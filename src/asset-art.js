// Converted CC0 mesh adapter. Renderer-only, no save fields.
// Meshes are offline exports (scripts/export-art.py): {faces:[{v:[[x,y,z]x3],c:'#hex'}]},
// modeled in tile units around origin, ground at z=0. drawMesh places them at
// a tile anchor through MeshScene.face so lighting, orbit, picking and caches
// behave like native geometry. Far zoom draws only the largest-area faces
// first (the exporter sorts largest-first), keeping silhouettes cheap.
const cache = new Map();
const flatValidation=new WeakMap();
export function validFlatMesh(mesh){
 if(!mesh||typeof mesh!=='object')return false;
 if(flatValidation.has(mesh))return flatValidation.get(mesh);
 const valid=Array.isArray(mesh.faces)&&mesh.faces.length>0&&mesh.faces.length<=3000&&mesh.faces.every(f=>{
  if(!f||!/^#[0-9a-f]{6}$/i.test(f.c)||!Array.isArray(f.v)||f.v.length<3||f.v.length>64||!f.v.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return false;
  const [a,b,c]=f.v,u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
  return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-8;
 });
 flatValidation.set(mesh,valid);return valid;
}

export function artEnabled(data, id) {
  const manifest = data?.artManifest ?? data?.['art-manifest'];
  const entry = manifest?.meshes?.[id] ?? manifest?.baked?.[id];
  return entry?.enabled === true;
}

export function lodFaceCount(total, zoom, quality) {
  const q = quality?.maxEffects ?? 60;
  if (zoom < 0.75) return Math.min(total, 12);
  if (zoom < 1.2) return Math.min(total, q >= 60 ? 60 : 24);
  return total;
}

export function drawMesh(s, mesh, x, y, opts = {}) {
  if (!validFlatMesh(mesh)) return 0;
  const zoom = s.r?.cam?.zoom ?? 1.65;
  const n = lodFaceCount(mesh.faces.length, zoom, s.r?.qualityCfg);
  const dx = opts.dx ?? 0, dy = opts.dy ?? 0, dz = opts.dz ?? 0, scale = Number.isFinite(opts.scale) && opts.scale > 0 ? opts.scale : 1;
  const prev = s.owner;
  if (opts.owner !== undefined) s.owner = opts.owner;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    const f = mesh.faces[i];
    if (!f || !Array.isArray(f.v) || f.v.length < 3 || typeof f.c !== 'string') continue;
    s.face(f.v.map(([vx, vy, vz]) => [x + vx * scale + dx, y + vy * scale + dy, vz * scale + dz]), f.c);
    drawn++;
  }
  s.owner = prev;
  return drawn;
}

export function meshBounds(mesh) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const f of mesh?.faces || []) for (const [x, y, z] of f.v || []) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  return {x0, y0, z0, x1, y1, z1};
}

export function cachedMesh(key, doc) {
  if (!cache.has(key)) cache.set(key, doc);
  return cache.get(key);
}

