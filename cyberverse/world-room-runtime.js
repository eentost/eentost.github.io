/* Browser-native CyberVerse room builder.
 * Design principles adapted from Scenario Agent Skills: coherent art direction,
 * clean scene composition, PBR materials, object-level assets, room calibration,
 * and interaction QA. No Scenario API, remote asset service, or external runtime.
 */
const ROOM_CONFIG = {
  academy:{title:"CYBER ACADEMY",accent:0x75e8c8,glow:0x2e9f9b,wall:0x17364a,floor:0x10283a,props:["laptop","tablet","usb","book"]},
  soc:{title:"SOC OPERATIONS",accent:0x7fc9ff,glow:0x277eaf,wall:0x172f49,floor:0x0d2035,props:["monitor","keyboard","router","drive"]},
  incident:{title:"INCIDENT COMMAND",accent:0xffa77d,glow:0xb64e45,wall:0x392936,floor:0x241f31,props:["beacon","drive","router","evidence"]},
  forensics:{title:"DIGITAL FORENSICS",accent:0xc6a4ff,glow:0x7655b4,wall:0x282743,floor:0x191d34,props:["evidence","drive","usb","tablet"]},
  community:{title:"SECURITY COMMUNITY",accent:0x75e6b7,glow:0x368d76,wall:0x1c3a42,floor:0x102c35,props:["laptop","tablet","badge","router"]},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createWorldRoomRuntime({THREE,scene,camera,canvas,announce=()=>{}}){
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  const dragPoint=new THREE.Vector3();
  const dragOffset=new THREE.Vector3();
  const dragPlane=new THREE.Plane();
  const props=[];
  const supports=[];
  const playerSolids=[];
  let rootGroup=null,roomId=null,drag=null,hovered=null,audioContext=null,hoverRing=null;

  const mats={
    steel:new THREE.MeshStandardMaterial({color:0x728d9e,metalness:.82,roughness:.27}),
    darkMetal:new THREE.MeshStandardMaterial({color:0x142638,metalness:.72,roughness:.34}),
    black:new THREE.MeshStandardMaterial({color:0x07131e,metalness:.35,roughness:.42}),
    glass:new THREE.MeshStandardMaterial({color:0x1b5870,metalness:.4,roughness:.2,emissive:0x0c354a,emissiveIntensity:.32}),
    screen:new THREE.MeshStandardMaterial({color:0x0b2437,metalness:.18,roughness:.2,emissive:0x0a7182,emissiveIntensity:.7}),
    white:new THREE.MeshStandardMaterial({color:0xcbdce2,metalness:.18,roughness:.65}),
    rubber:new THREE.MeshStandardMaterial({color:0x111a22,metalness:.05,roughness:.92}),
    wood:new THREE.MeshStandardMaterial({color:0x344c5b,metalness:.16,roughness:.62}),
    red:new THREE.MeshStandardMaterial({color:0xb84c45,metalness:.28,roughness:.35,emissive:0x4d1111,emissiveIntensity:.3}),
  };
  function mat(color,metal=.25,rough=.5,emissive=0){
    return new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive,emissiveIntensity:emissive?.35:0});
  }
  function meshBox(parent,size,pos,material,rotation=null){
    const o=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material);
    o.position.set(pos[0],pos[1],pos[2]);
    if(rotation)o.rotation.set(rotation[0],rotation[1],rotation[2]);
    o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function meshCylinder(parent,radius,height,pos,material,rotation=null){
    const o=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,16),material);
    o.position.set(pos[0],pos[1],pos[2]);
    if(rotation)o.rotation.set(rotation[0],rotation[1],rotation[2]);
    o.castShadow=true;parent.add(o);return o;
  }
  function addSolid(cx,cz,hx,hz,topY,bottomY=0){
    const s={cx,cz,hx,hz,topY,bottomY};
    playerSolids.push(s);return s;
  }
  function addSupport(cx,cz,hx,hz,topY){
    supports.push({cx,cz,hx,hz,topY});
    addSolid(cx,cz,hx,hz,topY,0);
  }
  function addScreen(parent,x,y,z,w,h,accent){
    meshBox(parent,[w+.12,h+.12,.13],[x,y,z],mats.black);
    meshBox(parent,[w,h,.025],[x,y,z+.078],mats.screen);
    const glow=mat(accent,.2,.24,accent);
    for(let i=0;i<4;i++)meshBox(parent,[w*.72,.018,.012],[x-w*.08,y+h*.27-i*h*.16,z+.096],glow);
    meshBox(parent,[w*.24,.025,.012],[x-w*.34,y-h*.34,z+.096],glow);
    meshBox(parent,[.1,.28,.1],[x,y-h*.5-.14,z],mats.steel);
    meshBox(parent,[w*.34,.055,.3],[x,y-h*.5-.3,z],mats.darkMetal);
  }
  function addDesk(parent,x,z,accent,index){
    const w=2.55,d=1.48,top=.94;
    meshBox(parent,[w,.16,d],[x,top-.08,z],mats.wood);
    meshBox(parent,[w+.08,.045,d+.08],[x,top+.015,z],mat(accent,.3,.3,accent));
    for(const sx of [-1,1])for(const sz of [-1,1])
      meshBox(parent,[.12,.86,.12],[x+sx*(w/2-.12),.45,z+sz*(d/2-.12)],mats.darkMetal);
    meshBox(parent,[w*.72,.52,.09],[x,.58,z+d/2-.1],mats.darkMetal);
    addSupport(x,z,w/2,d/2,top+.04);
    addSolid(x,z,w/2,d/2,top,0);
    meshBox(parent,[.78,.62,.07],[x,.47,z+d/2+.12],mats.black);
    meshBox(parent,[.64,.45,.025],[x,.49,z+d/2+.16],mats.glass);
    for(let k=0;k<3;k++)meshBox(parent,[.14,.018,.012],[x-.2+k*.2,.49,z+d/2+.18],mat(accent,.1,.2,accent));
    // A chair is visual furniture; the table itself is the walk-blocking collider.
    const chairX=x,chairZ=z+d/2+.95;
    meshBox(parent,[.78,.13,.72],[chairX,.52,chairZ],mats.darkMetal);
    meshBox(parent,[.78,.78,.13],[chairX,.94,chairZ+.31],mats.darkMetal);
    for(const sx of [-1,1])for(const sz of [-1,1])
      meshBox(parent,[.07,.48,.07],[chairX+sx*.31,.25,chairZ+sz*.28],mats.steel);
    addSolid(chairX,chairZ,.43,.4,.99,0);
    return {x,z,top:top+.04,index};
  }
  function buildArchitecture(id,config){
    rootGroup=new THREE.Group();rootGroup.name="CyberVerseRoom_"+id;rootGroup.userData.roomId=id;
    const floorMat=mat(config.floor,.28,.78),wallMat=mat(config.wall,.36,.68),trim=mat(config.accent,.48,.34,config.glow);
    meshBox(rootGroup,[23.2,.22,23.2],[0,-.14,0],floorMat);
    // Floor inlays create depth and a calibrated 2 m grid without excessive geometry.
    for(let i=-10;i<=10;i+=2){
      meshBox(rootGroup,[.018,.012,22],[i,.0,0],mat(0x31536a,.2,.72));
      meshBox(rootGroup,[22,.012,.018],[0,.0,i],mat(0x31536a,.2,.72));
    }
    // Three closed walls and a deliberately open entrance toward the city.
    meshBox(rootGroup,[23.2,7.2,.34],[0,3.55,-11.55],wallMat);
    meshBox(rootGroup,[.34,7.2,23.2],[-11.55,3.55,0],wallMat);
    meshBox(rootGroup,[.34,7.2,23.2],[11.55,3.55,0],wallMat);
    meshBox(rootGroup,[23.2,.28,.5],[0,7.05,-11.5],trim);
    meshBox(rootGroup,[.5,.28,23.2],[-11.5,7.05,0],trim);
    meshBox(rootGroup,[.5,.28,23.2],[11.5,7.05,0],trim);
    // Rear glazing, structural ribs and ceiling light rails.
    for(let x=-9;x<=9;x+=3){
      meshBox(rootGroup,[.08,5.3,.12],[x,3.45,-11.31],trim);
      meshBox(rootGroup,[.07,6.5,.07],[x,3.6,-10.95],mats.steel);
    }
    for(let z=-9;z<=9;z+=3){
      meshBox(rootGroup,[.07,6.5,.07],[-11.28,3.6,z],mats.steel);
      meshBox(rootGroup,[.07,6.5,.07],[11.28,3.6,z],mats.steel);
    }
    for(let x=-8;x<=8;x+=4){
      meshBox(rootGroup,[.12,.16,20],[x,6.65,0],mats.darkMetal);
      meshBox(rootGroup,[2.5,.055,.22],[x,6.48,0],mat(0xc3f8f1,.1,.24,config.accent));
    }
    // Main command display wall.
    meshBox(rootGroup,[17,3.35,.3],[0,4.55,-11.18],mats.black);
    meshBox(rootGroup,[16.5,2.95,.04],[0,4.55,-10.99],mat(0x081a2b,.22,.2,config.glow));
    for(let i=0;i<6;i++){
      const x=-6.65+i*2.66;
      meshBox(rootGroup,[2.45,1.55,.055],[x,4.7,-10.93],mats.darkMetal);
      meshBox(rootGroup,[2.31,1.4,.025],[x,4.7,-10.89],mat(0x0a2637,.2,.2,config.glow));
      for(let r=0;r<5;r++)meshBox(rootGroup,[1.55,.025,.012],[x-.2,5.1-r*.19,-10.86],mat(config.accent,.1,.2,config.accent));
    }
    // Side equipment cabinets and emergency lighting.
    for(const side of [-1,1]){
      for(let i=0;i<3;i++){
        const x=side*(9.35),z=-5+i*4.1;
        meshBox(rootGroup,[1.35,2.45,1.1],[x,1.22,z],mats.darkMetal);
        for(let r=0;r<5;r++)meshBox(rootGroup,[.94,.025,.018],[x, .48+r*.34,z+.57],mat(config.accent,.2,.3,config.glow));
        meshBox(rootGroup,[.18,.12,.035],[x-.43,2.22,z+.58],mats.red);
        addSolid(x,z,.72,.62,2.45,0);
      }
    }
    // Ceiling luminaires and local fill lights.
    for(const x of [-7,0,7]){
      const lightMat=mat(0xb8fff4,.05,.2,0x70e6d6);
      meshBox(rootGroup,[3.2,.08,.42],[x,6.42,-1],lightMat);
      const point=new THREE.PointLight(config.accent,1.25,13,2);
      point.position.set(x,5.9,0);rootGroup.add(point);
    }
    const title=makeLabel(config.title,config.accent);
    title.position.set(0,6.25,10.95);title.scale.set(7.8,1.05,1);rootGroup.add(title);
    // Four calibrated work surfaces; props spawn on their tops.
    const stations=[];
    [-7.65,-2.55,2.55,7.65].forEach((x,i)=>stations.push(addDesk(rootGroup,x,-5.2,config.accent,i)));
    if(id==="soc"){
      for(let i=0;i<4;i++)addScreen(rootGroup,-6.3+i*4.2,2.7,-10.65,3.5,1.8,config.accent);
    }else if(id==="incident"){
      for(let i=0;i<5;i++)meshCylinder(rootGroup,.16,.48,[-8+i*4,6.05,8.5],mats.red);
      meshBox(rootGroup,[9,.12,.12],[0,5.72,8.5],trim);
    }else if(id==="forensics"){
      for(let i=0;i<4;i++){
        const x=-7.5+i*5;
        meshBox(rootGroup,[1.25,1.8,.72],[x,.95,7.4],mats.glass);
        meshBox(rootGroup,[1.3,.08,.78],[x,1.9,7.4],trim);
      }
    }else if(id==="community"){
      meshCylinder(rootGroup,1.65,.18,[0,.68,6.5],mats.wood);
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2;
        meshBox(rootGroup,[.75,.72,.72],[Math.cos(a)*2.35,.38,6.5+Math.sin(a)*2.35],mats.darkMetal);
      }
    }else{
      for(let i=0;i<4;i++)addScreen(rootGroup,-7.2+i*4.8,2.9,-10.65,3.3,1.55,config.accent);
    }
    return stations;
  }
  function makeLabel(text,color){
    const c=document.createElement("canvas");c.width=1024;c.height=160;
    const ctx=c.getContext("2d");ctx.fillStyle="#061725";ctx.fillRect(0,0,1024,160);
    ctx.strokeStyle="#"+color.toString(16).padStart(6,"0");ctx.lineWidth=7;ctx.strokeRect(5,5,1014,150);
    ctx.font="800 64px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle="#eaffff";ctx.fillText(text,512,80);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(8,1.25),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
  }
  function createProp(kind,accent,x,z,top){
    const root=new THREE.Group(),glow=mat(accent,.25,.28,accent);
    let half=[.38,.22,.3];
    if(kind==="laptop"){
      half=[.58,.42,.42];
      meshBox(root,[1.05,.07,.76],[0,-.28,.02],mats.darkMetal);
      meshBox(root,[.95,.018,.64],[0,-.235,.02],mats.steel);
      for(let r=0;r<4;r++)for(let c=0;c<10;c++)meshBox(root,[.07,.018,.055],[-.41+c*.09,-.21,-.2+r*.105],mats.rubber);
      const display=new THREE.Group();display.position.set(0,-.23,-.32);display.rotation.x=-.12;root.add(display);
      meshBox(display,[1.04,.72,.075],[0,.36,0],mats.darkMetal);
      meshBox(display,[.94,.62,.018],[0,.36,.047],mats.screen);
      meshBox(display,[.55,.018,.012],[0,.48,.06],glow);
    }else if(kind==="tablet"){
      half=[.42,.08,.57];meshBox(root,[.76,.13,1.08],[0,0,0],mats.darkMetal);
      meshBox(root,[.67,.018,.96],[0,.076,0],mats.screen);
      meshBox(root,[.28,.018,.018],[0,.09,.36],glow);
      meshCylinder(root,.035,.018,[0,.09,-.42],mats.steel,[Math.PI/2,0,0]);
    }else if(kind==="usb"){
      half=[.26,.09,.13];meshBox(root,[.42,.14,.22],[0,0,0],mats.darkMetal);
      meshBox(root,[.14,.095,.16],[.27,0,0],mats.steel);
      meshBox(root,[.08,.035,.1],[.37,.015,0],mats.white);
      meshBox(root,[.09,.025,.13],[-.12,.085,0],glow);
    }else if(kind==="book"){
      half=[.28,.09,.36];meshBox(root,[.54,.14,.7],[0,0,0],mats.red);
      meshBox(root,[.48,.025,.62],[0,.08,0],mats.white);
      meshBox(root,[.035,.16,.7],[-.24,0,0],mats.steel);
    }else if(kind==="monitor"){
      half=[.48,.5,.28];meshBox(root,[.95,.7,.12],[0,.22,0],mats.darkMetal);
      meshBox(root,[.84,.57,.025],[0,.23,.078],mats.screen);
      meshBox(root,[.13,.3,.12],[0,-.3,0],mats.steel);
      meshBox(root,[.5,.06,.3],[0,-.47,0],mats.darkMetal);
      for(let i=0;i<3;i++)meshBox(root,[.55,.02,.012],[0,.38-i*.16,.1],glow);
    }else if(kind==="keyboard"){
      half=[.56,.08,.25];meshBox(root,[1.1,.12,.48],[0,0,0],mats.darkMetal);
      for(let r=0;r<4;r++)for(let c=0;c<12;c++)meshBox(root,[.065,.025,.065],[-.49+c*.088,.075,-.16+r*.1],mats.steel);
      meshBox(root,[.32,.025,.07],[0,.075,.22],glow);
    }else if(kind==="router"){
      half=[.48,.18,.34];meshBox(root,[.92,.25,.65],[0,0,0],mats.darkMetal);
      meshBox(root,[.78,.06,.54],[0,.15,0],mats.steel);
      for(let i=0;i<4;i++)meshCylinder(root,.018,.4,[-.3+i*.2,.43,-.2],mats.black);
      for(let i=0;i<5;i++)meshCylinder(root,.025,.025,[-.28+i*.14,.17,.34],glow);
    }else if(kind==="drive"){
      half=[.4,.16,.29];meshBox(root,[.78,.28,.56],[0,0,0],mats.darkMetal);
      meshBox(root,[.6,.035,.4],[0,.16,0],mats.steel);
      meshCylinder(root,.11,.04,[.2,.19,0],glow);
      meshBox(root,[.13,.04,.08],[-.2,.18,.12],mats.white);
    }else if(kind==="beacon"){
      half=[.24,.38,.24];meshCylinder(root,.22,.58,[0,0,0],mats.darkMetal);
      meshCylinder(root,.18,.16,[0,.32,0],mats.red);
      meshCylinder(root,.09,.05,[0,.43,0],glow);
    }else if(kind==="evidence"){
      half=[.43,.3,.34];meshBox(root,[.84,.56,.66],[0,0,0],mats.white);
      meshBox(root,[.9,.08,.7],[0,.31,0],mats.red);
      meshBox(root,[.2,.08,.72],[0,0,.02],glow);
      meshBox(root,[.3,.08,.06],[0,.36,.35],mats.darkMetal);
    }else if(kind==="badge"){
      half=[.24,.2,.09];meshCylinder(root,.23,.11,[0,0,0],mats.steel);
      meshCylinder(root,.16,.13,[0,.02,.02],glow);
      meshBox(root,[.09,.06,.04],[0,.02,.1],mats.white);
    }
    root.userData.worldProp=true;root.userData.kind=kind;
    root.position.set(x,top+half[1]+.018,z);
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const prop={mesh:root,kind,half,label:({laptop:"학습용 노트북",tablet:"분석 태블릿",usb:"USB 증거 매체",book:"보안 교재",monitor:"관제 모니터",keyboard:"입력 장치",router:"네트워크 라우터",drive:"저장 장치",beacon:"경보 비콘",evidence:"디지털 증거 상자",badge:"보안 배지"})[kind]||kind,velocity:new THREE.Vector3(),angular:new THREE.Vector3(),cooldown:0,held:false};
    props.push(prop);rootGroup.add(root);return prop;
  }
  function ensureAudio(){
    if(audioContext)return audioContext;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    audioContext=new C();audioContext.resume?.();return audioContext;
  }
  function impactSound(prop){
    const ctx=ensureAudio();if(!ctx)return;
    const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
    osc.type=prop.kind==="evidence"?"triangle":"sine";
    osc.frequency.setValueAtTime(prop.kind==="server"?175:125,now);
    osc.frequency.exponentialRampToValueAtTime(46,now+.17);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.095,now+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
    pan.pan.value=clamp(prop.mesh.position.x/11,-1,1);
    osc.connect(gain);gain.connect(pan);pan.connect(ctx.destination);osc.start(now);osc.stop(now+.23);
  }
  function clearRoom(){
    if(rootGroup){rootGroup.parent?.remove(rootGroup);rootGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
    rootGroup=null;roomId=null;props.length=0;supports.length=0;playerSolids.length=0;
    drag=null;hovered=null;if(hoverRing){scene.remove(hoverRing);hoverRing.geometry.dispose();hoverRing.material.dispose();hoverRing=null;}
  }
  function mount(id,interiorGroup){
    clearRoom();
    const config=ROOM_CONFIG[id];if(!config)return false;
    roomId=id;
    const workSurfaces=buildArchitecture(id,config);
    // Build the room as one self-contained group, then attach it to the existing interior scene.
    if(rootGroup)interiorGroup.add(rootGroup);
    const kinds=config.props;
    workSurfaces.forEach((surface,i)=>createProp(kinds[i],config.accent,surface.x,surface.z,surface.top));
    const ringGeo=new THREE.TorusGeometry(1,.026,8,48);
    hoverRing=new THREE.Mesh(ringGeo,mat(config.accent,.1,.2,config.accent));
    hoverRing.rotation.x=Math.PI/2;hoverRing.visible=false;scene.add(hoverRing);
    return true;
  }
  function buildArchitecture(id,config){
    rootGroup=new THREE.Group();rootGroup.name="CyberVerseRoom_"+id;
    const floorMat=mat(config.floor,.28,.78),wallMat=mat(config.wall,.36,.68),trim=mat(config.accent,.48,.34,config.glow);
    meshBox(rootGroup,[23.2,.22,23.2],[0,-.14,0],floorMat);
    for(let i=-10;i<=10;i+=2){
      meshBox(rootGroup,[.018,.012,22],[i,0,0],mat(0x31536a,.2,.72));
      meshBox(rootGroup,[22,.012,.018],[0,0,i],mat(0x31536a,.2,.72));
    }
    meshBox(rootGroup,[23.2,7.2,.34],[0,3.55,-11.55],wallMat);
    meshBox(rootGroup,[.34,7.2,23.2],[-11.55,3.55,0],wallMat);
    meshBox(rootGroup,[.34,7.2,23.2],[11.55,3.55,0],wallMat);
    meshBox(rootGroup,[23.2,.28,.5],[0,7.05,-11.5],trim);
    for(const x of [-9,-6,-3,0,3,6,9])meshBox(rootGroup,[.08,5.3,.12],[x,3.45,-11.31],trim);
    for(const side of [-1,1])for(const z of [-9,-6,-3,0,3,6,9])
      meshBox(rootGroup,[.07,6.5,.07],[side*11.28,3.6,z],mats.steel);
    for(let x=-8;x<=8;x+=4){
      meshBox(rootGroup,[.12,.16,20],[x,6.65,0],mats.darkMetal);
      meshBox(rootGroup,[2.5,.055,.22],[x,6.48,0],mat(0xc3f8f1,.1,.24,config.accent));
    }
    meshBox(rootGroup,[17,3.35,.3],[0,4.55,-11.18],mats.black);
    meshBox(rootGroup,[16.5,2.95,.04],[0,4.55,-10.99],mat(0x081a2b,.22,.2,config.glow));
    for(let i=0;i<6;i++){
      const x=-6.65+i*2.66;
      meshBox(rootGroup,[2.45,1.55,.055],[x,4.7,-10.93],mats.darkMetal);
      meshBox(rootGroup,[2.31,1.4,.025],[x,4.7,-10.89],mat(0x0a2637,.2,.2,config.glow));
      for(let r=0;r<5;r++)meshBox(rootGroup,[1.55,.025,.012],[x-.2,5.1-r*.19,-10.86],mat(config.accent,.1,.2,config.accent));
    }
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const x=side*9.35,z=-5+i*4.1;
      meshBox(rootGroup,[1.35,2.45,1.1],[x,1.22,z],mats.darkMetal);
      for(let r=0;r<5;r++)meshBox(rootGroup,[.94,.025,.018],[x,.48+r*.34,z+.57],mat(config.accent,.2,.3,config.glow));
      meshBox(rootGroup,[.18,.12,.035],[x-.43,2.22,z+.58],mats.red);
      addSolid(x,z,.72,.62,2.45,0);
    }
    for(const x of [-7,0,7]){
      meshBox(rootGroup,[3.2,.08,.42],[x,6.42,-1],mat(0xb8fff4,.05,.2,0x70e6d6));
      const light=new THREE.PointLight(config.accent,1.25,13,2);light.position.set(x,5.9,0);rootGroup.add(light);
    }
    const title=makeLabel(config.title,config.accent);title.position.set(0,6.25,10.95);title.scale.set(7.8,1.05,1);rootGroup.add(title);
    const workSurfaces=[];
    [-7.65,-2.55,2.55,7.65].forEach((x,i)=>workSurfaces.push(addDesk(rootGroup,x,-5.2,config.accent,i)));
    if(id==="soc"){
      for(let i=0;i<4;i++)addScreen(rootGroup,-6.3+i*4.2,2.7,-10.65,3.5,1.8,config.accent);
    }else if(id==="incident"){
      for(let i=0;i<5;i++)meshCylinder(rootGroup,.16,.48,[-8+i*4,6.05,8.5],mats.red);
      meshBox(rootGroup,[9,.12,.12],[0,5.72,8.5],trim);
    }else if(id==="forensics"){
      for(let i=0;i<4;i++){
        const x=-7.5+i*5;
        meshBox(rootGroup,[1.25,1.8,.72],[x,.95,7.4],mats.glass);
        meshBox(rootGroup,[1.3,.08,.78],[x,1.9,7.4],trim);
        addSolid(x,7.4,.68,.42,1.86,0);
      }
    }else if(id==="community"){
      meshCylinder(rootGroup,1.65,.18,[0,.68,6.5],mats.wood);
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2;
        meshBox(rootGroup,[.75,.72,.72],[Math.cos(a)*2.35,.38,6.5+Math.sin(a)*2.35],mats.darkMetal);
        addSolid(Math.cos(a)*2.35,6.5+Math.sin(a)*2.35,.42,.4,.74,0);
      }
    }else{
      for(let i=0;i<4;i++)addScreen(rootGroup,-7.2+i*4.8,2.9,-10.65,3.3,1.55,config.accent);
    }
    return workSurfaces;
  }
  function setRay(event){
    const r=canvas.getBoundingClientRect();pointer.x=(event.clientX-r.left)/r.width*2-1;
    pointer.y=-(event.clientY-r.top)/r.height*2+1;raycaster.setFromCamera(pointer,camera);
  }
  function findProp(object){
    while(object&&!object.userData.worldProp)object=object.parent;
    return props.find(p=>p.mesh===object)||null;
  }
  function pointerDown(event){
    if(!roomId||drag)return false;
    setRay(event);const hits=raycaster.intersectObjects(props.map(p=>p.mesh),true);
    if(!hits.length)return false;
    const prop=findProp(hits[0].object);if(!prop)return false;
    ensureAudio();const hit=hits[0].point;
    const normal=camera.getWorldDirection(new THREE.Vector3()).normalize();
    dragPlane.setFromNormalAndCoplanarPoint(normal,hit);dragOffset.copy(prop.mesh.position).sub(hit);
    drag={prop,id:event.pointerId,last:hit.clone(),velocity:new THREE.Vector3(),startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,time:performance.now(),moved:false};
    prop.held=true;prop.velocity.set(0,0,0);prop.angular.set(0,0,0);
    announce(prop.label+" 선택 · 드래그하여 이동하거나 놓아서 던지세요");
    return true;
  }
  function pointerMove(event){
    if(!roomId)return false;
    if(!drag){
      setRay(event);const hits=raycaster.intersectObjects(props.map(p=>p.mesh),true);
      hovered=hits.length?findProp(hits[0].object):null;
      if(hoverRing){
        hoverRing.visible=!!hovered;
        if(hovered){hoverRing.position.set(hovered.mesh.position.x,hovered.mesh.position.y-hovered.half[1]+.035,hovered.mesh.position.z);hoverRing.scale.set(Math.max(hovered.half[0],hovered.half[2])*.85,Math.max(hovered.half[0],hovered.half[2])*.85,1);}
      }
      canvas.style.cursor=hovered?"grab":"";
      return false;
    }
    if(event.pointerId!==drag.id)return false;
    setRay(event);if(!raycaster.ray.intersectPlane(dragPlane,dragPoint))return true;
    const target=dragPoint.clone().add(dragOffset);
    target.x=clamp(target.x,-10.1,10.1);target.y=clamp(target.y,.18,4.8);target.z=clamp(target.z,-10.1,10.1);
    const now=performance.now(),elapsed=Math.max(.008,(now-drag.time)/1000);
    drag.velocity.copy(target).sub(drag.last).multiplyScalar(1/elapsed);
    drag.velocity.clamp(new THREE.Vector3(-8,-6,-8),new THREE.Vector3(8,6,8));
    drag.last.copy(target);drag.time=now;
    if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6)drag.moved=true;
    drag.lastX=event.clientX;drag.lastY=event.clientY;
    drag.prop.mesh.position.copy(target);return true;
  }
  function pointerUp(event){
    if(!drag||event.pointerId!==drag.id)return false;
    const d=drag;drag=null;d.prop.held=false;
    if(!d.moved){d.prop.velocity.set(0,0,0);announce(d.prop.label+" · 클릭하여 장비를 조사했습니다");return true;}
    d.prop.velocity.copy(d.velocity).multiplyScalar(1.12);
    d.prop.velocity.x=clamp(d.prop.velocity.x,-8,8);d.prop.velocity.y=clamp(Math.max(1.2,d.prop.velocity.y*.7),.8,5);d.prop.velocity.z=clamp(d.prop.velocity.z,-8,8);
    d.prop.angular.set(d.velocity.z*.12,0,-d.velocity.x*.12);
    impactSound(d.prop);announce(d.prop.label+" 던지기 · 충돌과 반동을 확인하세요");return true;
  }
  function overlapsXZ(a,b){
    return Math.abs(a.mesh.position.x-b.cx)<a.half[0]+b.hx&&Math.abs(a.mesh.position.z-b.cz)<a.half[2]+b.hz;
  }
  function collideSupport(prop,previousY){
    const p=prop.mesh.position,h=prop.half;
    let top=0;
    for(const s of supports){
      if(Math.abs(p.x-s.cx)>h[0]+s.hx||Math.abs(p.z-s.cz)>h[2]+s.hz)continue;
      if(previousY-h[1]>=s.topY-.16&&p.y-h[1]<=s.topY&&prop.velocity.y<=0)top=Math.max(top,s.topY);
    }
    if(p.y-h[1]<top){
      p.y=top+h[1];
      if(prop.velocity.y<-.65&&prop.cooldown<=0){impactSound(prop);prop.cooldown=.18;}
      prop.velocity.y=Math.abs(prop.velocity.y)*.2;
      prop.velocity.x*=.78;prop.velocity.z*=.78;
      prop.angular.multiplyScalar(.78);
    }
  }
  function collideProps(){
    for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++){
      const a=props[i],b=props[j];if(a.held||b.held)continue;
      const dx=b.mesh.position.x-a.mesh.position.x,dz=b.mesh.position.z-a.mesh.position.z;
      const min=a.half[0]*.65+b.half[0]*.65,dist=Math.hypot(dx,dz);
      const vertical=Math.abs(a.mesh.position.y-b.mesh.position.y)<a.half[1]+b.half[1];
      if(!vertical||dist>=min||dist<.001)continue;
      const nx=dx/dist,nz=dz/dist,overlap=min-dist;
      a.mesh.position.x-=nx*overlap*.5;a.mesh.position.z-=nz*overlap*.5;
      b.mesh.position.x+=nx*overlap*.5;b.mesh.position.z+=nz*overlap*.5;
      const rel=(b.velocity.x-a.velocity.x)*nx+(b.velocity.z-a.velocity.z)*nz;
      if(rel<0){const impulse=-rel*.48;a.velocity.x-=impulse*nx;a.velocity.z-=impulse*nz;b.velocity.x+=impulse*nx;b.velocity.z+=impulse*nz;}
    }
  }
  function update(dt){
    if(!roomId)return;
    const step=Math.min(dt,.033);
    for(const p of props){
      if(p.cooldown>0)p.cooldown=Math.max(0,p.cooldown-step);
      if(p.held)continue;
      const pos=p.mesh.position,previousY=pos.y;
      p.velocity.y-=9.81*step;pos.addScaledVector(p.velocity,step);
      pos.x=clamp(pos.x,-10.25,10.25);pos.z=clamp(pos.z,-10.25,10.25);
      if(Math.abs(pos.x)>10.2)p.velocity.x*=-.25;
      if(Math.abs(pos.z)>10.2)p.velocity.z*=-.25;
      collideSupport(p,previousY);
      p.mesh.rotation.x+=p.angular.x*step+p.velocity.z*step*.035;
      p.mesh.rotation.y+=p.angular.y*step;
      p.mesh.rotation.z+=p.angular.z*step-p.velocity.x*step*.035;
      p.velocity.x*=Math.pow(.985,step*60);p.velocity.z*=Math.pow(.985,step*60);
      p.angular.multiplyScalar(Math.pow(.975,step*60));
    }
    collideProps();
  }
  function collidesPlayer(x,z,radius=.42){
    if(!roomId)return false;
    for(const s of playerSolids)if(Math.abs(x-s.cx)<s.hx+radius&&Math.abs(z-s.cz)<s.hz+radius)return true;
    for(const p of props)if(Math.abs(x-p.mesh.position.x)<p.half[0]+radius*.65&&Math.abs(z-p.mesh.position.z)<p.half[2]+radius*.65)return true;
    return false;
  }
  function makeLabel(text,color){
    const c=document.createElement("canvas");c.width=1024;c.height=160;
    const ctx=c.getContext("2d");ctx.fillStyle="#061725";ctx.fillRect(0,0,1024,160);
    ctx.strokeStyle="#"+color.toString(16).padStart(6,"0");ctx.lineWidth=7;ctx.strokeRect(5,5,1014,150);
    ctx.font="800 64px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#eaffff";ctx.fillText(text,512,80);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(8,1.25),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
  }
  return {mount,clearRoom,pointerDown,pointerMove,pointerUp,update,collidesPlayer,getStatus:()=>({room:roomId,physics:"browser-native",props:props.length,held:!!drag})};
}
