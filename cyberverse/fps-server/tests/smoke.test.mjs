import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import WebSocket from "ws";
const here=dirname(fileURLToPath(import.meta.url)),serverFile=join(here,"..","server.mjs");
async function freePort(){
  const server=createServer();
  await new Promise((resolve,reject)=>server.once("error",reject).listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  await new Promise(r=>server.close(r));return port;
}
async function waitHealth(port){
  for(let i=0;i<50;i++){
    try{const r=await fetch("http://127.0.0.1:"+port+"/health");if(r.ok)return r.json();}
    catch{}
    await delay(75);
  }
  throw Error("FPS server did not start within test deadline");
}
function connect(port,room,name){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket("ws://127.0.0.1:"+port+"/fps",{origin:"https://eentost.github.io"});
    const inbox=[];
    const fail=setTimeout(()=>reject(Error("WS timeout")),4000);
    ws.on("message",data=>{try{inbox.push(JSON.parse(String(data)));}catch{}});
    ws.once("error",err=>{clearTimeout(fail);reject(err);});
    ws.once("open",()=>{ws.send(JSON.stringify({type:"join",room,name}));clearTimeout(fail);resolve({ws,inbox});});
  });
}
async function until(client,match,timeout=3300){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const idx=client.inbox.findIndex(match);
    if(idx!==-1)return client.inbox.splice(idx,1)[0];
    await delay(25);
  }
  throw Error("Missing expected WebSocket message: "+client.inbox.map(m=>m.type).join(","));
}
test("FPS server: health, two-player room, authoritative movement, score state and input isolation",async t=>{
  const port=await freePort();
  const server=spawn(process.execPath,[serverFile],{
    env:{...process.env,PORT:String(port),HOST:"127.0.0.1",ALLOWED_ORIGINS:"https://eentost.github.io"},
    stdio:["ignore","pipe","pipe"]
  });
  let stderr="";server.stderr.on("data",buf=>stderr+=String(buf));
  t.after(()=>{server.kill("SIGTERM");});
  const health=await waitHealth(port);
  assert.equal(health.ok,true);
  const blue=await connect(port,"qa-room","Alpha");
  const red=await connect(port,"qa-room","Bravo");
  t.after(()=>{blue.ws.close();red.ws.close();});
  const a=await until(blue,m=>m.type==="welcome");
  const b=await until(red,m=>m.type==="welcome");
  assert.equal(a.team,"blue");assert.equal(b.team,"red");
  assert.notEqual(a.id,b.id);
  assert.equal(a.room,"qa-room");
  assert.equal(b.room,"qa-room");
  const initial=await until(blue,m=>m.type==="state"&&m.players.length===2);
  assert.equal(initial.players.length,2);
  const before=initial.players.find(p=>p.id===a.id);
  blue.ws.send(JSON.stringify({type:"input",yaw:0,pitch:0,keys:{w:false,s:false,a:false,d:true,shift:false,c:false},hp:0,score:9999,x:3000,z:3000}));
  await delay(320);
  const moved=await until(blue,m=>m.type==="state"&&m.players.some(p=>p.id===a.id&&p.x>before.x+.2));
  const me=moved.players.find(p=>p.id===a.id);
  assert.equal(me.hp,100,"Client must not set its own health");
  assert.ok(me.x>-31&&me.x<31,"Server world position must remain bounded");
  assert.ok(me.x>before.x,"Server-authoritative lateral movement should advance player");
  assert.ok(me.x<before.x+6,"Server must reject teleport-like movement");
  blue.ws.send(JSON.stringify({type:"equip",gun:"not-a-weapon"}));
  const unchanged=await until(blue,m=>m.type==="state"&&m.players.some(p=>p.id===a.id));
  assert.equal(unchanged.players.find(p=>p.id===a.id).gun,"rifle");
  blue.ws.send(JSON.stringify({type:"equip",gun:"sniper"}));
  const equipped=await until(blue,m=>m.type==="state"&&m.players.find(p=>p.id===a.id)?.gun==="sniper");
  assert.equal(equipped.players.find(p=>p.id===a.id).gun,"sniper");
  const stats=await fetch("http://127.0.0.1:"+port+"/health").then(r=>r.json());
  assert.equal(stats.players,2);
  assert.equal(stderr,"","Server emitted unexpected stderr");
});
test("FPS server refuses WebSocket connections from untrusted origins",async t=>{
  const port=await freePort();
  const server=spawn(process.execPath,[serverFile],{env:{...process.env,PORT:String(port),HOST:"127.0.0.1",ALLOWED_ORIGINS:"https://eentost.github.io"},stdio:"ignore"});
  t.after(()=>server.kill("SIGTERM"));
  await waitHealth(port);
  await new Promise((resolve,reject)=>{
    const ws=new WebSocket("ws://127.0.0.1:"+port+"/fps",{origin:"https://untrusted.invalid"});
    const timer=setTimeout(()=>reject(Error("Untrusted origin handshake timeout")),3500);
    ws.once("open",()=>{clearTimeout(timer);ws.close();reject(Error("Untrusted origin unexpectedly connected"));});
    ws.once("error",()=>{clearTimeout(timer);resolve();});
    ws.once("unexpected-response",(_,res)=>{clearTimeout(timer);assert.equal(res.statusCode,403);res.resume();resolve();});
  });
});
