/* Round22 C: central owner identity, isolated beneficiary and original calculator. */
(function () {
  'use strict';
  const defs = [
    ['morning','الترحيب الصباحي والمسائي','ترحيب صباحي','صباح الخير يا {client}، حياك الله'],
    ['evening','الترحيب الصباحي والمسائي','ترحيب مسائي','مساء الخير يا {client}، حياك الله'],
    ['name','سؤال اسم العميل','طلب الاسم','اكتب اسمك الكريم'],
    ['name_error','سؤال اسم العميل','اسم غير مكتمل','اكتب اسمًا واضحًا من حرفين على الأقل.'],
    ['identity_error','سؤال اسم العميل','تعذر حفظ الهوية','تعذر حفظ الاسم في المركزية. حاول مجددًا.'],
    ['continue','سؤال اسم العميل','متابعة','متابعة'],
    ['cancel','الحسبة لنفسه أو لشخص آخر','رجوع','العودة للحسبة الحالية'],
    ['choose','الحسبة لنفسه أو لشخص آخر','لمن الحسبة','يا {client}، الحسبة لك أو لشخص ثاني؟'],
    ['self','الحسبة لنفسه أو لشخص آخر','لنفسي','لنفسي'],
    ['other','الحسبة لنفسه أو لشخص آخر','لشخص آخر','لشخص آخر'],
    ['beneficiary','الحسبة لنفسه أو لشخص آخر','اسم المستفيد','يا {client}، وش اسم الشخص اللي بنحسب له؟'],
    ['work','جهة العمل والبنك والراتب','جهة العمل','يا {client}، اذكر جهة عمل {beneficiary}.'],
    ['bank','جهة العمل والبنك والراتب','بنك الراتب','يا {client}، اختر البنك اللي ينزل عليه راتب {beneficiary}.'],
    ['salary','جهة العمل والبنك والراتب','راتب المستفيد','حياك الله يا {client}، كم راتب {beneficiary}؟'],
    ['settlement','جهة العمل والبنك والراتب','السداد المبكر','يا {client}، كم مبلغ السداد المبكر لتمويل {beneficiary}؟'],
    ['external','جهة العمل والبنك والراتب','الالتزامات','يا {client}، كم التزامات {beneficiary} الشهرية الأخرى؟'],
    ['saved','الحسبة لنفسه أو لشخص آخر','البيانات المحفوظة','يا {client}، بياناتك المحفوظة جاهزة، وتقدر تعدلها قبل اعتماد الحسبة.'],
    ['saved_use','الحسبة لنفسه أو لشخص آخر','اعتماد جهة العمل والبنك','متابعة بجهة العمل والبنك المحفوظين'],
    ['edit','الحسبة لنفسه أو لشخص آخر','تعديل البيانات','تعديل البيانات'],
    ['end','انتهاء الحسبة','انتهاء الحسبة مع رصيد','يا {client}، انتهت حسبتك. تقدر تراجع النتائج أو تبدأ حسبة جديدة.'],
    ['end_empty','انتهاء الحسبة','انتهاء الحسبة بلا رصيد','يا {client}، انتهت حسبتك. تقدر تراجع النتائج. استهلكت رصيد الحسبات المخصص للباقة.'],
    ['who','الهوية','صاحب الحسبة ومن أجراها (حسبة لشخص آخر)','صاحب الحسبة: {beneficiary_name} • أجرى الحسبة: {code_owner_name}'],
    ['balance','بداية حسبة جديدة','الرصيد والمدة','المتبقي {remaining} من {max} حسبات. صلاحية الكود حتى {expiry}.'],
    ['last','بداية حسبة جديدة','استخدام واحد متبقٍ','آخر حسبة'],
    ['new','بداية حسبة جديدة','بدء جديد','أبدأ حسبة جديدة'],
    ['review','انتهاء الحسبة','مراجعة النتائج','أراجع النتائج'],
    ['unknown','بداية حسبة جديدة','تعذر قراءة الرصيد','تعذر التحقق من الرصيد. يمكنك مراجعة النتائج، ولا تبدأ حسبة جديدة قبل التحقق.'],
    ['ask','ما بعد النتيجة','سؤال ما بعد النتيجة','يا {beneficiary}، ودّك تسأل عن شيء في الحسبة؟'],
    ['q_installment','ما بعد النتيجة','سؤال القسط','كم القسط؟'],
    ['q_cash','ما بعد النتيجة','سؤال الكاش','كم يصفّى لي كاش؟'],
    ['q_lower25','ما بعد النتيجة','طلب تقليل القسط','أبي أقلل قسطي.'],
    ['q_amount','ما بعد النتيجة','طلب تقليل مبلغ التمويل','أبي أقلل مبلغ التمويل.'],
    ['q_next_bank','ما بعد النتيجة','الجهة المرشحة التالية','الجهة المرشحة التالية'],
    ['q_back','ما بعد النتيجة','العودة لمبلغ التمويل السابق','العودة لمبلغ التمويل السابق'],
    ['q_cash_reduce','ما بعد النتيجة','تقليل مبلغ الكاش','أبي أقلل مبلغ الكاش.'],
    ['q_max','ما بعد النتيجة','الرجوع لأعلى تمويل','الرجوع لأعلى تمويل'],
    ['q_summary','ما بعد النتيجة','تلخيص الحسبة','تلخيص الحسبة'],
    ['q_compare','ما بعد النتيجة','مقارنة الترشيحات','مقارنة الترشيحات'],
    ['new25','ما بعد النتيجة','زر حسبة جديدة','ابدأ حسبة جديدة'],
    ['exit25','ما بعد النتيجة','زر الخروج','الخروج'],
    ['exhausted25','ما بعد النتيجة','انتهاء رصيد الحسبات','انتهى رصيد الحسبات لهذا الكود.'],
    ['exit_warn','الخروج من الحسبة','تحذير الخروج','تنبيه: إذا خرجت من هذه الحسبة، ما راح تقدر ترجع لمراجعة نفس النتيجة من المحادثة بعد الخروج. هل ترغب بالخروج؟'],
    ['exit_yes','الخروج من الحسبة','تأكيد الخروج','نعم، أعلم وأرغب بالخروج'],
    ['exit_back','الخروج من الحسبة','العودة للحسبة','العودة للحسبة']
  ];
  window.F99Texts?.register(defs.map(([k,category,label,text]) => ({key:'c22.'+k,category,label,text,vars:['client','beneficiary','code_owner_name','beneficiary_name','remaining','max','expiry']})));
  function T(k,v={}) { const d=defs.find(x=>x[0]===k); const fallback=d[3].replace(/\{(\w+)\}/g,(_,n)=>String(v[n]??''));return window.F99T('c22.'+k,v,fallback); }
  const clean=v=>typeof cleanClientName==='function'?cleanClientName(v):String(v||'').trim().slice(0,40);
  const e=()=>window.finoCentralRestoreEntry?.()||{};
  const ownerName=()=>clean(codeOwner||clientName);
  const vars=()=>({client:ownerName(),beneficiary:beneficiary||ownerName(),code_owner_name:ownerName(),beneficiary_name:beneficiary||ownerName()});
  const key=()=>String(e().code_id||e().codeId||'')+'|'+String(e().entryToken||'');
  let identityKey='', beneficiary='', saved={}, self=true, choosing=false, endId='', codeOwner='';
  const originalRpc=window.finoRpc;
  window.finoRpc=function(fn,args,...rest){if(fn==='fino_client_save_case'&&args?.p_input&&identityKey===key())args={...args,p_input:{...args.p_input,client_name:ownerName(),beneficiary_name:beneficiary||ownerName(),calculation_for:self?'self':'other'},p_event:args.p_event?{...args.p_event,code_owner_name:ownerName(),beneficiary_name:beneficiary||ownerName(),calculation_for:self?'self':'other'}:args.p_event};return originalRpc.call(this,fn,args,...rest);};
  // r24: show the beginning of a new message and let the customer scroll down himself.
  function scroll(node) { requestAnimationFrame(()=>{const c=document.getElementById('finoBotChat');if(!c||!node?.isConnected)return;c.scrollTo({top:Math.max(0,node.offsetTop-c.offsetTop-8),behavior:'smooth'});}); }
  const transient=r=>!r?.ok||/timeout|canceling statement|57014|lock|connection|fetch|network|50[023]/i.test(String(r?.data?.reason||r?.error||''));
  async function identity(name=null,data=null) { const entry=e(); let r=null;
    for(let n=0;n<3;n++){r=await window.finoRpc('f99r22_client_identity',{p_entry_token:entry.entryToken,p_device_id:entry.deviceId,p_name:name,p_self_data:data},14000);if(r?.ok&&r.data?.ok===true)return r.data;if(!transient(r))break;if(n<2)await new Promise(x=>setTimeout(x,n?1600:700));}
    throw Error('IDENTITY_UNAVAILABLE'); }
  function panel(title) { let m=document.getElementById('f99v21-name-panel');if(!m){m=document.createElement('div');m.id='f99v21-name-panel';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');document.body.append(m);}m.hidden=false;m.replaceChildren();const box=document.createElement('section');box.className='f21-card';const h=document.createElement('h2');h.textContent=title;box.append(h);m.append(box);return {m,box}; }
  function button(box,label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;box.append(b);return b;}
  function setPerson(other,name='') { const owner=ownerName();codeOwner=owner;self=!other;beneficiary=other?clean(name):'';clientName=other?beneficiary:owner;window.F99V50ActorState?.setActor(owner);window.F99V50ActorState?.setScenario(other?'أُدخلت بيانات الحسبة بواسطة '+owner+' لصالح '+beneficiary:'');window.__F99WelcomeBackPending=false;endId=''; }
  function personChooser(next,cancel) {
    if(choosing)return;choosing=true;
    const product=window.F99V32MainAccess?.()?.packageKey||window.fino99ActivePackage?.()?.key;
    const ask=window.F99Settings?.packageOption(product,'ask_beneficiary',true)!==false;
    if(!ask){setPerson(false);choosing=false;return next();}
    const {m,box}=panel(T('choose',vars()));
    button(box,T('self'),()=>{setPerson(false);m.hidden=true;choosing=false;next();});
    button(box,T('other'),()=>{box.replaceChildren();const h=document.createElement('h2');h.textContent=T('beneficiary',vars());box.append(h);const input=document.createElement('input');input.maxLength=40;input.autocomplete='off';input.setAttribute('aria-label',T('beneficiary',vars()));box.append(input);const error=document.createElement('p');error.setAttribute('role','status');box.append(error);const submit=()=>{if(clean(input.value).length<2){error.textContent=T('name_error');return;}setPerson(true,input.value);m.hidden=true;choosing=false;next();};button(box,T('continue'),submit);input.onkeydown=x=>{if(x.key==='Enter')submit();};input.focus();});
    button(box,T('cancel'),()=>{m.hidden=true;choosing=false;window.__F99V85KeepConversation=false;window.__F99V82LastUseConsent=false;cancel?.();});
  }
  window.F99R22PersonChooser=personChooser;
  window.F99V21WelcomeBot=async function(service,launch) {
    if(!activeAccess?.record?.central||activeAccess.record.owner)return launch();
    await window.F99Settings?.ready;
    try {
      const known=await identity();clientName=clean(known.client_name);codeOwner=clientName;saved=known.self_data||{};identityKey=key();window.F99V50ActorState?.setActor(clientName);window.F99V50ActorState?.setScenario('');
      const attempt=f99QuotaUnresolved.get(JSON.stringify([String(e().entryToken),String(e().deviceId)]));
      if(clientName&&attempt?.intent){try{const pending=JSON.parse(attempt.intent),basis=String(pending.basis||'').split('|');if(basis.length===5&&basis[0]===e().entryToken){saved={salary:Number(basis[1]),settlement:Number(basis[2]),bankId:basis[3],customerType:basis[4],external:Number(pending.externalObligations||0)};setPerson(false);window.F99R22RecoveringQuota=true;return launch();}}catch(_){} }
      if(clientName)return personChooser(launch);
      const {m,box}=panel(T('name'));const input=document.createElement('input');input.maxLength=40;input.autocomplete='given-name';input.setAttribute('aria-label',T('name'));box.append(input);const error=document.createElement('p');error.setAttribute('role','status');box.append(error);
      const b=button(box,T('continue'),async()=>{const n=clean(input.value);if(n.length<2){error.textContent=T('name_error');return;}b.disabled=true;try{const r=await identity(n);clientName=clean(r.client_name);codeOwner=clientName;saved=r.self_data||{};setPerson(false);m.hidden=true;launch();}catch(_){error.textContent=T('identity_error');}finally{b.disabled=false;}});input.onkeydown=x=>{if(x.key==='Enter')b.click();};input.focus();
    }catch(_){const {box}=panel(T('identity_error'));button(box,T('continue'),()=>window.F99V21WelcomeBot(service,launch));}
  };
  window.F99SaudiWelcomeLine=function(name){return T(window.F99SaudiGreetingWord()==='صباح الخير'?'morning':'evening',{client:clean(name)});};
  // No repeated greeting on a new calculation. The existing entry guard is authoritative.
  window.portalOpenGreeting=function(){window.__F99WelcomeBackPending=false;if(window.F99GreetOnce())return window.portalAssistant(window.F99SaudiWelcomeLine(clientName));};
  const assistant=window.portalAssistant;
  window.portalAssistant=function(html){
    let text=String(html??'');const step=typeof finoPortal==='undefined'?'':finoPortal.step;
    if(!self&&beneficiary){const plain=text.replace(/<[^>]*>/g,'').trim();let k='';
      if(step==='buyout_type'&&/جهة عمل/.test(plain)&&!text.includes('<button'))k='work';
      if(step==='buyout_bank'&&/البنك.*راتب/.test(plain))k='bank';
      if(step==='buyout_salary'&&/الراتب الشهري/.test(plain))k='salary';
      if(step==='buyout_settlement'&&/السداد المبكر/.test(plain))k='settlement';
      if(step==='buyout_external'&&/التزامات/.test(plain))k='external';
      if(k){const grid=k==='bank'?text.slice(text.indexOf('<')):'';text=portalEsc(T(k,vars()))+(grid&&grid!=='>'?grid:'');}
    }
    return assistant.call(this,text);
  };
  const setInput=window.setPortalInput;
  window.setPortalInput=function(...args){const out=setInput.apply(this,args);if(self&&args[0]){const fields={buyout_salary:'salary',buyout_settlement:'settlement',buyout_external:'external'};const f=fields[finoPortal?.step];const input=document.getElementById('finoBotInput');if(f&&saved[f]!=null&&input)input.value=String(saved[f]);}return out;};
  const start=window.startFINOPortalBuyout;
  window.startFINOPortalBuyout=function(...args){const out=start.apply(this,args);if(self&&saved.customerType&&saved.bankId&&finoPortal?.step==='buyout_type'){
    const chat=document.getElementById('finoBotChat'), row=document.createElement('div');row.className='portal-note';const p=document.createElement('p');p.textContent=T('saved',vars());row.append(p);
    button(row,T('saved_use'),()=>{row.remove();window.chooseFINOPortalType(saved.customerType);window.chooseFINOPortalBank(saved.bankId);});button(row,T('edit'),()=>row.remove());chat?.append(row);scroll(row);
  }return out;};
  const saveCase=window.finoCentralSaveCase;
  window.finoCentralSaveCase=function(event,...args){if(event?.type==='buyout-calculation'&&self&&identityKey===key()){saved=JSON.parse(JSON.stringify(finoPortal.data||{}));void identity(null,saved).catch(()=>{});}return saveCase.call(this,event,...args);};
  async function status(){const entry=e();const r=await window.finoRpc('f99v23_client_status',{p_entry_token:entry.entryToken,p_device_id:entry.deviceId},14000);if(!r?.ok||r.data?.ok!==true)throw Error('STATUS_UNAVAILABLE');return r.data;}
  function review(){const n=document.querySelector('#finoBotChat .portal-result');n?.scrollIntoView({block:'start',behavior:'smooth'});}
  async function end(force=false){
    const chat=document.getElementById('finoBotChat');if(!chat||finoPortal?.step!=='buyout_result')return;
    const s=await status();const id=key()+'|'+s.calculations_used+'|'+(window.__F99V86Usage?.used??'');if(!force&&endId===id)return;endId=id;
    chat.querySelectorAll('[data-c22-end]').forEach(n=>n.remove());const row=document.createElement('div');row.className='f49-message f82-end-actions';row.dataset.c22End='1';const p=document.createElement('p');const max=Number(s.max_calculations),remaining=s.calculations_remaining===null?null:Number(s.calculations_remaining),has=max===0||remaining>0;
    if(!self&&beneficiary){const who=document.createElement('p');who.className='f99c22-who';who.textContent=T('who',vars());row.append(who);}
    p.textContent=T(has?'end':'end_empty',vars());row.append(p);
    if(max>0){const q=document.createElement('p');const expiry=s.code?.expires_at||s.expires_at||e().expires_at;const date=expiry?new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'short',timeStyle:'short'}).format(new Date(expiry)):'—';q.textContent=T('balance',{...vars(),max,remaining,expiry:date})+(remaining===1?' '+T('last'):'');row.append(q);}
    if(has)button(row,T('new'),()=>window.F99V82RequestNewCalculation());button(row,T('review'),review);chat.append(row);scroll(row);
  }
  // r24: the end panel is no longer appended automatically after the result card.
  const finish=window.F99V82FinishReview;
  window.F99V82FinishReview=function(...args){const r=finish.apply(this,args);/* r24: the offer is reached only via «نعم» */[...document.querySelectorAll('#finoBotChat button')].forEach(b=>{if(/عندك عرض للمتابعة$/.test(b.textContent||''))b.remove();});void status().then(s=>{const row=[...document.querySelectorAll('#finoBotChat .f82-end-actions')].at(-1);if(!row)return;const left=Number(s.calculations_remaining??s.remaining),max=Number(s.max_calculations);const h=row.querySelector('strong');if(h)h.textContent=T(max===0||left>0?'end':'end_empty',vars());row.querySelectorAll('button').forEach(b=>{if(b.textContent==='أبدأ حسبة جديدة'&&max>0&&left<=0)b.remove();});scroll(row);
    /* r24: calculations exhausted -> the approved renewal invitation card, once, inside the conversation */if(max>0&&left<=0&&Number.isFinite(left)&&typeof window.F99Renewal22?.openCurrent==='function'&&!document.querySelector('#finoBotChat .f99r22-renewal'))void window.F99Renewal22.openCurrent();}).catch(()=>{});return r;};
  // r24: saved-history review is paused in the customer UI (records stay on the server).
  const request0=window.F99V82RequestNewCalculation;if(typeof request0==='function')window.F99V82RequestNewCalculation=async function(...a){const r=await request0.apply(this,a);document.querySelectorAll('#finoBotChat .f82-end-actions button').forEach(b=>{if(b.textContent==='أراجع الحسب السابقة')b.remove();});return r;};
  // r24: no MutationObserver auto-scroll to the bottom of the conversation.
  // Post-result questions (owner order 2026-11-17): the ORIGINAL answer functions on the saved result only.
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=k=>window.F99V38FeatureAllowed?.(k)===true;
  const btnHtml=(label,act,cls='')=>`<button type="button"${cls?` class="${cls}"`:''} onclick="${act}">${esc(label)}</button>`;
  // r24: a question already answered for this result is not offered again (no duplicate buttons).
  const answered=new WeakMap();const bag=i=>{const r=typeof latestResults!=='undefined'&&latestResults?latestResults:null;if(!r)return new Set();let m=answered.get(r);if(!m){m=new Map();answered.set(r,m);}if(!m.has(i))m.set(i,new Set());return m.get(i);};
  const ask0=window.F99V41Ask;if(typeof ask0==='function')window.F99V41Ask=function(key,i){bag(Number(i)).add(String(key));return ask0.apply(this,arguments);};
  // r25 (owner order Pasted_23 §2,§3,§7,§8): reduction state, balance-gated «ابدأ حسبة جديدة», exit sequence.
  let reduced=false,newSeq=0,lastHas=null,exiting=false;
  const apply25=window.F99V37ApplyBotAdjustment;if(typeof apply25==='function')window.F99V37ApplyBotAdjustment=async function(...a){const r=await apply25.apply(this,a);if(r?.ok===true)reduced=true;return r;};
  const reset25=window.F99V37ResetBotAdjustment;if(typeof reset25==='function')window.F99V37ResetBotAdjustment=async function(...a){const r=await reset25.apply(this,a);if(r)reduced=false;return r;};
  const request25=window.F99V82RequestNewCalculation;if(typeof request25==='function')window.F99V82RequestNewCalculation=function(...a){reduced=false;return request25.apply(this,a);};
  function paintNew(has){const all=[...document.querySelectorAll('#finoBotChat .f25-menu')];all.forEach((menu,n)=>{const last=n===all.length-1;const b=menu.querySelector('[data-r25-new]');if(b)b.hidden=!(has===true&&last);const note=menu.querySelector('.f25-exhausted');if(note){note.hidden=!(has===false&&last);note.textContent=has===false?T('exhausted25'):'';}
    // r26 §3: an exhausted code offers no question, adjustment or comparison — renewal/exit only.
    if(has===false)menu.querySelectorAll('[data-r25-opt]').forEach(x=>{x.hidden=true;x.disabled=true;});});
    // exhausted: no old/new start buttons stay usable in this conversation (server enforcement is authoritative)
    if(has===false)document.querySelectorAll('#finoBotChat button').forEach(b=>{const a=b.getAttribute('onclick')||'';if(/F99V82RequestNewCalculation|startFINOPortalBuyout/.test(a)||b.textContent.trim()===T('new')){b.disabled=true;b.hidden=true;}});}
  async function refreshNew(tries=0){const id=++newSeq;if(!document.querySelector('#finoBotChat .f25-menu')){if(tries<6)setTimeout(()=>{if(id===newSeq)void refreshNew(tries+1);},tries<2?300:900);return;}
    let s=null;try{s=await status();}catch(_){return;}if(id!==newSeq)return;
    const max=Number(s.max_calculations),left=s.calculations_remaining===null||s.calculations_remaining===undefined?null:Number(s.calculations_remaining);
    lastHas=max===0||(Number.isFinite(left)&&left>0);paintNew(lastHas);}
  function leave(){window.__F99V85KeepConversation=false;window.__F99V82LastUseConsent=false;
    // Close THIS conversation only: no consumption, no code invalidation, server records untouched.
    try{if(typeof finoPortal!=='undefined')finoPortal.step='f24_exit';}catch(_){}
    if(typeof window.F99V41LeaveNow==='function')window.F99V41LeaveNow();else window.FINOPortalBack?.();}
  async function rating(){const open=window.F99O3OpenFeedback;if(typeof open!=='function')return;
    let pkg='';try{const x=activeAccess?.record?.centralData||{};pkg=String(x?.config?.f99x?.effective_package_key||x?.config?.f99x?.store_package_key||x?.store_package_key||'');}catch(_){}
    if(!pkg||!e().entryToken)return;const prev=document.querySelector('.o3-overlay');
    try{await open();}catch(_){return;}
    const box=[...document.querySelectorAll('.o3-overlay')].find(n=>n!==prev&&n.querySelector('.o3-feedback'));if(!box)return;
    await new Promise(res=>{const mo=new MutationObserver(()=>{if(!box.isConnected){mo.disconnect();res();}});mo.observe(document.body,{childList:true});});}
  async function exitFlow(){if(exiting)return;exiting=true;document.querySelectorAll('#finoBotChat .f25-menu button').forEach(b=>{b.disabled=true;});
    // 1) follow-up offer: once, only if enabled by the owner for this package and the customer is eligible.
    if(allowed('show_completion')&&window.F99Followup22?.invitation)await new Promise(res=>{window.__F99R25FollowupDone=()=>{window.__F99R25FollowupDone=null;res();};
      Promise.resolve().then(()=>window.F99Followup22.invitation()).then(ok=>{if(!ok){window.__F99R25FollowupDone=null;res();}},()=>{window.__F99R25FollowupDone=null;res();});});
    // 2) renewal: only when the calculations are exhausted. Choosing to renew stays in the renewal path (no rating).
    let s=null;try{s=await status();}catch(_){}
    const max=Number(s?.max_calculations),left=s?.calculations_remaining==null?NaN:Number(s.calculations_remaining);
    if(s&&max>0&&Number.isFinite(left)&&left<=0&&typeof window.F99Renewal22?.openCurrent==='function'){
      const r=await new Promise(res=>{Promise.resolve().then(()=>window.F99Renewal22.openCurrent({exit:true,onLater:()=>res('later')})).then(opened=>{if(!opened)res('none');},()=>res('none'));});void r;}
    // 3) rating, only if the owner enabled it; 4) home.
    try{await rating();}catch(_){}
    exiting=false;leave();}
  const originalMenu=window.F99V38BotStepsHtml;
  if(typeof originalMenu==='function')window.F99V38BotStepsHtml=function(...args){
    const html=originalMenu.apply(this,args);const m=/F99V41Ask\('installment',(\d+)\)/.exec(String(html||''));if(!m)return html;const i=Number(m[1]);
    // r25 (owner order Pasted_23 §2-§3): exactly the approved questions under the original result card,
    // then «ابدأ حسبة جديدة» (only with remaining balance/validity) and «الخروج». No «الخيارات اللي بعدها».
    // r26 (owner order Pasted_25 §1): every approved option returns, each gated by its OWN package/code switch.
    const used=bag(i),q=[],opt=(label,code)=>q.push(btnHtml(label,code).replace('<button','<button data-r25-opt="1"'));
    if(!used.has('installment'))opt(T('q_installment'),`F99V41Ask('installment',${i})`);
    if(!used.has('cash'))opt(T('q_cash'),`F99V41Ask('cash',${i})`);
    if(allowed('reduce_installment'))opt(T('q_lower25'),"F99V37BeginAdjust('installment')");
    if(allowed('reduce_amount'))opt(T('q_amount'),"F99V37BeginAdjust('principal')");
    if(allowed('reduce_amount'))opt(T('q_cash_reduce'),"F99V37BeginAdjust('cash')");
    if(window.F99V38HasNextBank?.()===true)opt(T('q_next_bank'),'F99V38NextBank()');
    if(allowed('reduce_installment')||allowed('reduce_amount'))opt(T('q_max'),'F99V37Reset()');
    if(window.F99V38MenuReady?.(i,'summary')===true)opt(T('q_summary'),`F99V38ShowSummary(${i})`);
    if(window.F99V38MenuReady?.(i,'compare')===true)opt(T('q_compare'),'F99V38ComparePicker()');
    if(reduced&&(allowed('reduce_installment')||allowed('reduce_amount')))opt(T('q_back'),'F99V47ResetFinance()');
    setTimeout(()=>{void refreshNew();},0);
    return `<div class="f41-options f47-main-options f49-menu f24-menu f25-menu"><p class="f24-ask">${esc(T('ask',vars()))}</p><div class="f24-questions">${q.join('')}</div><p class="f25-exhausted"${lastHas===false?'':' hidden'}>${lastHas===false?esc(T('exhausted25')):''}</p><div class="f24-yes-no f25-end"><button type="button" class="f41-primary" data-r25-new${lastHas===true?'':' hidden'} onclick="F99V82RequestNewCalculation()">${esc(T('new25'))}</button>${btnHtml(T('exit25'),'F99R24Exit()')}</div></div>`;
  };
  window.F99R24Next=async function(){
    document.getElementById('f24-exit-warning')?.remove();
    let shown=false;
    if(allowed('show_completion')&&window.F99Followup22?.invitation){try{shown=await window.F99Followup22.invitation();}catch(_){shown=false;}}
    if(!shown)window.F99V82FinishReview?.();
  };
  window.F99R24Exit=function(){
    const chat=document.getElementById('finoBotChat');if(!chat)return;document.getElementById('f24-exit-warning')?.remove();
    const box=document.createElement('div');box.id='f24-exit-warning';box.className='f24-exit-warning';box.setAttribute('role','alertdialog');
    const p=document.createElement('p');p.textContent=T('exit_warn');box.append(p);const row=document.createElement('div');row.className='f24-yes-no';box.append(row);
    button(row,T('exit_yes'),()=>{box.remove();void exitFlow();}).className='f24-danger';
    // r26 §3: no «العودة للحسبة» path once the balance is finished.
    if(lastHas!==false)button(row,T('exit_back'),()=>box.remove());
    chat.append(box);scroll(box);
  };
  window.F99R22Identity=Object.freeze({owner:()=>ownerName(),beneficiary:()=>beneficiary,self:()=>self,saved:()=>JSON.parse(JSON.stringify(saved))});
})();
