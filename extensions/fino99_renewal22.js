/* FINO99 G22: renewal is a read-only customer scope, never a calculator bearer.
 * New = package-linked V74/V77 Salla stock offers. Old = V29 owner-confirmed
 * same-code renewal (V50 voucher writes remain disabled by the original server).
 */
(function () {
  'use strict';
  const w = window, d = document;
  const words = {
    invite: ['نفاد الاستخدامات','دعوة التجديد','يا {client}، استهلكت حسبات باقتك، وعندك عروض خاصة للتجديد. ودك تشوفها؟',['client']],
    expired: ['نفاد الاستخدامات','دعوة تجديد المدة','يا {client}، انتهت مدة باقتك، وعندك عروض خاصة للتجديد. ودك تشوفها؟',['client']],
    view: ['رسائل التجديد','عرض العروض','نعم، أشوف العروض'],
    later: ['رسائل التجديد','تأجيل التجديد','ليس الآن'],
    title: ['رسائل التجديد','عنوان التجديد','تجديد الكود'],
    inquiry: ['رسائل التجديد','الاستعلام عن الكود','الاستعلام عن الكود'],
    code: ['رسائل التجديد','حقل الكود','كود الباقة'],
    enter: ['رسائل التجديد','تحقق من الكود','عرض فرصة التجديد'],
    buy: ['رسائل التجديد','زر الشراء','تجديد وشراء'],
    price: ['رسائل التجديد','سعر العرض','{price} ريال',['price']],
    terms: ['رسائل التجديد','مدة وحسبات العرض','مدة الاستخدام: {minutes} دقيقة • {count} حسبة جديدة',['minutes','count']],
    empty: ['رسائل التجديد','عدم توفر عروض','لا توجد عروض تجديد مفعلة الآن. يمكنك العودة لاحقًا.'],
    stock: ['رسائل التجديد','نفاد مخزون العرض','نفد مخزون هذا العرض حاليًا.'],
    changed: ['رسائل التجديد','تغير العرض','تغيّر العرض أو نفد المخزون. أعد عرض التفاصيل قبل الشراء.'],
    failed: ['رسائل التجديد','تعذر التحقق','تعذر التحقق من الكود أو عروضه. لم تُفتح حسبة جديدة.'],
    old: ['رسائل التجديد','التجديد القديم','التجديد القديم — نفس الكود بعد اعتماد المالك'],
    oldRequest: ['رسائل التجديد','طلب التجديد القديم','طلب تجديد نفس الكود'],
    oldNote: ['رسائل التجديد','اعتماد التجديد القديم','يُعتمد التجديد بعد مراجعة السداد من المالك؛ لا يُفعّل من إدخال الكود وحده.'],
    oldMessage: ['رسائل التجديد','رسالة طلب التجديد القديم','السلام عليكم، أرغب في تجديد كودي {code} بعرض {offer}، بالسعر المعتمد {price} ريال. الاسم: {client}.',['code','offer','price','client']],
    voucher: ['رسائل التجديد','رمز التجديد المباع','لدي رمز تجديد مباع'],
    voucherLabel: ['رسائل التجديد','إدخال رمز التجديد','رمز التجديد الذي وصلك بعد الشراء'],
    voucherSend: ['رسائل التجديد','مراجعة رمز التجديد','طلب مراجعة الرمز من المالك'],
    voucherMessage: ['رسائل التجديد','طلب اعتماد رمز التجديد','السلام عليكم، لدي رمز تجديد مباع {voucher} لكودي الأصلي {code}، وأرغب في مراجعته واعتماد التجديد. الاسم: {client}.',['voucher','code','client']],
    copy: ['رسائل التجديد','نسخ الرمز وحده','نسخ الرمز وحده'],
    copied: ['رسائل التجديد','تم نسخ الرمز','تم نسخ الرمز وحده.'],
    review: ['رسائل التجديد','مراجعة محفوظة','مراجعة النتائج المحفوظة — دون حسبة جديدة'],
    close: ['رسائل التجديد','العودة للخدمات','العودة للخدمات'],
    purchased: ['رسائل التجديد','وصل كود التجديد','وصلني كود التجديد بعد الشراء'],
    purchasedLabel: ['رسائل التجديد','حقل الكود المباع','كود التجديد الذي وصلك بعد الشراء'],
    bind: ['رسائل التجديد','ربط الكود المباع','ربط كود التجديد بحسابي'],
    bound: ['رسائل التجديد','اعتماد الكود المباع','تم التحقق من البيع وربط كود التجديد بك وباسمك المحفوظ.'],
    unconfirmed: ['رسائل التجديد','رفض الربط قبل السداد','لم تتوفر إفادة بيع مؤكدة لهذا الكود. لم يُفعّل التجديد ولم يُستهلك كود.'],
    off: ['رسائل التجديد','التجديد معطل','التجديد غير مفعّل لهذه الباقة. نتائجك المحفوظة لا تُحذف.'],
    loading: ['رسائل التجديد','قراءة العروض','جاري قراءة عروض باقتك من المركزية...'],
    client: ['رسائل التجديد','اسم احتياطي','عميلنا'],
    oldUnavailable: ['رسائل التجديد','عدم توفر الاستقبال','استقبال طلبات التجديد غير متاح حاليًا.'],
    expiredNotice: ['نفاد الاستخدامات','رسالة انتهاء صلاحية الكود','انتهت صلاحية كودك.'],
    finishedNotice: ['نفاد الاستخدامات','رسالة استنفاد الحسبات','استخدمت جميع الحسبات المتاحة في باقتك.']
  };
  w.F99Texts?.register(Object.entries(words).map(([key,x])=>({key:'renewal22.'+key,category:x[0],label:x[1],text:x[2],vars:x[3]||[]})));
  const t=(key,vars={})=>w.F99T('renewal22.'+key,vars,words[key][2].replace(/\{([a-z][a-z0-9_]*)\}/g,(match,name)=>Object.prototype.hasOwnProperty.call(vars,name)?String(vars[name]):match));
  const el=(tag,text,cls)=>{const n=d.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const btn=(host,key,fn)=>{const n=el('button',t(key),'f99s12-button');n.type='button';n.onclick=ev=>{if(!ev.isTrusted)return;Promise.resolve(fn(ev)).catch(()=>status(host,'failed'));};host.append(n);return n;};
  const status=(host,key)=>{let n=host.querySelector('[data-renewal-status]');if(!n){n=el('p');n.dataset.renewalStatus='1';n.setAttribute('role','status');host.append(n);}n.textContent=t(key);};
  const normalized=c=>String(c||'').trim().toUpperCase();
  const safeURL=raw=>{const u=w.F99SessionSecurity.safeHttps(raw);try{const x=new URL(u);return ['salla.sa','www.salla.sa'].includes(x.hostname)&&!x.port?u:'';}catch(_){return '';}};
  let current=null, validUntil=0, serial=0;
  const modeFor=ctx=>w.F99Settings?.packageOption(ctx.package_key,'renewal_mode',ctx.renewal_mode||'new')||'new';
  async function details(code){const r=await w.finoRpc('f99r22_renewal_context',{p_code:normalized(code),p_device_id:w.F99S12Runtime.device()},15000);return r?.ok&&r.data?.ok?r.data:null;}
  function page(){let p=d.getElementById('f99r22RenewalPage');if(!p){p=el('section',null,'page');p.id='f99r22RenewalPage';p.dir='rtl';const viewport=el('div',null,'viewport');const chat=el('div',null,'f99r22-chat');chat.setAttribute('role','log');viewport.append(chat);p.append(viewport);d.body.append(p);}return p;}
  function close(card){card?.remove();validUntil=0;current=null;serial++;if(w.F99SessionSecurity.context()?.verified)w.showPage?.('freeHub');else w.showPage?.('page1');}
  function offerCard(host,o){const c=el('article',null,'f99r22-offer');c.dataset.offerId=o.id;host.append(c);c.append(el('h4',o.title),el('strong',t('price',{price:Number(o.price_sar??o.price).toLocaleString('en-US',{maximumFractionDigits:2})})),el('p',t('terms',{minutes:o.duration_minutes,count:o.max_calculations})));return c;}
  function oldOffers(host,ctx,code){const catalog=ctx.old_catalog||{};if(catalog.enabled===false)return 0;
    const offers=(catalog.offers||[]).filter(o=>o.enabled===true&&Number.isFinite(Number(o.price))&&Number(o.duration_minutes)>0&&Number(o.max_calculations)>0);
    if(!offers.length)return 0;host.append(el('h4',t('old')),el('p',t('oldNote')));
    const wa=String(catalog.whatsapp||'');
    const openMessage=message=>{if(!/^9665\d{8}$/.test(wa))return status(host,'oldUnavailable');w.open('https://wa.me/'+wa+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');};
    for(const o of offers){const c=offerCard(host,o);btn(c,'oldRequest',()=>openMessage(t('oldMessage',{code,offer:o.title,price:o.price,client:ctx.client_name||t('client')})));}
    btn(host,'voucher',()=>{if(host.querySelector('[data-renewal-voucher]'))return;const field=el('label',t('voucherLabel')),input=el('input');input.dataset.renewalVoucher='1';input.maxLength=80;input.dir='ltr';field.append(input);host.append(field);
      btn(host,'voucherSend',()=>{const voucher=normalized(input.value);if(!/^[A-Z0-9_-]{8,80}$/.test(voucher))return status(host,'failed');openMessage(t('voucherMessage',{voucher,code,client:ctx.client_name||t('client')}));});
      btn(host,'copy',async()=>{await navigator.clipboard.writeText(normalized(input.value));status(host,'copied');});
    });return offers.length;
  }
  function showOffers(host,ctx,code){const mode=modeFor(ctx);let count=0;
    if(mode==='new'||mode==='both')for(const o of ctx.offers||[]){const deadline=o.offer_expires_at?Date.parse(o.offer_expires_at):Infinity;if(!Number.isFinite(Number(o.price_sar))||deadline<=Date.parse(ctx.server_now))continue;
      const c=offerCard(host,o);count++;const quantity=Number(o.available),url=safeURL(o.checkout_url);
      if(!Number.isSafeInteger(quantity)||quantity<1){c.append(el('p',t('stock')));continue;}
      if(url) {const b=btn(c,'buy',async()=>{b.disabled=true;try{const latest=await details(code),m=latest&&modeFor(latest),actual=latest?.offers?.find(x=>x.id===o.id);
        if(!['new','both'].includes(m)||!actual||Number(actual.available)<1||Number(actual.price_sar)!==Number(o.price_sar)||safeURL(actual.checkout_url)!==url)return status(c,'changed');
        // Direct navigation only. No stock claim, voucher redemption, code exposure or payment assertion.
        w.open(url,'_blank','noopener,noreferrer');
      }finally{b.disabled=false;}});b.dataset.checkoutUrl=url;}
    }
    if(mode==='old'||mode==='both')count+=oldOffers(host,ctx,code);
    if(!count)host.append(el('p',t(mode==='off'?'off':'empty')));
  }
  function purchased(host,code){btn(host,'purchased',()=>{if(host.querySelector('[data-purchased-code]'))return;const label=el('label',t('purchasedLabel')),input=el('input');input.dir='ltr';input.maxLength=32;input.dataset.purchasedCode='1';label.append(input);host.append(label);
    const link=btn(host,'bind',async()=>{link.disabled=true;try{const value=normalized(input.value);if(!/^[A-Z0-9-]{8,32}$/.test(value))return status(host,'unconfirmed');const r=await w.finoRpc('f99r22_bind_purchased_renewal',{p_old_code:code,p_device_id:w.F99S12Runtime.device(),p_new_code:value},20000);if(!r?.ok||r.data?.bound!==true)return status(host,'unconfirmed');status(host,'bound');const output=el('code',r.data.new_code);output.dataset.purchasedOutput='1';host.append(output);btn(host,'copy',async()=>{await navigator.clipboard.writeText(r.data.new_code);status(host,'copied');});}finally{link.disabled=false;}});
  });}
  function renderReviews(host,ctx,captured){if(captured?.childNodes?.length){const review=el('details',null,'f99r22-review');review.append(el('summary',t('review')),captured);host.append(review);return;}
    if(!(ctx.reviews||[]).length)return;const review=el('details',null,'f99r22-review');review.append(el('summary',t('review')));
    // Saved records only; textContent prevents stored markup from granting actions/JS.
    for(const r of ctx.reviews){const one=el('section');const lines=[];const visit=(value)=>{if(value==null)return;if(Array.isArray(value))return value.forEach(visit);if(typeof value==='object'){for(const [k,v] of Object.entries(value)){if(typeof v==='object')visit(v);else if(v!=null&&v!=='')lines.push(k+': '+v);}return;}lines.push(String(value));};
      visit(r.detailed_card_snapshot);if(!lines.length)visit(r.compact_card_snapshot);if(!lines.length)visit(r.chat_log);one.append(el('pre',lines.join('\n')));review.append(one);}
    host.append(review);
  }
  async function open(code,options={}){const id=++serial;let ctx;try{ctx=await details(code);}catch(_){}
    if(id!==serial)return false;
    const active=w.F99SessionSecurity.context()?.verified===true;
    const host=active?d.getElementById('finoBotChat'):page().querySelector('.f99r22-chat');
    if(!ctx){if(active&&host)status(host,'failed');else {validUntil=0;current=null;w.showPage?.('page1');const error=d.getElementById('f99l-error');if(error)error.textContent=t('failed');}return false;}
    if(!active)host.replaceChildren();host.querySelector('.f99r22-renewal')?.remove();
    current={code:normalized(code),ctx};validUntil=Date.now()+600000;
    const card=el('section',null,'f99r22-renewal');card.setAttribute('role','status');host.append(card);
    const client=ctx.client_name||options.clientName||t('client');
    card.append(el('strong',t(ctx.status==='expired'?'expiredNotice':'finishedNotice'),'f99r22-notice'),el('p',t(ctx.status==='expired'?'expired':'invite',{client})));
    const offers=el('div',null,'f99r22-offers');offers.hidden=true;card.append(offers);
    if(modeFor(ctx)!=='off')btn(card,'view',()=>{offers.hidden=false;offers.replaceChildren();showOffers(offers,ctx,normalized(code));card.scrollIntoView({block:'nearest',behavior:'smooth'});});
    else card.querySelector('p').textContent=t('off');
    if(['new','both'].includes(modeFor(ctx)))purchased(card,normalized(code));
    btn(card,'later',()=>close(card));renderReviews(host,ctx,options.capturedChat);
    if(!active)w.showPage?.('f99r22RenewalPage');card.scrollIntoView({block:'nearest',behavior:'smooth'});return true;
  }
  function inquiry(host){host.querySelector('.f99r22-code-entry')?.remove();const row=el('div',null,'f99r22-code-entry'),label=el('label',t('code')),input=el('input');input.dir='ltr';input.autocomplete='off';input.maxLength=32;label.append(input);row.append(label);host.append(row);btn(row,'enter',()=>open(input.value));input.focus();}
  function currentCode(){try{return current?.code||w.finoCentralRestoreEntry()?.code||activeAccess?.record?.code||f99LastAttemptedCode||'';}catch(_){return current?.code||'';}}
  function serviceLinks(){const visibility=w.F99Settings?.value('store_design')?.renewal_services_links!==false;
    // Owner order 2026-11-16: never inside the store sheet. Remove any earlier copy there.
    d.querySelectorAll('#f99s-modal .f99r22-links').forEach(n=>n.remove());
    const roots=[d.querySelector('#freeHub .viewport')||d.getElementById('freeHub'),d.querySelector('#specialistBotPage .viewport')||d.getElementById('specialistBotPage')].filter(Boolean);
    for(const host of roots){let nav=host.querySelector(':scope > .f99r22-links');if(!visibility){nav?.remove();continue;}if(nav)continue;nav=el('nav',null,'f99r22-links');nav.setAttribute('aria-label',t('title'));host.prepend(nav);
      btn(nav,'title',()=>{const code=currentCode();if(code)return open(code);inquiry(nav);});btn(nav,'inquiry',()=>inquiry(nav));}
  }
  function ownerTools(){let owner=false;try{owner=activeAccess?.record?.owner===true&&activeAccess.record.central===true;}catch(_){}if(!owner)return;
    const root=d.querySelector('#f76-modal main');if(!root||root.querySelector('.f99r22-owner'))return;const box=el('section',null,'f76-card f99r22-owner');root.append(box);box.append(el('h3','إدارة روابط التجديد وحذف العرض غير المستخدم'));
    const label=el('label','إظهار رابط التجديد والاستعلام أعلى الخدمات'),check=el('input');check.type='checkbox';check.checked=w.F99Settings.value('store_design').renewal_services_links!==false;label.prepend(check);box.append(label);
    const save=el('button','حفظ ظهور الروابط');save.type='button';box.append(save);save.onclick=async()=>{save.disabled=true;try{for(let i=0;i<3;i++){const latest=await w.F99Settings.adminGet('store_design');if(!latest.ok)throw Error();const ack=await w.F99Settings.adminSave('store_design',{...latest.value,renewal_services_links:check.checked},latest.version);if(ack.ok){serviceLinks();return;}if(ack.reason!=='VERSION_CONFLICT')throw Error();}}catch(_){box.append(el('p','تعذر الحفظ؛ أعد المحاولة بعد قراءة الإعدادات.'));}finally{save.disabled=false;}};
    const sel=el('select');sel.append(new Option('اختر عرضًا غير مستخدم لحذفه',''));box.append(sel);let offers=[];
    void w.finoCentralAdminCall('f99v74_owner_offers',{}).then(r=>{offers=r?.data?.items||[];for(const o of offers)sel.append(new Option(o.title,o.id));});
    const remove=el('button','حذف العرض غير المستخدم');remove.type='button';box.append(remove);remove.onclick=async()=>{const o=offers.find(x=>x.id===sel.value);if(!o||!confirm('حذف هذا العرض غير المستخدم فقط؟ لا تُحذف العروض المرتبطة بمخزون أو مشتريات.'))return;remove.disabled=true;try{const r=await w.finoCentralAdminCall('f99r22_admin_delete_renewal_offer',{p_id:o.id,p_expected_version:o.version});box.append(el('p',r?.data?.deleted?'تم حذف العرض غير المستخدم.':'لم يُحذف العرض. العرض المستخدم أو المرتبط بمخزون يُعطّل من إعداداته ولا يُحذف.'));}finally{remove.disabled=false;}};
  }
  function boot(){
    const block=w.F99V43BlockNewCalculation;if(typeof block==='function')w.F99V43BlockNewCalculation=function(){if(w.__F99V43QuotaExhausted===true){void open(currentCode());return true;}return block.apply(this,arguments);};
    const request=w.F99V82RequestNewCalculation;if(typeof request==='function')w.F99V82RequestNewCalculation=async function(){const ctx=w.F99SessionSecurity.context();if(ctx.verified&&ctx.state?.calculator_allowed===false&&Number(ctx.state.remaining_calculations)===0)return open(currentCode());return request.apply(this,arguments);};
    const renew=code=>open(typeof code==='string'&&code.trim()?code:currentCode());w.F99V8OpenRenewal=renew;w.FINO99V74CustomerRenewal=renew;
    w.F99Settings.onChange(serviceLinks);serviceLinks();ownerTools();
    let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;serviceLinks();ownerTools();});}).observe(d.body,{childList:true,subtree:true});
  }
  w.F99Renewal22={open,authorized:()=>Date.now()<validUntil,modeFor,details};
  w.addEventListener('pagehide',()=>{validUntil=0;});
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
