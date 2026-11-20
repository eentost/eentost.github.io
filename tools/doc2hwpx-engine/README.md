# doc2hwpx IeumOffice engine adapter

This directory contains the eentost browser integration adapter for the DOCX-to-HWPX conversion engine from [pblsketch/ieumoffice](https://github.com/pblsketch/ieumoffice).

- Upstream revision: 18cfc7150a2028487a2ae669a324d02bae93570a
- Upstream conversion packages: @genoffice/docx2hwp, @genoffice/docx-engine
- HWP/HWPX engine: @rhwp/core (rhwp WebAssembly)
- Runtime: browser Web Worker; the WASM binary is fetched lazily and gzip-decoded
- Output: HWPX, with the upstream feature-loss report

The upstream source is not modified. The adapter, worker bridge, page integration, and build workflow are original eentost changes. The generated distribution includes the applicable upstream LICENSE, NOTICE, rhwp MIT license, Unicode license, and third-party license inventory under tools/doc2hwpx-assets/licenses/.

Build is performed by .github/workflows/build-doc2hwpx-engine.yml. It checks out the pinned public upstream revision, installs its workspace dependencies, builds the browser bundle, compresses the WASM binary, and publishes the generated static assets to this repository.

This integration is not affiliated with, sponsored by, or endorsed by Mainfunc, Inc., the IeumOffice contributors, Edward Kim, or Hancom Inc. Product and company names are used only to identify the upstream components.
