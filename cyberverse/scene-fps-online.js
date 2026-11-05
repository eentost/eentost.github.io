/* CyberVerse FPS realtime client. Separately deployed authoritative WebSocket server. */
import * as THREE from "three";
export function createFpsOnline({world,scene,root,onWelcome,onState,onRoundEnd,onShot,onHit,onDamage,onKill,onDisconnected}) {
  let socket=null,id=null,team=null,connected=false,connecting=false,serverUrl="",roomName="",lastPing=0;
  const peers=new Map();
  const ui=document.createElement("div");ui.className="cv-fps-online";
  ui.innerHTML='<div class="cv-fps-online-title">PUBLIC MULTIPLAYER · 실시간 대전</div>'
   +'<label>게임 서버 주소 <input id="cv-fps-wss" placeholder="wss://fps.example.com/fps" autocomplete="off"></label>'
   +'<div class="cv-fps-online-fields"><label>방 이름 <input id="cv-fps-room" maxlength="24" value="public-1"></label>'
   +'<label>닉네임 <input id="cv-fps-nick" maxlength="18" value="Player"></label></div>'
   +'<div class="cv-fps-online-actions"><button id="cv-fps-join" type="button">온라인 방 참가</button><button id="cv-fps-disconnect" type="button" hidden>연결 종료</button></div>'
   +'<div id="cv-fps-online-status" role="status">서버 주소를 입력하면 실제 방문자와 싸울 수 있습니다.</div>';
  const modal=root.querySelector(".cv-fps-modal");
  if(modal)modal.append(ui);
  const $=id=>ui.querySelector("#"+id);
  const status=s=>{$("cv-fps-online-status").textContent=s;};
  function makeAvatar(team,name) {
    const group=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:team==="blue"?0x477e9d:0x98514d,metalness:.3,roughness:.6});
    const dark=new THREE.MeshStandardMaterial({color:0x25323d,metalness:.3,roughness:.6});
    const headMat=new THREE.MeshStandardMaterial({color:0xc9beb0,roughness:.9});
    const cube=(w,h,d,x,y,z,m)=>{
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);group.add(o);return o;
    };
    cube(.74,1,.45,0,1.28,0,skin);cube(.95,.18,.5,0,1.7,0,dark);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),headMat);head.position.y=2.01;group.add(head);
    cube(.53,.12,.06,0,2.02,-.25,dark);
    const limbs=[];
    for(const s of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(s*.54,1.58,0);group.add(arm);
      const leg=new THREE.Group();leg.position.set(s*.22,.86,0);group.add(leg);
      const a=cube(.24,.65,.26,0,0,0,skin);group.remove(a);arm.add(a);a.position.y=-.35;
      const b=cube(.29,.7,.35,0,0,0,dark);group.remove(b);leg.add(b);b.position.y=-.37;
      limbs.push(arm,leg);
    }
    group.userData.limbs=limbs;
    group.userData.name=name;world.add(group);return group;
  }
  function clearPeers(){
    for(const p of peers.values()){world.remove(p.group);p.group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
    peers.clear();
  }
  function close(){
    const previous=socket;socket=null;connecting=false;connected=false;id=null;team=null;
    try{previous?.close(1000,"left");}catch{}
    clearPeers();
    $("cv-fps-join").hidden=false;$("cv-fps-disconnect").hidden=true;
    status("연결 종료 · 로컬 AI 대전을 이용할 수 있습니다.");
  }
  function send(payload){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));}
  function connect(){
    if(connected||connecting)return;
    const target=$("cv-fps-wss").value.trim(),room=$("cv-fps-room").value.trim().toLowerCase();
    const name=($("cv-fps-nick").value.trim()||"Player").slice(0,18);
    let url;
    try{url=new URL(target);}catch{status("유효한 서버 주소를 입력하세요.");return;}
    if(!["ws:","wss:"].includes(url.protocol)||url.username||url.password||!/^[a-z0-9-]{1,24}$/.test(room)){
      status("주소 및 방 이름을 확인하세요.");return;
    }
    if(location.protocol==="https:"&&url.protocol!=="wss:"){status("HTTPS 페이지에서는 wss:// 연결이 필요합니다.");return;}
    if(!url.pathname.endsWith("/fps")){status("서버 주소는 /fps 경로로 끝나야 합니다.");return;}
    connecting=true;serverUrl=url.href;roomName=room;status("게임 서버에 접속 중...");
    try{
      socket=new WebSocket(url);
      socket.onopen=()=>{
        connecting=false;
        try{localStorage.setItem("cyberverse-fps-wss",serverUrl);localStorage.setItem("cyberverse-fps-nick",name);}catch{}
        send({type:"join",room,name});
      };
      socket.onmessage=event=>{
        let m;try{m=JSON.parse(event.data);}catch{return;}
        if(!m||typeof m!=="object")return;
        switch(m.type) {
          case "welcome":
            id=m.id;team=m.team;connected=true;
            $("cv-fps-join").hidden=true;$("cv-fps-disconnect").hidden=false;
            status("연결됨 · "+roomName+" · "+team.toUpperCase()+" 팀");
            onWelcome?.(m);break;
          case "state":{
            const list=Array.isArray(m.players)?m.players:[];
            const alive=new Set();
            for(const p of list) {
              if(!p?.id||p.id===id)continue;alive.add(p.id);
              let remote=peers.get(p.id);
              if(!remote) {
                remote={group:makeAvatar(p.team,p.name),next:{x:Number(p.x)||0,z:Number(p.z)||0,yaw:Number(p.yaw)||0},dead:!!p.dead};
                remote.group.position.set(remote.next.x,0,remote.next.z);peers.set(p.id,remote);
              }
              remote.next={x:Number(p.x)||0,z:Number(p.z)||0,yaw:Number(p.yaw)||0};
              remote.dead=!!p.dead;remote.group.visible=!remote.dead;
            }
            for(const [pid,p] of peers)if(!alive.has(pid)){world.remove(p.group);p.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});peers.delete(pid);}
            onState?.(m,list.find(p=>p.id===id),list);
            break;
          }
          case "round_end":onRoundEnd?.(m);break;
          case "round_start":onWelcome?.(m);break;
          case "shot":onShot?.(m,peers.get(m.id));break;
          case "hit":onHit?.(m);break;
          case "damage":onDamage?.(m);break;
          case "kill":onKill?.(m);break;
          case "error":status(m.text||"서버 오류");break;
        }
      };
      socket.onclose=()=>{if(!connected&&!connecting&&socket===null)return;
        connecting=false;connected=false;id=null;team=null;clearPeers();
        $("cv-fps-join").hidden=false;$("cv-fps-disconnect").hidden=true;
        status("서버 연결이 끊어졌습니다. 재접속할 수 있습니다.");
        onDisconnected?.();
      };
      socket.onerror=()=>status("서버 연결 실패 · HTTPS/WSS, 서버 주소, CORS Origin을 확인하세요.");
    }catch{connecting=false;status("연결을 시작하지 못했습니다.");}
  }
  function tick(dt,t){
    for(const p of peers.values()) {
      if(!p.group.visible)continue;
      const a=Math.min(1,dt*13);
      p.group.position.lerp(new THREE.Vector3(p.next.x,0,p.next.z),a);
      const target=p.next.yaw;
      p.group.rotation.y+=Math.atan2(Math.sin(target-p.group.rotation.y),Math.cos(target-p.group.rotation.y))*a;
      const swing=Math.sin(t*9+p.group.position.x)*.3;
      for(let i=0;i<p.group.userData.limbs.length;i++)p.group.userData.limbs[i].rotation.x=i%2?swing:-swing;
    }
  }
  $("cv-fps-join").addEventListener("click",connect);
  $("cv-fps-disconnect").addEventListener("click",()=>{close();onDisconnected?.();});
  try{$("cv-fps-wss").value=localStorage.getItem("cyberverse-fps-wss")||window.CV_FPS_SERVER_URL||"";
  $("cv-fps-nick").value=localStorage.getItem("cyberverse-fps-nick")||"Player";}catch{}
  return {connect,close,send,tick,isConnected:()=>connected,isConnecting:()=>connecting,id:()=>id,team:()=>team,peerCount:()=>peers.size};
}