// Converted-mesh workplace accents. Augment-only: targeted buildings keep
// every procedural face, meshes add readable trade props at footprint edges.
// Missing/disabled meshes, ruins and scaffolds render exactly the original
// look. Pinned baseline buildings (hall, cottage, tower, walls, gates, mill,
// sawmill, great works) are deliberately excluded so their frozen digests
// only move in a dedicated architecture pass.
const ACCENTS = {
  barracks: [['dummy', .15, .15], ['weapon-stand', .55, .1]],
  schoolroom: [['book-stand', .3, .3]],
  scriptorium: [['book-stand', .3, .3]],
  storehouse: [['crate', .1, .15], ['barrel', .6, .1]],
  market: [['crate-apple', .1, .7]],
  farm: [['crate-carrot', .1, .7]],
  forge: [['workbench', .55, .05]],
  longhouse: [['pennant', .45, .4, .95]],
  timber_yard: [['log-stack', .1, .1]],
  pasture: [['fence', .05, .05]],
};
// Compact KayKit structural modules supplement, never replace, authored tiers.
// Roof anchors follow each family's existing roof rather than the tile center.
const BUILDING_ROOFS = {
  hall: [.5, .68, l => .42+l*.16+(.4+l*.05)*.55],
  cottage: [.5, .68, l => .42+l*.16+(.36+l*.06)*.55],
  barracks: [.5, .68, l => .42+l*.16+(.42+l*.06)*.55],
  farm: [.335, .4, l => .42+l*.16+(.34+l*.05)*.55],
  lumber: [.34, .36, l => .36+l*.1+(.28+l*.04)*.55],
  mine: [.5, .4, l => .88+(.22+l*.04)*.55],
  market: [.63, .7, l => .42+l*.13+(.32+l*.05)*.55],
  forge: [.5, .68, l => .42+l*.16+(.42+l*.06)*.55],
};
export function addConvertedAccents(s, b, spec) {
  const list = ACCENTS[b.type];
  if (!list || b.id == null || b.hp <= 0 || b.remaining > 0) return 0;
  const meshes = s.r?.meshes;
  if (!meshes) return 0;
  const n = spec?.size || 1;
  let added = 0;
  for (const [id, fx, fy, fz] of list) {
    const doc = meshes[id];
    if (!doc || !artEnabled(s.r?.data, id)) continue;
    added += drawMesh(s, doc, b.x + n * fx, b.y + n * fy, {dz: fz ?? 0});
  }
  return added;
}
export function addConvertedBuildingTiers(s, b, spec) {
  if (b.id == null || b.hp <= 0 || b.remaining > 0) return 0;
  const roof = BUILDING_ROOFS[b.type], l = b.level;
  if (!roof || l < 2 || (s.r?.cam?.zoom ?? 1.65) < 1.35) return 0;
  const meshes = s.r?.meshes, n = spec.size;
  if (!meshes) return 0;
  let added = 0;
  const modules = [['fence', Math.max(.44,n*.25), n-.12, .12]];
  if (l >= 5) modules.push(['roof-gable', n*roof[0], n*roof[1], roof[2](l)]);
  if (l >= 6) modules.push(['fence', n-.44, .16, .12]);
  const budget = s.r.width < 600 ? 800 : 1400;
  for (const [id, x, y, z] of modules) {
    const doc = id === 'fence' && l >= 4 ? meshes[id]?.variants?.stone : meshes[id];
    if (!artEnabled(s.r.data,id) || !doc?.faces?.length || (s.buildingArtFaces || 0)+doc.faces.length > budget) continue;
    const count = drawMesh(s,doc,b.x+x,b.y+y,{dz:z});
    s.buildingArtFaces = (s.buildingArtFaces || 0)+count;
    added += count;
  }
  return added;
}

const catalogValidation=new WeakMap();
const catalogBounds=new WeakMap();
export function createCatalogBuildingLoader(renderer,manifest,baseUrl,fetcher=globalThis.fetch,onError=()=>{},maxEntries=32){
 const pending=new Map(),failed=new Set(),recent=new Map(),limit=Math.max(1,Math.floor(maxEntries)||32);
 const queue=[];let active=0;
 const pump=()=>{
  while(queue.length&&active<(renderer.width<600?2:3)){
   const job=queue.shift();active++;
   let response;
   try{response=fetcher(new URL(`../${job.asset.file}`,baseUrl));}catch(error){response=Promise.reject(error);}
   Promise.resolve(response)
    .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})
    .then(mesh=>{if(!mesh||typeof mesh!=='object')throw new Error('Invalid building asset payload');(renderer.meshes??={})[job.asset.id]=mesh;touch(job.asset.id);renderer._meshStatic=null;renderer._trailStatic=null;return mesh;})
    .catch(error=>{failed.add(job.asset.id);try{onError(job.asset.id,error);}catch(reportError){console.warn('Building art error reporter failed',reportError);}return null;})
    .then(mesh=>{pending.delete(job.asset.id);active--;pump();job.resolve(mesh);});
  }
 };
 const touch=id=>{
  if(!renderer.meshes?.[id])return;
  recent.delete(id);recent.set(id,true);
  const cap=renderer.width<600?Math.min(limit,16):limit;
  while(recent.size>cap){const oldest=recent.keys().next().value;recent.delete(oldest);delete renderer.meshes[oldest];}
 };
 const load=(type,tier)=>{
  const entry=manifest?.buildings?.[type],asset=entry?.tiers?.[tier];
  if(entry?.enabled!==true||!asset?.id||!asset.file||failed.has(asset.id))return Promise.resolve(null);
  if(renderer.meshes?.[asset.id]){touch(asset.id);return Promise.resolve(renderer.meshes[asset.id]);}
  if(pending.has(asset.id))return pending.get(asset.id);
  let resolve;const request=new Promise(done=>{resolve=done;});
  pending.set(asset.id,request);queue.push({asset,resolve});pump();
  return request;
 };
 load.touch=touch;
 return load;
}

