/* FINO99 S12 — additive session UI; API11 is authoritative. No secondary bearer.
 * Load before startup, bind only the explicit inline runtime adapter. No finance/image overrides.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document && !root.F99SessionSecurity) { root.F99SessionSecurity = api; api.install(root); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const VERSION = '20261115-s12-2';
  const NS = 'FINO99_NEW_SEPARATE_V2:';
  const MARKER = NS + 'S12_ENDED_LOCAL';
  const RECEIPTS = 'FINO99_APPOINTMENT_RECEIPTS_09';
  const LOGIN = new Set(['f99v23_client_resume_code', 'f99v3_client_resume_code', 'f99v23_client_open_atomic', 'f99v6_client_open_atomic', 'fino_client_open_code', 'f99s12_receipt_login']);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const PUBLIC = new Set(['page1', 'login']);
  const CLIENT_PAGES = new Set(['identityPage', 'freeHub', 'specialistBotPage', 'page2', 'page3', 'smartPage', 'smartResultPage', 'contractClientPage', 'f99FeesClientPage']);
  function id(crypto) {
    if (crypto?.randomUUID) return crypto.randomUUID();
    if (!crypto?.getRandomValues) throw Error('SECURE_UUID_REQUIRED');
    const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    const s = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }
  const codeValue = c => String(c || '').trim().toUpperCase();
  function trustedLogin(ev) {
    if (ev?.isTrusted !== true) return false;
    if (ev.type === 'keydown' && (ev.key !== 'Enter' || ev.repeat)) return false;
    if (!['click', 'keydown'].includes(ev.type)) return false;
    const el = ev.target?.closest?.('#f99l-enter,#f99s12-receipt-login,#page1 .finium-entry-btn,#f99l-code,#password,#r65-ov .r65-cbtn,#r65-code');
    return !!el && (ev.type !== 'click' || !['f99l-code', 'password', 'r65-code'].includes(el.id));
  }
  function createLoginGate(crypto, now = Date.now) {
    let ticket = null, active = null;
    return {
      capture(ev) { ticket = trustedLogin(ev) ? {nonce: id(crypto), at: now()} : null; return !!ticket; },
      start(code, device) {
        if (active || !ticket || now() - ticket.at > 1500 || !codeValue(code) || !device) { ticket = null; return null; }
        active = {...ticket, code: codeValue(code), device: String(device)}; ticket = null; return active;
      },
      header(fn, args) { return active && LOGIN.has(fn) && codeValue(args?.p_code) === active.code && String(args?.p_device_id) === active.device ? 'fino99-login-v12/' + active.nonce : ''; },
      finish() { active = null; ticket = null; }, clear() { active = null; ticket = null; }
    };
  }
  function createActivityGate(now = Date.now) {
    let last = -Infinity;
    return {
      accept(ev) { if (ev?.isTrusted !== true || !['click', 'keydown', 'pointerdown', 'scroll'].includes(ev.type) || (ev.type === 'keydown' && ev.repeat) || now() - last < 30000) return false; last = now(); return true; },
      reset() { last = -Infinity; }
    };
  }
  function clearStorage(storage, device) {
    if (!storage) return;
    for (const key of [NS + 'FINO_CENTRAL_ENTRY_V1', NS + 'FINO_PORTAL_CLIENT_DEFAULTS_V1']) { try { storage.removeItem(key); } catch (_) {} }
    try {
      const rows = JSON.parse(storage.getItem(RECEIPTS) || '[]');
      const keep = Array.isArray(rows) ? rows.filter(x => x?.device_id && x.device_id !== device) : [];
      if (keep.length) storage.setItem(RECEIPTS, JSON.stringify(keep)); else storage.removeItem(RECEIPTS);
    } catch (_) { try { storage.removeItem(RECEIPTS); } catch (_) {} }
    try { const keys = Array.from({length: storage.length}, (_, i) => storage.key(i)); for (const k of keys) if (k?.startsWith('f99x-consent-')) storage.removeItem(k); } catch (_) {}
  }
  function safeHttps(value) {
    if (typeof value !== 'string' || value.length > 1500 || /[\s\u0000-\u001f\u007f<>"'\\]/.test(value)) return '';
    try { const u = new URL(value); return /^https:\/\//.test(value) && u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; }
  }
  function validOffers(context, now) {
    if (context?.ok !== true || context.eligible !== true || !Array.isArray(context.offers)) return [];
    const t = Date.parse(context.server_now) || now || Date.now();
    return context.offers.filter(x => Number.isSafeInteger(Number(x?.available)) && Number(x.available) > 0 && x.id && typeof x.title === 'string' && x.price_sar != null && Number.isFinite(Number(x.price_sar)) && Number(x.price_sar) >= 0 && Number(x.duration_minutes) > 0 && Number(x.max_calculations) > 0 && (!x.offer_expires_at || Date.parse(x.offer_expires_at) > t) && safeHttps(x.checkout_url));
  }
  function activeState(s) { return s?.ok === true && s.state === 'active' && Number.isFinite(Date.parse(s.server_now)) && Number.isFinite(Date.parse(s.idle_expires_at)); }
  function allowPage(page, ctx) {
    if (PUBLIC.has(page)) return true;
    if (page === 'f99r22RenewalPage') return ctx?.renewalOnlyVerified === true;
    if (ctx?.owner === true) return true;
    if (!ctx?.verified || ctx?.scope !== 'entry' || !activeState(ctx.state) || !CLIENT_PAGES.has(page)) return false;
    if (['page2', 'smartPage'].includes(page) && ctx.state.calculator_allowed !== true) return false;
    const services = ctx.state.allowed_services || [];
    if (['page2', 'page3'].includes(page)) return services.some(s => ['buyout', 'bot_buyout'].includes(s));
    if (['smartPage', 'smartResultPage'].includes(page)) return services.some(s => ['smart', 'bot_smart'].includes(s));
    return services.length > 0 || (ctx.state.customer_scopes || []).includes('contract');
  }
  function createFlow() {
    let started = false, declined = false;
    return {start(ready) { if (!ready || started) return false; started = true; return true; }, decline() { if (declined) return ''; declined = true; return 'أبشر'; }, reset() { started = false; declined = false; }};
  }
  function unpack(r) { return r?.ok === true && r.data && typeof r.data === 'object' ? r.data : {ok: false, state: 'invalid'}; }
  function createController(options) {
    const o = options;
    let generation = 0, selected = null, state = null, verified = false, offset = 0, busy = false, verification = null;
    const activity = createActivityGate(o.now || Date.now), flow = createFlow();
    const clock = () => (o.now || Date.now)();
    const now = () => (o.now || Date.now)() + offset;
    const context = () => ({...selected, state, verified, generation});
    const same = snap => !!selected && snap.generation === generation && snap.token === selected.token && snap.scope === selected.scope && snap.device === selected.device;
    function replace(s) { generation++; selected = s ? {...s} : null; state = null; verified = false; busy = false; verification = null; activity.reset(); flow.reset(); o.conceal?.(true); return context(); }
    function suspend() { generation++; verified = false; busy = false; verification = null; o.conceal?.(true); return context(); }
    function accept(r, snap) {
      if (!same(snap)) return false;
      if (!activeState(r)) { verified = false; o.invalidate?.(); return false; }
      if (state && Date.parse(r.server_now) < Date.parse(state.server_now)) return true;
      const server = Date.parse(r.server_now); offset = server - (o.now || Date.now)(); state = r; verified = true; o.conceal?.(false); return true;
    }
    function active() { return verified && activeState(state) && (selected?.owner === true || now() < Math.min(Date.parse(state.idle_expires_at), Date.parse(state.expires_at) || Infinity)); }
    async function call(action, payload = {}, snap = context()) {
      if (!selected || !UUID.test(snap.token || '') || !snap.device || !same(snap)) return {ok: false, stale: true};
      const r = await o.rpc('f99s12_client_session', {p_entry_token: snap.token, p_device_id: snap.device, p_action: action, p_payload: {...payload, ...(snap.scope === 'receipt' ? {scope: 'receipt'} : {})}});
      if (!same(snap)) return {ok: false, stale: true};
      if (r?.ok !== true || typeof r.data?.ok !== 'boolean') return {ok: false, unknown: true};
      return same(snap) ? unpack(r) : {ok: false, stale: true};
    }
    function verificationPending() {
      return !verified && !!verification && same(verification.snap) && clock() < verification.deadline;
    }
    function verify() {
      const snap = context();
      if (!snap.token) return Promise.resolve(false);
      // Polling shares this request: it cannot keep extending initial verification.
      if (verification && same(verification.snap)) return verification.promise;
      const pending = {snap, deadline: clock() + 20000, promise: null};
      verification = pending;
      pending.promise = (async () => {
        try {
          const r = await call('state', {}, snap);
          if (verification !== pending || !same(snap)) return false;
          if (clock() >= pending.deadline) { verified = false; o.invalidate?.(); return false; }
          return !r.stale && accept(r, snap);
        } catch (_) {
          if (verification === pending && same(snap)) { verified = false; o.invalidate?.(); }
          return false;
        } finally { if (verification === pending) verification = null; }
      })();
      return pending.promise;
    }
    async function touch(ev) {
      if (selected?.owner || !active() || busy || !activity.accept(ev)) return false;
      const snap = context(); busy = true;
      try { const r = await call('touch', {}, snap); return !r.stale && accept(r, snap); } catch (_) { if (same(snap)) o.invalidate?.(); return false; }
      finally { if (same(snap)) busy = false; }
    }
    async function end(payload, feedback = false) {
      const snap = context(); verified = false; verification = null; o.conceal?.(true);
      let r;
      try { r = await call(feedback ? 'feedback' : 'end', payload || {}, snap); } catch (_) { r = {ok: false, unknown: true}; }
      if (!same(snap)) return {ok: false, stale: true};
      // Known invalid feedback is not an end. An uncertain response is fail closed, never retried as a different request.
      if (feedback && r.ok === false && !r.unknown && !r.stale) { await verify(); return r; }
      replace(null); o.ended?.(r); return r;
    }
    return {context, replace, suspend, accept, same, active, verificationPending, verify, touch, end, call, now, flow};
  }
  function install(w) {
    if (w.__F99S12Installed) return false; w.__F99S12Installed = true;
    const d = w.document, gate = createLoginGate(w.crypto);
    let runtime = null, originalRpc = null, loginBusy = false, panel = null, warning = null, feeMount = null, couponMount = null, renewalCode = '', currentFlow = 0, observer = null, clearing = false, lastUserInput = -Infinity;
    const receipts = new Map();
    const conceal = yes => d.documentElement.toggleAttribute('data-f99s12-pending', yes);
    conceal(true);
    function destroyFlow() { currentFlow++; feeMount?.destroy(); couponMount?.destroy(); feeMount = couponMount = null; panel?.remove(); panel = null; warning?.remove(); warning = null; for (const n of d.querySelectorAll('.f99s12-ack')) n.remove(); }
    function clearLocal(marker = false) {
      const dev = runtime?.device?.() || '';
      destroyFlow(); receipts.clear(); gate.clear(); renewalCode = '';
      clearStorage(w.localStorage, dev); clearStorage(w.sessionStorage, dev);
      clearing = true;
      try { runtime?.clear?.(); } finally { clearing = false; }
      for (const k of ['F99V22LatestStatus','F99V75LastCode','__F99V86Usage','__F99V82LastUseConsent','__F99V85KeepConversation','__F99V43QuotaExhausted','__F99V43LastPending']) w[k] = null;
      w.F99ServiceTools?.clearSession?.();
      if (marker) { try { w.sessionStorage.setItem(MARKER, '1'); } catch (_) {} }
      w.showPage?.('page1'); conceal(false);
    }
    const ctrl = createController({rpc: (fn, args) => originalRpc(fn, args, 20000), conceal,
      invalidate: () => { ctrl.replace(null); clearLocal(true); },
      ended: () => { clearLocal(true); w.location.reload(); }});
    const browserContext = () => ({...ctrl.context(), verified: ctrl.active(), owner: runtime?.owner?.() === true, renewalOnlyVerified: w.F99Renewal22?.authorized?.() === true});
    const still = snap => ctrl.same(snap) && ctrl.active();
    // Installed before the first inline startup. Never headers on state/poll/touch/end/feedback.
    const oldFetch = w.fetch;
    w.fetch = function (input, init) {
      let fn = ''; try { fn = new URL(typeof input === 'string' ? input : input.url, d.baseURI).pathname.split('/rest/v1/rpc/')[1] || ''; } catch (_) {}
      if (!LOGIN.has(fn)) return oldFetch.call(this, input, init);
      let args = null; try { args = JSON.parse(init?.body || '{}'); } catch (_) {}
      const headers = new w.Headers(init?.headers || (typeof input === 'object' ? input.headers : undefined));
      headers.delete('X-Client-Info'); const approved = gate.header(fn, args); if (approved) headers.set('X-Client-Info', approved);
      return oldFetch.call(this, input, {...init, headers});
    };
    function capture(ev) { if (trustedLogin(ev)) gate.capture(ev); }
    w.addEventListener('click', capture, true); w.addEventListener('keydown', capture, true);
    for (const type of ['wheel', 'touchmove']) w.addEventListener(type, ev => { if (ev.isTrusted === true) lastUserInput = Date.now(); }, {capture: true, passive: true});
    for (const type of ['click', 'keydown', 'pointerdown', 'scroll']) w.addEventListener(type, ev => {
      if (ev.isTrusted !== true || (type === 'scroll' && Date.now() - lastUserInput > 1500)) return;
      if (type !== 'scroll') lastUserInput = Date.now();
      void ctrl.touch(ev);
    }, {capture: true, passive: true});
    function element(tag, text, cls) { const n = d.createElement(tag); if (text != null) n.textContent = String(text); if (cls) n.className = cls; return n; }
    function button(host, label, run) { const b = element('button', label, 'f99s12-button'); b.type = 'button'; b.onclick = ev => { if (ev.isTrusted !== true) return; Promise.resolve(run(ev)).catch(() => notice('تعذر التحقق من المركزية. لم نعتمد نجاحًا محليًا.')); }; host.append(b); return b; }
    function field(host, label, tag = 'input') { const wrap = element('label', null, 'f99s12-field'), n = element(tag); wrap.append(element('span', label), n); host.append(wrap); return n; }
    function notice(text) { if (!panel) return; let n = panel.querySelector('[data-s12-status]'); if (!n) {n = element('p'); n.dataset.s12Status = '1'; n.setAttribute('role', 'status'); panel.append(n);} n.textContent = text; }
    function sheet(title, host, variant = '') {
      panel?.remove(); panel = element('section', null, 'f99s12-panel ' + variant); panel.dir = 'rtl'; panel.setAttribute('aria-label', title); panel.append(element('h3', title));
      (host || d.getElementById('finoBotChat') || d.getElementById('page1') || d.body).append(panel); return panel;
    }
    async function renewalContext(code, snap) {
      if (!codeValue(code) || !runtime) return null;
      const r = unpack(await originalRpc('f99s12_renewal_context', {p_code: codeValue(code), p_device_id: runtime.device()}, 15000));
      return snap && !ctrl.same(snap) ? null : r;
    }
    function renderOffers(host, ctx, snap) {
      const offers = validOffers(ctx, ctrl.now());
      for (const x of offers) {
        try { if (renewalCode && decodeURIComponent(x.checkout_url).toUpperCase().includes(renewalCode)) continue; } catch (_) { continue; }
        const box = element('article', null, 'f99s12-offer'); host.append(box); box.append(element('h4', x.title), element('strong', x.price_sar + ' ريال', 'f99s12-amount'), element('p', 'صلاحية الباقة: ' + (window.F99DurationAr ? window.F99DurationAr(x.duration_minutes) : x.duration_minutes) + ' | عدد الحسبات: ' + (window.F99CalcCountAr ? window.F99CalcCountAr(x.max_calculations) : x.max_calculations)));
        button(box, 'الحصول على كود جديد من منصة الدفع', async () => {
          const latest = await renewalContext(renewalCode, snap); const actual = validOffers(latest, ctrl.now()).find(o => o.id === x.id);
          if (!actual || String(actual.price_sar) !== String(x.price_sar) || actual.checkout_url !== x.checkout_url) return notice('تغيّر العرض أو نفد المخزون. أعد قراءة التفاصيل قبل فتح منصة الدفع.');
          w.open(safeHttps(actual.checkout_url), '_blank', 'noopener,noreferrer'); notice('فتح منصة الدفع فقط؛ لا تأكيد سداد أو إصدار كود محليًا.');
        });
        // C10 adapter is mounted only with an actual server offer UUID and explicit eligibility.
        if (UUID.test(x.id) && w.F99Coupons?.createApi && w.F99Coupons?.mountClientWidget && ctx.eligible === true) {
          const api = w.F99Coupons.createApi({rpc: (fn, args) => w.finoRpc(fn, args, 20000)});
          couponMount = w.F99Coupons.mountClientWidget(box, {api, productKey: ctx.package_key, stage: 'renewal', activated: true, renewalEligible: true, offerId: x.id});
        }
      }
      if (!offers.length) host.append(element('p', 'لا يوجد عرض تجديد متاح ومؤهل الآن. يمكنك إدخال كود جديد.'));
      return offers.length;
    }
    async function showRenewal(code, loginData) {
      if (w.F99Renewal22?.open) {
        const previousChat = renewalCode === codeValue(code) ? d.getElementById('finoBotChat')?.cloneNode(true) : null;
        // A renewal-only login never restores an entry bearer. Keep a same-code
        // read-only DOM copy only; identity/history are reverified on the server.
        if (loginData?.mode === 'renewal_only') { ctrl.replace(null); clearLocal(false); }
        renewalCode = codeValue(code);
        if (previousChat) { previousChat.removeAttribute('id'); previousChat.inert = true; }
        return w.F99Renewal22.open(renewalCode, {capturedChat: previousChat});
      }
      // No bearer or old calculator is restored from a renewal-only response.
      ctrl.replace(null); clearLocal(false); renewalCode = codeValue(code); w.showPage?.('page1');
      const codeSnapshot = renewalCode, box = sheet('انتهت الخدمة — التجديد اختياري', d.getElementById('page1'), 'f99s12-renewal');
      box.append(element('p', 'جاري قراءة العروض المؤهلة من المركزية...'));
      let r; try { r = await renewalContext(codeSnapshot); } catch (_) {}
      if (renewalCode !== codeSnapshot || panel !== box) return;
      box.replaceChildren(element('h3', 'التجديد اختياري'));
      if (r?.ok === true) { box.append(element('p', 'الباقة: ' + r.package_key + ' • الحالة: ' + (r.status === 'expired' ? 'انتهت المدة' : 'اكتملت الاستخدامات'))); renderOffers(box, r); }
      else box.append(element('p', 'تعذر إثبات عرض تجديد مؤهل. لا تبدأ حاسبة بهذا الدخول.'));
      button(box, 'إدخال كود جديد', () => { destroyFlow(); renewalCode = ''; d.getElementById('f99l-code')?.focus(); });
    }
    async function receiveLogin(data, args) {
      if (data?.mode === 'renewal_only') { if (data.ok === true) await showRenewal(args.p_code, data); return data; }
      if (data?.ok !== true || !UUID.test(data.entry_token || '')) return data;
      // Supersede all old memory BEFORE original owner-token exchange/runtime/identity call.
      const savedCode = codeValue(args.p_code); ctrl.replace(null); clearLocal(false); renewalCode = savedCode;
      runtime.store(data);
      ctrl.replace({scope: 'entry', token: data.entry_token, device: String(args.p_device_id), owner: data.owner === true});
      if (!await ctrl.verify()) return {ok: false, reason: 'S12_SESSION_NOT_VERIFIED'};
      // Bank entitlement uses the original storefront closure. Await its first load,
      // not a fixed delay or a permissive fallback when it is still empty.
      // Owner permissions come from the verified session/admin exchange, not a
      // customer package. Keep the exact entitlement wait for customers only.
      if (data.owner !== true && !(w.FINO99ReadStorefront?.()?.products?.length) && typeof w.F99V33RefreshStorefront === 'function') await w.F99V33RefreshStorefront();
      try { w.sessionStorage.removeItem(MARKER); } catch (_) {}
      return data;
    }
    function bindRuntime(adapter) {
      if (runtime || !adapter?.clear || !adapter?.store || typeof w.finoRpc !== 'function') return false;
      runtime = adapter; originalRpc = w.finoRpc;
      const originalClear = w.finoCentralClearEntry;
      if (typeof originalClear === 'function') w.finoCentralClearEntry = function () {
        const value = originalClear.apply(this, arguments);
        if (!clearing) { ctrl.replace(null); clearLocal(true); }
        return value;
      };
      w.finoRpc = async function (fn, args = {}, timeout) {
        const snap = ctrl.context(), protectedEntry = !!args.p_entry_token, protectedReceipt = !!args.p_receipt_token;
        if (!LOGIN.has(fn) && fn !== 'f99s12_client_session' && (protectedEntry || protectedReceipt)) {
          const token = args.p_entry_token || args.p_receipt_token, scope = protectedReceipt ? 'receipt' : 'entry';
          if (!ctrl.active() || snap.scope !== scope || snap.token !== token || snap.device !== String(args.p_device_id)) return {ok: false, data: {ok: false, reason: 'S12_SESSION_NOT_VERIFIED'}};
        }
        const r = await originalRpc.apply(this, arguments);
        if (LOGIN.has(fn)) {
          if (r?.ok && r.data) r.data = await receiveLogin(r.data, args);
          return r;
        }
        if ((protectedEntry || protectedReceipt) && !ctrl.same(snap)) return {ok: false, data: {ok: false, reason: 'S12_SESSION_CHANGED'}};
        if ((protectedEntry || protectedReceipt) && r?.data?.ok === false && /SESSION|TOKEN|DEVICE_BLOCKED|CODE_EXPIRED_OR_DISABLED/.test(String(r.data.reason || ''))) { ctrl.replace(null); clearLocal(true); }
        return r;
      };
      return true;
    }
    function inputCode() { const raw = d.getElementById('f99l-code')?.value || d.getElementById('password')?.value || ''; return typeof w.F99V8ExtractCode === 'function' ? w.F99V8ExtractCode(raw) : codeValue(raw); }
    function hookLogin() {
      const old = w.login; if (typeof old !== 'function' || old.__s12) return;
      const wrapped = async function () {
        if (loginBusy || !gate.start(inputCode(), runtime.device())) return;
        loginBusy = true;
        try { return await old.apply(this, arguments); } finally { loginBusy = false; gate.finish(); }
      }; wrapped.__s12 = true; w.login = wrapped;
    }
    async function receiptLogin(ev) {
      if (loginBusy || ev.isTrusted !== true) return;
      const code = inputCode(); if (!gate.start(code, runtime.device())) return;
      loginBusy = true;
      try {
        const r = unpack(await originalRpc('f99s12_receipt_login', {p_code: code, p_device_id: runtime.device()}, 20000));
        if (r.ok !== true || r.mode !== 'receipt_only' || !Array.isArray(r.receipts)) return sheet('لم تتوفر حقوق إيصال موثقة', (d.getElementById('f99l-codes') || d.getElementById('page1'))).append(element('p', 'لا يفتح هذا الدخول باقة أو حاسبة. جرّب إدخال كودك مجددًا.'));
        ctrl.replace(null); clearLocal(false); const host = sheet('إيصالات موعدك فقط', (d.getElementById('f99l-codes') || d.getElementById('page1'))); host.append(element('p', 'حقوق مستقلة عن الحاسبة. اختر الإيصال للتحقق من موعده.'));
        for (const value of r.receipts.slice(0, 100)) if (UUID.test(value.receipt_token) && UUID.test(value.booking_id)) button(host, 'قراءة الموعد المحفوظ', async () => {
          if (!await activateReceipt(value.receipt_token, runtime.device())) return;
          const ctx = unpack(await w.finoRpc('f99a10_receipt', {p_receipt_token: value.receipt_token, p_device_id: runtime.device(), p_action: 'context', p_payload: {}}, 20000));
          const b = ctx.booking || ctx.bookings?.find(x => x.id === value.booking_id);
          if (!b?.product_key || b.id !== value.booking_id || !ctrl.active()) return;
          const record = {...value, product_key: b.product_key, device_id: runtime.device()}; receipts.set(value.receipt_token, record); w.F99ServiceTools?.openReceipt?.(record);
        });
        try { w.sessionStorage.removeItem(MARKER); } catch (_) {}
      } finally { loginBusy = false; gate.finish(); }
    }
    async function activateReceipt(token, device) {
      if (!UUID.test(token || '') || !device || device !== runtime.device()) return false;
      if (ctrl.context().token !== token || ctrl.context().scope !== 'receipt') { destroyFlow(); ctrl.replace({scope: 'receipt', token, device, owner: false}); }
      return ctrl.verify();
    }
    function receiptActive(token, device) { const c = ctrl.context(); return ctrl.active() && c.scope === 'receipt' && c.token === token && c.device === device; }
    function feedbackEnabled() { const c = runtime.snapshot(); const p = (w.FINO99ReadStorefront?.()?.products || []).find(x => x.key === c.packageKey); return c.entry?.config?.feedback_enabled !== false && p?.settings?.survey_enabled !== false; }
    function feedback(snap, host) {
      if (!still(snap)) return;
      host.replaceChildren(element('h3', 'يهمّنا رأيك'), element('p', 'وش رأيك بتجربتك معنا؟ وإذا عندك ملاحظة أو اقتراح، يسعدنا نسمعه منك.'));
      if (feedbackEnabled()) {
        const kind = field(host, 'نوع المشاركة', 'select'); for (const [v, text] of [['review','تقييم'],['suggestion','اقتراح']]) {const n = element('option', text); n.value = v; kind.append(n);}
        const rating = field(host, 'التقييم من 1 إلى 5', 'select'); for (let i = 5; i >= 1; i--) {const n = element('option', String(i)); n.value = String(i); rating.append(n);}
        const message = field(host, 'رأيك دون بيانات حساسة', 'textarea'); message.minLength = 3; message.maxLength = 1200;
        const name = field(host, 'اسم للنشر — اختياري'); name.maxLength = 50;
        const consent = field(host, 'أسمح بالنشر بعد مراجعة المالك'); consent.type = 'checkbox';
        kind.onchange = () => {rating.parentElement.hidden = consent.parentElement.hidden = kind.value === 'suggestion';};
        const send = button(host, 'إرسال رأيي وإنهاء الجلسة', async () => {
          if (!still(snap) || message.value.trim().length < 3 || message.value.length > 1200) return notice('اكتب رأيك في 3 محارف على الأقل.');
          send.disabled = true;
          const r = await ctrl.end({kind: kind.value, rating: kind.value === 'review' ? Number(rating.value) : null, message: message.value.trim(), public_name: name.value.trim(), publication_consent: kind.value === 'review' && consent.checked}, true);
          if (r.ok === false && !r.stale) { send.disabled = false; notice('لم يُقبل التقييم. راجع النص أو اختر التخطي.'); }
        });
      }
      button(host, 'تخطي وإنهاء الجلسة', () => still(snap) && ctrl.end());
    }
    // Owner order (attachment 19): no automatic completion sheet, no forced fee/renewal
    // stage and no invented wording after a calculation. The calculator keeps its original
    // V82 review/new-calculation/follow-up choices. This sheet is only an explicit,
    // optional feedback step before ending the conversation or a finished human service.
    function complete(serviceComplete = false, mountHost = null) {
      const snap = ctrl.context();
      if (runtime?.owner?.() || snap.scope !== 'entry' || !ctrl.active()) return false;
      if (serviceComplete === true && !ctrl.flow.start(true)) return false;
      const visiblePage = d.querySelector('.page.active'), services = d.getElementById('f99a10-overlay');
      const mount = mountHost || (serviceComplete === true && services && !services.hidden ? d.getElementById('f99a10-content') :
        visiblePage?.id === 'specialistBotPage' ? d.getElementById('finoBotChat') : visiblePage?.querySelector('.viewport') || visiblePage);
      const host = sheet('يهمّنا رأيك', mount, 'f99s12-completion');
      feedback(snap, host);
      return true;
    }
    function endConversation() {
      if (!ctrl.active()) { ctrl.replace(null); clearLocal(true); w.location.reload(); return; }
      if (feedbackEnabled() && complete(false, d.getElementById('finoBotChat'))) {
        button(panel, 'رجوع للمحادثة', () => { panel?.remove(); panel = null; });
        panel?.scrollIntoView?.({block: 'nearest', behavior: 'smooth'}); return;
      }
      void ctrl.end();
    }
    function tick() {
      if (!runtime || !ctrl.context().token || runtime.owner()) return;
      // A concealed, unverified identity is not an expired active session.
      // Defer invalidation only while its bounded state request is in flight.
      if (ctrl.verificationPending()) return;
      if (!ctrl.active()) { ctrl.replace(null); clearLocal(true); return; }
      const c = ctrl.context(), left = Date.parse(c.state.idle_expires_at) - ctrl.now();
      if (left > Number(c.state.warning_seconds || 0) * 1000) {warning?.remove(); warning = null; return;}
      if (!warning) {
        warning = element('aside', null, 'f99s12-warning'); warning.dir = 'rtl'; warning.setAttribute('role','alert');
        warning.append(element('h3','ما زلت معنا؟'), element('p','حفاظًا على خصوصيتك، بتنتهي جلستك قريبًا.'));
        button(warning, 'متابعة الجلسة', async ev => { if (ctrl.active()) { await ctrl.touch(ev); if (ctrl.active()) await ctrl.verify(); } });
        button(warning, 'تسجيل الخروج', () => ctrl.end()); d.body.append(warning);
      }
    }
    async function ownerPolicy() {
      if (!runtime.owner()) return;
      const token = runtime.ownerToken(), ownerSnap = token;
      const ownerCall = async (action, payload = {}) => { if (!runtime.owner() || runtime.ownerToken() !== ownerSnap) throw Error('OWNER_SESSION_CHANGED'); const r = unpack(await originalRpc('f99s12_owner_policy', {p_token: token, p_action: action, p_payload: payload}, 20000)); if (!runtime.owner() || runtime.ownerToken() !== ownerSnap) throw Error('OWNER_SESSION_CHANGED'); return r; };
      const host = sheet('سياسة خمول العملاء', d.getElementById('ownerHub'), 'f99s12-owner');
      const r = await ownerCall('get'); if (!r.ok || !host.isConnected) return;
      host.append(element('p', 'تطبق المهلة على آخر نشاط حقيقي. تقليلها قد ينهي جلسات خاملة الآن. لا يطبق تنبيه خمول العميل على واجهة المالك.'));
      const minutes = field(host, 'مدة الخمول بالدقائق (1–1440)'); minutes.type = 'number'; minutes.min = '1'; minutes.max = '1440'; minutes.value = r.policy.idle_minutes;
      button(host, 'مراجعة واعتماد التغيير', () => {
        const value = Number(minutes.value); if (!Number.isInteger(value) || value < 1 || value > 1440) return;
        host.replaceChildren(element('h3', 'بطاقة اعتماد سياسة الخمول'), element('p', 'المدة الجديدة: ' + value + ' دقيقة • المراجعة: ' + r.policy.revision));
        const approve = field(host, 'راجعت أثر تقليل المهلة وأوافق على التطبيق الآن.'); approve.type = 'checkbox';
        const payload = {idle_minutes: value, expected_revision: r.policy.revision, request_id: id(w.crypto)};
        const save = button(host, 'اعتماد وحفظ ثم إعادة القراءة', async () => { if (!approve.checked) return; save.disabled = true; const ack = await ownerCall('save', payload); if (!ack.ok) {notice('تغيرت المراجعة أو تعذر الحفظ. أعد قراءة السياسة دون تكرار حفظ جديد.'); return;} await ownerPolicy(); });
        button(host, 'رجوع دون حفظ', ownerPolicy);
      });
    }
    function boot() {
      if (!runtime) return;
      hookLogin();
      // Attachment 19: the receipt-only gateway is removed from the public home page.
      const host = d.getElementById('f99l-codes') || d.querySelector('#page1 .finium-entry');
      d.getElementById('f99s12-receipt-login')?.remove();
      try {
        if (host && w.sessionStorage?.getItem('f99s12_logout_notice') === 'UNCONFIRMED') { w.sessionStorage.removeItem('f99s12_logout_notice'); const n = element('p','مُسحت جلسة هذا الجهاز، لكن تعذر تأكيد اكتمال الإغلاق في الخادم.'); n.setAttribute('role','status'); host.append(n); }
      } catch (_) {}
      const owner = d.getElementById('ownerHub');
      if (owner && !d.getElementById('f99s12-owner-policy')) {const b = button(owner, 'سياسة خمول العملاء', ownerPolicy); b.id = 'f99s12-owner-policy';}
      const oldOwnerLogout = w.ownerLogout;
      if (typeof oldOwnerLogout === 'function') w.ownerLogout = async function () {
        // Capture the original entry/device BEFORE oldOwnerLogout or clearLocal erases them.
        const token = runtime.ownerToken(), entry = runtime.entry(), device = entry?.deviceId || runtime.device();
        const payload = {request_id:id(w.crypto), ...(UUID.test(entry?.entryToken || '') && device ? {entry_token:entry.entryToken,device_id:device} : {})};
        // The legacy logout expires AdminToken: never race it against the atomic entry revoke.
        let confirmed = !UUID.test(token);
        try {
          if (UUID.test(token)) { const r = await originalRpc('f99s12_owner_policy', {p_token:token,p_action:'end_owner',p_payload:payload}, 20000); confirmed = r?.ok === true && (r.data || r).owner_ended === true; }
        } catch (_) { confirmed = false; }
        finally {
          const local = oldOwnerLogout.apply(this, arguments);
          ctrl.replace(null); clearLocal(true);
          await Promise.allSettled([local]);
        }
        if (!confirmed) { try { w.sessionStorage?.setItem('f99s12_logout_notice','UNCONFIRMED'); } catch (_) {} }
        w.location.reload();
      };
      const oldEnd = w.F99V23ShowEnd;
      if (typeof oldEnd === 'function' && !oldEnd.__s12) {const fn = function (reason) { if (runtime.owner()) return oldEnd.apply(this, arguments); if (reason === 'CALCULATIONS_FINISHED' && ctrl.active()) return; ctrl.replace(null); clearLocal(true); }; fn.__s12 = true; w.F99V23ShowEnd = fn;}
      const oldFeedback = w.FINO99V74CustomerFeedback;
      if (typeof oldFeedback === 'function') w.FINO99V74CustomerFeedback = function () { return runtime.owner() ? oldFeedback.apply(this, arguments) : false; };
      const oldFinish = w.F99V82FinishReview;
      // Keep the ORIGINAL V82 review message and choices; only add an explicit end action
      // that returns the customer to the main page.
      if (typeof oldFinish === 'function') w.F99V82FinishReview = function () {
        const before = d.querySelectorAll('#finoBotChat .f82-end-actions').length;
        const value = oldFinish.apply(this, arguments);
        if (runtime.owner() || !ctrl.active()) return value;
        const all = d.querySelectorAll('#finoBotChat .f82-end-actions'), card = all.length > before ? all[all.length - 1] : null;
        const row = card?.querySelector(':scope > div');
        if (row && !row.querySelector('[data-f99s12-end]')) {
          const b = d.createElement('button'); b.type = 'button'; b.dataset.f99s12End = '1'; b.textContent = 'إنهاء المحادثة والعودة للرئيسية';
          b.onclick = ev => { if (ev.isTrusted !== true) return; card.remove(); endConversation(); };
          row.append(b);
        }
        return value;
      };
      const oldNew = w.F99V82RequestNewCalculation;
      if (typeof oldNew === 'function') w.F99V82RequestNewCalculation = async function () {
        if (runtime.owner()) return oldNew.apply(this, arguments);
        if (!await ctrl.verify()) return;
        // The original V82 reads the authoritative balance and offers renewal at zero;
        // the server still refuses any calculation that is not allowed.
        return oldNew.apply(this, arguments);
      };
      // Only observe completion phase and original result presence; never mutate result/image/export functions.
      const ready = () => {
        if (runtime.owner()) return;
        for (const node of d.querySelectorAll('#v74-client-feedback,#v74-client-renew,#f99v23-end')) if (!node.hidden) node.hidden = true;
        const page = d.querySelector('.page.active'); if (page && !allowPage(page.id, browserContext())) w.showPage?.('page1');
      };
      observer = new w.MutationObserver(ready); observer.observe(d.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','hidden']});
      try { if (w.sessionStorage.getItem(MARKER)) {ctrl.replace(null); clearLocal(false);} else {const e = runtime.entry(); if (e?.entryToken) {ctrl.replace({scope:'entry', token:e.entryToken, device:e.deviceId || runtime.device(), owner:false}); void ctrl.verify();} else conceal(false);} } catch (_) {ctrl.replace(null); clearLocal(false);}
      // Read polling ONLY. No interval can call touch or extend last_activity.
      w.setInterval(() => { if (ctrl.context().token && !runtime.owner()) void ctrl.verify(); }, 15000);
      w.setInterval(tick, 1000);
    }
    w.addEventListener('pagehide', () => { conceal(true); });
    w.addEventListener('pageshow', ev => { if (!ev.persisted || !runtime) return; conceal(true); if (runtime.owner()) {conceal(false); return;} ctrl.suspend(); if (ctrl.context().token) void ctrl.verify(); else clearLocal(false); });
    w.addEventListener('popstate', () => { if (!runtime?.owner?.()) {ctrl.suspend(); if (ctrl.context().token) void ctrl.verify(); else clearLocal(false);} });
    w.addEventListener('hashchange', () => { const page = d.querySelector('.page.active'); if (page && !allowPage(page.id, browserContext())) w.showPage?.('page1'); });
    w.addEventListener('f99s12:service-complete', ev => { if (ev.detail?.serviceComplete === true) complete(true); });
    api.bindRuntime = bindRuntime;
    api.allowPage = page => allowPage(page, browserContext());
    api.guard = () => runtime?.owner?.() === true || ctrl.active() && ctrl.context().scope === 'entry';
    api.loginInProgress = () => loginBusy === true;
    api.activateReceipt = activateReceipt; api.receiptActive = receiptActive;
    api.complete = complete; api.end = () => ctrl.end(); api.showRenewal = showRenewal;
    api.entryContext = () => ctrl.active() && ctrl.context().scope === 'entry' ? {entryToken: ctrl.context().token, deviceId: ctrl.context().device} : null;
    api.context = () => ({state: ctrl.context().state, scope: ctrl.context().scope, verified: ctrl.active()});
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
    return true;
  }
  const api = {version: VERSION, install, trustedLogin, createLoginGate, createActivityGate, clearStorage, safeHttps, validOffers, activeState, allowPagePure: allowPage, createFlow, createController, LOGIN, MARKER, RECEIPTS};
  return api;
});
