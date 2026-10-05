import {readFile,writeFile} from 'node:fs/promises';

const load=async path=>JSON.parse(await readFile(path,'utf8'));
const buildings=await load('data/buildings.json');
const manifest=await load('data/art-manifest.json');
const external=await load('data/external_assets.json'),rights=external.catalogSources?.['game-assets-mixar'];
const approved=rights?.publicRedistributionPermitted===true&&rights.sourceSHA256==='3b9376e86a747414e3feded5d30b7e3a1e9e8446e3b8c832080f86b08e7b9e92';
const tiers={},hashes=new Set();

for(const [type,spec] of Object.entries(buildings)){
 const mapped={};
 for(let level=1;level<=spec.tiers.length;level++){
  const id=`mmr-${type}-${level}`,file=`assets/meshes/${id}.json`,mesh=await load(file),meta=mesh.meta;
  const sourceObject=`MMR | ${type} | T${String(level).padStart(2,'0')} Architecture`;
  if(meta?.format!=='mixar-building-v1'||meta.type!==type||meta.tier!==level||meta.footprint!==spec.size||meta.sourceObject!==sourceObject||meta.complete!==true||!/^[0-9a-f]{64}$/.test(meta.sourceSHA256)||approved&&!rights.exportSHA256?.includes(meta.sourceSHA256)){
   throw new Error(`Invalid actual source mesh: ${id}`);
  }
  hashes.add(meta.sourceSHA256);
  mapped[level]={id,file};
 }
  const stateful=['gate','trap','fire-trap'].includes(type);
  tiers[type]={enabled:!stateful,tiers:mapped,...(stateful?{holdReason:'Native orientation/defense state retained until source parts and pivots are mapped'}:{})};
}

manifest.buildings=tiers;
manifest.catalogSource={
 name:'Game Assets.mixar / Midnights Manner - Reference Redesign',
 sourceSHA256:'3b9376e86a747414e3feded5d30b7e3a1e9e8446e3b8c832080f86b08e7b9e92',
 exportSHA256:[...hashes].sort(),
 creator:approved?rights.creator:'User-provided Mixar source; not independently verified',
 license:approved?rights.license:'unverified',
 releaseStatus:approved?'approved-public':'local-only',
 ...(approved?{rightsEvidence:'game-assets-mixar'}:{}),
 note:approved?'Public redistribution authorized by user ownership attestation; not independently verified as CC0.':'Do not commit, publish, or redistribute these derivatives until source ownership and redistribution rights are verified.'
};
for(const [id,entry]of Object.entries(manifest.meshes).filter(([id])=>id.startsWith('catalog-'))){
  const mesh=await load(entry.file);
  if(approved&&(!rights.exportSHA256?.includes(mesh.meta?.sourceSHA256)||mesh.meta.sourceSHA256!==entry.sourceSHA256||mesh.meta.sourceObject!==entry.sourceObject))throw new Error(`Invalid catalog export provenance: ${id}`);
 entry.enabled=mesh.faces.length<=(entry.domain==='environment'?320:300);
 if(!entry.enabled)entry.holdReason='Complete source silhouette exceeds the existing per-model nature budget; procedural fallback retained';
 else delete entry.holdReason;
 entry.creator=manifest.catalogSource.creator;entry.license=approved?rights.license:'UNVERIFIED';entry.releaseStatus=manifest.catalogSource.releaseStatus;
 if(approved)entry.rightsEvidence='game-assets-mixar';else delete entry.rightsEvidence;
 entry.modifications=['GLB node transform baked','Y-up to Z-up','ground-centered pivot and uniform target height','atlas sampled to existing flat palette','full source geometry retained; convex coplanar faces merged, no QEM or grid clustering'];
 mesh.meta.releaseStatus=entry.releaseStatus;if(approved)mesh.meta.rightsEvidence='game-assets-mixar';
 await writeFile(entry.file,JSON.stringify(mesh)+'\n');
}
await writeFile('data/art-manifest.json',JSON.stringify(manifest,null,1)+'\n');

