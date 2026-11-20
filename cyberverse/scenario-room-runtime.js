import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SCENARIO_WORLD_ASSETS } from "./scenario-world-assets.js";

const RAPIER_URL = "https://esm.sh/@dimforge/rapier3d-compat@0.21.0";
const ROOM_FALLBACKS = {
  academy:[["laptop","학습용 노트북",[-7,.72,-5]],["server","서버 랙",[-3.8,.95,-5.2]],["usb","USB 증거 매체",[3.5,.34,-5]],["tablet","분석 태블릿",[7.2,.45,-5]]],
  soc:[["monitor","관제 모니터",[-7,.8,-5]],["router","네트워크 라우터",[-3.7,.45,-5]],["keyboard","입력 장치",[3.7,.3,-5]],["drive","로그 저장 장치",[7.2,.4,-5]]],
  incident:[["beacon","경보 비콘",[-7,.48,-5]],["drive","백업 드라이브",[-3.7,.4,-5]],["router","네트워크 장비",[3.7,.45,-5]],["evidence","사고 증거 상자",[7.2,.48,-5]]],
  forensics:[["evidence","증거 보관 상자",[-7,.48,-5]],["drive","포렌식 디스크",[-3.7,.4,-5]],["usb","USB 증거 매체",[3.7,.34,-5]],["tablet","분석 태블릿",[7.2,.45,-5]]],
  community:[["laptop","학습용 노트북",[-7,.72,-5]],["tablet","커뮤니티 태블릿",[-3.7,.45,-5]],["badge","보안 배지",[3.7,.32,-5]],["router","홈 네트워크 장비",[7.2,.45,-5]]],
};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const vec=(x=0,y=0,z=0)=>({x,y,z});

