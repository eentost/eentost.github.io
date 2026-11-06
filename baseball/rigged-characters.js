import * as THREE from 'three';

// Original, self-contained stylized baseball characters. No external asset license or API required.
// A hierarchical bone rig drives SkinnedMesh limbs and animation clips.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const q=(x=0,y=0,z=0)=>{const t=new THREE.Quaternion();t.setFromEuler(new THREE.Euler(x,y,z,'XYZ'));return t;};
const mat=(color,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.03});
const palette={skin:mat(0xd8a47c),skinDark:mat(0xbd805e),white:mat(0xe6ecf2),navy:mat(0x19334c),leather:mat(0x87502d,.65),metal:mat(0x8395a6,.4),dark:mat(0x1c2635),wood:mat(0xc58c51,.35)};
function mesh(parent,geometry,material,x=0,y=0,z=0){
 const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function capsule(parent,material,scale,x,y,z){
 const m=mesh(parent,new THREE.CapsuleGeometry(1,1,8,16),material,x,y,z);m.scale.set(...scale);return m;
}
function bone(parent,name,x,y,z){
 const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);return b;
}
function buildClip(name,duration,channels){
 const tracks=[];
 for(const [b,frames] of channels){
  const times=[],values=[];
  for(const [t,x,y,z] of frames){times.push(t);const v=q(x,y,z);values.push(v.x,v.y,v.z,v.w)}
  tracks.push(new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,values));
 }
 return new THREE.AnimationClip(name,duration,tracks);
}
function frames(times,poses){return times.map((t,i)=>[t,...poses[i]])}
function makeBat(hand){
 const p=[[0,.078],[.05,.088],[.12,.055],[.30,.058],[.47,.065],[.7,.09],[.9,.125],[1.12,.15],[1.35,.152],[1.48,.13],[1.52,.055]];
 const holder=new THREE.Group();holder.position.set(0,-.05,0);holder.rotation.set(.18,.16,-.63);hand.add(holder);
 mesh(holder,new THREE.LatheGeometry(p.map(([y,r])=>new THREE.Vector2(r,y)),32),palette.wood);
 mesh(holder,new THREE.CylinderGeometry(.063,.06,.37,18),palette.dark,0,.23,0);
 mesh(holder,new THREE.CylinderGeometry(.095,.095,.05,18),palette.leather,0,0,0);
 for(let i=0;i<6;i++){const ring=mesh(holder,new THREE.TorusGeometry(.064,.006,6,16),palette.metal,0,.10+i*.057,0);ring.rotation.x=Math.PI/2}
 return holder;
}
export function createRiggedPlayer(role='batter',color=0xe9eef5){
 const group=new THREE.Group();group.name='rig_'+role;
 const shirt=mat(color),pants=mat(role==='pitcher'?0x186f48:0xe7eaf0),trim=mat(role==='catcher'?0x213b57:0x2c6998);
 const root=bone(group,role+'_root',0,0,0);
 const hip=bone(root,role+'_hip',0,1.04,0);
 const spine=bone(hip,role+'_spine',0,.36,0);
 const chest=bone(spine,role+'_chest',0,.47,0);
 const neck=bone(chest,role+'_neck',0,.32,0);
 const head=bone(neck,role+'_head',0,.22,0);
 const shoulders={},elbows={},hands={},thighs={},knees={},feet={};
 for(const side of [-1,1]){
  const key=side<0?'L':'R';
  shoulders[key]=bone(chest,role+'_shoulder'+key,side*.42,.07,0);
  elbows[key]=bone(shoulders[key],role+'_elbow'+key,side*.04,-.48,0);
  hands[key]=bone(elbows[key],role+'_hand'+key,0,-.44,0);
  thighs[key]=bone(hip,role+'_thigh'+key,side*.23,-.08,0);
  knees[key]=bone(thighs[key],role+'_knee'+key,0,-.55,0);
  feet[key]=bone(knees[key],role+'_foot'+key,0,-.45,-.07);
 }
 // Organic silhouette; clothing and armor are attached to the moving skeleton.
 capsule(hip,pants,[.37,.24,.25],0,-.05,0);
 capsule(spine,shirt,[.40,.44,.26],0,.23,0);
 capsule(chest,shirt,[.44,.30,.27],0,.02,0);
 mesh(neck,new THREE.CylinderGeometry(.14,.16,.23,16),palette.skin,0,.04,0);
 capsule(head,palette.skin,[.30,.30,.27],0,.10,0);
 const cap=mesh(head,new THREE.SphereGeometry(.315,24,16,0,Math.PI*2,0,Math.PI*.52),role==='pitcher'?mat(0x126d40):trim,0,.21,0);
 mesh(head,new THREE.BoxGeometry(.47,.045,.20),role==='pitcher'?mat(0x126d40):trim,0,.15,-.28);
 for(const side of [-1,1]){
  const key=side<0?'L':'R';
  capsule(shoulders[key],shirt,[.18,.24,.18],0,-.21,0);
  capsule(elbows[key],palette.skin,[.13,.21,.13],0,-.20,0);
  capsule(hands[key],palette.white,[.14,.13,.12],0,-.02,0);
  capsule(thighs[key],pants,[.21,.29,.22],0,-.27,0);
  capsule(knees[key],pants,[.16,.24,.16],0,-.22,0);
  const shoe=mesh(feet[key],new THREE.BoxGeometry(.33,.18,.52),palette.dark,0,-.07,-.12);
  shoe.geometry.translate(0,0,-.04);
 }
 // A genuine SkinnedMesh overlay follows shoulder/elbow and thigh/knee bones.
 group.updateMatrixWorld(true);
 const allBones=[];root.traverse(o=>{if(o.isBone)allBones.push(o)});
 const skeleton=new THREE.Skeleton(allBones);
 function skinnedTube(a,b,len,radius,material){
  const g=new THREE.CylinderGeometry(radius*.88,radius,len,12,10,false);
  const pos=g.attributes.position,indices=[],weights=[];
  for(let i=0;i<pos.count;i++){
   const t=THREE.MathUtils.clamp((.5-pos.getY(i)/len),0,1);
   const blend=THREE.MathUtils.smoothstep(t,.65,1);
   indices.push(allBones.indexOf(a),allBones.indexOf(b),0,0);
   weights.push(1-blend,blend,0,0);
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const world=a.getWorldPosition(V());const local=group.worldToLocal(world);
  g.translate(local.x,local.y-len*.5,local.z);
  const m=new THREE.SkinnedMesh(g,material);m.castShadow=true;m.receiveShadow=true;group.add(m);
  group.updateMatrixWorld(true);m.bind(skeleton);return m;
 }
 for(const side of ['L','R']){
  skinnedTube(shoulders[side],elbows[side],.48,.15,shirt);
  skinnedTube(elbows[side],hands[side],.44,.115,palette.skin);
  skinnedTube(thighs[side],knees[side],.55,.18,pants);
  skinnedTube(knees[side],feet[side],.45,.14,pants);
 }
 // Default baseball-ready poses.
 if(role==='batter'){
  shoulders.L.rotation.set(1.10,-.15,-.36);
  shoulders.R.rotation.set(1.16,.12,.48);
  elbows.L.rotation.set(-1.20,0,.10);elbows.R.rotation.set(-1.25,0,-.12);
  thighs.L.rotation.z=-.10;thighs.R.rotation.z=.10;
  knees.L.rotation.x=.16;knees.R.rotation.x=.16;
  makeBat(hands.R);
 }
 let catcherMitt=null;
 if(role==='catcher'){
  hip.position.y=.73;spine.rotation.x=-.18;
  thighs.L.rotation.set(-1.35,0,-.22);thighs.R.rotation.set(-1.35,0,.22);
  knees.L.rotation.x=2.08;knees.R.rotation.x=2.08;
  shoulders.L.rotation.set(.95,0,-.18);elbows.L.rotation.x=-.35;
  shoulders.R.rotation.set(.60,0,.20);elbows.R.rotation.x=-.7;
  const helmet=mesh(head,new THREE.SphereGeometry(.35,20,16),palette.dark,0,.13,0);
  helmet.scale.y=.86;
  for(let i=-2;i<=2;i++)mesh(head,new THREE.CylinderGeometry(.018,.018,.65,8),palette.metal,i*.12,.06,-.34);
  for(let i=0;i<3;i++){const bar=mesh(head,new THREE.CylinderGeometry(.019,.019,.64,8),palette.metal,0,-.17+i*.17,-.36);bar.rotation.z=Math.PI/2}
  mesh(chest,new THREE.BoxGeometry(.79,.65,.16),trim,0,-.10,-.28);
  for(const side of ['L','R'])mesh(knees[side],new THREE.BoxGeometry(.32,.52,.18),trim,0,-.18,-.20);
  const mitt=mesh(hands.L,new THREE.SphereGeometry(.31,18,14),palette.leather,0,-.04,-.12);catcherMitt=mitt;
  mitt.scale.set(1.15,1,.55);
  const rim=mesh(mitt,new THREE.TorusGeometry(.28,.05,8,20),palette.wood,0,0,-.56);
  rim.rotation.z=.2;
 }
 if(role==='umpire'){
  mesh(chest,new THREE.BoxGeometry(.80,.69,.14),palette.dark,0,-.08,-.28);
  mesh(head,new THREE.BoxGeometry(.62,.43,.22),palette.dark,0,.04,-.30);
 }
 if(role==='pitcher'){
  const glove=mesh(hands.L,new THREE.SphereGeometry(.28,16,12),palette.leather,0,-.04,-.12);glove.scale.set(1.1,1,.7);
  shoulders.L.rotation.x=.65;elbows.L.rotation.x=-.65;
 }
 // Re-bind in a neutral rest pose after hierarchy has been assembled.
 group.updateMatrixWorld(true);
 const idle=buildClip('idle',1.8,[
  [spine,frames([0,.9,1.8],[[role==='catcher'?-.18:0,0,0],[role==='catcher'?-.16:.025,0,0],[role==='catcher'?-.18:0,0,0]])],
  [head,frames([0,.9,1.8],[[0,0,0],[-.025,0,0],[0,0,0]])]
 ]);
 const pitch=buildClip('pitch',1.04,[
  [hip,frames([0,.22,.52,.76,1.04],[[0,0,0],[0,-.32,0],[0,-.52,0],[0,.44,0],[0,0,0]])],
  [spine,frames([0,.22,.52,.76,1.04],[[0,0,0],[-.16,-.24,0],[-.25,-.42,0],[.32,.55,0],[0,0,0]])],
  [shoulders.R,frames([0,.22,.52,.76,1.04],[[.0,0,0],[-1.5,0,.2],[-2.2,.15,.3],[1.3,0,-.3],[0,0,0]])],
  [elbows.R,frames([0,.22,.52,.76,1.04],[[0,0,0],[-.6,0,0],[-1.3,0,0],[-.4,0,0],[0,0,0]])],
  [thighs.L,frames([0,.22,.52,.76,1.04],[[0,0,0],[-.8,0,0],[-1.15,0,0],[.35,0,0],[0,0,0]])]
 ]);
 const swing=buildClip('swing',.72,[
  [hip,frames([0,.15,.28,.42,.58,.72],[[0,-.10,0],[0,-.36,0],[0,.16,0],[0,.75,0],[0,1.06,0],[0,.05,0]])],
  [spine,frames([0,.15,.28,.42,.58,.72],[[0,-.12,0],[0,-.30,-.10],[.05,.25,0],[.14,.85,0],[.10,1.12,0],[0,.04,0]])],
  [shoulders.R,frames([0,.15,.28,.42,.58,.72],[[1.16,.12,.48],[1.35,.1,.48],[.5,-.3,.30],[-.65,-.6,.0],[-1.12,-.25,-.30],[1.16,.12,.48]])],
  [shoulders.L,frames([0,.15,.28,.42,.58,.72],[[1.10,-.15,-.36],[1.30,-.2,-.35],[.55,-.2,-.18],[-.75,.2,.10],[-1.15,.3,.28],[1.10,-.15,-.36]])],
  [elbows.R,frames([0,.15,.28,.42,.58,.72],[[-1.25,0,-.12],[-1.35,0,-.12],[-.85,0,0],[-.22,0,0],[-.08,0,0],[-1.25,0,-.12]])],
  [elbows.L,frames([0,.15,.28,.42,.58,.72],[[-1.20,0,.1],[-1.32,0,.1],[-.9,0,0],[-.3,0,0],[-.08,0,0],[-1.20,0,.1]])]
 ]);
 const catchClip=buildClip('catch',.55,[
  [shoulders.L,frames([0,.18,.36,.55],[[.95,0,-.18],[1.26,0,-.10],[1.02,0,-.18],[.95,0,-.18]])],
  [elbows.L,frames([0,.18,.36,.55],[[-.35,0,0],[-.12,0,0],[-.45,0,0],[-.35,0,0]])],
  [spine,frames([0,.18,.36,.55],[[-.18,0,0],[-.24,0,0],[-.20,0,0],[-.18,0,0]])]
 ]);
 const call=buildClip('call',.75,[
  [shoulders.R,frames([0,.2,.48,.75],[[0,0,0],[-2.3,0,.1],[-2.3,0,.1],[0,0,0]])]
 ]);
 const mixer=new THREE.AnimationMixer(group),clips={idle,pitch,swing,catch:catchClip,call};
 const actions={};for(const [name,clip] of Object.entries(clips)){
  const action=mixer.clipAction(clip);action.enabled=true;
  if(name!=='idle'){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true}
  actions[name]=action;
 }
 let current=null;
 function play(name){
  const next=actions[name];if(!next)return;
  if(current===next&&next.isRunning())return;
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  if(current&&current!==next)current.fadeOut(.12);
  next.fadeIn(.12);current=next;
 }
 mixer.addEventListener('finished',e=>{if(e.action===current&&current!==actions.idle)play('idle')});
 play('idle');
 return {group,mixer,actions,play,mitt:catcherMitt,bones:{root,hip,spine,chest,head,shoulders,elbows,hands,thighs,knees},skinCount:8};
}
