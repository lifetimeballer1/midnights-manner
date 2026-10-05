import {createHash} from 'node:crypto';

export function assertReleaseRights(manifest,localPreview=false,external={}){
 const unverified=entry=>entry&&(entry.releaseStatus==='local-only'||/^unverified$/i.test(entry.license||''));
 const blocked=[manifest.catalogSource,...Object.values(manifest.meshes||{}),...Object.values(manifest.baked||{}),...Object.values(manifest.gear||{})].filter(unverified);
 if(blocked.length&&!localPreview)throw new Error('Build blocked: unverified asset rights. Resolve redistribution evidence before release; --local-preview is for local testing only.');
 if(!localPreview&&Object.keys(manifest.buildings||{}).length){
  const source=manifest.catalogSource,evidence=external.catalogSources?.[source?.rightsEvidence];
   if(source?.releaseStatus!=='approved-public'||evidence?.publicRedistributionPermitted!==true||evidence.sourceSHA256!==source.sourceSHA256)throw new Error('Build blocked: building catalog permission evidence is missing or mismatched.');
  }
  if(!localPreview)for(const [id,entry] of [['catalogSource',manifest.catalogSource],...Object.entries(manifest.meshes||{})].filter(([id,entry])=>entry&&(id.startsWith('catalog-')||entry.rightsEvidence))){
   const evidence=external.catalogSources?.[entry.rightsEvidence];
   if(entry.releaseStatus!=='approved-public'||evidence?.publicRedistributionPermitted!==true||evidence.sourceSHA256!==manifest.catalogSource?.sourceSHA256)throw new Error('Build blocked: missing or mismatched catalog redistribution evidence.');
   const exports=id==='catalogSource'?entry.exportSHA256:[entry.sourceSHA256];
   if(!Array.isArray(exports)||!exports.length||exports.some(hash=>!evidence.exportSHA256?.includes(hash)))throw new Error('Build blocked: catalog export provenance is missing or mismatched.');
  }
}

export async function assertCatalogProvenance(manifest,external,files,read){
 assertReleaseRights(manifest,false,external);
 const registered=new Map();
 for(const [type,entry]of Object.entries(manifest.buildings||{}))for(const [tier,asset]of Object.entries(entry.tiers||{}))registered.set('./'+asset.file,{type,tier:Number(tier)});
 for(const [id,entry]of Object.entries(manifest.meshes||{}))if(id.startsWith('catalog-'))registered.set('./'+entry.file,entry);
 for(const file of files.filter(file=>/^\.\/assets\/meshes\/(?:mmr-[^/]+\.json|catalog\/)/.test(file))){
  const entry=registered.get(file);
  if(!entry)throw new Error(`Build blocked: unregistered catalog file ${file}`);
  const {meta}=JSON.parse(await read(file)),source=manifest.catalogSource,evidence=external.catalogSources?.[entry.rightsEvidence||source.rightsEvidence];
  if(!meta||!evidence.exportSHA256.includes(meta.sourceSHA256)||(entry.type?(meta.format!=='mixar-building-v1'||meta.type!==entry.type||meta.tier!==entry.tier||!source.exportSHA256.includes(meta.sourceSHA256)):(meta.sourceSHA256!==entry.sourceSHA256||meta.sourceObject!==entry.sourceObject||meta.rightsEvidence!==entry.rightsEvidence||meta.releaseStatus!==entry.releaseStatus)))throw new Error(`Build blocked: catalog file export provenance mismatch ${file}`);
 }
 for(const file of registered.keys())if(!files.includes(file))throw new Error(`Build blocked: missing registered catalog file ${file}`);
}

export async function contentBuildId(seed,files,read,precache=[]){
 const hash=createHash('sha256').update(seed).update(JSON.stringify(precache));
 for(const file of files)hash.update(file).update(await read(file));
 return hash.digest('hex').slice(0,16);
}
