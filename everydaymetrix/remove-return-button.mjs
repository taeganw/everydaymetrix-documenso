// Removes the "Return" link (to "/") from the sidebar footer of the signing page. Clients only
// ever open /sign/<token>, and "/" has no useful destination for them. Also rebrands the tab title
// suffix ("- Documenso") to "- Everyday Metrix".
//
// Patches the compiled bundle in place at pod start (see templates/deployment.yaml). The source
// line is in documenso/documenso apps/remix/app/components/general/document-signing/
// document-signing-page-view-v2.tsx: `{!isEmbed && (<div className="px-4">...<Return/>...)}`
// under `embed--DocumentWidgetFooter mt-auto`. The server build keeps `!isEmbed &&`, the client
// build minifies it to `!g&&`; both become a constant-false guard so SSR and hydration agree.
//
// Fails the pod loudly if the pattern is not found, so an image bump that moves the code is
// noticed instead of silently showing the button again.
import {
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const BUILD = process.env.DOCUMENSO_BUILD_DIR || "build";
const PATTERN =
  /(embed--DocumentWidgetFooter mt-auto",\s*children:\s*)!([A-Za-z_$][\w$]*)\s*&&/g;
const PATCHED =
  /embed--DocumentWidgetFooter mt-auto",\s*children:\s*(?:false|!1)\s*&&/;

// Client chunks are cached for a year under their hashed name (Cloudflare edges and browsers), so
// a patched chunk keeps serving its stock copy to anyone who loaded it before, and so do the chunks
// that import it. Rename each patched client chunk and, transitively, every client chunk that
// references a renamed one, then rewrite all references (server bundle included, which is not
// cached and is where the HTML gets its entry names). Bump REV whenever the patch changes.
const REV = "em2";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const baseOf = (file) => file.slice(file.lastIndexOf("/") + 1);

function renameClosure(roots) {
  const clientAssets = join(BUILD, "client/assets");
  const renamed = new Map(); // old basename -> new basename
  const queue = [...roots];
  const texts = new Map(); // path -> text, for files rewritten in this pass
  const files = walk(BUILD).filter((f) => /\.(js|mjs|json|html)$/.test(f));
  for (const f of files) texts.set(f, readFileSync(f, "utf8"));

  while (queue.length > 0) {
    const file = queue.shift();
    const oldBase = baseOf(file);
    if (renamed.has(oldBase)) continue;
    const newBase = oldBase.replace(/\.js$/, `-${REV}.js`);
    renamed.set(oldBase, newBase);
    for (const [other, text] of texts) {
      if (!text.includes(oldBase)) continue;
      texts.set(other, text.split(oldBase).join(newBase));
      if (other.startsWith(clientAssets) && !renamed.has(baseOf(other))) {
        queue.push(other);
      }
    }
  }

  for (const [path, text] of texts) writeFileSync(path, text);
  // Files were rewritten under their old paths; now move the renamed ones.
  for (const [oldBase, newBase] of renamed) {
    renameSync(
      join(BUILD, "client/assets", oldBase),
      join(BUILD, "client/assets", newBase),
    );
  }
  return renamed.size;
}

// The tab title comes from lingui catalogs ("Sign Document - Documenso", one entry per locale in
// the server and client web-*.js chunks). Swap the brand suffix; client chunks get renamed below.
const TITLE_BRAND = / - Documenso(?=\\?["'`])/g;

let patched = 0;
let already = 0;
let titles = 0;
const renames = [];
for (const file of walk(BUILD)) {
  if (!/\.m?js$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  if (!TITLE_BRAND.test(src)) continue;
  TITLE_BRAND.lastIndex = 0;
  writeFileSync(file, src.replace(TITLE_BRAND, " - Everyday Metrix"));
  titles += 1;
  if (file.startsWith(join(BUILD, "client/assets"))) renames.push(file);
}
for (const dir of ["server/assets", "client/assets"]) {
  for (const name of readdirSync(join(BUILD, dir))) {
    if (!name.endsWith(".js")) continue;
    const file = join(BUILD, dir, name);
    const src = readFileSync(file, "utf8");
    if (!src.includes("embed--DocumentWidgetFooter mt-auto")) continue;
    if (PATTERN.test(src)) {
      PATTERN.lastIndex = 0;
      writeFileSync(file, src.replace(PATTERN, "$1false&&"));
      patched += 1;
      if (dir.startsWith("client")) renames.push(file);
    } else if (PATCHED.test(src)) {
      already += 1;
    }
  }
}

const renamedCount = renames.length > 0 ? renameClosure(renames) : 0;

// Expect the server bundle plus the signing-page client chunk.
if (patched + already < 2 || titles === 0) {
  console.error(
    `remove-return-button: expected at least 2 bundles, found ${patched + already}, title files ${titles}`,
  );
  process.exit(1);
}
console.log(
  `remove-return-button: patched ${patched}, already patched ${already}, titles ${titles}, renamed ${renamedCount}`,
);