const rows=Object.entries(buildings).map(([type,spec])=>{
 const ids=Array.from({length:spec.tiers.length},(_,i)=>`mmr-${type}-${i+1}.json`);
 return `| \`${type}\` | ${spec.name} | ${spec.tiers.length} | \`${ids.join('\`, \`')}\` | ${tiers[type].enabled?'mapped':'native state fallback'} |`;
});
const coverage=`# Art Coverage\n\n## Source And Rights\n\nThe actual building derivatives come from the user-provided \`${manifest.catalogSource.name}\` catalog. Source SHA-256: \`${manifest.catalogSource.sourceSHA256}\`. The export GLB hashes are recorded in \`data/art-manifest.json\` and each mesh's \`meta.sourceSHA256\`. Authorship and redistribution rights are not independently verified; this integration is **local-only** and must not be committed, published, or redistributed until those rights are confirmed.\n\n## Game Buildings\n\nEvery current game building ID and its existing authored tier count maps to the matching \`MMR | <id> | T<NN> Architecture\` object. The runtime uses the actual flat-face conversion through the existing Canvas renderer. Model loads are on-demand by placed type/tier; disabled, missing, invalid, unfinished, and ruined assets keep the procedural fallback. Tier counts, footprints, collisions, simulation, and saves are unchanged.\n\n| Game ID | Display name | Tiers | Converted source files | State |\n| --- | --- | ---: | --- | --- |\n${rows.join('\n')}\n\nCoverage is enforced by \`tests/art-coverage.test.js\`; regenerate registrations with \`node scripts/register-mixar-building-catalog.mjs\`.\n\n## Remaining Catalog Work\n\nThese source groups are not yet integrated. Their existing procedural, sprite, and previously reviewed CC0 paths remain active. Each row has a concrete integration gate; source rights are unverified unless a separate record says otherwise.\n\n| Source group | Catalog count | State | Blocker before integration |\n| --- | ---: | --- | --- |\n| Characters | 73 variants / 37 game professions | queued | Map variants to all existing troop/enemy archetypes; validate rigs, clips, pivots, anchors, LOD budgets, and source rights. |\n| Equipment | 88 forms | queued | Map item IDs to attachment anchors and ensure hand/back/chest silhouettes stay inside the baked-pose budgets. |\n| Terrain blocks | 15 | queued | Match the five biome routes, ground heights, camera projection, phone caps, and deterministic tile ownership. |\n| Vegetation and nature | 45 + 45 variants | queued | Select per-biome silhouettes, ground pivots, wind anchors, and scenery budget winners. |\n| Props | 21 forms | queued | Map only useful forms to existing building/job consumers and check overlap with shipped props. |\n| Resource piles | 40 stages | queued | Match the 10 resource keys and four reserve stages without changing reserve/gameplay contracts. |\n| Faction camps | 5 | queued | Map to existing faction camp definitions, preserve selection/lore, and stay inside scenery caps. |\n| Landmarks | 10 | queued | Map to existing world hotspot IDs and preserve their selectable location/pivot. |\n| Animation source collections | 6 | queued | Bake only verified named clips offline; no runtime skeletal-animation loader. |\n`;
const updatedCoverage=coverage
 .replace('These source groups are not yet integrated.','These source groups are queued or partially integrated.')
 .replace('| Vegetation and nature | 45 + 45 variants | queued | Select per-biome silhouettes, ground pivots, wind anchors, and scenery budget winners. |','| Vegetation and nature | 45 + 45 variants | partial | Seven tree meshes converted intact: `catalog-tree-single-a` and A-small/A-medium enabled; four larger clusters held over the 320-face budget. `catalog-resource-stone` supplies shore/path stones. Remaining biomes/forms and source-specific wind anchors are queued. |')
 .replace('| Resource piles | 40 stages | queued | Match the 10 resource keys and four reserve stages without changing reserve/gameplay contracts. |','| Resource piles | 40 stages | partial | `catalog-resource-lumber` supplies complete scale-stepped sawmill stacks; other resource keys and distinct authored stages remain queued. |');
const rightsCoverage=approved?updatedCoverage.replace('Authorship and redistribution rights are not independently verified; this integration is **local-only** and must not be committed, published, or redistributed until those rights are confirmed.','The user attested ownership of the entire catalog and authorized public-repository redistribution on 2026-10-05. Evidence is retained in `data/external_assets.json` under `catalogSources.game-assets-mixar`. This is user-attested permission, not an independently verified CC0 license.').replace('source rights are unverified unless a separate record says otherwise.','the catalog permission is user-attested; third-party source licenses are not inferred from appearance.'):updatedCoverage;
await writeFile('docs/ART_COVERAGE.md',rightsCoverage);
console.log(`Registered ${Object.keys(tiers).length} building families / ${Object.values(tiers).reduce((n,e)=>n+Object.keys(e.tiers).length,0)} tiers; ${hashes.size} export hashes.`);
