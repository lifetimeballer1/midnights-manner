// Home-only survival pacing. Deadlines are rolled once and saved with the world.
// Campaign timelines and explicit defense tests remain under their own control.
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function directorConfig(data) {
 const c=data.world.homeRaids?.director||{};
 return {minQuiet:Math.max(60,c.minQuiet??240),maxQuiet:Math.max(c.minQuiet??240,c.maxQuiet??480),recovery:Math.max(60,c.recovery??180),defeatRecovery:Math.max(120,c.defeatRecovery??360),warning:Math.max(15,c.warning??25)};
}
// New defenses draw attention: a walled, towered, trapped town reads
// richer to scouts, so the director answers heavier walls with heavier
// parties through the normal score path (party size, quiet span).
export const NEW_DEFENSES=['gate','rampart','archer_tower','ballista'];
export function defenseValue(world) {
 return (world.buildings||[]).filter(b=>b.hp>0&&b.remaining<=0&&NEW_DEFENSES.includes(b.type)).length;
}
export function settlementThreat(state) {
 const w=state.world;
 const factors={buildings:Math.min(25,w.buildings.filter(b=>b.hp>0).length),population:Math.min(20,w.troops.length),wealth:Math.min(20,Math.floor(Object.values(w.resources).reduce((a,n)=>a+Math.max(0,Number(n)||0),0)/250)),progress:Math.min(20,Math.max(0,(state.vlevel||1)-1)*2+(state.completed||[]).length+(state.research?.completed||[]).length),victories:Math.min(15,w.wave||0),defenses:Math.min(10,defenseValue(w))};
 const score=Math.min(100,Object.values(factors).reduce((a,b)=>a+b,0));
 return {score,label:score<30?'Low':score<60?'Rising':'High',factors};
}
export function ensureDirector(world,data) {
 if(world.director?.version===1)return world.director;
 const cfg=directorConfig(data),now=world.elapsed||0;
 world.director={version:1,recoveryUntil:0,lastOutcome:null};
 // Preserve the gentle first scouts and future old deadlines. Overdue saves
 // receive a quiet window rather than an immediate surprise attack.
 if(!Number.isFinite(world.nextRaidAt)||world.nextRaidAt<now)world.nextRaidAt=now+cfg.minQuiet;
 return world.director;
}
export function scheduleRecovery(state,data,won,random=Math.random) {
 const w=state.world,d=ensureDirector(w,data),cfg=directorConfig(data);
 const damage=w.buildings.filter(b=>b.hp<data.buildings[b.type].tiers[b.level-1].hp).length;
 const recovery=(won?cfg.recovery:cfg.defeatRecovery)+Math.min(120,damage*10);
 d.recoveryUntil=w.elapsed+recovery;d.lastOutcome=won?'victory':'defeat';
 // Threat shortens only the random portion: even a rich city gets quiet time.
 const span=(cfg.maxQuiet-cfg.minQuiet)*(1-settlementThreat(state).score/200);
 const roll=clamp(Number(random())||0,0,1);
 w.nextRaidAt=w.elapsed+Math.max(recovery,cfg.minQuiet+roll*span);
 return d;
}
export function directorParty(state,data) {
 const c=data.world.homeRaids||{},w=state.world;
 if(!w.wave)return c.firstCount??2;
 // Late war (Phase 12): the ladder answers high villages with heavier
 // parties through the normal score path. Missing config reads zero.
 let bonus=0;
 try{
  const ladder=(data.endgame?.threatLadder||[]).filter(t=>(state.vlevel||1)>=(t.minLevel||Infinity));
  if(ladder.length)bonus=Math.max(...ladder.map(t=>t.partyBonus||0));
 }catch{}
 return Math.min(c.maxCount??8,(c.baseCount??3)+w.wave*(c.perWave??1)+Math.floor(settlementThreat(state).score/35)+bonus);
}
export function survivalStatus(state,data) {
 const w=state.world,threat=settlementThreat(state);
 const recovery=Math.max(0,Math.ceil((w.director?.recoveryUntil||0)-w.elapsed));
 return {...threat,recovery,phase:w.raidPending?'warning':w.enemies.length?'battle':recovery?'recovery':'quiet'};
}
