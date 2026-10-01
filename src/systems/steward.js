import {goalSnapshot} from './steward-goals.js';
import {inspectSettlement} from './steward-diagnostics.js';
import {refreshStewardBudget,budgetSnapshot} from './steward-budget.js';

const runtime=new WeakMap();
export const STEWARD_INTERVAL=3;
const empty=()=>({timer:0,cursor:0,issues:[],goals:[],plans:0,inspected:0,lastInspected:0});
function cache(world){let c=runtime.get(world);if(!c){c=empty();runtime.set(world,c);}return c;}
export function refreshSteward(game){
 const w=game.world,c=cache(w);
 if(game.state.mission||!w.steward?.enabled){c.issues=[];c.goals=[];c.timer=0;return;}
 c.goals=goalSnapshot(game);
 const report=inspectSettlement(game,{start:c.cursor,buildingLimit:24,issueLimit:12});
 c.issues=report.issues;c.cursor=report.nextCursor;c.lastInspected=report.inspected;c.inspected+=report.inspected;c.plans++;
 refreshStewardBudget(game,c.goals);c.timer=STEWARD_INTERVAL;
}
export function tickSteward(game,dt){
 if(!(dt>0)||!Number.isFinite(dt)||game.state.mission||!game.world.steward?.enabled)return;
 const c=cache(game.world);c.timer-=Math.max(0,dt);if(c.timer<=0)refreshSteward(game);
}
export function stewardMetrics(world){const c=runtime.get(world);return {plans:c?.plans||0,inspected:c?.inspected||0,lastInspected:c?.lastInspected||0,interval:STEWARD_INTERVAL,buildingLimit:24,issueLimit:12};}
export function stewardSnapshot(game){
 const c=runtime.get(game.world);
 return {issues:(c?.issues||[]).map(x=>({...x})),goals:game.world.steward?.enabled?(c?.goals||[]).map(x=>({...x,cost:{...x.cost},missing:{...x.missing},requirements:x.requirements.map(r=>({...r}))})):goalSnapshot(game),budget:budgetSnapshot(game),metrics:stewardMetrics(game.world)};
}
