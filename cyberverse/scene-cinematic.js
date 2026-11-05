/* CyberVerse cinematic environment
 * Lightweight procedural textures + PBR architecture + animated atmosphere.
 * Self-contained: no additional remote models, paid APIs, or textures.
 */
import * as THREE from "three";

export function createCinematicCity({scene,city,renderer,root,zones,sky,sun,state}) {
  const pi=Math.PI;
  const rand=(()=>{let seed=20261105;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};})();
  const pick=(a)=>a[Math.floor(rand()*a.length)];
  const sat=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const details=new THREE.Group();
  details.name="CyberVerse cinematic city detail";
  city.add(details);
  const animated=[],lamps=[],drones=[],alerts=[];
  const mk=(w,h,d,mat,x,y,z,parent=details)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const mat=(color,rough=.55,metal=.2,emissive=0)=>{
    return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive,emissiveIntensity:emissive?0.42:0});
  };
  const metal=mat(0x29475a,.32,.72),rubber=mat(0x141f2d,.8,.12);
  const neonBlue=new THREE.MeshBasicMaterial({color:0x7ad8ed,transparent:true,opacity:.93});
  const neonAmber=new THREE.MeshBasicMaterial({color:0xffcc86,transparent:true,opacity:.91});
  const neonRed=new THREE.MeshBasicMaterial({color:0xff786b,transparent:true,opacity:.95});

  // Deterministic repeating PBR-like city ground: stains, seams, aggregate and cracks.
  function paintedTexture(kind) {
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;
    const c=canvas.getContext("2d");
    c.fillStyle=kind==="asphalt"?"#222f3a":"#4d6870";
    c.fillRect(0,0,512,512);
    const n=kind==="asphalt"?12000:5800;
    for(let i=0;i<n;i++){
      const v=Math.floor(rand()*110)+55;
      c.fillStyle=kind==="asphalt"?"rgba("+v+","+(v+8)+","+(v+18)+","+(rand()*.14+.04)+")":"rgba("+v+","+(v+20)+","+(v+24)+","+(rand()*.11+.03)+")";
      c.fillRect(rand()*512,rand()*512,rand()*2.2+.3,rand()*2.2+.3);
    }
    if(kind==="paving"){
      c.strokeStyle="#233b45";c.lineWidth=2;
      for(let y=0;y<=512;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();}
      for(let y=0;y<512;y+=64)for(let x=(y/64)%2?32:0;x<512;x+=64){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+64);c.stroke();}
      c.strokeStyle="#b6c2b91a";c.lineWidth=1;
      for(let i=0;i<160;i++){const x=rand()*512,y=rand()*512;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*20,y+rand()*30);c.stroke();}
    }else{
      c.strokeStyle="#a7bac01a";c.lineWidth=1;
      for(let i=0;i<65;i++){const x=rand()*512,y=rand()*512;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*17,y+rand()*9);c.stroke();}
    }
    const t=new THREE.CanvasTexture(canvas);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const paving=paintedTexture("paving"),asphalt=paintedTexture("asphalt");
  paving.repeat.set(18,18);asphalt.repeat.set(1,10);
  const pavingMat=new THREE.MeshStandardMaterial({map:paving,color:0x8fa0a4,roughness:.92,metalness:.05});
  const roadMat=new THREE.MeshStandardMaterial({map:asphalt,color:0xa0a4ae,roughness:.72,metalness:.14});
  function ground(w,d,x,z,y,m) {
    const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);
    o.rotation.x=-pi/2;o.position.set(x,y,z);o.receiveShadow=true;details.add(o);return o;
  }
  ground(118,118,0,0,.009,pavingMat);
  for(let i=-50;i<=50;i+=10){
    ground(2.15,110,i,0,.033,roadMat);
    const r=roadMat.clone();r.map=asphalt.clone();r.map.needsUpdate=true;r.map.repeat.set(10,1);
    ground(110,2.15,0,i,.036,r);
  }
  const lane=new THREE.MeshBasicMaterial({color:0xc5dfd6,transparent:true,opacity:.38,depthWrite:false});
  for(let i=-40;i<=40;i+=4){
    ground(.075,1.45,0,i,.041,lane);
    ground(1.45,.075,i,0,.042,lane);
  }
  const edge=new THREE.MeshBasicMaterial({color:0x3fa3b7,transparent:true,opacity:.35});
  for(let i=-40;i<=40;i+=10){
    ground(.08,7,i-1.22,-20,.041,edge);ground(.08,7,i+1.22,-20,.041,edge);
  }
  for(const z of [-7,8,23]){
    for(let j=-2;j<=2;j++)ground(1.25,.4,j*1.75,z,.047,lane);
  }
  // Rain reflections: transparent physical puddles avoid dependency on external environment maps.
  const wetMaterial=new THREE.MeshPhysicalMaterial({color:0x80a6bd,roughness:.07,metalness:.47,transparent:true,opacity:.34,depthWrite:false,clearcoat:1,clearcoatRoughness:.06,side:THREE.DoubleSide});
  const puddles=[];
  for(let i=0;i<34;i++){
    const x=(rand()-.5)*93,z=(rand()-.5)*93,r=.55+rand()*1.55;
    const p=new THREE.Mesh(new THREE.CircleGeometry(r,24),wetMaterial);
    p.rotation.x=-pi/2;p.scale.set(1.6,.42,1);p.position.set(x,.052,z);details.add(p);p.visible=false;puddles.push(p);
  }

  // Silhouette of the city beyond the playable plaza.
  const skylineGeometry=new THREE.BoxGeometry(1,1,1);
  const skylineMaterial=new THREE.MeshStandardMaterial({color:0x28445d,metalness:.52,roughness:.43,vertexColors:false});
  const count=112,skyline=new THREE.InstancedMesh(skylineGeometry,skylineMaterial,count);
  const helper=new THREE.Object3D(),towerData=[];
  for(let i=0;i<count;i++){
    const a=2*pi*i/count+(rand()-.5)*.15,rad=73+rand()*26;
    const x=Math.cos(a)*rad,z=Math.sin(a)*rad,h=11+Math.pow(rand(),1.7)*44;
    const w=3.6+rand()*7.4,d=3.8+rand()*7.1;
    helper.position.set(x,h/2-.14,z);helper.scale.set(w,h,d);helper.updateMatrix();
    skyline.setMatrixAt(i,helper.matrix);
    skyline.setColorAt(i,new THREE.Color().setHSL(.56+rand()*.06,.26+rand()*.18,.2+rand()*.16));
    towerData.push({x,z,h,w,d});
  }
  skyline.instanceMatrix.needsUpdate=true;skyline.instanceColor.needsUpdate=true;
  skyline.receiveShadow=false;skyline.castShadow=false;skyline.frustumCulled=false;
  details.add(skyline);

  const strips=new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({color:0x8abdd7,transparent:true,opacity:.62,side:THREE.DoubleSide,depthWrite:false}),
    count*16
  );
  let stripCount=0;
  for(const b of towerData){
    for(let j=0;j<16;j++){
      const y=1.6+(j%8)*(b.h-3)/8;
      const side=j<8?0:1;
      helper.position.set(side?b.x+b.w/2+.013:b.x,y,side?b.z:b.z+b.d/2+.013);
      helper.rotation.set(0,side?pi/2:0,0);
      helper.scale.set(side?b.d*.58:b.w*.58,.09,1);
      helper.updateMatrix();strips.setMatrixAt(stripCount,helper.matrix);
      strips.setColorAt(stripCount,new THREE.Color(pick([0x68bad0,0x9cc9cf,0xd7b57e,0x477c98])));
      stripCount++;
    }
  }
  strips.count=stripCount;strips.instanceMatrix.needsUpdate=true;strips.instanceColor.needsUpdate=true;
  details.add(strips);helper.rotation.set(0,0,0);

  // Foreground: architectural fins, glowing glass, canopy, rooftop plant and screen panels.
  const windowMats=[
    new THREE.MeshBasicMaterial({color:0x6ecde7,transparent:true,opacity:.76}),
    new THREE.MeshBasicMaterial({color:0xe7c18a,transparent:true,opacity:.71}),
    new THREE.MeshBasicMaterial({color:0x244c64,transparent:true,opacity:.78})
  ];
  for(const zone of zones.slice(1)){
    const w=zone.id==="incident"?14:11,d=10,h=zone.id==="soc"?11:zone.id==="incident"?9:7;
    const g=new THREE.Group();g.position.set(zone.x,0,zone.z);details.add(g);
    const tone=zone.col;
    const accent=mat(tone,.36,.5,tone);
    // concrete plinth, facade articulation, copper-toned corner fins
    mk(w+.9,.28,d+.9,metal,0,.18,0,g);
    for(const s of [-1,1]){
      mk(.14,h+.25,.17,metal,s*(w/2-.18),h/2+.3,-d/2-.13,g);
      mk(.22,.22,d+.45,accent,s*(w/2-.05),h+.66,0,g);
      mk(.10,h*.72,.12,metal,s*(w/2+.11),h*.5,.8,g);
    }
    for(let r=0;r<3;r++){
      const y=1.95+r*1.9;
      mk(w,.09,.12,metal,0,y+.72,-d/2-.115,g);
      for(let c=0;c<4;c++){
        const x=(c-1.5)*w*.205;
        mk(w*.167,1.18,.04,metal,x,y,-d/2-.145,g);
        mk(w*.146,1.00,.045,pick(windowMats),x,y,-d/2-.174,g);
        mk(.035,1.00,.066,metal,x,y,-d/2-.208,g);
        mk(w*.16,.045,.07,metal,x,y-.59,-d/2-.2,g);
      }
    }
    for(let r=0;r<2;r++)for(let j=-1;j<=1;j++){
      for(const s of [-1,1]){
        mk(.065,1.1,1.2,metal,s*(w/2+.075),2.5+r*2.0,j*2.35,g);
        mk(.073,.93,1.02,pick(windowMats),s*(w/2+.122),2.5+r*2.0,j*2.35,g);
      }
    }
    mk(3.65,.20,1.65,metal,0,3.64,-d/2-.79,g);
    mk(3.25,.08,1.65,accent,0,3.56,-d/2-.79,g);
    for(const s of [-1,1]){
      mk(.12,3.3,.22,metal,s*1.48,1.85,-d/2-.23,g);
      mk(.8,.10,.21,accent,s*1.03,2.55,-d/2-.26,g);
    }
    // rooftop air handling units; slightly different outline for each building
    for(let j=0;j<3;j++){
      const x=-w*.27+j*w*.27,z=1.0+(j%2)*2;
      mk(1.2,.8,1.5,metal,x,h+1.05,z,g);
      mk(1.32,.12,1.62,rubber,x,h+1.49,z,g);
    }
    const led=mk(w+.4,.075,.18,new THREE.MeshBasicMaterial({color:tone,transparent:true,opacity:.9}),0,h+.68,-d/2-.22,g);
    animated.push({mesh:led,phase:rand()*6});
    const labelCanvas=document.createElement("canvas");labelCanvas.width=512;labelCanvas.height=128;
    const lc=labelCanvas.getContext("2d");lc.fillStyle="#0c2435";lc.fillRect(0,0,512,128);
    lc.fillStyle="#67ead6";lc.fillRect(0,0,8,128);
    lc.fillStyle="#dcfaff";lc.font="bold 48px system-ui";lc.textAlign="center";
    lc.fillText(({community:"COMMUNITY HUB",soc:"SOC COMMAND",incident:"INCIDENT LAB",forensics:"FORENSICS",academy:"ACADEMY"})[zone.id],260,75);
    lc.font="18px monospace";lc.fillStyle="#80b4c2";lc.fillText("CYBERVERSE / SECURE ENVIRONMENT",260,109);
    const labelT=new THREE.CanvasTexture(labelCanvas);labelT.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w-1,9),2.2),new THREE.MeshBasicMaterial({map:labelT,side:THREE.DoubleSide,transparent:true}));
    sign.position.set(0,h-.86,-d/2-.19);g.add(sign);
    // doorstep approach lamps provide visual navigation toward interactive entry
    for(const s of [-1,1]){
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),new THREE.MeshBasicMaterial({color:tone}));
      marker.position.set(s*2,1.2,-d/2-1.8);g.add(marker);alerts.push(marker);
    }
  }

  // Layered, softly illuminated city trees mask the old low-poly skyline.
  const leaves=[mat(0x194f4d,.92,0),mat(0x235f5b,.9,0),mat(0x326d65,.88,0)];
  const foliageGeo=new THREE.IcosahedronGeometry(1,1);
  for(let i=0;i<25;i++){
    const a=i*2.399,r=26+i%5*3.5,x=Math.cos(a)*r,z=Math.sin(a)*r;
    for(let l=0;l<3;l++){
      const tree=new THREE.Mesh(foliageGeo,pick(leaves));
      tree.position.set(x+(l-1)*.42,3.3+l*.53,z+(l%2-.5)*.3);
      tree.scale.set(1.22+(l%2)*.27,1.5-l*.13,1.22);tree.castShadow=false;details.add(tree);
    }
  }

  // Ground beacons, streetlamps and cheap additive glow sprites (no heavy postprocessing).
  const glowCanvas=document.createElement("canvas");glowCanvas.width=128;glowCanvas.height=128;
  const gc=glowCanvas.getContext("2d");
  const grd=gc.createRadialGradient(64,64,0,64,64,64);
  grd.addColorStop(0,"rgba(255,255,255,.85)");grd.addColorStop(.13,"rgba(160,238,255,.45)");
  grd.addColorStop(.45,"rgba(85,210,245,.09)");grd.addColorStop(1,"rgba(85,210,245,0)");
  gc.fillStyle=grd;gc.fillRect(0,0,128,128);
  const glowTex=new THREE.CanvasTexture(glowCanvas);
  function glow(x,y,z,size,color=0x77dfee,parent=details){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    s.position.set(x,y,z);s.scale.set(size,size,1);parent.add(s);return s;
  }
  for(let i=-40;i<=40;i+=13){
    for(const x of [-6.3,6.3]){
      const pole=new THREE.Group();pole.position.set(x,0,i);details.add(pole);
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,5.2,8),metal);
      rod.position.y=2.6;pole.add(rod);
      mk(1.15,.08,.12,metal,x<0?.49:-.49,5.22,0,pole);
      mk(.38,.1,.43,neonAmber,x<0?1.01:-1.01,5.1,0,pole);
      const s=glow(x<0?1.01:-1.01,5.1,0,2.7,0xffca94,pole);lamps.push(s);
    }
  }
  for(let i=0;i<5;i++)glow(0,1.5+i*.65,0,5+i*1.5,0x5aece8);

  // Security inspection drones follow smooth closed curves through the public square.
  const droneBody=mat(0x354d63,.25,.67),droneLight=new THREE.MeshBasicMaterial({color:0x6ee6f4});
  const droneCount=5;
  for(let i=0;i<droneCount;i++){
    const g=new THREE.Group();details.add(g);
    const body=new THREE.Mesh(new THREE.SphereGeometry(.38,12,8),droneBody);
    body.scale.set(1.6,.36,1);g.add(body);
    mk(1.45,.06,.12,metal,0,0,0,g);mk(.12,.06,1.05,metal,0,0,0,g);
    for(const s of [-1,1]){
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.105,8,7),droneLight);
      lamp.position.set(s*.76,0,0);g.add(lamp);
      const gg=glow(s*.76,0,0,1.25,0x88f8ff,g);gg.visible=i<4;
    }
    const trail=glow(0,-.24,0,2.4,0x7de9ff,g);
    drones.push({g,trail,offset:i*2*pi/droneCount,rad:14+i*4.6,phase:rand()*3});
  }

  // Animated clouds and an enormous twilight-to-night sky gradient.
  const skyUniforms={uNight:{value:0}};
  const dome=new THREE.Mesh(new THREE.SphereGeometry(180,36,18),new THREE.ShaderMaterial({
    uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,depthTest:false,
    vertexShader:"varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform float uNight;varying vec3 vPos;void main(){float h=clamp(normalize(vPos).y*.5+.5,0.,1.);vec3 dayLo=vec3(.31,.31,.39);vec3 dayHi=vec3(.035,.105,.18);vec3 nightLo=vec3(.052,.115,.17);vec3 nightHi=vec3(.005,.015,.046);vec3 d=mix(dayLo,dayHi,smoothstep(.08,.85,h));vec3 n=mix(nightLo,nightHi,smoothstep(.03,.88,h));vec3 c=mix(d,n,uNight);c+=vec3(.19,.075,.03)*(1.-uNight)*pow(1.-h,9.);gl_FragColor=vec4(c,1.);}"
  }));
  dome.renderOrder=-999;scene.add(dome);
  const cloudCanvas=document.createElement("canvas");cloudCanvas.width=256;cloudCanvas.height=128;
  const clc=cloudCanvas.getContext("2d");
  const clgr=clc.createRadialGradient(128,70,8,128,70,115);
  clgr.addColorStop(0,"rgba(234,245,255,.5)");clgr.addColorStop(.52,"rgba(188,218,235,.22)");
  clgr.addColorStop(1,"rgba(170,200,228,0)");
  clc.fillStyle=clgr;clc.fillRect(0,0,256,128);
  const cloudTex=new THREE.CanvasTexture(cloudCanvas),clouds=[];
  for(let i=0;i<14;i++){
    const c=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,color:0xd1d9e5,transparent:true,opacity:.28,depthWrite:false}));
    c.position.set((rand()-.5)*155,36+rand()*35,(rand()-.5)*155);
    c.scale.set(20+rand()*30,8+rand()*8,1);scene.add(c);clouds.push(c);
  }
  const sunGlow=glow(-80,38,-100,65,0xffad77,scene);

  // Filmic weather: batched line segments and reflective puddles.
  const rainCount=360,positions=new Float32Array(rainCount*2*3);
  const rainV=[];
  for(let i=0;i<rainCount;i++){
    rainV.push({x:(rand()-.5)*46,z:(rand()-.5)*42,y:rand()*28+1,v:15+rand()*11});
  }
  const rainG=new THREE.BufferGeometry();
  rainG.setAttribute("position",new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  const rain=new THREE.LineSegments(rainG,new THREE.LineBasicMaterial({color:0x9fcbe7,transparent:true,opacity:.36,depthWrite:false,blending:THREE.AdditiveBlending}));
  rain.frustumCulled=false;rain.visible=false;scene.add(rain);

  // Small twinkling distant lights only when night is selected.
  const starsA=new Float32Array(220*3);
  for(let i=0;i<220;i++){
    const a=rand()*2*pi,up=rand()*.74+.18,r=145;
    starsA[i*3]=r*Math.cos(a)*Math.cos(up);
    starsA[i*3+1]=r*Math.sin(up);
    starsA[i*3+2]=r*Math.sin(a)*Math.cos(up);
  }
  const starG=new THREE.BufferGeometry();starG.setAttribute("position",new THREE.BufferAttribute(starsA,3));
  const stars=new THREE.Points(starG,new THREE.PointsMaterial({color:0xdceaff,size:.7,transparent:true,opacity:0,depthWrite:false}));
  stars.frustumCulled=false;scene.add(stars);

  // Three-way interaction: cinematic sky, dynamic weather, and resource-sensitive mode.
  const hud=document.createElement("section");hud.className="cv-cinematic-hud";
  hud.setAttribute("aria-label","3D 환경 설정");
  hud.innerHTML='<div class="cv-cin-main" id="cv-cin-main"><div class="cv-cin-eyebrow">LIVE WORLD · ENVIRONMENT</div><div class="cv-cin-title">CYBER CITY / 3D</div><div class="cv-cin-sub"><span class="cv-cin-pulse"></span><span id="cv-cin-state">시네마틱 탐험 · 실시간 렌더링</span></div><div class="cv-cin-controls" aria-label="조명과 날씨"><button data-cin-time="dusk" aria-pressed="true">석양</button><button data-cin-time="night" aria-pressed="false">야경</button><button data-cin-rain aria-pressed="false">비 내리기</button><button data-cin-eco aria-pressed="false">저사양</button></div><div class="cv-cin-live" id="cv-cin-live">빛과 날씨를 바꾸며 도시를 탐험하세요.</div></div><div class="cv-cin-bottom"><span class="cv-cin-compass">방향 <b class="cv-cin-direction" id="cv-cin-heading">N</b></span><span class="cv-cin-compass" id="cv-cin-coord">X 0 · Z 5</span></div>';
  root.append(hud);
  const rainline=document.createElement("div");rainline.className="cv-cin-rainline";root.append(rainline);
  let mode="dusk",wet=false,eco=false,night=0,prevStamp=0;
  const main=hud.querySelector("#cv-cin-main"),live=hud.querySelector("#cv-cin-live"),status=hud.querySelector("#cv-cin-state");
  const timeBtns=Array.from(hud.querySelectorAll("[data-cin-time]"));
  const rainBtn=hud.querySelector("[data-cin-rain]"),ecoBtn=hud.querySelector("[data-cin-eco]");
  function setWeather(on) {
    wet=!!on;rain.visible=wet&&!state.reduced;
    puddles.forEach(p=>p.visible=wet);
    root.classList.toggle("cv-cin-wet",wet);
    rainBtn.setAttribute("aria-pressed",String(wet));
    live.textContent=wet?"강우 시뮬레이션 · 습윤 노면 반사 활성화":"맑은 하늘 · 시정 양호";
  }
  timeBtns.forEach(b=>b.addEventListener("click",()=>{
    mode=b.dataset.cinTime;
    timeBtns.forEach(q=>q.setAttribute("aria-pressed",String(q.dataset.cinTime===mode)));
    live.textContent=mode==="night"?"야간 모드 · 건물과 거리의 경관 조명 활성화":"석양 모드 · 장면의 광원과 하늘 변화";
  }));
  rainBtn.addEventListener("click",()=>setWeather(!wet));
  ecoBtn.addEventListener("click",()=>{
    eco=!eco;ecoBtn.setAttribute("aria-pressed",String(eco));
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,eco?1:1.5));
    clouds.forEach(c=>c.visible=!eco);
    drones.forEach((d,i)=>d.g.visible=!eco||i<2);
    live.textContent=eco?"저사양 모드 · 표시 효과와 렌더링 해상도 조절":"고화질 모드 · 환경 효과 복원";
  });
  function update(dt,t) {
    const goal=mode==="night"?1:0;
    night+=(goal-night)*Math.min(1,dt*1.4);
    skyUniforms.uNight.value=night;
    sky.intensity=2.0-night*.62;sun.intensity=2.4-night*1.8;
    sun.color.set(0xffdeb6).lerp(new THREE.Color(0x9bc6ff),night);
    scene.fog.color.set(0x2d4859).lerp(new THREE.Color(0x071d33),night);
    scene.fog.density=wet?.017:.011;
    renderer.toneMappingExposure=1.48-night*.2;
    dome.position.set(state.pos.x,0,state.pos.z);
    stars.position.set(state.pos.x,0,state.pos.z);stars.material.opacity=night*.82;
    sunGlow.material.opacity=(1-night)*.75;sunGlow.visible=night<.99;
    rain.visible=wet&&!state.reduced;
    if(rain.visible){
      const p=rainG.attributes.position;
      for(let i=0;i<rainCount;i++){
        const r=rainV[i];r.y-=r.v*dt;r.x+=dt*2;
        if(r.y<0){r.y=25+rand()*8;r.x=(rand()-.5)*46;r.z=(rand()-.5)*42;}
        const ix=i*6;
        positions[ix]=r.x+state.pos.x;positions[ix+1]=r.y;positions[ix+2]=r.z+state.pos.z;
        positions[ix+3]=positions[ix]-.18;positions[ix+4]=r.y-.9;positions[ix+5]=positions[ix+2];
      }
      p.needsUpdate=true;
    }
    if(!state.reduced){
      for(const {mesh,phase} of animated)mesh.material.opacity=.75+.2*Math.sin(t*1.9+phase);
      for(let i=0;i<drones.length;i++){
        const d=drones[i],a=t*(.11+i*.007)+d.offset;
        const x=Math.cos(a)*d.rad,z=Math.sin(a)*d.rad;
        d.g.position.set(x,6+Math.sin(a*3+d.phase)*1.5+i*.55,z);
        d.g.rotation.set(Math.sin(t*3+i)*.08,-a,Math.sin(t*4+i)*.07);
        d.trail.material.rotation=t*.2;
      }
      for(let i=0;i<clouds.length;i++){
        const c=clouds[i];c.position.x+=dt*(i%3+1)*.22;
        if(c.position.x>85)c.position.x=-85;
      }
      for(let i=0;i<lamps.length;i++)lamps[i].material.opacity=.72+.14*Math.sin(t*1.2+i*.5);
      for(let i=0;i<alerts.length;i++)alerts[i].scale.setScalar(1+Math.sin(t*2+i)*.16);
    }
    const alarm=!!state.phase;
    main.classList.toggle("cv-cin-alert",alarm);
    status.textContent=alarm?"침해사고 발생 · 위협 흐름 분석 중":"시네마틱 탐험 · 실시간 렌더링";
    if(t-prevStamp>.2){
      prevStamp=t;
      const dir=((state.pos.a*180/pi+360)%360);
      const compass=["N","NE","E","SE","S","SW","W","NW"][Math.round(dir/45)%8];
      hud.querySelector("#cv-cin-heading").textContent=compass;
      hud.querySelector("#cv-cin-coord").textContent="X "+state.pos.x.toFixed(1)+" · Z "+state.pos.z.toFixed(1);
    }
  }
  return {update,setWeather,setNight:(v)=>timeBtns[v?"1":"0"]?.click()};
}
