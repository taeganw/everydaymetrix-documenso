// Replaces the "Return" link (to "/") in the sidebar footer of the signing page with a
// "Source code" link to our public AGPL-3.0 source (AGPL section 13). Clients only ever open
// /sign/<token>, and "/" has no useful destination for them.
//
// Patches the compiled bundle in place at pod start (see templates/deployment.yaml). The source
// edit this mirrors is in https://github.com/taeganw/everydaymetrix-documenso, file
// apps/remix/app/components/general/document-signing/document-signing-page-view-v2.tsx.
//
// Fails the pod loudly if a pattern is not found, so an image bump that moves the code is
// noticed instead of silently showing the Return link again.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BUILD = process.env.DOCUMENSO_BUILD_DIR || "build";
const SOURCE_URL = "https://github.com/taeganw/everydaymetrix-documenso";
const ANCHOR = 'embed--DocumentWidgetFooter mt-auto"';
const WINDOW = 900;
const IDENT = "[A-Za-z_$][\\w$]*";

// Each rule runs inside the footer window only. The server bundle is unminified
// (`jsxs(Link, { to: "/", children: [`); the client bundle is minified (`e.jsxs(tt,{to:"/",`).
const RULES = [
  // Link target.
  [
    new RegExp(`(${IDENT}),\\s*\\{\\s*to:\\s*"/"`),
    `$1, { to: "${SOURCE_URL}", target: "_blank", rel: "noopener noreferrer"`,
  ],
  // Drop the left-arrow icon.
  [
    new RegExp(
      `(?:/\\* @__PURE__ \\*/\\s*)?(?:jsx\\(${IDENT}|${IDENT}\\.jsx\\(${IDENT})\\s*,\\s*\\{\\s*className:\\s*"mr-2 h-4 w-4"\\s*\\}\\)\\s*,`,
    ),
    "null,",
  ],
  // Swap the translated "Return" label for plain text.
  [
    new RegExp(
      `(?:/\\* @__PURE__ \\*/\\s*)?(?:jsx\\(Trans|${IDENT}\\.jsx\\(${IDENT})\\s*,\\s*\\{\\s*(?:\\.\\.\\./\\*i18n\\*/\\s*\\{\\s*)?id:\\s*"vUOn9d"\\s*\\}?\\s*\\}\\)`,
    ),
    '"Source code"',
  ],
];

let patched = 0;
let already = 0;
for (const dir of ["server/assets", "client/assets"]) {
  for (const name of readdirSync(join(BUILD, dir))) {
    if (!name.endsWith(".js")) continue;
    const file = join(BUILD, dir, name);
    const src = readFileSync(file, "utf8");
    const at = src.indexOf(ANCHOR);
    if (at < 0) continue;
    let win = src.slice(at, at + WINDOW);
    if (win.includes(SOURCE_URL)) {
      already += 1;
      continue;
    }
    for (const [pattern, replacement] of RULES) {
      if (!pattern.test(win)) {
        console.error(`patch: ${pattern} not found in ${file}`);
        process.exit(1);
      }
      win = win.replace(pattern, replacement);
    }
    writeFileSync(file, src.slice(0, at) + win + src.slice(at + WINDOW));
    patched += 1;
  }
}

// Expect the server bundle plus the signing-page client chunk.
if (patched + already < 2) {
  console.error(
    `patch: expected at least 2 bundles, found ${patched + already}`,
  );
  process.exit(1);
}
console.log(`patch: patched ${patched}, already patched ${already}`);
