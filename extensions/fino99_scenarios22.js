/* FINO99 R22-D. Saved paid scenarios, not a second calculator.
 * Financial changes call ONLY F99V37ApplyBotAdjustment / calculate from index.html.
 * Cards/images/sharing call the original showFINOPortalRank and its original controls.
 * The first card is never rewritten, decorated, resized, reordered or cloned.
 */
(function () {
  'use strict';
  const defs = [
    ['no_result','الترشيحات والنتائج','النتيجة غير متاحة','لا توجد نتيجة محفوظة لهذه الحسبة الآن. أكمل الحسبة أولًا.'],
    ['unavailable','تعديل القسط والكاش','تعذر اعتماد السيناريو','لم ينتج المحرك الأصلي نتيجة مؤهلة لهذا الطلب. بقيت نتيجتك المحفوظة كما هي، ولا نعتمد رقمًا غير مؤكد.'],
    ['not_allowed','تعديل القسط والكاش','صلاحية الخيار','الخيار غير مشمول في هذه الباقة.'],
    ['installment','تعديل القسط والكاش','كم القسط','كم القسط؟'],
    ['cash','تعديل القسط والكاش','كم الكاش','كم يصفّى لي كاش؟'],
    ['lower','تعديل القسط والكاش','طلب قسط أقل','أبي أقل قسط'],
    ['maximum','تعديل القسط والكاش','أعلى مبلغ','أبي أعلى مبلغ تمويل'],
    ['impact','السداد المبكر والالتزامات','سؤال الأثر','كم أثرت الالتزامات على تمويلي؟'],
    ['new','الترشيحات والنتائج','حسبة مستقلة','ابدأ حسبة جديدة'],
    ['back_max','تعديل القسط والكاش','رجوع للحد المحفوظ','العودة لأعلى مبلغ تمويل محفوظ'],
    ['back_lower','تعديل القسط والكاش','رجوع للقسط المحفوظ','العودة لسيناريو القسط الأقل المحفوظ'],
    ['review','الترشيحات والنتائج','مراجعة السيناريو','مراجعة السيناريو الحالي — دون استهلاك حسبة جديدة'],
    ['prompt_installment','تعديل القسط والكاش','القسط المطلوب','قسطك الحالي {amount} ريال. كم القسط الشهري اللي يناسبك؟ اكتب قسطًا أقل، وسنتحقق منه بالمحرك الأصلي ضمن حدود الاستقطاع والأهلية.'],
    ['prompt_principal','تعديل القسط والكاش','أصل التمويل المطلوب','أصل التمويل الحالي {amount} ريال قبل الرسوم والسداد. كم أصل التمويل الأقل اللي تبيه؟'],
    ['prompt_cash','تعديل القسط والكاش','الكاش المطلوب','صافي الكاش الحالي {amount} ريال بعد الرسوم والسداد. كم صافي الكاش الأقل اللي تبيه؟'],
    ['input_installment','تعديل القسط والكاش','حقل القسط','القسط الشهري المطلوب'],
    ['input_principal','تعديل القسط والكاش','حقل التمويل','أصل التمويل المطلوب'],
    ['input_cash','تعديل القسط والكاش','حقل الكاش','صافي الكاش المطلوب'],
    ['input_hint','تعديل القسط والكاش','تعليمات المبلغ','اكتب المبلغ بالأرقام. لا نغيّر نسبة البنك أو حدود الحسبة الأصلية.'],
    ['invalid','تعديل القسط والكاش','قيمة غير صحيحة','اكتب مبلغًا صحيحًا أكبر من صفر ولا يتجاوز نتيجتك الحالية: {amount} ريال.'],
    ['answer','الترشيحات والنتائج','جواب محفوظ','{label} في السيناريو المحفوظ على {bank}: {value}.'],
    ['answer_installment','الترشيحات والنتائج','عنوان القسط','القسط الشهري'],
    ['answer_cash','الترشيحات والنتائج','عنوان الكاش','صافي الكاش بعد الرسوم والسداد'],
    ['answer_rate','الترشيحات والنتائج','عنوان الهامش','هامش الربح السنوي'],
    ['answer_term','الترشيحات والنتائج','عنوان المدة','مدة التمويل'],
    ['answer_profit','الترشيحات والنتائج','عنوان الأرباح','إجمالي الأرباح'],
    ['answer_fees','الترشيحات والنتائج','عنوان الرسوم','رسوم البنك'],
    ['unit_money','الترشيحات والنتائج','وحدة الريال','{amount} ريال'],
    ['unit_months','الترشيحات والنتائج','وحدة المدة','{amount} شهر'],
    ['fees_detail','الترشيحات والنتائج','تفاصيل الرسوم المحفوظة','إدارية {admin} ريال، ضريبة الرسوم {vat} ريال، السلعة {commodity} ريال، ورسوم إضافية {extra} ريال'],
    ['effect','تعديل القسط والكاش','أثر التعديل','أثر التعديل على {bank}: أصل التمويل من {principal_before} إلى {principal_after} ريال، وصافي الكاش من {cash_before} إلى {cash_after} ريال، وإجمالي الأرباح من {profit_before} إلى {profit_after} ريال، والقسط من {installment_before} إلى {installment_after} ريال، والمدة من {term_before} إلى {term_after} شهر. النتيجة مبدئية وفق شروط الجهة وليست موافقة نهائية.'],
    ['no_impact','السداد المبكر والالتزامات','لا أثر مؤكد','لا يظهر تأثير إضافي مؤكد للالتزامات في هذه الحسبة.'],
    ['impact_detail','السداد المبكر والالتزامات','الأثر المحفوظ','الالتزامات الشهرية المسجلة {external} ريال. تجاوزها المؤثر {excess} ريال شهريًا؛ انخفض القسط المتاح {installment} ريال وأصل التمويل {principal} ريال وفق الحسبة الأصلية. هذا أثر الالتزامات، وليس أثر اختيار قسط أقل.'],
    ['settle','السداد المبكر والالتزامات','مراجعة التسوية','أقدر أسدد التزامًا أو أكثر'],
    ['keep','السداد المبكر والالتزامات','إبقاء الالتزامات','خلّ الحسبة مثل ما هي'],
    ['count','سؤال عدد العقود','عدد العقود التمويلية','الأقساط الشهرية الأخرى مجموعها {amount} ريال. كم عقدًا تمويليًا مستقلًا تتكون منها؟'],
    ['count_input','سؤال عدد العقود','حقل العدد','عدد العقود التمويلية'],
    ['count_hint','سؤال عدد العقود','تعليمات العدد','اكتب واحد أو عقدين أو ثلاثة، أو العدد بالأرقام من 1 إلى 10. هذه عقود تمويلية وليست عقود خدمات المتابعة.'],
    ['bad_count','سؤال عدد العقود','عدد غير صحيح','اكتب عدد العقود التمويلية من 1 إلى 10.'],
    ['single','سؤال عدد العقود','بيانات العقد الوحيد','تمام، عندك عقد تمويلي واحد. كم قسط عقدك الشهري بالريال؟'],
    ['contract','سؤال عدد العقود','بيانات العقد المتسلسل','كم قسط العقد {ordinal} الشهري بالريال؟'],
    ['single_input','سؤال عدد العقود','حقل العقد الوحيد','قسط عقدك الشهري'],
    ['contract_input','سؤال عدد العقود','حقل العقد المتسلسل','قسط العقد {ordinal}'],
    ['contract_hint','سؤال عدد العقود','تعليمات قسط العقد','اكتب القسط الشهري لهذا العقد فقط. بيانات العقود المدخلة محفوظة في هذه الحسبة.'],
    ['bad_contract','السداد المبكر والالتزامات','قسط غير صحيح','اكتب قسطًا شهريًا أكبر من صفر. مجموع العقود لا يمكن أن يتجاوز الالتزامات المسجلة {amount} ريال.'],
    ['mismatch','السداد المبكر والالتزامات','تصحيح القسط الأخير','مجموع أقساط العقود {sum} ريال، والالتزامات المسجلة {total} ريال. حفظنا بياناتك؛ راجع قسط العقد الأخير فقط ليطابق المجموع، دون إضافة عقد جديد.'],
    ['choose','السداد المبكر والالتزامات','اختيار العقود للتسوية','اختر العقود التمويلية التي تستطيع تسويتها بالكامل. لا نفترض إلغاء جزء من قسط عقد.'],
    ['single_row','السداد المبكر والالتزامات','تسوية العقد الوحيد','تسوية عقدك — يتوقف قسط شهري {amount} ريال'],
    ['contract_row','السداد المبكر والالتزامات','تسوية عقد متسلسل','تسوية العقد {ordinal} — يتوقف قسط شهري {amount} ريال'],
    ['preview','السداد المبكر والالتزامات','مراجعة التسوية','مراجعة الالتزامات المتبقية'],
    ['select_contract','السداد المبكر والالتزامات','اختيار مطلوب','حدد عقدًا تمويليًا واحدًا على الأقل تستطيع تسويته بالكامل.'],
    ['confirm','السداد المبكر والالتزامات','تأكيد الافتراض','الأقساط التي تفترض توقفها {closed} ريال شهريًا، والمتبقي {remaining} ريال شهريًا. هل تريد احتساب هذا الافتراض؟ لم نسجل السداد على أنه تم فعلًا، ولا نعتمد استبعاد الالتزام لدى البنك دون إثبات.'],
    ['apply','السداد المبكر والالتزامات','احتساب التسوية','نعم، احسب على هذا الافتراض'],
    ['cancel','السداد المبكر والالتزامات','إلغاء الافتراض','إلغاء والعودة للنتيجة المحفوظة'],
    ['kept','السداد المبكر والالتزامات','بيانات محفوظة','التزاماتك وبيانات عقودك محفوظة كما أدخلتها. لم نغيّر الحسبة أو نستهلك استخدامًا جديدًا.'],
    ['ord_first','سؤال عدد العقود','الأول','الأول'],['ord_second','سؤال عدد العقود','الثاني','الثاني'],['ord_third','سؤال عدد العقود','الثالث','الثالث'],['ord_number','سؤال عدد العقود','رقم العقد','رقم {amount}']
  ];
  const registry = Object.fromEntries(defs.map(([key,category,label,text]) => [key,{key:'r22d.'+key,category,label,text,vars:[...text.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1])}]));
  window.F99Texts.register(Object.values(registry));
  const t=(key,vars={})=>{const d=registry[key];const fallback=d.text.replace(/\{([a-z_]+)\}/g,(_,v)=>String(vars[v]??''));return window.F99T(d.key,vars,fallback)};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id), clone=x=>structuredClone(x);
  const say=html=>{portalAssistant(html);return el('finoBotChat')?.lastElementChild;}, note=(key,vars)=>say('<div class="f49-message">'+esc(t(key,vars))+'</div>');
  const amount=n=>fmt(Number(n));
  const permission=k=>window.F99V38FeatureAllowed?.(k)===true;
  const cases=new Map(), owners=new WeakMap();
  let active=null, busy=false, pending=null, sequence=0;
  let scenarioRendering=false;
  const originalMenu=window.F99V38BotStepsHtml;
  window.F99V38BotStepsHtml=function(){const html=originalMenu.apply(this,arguments);return scenarioRendering?html.replace(' f49-menu',''):html;};
  const cards=()=>[...(el('finoBotChat')?.querySelectorAll('.portal-result')||[])].filter(c=>c.querySelector('.portal-detail-lines'));
  const originalScope=window.finoHideDisallowedPortalActions;
  window.finoHideDisallowedPortalActions=function(){
    // portalAssistant schedules this via setTimeout after every message, so the
    // deferred call lands after `busy` clears; cover the whole active scenario session.
    if(!active||active.session!==session())return originalScope.apply(this,arguments);
    // Original calculate reapplies chat scope by deleting/readding every hidden
    // marker. Keep the same policy, but leave an already-correct button untouched.
    const scope=finoPortal?.strictServiceScope||finoCentralServiceScope(),page=el('specialistBotPage');
    if(!page)return;
    for(const btn of page.querySelectorAll('button')){
      const txt=(btn.textContent||'').trim(),admin=txt.includes('المختص')||txt.includes('إعدادات');
      const hide=!!scope&&scope!=='both'&&(admin||(scope==='smart'&&txt.includes('تحويل المديونية'))||(scope==='buyout'&&(txt.includes('الحاسبة الذكية')||txt.includes('تمويل استهلاكي')||txt.includes('تمويل شركات')||txt.includes('التمويل الاستهلاكي'))));
      if(hide){if(btn.style.display!=='none')btn.style.display='none';if(btn.dataset.finoScopeHidden!=='1')btn.dataset.finoScopeHidden='1';}
      else if(btn.dataset.finoScopeHidden==='1'){btn.style.display='';delete btn.dataset.finoScopeHidden;}
    }
  };
  function session(){try{return String(finoCentralRestoreEntry()?.entryToken||'')}catch{return ''}}
  function ready(){return active&&active.session===session()&&finoPortal?.mode==='buyout'&&latestResults?.length>0}
  function result(){return ready()?(latestResults[selectedResultIndex]||latestResults[0]):null}
  function snapshot(kind){return {id:++sequence,kind,results:clone(latestResults),index:Number(selectedResultIndex)||0,data:clone(finoPortal.data),sector:customerType,bank:selectedBank,term:freeBuyoutTermMonths,paidBasis:f85PaidBasis,engine:window.F99R22ScenarioEngineState(),cards:new Map(),impactShown:false}}
  function save(kind){const s=snapshot(kind);active.scenarios.set(s.id,s);active.current=s;return s}
  function restore(s,index=s.index){
    if(!active||active.session!==session()||!s)return false;
    window.F99R22ScenarioEngineState(s.engine);finoPortal.data=clone(s.data);customerType=s.sector;selectedBank=s.bank;freeBuyoutTermMonths=s.term;
    f85PaidBasis=s.paidBasis; // Only an in-memory snapshot of an actually accepted paid case.
    latestResults=clone(s.results);selectedResultIndex=Math.max(0,Math.min(Number(index)||0,latestResults.length-1));s.index=selectedResultIndex;active.current=s;
    for(const [id,key] of [['salary','salary'],['earlySettlement','settlement'],['externalObligations','external']])if(el(id))el(id).value=String(s.data[key]||0);
    finoPortal.step='buyout_result';setPortalInput(false);
    // A saved chat view needs its accepted globals, not an off-screen calculator redraw.
    // renderResults also reapplies service scope to every old chat button.
    return true;
  }
  const button=(key,action)=>'<button type="button" onclick="'+action+'">'+esc(t(key))+'</button>';
  function navigation(){
    if(!ready())return;
    document.querySelectorAll('#finoBotChat [data-r22d-navigation]').forEach(n=>n.remove());
    const s=active.current,i=Number(selectedResultIndex)||0;
    const review=[button('installment',`F99V41Ask('installment',${i})`),button('cash',`F99V41Ask('cash',${i})`)];
    if(permission('reduce_installment'))review.push(button('lower',"F99V37BeginAdjust('installment')"));
    if(permission('reduce_amount')||permission('reduce_installment'))review.push(button('maximum','F99R22Scenarios.maximum()'));
    if(permission('show_obligation_impact'))review.push(button('impact','F99V41Impact()'));
    if(s!==active.maximum)review.push(button('back_max',`F99R22Scenarios.open(${active.maximum.id})`));
    if(active.lower&&s!==active.lower)review.push(button('back_lower',`F99R22Scenarios.open(${active.lower.id})`));
    say('<div class="f49-message" data-r22d-navigation><p>'+esc(t('review'))+'</p><div class="f41-options">'+review.join('')+'</div><hr><div class="f41-options">'+button('new','F99V82RequestNewCalculation()')+'</div></div>');
  }
  const originalRun=window.runFINOPortalBuyout;
  window.runFINOPortalBuyout=async function(){const out=await originalRun.apply(this,arguments);if(out!==false&&finoPortal?.step==='buyout_result'&&latestResults?.length){
    active={id:++sequence,session:session(),scenarios:new Map(),contracts:{count:0,amounts:[],index:0},current:null,maximum:null,lower:null};
    active.maximum=save('maximum');cases.set(active.id,active);
  }return out};
  const originalRank=window.showFINOPortalRank;
  window.showFINOPortalRank=async function(index){
    if(ready()){active.current.index=Number(index)||0;selectedResultIndex=active.current.index;}
    const before=new Set(cards());let out;
    scenarioRendering=ready()&&active.current!==active.maximum;
    try{out=await originalRank.apply(this,arguments);}finally{scenarioRendering=false;}
    if(out!==false&&ready()){
      const s=active.current;for(const card of cards())if(!before.has(card)){owners.set(card,{owner:active,scenario:s,index:Number(index)||0});s.cards.set(Number(index)||0,card);}
      navigation();
    }return out;
  };
  // Original image/share handlers resolve globals. Restore their card's saved scenario
  // before the original trusted click handler runs; no card attribute or child is changed.
  document.addEventListener('click',ev=>{
    const card=ev.target.closest?.('#finoBotChat .portal-result'),saved=card&&owners.get(card);
    const control=ev.target.closest?.('button,a');
    if(saved&&control&&saved.owner.session===session()){
      active=saved.owner;restore(saved.scenario,saved.index);
      // These R22-owned actions must not reach V50's chat-wide choiceClicked
      // decorator, which marks buttons on the immutable first result card.
      const action=control.getAttribute('onclick')||'';
      if(ev.isTrusted&&/^(F99V(?:37BeginAdjust|41Ask|38Ask|41Impact|49DebtStart|49DebtCancel|49DebtPreview|49DebtApply|37Reset|47ResetFinance|47ResetInstallment|47ResetChosen|38ShowSummary))\(/.test(action)){
        ev.preventDefault();ev.stopImmediatePropagation();control.onclick?.call(control,ev);
      }
    }
  },true);
  async function open(id,index){
    if(!ready())return note('no_result');const s=active.scenarios.get(Number(id));if(!s)return note('no_result');
    if(!restore(s,index===undefined?s.index:index))return;
    const card=s.cards.get(Number(selectedResultIndex)||0);
    if(card?.isConnected){card.scrollIntoView({block:'start',behavior:'smooth'});navigation();return true;}
    return window.showFINOPortalRank(Number(selectedResultIndex)||0);
  }
  async function maximum(){
    if(!ready())return note('no_result');if(!permission('reduce_installment')&&!permission('reduce_amount'))return note('not_allowed');
    const s=active.maximum;
    const i=s.results.reduce((best,r,index)=>Number(r.principalBeforeFees)>Number(s.results[best].principalBeforeFees)?index:best,0);
    return open(s.id,i);
  }
  const valueKeys={installment:'installment',cash:'cashAfterDebt',rate:'rate',term:'actualPayments',profit:'totalProfit'};
  function ask(key){
    const r=result();if(!r)return note('no_result');if(!valueKeys[key]&&key!=='fees')return;
    let value;
    if(key==='fees')value=t('fees_detail',{admin:amount(r.adminFee),vat:amount(r.adminVat),commodity:amount(r.commodityFee),extra:amount(r.additionalFee)});
    else if(key==='rate')value=fmt(r.rate)+'%';
    else value=t(key==='term'?'unit_months':'unit_money',{amount:key==='term'?r.actualPayments:amount(r[valueKeys[key]])});
    note('answer',{label:t('answer_'+key),bank:r.name,value});navigation();
  }
  window.F99V41Ask=ask;window.F99V38Ask=ask;
  window.F99V37BeginAdjust=kind=>{
    const r=result();if(!r)return note('no_result');if(!['installment','principal','cash'].includes(kind))return;
    if(!permission(kind==='installment'?'reduce_installment':'reduce_amount'))return note('not_allowed');
    pending={kind,before:active.current,owner:active};finoPortal.step='r22d_'+kind;
    note('prompt_'+kind,{amount:amount(r[kind==='installment'?'installment':kind==='principal'?'principalBeforeFees':'cashAfterDebt'])});
    setPortalInput(true,t('input_'+kind),'text',t('input_hint'));
  };
  function parse(raw){let s=String(raw||'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[٬،,\s]/g,'').replace(/٫/g,'.');return /^\d+(\.\d{1,2})?$/.test(s)?Number(s):NaN}
  async function adjust(raw){
    if(busy||!pending||pending.owner!==active)return;
    const {kind,before}=pending,n=parse(raw),r=result();const upper=Number(r?.[kind==='installment'?'installment':kind==='principal'?'principalBeforeFees':'cashAfterDebt']);
    if(!Number.isFinite(n)||n<=0||n>upper+.01)return note('invalid',{amount:amount(upper)});
    busy=true;finoPortal.step='f37_'+kind;
    try{
      const bank=r.key;const d=await window.F99V37ApplyBotAdjustment(kind,n);
      if(!d?.ok||!latestResults?.length||!latestResults.some(x=>x.key===bank)){restore(before);note('unavailable');navigation();return;}
      selectedResultIndex=latestResults.findIndex(x=>x.key===bank);
      finoPortal.step='buyout_result';setPortalInput(false);window.F99V47ClearAdjustment?.();
      const s=save(kind);if(kind==='installment')active.lower=s;
      const next=result();note('effect',{bank:next.name,principal_before:amount(r.principalBeforeFees),principal_after:amount(next.principalBeforeFees),cash_before:amount(r.cashAfterDebt),cash_after:amount(next.cashAfterDebt),profit_before:amount(r.totalProfit),profit_after:amount(next.totalProfit),installment_before:amount(r.installment),installment_after:amount(next.installment),term_before:r.actualPayments,term_after:next.actualPayments});
      await window.showFINOPortalRank(selectedResultIndex);
    }catch(_){restore(before);note('unavailable');navigation();}
    finally{busy=false;pending=null;}
  }
  window.F99V37Reset=maximum;window.F99V47ResetFinance=maximum;window.F99V47ResetInstallment=maximum;window.F99V47ResetChosen=maximum;
  window.F99V38ShowSummary=()=>{if(!ready())return note('no_result');return open(active.current.id)};
  function impact(){
    const r=result();if(!r)return note('no_result');if(!permission('show_obligation_impact'))return note('not_allowed');
    finoPortal.step='buyout_result';setPortalInput(false);
    const s=active.current;if(s.impactShown){s.impactNode?.scrollIntoView({block:'nearest',behavior:'smooth'});return;} // one action owns one saved response
    s.impactShown=true;const d=r.obligationImpact;
    if(!d?.affected||!(Number(d.excess)>0)){s.impactNode=note('no_impact');navigation();return;}
    s.impactNode=note('impact_detail',{external:amount(s.data.external),excess:amount(d.excess),installment:amount(d.installmentReduction),principal:amount(d.principalReduction)});
    if(permission('show_debt_suggestions'))say('<div class="f41-options">'+button('settle','F99V49DebtStart()')+button('keep','F99V49DebtCancel()')+'</div>');
  }
  window.F99V41Impact=impact;
  const ordinal=n=>n===1?t('ord_first'):n===2?t('ord_second'):n===3?t('ord_third'):t('ord_number',{amount:n});
  function contractPrompt(){const c=active.contracts;
    note(c.count===1?'single':'contract',{ordinal:ordinal(c.index+1)});
    finoPortal.step='r22d_contract_amount';setPortalInput(true,c.count===1?t('single_input'):t('contract_input',{ordinal:ordinal(c.index+1)}),'text',t('contract_hint'));
  }
  function breakdown(){
    const c=active.contracts;finoPortal.step='buyout_result';setPortalInput(false);
    const rows=c.amounts.map((n,i)=>'<label class="f49-debt-row"><input type="checkbox" data-r22d-contract value="'+i+'" '+(c.selected?.includes(i)?'checked':'')+'><span>'+esc(t(c.count===1?'single_row':'contract_row',{ordinal:ordinal(i+1),amount:amount(n)}))+'</span></label>').join('');
    say('<div class="f49-card" data-r22d-contracts><p>'+esc(t('choose'))+'</p>'+rows+'<div class="f41-options">'+button('preview','F99V49DebtPreview()')+button('cancel','F99V49DebtCancel()')+'</div></div>');
  }
  window.F99V49DebtStart=()=>{
    if(!ready())return note('no_result');if(!permission('show_debt_suggestions'))return note('not_allowed');
    const c=active.contracts;
    if(c.count&&c.amounts.length===c.count)return breakdown();
    if(c.count)return contractPrompt();
    finoPortal.step='r22d_contract_count';note('count',{amount:amount(active.current.data.external)});
    setPortalInput(true,t('count_input'),'text',t('count_hint'));
  };
  window.F99V41SettleChoice=window.F99V49DebtStart;
  window.F99V49DebtCancel=()=>{if(!ready())return note('no_result');restore(active.current);note('kept');navigation()};
  window.F99V41KeepDebts=window.F99V49DebtCancel;
  function contractInput(raw){
    const c=active.contracts,total=Number(active.current.data.external||0);
    if(finoPortal.step==='r22d_contract_count'){
      const words={'واحد':1,'واحدة':1,'عقد واحد':1,'عقد':1,'عقدين':2,'اثنين':2,'اثنان':2,'عقدان':2,'ثلاثة':3,'ثلاث':3,'ثلاثة عقود':3};const n=words[raw.trim()]??parse(raw);
      if(!Number.isInteger(n)||n<1||n>10)return note('bad_count');c.count=n;c.index=c.amounts.length;return contractPrompt();
    }
    const n=parse(raw),prior=c.amounts.slice(0,c.index).reduce((a,b)=>a+b,0);
    if(!Number.isFinite(n)||n<=0||prior+n>total+.02)return note('bad_contract',{amount:amount(total)});
    c.amounts[c.index]=n;
    if(c.index+1<c.count){c.index++;return contractPrompt();}
    const sum=c.amounts.reduce((a,b)=>a+b,0);
    if(Math.abs(sum-total)>.02){note('mismatch',{sum:amount(sum),total:amount(total)});return;}
    c.index=c.count;breakdown();
  }
  window.F99V49DebtPreview=()=>{
    if(!ready())return note('no_result');const c=active.contracts,card=[...document.querySelectorAll('#finoBotChat [data-r22d-contracts]')].at(-1);
    const selected=[...(card?.querySelectorAll('[data-r22d-contract]:checked')||[])].map(n=>Number(n.value));
    if(!selected.length)return note('select_contract');c.selected=selected;
    const closed=selected.reduce((sum,i)=>sum+Number(c.amounts[i]||0),0),remaining=Number(active.current.data.external)-closed;
    if(remaining<-.02)return note('unavailable');
    c.preview={before:active.current,remaining:Math.max(0,remaining)};
    note('confirm',{closed:amount(closed),remaining:amount(c.preview.remaining)});
    say('<div class="f41-options">'+button('apply','F99V49DebtApply()')+button('cancel','F99V49DebtCancel()')+'</div>');
  };
  window.F99V49DebtApply=async()=>{
    if(busy||!ready())return;const c=active.contracts,p=c.preview;if(!p||p.before!==active.current)return note('unavailable');
    busy=true;c.preview=null;const bank=result().key;
    try{
      finoPortal.data.external=p.remaining;if(el('externalObligations'))el('externalObligations').value=String(p.remaining);
      finoPortal.step='buyout_result';const ok=await calculate({recalculate:true,botKeep:true});
      if(ok===false||!latestResults?.length||!latestResults.some(x=>x.key===bank))throw Error('NO_ELIGIBLE_ORIGINAL_RESULT');
      selectedResultIndex=latestResults.findIndex(x=>x.key===bank);save('commitments');await window.showFINOPortalRank(selectedResultIndex);
    }catch(_){restore(p.before);note('unavailable');navigation();}finally{busy=false;}
  };
  window.F99V49DebtRestore=()=>ready()?open(active.maximum.id):note('no_result');
  const previousInput=window.submitFINOPortalInput;
  window.submitFINOPortalInput=function(){
    const step=finoPortal?.step||'';
    if(!/^r22d_/.test(step))return previousInput.apply(this,arguments);
    const input=el('finoBotInput'),raw=String(input?.value||'').trim();if(!raw||busy)return;
    if(input)input.value='';portalUser(raw);
    if(step==='r22d_contract_count'||step==='r22d_contract_amount')return contractInput(raw);
    return adjust(raw);
  };
  // Clear only the scenario identity when a truly new calculation is authorized.
  // Do not wrap or bypass the existing new-calculation session/quota guard.
  const oldOpen=window.openFINOSmartPortal;
  window.openFINOSmartPortal=function(){const value=oldOpen.apply(this,arguments);if(finoPortal?.step==='buyout_type'){active=null;pending=null;}return value};
  window.F99R22Scenarios={open,maximum,version:'20261116r22D',diagnostics:()=>({case_id:active?.id||null,current:active?.current?.id||null,kind:active?.current?.kind||null,saved:active?.scenarios.size||0,contracts:clone(active?.contracts||{})})};
})();
