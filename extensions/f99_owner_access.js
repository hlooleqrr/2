/* FINO99 section4. No auth replacement, global gateway override, persistence or logging. */
(function (global) {
  'use strict';
  const SCOPES = Object.freeze({
    customer_access: 'إيقاف وتفعيل أكواد العملاء فقط',
    feedback: 'قراءة ومراجعة تقييمات العملاء',
    inventory_read: 'قراءة ملخص المخزون والدفعات فقط',
    monitoring: 'قراءة التنبيهات والإقرار بمراجعتها'
  });
  const RPC = Object.freeze({
    fino_admin_set_code_enabled: ['customer_access', ['p_code_id', 'p_enabled']],
    f99v74_owner_feedback: ['feedback', ['p_limit']],
    f99v74_owner_feedback_moderate: ['feedback', ['p_id', 'p_action']],
    f99v9_admin_stock_summary: ['inventory_read', []],
    f99v45_admin_batch_list: ['inventory_read', []],
    f99v78_owner_alerts: ['monitoring', []],
    f99x_admin_ack_alert: ['monitoring', ['p_alert_id']]
  });
  let config = null;
  const mounted = new Set();
  function configure(options) {
    if (!options || typeof options.rpc !== 'function' || typeof options.adminCall !== 'function' ||
        typeof options.getSession !== 'function' || typeof options.clearBrowserAndReload !== 'function') {
      throw new Error('OWNER_ACCESS_ADAPTER_REQUIRED');
    }
    config = Object.freeze({ rpc: options.rpc, adminCall: options.adminCall,
      getSession: options.getSession, clearBrowserAndReload: options.clearBrowserAndReload });
  }
  function session() {
    if (!config) throw new Error('OWNER_ACCESS_NOT_CONFIGURED');
    const s = config.getSession();
    if (!s || typeof s.entryToken !== 'string' || typeof s.deviceId !== 'string' || !s.entryToken || s.deviceId.length < 12) {
      throw new Error('VERIFIED_ENTRY_REQUIRED');
    }
    return { p_entry_token: s.entryToken, p_device_id: s.deviceId };
  }
  function unwrap(response) {
    // Deliberately do not display transport errors/JSON bodies that might contain inputs.
    if (!response || response.ok !== true || !response.data || response.data.ok !== true) {
      throw new Error('OWNER_ACCESS_REQUEST_DENIED');
    }
    return response.data;
  }
  async function owner(action, payload) {
    const s = session();
    return unwrap(await config.adminCall('f99oa14_owner', {
      ...s, p_action: action, p_payload: payload
    }));
  }
  async function executivePermissions() {
    return unwrap(await config.rpc('f99v55_staff_permissions', session()));
  }
  async function executiveCall(name, args = {}) {
    if (!Object.hasOwn(RPC, name)) throw new Error('RPC_NOT_ALLOWLISTED');
    if (!args || Array.isArray(args) || typeof args !== 'object' ||
        Object.keys(args).sort().join('|') !== [...RPC[name][1]].sort().join('|')) {
      throw new Error('EXACT_ARGUMENTS_REQUIRED');
    }
    // The entry/device and entire exact payload are server-verified. No p_token accepted.
    return config.rpc('f99oa14_executive', { ...session(), p_rpc: name, p_args: { ...args } });
  }
  function node(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function input(type, placeholder) {
    const n = node('input');n.type = type;n.placeholder = placeholder || '';
    n.autocomplete = 'off';n.spellcheck = false;return n;
  }
  function label(text, control) {
    const n = node('label', undefined, 'f99oa14-field');n.append(node('span', text), control);return n;
  }
  function button(text, work) {
    const b = node('button', text);b.type = 'button';b.addEventListener('click', work);return b;
  }
  function randomOwnerSecret() {
    const bytes = new Uint8Array(15);global.crypto.getRandomValues(bytes);
    return 'O-' + Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  async function mountRoot(container) {
    if (!container || typeof container.replaceChildren !== 'function') throw new Error('ROOT_CONTAINER_REQUIRED');
    const initial = await owner('list', {}); // Server auth before rendering root controls.
    const shell = node('section', undefined, 'f99oa14');shell.dir = 'rtl';
    const title = node('h2', 'تفويض المدير التنفيذي وكود المالك');
    const warning = node('p', 'كل الصلاحيات هنا تعني جميع الأدوات السبع المدعومة أدناه فقط، وليست صلاحيات المالك أو بقية أدوات المنصة.');
    const status = node('p', '', 'f99oa14-status');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
    const list = node('div', undefined, 'f99oa14-list');
    const create = node('div', undefined, 'f99oa14-card');create.append(node('h3', 'إصدار كود مستقل'));
    const name = input('text', 'اسم المدير التنفيذي');name.maxLength = 80;
    const all = input('checkbox');all.checked = false;
    const scopeBox = node('div');const checks = {};
    for (const [key, text] of Object.entries(SCOPES)) {
      const c = input('checkbox');checks[key] = c;scopeBox.append(label(text, c));
    }
    all.addEventListener('change', () => { for (const c of Object.values(checks)) { c.disabled = all.checked; } });
    const oneTime = node('div', undefined, 'f99oa14-once');oneTime.hidden = true;
    const secretOnce = input('password');secretOnce.readOnly = true;
    const clearSecrets = () => { secretOnce.value = '';oneTime.hidden = true;current.value = '';next.value = '';confirm.checked = false; };
    oneTime.append(node('p', 'هذا الكود يظهر مرة واحدة فقط. انقله للمدير بطريقة آمنة ثم أخفه. لا يُدرج في الملفات أو التقارير.'), secretOnce,
      button('إظهار/إخفاء', () => { secretOnce.type = secretOnce.type === 'password' ? 'text' : 'password'; }),
      button('تم النقل — إخفاء نهائي', () => { secretOnce.value = '';oneTime.hidden = true; }));
    let busy = false;
    async function work(fn) {
      if (busy) return;busy = true;shell.setAttribute('aria-busy', 'true');status.textContent = 'جار التحقق والحفظ...';
      try { await fn();status.textContent = 'تم التحقق من العملية لدى الخادم.'; }
      catch (_) { status.textContent = 'لم تكتمل العملية. أعد التحقق من الجلسة والتفويض. عند فقد رد إصدار الكود راجع القائمة وألغِ التفويض قبل إعادة الإصدار.'; }
      finally { busy = false;shell.removeAttribute('aria-busy'); }
    }
    const refresh = async () => renderList((await owner('list', {})).items);
    function scopesFor(box) {
      const arr = [];
      for (const [key, text] of Object.entries(SCOPES)) {
        const c = input('checkbox');c.checked = box.initial.includes(key);box.container.append(label(text, c));arr.push([key, c]);
      }
      return () => arr.filter(([, c]) => c.checked).map(([key]) => key);
    }
    function renderList(items) {
      list.replaceChildren();
      for (const item of items) {
        const card = node('article', undefined, 'f99oa14-card');card.append(node('h3', item.label));
        const editName = input('text');editName.value = item.label;editName.maxLength = 80;
        const enabled = input('checkbox');enabled.checked = item.enabled === true;
        const choices = node('div');const read = scopesFor({ initial: item.scopes || [], container: choices });
        const update = (active) => work(async () => {
          await owner('update', { id: item.id, label: editName.value.trim(), all: false,
            scopes: read(), enabled: active, expected_revision: item.revision });
          await refresh();
        });
        card.append(label('الاسم', editName), label('التفويض مفعل', enabled), choices,
          button('حفظ التعديل وإغلاق جلسات المدير الحالية', () => update(enabled.checked)),
          button('إلغاء التفويض فورًا', () => update(false)));
        list.append(card);
      }
    }
    create.append(label('الاسم', name), label('كل الأدوات التشغيلية المدعومة', all), scopeBox,
      button('إصدار كود جديد', () => work(async () => {
        const selected = Object.keys(checks).filter(k => checks[k].checked);
        if (!name.value.trim() || (!all.checked && !selected.length)) throw new Error('INVALID_FORM');
        secretOnce.value = '';oneTime.hidden = true;
        const r = await owner('create', { request_id: global.crypto.randomUUID(), label: name.value.trim(),
          all: all.checked, scopes: selected, enabled: true });
        secretOnce.type = 'password';secretOnce.value = r.code_once || '';delete r.code_once;oneTime.hidden = !secretOnce.value;
        name.value = '';await refresh();
      })), oneTime);
    const rotation = node('div', undefined, 'f99oa14-card');rotation.append(node('h3', 'تغيير كود المالك الأصلي'));
    const current = input('password', 'أعد إدخال كود المالك الحالي');current.autocomplete = 'current-password';
    const next = input('password', 'كود جديد قوي من 24 إلى 32 حرفًا');next.autocomplete = 'new-password';
    const confirm = input('checkbox');
    rotation.append(node('p', 'لن تتغير هوية الكود أو بيانات العملاء أو المبيعات أو الأرشيف. ستُغلق جلسات دخول المالك وجميع جلسات الإدارة الحالية. احفظ الكود الجديد بأمان قبل التأكيد.'),
      label('الكود الحالي', current), label('الكود الجديد', next),
      button('اقتراح كود عشوائي قوي', () => { next.value = randomOwnerSecret();next.type = 'text'; }),
      label('أؤكد تغيير كودي وإغلاق الجلسات ومسح بيانات الدخول من هذا المتصفح', confirm),
      button('تغيير كودي وتسجيل الخروج', () => work(async () => {
        if (!confirm.checked || !current.value || !/^[A-Za-z0-9-]{24,32}$/.test(next.value.trim())) throw new Error('CONFIRM_REQUIRED');
        let payload = { current_secret: current.value, new_secret: next.value,
          confirm: 'CHANGE_MY_OWNER_CODE_AND_SIGN_OUT' };
        // Erase inputs before network I/O, not merely after the successful response.
        current.value = '';next.value = '';confirm.checked = false;
        let signedOut = false;
        try { const result = await owner('rotate_root', payload);signedOut = result.signed_out === true; }
        finally {
          payload.current_secret = '';payload.new_secret = '';payload = null;clearSecrets();
          // A lost response may mean rotation committed. Always drop this browser's
          // auth after a rotation request: fail closed rather than retaining an actor.
          shell.replaceChildren(node('p', signedOut ? 'تم التغيير. سجّل الدخول بالكود الجديد.' : 'تحقق من الكود الجديد عند إعادة الدخول.'));
          await config.clearBrowserAndReload();
        }
      })));
    shell.append(title, warning, status, create, node('h3', 'التفويضات الحالية'), list,
      button('تحديث التفويضات', () => work(refresh)), rotation);
    renderList(initial.items || []);container.replaceChildren(shell);
    const hide = () => { if (document.visibilityState === 'hidden') clearSecrets(); };
    const pagehide = () => clearSecrets();document.addEventListener('visibilitychange', hide);global.addEventListener('pagehide', pagehide);
    const handle = { destroy() { clearSecrets();document.removeEventListener('visibilitychange', hide);global.removeEventListener('pagehide', pagehide);shell.remove();mounted.delete(handle); } };
    mounted.add(handle);return handle;
  }
  global.F99OwnerAccess = Object.freeze({ configure, mountRoot, executiveCall, executivePermissions,
    supportedScopes: SCOPES, supportedRPCs: Object.freeze(Object.keys(RPC)),
    destroy() { for (const handle of [...mounted]) handle.destroy(); } });
})(typeof window !== 'undefined' ? window : globalThis);
