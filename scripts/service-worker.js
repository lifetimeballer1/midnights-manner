// CACHE and CORE are injected by build.mjs. Each build gets an isolated cache.
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(path=>new Request(path,{cache:'reload'})))));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const hit=await cache.match(event.request);
  if(hit)return hit;
  // Navigation always opens the same fully downloaded build, even with a query.
  if(event.request.mode==='navigate'){
   const page=await cache.match(new URL('./index.html',self.registration.scope));
   if(page)return page;
  }
  // Never substitute HTML for a missing script, sprite or JSON response.
  return fetch(event.request);
 })());
});
