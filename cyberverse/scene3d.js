/* CyberVerse 3D city — three.js r180, animated avatars, enterable buildings, multiplayer hooks. */
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {createCinematicCity} from "./scene-cinematic.js";
import {createCombatTraining} from "./scene-combat.js";
import {createFpsArena} from "./scene-fps.js";
const root=document.querySelector(".world-wrap");
if(!root)throw Error("CyberVerse world container not found");
const zones=[
{id:"plaza",name:"중앙 광장",x:0,z:0,col:0x67f0e2},
{id:"community",name:"커뮤니티",x:-17,z:-11,col:0x65e5b4},
{id:"soc",name:"SOC 관제실",x:17,z:-11,col:0x81beff},
{id:"incident",name:"사고 체험관",x:0,z:-24,col:0xffae7e},
{id:"forensics",name:"디지털 포렌식",x:-17,z:13,col:0xc4a6ff},
{id:"academy",name:"보안 아카데미",x:17,z:13,col:0xd8f29e}];
const stations={
community:[["보안 경험 공유","실제 운영을 위해 서버 기반 커뮤니티와 관리자 기능을 배포해야 합니다.","community"],["사고 사례 나누기","서로 다른 사례의 사고 징후를 비교하고 방어 방법을 이야기합니다.","community"]],
soc:[["SOC 모니터링","경보를 수신했다면 평시 기준선, 자산 중요도, 관련 이벤트를 조사합니다.","incident"],["공격 흐름 분석","단일 경보를 곧바로 침해 확정으로 보지 말고 증거를 연결합니다.","incident"]],
incident:[["피싱 대응실","계정 탈취로 이어지는 피싱 사건을 직접 선택하며 방어합니다.","phishing"],["랜섬웨어 대응실","암호화 확산을 막고 격리된 백업을 검증합니다.","ransomware"],["DDoS 대응실","과부하 상황에서 정상 사용자를 보호하는 결정을 내립니다.","ddos"]],
forensics:[["증거 보존","로그의 타임스탬프, 원본 무결성, 수집 경로를 기록해야 합니다.","forensics"],["사고 타임라인","접근, 실행, 권한 변경, 파일 접근의 순서를 재구성합니다.","forensics"]],
academy:[["보안 기초","의심 링크, MFA 승인 요청, 암호화, 백업과 보안 모니터링을 학습합니다.","academy"],["사고 대응 연습","사고 체험관의 단계별 훈련으로 배운 지식을 확인합니다.","incident"]]};
const ui=document.createElement("div");ui.className="cv3-ui";
ui.innerHTML='<div class="cv3-top"><span id="cv3-presence" class="cv3-chip cv3-online">● 3D · 싱글 플레이어</span><button id="cv3-fullscreen" type="button">⛶ 몰입형 화면</button><button id="cv3-motion" type="button">◌ 움직임 줄이기</button></div><div class="cv3-center-label" id="cv3-center-label" aria-live="polite"></div><div class="cv3-bottom"><div class="cv3-help"><b id="cv3-room-label">CYBER CITY</b><span id="cv3-location">중앙 광장 · 외부</span><small>WASD 이동 · 드래그 카메라 · E 상호작용</small></div><button class="cv3-action" id="cv3-action" type="button" style="display:none">E · 입장</button><button class="cv3-exit" id="cv3-exit" type="button" style="display:none">↩ 도시로 돌아가기</button></div><div class="cv3-dpad" aria-label="모바일 아바타 이동"><button data-dir="forward" aria-label="앞으로">▲</button><div><button data-dir="left" aria-label="왼쪽">◀</button><button data-dir="back" aria-label="뒤로">▼</button><button data-dir="right" aria-label="오른쪽">▶</button></div></div><div id="cv3-popup" class="cv3-popup" role="dialog" aria-labelledby="cv3-popup-title" hidden><button id="cv3-close" class="cv3-close" type="button" aria-label="닫기">×</button><span class="cv3-kicker">INTERACTIVE STATION</span><h3 id="cv3-popup-title"></h3><p id="cv3-popup-text"></p><button id="cv3-popup-cta" class="cv3-cta" type="button">자세히 보기 →</button></div><div class="cv3-loading" id="cv3-loading"><div class="cv3-spin"></div><strong>CYBERVERSE 3D</strong><span>사이버 도시를 구성하고 있습니다.</span></div>';
root.append(ui);
const state={area:"city",zone:"plaza",pos:{x:0,z:5,a:0},target:null,focus:null,keys:new Set(),pad:new Set(),mouse:{drag:false,x:0,y:0},camAngle:.62,camHeight:.78,camDist:14,reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,phase:null,step:0,peers:new Map(),lastSend:0,currentStation:null};
const $=id=>document.getElementById(id),city=new THREE.Group(),interior=new THREE.Group(),scene=new THREE.Scene();
scene.background=new THREE.Color(0x09192b);scene.fog=new THREE.FogExp2(0x0a243b,.012);scene.add(city,interior);interior.visible=false;
const camera=new THREE.PerspectiveCamera(56,1,.1,220);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.domElement.className="cv3-webgl";root.prepend(renderer.domElement);root.classList.add("cv3-ready");
const sky=new THREE.HemisphereLight(0x9edfff,0x0b1526,2.3);scene.add(sky);
const sun=new THREE.DirectionalLight(0xd7efff,2.7);sun.position.set(-20,36,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.far=110;scene.add(sun);
const M=(color,metal=.2,rough=.5,em=0)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive:em,emissiveIntensity:em?.38:0});
const stone=M(0x102a3d,.15,.8),road=M(0x081927,.28,.7),frame=M(0x203d53,.5,.45),glass=M(0x20556e,.5,.2,0x092f45),desk=M(0x315469,.48,.42),light=M(0x8cefe4,.3,.28,0x43a79d);
function box(g,w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function floor(g,w,d,x,z,m,y=0){const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);o.rotation.x=-Math.PI/2;o.position.set(x,y,z);o.receiveShadow=true;g.add(o);return o;}
function orb(g,x,y,z,r,color){const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,9),new THREE.MeshBasicMaterial({color}));o.position.set(x,y,z);g.add(o);return o;}
function sign(text,col="#ffffff",size=48){const can=document.createElement("canvas");can.width=1024;can.height=160;const c=can.getContext("2d");c.font="800 "+size+"px system-ui";c.textAlign="center";c.fillStyle=col;c.fillText(text,512,103);const t=new THREE.CanvasTexture(can);t.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));sp.scale.set(9,1.4,1);return sp;}
function ring(g,x,z,col,r=1.3){const o=new THREE.Mesh(new THREE.TorusGeometry(r,.05,6,45),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.68}));o.rotation.x=Math.PI/2;o.position.set(x,.2,z);g.add(o);return o;}
floor(city,120,120,0,0,stone);
for(let i=-50;i<=50;i+=10){floor(city,2.2,110,i,0,road,.02);floor(city,110,2.2,0,i,road,.025);}
const base=new THREE.Mesh(new THREE.CylinderGeometry(8,8.4,.34,48),M(0x245066,.45,.42));base.position.y=.2;base.receiveShadow=true;city.add(base);
const holo=new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,1),M(0x8ae7e7,.7,.2,0x1b8d8e));holo.position.y=3.4;city.add(holo);
const holoRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,.045,7,76),new THREE.MeshBasicMaterial({color:0x82dcff}));holoRing.position.y=3.4;holoRing.rotation.x=.4;city.add(holoRing);
const props=[];
for(const z of zones.slice(1)){
const g=new THREE.Group();g.position.set(z.x,0,z.z);city.add(g);
const accent=M(z.col,.4,.34,z.col),body=M(0x142c42,.48,.5),win=M(0x226780,.55,.2,0x16405a);
const w=z.id==="incident"?14:11,d=10,h=z.id==="soc"?11:z.id==="incident"?9:7;
box(g,w+.8,.3,d+.8,0,.16,0,frame);box(g,w,h,d,0,h/2+.3,0,body);box(g,w+.35,.4,d+.35,0,h+.5,0,accent);
for(let r=0;r<3;r++)for(let c=0;c<4;c++){box(g,w*.16,1.14,.07,(c-1.5)*w*.205,1.95+r*1.9,-d/2-.055,win);}
box(g,2.65,3.25,.13,0,1.82,-d/2-.16,glass);box(g,2.9,.15,.17,0,3.5,-d/2-.2,accent);
const sp=sign(z.name);sp.position.set(0,h+2,0);g.add(sp);
const door={x:z.x,z:z.z-d/2-3.1};ring(city,door.x,door.z,z.col);
props.push({id:z.id,name:z.name,x:door.x,z:door.z});
for(let j=0;j<4;j++)orb(g,(j-1.5)*3.2,.53,-d/2-.85,.14,z.col);
}
for(let i=0;i<25;i++){const a=i*2.399,r=26+i%5*3.5,x=Math.cos(a)*r,z=Math.sin(a)*r;box(city,.36,1.7,.36,x,.9,z,M(0x385669));const leaf=new THREE.Mesh(new THREE.ConeGeometry(1.3,3.4,6),M(i%2?0x357e78:0x287a89));leaf.position.set(x,3.4,z);leaf.castShadow=true;city.add(leaf);}
/* Live simulated intrusion traffic and response effects — visual only. */
const incidentVisual=new THREE.Group();city.add(incidentVisual);
const red=new THREE.MeshBasicMaterial({color:0xff766b}),cyan=new THREE.MeshBasicMaterial({color:0x6dffe1,transparent:true,opacity:.65,side:THREE.DoubleSide});
const threatPaths=[
[new THREE.Vector3(-34,1,-31),new THREE.Vector3(0,2,-24)],
[new THREE.Vector3(32,1,-33),new THREE.Vector3(0,2,-24)],
[new THREE.Vector3(0,2,-24),new THREE.Vector3(17,2,-11)],
[new THREE.Vector3(-17,2,-11),new THREE.Vector3(0,2,-24)]];
const beams=[],attackDots=[];
for(let i=0;i<threatPaths.length;i++){
 const [a,b]=threatPaths[i],line=b.clone().sub(a),length=line.length();
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,length,7),new THREE.MeshBasicMaterial({color:0xff766b,transparent:true,opacity:.56}));
 beam.position.copy(a).add(b).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),line.normalize());
 incidentVisual.add(beam);beams.push(beam);
 for(let j=0;j<3;j++){const p=orb(incidentVisual,a.x,a.y,a.z,.18,0xff7d67);attackDots.push({node:p,path:i,phase:j/3+i*.17});}
}
const shield=new THREE.Mesh(new THREE.SphereGeometry(6.1,24,16),new THREE.MeshBasicMaterial({color:0x51ffde,transparent:true,opacity:.13,wireframe:true,depthWrite:false}));
shield.position.set(17,5,-11);city.add(shield);shield.visible=false;incidentVisual.visible=false;
function defenseFeedback(good){
 shield.visible=!!good;state.flash=performance.now();state.lastGood=!!good;
 announce(good?"대응 성공 · 보호막이 활성화되었습니다":"위험한 선택 · 공격 흐름이 확산됩니다");
}
function renderThreat(t){
 incidentVisual.visible=!!state.phase&&!state.reduced;
 if(!state.phase)return;
 const activeCount=state.phase==="ddos"?4:state.phase==="ransomware"?3:2;
 for(let i=0;i<beams.length;i++)beams[i].visible=i<activeCount;
 for(const p of attackDots){
 p.node.visible=p.path<activeCount;
 if(!p.node.visible)continue;
 const [a,b]=threatPaths[p.path],speed=state.reduced?0:.24;
 const progress=(t*speed+p.phase)%1;
 p.node.position.copy(a).lerp(b,progress);
 p.node.position.y+=Math.sin(progress*Math.PI)*2;
 }
 if(shield.visible){shield.rotation.y+=state.reduced?0:.008;shield.scale.setScalar(1+(state.reduced?0:Math.sin(t*3)*.035));}
}

