/* Round22 C: owner-only package options, sparse CAS merge. No fictitious display mode. */
(function () {
  'use strict';
  function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
  async function save(id,fields){
    for(let i=0;i<3;i++){
      const current=await window.F99Settings.adminGet('package_options');
      if(!current?.ok)throw Error('تعذر قراءة خيارات الباقة');
      const item=current.item||current;
      const value=JSON.parse(JSON.stringify(item.value||{}));
      value[id]={...(value[id]||{}),ask_beneficiary:fields.ask_beneficiary,renewal_mode:fields.renewal_mode,...(fields.renewal_card?{renewal_card:fields.renewal_card}:{}),...(fields.f34?{extra_services:fields.f34.extra,reduce_term:fields.f34.term}:{})};
      const r=await window.F99Settings.adminSave('package_options',value,item.version||0);
      if(r?.ok)return r;
      if(!/VERSION|CONFLICT/i.test(String(r?.reason||r?.error||'')))throw Error('لم تعتمد المركزية حفظ خيارات الباقة');
    }
    throw Error('تغيرت الإعدادات أثناء الحفظ؛ أعد المحاولة');
  }
  function mount(){
    if(!activeAccess?.record?.owner)return;
    document.querySelectorAll('#f99v6-admin-products .f99s-product[data-package-key]').forEach(row=>{
      if(row.querySelector('[data-c22-package-options]'))return;
      const id=row.dataset.packageKey;
      const section=node('section');section.dataset.c22PackageOptions='1';section.className='f99v6-check-list';section.style.display='block';section.append(node('h4','خيارات الباقة'));
      const lab=node('label');const ask=node('input');ask.type='checkbox';ask.dataset.c22Ask='1';ask.checked=window.F99Settings.packageOption(id,'ask_beneficiary',true)!==false;lab.append(ask,node('span',' سؤال اسم المستفيد'));section.append(lab);
      // r34 §12: owner switches for the post-result extra services and the client term reduction.
      const xLab=node('label');const xOn=node('input');xOn.type='checkbox';xOn.dataset.c22Extra='1';xOn.checked=window.F99Settings.packageOption(id,'extra_services',true)!==false;xLab.append(xOn,node('span',' إظهار «خيارات إضافية للحسبة»'));section.append(xLab);
      const tLab=node('label');const tOn=node('input');tOn.type='checkbox';tOn.dataset.c22Term='1';tOn.checked=window.F99Settings.packageOption(id,'reduce_term',true)!==false;tLab.append(tOn,node('span',' تفعيل «أبي أقلل مدة التمويل»'));section.append(tLab);
      const modeLabel=node('label','نمط التجديد');const mode=node('select');mode.dataset.c22Renewal='1';[['old','التجديد القديم'],['new','التجديد الجديد'],['both','إظهار الاثنين'],['off','تعطيل التجديد']].forEach(([v,t])=>mode.append(new Option(t,v)));mode.value=window.F99Settings.packageOption(id,'renewal_mode','old');modeLabel.append(mode);section.append(modeLabel);
      // r26 §4: full owner control of the renewal card for this package.
      const rc=window.F99Settings.packageOption(id,'renewal_card',{})||{};
      const box=node('details');box.dataset.c22RenewalCard='1';box.append(node('summary','بطاقة التجديد — النص والتصميم'));
      const on=node('input');on.type='checkbox';on.dataset.c22CardOn='1';on.checked=rc.enabled!==false;const onLab=node('label');onLab.append(on,node('span',' إظهار بطاقة التجديد'));box.append(onLab);
      const mk=(label,key,value,ph)=>{const l=node('label',label+' ');const i=node('input');i.dataset.c22Card=key;i.value=value==null?'':String(value);if(ph)i.placeholder=ph;l.append(i);box.append(l);return i;};
      const f={badge:mk('شارة البطاقة','badge',rc.badge||'عرض خاص'),title:mk('العنوان','title',rc.title||''),body:mk('النص','body',rc.body||''),cta:mk('زر الشراء','cta',rc.cta||'اشترِ الآن'),later:mk('زر التأجيل','later',rc.later||'ليس الآن'),note:mk('ملاحظة صغيرة','note',rc.note||''),offer_id:mk('معرّف العرض (اختياري)','offer_id',rc.offer_id||''),
        bg:mk('لون الخلفية','bg',rc.bg||'#0b1220'),accent:mk('لون التمييز','accent',rc.accent||'#d4af37'),text:mk('لون النص','text',rc.text||'#ffffff')};
      const place=node('select');place.dataset.c22Card='placement';[['overlay','نافذة فورية فوق الصفحة'],['chat','داخل المحادثة']].forEach(([v,t])=>place.append(new Option(t,v)));place.value=rc.placement==='chat'?'chat':'overlay';const pl=node('label','مكان الظهور ');pl.append(place);box.append(pl);
      section.append(box);
      const status=node('p');status.setAttribute('role','status');const b=node('button','حفظ خيارات الباقة');b.type='button';b.onclick=async()=>{b.disabled=true;try{const card={enabled:on.checked,badge:f.badge.value.trim(),title:f.title.value.trim(),body:f.body.value.trim(),cta:f.cta.value.trim(),later:f.later.value.trim(),note:f.note.value.trim(),offer_id:f.offer_id.value.trim(),bg:f.bg.value.trim(),accent:f.accent.value.trim(),text:f.text.value.trim(),placement:place.value};
        await save(id,{ask_beneficiary:ask.checked,renewal_mode:mode.value,renewal_card:card,f34:{extra:xOn.checked,term:tOn.checked}});status.textContent='تم حفظ خيارات الباقة والتحقق من المركزية';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};section.append(b,status);
      (row.querySelector('[data-f21-editor]')||row.lastElementChild)?.after(section);
    });
  }
  let pending=false;function schedule(){if(pending)return;pending=true;setTimeout(()=>{pending=false;mount();},80);}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.F99Settings?.onChange(schedule);schedule();
})();
