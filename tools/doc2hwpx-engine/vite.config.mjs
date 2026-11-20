import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(here, "../..");
const ieumRoot = resolve(siteRoot, "ieumoffice");
const aliases = [
  {find:"@genoffice/agent-core/redact-range",replacement:resolve(ieumRoot,"packages/agent-core/src/redact-range.ts")},
  {find:"@genoffice/epub-engine/core",replacement:resolve(ieumRoot,"packages/epub-engine/src/core.ts")},
  {find:"@genoffice/xlsx-gateway/",replacement:resolve(ieumRoot,"packages/xlsx-gateway/src")+"/"},
  ...["doc2hwp","doc2docx","docx-engine","odt-engine","ppt2pptx","file-parse","epub-engine","pdf2docx","pdf-structure","xlsx-gateway","zip-gate","agent-core","pptx-engine","font-metrics","xmind-engine","i18n"].map(name=>({find:"@genoffice/"+name,replacement:resolve(ieumRoot,"packages/"+name+"/src/index.ts")})),
  {find:"@rhwp/core",replacement:resolve(ieumRoot,"vendor/rhwp-core/rhwp.js")}
];
export default {root:siteRoot,base:"/",resolve:{alias:aliases},worker:{format:"es"},build:{outDir:resolve(siteRoot,"tools/doc2hwpx-assets"),emptyOutDir:true,target:"es2022",sourcemap:false,minify:"esbuild",rollupOptions:{input:resolve(siteRoot,"tools/doc2hwpx-engine/entry.ts"),output:{entryFileNames:"doc2hwpx-engine.js",chunkFileNames:"assets/[name]-[hash].js",assetFileNames:"assets/[name]-[hash][extname]"}}}};
