/* CyberVerse FPS game systems v1. Offline-only gameplay.
 * Visual grenades, melee, loot, ranks, XP, level-up, enhancements and hit VFX.
 * Does not alter online combat authority.
 */
import * as THREE from "three";
export function createFpsGameplay({world,scene,camera,root,specs,units,data,walls,emit,dealDamage,setWeapon,addReserve,getWeapon,isOnline}) {
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const ranks=["훈련병","이병","일병","상병","병장","하사","중사","상사","원사","소위","중위","대위","소령","중령","대령","준장","소장","중장","대장"];
 const storageKey="cv-fps-profile-v1";
 const fresh=()=>({xp:0,credits:0,upgrades:{},totalKills:0,headshots:0,matches:0});
 let profile=fresh();
 try{const value=JSON.parse(localStorage.getItem(storageKey)||"null");if(value&&Number.isFinite(value.xp)&&Number.isFinite(value.credits)){profile={...fresh(),...value,upgrades:value.upgrades&&typeof value.upgrades==="object"?value.upgrades:{}};}}catch{}
 profile.xp=clamp(profile.xp,0,9999999);profile.credits=clamp(profile.credits,0,9999999);
 const level=()=>Math.min(100,1+Math.floor(Math.sqrt(profile.xp/110)));
 const rank=()=>ranks[Math.min(ranks.length-1,Math.floor((level()-1)/5))];
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(profile));}catch{}};
 const hud=document.createElement("aside");hud.className="cv-rpg-hud";
 hud.innerHTML='<div class="cv-rpg-row"><strong id="cv-rpg-rank">훈련병</strong><b id="cv-rpg-level">LV 1</b><span id="cv-rpg-credit">0 CR</span></div><div class="cv-rpg-xp"><i id="cv-rpg-xpbar"></i></div><div class="cv-rpg-row"><span id="cv-rpg-grenades">수류탄 2</span><span id="cv-rpg-upgrade">강화 +0</span><span id="cv-rpg-headshot">헤드샷 0</span></div><div id="cv-rpg-pickup" class="cv-rpg-pickup" hidden></div><div id="cv-rpg-event" class="cv-rpg-event" hidden role="status"></div><div class="cv-rpg-controls">G 수류탄 · V 칼 · E 무기 줍기 · H 강화</div>';
 root.append(hud);const $=id=>hud.querySelector("#"+id);
 const body=new THREE.Group();body.name="FPS progression gameplay effects";world.add(body);
 const grenades=[],drops=[],particles=[],bursts=[];
 let grenadeCount=2,elapsed=0,feedbackUntil=0,seed=27491,meleeCooldown=0,grenadeCooldown=0;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const black=new THREE.MeshStandardMaterial({color:0x242e32,metalness:.55,roughness:.5});
 const green=new THREE.MeshStandardMaterial({color:0x516956,metalness:.5,roughness:.45});
 const lootMaterial=new THREE.MeshStandardMaterial({color:0x5bdbbe,emissive:0x126e64,emissiveIntensity:.7,metalness:.43});
 const grenadeGeometry=new THREE.IcosahedronGeometry(.15,1),particleGeo=new THREE.SphereGeometry(.046,6,5);
 const bloodMat=new THREE.MeshBasicMaterial({color:0xbc2431,transparent:true,opacity:.78,depthWrite:false});
 const sparksMat=new THREE.MeshBasicMaterial({color:0xffa466,transparent:true,opacity:.95,depthWrite:false});
 const grenadeMat=green;
 const makeText=(v)=>String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,",");
 function event(message,seconds=2){$("cv-rpg-event").textContent=message;$("cv-rpg-event").hidden=false;feedbackUntil=elapsed+seconds;}
 function refresh(){
  const lv=level(),start=(lv-1)**2*110,next=lv*lv*110,progress=lv===100?100:clamp((profile.xp-start)/(next-start)*100,0,100);
  $("cv-rpg-rank").textContent=rank();$("cv-rpg-level").textContent="LV "+lv;
  $("cv-rpg-credit").textContent=makeText(profile.credits)+" CR";$("cv-rpg-xpbar").style.width=progress+"%";
  $("cv-rpg-grenades").textContent="수류탄 "+grenadeCount;
  $("cv-rpg-upgrade").textContent="강화 +"+(profile.upgrades[getWeapon()]||0);
  $("cv-rpg-headshot").textContent="헤드샷 "+profile.headshots;
 }
 function xp(amount,credits,reason){
  if(isOnline())return;
  const before=level(),previousRank=rank();
  profile.xp+=amount;profile.credits+=credits;
  if(level()>before)event("LEVEL UP! "+before+" → "+level()+" · "+rank(),3);
  else if(previousRank!==rank())event("계급 진급 · "+rank(),3);
  else event(reason+" · +"+amount+" XP / +"+credits+" CR");
  persist();refresh();
 }
 function hitBurst(position,headshot=false){
  const amount=headshot?24:9;
  for(let i=0;i<amount;i++){
   const material=(headshot?bloodMat:sparksMat).clone();
   const mesh=new THREE.Mesh(particleGeo,material);mesh.position.copy(position);body.add(mesh);
   const v=new THREE.Vector3((rnd()-.5)*3.4,rnd()*2.6+.1,(rnd()-.5)*3.4);
   particles.push({mesh,v,life:.35+rnd()*.38,total:.75});
  }
  if(headshot)event("HEADSHOT! +150 XP / +60 CR",1.1);
 }
 function removeDrop(item){
  body.remove(item.group);
  item.group.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material&&!Array.isArray(n.material))n.material.dispose();});
  const i=drops.indexOf(item);if(i>=0)drops.splice(i,1);
 }
 function dropAt(position,kind){
  if(isOnline())return;
  if(drops.length>=18)removeDrop(drops[0]);
  const group=new THREE.Group();
  group.position.set(position.x,.65,position.z);body.add(group);
  const block=new THREE.Mesh(new THREE.BoxGeometry(.78,.22,.26),lootMaterial.clone());group.add(block);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,.52,10),black.clone());
  barrel.rotation.x=Math.PI/2;barrel.position.z=-.35;group.add(barrel);
  const aura=new THREE.Mesh(new THREE.TorusGeometry(.64,.03,6,32),new THREE.MeshBasicMaterial({color:0x72e8cc,transparent:true,opacity:.75}));
  aura.rotation.x=Math.PI/2;aura.position.y=-.4;group.add(aura);
  drops.push({group,kind,age:0});
 }
 function pickup(){
  if(isOnline()||!data.running||data.deathDelay>0)return;
  const nearest=drops.map(d=>({d,distance:Math.hypot(d.group.position.x-data.x,d.group.position.z-data.z)})).sort((a,b)=>a.distance-b.distance)[0];
  if(!nearest||nearest.distance>2.6){event("획득 가능한 무기가 가까이 없습니다.");return;}
  const item=nearest.d;setWeapon(item.kind);addReserve(item.kind,specs[item.kind].mag);
  event(specs[item.kind].name+" 획득 · 예비탄약 보충",2);removeDrop(item);
 }
 function upgrade(){
  if(isOnline()||!data.running||data.deathDelay>0)return;
  const weapon=getWeapon(),level=profile.upgrades[weapon]||0,cost=100*(level+1);
  if(level>=5){event("강화 최대 단계 +5");return;}
  if(profile.credits<cost){event("강화에 "+cost+" CR 필요");return;}
  profile.credits-=cost;profile.upgrades[weapon]=level+1;persist();refresh();
  event(specs[weapon].name+" 강화 +"+(level+1)+" · 피해량 +"+((level+1)*4)+"%",3);
 }
 function multiplier(kind){return isOnline()?1:1+(profile.upgrades[kind]||0)*.04;}
 function melee(){
  if(isOnline()){event("온라인 칼 전투는 서버 판정 미지원");return;}
  if(!data.running||data.deathDelay>0||meleeCooldown>0)return;
  meleeCooldown=.57;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const from=camera.position.clone();
  let victim=null,best=2.25;
  for(const u of units){
   if(u.team!=="red"||u.dead)continue;
   const target=u.group.position.clone().add(new THREE.Vector3(0,1.2,0));
   const delta=target.sub(from),distance=delta.length();
   if(distance>best||delta.normalize().dot(dir)<.68)continue;
   const ray=new THREE.Raycaster(from,delta,0,distance);
   if(ray.intersectObjects(walls,false).length)continue;
   best=distance;victim=u;
  }
  if(victim){hitBurst(victim.group.position.clone().add(new THREE.Vector3(0,1.3,0)));dealDamage(victim,80*multiplier(getWeapon()),"YOU",false);event("KNIFE HIT!");}
  else event("근접 공격 · 빗나감",.7);
 }
 function burst(at){
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.1,14,10),new THREE.MeshBasicMaterial({color:0xffa94e,transparent:true,opacity:.9,depthWrite:false}));
  sphere.position.copy(at);body.add(sphere);bursts.push({mesh:sphere,life:.38});
  for(let i=0;i<32;i++){
   const mesh=new THREE.Mesh(particleGeo,sparksMat.clone());mesh.position.copy(at);body.add(mesh);
   particles.push({mesh,v:new THREE.Vector3((rnd()-.5)*10,rnd()*5,(rnd()-.5)*10),life:.55,total:.55});
  }
 }
 function grenade(){
  if(isOnline()){event("온라인 수류탄은 서버 판정 미지원");return;}
  if(!data.running||data.deathDelay>0||grenadeCooldown>0||grenadeCount<1)return;
  grenadeCount--;grenadeCooldown=.8;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const mesh=new THREE.Mesh(grenadeGeometry,grenadeMat);mesh.position.copy(camera.position);body.add(mesh);
  grenades.push({mesh,velocity:dir.multiplyScalar(12).add(new THREE.Vector3(0,4,0)),fuse:2.6});
  refresh();event("수류탄 투척!",.8);
 }
 function explode(g){
  const pos=g.mesh.position.clone();body.remove(g.mesh);burst(pos);
  const radius=6.4;
  for(const u of units){
   if(u.team!=="red"||u.dead)continue;
   const target=u.group.position.clone().add(new THREE.Vector3(0,1,0)),distance=target.distanceTo(pos);
   if(distance>radius)continue;
   const direction=target.clone().sub(pos),ray=new THREE.Raycaster(pos,direction.normalize(),0,distance);
   if(ray.intersectObjects(walls,false).length)continue;
   dealDamage(u,Math.max(0,115*(1-distance/radius)),"YOU",false);
  }
 }
 function kill(unit,head=false){
  if(isOnline())return;
  xp(head?150:100,head?60:35,head?"헤드샷":"처치");
  profile.totalKills++;if(head)profile.headshots++;
  persist();refresh();
  const keys=Object.keys(specs),weapon=keys[Math.floor(rnd()*keys.length)];
  if(rnd()<.62)dropAt(unit.group.position,weapon);
 }
 function reset(){
  grenadeCount=2;meleeCooldown=grenadeCooldown=0;elapsed=0;feedbackUntil=0;
  for(const g of grenades)body.remove(g.mesh);grenades.length=0;
  for(const d of [...drops])removeDrop(d);
  for(const p of particles){body.remove(p.mesh);p.mesh.material.dispose();}particles.length=0;
  for(const b of bursts){body.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();}bursts.length=0;
  hud.hidden=true;refresh();
 }
 function start(){reset();hud.hidden=false;refresh();}
 function update(dt,t){
  if(hud.hidden)return;
  dt=Math.min(.05,Math.max(0,dt));elapsed+=dt;
  meleeCooldown=Math.max(0,meleeCooldown-dt);grenadeCooldown=Math.max(0,grenadeCooldown-dt);
  if(feedbackUntil<elapsed)$("cv-rpg-event").hidden=true;
  for(let i=grenades.length-1;i>=0;i--){
   const g=grenades[i];g.fuse-=dt;
   g.velocity.y-=13*dt;
   const next=g.mesh.position.clone().addScaledVector(g.velocity,dt);
   if(next.y<.18){next.y=.18;g.velocity.y=Math.abs(g.velocity.y)*.38;g.velocity.x*=.65;g.velocity.z*=.65;}
   if(Math.abs(next.x)>30||Math.abs(next.z)>34){g.velocity.x*=-.5;g.velocity.z*=-.5;}
   else g.mesh.position.copy(next);
   g.mesh.rotation.x+=dt*9;
   if(g.fuse<=0){explode(g);grenades.splice(i,1);}
  }
  for(let i=particles.length-1;i>=0;i--){
   const p=particles[i];p.life-=dt;p.v.y-=8*dt;p.mesh.position.addScaledVector(p.v,dt);
   p.mesh.material.opacity=clamp(p.life/p.total,0,1);
   if(p.life<=0){body.remove(p.mesh);p.mesh.material.dispose();particles.splice(i,1);}
  }
  for(let i=bursts.length-1;i>=0;i--){
   const b=bursts[i];b.life-=dt;b.mesh.scale.setScalar(1+(.38-b.life)*28);b.mesh.material.opacity=clamp(b.life/.38,0,1);
   if(b.life<=0){body.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();bursts.splice(i,1);}
  }
  const inRange=drops.filter(d=>Math.hypot(d.group.position.x-data.x,d.group.position.z-data.z)<2.6);
  const label=$("cv-rpg-pickup");
  label.hidden=!inRange.length;
  if(inRange.length)label.textContent="E · "+specs[inRange[0].kind].name+" 줍기";
  for(const d of [...drops]){
   d.age+=dt;d.group.rotation.y+=dt*1.1;
   d.group.position.y=.65+Math.sin(t*2+d.age)*.12;
   if(d.age>75)removeDrop(d);
  }
 }
 return {start,reset,update,grenade,melee,pickup,upgrade,hitBurst,kill,multiplier,refresh,snapshot:()=>({level:level(),rank:rank(),xp:profile.xp,credits:profile.credits,upgrades:{...profile.upgrades},grenades:grenadeCount,loot:drops.length})};
}
