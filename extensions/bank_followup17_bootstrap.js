/* B17 integration v1: explicit render hooks only; no startup RPC, polling or document observer. */
(function (w) {
  'use strict';
  if (w.F99B17Integration) return;
  const B = w.F99BankFollowup17;
  if (!B) throw Error('B17_MODULE_REQUIRED');
  const runtime = () => w.F99S12Runtime;
  const entry = () => runtime()?.entry?.() || runtime()?.snapshot?.()?.entry || null;
  const identity = () => { const e = entry(); return e?.entryToken && e?.deviceId ? String(e.entryToken) + '\u0000' + String(e.deviceId) : ''; };
  const assertIdentity = id => { if (!id || id !== identity()) throw Error('B17_SESSION_CHANGED'); };
  const bank = b => { if (!['personal', 'mortgage'].includes(b?.finance_type) || typeof b.bank_id !== 'string' || !b.bank_id.trim()) throw Error('B17_CANONICAL_BANK_REQUIRED'); return {finance_type:b.finance_type, bank_id:b.bank_id}; };
  async function clientRpc(name, args, ...rest) {
    const id = identity(); assertIdentity(id);
    const e = entry();
    if (args.p_entry_token !== e.entryToken || args.p_device_id !== e.deviceId) throw Error('B17_SESSION_CHANGED');
    const raw = await w.finoRpc(name, args, ...rest); // Keep S12/security18 wrapper, nonce and envelope intact.
    assertIdentity(id); return raw;
  }
  async function ownerRpc(name, args, ...rest) {
    const token = runtime()?.ownerToken?.();
    if (!token || runtime()?.owner?.() !== true || token !== args.p_token) throw Error('ADMIN_UNAUTHORIZED');
    const raw = await w.finoCentralAdminCall(name, args, ...rest);
    if (runtime()?.owner?.() !== true || runtime()?.ownerToken?.() !== token) throw Error('B17_OWNER_SESSION_CHANGED');
    return raw;
  }
  const original = B.createApi({rpc:(n,a)=>clientRpc(n,a,20000), ownerRpc,
    ownerActor:()=>({token:runtime()?.owner?.() === true ? runtime().ownerToken() : ''}), entryContext:entry});
  let intent = null;
  const api = Object.freeze({get:b=>original.get(bank(b)), set:(b,...a)=>original.set(bank(b),...a),
    want:async b=>{ const selected=bank(b),id=identity();intent=null;const r=await original.want(selected);assertIdentity(id);if(r?.reason==='BANK_FOLLOWUP_PAUSED')clearPreviews();if(r?.ok===true){requireBinding(r.bank_followup,selected);intent={id,binding:r.bank_followup};}return r; }, verify:b=>original.verify(b)});
  const owners = new WeakMap(), previews = new Set();
  const hasIntent = () => !!intent && intent.id === identity();
  function clearPreviews() {intent=null;for(const item of previews)item.mount.clearFollowup?.();}
  function clearOwners(host) { for (const m of owners.get(host) || []) m.destroy(); owners.delete(host); }
  function mountPersonalOwner(host, key) {
    clearOwners(host); const field = host.querySelector('#adminBankName')?.closest('.admin-field');
    if (!field || typeof key !== 'string' || !key) return;
    const slot = host.ownerDocument.createElement('div'); slot.dataset.b17Owner = 'personal'; field.after(slot);
    const m = B.mountOwnerField(slot,{api,bank:bank({finance_type:'personal',bank_id:key})});
    owners.set(host,[{destroy(){m.destroy();slot.remove();}}]);
  }
  function mountMortgageOwner(host, banks) {
    clearOwners(host); const mounted = [];
    for (const [i,b] of (banks || []).entries()) {
      if (typeof b?.key !== 'string' || !b.key || banks.filter(x=>x.key===b.key).length !== 1) continue;
      const field = host.querySelector('#f99m-b-key-'+i), card = field?.closest('.f99m-bank-card'); if (!card) continue;
      const slot = host.ownerDocument.createElement('div'); slot.dataset.b17Owner = 'mortgage'; field.closest('.f99m-field')?.after(slot);
      const m = B.mountOwnerField(slot,{api,bank:bank({finance_type:'mortgage',bank_id:b.key})});
      mounted.push({destroy(){m.destroy();slot.remove();}});
    }
    owners.set(host,mounted);
  }
  function mountCustomer(host, options) {
    // The base B17 module has no trust gate; bind one ONLY to this dedicated component.
    const stopSynthetic = ev => { if (ev.isTrusted !== true) {ev.preventDefault();ev.stopImmediatePropagation();} };
    host.addEventListener('click',stopSynthetic,true);
    const id = identity();
    const m = B.mountCustomerAction(host,{api:{want:b=>{assertIdentity(id);return api.want(b);}},
      selectedBank:()=>bank(options.selectedBank()), onAvailable:async (...args)=>{assertIdentity(id);return options.onAvailable?.(...args);}});
    const button = host.querySelector('button'); if (button) button.textContent = 'طلب متابعة';
    return {destroy(){m.destroy();host.removeEventListener('click',stopSynthetic,true);}};
  }
  function registerPreview(mount, current) {
    const item = {mount,current}; previews.add(item);
    const destroy = mount.destroy;
    mount.destroy = function (...a) {previews.delete(item);return destroy.apply(this,a);};
    return mount;
  }
  async function refreshPreviews() {
    const work=[];
    for (const item of previews) if (item.mount.root?.isConnected && item.current()) work.push(item.mount.refresh());
    return Promise.all(work);
  }
  const guardedF13Rpc = rpc => B.guardedF13Rpc(async (name,args,...rest) => {
    const id=identity();assertIdentity(id);
    const raw=await rpc(name,args,...rest);assertIdentity(id);
    const r=raw?.data !== undefined ? raw.data : raw;
    if(name==='f99f13_client' && ['context','getClientOffer','readcontext'].includes(args.p_action) && r?.offer) {
      const human=['guidance_mortgage','guidance_personal','custom_service','contract','bot_contract'].includes(r.offer.serviceKey);
      if(!human) {
        const personal=['buyout','smart','compare','bot_buyout','bot_smart','bot_compare','compare_known','compare_manual'];
        const mortgage=['mortgage_quote','mortgage_compare','mortgage_buyout','bot_mortgage_quote','bot_mortgage_compare','bot_mortgage_buyout'];
        const scope=personal.includes(r.offer.serviceKey)?'personal':mortgage.includes(r.offer.serviceKey)?'mortgage':null;
        if(!scope)throw Error('B17_SERVICE_SCOPE_REVIEW_REQUIRED');
        if(!hasIntent()) {const hidden={...r,offer:null,acceptance:null};return raw?.data !== undefined ? {...raw,data:hidden} : hidden;}
        requireBinding(r.bank_followup,intent.binding);
        if(scope!==r.bank_followup.finance_type)throw Error('B17_FINANCE_SCOPE_MISMATCH');
        if(r.bank_followup.intent_id!==intent.binding.intent_id)throw Error('B17_STALE_BANK_INTENT');
      }
    }
    return raw;
  });
  const paused = e => e?.reason === 'BANK_FOLLOWUP_PAUSED' || e?.message === 'BANK_FOLLOWUP_PAUSED';
  function requireBinding(binding, selected) {
    const b=bank(selected);
    if (!binding?.intent_id || binding.finance_type !== b.finance_type || binding.bank_id !== b.bank_id) throw Error('B17_TRUSTED_BANK_BINDING_REQUIRED');
    return binding;
  }
  // Verified original mortgage event: runWork dispatches AFTER renderResults. Never touch result cards/PNG.
  const mortgage = new WeakMap();
  w.addEventListener('f99m:result', ev => {
    const host=w.document.getElementById('f99m-results'),detail=ev.detail;
    if(!host)return;
    const previous=mortgage.get(host);if(previous){for(const m of previous.mounts)m.destroy();previous.root.remove();mortgage.delete(host);}
    if(detail?.client!==true || !Array.isArray(detail.res?.ranked) || !Array.isArray(detail.banks))return;
    const root=host.ownerDocument.createElement('section'),mounts=[];root.dataset.b17Followup='mortgage';
    for(const r of detail.res.ranked) {
      if(typeof r.key!=='string'||!r.key||detail.banks.filter(b=>b.key===r.key).length!==1)continue;
      const slot=host.ownerDocument.createElement('div'),title=host.ownerDocument.createElement('p');title.textContent=String(r.bank||r.key);slot.append(title);root.append(slot);
      mounts.push(mountCustomer(slot,{selectedBank:()=>({finance_type:'mortgage',bank_id:r.key}),onAvailable:async binding=>{
        requireBinding(binding,{finance_type:'mortgage',bank_id:r.key});
        clearPreviews();intent={id:identity(),binding};await refreshPreviews();
        if(!w.F99FeeOffers)throw Error('F13_MODULE_REQUIRED');
        const previewHost=host.ownerDocument.createElement('div');slot.append(previewHost);
        const previewApi=w.F99FeeOffers.createApi({rpc:guardedF13Rpc((n,a,...rest)=>clientRpc(n,a,...rest.length?rest:[20000])),entryContext:entry});
        const id=identity(),preview=registerPreview(w.F99FeeOffers.mountClientOffer(previewHost,{api:previewApi}),()=>id===identity());mounts.push(preview);
        const result=await preview.ready;
        if(id!==identity())return;
        if(result?.ok===true&&!result.offer&&!['BANK_FOLLOWUP_PAUSED'].includes(result.followup_reason)){const note=host.ownerDocument.createElement('p');note.textContent='لا يوجد عرض متابعة مالي معتمد متاح الآن. لم يتم تسجيل طلب أو قبول.';previewHost.append(note);}
      }}));
    }
    if(mounts.length){host.append(root);mortgage.set(host,{root,mounts});}
  });
  w.F99B17Integration = Object.freeze({api,identity,assertIdentity,mountPersonalOwner,mountMortgageOwner,mountCustomer,hasIntent,clearPreviews,
    registerPreview,refreshPreviews,guardedF13Rpc,paused,requireBinding,showApology:B.showApology});
})(window);
