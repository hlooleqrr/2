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
      value[id]={...(value[id]||{}),ask_beneficiary:fields.ask_beneficiary,renewal_mode:fields.renewal_mode};
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
      const modeLabel=node('label','نمط التجديد');const mode=node('select');mode.dataset.c22Renewal='1';[['old','التجديد القديم'],['new','التجديد الجديد'],['both','إظهار الاثنين'],['off','تعطيل التجديد']].forEach(([v,t])=>mode.append(new Option(t,v)));mode.value=window.F99Settings.packageOption(id,'renewal_mode','old');modeLabel.append(mode);section.append(modeLabel);
      const status=node('p');status.setAttribute('role','status');const b=node('button','حفظ خيارات الباقة');b.type='button';b.onclick=async()=>{b.disabled=true;try{await save(id,{ask_beneficiary:ask.checked,renewal_mode:mode.value});status.textContent='تم حفظ خيارات الباقة والتحقق من المركزية';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};section.append(b,status);
      (row.querySelector('[data-f21-editor]')||row.lastElementChild)?.after(section);
    });
  }
  let pending=false;function schedule(){if(pending)return;pending=true;setTimeout(()=>{pending=false;mount();},80);}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.F99Settings?.onChange(schedule);schedule();
})();
