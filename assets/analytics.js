/* Haru tools: GA4 loads only after explicit visitor consent. No form values are transmitted. */
(function () {
 'use strict';
 const id=String(window.HARU_ANALYTICS_CONFIG?.measurementId||'').trim();
 if(!/^G-[A-Z0-9]{6,20}$/.test(id)||navigator.globalPrivacyControl===true)return;
 const KEY='haru.analytics.consent.v1';
 let choice;try{choice=localStorage.getItem(KEY)}catch(_){choice=null}
 let loaded=false,pending=null;const recent=new Map();
 const log=(name,params)=>{if(choice==='accepted'&&loaded&&typeof window.gtag==='function')window.gtag('event',name,params)};
 const cleanRef=()=>{try{const u=new URL(document.referrer);return u.origin===location.origin?u.origin+u.pathname:u.origin+'/'}catch(_){return ''}};
 function start(){
   if(loaded||choice!=='accepted')return;
   loaded=true;
   window.dataLayer=window.dataLayer||[];
   window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
   window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   window.gtag('consent','update',{analytics_storage:'granted'});
   window.gtag('js',new Date());
   window.gtag('config',id,{send_page_view:false,anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname,page_referrer:cleanRef(),cookie_flags:'SameSite=Lax;Secure'});
   const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(s);
   log('page_view',{page_title:document.title,page_location:location.origin+location.pathname,page_path:location.pathname,page_referrer:cleanRef()});
 }
 function eraseCookies(){
   document.cookie.split(';').forEach(p=>{
     const n=p.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(n))return;
     document.cookie=n+'=; Max-Age=0; path=/; SameSite=Lax; Secure';
     document.cookie=n+'=; Max-Age=0; path=/; domain='+location.hostname+'; SameSite=Lax; Secure';
   });
 }
 function decide(value){
   const wasLoaded=loaded;choice=value;try{localStorage.setItem(KEY,value)}catch(_){}
   document.getElementById('haru-consent-banner')?.remove();
   if(value==='accepted')start();else{
     if(loaded)window.gtag?.('consent','update',{analytics_storage:'denied'});
     eraseCookies();if(wasLoaded)location.reload();
   }
 }
 function banner(){
   if(document.getElementById('haru-consent-banner'))return;
   const b=document.createElement('section');b.id='haru-consent-banner';b.className='haru-consent-banner';b.setAttribute('aria-label','방문 통계 설정');
   const p=document.createElement('p');p.textContent='방문자 수, 페이지 조회, 도구 사용 횟수의 통계 수집에 동의하시겠습니까? 계산기 입력값과 프롬프트 내용은 직접 전송하지 않습니다. 거부해도 모든 도구를 사용할 수 있습니다.';
   const a=document.createElement('div');a.className='haru-consent-actions';
   const no=document.createElement('button');no.type='button';no.className='haru-consent-reject';no.textContent='거부';no.addEventListener('click',()=>decide('declined'));
   const yes=document.createElement('button');yes.type='button';yes.className='haru-consent-accept';yes.textContent='동의';yes.addEventListener('click',()=>decide('accepted'));
   const link=document.createElement('a');link.href='/privacy.html';link.textContent='개인정보처리방침';
   a.append(no,yes,link);b.append(p,a);document.body.appendChild(b);
 }
 function used(tool,action,valid=()=>true){
   if(choice!=='accepted'||!loaded||!tool||!valid())return;
   const k=tool+':'+action,now=Date.now();
   if(now-(recent.get(k)||0)<2500)return;recent.set(k,now);
   log('tool_use',{tool_name:tool,tool_action:action,page_path:location.pathname});
 }
 function onInput(event){
   const p=event.target.closest?.('[data-kind],form[data-tool]');if(!p)return;
   const tool=p.dataset.kind||p.dataset.tool;if(!/^[a-z][a-z0-9-]{0,40}$/.test(tool))return;
   clearTimeout(pending);pending=setTimeout(()=>{
     const ok=p.dataset.kind?()=>{
       const s=document.getElementById('result')?.textContent||'';
       return s!==''&&!/^(계산 중|모든 입력|입력 범위|유효한|용량은|휴게시간이|총액과|날짜를|숫자와)/.test(s);
     }:()=>p.querySelector('[data-output]')?.dataset.valid==='true';
     used(tool,'calculate',ok);
   },1100);
 }
 function init(){
   const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/analytics.css';document.head.append(css);
   const footer=document.querySelector('.foot .wrap, .cv-footer-inner');
   if(footer){const btn=document.createElement('button');btn.type='button';btn.className='haru-consent-settings';btn.textContent='방문 통계 설정';btn.addEventListener('click',banner);footer.appendChild(btn)}
   if(choice==='accepted')start();else if(choice!=='declined')banner();
   document.addEventListener('input',onInput);document.addEventListener('change',onInput);
   document.addEventListener('click',event=>{
     const b=event.target.closest?.('button');if(!b||b.disabled)return;
     if(b.id==='pb-copy')used('prompt-builder','copy_click');
     if(b.id==='pb-download')used('prompt-builder','download_click');
     if(b.type==='submit'&&b.closest('form[data-tool]'))onInput({target:b.closest('form[data-tool]')});
   });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
