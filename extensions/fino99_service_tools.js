/* FINO99 09 additive service tools. Load AFTER A9. No production/bootstrap/auth changes.
 * All owner text is textContent. No HTML, local PII, automatic WhatsApp or payment claims.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (!root.F99ServiceTools) root.F99ServiceTools = Object.freeze(api.install(root));
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const TZ = 'Asia/Riyadh';
  const KINDS = ['guidance_mortgage', 'guidance_personal', 'custom_service'];
  const TYPES = {text: 'نص حر', content: 'محتوى وإقرار اختياري', external_link: 'رابط HTTPS', whatsapp: 'محتوى وواتساب الأعمال', appointment: 'حجز موعد'};
  const STATES = {available: 'متاحة الآن', soon: 'ستطلق قريبًا', sold_out: 'نفدت الأكواد', paused: 'موقوفة مؤقتًا', maintenance: 'تحت الصيانة', development: 'في طور التطوير', custom: 'حالة مخصصة'};
  const BOOKING_STATES = {pending: 'بانتظار المالك', confirmed: 'معتمد من المالك', proposed: 'موعد بديل مقترح — غير معتمد', rejected: 'مرفوض', cancelled: 'ملغي', completed: 'مكتمل', no_show: 'لم يحضر'};
  const DAYS = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
  const RECEIPTS_KEY = 'FINO99_APPOINTMENT_RECEIPTS_09';
  const PROTECTED = '.portal-result,.f38-full,.f47-inline-image,#page3,#results,canvas,img,contract,legal,consent,[id*="contract" i],[class*="contract" i],[id*="legal" i],[class*="legal" i],[id*="consent" i],[class*="consent" i],[data-contract],[data-legal],[data-consent]';
  function fail(message) { const e = Error(message); e.local = true; throw e; }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])); return value; }
  function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
  function safeHttps(value) {
    if (typeof value !== 'string' || !value || value.length > 1500 || value !== value.trim() || /[\s\u0000-\u001f\u007f\\<>"']/u.test(value) || !/^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]+)?(?:[/?#].*)?$/.test(value)) return '';
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname && value.startsWith('https://') ? u.href : ''; } catch (_) { return ''; }
  }
  function phone(value) {
    let v = String(value || '').trim().replace(/[\s()-]/g, '');
    if (/^05\d{8}$/.test(v)) v = '966' + v.slice(1);
    if (/^\+\d+$/.test(v)) v = v.slice(1);
    return /^[1-9]\d{7,14}$/.test(v) ? v : '';
  }
  function saudiPhone(value) { const v = phone(value); return /^9665\d{8}$/.test(v) ? v : ''; }
  function businessNumber(value) { let v = String(value || '').trim().replace(/[\s()-]/g, ''); if (/^0[1-9]\d{8}$/.test(v)) v = '966' + v.slice(1); if (/^\+966[1-9]\d{8}$/.test(v)) v = v.slice(1); return /^966[1-9]\d{8}$/.test(v) ? v : ''; }
  function whatsapp(number, template) { const n = businessNumber(number); return n && String(template || '').trim() ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(String(template)) : ''; }
  function safeWhatsApp(value) {
    if (typeof value !== 'string' || value.length > 48000 || /[\s\u0000-\u001f\u007f\\<>"']/u.test(value)) return '';
    try { const u = new URL(value); return u.protocol === 'https:' && value.startsWith('https://wa.me/') && !u.username && !u.password && u.hostname === 'wa.me' && !u.port && !u.hash && /^\/966[1-9]\d{8}$/.test(u.pathname) && u.searchParams.get('text') && Array.from(u.searchParams.keys()).length === 1 ? u.href : ''; } catch (_) { return ''; }
  }
  function cleanText(value, max = 12000) {
    if (value == null) return '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('النص غير صالح أو أطول من الحد المسموح.');
    return value.trim();
  }
  function number(value, min = 0, max = 525600, integer = true) {
    const n = Number(value);
    if (String(value).trim() === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) fail('أدخل رقمًا صالحًا ضمن الحدود الموضحة.');
    return n;
  }
  function validTime(v) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(v)); }
  function validateWindows(list) {
    if (!Array.isArray(list) || list.length > 24) fail('فترات اليوم غير صالحة.');
    const rows = list.map(x => {
      if (!x || !validTime(x.start) || !(validTime(x.end) || x.end === '24:00') || x.start >= x.end) fail('البداية تسبق النهاية؛ منتصف الليل 24:00 نهاية اليوم فقط.');
      return {start: x.start, end: x.end};
    }).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < rows.length; i++) if (rows[i].start < rows[i - 1].end) fail('الفترات متداخلة في اليوم نفسه.');
    return rows;
  }
  function validateStageWindows(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('جدول المراحل غير صالح.');
    const out = {};
    for (const stage of Object.keys(value)) {
      if (!['first', 'renewal'].includes(stage) || !value[stage] || typeof value[stage] !== 'object' || Array.isArray(value[stage])) fail('مرحلة التقويم غير صالحة.');
      out[stage] = {};
      for (const [day, rows] of Object.entries(value[stage])) { if (!/^[1-7]$/.test(day)) fail('أيام الأسبوع من الاثنين 1 إلى الأحد 7.'); out[stage][day] = validateWindows(rows); }
    }
    return out;
  }
  function validateSteps(list) {
    if (!Array.isArray(list) || list.length > 20) fail('قائمة الوظائف يجب أن تحتوي 20 خطوة أو أقل.');
    return list.map(x => {
      if (!x || !Object.hasOwn(TYPES, x.type)) fail('نوع الوظيفة غير صالح.');
      const out = {type: x.type, text: cleanText(x.text, 10000), button_label: cleanText(x.button_label, 120), require_consent: x.require_consent === true};
      if (x.type === 'external_link') { out.url = safeHttps(x.url); if (!out.url) fail('رابط الوظيفة يجب أن يكون HTTPS بلا بيانات دخول.'); }
      if (x.type === 'whatsapp') {
        out.whatsapp_number = businessNumber(x.whatsapp_number); out.whatsapp_template = cleanText(x.whatsapp_template, 4000);
        if (!out.whatsapp_number || !out.whatsapp_template) fail('أدخل رقم واتساب أعمال سعوديًا ونصًا جاهزًا صالحًا وفق عقد A9.');
      }
      if (['text', 'content'].includes(x.type) && !out.text) fail('أدخل نص هذه الوظيفة.');
      return out;
    });
  }
  function validatePresentation(value) {
    if (!value || !Object.hasOwn(STATES, value.status)) fail('حالة الباقة غير صالحة.');
    const offer = value.completion_offer || {}, out = {status: value.status, status_text: cleanText(value.status_text, 300), custom_can_purchase: value.custom_can_purchase === true,
      completion_offer: {enabled: offer.enabled === true, message: cleanText(offer.message, 4000), terms: cleanText(offer.terms, 10000)}};
    if (out.status === 'custom' && !out.status_text) fail('أدخل نص الحالة المخصصة.');
    if (offer.price !== '' && offer.price != null) out.completion_offer.price = number(offer.price, 0, 1000000, false);
    if (out.completion_offer.enabled && (!out.completion_offer.message || !out.completion_offer.terms)) fail('عرض الإنجاز المفعّل يحتاج رسالة وشروطًا.');
    return out;
  }
  function canPurchase(x) {
    if (!x || x.can_purchase !== true) return false;
    const p = x.presentation || x, status = p.status || x.status;
    if (!['available', 'custom'].includes(status) || (status === 'custom' && p.custom_can_purchase !== true)) return false;
    if (x.enabled === false || (x.published_stock != null && Number(x.published_stock) <= 0) || (x.stock != null && Number(x.stock) <= 0)) return false;
    return true; // server can_purchase is mandatory; this is never a client-derived grant.
  }
  function uuid(crypto) {
    if (crypto?.randomUUID) return crypto.randomUUID();
    if (!crypto?.getRandomValues) fail('المتصفح لا يدعم معرّف طلب آمن؛ استخدم HTTPS.');
    const a = new Uint8Array(16); crypto.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    const s = Array.from(a, v => v.toString(16).padStart(2, '0')).join(''); return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }
  function isUUID(v) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
  function receiptRecord(value, device) {
    if (!value || !isUUID(value.receipt_token) || !isUUID(value.booking_id) || typeof value.product_key !== 'string' || !value.product_key || value.product_key.length > 200 || /[\u0000-\u001f\u007f]/.test(value.product_key) || typeof device !== 'string' || !device || device.length > 200 || value.device_id !== device) return null;
    const out = {receipt_token: value.receipt_token, booking_id: value.booking_id, product_key: value.product_key, device_id: device};
    if (typeof value.code_hash === 'string' && /^[0-9a-f]{64}$/.test(value.code_hash)) out.code_hash = value.code_hash;
    return out;
  }
  function readReceipts(storage, device) {
    try { const v = JSON.parse(storage.getItem(RECEIPTS_KEY) || '[]'); return Array.isArray(v) ? v.slice(0, 200).map(x => receiptRecord(x, device)).filter(Boolean) : []; } catch (_) { return []; }
  }
  function saveReceipt(storage, value, device) {
    const x = receiptRecord(value, device); if (!x) return false;
    try { const rows = readReceipts(storage, device).filter(r => r.booking_id !== x.booking_id); rows.unshift(x); storage.setItem(RECEIPTS_KEY, JSON.stringify(rows.slice(0, 200))); return true; } catch (_) { return false; }
  }
  async function codeHash(crypto, value) {
    if (!crypto?.subtle || typeof value !== 'string' || !value.trim() || value.length > 256) return '';
    const bytes = new TextEncoder().encode(value.trim().toUpperCase());
    try { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); } catch (_) { return ''; }
    finally { bytes.fill(0); }
  }
  function validDay(day) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return false; const x = new Date(day + 'T12:00:00Z'); return Number.isFinite(x.getTime()) && x.toISOString().slice(0, 10) === day; }
  function validInstant(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)); }
  function dayInRiyadh(value = new Date()) {
    const p = new Intl.DateTimeFormat('en-US', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(value));
    return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-');
  }
  function localISO(value) { const [day, time] = String(value || '').split('T'); if (!validDay(day) || !validTime(time)) fail('أدخل تاريخًا ووقتًا صحيحين بتوقيت الرياض.'); return day + 'T' + time + ':00+03:00'; }
  function formatDate(value) { return validInstant(value) ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(value)) : 'وقت غير متاح'; }
  function packageKey(entry, record) {
    for (const x of [record, entry]) { const f = x?.config?.f99x || x?.code?.config?.f99x || {}; const k = f.effective_package_key || f.store_package_key || x?.store_package_key; if (typeof k === 'string' && k.trim()) return k.trim(); }
    return '';
  }
  function protectedNode(node) { return !!node?.closest?.(PROTECTED); }
  function suppressDuplicate(node) {
    // Only explicitly tagged OPTIONAL offers. Never scan arbitrary copy or hide an ancestor.
    if (!node || protectedNode(node) || node.querySelector?.(PROTECTED) || node.matches?.('input,button,label,a') || !node.matches?.('[data-f99-completion-offer="optional"]')) return false;
    node.hidden = true; return true;
  }
  function install(w) {
    const d = w.document; if (!d) return {};
    let overlay, dialog, content, status, current, view = 0, fieldId = 0, previousFocus, timer;
    let selectedStoreKey = '', badgeBusy = false, badgeToken = '', catalogSnapshot = [];
    const unresolved = new Map(), replayAllowed = new WeakSet();
    const preparedWhatsApp = new Map();
    const verifiedHashes = new Map(); let couponMount = null, hintSerial = 0;
    let storeWasVisible = false, ownerWasVisible = false, storefrontReadBusy = false, publicStates = [], publicReadSerial = 0;
    const legacy = w.F99Appointments;
    function access() { return typeof activeAccess !== 'undefined' ? activeAccess : w.activeAccess; }
    function ownerToken() { return typeof finoCentralAdminToken !== 'undefined' ? String(finoCentralAdminToken || '') : String(w.finoCentralAdminToken || ''); }
    function entry() { try { return w.finoCentralRestoreEntry?.() || null; } catch (_) { return null; } }
    function device(e = entry()) { try { return String(e?.deviceId || e?.device_id || w.finoCentralDeviceId?.() || ''); } catch (_) { return ''; } }
    function ownerSession() { const a = access(); return a?.record?.owner === true && a.record.central === true && isUUID(ownerToken()) ? {role: 'owner', token: ownerToken()} : null; }
    function clientSession(given, key) {
      const a = access(), live = entry(), e = given || live, token = e?.entryToken || e?.entry_token, liveToken = live?.entryToken || live?.entry_token;
      const services = a?.record?.centralData?.allowed_services || live?.allowed_services || [], actual = packageKey(live, a?.record?.centralData), chosen = key || actual;
      if (!a?.record?.central || a.record.owner || !isUUID(token) || token !== liveToken || !device(e) || device(e) !== device(live) || !chosen || (actual && chosen !== actual) || !Array.isArray(services) || !services.some(k => KINDS.includes(k))) return null;
      return {role: 'client', token, device: device(e), key: chosen, services: services.slice()};
    }
    function live(s) {
      if (!s || s.role === 'public') return true;
      if (s.role === 'receipt') return !!receiptRecord(s.receipt, device()) && s.device === device() && w.F99SessionSecurity?.receiptActive(s.receipt.receipt_token,s.device)===true;
      if (s.role === 'owner') return ownerSession()?.token === s.token;
      const n = clientSession(null, s.key); return !!n && n.token === s.token && n.device === s.device;
    }
    function scope(s) { return JSON.stringify([s.role, s.token || s.receipt?.receipt_token, s.device, s.key]); }
    function active(v, s = current) { return v === view && overlay && !overlay.hidden && live(s); }
    function el(tag, cls, text) { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
    function text(host, value, cls = 'f99a9-text') { const n = el('p', cls, String(value ?? '').replace(/سلة/g, 'منصة الدفع')); host.append(n); return n; }
    function card(host, title) { const n = el('section', 'f99a9-card'); if (title) n.append(el('h3', '', title)); host.append(n); return n; }
    function button(host, label, fn, primary) {
      const b = el('button', 'f99a9-button' + (primary ? ' f99a9-primary' : ''), label); b.type = 'button';
      b.addEventListener('click', () => { if (current && !live(current)) return invalidate(); try { Promise.resolve(fn()).catch(e => say(errorText(e), true)); } catch (e) { say(errorText(e), true); } }); host.append(b); return b;
    }
    function field(host, label, value = '', type = 'text', opts = {}) {
      const l = el('label', 'f99a9-field'), n = el(type === 'textarea' ? 'textarea' : 'input'); n.id = 'f99a10-field-' + (++fieldId); l.htmlFor = n.id; l.append(el('span', '', label));
      if (type !== 'textarea') n.type = type; else n.rows = 3; n.value = String(value ?? ''); Object.assign(n, opts); l.append(n); host.append(l); return n;
    }
    function select(host, label, value, choices) {
      const l = el('label', 'f99a9-field'), n = el('select'); l.append(el('span', '', label)); for (const [k, v] of choices) { const o = el('option', '', v); o.value = k; n.append(o); } n.value = value; l.append(n); host.append(l); return n;
    }
    function check(host, label, checked = false) { const l = el('label', 'f99a9-check'), n = el('input'); n.type = 'checkbox'; n.checked = !!checked; l.append(n, el('span', '', label)); host.append(l); return n; }
    function actions(host) { const n = el('div', 'f99a9-actions'); host.append(n); return n; }
    function say(message, bad = false) { if (!status || overlay.hidden) return; status.textContent = String(message || ''); status.dataset.error = bad ? '1' : '0'; status.setAttribute('role', bad ? 'alert' : 'status'); }
    function errorText(e) {
      if (e?.local) return e.message;
      const r = String(e?.code || e?.message || '');
      if (/REVISION|VERSION|CONSENT/.test(r)) return 'تغيرت النسخة أو الإقرار؛ أعد القراءة والمراجعة قبل العملية.';
      if (/AUTH|SESSION|TOKEN|DEVICE|ENTRY|EXPIRED/.test(r)) return 'انتهت الجلسة أو لم تُوثّق. أعد الدخول، أو استخدم إيصال موعدك المحدود إن حفظته.';
      if (/SLOT|OVERLAP|COLLISION|HOURS|CLOSED/.test(r)) return 'الوقت غير متاح أو خارج الدوام. لم ننشئ موعدًا بديلًا.';
      if (/CUTOFF|TOO_LATE|NOTICE/.test(r)) return 'مهلة الإلغاء أو التعديل أو الحجز لا تسمح بهذه العملية.';
      if (/NOT_FOUND|PGRST202|42883|UNAVAILABLE|STOCK|ENABLED/.test(r)) return 'الوحدة أو الباقة غير متاحة من المركزية؛ لا شراء أو بديل غير موثق.';
      return 'تعذر التحقق من المركزية. لا يعني ذلك أن العملية لم تُحفظ؛ اقرأ السجل قبل أي تغيير جديد.';
    }
    function unpack(r, mutation) {
      if (r?.ok === true && r.data?.ok === true) return r.data;
      const e = Error(String(r?.data?.reason || r?.reason || r?.error?.code || r?.error?.message || 'RPC_UNAVAILABLE')); e.code = e.message; e.uncertain = !!mutation && !(r?.ok === true && r.data?.ok === false); throw e;
    }
    async function call(s, action, payload = {}, mutation = false) {
      if (!live(s)) throw Error('SESSION_CHANGED');
      if (s.role === 'client' && typeof w.finoCentralGuard === 'function' && !w.finoCentralGuard()) throw Error('ENTRY_EXPIRED');
      let result;
      try {
        if (s.role === 'owner') { if (typeof w.finoCentralAdminCall !== 'function') throw Error('RPC_UNAVAILABLE'); result = await w.finoCentralAdminCall('f99a10_owner', {p_action: action, p_payload: payload}); }
        else {
          if (typeof w.finoRpc !== 'function') throw Error('RPC_UNAVAILABLE');
          if (s.role === 'client') result = await w.finoRpc('f99a10_client', {p_entry_token: s.token, p_device_id: s.device, p_product_key: s.key, p_action: action, p_payload: payload}, 20000);
          else if (s.role === 'receipt') {
            if (!['context', 'cancel', 'reschedule', 'slots', 'closest_available', 'replacement'].includes(action)) throw Error('RECEIPT_ACTION_FORBIDDEN');
            result = await w.finoRpc('f99a10_receipt', {p_receipt_token: s.receipt.receipt_token, p_device_id: s.device, p_action: action, p_payload: payload}, 20000);
          } else result = await w.finoRpc('f99a10_public', {p_product_key: s.key || null}, 20000);
        }
      } catch (e) { e.uncertain = mutation; throw e; }
      if (!live(s)) { const e = Error('SESSION_CHANGED'); e.uncertain = mutation; throw e; }
      return unpack(result, mutation);
    }
    function ensure() {
      if (overlay) return;
      overlay = el('div', 'f99a9-overlay f99a10-overlay'); overlay.id = 'f99a10-overlay'; overlay.hidden = true;
      dialog = el('section', 'f99a9-dialog'); dialog.dir = 'rtl'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'false'); dialog.setAttribute('aria-labelledby', 'f99a10-title');
      const header = el('header', 'f99a9-header'), box = el('div'); box.append(el('small', 'f99a9-muted', 'FINO99 • الخدمات • توقيت الرياض')); const title = el('h2', '', 'الخدمات'); title.id = 'f99a10-title'; box.append(title); header.append(box);
      button(header, 'إغلاق', close); status = el('p', 'f99a9-status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true'); content = el('div', 'f99a9-content'); content.id = 'f99a10-content';
      dialog.append(header, status, content); overlay.append(dialog); d.body.append(overlay);
      overlay.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } });
    }
    function page() { ++view; couponMount?.destroy(); couponMount = null; content.replaceChildren(); say(''); return view; }
    function open(s, title) {
      ensure(); if (overlay.hidden) previousFocus = d.activeElement;
      for (const id of ['f99a9-overlay', 'f99o2-overlay']) { const n = d.getElementById(id); if (n && !protectedNode(n) && !n.querySelector(PROTECTED)) n.hidden = true; }
      current = s; overlay.hidden = false; d.getElementById('f99a10-title').textContent = title; const v = page(); dialog.querySelector('button')?.focus();
      if (timer) w.clearInterval(timer); timer = w.setInterval(() => { if (current && !live(current)) invalidate(); }, 700); return v;
    }
    function close() { ++view; couponMount?.destroy(); couponMount = null; if (timer) w.clearInterval(timer); timer = null; if (overlay) { overlay.hidden = true; content.replaceChildren(); status.textContent = ''; } current = null; if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null; }
    function invalidate() { unresolved.clear(); preparedWhatsApp.clear(); verifiedHashes.clear(); catalogSnapshot = []; open({role: 'public'}, 'يلزم تسجيل الدخول'); text(card(content, 'الجلسة السابقة أُخفيت'), 'أعد الدخول بالكود الأصلي. إيصال الموعد لا يفتح أي خدمة أو حاسبة.'); button(content, 'دخول المنصة', login); }
    function login() { close(); if (typeof w.FINO99OpenCodeEntry === 'function') w.FINO99OpenCodeEntry(); else w.showPage?.('page1'); w.setTimeout(() => { const n = d.getElementById('f99l-code') || d.getElementById('password'); if (n?.getClientRects().length) n.focus(); }, 30); }
    function products(r) { const list = r?.products || r?.items; if (!Array.isArray(list)) throw Error('BAD_CATALOG_CONTRACT'); return list; }
    function productKey(x) { return x?.product_key || x?.key || ''; }
    function serviceOf(x) { return x?.service || x; }
    function findProduct(list, key) { return list.find(x => productKey(x) === key); }
    function summary(host, x) {
      const s = serviceOf(x), box = card(host, s.title || x.name || 'الباقة');
      text(box, s.description || x.description || '');
      const p = x.presentation || s.presentation || x, original = storeProducts().find(p => p.key === productKey(x)), state = original?.launch_status === 'coming_soon' ? 'soon' : p.status || x.status;
      const ownerLaunchText = String(original?.launch_text || '').trim().slice(0, 300);
      const tag = text(box, ownerLaunchText || (state === 'available' && current?.role === 'public' && !canPurchase(x) ? 'غير متاحة للشراء حاليًا' : state === 'custom' ? p.status_text || STATES.custom : STATES[state] || 'الحالة تحتاج تحققًا مركزيًا'), 'f99a10-badge'); tag.dataset.state = state || 'unknown';
      if (ownerLaunchText && current?.role === 'public' && !canPurchase(x)) text(box, 'الشراء غير متاح حاليًا', 'f99a9-muted');
      if (state !== 'soon' && s.price != null && (current?.role !== 'public' || canPurchase(x))) text(box, Number(s.price).toLocaleString('ar-SA') + ' ريال — السعر المحفوظ للباقة');
      if (x.reason || x.reasons?.length) text(box, x.reason || x.reasons.join(' • '), 'f99a9-muted');
      return box;
    }
    function completion(host, presentation) {
      const o = presentation?.completion_offer; if (o?.enabled !== true) return;
      const box = card(host, 'عرض مستقل: متابعة إنجاز المعاملة'); box.dataset.f99CompletionOffer = '09'; text(box, o.message); text(box, o.terms);
      if (o.price != null) text(box, 'أتعاب العرض المقترحة: ' + Number(o.price).toLocaleString('ar-SA') + ' ريال. ليست تعديلًا لرسوم عقد أو باقة معتمدة.');
      text(box, 'لا يمثل العرض ضمانًا قانونيًا أو وعدًا بقبول التمويل. لا يغيّر بندًا في عقد قائم.');
    }
    async function openOwner() {
      const s = ownerSession(), v = open(s || {role: 'public'}, 'إدارة الخدمات والاعتماد');
      if (!s) { text(card(content, 'جلسة مالك مركزية مطلوبة'), 'أدخل كود المالك الأصلي؛ لا تمنح هذه الواجهة صلاحيات.'); button(content, 'دخول المنصة', login); return; }
      say('جاري قراءة الخدمات والمنتجات من المركزية...');
      try { const r = await call(s, 'catalog'); if (!active(v, s)) return; catalogSnapshot = products(r); renderOwner(s, catalogSnapshot); await refreshBadge(); }
      catch (e) { if (active(v, s)) { say(errorText(e), true); button(content, 'إعادة قراءة الكتالوج', openOwner); } }
    }
    function ownerNav(s) { const row = actions(content); button(row, 'كتالوج المنتجات', openOwner); button(row, 'طلبات تنتظر الاعتماد', openPending, true); button(row, 'الحجوزات الحالية والشواغر', openOwnerBookings); button(row, 'إدارة الكوبونات', openOwnerCoupons); if (legacy?.openOwner) button(row, 'أدوات A9 الأصلية: إنشاء ومخزون وسجل', () => { close(); legacy.openOwner(); }); }
    function renderOwner(s, items) {
      page(); ownerNav(s); text(content, 'حالة مستقلة لكل منتج؛ حقوق الأكواد القديمة لا تتغير. احفظ فقط بعد مراجعة بطاقة اعتماد الإعداد.');
      for (const x of items) { const key = productKey(x); if (!key) continue; const box = summary(content, x); text(box, 'معرّف المنتج: ' + key + ' • المراجعة: ' + (x.revision ?? serviceOf(x).revision), 'f99a9-muted');
        button(box, 'الحالة وعرض الإنجاز', () => editPresentation(s, x));
        if (KINDS.includes(serviceOf(x).kind)) { button(box, 'محرر وظائف التسليم والنصوص', () => editDelivery(s, x), true); button(box, 'تقويم الحجز الجديد والتجديد', () => editCalendar(s, x)); button(box, 'تخصيص دفعة أول شراء أو تجديد', () => allocateCodes(s, x)); }
      }
    }
    function approveDraft(s, x, action, payload, returnTo) {
      const v = page(); ownerNav(s); const key = productKey(x), revision = x.revision ?? serviceOf(x).revision;
      if (!Number.isInteger(Number(revision))) { say('لم تُقرأ مراجعة المنتج؛ أعد قراءة الكتالوج.', true); return; }
      const box = card(content, 'بطاقة اعتماد الإعداد — لا حفظ قبل الموافقة'); text(box, 'المنتج: ' + key + ' • المراجعة المقروءة: ' + revision);
      const pre = el('pre', 'f99a9-audit', JSON.stringify(payload, null, 2)); box.append(pre); text(box, 'لا تغيير على السعر المحفوظ للباقة أو الرسوم التعاقدية أو الأكواد القائمة. المركزية تراجع كل قيمة والتداخل.');
      if (action === 'save_calendar') payload = {calendar: payload};
      const yes = check(box, 'راجعت هذه القيم وأوافق على حفظها لهذا المنتج فقط.'); const row = actions(box);
      const attempt = {action, payload: {product_key: key, expected_revision: Number(revision), ...copy(payload), request_id: uuid(w.crypto)}, busy: false};
      const save = button(row, 'اعتماد الإعداد والحفظ ثم إعادة القراءة', async () => {
        if (!yes.checked || attempt.busy || unresolved.has(scope(s) + ':' + key)) return;
        attempt.busy = true; unresolved.set(scope(s) + ':' + key, attempt); const controls = Array.from(box.querySelectorAll('button,input')); controls.forEach(n => { n.disabled = true; }); say('جاري الحفظ مع فحص المراجعة...');
        let acknowledged = false;
        try {
          const ack = await call(s, action, attempt.payload, true); acknowledged = true;
          const ar = Number(ack.revision ?? ack.service?.revision ?? ack.product?.revision);
          if (!Number.isInteger(ar) || ar <= Number(revision)) throw Error('SAVE_ACK_INVALID');
          const read = await call(s, 'catalog'); if (!active(v, s)) return;
          const items = products(read), actual = findProduct(items, key), actualRevision = Number(actual?.revision ?? serviceOf(actual)?.revision);
          if (!actual || actualRevision !== ar) throw Error('READBACK_CHANGED');
          const actualService = serviceOf(actual);
          for (const [name, expected] of Object.entries(payload.calendar || payload)) {
            const found = name === 'presentation' ? actual.presentation || actualService.presentation : actualService[name] ?? actual[name];
            if (!same(found, expected)) throw Error('READBACK_VALUES_CHANGED');
          }
          unresolved.delete(scope(s) + ':' + key); catalogSnapshot = items; renderOwner(s, items); say('حُفظ الإعداد وأُعيدت قراءة القيم والمراجعة الفعلية من المركزية.');
        } catch (e) {
          if (!acknowledged && !e.uncertain) { unresolved.delete(scope(s) + ':' + key); controls.forEach(n => { n.disabled = false; }); save.disabled = !yes.checked; }
          if (active(v, s)) { say(acknowledged || e.uncertain ? 'لم تتطابق إعادة القراءة أو لم يُحسم الرد. لا تكرر الحفظ؛ راجع آخر نسخة أولًا.' : errorText(e), true); button(content, 'إعادة قراءة الكتالوج دون تكرار الحفظ', openOwner); }
        } finally { attempt.busy = false; }
      }, true); save.disabled = true; yes.onchange = () => { save.disabled = !yes.checked; }; button(row, 'رجوع إلى المسودة دون حفظ', returnTo);
    }
    function editPresentation(s, x, draft) {
      page(); ownerNav(s); const p = draft || x.presentation || serviceOf(x).presentation || {status: 'available'}, o = p.completion_offer || {};
      const box = card(content, 'حالة وعرض مستقل — ' + (serviceOf(x).title || x.name || productKey(x)));
      const state = select(box, 'حالة المنتج', p.status || 'available', Object.entries(STATES)), statusText = field(box, 'نص الحالة المخصصة', p.status_text, 'textarea', {maxLength: 300});
      const allow = check(box, 'السماح بشراء الحالة المخصصة فقط بعد تحقق الخادم من المخزون والتفعيل', p.custom_can_purchase);
      const offered = card(content, 'متابعة الإنجاز: تفعيل أو إخفاء لهذه الباقة وحدها'); const enabled = check(offered, 'تفعيل العرض المستقل', o.enabled), message = field(offered, 'رسالة العرض', o.message, 'textarea'), terms = field(offered, 'شروط العرض', o.terms, 'textarea'), price = field(offered, 'أتعاب العرض — مسودة لا تغيّر سعر الباقة أو الرسوم المعتمدة', o.price ?? '', 'number', {min: 0, step: '0.01'});
      text(offered, 'لن نحذف أو نخفي أي بند عقد أو إقرار أو رسوم معتمدة. التفعيل ليس تنفيذًا أو تحصيلًا أو قبولًا تمويليًا.');
      button(content, 'مراجعة بطاقة اعتماد الإعداد', () => { const next = validatePresentation({status: state.value, status_text: statusText.value, custom_can_purchase: allow.checked, completion_offer: {enabled: enabled.checked, message: message.value, terms: terms.value, price: price.value}}); approveDraft(s, x, 'save_presentation', {presentation: next}, () => editPresentation(s, x, next)); }, true);
    }
    function editDelivery(s, x, draft) {
      page(); ownerNav(s); const service = serviceOf(x), values = draft || {delivery_steps: service.delivery_steps || [], instructions: service.instructions || '', terms: service.terms || '', consent_text: service.consent_text || '', confirmation_text: service.confirmation_text || ''};
      const texts = card(content, 'النصوص الفعلية للخدمة — وليست أزرارًا شكلية'), inputs = {};
      for (const [key, label] of [['instructions', 'تعليمات العميل'], ['terms', 'الشروط العامة'], ['consent_text', 'نص الإقرار'], ['confirmation_text', 'نص رسالة تأكيد المالك على واتساب']]) inputs[key] = field(texts, label, values[key], 'textarea', {maxLength: 12000});
      text(texts, 'إقرار عام قابل للتحرير، لا ضمان قانوني ولا وعد بقبول التمويل. متغيرات رسالة تأكيد الحجز: {name} {phone} {question} {service} {date} {time} {booking_id}. لا إرسال تلقائي.');
      button(texts, 'مراجعة النصوص الفعلية للاعتماد في A9', () => { const next = {}; for (const [k, input] of Object.entries(inputs)) next[k] = cleanText(input.value, k === 'confirmation_text' ? 4000 : 10000); if (!next.terms || !next.consent_text) fail('أكمل الشروط والإقرار.'); reviewTexts(s, x, next); }, true);
      text(texts, 'حفظ النصوص الفعلية مستقل عن حفظ قائمة الوظائف؛ كلاهما يمر ببطاقة اعتماد وقراءة تحقق.');
      const stepsBox = card(content, 'وظائف التسليم بالترتيب'), list = el('div', 'f99a10-step-list'); stepsBox.append(list); const rows = [];
      function add(value = {type: 'text', text: ''}) {
        const row = el('section', 'f99a10-step'); const item = {row}; rows.push(item); list.append(row);
        const type = select(row, 'نوع الوظيفة', value.type, Object.entries(TYPES)), body = field(row, 'النص / المعلومات / التعليمات', value.text, 'textarea', {maxLength: 10000}), label = field(row, 'نص الزر', value.button_label, 'text', {maxLength: 120}), consent = check(row, 'تتطلب إقرار قراءة وموافقة قبل المتابعة', value.require_consent);
        const url = field(row, 'رابط خارجي HTTPS (للرابط فقط)', value.url, 'url'), wa = field(row, 'رقم واتساب الأعمال الدولي (لوظيفة واتساب)', value.whatsapp_number, 'tel', {autocomplete: 'off'}), template = field(row, 'نص رسالة واتساب القابل للتعديل', value.whatsapp_template, 'textarea', {maxLength: 4000});
        item.read = () => ({type: type.value, text: body.value, button_label: label.value, require_consent: consent.checked, url: url.value, whatsapp_number: wa.value, whatsapp_template: template.value});
        function change() { url.parentElement.hidden = type.value !== 'external_link'; wa.parentElement.hidden = template.parentElement.hidden = type.value !== 'whatsapp'; label.parentElement.hidden = type.value === 'text'; }
        type.onchange = change; change(); const bar = actions(row);
        function move(delta) { const from = rows.indexOf(item), to = from + delta; if (to < 0 || to >= rows.length) return; rows.splice(from, 1); rows.splice(to, 0, item); rows.forEach(r => list.append(r.row)); }
        button(bar, 'نقل للأعلى', () => move(-1)); button(bar, 'نقل للأسفل', () => move(1)); button(bar, 'حذف الوظيفة من المسودة', () => { rows.splice(rows.indexOf(item), 1); row.remove(); });
      }
      values.delivery_steps.forEach(add); button(stepsBox, 'إضافة وظيفة', () => { if (rows.length >= 20) fail('الحد الأقصى 20 وظيفة.'); add(); });
      button(content, 'مراجعة وظائف التسليم والنصوص للاعتماد', () => {
        const next = {delivery_steps: validateSteps(rows.map(r => r.read()))};
        approveDraft(s, x, 'save_delivery', next, () => editDelivery(s, x, {...values, ...next}));
      }, true);
    }
    function reviewTexts(s, x, values) {
      const v = page(), key = productKey(x), source = serviceOf(x);
      const revision = Number(source.a9_revision ?? source.revision), toolRevision = Number(x.revision ?? source.revision);
      ownerNav(s);
      const box = card(content, 'اعتماد النصوص الفعلية وإقرار الخدمة');
      box.append(el('pre', 'f99a9-audit', JSON.stringify(values, null, 2)));
      text(box, 'تُحفظ النصوص في A9 ويرتفع إصدار الإقرار09 داخل معاملة واحدة. تبقى الحجوزات والإقرارات القديمة محفوظة، ويحتاج أي انتقال لاحق للنص الجديد موافقة جديدة. لا تعديل للرسوم أو السعر أو مدة الكود.');
      const yes = check(box, 'راجعت النصوص وأوافق على حفظها وإبطال موافقة النص القديم للعمليات المقبلة.');
      const lockKey = scope(s) + ':texts:' + key;
      const request = {product_key: key, expected_revision: toolRevision, expected_a9_revision: revision, service: copy(values), approval: true, request_id: uuid(w.crypto)};
      const save = button(box, 'اعتماد النصوص والحفظ ثم القراءة', async () => {
        if (!yes.checked || unresolved.has(lockKey) || !Number.isInteger(revision) || !Number.isInteger(toolRevision)) return;
        save.disabled = true; unresolved.set(lockKey, request); let acked = false;
        try {
          const ack = await call(s, 'save_texts', request, true); acked = true; if (!active(v, s)) return;
          const actuals = products(await call(s, 'catalog')); if (!active(v, s)) return;
          const actual = findProduct(actuals, key), actualService = serviceOf(actual);
          if (!actual || Number(actualService.a9_revision) !== Number(ack.service?.a9_revision)
            || Number(actualService.revision) !== Number(ack.revision) || Number(ack.revision) <= toolRevision
            || Number(actualService.a9_revision) <= revision
            || Object.entries(values).some(([k, value]) => actualService[k] !== value)) throw Error('TEXT_READBACK_NOT_CONFIRMED');
          unresolved.delete(lockKey); catalogSnapshot = actuals; renderOwner(s, actuals);
          say('حُفظت النصوص والإقرار ذريًا وأُعيد التحقق منهما من المركزية.');
        } catch (e) {
          if (!acked && !e.uncertain) { unresolved.delete(lockKey); save.disabled = false; }
          if (active(v, s)) { say(errorText(e), true); button(content, 'قراءة الكتالوج قبل أي حفظ آخر', openOwner); }
        }
      }, true);
      save.disabled = true; yes.onchange = () => { save.disabled = !yes.checked; };
      button(box, 'رجوع دون حفظ', () => editDelivery(s, x, {...source, ...values}));
    }
    function windowsEditor(host, initial) {
      const area = el('div'), rows = []; host.append(area);
      function add(value = {start: '', end: ''}) {
        const row = el('div', 'f99a10-window'), a = field(row, 'بداية الفترة', value.start, 'time'), b = field(row, 'نهاية الفترة', value.end === '24:00' ? '23:59' : value.end, 'time'), midnight = check(row, 'منتصف الليل: نهاية اليوم 24:00', value.end === '24:00');
        const item = {row, a, b, midnight}; rows.push(item); area.append(row); b.disabled = midnight.checked; midnight.onchange = () => { b.disabled = midnight.checked; };
        button(row, 'حذف الفترة', () => { rows.splice(rows.indexOf(item), 1); row.remove(); });
      }
      (initial || []).forEach(add); button(host, 'إضافة شفت / فترة', () => add()); return () => validateWindows(rows.map(r => ({start: r.a.value, end: r.midnight.checked ? '24:00' : r.b.value})));
    }
    function editCalendar(s, x, draft) {
      page(); ownerNav(s); const service = serviceOf(x), value = draft || service;
      const settings = card(content, 'سياسة الموعد — صلاحية الكود لا تلغي حق إدارة إيصال الموعد'), fields = {};
      const duration = select(settings, 'مدة الموعد', String(value.appointment_minutes || 30), [['30', '30 دقيقة'], ['60', '60 دقيقة'], ...(![30, 60].includes(Number(value.appointment_minutes)) && value.appointment_minutes ? [[String(value.appointment_minutes), 'المدة المحفوظة: ' + value.appointment_minutes]] : [])]);
      for (const [k, label, fallback] of [['buffer_minutes', 'فاصل بعد كل موعد بالدقائق', 0], ['min_notice_minutes', 'أقل مهلة قبل الحجز', 15], ['change_cutoff_minutes', 'مهلة منع التعديل (مثال 15 أو 60 دقيقة)', 15], ['cancellation_cutoff_minutes', 'مهلة منع الإلغاء (مثال 15 أو 60 دقيقة)', 60]]) fields[k] = field(settings, label, value[k] ?? fallback, 'number', {min: 0, max: 525600, step: 1});
      text(settings, 'pending وconfirmed يحجزان الوقت عالميًا. المرحلة موثوقة من دفعة الكود وليست اختيار العميل. لا إلغاء تلقائي للحجز عند انتهاء الكود.');
      const stage = {}, stageEnabled = {};
      for (const [key, label] of [['first', 'فترات الحجز الجديد'], ['renewal', 'فترات التجديد']]) {
        const box = card(content, label); stageEnabled[key] = check(box, 'استخدام جدول مستقل لهذه المرحلة (وإلا يرث ساعات A9 المحفوظة)', !!value.stage_windows?.[key]); stage[key] = {};
        for (let i = 1; i <= 7; i++) { const day = el('fieldset', 'f99a9-day'); day.append(el('legend', '', DAYS[i - 1])); box.append(day); stage[key][i] = windowsEditor(day, value.stage_windows?.[key]?.[String(i)] || service.hours?.[String(i)] || []); }
        text(box, 'بعد تفعيل الجدول، يوم بلا فترات = مغلق. 24:00 نهاية اليوم، 00:00 بداية يوم جديد.');
      }
      button(content, 'مراجعة التقويم وسياسات المهلة للاعتماد', () => {
        const next = {appointment_minutes: number(duration.value, 1, 480), stage_windows: {}};
        for (const [k, n] of Object.entries(fields)) next[k] = number(n.value);
        for (const k of ['first', 'renewal']) if (stageEnabled[k].checked) { next.stage_windows[k] = {}; for (let i = 1; i <= 7; i++) next.stage_windows[k][String(i)] = stage[k][i](); }
        next.stage_windows = validateStageWindows(next.stage_windows); approveDraft(s, x, 'save_calendar', next, () => editCalendar(s, x, next));
      }, true);
    }
    async function openPending() {
      const s = ownerSession(), v = open(s || {role: 'public'}, 'طلبات المواعيد واعتماد المالك');
      if (!s) { text(content, 'جلسة المالك الأصلية مطلوبة.'); button(content, 'دخول المنصة', login); return; }
      ownerNav(s); say('جاري قراءة الطلبات...');
      try {
        const r = await call(s, 'pending', {offset: 0}); if (!active(v, s)) return;
        const rows = r.bookings || r.items; if (!Array.isArray(rows)) throw Error('BAD_PENDING_CONTRACT');
        if (!rows.length) text(card(content, 'لا توجد طلبات معلقة'), 'اعتماد المواعيد لا يحدث تلقائيًا.');
        for (const b of rows) {
          const box = bookingCard(content, b, true), row = actions(box);
          if (['pending', 'proposed'].includes(b.status)) {
            button(row, 'اعتماد الموعد', () => reviewOwnerBooking(s, b, 'approve'), true); button(row, 'رفض الطلب', () => reviewOwnerBooking(s, b, 'reject')); button(row, 'اقتراح موعد آخر', () => reviewOwnerBooking(s, b, 'propose'));
          }
          if (['confirmed', 'pending', 'proposed'].includes(b.status)) button(row, 'إلغاء من المالك مع اختيار التعويض', () => ownerCancel(s, b));
        }
        if (r.has_more) text(content, 'هناك طلبات إضافية. استخدم تحميل الصفحة التالية.');
        if (r.has_more) button(content, 'الطلبات التالية', () => pendingPage(s, 100));
        renderNotifications(r.items || []);
        button(content, 'الحجوزات الحالية للإلغاء والإدارة', openOwnerBookings); say('قراءة الطلبات من المركزية، لا WhatsApp مرسل.'); await refreshBadge();
      } catch (e) { if (active(v, s)) { say(errorText(e), true); button(content, 'إعادة قراءة الطلبات', openPending); } }
    }
    async function pendingPage(s, offset) {
      const v = page(); ownerNav(s);
      const r = await call(s, 'pending', {offset}); if (!active(v, s)) return;
      const rows = r.bookings || r.items; if (!Array.isArray(rows)) throw Error('BAD_PENDING_CONTRACT');
      for (const b of rows) { const box = bookingCard(content, b, true); for (const [action, label] of [['approve', 'اعتماد'], ['reject', 'رفض'], ['propose', 'اقتراح موعد']]) if (['pending', 'proposed'].includes(b.status)) button(box, label, () => reviewOwnerBooking(s, b, action)); }
      renderNotifications(r.items || []);
      if (r.has_more && (rows.length || r.items?.length)) button(content, 'الصفحة التالية', () => pendingPage(s, offset + 100));
    }
    function renderNotifications(items) { const box = card(content, 'تنبيهات وسجل قرارات محفوظة'); for (const n of items) { const line = card(box, 'حدث: ' + String(n.action || 'تغيير موعد')); text(line, 'الحجز: ' + String(n.booking_id || '') + ' • ' + formatDate(n.created_at)); if (n.details?.apology) text(line, n.details.apology); if (n.details?.compensation?.kind) text(line, 'التعويض المسجل: ' + n.details.compensation.kind); } }
    function bookingCard(host, b, owner = false) {
      const box = card(host, BOOKING_STATES[b.status] || 'حالة تحتاج تحققًا'); text(box, 'رقم الطلب / الحجز: ' + String(b.id || b.booking_id || ''));
      text(box, 'الموعد: ' + formatDate(b.starts_at) + ' — ' + formatDate(b.ends_at));
      if (owner) { text(box, 'المنتج: ' + b.product_key); text(box, 'الاسم: ' + (b.name || '')); text(box, 'الجوال: ' + (b.phone || '')); text(box, b.question || ''); }
      if (b.proposed_start || b.proposed_starts_at) text(box, 'موعد بديل مقترح: ' + formatDate(b.proposed_start || b.proposed_starts_at) + '. ليس موعدًا معتمدًا.');
      if (b.status === 'pending' && b.proposal_origin === 'owner' && b.client_ack === false) text(box, 'اقتراح المالك لهذا الوقت يحتاج موافقتك، ثم اعتماد المالك النهائي؛ لم يُعتمد بعد.');
      const cancellation = b.owner_cancellation || {};
      if (cancellation.apology) text(box, cancellation.apology);
      if (cancellation.reason) text(box, 'سبب إلغاء المالك: ' + cancellation.reason);
      const c = cancellation.compensation;
      if (c) { text(box, c.message || c.text || 'اختيار التعويض: ' + ({none: 'دون تعويض إضافي، مع حق بديل', duration: 'زيادة مدة البديل', extra_appointment: 'موعد إضافي', custom: 'تعويض مخصص', coupon: 'اقتراح كوبون غير جاهز للدفع'}[c.kind] || 'غير معروف')); if (c.appointment_minutes) text(box, 'مدة الموعد البديل المعتمدة: ' + c.appointment_minutes + ' دقيقة. يلزم توفر كامل المدة.'); if (c.kind === 'coupon') text(box, 'اقتراح كوبون فقط، ليس خصم دفع عاملًا أو تعويضًا ماليًا منفذًا.'); }
      return box;
    }
    function reviewOwnerBooking(s, b, action) {
      const v = page(); ownerNav(s); bookingCard(content, b, true); const box = card(content, 'مراجعة قرار المالك: ' + ({approve: 'اعتماد', reject: 'رفض', propose: 'اقتراح وقت'}[action]));
      const note = field(box, 'ملاحظة للقرار', '', 'textarea'); const start = action === 'propose' ? field(box, 'التاريخ والوقت المقترحان بتوقيت الرياض', '', 'datetime-local') : null;
      const consent = check(box, 'أوافق صراحة على هذا القرار لهذا الحجز، بعد التحقق المركزي من التداخل.');
      const go = button(box, 'اعتماد القرار والحفظ ثم القراءة', async () => {
        if (!consent.checked) return;
        const payload = {booking_id: b.id, expected_booking_revision: Number(b.revision), approval: true, reason: cleanText(note.value, 2500), ...(start ? {start: localISO(start.value)} : {})};
        await ownerMutation(s, action, payload, v, go, openPending);
      }, true); go.disabled = true; consent.onchange = () => { go.disabled = !consent.checked; }; button(box, 'رجوع دون حفظ', openPending);
    }
    async function ownerMutation(s, action, payload, v, go, reload) {
      const key = scope(s) + ':booking:' + payload.booking_id;
      if (unresolved.has(key)) { say('توجد عملية غير محسومة لهذا الحجز. اقرأ السجل أولًا.', true); return; }
      const attempt = {action, payload: {...payload, request_id: uuid(w.crypto)}}; unresolved.set(key, attempt); go.disabled = true; let acked = false;
      try {
        const ack = await call(s, action, attempt.payload, true); acked = true; if (!ack.booking?.id) throw Object.assign(Error('BOOKING_ACK_INVALID'), {uncertain: true}); if (!active(v, s)) return;
        const day = dayInRiyadh(ack.booking.starts_at), read = unpack(await w.finoCentralAdminCall('f99a9_owner', {p_action: 'schedule', p_data: {from: day, to: day, product_key: ack.booking.product_key, offset: 0}}));
        const actual = read.items?.find(x => x.id === ack.booking.id);
        if (!live(s) || !actual || actual.status !== ack.booking.status || Date.parse(actual.starts_at) !== Date.parse(ack.booking.starts_at)) throw Object.assign(Error('BOOKING_READBACK_CHANGED'), {uncertain: true});
        await reload(); unresolved.delete(key); await refreshBadge(); say('ورد رد مركزي وأُعيدت قراءة حالة الحجز ووقته من السجل.');
        if (current?.role === 'owner' && live(s)) { const result = bookingCard(content, ack.booking, true); const href = safeWhatsApp(ack.whatsapp_url); if (href) addWhatsApp(result, href); }
      }
      catch (e) { if (!acked && !e.uncertain) { unresolved.delete(key); go.disabled = false; } if (active(v, s)) { say(errorText(e), true); button(content, 'إعادة القراءة دون تكرار القرار', reload); } }
    }
    async function openOwnerBookings() {
      const s = ownerSession(), v = open(s || {role: 'public'}, 'إدارة الحجوزات الحالية'); if (!s) { text(content, 'يلزم دخول المالك.'); return; }
      ownerNav(s); const box = card(content, 'نطاق الحجوزات الأصلي A9 — قراءة فقط'), today = dayInRiyadh(), from = field(box, 'من تاريخ', today, 'date'), to = field(box, 'إلى تاريخ', today, 'date'), list = el('div'); content.append(list);
      async function load() {
        if (!validDay(from.value) || !validDay(to.value) || from.value > to.value || (Date.parse(to.value) - Date.parse(from.value)) > 30 * 86400000) fail('حدد نطاقًا حتى 31 يومًا.');
        const r = unpack(await w.finoCentralAdminCall('f99a9_owner', {p_action: 'schedule', p_data: {from: from.value, to: to.value, offset: 0}})); if (!active(v, s)) return;
        if (!Array.isArray(r.items)) throw Error('BAD_SCHEDULE_CONTRACT'); list.replaceChildren();
        for (const b of r.items) { const n = bookingCard(list, b, true); if (['confirmed', 'pending', 'proposed'].includes(b.status)) { button(n, 'إلغاء المالك ومراجعة التعويض', () => ownerCancel(s, b)); button(n, 'أقرب شواغر لهذا الحجز الموثق', () => ownerClosest(s, b)); } }
        if (r.has_more) text(list, 'يعرض هذا النطاق أول 100 حجز؛ ضيّق النطاق أو استخدم سجل A9 الأصلي للصفحات التالية.');
        say('أُعيدت قراءة سجل A9، والإلغاء سيُحفظ عبر 09 مع الأثر.');
      }
      button(box, 'عرض الحجوزات الفعلية في النطاق', load, true);
      void load().catch(e => { if (active(v, s)) say(errorText(e), true); });
    }
    async function ownerCancel(s, b) {
      const v = page(); ownerNav(s); bookingCard(content, b, true); const box = card(content, 'إلغاء المالك — لا تعويض تلقائي');
      if (!Number.isInteger(Number(b.revision))) {
        const read = await call(s, 'closest_available', {booking_id: b.id}); if (!active(v, s)) return;
        if (read.booking_id !== b.id || !Number.isInteger(Number(read.revision))) throw Error('BOOKING_REVISION_UNAVAILABLE'); b = {...b, revision: Number(read.revision)};
      }
      const reason = field(box, 'سبب الإلغاء — إلزامي', '', 'textarea', {maxLength: 2500});
      const apology = field(box, 'رسالة الاعتذار القابلة للتعديل', 'نعتذر لك عن إلغاء موعدك لظروف خارجة عن إرادتنا، ونقدّر تفهّمك. يمكنك اختيار موعد بديل من الأوقات المتاحة.', 'textarea');
      const type = select(box, 'اختيار التعويض الصريح', 'none', [['none', 'بدون تعويض إضافي'], ['duration', 'زيادة مدة الموعد (مثل 15 ← 30)'], ['coupon', 'اقتراح كوبون — ليس خصم دفع جاهزًا'], ['extra_appointment', 'موعد إضافي'], ['custom', 'تعويض مخصص']]);
      const originalMinutes = Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000);
      const minutes = field(box, 'مدة الموعد البديل كاملة بالدقائق', Math.max(30, originalMinutes + 15), 'number', {min: originalMinutes + 1, max: 180}), message = field(box, 'رسالة التعويض المعتمد (اختيارية دون وعود دفع)', '', 'textarea'), coupon = field(box, 'مرجع اقتراح الكوبون — ليس كود الباقة أو إثبات خصم', '', 'text'), custom = field(box, 'تفاصيل التعويض المخصص', '', 'textarea');
      const hold = check(box, 'حجب الفترة الملغاة بدل تحريرها لحجز مباشر', false), approval = check(box, 'راجعت الاعتذار والوقت والتعويض، وأوافق على إلغاء هذا الحجز فقط مع حفظ الأثر.');
      function changed() { minutes.parentElement.hidden = type.value !== 'duration'; coupon.parentElement.hidden = type.value !== 'coupon'; custom.parentElement.hidden = type.value !== 'custom'; }
      type.onchange = changed; changed(); text(box, 'لا يحصّل المتصفح رسومًا ولا ينشئ كوبونًا أو موعدًا إضافيًا تلقائيًا. المدة المعتمدة تُفحص كاملة في المركزية.');
      const submit = button(box, 'اعتماد الإلغاء والتعويض المختار ثم القراءة', async () => {
        if (!approval.checked) return;
        const compensation = {kind: type.value, message: cleanText(message.value, 4000)}, why = cleanText(reason.value, 2500);
        if (!why) fail('اكتب سبب إلغاء المالك.');
        if (type.value === 'duration') compensation.appointment_minutes = number(minutes.value, originalMinutes + 1, 180);
        if (type.value === 'extra_appointment') compensation.count = 1;
        if (type.value === 'coupon') compensation.coupon_reference = cleanText(coupon.value, 200);
        if (type.value === 'custom') { compensation.text = cleanText(custom.value, 4000); if (!compensation.text) fail('اكتب تفاصيل التعويض المخصص.'); }
        await ownerMutation(s, 'owner_cancel', {booking_id: b.id, expected_booking_revision: Number(b.revision), reason: why, apology: cleanText(apology.value, 4000), hold_slot: hold.checked, compensation, approval: true}, v, submit, openOwnerBookings);
      }, true); submit.disabled = true; approval.onchange = () => { submit.disabled = !approval.checked; };
      button(box, 'رجوع دون إلغاء', openOwnerBookings);
    }
    async function ownerClosest(s, b) {
      const v = page(); ownerNav(s); bookingCard(content, b, true); const box = card(content, 'أقرب فترات كاملة لهذا الحجز فقط');
      const r = await call(s, 'closest_available', {booking_id: b.id}); if (!active(v, s)) return;
      if (r.booking_id !== b.id || !Array.isArray(r.items) || !Number.isInteger(Number(r.revision))) throw Error('CLOSEST_CONTRACT_INVALID');
      text(box, 'الكود مختار عبر حجز العميل القائم والمصرح به، لا توزيع عشوائي. اختيار الوقت يظل pending حتى موافقة العميل واعتماد المالك.');
      if (!r.items.length) text(box, 'لا توجد فترة كاملة ضمن أفق الحجز.');
      for (const slot of r.items) {
        if (!validInstant(slot.starts_at) || !validInstant(slot.ends_at)) throw Error('BAD_SLOT');
        button(box, formatDate(slot.starts_at) + ' — ' + formatDate(slot.ends_at), () => {
          const review = page(); ownerNav(s); const c = card(content, 'اعتماد اقتراح النقل لهذا الحجز'); text(c, 'رقم الحجز: ' + b.id); text(c, 'الوقت المقترح: ' + formatDate(slot.starts_at));
          const yes = check(c, 'أوافق على حجز هذا الوقت المقترح للحجز المحدد فقط، لا اعتماد نهائي.');
          const go = button(c, 'حفظ اقتراح النقل ثم إعادة القراءة', () => { if (yes.checked) return ownerMutation(s, 'reserve_for_booking', {booking_id: b.id, expected_booking_revision: Number(r.revision), start: slot.starts_at}, review, go, openPending); }, true); go.disabled = true; yes.onchange = () => { go.disabled = !yes.checked; };
        });
      }
      text(box, 'التوزيع الجماعي على قائمة انتظار غير متاح في العقد (NOT_IMPLEMENTED). لا زر شكلي أو اختيار عملاء تلقائي.');
    }
    function allocateCodes(s, x) {
      page(); ownerNav(s); const box = card(content, 'تخصيص أكواد بمرحلة موثوقة من المالك'), count = field(box, 'عدد الأكواد', 10, 'number', {min: 1, step: 1}), stage = select(box, 'مرحلة الدفعة — لا يختارها العميل', 'first', [['first', 'أول شراء'], ['renewal', 'تجديد']]);
      text(box, 'التخصيص لا ينشر دفعة أو ينشئ عرض شراء أو يثبت استيرادًا أو دفعًا. السياسة من الخدمة المحفوظة فقط.');
      button(box, 'مراجعة تخصيص الدفعة للاعتماد', () => {
        const n = number(count.value, 1, 100000), chosenStage = stage.value, v = page(); ownerNav(s); const review = card(content, 'بطاقة اعتماد الدفعة'); text(review, 'المنتج: ' + productKey(x) + ' • العدد: ' + n + ' • المرحلة: ' + (chosenStage === 'renewal' ? 'تجديد' : 'أول شراء'));
        const yes = check(review, 'أوافق على تخصيص هذا العدد وهذه المرحلة لهذا المنتج، دون نشر أو ادعاء دفع.');
        const request = {product_key: productKey(x), count: n, purchase_stage: chosenStage, approve: true, request_id: uuid(w.crypto)}, lockKey = scope(s) + ':allocation:' + productKey(x);
        const go = button(review, 'اعتماد تخصيص الدفعة ثم قراءة المخزون', async () => {
          if (!yes.checked || unresolved.has(lockKey)) return; go.disabled = true; unresolved.set(lockKey, request);
          let acked = false;
          try {
            const ack = await call(s, 'allocate', request, true); acked = true; if (!isUUID(ack.allocation_id) || Number(ack.count) !== n || ack.purchase_stage !== chosenStage) throw Object.assign(Error('ALLOCATION_ACK_INVALID'), {uncertain: true});
            const stock = unpack(await w.finoCentralAdminCall('f99a9_owner', {p_action: 'stock', p_data: {product_key: productKey(x), offset: 0}})); if (!active(v, s)) return;
            const actual = stock.items?.find(b => b.allocation_id === ack.allocation_id); if (!actual || Number(actual.count) !== n) throw Object.assign(Error('ALLOCATION_READBACK_UNCONFIRMED'), {uncertain: true});
            unresolved.delete(lockKey); text(review, 'الدفعة المحجوزة: ' + ack.allocation_id + ' • العدد المطابق: ' + n + '. افتح المخزون لتنزيل الدفعة نفسها واعتماد الرفع الخارجي صراحة.');
            if (typeof w.F99V17OpenInventory === 'function') button(review, 'فتح مخزون المنتج الأصلي', () => { close(); w.F99V17OpenInventory(productKey(x)); }, true);
            say('قراءة مخزون تؤكد الدفعة المحجوزة فقط. لا بيع أو استيراد أو دفع تلقائي.');
          } catch (e) { if (!acked && !e.uncertain) { unresolved.delete(lockKey); go.disabled = false; } if (active(v, s)) { say(errorText(e), true); text(review, 'راجع المخزون قبل أي تخصيص جديد؛ لا ننشئ دفعة بديلة عند غموض الرد.'); } }
        }, true); go.disabled = true; yes.onchange = () => { go.disabled = !yes.checked; };
      }, true);
    }
    function couponApi(s) {
      if (typeof w.F99Coupons?.createApi !== 'function') return null;
      return w.F99Coupons.createApi({
        rpc: async (fn, args) => { if (!live(s)) throw Error('SESSION_CHANGED'); const r = await w.finoRpc(fn, args, 20000); if (!live(s)) throw Error('SESSION_CHANGED'); return r; },
        ownerRpc: async (fn, args) => { if (s.role !== 'owner' || !live(s)) throw Error('OWNER_SESSION_INVALID'); const r = await w.finoCentralAdminCall(fn, args); if (!live(s)) throw Error('SESSION_CHANGED'); return r; },
        getOwnerToken: () => s.role === 'owner' && live(s) ? s.token : ''
      });
    }
    function mountCoupons(host, s, options) {
      const api = couponApi(s);
      if (!api || typeof w.F99Coupons?.mountClientWidget !== 'function') { text(host, 'وحدة الكوبونات غير متاحة؛ لا سعر بعد الخصم ولا ادعاء خصم فعلي.', 'f99a9-muted'); return; }
      couponMount = w.F99Coupons.mountClientWidget(host, {...options, api});
    }
    function openOwnerCoupons() {
      const s = ownerSession(); open(s || {role: 'public'}, 'كوبونات مستقلة — ليست أكواد تفعيل');
      if (!s) { text(content, 'دخول المالك الأصلي مطلوب.'); return; } ownerNav(s); const api = couponApi(s);
      if (!api || typeof w.F99Coupons?.mountOwnerPanel !== 'function') { text(content, 'وحدة الكوبونات غير محملة. هذه الميزة غير متاحة ولا خصم عاملًا.'); return; }
      couponMount = w.F99Coupons.mountOwnerPanel(content, {api});
    }
    async function refreshBadge() {
      const host = d.getElementById('ownerHub'), badge = d.getElementById('f99a10-owner-badge'), s = ownerSession();
      if (!badge || !s || !host || host.hidden || d.hidden || !host.getClientRects().length || badgeBusy) { if (badge && !s) { badge.textContent = 'طلبات المواعيد — يتطلب دخول المالك'; badgeToken = ''; } return; }
      badgeBusy = true; badgeToken = s.token;
      try { const r = await call(s, 'pending', {offset: 0}); if (!live(s) || badgeToken !== s.token) return; const rows = r.bookings || r.items; if (!Array.isArray(rows)) throw Error('BAD_PENDING_CONTRACT'); const count = Number.isInteger(Number(r.pending_count)) ? Number(r.pending_count) : rows.length; badge.textContent = 'طلبات تنتظر المالك: ' + count + ' • تنبيهات محفوظة: ' + (Array.isArray(r.items) ? r.items.length : 0) + ' — اعتماد / رفض / اقتراح'; badge.dataset.unread = count || r.items?.length ? '1' : '0'; }
      catch (_) { if (live(s)) badge.textContent = 'طلبات المواعيد — تعذر التحقق، اضغط لإعادة القراءة'; }
      finally { badgeBusy = false; }
    }
    async function openCatalog() {
      const s = {role: 'public'}, v = open(s, 'كتالوج الخدمات وحالات الباقات'); say('جاري قراءة الحالة والمخزون من المركزية...');
      try { const r = await call(s, 'catalog'); if (!active(v, s)) return; const items = products(r); say('الحالة معروضة من الخادم؛ لا يؤثر منع الشراء على حقوق الأكواد القديمة.');
        for (const x of items) { const p = storeProducts().find(p => p.key === productKey(x)); if (!isHumanStoreProduct(p)) continue; const box = summary(content, x); button(box, 'التفاصيل والتعليمات قبل الشراء', () => openOffer(productKey(x)), true); }
        button(content, 'لدي كود — دخول المنصة', login);
      } catch (e) { if (active(v, s)) { say(errorText(e), true); button(content, 'إعادة التحقق', openCatalog); } }
    }
    function publicProduct(r, key) { const x = r?.product || r?.service || (Array.isArray(r?.items) ? findProduct(r.items, key) : null) || (Array.isArray(r?.products) ? findProduct(r.products, key) : null); if (!x || productKey(x) !== key) throw Error('BAD_PRODUCT_CONTRACT'); return x; }
    async function openOffer(key, resume) {
      const s = {role: 'public', key}, v = open(s, 'التعليمات والشروط قبل الشراء'); say('جاري التحقق من العرض...');
      try {
        const r = await call(s, 'context'), x = publicProduct(r, key); if (!active(v, s)) return;
        let service = serviceOf(x);
        if (!resume && canPurchase(x)) { const detail = unpack(await w.finoRpc('f99a9_public', {p_product_key: key}, 20000)); if (!detail.service || detail.service.product_key !== key || !KINDS.includes(detail.service.kind)) throw Error('A9_OFFER_NOT_AVAILABLE'); service = detail.service; }
        if (!active(v, s)) return; summary(content, {...x, service}); const box = card(content, 'تعليمات وشروط وإقرار الخدمة');
        text(box, service.instructions || x.purchase_instructions || 'راجع تعليمات التفعيل المعروضة في المتجر الأصلي.'); text(box, service.terms || x.terms || ''); text(box, service.consent_text || x.consent_text || '');
        if (resume) { const originalTerms = d.querySelector('#f99s-modal .f99s-terms'); if (originalTerms) text(box, originalTerms.textContent); text(box, 'الموافقة هنا لا تستبدل موافقة الشروط أو أسئلة الأهلية في المتجر الأصلي؛ سيُعاد فحصها عند المتابعة.'); }
        completion(content, x.presentation || service.presentation); text(content, 'فتح منصة الدفع ليس إثبات سداد أو تفعيل كود أو اعتماد موعد. الخصم الفعلي يتطلب ارتباطًا متحققًا بطلب دفع.');
        const consent = check(box, 'قرأت التعليمات والشروط والإقرار المعروض وأوافق عليها قبل المتابعة.');
        const buy = button(content, resume ? 'الموافقة والعودة إلى تدفق الشراء الأصلي' : 'الموافقة والمتابعة إلى منصة الدفع', async () => {
          if (!consent.checked || !active(v, s)) return; buy.disabled = true;
          try { const now = publicProduct(await call(s, 'context'), key); if (!active(v, s)) return; if (!canPurchase(now)) fail('الباقة غير متاحة للشراء أو نفدت الأكواد. لم نفتح الدفع.');
            if (!same(now, x)) fail('تغير العرض؛ أعد قراءة الشروط والموافقة.');
            if (!resume) { const detail = unpack(await w.finoRpc('f99a9_public', {p_product_key: key}, 20000)); if (!active(v, s)) return; if (!same(detail.service, service)) fail('تغيرت تفاصيل A9؛ أعد القراءة قبل الدفع.'); }
            if (resume) { close(); resume(); return; }
            const href = safeHttps(service.checkout_url || x.checkout_url); if (!href) fail('لا يوجد رابط دفع HTTPS موثق؛ استخدم التدفق الأصلي.'); w.open(href, '_blank', 'noopener,noreferrer'); say('طُلب فتح منصة الدفع فقط؛ لا تأكيد دفع أو خصم أو حجز.');
          } finally { if (active(v, s)) buy.disabled = !consent.checked || !canPurchase(x); }
        }, true);
        const enoughTerms = !!String(service.terms || x.terms || '').trim() && !!String(service.consent_text || x.consent_text || '').trim();
        buy.disabled = true; consent.onchange = () => { buy.disabled = !consent.checked || !canPurchase(x) || (!resume && !enoughTerms); };
        if (!canPurchase(x)) text(content, 'الشراء غير متاح حسب الحالة والمخزون المركزي. أكوادك القديمة لا تُلغى.');
        if (!resume && !enoughTerms) text(content, 'لا يمكن الشراء قبل قراءة شروط وإقرار محفوظين من المركزية.');
        mountCoupons(content, {role: 'public', key}, {productKey: key, stage: 'first', activated: false});
        button(content, 'دخول الكود بعد الشراء', login);
      } catch (e) { if (active(v, s)) { say(errorText(e), true); button(content, 'إعادة قراءة العرض', () => openOffer(key, resume)); } }
    }
    function checkContext(r, s) {
      if (s.role === 'receipt') {
        const b = r.booking || r.bookings?.find(x => x.id === s.receipt.booking_id); if (!b || b.id !== s.receipt.booking_id || b.product_key !== s.key) throw Error('BAD_RECEIPT_SCOPE');
        const ids = new Set([b.id, ...(r.credits || []).map(x => x.booking_id).filter(Boolean)]), bookings = r.bookings || [b];
        if (!Array.isArray(bookings) || bookings.some(x => x.product_key !== s.key || !ids.has(x.id))) throw Error('BAD_RECEIPT_SCOPE');
        return {...r, bookings};
      }
      const x = r.service; if (!x || x.product_key !== s.key || !KINDS.includes(x.kind) || !s.services.includes(x.kind) || !Array.isArray(r.bookings) || r.timezone !== TZ || !Number.isInteger(Number(x.revision))) throw Error('BAD_CONTEXT_CONTRACT');
      if (!String(x.terms || '').trim() || !String(x.consent_text || '').trim()) throw Error('CONSENT_UNAVAILABLE'); return r;
    }
    async function openClient(given, key) {
      const s = clientSession(given, key), v = open(s || {role: 'public'}, 'خدمتك وطلبات مواعيدك');
      if (!s) { text(card(content, 'يلزم كودك المفعّل وجلسة جهازك'), 'لا يتجاوز هذا الامتداد حراسة الدخول. يمكنك إدارة موعد محفوظ بإيصال محدود دون فتح الباقة.'); button(content, 'دخول المنصة', login); button(content, 'مواعيدي المحفوظة', openReceipts); return; }
      say('جاري قراءة خدمة كودك والإقرارات والحجوزات...');
      try { const ctx = checkContext(await call(s, 'context'), s); if (active(v, s)) renderClient(s, ctx); }
      catch (e) { if (active(v, s)) { say(errorText(e), true); button(content, 'إعادة القراءة', () => openClient(null, s.key)); button(content, 'مواعيدي المحفوظة', openReceipts); } }
    }
    function renderClient(s, ctx, message) {
      page(); const service = ctx.service;
      if (s.role === 'client') { const box = card(content, service.title || 'خدمتك'); text(box, service.description || ''); text(box, 'حقوق الكود تُراجع مركزيًا؛ حالة المتجر ليست إلغاءً لخدمتك.'); renderDelivery(s, ctx); }
      else text(card(content, 'إيصال موعد محدود بالجهاز والحجز'), 'يتيح إدارة هذا الموعد فقط، حتى بعد انتهاء الكود. لا يفتح باقة أو حاسبة أو حجزًا جديدًا إلا بديلًا معتمدًا لهذا الإلغاء عند إتاحة المركزية.');
      if (s.role === 'client' && service.approval_required !== true) { text(content, 'لم يُفعّل تقويم09 للاعتماد بعد. خدمات07 وحقوقها القائمة محفوظة دون تحويل حجز مؤكد إلى pending تلقائيًا.'); if (legacy?.openClient) button(content, 'فتح خدمة A9 الأصلية المحفوظة', () => { close(); legacy.openClient(null, s.key); }); }
      const pending = unresolved.get(scope(s));
      if (pending) { const n = card(content, 'محاولة غير محسومة'); text(n, 'راجع السجل أو كرر نفس معرّف الطلب، لا طلبًا جديدًا.'); const retry = button(n, 'إعادة نفس الطلب بمعرّفه الأصلي', () => runClientMutation(s, ctx, pending), true); retry.disabled = !!pending.busy; }
      for (const b of ctx.bookings) {
        const box = bookingCard(content, b), row = actions(box);
        if (['pending', 'confirmed', 'proposed'].includes(b.status) && !pending) { button(row, 'طلب إلغاء وفق المهلة', () => cancelBooking(s, ctx, b)); button(row, 'طلب تعديل الموعد', () => chooseSlots(s, ctx, {booking: b})); }
        if (b.status === 'pending' && b.proposal_origin === 'owner' && b.client_ack === false && !pending) button(row, 'قبول وقت المالك المقترح وانتظار الاعتماد', () => startClientMutation(s, ctx, 'reschedule', {booking_id: b.id, accept_proposal: true, expected_booking_revision: Number(b.revision), proposal_nonce: b.proposal_nonce}), true);
        const credits = b.credits || [];
        for (const credit of credits) if (credit.available === true && isUUID(credit.id) && !pending) button(row, credit.kind === 'extra_appointment' ? 'طلب الموعد الإضافي المعتمد' : 'احجز موعدًا بديلًا — دون شراء كود جديد', () => replacementConsent(s, ctx, {booking: b, credit, replacement: true}), true);
        const prepared = preparedWhatsApp.get(scope(s) + ':' + b.id), sameTime = prepared && Date.parse(prepared.start) === Date.parse(b.starts_at);
        const href = safeWhatsApp(b.whatsapp_url || ctx.whatsapp_url || (sameTime ? prepared.url : '')); if (href && ['pending', 'confirmed'].includes(b.status)) addWhatsApp(box, href);
      }
      if (s.role === 'client') {
        completion(content, service.presentation);
        if (ctx.renewal_eligible === true || ctx.renewal_available === true) text(content, 'عرض التجديد متاح وفق سياسة الباقة. لا يُخصم من شراء الكود السابق؛ الخصم يحتاج تحقق طلب التجديد في وحدة الكوبونات.', 'f99a9-muted');
        if (ctx.renewal_eligible === true && isUUID(ctx.renewal_offer_id)) mountCoupons(content, s, {productKey: s.key, stage: 'renewal', activated: true, renewalEligible: true, offerId: ctx.renewal_offer_id});
      }
      button(content, 'تحديث الحالة من المركزية', () => s.role === 'receipt' ? openReceipt(s.receipt) : openClient(null, s.key)); if (message) say(message);
      if(s.role==='client'&&ctx.bookings.some(b=>b.status==='completed'))w.dispatchEvent(new w.CustomEvent('f99s12:service-complete',{detail:{serviceComplete:true}}));
    }
    function acceptedStep(ctx, index) {
      if (ctx.content_accepted === true) return true; // 09 stores the FULL snapshot, not a local checkbox or per-step flag.
      const a = ctx.content_acceptances || ctx.acceptances || ctx.accepted_content || [];
      return Array.isArray(a) && a.some(x => x.step_index === index && Number(x.revision ?? x.service_revision) === Number(ctx.service.revision));
    }
    function renderDelivery(s, ctx) {
      const service = ctx.service, steps = Array.isArray(service.delivery_steps) ? service.delivery_steps : [];
      text(card(content, 'التعليمات والشروط والإقرار المحفوظة'), service.instructions); const terms = card(content, 'شروط خدمتك الفعلية'); text(terms, service.terms); text(terms, service.consent_text);
      if (!steps.length) text(content, 'لم يُحدد المالك وظائف تسليم إضافية؛ تُحفظ طريقة A9 الأصلية دون فتح خدمة بديلة.');
      const list = el('ol', 'f99a10-delivery'); content.append(list);
      const allRead = steps.every((x, i) => !x.require_consent || acceptedStep(ctx, i));
      steps.forEach((step, index) => {
        const row = el('li'), box = card(row, TYPES[step.type] || 'وظيفة غير متاحة'); list.append(row); text(box, step.text || ''); const accepted = acceptedStep(ctx, index), blocked = step.require_consent === true && !accepted;
        if (step.require_consent) { text(box, accepted ? 'إقرار القراءة محفوظ من المركزية لهذه النسخة.' : 'هذه الوظيفة تتطلب إقرارًا محفوظًا، لا موافقة محلية فقط.'); if (!accepted) { const consent = check(box, 'قرأت نص هذه الوظيفة وأوافق عليه.'); const save = button(box, 'حفظ إقرار القراءة في المركزية', () => { if (!consent.checked) return; return startClientMutation(s, ctx, 'accept_content', {step_index: index, expected_revision: service.revision, accepted: true}); }, true); save.disabled = true; consent.onchange = () => { save.disabled = !consent.checked; }; } }
        if (step.type === 'external_link') { const href = safeHttps(step.url); if (href) { const b = button(box, step.button_label || 'ابدأ الخدمة', () => { if (!blocked && active(view, s)) w.open(href, '_blank', 'noopener,noreferrer'); }, true); b.disabled = blocked; } else text(box, 'الرابط المحفوظ غير صالح؛ لم نفتح رابطًا بديلًا.'); }
        if (step.type === 'whatsapp') {
          const href = whatsapp(step.whatsapp_number, step.whatsapp_template);
          if (href) { const b = button(box, step.button_label || 'فتح رسالة واتساب الأعمال', () => { if (!blocked && allRead) w.open(href, '_blank', 'noopener,noreferrer'); }, true); b.disabled = blocked || !allRead; text(box, 'يفتح نص المالك الجاهز فقط؛ تضغط إرسال بنفسك. سيُشارك النص مع واتساب عند اختيار فتحه.'); }
        }
        if (step.type === 'appointment') { const b = button(box, step.button_label || 'طلب موعد — ينتظر موافقة المالك', () => readBookingConsent(s, ctx), true); b.disabled = blocked || !allRead || service.approval_required !== true || !!unresolved.get(scope(s)) || !(Number(ctx.quota?.remaining) > 0); }
      });
      if (!steps.some(x => x.type === 'appointment') && service.service_mode === 'appointment') { const b = button(content, 'طلب موعد — تعليمات وإقرار أولًا', () => readBookingConsent(s, ctx), true); b.disabled = !allRead || service.approval_required !== true || !!unresolved.get(scope(s)) || !(Number(ctx.quota?.remaining) > 0); }
      if (service.service_mode === 'manual' && !steps.length) text(content, 'الخدمة يدوية وفق تعليمات المالك، دون طلب آلي غير موثق.');
    }
    function readBookingConsent(s, ctx) {
      page(); const box = card(content, 'قراءة التعليمات والشروط قبل طلب الموعد'); text(box, ctx.service.instructions); text(box, ctx.service.terms); text(box, ctx.service.consent_text); text(box, 'تُستخدم بيانات الاتصال لتنظيم الموعد. لا تدخل بيانات بنكية أو هوية أو معلومات حساسة.');
      const yes = check(box, 'قرأت التعليمات والشروط والإقرار لهذه النسخة، وأوافق على استخدام بيانات الاتصال لتنظيم الموعد.');
      const next = button(box, 'الموافقة ثم بيانات الاتصال', () => { if (yes.checked) contact(s, ctx, {accepted: true, expected_revision: ctx.service.revision}); }, true); next.disabled = true; yes.onchange = () => { next.disabled = !yes.checked; }; button(box, 'رجوع', () => renderClient(s, ctx));
    }
    function replacementConsent(s, ctx, flow) {
      page(); bookingCard(content, flow.booking); const box = card(content, 'حق موعد بديل معتمد — قراءة وموافقة');
      text(box, 'معرّف الحق: ' + flow.credit.id + ' • المدة الكاملة: ' + flow.credit.appointment_minutes + ' دقيقة. حق واحد محدد، وليس كودًا جديدًا أو تمديدًا للباقة.');
      if (ctx.service) { text(box, ctx.service.instructions); text(box, ctx.service.terms); text(box, ctx.service.consent_text); }
      else text(box, 'الإيصال لا يكشف المحتوى المدفوع. الطلب يستند إلى خدمة الموعد الأصلي وإقرار تنظيم البديل أدناه.');
      const yes = check(box, 'أوافق على استخدام بيانات اتصالي لتنظيم هذا الموعد البديل وانتظار موافقة المالك.');
      const next = button(box, 'الموافقة ثم بيانات موعد البديل', () => { if (yes.checked) contact(s, ctx, {accepted: true}, flow); }, true); next.disabled = true; yes.onchange = () => { next.disabled = !yes.checked; }; button(box, 'رجوع', () => renderClient(s, ctx));
    }
    function contact(s, ctx, details, flow = {}) {
      page(); const box = card(content, 'بيانات طلب الموعد — لا تُخزن محليًا'), name = field(box, 'اسمك', details.name || '', 'text', {maxLength: 80, minLength: 2, required: true}), p = field(box, 'جوال سعودي', details.phone || '', 'tel', {autocomplete: 'tel'}), question = field(box, 'استفسارك دون بيانات حساسة', details.question || '', 'textarea', {maxLength: 2000});
      button(box, 'عرض الأوقات المتاحة فعليًا', () => { const n = cleanText(name.value, 80), ph = saudiPhone(p.value), q = cleanText(question.value, 2000); if (n.length < 2 || !ph || q.length < 5) fail('أدخل اسمًا وجوالًا سعوديًا واستفسارًا واضحًا (5 محارف على الأقل).'); chooseSlots(s, ctx, {...flow, details: {...details, name: n, phone: '+' + ph, question: q}}); }, true); button(box, 'رجوع', () => flow.replacement ? replacementConsent(s, ctx, flow) : readBookingConsent(s, ctx));
    }
    function chooseSlots(s, ctx, flow) {
      const v = page(), box = card(content, flow.replacement ? 'موعد بديل وفق التعويض المعتمد' : flow.booking ? 'طلب تعديل الموعد' : 'الأوقات المتاحة الآن');
      text(box, 'توقيت الرياض. أي تغيير ينتظر المالك ولا يُعتمد تلقائيًا. يحدد الخادم مرحلة الكود ومدة الموعد كاملة.');
      if (s.role === 'receipt' && !flow.credit) {
        const input = field(box, 'الوقت المطلوب بتوقيت الرياض — يتحقق الخادم من التوفر والمدة كاملة', '', 'datetime-local');
        text(box, 'الإيصال يتيح قراءة slots لحق بديل غير مستهلك فقط؛ لتعديل الحجز القائم هذا وقت مطلوب وليس شاغرًا مؤكدًا. المركزية تتحقق من كامل المدة والتداخل.');
        button(box, 'مراجعة طلب الوقت البديل', () => reviewBooking(s, ctx, {...flow, slot: {starts_at: localISO(input.value)}}), true);
        button(box, 'رجوع', () => renderClient(s, ctx)); return;
      }
      const day = field(box, 'اليوم الميلادي', dayInRiyadh(), 'date'), slots = el('div', 'f99a9-slots'); box.append(slots); let selected = null, serial = 0;
      const next = button(box, 'مراجعة الطلب قبل الحفظ', () => { if (selected) reviewBooking(s, ctx, {...flow, slot: selected}); }, true); next.disabled = true;
      day.onchange = () => { ++serial; selected = null; slots.replaceChildren(); next.disabled = true; };
      const load = button(box, 'قراءة أوقات هذا اليوم من المركزية', async () => {
        if (!validDay(day.value)) fail('اختر يومًا صحيحًا.'); const n = ++serial, wanted = day.value; selected = null; slots.replaceChildren(); next.disabled = true; load.disabled = true;
        try { const r = await call(s, 'slots', {day: wanted, ...(flow.booking && !flow.replacement ? {exclude_booking_id: flow.booking.id} : {}), ...(flow.credit ? {credit_id: flow.credit.id} : {})}); if (!active(v, s) || serial !== n || day.value !== wanted) return; if (!Array.isArray(r.items) || r.timezone !== TZ) throw Error('BAD_SLOTS_CONTRACT');
          for (const slot of r.items) { if (!validInstant(slot.starts_at) || !validInstant(slot.ends_at) || Date.parse(slot.ends_at) <= Date.parse(slot.starts_at) || dayInRiyadh(slot.starts_at) !== wanted) throw Error('BAD_SLOT'); const b = button(slots, formatDate(slot.starts_at) + ' — ' + formatDate(slot.ends_at), () => { selected = slot; slots.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); next.disabled = false; }); b.setAttribute('aria-pressed', 'false'); }
          if (!r.items.length) text(slots, 'لا توجد فترة كاملة متاحة لهذا اليوم.'); say('أوقات مركزية؛ يعاد فحصها عند الحفظ منعًا للتداخل.');
        } catch (e) { if (active(v, s) && serial === n) { slots.replaceChildren(); selected = null; next.disabled = true; say(errorText(e), true); } } finally { if (active(v, s)) load.disabled = false; }
      }); button(box, 'رجوع', () => flow.replacement ? contact(s, ctx, flow.details, flow) : flow.booking ? renderClient(s, ctx) : contact(s, ctx, flow.details));
    }
    function reviewBooking(s, ctx, flow) {
      page(); const box = card(content, 'مراجعة طلب الموعد — ليس اعتمادًا'), start = flow.slot.starts_at;
      text(box, 'الوقت المطلوب: ' + formatDate(start)); if (flow.slot.ends_at) text(box, 'النهاية: ' + formatDate(flow.slot.ends_at)); if (flow.booking) text(box, 'الحجز المرجعي: ' + flow.booking.id);
      if (flow.details) { text(box, 'الاسم: ' + flow.details.name); text(box, 'الجوال: ' + flow.details.phone); text(box, flow.details.question); }
      text(box, 'يحفظ الخادم الطلب pending حتى موافقة المالك. لا رسالة WhatsApp تلقائية ولا شراء جديد لموعد بديل أتاحه المالك.');
      button(box, 'حفظ طلب الموعد وانتظار المالك', () => {
        const payload = flow.replacement ? {credit_id: flow.credit.id, start, ...flow.details} : flow.booking ? {booking_id: flow.booking.id, expected_booking_revision: Number(flow.booking.revision), start} : {start, ...flow.details};
        return startClientMutation(s, ctx, flow.replacement ? 'replacement' : flow.booking ? 'reschedule' : 'book', payload);
      }, true); button(box, 'رجوع لاختيار الوقت', () => chooseSlots(s, ctx, flow));
    }
    function cancelBooking(s, ctx, b) { page(); bookingCard(content, b); const box = card(content, 'طلب إلغاء وفق السياسة المركزية'), yes = check(box, 'أوافق على إلغاء هذا الحجز فقط إذا سمحت المهلة، مع الاحتفاظ بالسجل.'); const go = button(box, 'حفظ طلب الإلغاء ثم قراءة الحالة', () => { if (yes.checked) return startClientMutation(s, ctx, 'cancel', {booking_id: b.id, ...(Number.isInteger(Number(b.revision)) ? {expected_booking_revision: Number(b.revision)} : {})}); }, true); go.disabled = true; yes.onchange = () => { go.disabled = !yes.checked; }; button(box, 'رجوع دون إلغاء', () => renderClient(s, ctx)); }
    async function startClientMutation(s, ctx, action, payload) {
      if (unresolved.has(scope(s))) { renderClient(s, ctx); return; }
      const attempt = {action, payload: {...copy(payload), request_id: uuid(w.crypto)}, busy: false}; unresolved.set(scope(s), attempt); await runClientMutation(s, ctx, attempt);
    }
    async function runClientMutation(s, ctx, attempt) {
      if (attempt.busy || unresolved.get(scope(s)) !== attempt) return; attempt.busy = true;
      const v = page(), box = card(content, 'جاري الحفظ والتحقق'); text(box, 'لا تبدأ طلبًا جديدًا عند انقطاع الرد. معرّف الطلب ثابت لإعادة المحاولة الآمنة.');
      let acked = false;
      try {
        const r = await call(s, attempt.action, attempt.payload, true); acked = true;
        const b = r.booking;
        if (attempt.action !== 'accept_content' && (!b?.id || b.product_key !== s.key || !BOOKING_STATES[b.status])) throw Object.assign(Error('BOOKING_ACK_INVALID'), {uncertain: true});
        if (attempt.action === 'book' && b.status !== 'pending') throw Object.assign(Error('BOOKING_NOT_PENDING'), {uncertain: true});
        if (b && ['cancel', 'reschedule'].includes(attempt.action)) preparedWhatsApp.delete(scope(s) + ':' + b.id);
        if (b && safeWhatsApp(r.whatsapp_url)) preparedWhatsApp.set(scope(s) + ':' + b.id, {url: safeWhatsApp(r.whatsapp_url), start: b.starts_at});
        if (r.receipt_token && b) {
          const value = {receipt_token: r.receipt_token, booking_id: b.id, product_key: s.key, device_id: s.device, code_hash: verifiedHashes.get(scope(s)) || undefined};
          if (!saveReceipt(w.localStorage, value, s.device)) text(box, 'لم يُحفظ إيصال الجهاز. لا تُخزن بيانات الاتصال أو كودك؛ أعد قراءة الحجز داخل جلستك.');
        }
        const fresh = checkContext(await call(s, 'context'), s); if (!active(v, s)) return;
        if (attempt.action === 'accept_content') { if (!acceptedStep(fresh, attempt.payload.step_index)) throw Error('CONTENT_READBACK_NOT_CONFIRMED'); }
        else if (!fresh.bookings.some(x => x.id === b.id && x.status === b.status && Date.parse(x.starts_at) === Date.parse(b.starts_at))) throw Error('BOOKING_READBACK_NOT_CONFIRMED');
        unresolved.delete(scope(s)); renderClient(s, fresh, attempt.action === 'accept_content' ? 'إقرار القراءة محفوظ وأُعيد التحقق منه من المركزية.' : 'أُعيدت قراءة طلبك المحفوظ: ' + BOOKING_STATES[b.status] + ' • رقم ' + b.id + ' • ' + formatDate(b.starts_at));
      } catch (e) {
        if (!acked && !e.uncertain) unresolved.delete(scope(s));
        if (active(v, s)) { page(); text(card(content, 'لم نعرض نجاحًا غير متحقق'), 'قد تكون العملية محفوظة. اقرأ السياق أو كرر الطلب نفسه بمعرّفه، لا حجزًا جديدًا.'); if (unresolved.has(scope(s))) button(content, 'إعادة الطلب نفسه بأمان', () => runClientMutation(s, ctx, attempt), true); button(content, 'إعادة قراءة حجوزاتي', () => s.role === 'receipt' ? openReceipt(s.receipt) : openClient(null, s.key)); say(errorText(e), true); }
      } finally { attempt.busy = false; }
    }
    function addWhatsApp(host, href) { const b = button(host, 'فتح واتساب برسالة المالك الجاهزة', () => w.open(href, '_blank', 'noopener,noreferrer')); text(host, 'أنت تضغط إرسال بنفسك؛ لا ندّعي إرسالًا تلقائيًا.'); return b; }
    function openReceipts() {
      open({role: 'public'}, 'مواعيدي المحفوظة على هذا الجهاز'); const dev = device(), rows = readReceipts(w.localStorage, dev);
      text(content, 'نحفظ إيصالًا عشوائيًا ومعرّف الحجز والمنتج والجهاز فقط، لا كود مالك أو عميل ولا أسماء أو جوالات. الإيصال مقيد بهذا الجهاز ولا يمنح وصولًا للباقة.');
      if (!rows.length) text(card(content, 'لا توجد إيصالات محفوظة على هذا الجهاز'), 'أُضيفت الإيصالات بعد رد الحجز المركزي فقط.');
      for (const r of rows) { const box = card(content, 'حجز ' + r.booking_id); text(box, 'المنتج: ' + r.product_key); button(box, 'قراءة وإدارة هذا الموعد فقط', () => openReceipt(r), true); }
      button(content, 'دخول الكود الأصلي', login);
    }
    async function openReceipt(value) {
      const r = receiptRecord(value, device()); if (!r) { openReceipts(); say('إيصال غير صالح أو ليس لهذا الجهاز.', true); return; }
      /* S12_RECEIPT_SCOPE 20261115-s12-1 */
      if (!await w.F99SessionSecurity?.activateReceipt(r.receipt_token,r.device_id)) { invalidate(); return; }
      const s = {role: 'receipt', receipt: r, device: r.device_id, key: r.product_key}, v = open(s, 'إدارة الموعد بالإيصال المحدود');
      try { const ctx = checkContext(await call(s, 'context'), s); if (active(v, s)) renderClient(s, ctx); }
      catch (e) { if (active(v, s)) { say(errorText(e), true); button(content, 'مواعيدي المحفوظة', openReceipts); } }
    }
    function clearSession() { ++hintSerial; ++publicReadSerial; close(); unresolved.clear(); preparedWhatsApp.clear(); verifiedHashes.clear(); replayAllowed.clear?.(); catalogSnapshot=[]; selectedStoreKey=""; badgeToken=""; d.getElementById("f99a10-code-receipt")?.remove(); }
    async function verifyPurchase(key) { const s = {role: 'public', key}; const r = publicProduct(await call(s, 'context'), key); return {allowed: canPurchase(r), product: r}; }
    async function receiptHint(input) {
      const serial = ++hintSerial, value = input.value, hash = await codeHash(w.crypto, value);
      if (serial !== hintSerial || !input.isConnected || input.value !== value) return;
      const match = hash ? readReceipts(w.localStorage, device()).find(r => r.code_hash === hash) : null;
      let box = d.getElementById('f99a10-code-receipt');
      if (!match) { box?.remove(); return; }
      if (!box) { box = el('section', 'f99a10-code-receipt'); box.id = 'f99a10-code-receipt'; input.closest('label')?.after(box); if (!box.isConnected) input.after(box); }
      box.replaceChildren(); text(box, 'لديك إيصال حجز محفوظ لهذا الكود على الجهاز نفسه. يمكنك التحقق من إمكانية إدارة موعدك حتى بعد انتهاء الكود؛ لا يفتح الإيصال الباقة.');
      button(box, 'إدارة موعد الكود المحفوظ', () => openReceipt(match), true);
    }
    function paintStoreStates() {
      for (const tile of d.querySelectorAll('#f99s-modal .f99v6-tile[data-product-key]')) {
        if (protectedNode(tile)) continue;
        const original = storeProducts().find(p => p.key === tile.dataset.productKey);
        // Financial products keep the original flow; coming_soon keeps the original tile label only.
        if (!isHumanStoreProduct(original) || original.launch_status === 'coming_soon') { tile.querySelector('.f99a10-store-state')?.remove(); continue; }
        const x = findProduct(publicStates, tile.dataset.productKey), p = x?.presentation || x || {}, state = p.status || 'unknown';
        let badge = tile.querySelector('.f99a10-store-state');
        if (!badge) { badge = el('p', 'f99a10-badge f99a10-store-state'); tile.append(badge); }
        const allowed = canPurchase(x), label = state === 'custom' ? p.status_text || STATES.custom : STATES[state] || 'الحالة غير معلومة';
        const ownerLaunchText = String(original?.launch_text || '').trim().slice(0, 300);
        const message = x ? (ownerLaunchText ? (allowed ? '' : 'الشراء غير متاح حاليًا') : state === 'available' ? (allowed ? label : 'غير متاحة للشراء حاليًا') : label + (state === 'custom' && !allowed ? ' — الشراء غير متاح' : '')) : 'الحالة تحتاج تحققًا مركزيًا — لا نؤكد توفر الشراء';
        const price = tile.querySelector('.f99v6-price'); if (price) { if (!allowed) price.style.setProperty('display', 'none', 'important'); else price.style.removeProperty('display'); }
        if (badge.textContent !== message) badge.textContent = message;
        if (badge.dataset.state !== state) badge.dataset.state = state;
      }
    }
    async function readStoreStates() {
      if (storefrontReadBusy || d.hidden) return; storefrontReadBusy = true; const serial = ++publicReadSerial;
      try { const r = await call({role: 'public'}, 'catalog'); if (serial === publicReadSerial) publicStates = products(r); }
      catch (_) { if (serial === publicReadSerial) publicStates = []; }
      finally { storefrontReadBusy = false; paintStoreStates(); }
    }
    function mount() {
      const host = d.querySelector('#f99l-root .f99l-main') || d.querySelector('#page1 .finium-entry');
      if (host && !d.getElementById('f99a10-login-entry')) { const box = el('section', 'f99a9-entry f99a10-entry'); box.id = 'f99a10-login-entry'; box.append(el('h3', '', 'خدماتك ومواعيدك')); button(box, 'حالات الباقات والخدمات', openCatalog); button(box, 'مواعيدي المحفوظة', openReceipts, true); host.append(box); }
      const owner = d.getElementById('ownerHub');
      if (owner && !d.getElementById('f99a10-owner-badge')) { const box = el('div', 'f99a10-owner-alert'); const b = button(box, 'طلبات المواعيد — اضغط للتحقق', openPending, true); b.id = 'f99a10-owner-badge'; owner.prepend(box); }
      const ownerVisible = !!owner && !owner.hidden && !d.hidden && owner.getClientRects().length > 0;
      if (ownerVisible && !ownerWasVisible) void refreshBadge(); ownerWasVisible = ownerVisible;
      const store = d.getElementById('f99s-modal'), storeVisible = !!store && !store.hidden && !d.hidden;
      if (storeVisible && !storeWasVisible) { selectedStoreKey = ''; void readStoreStates(); }
      storeWasVisible = storeVisible; if (storeVisible) paintStoreStates();
    }
    function storeProducts() { try { return w.FINO99ReadStorefront?.()?.products || []; } catch (_) { return []; } }
    // PACKAGE17_SCOPE_ONLY: financial products retain their original store/payment flow.
    function isHumanStoreProduct(p) { return Array.isArray(p?.services) && p.services.length === 1 && KINDS.includes(p.services[0]); }
    // Window capture runs BEFORE the A9 document capture. Preserve original financial
    // eligibility questions, terms and calculator guards; only gate its final checkout.
    w.addEventListener('click', ev => {
      const target = ev.target?.closest?.('button,a,[data-checkout]'); if (!target || protectedNode(target)) return;
      if (replayAllowed.has(target)) { replayAllowed.delete(target); return; }
      const tile = target.closest('#f99s-modal .f99v6-tile[data-product-key]');
      if (tile) {
        const key = tile.dataset.productKey, p = storeProducts().find(x => x.key === key); if (!p) return; selectedStoreKey = isHumanStoreProduct(p) ? key : '';
        if (isHumanStoreProduct(p)) { ev.preventDefault(); ev.stopImmediatePropagation(); const modal = d.getElementById('f99s-modal'); if (modal && !protectedNode(modal) && !modal.querySelector(PROTECTED)) modal.hidden = true; void openOffer(key); }
        return;
      }
      const terminal = target.closest('#f99s-modal .f99v10-actions') && ['إتمام الشراء', 'نعم، تأكيد الشراء'].includes(target.textContent.trim());
      const checkoutLink = target.matches('#f99s-modal a[data-checkout="link"]');
      if ((!terminal && !checkoutLink) || !selectedStoreKey) return;
      if (!isHumanStoreProduct(storeProducts().find(p => p.key === selectedStoreKey))) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const key = selectedStoreKey;
      void openOffer(key, () => {
        if (!target.isConnected || selectedStoreKey !== key || protectedNode(target)) return;
        replayAllowed.add(target); target.click(); // original consent and eligibility are rechecked by original code.
      });
    }, true);
    const oldEntry = w.F99O2OpenForEntry, oldClient = w.F99O2OpenClient, oldRun = w.F99V13RunService;
    function entryKinds() { const a = access(), e = entry(); const v = a?.record?.centralData?.allowed_services || e?.allowed_services; return Array.isArray(v) ? v : []; }
    w.F99O2OpenAdmin = openOwner;
    w.F99O2OpenForEntry = function (e, key) { return entryKinds().some(k => KINDS.includes(k)) || !entryKinds().length ? openClient(e, key) : oldEntry?.apply(this, arguments); };
    w.F99O2OpenClient = function (e, key) { return entryKinds().some(k => KINDS.includes(k)) || !entryKinds().length ? openClient(e, key) : oldClient?.apply(this, arguments); };
    w.F99V13RunService = function (kind) { return KINDS.includes(kind) ? openClient() : oldRun?.apply(this, arguments); };
    const oldFinish = w.finishIdentityAndEnter;
    if (typeof oldFinish === 'function') w.finishIdentityAndEnter = function () {
      const input = d.getElementById('f99l-code') || d.getElementById('password'), hashPromise = codeHash(w.crypto, input?.value || '');
      const result = oldFinish.apply(this, arguments);
      Promise.resolve(result).then(async () => { const s = clientSession(); if (!s) return; const hash = await hashPromise; if (hash && live(s)) verifiedHashes.set(scope(s), hash); if (live(s) && entryKinds().length === 1 && entryKinds()[0] === 'custom_service') void openClient(); }).catch(() => {});
      return result; // original identity/auth/heartbeat and return contract are preserved.
    };
    const oldChoose = w.F99V6OpenServices;
    w.F99V6OpenServices = function () {
      if (!entryKinds().some(k => KINDS.includes(k))) return oldChoose?.apply(this, arguments);
      const s = clientSession(); if (!s) return openClient(); open(s, 'خدمات باقتك المصرح بها'); button(content, 'الخدمة البشرية ومواعيدي', () => openClient(), true);
      if (entryKinds().some(k => !KINDS.includes(k)) && oldChoose) button(content, 'الخدمات الأخرى عبر المحدد الأصلي', () => { close(); oldChoose.call(w); });
    };
    // R22H: F99Appointments owns the flexible calendar. Service tools stay
    // reachable through F99ServiceTools/F99O2 and their existing owner navigation.
    // Close only our overlay before delegating; never replace the calendar API.
    if (legacy) w.F99Appointments = Object.freeze({...legacy,
      openOwner: function () { close(); return legacy.openOwner.apply(this, arguments); },
      openClient: function () { close(); return legacy.openClient.apply(this, arguments); },
      openOffer, openCatalog});
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount, {once: true}); else mount();
    d.addEventListener('input', ev => { if (ev.target?.matches?.('#f99l-code,#password') && !protectedNode(ev.target)) void receiptHint(ev.target); });
    // No polling RPCs. Only mount/refresh on visible owner navigation or explicit reads.
    d.addEventListener('visibilitychange', () => { if (!d.hidden) { mount(); void refreshBadge(); } });
    const observer = typeof w.MutationObserver === 'function' ? new w.MutationObserver(() => { mount(); }) : null;
    observer?.observe(d.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style']});
    return {clearSession, openOwner, openPending, openOwnerBookings, openOwnerCoupons, openClient, openOffer, openCatalog, openReceipts, openReceipt, verifyPurchase, refreshBadge, readStoreStates, suppressDuplicate};
  }
  return Object.freeze({install, safeHttps, safeWhatsApp, whatsapp, phone, saudiPhone, businessNumber, cleanText, validateSteps, validateWindows, validateStageWindows, validatePresentation, canPurchase, uuid, isUUID, receiptRecord, readReceipts, saveReceipt, codeHash, validDay, validInstant, dayInRiyadh, localISO, formatDate, protectedNode, suppressDuplicate, RECEIPTS_KEY, PROTECTED, TYPES, STATES, BOOKING_STATES, TZ});
});
