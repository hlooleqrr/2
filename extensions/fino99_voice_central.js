/* FINO99 additive voice permissions. Missing migration => OFF, never a substitute central. */
(function(window,document){
 'use strict';
 if(window.FINO99VoiceCentral)return;
 const FIELDS=[['enabled','السماح بالمساعد الاختياري'],['client_enabled','إتاحته للعميل بعد الدخول'],['owner_enabled','إتاحته للمالك'],['recognition_allowed','السماح بالتعرف الصوتي بعد موافقة المستخدم'],['synthesis_allowed','السماح بالقراءة الصوتية بعد موافقة المستخدم']];
 let settings=null,instance=null,lastSignature='',ownerButton=null,busy=false,stopped=false,timer=null;
 function ownerSession(){try{return activeAccess?.record?.owner===true&&activeAccess?.record?.central===true&&typeof finoCentralAdminToken==='string'&&!!finoCentralAdminToken&&window.F99V60Test?.owner()===true;}catch{return false;}}
 function entered(){try{return activeAccess?.record?.central===true&&activeAccess?.state?.expiresAt!==undefined&&Number.isFinite(activeAccess.state.expiresAt)&&activeAccess.state.expiresAt>Date.now();}catch{return false;}}
 function ownerHub(){const h=document.getElementById('ownerHub');return !!h&&!h.hidden&&h.classList.contains('active')&&ownerSession();}
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 async function call(name,args={},owner=false){
  const r=owner?await finoCentralAdminCall(name,args):await finoRpc(name,args);
  if(!r||r.ok!==true||r.data?.ok!==true)throw Error(r?.data?.reason||'VOICE_SETTINGS_UNAVAILABLE');
  return r.data;
 }
 function normalized(data){const s={revision:data.revision};for(const [key]of FIELDS)s[key]=data[key]===true;return s;}
 function reconcile(){
  if(stopped)return;
  const allowed=!!settings&&settings.enabled===true&&entered()&&(ownerSession()?settings.owner_enabled:settings.client_enabled);
  const sig=allowed?JSON.stringify([settings.revision,settings.recognition_allowed,settings.synthesis_allowed,ownerSession()]):'';
  if(sig!==lastSignature){instance?.destroy();instance=null;lastSignature=sig;if(allowed&&window.FINO99VoiceOptional)instance=window.FINO99VoiceOptional.mount({host:document.body,permissions:{recognition:settings.recognition_allowed,synthesis:settings.synthesis_allowed}});}
  const hub=document.getElementById('ownerHub');
  if(ownerHub()&&hub&&!ownerButton){ownerButton=node('button','إعداد المساعد الصوتي الاختياري');ownerButton.type='button';ownerButton.className='btn secondary';ownerButton.id='f99d1-owner-voice';ownerButton.addEventListener('click',event=>{if(event.isTrusted&&ownerHub())openSettings();});hub.appendChild(ownerButton);}
  if(ownerButton)ownerButton.hidden=!ownerHub();
 }
 let voiceFails=0;
 async function refresh(){
  if(stopped||busy)return;busy=true;
  try{settings=normalized(await call('f99d1_voice_public'));voiceFails=0;}catch{settings=null;voiceFails++;if(voiceFails>=2&&timer){window.clearInterval(timer);timer=null;}}finally{busy=false;reconcile();}
 }
 async function openSettings(){
  if(!ownerHub()||document.getElementById('f99d1-voice-dialog'))return;
  const dialog=node('dialog');dialog.id='f99d1-voice-dialog';dialog.dir='rtl';dialog.style.cssText='max-width:540px;width:calc(100% - 32px);padding:24px;border:1px solid #d5deec;border-radius:18px;color:#102348;background:#fff;';
  dialog.appendChild(node('h3','صلاحيات المساعد الاختياري'));
  dialog.appendChild(node('p','الإعدادات تحفظ في المركزية المصرّح بها. لا تتغير الأسعار أو الحسبات أو العقود أو الأكواد. إذن المتصفح وموافقة المستخدم يبقيان مطلوبين؛ لا تسجيل أو احتفاظ من الوحدة.'));
  const status=node('p','جارٍ قراءة الإعدادات…');status.setAttribute('role','status');dialog.appendChild(status);
  const controls=node('div');dialog.appendChild(controls);
  const save=node('button','حفظ الإعدادات يدويًا');save.type='button';save.disabled=true;save.className='btn';
  const close=node('button','إغلاق');close.type='button';close.className='btn secondary';dialog.appendChild(save);dialog.appendChild(close);
  const release=()=>{dialog.close();dialog.remove();ownerButton?.focus();};close.addEventListener('click',release);dialog.addEventListener('cancel',event=>{event.preventDefault();release();});
  document.body.appendChild(dialog);dialog.showModal();
  let current,inputs={};
  try{
   current=normalized(await call('f99d1_owner_voice_get',{},true));
   if(!ownerHub())throw Error('SESSION_CHANGED');
   for(const [key,label]of FIELDS){const line=node('label');line.style.cssText='display:flex;gap:10px;padding:10px 0;';const input=node('input');input.type='checkbox';input.checked=current[key];inputs[key]=input;line.appendChild(input);line.appendChild(node('span',label));controls.appendChild(line);}
   status.textContent='الصوت مغلق افتراضيًا؛ كل تغيير يتطلب هذا الحفظ اليدوي. الإصدار '+current.revision+'.';save.disabled=false;
  }catch{status.textContent='ترقية إعداد الصوت غير متاحة، أو انتهت صلاحية المالك. بقي الصوت مغلقًا؛ لم نحفظ أي إعداد.';}
  save.addEventListener('click',async event=>{
   if(!event.isTrusted||save.disabled||!ownerHub()||!current)return;
   save.disabled=true;status.textContent='جارٍ التحقق والحفظ…';
   const payload={p_expected_revision:current.revision};for(const[key]of FIELDS)payload['p_'+key]=inputs[key].checked;
   try{const result=normalized(await call('f99d1_owner_voice_save',payload,true));current=result;settings=result;status.textContent='تم الحفظ في المركزية الحالية. لا تعمل الميزة إلا بموافقة المستخدم وإذن المتصفح.';reconcile();}
   catch{status.textContent='لم يثبت الحفظ؛ قد تغير الإصدار أو الجلسة أو انقطع الرد. أغلق وأعد قراءة الحالة قبل المحاولة التالية.';return;}
   finally{if(dialog.isConnected)save.disabled=true;}
  });
 }
 let queued=false;
 const observer=new MutationObserver(()=>{if(queued||stopped)return;queued=true;window.setTimeout(()=>{queued=false;reconcile();},250);});
 function boot(){observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});refresh();timer=window.setInterval(()=>{if(!document.hidden)refresh();},120000);}
 window.addEventListener('pagehide',()=>{stopped=true;observer.disconnect();if(timer)window.clearInterval(timer);instance?.destroy();instance=null;settings=null;});
 window.FINO99VoiceCentral=Object.freeze({version:'1.0.0-staging',refresh});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);
