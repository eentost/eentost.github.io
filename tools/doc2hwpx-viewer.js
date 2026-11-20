(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const stage = $("nativeViewerStage");
  if (!stage) return;
  const fileInput = $("nativeViewerFile");
  const prev = $("nativeViewerPrev");
  const next = $("nativeViewerNext");
  const pageInput = $("nativeViewerPage");
  const pagesLabel = $("nativeViewerPages");
  const zoomLabel = $("nativeViewerZoom");
  const status = $("nativeViewerStatus");
  const zoomOut = $("nativeViewerZoomOut");
  const zoomIn = $("nativeViewerZoomIn");
  const fit = $("nativeViewerFit");
  let session = 0, pageCount = 0, pageIndex = 0, zoom = 1, currentFile = "";
  let imageUrl = null, busy = false;
  const buttons = [prev,next,pageInput,zoomOut,zoomIn,fit];
  function setBusy(value){busy=value;buttons.forEach(x=>x.disabled=value||!session);}
  function updateControls(){
    prev.disabled=busy||!session||pageIndex<=0;
    next.disabled=busy||!session||pageIndex>=pageCount-1;
    pageInput.disabled=busy||!session;
    zoomOut.disabled=busy||!session||zoom<=0.5;
    zoomIn.disabled=busy||!session||zoom>=2;
    fit.disabled=busy||!session;
    pageInput.value=String(pageIndex+1);
    pageInput.max=String(pageCount||1);
    pagesLabel.textContent=String(pageCount||"—");
    zoomLabel.textContent=Math.round(zoom*100)+"%";
  }
  function cleanSvg(source){
    const parsed=new DOMParser().parseFromString(source,"image/svg+xml");
    if(parsed.querySelector("parsererror")) throw new Error("렌더링 SVG를 읽을 수 없습니다.");
    const root=parsed.documentElement;
    if(root.localName!=="svg") throw new Error("SVG 루트 요소가 올바르지 않습니다.");
    for(const node of [...root.querySelectorAll("*")]){
      const tag=node.localName.toLowerCase();
      if(["script","foreignobject","iframe","object","embed","audio","video"].includes(tag)){node.remove();continue;}
      for(const attr of [...node.attributes]){
        const name=attr.name.toLowerCase(), value=attr.value.trim();
        if(name.startsWith("on")||name==="srcdoc"){node.removeAttribute(attr.name);continue;}
        if(["href","xlink:href"].includes(name) && value && !value.startsWith("#") && !value.startsWith("data:image/")){
          node.removeAttribute(attr.name);continue;
        }
        if(name==="style" && /url\s*\(\s*['"]?(?!#|data:image\/)/i.test(value)) node.removeAttribute(attr.name);
      }
    }
    for(const node of [...root.querySelectorAll("style")]){
      if(/@import|url\s*\(\s*['"]?(?!#|data:image\/)/i.test(node.textContent||"")) node.remove();
    }
    if(!root.getAttribute("viewBox") && (!root.getAttribute("width") || !root.getAttribute("height"))) {
      throw new Error("렌더링 SVG의 페이지 크기 정보가 없습니다.");
    }
    return new XMLSerializer().serializeToString(root);
  }
  function showSvg(source){
    const safe=cleanSvg(source);
    const blob=new Blob([safe],{type:"image/svg+xml"});
    const url=URL.createObjectURL(blob);
    const img=document.createElement("img");
    img.alt=currentFile+" · "+(pageIndex+1)+"페이지";
    img.style.width="min(100%, "+Math.round(794*zoom)+"px)";
    img.onload=()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=url;};
    img.onerror=()=>{URL.revokeObjectURL(url);status.textContent="페이지 이미지를 표시하지 못했습니다.";};
    img.src=url;
    stage.replaceChildren(img);
    updateControls();
  }
  async function openFile(fileName,bytes){
    if(!window.doc2hwpxIeumOffice?.openViewer) throw new Error("HWP 뷰어 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
    if(!/\.(hwp|hwpx)$/i.test(fileName)) throw new Error("HWP 또는 HWPX 파일만 열 수 있습니다.");
    if(bytes.byteLength>50*1024*1024) throw new Error("파일당 50 MiB 제한을 초과했습니다.");
    setBusy(true);status.textContent="문서 열기 및 페이지 레이아웃 계산 중…";
    const reply=await window.doc2hwpxIeumOffice.openViewer(fileName,bytes);
    session=reply.session;pageCount=reply.pageCount;pageIndex=reply.pageIndex;currentFile=fileName;zoom=1;
    showSvg(reply.svg);
    status.textContent=currentFile+" · "+pageCount+"페이지 · rhwp WASM 직접 렌더링";
    setBusy(false);
  }
  async function render(index){
    if(!session||busy)return;
    if(index<0||index>=pageCount)return;
    setBusy(true);status.textContent=(index+1)+"페이지 렌더링 중…";
    try{
      const reply=await window.doc2hwpxIeumOffice.renderViewerPage(session,index);
      if(reply.session!==session)return;
      pageIndex=index;showSvg(reply.svg);
      status.textContent=currentFile+" · "+pageCount+"페이지 · "+(pageIndex+1)+"페이지 표시 중";
    }catch(error){status.textContent="페이지 렌더링 실패: "+error.message;}
    finally{setBusy(false);}
  }
  fileInput.addEventListener("change",async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    try{await openFile(file.name,await file.arrayBuffer());}
    catch(error){status.textContent="문서 열기 실패: "+error.message;stage.innerHTML='<div class="placeholder">문서를 열지 못했습니다.</div>';}
  });
  prev.addEventListener("click",()=>render(pageIndex-1));
  next.addEventListener("click",()=>render(pageIndex+1));
  pageInput.addEventListener("change",()=>{const n=Number(pageInput.value);if(Number.isInteger(n))render(n-1);});
  zoomOut.addEventListener("click",()=>{zoom=Math.max(.5,zoom-.1);zoomLabel.textContent=Math.round(zoom*100)+"%";const img=stage.querySelector("img");if(img)img.style.width="min(100%, "+Math.round(794*zoom)+"px)";updateControls();});
  zoomIn.addEventListener("click",()=>{zoom=Math.min(2,zoom+.1);zoomLabel.textContent=Math.round(zoom*100)+"%";const img=stage.querySelector("img");if(img)img.style.width="min(100%, "+Math.round(794*zoom)+"px)";updateControls();});
  fit.addEventListener("click",()=>{zoom=1;const img=stage.querySelector("img");if(img)img.style.width="min(100%, 794px)";updateControls();});
  window.addEventListener("doc2hwpx-open-viewer",async event=>{
    const detail=event.detail||{};
    if(detail.fileName&&detail.bytes){
      try{await openFile(detail.fileName,detail.bytes);}
      catch(error){status.textContent="변환 결과 미리보기 실패: "+error.message;}
    }
  });
  window.addEventListener("doc2hwpx-ieum-ready",()=>{if(!session)status.textContent="뷰어 엔진 준비 완료 · HWP/HWPX 파일을 열 수 있습니다.";});
  updateControls();
})();
