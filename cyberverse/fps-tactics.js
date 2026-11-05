/* CyberVerse tactical FPS extension - offline only. Original deathmatch and online protocol are unchanged. */
import * as THREE from "three";
export function createFpsTactics({world,root,units,data,notify}) {
  let enabled=false,owner=null,progress=0,emp=0,empCooldown=0,decoyCooldown=0,decoyLife=0,scoreClock=0,decoy=null;
  const material=new THREE.MeshStandardMaterial({color:0x4cffe2,emissive:0x0b776e,emissiveIntensity:.55,metalness:.65,roughness:.28});
  const node=new THREE.Group();node.position.set(0,0,0);world.add(node);
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(2.9,2.9,.1,40),new THREE.MeshStandardMaterial({color:0x203b49,metalness:.6}));
  pad.position.y=.08;node.add(pad);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.6,.085,8,48),material);ring.rotation.x=-Math.PI/2;ring.position.y=.19;node.add(ring);
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(.66,1),material);core.position.y=1.15;node.add(core);
  const light=new THREE.PointLight(0x4cffe2,1.5,7);light.position.y=1.5;node.add(light);
  node.visible=false;
  const hud=document.createElement("div");
  hud.className="cv-tactical-status";hud.style.cssText="position:absolute;top:104px;left:50%;transform:translateX(-50%);z-index:20;min-width:235px;max-width:calc(100vw - 32px);padding:10px 14px;border:1px solid #54ddcc;border-radius:10px;background:#071724e8;color:#e9ffff;text-align:center;font:700 12px system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 4px #000";
  hud.hidden=true;root.append(hud);
  const touch=document.createElement("div");
  touch.style.cssText="position:absolute;right:20px;bottom:165px;z-index:24;display:flex;gap:8px";
  touch.innerHTML='<button type="button" data-tactic="emp" style="padding:10px;background:#143b4b;color:white;border:1px solid #5bbcbf;border-radius:8px">Q EMP</button><button type="button" data-tactic="decoy" style="padding:10px;background:#143b4b;color:white;border:1px solid #5bbcbf;border-radius:8px">E 분신</button>';
  touch.hidden=true;root.append(touch);
  const inRange=(x,z)=>Math.hypot(x-node.position.x,z-node.position.z)<3.3;
  function reset(on){
    enabled=!!on;owner=null;progress=0;emp=0;empCooldown=0;decoyCooldown=0;decoyLife=0;scoreClock=0;
    if(decoy){world.remove(decoy);decoy.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});decoy=null;}
    node.visible=enabled;hud.hidden=!enabled;touch.hidden=!enabled;
    if(enabled)notify("TACTICAL","중앙 데이터 코어를 점령하세요 · Q EMP / E 홀로그램 분신");
  }
  function activate(kind){
    if(!enabled||!data.running||data.finished||data.deathDelay>0)return false;
    if(kind==="emp"){
      if(empCooldown>0){notify("TACTICAL","EMP 충전 중 "+Math.ceil(empCooldown)+"초");return false;}
      emp=6;empCooldown=28;notify("HACK","EMP 발동 · 적 AI 사격 정확도 6초 감소");return true;
    }
    if(kind==="decoy"){
      if(decoyCooldown>0){notify("TACTICAL","분신 충전 중 "+Math.ceil(decoyCooldown)+"초");return false;}
      decoyCooldown=23;decoyLife=8;
      if(decoy){world.remove(decoy);decoy=null;}
      decoy=new THREE.Group();
      const ghost=new THREE.Mesh(new THREE.CapsuleGeometry(.30,1.05,5,10),new THREE.MeshBasicMaterial({color:0x4be8ff,transparent:true,opacity:.43,depthWrite:false}));
      ghost.position.y=.95;decoy.add(ghost);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(.48,.045,6,24),new THREE.MeshBasicMaterial({color:0x90faff}));
      halo.position.y=1.8;halo.rotation.x=Math.PI/2;decoy.add(halo);
      const forward=new THREE.Vector3(-Math.sin(data.yaw),0,-Math.cos(data.yaw));
      decoy.position.set(data.x+forward.x*3,0,data.z+forward.z*3);
      world.add(decoy);notify("HACK","홀로그램 분신 생성 · 8초간 적 시야 교란");return true;
    }
    return false;
  }
  function update(dt,t){
    if(!enabled||!data.running||data.finished)return;
    emp=Math.max(0,emp-dt);empCooldown=Math.max(0,empCooldown-dt);decoyCooldown=Math.max(0,decoyCooldown-dt);
    if(decoy){decoyLife=Math.max(0,decoyLife-dt);decoy.rotation.y+=dt*.8;if(decoyLife<=0){world.remove(decoy);decoy.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});decoy=null;}}
    const blue=units.filter(u=>!u.dead&&u.team==="blue"&&inRange(u.group.position.x,u.group.position.z)).length+(data.deathDelay<=0&&inRange(data.x,data.z)?1:0);
    const red=units.filter(u=>!u.dead&&u.team==="red"&&inRange(u.group.position.x,u.group.position.z)).length;
    const side=blue>0&&red===0?"blue":red>0&&blue===0?"red":null;
    if(side){progress=Math.max(0,Math.min(100,progress+(owner===side?35:22)*dt*(side==="blue"?Math.min(2,blue):Math.min(2,red))));if(progress>=100&&owner!==side){owner=side;notify("CORE",side.toUpperCase()+" 팀이 데이터 코어를 점령했습니다.");}}
    else if(!blue&&!red&&!owner)progress=Math.max(0,progress-8*dt);
    if(owner&&side&&side!==owner){owner=null;progress=0;scoreClock=0;notify("CORE","데이터 코어가 중립 상태로 전환되었습니다.");}
    if(owner){scoreClock+=dt;if(scoreClock>=4){scoreClock-=4;data[owner]=Math.min(30,data[owner]+1);if(data.blue>=30||data.red>=30)return "finish";}}
    core.rotation.y+=dt*1.4;core.position.y=1.15+Math.sin(t*2)*.17;
    const color=owner==="blue"?0x4faeff:owner==="red"?0xff635a:0x4cffe2;
    material.color.setHex(color);light.color.setHex(color);
    hud.textContent="CORE "+(owner?owner.toUpperCase()+" CONTROL":"NEUTRAL")+" · "+Math.round(progress)+"%  |  Q EMP "+(empCooldown?Math.ceil(empCooldown)+"s":"READY")+"  |  E DECOY "+(decoyCooldown?Math.ceil(decoyCooldown)+"s":"READY");
  }
  touch.addEventListener("pointerdown",e=>{const b=e.target.closest("[data-tactic]");if(b){e.preventDefault();e.stopPropagation();activate(b.dataset.tactic);}});
  return {reset,update,activate,isEmpActive:()=>enabled&&emp>0,decoyTarget:()=>enabled&&decoy?decoy:null,snapshot:()=>({enabled,owner,progress,emp,empCooldown,decoyCooldown})};
}
