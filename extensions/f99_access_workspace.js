/* FINO99 access workspace 14: existing auth only; no persistence, logging or install-time I/O. */
(function (w) {
  'use strict';
  if (w.F99AccessWorkspace) return;
  const d = w.document, UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const LOGIN = new Set(['f99v23_client_open_atomic', 'f99v23_client_resume_code', 'f99v3_client_resume_code', 'f99v6_client_open_atomic', 'fino_client_open_code']);
  let generation = 0, modal = null, configured = false, pendingLogin = null;
  function entry() { return w.F99S12Runtime?.snapshot?.()?.entry; }
  function ownerToken() {
    try {
      return activeAccess?.record?.owner === true && activeAccess.record.central === true &&
        w.F99S12Runtime?.owner?.() === true && typeof finoCentralAdminToken === 'string' &&
        finoCentralAdminToken === w.F99S12Runtime.ownerToken() ? finoCentralAdminToken : '';
    } catch (_) { return ''; }
  }
  function snapshot() {
    const e = entry(), live = w.F99SessionSecurity?.entryContext?.();
    if (!e?.entryToken || !e.deviceId || live?.entryToken !== e.entryToken || live.deviceId !== e.deviceId) throw Error('SESSION_REQUIRED');
    return {entryToken: e.entryToken, deviceId: e.deviceId, generation, nativeGeneration: e.generation};
  }
  function same(s) {
    try { const n = snapshot(); return n.generation === s.generation && n.entryToken === s.entryToken && n.deviceId === s.deviceId && n.nativeGeneration === s.nativeGeneration; }
    catch (_) { return false; }
  }
  function requireLive(s, token) { if (!same(s) || (token !== undefined && (!token || ownerToken() !== token))) { close(); throw Error('SESSION_CHANGED'); } }
  function close() {
    generation++; pendingLogin = null;
    const m = modal; modal = null;
    if (!m) return;
    m.observer?.disconnect(); m.deviceObserver?.disconnect();
    m.handle?.destroy(); m.device?.destroy();
    // Also clears a mount completing after navigation; its continuation destroys its own handle.
    w.F99OwnerAccess?.destroy?.();
    for (const input of m.root.querySelectorAll('input,textarea')) input.value = '';
    m.root.remove();
    if (m.focus?.isConnected) m.focus.focus();
  }
  function node(tag, text) { const n = d.createElement(tag); if (text !== undefined) n.textContent = text; return n; }
  function button(host, text, run) {
    const b = node('button', text); b.type = 'button';
    b.addEventListener('click', () => { Promise.resolve().then(run).catch(() => { if (modal?.root.contains(b)) close(); }); });
    host.append(b); return b;
  }
  function sheet(title, s, token) {
    const root = node('div'); root.className = 'f99aw14'; root.dir = 'rtl';
    const box = node('section'); box.className = 'f99aw14-dialog'; box.tabIndex = -1;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const head = node('header'); head.append(node('h2', title)); button(head, 'إغلاق', close);
    const status = node('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const body = node('div'); body.className = 'f99aw14-body'; box.append(head, status, body); root.append(box);
    const m = {root, body, status, s, token, focus: d.activeElement, page: d.querySelector('.page.active')}; modal = m;
    root.addEventListener('click', ev => { if (ev.target === root) close(); });
    root.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); close(); }
      if (ev.key === 'Tab') {
        const all = [...box.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(n => !n.disabled && !n.hidden && n.getClientRects().length);
        if (!all.length) { ev.preventDefault(); box.focus(); return; }
        if (ev.shiftKey && (d.activeElement === all[0] || d.activeElement === box)) { ev.preventDefault(); all.at(-1).focus(); }
        else if (!ev.shiftKey && d.activeElement === all.at(-1)) { ev.preventDefault(); all[0].focus(); }
      }
    });
    d.body.append(root); box.focus();
    m.observer = new w.MutationObserver(() => {
      if (modal !== m) return;
      if (!same(s) || (token !== undefined && ownerToken() !== token) || d.querySelector('.page.active') !== m.page || !root.isConnected) close();
    });
    m.observer.observe(d.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden']});
    return m;
  }
  function configure() {
    if (configured) return;
    if (!w.F99OwnerAccess || typeof w.finoRpc !== 'function' || typeof w.finoCentralAdminCall !== 'function') throw Error('MODULE_REQUIRED');
    w.F99OwnerAccess.configure({
      rpc: async (name, args) => { const s = snapshot(); const r = await w.finoRpc(name, args); requireLive(s); return r; },
      adminCall: async (name, args) => { const s = snapshot(), t = ownerToken(); requireLive(s, t); const r = await w.finoCentralAdminCall(name, args); requireLive(s, t); return r; },
      getSession: () => { const s = snapshot(); return {entryToken: s.entryToken, deviceId: s.deviceId}; },
      clearBrowserAndReload: async () => { close(); await w.ownerLogout(); }
    });
    configured = true;
  }
  async function openOwner() {
    close(); const token = ownerToken(); if (!token) return false;
    let m, handle;
    try {
      const s = snapshot(); configure(); m = sheet('تفويض المدير وكود المالك', s, token);
      handle = await w.F99OwnerAccess.mountRoot(m.body);
      if (modal !== m || !same(s) || ownerToken() !== token) { handle.destroy(); if (modal === m) close(); return false; }
      m.handle = handle; return true;
    } catch (_) { handle?.destroy(); if (modal === m) close(); return false; }
  }
  async function openDevices() {
    close(); const token = ownerToken(); if (!token || typeof w.F99DeviceManager !== 'function') return false;
    let m;
    try {
      const s = snapshot(); m = sheet('إدارة أجهزة الباقات', s, token);
      const search = node('form'), label = node('label', 'كود العميل — يُستخدم للفحص فقط ولا يُحفظ');
      const code = node('input'); code.type = 'password'; code.autocomplete = 'off'; code.spellcheck = false; code.required = true;
      code.setAttribute('aria-label', 'كود العميل'); label.append(code); search.append(label);
      const submit = node('button', 'فحص الكود وعرض أجهزته'); submit.type = 'submit'; search.append(submit);
      const host = node('div'); host.className = 'f99aw14-device-mount'; m.body.append(search, host);
      const device = new w.F99DeviceManager({
        getOwnerToken: () => { requireLive(s, token); return ownerToken(); },
        rpc: async (name, args) => { requireLive(s, token); const r = await w.finoRpc(name, args); requireLive(s, token); return r; }
      }); m.device = device;
      // Keep the standalone module unchanged. Replace its technical UUID picker with this code lookup.
      const friendly = () => {
        const first = device.codeArea?.firstElementChild;
        if (first?.tagName.toLowerCase() === 'fieldset' && !first.hidden) first.hidden = true;
        for (const h of device.codeArea?.querySelectorAll('h3') || []) if (UUID.test(h.textContent.replace(/^الكود\s+/, ''))) h.textContent = 'أجهزة العميل المحدد';
      };
      m.deviceObserver = new w.MutationObserver(friendly); m.deviceObserver.observe(host, {subtree: true, childList: true});
      search.addEventListener('submit', async ev => {
        ev.preventDefault(); if (submit.disabled || !code.value.trim()) return;
        submit.disabled = true; let secret = code.value.trim().toUpperCase(); code.value = '';
        try {
          requireLive(s, token);
          // Only retain the non-secret record ID; never render/store/log the full detail response.
          let response = await w.finoCentralAdminCall('f99v19_admin_code_detail', {p_code: secret}); secret = '';
          requireLive(s, token);
          const id = response?.ok === true && response.data?.ok === true ? response.data.record?.id : null; response = null;
          if (!UUID.test(id || '')) throw Error('CODE_NOT_FOUND');
          await device.loadCode(id); requireLive(s, token); friendly(); m.status.textContent = 'تم تحميل أجهزة العميل من المركزية.';
        } catch (_) { if (modal === m) m.status.textContent = 'تعذر فحص الكود. تحقق من الكود وجلسة المالك ثم أعد المحاولة.'; }
        finally { secret = ''; code.value = ''; submit.disabled = false; }
      });
      await device.mount(host); requireLive(s, token); friendly(); return modal === m;
    } catch (_) { if (modal === m) close(); return false; }
  }
  // No arbitrary payloads or generic owner commands are exposed in the executive UI.
  const TOOLS = Object.freeze([
    ['inventory_read', 'ملخص المخزون — قراءة فقط', 'f99v9_admin_stock_summary'],
    ['inventory_read', 'دفعات المخزون — قراءة فقط', 'f99v45_admin_batch_list'],
    ['feedback', 'تقييمات العملاء — قراءة فقط', 'f99v74_owner_feedback'],
    ['feedback', 'مراجعة تقييم عميل', 'f99v74_owner_feedback_moderate', true],
    ['monitoring', 'التنبيهات — قراءة فقط', 'f99v78_owner_alerts'],
    ['monitoring', 'الإقرار بمراجعة تنبيه', 'f99x_admin_ack_alert', true],
    ['customer_access', 'تفعيل أو إيقاف كود عميل فقط', 'fino_admin_set_code_enabled', true]
  ]);
  function safeText(value) {
    if (!['string', 'number', 'boolean'].includes(typeof value)) return '';
    return String(value).slice(0, 1600).replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '[معرّف محجوب]')
      .replace(/\b[A-Za-z0-9-]{24,}\b/g, '[قيمة حساسة محجوبة]');
  }
  const FIELDS = Object.freeze({
    available: 'متاح', reserved: 'محجوز', published: 'منشور', legacy: 'سابق', retired: 'متقاعد', total: 'الإجمالي',
    package_key: 'الباقة', package_name: 'اسم الباقة', item_count: 'العدد', state: 'الحالة', created_at: 'التاريخ', published_at: 'تاريخ النشر',
    redeem_last_day: 'آخر يوم', archived: 'مؤرشف', used: 'مستخدم', eligible: 'مؤهل', kind: 'النوع', rating: 'التقييم', message: 'الرسالة',
    public_name: 'الاسم العام', publication_consent: 'موافقة النشر', approved: 'معتمد', type: 'نوع التنبيه', title: 'العنوان', generated_at: 'وقت التحديث'
  });
  function renderResult(host, result, rpc, choose) {
    host.replaceChildren(node('p', 'نجحت العملية لدى الخادم. الحقول التشغيلية المعتمدة فقط:'));
    const fields = (box, item) => {
      for (const [key, title] of Object.entries(FIELDS)) if (Object.hasOwn(item, key)) {
        const value = safeText(item[key]); if (value) box.append(node('p', title + ': ' + value));
      }
    };
    fields(host, result);
    let count = 0;
    for (const key of ['items', 'allocations', 'batches']) for (const item of (Array.isArray(result[key]) ? result[key].slice(0, 200) : [])) {
      if (!item || typeof item !== 'object') continue;
      count++; const card = node('article'); fields(card, item);
      if (UUID.test(item.id || '') && rpc === 'f99v74_owner_feedback') button(card, 'اختيار هذا التقييم للمراجعة', () => choose('f99v74_owner_feedback_moderate', item.id));
      if (/^[1-9][0-9]{0,18}$/.test(String(item.id || '')) && rpc === 'f99v78_owner_alerts') button(card, 'اختيار هذا التنبيه للإقرار', () => choose('f99x_admin_ack_alert', String(item.id)));
      host.append(card);
    }
    if (!count && ['items', 'allocations', 'batches'].some(k => Array.isArray(result[k]))) host.append(node('p', 'لا توجد عناصر في هذه القراءة.'));
  }
  async function openExecutive(expected) {
    if (expected && !same(expected)) return false;
    close(); let m;
    try {
      const s = snapshot(); if (ownerToken() || w.F99S12Runtime.owner() === true) return false;
      configure(); const permission = await w.F99OwnerAccess.executivePermissions(); requireLive(s);
      if (permission?.role !== 'executive' || permission.enabled !== true || !Array.isArray(permission.scopes)) return false;
      m = sheet('مساحة المدير التنفيذي — تفويض تشغيلي محدود', s);
      m.body.append(node('p', 'الحد المدعوم: 7 أدوات ضمن 4 نطاقات فقط، وليس تفويضًا كاملًا أو صلاحيات مالك. القراءة لا تغيّر البيانات. تُراجع الصلاحيات عند كل فتح ويحرس الخادم كل طلب.'));
      button(m.body, 'تسجيل الخروج الآمن', async () => { requireLive(s); close(); await w.F99SessionSecurity.end(); });
      const nav = node('nav'), form = node('section'), result = node('section'); m.body.append(nav, form, result);
      let selected = null, busy = false;
      const allowed = TOOLS.filter(t => permission.scopes.includes(t[0]));
      const choose = (rpc, id) => { const t = allowed.find(x => x[2] === rpc); if (t) show(t, id); };
      async function execute(tool, args) {
        if (busy || modal !== m) return;
        busy = true; m.status.textContent = 'جار التحقق من الخادم…';
        try {
          requireLive(s); const r = await w.F99OwnerAccess.executiveCall(tool[2], args); requireLive(s);
          if (modal !== m) return;
          if (r?.ok !== true || r.data?.ok !== true) throw Error('DENIED');
          renderResult(result, r.data, tool[2], choose); m.status.textContent = 'تم التحقق من النتيجة لدى الخادم.';
        } catch (_) { if (modal === m) close(); }
        finally { busy = false; }
      }
      function show(tool, id) {
        requireLive(s); if (modal !== m) return; selected = tool;
        form.replaceChildren(node('h3', tool[1])); result.replaceChildren();
        if (!tool[3]) {
          button(form, 'قراءة من المركزية — دون تعديل', () => execute(tool, tool[2] === 'f99v74_owner_feedback' ? {p_limit: 100} : {})); return;
        }
        const alert = tool[2] === 'f99x_admin_ack_alert';
        const label = node('label', alert ? 'رقم التنبيه الأصلي (عدد صحيح موجب)' : tool[2] === 'fino_admin_set_code_enabled' ? 'معرف UUID لكود عميل فقط (يرفض الخادم المالك والموظفين)' : 'معرف UUID للسجل المستهدف');
        const target = node('input'); target.value = id || ''; target.autocomplete = 'off'; label.append(target); form.append(label);
        const action = node('select');
        const choices = tool[2] === 'f99v74_owner_feedback_moderate' ? [['publish','نشر'], ['hide','إخفاء'], ['archive','أرشفة']] :
          tool[2] === 'fino_admin_set_code_enabled' ? [['true','تفعيل'], ['false','إيقاف']] : [['ack','الإقرار بالمراجعة']];
        for (const [value, title] of choices) { const o = node('option', title); o.value = value; action.append(o); }
        action.value = choices[0][0]; form.append(action);
        if (tool[2] === 'f99x_admin_ack_alert') form.append(node('p', 'تنبيهات المخزون والشراء V78 لا تعيد معرف سجل إقرار؛ لا يُستخدم offer_id أو claim_id بديلًا. يلزم معرف تنبيه أصلي صالح.'));
        const preview = node('div'); form.append(preview);
        target.addEventListener('input', () => preview.replaceChildren()); action.addEventListener('change', () => preview.replaceChildren());
        button(form, 'معاينة التغيير — لا تنفيذ', () => {
          requireLive(s); const targetId = target.value.trim(), value = action.value;
          const valid = alert ? /^[1-9][0-9]{0,18}$/.test(targetId) && BigInt(targetId) <= 9223372036854775807n : UUID.test(targetId);
          if (!valid || !choices.some(c => c[0] === value)) { m.status.textContent = 'اختر سجلًا صالحًا وإجراءً مدعومًا.'; return; }
          const args = tool[2] === 'f99v74_owner_feedback_moderate' ? {p_id: targetId, p_action: value} :
            tool[2] === 'fino_admin_set_code_enabled' ? {p_code_id: targetId, p_enabled: value === 'true'} : {p_alert_id: targetId};
          preview.replaceChildren(node('p', 'معاينة: ' + tool[1] + ' — ' + choices.find(c => c[0] === value)[1] + ' — السجل: ' + targetId));
          const agreeLabel = node('label', 'راجعت السجل والأثر وأوافق على التنفيذ الآن'); const agree = node('input'); agree.type = 'checkbox'; agreeLabel.append(agree); preview.append(agreeLabel);
          button(preview, 'تأكيد وتنفيذ التغيير', async () => {
            if (!agree.checked || selected !== tool || target.value.trim() !== targetId || action.value !== value) return;
            preview.replaceChildren(); await execute(tool, args); requireLive(s);
          });
          button(preview, 'إلغاء دون تغيير', () => preview.replaceChildren());
        });
      }
      for (const tool of allowed) button(nav, tool[1], () => show(tool));
      if (!allowed.length) m.status.textContent = 'لا توجد أدوات مدعومة ضمن نطاقات هذا التفويض.';
      return true;
    } catch (_) { if (modal === m) close(); return false; }
  }
  // Observe LOGIN only, AFTER S12's wrapper; preserve this/arguments and the exact response object.
  function installLoginObserver() {
    const original = w.finoRpc;
    if (typeof original !== 'function' || !w.F99SessionSecurity?.entryContext || typeof w.F99SessionSecurity.end !== 'function') return false;
    const route = s => w.setTimeout(() => { if (same(s)) void openExecutive(s); }, 0);
    // Original login still awaits owner-denial/runtime before its final navigation.
    // Observe completion only: never change login's return value, inputs or auth state.
    const login = w.login;
    if (typeof login === 'function') w.login = function () {
      return Promise.resolve(login.apply(this, arguments)).then(value => {
        const s = pendingLogin; pendingLogin = null; if (s) route(s); return value;
      }, error => { pendingLogin = null; throw error; });
    };
    w.finoRpc = function (name, args) {
      const login = LOGIN.has(name), hinted = login && /^E-[0-9A-F]{30}$/i.test(String(args?.p_code || '').trim());
      if (login) close();
      const started = generation;
      const promise = original.apply(this, arguments);
      if (!login) return promise;
      return Promise.resolve(promise).then(response => {
        if (started === generation && response?.ok === true && response.data?.ok === true &&
            (hinted || response.data.config?.role === 'executive')) {
          try {
            const s = snapshot();
            if (s.entryToken === response.data.entry_token && s.deviceId === args?.p_device_id) {
              if (w.F99SessionSecurity.loginInProgress?.() === true) pendingLogin = s;
              else route(s);
            }
          } catch (_) { /* No live original entry: never route. */ }
        }
        return response;
      });
    };
    return true;
  }
  const installed = installLoginObserver();
  const logout = w.ownerLogout;
  if (typeof logout === 'function') w.ownerLogout = function () { close(); return logout.apply(this, arguments); };
  for (const event of ['pagehide', 'popstate', 'hashchange']) w.addEventListener(event, close);
  d.addEventListener('visibilitychange', () => { if (d.visibilityState === 'hidden') close(); });
  w.F99AccessWorkspace = Object.freeze({openOwner, openDevices, openExecutive, close, installed});
})(window);
