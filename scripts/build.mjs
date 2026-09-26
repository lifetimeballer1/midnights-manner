import {mkdir,rm,cp,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of ['index.html','src','assets','data'])await cp(new URL(file,root),new URL(file,out),{recursive:true});
await writeFile(new URL('.nojekyll',out),'');
console.log('Static game built in dist/');
