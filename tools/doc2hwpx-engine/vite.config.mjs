import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(here, "../..");
const ieumRoot = resolve(siteRoot, "ieumoffice");
const workspacePackages = ["doc2hwp","doc2docx","docx-engine","odt-engine","ppt2pptx","file-parse","epub-engine","pdf2docx","xlsx-gateway","zip-gate","agent-core","pptx-engine","font-metrics"];
const aliases = workspacePackages.map(name => ({find:"@genoffice/"+name,replacement:resolve(ieumRoot,"packages/"+name+"/src/index.ts")}));
aliases.push({find:"@genoffice/epub-engine/core",replacement:resolve(ieumRoot,"packages/epub-engine/src/core.ts")});\naliases.push({find:"@rhwp/core",replacement:resolve(ieumRoot,"vendor/rhwp-core/rhwp.js")});
export default {root:siteRoot,base:"/",resolve:{alias:aliases},worker:{format:"es"},build:{outDir:resolve(siteRoot,"tools/doc2hwpx-assets"),emptyOutDir:true,target:"es2022",sourcemap:false,minify:"esbuild",rollupOptions:{input:resolve(siteRoot,"tools/doc2hwpx-engine/entry.ts"),output:{entryFileNames:"doc2hwpx-engine.js",chunkFileNames:"assets/[name]-[hash].js",assetFileNames:"assets/[name]-[hash][extname]"}}}};
