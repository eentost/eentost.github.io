/* CyberVerse opt-in virtual training. Fictional robots and simulated projectiles only. */
import * as THREE from "three";
export function createCombatTraining({city,camera,renderer,root,state,local,zones,announce}) {
 const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
 const weapons={sniper:{label:"정밀 저격총",size:5,damage:120,cooldown:1.1,reload:2.5,max:100,color:0xffd08a},rifle:{label:"전술 소총",size:24,damage:34,cooldown:.17,reload:1.65,max:65,color:0x75efde}};
 const data={active:false,over:false,zoom:false,gun:"sniper",wave:0,hp:100,kills:0,score:0,shots:0,hits:0,ammo:{sniper:5,rifle:24},reserve:{sniper:40,rifle:120},cool:0,reload:0,next:0,hit:0,hurt:0};
 const meshGroup=new THREE.Group();meshGroup.name="virtual-robot-training";city.add(meshGroup);
 const ray=new THREE.Raycaster();let bots=[],targets=[],bolts=[],fx=[],time=0,aimPitch=0,uiTime=0,reloadGun=null;
 const rnd=(()=>{let v=717;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};})();
 const material=(c)=>new THREE.MeshStandardMaterial({color:c,metalness:.6,roughness:.42});
 const glowing=(c)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.95});
 function cub(parent,x,y,z,w,h,d,mat) {
  const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);a.position.set(x,y,z);a.castShadow=true;parent.add(a);return a;
 }
 function ball(parent,x,y,z,r,mat) {
  const a=new THREE.Mesh(new THREE.SphereGeometry(r,12,9),mat);a.position.set(x,y,z);parent.add(a);return a;
 }
 function clean(o) {o.parent?.remove(o);o.traverse(n=>{n.geometry?.dispose();if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();});}
 function blocked(x,z) {
  return Math.abs(x)>42||Math.abs(z)>42||zones.slice(1).some(v=>Math.abs(x-v.x)<(v.id==="incident"?9:7.5)&&Math.abs(z-v.z)<6.5);
 }
 const models={};
 for(const kind of ["sniper","rifle"]) {
  const long=kind==="sniper",gun=new THREE.Group(),dark=material(0x182734),metal=material(long?0xd0b17e:0x3eaa98);
  gun.position.set(.44,1.46,-.35);gun.name="cv-combat-training-prop";local.add(gun);
  cub(gun,0,0,-.32,.18,.2,long?1.32:.83,dark);
  cub(gun,0,-.21,-.14,.1,.41,.16,dark);
  cub(gun,0,.16,-.44,.14,.12,.58,metal);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,long?1.15:.62,10),dark);
  barrel.rotation.x=Math.PI/2;barrel.position.set(0,.03,long?-1.24:-.91);gun.add(barrel);
  const scope=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,long?.56:.28,12),dark);
  scope.rotation.x=Math.PI/2;scope.position.set(0,.26,-.48);gun.add(scope);
  models[kind]=gun;gun.visible=false;
 }
 const ui=document.createElement("div");ui.className="cv-combat-ui";
 ui.innerHTML='<button class="cv-battle-toggle" id="cv-battle-toggle" type="button" aria-pressed="false">🎯 로봇 전투 훈련 시작</button>'
 +'<div class="cv-battle-hud" id="cv-battle-hud" hidden><div class="cv-battle-metrics">'
 +'<span><small>체력</small><b id="cv-battle-hp">100%</b><i class="cv-battle-meter"><em id="cv-battle-fill"></em></i></span>'
 +'<span><small>웨이브 / 남은 적</small><b id="cv-battle-wave">1 / 4</b></span>'
 +'<span><small>점수 / 처치</small><b id="cv-battle-score">0 / 0</b></span>'
 +'<span><small>탄약</small><b id="cv-battle-ammo">5 / 40</b></span></div>'
 +'<div class="cv-battle-tools"><button data-gun="sniper">2 · 저격총</button><button data-gun="rifle">1 · 소총</button><button id="cv-battle-reload">R · 재장전</button></div>'
 +'<div id="cv-battle-help">좌클릭 사격 · 우클릭 조준 · 1/2 무기 변경 · R 재장전 · F 종료</div></div>'
 +'<div class="cv-battle-reticle" id="cv-battle-reticle" hidden aria-hidden="true"><div class="cv-battle-cross"></div><span id="cv-battle-hit">×</span><small>CYBERVERSE // OPTICAL TARGET SYSTEM</small></div>'
 +'<div class="cv-battle-damage" id="cv-battle-damage" hidden></div>'
 +'<div class="cv-battle-actions" id="cv-battle-actions" hidden><button id="cv-battle-aim" type="button">◎ 조준</button><button id="cv-battle-fire" type="button">● 사격</button></div>'
 +'<div class="cv-battle-toast" id="cv-battle-toast" hidden role="status"></div>'
 +'<div class="cv-battle-result" id="cv-battle-result" hidden><h3>훈련 종료</h3><p id="cv-battle-summary"></p><button id="cv-battle-retry" type="button">다시 훈련</button><button id="cv-battle-exit" type="button">도시로 돌아가기</button></div>';
 root.append(ui);
 const $=x=>ui.querySelector("#"+x);
 const hud=$("cv-battle-hud"),reticle=$("cv-battle-reticle"),actions=$("cv-battle-actions"),toast=$("cv-battle-toast"),result=$("cv-battle-result");
 function notice(s,duration=1.8){toast.textContent=s;toast.hidden=false;toast.dataset.expiry=String(time+duration);}
 function sync() {
  $("cv-battle-hp").textContent=Math.ceil(data.hp)+"%";$("cv-battle-fill").style.width=data.hp+"%";
  $("cv-battle-wave").textContent=data.wave+" / "+bots.length;
  $("cv-battle-score").textContent=data.score+" / "+data.kills;
  $("cv-battle-ammo").textContent=data.ammo[data.gun]+" / "+data.reserve[data.gun];
  $("cv-battle-help").textContent=data.reload>0?"재장전 중 "+data.reload.toFixed(1)+"초":"좌클릭 사격 · 우클릭 유지 조준 · R 재장전 · 1/2 무기 변경 · F 종료";
  ui.querySelectorAll("[data-gun]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.gun===data.gun)));
 }
 function showGuns(){for(const k of Object.keys(models))models[k].visible=data.active&&!data.zoom&&data.gun===k;}
 function reset() {
  for(const b of bots)clean(b.root);for(const f of fx)clean(f.mesh);for(const p of bolts)clean(p.mesh);
  bots=[];targets=[];fx=[];bolts=[];
 }
 function stop() {
  data.active=false;data.zoom=false;data.over=false;reset();local.visible=true;showGuns();
  hud.hidden=true;reticle.hidden=true;actions.hidden=true;result.hidden=true;toast.hidden=true;
  $("cv-battle-toggle").textContent="🎯 로봇 전투 훈련 시작";$("cv-battle-toggle").setAttribute("aria-pressed","false");
  camera.fov=56;camera.updateProjectionMatrix();root.classList.remove("cv-battle-active","cv-battle-zoom");
 }
 function spawnBot(x,z) {
  const group=new THREE.Group();group.position.set(x,0,z);meshGroup.add(group);
  const shell=material(0x46566b),armor=material(0x853e43),red=glowing(0xff655c),trim=material(0x252d3d),parts=[];
  function hit(m,part){m.userData.part=part;parts.push(m);}
  hit(cub(group,0,1.13,0,.72,.95,.46,armor),"body");
  hit(ball(group,0,1.89,0,.29,shell),"head");
  hit(cub(group,0,1.23,-.25,.32,.2,.08,red),"core");
  cub(group,0,1.9,-.26,.46,.12,.07,red);
  cub(group,0,1.67,0,.91,.12,.54,trim);
  const limbs=[];
  for(const d of [-1,1]){
   const arm=new THREE.Group();arm.position.set(d*.51,1.5,0);group.add(arm);
   hit(cub(arm,0,-.34,0,.22,.7,.27,shell),"arm");limbs.push(arm);
   const leg=new THREE.Group();leg.position.set(d*.2,.82,0);group.add(leg);
   hit(cub(leg,0,-.33,0,.26,.65,.31,shell),"leg");limbs.push(leg);
  }
  const antenna=ball(group,0,2.35,0,.08,red);cub(group,0,2.22,0,.05,.24,.05,trim);
  const health=glowing(0xffbd89),bar=cub(group,0,2.66,-.03,.88,.075,.03,health);
  const bot={root:group,limbs,eye:red,bar,hp:95+data.wave*20,maxHp:95+data.wave*20,phase:rnd()*6.28,next:1.4+rnd()*1.5,speed:1.2+.1*data.wave,flash:0};
  parts.forEach(p=>{p.userData.bot=bot;targets.push(p);});bots.push(bot);return bot;
 }
 function wave(){
  data.wave++;let made=0;const count=Math.min(9,3+data.wave);
  for(let i=0;i<count;i++){
   let spot;
   for(let j=0;j<90;j++){
    const angle=i/count*2*Math.PI+(rnd()-.5)*1.1,r=14+rnd()*15;
    const x=clip(state.pos.x+Math.cos(angle)*r,-39,39),z=clip(state.pos.z+Math.sin(angle)*r,-39,39);
    if(!blocked(x,z)&&Math.hypot(x-state.pos.x,z-state.pos.z)>9){spot={x,z};break;}
   }
   if(spot){spawnBot(spot.x,spot.z);made++;}
  }
  data.next=0;notice("웨이브 "+data.wave+" · 적 로봇 "+made+"대 출현",2.7);sync();
 }
 function start(){
  if(state.area!=="city"){announce("도시 밖에서 전투 훈련을 시작할 수 있습니다");return;}
  stop();Object.assign(data,{active:true,over:false,zoom:false,gun:"sniper",wave:0,hp:100,kills:0,score:0,shots:0,hits:0,ammo:{sniper:5,rifle:24},reserve:{sniper:40,rifle:120},cool:0,reload:0,next:0,hit:0,hurt:0});
  aimPitch=0;reloadGun=null;
  hud.hidden=false;reticle.hidden=false;actions.hidden=false;result.hidden=true;
  $("cv-battle-toggle").textContent="✕ 전투 훈련 종료";$("cv-battle-toggle").setAttribute("aria-pressed","true");
  root.classList.add("cv-battle-active");showGuns();wave();
 }
 function choose(name){
  if(!data.active||data.over||!weapons[name])return;
  data.gun=name;data.reload=0;reloadGun=null;zoom(false);showGuns();sync();notice(weapons[name].label+" 장착");
 }
 function zoom(on){
  if(!data.active||data.over)return;
  data.zoom=!!on;root.classList.toggle("cv-battle-zoom",data.zoom);
  $("cv-battle-aim").setAttribute("aria-pressed",String(data.zoom));
  if(data.zoom)state.mouse.drag=false;
  showGuns();
 }
 function reload(){
  const k=data.gun,w=weapons[k];
  if(!data.active||data.over||data.reload>0||data.ammo[k]>=w.size||data.reserve[k]<=0)return;
  reloadGun=k;data.reload=w.reload;notice("재장전 중");sync();
 }
 function tracer(a,b,color,duration=.16){
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));
  meshGroup.add(line);fx.push({mesh:line,ttl:duration,life:duration});
 }
 function destroy(b) {
  targets=targets.filter(t=>t.userData.bot!==b);bots=bots.filter(x=>x!==b);clean(b.root);
  data.kills++;data.score+=100+data.wave*15;
  if(!bots.length){data.next=3;data.hp=Math.min(100,data.hp+18);data.reserve.sniper+=5;data.reserve.rifle+=24;notice("모두 제압! 체력 회복 · 다음 웨이브 준비",2.5);}
 }
 function fire(ndc) {
  if(!data.active||data.over||data.cool>0||data.reload>0)return;
  const w=weapons[data.gun];
  if(!data.ammo[data.gun]){reload();return;}
  data.ammo[data.gun]--;data.shots++;data.cool=w.cooldown;
  if(data.zoom)ray.setFromCamera(new THREE.Vector2(0,0),camera);
  else if(ndc)ray.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  else ray.set(new THREE.Vector3(state.pos.x,1.8,state.pos.z),new THREE.Vector3(-Math.sin(state.camAngle),0,-Math.cos(state.camAngle)));
  ray.far=w.max;
  const hit=ray.intersectObjects(targets,false)[0];
  const end=hit?hit.point.clone():ray.ray.at(w.max,new THREE.Vector3());
  const muzzle=new THREE.Vector3(state.pos.x,1.65,state.pos.z);
  tracer(muzzle,end,w.color);
  if(hit){
   const b=hit.object.userData.bot;
   if(b&&bots.includes(b)){
    data.hits++;data.hit=.25;b.flash=.2;
    const precision=hit.object.userData.part==="head";
    b.hp-=w.damage*(precision?1.7:1);
    b.bar.scale.x=clip(b.hp/b.maxHp,0,1);b.bar.position.x=-(1-b.bar.scale.x)*.44;
    const burst=ball(meshGroup,hit.point.x,hit.point.y,hit.point.z,precision?.23:.15,glowing(precision?0xffc48a:0x8afae0));
    fx.push({mesh:burst,ttl:.2,life:.2});
    if(precision){data.score+=35;notice("헤드샷 +35",.8);}
    if(b.hp<=0)destroy(b);
   }
  }
  sync();
 }
 function lose(){
  zoom(false);data.over=true;local.visible=true;reticle.hidden=true;actions.hidden=true;
  camera.fov=56;camera.updateProjectionMatrix();
  $("cv-battle-summary").textContent="웨이브 "+data.wave+" · "+data.kills+"대 제압 · "+data.score+"점 · 명중률 "+(data.shots?Math.round(data.hits/data.shots*100):0)+"%";
  result.hidden=false;notice("훈련 종료 · 재도전할 수 있습니다",3);
 }
 function attack(b) {
  b.next=2+rnd()*1.2;
  const start=b.root.position.clone();start.y=1.6;
  const target=new THREE.Vector3(state.pos.x,1.6,state.pos.z);
  const body=ball(meshGroup,start.x,start.y,start.z,.12,glowing(0xff6459));
  bolts.push({mesh:body,start,end:target,progress:0});
  tracer(start,target,0xff7867,.24);
 }
 function onKeyDown(e){
  if(!data.active){if(e.code==="KeyF"){start();return true;}return false;}
  if(e.code==="KeyF"||e.code==="Escape"){stop();return true;}
  if(e.code==="KeyR"){reload();return true;}
  if(e.code==="Digit1"){choose("rifle");return true;}
  if(e.code==="Digit2"){choose("sniper");return true;}
  if(e.code==="Space"){if(!e.repeat)fire();return true;}
  return false;
 }
 function onPointerDown(e){
  if(!data.active||data.over)return false;
  if(e.button===2){e.preventDefault();zoom(true);return true;}
  if(e.button!==0)return false;
  e.preventDefault();const r=renderer.domElement.getBoundingClientRect();
  fire(data.zoom?null:{x:clip((e.clientX-r.left)/r.width*2-1,-1,1),y:clip(1-(e.clientY-r.top)/r.height*2,-1,1)});
  return true;
 }
 function onPointerMove(e){
  if(!data.active||!data.zoom)return false;
  state.camAngle-=clip(e.movementX||0,-80,80)*.004;
  aimPitch=clip(aimPitch-clip(e.movementY||0,-80,80)*.0034,-.43,.44);
  return true;
 }
 function onPointerUp(e){if(data.active&&e.button===2){zoom(false);return true;}return data.active;}
 function update(dt,t){
  time=t;if(!data.active)return;
  if(state.area!=="city"){stop();return;}
  if(data.over)return;
  dt=Math.min(dt,.05);data.cool=Math.max(0,data.cool-dt);
  if(data.reload>0){
   data.reload=Math.max(0,data.reload-dt);
   if(data.reload===0&&reloadGun){const w=weapons[reloadGun],amount=Math.min(w.size-data.ammo[reloadGun],data.reserve[reloadGun]);data.ammo[reloadGun]+=amount;data.reserve[reloadGun]-=amount;reloadGun=null;}
  }
  data.hit=Math.max(0,data.hit-dt);data.hurt=Math.max(0,data.hurt-dt);
  reticle.classList.toggle("cv-battle-hit",data.hit>0);$("cv-battle-damage").hidden=data.hurt===0;
  if(data.zoom){
   const dx=-Math.sin(state.camAngle),dz=-Math.cos(state.camAngle),p=new THREE.Vector3(state.pos.x+dx*.2,2.03,state.pos.z+dz*.2);
   camera.position.lerp(p,clip(dt*22,0,1));
   camera.lookAt(p.clone().add(new THREE.Vector3(dx*30,Math.tan(aimPitch)*30,dz*30)));
   camera.fov+=(22-camera.fov)*clip(dt*18,0,1);local.visible=false;
  }else{camera.fov+=(56-camera.fov)*clip(dt*12,0,1);local.visible=true;}
  camera.updateProjectionMatrix();
  for(const b of bots){
   const o=b.root,dx=state.pos.x-o.position.x,dz=state.pos.z-o.position.z,d=Math.hypot(dx,dz);
   if(d>7){const nx=o.position.x+dx/d*b.speed*dt,nz=o.position.z+dz/d*b.speed*dt;if(!blocked(nx,nz)){o.position.x=nx;o.position.z=nz;}}
   o.rotation.y=Math.atan2(-dx,-dz);
   const swing=d>7?Math.sin(t*7+b.phase)*.4:0;
   b.limbs[0].rotation.x=swing;b.limbs[1].rotation.x=-swing;b.limbs[2].rotation.x=-swing;b.limbs[3].rotation.x=swing;
   o.position.y=Math.sin(t*3+b.phase)*.05;
   b.flash=Math.max(0,b.flash-dt);b.eye.color.setHex(b.flash>0?0xffffff:0xff655c);
   b.next-=dt;if(b.next<=0&&d<27)attack(b);
  }
  for(let i=bolts.length-1;i>=0;i--){
   const p=bolts[i],length=p.start.distanceTo(p.end);
   p.progress+=18*dt/Math.max(.01,length);
   p.mesh.position.lerpVectors(p.start,p.end,Math.min(1,p.progress));
   if(p.progress>=1){
    if(Math.hypot(state.pos.x-p.end.x,state.pos.z-p.end.z)<2.5){data.hp=clip(data.hp-8-Math.min(7,data.wave),0,100);data.hurt=.3;if(data.hp===0)lose();}
    clean(p.mesh);bolts.splice(i,1);
   }
  }
  for(let i=fx.length-1;i>=0;i--){const p=fx[i];p.ttl-=dt;p.mesh.material.opacity=clip(p.ttl/p.life,0,1);if(p.ttl<=0){clean(p.mesh);fx.splice(i,1);}}
  if(data.next>0){data.next-=dt;if(data.next<=0)wave();}
  if(toast.dataset.expiry&&time>Number(toast.dataset.expiry))toast.hidden=true;
  if(t-uiTime>.12){uiTime=t;sync();}
 }
 $("cv-battle-toggle").addEventListener("click",()=>data.active?stop():start());
 $("cv-battle-retry").addEventListener("click",start);
 $("cv-battle-exit").addEventListener("click",stop);
 $("cv-battle-reload").addEventListener("click",reload);
 $("cv-battle-aim").addEventListener("click",()=>zoom(!data.zoom));
 $("cv-battle-fire").addEventListener("click",()=>fire());
 ui.querySelectorAll("[data-gun]").forEach(b=>b.addEventListener("click",()=>choose(b.dataset.gun)));
 renderer.domElement.addEventListener("contextmenu",e=>{if(data.active)e.preventDefault();});
 window.addEventListener("pointerup",e=>{if(e.button===2&&data.active)onPointerUp(e);});
 window.addEventListener("blur",()=>{if(data.active&&data.zoom)zoom(false);});
 return {start,stop,update,onKeyDown,onPointerDown,onPointerMove,onPointerUp,isActive:()=>data.active,snapshot:()=>({active:data.active,wave:data.wave,hp:data.hp,kills:data.kills,score:data.score,enemies:bots.length})};
}
