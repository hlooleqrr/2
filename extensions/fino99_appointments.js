/* FINO99 A9 appointments frontend. Load LAST, after legacy O2/O3 and all extensions.
 * Additive UI only: f99a9_owner / f99a9_client / f99a9_public.
 * No auth grants, local contact storage, automatic messages, payment simulation or slot generation.
 */
(function (root, factory) {
  'use strict';
  const helpers = factory();
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  else if (!root.F99Appointments) root.F99Appointments = Object.freeze(helpers.install(root));
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const TZ = 'Asia/Riyadh';
  const KINDS = ['guidance_mortgage', 'guidance_personal', 'custom_service'];
  const DAYS = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
  const STATUS = {confirmed: 'مؤكد', cancelled: 'ملغي', completed: 'مكتمل', no_show: 'لم يحضر'};
  function safeHttps(value) {
    if (typeof value !== 'string' || !value || value.length > 2056 || value !== value.trim() || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return '';
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || !u.hostname || !value.startsWith('https://')) return '';
      return u.href;
    } catch (_) { return ''; }
  }
  function safeWhatsApp(value) {
    const href = safeHttps(value);
    if (!href) return '';
    const u = new URL(href);
    if (u.hostname !== 'wa.me' || u.port || u.hash || !/^\/9665\d{8}$/.test(u.pathname)
      || !u.searchParams.get('text') || Array.from(u.searchParams.keys()).length !== 1) return '';
    return href;
  }
  function saudiPhone(value) {
    let v = String(value || '').trim().replace(/[\s()-]/g, '');
    if (/^05\d{8}$/.test(v)) v = '966' + v.slice(1);
    if (/^\+9665\d{8}$/.test(v)) v = v.slice(1);
    return /^9665\d{8}$/.test(v) ? v : '';
  }
  function validDay(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return false;
    const dt = new Date(day + 'T12:00:00Z');
    return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === day;
  }
  function riyadhDay(value = new Date()) {
    const p = new Intl.DateTimeFormat('en-US', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(value));
    const get = k => p.find(x => x.type === k).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function addDays(day, count) {
    if (!validDay(day) || !Number.isInteger(count)) throw Error('اختر تاريخًا ميلاديًا صحيحًا.');
    const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
  }
  function validTime(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value)); }
  function riyadhISO(value) {
    const a = String(value || '').split('T');
    if (a.length !== 2 || !validDay(a[0]) || !validTime(a[1])) throw Error('أدخل التاريخ والوقت بتوقيت الرياض.');
    return a[0] + 'T' + a[1] + ':00+03:00';
  }
  function validInstant(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
  }
  function riyadhLocal(value) {
    if (!validInstant(value)) return '';
    const p = new Intl.DateTimeFormat('en-US', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(value));
    return riyadhDay(value) + 'T' + p.find(x => x.type === 'hour').value + ':' + p.find(x => x.type === 'minute').value;
  }
  function formatDate(value, timeOnly) {
    if (!validInstant(value)) return 'وقت غير صالح';
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {timeZone: TZ, ...(timeOnly ? {} : {year: 'numeric', month: 'short', day: 'numeric', weekday: 'short'}), hour: '2-digit', minute: '2-digit'}).format(new Date(value));
  }
  function validateWindows(windows) {
    if (!Array.isArray(windows)) throw Error('فترات الدوام غير صالحة.');
    const sorted = windows.map(w => {
      if (!w || !validTime(w.start) || !validTime(w.end) || w.start >= w.end) throw Error('بداية الفترة يجب أن تسبق نهايتها في اليوم نفسه.');
      return {start: w.start, end: w.end};
    }).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) throw Error('فترات الدوام متداخلة؛ راجع بدايتها ونهايتها.');
    return sorted;
  }
  function validateSchedule(hours, overrides, blocked) {
    if (!hours || typeof hours !== 'object' || Array.isArray(hours) || !overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw Error('جدول الدوام غير صالح.');
    const h = {}, o = {};
    for (const [key, list] of Object.entries(hours)) {
      if (!/^[1-7]$/.test(key)) throw Error('ترقيم أيام الأسبوع من 1 الاثنين إلى 7 الأحد.');
      h[key] = validateWindows(list);
    }
    for (const [key, list] of Object.entries(overrides)) {
      if (!validDay(key)) throw Error('تاريخ الاستثناء غير صالح.');
      o[key] = validateWindows(list);
    }
    if (!Array.isArray(blocked) || blocked.some(x => !validDay(x))) throw Error('أحد التواريخ المحجوبة غير صالح.');
    return {hours: h, date_overrides: o, blocked_dates: Array.from(new Set(blocked)).sort()};
  }
  function numberValue(value, label, integer, min = 0, max = Infinity) {
    if (String(value).trim() === '') throw Error('أدخل قيمة «' + label + '».');
    const n = Number(value);
    if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) throw Error('قيمة «' + label + '» غير صالحة.');
    return n;
  }
  function uuid(crypto) {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (!crypto || typeof crypto.getRandomValues !== 'function') throw Error('يلزم اتصال HTTPS ومتصفح يدعم معرّفات الطلبات الآمنة.');
    const a = new Uint8Array(16); crypto.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    const s = Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }
  function packageKey(entry, record) {
    for (const data of [record, entry]) {
      const x = data || {}, f = x.config?.f99x || x.code?.config?.f99x || {};
      const k = f.effective_package_key || f.store_package_key || x.store_package_key;
      if (typeof k === 'string' && k.trim()) return k.trim();
    }
    return '';
  }
  function install(w) {
    const d = w.document;
    if (!d) return {};
    let modal = null, content = null, status = null, dialog = null, screen = 0, previousFocus = null;
    let current = null, guardTimer = null, fieldId = 0, ownerItems = [];
    // Unresolved mutation payloads and links are RAM-only and scoped to the verified session.
    const pending = new Map(), waLinks = new Map(), allocationPending = new Map();
    function access() { return typeof activeAccess !== 'undefined' ? activeAccess : null; }
    function adminToken() { return typeof finoCentralAdminToken !== 'undefined' ? String(finoCentralAdminToken || '') : ''; }
    function restored() { try { return typeof w.finoCentralRestoreEntry === 'function' ? w.finoCentralRestoreEntry() : null; } catch (_) { return null; } }
    function device(entry) { return String(entry?.deviceId || (typeof w.finoCentralDeviceId === 'function' ? w.finoCentralDeviceId() : '') || ''); }
    function ownerSession() {
      const a = access();
      return a?.record?.owner === true && a.record.central === true && adminToken() ? {role: 'owner', actor: a, token: adminToken()} : null;
    }
    function clientSession(entry, key) {
      const a = access(), live = restored(), e = entry || live;
      const token = String(e?.entryToken || e?.entry_token || ''), liveToken = String(live?.entryToken || live?.entry_token || '');
      const services = a?.record?.centralData?.allowed_services || live?.allowed_services || [];
      if (!a?.record?.central || a.record.owner || !token || token !== liveToken || !device(e) || device(e) !== device(live) || !Array.isArray(services) || !services.some(k => KINDS.includes(k))) return null;
      const actual = packageKey(live, a.record.centralData), chosen = key || actual;
      if (!chosen || (actual && chosen !== actual)) return null;
      return {role: 'client', actor: a, token, device: device(e), key: chosen, services: services.slice()};
    }
    function sessionLive(s) {
      if (!s || s.role === 'public') return true;
      // Central polling may replace the access object without changing the authenticated session.
      if (s.role === 'owner') { const n = ownerSession(); return !!n && n.token === s.token; }
      const n = clientSession(null, s.key);
      return !!n && n.token === s.token && n.device === s.device && n.key === s.key;
    }
    function scopeKey(s) { return JSON.stringify([s.token, s.device, s.key]); }
    function activeView(v, s = current) { return v === screen && modal && !modal.hidden && sessionLive(s); }
    function el(tag, cls, text) {
      const n = d.createElement(tag); if (cls) n.className = cls;
      if (text !== undefined) n.textContent = String(text ?? '');
      return n;
    }
    function button(host, label, run, primary) {
      const b = el('button', 'f99a9-button' + (primary ? ' f99a9-primary' : ''), label); b.type = 'button';
      b.addEventListener('click', () => {
        if (current && !sessionLive(current)) return invalidate();
        try { Promise.resolve(run()).catch(err => say(errorText(err), true)); } catch (err) { say(errorText(err), true); }
      }); host.append(b); return b;
    }
    function actions(host) { const n = el('div', 'f99a9-actions'); host.append(n); return n; }
    function card(host, title) { const n = el('section', 'f99a9-card'); if (title) n.append(el('h3', '', title)); host.append(n); return n; }
    function text(host, value, cls) { const n = el('p', cls || 'f99a9-text', publicText(value)); host.append(n); return n; }
    function publicText(value) { return String(value ?? '').replace(/سلة/g, 'منصة الدفع'); }
    function field(host, label, value = '', type = 'text', options = {}) {
      const l = el('label', 'f99a9-field'), id = 'f99a9-field-' + (++fieldId);
      l.htmlFor = id; l.append(el('span', '', label));
      const n = el(type === 'textarea' ? 'textarea' : 'input'); n.id = id;
      if (type !== 'textarea') n.type = type; else n.rows = options.rows || 3;
      n.value = String(value ?? '');
      for (const [k, v] of Object.entries(options)) if (k !== 'rows') n[k] = v;
      l.append(n); host.append(l); return n;
    }
    function select(host, label, value, choices) {
      const l = el('label', 'f99a9-field'); l.append(el('span', '', label)); const n = el('select');
      for (const [k, name] of choices) { const o = el('option', '', name); o.value = k; n.append(o); }
      n.value = value; l.append(n); host.append(l); return n;
    }
    function checkbox(host, label, checked) {
      const l = el('label', 'f99a9-check'), n = el('input'); n.type = 'checkbox'; n.checked = !!checked;
      l.append(n, el('span', '', label)); host.append(l); return n;
    }
    function money(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString('ar-SA', {maximumFractionDigits: 2}) + ' ريال' : 'السعر غير متاح'; }
    function say(message, bad) {
      if (!status || !modal || modal.hidden) return;
      status.textContent = publicText(message); status.dataset.error = bad ? '1' : '0';
      status.setAttribute('role', bad ? 'alert' : 'status');
    }
    function errorText(err) {
      const reason = String(err?.code || err?.message || '');
      if (/REVISION|VERSION|CONSENT/i.test(reason)) return 'تغيرت نسخة الخدمة أو الإقرار. أعد قراءة الخدمة وراجعها قبل الحفظ أو الحجز.';
      if (/SESSION|TOKEN|ADMIN|AUTH|DEVICE/i.test(reason)) return 'جلسة الدخول غير متاحة أو انتهت. أعد الدخول بالكود المناسب.';
      if (/SLOT|OVERLAP|COLLISION|HOURS|CLOSED/i.test(reason)) return 'الوقت غير متاح الآن أو خارج الدوام. حدّث الأوقات الفعلية واختر وقتًا آخر.';
      if (/CUTOFF|NOTICE|TOO_LATE/i.test(reason)) return 'المهلة المحددة للحجز أو التعديل أو الإلغاء لا تسمح بهذه العملية.';
      if (/QUOTA|LIMIT|BOOKINGS_EXHAUSTED/i.test(reason)) return 'لا يسمح رصيد الكود بهذه العملية. أعد قراءة حجوزاتك ورصيدك.';
      if (/NOT_ENABLED|DISABLED|UNAVAILABLE|NOT_ACTIVE|STOCK|NOT_FOUND|PGRST202|42883/i.test(reason)) return 'الخدمة غير متاحة أو لم تُفعّل وحدة المواعيد المركزية. لم نفتح خدمة بديلة.';
      if (err?.local) return publicText(err.message);
      return 'تعذر التحقق من العملية من المركزية. لا يعني هذا أنها حُفظت؛ حدّث السجل قبل إعادة أي تغيير.';
    }
    function localError(message) { const e = Error(message); e.local = true; return e; }
    function unpack(r, mutation) {
      if (r?.ok === true && r.data?.ok === true) return r.data;
      const reason = r?.data?.reason || r?.reason || r?.error?.code || r?.error?.message || (typeof r?.error === 'string' ? r.error : 'RPC_UNAVAILABLE');
      const e = Error(String(reason)); e.code = reason;
      e.uncertain = !!mutation && !(r?.ok === true && r.data?.ok === false);
      throw e;
    }
    async function ownerCall(s, action, data = {}, mutation = false) {
      if (!sessionLive(s) || s?.role !== 'owner' || typeof w.finoCentralAdminCall !== 'function') throw Error('ADMIN_SESSION_INVALID');
      let r;
      try { r = await w.finoCentralAdminCall('f99a9_owner', {p_action: action, p_data: data}); }
      catch (err) { err.uncertain = mutation; throw err; }
      if (!sessionLive(s)) { const e = Error('SESSION_CHANGED'); e.uncertain = mutation; throw e; }
      return unpack(r, mutation);
    }
    async function clientCall(s, action, data = {}, mutation = false) {
      if (!sessionLive(s) || s?.role !== 'client' || typeof w.finoRpc !== 'function') throw Error('SESSION_INVALID');
      let r;
      try { r = await w.finoRpc('f99a9_client', {p_entry_token: s.token, p_device_id: s.device, p_product_key: s.key, p_action: action, p_data: data}, 20000); }
      catch (err) { err.uncertain = mutation; throw err; }
      if (!sessionLive(s)) { const e = Error('SESSION_CHANGED'); e.uncertain = mutation; throw e; }
      return unpack(r, mutation);
    }
    async function publicCall(key) {
      if (typeof w.finoRpc !== 'function') throw Error('RPC_UNAVAILABLE');
      return unpack(await w.finoRpc('f99a9_public', {p_product_key: key || null}, 20000));
    }
    function ensure() {
      if (modal) return;
      modal = el('div', 'f99a9-overlay'); modal.id = 'f99a9-overlay'; modal.hidden = true;
      dialog = el('section', 'f99a9-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'false'); dialog.setAttribute('aria-labelledby', 'f99a9-heading');
      dialog.dir = 'rtl'; dialog.tabIndex = -1;
      const header = el('header', 'f99a9-header'), titleBox = el('div');
      titleBox.append(el('small', 'f99a9-muted', 'FINO99 • توقيت الرياض'));
      const heading = el('h2', '', 'الخدمات والمواعيد'); heading.id = 'f99a9-heading'; titleBox.append(heading); header.append(titleBox);
      const closeButton = el('button', 'f99a9-button', 'إغلاق'); closeButton.type = 'button'; closeButton.onclick = close; header.append(closeButton);
      status = el('p', 'f99a9-status'); status.id = 'f99a9-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
      content = el('div', 'f99a9-content'); content.id = 'f99a9-content';
      dialog.append(header, status, content); modal.append(dialog); d.body.append(modal);
      modal.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
        if (ev.key !== 'Tab' || dialog.getAttribute('aria-modal') !== 'true') return;
        const items = Array.from(dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')).filter(n => n.getClientRects().length > 0);
        if (!items.length) { ev.preventDefault(); dialog.focus(); return; }
        const first = items[0], last = items[items.length - 1];
        if (ev.shiftKey && (d.activeElement === first || !dialog.contains(d.activeElement))) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && (d.activeElement === last || !dialog.contains(d.activeElement))) { ev.preventDefault(); first.focus(); }
      });
    }
    function open(s, title) {
      ensure(); if (modal.hidden) previousFocus = d.activeElement;
      current = s; modal.hidden = false; d.getElementById('f99a9-heading').textContent = title;
      if (s?.role !== 'owner') ownerItems = [];
      const v = page();
      if (guardTimer) w.clearInterval(guardTimer);
      guardTimer = w.setInterval(() => { if (current && !sessionLive(current)) invalidate(); }, 700);
      dialog.querySelector('button').focus(); return v;
    }
    function page() { screen++; content.replaceChildren(); say(''); dialog.scrollTop = 0; return screen; }
    function close() {
      screen++; if (guardTimer) w.clearInterval(guardTimer); guardTimer = null;
      if (modal) { modal.hidden = true; content.replaceChildren(); status.textContent = ''; }
      ownerItems = []; current = null;
      if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null;
    }
    function invalidate() {
      pending.clear(); waLinks.clear(); ownerItems = [];
      const s = {role: 'public'}; open(s, 'يلزم تسجيل الدخول');
      text(card(content, 'انتهت جلسة العرض'), 'أُخفيت بيانات الجلسة السابقة. أعد تسجيل الدخول بالكود المناسب لقراءة المواعيد.');
      button(content, 'العودة إلى دخول المنصة', goLogin);
      say('لا يمكن عرض بيانات جلسة انتهت.', true);
    }
    function goLogin() {
      close(); if (typeof w.showPage === 'function') w.showPage('page1');
      w.setTimeout(() => {
        const input = d.getElementById('f99l-code') || d.getElementById('password');
        // Do not unhide a centrally configured disabled login; never alter login flags.
        if (input?.getClientRects().length) input.focus();
        else d.getElementById('f99l-code-link')?.focus();
      }, 30);
    }
    function picture(host, service) {
      const href = safeHttps(service.image_url);
      if (!href) { text(host, 'لم تُضف صورة آمنة لهذه الخدمة.', 'f99a9-muted'); return; }
      const img = el('img', 'f99a9-image'); img.src = href; img.alt = publicText('صورة ' + service.title); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { img.remove(); text(host, 'تعذر تحميل صورة الخدمة.', 'f99a9-muted'); }, {once: true}); host.append(img);
    }
    function serviceSummary(host, s, full) {
      const box = card(host, publicText(s.title || 'الخدمة')); picture(box, s);
      text(box, s.description || 'لم يُضف وصف الخدمة.');
      text(box, money(s.price) + ' • مدة الخدمة: ' + String(s.appointment_minutes ?? 'غير محددة') + ' دقيقة', 'f99a9-price');
      if (full) {
        if (s.code_duration_minutes != null) text(box, 'صلاحية الكود: ' + s.code_duration_minutes + ' دقيقة بحسب السياسة المركزية.');
        text(box, s.service_mode === 'manual' ? 'خدمة بشرية يدوية؛ لا تُرسل طلبًا أو تحجز موعدًا تلقائيًا.' : 'خدمة يقدمها صاحب الخدمة في موعد محدد، وليست حاسبة أو إجابات آلية.');
      }
      return box;
    }
    async function openCatalog() {
      const s = {role: 'public'}, v = open(s, 'كتالوج الخدمات البشرية'); say('جاري التحقق من الخدمات المنشورة...');
      try {
        const r = await publicCall(null); if (!activeView(v, s)) return;
        if (!Array.isArray(r.items)) throw Error('BAD_CONTRACT');
        say(''); text(content, 'اطّلع على تفاصيل الخدمة وإقرارها قبل الانتقال إلى منصة الدفع. بعد الشراء فعّل الكود من دخول المنصة.');
        if (!r.items.length) text(card(content, 'لا توجد عروض متاحة الآن'), 'لم تُنشر خدمات نشطة بمخزون ورابط دفع متاحين.');
        const list = el('div', 'f99a9-grid'); content.append(list);
        for (const item of r.items) {
          if (!item.product_key || !KINDS.includes(item.kind) || !safeHttps(item.checkout_url)) continue;
          const box = serviceSummary(list, item, false); button(box, 'التفاصيل والشروط قبل الشراء', () => openOffer(item.product_key), true);
        }
        if (r.items.length && !list.childElementCount) text(content, 'تعذر التحقق من بيانات العروض؛ لا يمكن فتح منصة الدفع.');
        button(content, 'لدي كود — دخول المنصة', goLogin);
      } catch (err) { if (activeView(v, s)) { text(card(content, 'الكتالوج غير متاح'), 'تعذر التحقق من توفر الخدمة؛ لم يُفتح رابط دفع.'); say(errorText(err), true); button(content, 'إعادة التحقق', openCatalog); } }
    }
    async function openOffer(key) {
      const s = {role: 'public'}, v = open(s, 'تفاصيل الخدمة قبل الشراء'); say('جاري قراءة العرض وشروطه من المركزية...');
      try {
        if (typeof key !== 'string' || !key.trim()) throw localError('لم تُحدد خدمة.');
        const r = await publicCall(key); if (!activeView(v, s)) return;
        const x = r.service;
        if (!x || x.product_key !== key || !KINDS.includes(x.kind) || !safeHttps(x.checkout_url) || !String(x.terms || '').trim() || !String(x.consent_text || '').trim()) throw Error('OFFER_UNAVAILABLE');
        say(''); serviceSummary(content, x, true);
        const conditions = card(content, 'الشروط والإقرار'); text(conditions, x.terms); text(conditions, x.consent_text);
        if (x.instructions) { const n = card(content, 'تعليمات الخدمة'); text(n, x.instructions); }
        const consent = checkbox(conditions, 'اطّلعت على وصف الخدمة وشروطها والإقرار أعلاه وأوافق عليها قبل الانتقال للدفع.', false);
        text(content, 'الدفع وتسليم كود الاستخدام يتمان في منصة الدفع. فتح الرابط ليس إثبات دفع أو تفعيل أو حجز داخل FINO99.');
        const row = actions(content);
        const buy = button(row, 'الموافقة والمتابعة إلى منصة الدفع', () => {
          if (!consent.checked || !activeView(v, s)) return;
          const href = safeHttps(x.checkout_url); if (!href) throw localError('رابط منصة الدفع غير صالح.');
          w.open(href, '_blank', 'noopener,noreferrer');
          say('طُلب فتح منصة الدفع في نافذة جديدة؛ إن منعها المتصفح اسمح بالنوافذ الجديدة. لم ننفذ دفعًا أو نؤكد شراءً.');
        }, true); buy.disabled = true; consent.onchange = () => { buy.disabled = !consent.checked; };
        button(row, 'العودة للكتالوج', openCatalog); button(row, 'بعد الشراء: تفعيل الكود', goLogin);
      } catch (err) { if (activeView(v, s)) { text(card(content, 'العرض غير متاح'), 'لم نفتح منصة الدفع. يلزم عرض نشط بشروط وإقرار ورابط صالح.'); say(errorText(err), true); button(content, 'عرض الكتالوج', openCatalog); } }
    }
    async function openOwner() {
      const s = ownerSession(), v = open(s || {role: 'public'}, 'إدارة الخدمات والمواعيد');
      if (!s) { text(card(content, 'جلسة المالك مطلوبة'), 'سجّل الدخول بكود المالك الأصلي أولًا. الصلاحيات تُراجع في المركزية لكل عملية.'); button(content, 'دخول المنصة', goLogin); say('لا توجد جلسة مالك مركزية موثقة.', true); return; }
      say('جاري قراءة كتالوج المالك...');
      try {
        const r = await ownerCall(s, 'catalog'); if (!activeView(v, s)) return;
        if (!Array.isArray(r.items) || r.timezone !== TZ) throw Error('BAD_CONTRACT');
        ownerItems = r.items; renderOwnerCatalog(s);
      } catch (err) { if (activeView(v, s)) { text(card(content, 'تعذر تحميل إدارة المواعيد'), 'لا يمكن تعديل بيانات غير مقروءة أو فتح وحدة غير مفعلة.'); say(errorText(err), true); button(content, 'إعادة التحقق', openOwner); } }
    }
    function ownerNav(s) {
      const row = actions(content);
      button(row, 'كتالوج الخدمات', () => renderOwnerCatalog(s)); button(row, 'اليوم والغد والقادم', () => renderOwnerSchedule(s)); button(row, 'سجل التغييرات', () => renderHistory(s, {}));
    }
    function renderOwnerCatalog(s) {
      page(); ownerNav(s);
      text(content, 'الإنشاء يولّد مسودة مخفية فقط. النشر وتخصيص الأكواد لا يحدثان تلقائيًا؛ استخدم أدوات المخزون الأصلية عند جاهزية المنتج.');
      const row = actions(content); button(row, 'تحديث من المركزية', openOwner); button(row, 'إنشاء خدمة جديدة مخفية', () => renderCreate(s), true);
      if (!ownerItems.length) text(card(content, 'لا توجد خدمات'), 'يمكنك إنشاء خدمة جديدة كمسودة مخفية.');
      const list = el('div', 'f99a9-grid'); content.append(list);
      for (const x of ownerItems) {
        const box = card(list, publicText(x.title));
        text(box, x.enabled ? 'مفعّلة • ' + (x.catalog_visible ? 'ظاهرة في الكتالوج' : 'مخفية في الكتالوج') : 'مسودة أو خدمة معطلة');
        text(box, money(x.price) + ' • ' + x.appointment_minutes + ' دقيقة • مراجعة ' + x.revision);
        text(box, 'هوية المنتج: ' + x.product_key, 'f99a9-muted');
        text(box, 'المخزون المنشور: ' + String(x.published_stock ?? 'غير معلوم'), 'f99a9-muted');
        button(box, 'تحرير الخدمة والدوام', () => renderServiceEditor(s, x), true);
        button(box, 'مواعيد هذه الخدمة', () => renderOwnerSchedule(s, x.product_key));
        button(box, 'تخصيص أكواد لهذه الخدمة بموافقتي', () => renderAllocation(s, x));
        button(box,'مخزون الخدمة وتصدير الدفعات واعتماد الرفع',()=>renderStock(s,x));
      }
    }
    function renderCreate(s) {
      const v = page(); ownerNav(s); const box = card(content, 'إنشاء خدمة جديدة — مسودة مخفية');
      const title = field(box, 'اسم الخدمة', '', 'text', {required: true, maxLength: 200});
      const kind = select(box, 'نوع الخدمة البشرية', 'custom_service', [['custom_service', 'خدمة مخصصة'], ['guidance_mortgage', 'إرشادات عقارية عامة'], ['guidance_personal', 'إرشادات شخصية عامة']]);
      const mode = select(box, 'طريقة تنفيذ الخدمة', 'appointment', [['appointment', 'خدمة بشرية بموعد'], ['manual', 'خدمة يدوية بتعليمات دون حجز آلي']]);
      const compatible = checkbox(box, 'خدمة بعنوان حر على النوع البشري المتوافق (guidance_personal) بدل custom_service، إذا لم تدعم المركزية النوع المخصص', false);
      text(box, 'عنوان الخدمة وطريقة تنفيذها مستقلان عن الحاسبات والخدمات التمويلية. اختيار النوع المتوافق صريح؛ لا نغير أي بوابات أو صلاحيات تمويلية.');
      text(box, 'لا يتم بيع أو تخصيص أكواد بمجرد الإنشاء. بعد إنشاء المسودة عدّل التفاصيل ثم راجع إعدادات النشر والمخزون.');
      const create = button(box, 'إنشاء المسودة في المركزية', async () => {
        if (!title.reportValidity() || !title.value.trim()) return;
        create.disabled = true; say('جاري إنشاء مسودة مخفية...');
        try {
          const r = await ownerCall(s, 'create', {title: title.value.trim(), kind: compatible.checked ? 'guidance_personal' : kind.value, service_mode: mode.value}, true);
          if (!activeView(v, s)) return;
          if (!r.service?.product_key || r.service.enabled !== false || r.service.catalog_visible !== false) throw Error('DRAFT_NOT_CONFIRMED');
          ownerItems.push(r.service); renderServiceEditor(s, r.service); say('أنشأت المركزية مسودة مخفية. لم تُنشر ولم تُخصص أكواد.');
        } catch (err) { if (activeView(v, s)) {
          say(err.uncertain ? 'لم يُحسم رد الإنشاء؛ قد تكون المسودة أُنشئت. حدّث الكتالوج وابحث عنها قبل إنشاء أخرى.' : errorText(err), true);
          // No create request_id in the contract: require a fresh catalog before another attempt.
          button(box, 'تحديث الكتالوج قبل أي محاولة أخرى', openOwner);
        } }
      }, true);
    }
    function inventoryAvailable() {
      return typeof w.F99AppointmentsInventory?.openBatch === 'function' || typeof w.F99V17OpenInventory === 'function';
    }
    function openInventory(s, detail) {
      if (!sessionLive(s)) return invalidate();
      if (!inventoryAvailable()) throw localError('واجهة المخزون غير محملة؛ احتفظ بمعرّف الدفعة وأعد فتح المخزون الأصلي لاحقًا.');
      close();
      if (typeof w.F99AppointmentsInventory?.openBatch === 'function') return w.F99AppointmentsInventory.openBatch(detail);
      return w.F99V17OpenInventory(detail.product_key);
    }
    function renderStock(s,service){
      const v=page();ownerNav(s);const list=card(content,'مخزون '+publicText(service.title));let offset=0;
      text(list,'الحجز الداخلي ليس استيرادًا أو سدادًا. النشر مشروط بتأكيد المالك رفع الدفعة ومطابقة العدد خارج المنصة. لا تُفعّل الخدمة تلقائيًا.');
      async function load(){
        say('جاري قراءة مخزون الخدمة...');
        try{
          const r=await ownerCall(s,'stock',{product_key:service.product_key,offset});if(!activeView(v,s))return;
          if(!Array.isArray(r.items))throw Error('BAD_STOCK_CONTRACT');
          for(const item of r.items){
            const box=card(list,item.allocation_id);text(box,'العدد: '+item.count+' • الحالة: '+item.state+' • صلاحية الكود: '+item.duration_minutes+' دقيقة');
            button(box,'تنزيل أكواد الدفعة نفسها CSV',async()=>{
              if(!w.confirm('أوافق على تصدير '+item.count+' كود من هذه الدفعة إلى ملف خاص. لا يعني التنزيل رفعها أو بيعها.'))return;
              const ex=await ownerCall(s,'export_codes',{product_key:service.product_key,allocation_id:item.allocation_id,approve:true},true);
              if(!sessionLive(s)||!Array.isArray(ex.items)||ex.items.length!==Number(ex.count)||Number(ex.count)!==Number(item.count)||ex.items.some(x=>typeof x.code!=='string')||new Set(ex.items.map(x=>x.code)).size!==ex.items.length)throw Error('CODE_EXPORT_COUNT_MISMATCH');
              const rows=['Code',...ex.items.map(x=>'"'+x.code.replace(/"/g,'""')+'"')];
              const blob=new Blob(['\ufeff'+rows.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});const url=w.URL.createObjectURL(blob),a=el('a');a.href=url;a.download='FINO99_CODES_'+item.allocation_id+'.csv';a.click();w.URL.revokeObjectURL(url);
              say('نُزّلت أكواد الدفعة نفسها فقط؛ لا نؤكد استيرادها أو سدادها.');
            });
            if(item.state==='reserved'){
              const check=checkbox(box,'أؤكد أنني رفعت هذه الدفعة فعليًا إلى منصة الدفع وطابقت العدد '+item.count+'.',false);
              const publish=button(box,'اعتماد الدفعة المنشورة داخليًا بعد تأكيدي',async()=>{
                if(!check.checked||!w.confirm('تأكيد الرفع الخارجي ومطابقة العدد لهذه الدفعة فقط؟ لا نثبت سداد عميل.'))return;
                publish.disabled=true;await ownerCall(s,'publish',{product_key:service.product_key,allocation_id:item.allocation_id,external_import_confirmed:true},true);if(activeView(v,s))renderStock(s,service);
              },true);publish.disabled=true;check.onchange=()=>{publish.disabled=!check.checked;};
            }
          }
          offset+=100;if(r.has_more)button(list,'صفحة المخزون التالية',load);say('مخزون مركزي؛ لا إرسال أو بيع آلي.');
        }catch(e){if(activeView(v,s))say(errorText(e),true);}
      }
      void load();button(content,'رجوع إلى الخدمات',()=>renderOwnerCatalog(s));
    }
    function renderAllocation(s, service) {
      const v = page(); ownerNav(s); const box = card(content, 'تخصيص أكواد — ' + publicText(service.title));
      text(box, 'نستخدم سياسة الخدمة المحفوظة فقط: صلاحية الكود ' + service.code_duration_minutes + ' دقيقة، وعدد الحجوزات ' + service.max_bookings_per_code + '. احفظ أي تعديل قبل تخصيص الدفعة.');
      text(box, 'التخصيص لا يعني أن الأكواد استُوردت في منصة الدفع أو بِيعت أو سُلّمت. بعد التخصيص افتح مخزون الباقة ونزّل الدفعة نفسها؛ لا تنشئ دفعة بديلة.');
      const pendingKey = JSON.stringify([s.token, service.product_key]);
      if (allocationPending.has(pendingKey)) {
        text(box, 'توجد محاولة تخصيص قيد الانتظار أو لم يُحسم ردها في هذه الجلسة. مُنع تخصيص جديد لهذه الخدمة حتى تراجع مخزونها. لا يوجد معرّف إعادة محاولة في عقد التخصيص.');
        if (inventoryAvailable()) button(box, 'مراجعة مخزون الباقة والدفعات السابقة', () => openInventory(s, {product_key: service.product_key}), true);
        say('لا يمكن تأكيد إنشاء دفعة أو تكرار التخصيص من نتيجة اتصال مجهولة.', true); return;
      }
      const count = field(box, 'عدد الأكواد المراد تخصيصها — يراجع الخادم الحد الآمن', 10, 'number', {min: 1, step: 1, required: true});
      const approval = checkbox(box, 'أوافق صراحة على تخصيص هذا العدد لهذه الخدمة بالسياسة المحفوظة، وأفهم أنه ليس إثبات استيراد أو بيع.', false);
      const result = el('div'); box.append(result);
      const allocate = button(box, 'تخصيص الأكواد بالموافقة الصريحة', async () => {
        if (!approval.checked || !count.reportValidity()) return;
        let n; try { n = numberValue(count.value, 'عدد الأكواد', true, 1); } catch (err) { err.local = true; throw err; }
        if (!w.confirm('تخصيص ' + n + ' كود للخدمة «' + publicText(service.title) + '» فقط؟ لم يحدث استيراد أو بيع في منصة الدفع.')) return;
        allocate.disabled = true; count.disabled = true; approval.disabled = true; say('جاري تخصيص الدفعة عبر سياسة الأكواد المركزية...');
        allocationPending.set(pendingKey, {count: n});
        try {
          const r = await ownerCall(s, 'allocate', {product_key: service.product_key, count: n, approve: true}, true);
          if (typeof r.allocation_id !== 'string' || !r.allocation_id || Number(r.count) !== n) { const err = Error('ALLOCATION_ACK_INVALID'); err.uncertain = true; throw err; }
          allocationPending.delete(pendingKey);
          if (!activeView(v, s)) return;
          const detail = {product_key: service.product_key, allocation_id: r.allocation_id, count: Number(r.count)};
          text(result, 'أكدت المركزية تخصيص ' + r.count + ' كود. رقم الدفعة: ' + r.allocation_id);
          text(result, 'لا نؤكد استيرادها أو بيعها. افتح الدفعات السابقة للباقة ونزّل هذه الدفعة فقط.');
          const inventory = button(result, 'فتح مخزون الباقة لتنزيل الدفعة نفسها', () => openInventory(s, detail), true);
          inventory.disabled = !inventoryAvailable();
          if (inventory.disabled) text(result, 'واجهة المخزون غير محملة الآن؛ معرّف الدفعة محفوظ مركزيًا ويمكن استرجاعها لاحقًا من مخزون الباقة.');
          w.dispatchEvent(new w.CustomEvent('f99a9-allocation-ready', {detail}));
          say('ورد تأكيد التخصيص المركزي فقط؛ لم ننفذ تصديرًا أو استيرادًا أو دفعًا تلقائيًا.');
        } catch (err) {
          if (!err.uncertain) allocationPending.delete(pendingKey);
          if (activeView(v, s)) {
          say(err.uncertain ? 'لم يُحسم رد التخصيص وقد تكون الدفعة موجودة. لا تكرر التخصيص؛ راجع مخزون الباقة والدفعات السابقة أولًا.' : errorText(err), true);
          if (inventoryAvailable()) button(result, 'مراجعة مخزون الباقة قبل أي تخصيص آخر', () => openInventory(s, {product_key: service.product_key}));
          else button(result, 'إعادة قراءة الكتالوج والسجل', openOwner);
        } }
      }, true); allocate.disabled = true; approval.onchange = () => { allocate.disabled = !approval.checked; };
      button(box, 'رجوع إلى كتالوج المالك', () => renderOwnerCatalog(s));
    }
    function windowsEditor(host, initial, label) {
      const area = el('div', 'f99a9-windows'); host.append(area); const rows = [];
      function add(win = {start: '', end: ''}) {
        const row = el('div', 'f99a9-window'); area.append(row);
        const start = field(row, label + ' — البداية', win.start, 'time', {required: true});
        const end = field(row, label + ' — النهاية', win.end, 'time', {required: true});
        const item = {row, start, end}; rows.push(item);
        button(row, 'حذف الفترة', () => { rows.splice(rows.indexOf(item), 1); row.remove(); });
      }
      (Array.isArray(initial) ? initial : []).forEach(add);
      button(host, 'إضافة فترة دوام', () => add());
      return () => validateWindows(rows.map(r => ({start: r.start.value, end: r.end.value})));
    }
    function renderServiceEditor(s, service) {
      const v = page(); ownerNav(s);
      const form = el('form'); form.addEventListener('submit', ev => ev.preventDefault()); content.append(form);
      const box = card(form, 'تحرير: ' + publicText(service.title));
      text(box, 'كل الأوقات ميلادية بتوقيت الرياض. لا تتغير بيانات الخدمة حتى تقر المركزية الحفظ. المراجعة الحالية: ' + service.revision);
      const grid = el('div', 'f99a9-grid'); box.append(grid); const inputs = {};
      const definitions = [
        ['title', 'اسم الخدمة', 'text'], ['image_url', 'رابط صورة HTTPS', 'url'], ['price', 'السعر (ريال)', 'number'], ['old_price', 'السعر السابق (ريال، اختياري)', 'number'],
        ['appointment_minutes', 'مدة الموعد بالدقائق — 15 أو 20 أو 30 أو قيمة مخصصة', 'number'], ['buffer_minutes', 'الفاصل المحجوز بعد الموعد (دقائق)', 'number'],
        ['min_notice_minutes', 'أقل مهلة قبل الحجز (دقائق)', 'number'], ['change_cutoff_minutes', 'مهلة منع التعديل قبل الموعد (دقائق)', 'number'],
        ['cancellation_cutoff_minutes', 'مهلة منع الإلغاء قبل الموعد (دقائق)', 'number'], ['booking_horizon_days', 'أفق الحجز مقدمًا (أيام)', 'number'],
        ['max_bookings_per_code', 'عدد المواعيد لكل كود (1–100)', 'number'], ['code_duration_minutes', 'مدة صلاحية الكود (دقائق مخصصة)', 'number'],
        ['whatsapp', 'رقم واتساب الأعمال السعودي (05 أو 9665)', 'tel'], ['checkout_url', 'رابط منصة الدفع HTTPS', 'url']
      ];
      for (const [key, label, type] of definitions) {
        inputs[key] = field(grid, label, service[key] ?? '', type, type === 'number' ? {min: key === 'max_bookings_per_code' || key === 'appointment_minutes' || key === 'code_duration_minutes' || key === 'booking_horizon_days' ? 1 : 0, step: ['price', 'old_price'].includes(key) ? '0.01' : '1'} : {});
      }
      inputs.whatsapp.autocomplete = 'off'; inputs.whatsapp.inputMode = 'tel';
      const mode = select(box, 'طريقة تنفيذ الخدمة', service.service_mode, [['appointment', 'خدمة بموعد'], ['manual', 'تعليمات يدوية دون حجز آلي']]);
      const enabled = checkbox(box, 'تفعيل الخدمة بعد مراجعة الشروط والمخزون', service.enabled);
      const visible = checkbox(box, 'إظهار الخدمة في الكتالوج العام بعد تحقق المركزية', service.catalog_visible);
      const copy = card(form, 'محتوى الخدمة والإقرارات');
      for (const [key, label] of [['description', 'وصف الخدمة'], ['instructions', 'تعليمات العميل بعد تفعيل الكود'], ['terms', 'شروط الخدمة'], ['consent_text', 'نص الإقرار والموافقة'], ['confirmation_text', 'نص رسالة واتساب الجاهزة']]) inputs[key] = field(copy, label, service[key], 'textarea');
      text(copy, 'متغيرات رسالة واتساب: {name} {phone} {question} {service} {date} {time} {booking_id}. المركزية تستبدلها من الحجز المحفوظ؛ فتح الرسالة لا يرسلها.');
      const hoursBox = card(form, 'الدوام الأسبوعي — ISO: الاثنين 1، الأحد 7'); const readHours = {};
      for (let i = 1; i <= 7; i++) { const row = el('fieldset', 'f99a9-day'); row.append(el('legend', '', DAYS[i - 1] + ' (' + i + ')')); hoursBox.append(row); readHours[i] = windowsEditor(row, service.hours?.[String(i)], DAYS[i - 1]); }
      text(hoursBox, 'يوم بلا فترات = مغلق. لا تظهر مواعيد خارج الدوام؛ المركزية تحسب الفاصل وتمنع التداخل.');
      const exceptions = card(form, 'استثناءات حسب التاريخ'); const overrideRows = [];
      function addOverride(date = '', windows = []) {
        const row = el('fieldset', 'f99a9-day'); exceptions.append(row); row.append(el('legend', '', 'استثناء تاريخ')); const day = field(row, 'التاريخ الميلادي', date, 'date', {required: true});
        text(row, 'لا توجد فترات = إغلاق هذا التاريخ. إضافة فترات تستبدل دوام الأسبوع لهذا التاريخ فقط.', 'f99a9-muted');
        const read = windowsEditor(row, windows, 'دوام الاستثناء'), item = {row, day, read}; overrideRows.push(item);
        button(row, 'حذف الاستثناء من المسودة', () => { overrideRows.splice(overrideRows.indexOf(item), 1); row.remove(); });
      }
      Object.entries(service.date_overrides || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([day, list]) => addOverride(day, list));
      button(exceptions, 'إضافة استثناء بتاريخ', () => addOverride());
      const blocked = field(form, 'تواريخ محجوبة بالكامل — YYYY-MM-DD، كل تاريخ في سطر', (service.blocked_dates || []).join('\n'), 'textarea');
      text(form, 'مدة الكود وعدد الحجوزات تخضعان للحدود والسياسات الآمنة في الخادم. لا تُضعَف حقوق الأكواد القائمة ولا تُنشأ أكواد جديدة من هذا المحرر.');
      const row = actions(form);
      const save = button(row, 'حفظ الخدمة والدوام في المركزية', async () => {
        if (!form.reportValidity()) return;
        let draft;
        try {
          draft = {service_mode: mode.value, enabled: enabled.checked, catalog_visible: visible.checked};
          for (const [key, , type] of definitions) {
            const val = inputs[key].value.trim();
            if (type === 'number') draft[key] = key === 'old_price' && !val ? 0 : numberValue(val, key, !['price', 'old_price'].includes(key), ['appointment_minutes', 'max_bookings_per_code', 'code_duration_minutes', 'booking_horizon_days'].includes(key) ? 1 : 0, key === 'max_bookings_per_code' ? 100 : Infinity);
            else draft[key] = val;
          }
          for (const key of ['description', 'instructions', 'terms', 'consent_text', 'confirmation_text']) draft[key] = inputs[key].value.trim();
          if (!draft.title) throw localError('أدخل اسم الخدمة.');
          for (const key of ['image_url', 'checkout_url']) if (draft[key] && !safeHttps(draft[key])) throw localError('الرابط غير صالح؛ استخدم HTTPS دون بيانات دخول أو مسافات.');
          if (draft.whatsapp) { draft.whatsapp = saudiPhone(draft.whatsapp); if (!draft.whatsapp) throw localError('أدخل رقم أعمال سعوديًا صحيحًا.'); }
          if (draft.enabled && (!draft.terms || !draft.consent_text || !draft.instructions || !safeHttps(draft.checkout_url))) throw localError('يلزم إكمال الشروط والإقرار والتعليمات ورابط منصة الدفع قبل التفعيل.');
          const hours = {}, overrides = {};
          for (let i = 1; i <= 7; i++) hours[String(i)] = readHours[i]();
          for (const entry of overrideRows) { const day = entry.day.value; if (!validDay(day) || Object.prototype.hasOwnProperty.call(overrides, day)) throw localError('راجع تاريخ الاستثناء؛ لا تكرر التاريخ.'); overrides[day] = entry.read(); }
          Object.assign(draft, validateSchedule(hours, overrides, blocked.value.split(/\s+/).filter(Boolean)));
        } catch (err) { err.local = true; say(errorText(err), true); return; }
        if (!w.confirm('حفظ هذه القيم للخدمة المحددة فقط؟ النشر الفعلي يتطلب تحقق المركزية من المخزون والسياسات.')) return;
        // Freeze editor while the revision-checked write is unresolved; keep draft on rejection.
        const controls = Array.from(form.querySelectorAll('input,textarea,select,button')); controls.forEach(x => { x.disabled = true; }); say('جاري الحفظ مع فحص مراجعة الخدمة...');
        let acknowledged = false, lock = false;
        try {
          const r = await ownerCall(s, 'save', {product_key: service.product_key, expected_revision: service.revision, service: draft}, true);
          if (!activeView(v, s)) return;
          if (!r.service || r.service.product_key !== service.product_key || !Number.isInteger(Number(r.service.revision)) || Number(r.service.revision) <= Number(service.revision)) throw Error('SAVE_ACK_INVALID');
          acknowledged = true;
          const fresh = await ownerCall(s, 'catalog'); if (!activeView(v, s)) return;
          const actual = fresh.items?.find(x => x.product_key === service.product_key);
          if (!actual || Number(actual.revision) !== Number(r.service.revision)) { lock = true; throw Error('READBACK_CHANGED'); }
          ownerItems = fresh.items; renderServiceEditor(s, actual); say('أكدت المركزية الحفظ وأُعيدت قراءة الخدمة. المراجعة: ' + actual.revision);
        } catch (err) { if (activeView(v, s)) {
          lock = acknowledged || err.uncertain === true;
          say(lock ? 'لم تُحسم مطابقة آخر نسخة. لا تكرر الحفظ؛ احتُفظ بالمسودة المعروضة. حدّث الكتالوج وراجع السجل أولًا.' : errorText(err), true);
          if (lock) button(content, 'إعادة قراءة الكتالوج قبل الحفظ', openOwner);
        } } finally { if (activeView(v, s) && !lock) controls.forEach(x => { x.disabled = false; }); }
      }, true);
      button(row, 'تحديث الخدمة وإلغاء المسودة بعد الموافقة', () => { if (w.confirm('إلغاء المسودة غير المحفوظة وإعادة قراءة الكتالوج؟')) return openOwner(); });
      button(row, 'سجل هذه الخدمة', () => renderHistory(s, {product_key: service.product_key}));
      void save;
    }
    function bookingDetails(host, booking, owner) {
      const box = card(host, formatDate(booking.starts_at));
      text(box, 'الخدمة: ' + (ownerItems.find(x => x.product_key === booking.product_key)?.title || booking.product_key || ''));
      text(box, 'الحالة: ' + (STATUS[booking.status] || 'غير معروفة') + ' • النهاية: ' + formatDate(booking.ends_at, true));
      if (owner) { text(box, 'الاسم: ' + booking.name); text(box, 'الجوال: ' + booking.phone); }
      else text(box, 'الاسم: ' + booking.name);
      text(box, 'الاستفسار: ' + (booking.question || '')); text(box, 'رقم الحجز: ' + booking.id, 'f99a9-muted');
      if (owner && booking.notes != null) text(box, 'ملاحظات داخلية: ' + String(booking.notes));
      return box;
    }
    function renderOwnerSchedule(s, key = '', initial) {
      const v = page(); ownerNav(s); const filters = card(content, 'سجل المواعيد — بتوقيت الرياض');
      const today = riyadhDay(), range = initial || {from: today, to: addDays(today, 7)};
      const grid = el('div', 'f99a9-grid'); filters.append(grid);
      const from = field(grid, 'من تاريخ', range.from, 'date'), to = field(grid, 'إلى تاريخ (شامل)', range.to, 'date');
      const choose = select(filters, 'تصفية الخدمة', key, [['', 'كل الخدمات'], ...ownerItems.map(x => [x.product_key, publicText(x.title)])]);
      const row = actions(filters), results = el('div'); content.append(results); let query = null, offset = 0, serial = 0;
      async function load(reset) {
        const n = ++serial;
        if (reset) {
          if (!validDay(from.value) || !validDay(to.value) || from.value > to.value || to.value > addDays(from.value, 30)) { say('اختر نطاقًا من يوم واحد إلى 31 يومًا فقط.', true); return; }
          query = {from: from.value, to: to.value, ...(choose.value ? {product_key: choose.value} : {})}; offset = 0; results.replaceChildren();
        }
        const data = {...query, offset}; reload.disabled = true; say('جاري قراءة الحجوزات والإغلاقات المركزية...');
        try {
          const r = await ownerCall(s, 'schedule', data); if (!activeView(v, s) || n !== serial) return;
          if (!Array.isArray(r.items) || !Array.isArray(r.closures) || typeof r.has_more !== 'boolean') throw Error('BAD_CONTRACT');
          results.querySelector('[data-next-page]')?.remove();
          if (reset && !r.items.length) text(results, 'لا توجد حجوزات في هذا النطاق.');
          for (const b of r.items) {
            const box = bookingDetails(results, b, true), a = actions(box);
            if (b.status === 'confirmed') {
              button(a, 'نقل الموعد', () => renderOwnerMove(s, b, () => renderOwnerSchedule(s, choose.value, query)));
              for (const [state, label] of [['cancelled', 'إلغاء'], ['completed', 'إكمال'], ['no_show', 'لم يحضر']]) button(a, label, () => renderOwnerStatus(s, b, state, () => renderOwnerSchedule(s, choose.value, query)));
            }
            button(a, 'سجل الحجز', () => renderHistory(s, {booking_id: b.id}));
          }
          for(const b of r.requests || []) {
            const box=card(results,'طلب خدمة بشرية — '+(STATUS[b.status]||b.status));
            for(const line of ['الخدمة: '+b.product_key,'الاسم: '+b.name,'الجوال: '+b.phone,'الاستفسار: '+b.question,'رقم الطلب: '+b.id])text(box,line);
            if(b.status==='confirmed')for(const [state,label] of [['cancelled','إلغاء الطلب'],['completed','إكمال الطلب'],['no_show','لم يحضر']])button(box,label,()=>renderOwnerStatus(s,b,state,()=>renderOwnerSchedule(s,choose.value,query)));
            button(box,'سجل الطلب',()=>renderHistory(s,{booking_id:b.id}));
          }
          if (reset || r.closures.length) {
            const closures = card(results, 'الفترات المغلقة والمفتوحة في النطاق');
            if (!r.closures.length) text(closures, 'لا توجد إغلاقات مسجلة في النطاق.');
            for (const c of r.closures) {
              const item = card(closures, c.active ? 'فترة مغلقة' : 'فترة أُعيد فتحها');
              text(item, formatDate(c.start) + ' — ' + formatDate(c.end)); text(item, c.reason || 'بدون سبب مسجل');
              text(item, c.product_key ? 'الخدمة: ' + c.product_key : 'إغلاق عام لجميع الخدمات');
              if (c.active) button(item, 'إعادة فتح هذه الفترة مع حفظ السجل', () => ownerMutation(s, 'reopen_slot', {closure_id: c.id}, v, () => renderOwnerSchedule(s, choose.value, query)));
            }
          }
          offset += 100;
          if (r.has_more) { if (!r.items.length && !(r.requests||[]).length && !r.closures.length) throw Error('BAD_PAGINATION'); const next = button(results, 'تحميل المزيد (100 سجل كحد أقصى لكل صفحة)', () => load(false)); next.dataset.nextPage = '1'; }
          say('أُعيدت قراءة الحجوزات والإغلاقات من المركزية.');
        } catch (err) { if (activeView(v, s) && n === serial) { results.replaceChildren(); say(errorText(err), true); } }
        finally { if (activeView(v, s) && n === serial) reload.disabled = false; }
      }
      const reload = button(row, 'عرض النطاق / تحديث', () => load(true), true);
      for (const [label, start, end] of [['اليوم', today, today], ['الغد', addDays(today, 1), addDays(today, 1)], ['القادم (30 يومًا)', addDays(today, 2), addDays(today, 30)]]) button(row, label, () => { from.value = start; to.value = end; return load(true); });
      button(row, 'إغلاق فترة جديدة', () => renderClosure(s, choose.value, () => renderOwnerSchedule(s, choose.value, query || range)));
      void load(true);
    }
    async function ownerMutation(s, action, data, v, reload) {
      if (!w.confirm('تأكيد التغيير؟ سيبقى السجل محفوظًا في المركزية.')) return;
      const controls = Array.from(content.querySelectorAll('button,input,select,textarea')); controls.forEach(x => { x.disabled = true; }); say('جاري التحقق وحفظ التغيير...');
      try { await ownerCall(s, action, data, true); if (!activeView(v, s)) return; reload(); say('أكدت المركزية العملية. أعد قراءة السجل لمعرفة الحالة الحالية.'); }
      catch (err) { if (activeView(v, s)) {
        say(err.uncertain ? 'لم يُحسم رد التغيير. أعد قراءة السجل قبل تكرار العملية؛ لا نؤكد أنه حُفظ.' : errorText(err), true);
        if (err.uncertain) button(content, 'إعادة قراءة السجل قبل أي تغيير آخر', reload);
        else controls.forEach(x => { x.disabled = false; });
      } }
    }
    function renderOwnerMove(s, b, back) {
      const v = page(); bookingDetails(content, b, true); const box = card(content, 'نقل الموعد — توقيت الرياض');
      const start = field(box, 'التاريخ والوقت الجديدان', riyadhLocal(b.starts_at), 'datetime-local', {required: true});
      text(box, 'المركزية تتحقق من الدوام والإغلاقات والتداخل حتى لنقل المالك. لا يُحذف الحجز الأصلي.');
      button(box, 'اعتماد النقل بعد فحص المركزية', () => { if (!start.reportValidity()) return; return ownerMutation(s, 'move', {booking_id: b.id, start: riyadhISO(start.value)}, v, back); }, true); button(box, 'رجوع', back);
    }
    function renderOwnerStatus(s, b, newStatus, back) {
      const v = page(); bookingDetails(content, b, true); const box = card(content, 'تغيير الحالة إلى: ' + STATUS[newStatus]);
      const note = field(box, 'ملاحظة داخلية للسجل (اختيارية)', '', 'textarea');
      button(box, 'تأكيد الحالة في المركزية', () => ownerMutation(s, 'status', {booking_id: b.id, status: newStatus, note: note.value.trim()}, v, back), true); button(box, 'رجوع', back);
    }
    function renderClosure(s, key, back) {
      const v = page(), box = card(content, 'إغلاق فترة استقبال — بتوقيت الرياض');
      const chosen = select(box, 'نطاق الإغلاق', key, [['', 'كل الخدمات'], ...ownerItems.map(x => [x.product_key, publicText(x.title)])]);
      const start = field(box, 'بداية الإغلاق', riyadhDay() + 'T09:00', 'datetime-local', {required: true}), end = field(box, 'نهاية الإغلاق', riyadhDay() + 'T10:00', 'datetime-local', {required: true});
      const reason = field(box, 'سبب الإغلاق (اختياري)', '', 'textarea');
      text(box, 'الإغلاق يمنع مواعيد جديدة ولا يلغي الحجوزات المؤكدة ضمنه تلقائيًا. راجع الحجوزات القائمة بشكل مستقل.');
      button(box, 'إغلاق الفترة في المركزية', () => {
        if (!start.reportValidity() || !end.reportValidity()) return;
        const a = riyadhISO(start.value), b = riyadhISO(end.value); if (Date.parse(a) >= Date.parse(b)) throw localError('نهاية الإغلاق يجب أن تأتي بعد بدايته.');
        return ownerMutation(s, 'close_slot', {start: a, end: b, reason: reason.value.trim(), ...(chosen.value ? {product_key: chosen.value} : {})}, v, back);
      }, true); button(box, 'رجوع', back);
    }
    function renderHistory(s, filter) {
      const v = page(); ownerNav(s); text(content, 'سجل التغييرات المركزي — قراءة فقط، دون أكواد خام أو رموز جلسات.');
      const list = el('div'); content.append(list); let offset = 0, loading = false;
      async function load() {
        if (loading) return; loading = true; say('جاري قراءة السجل...');
        try {
          const r = await ownerCall(s, 'history', {...filter, offset}); if (!activeView(v, s)) return;
          if (!Array.isArray(r.items) || typeof r.has_more !== 'boolean') throw Error('BAD_CONTRACT');
          list.querySelector('[data-next-page]')?.remove();
          if (!offset && !r.items.length) text(list, 'لا توجد تغييرات مسجلة لهذا النطاق.');
          for (const item of r.items) {
            // Audit item fields are intentionally not guessed. Render contract-provided JSON as text.
            const row = card(list, 'سجل مركزي'); const pre = el('pre', 'f99a9-audit', JSON.stringify(redactAudit(item), null, 2)); row.append(pre);
          }
          offset += r.items.length;
          if (r.has_more) { if (!r.items.length) throw Error('BAD_PAGINATION'); const more = button(list, 'تحميل صفحة أخرى من السجل', load); more.dataset.nextPage = '1'; }
          say('أُعيدت قراءة سجل التغييرات.');
        } catch (err) { if (activeView(v, s)) { list.replaceChildren(); say(errorText(err), true); button(list, 'إعادة القراءة', () => renderHistory(s, filter)); } }
        finally { loading = false; }
      }
      void load();
    }
    function redactAudit(value) {
      if (Array.isArray(value)) return value.map(redactAudit);
      if (value && typeof value === 'object') {
        const out = {}; for (const [key, v] of Object.entries(value)) if (!/(?:token|secret|password|raw_code|code_value|code_hash)/i.test(key)) out[key] = redactAudit(v); return out;
      }
      return typeof value === 'string' ? publicText(value) : value;
    }
    function checkContext(r, s) {
      const x = r?.service;
      if (!x || x.product_key !== s.key || !KINDS.includes(x.kind) || !s.services.includes(x.kind) || !['appointment', 'manual'].includes(x.service_mode)
        || !Array.isArray(r.bookings) || r.timezone !== TZ || !r.quota || !Number.isInteger(Number(r.quota.remaining)) || Number(r.quota.remaining) < 0) throw Error('SERVICE_UNAVAILABLE');
      if (!Number.isInteger(Number(x.revision)) || !String(x.terms || '').trim() || !String(x.consent_text || '').trim()) throw Error('SERVICE_UNAVAILABLE');
      return r;
    }
    async function openClient(entry, key) {
      const s = clientSession(entry, key), v = open(s || {role: 'public'}, 'خدمتك ومواعيدك');
      if (!s) { text(card(content, 'تعذر فتح الخدمة'), 'يلزم كود مركزي مفعّل لهذه الخدمة على جهازك. لم نفتح حاسبة أو إجابات آلية بدلًا منها.'); say('جلسة العميل أو هوية الباقة أو صلاحية الخدمة غير متاحة.', true); button(content, 'تفعيل الكود من دخول المنصة', goLogin); return; }
      for (const k of pending.keys()) if (k !== scopeKey(s)) pending.delete(k);
      say('جاري التحقق من خدمة كودك والحجوزات المحفوظة...');
      try { const ctx = checkContext(await clientCall(s, 'context'), s); if (!activeView(v, s)) return; renderClientHome(s, ctx); }
      catch (err) { if (activeView(v, s)) { text(card(content, 'الخدمة غير متاحة الآن'), 'لم نعرض أوقاتًا تقديرية أو حجزًا غير محفوظ.'); say(errorText(err), true); button(content, 'إعادة قراءة الخدمة', () => openClient(null, s.key)); } }
    }
    function renderClientHome(s, ctx, message = '') {
      page(); serviceSummary(content, ctx.service, true);
      text(content, 'كل المواعيد بتوقيت الرياض (Asia/Riyadh). رصيد الحجوزات: ' + ctx.quota.remaining + ' متبقية من ' + ctx.quota.limit + '.');
      const unresolved = pending.get(scopeKey(s));
      if (unresolved) {
        const box = card(content, 'محاولة لم يُحسم ردها');
        text(box, 'قد تكون المركزية سجلت العملية. راجع الحجوزات أدناه أو أعد الطلب نفسه بمعرّفه نفسه؛ لا تبدأ حجزًا جديدًا الآن.');
        const retry = button(box, 'إعادة المحاولة نفسها بأمان', () => retryMutation(s, ctx, unresolved), true);
        retry.disabled = unresolved.busy;
        if (unresolved.busy) text(box, 'الطلب الأصلي لا يزال قيد الانتظار؛ حدّث القراءة بعد انتهاء المحاولة.');
      }
      const list = card(content, 'حجوزاتك المحفوظة');
      if (!ctx.bookings.length) text(list, 'لا توجد حجوزات محفوظة لهذا الكود.');
      for (const b of ctx.bookings) {
        const box = bookingDetails(list, b, false), a = actions(box);
        if (b.status === 'confirmed' && !unresolved) {
          button(a, 'تعديل الموعد بعد فحص المهلة', () => renderSlots(s, ctx, {booking: b}));
          button(a, 'إلغاء الحجز بعد فحص المهلة', () => renderClientCancel(s, ctx, b));
        }
        const link = waLinks.get(scopeKey(s) + ':' + b.id);
        if (b.status === 'confirmed' && link && link.start === b.starts_at) addWhatsApp(box, link.url);
      }
      if (ctx.service.service_mode === 'manual') {
        const box = card(content, 'طلبات الخدمة اليدوية المحفوظة');
        for (const b of ctx.requests || []) {
          const item = card(box, STATUS[b.status] || b.status); text(item, b.name); text(item, b.question); text(item, 'رقم الطلب: '+b.id);
          if (b.status === 'confirmed' && !unresolved) button(item, 'إلغاء الطلب بعد فحص المركزية', () => renderClientCancel(s, ctx, b));
          const link=waLinks.get(scopeKey(s)+':'+b.id); if(link&&b.status==='confirmed')addWhatsApp(item,link.url);
        }
        if(!unresolved && Number(ctx.quota.remaining)>0)button(content,'بدء طلب خدمة — التعليمات والإقرار أولًا',()=>renderConsent(s,ctx),true);
        text(box,'الطلب يُحفظ لدى صاحب الخدمة بعد اعتمادك؛ ليس جوابًا آليًا ولا حجز موعد.');
      } else if (!unresolved && Number(ctx.quota.remaining) > 0) button(content, 'بدء الحجز — قراءة التعليمات والإقرار أولًا', () => renderConsent(s, ctx), true);
      else if (!unresolved) text(content, 'لا يوجد رصيد متبقٍ لحجز جديد. يحدد الخادم إمكانية الإلغاء أو التعديل.');
      button(content, 'تحديث الخدمة والحجوزات من المركزية', () => openClient(null, s.key));
      if (message) say(message);
    }
    function renderConsent(s, ctx) {
      page(); const box = card(content, '1 من 4 — تعليمات الخدمة والشروط والإقرار');
      text(box, ctx.service.instructions || 'راجع تعليمات صاحب الخدمة قبل الحجز.'); text(box, ctx.service.terms); text(box, ctx.service.consent_text);
      text(box, 'بموافقتك نستخدم اسمك وجوالك واستفسارك لتنظيم الموعد لدى صاحب الخدمة. لا تدخل معلومات بنكية أو هوية أو بيانات حساسة في الاستفسار. رسالة واتساب لا تُفتح إلا باختيارك، وستشارك محتواها مع واتساب عند فتحه.');
      const consent = checkbox(box, 'أقر بأنني قرأت التعليمات والشروط والإقرار وأوافق على استخدام بيانات الاتصال لتنظيم الموعد.', false);
      const next = button(box, 'الموافقة ثم بيانات الاتصال', () => { if (consent.checked) renderContact(s, ctx, {accepted: true, expected_revision: ctx.service.revision}); }, true); next.disabled = true;
      consent.onchange = () => { next.disabled = !consent.checked; }; button(box, 'رجوع إلى حجوزاتي', () => renderClientHome(s, ctx));
    }
    function renderContact(s, ctx, details) {
      page(); const box = card(content, '2 من 4 — بيانات الاتصال والاستفسار');
      const name = field(box, 'اسمك', details.name || '', 'text', {required: true, minLength: 2, maxLength: 80, autocomplete: 'name'});
      const phone = field(box, 'رقم جوالك السعودي (05...)', details.phone || '', 'tel', {required: true, autocomplete: 'tel', inputMode: 'tel', maxLength: 20});
      const question = field(box, 'استفسارك لصاحب الخدمة — دون بيانات حساسة', details.question || '', 'textarea', {required: true, minLength: 5, maxLength: 2000});
      button(box, ctx.service.service_mode==='manual'?'مراجعة طلب الخدمة':'متابعة إلى الأوقات الفعلية', () => {
        if (!name.reportValidity() || !phone.reportValidity() || !question.reportValidity()) return;
        const p = saudiPhone(phone.value);
        if (!p || !name.value.trim() || !question.value.trim()) throw localError('اكتب اسمك واستفسارك ورقم جوال سعوديًا صحيحًا.');
        const flow={details:{...details,name:name.value.trim(),phone:'+'+p,question:question.value.trim()}};
        if(ctx.service.service_mode==='manual')renderManualConfirmation(s,ctx,flow);else renderSlots(s,ctx,flow);
      }, true); button(box, 'رجوع إلى الإقرار', () => renderConsent(s, ctx));
    }
    function renderManualConfirmation(s,ctx,flow){
      const v=page(),box=card(content,'مراجعة طلب الخدمة البشرية');
      for(const line of [ctx.service.title,'الاسم: '+flow.details.name,'الجوال: '+flow.details.phone,'الاستفسار: '+flow.details.question])text(box,line);
      text(box,'يُحفظ الطلب والسجل بعد تأكيد المركزية. لا يوجد موعد تلقائي أو دفع أو إرسال واتساب.');
      const submit=button(box,'تأكيد طلب الخدمة في المركزية',async()=>{
        if(pending.has(scopeKey(s))){renderClientHome(s,ctx);return;}
        submit.disabled=true;const attempt={action:'request',data:{...flow.details,request_id:uuid(w.crypto)},busy:false,uncertain:false};
        pending.set(scopeKey(s),attempt);await performMutation(s,ctx,attempt,v);
      },true);button(box,'رجوع إلى بيانات الاتصال',()=>renderContact(s,ctx,flow.details));
    }
    function renderSlots(s, ctx, flow) {
      const v = page(), reschedule = !!flow.booking; const box = card(content, reschedule ? 'تعديل الحجز — اختر وقتًا فعليًا جديدًا' : '3 من 4 — المواعيد المتاحة فعليًا');
      if (reschedule) text(box, 'الحجز الحالي: ' + formatDate(flow.booking.starts_at) + '. قبول التعديل مرتبط بالمهلة وصلاحية الكود وفحص المركزية.');
      const day = field(box, 'اليوم الميلادي بتوقيت الرياض', riyadhDay(), 'date', {required: true, min: riyadhDay()});
      const slotsArea = el('div', 'f99a9-slots'); box.append(slotsArea); slotsArea.setAttribute('aria-live', 'polite');
      let selected = null, serial = 0;
      const next = button(box, reschedule ? 'مراجعة التعديل قبل تأكيده' : 'مراجعة بيانات الحجز قبل التأكيد', () => {
        if (!selected) return; renderClientConfirmation(s, ctx, {...flow, slot: selected});
      }, true); next.disabled = true;
      const clear = () => { serial++; selected = null; next.disabled = true; slotsArea.replaceChildren(); say('لم يتم تأكيد حجز. اعرض أوقات اليوم المحدد من المركزية.'); };
      day.onchange = clear;
      const load = button(box, 'عرض أوقات هذا اليوم من المركزية', async () => {
        if (!day.reportValidity() || !validDay(day.value)) return;
        const n = ++serial, requestedDay = day.value; selected = null; next.disabled = true; slotsArea.replaceChildren(); load.disabled = true;
        say('جاري قراءة الأوقات المتاحة لهذا اليوم...');
        try {
          const r = await clientCall(s, 'slots', {day: requestedDay, ...(reschedule ? {exclude_booking_id: flow.booking.id} : {})});
          if (!activeView(v, s) || n !== serial || day.value !== requestedDay) return;
          if (!Array.isArray(r.items) || r.timezone !== TZ) throw Error('BAD_CONTRACT');
          if (!r.items.length) text(slotsArea, 'لا توجد أوقات متاحة لهذا اليوم. اختر يومًا آخر.');
          for (const slot of r.items) {
            if (!validInstant(slot.starts_at) || !validInstant(slot.ends_at) || Date.parse(slot.starts_at) >= Date.parse(slot.ends_at) || riyadhDay(slot.starts_at) !== requestedDay) throw Error('BAD_SLOT');
            const b = button(slotsArea, formatDate(slot.starts_at, true) + ' — ' + formatDate(slot.ends_at, true), () => {
              selected = slot; slotsArea.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); next.disabled = false;
            }); b.setAttribute('aria-pressed', 'false');
          }
          say('الأوقات من المركزية الآن؛ يُعاد فحص توفر الوقت عند التأكيد.');
        } catch (err) { if (activeView(v, s) && n === serial) { selected = null; next.disabled = true; slotsArea.replaceChildren(); say(errorText(err), true); } }
        finally { if (activeView(v, s)) load.disabled = false; }
      });
      button(box, 'رجوع', () => reschedule ? renderClientHome(s, ctx) : renderContact(s, ctx, flow.details));
      // Contact and consent are completed before the first slot read. No local slot calculation.
      void load;
    }
    function renderClientConfirmation(s, ctx, flow) {
      const v = page(), reschedule = !!flow.booking, box = card(content, reschedule ? 'تأكيد تعديل الموعد' : '4 من 4 — مراجعة وتأكيد الحجز');
      text(box, ctx.service.title); text(box, 'الموعد الجديد: ' + formatDate(flow.slot.starts_at) + ' إلى ' + formatDate(flow.slot.ends_at, true) + ' بتوقيت الرياض.');
      if (reschedule) text(box, 'رقم الحجز: ' + flow.booking.id + ' • الموعد الحالي: ' + formatDate(flow.booking.starts_at));
      else { text(box, 'الاسم: ' + flow.details.name); text(box, 'الجوال: ' + flow.details.phone); text(box, 'استفسارك: ' + flow.details.question); text(box, 'وافق العميل على التعليمات والشروط والإقرار للمراجعة ' + flow.details.expected_revision + '.'); }
      text(box, 'الوقت لا يُحجز حتى يرد التأكيد المركزي. قد يصبح غير متاح إذا سبقك حجز آخر.');
      const submit = button(box, reschedule ? 'تأكيد التعديل في المركزية' : 'تأكيد الحجز في المركزية', async () => {
        if (pending.has(scopeKey(s))) { renderClientHome(s, ctx); return; }
        submit.disabled = true;
        const data = reschedule ? {booking_id: flow.booking.id, start: flow.slot.starts_at, request_id: uuid(w.crypto)} : {start: flow.slot.starts_at, ...flow.details, request_id: uuid(w.crypto)};
        const attempt = {action: reschedule ? 'reschedule' : 'book', data, busy: false, uncertain: false};
        pending.set(scopeKey(s), attempt); await performMutation(s, ctx, attempt, v);
      }, true);
      button(box, 'رجوع واختيار وقت آخر', () => renderSlots(s, ctx, flow)); button(box, 'رجوع إلى حجوزاتي', () => renderClientHome(s, ctx));
    }
    function renderClientCancel(s, ctx, booking) {
      const v = page(); bookingDetails(content, booking, false); const box = card(content, 'إلغاء الحجز بعد فحص المركزية');
      text(box, 'المركزية تتحقق من ملكية الحجز وحالته ومهلة الإلغاء. يبقى الحجز والسجل محفوظين بحالة ملغية عند قبول الإلغاء.');
      button(box, 'تأكيد طلب الإلغاء', async () => {
        if (!w.confirm('إلغاء هذا الحجز فقط إذا سمحت المهلة المركزية؟')) return;
        if (pending.has(scopeKey(s))) { renderClientHome(s, ctx); return; }
        const attempt = {action: 'cancel', data: {booking_id: booking.id, request_id: uuid(w.crypto)}, busy: false, uncertain: false}; pending.set(scopeKey(s), attempt);
        await performMutation(s, ctx, attempt, v);
      }, true); button(box, 'الاحتفاظ بالحجز والرجوع', () => renderClientHome(s, ctx));
    }
    async function retryMutation(s, ctx, attempt) {
      if (pending.get(scopeKey(s)) !== attempt || attempt.busy) return;
      const v = page(); const box = card(content, 'إعادة الطلب نفسه دون إنشاء محاولة جديدة');
      text(box, 'نعيد معرّف الطلب الأصلي وبياناته نفسها. لا نؤكد نتيجة قبل رد المركزية.');
      await performMutation(s, ctx, attempt, v);
    }
    async function performMutation(s, ctx, attempt, v) {
      if (attempt.busy) return; attempt.busy = true;
      const controls = Array.from(content.querySelectorAll('button,input,select,textarea')); controls.forEach(x => { x.disabled = true; }); say('جاري فحص الطلب وحفظه في المركزية...');
      try {
        const r = await clientCall(s, attempt.action, attempt.data, true);
        const b = r.booking || r.request; const manual=!!r.request;
        if (!b?.id || b.product_key !== s.key || (manual ? !validInstant(b.created_at) : (!validInstant(b.starts_at) || !validInstant(b.ends_at))) || !STATUS[b.status]) { const e = Error('MUTATION_ACK_INVALID'); e.uncertain = true; throw e; }
        pending.delete(scopeKey(s));
        if (attempt.action === 'cancel') waLinks.delete(scopeKey(s) + ':' + b.id);
        if (attempt.action === 'reschedule') waLinks.delete(scopeKey(s) + ':' + b.id);
        if (['book','request'].includes(attempt.action) && safeWhatsApp(r.whatsapp_url)) waLinks.set(scopeKey(s) + ':' + b.id, {url: safeWhatsApp(r.whatsapp_url), start: b.starts_at || b.created_at});
        if (!activeView(v, s)) return;
        content.replaceChildren(); say('ورد تأكيد مركزي؛ جاري إعادة قراءة حجوزاتك قبل عرض النتيجة...');
        const fresh = checkContext(await clientCall(s, 'context'), s); if (!activeView(v, s)) return;
        const actual = [...fresh.bookings,...(fresh.requests||[])].find(x => x.id === b.id);
        if (!actual) throw Error('READBACK_NOT_CONFIRMED');
        renderClientHome(s, fresh, 'أُعيدت قراءة الحجز المحفوظ من المركزية؛ حالته الحالية: ' + (STATUS[actual.status] || actual.status) + '.');
        if (['book','request'].includes(attempt.action) && !safeWhatsApp(r.whatsapp_url)) text(content, 'لم تُجهز المركزية رابط واتساب صالحًا. لا توجد رسالة مرسلة تلقائيًا.', 'f99a9-muted');
      } catch (err) {
        if (pending.get(scopeKey(s)) === attempt) {
          if (err.uncertain || attempt.uncertain) attempt.uncertain = true; else pending.delete(scopeKey(s));
        }
        if (!activeView(v, s)) return;
        page(); const box = card(content, 'لم نعرض نجاحًا غير متحقق');
        if (pending.has(scopeKey(s))) {
          text(box, 'رد العملية غير محسوم؛ قد تكون حُفظت. لا تبدأ طلبًا جديدًا. أعد قراءة الحجوزات أو كرر الطلب نفسه بمعرّفه الأصلي.');
          button(box, 'إعادة الطلب نفسه بأمان', () => retryMutation(s, ctx, attempt), true);
        } else text(box, 'أعد قراءة الحجوزات والخدمة لمعرفة الحالة الحالية قبل المتابعة.');
        button(box, 'قراءة الحجوزات الحالية', () => openClient(null, s.key));
        say(errorText(err), true);
      } finally { attempt.busy = false; }
    }
    function addWhatsApp(host, url) {
      const href = safeWhatsApp(url); if (!href) return;
      const a = el('a', 'f99a9-button f99a9-wa', 'فتح واتساب برسالة الحجز الجاهزة'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
      a.addEventListener('click', ev => { if (!sessionLive(current)) { ev.preventDefault(); invalidate(); } }); host.append(a);
      text(host, 'يفتح رسالة جهزتها المركزية من نص المالك. أنت تضغط إرسال بنفسك؛ لا يوجد إرسال تلقائي. ينتقل محتوى الرسالة إلى واتساب عند اختيار فتح الرابط.', 'f99a9-muted');
    }
    function hideLegacyClient() {
      for (const id of ['f99o2-overlay', 'f99v6-services']) { const n = d.getElementById(id); if (n) n.hidden = true; }
    }
    function entryKinds() {
      const a = access(), e = restored();
      const list = a?.record?.centralData?.allowed_services || e?.allowed_services || [];
      return Array.isArray(list) ? list : [];
    }
    const oldEntry = w.F99O2OpenForEntry, oldClient = w.F99O2OpenClient, oldRun = w.F99V13RunService, oldChoose = w.F99V6OpenServices;
    function forEntry(entry, key) {
      const kinds = entryKinds();
      if (kinds.some(k => KINDS.includes(k)) || !kinds.length) { hideLegacyClient(); return openClient(entry, key); }
      if (typeof oldEntry === 'function') return oldEntry.apply(w, arguments);
      return openClient(entry, key);
    }
    w.F99O2OpenForEntry = forEntry;
    w.F99O2OpenClient = function (entry, key) {
      const kinds = entryKinds();
      if (kinds.some(k => KINDS.includes(k)) || !kinds.length) { hideLegacyClient(); return openClient(entry, key); }
      if (typeof oldClient === 'function') return oldClient.apply(this, arguments);
      return openClient(entry, key);
    };
    w.F99O2OpenAdmin = openOwner;
    w.F99V13RunService = function (kind) {
      if (KINDS.includes(kind)) { hideLegacyClient(); return openClient(); }
      if (typeof oldRun === 'function') return oldRun.apply(this, arguments);
    };
    w.F99V6OpenServices = function () {
      const kinds = entryKinds();
      if (!kinds.some(k => KINDS.includes(k))) return typeof oldChoose === 'function' ? oldChoose.apply(this, arguments) : undefined;
      const s = clientSession(); if (!s) return openClient();
      const v = open(s, 'خدمات باقتك'); text(content, 'اختر من صلاحيات كودك؛ الخدمات البشرية لها إقرار وحجز مركزي وليست إجابات آلية.');
      const row = actions(content); button(row, 'الخدمة البشرية ومواعيدي', () => { if (activeView(v, s)) return openClient(); }, true);
      if (kinds.some(k => !KINDS.includes(k)) && typeof oldChoose === 'function') button(row, 'الخدمات الأخرى المصرح بها', () => { close(); oldChoose.call(w); });
    };
    // The current login only routes the two guidance kinds. For custom_service, let the
    // original identity/auth/heartbeat finish unchanged, then open the real authorized UI.
    const oldFinish = w.finishIdentityAndEnter;
    if (typeof oldFinish === 'function') w.finishIdentityAndEnter = function () {
      const result = oldFinish.apply(this, arguments), a = access(), kinds = entryKinds();
      if (a?.record?.central && !a.record.owner && kinds.length === 1 && kinds[0] === 'custom_service') void openClient();
      return result;
    };
    // Legacy storefront openDetail is private, not an exported hook. Its real tile
    // carries data-product-key. Capture only human-service details clicks; all
    // other services and their existing checkout/technical keys remain unchanged.
    d.addEventListener('click', ev => {
      const target = ev.target?.closest?.('#f99s-modal .f99v6-tile[data-product-key] button');
      if (!target) return;
      const tile = target.closest('[data-product-key]');
      let product;
      try { product = w.FINO99ReadStorefront?.()?.products?.find(x => x.key === tile.dataset.productKey); } catch (_) { return; }
      if (!Array.isArray(product?.services) || !product.services.some(x => KINDS.includes(x))) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const legacy = d.getElementById('f99s-modal'); if (legacy) legacy.hidden = true;
      void openOffer(tile.dataset.productKey);
    }, true);
    function mountEntry() {
      // Attachment 19: no human-services section on the public home page. Services remain
      // reachable only through their own approved storefront product and the owner panel.
      d.getElementById('f99a9-catalog-entry')?.remove();
      const ownerButton = d.querySelector('#ownerHub .owner-grid [onclick*="F99O2OpenAdmin"]');
      if (ownerButton) {
        const small = ownerButton.querySelector('small');
        if (small) small.textContent = 'الخدمات البشرية، الدوام، الاستثناءات، الحجوزات والسجل المركزي.';
      }
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mountEntry, {once: true}); else mountEntry();
    return {openOwner, openClient, openOffer, openCatalog};
  }
  return Object.freeze({install, safeHttps, safeWhatsApp, saudiPhone, validDay, riyadhDay, addDays, validTime, riyadhISO, riyadhLocal, validInstant, validateWindows, validateSchedule, numberValue, uuid, packageKey, TZ, KINDS});
});
