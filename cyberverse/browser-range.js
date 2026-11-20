(function(){
"use strict";
const WARGAME_URL="https://lsszz2100.github.io/VibeHacking/wargame/";
const overlay=document.createElement("section");
overlay.className="cv-range-overlay";
overlay.id="cv-range-overlay";
overlay.hidden=true;
overlay.setAttribute("role","dialog");
overlay.setAttribute("aria-modal","true");
overlay.setAttribute("aria-labelledby","cv-range-title");
const shell=document.createElement("div");
shell.className="cv-range-shell";
const header=document.createElement("header");
header.className="cv-range-header";
const heading=document.createElement("div");
heading.className="cv-range-heading";
const kicker=document.createElement("span");
kicker.className="cv-range-kicker";
kicker.textContent="CYBERVERSE ACADEMY / EXTERNAL BROWSER LAB";
const title=document.createElement("h2");
title.id="cv-range-title";
title.textContent="VibeHacking 실전 워게임";
const subtitle=document.createElement("p");
subtitle.textContent="77개 트랙 · 2,730개 챌린지 · 브라우저 취약점 플레이그라운드";
heading.append(kicker,title,subtitle);
const actions=document.createElement("div");
actions.className="cv-range-header-actions";
const external=document.createElement("a");
external.className="cv-range-open-new";
external.href=WARGAME_URL;
external.target="_blank";
external.rel="noopener noreferrer";
external.textContent="새 창에서 열기 ↗";
const closeButton=document.createElement("button");
closeButton.className="cv-range-close";
closeButton.type="button";
closeButton.setAttribute("aria-label","워게임 닫기");
closeButton.textContent="×";
actions.append(external,closeButton);
header.append(heading,actions);
const disclosure=document.createElement("div");
disclosure.className="cv-range-disclosure";
disclosure.textContent="브라우저 내부에서 동작하는 교육용 가상 터미널·시뮬레이터입니다. 방문자의 PC에서 실제 OS 명령을 실행하거나 외부 시스템에 접속하지 않습니다. Docker 기반 랩은 별도 실습 환경이 필요합니다.";
const frameWrap=document.createElement("div");
frameWrap.className="cv-range-frame-wrap";
const frame=document.createElement("iframe");
frame.className="cv-range-frame";
frame.title="VibeHacking 브라우저 터미널 워게임 및 취약점 시뮬레이터";
frame.loading="lazy";
frame.referrerPolicy="no-referrer";
frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-modals allow-downloads");
frame.setAttribute("allow","clipboard-write");
frame.setAttribute("allowfullscreen","");
frameWrap.append(frame);
const footer=document.createElement("footer");
footer.className="cv-range-footer";
const storageNote=document.createElement("span");
storageNote.textContent="진행도는 VibeHacking 사이트의 브라우저 저장소에 저장됩니다.";
const source=document.createElement("a");
source.href="https://github.com/lsszz2100/VibeHacking";
source.target="_blank";
source.rel="noopener noreferrer";
source.textContent="오픈소스 및 학습 자료";
footer.append(storageNote,source);
shell.append(header,disclosure,frameWrap,footer);
overlay.append(shell);
document.body.append(overlay);
let previousFocus=null;
let previousOverflow="";
let backgroundState=[];
let loaded=false;
function setBackgroundInert(enabled){
  if(enabled){
    backgroundState=Array.from(document.body.children).filter(node=>node!==overlay).map(node=>({node,inert:node.inert}));
    backgroundState.forEach(item=>{item.node.inert=true;});
  }else{
    backgroundState.forEach(item=>{item.node.inert=item.inert;});
    backgroundState=[];
  }
}
function open(){
  if(!overlay.hidden)return;
  previousFocus=document.activeElement;
  previousOverflow=document.body.style.overflow;
  overlay.hidden=false;
  document.body.style.overflow="hidden";
  setBackgroundInert(true);
  if(!loaded){frame.src=WARGAME_URL;loaded=true;}
  closeButton.focus();
  window.dispatchEvent(new CustomEvent("cv-range:open"));
}
function close(){
  if(overlay.hidden)return;
  overlay.hidden=true;
  document.body.style.overflow=previousOverflow;
  setBackgroundInert(false);
  if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus();
  window.dispatchEvent(new CustomEvent("cv-range:close"));
}
closeButton.addEventListener("click",close);
overlay.addEventListener("click",event=>{if(event.target===overlay)close();});
document.addEventListener("keydown",event=>{
  if(!overlay.hidden&&event.key==="Escape"){
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }
},true);
window.CVRange={open,close,isOpen:()=>!overlay.hidden};
if(new URLSearchParams(window.location.search).get("lab")==="vibehacking")open();
})();