/* FINO99 G22: renewal is a read-only customer scope, never a calculator bearer.
 * New = package-linked V74/V77 Salla stock offers. Old = V29 owner-confirmed
 * same-code renewal (V50 voucher writes remain disabled by the original server).
 */
(function () {
  'use strict';
  const w = window, d = document;
  const words = {
    invite: ['نفاد الاستخدامات','دعوة التجديد','يا {client}، خلصت حسبات باقتك، وعندك عرض خاص للتجديد. ودّك تجدّد وتحسب من جديد؟',['client']],
    expired: ['نفاد الاستخدامات','دعوة تجديد المدة','يا {client}، انتهت مدة باقتك، وعندك عروض خاصة للتجديد. ودّك تشوفها؟',['client']],
    view: ['رسائل التجديد','عرض العروض','نعم، أشوف العروض'],
    later: ['رسائل التجديد','تأجيل التجديد','ليس الآن'],
    title: ['رسائل التجديد','عنوان التجديد','تجديد الكود'],
    inquiry: ['رسائل التجديد','الاستعلام عن الكود','الاستعلام عن الكود'],
    code: ['رسائل التجديد','حقل الكود','كود الباقة'],
    enter: ['رسائل التجديد','تحقق من الكود','عرض فرصة التجديد'],
    buy: ['رسائل التجديد','زر الشراء','ادفع الآن'],
    price: ['رسائل التجديد','سعر العرض','{price} ريال',['price']],
    terms: ['رسائل التجديد','مدة وحسبات العرض','صلاحية الباقة: {duration} | عدد الحسبات: {calcs}',['minutes','count','duration','calcs']],
    empty: ['رسائل التجديد','عدم توفر عروض','لا توجد عروض تجديد مفعلة الآن. يمكنك العودة لاحقًا.'],
    stock: ['رسائل التجديد','نفاد مخزون العرض','العرض غير متاح حاليًا.'],
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
  async function details(code){const r=await w.finoRpc('f99r22_renewal_context',{p_code:normalized(code),p_device_id:w.F99S12Runtime.device()},15000);if(r?.ok&&r.data?.ok)return r.data;/* r24: valid code with balance -> active (no renewal, no error) */if(r?.ok&&r.data?.reason==='CODE_NOT_EXHAUSTED')return {status:'active'};return null;}
  function page(){let p=d.getElementById('f99r22RenewalPage');if(!p){p=el('section',null,'page');p.id='f99r22RenewalPage';p.dir='rtl';const viewport=el('div',null,'viewport');const chat=el('div',null,'f99r22-chat');chat.setAttribute('role','log');viewport.append(chat);p.append(viewport);d.body.append(p);}return p;}
  function close(card){card?.remove();validUntil=0;current=null;serial++;if(w.F99SessionSecurity.context()?.verified)w.showPage?.('freeHub');else w.showPage?.('page1');}
  function offerCard(host,o){const c=el('article',null,'f99r22-offer');c.dataset.offerId=o.id;host.append(c);c.append(el('h4',o.title),el('strong',t('price',{price:Number(o.price_sar??o.price).toLocaleString('en-US',{maximumFractionDigits:2})})),el('p',t('terms',{minutes:o.duration_minutes,count:o.max_calculations,duration:(w.F99DurationAr?w.F99DurationAr(o.duration_minutes):o.duration_minutes),calcs:(w.F99CalcCountAr?w.F99CalcCountAr(o.max_calculations):o.max_calculations)})));return c;}
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
  // r26 §4: the renewal card is owner-controlled per package (text, colours, price note, placement).
  function cardCfg(ctx){const c=(w.F99Settings?.packageOption(ctx.package_key,'renewal_card',{})||{});const client=ctx.client_name||t('client');
    return {enabled:c.enabled!==false,badge:c.badge||'عرض خاص',title:c.title||t(ctx.status==='expired'?'expiredNotice':'finishedNotice'),
      body:c.body||t(ctx.status==='expired'?'expired':'invite',{client}),cta:c.cta||t('buy'),later:c.later||t('later'),
      note:c.note||'',bg:c.bg||'#0b1220',accent:c.accent||'#d4af37',text:c.text||'#ffffff',offerId:c.offer_id||'',
      placement:c.placement||'overlay'};}
  function bestOffer(ctx,id){const now=Date.parse(ctx.server_now);const list=(ctx.offers||[]).filter(o=>Number(o.available)>0&&safeURL(o.checkout_url)&&(!o.offer_expires_at||Date.parse(o.offer_expires_at)>now));
    if(id){const x=list.find(o=>o.id===id);if(x)return x;}
    return list.slice().sort((a,b)=>Number(a.price_sar)-Number(b.price_sar))[0]||null;}
  /* r86: the mortgage package keeps its approved renewal (price + Salla link) in its own sale settings (f99r43_mortgage_sale → f99r65_public), not in the generic renewal-offers table. */
  let mg86=null;async function mgRenewal(ctx){try{if(!mg86){const r=await w.finoRpc('f99r65_public',{},12000);if(r&&r.ok&&r.data&&r.data.ok)mg86=r.data;}const p=mg86;if(!p||!ctx||!p.key||p.key!==ctx.package_key)return null;const u=safeURL(p.renewal&&p.renewal.url),pr=Number(p.renewal&&p.renewal.price);return u&&pr>0?{id:'r86-mg',mg:true,price_sar:pr,checkout_url:u}:null;}catch(_){return null;}}
  function mgName(){try{const v=new Set();for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i)||'';if(/^f99re59n:/.test(k)&&!/^f99re59n:transfer:/.test(k)){const n=String(w.localStorage.getItem(k)||'').replace(/[<>`]/g,'').replace(/\s+/g,' ').trim().slice(0,40);if(n.length>=2)v.add(n);}}return v.size===1?[...v][0]:'';}catch(_){return '';}}
  const mgSeen=code=>{try{return !!w.sessionStorage.getItem('f99r86rn:'+code);}catch(_){return false;}};
  function money2(v){return Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function overlayCard(ctx,code,options,c){d.getElementById('f99r26Renewal')?.remove();
    const wrap=el('div');wrap.id='f99r26Renewal';
    Object.assign(wrap.style,{position:'fixed',top:'0',right:'0',bottom:'0',left:'0',background:'rgba(3,8,16,.74)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',zIndex:'99999',direction:'rtl'});
    const card=el('section');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
    Object.assign(card.style,{width:'100%',maxWidth:'430px',background:c.bg,color:c.text,borderRadius:'22px',padding:'24px 20px',boxShadow:'0 24px 60px rgba(0,0,0,.5)',textAlign:'center',fontFamily:'inherit'});
    const badge=el('span',c.badge);Object.assign(badge.style,{display:'inline-block',background:c.accent,color:'#111',borderRadius:'999px',padding:'4px 14px',fontSize:'12px',fontWeight:'700'});
    const h=el('h3',c.title);Object.assign(h.style,{margin:'14px 0 8px',fontSize:'21px',lineHeight:'1.6',color:c.text,fontWeight:'800'});
    const body=el('p',c.body);Object.assign(body.style,{margin:'0 0 16px',fontSize:'14px',lineHeight:'1.9',opacity:'.88',color:c.text});
    const o=bestOffer(ctx,c.offerId)||ctx.mg86||null,M86=!!(o&&o.mg);
    if(M86){const nm=ctx.client_name||mgName()||t('client');h.textContent='🎁 عرض خاص لتجديد باقتك!';body.textContent=ctx.status==='expired'?c.body:'يا '+nm+'، استخدمت جميع حسابات باقتك.';const b2=el('p','جدّد باقتك بـ'+Number(o.price_sar).toLocaleString('en-US',{maximumFractionDigits:2})+' ريال وواصل حساباتك دون إعادة إدخال بياناتك.');Object.assign(b2.style,{margin:'-6px 0 18px',fontSize:'15px',lineHeight:'1.9',fontWeight:'700',color:c.text});card.append(h,body,b2);}
    else card.append(badge,h,body);
    if(o&&!M86){const price=el('div');Object.assign(price.style,{fontSize:'36px',fontWeight:'800',color:c.accent,lineHeight:'1.1'});
      price.textContent=money2(o.price_sar);const cur=el('small',' ريال');Object.assign(cur.style,{fontSize:'15px',color:c.text,fontWeight:'600',marginRight:'4px'});price.append(cur);card.append(price);
      const terms=el('p',t('terms',{minutes:o.duration_minutes,count:o.max_calculations,duration:(w.F99DurationAr?w.F99DurationAr(o.duration_minutes):o.duration_minutes),calcs:(w.F99CalcCountAr?w.F99CalcCountAr(o.max_calculations):o.max_calculations)}));Object.assign(terms.style,{fontSize:'13px',opacity:'.78',margin:'8px 0 18px',color:c.text});card.append(terms);}
    else if(!o){const none=el('p',t('stock'));Object.assign(none.style,{fontSize:'14px',opacity:'.9',margin:'8px 0 18px'});card.append(none);}
    if(c.note){const n=el('p',c.note);Object.assign(n.style,{fontSize:'12px',opacity:'.7',margin:'-8px 0 14px'});card.append(n);}
    const say=m=>{let n=card.querySelector('[data-r26-msg]');if(!n){n=el('p');n.dataset.r26Msg='1';Object.assign(n.style,{fontSize:'13px',color:c.accent,margin:'10px 0 0'});card.append(n);}n.textContent=m;};
    if(M86){const buy=el('button','جدّد الآن');buy.type='button';Object.assign(buy.style,{display:'block',width:'100%',background:c.accent,color:'#111',border:'0',borderRadius:'14px',padding:'15px',fontSize:'16px',fontWeight:'800',cursor:'pointer'});
      buy.onclick=()=>{const x=w.open(o.checkout_url,'_blank');if(x){try{x.opener=null;}catch(_){}}else w.location.href=o.checkout_url;};card.append(buy);} // r86: opened directly from the tap (iPhone blocks windows opened after a network wait)
    else if(o){const buy=el('button',c.cta);buy.type='button';Object.assign(buy.style,{display:'block',width:'100%',background:c.accent,color:'#111',border:'0',borderRadius:'14px',padding:'15px',fontSize:'16px',fontWeight:'800',cursor:'pointer'});
      buy.onclick=async()=>{buy.disabled=true;try{const latest=await details(code);const lc=latest&&bestOffer(latest,c.offerId);
        // re-verify stock, price and the checkout link right before leaving; never open a stale or unavailable product.
        if(!latest||latest.status==='active'||!lc||lc.id!==o.id||Number(lc.price_sar)!==Number(o.price_sar)||safeURL(lc.checkout_url)!==safeURL(o.checkout_url)){say(t('changed'));return;}
        w.open(safeURL(lc.checkout_url),'_blank','noopener,noreferrer');}catch(_){say(t('failed'));}finally{buy.disabled=false;}};
      card.append(buy);}
    const later=el('button',c.later);later.type='button';
    Object.assign(later.style,{display:'block',width:'100%',background:'transparent',color:c.text,border:'1px solid rgba(255,255,255,.25)',borderRadius:'14px',padding:'12px',fontSize:'14px',marginTop:'10px',cursor:'pointer',opacity:'.85'});
    later.onclick=()=>{if(M86){try{w.sessionStorage.setItem('f99r86rn:'+code,'1');}catch(_){}}wrap.remove();validUntil=0;current=null;serial++;if(typeof options.onLater==='function')return options.onLater();w.showPage?.('page1');};
    card.append(later);wrap.append(card);d.body.append(wrap);return true;}

  async function open(code,options={}){const id=++serial;let ctx;try{ctx=await details(code);}catch(_){}
    if(id!==serial)return false;
    // r24: a valid code with remaining calculations is never treated as exhausted/expired.
    if(ctx&&ctx.status==='active')return false;
    const active=w.F99SessionSecurity.context()?.verified===true;
    const host=active?d.getElementById('finoBotChat'):page().querySelector('.f99r22-chat');
    if(!ctx){if(active&&host)status(host,'failed');else {validUntil=0;current=null;w.showPage?.('page1');const error=d.getElementById('f99l-error');if(error)error.textContent=t('failed');}return false;}
    // r25: inside the exit sequence a disabled renewal shows no card (the sequence continues).
    if(options.exit===true&&modeFor(ctx)==='off')return false;
    const cc=cardCfg(ctx);
    if(!bestOffer(ctx,cc.offerId)){const m=await mgRenewal(ctx);if(id!==serial)return false;if(m){ctx.mg86=m;if(options.exit===true&&mgSeen(normalized(code)))return false;}}
    // r26 §3/§4: exhausted or expired entry shows the card immediately, never the old conversation.
    if(cc.enabled&&(options.entry===true||options.exit===true||cc.placement==='overlay'))return overlayCard(ctx,normalized(code),options,cc);
    if(!active)host.replaceChildren();host.querySelector('.f99r22-renewal')?.remove();
    current={code:normalized(code),ctx};validUntil=Date.now()+600000;
    const card=el('section',null,'f99r22-renewal');card.setAttribute('role','status');host.append(card);
    if(cc.enabled){card.style.background=cc.bg;card.style.color=cc.text;card.style.borderColor=cc.accent;}
    const client=ctx.client_name||options.clientName||t('client');
    card.append(el('strong',t(ctx.status==='expired'?'expiredNotice':'finishedNotice'),'f99r22-notice'),el('p',t(ctx.status==='expired'?'expired':'invite',{client})));
    const offers=el('div',null,'f99r22-offers');offers.hidden=true;card.append(offers);
    const actions=el('div',null,'f99r22-actions');card.append(actions);
    if(modeFor(ctx)!=='off'){const view=btn(actions,'view',()=>{offers.hidden=false;offers.replaceChildren();showOffers(offers,ctx,normalized(code));if(['new','both'].includes(modeFor(ctx)))purchased(offers,normalized(code));view.remove();offers.scrollIntoView({block:'start',behavior:'smooth'});});view.classList.add('f99r22-primary');}
    else card.querySelector('p').textContent=t('off');
    btn(actions,'later',()=>{if(typeof options.onLater==='function'){card.remove();validUntil=0;current=null;serial++;return options.onLater();}close(card);});
    // r24: saved-review sections are paused in the customer UI (records kept on the server).
    if(!active)w.showPage?.('f99r22RenewalPage');card.scrollIntoView({block:'start',behavior:'smooth'});return true;
  }
  function inquiry(host){host.querySelector('.f99r22-code-entry')?.remove();const row=el('div',null,'f99r22-code-entry'),label=el('label',t('code')),input=el('input');input.dir='ltr';input.autocomplete='off';input.maxLength=32;label.append(input);row.append(label);host.append(row);btn(row,'enter',()=>open(input.value));input.focus();}
  // r24: the code typed at the login form is kept for THIS tab session only (sessionStorage, cleared with the session)
  // so the in-chat renewal card can verify the exhausted/expired code. Never sent anywhere else.
  const CODE_KEY='f99r24-renewal-code';let typed='';
  function rememberTyped(v){const c=normalized(v||'');if(!c)return;typed=c;try{w.sessionStorage.setItem(CODE_KEY,c);}catch(_){}}
  function forgetTyped(){typed='';try{w.sessionStorage.removeItem(CODE_KEY);}catch(_){}}
  d.addEventListener('click',e=>{if(e.target?.closest?.('#f99l-enter'))rememberTyped(d.getElementById('f99l-code')?.value);},true);
  d.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='f99l-code')rememberTyped(e.target.value);},true);
  function currentCode(){let s='';try{s=w.sessionStorage.getItem(CODE_KEY)||'';}catch(_){}
    // the typed code is used only while a verified entry session exists in this tab (cleared on logout/exit)
    let live=false;try{live=!!w.finoCentralRestoreEntry?.()?.entryToken;}catch(_){}if(!live){s='';if(!current)typed='';}try{return current?.code||typed||s||w.finoCentralRestoreEntry()?.code||activeAccess?.record?.code||f99LastAttemptedCode||'';}catch(_){return current?.code||typed||s||'';}}
  // r24: owner order — no «تجديد الكود»/«الاستعلام عن الكود» buttons on top of customer pages.
  function serviceLinks(){d.querySelectorAll('.f99r22-links').forEach(n=>n.remove());}
  function ownerTools(){let owner=false;try{owner=activeAccess?.record?.owner===true&&activeAccess.record.central===true;}catch(_){}if(!owner)return;
    const root=d.querySelector('#f76-modal main');if(!root||root.querySelector('.f99r22-owner'))return;const box=el('section',null,'f76-card f99r22-owner');root.append(box);box.append(el('h3','حذف عرض تجديد غير مستخدم'));
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
  w.F99Renewal22={open,openCurrent:(o)=>open(currentCode(),o||{}),authorized:()=>Date.now()<validUntil,modeFor,details};
  w.addEventListener('pagehide',()=>{validUntil=0;});
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
