// Runtime-only cadence buckets for power-aware simulation scheduling.
// Accumulated dt is returned in whole intervals so throttling never loses time.
const stores=new WeakMap();

export function takeCadence(owner,key,dt,interval){
  if(!owner||!Number.isFinite(dt)||dt<=0||!Number.isFinite(interval)||interval<=0)return 0;
  let store=stores.get(owner);
  if(!store){store=new Map();stores.set(owner,store);}
  const total=(store.get(key)||0)+dt;
  if(total+1e-9<interval){store.set(key,total);return 0;}
  const remainder=total%interval;
  store.set(key,remainder);
  return total-remainder;
}

export function resetCadence(owner){
  if(owner)stores.delete(owner);
}
