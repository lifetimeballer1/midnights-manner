import {mkdir,rm,cp,writeFile,readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {version}=require('../package.json');
const root=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of ['index.html','manifest.webmanifest','src','assets','data'])await cp(new URL(file,root),new URL(file,out),{recursive:true});
await writeFile(new URL('.nojekyll',out),'');
console.log(`Static game built in dist/ (sw cache midnights-manner-v${version}, ${files.length} precached)`);
