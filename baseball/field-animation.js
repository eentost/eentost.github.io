import * as THREE from 'three';

// Home, first, second, third are expressed in the same world coordinates as the field mesh.
export const BASE_POINTS=Object.freeze([
 [0,0,5.05],[11.5,0,-6.8],[0,0,-18.3],[-11.5,0,-6.8]
]);
export function routeFor(start,advance){
 const route=[];for(let k=0;k<=advance;k++)route.push(BASE_POINTS[(start+k)%4]);
 return route;
}
export function runnerPlans(bases,kind){
 const advance={single:1,double:2,triple:3,home_run:4,walk:1,groundout:0,flyout:0}[kind]??0;
 if(kind==='strikeout'||kind==='foul'||kind==='ball'||kind==='strike')return [];
 const plans=[];
 for(let i=2;i>=0;i--){
  if(!bases[i])continue;
  const from=i+1;
  let count=advance;
  if(kind==='walk'){
   count=0;
   if(i===0)count=1;
   if(i===1&&bases[0])count=1;
   if(i===2&&bases[1]&&bases[0])count=1;
  }
  if(count)plans.push({from,steps:Math.min(count,4-from),runner:'base'+i});
 }
 if(kind!=='flyout')plans.push({from:0,steps:kind==='groundout'?1:advance,runner:'batter'});
 return plans;
}
const vec=p=>new THREE.Vector3(...p);
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
function createRunner(scene,color){
 const g=new THREE.Group();scene.add(g);
 const shirt=new THREE.MeshStandardMaterial({color,roughness:.72});
 const pants=new THREE.MeshStandardMaterial({color:0xe8edf3,roughness:.78});
 const skin=new THREE.MeshStandardMaterial({color:0xcfa07e,roughness:.85});
 const dark=new THREE.MeshStandardMaterial({color:0x21334b,roughness:.7});
 const add=(parent,geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o};
 add(g,new THREE.CapsuleGeometry(.35,.62,6,12),shirt,0,1.62,0);
 add(g,new THREE.SphereGeometry(.28,16,12),skin,0,2.44,0);
 add(g,new THREE.SphereGeometry(.30,16,12,0,Math.PI*2,0,Math.PI*.54),dark,0,2.55,0);
 const arms=[],legs=[];
 for(const sign of [-1,1]){
  const arm=new THREE.Group();arm.position.set(sign*.42,1.95,0);g.add(arm);
  add(arm,new THREE.CapsuleGeometry(.11,.42,5,10),shirt,0,-.30,0);arms.push(arm);
  const leg=new THREE.Group();leg.position.set(sign*.20,1.04,0);g.add(leg);
  add(leg,new THREE.CapsuleGeometry(.15,.62,5,10),pants,0,-.48,0);legs.push(leg);
  add(leg,new THREE.BoxGeometry(.29,.16,.42),dark,0,-.92,-.13);
 }
 return {group:g,arms,legs};
}
export function createBaseballVisuals({scene,ball,fielders=[]}){
 const active=[],standing=[null,null,null];
 let sequence=null,focus=null,catchEffect=null;
 const fieldHome=vec(BASE_POINTS[0]);
 function setRunnerPosition(actor,p){actor.group.position.set(p.x,0,p.z)}
 function syncBases(bases,team){
  for(let i=0;i<3;i++){
   if(!bases[i]){if(standing[i])standing[i].group.visible=false;continue;}
   if(!standing[i])standing[i]=createRunner(scene,team==='user'?0x4b9bd6:0x199160);
   standing[i].group.visible=true;setRunnerPosition(standing[i],vec(BASE_POINTS[i+1]));
  }
 }
 function clearActive(){
  for(const a of active){scene.remove(a.actor.group);a.actor.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material&&!o.material.userData?.shared)o.material.dispose()}})}
  active.length=0;sequence=null;focus=null;catchEffect=null;
  for(const f of fielders){if(f.userData.originalPosition)f.position.copy(f.userData.originalPosition)}
 }
 function startContact({kind,bases,team='user',lane='center',trajectory='fly',power=.65,start,done}){
  clearActive();
  const plans=runnerPlans(bases,kind);
  for(const actor of standing)if(actor)actor.group.visible=false;
  for(const plan of plans){
   const a=createRunner(scene,team==='user'?0x4b9bd6:0x199160);
   const route=routeFor(plan.from,plan.steps).map(vec);
   setRunnerPosition(a,route[0]);active.push({actor:a,route,steps:plan.steps,from:plan.from});
  }
  const dir={left:-1,center:0,right:1}[lane]??0;
  const homeRun=kind==='home_run',out=['flyout','groundout'].includes(kind);
  const distance=homeRun?98:kind==='triple'?75:kind==='double'?62:kind==='single'?44:out?40:48;
  const destination=new THREE.Vector3(dir*distance*.62,.22,5-distance);
  const launch=start?.clone?.()||new THREE.Vector3(0,1.55,4.5);
  const ballDuration=homeRun?3.0:trajectory==='ground'?1.6:2.35;
  const maxSteps=active.reduce((m,a)=>Math.max(m,a.steps),0);
  const duration=Math.max(ballDuration+.45,maxSteps*.82+.45,kind==='groundout'?1.7:0);
  const fielder=fielders.length?fielders.reduce((a,b)=>a.position.distanceToSquared(destination)<b.position.distanceToSquared(destination)?a:b):null;
  if(fielder&&!fielder.userData.originalPosition)fielder.userData.originalPosition=fielder.position.clone();
  ball.visible=true;ball.position.copy(launch);
  sequence={kind,start:performance.now()/1000,duration,ballDuration,launch,destination,homeRun,out,trajectory,fielder,done,ballLanded:false,fieldCatch:false,relay:false,team};
  focus=ball.position.clone();
  return sequence;
 }
 function catchAtMitt(mitt){
  const target=mitt.getWorldPosition(new THREE.Vector3());
  catchEffect={start:performance.now()/1000,from:ball.position.clone(),target};
 }
 function update(now,dt){
  if(catchEffect){
   const u=THREE.MathUtils.clamp((now-catchEffect.start)/.34,0,1);
   const target=catchEffect.target;
   ball.position.lerpVectors(catchEffect.from,target,ease(u));
   focus=ball.position.clone();
   if(u>=1){ball.visible=false;catchEffect=null}
  }
  if(!sequence)return;
  const s=sequence,t=now-s.start,u=THREE.MathUtils.clamp(t/s.ballDuration,0,1);
  if(t<s.ballDuration){
   const p=s.launch.clone().lerp(s.destination,u);
   p.y=(s.trajectory==='ground'?.25:1.5)+Math.sin(u*Math.PI)*(s.homeRun?19:s.trajectory==='ground'?1.1:12);
   if(s.homeRun&&u>.75)p.y+=8*(u-.75);
   ball.position.copy(p);ball.visible=true;
  }else if(!s.homeRun){
   ball.position.copy(s.destination);ball.position.y=.22;
   if(s.out&&s.fielder&&!s.fieldCatch){s.fieldCatch=true;ball.visible=false;}
   if(!s.out&&t>s.ballDuration+.25){ball.visible=false;}
  }else if(t>s.ballDuration){ball.visible=false}
  if(s.fielder){
   const target=s.destination.clone();target.y=0;
   const f=s.fielder;
   const start=f.userData.originalPosition;
   const chase=ease(Math.min(1,t/(s.ballDuration*.9)));
   f.position.lerpVectors(start,target,chase);
   f.position.y=Math.abs(Math.sin(t*14))*.075*(1-chase);
   if(t>s.ballDuration&&s.out&&!s.relay){
    s.relay=true;
    // A visible throw back toward first/home following the catch.
    s.throwStart=now;s.throwFrom=f.position.clone().add(new THREE.Vector3(0,1.8,0));
   }
   if(s.relay&&t<s.duration-.2){
    const throwU=Math.min(1,(now-s.throwStart)/.72);
    ball.visible=true;
    ball.position.lerpVectors(s.throwFrom,vec(BASE_POINTS[1]).add(new THREE.Vector3(0,1.5,0)),throwU);
    ball.position.y+=Math.sin(Math.PI*throwU)*2;
    if(throwU>=1)ball.visible=false;
   }
  }
  for(const a of active){
   const segmentTime=Math.min(a.steps,Math.max(0,t/.82));
   const index=Math.min(a.route.length-2,Math.floor(segmentTime));
   const f=segmentTime-index;
   if(a.route.length>1){
    const from=a.route[index],to=a.route[index+1];
    a.actor.group.position.lerpVectors(from,to,f);
    const direction=to.clone().sub(from);a.actor.group.rotation.y=Math.atan2(-direction.x,-direction.z);
   }
   const moving=t<a.steps*.82;
   const gait=moving?Math.sin(t*16):0;
   a.actor.legs[0].rotation.x=gait*.6;a.actor.legs[1].rotation.x=-gait*.6;
   a.actor.arms[0].rotation.x=-gait*.48;a.actor.arms[1].rotation.x=gait*.48;
   a.actor.group.position.y=moving?Math.abs(Math.sin(t*16))*.075:0;
  }
  focus=ball.visible?ball.position.clone():active.length?active[active.length-1].actor.group.position.clone().add(new THREE.Vector3(0,1.4,0)):s.destination.clone();
  if(t>=s.duration){
   const done=s.done;clearActive();ball.visible=false;
   if(typeof done==='function')done();
  }
 }
 function reset(){clearActive();for(const a of standing)if(a)a.group.visible=false;ball.visible=false}
 return {startContact,catchAtMitt,syncBases,update,reset,get focus(){return focus},get active(){return !!sequence}};
}