function validCatalogMesh(mesh){
 if(!mesh||typeof mesh!=='object')return false;
 if(catalogValidation.has(mesh))return catalogValidation.get(mesh);
 const faceValid=f=>f&&/^#[0-9a-f]{6}$/i.test(f.c)&&Number.isFinite(f.e)&&f.e>=0&&f.e<=1&&Array.isArray(f.v)&&f.v.length>=3&&f.v.length<=64&&f.v.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)&&Math.abs(v[0])<=mesh.meta.footprint/2&&Math.abs(v[1])<=mesh.meta.footprint/2&&v[2]>=0&&v[2]<=4);
 const valid=mesh.meta?.format==='mixar-building-v1'&&mesh.meta.complete===true&&/^[0-9a-f]{64}$/.test(mesh.meta.sourceSHA256)&&Number.isFinite(mesh.meta.footprint)&&validFlatMesh(mesh)&&validFlatMesh(mesh.lods?.low)&&[mesh.faces,mesh.lods.low.faces].every(f=>f.every(faceValid))&&Array.isArray(mesh.sources)&&mesh.sources.length<=12&&mesh.sources.every(p=>p&&Array.isArray(p.position)&&p.position.length===3&&p.position.every(Number.isFinite)&&Array.isArray(p.direction)&&p.direction.length===2&&p.direction.every(Number.isFinite)&&Number.isFinite(p.radius)&&p.radius>0&&p.radius<=3&&Number.isFinite(p.power)&&p.power>0&&p.power<=1&&['window','fire','lantern','torch'].includes(p.profile));
 catalogValidation.set(mesh,valid);
 if(valid)catalogBounds.set(mesh,meshBounds(mesh));
 return valid;
}

// Whole authored building bodies need complete geometry, not drawMesh's
// first-N-faces detail LOD. The existing embellishment budget stays separate.
function catalogTriangle(s,v,color,doubleSided){
 const lengths=v.map((a,i)=>Math.hypot(...a.map((p,j)=>p-v[(i+1)%3][j])));
 const edge=lengths.indexOf(Math.max(...lengths));
 if(lengths[edge]<=s.subdivision){s.face(v,color,false,doubleSided);return;}
 const a=v[edge],b=v[(edge+1)%3],c=v[(edge+2)%3],mid=a.map((p,i)=>(p+b[i])/2);
 catalogTriangle(s,[a,mid,c],color,doubleSided);catalogTriangle(s,[mid,b,c],color,doubleSided);
}