const effects=[];
for(let i=0;i<100;i++){const a=i*2.4,r=6+(i*17)%46;const p=orb(city,Math.cos(a)*r,1+(i*5%16)*.23,Math.sin(a)*r,.04,i%3?0x64e9f0:0x92aef8);p.userData.base=p.position.y;p.userData.phase=i;effects.push(p);}
function humanoid(color,peer=false){
const g=new THREE.Group(),body=M(color,.45,.38),dark=M(0x143247,.35,.43),face=M(0xdab998,.1,.8),shine=M(0x7af9ec,.25,.3,0x35ad9f);
box(g,.78,.95,.43,0,1.28,0,body);const head=new THREE.Mesh(new THREE.SphereGeometry(.25,14,12),face);head.position.y=2.03;g.add(head);box(g,.48,.1,.46,0,2.2,-.03,dark);box(g,.32,.12,.08,0,2.03,-.22,shine);
const arms=[],legs=[];for(const s of [-1,1]){const a=new THREE.Group();a.position.set(s*.52,1.62,0);box(a,.24,.8,.26,0,-.4,0,body);g.add(a);arms.push(a);
const l=new THREE.Group();l.position.set(s*.2,.8,0);box(l,.3,.78,.34,0,-.4,0,dark);box(l,.36,.13,.48,0,-.79,-.12,body);g.add(l);legs.push(l);}
const glow=orb(g,0,2.48,0,.09,peer?0xffd599:0x99fff5);
g.userData={arms,legs};return g;
}
const local=humanoid(0x4cc4bd);scene.add(local);const me=sign("나","#faffff");me.scale.set(3.5,.6,1);me.position.y=3.1;local.add(me);
let mixer,clips={},currentClip="idle",assetLoaded=false;
new GLTFLoader().load("https://threejs.org/examples/models/gltf/Soldier.glb",obj=>{
const model=obj.scene;model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
const b=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();b.getSize(size);model.scale.setScalar(2.15/Math.max(.01,size.y));
b.setFromObject(model);model.position.y=-b.min.y;local.add(model);
for(const child of local.children)if(child!==model&&child!==me&&child.name!=="cv-combat-training-prop")child.visible=false;
mixer=new THREE.AnimationMixer(model);obj.animations.forEach(clip=>clips[clip.name.toLowerCase()]=mixer.clipAction(clip));clips.idle?.play();assetLoaded=true;
},undefined,()=>{assetLoaded=false;});
let stationPoints=[];
function buildInterior(id){
while(interior.children.length){const o=interior.children[0];interior.remove(o);o.traverse(n=>n.geometry?.dispose?.());}
const zone=zones.find(z=>z.id===id),accent=M(zone.col,.4,.3,zone.col);
floor(interior,24,24,0,0,M(0x123149,.3,.6),.02);
for(let i=-11;i<=11;i+=2){box(interior,.035,.035,24,i,.04,0,M(0x1d506b));box(interior,24,.035,.035,0,.04,i,M(0x1d506b));}
box(interior,24,7,.3,0,3.5,11.5,frame);box(interior,.3,7,24,-11.5,3.5,0,frame);box(interior,.3,7,24,11.5,3.5,0,frame);
box(interior,24,.2,.4,0,6.8,11.5,accent);
const board=sign(zone.name);board.position.set(0,6.1,11);interior.add(board);
const points=stations[id]||[];stationPoints=points.map((row,i)=>{
const x=(i-(points.length-1)/2)*7.4,z=-.8;
box(interior,3.5,1,1.9,x,.65,1,desk);box(interior,3.7,.14,2,x,1.2,1,accent);
box(interior,3,1.9,.23,x,2.42,1.75,M(0x165b79,.3,.4,0x084268));box(interior,2.7,1.55,.06,x,2.42,1.59,new THREE.MeshBasicMaterial({color:0x1a7892}));
for(let r=0;r<5;r++)box(interior,(r%2?.8:1.8),.05,.045,x-.5,3.0-r*.27,1.54,M(0x8bf9e9),false);
ring(interior,x,z,zone.col,.8);orb(interior,x,4.2,1, .25,zone.col);
return {x,z,title:row[0],desc:row[1],action:row[2]};
});
for(let i=0;i<6;i++){const x=-9+i%3*9,z=-5-Math.floor(i/3)*4;box(interior,1.5,2.8,1.4,x,1.5,z,desk);for(let r=0;r<4;r++)box(interior,1.2,.06,.045,x,.7+r*.58,z-.72,accent);}
const exitSign=sign("↩ EXIT");exitSign.position.set(0,3.5,-11);interior.add(exitSign);
}
function announce(s){const el=$("cv3-center-label");el.textContent=s;el.classList.add("cv3-show");clearTimeout(el._timeout);el._timeout=setTimeout(()=>el.classList.remove("cv3-show"),2300);}
function syncPosition(force=false){const t=performance.now();if(!force&&t-state.lastSend<100)return;state.lastSend=t;window.dispatchEvent(new CustomEvent("cv3:move",{detail:{x:+state.pos.x.toFixed(2),z:+state.pos.z.toFixed(2),angle:+state.pos.a.toFixed(2),area:state.area,zone:state.zone}}));}
function enter(id){if(id==="plaza"||!zones.some(z=>z.id===id))return;state.area="interior";state.zone=id;state.pos.x=0;state.pos.z=-7;state.target=null;city.visible=false;interior.visible=true;buildInterior(id);$("cv3-location").textContent=zones.find(z=>z.id===id).name+" · 실내";$("cv3-room-label").textContent="INTERIOR / "+id.toUpperCase();$("cv3-exit").style.display="block";announce("실내 입장 · E로 장비를 조사하세요");syncPosition(true);}
function leave(){const z=zones.find(z=>z.id===state.zone)||zones[0];state.area="city";state.pos.x=z.x;state.pos.z=z.z-8;state.target=null;city.visible=true;interior.visible=false;$("cv3-location").textContent="사이버 도시 · 외부";$("cv3-room-label").textContent="CYBER CITY";$("cv3-exit").style.display="none";announce("사이버 도시로 돌아왔습니다");syncPosition(true);}
function teleport(id){const z=zones.find(z=>z.id===id);if(!z)return;if(state.area!=="city")leave();state.zone=id;state.target={x:z.x,z:z.z-8};announce(z.name+"으로 이동합니다");}
function nearby(){
const p=state.pos,btn=$("cv3-action");let nearest=null,dist=4.6;
for(const q of state.area==="city"?props:stationPoints){const d=Math.hypot(q.x-p.x,q.z-p.z);if(d<dist){dist=d;nearest=q;}}
state.focus=nearest;btn.style.display=nearest?"block":"none";if(nearest)btn.textContent="E · "+(state.area==="city"?nearest.name+" 입장":nearest.title+" 조사");
}
function popup(st){state.currentStation=st;$("cv3-popup-title").textContent=st.title;$("cv3-popup-text").textContent=st.desc;$("cv3-popup-cta").textContent=["phishing","ransomware","ddos"].includes(st.action)?"사고 대응 시작 →":"관련 콘텐츠 열기 →";$("cv3-popup").hidden=false;}
function interact(){if(!$("cv3-popup").hidden)return;const q=state.focus;if(!q)return;if(state.area==="city")enter(q.id);else popup(q);}
function peers(players){const live=new Set();for(const p of players){if(!p.id)continue;live.add(p.id);let m=state.peers.get(p.id);if(!m){m=humanoid([0xffb981,0x9a9fff,0xd7f4a7,0xe6a7df][state.peers.size%4],true);const s=sign((p.name||"동료").slice(0,16));s.scale.set(4,.7,1);s.position.y=3.1;m.add(s);scene.add(m);state.peers.set(p.id,m);}m.userData.net={x:Number(p.x)||0,z:Number(p.z)||0,a:Number(p.angle)||0,area:p.area||"city",zone:p.zone||"plaza"};}
for(const [id,m]of state.peers)if(!live.has(id)){scene.remove(m);state.peers.delete(id);}
$("cv3-presence").textContent="● "+(players.length+1)+"명 협력 중";
}
function peerMove(p){let m=state.peers.get(p.id);if(!m)return;m.userData.net={...m.userData.net,x:Number(p.x)||0,z:Number(p.z)||0,a:Number(p.angle)||0,area:p.area||"city",zone:p.zone||"plaza"};}
const controls=new Set(["KeyW","KeyS","KeyA","KeyD","KeyE","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight","Escape"]);
addEventListener("keydown",e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||""))return;if(fps.keyDown(e)){e.preventDefault();return;}if(combat.onKeyDown(e)){e.preventDefault();return;}if(controls.has(e.code)){state.keys.add(e.code);if(e.code.startsWith("Arrow"))e.preventDefault();}if(e.repeat)return;if(e.code==="KeyE")interact();if(e.code==="Escape"){if(!$("cv3-popup").hidden)$("cv3-popup").hidden=true;else if(state.area==="interior")leave();}});
addEventListener("keyup",e=>{fps.keyUp(e);state.keys.delete(e.code);});
for(const b of ui.querySelectorAll(".cv3-dpad button")){const d=b.dataset.dir;b.addEventListener("pointerdown",e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);state.pad.add(d);});for(const name of ["pointerup","pointercancel","lostpointercapture"])b.addEventListener(name,()=>state.pad.delete(d));}
renderer.domElement.addEventListener("pointerdown",e=>{if(fps.pointerDown(e)||combat.onPointerDown(e))return;state.mouse.drag=true;state.mouse.x=e.clientX;state.mouse.y=e.clientY;renderer.domElement.setPointerCapture?.(e.pointerId);});
renderer.domElement.addEventListener("pointermove",e=>{if(fps.isActive()||combat.onPointerMove(e))return;if(!state.mouse.drag)return;state.camAngle-=(e.clientX-state.mouse.x)*.006;state.camHeight=Math.max(.25,Math.min(1.37,state.camHeight+(e.clientY-state.mouse.y)*.004));state.mouse.x=e.clientX;state.mouse.y=e.clientY;});
renderer.domElement.addEventListener("pointerup",e=>{fps.pointerUp(e);combat.onPointerUp(e);state.mouse.drag=false;});
renderer.domElement.addEventListener("wheel",e=>{state.camDist=Math.max(6,Math.min(24,state.camDist+Math.sign(e.deltaY)*1.5));e.preventDefault();},{passive:false});
$("cv3-action").addEventListener("click",interact);$("cv3-exit").addEventListener("click",leave);$("cv3-close").addEventListener("click",()=>$("cv3-popup").hidden=true);
$("cv3-popup-cta").addEventListener("click",()=>{const act=state.currentStation?.action;$("cv3-popup").hidden=true;if(["phishing","ransomware","ddos"].includes(act)){if(window.CVCOOP?.connected())window.CVCOOP.start(act);else document.querySelector('[data-scenario="'+act+'"]')?.click();document.querySelector(".panel")?.scrollIntoView({behavior:"smooth",block:"nearest"});}else if(act==="community")$("community")?.scrollIntoView({behavior:"smooth"});else if(act==="incident"){leave();teleport("incident");}else announce("전시 장비를 관찰하며 위협 대응을 익혀보세요");});
$("cv3-motion").addEventListener("click",()=>{state.reduced=!state.reduced;$("cv3-motion").textContent=state.reduced?"◉ 움직임 켜기":"◌ 움직임 줄이기";});
$("cv3-fullscreen").addEventListener("click",()=>{root.classList.toggle("cv3-full");document.body.style.overflow=root.classList.contains("cv3-full")?"hidden":"";});
document.querySelectorAll(".zone").forEach(b=>b.addEventListener("click",()=>teleport(b.dataset.zone)));
function resize(){const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
new ResizeObserver(resize).observe(root);resize();
const cinematic=createCinematicCity({scene,city,renderer,root,zones,sky,sun,state});
const combat=createCombatTraining({city,camera,renderer,root,state,local,zones,announce});
const fps=createFpsArena({scene,camera,renderer,root,city,interior,local,state,combat});
const clk=new THREE.Clock();let last=0;
function loop(){
requestAnimationFrame(loop);const dt=Math.min(clk.getDelta(),.05),t=clk.elapsedTime;
let x=(state.keys.has("KeyD")||state.keys.has("ArrowRight")||state.pad.has("right")?1:0)-(state.keys.has("KeyA")||state.keys.has("ArrowLeft")||state.pad.has("left")?1:0);
let z=(state.keys.has("KeyS")||state.keys.has("ArrowDown")||state.pad.has("back")?1:0)-(state.keys.has("KeyW")||state.keys.has("ArrowUp")||state.pad.has("forward")?1:0);
let auto=false;if(state.target&&!x&&!z){const dx=state.target.x-state.pos.x,dz=state.target.z-state.pos.z,d=Math.hypot(dx,dz);if(d<.55)state.target=null;else{x=dx/d;z=dz/d;auto=true;}}
else if(x||z)state.target=null;
const moving=x!==0||z!==0,fast=state.keys.has("ShiftLeft")||state.keys.has("ShiftRight");
if(moving){const len=Math.hypot(x,z),speed=fast?7.8:4.3;let dx=x/len,dz=z/len;
if(!auto){const a=state.camAngle,nx=dx*Math.cos(a)+dz*Math.sin(a),nz=-dx*Math.sin(a)+dz*Math.cos(a);dx=nx;dz=nz;}
const min=state.area==="city"?-45:-10,max=state.area==="city"?45:10;
const nx=Math.max(min,Math.min(max,state.pos.x+dx*speed*dt)),nz=Math.max(min,Math.min(max,state.pos.z+dz*speed*dt));
let blocked=false;
if(state.area==="city"){
 for(const zone of zones.slice(1)){
  const w=zone.id==="incident"?14:11;
  if(Math.abs(nx-zone.x)<w/2+.5&&Math.abs(nz-zone.z)<5.6){blocked=true;break;}
 }
}else{
 for(const p of stationPoints)if(Math.abs(nx-p.x)<2.05&&Math.abs(nz-1)<1.7){blocked=true;break;}
}
if(!blocked){state.pos.x=nx;state.pos.z=nz;}
const a=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(a-state.pos.a),Math.cos(a-state.pos.a));state.pos.a+=delta*Math.min(1,dt*11);syncPosition();}
local.position.set(state.pos.x,.04+(moving&&!state.reduced?Math.abs(Math.sin(t*8))*.04:0),state.pos.z);local.rotation.y=state.pos.a;
if(assetLoaded&&mixer){let clip=moving?(fast?"run":"walk"):"idle";if(clip!==currentClip){clips[currentClip]?.fadeOut(.2);clips[clip]?.reset().fadeIn(.2).play();currentClip=clip;}mixer.update(state.reduced?0:dt);}
else{const swing=state.reduced?0:moving?Math.sin(t*(fast?12:8))*.55:0;local.userData.arms[0].rotation.x=swing;local.userData.arms[1].rotation.x=-swing;local.userData.legs[0].rotation.x=-swing;local.userData.legs[1].rotation.x=swing;}
if(!state.reduced){holo.rotation.y+=dt*.43;holo.rotation.x+=dt*.12;holo.position.y=3.4+Math.sin(t*.8)*.22;holoRing.rotation.z+=dt*.4;for(const o of effects)o.position.y=o.userData.base+Math.sin(t*.6+o.userData.phase)*.15;}
renderThreat(t);
cinematic.update(dt,t);
for(const [id,o]of state.peers){const p=o.userData.net;if(!p)continue;o.visible=p.area===state.area&&(p.area==="city"||p.zone===state.zone);if(o.visible){o.position.lerp(new THREE.Vector3(p.x,0,p.z),Math.min(1,dt*9));o.rotation.y=p.a;}}
const target=new THREE.Vector3(state.pos.x,1.7,state.pos.z),e=state.camHeight,dist=state.camDist;
const cameraGoal=new THREE.Vector3(target.x+Math.sin(state.camAngle)*dist*Math.cos(e),target.y+Math.sin(e)*dist,target.z+Math.cos(state.camAngle)*dist*Math.cos(e));
if(!fps.isActive()){camera.position.lerp(cameraGoal,Math.min(1,dt*3.6));camera.lookAt(target);}
combat.update(dt,t);
fps.update(dt,t);
if(!document.hidden)renderer.render(scene,camera);
if(t-last>.25){nearby();last=t;}
}
$("cv3-loading")?.remove();
window.CV3D={teleport,enter,leave,setPeers:peers,peerMove,setDefense:defenseFeedback,setThreat:(id,step)=>{if(state.phase!==id){shield.visible=false;state.phase=id;announce(id?"침해사고 발생 · 팀과 대응하세요":"방어 준비 완료");}state.step=step;},getPosition:()=>({...state.pos,area:state.area,zone:state.zone})};
document.dispatchEvent(new Event("cv3:ready"));requestAnimationFrame(loop);
