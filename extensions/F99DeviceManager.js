/* FINO99 section3 standalone owner module. No secrets persisted, no login/token rewriting. */
(function (root) {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ERRORS = {
    ADMIN_UNAUTHORIZED: 'يلزم تسجيل دخول المالك من جديد.',
    VERSION_CONFLICT: 'تغيرت البيانات؛ حدّثها وراجع التعديل قبل إعادة المحاولة.',
    DEVICE_LIMIT_REACHED: 'اكتمل عدد الأجهزة المسجلة لهذا الكود.',
    FAMILY_DEVICE_LIMIT_REACHED: 'اكتمل إجمالي أجهزة العائلة.',
    FAMILY_ALLOWLIST_REQUIRED: 'أكواد العائلة تتطلب تفعيل قائمة الأجهزة المسموحة.',
    POLICY_NOT_ENABLED: 'سياسة الأجهزة ما زالت مسودة؛ يلزم اعتماد المالك أولاً.',
    CODE_POLICY_REQUIRED: 'اربط الكود بسياسة أجهزة معتمدة أولاً.',
    DEVICE_REVOKED_USE_NEW_TOKEN: 'هذا الجهاز محظور؛ استخدم معرف جهاز جديداً دون إحياء الجلسة القديمة.',
    PROTECTED_OWNER_OR_NONCUSTOMER_SCOPE: 'هذا النطاق محمي ولا تدار أجهزته من بوابة العملاء.',
    MULTI_RETAINED_RENEWAL_REQUIRES_S12_REVIEW: 'غير متاح بأمان: الاحتفاظ بعدة أجهزة سبق دخولها عند تجديد الكود نفسه يحتاج مراجعة جلسات S12. لم يحدث أي تجديد.',
    DEVICE_POLICY_MAINTENANCE: 'إدارة الأجهزة متوقفة احترازياً.'
  };
  function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = String(text);
    if (className) n.className = className;
    return n;
  }
  class F99DeviceManager {
    constructor(options) {
      if (!options || typeof options.rpc !== 'function' || typeof options.getOwnerToken !== 'function') throw Error('RPC_AND_OWNER_TOKEN_PROVIDER_REQUIRED');
      this.rpc = options.rpc;
      this.getOwnerToken = options.getOwnerToken;
      this.confirm = options.confirm || (message => root.confirm(message));
      this.profiles = [];
      this.current = null;
      this.busy = false;
      this.pending = null;
      this.destroyed = false;
    }
    async call(action, payload) {
      const token = await this.getOwnerToken();
      if (!UUID.test(String(token || ''))) throw Error('ADMIN_UNAUTHORIZED');
      // No console logging, telemetry, localStorage, URLs, or request nonce/login headers.
      const response = await this.rpc('f99d15_owner', {p_token:token,p_action:action,p_payload:payload});
      const value = response && 'data' in response ? response.data : response;
      if (response && response.error) throw Error('RPC_TRANSPORT_FAILED');
      if (!value || value.ok !== true) throw Error(value && value.reason || 'RPC_FAILED');
      return value;
    }
    async read(action, payload) { return this.call(action, payload); }
    async mutate(action, fields, revision) {
      const canonical = JSON.stringify({action, fields, revision});
      // Unknown transport outcome may be retried with exactly the same UUID/body.
      if (!this.pending || this.pending.canonical !== canonical) {
        this.pending = {canonical, action, payload:{...fields,expected_revision:revision,request_id:root.crypto.randomUUID()}};
      }
      const result = await this.call(action, this.pending.payload);
      this.pending = null;
      return result;
    }
    mount(container) {
      if (!container || typeof container.replaceChildren !== 'function') throw Error('MOUNT_ELEMENT_REQUIRED');
      this.container = container;
      this.el = node('section', undefined, 'f99dm');
      this.el.dir = 'rtl';
      this.el.append(node('h2', 'إدارة أجهزة الباقات والتجديدات'));
      this.el.append(node('p', 'الرصيد المشترك: عدة أجهزة بإدخالات أصلية مستقلة للكود نفسه. الرصيد والمدة المستقلان: أكواد فرعية موجودة بمنح أصلية مستقلة. لا يزيد تسجيل الجهاز عدد الدخول أو الحسبات أو الصلاحية.', 'f99dm-note'));
      this.el.append(node('p', 'مفتوح للمراجعة — غير متاح: تجميع رصيد عدة أكواد في محفظة واحدة، والاحتفاظ بعدة أجهزة سبق دخولها عند تجديد الكود نفسه. لا يغيّر هذا المكوّن جلسات S12 أو الحاسبة.', 'f99dm-open'));
      this.status = node('p', '', 'f99dm-status');
      this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
      this.el.append(this.status);
      this.policyArea = node('div'); this.codeArea = node('div');
      this.el.append(this.policyArea, this.codeArea);
      this.container.replaceChildren(this.el);
      this.drawPolicies(); this.drawCode();
      return this.run(async () => { await this.refreshPolicies(); }, 'تم تحميل سياسات الأجهزة.');
    }
    async run(fn, message) {
      if (this.busy || this.destroyed) return;
      this.busy = true; this.disable(true); this.status.textContent = 'جار التحقق من الخادم…';
      try { await fn(); if (!this.destroyed) this.status.textContent = message || 'تم الحفظ في الخادم.'; }
      catch (error) { if (!this.destroyed) this.status.textContent = ERRORS[error.message] || 'تعذر تنفيذ العملية بأمان. لم تعتمد الواجهة أي تغيير؛ حدّث البيانات أو أعد المحاولة.'; }
      finally { this.busy = false; if (!this.destroyed) this.disable(false); }
    }
    disable(disabled) { if (this.el) this.el.querySelectorAll('button,input,select').forEach(n => { n.disabled = disabled; }); }
    input(form, label, name, value='', type='text', attrs={}) {
      const wrap = node('label'); wrap.append(node('span',label));
      const field = node('input'); field.name=name;field.type=type;
      if (type === 'checkbox') field.checked=!!value; else field.value=value == null ? '' : String(value);
      Object.entries(attrs).forEach(([k,v]) => field.setAttribute(k,String(v)));
      if (type === 'password') { field.autocomplete='off'; field.spellcheck=false; }
      wrap.append(field);form.append(wrap);return field;
    }
    select(form,label,name,choices,value) {
      const wrap=node('label');wrap.append(node('span',label));const field=node('select');field.name=name;
      choices.forEach(([v,t])=>{const option=node('option',t);option.value=v;field.append(option);});
      if (value !== undefined) field.value=value;
      wrap.append(field);form.append(wrap);return field;
    }
    form(area,title,submit,handler) {
      const section=node('fieldset');section.append(node('legend',title));const f=node('form');section.append(f);area.append(section);
      const button=node('button',submit);button.type='submit';
      f.addEventListener('submit',event=>{event.preventDefault();if(!f.reportValidity())return;this.run(()=>handler(f), 'تم تنفيذ الطلب وتحديث البيانات.');});
      f._button=button;return f;
    }
    finish(form) { form.append(form._button); }
    values(form) { return form.elements; }
    requireCode() { if (!this.current || !UUID.test(this.current.code_id)) throw Error('CODE_POLICY_REQUIRED');return this.current; }
    async refreshPolicies() { const v=await this.read('policies',{});this.profiles=v.policies;this.drawPolicies(); }
    async loadCode(id) { if (!UUID.test(id)) throw Error('INVALID_CODE_ID');this.current=await this.read('code',{code_id:id});this.drawCode(); }
    async codeMutation(action,fields) {
      const c=this.requireCode();const id=c.code_id;
      await this.mutate(action,{code_id:id,...fields},c.policy ? c.policy.revision : 0);
      await this.loadCode(id);
    }
    drawPolicies() {
      const a=this.policyArea;a.replaceChildren();
      const heading=node('div',undefined,'f99dm-heading');heading.append(node('h3','سياسة كل باقة / تجديد'));
      const refresh=node('button','تحديث السياسات');refresh.type='button';refresh.addEventListener('click',()=>this.run(()=>this.refreshPolicies()));heading.append(refresh);a.append(heading);
      const list=node('ul');this.profiles.forEach(p=>list.append(node('li',`${p.package_key} — ${p.kind==='renewal'?'تجديد':'أساسي'} | أجهزة ${p.device_limit} | ${p.enabled?'معتمدة':'مسودة غير مطبقة'} | إصدار ${p.revision}`)));a.append(list);
      const f=this.form(a,'حفظ سياسة باقة أو تجديد','حفظ السياسة',async form=>{
        const e=this.values(form),key=e.package_key.value.trim(),kind=e.kind.value;
        const old=this.profiles.find(p=>p.package_key===key&&p.kind===kind);
        if (e.enabled.checked && !await this.confirm('اعتماد سياسة الأجهزة؟ لن تطبق على أي كود إلا عند ربطه صراحة.')) return;
        await this.mutate('policy_save',{package_key:key,kind,device_limit:Number(e.device_limit.value),binding_enabled:e.binding_enabled.checked,enabled:e.enabled.checked},old?old.revision:0);
        await this.refreshPolicies();
      });
      this.input(f,'مفتاح الباقة الأصلي','package_key','', 'text',{required:true,maxlength:120});
      this.select(f,'نوع المنحة','kind',[['base','الباقة الأساسية'],['renewal','التجديد']]);
      this.input(f,'عدد الأجهزة المسجلة (ليس max_entries)','device_limit',1,'number',{min:1,max:50,required:true});
      this.input(f,'اشتراط قائمة الأجهزة المسموحة','binding_enabled',true,'checkbox');
      this.input(f,'اعتماد السياسة (غير مرتبط بنشر العرض)','enabled',false,'checkbox');this.finish(f);
      a.append(node('p','تعديل السياسة لا يغير الأكواد القديمة تلقائياً. تبقى الباقات/التجديدات غير المعدة بلا سياسة جديدة، وبنظامها الأصلي.','f99dm-note'));
    }
    drawCode() {
      const a=this.codeArea;a.replaceChildren();
      const load=this.form(a,'اختيار كود العميل من المركزية','عرض أجهزة الكود',async f=>this.loadCode(f.elements.code_id.value.trim()));
      this.input(load,'معرف الكود UUID (ليس الكود السري)','code_id',this.current?this.current.code_id:'','text',{required:true,pattern:UUID.source});this.finish(load);
      const c=this.current;if(!c)return;
      a.append(node('h3',`الكود ${c.code_id}`));
      a.append(node('p',`الدخول الأصلي: ${c.native.use_count} / ${c.native.max_entries===0?'وفق الأصل دون حد دخول':c.native.max_entries} | الحسبات المتبقية: ${c.native.remaining_calculations===null?'وفق ضوابط الأصل':c.native.remaining_calculations} | المدة: ${c.native.duration_minutes} دقيقة | الصلاحية: ${c.native.expires_at||'تحدد بالتفعيل الأصلي'}`,'f99dm-note'));
      if(c.native.lock_to_first_device || c.native.single_session===true) a.append(node('p','تنبيه: ما زال قيد الربط الأول أو الجلسة المفردة الأصلي فعالاً. زيادة عدد الأجهزة في السياسة وحدها لا تلغي هذا القيد.','f99dm-open'));
      const assign=this.form(a,'ربط سياسة معتمدة بهذا الكود فقط','ربط السياسة',async f=>{
        const e=f.elements;const selected=this.profiles[Number(e.profile.value)];if(!selected)throw Error('POLICY_NOT_ENABLED');
        if(!await this.confirm('ربط هذه السياسة بالكود؟ قد يمنع ذلك الأجهزة غير المسجلة. لا يتغير رصيد الدخول أو الحسبات.'))return;
        await this.codeMutation('assign',{package_key:selected.package_key,kind:selected.kind,replace_native_binding:e.release.checked,allow_parallel_sessions:e.parallel.checked});
      });
      this.select(assign,'السياسة','profile',this.profiles.map((p,i)=>[String(i),`${p.package_key}/${p.kind} — ${p.device_limit} ${p.enabled?'معتمدة':'مسودة'}`]));
      this.input(assign,'استبدال ربط أول جهاز الأصلي بالقائمة الجديدة (اختيار صريح)','release',false,'checkbox');
      this.input(assign,'السماح بجلسات أجهزة متوازية لهذا الكود (سياسة 2+ فقط)','parallel',false,'checkbox');this.finish(assign);
      if(!c.policy)return;
      const roster=node('div',undefined,'f99dm-roster');roster.append(node('h4','الأجهزة المسجلة'));
      (c.devices||[]).forEach(d=>{
        const row=node('div',undefined,'f99dm-device');row.append(node('strong',d.label||'جهاز دون تسمية'),node('code',d.device_hash),node('span',d.state==='active'?'مسموح':'محظور'));
        if(d.state==='active') {const b=node('button','حظر الجهاز');b.type='button';b.addEventListener('click',()=>this.run(async()=>{if(await this.confirm('حظر الجهاز وإغلاق جلساته نهائياً؟')) await this.codeMutation('block',{device_hash:d.device_hash});}));row.append(b);}
        roster.append(row);
      });a.append(roster);
      const register=this.form(a,'تسجيل جهاز / استبدال جهاز','تنفيذ التسجيل أو الاستبدال',async f=>{
        const e=f.elements,old=e.old.value;
        if(old && !await this.confirm('حظر الجهاز القديم وتسجيل الجديد؟ لا ينتقل الأرشيف أو رمز الجلسة.'))return;
        const action=old?'replace':'register';
        const fields={device_id:e.device_id.value,label:e.label.value};if(old)fields.device_hash=old;
        // Clear opaque token after confirmed success only; never display it in the roster.
        await this.codeMutation(action,fields);e.device_id.value='';
      });
      this.select(register,'الجهاز القديم للاستبدال (اختياري)','old',[['','إضافة جهاز جديد'],...c.devices.filter(d=>d.state==='active').map(d=>[d.device_hash,d.label||d.device_hash.slice(0,12)])]);
      this.input(register,'معرف الجهاز الفعلي / رمز قائمة مسموح به (ليس بصمة مصطنعة)','device_id','','password',{required:true,minlength:12,maxlength:1024});
      this.input(register,'تسمية الجهاز','label','','text',{maxlength:80});this.finish(register);
      const binding=this.form(a,'الربط بقائمة الأجهزة','تحديث الربط',async f=>{
        if(!await this.confirm('تعديل اشتراط القائمة؟ لا يلغي إثبات جهاز الجلسة الأصلي، ولا يعيد الجلسات المغلقة.'))return;
        await this.codeMutation('binding',{binding_enabled:f.elements.binding.checked,replace_native_binding:f.elements.release.checked});
      });
      this.input(binding,'اشتراط الجهاز المسجل (إيقافه لا يضمن حد القائمة، وممنوع لأكواد العائلة)','binding',c.policy.binding_enabled,'checkbox');
      this.input(binding,'إلغاء ربط أول جهاز الأصلي صراحة','release',false,'checkbox');this.finish(binding);
      const renewal=this.form(a,'تجديد مالك صريح مع الاحتفاظ / النقل','تنفيذ التجديد الأصلي',async f=>{
        const e=f.elements,retain=e.retain.checked;
        if(!await this.confirm('هذا تجديد فعلي من المالك عبر النظام الأصلي، وقد يمنح دورة ومدة جديدتين. اعتماد؟'))return;
        const fields={minutes:Number(e.minutes.value),retain_devices:retain};
        if(!retain&&e.device_id.value) {fields.device_id=e.device_id.value;fields.label=e.label.value;}
        await this.codeMutation('renew',fields);e.device_id.value='';
      });
      this.input(renewal,'مدة التجديد بالدقائق','minutes',c.native.duration_minutes||1440,'number',{min:1,max:525600,required:true});
      this.input(renewal,'الاحتفاظ بالأجهزة (عدة أجهزة تاريخية: OPEN غير متاح)','retain',true,'checkbox');
      this.input(renewal,'عند النقل فقط: معرف الجهاز الجديد','device_id','','password',{minlength:12,maxlength:1024});
      this.input(renewal,'تسمية الجهاز المنقول','label','','text',{maxlength:80});this.finish(renewal);
      const grant=this.form(a,'تعديل صريح لمنحة الحسبات والمدة','اعتماد المنحة الأصلية',async f=>{
        if(!f.elements.confirm_grant.checked || !await this.confirm('تغيير المنحة فعلياً دون تصفير الاستخدام أو تغيير عدد الدخول. اعتماد المالك؟'))return;
        await this.codeMutation('limits',{calculations:Number(f.elements.calculations.value),minutes:Number(f.elements.minutes.value),confirm_grant:true});
      });
      this.input(grant,'حد الحسبات للدورة (ليس رصيداً إضافياً)','calculations',1,'number',{min:1,max:1000,required:true});
      this.input(grant,'المدة الأصلية بالدقائق','minutes',c.native.duration_minutes||1440,'number',{min:1,max:525600,required:true});
      this.input(grant,'أوافق بصفتي المالك على تغيير المنحة الفعلية','confirm_grant',false,'checkbox');this.finish(grant);
      const family=this.form(a,'إضافة كود عائلة فرعي موجود','ربط كود فرعي مستقل',async f=>{
        const child=f.elements.child.value.trim();if(!UUID.test(child))throw Error('INVALID_CODE_ID');
        if(!await this.confirm('ربط الكود الفرعي الموجود؟ تظل بياناته ورصيده ومدته مستقلة، ولا يحصل الأب على أرشيفه. إجمالي أجهزة العائلة مقيد بعدد أجهزة الأب.'))return;
        await this.codeMutation('family_link',{child_code_id:child});
      });
      this.input(family,'UUID للكود الفرعي الصادر مسبقاً بسياسة معتمدة','child','','text',{required:true,pattern:UUID.source});this.finish(family);
      a.append(node('p',`الكود الأب: ${c.family.parent_code_id||'لا يوجد'} | أكواد فرعية مستقلة: ${(c.family.children||[]).join('، ')||'لا يوجد'}`,'f99dm-note'));
      if(this.busy)this.disable(true);
    }
    destroy() {
      this.destroyed=true;this.pending=null;this.current=null;this.profiles=[];
      if(this.container)this.container.replaceChildren();this.el=null;
      this.getOwnerToken=()=>null;this.rpc=()=>Promise.reject(Error('DESTROYED'));
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports=F99DeviceManager;
  root.F99DeviceManager=F99DeviceManager;
})(typeof window !== 'undefined' ? window : globalThis);
