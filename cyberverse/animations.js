/* CyberVerse interactive motion engine v0.2.0. No network calls; on-canvas effects only. */
(function(){
"use strict";
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
function create(opts){
  const ctx=opts.ctx, canvas=opts.canvas, project=opts.project;
  const reducePreference=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state={
    reduced:!!reducePreference,traffic:true,threat:null,stage:0,zone:"plaza",
    reaction:null,reactionAt:0,effects:[],trail:[],lastPlayer:null,hover:null,
    lastTime:0,settled:false,toastTimer:0
  };
  const get=(id)=>document.getElementById(id);
  function classState(){
    document.body.classList.toggle("cv-reduced",state.reduced);
    document.body.classList.toggle("cv-threat-active",!!state.threat&&!state.settled);
    document.body.classList.toggle("cv-guarded",!!state.threat&&state.settled);
  }
  function status(title,sub){
    const a=get("cv-threat-label"),b=get("cv-stage-label");
    if(a)a.textContent=title;if(b)b.textContent=sub;
    classState();
  }
  function toast(msg,danger){
    const el=get("cv-toast");
    if(!el)return;
    clearTimeout(state.toastTimer);
    el.textContent=msg;
    el.classList.toggle("is-danger",!!danger);
    el.classList.add("is-visible");
    state.toastTimer=setTimeout(()=>el.classList.remove("is-visible"),2700);
  }
  function emit(x,z,color,count){
    if(state.reduced)return;
    const total=Math.min(count||18,26);
    for(let i=0;i<total;i++){
      const a=TAU*(i/total)+Math.random()*.13,speed=.65+Math.random()*2.1;
      state.effects.push({x,z,vx:Math.cos(a)*speed,vz:Math.sin(a)*speed,at:performance.now(),life:650+Math.random()*800,color});
    }
    if(state.effects.length>100)state.effects.splice(0,state.effects.length-100);
  }
  function setReduced(value){
    state.reduced=!!value;
    if(state.reduced){state.effects.length=0;state.trail.length=0;}
    const btn=get("cv-motion-toggle");
    if(btn){btn.setAttribute("aria-pressed",String(state.reduced));btn.textContent=state.reduced?"◈ 모션 켜기":"◈ 모션 줄이기";}
    classState();
    toast(state.reduced?"움직임을 줄였습니다. 대응 기능은 그대로 사용할 수 있습니다.":"공간 애니메이션을 켰습니다.",false);
  }
  function setTraffic(value){
    state.traffic=!!value;
    const btn=get("cv-traffic-toggle");
    if(btn){btn.setAttribute("aria-pressed",String(state.traffic));btn.textContent=state.traffic?"↗ 흐름 표시 중":"↗ 흐름 숨김";}
    toast(state.traffic?"네트워크 흐름을 표시합니다.":"네트워크 흐름을 숨겼습니다.",false);
  }
  function zoneSelect(id){
    if(id===state.zone)return;
    state.zone=id;
    if(!state.reduced)emit((opts.getZones().find(z=>z.id===id)||{x:0}).x,(opts.getZones().find(z=>z.id===id)||{z:0}).z,"#64f2d8",11);
    if(!state.threat)status("가상 공간 탐험",id==="soc"?"SOC의 이상 징후를 관찰하세요":"구역을 클릭해 살펴보세요");
  }
  function start(type){
    state.threat=type;state.stage=0;state.settled=false;state.reaction=null;
    emit(0,-15,"#ff997c",26);
    const names={phishing:"피싱 침해 징후",ransomware:"랜섬웨어 확산 경보",ddos:"DDoS 트래픽 폭증"};
    status(names[type]||"사고 발생","경보 발생 · 사고 대응을 시작하세요");
    toast("사고 발생! 붉은 공격 흐름을 관찰하며 대응해 보세요.",true);
  }
  function stage(index){
    if(!state.threat)return;
    state.stage=index;
    status("사고 분석 진행 중",(index+1)+" / 4 단계 · 대응 결정을 내려보세요");
  }
  function choice(good){
    if(!state.threat)return;
    state.reaction=good?"good":"bad";
    state.reactionAt=performance.now();
    emit(0,-15,good?"#86ffe3":"#ff897f",good?26:30);
    if(good){
      status("방어 조치 적용","공격 경로 일부 차단 · 다음 단계 확인");
      toast("방어 성공! 공격 흐름에 차단막이 형성됐습니다.",false);
    }else{
      status("방어 실패 · 피해 증가","위협이 확산됩니다. 다음 단계에서 복구하세요");
      toast("피해 발생! 붉은 확산 파동을 확인하세요.",true);
    }
    const el=get("integrity");if(el){el.classList.remove("cv-damaged","cv-recovered");void el.offsetWidth;el.classList.add(good?"cv-recovered":"cv-damaged");}
    classState();
  }
  function end(correct,total){
    state.settled=true;state.reaction="done";state.reactionAt=performance.now();
    emit(0,-15,correct===total?"#8effd4":"#eac596",25);
    status("시나리오 종료",correct+" / "+total+"개 단계 올바른 대응");
    toast("훈련이 끝났습니다. 결과를 확인하고 다른 사고에 도전하세요.",false);
  }
  function reset(){
    state.threat=null;state.stage=0;state.reaction=null;state.settled=false;
    status("안전 네트워크","시나리오를 선택해 사고를 시작하세요");
  }
  function hover(id,x,y){
    state.hover=id||null;
    const hint=get("cv-tip");
    if(!hint)return;
    const z=opts.getZones().find(v=>v.id===id);
    if(!z){hint.classList.remove("is-visible");return;}
    hint.textContent=z.name+" · 클릭해서 이동";
    hint.style.left=x+"px";hint.style.top=y+"px";
    hint.classList.add("is-visible");
  }
  function dot(x,y,r,color,blur){
    ctx.save();
    if(blur){ctx.shadowColor=color;ctx.shadowBlur=blur;}
    ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=color;ctx.fill();ctx.restore();
  }
  function line(a,b,color,width,alpha){
    const p=project(a.x,a.z),q=project(b.x,b.z);
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
    ctx.lineCap="round";ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();
  }
  function movingParticle(a,b,t,offset,color,r){
    const f=state.reduced?.48:(t*.00014+offset)%1;
    const p=project(mix(a.x,b.x,f),mix(a.z,b.z,f));
    dot(p.x,p.y-4-Math.sin(f*Math.PI)*6,r,color,11);
  }
  function drawRoutes(t){
    const zones=opts.getZones();
    const hub=zones[0];
    for(let i=1;i<zones.length;i++){
      const z=zones[i];
      line(hub,z,"#5ce3dc",1.7,.21);
      const a=project(hub.x,hub.z),b=project(z.x,z.z);
      if(state.traffic){
        for(let k=0;k<2;k++)movingParticle(hub,z,t,i*.17+k*.5,"#69eedf",2.3);
        const p=project(mix(hub.x,z.x,.5),mix(hub.z,z.z,.5));
        ctx.save();ctx.strokeStyle="#4f9bb3";ctx.globalAlpha=.2;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(a.x,a.y-9);ctx.quadraticCurveTo(p.x,p.y-40,b.x,b.y-9);ctx.stroke();ctx.restore();
      }
    }
  }
  function drawThreat(t){
    if(!state.threat)return;
    const zones=opts.getZones(),pos=id=>zones.find(z=>z.id===id),incident=pos("incident"),soc=pos("soc");
    let routes;
    if(state.threat==="phishing")routes=[[pos("community"),incident],[incident,soc]];
    else if(state.threat==="ransomware")routes=[[incident,pos("community")],[incident,pos("forensics")],[incident,soc]];
    else routes=[[{x:-20,z:-16},soc],[{x:20,z:-18},soc],[{x:-20,z:15},soc],[{x:20,z:16},soc]];
    for(const [a,b] of routes){
      line(a,b,state.settled?"#67dbbf":"#ff735f",state.settled?2:2.7,state.settled?.23:.55);
      if(state.traffic&&!state.settled){
        for(let i=0;i<(state.threat==="ddos"?3:2);i++)movingParticle(a,b,t,i*.31+state.stage*.1,"#ff8774",3.3);
      }
    }
    const center=project(incident.x,incident.z);
    ctx.save();const k=state.reduced?.5:(t*.0011%1);
    ctx.lineWidth=2.2;ctx.strokeStyle=state.settled?"#78f4d9":"#ff9784";
    ctx.globalAlpha=state.settled?.45:.7*(1-k);
    ctx.beginPath();ctx.ellipse(center.x,center.y,20+k*36,8+k*16,0,0,TAU);ctx.stroke();ctx.restore();
    if(state.reaction){
      const elapsed=t-state.reactionAt;
      if(elapsed<1250&&elapsed>=0){
        const f=state.reduced?.4:elapsed/1250;
        ctx.save();ctx.strokeStyle=state.reaction==="bad"?"#ff8f84":"#83ffe0";
        ctx.globalAlpha=state.reduced?.6:Math.max(0,1-f);ctx.lineWidth=5*(1-f)+1;
        ctx.beginPath();ctx.ellipse(center.x,center.y,14+f*105,7+f*48,0,0,TAU);ctx.stroke();ctx.restore();
      }
    }
    if(state.reaction==="good"||state.settled){
      const guard=project(soc.x,soc.z),s=state.reduced?1:(.95+.08*Math.sin(t*.007));
      ctx.save();ctx.strokeStyle="#84ffdf";ctx.shadowColor="#64ffd7";ctx.shadowBlur=14;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(guard.x,guard.y-17,16*s,Math.PI*.8,Math.PI*2.2);ctx.stroke();ctx.restore();
      dot(guard.x,guard.y-17,3.1,"#aaffec",8);
    }
  }
  function drawRadar(t){
    const zones=opts.getZones(),list=["soc","plaza","incident"];
    for(let i=0;i<list.length;i++){
      const z=zones.find(q=>q.id===list[i]);const p=project(z.x,z.z);
      const phase=state.reduced?.45:(t*.00033+i*.26)%1;
      ctx.save();ctx.globalAlpha=.25*(1-phase);ctx.lineWidth=1.5;ctx.strokeStyle=z.id==="incident"&&state.threat?"#fa947e":"#73eee6";
      ctx.beginPath();ctx.ellipse(p.x,p.y,21+40*phase,9+19*phase,0,0,TAU);ctx.stroke();ctx.restore();
    }
    if(state.hover){
      const z=zones.find(q=>q.id===state.hover);
      if(z){const p=project(z.x,z.z);ctx.save();ctx.lineWidth=2;ctx.strokeStyle="#ffffc0";ctx.setLineDash([6,4]);ctx.beginPath();ctx.ellipse(p.x,p.y,49,21,0,0,TAU);ctx.stroke();ctx.restore();}
    }
    // Small monitoring drones gently orbit the SOC and academy, giving the city a sense of activity.
    for(let i=0;i<2;i++){
      const z=zones.find(v=>v.id===(i?"academy":"soc")),a=state.reduced?i*2:(t*.0004+i*2.9);
      const x=z.x+Math.cos(a)*4.2,zz=z.z+Math.sin(a)*3.4,p=project(x,zz);
      dot(p.x,p.y-45-(state.reduced?0:Math.sin(a*2)*5),3.4,"#94fef0",9);
      ctx.save();ctx.strokeStyle="#92fff2";ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(p.x-8,p.y-45);ctx.lineTo(p.x+8,p.y-45);ctx.stroke();ctx.restore();
    }
  }
  function drawTrail(t){
    const p=opts.getPlayer(),last=state.lastPlayer;
    if(!state.reduced&&last&&Math.hypot(p.x-last.x,p.z-last.z)>.16){
      state.trail.push({x:p.x,z:p.z,at:t});if(state.trail.length>20)state.trail.shift();
      state.lastPlayer={x:p.x,z:p.z};
    }else if(!last)state.lastPlayer={x:p.x,z:p.z};
    ctx.save();
    state.trail=state.trail.filter(n=>t-n.at<1250);
    for(const n of state.trail){const a=project(n.x,n.z),f=1-(t-n.at)/1250;ctx.globalAlpha=.35*f;dot(a.x,a.y-3,3.5*f+1,"#6bf2e5",0);}
    ctx.restore();
    const a=project(p.x,p.z),bob=state.reduced?0:Math.sin(t*.004)*2;
    // Avatar proximity beacon and subtle foot shadow, without replacing existing player drawing.
    ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle="#82fcef";ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(a.x,a.y,18+bob,8+bob*.4,0,0,TAU);ctx.stroke();ctx.restore();
    if(!state.reduced)dot(a.x,a.y-36+bob,1.5,"#eaffff",7);
  }
  function drawEffects(t){
    if(state.reduced||!state.effects.length)return;
    state.effects=state.effects.filter(p=>t-p.at<p.life);
    for(const o of state.effects){
      const f=clamp((t-o.at)/o.life,0,1);
      const p=project(o.x+o.vx*f*3,o.z+o.vz*f*3);
      ctx.save();ctx.globalAlpha=(1-f)*.9;ctx.fillStyle=o.color;
      ctx.beginPath();ctx.arc(p.x,p.y-18-f*25,(1-f)*3.8+.5,0,TAU);ctx.fill();ctx.restore();
    }
  }
  function draw(t){
    // Called after the original city render, to preserve all existing geometry and interactions.
    if(!opts.getZones||!opts.getPlayer||!project)return;
    drawRoutes(t);drawThreat(t);drawRadar(t);drawTrail(t);drawEffects(t);
  }
  const motionBtn=get("cv-motion-toggle"),trafficBtn=get("cv-traffic-toggle");
  if(motionBtn)motionBtn.addEventListener("click",()=>setReduced(!state.reduced));
  if(trafficBtn)trafficBtn.addEventListener("click",()=>setTraffic(!state.traffic));
  if(state.reduced){document.body.classList.add("cv-reduced");if(motionBtn){motionBtn.textContent="◈ 모션 켜기";motionBtn.setAttribute("aria-pressed","true");}}
  status("안전 네트워크","시나리오를 선택해 사고를 시작하세요");
  return {draw,zoneSelect,start,stage,choice,end,reset,hover,setReduced,setTraffic};
}
window.CyberVerseMotion={create};
})();
