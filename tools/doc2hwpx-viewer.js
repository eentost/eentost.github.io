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
  let session = 0, pageCount = 0, pageIndex = 0, zoom = 1, currentFile = "", fitMode = true;
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
    img.style.width=Math.round(794*zoom)+"px";img.style.maxWidth="100%";
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
    session=reply.session;pageCount=reply.pageCount;pageIndex=reply.pageIndex;currentFile=fileName;fitMode=true;fitToWidth();
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
  function applyZoom(){
    const img=stage.querySelector("img");
    if(img){img.style.width=Math.round(794*zoom)+"px";img.style.maxWidth="100%";}
    updateControls();
  }
  function fitToWidth(){
    const available=Math.max(320,stage.clientWidth-48);
    zoom=Math.min(1.5,Math.max(.5,available/794));
    applyZoom();
  }
  zoomOut.addEventListener("click",()=>{fitMode=false;zoom=Math.max(.5,zoom-.1);applyZoom();});
  zoomIn.addEventListener("click",()=>{fitMode=false;zoom=Math.min(2,zoom+.1);applyZoom();});
  fit.addEventListener("click",()=>{fitMode=true;fitToWidth();});
  if(typeof ResizeObserver!=="undefined"){
    const resizeObserver=new ResizeObserver(()=>{if(fitMode&&session)fitToWidth();});
    resizeObserver.observe(stage);
  }
  window.addEventListener("doc2hwpx-open-viewer",async event=>{
    const detail=event.detail||{};
    if(detail.fileName&&detail.bytes){
      try{await openFile(detail.fileName,detail.bytes);}
      catch(error){status.textContent="변환 결과 미리보기 실패: "+error.message;}
    }
  });
  window.addEventListener("doc2hwpx-ieum-ready",()=>{if(!session)status.textContent="뷰어 엔진 준비 완료 · HWP/HWPX 파일을 열 수 있습니다.";});

  // Source connectors: local files, local folders, drag-and-drop, CORS-enabled URLs and Google Drive Picker.
  const localInput=$("nativeSourceLocal"), folderInput=$("nativeSourceFolder");
  const folderBox=$("nativeSourceFolderBox"), folderSelect=$("nativeSourceFolderSelect");
  const urlToggle=$("nativeSourceUrlToggle"), urlBox=$("nativeSourceUrlBox");
  const urlInput=$("nativeSourceUrl"), urlOpen=$("nativeSourceUrlOpen");
  const driveButton=$("nativeSourceDrive"), driveSetup=$("nativeDriveSetup");
  const driveClientId=$("nativeDriveClientId"), driveApiKey=$("nativeDriveApiKey"), driveAppId=$("nativeDriveAppId");
  const driveState=$("nativeDriveState");
  let folderFiles=[];
  const DRIVE_CONFIG_KEY="doc2hwpx.google-drive.config.v1";
  function readDriveConfig(){
    try{return JSON.parse(localStorage.getItem(DRIVE_CONFIG_KEY)||"{}");}catch{return {};}
  }
  function saveDriveConfig(){
    const config={clientId:driveClientId.value.trim(),apiKey:driveApiKey.value.trim(),appId:driveAppId.value.trim()};
    if(!config.clientId||!config.apiKey)throw new Error("OAuth Client ID와 Google API Key를 입력하세요.");
    localStorage.setItem(DRIVE_CONFIG_KEY,JSON.stringify(config));
    driveState.textContent="설정 저장됨 · 연결 버튼을 눌러 Google 계정 권한을 승인하세요.";
    return config;
  }
  const savedDrive=readDriveConfig();
  driveClientId.value=savedDrive.clientId||"";
  driveApiKey.value=savedDrive.apiKey||"";
  driveAppId.value=savedDrive.appId||"";
  function loadScript(src,id){
    return new Promise((resolve,reject)=>{
      if(document.getElementById(id)){resolve();return;}
      const script=document.createElement("script");script.id=id;script.src=src;script.async=true;
      script.onload=resolve;script.onerror=()=>reject(new Error("Google 연결 라이브러리를 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
  }
  async function openLocal(file){
    if(!file)return;
    try{status.textContent="로컬 문서를 여는 중…";await openFile(file.name,await file.arrayBuffer());}
    catch(error){status.textContent="문서 열기 실패: "+error.message;}
  }
  if(localInput)localInput.addEventListener("change",()=>openLocal(localInput.files?.[0]));
  if(folderInput)folderInput.addEventListener("change",()=>{
    folderFiles=Array.from(folderInput.files||[]).filter(f=>/\.(hwp|hwpx)$/i.test(f.name));
    folderSelect.replaceChildren();
    folderFiles.forEach((file,index)=>{
      const option=document.createElement("option");option.value=String(index);
      option.textContent=(file.webkitRelativePath||file.name)+" · "+(file.size/1048576).toFixed(2)+" MiB";
      folderSelect.appendChild(option);
    });
    folderBox.hidden=folderFiles.length===0;
    if(folderFiles.length){status.textContent="폴더에서 HWP/HWPX "+folderFiles.length+"개를 찾았습니다. 목록에서 열 문서를 선택하세요.";}
    else status.textContent="선택한 폴더에서 HWP/HWPX 파일을 찾지 못했습니다.";
  });
  if(folderSelect)folderSelect.addEventListener("change",()=>openLocal(folderFiles[Number(folderSelect.value)]));
  if(urlToggle)urlToggle.addEventListener("click",()=>{urlBox.hidden=!urlBox.hidden;});
  if(urlOpen)urlOpen.addEventListener("click",async()=>{
    const url=urlInput.value.trim();
    try{
      const parsed=new URL(url);
      if(parsed.protocol!=="https:")throw new Error("문서 URL은 HTTPS 주소만 허용합니다.");
      if(!/\.(hwp|hwpx)(?:$|[?#])/i.test(parsed.pathname+parsed.search))throw new Error("URL 경로가 .hwp 또는 .hwpx 파일인지 확인하세요.");
      status.textContent="URL에서 문서를 가져오는 중…";
      const response=await fetch(parsed.href,{mode:"cors",credentials:"omit"});
      if(!response.ok)throw new Error("문서 서버 응답: HTTP "+response.status);
      const blob=await response.blob();
      const name=decodeURIComponent(parsed.pathname.split("/").pop()||"remote.hwpx");
      await openFile(name,await blob.arrayBuffer());
    }catch(error){
      status.textContent="URL 열기 실패: "+error.message+" · 원격 서버가 CORS를 허용해야 합니다.";
    }
  });
  if(driveButton)driveButton.addEventListener("click",()=>{driveSetup.hidden=!driveSetup.hidden;});
  const saveDrive=$("nativeDriveSave"),connectDrive=$("nativeDriveConnect"),disconnectDrive=$("nativeDriveDisconnect");
  if(saveDrive)saveDrive.addEventListener("click",()=>{
    try{saveDriveConfig();}catch(error){driveState.textContent=error.message;}
  });
  if(disconnectDrive)disconnectDrive.addEventListener("click",()=>{
    if(window.googleDriveTokenClient)window.googleDriveTokenClient=null;
    driveState.textContent="이 페이지의 Google 연결 상태를 초기화했습니다. 이미 발급된 토큰은 만료되거나 Google 계정 권한 페이지에서 취소할 수 있습니다.";
  });
  async function openDrivePicker(){
    let config;
    try{config=saveDriveConfig();}catch(error){driveState.textContent=error.message;return;}
    try{
      driveState.textContent="Google 연결 라이브러리를 준비 중…";
      await loadScript("https://accounts.google.com/gsi/client","google-identity-services");
      await loadScript("https://apis.google.com/js/api.js","google-api-client");
      await new Promise((resolve,reject)=>window.gapi.load("picker",{callback:resolve,onerror:()=>reject(new Error("Google Picker API를 불러오지 못했습니다."))}));
      if(!window.google?.accounts?.oauth2||!window.google?.picker)throw new Error("Google OAuth 또는 Picker API를 사용할 수 없습니다.");
      const tokenClient=window.google.accounts.oauth2.initTokenClient({
        client_id:config.clientId,
        scope:"https://www.googleapis.com/auth/drive.readonly",
        callback:async tokenResponse=>{
          if(tokenResponse.error){driveState.textContent="Google 승인 실패: "+tokenResponse.error;return;}
          const token=tokenResponse.access_token;
          driveState.textContent="Google Drive 파일 선택 창을 여는 중…";
          const view=new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
            .setIncludeFolders(false)
            .setMimeTypes("application/vnd.hancom.hwp,application/vnd.hancom.hwpx,application/octet-stream");
          const pickerBuilder=new window.google.picker.PickerBuilder()
            .setDeveloperKey(config.apiKey)
            .setOAuthToken(token)
            .setTitle("미리 볼 HWP/HWPX 파일 선택")
            .addView(view)
            .setCallback(async data=>{
              if(data.action===window.google.picker.Action.PICKED){
                const doc=data.docs?.[0];if(!doc)return;
                try{
                  driveState.textContent=doc.name+" 다운로드 중…";
                  const response=await fetch("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(doc.id)+"?alt=media",{headers:{Authorization:"Bearer "+token}});
                  if(!response.ok)throw new Error("Google Drive 다운로드 실패: HTTP "+response.status);
                  const bytes=await response.arrayBuffer();
                  await openFile(doc.name,bytes);
                  driveState.textContent="Google Drive에서 문서를 열었습니다: "+doc.name;
                }catch(error){driveState.textContent="Drive 파일 열기 실패: "+error.message;}
              }else if(data.action===window.google.picker.Action.CANCEL){driveState.textContent="파일 선택을 취소했습니다.";}
            });
          if(config.appId)pickerBuilder.setAppId(config.appId);
          if(window.google.picker.Feature?.SUPPORT_DRIVES)pickerBuilder.enableFeature(window.google.picker.Feature.SUPPORT_DRIVES);
          const picker=pickerBuilder.build();
          picker.setVisible(true);
        }
      });
      window.googleDriveTokenClient=tokenClient;
      tokenClient.requestAccessToken({prompt:"consent"});
    }catch(error){driveState.textContent="Google Drive 연결 실패: "+error.message;}
  }
  if(connectDrive)connectDrive.addEventListener("click",openDrivePicker);
  stage.addEventListener("dragover",event=>{event.preventDefault();stage.classList.add("drag-over");});
  stage.addEventListener("dragleave",()=>stage.classList.remove("drag-over"));
  stage.addEventListener("drop",event=>{
    event.preventDefault();stage.classList.remove("drag-over");
    const file=Array.from(event.dataTransfer?.files||[]).find(f=>/\.(hwp|hwpx)$/i.test(f.name));
    if(file)openLocal(file);else status.textContent="HWP 또는 HWPX 파일을 끌어 놓으세요.";
  });

  updateControls();
})();
