import {refreshProduction,productionSnapshot} from './steward-production.js';
import {fitEquipment,equipmentSnapshot} from './steward-equipment.js';
import {constructionSnapshot,advanceConstruction} from './steward-construction.js';
import {blueprintSnapshot} from './steward-blueprints.js';
import {refreshDistricts,districtSnapshot} from './steward-districts.js';
import {refreshCoverage,coverageSnapshot} from './steward-coverage.js';
import {refreshReports,reportsSnapshot} from './steward-reports.js';
import {goalSnapshot} from './steward-goals.js';
import {inspectSettlement} from './steward-diagnostics.js';
import {refreshStewardBudget,budgetSnapshot} from './steward-budget.js';

const runtime=new WeakMap();
export const STEWARD_INTERVAL=3;
const empty=()=>({timer:0,cursor:0,issues:[],goals:[],plans:0,inspected:0,lastInspected:0,queue:[],queueActions:0});
function cache(world){let c=runtime.get(world);if(!c){c=empty();runtime.set(world,c);}return c;}
export function refreshSteward(game,{execute=false}={}){
 const w=game.world,c=cache(w);
 if(game.state.mission||!w.steward?.enabled){c.issues=[];c.goals=[];c.queue=[];c.timer=0;return;}
 c.goals=goalSnapshot(game);
 const report=inspectSettlement(game,{start:c.cursor,buildingLimit:24,issueLimit:12});
 c.issues=report.issues;c.cursor=report.nextCursor;c.lastInspected=report.inspected;c.inspected+=report.inspected;c.plans++;
 c.queue=constructionSnapshot(game);refreshStewardBudget(game,c.goals,c.queue);
 refreshDistricts(game);refreshCoverage(game);
 const planned=[...c.goals,...c.queue.filter(e=>!c.goals.some(g=>g.status!=='Complete'&&g.action!=='repair'&&g.buildingId&&g.buildingId===e.buildingId&&Object.keys(g.cost||{}).length))];
 refreshProduction(game,planned);
 let queueCompleted;
 if(execute){
  fitEquipment(game);
  const result=advanceConstruction(game);queueCompleted=result.completed;
  if(result.ok){c.queueActions++;c.goals=goalSnapshot(game);c.queue=constructionSnapshot(game);refreshStewardBudget(game,c.goals,c.queue);}
 }
 refreshReports(game,{goals:c.goals,issues:c.issues,queue:c.queue,queueCompleted});c.timer=STEWARD_INTERVAL;
}
export function tickSteward(game,dt){
 if(!(dt>0)||!Number.isFinite(dt)||game.state.mission||!game.world.steward?.enabled)return;
 const c=cache(game.world);c.timer-=Math.max(0,dt);if(c.timer<=0)refreshSteward(game,{execute:true});
}
export function stewardMetrics(world){const c=runtime.get(world);return {plans:c?.plans||0,inspected:c?.inspected||0,lastInspected:c?.lastInspected||0,interval:STEWARD_INTERVAL,buildingLimit:24,issueLimit:12,queueActions:c?.queueActions||0,equipmentLimit:8,queueLimit:12,districtLimit:6,readinessLimit:12,historyLimit:12};}
export function stewardSnapshot(game){
 const c=runtime.get(game.world);
 return {issues:(c?.issues||[]).map(x=>({...x})),goals:game.world.steward?.enabled?(c?.goals||[]).map(x=>({...x,cost:{...x.cost},missing:{...x.missing},requirements:x.requirements.map(r=>({...r}))})):goalSnapshot(game),budget:budgetSnapshot(game),production:productionSnapshot(game),equipment:equipmentSnapshot(game),queue:(c?.queue||[]).map(e=>({...e,cost:{...e.cost}})),districts:game.world.steward?.enabled?districtSnapshot(game):[],coverage:game.world.steward?.enabled?coverageSnapshot(game):{examined:0,posts:0,protected:0,unguarded:0,gaps:[],geometric:true},reports:reportsSnapshot(game),blueprints:blueprintSnapshot(game),metrics:stewardMetrics(game.world)};
}