export function drawCatalogBuilding(s,b,spec){
 // These sources have no verified orientation/animation mapping yet.
 if(['gate','trap','fire-trap'].includes(b.type))return false;
 if(b.id==null||b.hp<=0||b.remaining>0)return false;
 const r=s.r,entry=(r?.data?.artManifest??r?.data?.['art-manifest'])?.buildings?.[b.type];
 if(entry?.enabled!==true)return false;
  const tier=entry.tiers?.[b.level];
  if(!tier?.id)return false;
  const center=r.project?.(b.x+spec.size/2,b.y+spec.size/2,2);
  if(center&&(center.x<-360||center.x>r.width+360||center.y<-420||center.y>r.height+420)){
   s.owner={kind:'building',id:b.id};s.alpha=1;(s.catalogOwners??=new Set()).add(b.id);return true;
  }
  // A scene with more distinct bodies than the cache can hold keeps the rest
  // procedural rather than continuously evicting and refetching visible tiers.
  const demand=s.catalogDemand??=new Set(),cap=r.width<600?16:32;
  if(!demand.has(tier.id)&&demand.size>=cap)return false;
  demand.add(tier.id);
  const mesh=r.meshes?.[tier.id];
  if(!mesh){
   r.requestCatalogBuilding?.(b.type,b.level);return false;
 }
 r.touchCatalogBuilding?.(tier.id);
 if(!validCatalogMesh(mesh)||mesh.meta.type!==b.type||mesh.meta.tier!==b.level||mesh.meta.footprint!==spec.size)return false;
 const budget=r.width<600?3000:6000,used=s.catalogFaces||0;
 let faces=r.cam.zoom>=(r.width<600?2.4:1.9)?mesh.faces:mesh.lods.low.faces;
 if(used+faces.length>budget)faces=mesh.lods.low.faces;
 if(used+faces.length>budget)return false;
 const bounds=catalogBounds.get(mesh),x=b.x+spec.size/2,y=b.y+spec.size/2;
 const corners=[];
 for(const vx of [bounds.x0,bounds.x1])for(const vy of [bounds.y0,bounds.y1])for(const vz of [bounds.z0,bounds.z1])corners.push(r.project(x+vx,y+vy,vz));
 s.owner={kind:'building',id:b.id};s.alpha=1;
 (s.catalogOwners??=new Set()).add(b.id);
 if(corners.every(p=>p.x<-80)||corners.every(p=>p.x>r.width+80)||corners.every(p=>p.y<-80)||corners.every(p=>p.y>r.height+80))return true;
  const emissive=s.emissive,fixture=s.fixture,bias=s.depthBias,start=s.faces.length;
 for(const f of faces){
  s.emissive=f.e;s.fixture=f.e>0;
  // Two-sided source sheets sit just above gable mass. Like native panes,
  // they need a small painter-order offset to avoid ceiling bleed-through.
  s.depthBias=bias+(f.d===true?.18:0);
  const vertices=f.v.map(([vx,vy,vz])=>[x+vx,y+vy,vz]);
  if(vertices.length===4)s.face(vertices,f.c,true,f.d===true);
  else for(let i=1;i<vertices.length-1;i++)catalogTriangle(s,[vertices[0],vertices[i],vertices[i+1]],f.c,f.d===true);
  }
  // Only emitted body faces are evidence: ownership includes offscreen bodies,
  // and the parsed cache can contain invalid or budget-rejected payloads.
  for(let i=start;i<s.faces.length;i++)s.faces[i].catalogMesh=tier.id;
  s.emissive=emissive;s.fixture=fixture;s.depthBias=bias;s.catalogFaces=used+faces.length;
 for(const p of mesh.sources)s.source([x+p.position[0],y+p.position[1],p.position[2]],p.direction,p.radius,p.power,p.profile);
  return true;
}

export function catalogBuildingRenders(r){
 const renders=new Map();
 for(const f of r._meshStatic?.faces||[]){
  if(!f.catalogMesh||f.owner?.kind!=='building')continue;
  const [x0,y0,x1,y1]=f.bounds;
  if(x1<=0||y1<=0||x0>=r.width||y0>=r.height)continue;
  const id=f.owner.id;
  if(!renders.has(id))renders.set(id,{buildingId:id,meshId:f.catalogMesh,faces:0});
  renders.get(id).faces++;
 }
 return [...renders.values()];
}
