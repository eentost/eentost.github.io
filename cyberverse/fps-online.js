/* CyberVerse multiplayer client. State and hit results come from server.
 * No trust in client-reported damage, position, kills or score.
 */
import * as THREE from "three";
export function createFpsOnline({world,root,connectionChanged,onWelcome,onSnapshot,onEvent}) {
  const remote=new Map(),group=new THREE.Group();world.add(group);group.name="Network participants";
  let socket=null,selfId=null,room="",connected=false,team="blue",snapshotAt=0,sendAt=0;
  const $=id=>root.querySelector("#"+id);
  const status=document.createElement("div");status.className="cv-online-panel";
  status.innerHTML='<div class="cv-online-head"><strong>LIVE · 공개 대전 서버</strong><span id="cv-online-state">서버 미연결</span></div>'+
    '<label>게임 서버 WSS 주소<input id="cv-online-url" autocomplete="url" placeholder="wss://fps.example.com/fps"></label>'+
    '<div class="cv-online-fields"><label>방 이름<input id="cv-online-room" maxlength="24" value="public-1"></label><label>닉네임<input id="cv-online-name" maxlength="18" value="Guest"></label></div>'+
    '<div class="cv-online-buttons"><button id="cv-online-join" type="button">온라인 대전 참가</button><button id="cv-online-leave" type="button" disabled>연결 종료</button></div>'+
    '<p>URL을 같은 방으로 맞추면 누구나 입장할 수 있습니다. 실시간 서버가 별도 배포되어 있어야 합니다.</p>';
  const menu=root.querySelector(".cv-fps-modal");
  if(!menu)throw Error("FPS modal not available");
  menu.append(status);
  const inputUrl=$("cv-online-url"),roomInput=$("cv-online-room"),nameInput=$("cv-online-name"),joinBtn=$("cv-online-join"),leaveBtn=$("cv-online-leave");
  inputUrl.value=localStorage.getItem("cv-fps-server")||window.CV_FPS_SERVER_URL||"";
  nameInput.value=localStorage.getItem("cv-fps-name")||"Guest";
  const fromParams=new URLSearchParams(location.search);
  if(/^[a-z0-9-]{1,24}$/.test(fromParams.get("fps-room")||""))roomInput.value=fromParams.get("fps-room");
  const note=(text)=>{$("cv-online-state").textContent=text;};
  const send=(obj)=>{if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(obj));return true;}return false;};
  function unitMesh(p){
    const model=new THREE.Group(),hue=p.team==="blue"?0x3e7698:0xa55751;
    const armor=new THREE.MeshStandardMaterial({color:hue,metalness:.24,roughness:.62});
    const helmet=new THREE.MeshStandardMaterial({color:0x253543,roughness:.7});
    const eye=new THREE.MeshBasicMaterial({color:p.team==="blue"?0x6bc9ff:0xffa489});
    function cube(x,y,z,w,h,d,mat,parent=model){
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;
    }
    cube(0,1.18,0,.7,.95,.43,armor);cube(0,1.69,0,.87,.14,.51,helmet);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),helmet);head.position.y=2;model.add(head);
    cube(0,1.99,-.23,.41,.1,.07,eye);
    const limbs=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.5,1.5,0);model.add(arm);cube(0,-.32,0,.22,.65,.25,armor,arm);limbs.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.2,.8,0);model.add(leg);cube(0,-.33,0,.28,.67,.3,helmet,leg);limbs.push(leg);
    }
    cube(.18,1.24,-.37,.12,.15,.62,helmet);
    model.userData.limbs=limbs;
    group.add(model);return model;
  }
  function clearPeers(){
    for(const model of remote.values()){
      group.remove(model);model.traverse(n=>{n.geometry?.dispose?.();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose?.();}});
    }
    remote.clear();
  }
  function handle(msg){
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="welcome"){
      selfId=msg.id;team=msg.team||"blue";connected=true;note("연결됨 · "+room+" · "+(team==="blue"?"BLUE":"RED")+" 팀");
      joinBtn.disabled=true;leaveBtn.disabled=false;
      localStorage.setItem("cv-fps-server",inputUrl.value.trim());
      localStorage.setItem("cv-fps-name",nameInput.value.trim());
      onWelcome?.(msg);
      connectionChanged?.(true);
    }else if(msg.type==="state"){
      snapshotAt=performance.now();
      const known=new Set();
      for(const p of msg.players||[]){
        if(p.id===selfId){onSnapshot?.(msg,p);continue;}
        known.add(p.id);
        let model=remote.get(p.id);
        if(!model){model=unitMesh(p);remote.set(p.id,model);model.position.set(p.x,0,p.z);}
        model.visible=!p.dead;
        model.userData.target={x:p.x,z:p.z,a:p.yaw};
        model.userData.hp=p.hp;
      }
      for(const [id,model] of remote)if(!known.has(id)){
        group.remove(model);remote.delete(id);
      }
    }else if(msg.type==="round_start"||msg.type==="round_end"||msg.type==="hit"||msg.type==="damage"||msg.type==="shot"||msg.type==="kill"){
      onEvent?.(msg);
    }else if(msg.type==="error"){note("서버 오류: "+String(msg.text).slice(0,100));}
  }
  function connect(){
    if(socket&&socket.readyState<2)return;
    const url=inputUrl.value.trim(),nextRoom=roomInput.value.trim().toLowerCase(),name=(nameInput.value.trim()||"Guest").slice(0,18);
    if(!/^wss?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[a-zA-Z0-9/_-]+)?$/.test(url)){note("올바른 wss://.../fps 주소가 필요합니다.");return;}
    if(location.protocol==="https:"&&!url.startsWith("wss://")){note("HTTPS 페이지는 WSS 연결이 필요합니다.");return;}
    if(!/^[a-z0-9-]{1,24}$/.test(nextRoom)){note("방은 영문 소문자·숫자·하이픈 1~24자만 가능합니다.");return;}
    room=nextRoom;note("게임 서버 연결 중...");joinBtn.disabled=true;
    try{
      const ws=new WebSocket(url);socket=ws;
      ws.onopen=()=>send({type:"join",room:nextRoom,name});
      ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch{note("서버 응답을 해석할 수 없습니다.");}};
      ws.onerror=()=>note("연결 오류 · WSS 서버가 배포되어 있는지 확인하세요.");
      ws.onclose=()=>{
        if(socket!==ws)return;
        socket=null;connected=false;selfId=null;
        clearPeers();note("연결 종료 · 다시 참가할 수 있습니다.");
        joinBtn.disabled=false;leaveBtn.disabled=true;connectionChanged?.(false);
      };
    }catch{joinBtn.disabled=false;note("주소나 서버 연결을 확인하세요.");}
  }
  function disconnect(){
    const ws=socket;socket=null;connected=false;selfId=null;clearPeers();
    try{ws?.close(1000,"leave");}catch{}
    joinBtn.disabled=false;leaveBtn.disabled=true;note("서버 미연결");connectionChanged?.(false);
  }
  function update(dt,t,input){
    if(!connected)return;
    for(const m of remote.values()){
      const target=m.userData.target;
      if(!target)continue;
      m.position.lerp(new THREE.Vector3(target.x,0,target.z),Math.min(1,dt*11));
      let delta=Math.atan2(Math.sin(target.a-m.rotation.y),Math.cos(target.a-m.rotation.y));
      m.rotation.y+=delta*Math.min(1,dt*9);
      const limbs=m.userData.limbs;
      const moving=m.position.distanceTo(new THREE.Vector3(target.x,0,target.z))>.05;
      const gait=moving?Math.sin(t*9)*.4:0;
      limbs[0].rotation.x=gait;limbs[1].rotation.x=-gait;limbs[2].rotation.x=-gait;limbs[3].rotation.x=gait;
    }
    sendAt+=dt;
    if(sendAt>.05){
      sendAt=0;
      send({type:"input",keys:input.keys,yaw:input.yaw,pitch:input.pitch});
    }
  }
  joinBtn.addEventListener("click",connect);
  leaveBtn.addEventListener("click",disconnect);
  return {connect,disconnect,update,send,connected:()=>connected,team:()=>team,selfId:()=>selfId,snapshot:()=>({connected,team,room,peers:remote.size,updated:snapshotAt})};
}
