/* CyberVerse FPS audio + atmosphere: procedural sound effects and original map themes.
 * No external audio, no paid APIs, and safe silent fallback when WebAudio unavailable.
 */
import * as THREE from "three";
export function createFpsEffects({scene,world,camera,root}) {
  let ctx=null,master=null,enabled=true,theme="industrial",time=0,footstepTimer=0,active=false,ambience=null,ambientGain=null;
  const presets={
    industrial:{name:"물류 터미널 · 황혼",sky:0x9dabb1,fog:0xa4afb5,near:34,far:115,ambient:.75,lighting:0xffe1b0,wet:false},
    night:{name:"도심 항만 · 야간",sky:0x0d2134,fog:0x142a3e,near:18,far:88,ambient:.32,lighting:0xa1d7ff,wet:false},
    rain:{name:"항만 기지 · 폭우",sky:0x4b6570,fog:0x627b87,near:16,far:72,ambient:.5,lighting:0xa1c2d5,wet:true},
    desert:{name:"사막 전초기지 · 주간",sky:0xc9b28e,fog:0xd5c0a0,near:40,far:140,ambient:.95,lighting:0xffe5b9,wet:false}
  };
  const overlays=new THREE.Group();overlays.name="OPS Zero environment overlays";world.add(overlays);
  const lampGroup=new THREE.Group();overlays.add(lampGroup);
  const groundLights=[];
  const spotColors=[0xffba71,0xffd6a2,0xa8e3ff];
  for(const x of [-27,27])for(const z of [-28,0,28]){
    const light=new THREE.PointLight(spotColors[(Math.abs(x)+Math.abs(z))%3],1.3,17,2);
    light.position.set(x,6,z);lampGroup.add(light);groundLights.push(light);
  }
  const puddles=new THREE.Group();overlays.add(puddles);
  const wetMaterial=new THREE.MeshPhysicalMaterial({color:0x6c9ab5,roughness:.04,metalness:.55,clearcoat:1,transparent:true,opacity:.37,depthWrite:false});
  let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<42;i++){
    const p=new THREE.Mesh(new THREE.CircleGeometry(.7+rnd()*1.2,20),wetMaterial);
    p.rotation.x=-Math.PI/2;p.position.set((rnd()-.5)*59,.025,(rnd()-.5)*66);
    p.scale.set(1.7,.7,1);puddles.add(p);
  }
  const count=280,rainPos=new Float32Array(count*6),droplets=[];
  for(let i=0;i<count;i++)droplets.push({x:(rnd()-.5)*34,z:(rnd()-.5)*34,y:rnd()*22,speed:14+rnd()*9});
  const rainGeo=new THREE.BufferGeometry();
  rainGeo.setAttribute("position",new THREE.BufferAttribute(rainPos,3).setUsage(THREE.DynamicDrawUsage));
  const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xadd3e9,transparent:true,opacity:.43,depthWrite:false}));
  rain.frustumCulled=false;overlays.add(rain);
  const flashes=[];
  function initAudio(){
    if(!enabled)return false;
    try{
      if(!ctx){
        const A=window.AudioContext||window.webkitAudioContext;if(!A)return false;
        ctx=new A();master=ctx.createGain();master.gain.value=.28;master.connect(ctx.destination);
      }
      if(ctx.state==="suspended")ctx.resume().catch(()=>{});
      return true;
    }catch{return false;}
  }
  function updateAmbience(){
    if(!active||!enabled){if(ambientGain&&ctx)ambientGain.gain.setTargetAtTime(0,ctx.currentTime,.18);return;}
    if(!initAudio())return;
    if(!ambience){
      const seconds=2,samples=Math.floor(ctx.sampleRate*seconds),buf=ctx.createBuffer(1,samples,ctx.sampleRate),data=buf.getChannelData(0);
      let low=0;
      for(let i=0;i<samples;i++){const n=(Math.random()*2-1);low=low*.985+n*.015;data[i]=n*.57+low*.43;}
      ambience=ctx.createBufferSource();ambience.buffer=buf;ambience.loop=true;
      const filter=ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=1350;
      ambientGain=ctx.createGain();ambientGain.gain.value=0;
      ambience.connect(filter).connect(ambientGain).connect(master);
      ambience.start();
    }
    ambientGain.gain.setTargetAtTime(theme==="rain"?.11:theme==="night"?.022:.04,ctx.currentTime,.3);
  }
  function setActive(value){active=!!value;updateAmbience();}
  function tone(freq,end,duration,type="sine",gain=.15,pan=0){
    if(!initAudio())return;
    const now=ctx.currentTime,osc=ctx.createOscillator(),vol=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(Math.max(20,freq),now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);
    vol.gain.setValueAtTime(gain,now);
    vol.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(vol);
    if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));vol.connect(p);p.connect(master);}
    else vol.connect(master);
    osc.start(now);osc.stop(now+duration+.01);
  }
  function noise(duration=.16,volume=.14,filterFreq=750){
    if(!initAudio())return;
    const length=Math.floor(ctx.sampleRate*duration),buf=ctx.createBuffer(1,length,ctx.sampleRate),arr=buf.getChannelData(0);
    for(let i=0;i<length;i++)arr[i]=(Math.random()*2-1)*Math.pow(1-i/length,1.25);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),vol=ctx.createGain();
    source.buffer=buf;filter.type="lowpass";filter.frequency.value=filterFreq;vol.gain.value=volume;
    source.connect(filter).connect(vol).connect(master);source.start();source.stop(ctx.currentTime+duration);
  }
  function play(kind,weapon="rifle"){
    if(!enabled)return;
    if(kind==="shot"){
      const freq=weapon==="sniper"?75:weapon==="shotgun"?95:weapon==="pistol"?155:weapon==="smg"?190:130;
      tone(freq,freq*.35,weapon==="sniper"?.29:.16,"sawtooth",weapon==="sniper"?.28:.18);
      noise(weapon==="sniper"?.3:.15,weapon==="sniper"?.2:.12,weapon==="sniper"?450:1100);
    }else if(kind==="reload"){
      tone(710,330,.09,"triangle",.1);tone(250,140,.14,"square",.06);
    }else if(kind==="equip"){tone(520,280,.07,"triangle",.075);}
    else if(kind==="hit"){tone(960,470,.1,"sine",.10);}
    else if(kind==="hurt"){tone(135,66,.25,"sawtooth",.16);}
    else if(kind==="kill"){tone(680,940,.14,"triangle",.08);tone(940,1280,.17,"triangle",.07);}
    else if(kind==="step"){noise(.055,.04,240);}
    else if(kind==="jump"){tone(155,250,.12,"sine",.06);}
    else if(kind==="land"){noise(.13,.09,200);}
    else if(kind==="round"){tone(220,740,.42,"triangle",.12);}
  }
  function setTheme(name){
    theme=presets[name]?name:"industrial";
    const p=presets[theme];
    puddles.visible=p.wet;rain.visible=p.wet;
    lampGroup.visible=(theme==="night"||theme==="rain");
    root.classList.toggle("cv-fps-wet",p.wet);
    updateAmbience();
    return p;
  }
  function apply(){
    const p=presets[theme];
    scene.background=new THREE.Color(p.sky);
    scene.fog=new THREE.Fog(p.fog,p.near,p.far);
  }
  function update(dt){
    if(theme!=="rain")return;
    time+=dt;
    const a=rainGeo.attributes.position;
    for(let i=0;i<count;i++){
      const d=droplets[i];d.y-=d.speed*dt;
      if(d.y<0){d.y=18+rnd()*8;d.x=(rnd()-.5)*34;d.z=(rnd()-.5)*34;}
      const n=i*6;rainPos[n]=camera.position.x+d.x;rainPos[n+1]=d.y;rainPos[n+2]=camera.position.z+d.z;
      rainPos[n+3]=rainPos[n]-.21;rainPos[n+4]=d.y-1;rainPos[n+5]=rainPos[n+2];
    }
    a.needsUpdate=true;
  }
  function footsteps(dt,moving,sprinting){
    if(!moving){footstepTimer=0;return;}
    footstepTimer+=dt;
    if(footstepTimer>(sprinting?.24:.37)){footstepTimer=0;play("step");}
  }
  function setVolume(v){
    const value=Math.max(0,Math.min(1,Number(v)||0));
    if(!ctx)initAudio();
    if(master)master.gain.value=value*.5;
  }
  function mute(v){enabled=!v;if(master)master.gain.value=enabled?.28:0;updateAmbience();}
  setTheme("industrial");
  return {presets,setTheme,setActive,apply,play,update,footsteps,setVolume,mute,getTheme:()=>theme};
}
