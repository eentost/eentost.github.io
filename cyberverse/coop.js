/* CyberVerse cooperative multiplayer connector */
(function(){
"use strict";
const byId=id=>document.getElementById(id),panel=document.querySelector(".panel");
if(!panel)return;
const css=document.createElement("style");
css.textContent='.cv-coop{margin:16px 0;padding:15px;background:#103349;border:1px solid #4c8192;border-radius:14px}.cv-coop h3{font-size:16px;margin:5px 0}.cv-coop p{font-size:12px;color:#bbd3e1;line-height:1.65}.cv-coop label{font-size:11px;display:block;color:#b8e4e7;margin:10px 0 4px}.cv-coop input{background:#0a2335;border:1px solid #4e8195;border-radius:8px;padding:10px;color:#edfaff;width:100%;font-size:12px}.cv-coop button{cursor:pointer;border:1px solid #52adaf;border-radius:8px;background:#186c71;color:#e9fffc;padding:9px 10px;margin:5px 4px 5px 0;font-size:12px}.cv-coop button:disabled{opacity:.45}.cv-coop .cv-opt{display:block;width:100%;text-align:left;background:#184355;line-height:1.6;padding:11px}.cv-coop .cv-feed{max-height:145px;overflow:auto;display:grid;gap:5px;margin:10px 0}.cv-coop .cv-msg{background:#0b2b3c;padding:7px;border:1px solid #31566a;border-radius:6px;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.cv-coop .cv-stat{font-size:11px;border:1px solid #427c83;border-radius:7px;padding:9px;background:#173b44;color:#aaf6e4}.cv-coop .cv-members{font-size:11px;color:#b8dfeb;line-height:1.7}.cv-coop .cv-chat{display:flex;gap:5px}.cv-coop .cv-chat input{flex:1;min-width:0}.cv-coop .cv-chat button{flex-shrink:0}';
document.head.append(css);
const ui=document.createElement("section");ui.className="cv-coop";ui.id="cv-coop";
ui.innerHTML='<span class="kicker">LIVE COOPERATIVE ROOM</span><h3>실시간 공동 사고 대응</h3><p>서버를 연결하면 같은 방의 아바타·채팅·공동 대응 투표가 동기화됩니다. 서버 연결 전에는 기존 개인 체험을 이용하세요.</p><div id="cv-join"><label for="cv-ws">실시간 서버 주소</label><input id="cv-ws" placeholder="wss://your-domain.example/ws" autocomplete="off"><label for="cv-room">방 이름</label><input id="cv-room" maxlength="24" value="main"><label for="cv-nick">닉네임</label><input id="cv-nick" maxlength="18" placeholder="보안 탐험가"><button id="cv-connect">협동 체험 입장</button><button id="cv-share">초대 링크 복사</button></div><div id="cv-status" class="cv-stat" role="status">개인 체험 중 · 서버 연결 전</div><div id="cv-live" hidden><div class="cv-members" id="cv-members"></div><button id="cv-leave">방 나가기</button><div id="cv-mission"></div><h3>팀 채팅 및 대응 기록</h3><div id="cv-feed" class="cv-feed" aria-live="polite"></div><form class="cv-chat" id="cv-chat"><input id="cv-chat-text" maxlength="220" aria-label="팀원에게 보낼 채팅"><button type="submit">전송</button></form></div>';
panel.insertBefore(ui,byId("catalog"));
const params=new URLSearchParams(location.search),room=params.get("room");
if(room&&/^[a-z0-9-]{1,24}$/.test(room))byId("cv-room").value=room;
byId("cv-ws").value=localStorage.getItem("cv-server")||window.CV_REALTIME_URL||"";
byId("cv-nick").value=localStorage.getItem("cv-nick")||"";
const state={socket:null,me:null,players:new Map(),incident:null,voted:null,live:false};
const send=data=>{if(state.socket?.readyState===WebSocket.OPEN)state.socket.send(JSON.stringify(data));};
const status=s=>byId("cv-status").textContent=s;
function log(who,msg){const d=document.createElement("div");d.className="cv-msg";d.textContent=who+" · "+msg;byId("cv-feed").append(d);while(byId("cv-feed").children.length>40)byId("cv-feed").firstChild.remove();byId("cv-feed").scrollTop=byId("cv-feed").scrollHeight;}
function refreshPeers(){const peers=Array.from(state.players.values()).filter(p=>p.id!==state.me?.id);window.CV3D?.setPeers(peers);byId("cv-members").textContent="현재 "+state.players.size+"명 · "+Array.from(state.players.values()).map(p=>p.name+"("+p.score+"점)").join(" / ");}
addEventListener("cv3:ready",refreshPeers);
function setLive(on){state.live=on;byId("cv-live").hidden=!on;byId("cv-join").hidden=on;byId("catalog").classList.toggle("hidden",on);byId("exercise").classList.add("hidden");byId("result").classList.add("hidden");if(!on){byId("catalog").classList.remove("hidden");state.me=null;state.incident=null;state.players.clear();refreshPeers();window.CV3D?.setThreat(null,0);}}
function render(){
const box=byId("cv-mission");box.replaceChildren();const incident=state.incident;
if(!incident||incident.completed){
const title=document.createElement("h3");title.textContent=incident?"팀 훈련 완료 · 피해 "+incident.damage+"/100":"공동 훈련을 시작하세요";box.append(title);
for(const [id,name] of [["phishing","피싱"],["ransomware","랜섬웨어"],["ddos","DDoS"]]){const b=document.createElement("button");b.textContent=name;b.onclick=()=>send({type:"start",scenario:id});box.append(b);}
window.CV3D?.setThreat(incident?.id||null,incident?.step||0);return;
}
const h=document.createElement("h3");h.textContent=(incident.step+1)+"/"+incident.total+" · "+incident.stage.title;box.append(h);
const p=document.createElement("p");p.textContent=incident.stage.situation;box.append(p);
const path=document.createElement("p");path.textContent="공격 흐름 · "+incident.stage.attack_visual;path.style.color="#ffb8aa";box.append(path);
const vote=document.createElement("p");vote.textContent="공동 투표 · "+(incident.votes_count||0)+"명 제출 / "+(incident.vote_needed||1)+"명 필요";box.append(vote);
for(const option of incident.stage.options){const b=document.createElement("button");b.className="cv-opt";b.textContent=option.text;b.disabled=state.voted===incident.step;b.onclick=()=>{state.voted=incident.step;send({type:"vote",step:incident.step,option:option.id});log("내 투표","대응안을 제출했습니다.");render();};box.append(b);}
window.CV3D?.setThreat(incident.id,incident.step);
}
function handle(m){
switch(m.type){
case "welcome":state.me=m.self;state.players=new Map((m.players||[]).map(p=>[p.id,p]));state.incident=m.incident;state.voted=null;setLive(true);refreshPeers();render();status("● "+m.room+" 방 연결됨 · 서버에서 공동 대응을 판정합니다.");log("시스템","실시간 방에 접속했습니다.");break;
case "join":state.players.set(m.player.id,m.player);refreshPeers();log("참가",m.player.name+" 입장");break;
case "leave":state.players.delete(m.id);refreshPeers();log("시스템","동료가 퇴장했습니다.");break;
case "move":{const p=state.players.get(m.id);if(p){Object.assign(p,m);window.CV3D?.peerMove(p);}break;}
case "chat":log(m.name,m.text);break;
case "incident":{const old=state.incident?.step;state.incident=m.incident;if(old!==m.incident?.step)state.voted=null;if(m.scores)for(const s of m.scores){const p=state.players.get(s.id);if(p)p.score=s.score;}refreshPeers();render();if(m.by)log("훈련",m.by+" 님이 사고를 시작했습니다.");break;}
case "vote_status":if(state.incident?.step===m.step){state.incident.votes_count=m.count;state.incident.vote_needed=m.needed;render();}log("투표",m.count+"명 참여 / "+m.needed+"명 필요");break;
case "feedback":log(m.correct?"방어 성공":"피해 발생",m.effect);window.CV3D?.setDefense(m.correct);break;
case "notice":status(m.text);break;
}
}
byId("cv-connect").addEventListener("click",()=>{
if(state.socket&&state.socket.readyState<2)return;
const base=byId("cv-ws").value.trim().replace(/\/+$/,""),room=byId("cv-room").value.trim(),nick=byId("cv-nick").value.trim()||"게스트";
if(!/^wss?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9/_-]+)?$/.test(base)){status("실시간 서버 주소를 확인하세요. 예: wss://example.com/ws");return;}
if(location.protocol==="https:"&&!base.startsWith("wss://")){status("HTTPS에서는 wss:// 연결만 허용합니다.");return;}
if(!/^[a-z0-9-]{1,24}$/.test(room)){status("방 이름은 영문 소문자·숫자·하이픈 1~24자여야 합니다.");return;}
status("서버에 연결 중...");
try{const ws=new WebSocket(base+"/"+room+"?nick="+encodeURIComponent(nick.slice(0,18)));state.socket=ws;
ws.onopen=()=>{localStorage.setItem("cv-server",base);localStorage.setItem("cv-nick",nick);};
ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch(err){status("서버 메시지 형식을 확인하세요.");}};
ws.onclose=e=>{if(state.socket!==ws)return;setLive(false);status("연결 종료("+e.code+") · 서버 주소, 허용 Origin, TLS 상태를 확인하세요.");};
ws.onerror=()=>status("연결 실패 · 실시간 서버가 배포되었는지 확인하세요.");
}catch(err){status("서버 주소가 유효하지 않습니다.");}
});
byId("cv-leave").addEventListener("click",()=>{state.socket?.close(1000,"left");setLive(false);status("개인 체험 모드로 돌아왔습니다.");});
byId("cv-share").addEventListener("click",async()=>{const room=byId("cv-room").value.trim();if(!/^[a-z0-9-]{1,24}$/.test(room)){status("방 이름을 확인하세요.");return;}const u=new URL(location.href);u.searchParams.set("room",room);try{await navigator.clipboard.writeText(u.toString());status("초대 링크가 복사되었습니다. 상대방도 동일 서버를 연결해야 합니다.");}catch(err){status(u.toString());}});
byId("cv-chat").addEventListener("submit",e=>{e.preventDefault();const inp=byId("cv-chat-text"),msg=inp.value.trim();if(msg){send({type:"chat",text:msg.slice(0,220)});inp.value="";}});
window.CVCOOP={connected:()=>state.live,start:id=>{if(state.live&&["phishing","ransomware","ddos"].includes(id))send({type:"start",scenario:id});}};
addEventListener("cv3:move",e=>{if(state.live)send({type:"move",...e.detail});});
})();
