// Removes the "Return" link (to "/") from the sidebar footer of the signing page. Clients only
// ever open /sign/<token>, and "/" has no useful destination for them.
//
// Patches the compiled bundle in place at pod start (see templates/deployment.yaml). The source
// line is in documenso/documenso apps/remix/app/components/general/document-signing/
// document-signing-page-view-v2.tsx: `{!isEmbed && (<div className="px-4">...<Return/>...)}`
// under `embed--DocumentWidgetFooter mt-auto`. The server build keeps `!isEmbed &&`, the client
// build minifies it to `!g&&`; both become a constant-false guard so SSR and hydration agree.
//
// Fails the pod loudly if the pattern is not found, so an image bump that moves the code is
// noticed instead of silently showing the button again.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BUILD = process.env.DOCUMENSO_BUILD_DIR || "build";
const PATTERN =
  /(embed--DocumentWidgetFooter mt-auto",\s*children:\s*)!([A-Za-z_$][\w$]*)\s*&&/g;
const PATCHED =
  /embed--DocumentWidgetFooter mt-auto",\s*children:\s*(?:false|!1)\s*&&/;

let patched = 0;
let already = 0;
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
    } else if (PATCHED.test(src)) {
      already += 1;
    }
  }
}

// Expect the server bundle plus the signing-page client chunk.
if (patched + already < 2) {
  console.error(
    `remove-return-button: expected at least 2 bundles, found ${patched + already}`,
  );
  process.exit(1);
}
console.log(
  `remove-return-button: patched ${patched}, already patched ${already}`,
);
