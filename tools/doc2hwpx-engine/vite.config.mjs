import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(here, "../..");
const ieumRoot = resolve(siteRoot, "ieumoffice");

export default {
  root: siteRoot,
  base: "./",
  resolve: {
    alias: [
      {
        find: /^@genoffice\\/docx2hwp$/,
        replacement: resolve(ieumRoot, "packages/docx2hwp/src/index.ts"),
      },
      {
        find: /^@rhwp\\/core$/,
        replacement: resolve(ieumRoot, "vendor/rhwp-core/rhwp.js"),
      },
    ],
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: resolve(siteRoot, "tools/doc2hwpx-assets"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      input: resolve(siteRoot, "tools/doc2hwpx-engine/entry.ts"),
      output: {
        entryFileNames: "doc2hwpx-engine.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
};
