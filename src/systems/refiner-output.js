// Real workshop output waits at its source; hauls only reserve it.
// No runtime job owns inventory. Save/reload and interrupted trips are safe.
import {depositCentral} from './storage.js';
export const OUTPUT_CAP=96, OUTPUT_FALLBACK_SECONDS=30;
export function outputAmount(b,key){return Math.max(0,b.outputReserve?.[key]||0);}
export function outputTotals(w){const totals={};for(const b of w.buildings)for(const [key,n] of Object.entries(b.outputReserve||{}))totals[key]=(totals[key]||0)+n;return totals;}
export function bankOutput(w,d,b,key,amount=outputAmount(b,key)){
 const result=depositCentral(w,d,key,Math.min(amount,outputAmount(b,key)));
 if(result.banked>0)b.outputReserve[key]=Math.max(0,outputAmount(b,key)-result.banked);
 if(!Object.values(b.outputReserve||{}).some(n=>n>0))b.outputSince=null;
 return result;
}
export function holdOutput(w,b,key,amount){
 b.outputReserve??={};b.outputReserve[key]=outputAmount(b,key)+amount;
 if(b.outputSince==null)b.outputSince=w.elapsed||0;
}
// Small unattended batches eventually bank through the same capacity gate.
// This bounds delay when no spare hands/routes exist, including during raids.
export function fallbackOutputs(w,d,b,hasHaul=false){
 if(hasHaul||(w.elapsed||0)-(b.outputSince??(w.elapsed||0))<OUTPUT_FALLBACK_SECONDS)return;
 for(const key of Object.keys(b.outputReserve||{}))bankOutput(w,d,b,key);
}
export function normalizeOutputs(w,d){
 for(const b of w.buildings||[]){
  if(!d.buildings[b.type]?.refine)continue;
  if(!b.outputReserve||typeof b.outputReserve!=='object'||Array.isArray(b.outputReserve))b.outputReserve={};
  if(!Number.isFinite(b.outputSince))b.outputSince=Object.values(b.outputReserve).some(n=>n>0)?w.elapsed||0:null;
 }
}
