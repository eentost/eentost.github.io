/* CyberVerse OPS ZERO: original FPS bot team deathmatch for browser.
 * Dedicated scene, pointer-lock look, cover collision, bot teams, respawn, score.
 */
import * as THREE from "three";
import {createFpsEffects} from "./fps-effects.js";
import {createFpsOnline} from "./fps-online.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {clone as cloneSkeleton} from "three/addons/utils/SkeletonUtils.js";
export function createFpsArena({scene,camera,renderer,root,city,interior,local,state,combat,cinematic}) {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rng=(()=>{let a=31415;return ()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};})();
  const specs={
    rifle:{name:"CV-47 돌격소총",mag:30,stock:150,damage:30,cool:.115,reload:1.8,spread:.018,recoil:.026,auto:true},
    smg:{name:"Viper-9 기관단총",mag:40,stock:200,damage:20,cool:.075,reload:1.5,spread:.032,recoil:.016,auto:true},
    carbine:{name:"Kestrel-C 카빈",mag:30,stock:150,damage:27,cool:.095,reload:1.6,spread:.017,recoil:.021,auto:true},
    shotgun:{name:"Breach-8 산탄총",mag:8,stock:48,damage:15,pellets:8,cool:.75,reload:2.4,spread:.135,recoil:.085,auto:false},
    dmr:{name:"Sentinel-D 지정사수소총",mag:15,stock:75,damage:47,cool:.29,reload:2,spread:.007,recoil:.048,auto:false},
    sniper:{name:"SV-8 저격소총",mag:5,stock:35,damage:100,cool:1.1,reload:2.6,spread:.002,recoil:.095,auto:false},
    lmg:{name:"Guardian-65 경기관총",mag:65,stock:260,damage:23,cool:.09,reload:3.8,spread:.039,recoil:.027,auto:true},
    pistol:{name:"Pulse-15 권총",mag:15,stock:90,damage:30,cool:.24,reload:1.2,spread:.027,recoil:.027,auto:false}
  };
  const world=new THREE.Group();world.name="OPS ZERO FPS";world.visible=false;scene.add(world);
  const obstacles=[],walls=[],units=[],hitParts=[],traces=[],keys=new Set();
  const raycaster=new THREE.Raycaster(),vec=(x,y,z)=>new THREE.Vector3(x,y,z);
  const paint=(c,rough=.8,metal=.16)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal});
  const mat={ground:paint(0x848b88),wall:paint(0x9c9891),metal:paint(0x576d7c,.48,.55),red:paint(0x977466,.55,.35),blue:paint(0x577b8f,.53,.41),crate:paint(0xaa9882),stripe:new THREE.MeshBasicMaterial({color:0xf2c976})};
  const box=(parent,x,y,z,w,h,d,m,solid=false)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);
    if(solid){obstacles.push({x,z,w,d});walls.push(mesh);}return mesh;
  };
  function buildMap(){
    box(world,0,-.28,0,66,.55,74,mat.ground);
    box(world,0,5,-37,66,10,1.2,mat.wall,true);box(world,0,5,37,66,10,1.2,mat.wall,true);
    box(world,-33,5,0,1.2,10,74,mat.wall,true);box(world,33,5,0,1.2,10,74,mat.wall,true);
    const rects=[
      [-16,-14,12,4.8,5,"red"],[-16,12,12,4.8,5,"blue"],
      [16,14,12,4.8,5,"red"],[16,-12,12,4.8,5,"blue"],
      [0,-6,6.5,4.3,9.5,"blue"],[0,9,6.5,4.3,9.5,"red"],
      [-10,-1,4.5,2.5,4,"wall"],[11,2,4.5,2.5,4,"wall"],
      [-23,2,3,3,3,"crate"],[23,-4,3,3,3,"crate"],
      [-24,-25,4,2.8,4,"crate"],[24,24,4,2.8,4,"crate"],
      [0,25,5,2.5,3,"crate"],[0,-24,5,2.5,3,"crate"]
    ];
    for(const [x,z,w,h,d,type] of rects){
      const group=type==="blue"?mat.blue:type==="red"?mat.red:type==="wall"?mat.wall:mat.crate;
      box(world,x,h/2,z,w,h,d,group,true);
      if(type==="red"||type==="blue"){
        for(let i=1;i<=4;i++)for(const side of [-1,1])
          box(world,x-w/2+i*w/5,h/2,z+side*(d/2+.04),.09,h-.22,.06,mat.metal);
        box(world,x,h-.12,z,w+.12,.12,d+.15,mat.metal);
      }else if(type==="crate"){
        for(const side of [-1,1])box(world,x,h/2,z+side*d/2,.14,h-.25,.11,mat.metal);
      }
    }
    for(const x of [-27,27])for(const z of [-25,0,25]){
      box(world,x,4.25,z,.18,8.5,.18,mat.metal);
      box(world,x,8.4,z,2,.19,.6,mat.stripe);
      const light=new THREE.PointLight(0xffe4b3,.65,18,2);light.position.set(x,8,z);world.add(light);
    }
    for(let i=-24;i<=24;i+=6)box(world,i,.02,0,.16,.03,1.6,mat.stripe);
    for(const z of [-43,43])for(let i=0;i<18;i++){
      const h=9+rng()*15,x=-40+i*4.8;
      box(world,x,h/2,z,3.8,h,5,i%3?mat.wall:mat.metal);
    }
    world.add(new THREE.HemisphereLight(0xeaf5ff,0x47535a,1.5));
    const light=new THREE.DirectionalLight(0xffe6c9,2.3);light.position.set(-21,44,8);world.add(light);
  }
  buildMap();
  const data={active:false,running:false,finished:false,paused:false,hp:100,ap:100,deathDelay:0,spawnShield:0,x:0,z:28,height:0,vy:0,yaw:0,pitch:0,time:300,blue:0,red:0,kills:0,deaths:0};
  let gun="rifle",ammo=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,v.mag])),stock=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,v.stock])),cool=0,loading=0,reloadGun="",aim=false,fireHeld=false,bob=0,recoil=0,flash=0,hit=0,frame=0,lastFull=false,lastOverflow="",lastFog=null,lastBackground=null,lastFov=56,lastCity=true,lastInterior=false;
  const view=new THREE.Group();if(camera.parent!==scene)scene.add(camera);camera.add(view);
  const gunModels={};
  function makeViewGun(kind){
    const sniper=kind==="sniper"||kind==="dmr",short=kind==="pistol"||kind==="smg"||kind==="shotgun",body=paint(0x263746,.36,.65),accent=paint(sniper?0xc5a77e:kind==="smg"?0x4f9ba1:0x4a9290,.42,.5);
    const group=new THREE.Group(),gbox=(x,y,z,w,h,d,m)=>{
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);group.add(o);
    };
    gbox(0,0,-.34,.17,.18,sniper?1.08:short?.49:.7,body);
    gbox(0,-.16,-.12,.16,.39,.18,body);gbox(0,.09,-.35,.2,.12,.5,accent);
    gbox(0,.21,-.36,.12,.12,sniper?.52:short?.17:.29,body);
    gbox(.15,-.07,.11,.19,.17,.3,body);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(kind==="shotgun"?.075:.04,kind==="shotgun"?.075:.04,sniper?.95:short?.34:.58,12),body);
    barrel.rotation.x=Math.PI/2;barrel.position.set(0,.018,sniper?-1.19:short?-.63:-.85);group.add(barrel);
    group.position.set(.33,-.30,-.63);view.add(group);gunModels[kind]=group;
  }
  for(const kind of Object.keys(specs))makeViewGun(kind);
  const muzzle=new THREE.PointLight(0xffc78d,0,2.6);muzzle.position.set(.2,-.15,-1.2);camera.add(muzzle);
  function buildUnit(team,n){
    const group=new THREE.Group();world.add(group);
    const shell=paint(team==="blue"?0x46718a:0x915450,.59,.3),armor=paint(team==="blue"?0x273d51:0x593a38,.51,.4),skin=paint(0xbac0bc),visor=new THREE.MeshBasicMaterial({color:team==="blue"?0x78e6ff:0xff9c83});
    const u={team,n,group,hp:100,dead:false,respawn:0,fire:1+rng(),think:0,goal:{x:0,z:0},phase:rng()*6,left:[],right:[]};
    const hitBox=(parent,part,x,y,z,w,h,d,m)=>{
      const o=box(parent,x,y,z,w,h,d,m);o.userData.unit=u;o.userData.part=part;hitParts.push(o);return o;
    };
    hitBox(group,"body",0,1.22,0,.76,1.03,.48,shell);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,9),skin);
    head.position.y=2.01;head.userData.unit=u;head.userData.part="head";group.add(head);hitParts.push(head);
    box(group,0,2.21,0,.58,.18,.58,armor);box(group,0,2.04,-.27,.48,.12,.08,visor);
    for(const s of [-1,1]){
      const arm=new THREE.Group();arm.position.set(s*.53,1.58,0);group.add(arm);
      hitBox(arm,"arm",0,-.35,0,.23,.73,.28,armor);
      const leg=new THREE.Group();leg.position.set(s*.23,.84,0);group.add(leg);
      hitBox(leg,"leg",0,-.34,0,.3,.72,.34,shell);
      (s<0?u.left:u.right).push(arm,leg);
    }
    box(group,.22,1.22,-.34,.12,.12,.7,armor);units.push(u);return u;
  }
  for(let i=0;i<3;i++)buildUnit("blue",i+1);
  for(let i=0;i<5;i++)buildUnit("red",i+1);
  units.forEach(u=>u.group.visible=false);
  // Skinned soldier animations, with the existing primitive models as offline fallback.
  new GLTFLoader().load("https://threejs.org/examples/models/gltf/Soldier.glb",asset=>{
    for(const u of units){
      const mesh=cloneSkeleton(asset.scene);
      mesh.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=true;}});
      const bound=new THREE.Box3().setFromObject(mesh),size=new THREE.Vector3();bound.getSize(size);
      mesh.scale.setScalar(2.32/Math.max(.1,size.y));
      bound.setFromObject(mesh);mesh.position.y=-bound.min.y;
      u.group.traverse(n=>{
        if(n.isMesh){
          const arr=(Array.isArray(n.material)?n.material:[n.material]).map(m=>{
            const invisible=m.clone();invisible.transparent=true;invisible.opacity=0;invisible.depthWrite=false;return invisible;
          });
          n.material=arr.length===1?arr[0]:arr;
        }
      });
      u.group.add(mesh);u.visual=mesh;
      u.mixer=new THREE.AnimationMixer(mesh);
      u.actions={};
      for(const clip of asset.animations)u.actions[clip.name.toLowerCase()]=u.mixer.clipAction(clip);
      u.anim="idle";u.actions.idle?.play();
    }
  },undefined,()=>{ /* no asset: original robot/soldier meshes remain */ });
  const effects=createFpsEffects({scene,world,camera,root});
  const ui=document.createElement("div");ui.className="cv-fps-ui";ui.setAttribute("aria-label","CyberVerse FPS 데스매치");
  ui.innerHTML=[
    '<button type="button" class="cv-fps-entry" id="cv-fps-entry">FPS 팀데스매치 입장</button>',
    '<section class="cv-fps-menu" id="cv-fps-menu" hidden><div class="cv-fps-modal">',
    '<div class="cv-fps-eyebrow">CYBERVERSE // ORIGINAL FPS ARENA</div>',
    '<h2 id="cv-fps-title">OPS ZERO</h2><p id="cv-fps-desc">1인칭 FPS · BLUE 4명 VS RED AI 5명 · 5분 제한</p>',
    '<div class="cv-fps-pillrow"><span>팀데스매치</span><span>30킬 승리</span><span>엄폐 전투</span><span>AI 봇</span></div>',
    '<div class="cv-fps-config"><label>전장 환경<select id="cv-fps-theme"><option value="industrial">물류 터미널 · 황혼</option><option value="night">도심 항만 · 야간</option><option value="rain">항만 기지 · 폭우</option><option value="desert">사막 전초기지 · 주간</option></select></label><label>기본 무기<select id="cv-fps-loadout"></select></label><label>효과음 <input id="cv-fps-volume" type="range" min="0" max="100" value="65"></label></div>',
    '<button id="cv-fps-play" class="cv-fps-primary" type="button">클릭하여 FPS 시작</button>',
    '<button id="cv-fps-exit" class="cv-fps-secondary" type="button">CyberVerse 도시로 돌아가기</button>',
    '<small>로컬 AI 대전입니다. 다른 방문자와의 실시간 대전은 제공하지 않습니다.</small></div></section>',
    '<section class="cv-fps-hud" id="cv-fps-hud" hidden>',
    '<div class="cv-fps-top"><div class="cv-fps-scores"><span>BLUE <b id="cv-fps-blue">0</b></span><strong id="cv-fps-time">05:00</strong><span><b id="cv-fps-red">0</b> RED</span></div>',
    '<div class="cv-fps-mode">30 KILLS TO WIN · BOT TEAM DEATHMATCH</div></div>',
    '<div class="cv-fps-radar"><canvas id="cv-fps-map" width="154" height="154"></canvas><small>OPS ZERO · YARD</small></div>',
    '<div class="cv-fps-feed" id="cv-fps-feed"></div>',
    '<div class="cv-fps-cross" id="cv-fps-cross"><i></i><i></i><i></i><i></i><b>×</b></div>',
    '<div class="cv-fps-scope" id="cv-fps-scope" hidden><div class="cv-fps-scope-circle"><i></i><small>SV-8 / 4X</small></div></div>',
    '<div class="cv-fps-damage" id="cv-fps-damage"></div>',
    '<div class="cv-fps-bottom"><div class="cv-fps-health">HP <b id="cv-fps-hp">100</b>　AP <b id="cv-fps-ap">100</b><div><i id="cv-fps-hpbar"></i></div></div>',
    '<div class="cv-fps-weapon"><small id="cv-fps-gun">CV-47 돌격소총</small><strong id="cv-fps-ammo">30 / 150</strong><span id="cv-fps-reload">R 재장전</span></div></div>',
    '<div class="cv-fps-instructions">WASD 이동 · SHIFT 달리기 · C 앉기 · SPACE 점프 · 좌클릭 사격 · 우클릭 조준 · 숫자 1~8 무기 · R 재장전 · ESC 메뉴</div>',
    '<div class="cv-fps-dead" id="cv-fps-dead" hidden>부활까지 <b id="cv-fps-respawn">3</b>초</div>',
    '<div class="cv-fps-mobile"><button id="cv-fps-aim" type="button">◎ 조준</button><button id="cv-fps-fire" type="button">● 사격</button></div>',
    '</section>'
  ].join("");
  root.append(ui);
  const $=id=>ui.querySelector("#"+id),menu=$("cv-fps-menu"),hud=$("cv-fps-hud"),map=$("cv-fps-map"),ctx=map.getContext("2d");
  let feed=[],network=null,online=false,serverTeam="blue",chosenTheme="industrial";
  const loadout=$("cv-fps-loadout");
  for(const [id,w]of Object.entries(specs)){const option=document.createElement("option");option.value=id;option.textContent=w.name;loadout.append(option);}
  $("cv-fps-theme").addEventListener("change",e=>{chosenTheme=e.target.value;if(data.active){effects.setTheme(chosenTheme);effects.apply();}});
  $("cv-fps-volume").addEventListener("input",e=>effects.setVolume(Number(e.target.value)/100));
  function isBlocked(x,z,r=.5){return Math.abs(x)>30.8||Math.abs(z)>34||obstacles.some(v=>Math.abs(x-v.x)<v.w/2+r&&Math.abs(z-v.z)<v.d/2+r);}
  function slide(obj,dx,dz){if(!isBlocked(obj.x+dx,obj.z))obj.x+=dx;if(!isBlocked(obj.x,obj.z+dz))obj.z+=dz;}
  function spawn(u){
    const x=(rng()-.5)*20,z=u.team==="red"?-28:28;
    u.group.position.set(x,0,z+(rng()-.5)*3);u.dead=false;u.hp=100;u.respawn=0;u.fire=1+rng();u.think=0;u.group.visible=true;
  }
  function respawn(){
    Object.assign(data,{x:(rng()-.5)*6,z:28,yaw:0,pitch:0,height:0,vy:0,hp:100,ap:100,deathDelay:0,spawnShield:1.7});
  }
  function setGun(type){
    if(!specs[type]||loading>0)return;
    gun=type;aim=false;cool=0;
    if(online)network?.send({type:"equip",gun:type});
    effects.play("equip",type);
    for(const [id,m]of Object.entries(gunModels))m.visible=id===gun;refresh();
  }
  function reload(){
    if(!data.running||data.deathDelay>0||loading>0||ammo[gun]>=specs[gun].mag||stock[gun]<=0)return;
    if(online){network?.send({type:"reload"});effects.play("reload",gun);return;}
    loading=specs[gun].reload;reloadGun=gun;effects.play("reload",gun);refresh();
  }
  function lineOfSight(a,b){
    const dir=b.clone().sub(a),len=dir.length();
    raycaster.set(a,dir.normalize());raycaster.far=len;
    return raycaster.intersectObjects(walls,false).length===0;
  }
  function addTrace(a,b,color){
    const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false}));
    scene.add(mesh);traces.push({mesh,ttl:.16});
  }
  function feedKill(who,victim,head=false){
    feed.unshift((who==="YOU"?"YOU":who)+(head?" ◉ ":" ⌁ ")+victim);
    feed=feed.slice(0,5);$("cv-fps-feed").replaceChildren(...feed.map(text=>{const d=document.createElement("div");d.textContent=text;return d;}));
  }
  function damage(u,dmg,who,head=false){
    if(data.finished)return;
    if(u.player){
      if(data.deathDelay>0||data.spawnShield>0)return;
      const absorbed=Math.min(data.ap,dmg*.56);data.ap-=absorbed;data.hp=Math.max(0,data.hp-dmg+absorbed);flash=.45;
      if(data.hp<=0){data.deaths++;data.deathDelay=3;data.red++;feedKill(who,"YOU");}
    }else if(!u.dead){
      u.hp-=dmg;if(u.hp<=0){
        u.dead=true;u.respawn=3.5;u.group.visible=false;
        const team=u.team==="red"?"blue":"red";data[team]++;
        if(who==="YOU")data.kills++;feedKill(who,u.team.toUpperCase()+"-"+u.n,head);
      }
    }
    if(data.blue>=30||data.red>=30)finish();
  }
  function shoot(){
    if(!data.running||data.finished||data.deathDelay>0||loading>0||cool>0)return;
    const w=specs[gun];if(ammo[gun]<=0){reload();return;}
    ammo[gun]--;cool=w.cool;recoil=.3;data.pitch=clamp(data.pitch+w.recoil,-1.2,1.2);
    effects.play("shot",gun);
    if(online){network?.send({type:"shoot"});refresh();return;}
    const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const pellets=w.pellets||1,targets=hitParts.filter(m=>m.userData.unit?.team==="red"&&!m.userData.unit.dead);
    for(let i=0;i<pellets;i++){
      const shot=dir.clone().add(vec((rng()-.5)*w.spread*(aim?.2:1),(rng()-.5)*w.spread*(aim?.2:1),0)).normalize();
      raycaster.set(camera.position,shot);raycaster.far=gun==="shotgun"?22:100;
      const first=raycaster.intersectObjects(walls.concat(targets),false)[0];
      const where=first?first.point:raycaster.ray.at(88,new THREE.Vector3());
      if(i===0)addTrace(camera.position.clone(),where,0xffcf9c);
      if(first?.object.userData.unit){
        const bot=first.object.userData.unit,head=first.object.userData.part==="head";
        damage(bot,w.damage*(head?2.2:1),"YOU",head);hit=.2;effects.play("hit");
      }
    }
    refresh();
  }
  function closest(u){
    let best=null,dist=1e6;
    for(const enemy of units){if(enemy.dead||enemy.team===u.team)continue;
      const d=u.group.position.distanceTo(enemy.group.position);
      if(d<dist){dist=d;best=enemy;}}
    if(u.team==="red"&&data.deathDelay<=0){
      const d=Math.hypot(data.x-u.group.position.x,data.z-u.group.position.z);
      if(d<dist){dist=d;best={player:true,group:{position:vec(data.x,0,data.z)}};}
    }
    return {best,dist};
  }
  function updateBots(dt,t){
    for(const u of units){
      if(u.dead){u.respawn-=dt;if(u.respawn<=0)spawn(u);continue;}
      const {best,dist}=closest(u);u.think-=dt;u.fire-=dt;
      if(u.think<=0){
        const p=u.group.position,tx=best?.group.position.x??0,tz=best?.group.position.z??0;
        const a=Math.atan2(tx-p.x,tz-p.z)+(rng()-.5)*1.2,span=dist>10?6:3;
        u.goal={x:clamp(p.x+Math.sin(a)*span+(rng()-.5)*6,-29,29),z:clamp(p.z+Math.cos(a)*span+(rng()-.5)*6,-31,31)};
        u.think=.65+rng()*1.3;
      }
      const p=u.group.position,dx=u.goal.x-p.x,dz=u.goal.z-p.z,d=Math.hypot(dx,dz);
      if(d>.3){
        const tmp={x:p.x,z:p.z};slide(tmp,dx/d*(2.3+u.n*.13)*dt,dz/d*(2.3+u.n*.13)*dt);
        if(Math.abs(tmp.x-p.x)+Math.abs(tmp.z-p.z)<.001)u.think=0;p.x=tmp.x;p.z=tmp.z;
      }
      if(best){
        const delta=best.group.position.clone().sub(p);u.group.rotation.y=Math.atan2(-delta.x,-delta.z);
        if(u.fire<=0&&dist<28){
          const a=p.clone().add(vec(0,1.6,0)),b=best.group.position.clone().add(vec(0,1.6,0));
          if(lineOfSight(a,b)){
            addTrace(a,b,u.team==="blue"?0x8bd9f1:0xff9b7a);
            if(rng()<clamp(.6-dist*.015,.15,.52))damage(best,8+rng()*9,u.team==="red"?"RED BOT":"BLUE BOT");
            u.fire=.65+rng()*.8;
          }else u.fire=.25;
        }
      }
      if(u.mixer){
        const next=d>.3?"walk":"idle";
        if(next!==u.anim){
          u.actions[u.anim]?.fadeOut(.17);
          u.actions[next]?.reset().fadeIn(.17).play();
          u.anim=next;
        }
        u.mixer.update(dt);
      }else{
        const swing=Math.sin(t*8+u.phase)*.52;
        u.left[0].rotation.x=swing;u.right[0].rotation.x=-swing;u.left[1].rotation.x=-swing;u.right[1].rotation.x=swing;
      }
    }
  }
  function finish(){
    if(data.finished)return;
    data.finished=true;data.running=false;fireHeld=false;
    if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();
    $("cv-fps-title").textContent=data.blue>data.red?"BLUE TEAM 승리":data.blue<data.red?"RED TEAM 승리":"무승부";
    $("cv-fps-desc").textContent="BLUE "+data.blue+" : "+data.red+" RED · 개인 "+data.kills+"킬 / "+data.deaths+"데스";
    $("cv-fps-play").textContent="새 경기 시작";menu.hidden=false;
  }
  function lock(){
    try{
      if(!renderer.domElement.requestPointerLock){data.running=true;menu.hidden=true;return;}
      const promise=renderer.domElement.requestPointerLock();
      if(promise?.catch)promise.catch(()=>{data.running=true;menu.hidden=true;});
    }catch(_){data.running=true;menu.hidden=true;}
  }
  function start(){
    if(data.active){menu.hidden=false;return;}
    combat?.stop?.();
    lastCity=city.visible;lastInterior=interior.visible;lastFull=root.classList.contains("cv3-full");
    lastBackground=scene.background;lastFog=scene.fog;lastFov=camera.fov;lastOverflow=document.body.style.overflow;
    city.visible=false;interior.visible=false;local.visible=false;world.visible=true;cinematic?.setArenaActive?.(true);
    view.visible=true;
    effects.setTheme(chosenTheme);effects.apply();
    document.body.style.overflow="hidden";root.classList.add("cv3-full","cv-fps-active");
    Object.assign(data,{active:true,running:false,finished:false,paused:false,time:300,blue:0,red:0,kills:0,deaths:0});
    gun=specs[loadout.value]?loadout.value:"rifle";
    ammo=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,v.mag]));
    stock=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,v.stock]));
    cool=0;loading=0;aim=false;recoil=0;feed=[];$("cv-fps-feed").replaceChildren();respawn();
    units.forEach(spawn);ui.querySelector("#cv-fps-entry").hidden=true;hud.hidden=false;menu.hidden=false;
    $("cv-fps-title").textContent="OPS ZERO";$("cv-fps-desc").textContent="BLUE 4명 VS RED AI 5명 · 30킬 승리 · 5분 제한";
    $("cv-fps-play").textContent="클릭하여 FPS 시작";
    refresh(); // Show mode / loadout selection before acquiring pointer lock.
  }
  function stop(){
    if(!data.active)return;
    data.active=false;data.running=false;fireHeld=false;aim=false;
    network?.disconnect();online=false;
    if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();
    world.visible=false;city.visible=lastCity;interior.visible=lastInterior;local.visible=true;cinematic?.setArenaActive?.(false);
    scene.background=lastBackground;scene.fog=lastFog;camera.fov=lastFov;camera.updateProjectionMatrix();camera.rotation.set(0,0,0);
    if(!lastFull)root.classList.remove("cv3-full");root.classList.remove("cv-fps-active");document.body.style.overflow=lastOverflow;
    ui.querySelector("#cv-fps-entry").hidden=false;menu.hidden=true;hud.hidden=true;view.visible=false;
    units.forEach(u=>u.group.visible=false);keys.clear();
    for(const v of traces){scene.remove(v.mesh);v.mesh.geometry.dispose();v.mesh.material.dispose();}traces.length=0;
  }
  function refresh(){
    $("cv-fps-blue").textContent=data.blue;$("cv-fps-red").textContent=data.red;
    const seconds=Math.max(0,Math.ceil(data.time));
    $("cv-fps-time").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
    $("cv-fps-hp").textContent=Math.round(data.hp);$("cv-fps-ap").textContent=Math.round(data.ap);
    $("cv-fps-hpbar").style.width=data.hp+"%";
    $("cv-fps-gun").textContent=specs[gun].name;$("cv-fps-ammo").textContent=ammo[gun]+" / "+stock[gun];
    $("cv-fps-reload").textContent=loading>0?"재장전 "+loading.toFixed(1)+"s":"R 재장전";
    $("cv-fps-dead").hidden=data.deathDelay<=0;$("cv-fps-respawn").textContent=Math.ceil(data.deathDelay);
    $("cv-fps-damage").style.opacity=String(clamp(flash*2,0,1));
    $("cv-fps-cross").classList.toggle("cv-fps-hit",hit>0);
    $("cv-fps-cross").hidden=gun==="sniper"&&aim;$("cv-fps-scope").hidden=!(gun==="sniper"&&aim);
  }
  function radar(){
    ctx.fillStyle="#112b3a";ctx.fillRect(0,0,154,154);ctx.strokeStyle="#7e9ca6";ctx.strokeRect(4,4,146,146);
    ctx.fillStyle="#3d505b";
    for(const o of obstacles){ctx.fillRect((o.x+33)/66*154-o.w/66*77,(o.z+37)/74*154-o.d/74*77,o.w/66*154,o.d/74*154);}
    for(const u of units){if(u.dead)continue;ctx.fillStyle=u.team==="blue"?"#67baff":"#ff7e65";ctx.beginPath();ctx.arc((u.group.position.x+33)/66*154,(u.group.position.z+37)/74*154,3,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc((data.x+33)/66*154,(data.z+37)/74*154,4,0,Math.PI*2);ctx.fill();
  }
  function update(dt,t){
    if(!data.active)return;
    dt=clamp(dt,0,.05);frame++;
    if(data.running&&!data.finished){
      if(!online){data.time-=dt;if(data.time<=0){data.time=0;finish();}}
      cool=Math.max(0,cool-dt);
      if(!online&&loading>0){loading=Math.max(0,loading-dt);if(loading===0&&reloadGun){const n=Math.min(specs[reloadGun].mag-ammo[reloadGun],stock[reloadGun]);ammo[reloadGun]+=n;stock[reloadGun]-=n;reloadGun="";}}
      if(data.deathDelay>0){if(!online){data.deathDelay=Math.max(0,data.deathDelay-dt);if(data.deathDelay===0)respawn();}}
      else{
        const f=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0),s=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
        const n=Math.hypot(f,s)||1,v=keys.has("KeyC")?3.2:aim?4.2:keys.has("ShiftLeft")?9:6.1;
        if(!online)slide(data,(-Math.sin(data.yaw)*f+Math.cos(data.yaw)*s)*v*dt/n,(-Math.cos(data.yaw)*f-Math.sin(data.yaw)*s)*v*dt/n);
        if(f||s)bob+=dt*(v>8?14:10);
        if(keys.has("Space")&&data.height===0)data.vy=6.8;
        data.vy-=17*dt;data.height=Math.max(0,data.height+data.vy*dt);if(data.height===0)data.vy=0;
        if(!online)data.spawnShield=Math.max(0,data.spawnShield-dt);
        effects.footsteps(dt,f!==0||s!==0,keys.has("ShiftLeft"));
      }
      if(!online)updateBots(dt,t);
      if(fireHeld&&specs[gun].auto)shoot();
    }
    camera.rotation.order="YXZ";
    camera.position.set(data.x,(keys.has("KeyC")?1.25:1.72)+data.height+Math.sin(bob)*.021,data.z);
    camera.rotation.set(data.pitch,data.yaw,0,"YXZ");
    const fov=aim?(gun==="sniper"?25:53):78;
    camera.fov+=(fov-camera.fov)*Math.min(1,dt*17);camera.updateProjectionMatrix();
    view.visible=data.deathDelay===0&&!aim;
    for(const [id,model]of Object.entries(gunModels)){model.visible=id===gun;if(id===gun){model.position.y=-.29-recoil*.3;model.position.z=-.63+recoil*.2;}}
    recoil=Math.max(0,recoil-dt*4);muzzle.intensity=recoil>.2?3.2:0;
    flash=Math.max(0,flash-dt*2);hit=Math.max(0,hit-dt);
    for(let i=traces.length-1;i>=0;i--){const v=traces[i];v.ttl-=dt;v.mesh.material.opacity=clamp(v.ttl/.16,0,1);if(v.ttl<=0){scene.remove(v.mesh);v.mesh.geometry.dispose();v.mesh.material.dispose();traces.splice(i,1);}}
    effects.update(dt);
    network?.update(dt,t,{keys:{
      w:keys.has("KeyW"),s:keys.has("KeyS"),a:keys.has("KeyA"),d:keys.has("KeyD"),
      shift:keys.has("ShiftLeft"),c:keys.has("KeyC")
    },yaw:data.yaw,pitch:data.pitch});
    if(frame%6===0){refresh();radar();}
  }
  function keyDown(e){
    if(!data.active)return false;
    if(e.code==="Escape"){if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();else{data.running=false;menu.hidden=false;}return true;}
    keys.add(e.code);
    if(!data.running||e.repeat)return true;
    const choices=Object.keys(specs),digit=/^Digit([1-8])$/.exec(e.code);
    if(digit)setGun(choices[Number(digit[1])-1]);
    if(e.code==="KeyR")reload();
    return true;
  }
  function keyUp(e){keys.delete(e.code);return data.active;}
  function pointerDown(e){
    if(!data.active)return false;
    if(e.button===2){aim=true;e.preventDefault();return true;}
    if(e.button===0){fireHeld=true;if(!data.running)lock();else shoot();return true;}
    return true;
  }
  function pointerUp(e){if(!data.active)return false;if(e.button===0)fireHeld=false;if(e.button===2)aim=false;return true;}
  document.addEventListener("mousemove",e=>{
    if(!data.active||!data.running||document.pointerLockElement!==renderer.domElement)return;
    data.yaw-=e.movementX*.0024;data.pitch=clamp(data.pitch-e.movementY*.0022,-1.26,1.26);
  });
  document.addEventListener("pointerlockchange",()=>{
    if(!data.active)return;
    data.running=document.pointerLockElement===renderer.domElement;
    menu.hidden=data.running;if(!data.running){keys.clear();fireHeld=false;aim=false;}
  });
  renderer.domElement.addEventListener("contextmenu",e=>{if(data.active)e.preventDefault();});
  window.addEventListener("blur",()=>{keys.clear();fireHeld=false;aim=false;});
  network=createFpsOnline({world,root,
    connectionChanged:(active)=>{
      online=active;
      units.forEach(u=>u.group.visible=!online&&!u.dead&&data.active);
      if(!active&&data.active){
        $("cv-fps-desc").textContent="온라인 연결 종료 · 오프라인 AI 대전을 선택할 수 있습니다.";
        $("cv-fps-play").textContent="오프라인 AI 대전 시작";
      }
    },
    onWelcome:(m)=>{
      serverTeam=m.team;online=true;
      gun="rifle";units.forEach(u=>u.group.visible=false);
      data.blue=m.score?.blue||0;data.red=m.score?.red||0;data.time=m.time||300;
      $("cv-fps-desc").textContent="연결 성공 · "+m.room+" 방 · "+serverTeam.toUpperCase()+" 팀";
      $("cv-fps-play").textContent="온라인 전투 참가";
      refresh();
    },
    onSnapshot:(m,p)=>{
      data.x=p.x;data.z=p.z;data.hp=p.hp;data.ap=p.armor;
      data.deathDelay=p.dead?Math.max(.1,data.deathDelay):0;
      data.blue=m.score?.blue||0;data.red=m.score?.red||0;data.time=m.time;
      data.kills=p.kills;data.deaths=p.deaths;
      if(specs[p.gun])gun=p.gun;
      if(Number.isFinite(p.ammo))ammo[gun]=p.ammo;
      if(Number.isFinite(p.reserve))stock[gun]=p.reserve;
    },
    onEvent:(m)=>{
      if(m.type==="damage"){effects.play("hurt");flash=.4;}
      if(m.type==="hit"){hit=.2;effects.play("hit");}
      if(m.type==="kill"){feedKill(m.by===network.selfId()?"YOU":"PLAYER",m.victim===network.selfId()?"YOU":"PLAYER",m.head);effects.play("kill");}
      if(m.type==="round_end"){data.running=false;data.finished=true;menu.hidden=false;$("cv-fps-title").textContent="라운드 종료";$("cv-fps-desc").textContent="BLUE "+m.score.blue+" : RED "+m.score.red;$("cv-fps-play").textContent="다음 라운드 준비";}
      if(m.type==="round_start"){data.finished=false;menu.hidden=false;$("cv-fps-title").textContent="NEW ROUND";$("cv-fps-play").textContent="온라인 전투 재개";}
    }
  });
  $("cv-fps-entry").addEventListener("click",start);$("cv-fps-exit").addEventListener("click",stop);
  $("cv-fps-play").addEventListener("click",()=>{
    if(data.finished&&!online){stop();start();return;}
    if(!online)units.forEach(spawn);
    if(online)data.finished=false;
    lock();
  });
  $("cv-fps-fire").addEventListener("click",shoot);$("cv-fps-aim").addEventListener("click",()=>aim=!aim);
  return {start,stop,update,keyDown,keyUp,pointerDown,pointerUp,isActive:()=>data.active,snapshot:()=>({active:data.active,running:data.running,online,hp:data.hp,blue:data.blue,red:data.red,kills:data.kills,deaths:data.deaths,time:data.time,gun,network:network?.snapshot()})};
}
