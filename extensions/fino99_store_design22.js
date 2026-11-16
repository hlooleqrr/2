/* FINO99 round22 A: scoped presentation settings; business data stays read-only. */
(function (w, d) {
  'use strict';
  if (w.F99StoreDesign22) return;
  const KEY = 'store_design';
  const FONTS = ['Tajawal','Cairo','Almarai','IBM Plex Sans Arabic','Noto Kufi Arabic','Noto Naskh Arabic','Amiri','Changa','Readex Pro','El Messiri','Reem Kufi','Markazi Text','Mada','Harmattan'];
  const MODES = [['adjacent','متجاور'],['grid','شبكي'],['small','صغير'],['large','كبير'],['carousel','أفقي متحرك'],['auto','تلقائي']];
  const ELEMENTS = [['image','الصورة'],['title','العنوان'],['description','الوصف'],['price','السعر'],['badge','الشارة'],['status','حالة الباقة'],['features','الخدمات والمدة'],['buttons','الأزرار']];
  const COLORS = [['background','خلفية المتجر'],['cardBackground','خلفية البطاقة'],['imageBackground','خلفية الصورة'],['titleColor','العناوين'],['textColor','النصوص'],['priceColor','الأسعار'],['buttonBackground','خلفية الأزرار'],['buttonColor','نص الأزرار'],['borderColor','الحدود']];
  const PALETTES = [
    ['FINO99',['#f8fbfd','#ffffff','#f3f8fc','#1c3d52','#476375','#173d52','#1b6385','#ffffff','#d8e7ed']],
    ['كحلي ذهبي',['#0c2035','#142f48','#1b3b56','#f1d391','#e2ebf2','#f1d391','#c29d4a','#102236','#3d5d75']],
    ['فيروزي',['#effaf8','#ffffff','#e5f5f1','#125d59','#315f5a','#147a71','#147a71','#ffffff','#b4dcd4']],
    ['بنفسجي',['#f5f1fc','#ffffff','#eee7fa','#593a81','#625773','#694599','#694599','#ffffff','#d4c4e8']],
    ['وردي',['#fff3f6','#ffffff','#fde6ee','#963f60','#735862','#a54368','#a54368','#ffffff','#ebc7d5']],
    ['ليلي',['#111827','#1f2937','#273449','#f3f4f6','#d1d5db','#7dd3fc','#0284c7','#ffffff','#425069']],
    ['رملي',['#faf5eb','#ffffff','#f3e8d3','#705132','#75654f','#956d35','#956d35','#ffffff','#e0d0b8']],
    ['أخضر',['#f0f8ef','#ffffff','#e4f1e1','#376c32','#4b6448','#3d7d37','#3d7d37','#ffffff','#c4dcbc']],
    ['مرجاني',['#fff5f0','#ffffff','#ffe5d8','#974c30','#725c51','#b95730','#b95730','#ffffff','#eccbbb']],
    ['أزرق سماوي',['#f0f8ff','#ffffff','#e3f2ff','#225c8e','#49697f','#1675ae','#1675ae','#ffffff','#bfd9ed']],
    ['أحادي',['#f5f5f5','#ffffff','#eeeeee','#202020','#505050','#202020','#333333','#ffffff','#d5d5d5']],
    ['عنابي',['#faf1f3','#ffffff','#f5e3e8','#7c2943','#705560','#91304e','#91304e','#ffffff','#e3bcc8']]
  ];
  const DEFAULT = {mode:'adjacent',theme:'FINO99',font:'original',phoneColumns:2,desktopColumns:3,gap:10,cardWidth:600,cardPadding:11,radius:18,imageSize:100,imageRatio:'natural',titleSize:18,textSize:12,priceSize:20,buttonSize:13,fontWeight:400,titleWeight:900,buttonRadius:12,order:[],hidden:[]};
  COLORS.forEach(([k], i) => DEFAULT[k] = PALETTES[0][1][i]);
  const RANGES = {phoneColumns:[1,4],desktopColumns:[1,8],gap:[0,40],cardWidth:[100,800],cardPadding:[0,40],radius:[0,40],imageSize:[30,100],titleSize:[10,40],textSize:[9,28],priceSize:[10,40],buttonSize:[10,28],fontWeight:[100,900],titleWeight:[100,900],buttonRadius:[0,40]};
  const RATIOS = ['natural','1/1','4/3','16/10','16/9','3/4'];
  const fontLoads = new Map(), previousOrder = new WeakMap();
  let panel, draft = {}, state = {value:{},version:0,history:[]}, frames = [], status, scheduled = false, previewValue = null, busy = false;
  const clone = x => JSON.parse(JSON.stringify(x));
  function owner() { try { return activeAccess?.record?.central === true && activeAccess.record.owner === true && w.F99V60Test?.owner?.() === true; } catch (_) { return false; } }
  function norm(x) {
    const out = {...DEFAULT}; x = x && typeof x === 'object' ? x : {};
    for (const [k,[a,b]] of Object.entries(RANGES)) out[k] = Number.isFinite(Number(x[k])) ? Math.max(a, Math.min(b, Number(x[k]))) : DEFAULT[k];
    out.mode = MODES.some(([v]) => v === x.mode) ? x.mode : DEFAULT.mode;
    out.font = FONTS.includes(x.font) ? x.font : 'original';
    out.imageRatio = RATIOS.includes(x.imageRatio) ? x.imageRatio : 'natural';
    COLORS.forEach(([k]) => { if (/^#[0-9a-f]{6}$/i.test(x[k] || '')) out[k] = x[k]; });
    out.theme = typeof x.theme === 'string' ? x.theme.slice(0,80) : 'FINO99';
    out.order = Array.isArray(x.order) ? [...new Set(x.order.filter(k => typeof k === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(k)))].slice(0,300) : [];
    out.hidden = Array.isArray(x.hidden) ? x.hidden.filter(k => ELEMENTS.some(([v]) => v === k)) : [];
    return out;
  }
  function settingsDesign(value) { return value?.design && typeof value.design === 'object' && Object.keys(value.design).length ? norm(value.design) : null; }
  async function loadFont(name) {
    if (!FONTS.includes(name)) return;
    if (fontLoads.has(name)) return fontLoads.get(name);
    const slug = name.toLowerCase().replaceAll(' ','-'), faceName = 'F99SD22 '+name;
    const task = Promise.all([400,700].flatMap(weight => ['arabic','latin'].map(async subset => {
      const face = new FontFace(faceName, 'url("./vendor/fonts22/'+slug+'/'+slug+'-'+subset+'-'+weight+'-normal.woff2")', {weight:String(weight),style:'normal',display:'swap',unicodeRange:subset==='arabic'?'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F,U+202A-202E,U+10E60-10E7F,U+1EE00-1EEFF':'U+0000-00FF,U+2000-206F'});
      await face.load(); d.fonts.add(face);
    }))).catch(() => { fontLoads.delete(name); if (status) status.textContent = 'تعذر تحميل الخط المحلي؛ بقي الخط الأصلي متاحًا.'; });
    fontLoads.set(name,task); return task;
  }
  function apply(value) {
    const root = d.getElementById('f99s-modal'); if (!root) return;
    const design = settingsDesign(value);
    root.classList.toggle('f99sd22-active',!!design);
    for (const [k] of ELEMENTS) root.removeAttribute('data-sd-hide-'+k);
    root.removeAttribute('data-sd-mode');
    for (const key of [...Object.keys(DEFAULT),'font']) root.style.removeProperty('--sd-'+key);
    const cards = [...root.querySelectorAll('.f99v6-tile[data-product-key]')];
    if (!design) {
      for (const c of cards) if (previousOrder.has(c)) { c.style.order=previousOrder.get(c); previousOrder.delete(c); }
      return;
    }
    root.dataset.sdMode = design.mode;
    design.hidden.forEach(k => root.setAttribute('data-sd-hide-'+k,''));
    for (const [k,v] of Object.entries(design)) {
      if (k in RANGES) root.style.setProperty('--sd-'+k, ['phoneColumns','desktopColumns','fontWeight','titleWeight'].includes(k) ? String(v) : v+(k==='imageSize'?'%':'px'));
    }
    COLORS.forEach(([k]) => root.style.setProperty('--sd-'+k,design[k]));
    root.style.setProperty('--sd-imageRatio',design.imageRatio==='natural'?'auto':design.imageRatio);
    if (design.font !== 'original') { void loadFont(design.font); root.style.setProperty('--sd-font','"F99SD22 '+design.font+'",Tahoma,sans-serif'); }
    cards.forEach((c, i) => {
      if (!previousOrder.has(c)) previousOrder.set(c,c.style.order);
      if (!design.order.length) { c.style.order=previousOrder.get(c); return; }
      const idx=design.order.indexOf(c.dataset.productKey); c.style.order=String(idx<0?design.order.length+i:idx);
    });
  }
  function current() { return previewValue !== null ? previewValue : (w.F99Settings?.value(KEY) || {}); }
  function node(tag,text,cls) { const n=d.createElement(tag); if (text!=null) n.textContent=text; if(cls)n.className=cls; return n; }
  function button(host,text,fn) { const b=node('button',text);b.type='button';b.addEventListener('click',()=>{if(!owner())return close();Promise.resolve(fn()).catch(()=>message('تعذر الاتصال بالمركزية؛ لم يُحفظ التغيير.'));});host.append(b);return b; }
  function message(text) { if(status)status.textContent=text; }
  function field(host,key,label,type,options) {
    const l=node('label'), caption=node('span',label), input=node(type==='select'?'select':'input'); l.append(caption,input);host.append(l);input.dataset.sdField=key;
    if(type==='select')options.forEach(([v,t])=>input.append(new Option(t,v)));else input.type=type;
    if(RANGES[key]){input.min=RANGES[key][0];input.max=RANGES[key][1];input.step=1;}
    input.value=draft[key];
    input.addEventListener('input',()=>{if(!owner())return close();draft[key]=RANGES[key]?Number(input.value):input.value;draft=norm(draft);renderPreviews();});return input;
  }
  function group(title) { const box=node('fieldset');box.append(node('legend',title));panel.append(box);const fields=node('div',null,'sd-fields');box.append(fields);return fields; }
  function syncFields() {
    panel.querySelectorAll('[data-sd-field]').forEach(n=>n.value=draft[n.dataset.sdField]);
    panel.querySelectorAll('[data-sd-element]').forEach(n=>n.checked=!draft.hidden.includes(n.dataset.sdElement));
    const productsHost=panel.querySelector('[data-sd-products]');if(productsHost)renderProducts(productsHost);
  }
  function modeDefaults(mode) {
    const modes={adjacent:{phoneColumns:2,desktopColumns:3,cardWidth:600,cardPadding:11,titleSize:18,textSize:12},grid:{phoneColumns:2,desktopColumns:4,cardWidth:600,cardPadding:14,titleSize:17,textSize:12},small:{phoneColumns:3,desktopColumns:5,cardWidth:240,cardPadding:6,titleSize:13,textSize:10,imageSize:80},large:{phoneColumns:1,desktopColumns:2,cardWidth:700,cardPadding:20,titleSize:24,textSize:16,imageSize:100},carousel:{phoneColumns:2,desktopColumns:3,cardWidth:280,cardPadding:12,titleSize:18,textSize:12},auto:{phoneColumns:2,desktopColumns:3,cardWidth:160,cardPadding:8,titleSize:16,textSize:11}};
    draft=norm({...draft,...modes[mode],mode});syncFields();renderPreviews();
  }
  function customThemes() { return Array.isArray(state.value?.customThemes) ? state.value.customThemes.filter(t=>typeof t?.name==='string'&&t.design).slice(0,24) : []; }
  function themeOptions() { return [['FINO99','هوية FINO99 الحالية — الأصل'],...PALETTES.slice(1).map(([name])=>[name,name]),...customThemes().map(t=>['custom:'+t.name,'مخصص: '+t.name])]; }
  function themeSelect(value) {
    if(value==='FINO99'){draft=clone(DEFAULT);draft.theme='FINO99';}
    else if(value.startsWith('custom:')){const t=customThemes().find(t=>'custom:'+t.name===value);if(t){draft=norm(t.design);draft.theme=value;}}
    else { const p=PALETTES.find(([name])=>name===value);if(p){COLORS.forEach(([k],i)=>draft[k]=p[1][i]);draft.theme=value;} }
    syncFields();renderPreviews();
  }
  function refreshHistory() {
    const select=panel?.querySelector('[data-sd-history]');if(!select)return;
    select.replaceChildren(new Option('الشكل الأصلي',0));
    (state.history||[]).forEach(h=>select.append(new Option('الإصدار '+h.version+' — '+new Date(h.saved_at).toLocaleString('ar-SA'),h.version)));
  }
  async function read() { const r=await w.F99Settings.adminGet(KEY); if(!r?.ok)throw Error('READ_FAILED');state=r;return r; }
  async function save(value) {
    if(busy)return;busy=true;message('جارٍ حفظ المظهر فقط...');
    try {
      const latest=await w.F99Settings.adminGet(KEY);if(!latest?.ok)throw Error('READ_FAILED');
      if(latest.version!==state.version){state=latest;refreshHistory();message('تغيّر التصميم في جلسة أخرى؛ راجع المعاينة واضغط حفظ مجددًا.');return;}
      const payload={...latest.value,...value,schema:1};
      const r=await w.F99Settings.adminSave(KEY,payload,latest.version);
      if(!r.ok){if(r.reason==='VERSION_CONFLICT'){await read();refreshHistory();message('تعارض إصدار؛ لم يُكتب فوق تصميم جلسة أخرى. راجع ثم أعد الحفظ.');return;}throw Error('SAVE_FAILED');}
      await read();refreshHistory();message('حُفظ تصميم المتجر في المركزية. الباقات والمخزون والأسعار وروابط الشراء لم تتغير.');
    } finally {busy=false;}
  }
  async function restore(version) {
    if(busy)return;busy=true;
    try {
      const r=await w.F99Settings.adminRestore(KEY,Number(version),state.version);
      if(!r.ok){await read();refreshHistory();message('لم تتم الاستعادة؛ تحقّق من الإصدار ثم أعد المحاولة.');return;}
      await read();draft=settingsDesign(state.value)||clone(DEFAULT);syncFields();renderPreviews();refreshHistory();message(Number(version)===0?'استُعيد الشكل الأصلي.':'استُعيد الشكل السابق المحفوظ.');
    } finally {busy=false;}
  }
  function products() { try {return (w.FINO99ReadStorefront?.().products||[]).filter(p=>p.key);}catch(_){return [];} }
  function renderProducts(host) {
    host.replaceChildren(); const all=products(); const order=draft.order;
    all.sort((a,b)=>{const aidx=order.indexOf(a.key),bidx=order.indexOf(b.key);return (aidx<0?999:aidx)-(bidx<0?999:bidx);});
    all.forEach((p,i)=>{const row=node('div',null,'sd-product');row.append(node('span',p.name||p.key));host.append(row);
      for(const [label,step]of [['أعلى',-1],['أسفل',1]]){const b=button(row,label,()=>{const keys=all.map(p=>p.key),j=i+step;if(j<0||j>=keys.length)return;[keys[i],keys[j]]=[keys[j],keys[i]];draft.order=keys;renderProducts(host);renderPreviews();});b.disabled=i+step<0||i+step>=all.length;}
    });
  }
  function renderPreviews() {
    frames.forEach(({iframe})=>{try{iframe.contentWindow.F99StoreDesign22?.setPreview({design:clone(draft)});}catch(_){}});
  }
  function previews() {
    const box=node('fieldset');box.append(node('legend','معاينة حية — الآيفون والكمبيوتر'));panel.append(box);
    box.append(node('p','هذه نفس بطاقات المتجر العامة في إطار معزول؛ التغييرات لا تُنشر إلا عند الحفظ.'));
    const wrap=node('div',null,'sd-previews');box.append(wrap);frames=[];
    [[390,844,'آيفون 390 × 844'],[1366,900,'كمبيوتر 1366 × 900']].forEach(([width,height,label])=>{
      const holder=node('div');holder.append(node('b',label));const frameBox=node('div',null,'sd-frame-box');holder.append(frameBox);wrap.append(holder);
      const iframe=node('iframe');iframe.title=label;iframe.src='./?f99designpreview=22';iframe.width=width;iframe.height=height;frameBox.append(iframe);iframe.addEventListener('load',()=>{renderPreviews();});
      const entry={iframe,frameBox,width,height};frames.push(entry);
      const resize=()=>{const available=Math.min(width,Math.max(250,panel.clientWidth-50),width===1366?690:width);const scale=available/width;frameBox.style.width=available+'px';frameBox.style.height=(height*scale)+'px';iframe.style.transform='scale('+scale+')';};
      resize();const ro=new ResizeObserver(resize);ro.observe(panel);entry.observer=ro;
    });
  }
  async function open() {
    if(!owner())return;
    await read(); if(!owner())return;
    close();draft=settingsDesign(state.value)||clone(DEFAULT);
    panel=node('section');panel.id='f99sd22-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','f99sd22-title');d.body.append(panel);
    const head=node('header',null,'sd-head');panel.append(head);const title=node('h1','تصميم المتجر والمظهر');title.id='f99sd22-title';head.append(title);button(head,'إغلاق',close);
    panel.append(node('p','الهوية الحالية هي الافتراضية. هذه الإعدادات تغيّر العرض فقط ولا تغيّر الباقات أو المخزون أو الأسعار أو حالات البيع.'));
    let fields=group('الأنماط والثيمات والخطوط');const mode=field(fields,'mode','نمط العرض','select',MODES);mode.addEventListener('change',()=>modeDefaults(mode.value));
    const theme=field(fields,'theme','الثيم الجاهز أو المخصص','select',themeOptions());theme.addEventListener('change',()=>themeSelect(theme.value));
    field(fields,'font','مكتبة الخطوط العربية الحرة','select',[['original','الخط الأصلي للهوية'],...FONTS.map(x=>[x,x])]);
    fields=group('البطاقات والصور والأعمدة والمسافات');
    [['phoneColumns','أعمدة الآيفون'],['desktopColumns','أعمدة الكمبيوتر'],['gap','المسافات (بكسل)'],['cardWidth','الحد الأقصى لعرض البطاقة (بكسل)'],['cardPadding','المساحة الداخلية (بكسل)'],['radius','تدوير البطاقة (بكسل)'],['imageSize','حجم الصورة (%)']].forEach(([k,l])=>field(fields,k,l,'number'));
    field(fields,'imageRatio','نسبة إطار الصورة — الصورة كاملة دون قص','select',RATIOS.map(x=>[x,x==='natural'?'الأبعاد الطبيعية الأصلية':x]));
    fields=group('أحجام الخطوط وأوزانها');[['titleSize','حجم العنوان'],['textSize','حجم الوصف والنص'],['priceSize','حجم السعر'],['buttonSize','حجم نص الأزرار'],['fontWeight','وزن النص'],['titleWeight','وزن العناوين'],['buttonRadius','تدوير الأزرار']].forEach(([k,l])=>field(fields,k,l,'number'));
    fields=group('مكتبة الألوان والتخصيص');COLORS.forEach(([k,l])=>field(fields,k,l,'color'));
    const palette=node('div',null,'sd-actions');fields.parentElement.append(palette);PALETTES.forEach(([name,colors])=>{const b=button(palette,name,()=>{COLORS.forEach(([k],i)=>draft[k]=colors[i]);draft.theme=name;syncFields();renderPreviews();});b.style.background=colors[6];b.style.color=colors[7];});
    const swatches=node('div',null,'sd-actions');fields.parentElement.append(swatches);
    [...new Set(PALETTES.flatMap(p=>p[1]))].forEach(color=>{const b=button(swatches,'',()=>{const key=panel.querySelector('[data-sd-color-target]').value;draft[key]=color;syncFields();renderPreviews();});b.className='sd-swatch';b.title=color;b.setAttribute('aria-label',color);b.style.background=color;});
    const target=node('select');target.dataset.sdColorTarget='';COLORS.forEach(([k,l])=>target.append(new Option('تطبيق اللون على '+l,k)));fields.parentElement.insertBefore(target,swatches);
    const custom=node('div',null,'sd-actions'),name=node('input');name.placeholder='اسم الثيم المخصص';name.maxLength=80;name.setAttribute('aria-label','اسم الثيم المخصص');custom.append(name);fields.parentElement.append(custom);
    button(custom,'حفظ كثيم مخصص',async()=>{const text=name.value.trim();if(!text)return message('اكتب اسم الثيم.');if(customThemes().length>=24&&!customThemes().some(t=>t.name===text))return message('الحد 24 ثيمًا مخصصًا؛ اختر اسمًا محفوظًا لاستبداله.');draft.theme='custom:'+text;const list=customThemes().filter(t=>t.name!==text);list.push({name:text,design:clone(draft)});await save({design:clone(draft),customThemes:list});theme.replaceChildren(...themeOptions().map(([v,t])=>new Option(t,v)));syncFields();});
    fields=group('عناصر البطاقة وترتيب المنتجات');ELEMENTS.forEach(([key,label])=>{const l=node('label',null,'sd-check'),input=node('input');input.type='checkbox';input.dataset.sdElement=key;input.checked=!draft.hidden.includes(key);input.addEventListener('change',()=>{if(!owner())return close();draft.hidden=draft.hidden.filter(x=>x!==key);if(!input.checked)draft.hidden.push(key);renderPreviews();});l.append(input,node('span','إظهار '+label));fields.append(l);});
    const order=node('div');order.dataset.sdProducts='';fields.parentElement.append(order);renderProducts(order);button(fields.parentElement,'الترتيب الأصلي',()=>{draft.order=[];renderProducts(order);renderPreviews();});
    previews();
    const actions=node('div',null,'sd-actions');panel.append(actions);button(actions,'حفظ الشكل',()=>save({design:clone(draft)}));button(actions,'استرجاع الشكل الأصلي',()=>restore(0));
    const history=node('select');history.dataset.sdHistory='';history.setAttribute('aria-label','سجل الأشكال السابقة');actions.append(history);button(actions,'استرجاع الشكل السابق',()=>restore(history.value));refreshHistory();
    status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);message('معاينة غير محفوظة؛ آخر إصدار محفوظ: '+state.version);
    panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});head.querySelector('button').focus();
  }
  function close() {frames.forEach(f=>f.observer?.disconnect());frames=[];panel?.remove();panel=null;status=null;}
  function enhanceOwner() {
    if(!owner()){close();d.getElementById('f99sd22-gateway')?.remove();d.getElementById('f99sd22-entry')?.remove();return;}
    const nav=d.querySelector('#f99od13-desktop .f99od13-gateways');
    if(nav&&!d.getElementById('f99sd22-gateway')){const b=button(nav,'',open);b.id='f99sd22-gateway';b.className='f99od13-gateway';b.append(node('b','تصميم المتجر والمظهر'),node('small','أنماط وثيمات وخطوط عربية ومعاينة وحفظ واستعادة'));}
    const grid=d.querySelector('#ownerHub .owner-grid');
    if(grid&&!d.getElementById('f99sd22-entry')){const b=button(grid,'',open);b.id='f99sd22-entry';b.className='owner-tile';b.append(node('b','تصميم المتجر والمظهر'),node('small','تخصيص العرض فقط'));}
  }
  function schedule() {if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;apply(current());enhanceOwner();},100);}
  function boot() {
    w.F99Settings?.onChange(()=>apply(current()));apply(current());enhanceOwner();
    // Observe structural changes only: applying scoped style/attributes cannot retrigger it.
    new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});
    setInterval(enhanceOwner,1500);
    if(new URLSearchParams(location.search).get('f99designpreview')==='22'&&w.parent!==w){
      const style=node('style');style.textContent='body{margin:0!important;overflow-x:hidden!important}body> :not(#f99s-modal):not(style):not(script):not(link){display:none!important}#f99s-modal{display:block!important;position:static!important;padding:0!important;background:transparent!important}#f99s-modal .f99s-sheet{width:100%!important;max-width:100%!important;margin:0!important}#f99s-modal .f99v6-h{display:none!important}';d.head.append(style);
      w.F99Settings?.ready.then(()=>{w.FINO99OpenStorefront?.();setTimeout(()=>{const modal=d.getElementById('f99s-modal');if(modal)modal.inert=true;apply(current());w.parent.F99StoreDesign22?.refreshPreviews();},500);});
    }
  }
  w.F99StoreDesign22 = {open,close,apply,normalize:norm,fonts:FONTS.slice(),modes:MODES.map(x=>x[0]),setPreview(value){if(w.parent===w||new URLSearchParams(location.search).get('f99designpreview')!=='22')return;previewValue=value;apply(value);},refreshPreviews:renderPreviews};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);