export function createScenarioRoomRuntime({THREE,scene,renderer,camera,canvas,announce=()=>{}}){
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const dragPoint=new THREE.Vector3(),dragOffset=new THREE.Vector3();
  const gltfLoader=new GLTFLoader(),props=[],colliderToProp=new Map();
  let activeRoom=null,rapier=null,physicsWorld=null,eventQueue=null,physicsPromise=null;
  let physicsReady=false,physicsFailed=false,drag=null,audioContext=null;
  let sparkRenderer=null,activeSplat=null,sparkFrameQueued=false,lastPlayerPush=0;

  const materials={
    dark:new THREE.MeshStandardMaterial({color:0x152a3c,metalness:.72,roughness:.3}),
    steel:new THREE.MeshStandardMaterial({color:0x7895a5,metalness:.82,roughness:.24}),
    screen:new THREE.MeshStandardMaterial({color:0x102d3e,metalness:.35,roughness:.2,emissive:0x0b5b69,emissiveIntensity:.55}),
    cyan:new THREE.MeshStandardMaterial({color:0x69eadb,metalness:.35,roughness:.25,emissive:0x2cae9e,emissiveIntensity:.5}),
    orange:new THREE.MeshStandardMaterial({color:0xffb27d,metalness:.25,roughness:.38,emissive:0x6e2d18,emissiveIntensity:.2}),
    white:new THREE.MeshStandardMaterial({color:0xd8e8ee,metalness:.2,roughness:.62}),
    rubber:new THREE.MeshStandardMaterial({color:0x17202a,metalness:.05,roughness:.9}),
  };
  function addBox(group,size,position,material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
    mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function addCylinder(group,radius,height,position,material){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,16),material);
    mesh.position.set(...position);mesh.castShadow=true;group.add(mesh);return mesh;
  }
  function makeProp(kind,accent){
    const root=new THREE.Group(),accentMaterial=new THREE.MeshStandardMaterial({color:accent,metalness:.42,roughness:.28,emissive:accent,emissiveIntensity:.16});
    let half=[.45,.28,.35];
    if(kind==="laptop"){
      half=[.62,.12,.43];addBox(root,[1.15,.09,.78],[0,-.08,0],materials.dark);addBox(root,[1.08,.055,.69],[0,-.015,.015],materials.steel);
      const screen=new THREE.Group();screen.position.set(0,.38,-.34);screen.rotation.x=-.12;root.add(screen);
      addBox(screen,[1.1,.72,.065],[0,0,0],materials.dark);addBox(screen,[1,.62,.018],[0,0,.041],materials.screen);
      for(let i=0;i<5;i++)addBox(root,[.82,.012,.025],[0,.035,.13+i*.07],materials.rubber);
    }else if(kind==="server"){
      half=[.48,.82,.42];addBox(root,[.9,1.55,.78],[0,0,0],materials.dark);
      for(let i=0;i<4;i++){addBox(root,[.72,.25,.035],[0,-.55+i*.36,.405],materials.steel);for(let k=0;k<3;k++)addCylinder(root,.025,.02,[-.27+k*.27,-.55+i*.36,.432],materials.cyan);}
      addBox(root,[.2,.1,.03],[0,.73,.414],accentMaterial);
    }else if(kind==="usb"){
      half=[.28,.12,.16];addBox(root,[.48,.18,.25],[0,0,0],materials.dark);addBox(root,[.15,.1,.18],[.31,.01,0],materials.steel);
      addBox(root,[.06,.035,.08],[.42,.01,0],materials.white);addBox(root,[.08,.035,.1],[-.12,.1,0],accentMaterial);
    }else if(kind==="tablet"){
      half=[.4,.08,.55];addBox(root,[.72,.12,1],[0,0,0],materials.dark);addBox(root,[.64,.018,.88],[0,.068,0],materials.screen);addBox(root,[.14,.025,.025],[0,.082,.43],accentMaterial);
    }else if(kind==="monitor"){
      half=[.55,.55,.32];addBox(root,[1.05,.68,.13],[0,.28,0],materials.dark);addBox(root,[.94,.55,.025],[0,.29,.078],materials.screen);
      addBox(root,[.12,.34,.12],[0,-.18,0],materials.steel);addBox(root,[.52,.06,.32],[0,-.36,0],materials.dark);
    }else if(kind==="router"){
      half=[.48,.16,.34];addBox(root,[.92,.24,.65],[0,0,0],materials.dark);addBox(root,[.82,.08,.55],[0,.13,0],materials.steel);
      for(let i=0;i<5;i++)addCylinder(root,.018,.38,[-.34+i*.17,.36,-.22],materials.cyan);
      for(let i=0;i<4;i++)addCylinder(root,.025,.025,[-.25+i*.16,.14,.31],accentMaterial);
    }else if(kind==="keyboard"){
      half=[.58,.09,.24];addBox(root,[1.1,.12,.45],[0,0,0],materials.dark);
      for(let y=0;y<4;y++)for(let x=0;x<11;x++)addBox(root,[.075,.018,.065],[-.48+x*.096,.07,-.14+y*.085],materials.steel);
      addBox(root,[.36,.018,.07],[0,.071,.2],accentMaterial);
    }else if(kind==="drive"){
      half=[.38,.16,.28];addBox(root,[.75,.28,.55],[0,0,0],materials.dark);addBox(root,[.58,.04,.38],[0,.16,0],materials.steel);
      addCylinder(root,.11,.04,[.2,.19,0],materials.cyan);addBox(root,[.15,.04,.08],[-.2,.18,.1],accentMaterial);
    }else if(kind==="beacon"){
      half=[.24,.38,.24];addCylinder(root,.22,.62,[0,0,0],materials.dark);addCylinder(root,.18,.15,[0,.3,0],materials.orange);addCylinder(root,.08,.05,[0,.41,0],materials.cyan);
    }else if(kind==="evidence"){
      half=[.42,.32,.32];addBox(root,[.82,.58,.62],[0,0,0],materials.white);addBox(root,[.88,.08,.66],[0,.31,0],materials.orange);addBox(root,[.18,.07,.68],[0,0,.01],accentMaterial);
    }else if(kind==="badge"){
      half=[.24,.22,.08];addCylinder(root,.24,.12,[0,0,0],materials.steel);addCylinder(root,.16,.14,[0,.01,.02],accentMaterial);addBox(root,[.08,.06,.04],[0,.01,.1],materials.white);
    }
    root.userData.scenarioProp=true;root.userData.kind=kind;
    return {mesh:root,kind,half,body:null,collider:null,velocity:new THREE.Vector3(),speed:0,cooldown:0,held:false};
  }
  function ensureAudio(){
    if(audioContext)return audioContext;
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return null;
    audioContext=new AudioCtx();audioContext.resume?.();return audioContext;
  }
  function impactSound(prop,position){
    const ctx=ensureAudio();if(!ctx)return;
    const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
    osc.type=prop?.kind==="evidence"?"triangle":"sine";
    osc.frequency.setValueAtTime(prop?.kind==="server"?190:115,now);osc.frequency.exponentialRampToValueAtTime(48,now+.16);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);
    pan.pan.value=clamp((position?.x||0)/12,-1,1);osc.connect(gain);gain.connect(pan);pan.connect(ctx.destination);osc.start(now);osc.stop(now+.21);
  }

  async function ensurePhysics(){
    if(physicsPromise)return physicsPromise;
    physicsPromise=(async()=>{
      try{const mod=await import(RAPIER_URL);rapier=mod.default||mod;await rapier.init();physicsReady=true;}
      catch(error){physicsFailed=true;console.warn("[CyberVerse] Rapier unavailable; using lightweight fallback.",error);}
      return physicsReady;
    })();
    return physicsPromise;
  }
  function clearRoom(){
    activeRoom=null;drag=null;props.forEach(p=>p.mesh.parent?.remove(p.mesh));props.length=0;
    colliderToProp.clear();
    if(eventQueue){eventQueue.free();eventQueue=null;}
    if(physicsWorld){physicsWorld.free();physicsWorld=null;}
    if(activeSplat){scene.remove(activeSplat);activeSplat.dispose?.();activeSplat=null;}
  }
  function addCollider(center,half){
    const body=physicsWorld.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(center[0],center[1],center[2]));
    physicsWorld.createCollider(rapier.ColliderDesc.cuboid(half[0],half[1],half[2]).setFriction(.8),body);
  }
  function buildPhysics(){
    if(!physicsReady||!activeRoom)return;
    if(physicsWorld)physicsWorld.free();
    if(eventQueue)eventQueue.free();
    colliderToProp.clear();
    physicsWorld=new rapier.World({x:0,y:-9.81,z:0});eventQueue=new rapier.EventQueue(true);
    addCollider([0,-.18,0],[12,.18,12]);
    addCollider([0,3.5,-11.6],[12,3.5,.2]);addCollider([0,3.5,11.6],[12,3.5,.2]);
    addCollider([-11.6,3.5,0],[.2,3.5,12]);addCollider([11.6,3.5,0],[.2,3.5,12]);
    props.forEach(p=>{
      const body=physicsWorld.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(p.mesh.position.x,p.mesh.position.y,p.mesh.position.z).setLinearDamping(.45).setAngularDamping(.6));
      const c=physicsWorld.createCollider(rapier.ColliderDesc.cuboid(...p.half).setDensity(.7).setFriction(.75).setRestitution(.2).setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS),body);
      p.body=body;p.collider=c;colliderToProp.set(c.handle,p);
    });
  }
  async function loadSplatWorld(roomId){
    const config=SCENARIO_WORLD_ASSETS[roomId]?.world;if(!config?.url)return false;
    try{
      const spark=await import("@sparkjsdev/spark");
      if(!sparkRenderer){sparkRenderer=new spark.SparkRenderer({renderer,onDirty:()=>{if(sparkFrameQueued||document.hidden)return;sparkFrameQueued=true;requestAnimationFrame(()=>{sparkFrameQueued=false;if(!document.hidden)renderer.render(scene,camera);});}});scene.add(sparkRenderer);}
      const mesh=new spark.SplatMesh({url:config.url,paged:true});
      const t=config.transform||{},p=t.position||[0,0,0],q=t.quaternion||[0,0,0,1];
      mesh.position.set(p[0],p[1],p[2]);mesh.quaternion.set(q[0],q[1],q[2],q[3]);mesh.scale.setScalar(t.scale||1);
      scene.add(mesh);await mesh.initialized;activeSplat=mesh;return true;
    }catch(error){console.warn("[CyberVerse] Splat world unavailable; using procedural room.",error);return false;}
  }
  async function mount(roomId,group){
    clearRoom();activeRoom={id:roomId,group};
    const color=({academy:0x7ed9a8,soc:0x83c7ff,incident:0xffa67d,forensics:0xc6a2ff,community:0x6fe0bd})[roomId]||0x72dfd0;
    (ROOM_FALLBACKS[roomId]||ROOM_FALLBACKS.academy).forEach(([kind,label,position])=>{
      const prop=makeProp(kind,color);prop.label=label;prop.mesh.position.set(...position);group.add(prop.mesh);props.push(prop);
    });
    await ensurePhysics();
    if(activeRoom?.id===roomId&&physicsReady)buildPhysics();
    return loadSplatWorld(roomId);
  }
  function setRay(event){
    const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);
  }
  function findProp(object){while(object&&!object.userData.scenarioProp)object=object.parent;return props.find(p=>p.mesh===object)||null;}
  function pointerDown(event){
    if(!activeRoom||drag)return false;setRay(event);
    const hits=raycaster.intersectObjects(props.map(p=>p.mesh),true);if(!hits.length)return false;
    const prop=findProp(hits[0].object);if(!prop)return false;
    ensureAudio();const point=hits[0].point;dragPlane.set(new THREE.Vector3(0,1,0),-point.y);dragOffset.copy(prop.mesh.position).sub(point);
    drag={prop,id:event.pointerId,last:point.clone(),velocity:new THREE.Vector3(),time:performance.now()};prop.held=true;
    if(prop.body){prop.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased,true);prop.body.setLinvel(vec(),true);prop.body.wakeUp();}
    announce("장비를 잡았습니다 · 드래그해서 이동하고 놓으면 던집니다");return true;
  }
  function pointerMove(event){
    if(!drag||drag.id!==event.pointerId)return false;setRay(event);
    if(!raycaster.ray.intersectPlane(dragPlane,dragPoint))return true;
    const target=dragPoint.clone().add(dragOffset);target.x=clamp(target.x,-10,10);target.z=clamp(target.z,-10,10);target.y=clamp(target.y,.2,2.8);
    const now=performance.now(),dt=Math.max(.01,(now-drag.time)/1000);drag.velocity.copy(target).sub(drag.last).multiplyScalar(1/dt);
    drag.velocity.clamp(new THREE.Vector3(-7,-5,-7),new THREE.Vector3(7,5,7));drag.last.copy(target);drag.time=now;
    if(drag.prop.body)drag.prop.body.setNextKinematicTranslation({x:target.x,y:target.y,z:target.z});else drag.prop.mesh.position.copy(target);
    return true;
  }
  function pointerUp(event){
    if(!drag||drag.id!==event.pointerId)return false;
    const p=drag.prop,v=drag.velocity;drag=null;p.held=false;
    if(p.body){p.body.setBodyType(rapier.RigidBodyType.Dynamic,true);p.body.setLinvel({x:v.x,y:Math.max(1,v.y*.6),z:v.z},true);p.body.wakeUp();}
    else{p.velocity.copy(v);p.velocity.y=Math.max(1,p.velocity.y*.6);}
    impactSound(p,p.mesh.position);return true;
  }
  function update(dt,state){
    if(!activeRoom)return;
    if(physicsWorld){
      props.forEach(p=>{if(p.body){const v=p.body.linvel();p.speed=Math.hypot(v.x,v.y,v.z);}});
      physicsWorld.timestep=clamp(dt,1/120,1/30);physicsWorld.step(eventQueue);
      eventQueue?.drainCollisionEvents((a,b,started)=>{
        if(!started)return;const p=colliderToProp.get(a)||colliderToProp.get(b);
        if(p&&!p.held&&p.speed>.5&&p.cooldown<=0){impactSound(p,p.mesh.position);p.cooldown=.18;}
      });
      props.forEach(p=>{if(p.cooldown>0)p.cooldown=Math.max(0,p.cooldown-dt);if(!p.body)return;const t=p.body.translation(),q=p.body.rotation();p.mesh.position.set(t.x,t.y,t.z);p.mesh.quaternion.set(q.x,q.y,q.z,q.w);});
    }else if(physicsFailed){
      props.forEach(p=>{if(p.held)return;p.velocity.y-=9.81*dt;p.mesh.position.addScaledVector(p.velocity,dt);
        if(p.mesh.position.y<p.half[1]){p.mesh.position.y=p.half[1];if(p.velocity.y<-.6)impactSound(p,p.mesh.position);p.velocity.y=Math.abs(p.velocity.y)*.2;p.velocity.x*=.8;p.velocity.z*=.8;}
        p.mesh.rotation.x+=p.velocity.z*dt*.07;p.mesh.rotation.z-=p.velocity.x*dt*.07;
      });
    }
  }
  return {mount,clearRoom,pointerDown,pointerMove,pointerUp,update,getStatus:()=>({room:activeRoom?.id||null,physics:physicsReady?"rapier":physicsFailed?"fallback":"loading",splats:!!activeSplat,props:props.length})};
}
