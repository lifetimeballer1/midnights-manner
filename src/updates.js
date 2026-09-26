// Updates never erase browser storage or reload without a player's click.
export class GameUpdates {
 constructor(game,{doc=document,nav=navigator,win=window}={}) {
  this.game=game;this.doc=doc;this.nav=nav;this.win=win;
  this.button=doc.querySelector('#opt-update');this.refreshButton=doc.querySelector('#opt-refresh');
  this.status=doc.querySelector('#update-status');this.notice=doc.querySelector('#update-notice');
  this.registration=null;this.checking=false;this.applying=false;this.ready=false;this.reloading=false;this.lastCheck=0;
  this.build=doc.querySelector('meta[name="game-build"]')?.content;
  this.button.onclick=()=>this.ready?this.apply():this.check(true);
  this.refreshButton.onclick=()=>this.apply();this.notice.onclick=()=>this.apply();
  this.started=this.start();
 }
 show(message){this.status.textContent=message;}
 available(){
  this.ready=true;this.button.textContent='Update ready · Save & refresh';this.notice.hidden=false;
  this.show('A new version is ready. Save & refresh when you are ready.');
 }
 async start(){
  if(!this.build||!this.nav.serviceWorker){this.button.disabled=true;this.show('Save & refresh reloads this game. Update checks are available in the installed build.');return;}
  this.doc.addEventListener('visibilitychange',()=>{if(!this.doc.hidden&&Date.now()-this.lastCheck>60000)this.check();});
  this.win.addEventListener('online',()=>this.check());
  this.win.setInterval(()=>{if(!this.doc.hidden)this.check();},300000);
  const sw=this.nav.serviceWorker;let controlled=!!sw.controller;
  sw.addEventListener('controllerchange',()=>{
   if(this.applying){this.reload();return;}
   if(controlled)this.available();
   controlled=true;
  });
  try{
   this.registration=await sw.register(new URL('../sw.js',import.meta.url),{updateViaCache:'none'});
   this.registration.addEventListener('updatefound',()=>this.watch(this.registration.installing));
   this.watch(this.registration.installing);
   if(this.registration.waiting)this.available();else this.show('Updates are checked when you reopen the game.');
  }catch{this.show('Could not check for updates. Connect to the internet and try again.');}
 }
 watch(worker){
  if(!worker)return;
  const changed=()=>{
   if(worker.state==='installed'&&this.nav.serviceWorker.controller)this.available();
   if(worker.state==='redundant'&&!this.ready)this.show('Update download failed. Your current game is still available. Try again.');
  };
  worker.addEventListener('statechange',changed);changed();
 }
 async check(manual=false){
  if(this.checking||this.applying)return;
  this.checking=true;this.button.disabled=true;this.lastCheck=Date.now();
  if(manual)this.show('Checking for updates…');
  try{
   await this.started;
   if(this.nav.onLine===false)throw Error('Offline');
   if(!this.registration){
    if(!this.build||!this.nav.serviceWorker)return;
    // Allow recovery after a failed initial registration or offline launch.
    this.registration=await this.nav.serviceWorker.register(new URL('../sw.js',import.meta.url),{updateViaCache:'none'});
    this.registration.addEventListener('updatefound',()=>this.watch(this.registration.installing));
   }
   await this.registration.update();
   if(this.registration.waiting)this.available();
   else if(this.registration.installing){this.watch(this.registration.installing);this.show('Downloading update… Keep playing until it is ready.');}
   else if(manual&&!this.ready)this.show('You’re up to date.');
  }catch{if(manual)this.show('Could not check for updates. Connect to the internet and try again.');}
  finally{this.checking=false;this.button.disabled=!this.build||!this.nav.serviceWorker;}
 }
 apply(){
  if(this.applying)return;
  const paused=this.game.paused;this.game.paused=true;
  if(!this.game.persist()){this.game.paused=paused;this.show('Could not save your village. Refresh cancelled. Export your save before trying again.');return;}
  this.applying=true;this.button.disabled=true;this.refreshButton.disabled=true;this.notice.disabled=true;
  this.show('Village saved. Refreshing…');
  const worker=this.registration?.waiting;
  if(!worker){this.reload();return;}
  // Register timeout before sending: controllerchange can arrive immediately.
  this.timer=this.win.setTimeout(()=>{
   if(this.reloading)return;
   this.applying=false;this.game.paused=paused;this.button.disabled=false;this.refreshButton.disabled=false;this.notice.disabled=false;
   this.show('Update is taking longer than expected. Your village is saved. Try Save & refresh again.');
  },15000);
  worker.postMessage({type:'SKIP_WAITING'});
 }
 reload(){
  if(this.reloading)return;
  this.reloading=true;this.win.clearTimeout(this.timer);this.win.location.reload();
 }
}
