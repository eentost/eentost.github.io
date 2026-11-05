/**
 * CyberVerse FPS realtime server.
 * Self-hosted Node 22+ / ws. Authoritative movement, shot validation and score.
 * Rooms are held in memory; one instance only (no multi-node shared state).
 */
import http from "node:http";
import {randomUUID} from "node:crypto";
import {WebSocketServer} from "ws";

const PORT=Number(process.env.PORT||8787);
const HOST=process.env.HOST||"0.0.0.0";
const ORIGINS=(process.env.ALLOWED_ORIGINS||"https://eentost.github.io,http://localhost:5173,http://localhost:8000").split(",").map(v=>v.trim()).filter(Boolean);
const MAX_ROOMS=80,MAX_PLAYERS=12,TICK_RATE=25,MAX_SCORE=30,GAME_LENGTH=300;
const ROOM_NAME=/^[a-z0-9-]{1,24}$/,VALID_WEAPONS=["rifle","smg","carbine","shotgun","dmr","sniper","lmg","pistol"];
const SPECS={
  rifle:{mag:30,damage:30,interval:.115,range:80,spread:.018,reload:1.8},
  smg:{mag:40,damage:20,interval:.075,range:45,spread:.032,reload:1.5},
  carbine:{mag:30,damage:27,interval:.095,range:72,spread:.017,reload:1.6},
  shotgun:{mag:8,damage:15,pellets:8,interval:.75,range:22,spread:.135,reload:2.4},
  dmr:{mag:15,damage:47,interval:.29,range:95,spread:.007,reload:2.0},
  sniper:{mag:5,damage:100,interval:1.1,range:110,spread:.002,reload:2.6},
  lmg:{mag:65,damage:23,interval:.09,range:80,spread:.039,reload:3.8},
  pistol:{mag:15,damage:30,interval:.24,range:45,spread:.027,reload:1.2}
};
const BLOCKS=[
 [-16,-14,12,5],[-16,12,12,5],[16,14,12,5],[16,-12,12,5],
 [0,-6,6.5,9.5],[0,9,6.5,9.5],[-10,-1,4.5,4],[11,2,4.5,4],
 [-23,2,3,3],[23,-4,3,3],[-24,-25,4,4],[24,24,4,4],[0,25,5,3],[0,-24,5,3]
];
const TICK=1/TICK_RATE,MAX_PER_SECOND=70,MAX_PER_IP=16;
const rooms=new Map(),ipCounts=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const now=()=>performance.now()/1000;
const safeName=s=>String(s||"Player").normalize("NFKC").replace(/[^\p{L}\p{N} _-]/gu,"").trim().slice(0,18)||"Player";
const send=(p,obj)=>{if(p.ws.readyState===1){try{p.ws.send(JSON.stringify(obj));}catch{}}};
function broadcast(room,obj){const txt=JSON.stringify(obj);for(const p of room.players.values())if(p.ws.readyState===1)p.ws.send(txt);}
function collision(x,z,r=.4){
  return Math.abs(x)>30.8||Math.abs(z)>34||
    BLOCKS.some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+r&&Math.abs(z-cz)<d/2+r);
}
function visible(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),steps=Math.ceil(d/.65);
  if(steps===0)return true;
  for(let i=1;i<steps;i++){const t=i/steps;if(BLOCKS.some(([x,z,w,depth])=>Math.abs(a.x+dx*t-x)<w/2+.01&&Math.abs(a.z+dz*t-z)<depth/2+.01))return false;}
  return true;
}
function spawn(p){
  for(let tries=0;tries<18;tries++){
    const x=(Math.random()-.5)*18,z=(p.team==="red"?-28:28)+(Math.random()-.5)*5;
    if(!collision(x,z)){p.x=x;p.z=z;break;}
  }
  p.hp=100;p.armor=100;p.dead=0;p.invuln=1.8;p.yaw=p.team==="blue"?0:Math.PI;p.pitch=0;
  p.input={w:false,s:false,a:false,d:false,shift:false,c:false};
  p.ammo={};p.reserve={};for(const k of VALID_WEAPONS){p.ammo[k]=SPECS[k].mag;p.reserve[k]=SPECS[k].mag*5;}
  p.weapon="rifle";p.lastShot=0;p.reloadUntil=0;p.reloadWeapon="";
}
function playerSnapshot(p){
  return {id:p.id,name:p.name,team:p.team,x:+p.x.toFixed(3),z:+p.z.toFixed(3),
    yaw:+p.yaw.toFixed(3),pitch:+p.pitch.toFixed(3),
    hp:p.hp,armor:p.armor,dead:p.dead>0,respawnIn:+p.dead.toFixed(2),invuln:p.invuln>0,
    gun:p.weapon,ammo:p.ammo[p.weapon],reserve:p.reserve[p.weapon],reloadIn:Math.max(0,+(p.reloadUntil-now()).toFixed(2)),kills:p.kills,deaths:p.deaths};
}
function getRoom(name){
  let room=rooms.get(name);
  if(!room&&rooms.size<MAX_ROOMS){room={name,players:new Map(),time:GAME_LENGTH,score:{blue:0,red:0},round:1,pendingReset:0,lastSnapshot:0};rooms.set(name,room);}
  return room;
}
function scoreKill(room,attacker,victim,head){
  victim.hp=0;victim.dead=3;victim.deaths++;
  if(attacker.team!==victim.team){room.score[attacker.team]++;attacker.kills++;}
  broadcast(room,{type:"kill",by:attacker.id,victim:victim.id,head,score:room.score});
  if(room.score.blue>=MAX_SCORE||room.score.red>=MAX_SCORE)roundEnd(room);
}
function roundEnd(room){
  if(room.pendingReset)return;
  room.pendingReset=7;
  broadcast(room,{type:"round_end",score:room.score,round:room.round});
}
function resetRoom(room){
  room.round++;room.time=GAME_LENGTH;room.score={blue:0,red:0};room.pendingReset=0;
  for(const p of room.players.values()){p.kills=0;p.deaths=0;spawn(p);}
  broadcast(room,{type:"round_start",round:room.round});
}
function recordInput(p,msg){
  const yaw=Number(msg.yaw),pitch=Number(msg.pitch);
  if(Number.isFinite(yaw))p.yaw=clamp(yaw,-10000,10000);
  if(Number.isFinite(pitch))p.pitch=clamp(pitch,-1.26,1.26);
  if(msg.keys&&typeof msg.keys==="object")for(const k of ["w","a","s","d","shift","c"])p.input[k]=msg.keys[k]===true;
  const axisX=Number(msg.moveX),axisZ=Number(msg.moveZ);
  p.input.ax=Number.isFinite(axisX)?clamp(axisX,-1,1):0;
  p.input.az=Number.isFinite(axisZ)?clamp(axisZ,-1,1):0;
}
function reload(p){
  if(p.dead||p.reloadUntil>now())return;
  const w=SPECS[p.weapon];
  if(p.ammo[p.weapon]>=w.mag||p.reserve[p.weapon]<=0)return;
  p.reloadWeapon=p.weapon;p.reloadUntil=now()+w.reload;
}
function switchWeapon(p,msg){
  if(p.dead||p.reloadUntil>now()||!VALID_WEAPONS.includes(msg.gun))return;
  p.weapon=msg.gun;p.lastShot=0;
}
function fire(room,p){
  if(room.pendingReset||p.dead||p.reloadUntil>now())return;
  const w=SPECS[p.weapon],ts=now();
  if(ts-p.lastShot+0.0001<w.interval)return;
  if(p.ammo[p.weapon]<=0){reload(p);return;}
  p.ammo[p.weapon]--;p.lastShot=ts;
  const spread=w.spread,shots=w.pellets||1;
  const victims=new Map();
  const origin={x:p.x,z:p.z};
  for(let i=0;i<shots;i++){
    const yaw=p.yaw+(Math.random()-.5)*spread,pitch=p.pitch+(Math.random()-.5)*spread;
    // 3D ray tested against simplified upright capsules centered at body/head.
    const dx=-Math.sin(yaw),dz=-Math.cos(yaw),dy=Math.tan(pitch);
    let best=null,bestDepth=w.range+1,head=false;
    for(const target of room.players.values()){
      if(target===p||target.team===p.team||target.dead>0||target.invuln>0)continue;
      const rx=target.x-origin.x,rz=target.z-origin.z,t=rx*dx+rz*dz;
      if(t<.4||t>w.range||t>=bestDepth)continue;
      const lateral=Math.abs(rx*dz-rz*dx);
      const y=1.7+dy*t;
      if(lateral>.42||y<.55||y>2.3||!visible(origin,target))continue;
      best=target;bestDepth=t;head=y>1.8;
    }
    if(best){const amt=w.damage*(head?1.7:1),prior=victims.get(best);victims.set(best,{damage:(prior?.damage||0)+amt,head:!!head||!!prior?.head});}
  }
  for(const [victim,info]of victims){
    const amount=info.damage;
    const absorbed=Math.min(victim.armor,amount*.55);
    victim.armor=Math.max(0,victim.armor-absorbed);
    victim.hp=Math.max(0,Math.ceil(victim.hp-amount+absorbed));
    send(victim,{type:"damage",hp:victim.hp,armor:victim.armor});
    send(p,{type:"hit",victim:victim.id});
    if(victim.hp===0)scoreKill(room,p,victim,info.head);
  }
  broadcast(room,{type:"shot",id:p.id,gun:p.weapon});
}
function tick(dt){
  for(const [name,room]of rooms){
    if(!room.players.size){rooms.delete(name);continue;}
    if(room.pendingReset){room.pendingReset=Math.max(0,room.pendingReset-dt);if(room.pendingReset===0)resetRoom(room);}
    else{room.time=Math.max(0,room.time-dt);if(room.time<=0)roundEnd(room);}
    for(const p of room.players.values()){
      if(p.dead>0){p.dead=Math.max(0,p.dead-dt);if(p.dead===0)spawn(p);continue;}
      p.invuln=Math.max(0,p.invuln-dt);
      if(p.reloadUntil&&p.reloadUntil<=now()){
        const key=p.reloadWeapon,w=SPECS[key],n=Math.min(w.mag-p.ammo[key],p.reserve[key]);
        p.ammo[key]+=n;p.reserve[key]-=n;p.reloadUntil=0;p.reloadWeapon="";
      }
      if(room.pendingReset)continue;
      const input=p.input,forward=Number(input.w)-Number(input.s)+(input.az||0),strafe=Number(input.d)-Number(input.a)+(input.ax||0);
      const length=Math.hypot(forward,strafe)||1,speed=input.c?3.2:input.shift?9:6.1;
      const dx=(-Math.sin(p.yaw)*forward+Math.cos(p.yaw)*strafe)*dt*speed/length;
      const dz=(-Math.cos(p.yaw)*forward-Math.sin(p.yaw)*strafe)*dt*speed/length;
      if(!collision(p.x+dx,p.z))p.x+=dx;
      if(!collision(p.x,p.z+dz))p.z+=dz;
    }
    room.lastSnapshot+=dt;
    if(room.lastSnapshot>=.1){
      room.lastSnapshot=0;
      broadcast(room,{type:"state",time:+room.time.toFixed(1),round:room.round,score:room.score,players:Array.from(room.players.values()).map(playerSnapshot)});
    }
  }
}
const server=http.createServer((req,res)=>{
  if(req.url==="/health"){
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    res.end(JSON.stringify({ok:true,rooms:rooms.size,players:Array.from(rooms.values()).reduce((a,r)=>a+r.players.size,0),version:"1.0.0"}));
  }else{res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");}
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on("upgrade",(request,socket,head)=>{
  const url=new URL(request.url||"/","http://localhost");
  if(url.pathname!=="/fps"||!ORIGINS.includes(request.headers.origin||"")){
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");socket.destroy();return;
  }
  const ip=request.socket.remoteAddress||"unknown";
  if((ipCounts.get(ip)||0)>=MAX_PER_IP){socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");socket.destroy();return;}
  wss.handleUpgrade(request,socket,head,ws=>{ipCounts.set(ip,(ipCounts.get(ip)||0)+1);wss.emit("connection",ws,request,ip);});
});
wss.on("connection",(ws,request,ip)=>{
  let player=null,room=null,cleaned=false,limit={window:now(),count:0};
  const close=()=>{try{ws.close(1008,"invalid request");}catch{}};
  const remove=()=>{
    if(cleaned)return;cleaned=true;ipCounts.set(ip,Math.max(0,(ipCounts.get(ip)||1)-1));
    if(player&&room){room.players.delete(player.id);broadcast(room,{type:"leave",id:player.id});}
  };
  ws.on("close",remove);ws.on("error",remove);
  ws.on("message",buf=>{
    if(buf.length>4096)return close();
    const t=now();if(t-limit.window>=1){limit.window=t;limit.count=0;}
    if(++limit.count>MAX_PER_SECOND)return close();
    let m;try{m=JSON.parse(String(buf));}catch{return close();}
    if(!m||typeof m!=="object"||typeof m.type!=="string")return close();
    if(!player){
      if(m.type!=="join"||!ROOM_NAME.test(m.room||""))return close();
      room=getRoom(m.room);if(!room){send({ws},{type:"error",text:"Room capacity reached"});return close();}
      if(room.players.size>=MAX_PLAYERS){send({ws},{type:"error",text:"Room full"});return close();}
      const blue=Array.from(room.players.values()).filter(p=>p.team==="blue").length;
      const red=room.players.size-blue;
      player={id:randomUUID(),ws,name:safeName(m.name),team:blue<=red?"blue":"red",kills:0,deaths:0,input:{}};
      spawn(player);room.players.set(player.id,player);
      send(player,{type:"welcome",id:player.id,room:room.name,team:player.team,time:room.time,score:room.score,round:room.round});
      broadcast(room,{type:"join",player:playerSnapshot(player)});return;
    }
    switch(m.type){
      case "input":recordInput(player,m);break;
      case "shoot":fire(room,player);break;
      case "reload":reload(player);break;
      case "equip":switchWeapon(player,m);break;
      case "ping":send(player,{type:"pong",at:m.at});break;
      default:break;
    }
  });
});
const timer=setInterval(()=>tick(TICK),1000/TICK_RATE);timer.unref();
server.listen(PORT,HOST,()=>console.log("CyberVerse FPS server listening on "+HOST+":"+PORT));
process.on("SIGTERM",()=>{clearInterval(timer);wss.close();server.close();});
