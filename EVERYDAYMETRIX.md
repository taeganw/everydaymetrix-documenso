# Everyday Metrix modifications to Documenso

This repository is the corresponding source for the modified [Documenso](https://github.com/documenso/documenso)
community edition (AGPL-3.0) that serves `https://sign.everydaymetrix.com`, published to meet section 13 of the
AGPL-3.0. The full license is in [LICENSE](LICENSE). Upstream copyright notices are unchanged.

- **Base:** upstream tag `v2.17.0` (`https://github.com/documenso/documenso/tree/v2.17.0`).
- **Our change:** one source edit in
  [`document-signing-page-view-v2.tsx`](apps/remix/app/components/general/document-signing/document-signing-page-view-v2.tsx).
  The signing page sidebar's "Return" link (to `/`) is replaced by a "Source code" link to this repository.
- **How it is deployed:** we run the unmodified `documenso/documenso:v2.17.0` container image and apply the same
  edit to its compiled output at start-up with [`everydaymetrix/remove-return-button.mjs`](everydaymetrix/remove-return-button.mjs).
  Other customization (logo, colors, company details) uses Documenso's own Branding settings, not code changes.

## What is not in this repository

`packages/ee` is removed. It is licensed under the Documenso Commercial License, which does not allow us to
republish it, and it is not part of the AGPL-3.0 community edition. Files in this repository that import
`@documenso/ee` will not build without that package. To build, restore `packages/ee` from upstream under
its own license terms, or buy an Enterprise subscription from Documenso.

Documenso and its logo are trademarks of Documenso, Inc.
