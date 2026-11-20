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
