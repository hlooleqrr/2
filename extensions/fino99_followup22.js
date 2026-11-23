/* Round22 E: view != consent. Existing fee design and original WhatsApp builder;
 * server quotes/entry/bank guards remain authoritative. No result/image mutation. */
(function (w) {
  'use strict';
  const defs = [], category = 'عروض المتابعة', consentCategory = 'الموافقة والاعتذار والتأجيل', shareCategory = 'نصوص المشاركة عبر واتساب';
  function define(key, label, text, vars = [], cat = category, note = '') {
    defs.push({ key: 'followup22.' + key, category: cat, label, text, vars, note });
  }
  define('invite', 'دعوة مشاهدة العرض', '🎉 يا {client}، عندك عرض خاص لمتابعة إجراءات تمويلك!\nتبي تشوف تفاصيل العرض؟', ['client']);
  define('view', 'قبول مشاهدة العرض', 'أبي أشوف العرض', [], consentCategory);
  define('postpone', 'تأجيل العرض', 'ليس الآن', [], consentCategory);
  define('continue', 'المتابعة بعد «ليس الآن»', 'أبشر يا {client}، نكمل حسبتك.', ['client'], consentCategory);
  define('other_bank', 'زر اختيار جهة مرشحة ثانية', 'أبي جهة مرشحة ثانية', [], consentCategory);
  define('other_pick', 'عنوان اختيار جهة المتابعة', 'اختر الجهة اللي تبي نتابع معاملتك عن طريقها (من الجهات المرشحة لك فقط):');
  define('updated', 'تحديث العرض بعد تغيير الجهة', 'تم تحديث عرض المتابعة حسب الجهة اللي اخترتها.', [], consentCategory);
  define('service_note', 'توضيح طبيعة الخدمة', 'الخدمة متابعة إجراءات فقط، وليست تمويلًا مباشرًا أو ضمانًا لموافقة الجهة التمويلية.');
  define('title', 'عنوان بطاقة العرض', 'يا {client}، عرض متابعة إجراءات تمويلك', ['client']);
  define('entity', 'الجهة المرتبطة بالنتيجة', 'يا {client}، هذا عرض المتابعة الخاص بك على {entity}', ['client', 'entity']);
  define('previous', 'الأتعاب السابقة', 'السعر السابق: {amount} ريال', ['amount']);
  define('saving', 'التوفير المعتمد', 'وفّرت {amount} ريال على أتعاب المتابعة', ['amount']);
  define('discount', 'الخصم المعتمد', 'نسبة الخصم: {percent}٪', ['percent']);
  define('discount_amount', 'الخصم الثابت المعتمد', 'الخصم المعتمد: {amount} ريال', ['amount']);
  define('fee', 'الأتعاب', 'أتعاب المتابعة: {amount} ريال', ['amount']);
  define('discounted_fee', 'الأتعاب بعد الخصم', 'أتعاب المتابعة بعد الخصم: {amount} ريال', ['amount']);
  define('terms', 'الشروط المعتمدة', '{terms}', ['terms']);
  define('expiry', 'صلاحية العرض', 'صلاحية العرض حتى: {expiry} (بتوقيت الرياض)', ['expiry']);
  define('consent', 'الموافقة الفعلية على المتابعة', 'أرغب بذلك', [], consentCategory);
  // r39: the approved marketing card — congratulation first, then the offer; texts editable by the owner.
  define('congrats', 'عنوان التهنئة في بطاقة العرض', '🎉 مبروك يا {client}!', ['client']);
  define('congrats_lead', 'نص التهنئة (عند خلو نص العرض المعتمد)', 'حصلت على عرض خاص لمتابعة إجراءات تمويلك لدى الجهات التمويلية.');
  // r96: the approved marketing layout (owner-editable labels; amounts always come from the server quote).
  define('congrats_sub', 'سطر التهنئة تحت العنوان', 'عندك عرض خاص على أتعاب المتابعة');
  define('before_label', 'عنوان الأتعاب قبل الخصم', 'قبل الخصم');
  define('after_label', 'عنوان الأتعاب بعد الخصم', 'بعد الخصم');
  define('send_retry', 'تعذر تجهيز رسالة المتابعة', 'تعذر تجهيز رسالة المتابعة الآن. اضغط «أرغب بذلك» مرة ثانية.', [], consentCategory);
  define('offer_days', 'مدة العرض', 'مدة العرض: {days} أيام من تاريخ ووقت إصدار هذه الحسبة', ['days']);
  define('offer_ends', 'تاريخ انتهاء العرض', 'ينتهي العرض: {expiry} (بتوقيت الرياض)', ['expiry']);
  define('offer_expired', 'انتهاء مدة العرض', 'انتهت مدة هذا العرض لهذه الحسبة.', [], consentCategory);
  define('loading', 'تجهيز العرض', 'جاري تجهيز عرضك الخاص…', [], consentCategory);
  define('close', 'إغلاق بطاقة العرض', 'إغلاق العرض', [], consentCategory);
  define('prepared', 'ملاحظة التجهيز دون إرسال تلقائي', 'جهّزنا رسالتك في واتساب. راجعها وأرسلها بنفسك؛ لا يتم اعتماد أي طلب تلقائيًا.', [], consentCategory);
  define('unavailable', 'تعذر تحميل العرض', 'ما قدرت أجيب عرضًا معتمدًا لهذا الكود الآن. لم يتم إرسال أي طلب.', [], consentCategory);
  define('changed', 'تحديث العرض قبل الموافقة', 'تغيّرت الحسبة أو شروط العرض؛ راجع البطاقة المحدثة قبل قبول المتابعة.', [], consentCategory);
  define('pick', 'اختيار الجهة قبل العرض', 'اختر الحسبة المناسبة لك، وأعرض لك أتعاب المتابعة المعتمدة والخصم الساري قبل إرسال أي طلب.');
  define('pick_result', 'زر اختيار حسبة', '{entity} — قسط {installment} ريال', ['entity', 'installment']);
  define('apology', 'اعتذار توقف متابعة جهة التمويل', w.F99BankFollowup17?.APOLOGY || 'نعتذر منك، خدمة متابعة إجراءات التمويل عبرنا لجهة التمويل المختارة غير متاحة حاليًا.', [], consentCategory);
  define('no_financial_offer', 'لا يوجد عرض مالي معتمد', 'لا يوجد عرض متابعة مالي معتمد متاح الآن. لم يتم تسجيل طلب أو قبول.', [], consentCategory);
  define('final_message', 'نص واتساب النهائي', '{message}', ['message'], shareCategory, 'النص الأصلي الكامل في {message}. لا يتجهز إلا بعد قبول المتابعة؛ المتغير لا يتضمن أكوادًا أو بيانات جلسة.');
  ['title', 'entity', 'previous', 'saving', 'discount', 'expiry', 'terms', 'service_note'].forEach(k => define('show_' + k, 'إظهار النص: ' + k, '1', [], category, '1 إظهار / 0 إخفاء النص فقط؛ لا يغير الأتعاب أو الشروط المعتمدة.'));
  const messageParts = [
    ['greeting', 'السلام عليكم ورحمة الله وبركاته', [], null],
    ['intro', 'أنا {client}، أطلب عرض خدمات متابعة معاملتي التمويلية.', ['client'], 'أنا '],
    ['data_heading', '— بيانات الحسبة المبدئية —', [], null],
    ['client', 'اسم صاحب الحسبة: {value}', ['value'], 'اسم صاحب الحسبة: '],
    ['scenario', 'ملاحظة: {value}', ['value'], 'ملاحظة: '],
    ['sector', 'القطاع: {value}', ['value'], 'القطاع: '],
    ['salary_bank', 'جهة الراتب: {value}', ['value'], 'جهة الراتب: '],
    ['entity', 'الجهة المرشحة: {value}', ['value'], 'الجهة المرشحة: '],
    ['salary', 'صافي الراتب الشهري: {value}', ['value'], 'صافي الراتب الشهري: '],
    ['obligations', 'الالتزامات الشهرية الأخرى: {value}', ['value'], 'الالتزامات الشهرية الأخرى: '],
    ['settlement', 'السداد المبكر للمديونية الحالية: {value}', ['value'], 'السداد المبكر للمديونية الحالية: '],
    ['rate', 'هامش الربح السنوي: {value}', ['value'], 'هامش الربح السنوي: '],
    ['duration', 'المدة: {value}', ['value'], 'المدة: '],
    ['installment', 'القسط الشهري المتوقع: {value}', ['value'], 'القسط الشهري المتوقع: '],
    ['principal', 'أصل التمويل قبل الرسوم: {value}', ['value'], 'أصل التمويل قبل الرسوم: '],
    ['profit', 'إجمالي أرباح التمويل: {value}', ['value'], 'إجمالي أرباح التمويل: '],
    ['gross', 'إجمالي التمويل مع الأرباح: {value}', ['value'], 'إجمالي التمويل مع الأرباح: '],
    ['admin_fee', 'الرسوم الإدارية: {value}', ['value'], 'الرسوم الإدارية: '],
    ['admin_vat', 'ضريبة الرسوم الإدارية: {value}', ['value'], 'ضريبة الرسوم الإدارية: '],
    ['commodity_fee', 'رسوم السلعة إن وجدت: {value}', ['value'], 'رسوم السلعة إن وجدت: '],
    ['net', 'صافي التمويل بعد الرسوم وقبل سداد المديونية: {value}', ['value'], 'صافي التمويل بعد الرسوم وقبل سداد المديونية: '],
    ['cash', 'صافي الكاش المتوقع بعد سداد المديونية: {value}', ['value'], 'صافي الكاش المتوقع بعد سداد المديونية: '],
    ['offer_heading', '— عرض المتابعة —', [], null],
    ['fee', 'أتعاب المتابعة المعتمدة: {value}', ['value'], 'أتعاب المتابعة المعتمدة: '],
    ['previous', 'الأتعاب قبل الخصم: {value}', ['value'], 'الأتعاب قبل الخصم: '],
    ['saving', 'قيمة الخصم الساري: {value}', ['value'], 'قيمة الخصم الساري: '],
    ['percent', 'نسبة خصم الأتعاب: {value}', ['value'], 'نسبة خصم الأتعاب: '],
    ['expiry', 'صلاحية العرض حتى: {value}', ['value'], 'صلاحية العرض حتى: '],
    ['requirements', 'أرغب في معرفة المستندات والمتطلبات وخطوات المتابعة.', [], null],
    ['disclaimer', 'وأعلم أنا {client} أن هذه الحسبة مبدئية وإرشادية، وأن التمويل النهائي وشروطه من اختصاص الجهات التمويلية، وأن FINO99 وسيط خدمات وليست جهة مانحة للتمويل.', ['client'], 'وأعلم أنا '],
    ['site', 'المنصة الذكية للحلول التمويلية: {value}', ['value'], 'المنصة الذكية للحلول التمويلية: ']
  ];
  messageParts.forEach(([k, text, vars]) => {
    define('wa_' + k, 'واتساب: ' + text.split(':')[0], text, vars, shareCategory);
    define('wa_show_' + k, 'تضمين واتساب: ' + text.split(':')[0], '1', [], shareCategory, '1 تضمين / 0 إخفاء هذا التفصيل من الرسالة.');
  });
  define('wa_extra', 'النص الإضافي المعتمد في واتساب', '{value}', ['value'], shareCategory);
  define('wa_show_extra', 'تضمين النص الإضافي', '1', [], shareCategory, '1 تضمين / 0 إخفاء.');
  w.F99Texts?.register(defs);
  const T = (key, vars = {}, fallback) => w.F99T('followup22.' + key, vars, fallback);
  const shown = key => T('show_' + key) !== '0';
  const bank = () => w.F99B17Integration;
  const chat = () => document.getElementById('finoBotChat');
  const who = () => typeof clientName !== 'undefined' ? String(clientName || '') : '';
  const rows = () => typeof latestResults !== 'undefined' && Array.isArray(latestResults) ? latestResults : [];
  const data = () => typeof finoPortal !== 'undefined' ? finoPortal.data || {} : {};
  const active = () => w.F99S12Runtime?.owner?.() !== true && typeof finoPortal !== 'undefined' && finoPortal.step === 'buyout_result' && !!chat();
  const selected = () => typeof selectedResultIndex !== 'undefined' ? Number(selectedResultIndex) : -1;
  // r25: number only (the templates add «ريال» once); keeps the approved decimals, e.g. 18.99.
  const fmt = v => { const n = Number(v); if (!Number.isFinite(n)) return String(v ?? ''); return n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }); };
  const packageKey = () => w.F99V32MainAccess?.()?.packageKey || w.fino99ActivePackage?.()?.key;
  const entry = () => w.F99S12Runtime?.entry?.();
  const snapshot = r => JSON.stringify({ result: r, data: data(), client: who() });
  const session = () => bank()?.identity() || '';
  const postponed = new Set();
  let host = null, front = null, pending = null, epoch = 0, busy = false, displayed = '';
  // r34: one automatic invitation per eligible calculation; «ليس الآن» never blocks later offers.
  const responded = new Set(); let calcSeq = 0, invitedKey = '', gateNext = null, gateInstalled = false;
  const calcKey = () => { try { return [entry()?.entryToken || '', calcSeq, JSON.stringify(data())].join('|'); } catch (_) { return ''; } };
  const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function button(parent, text, run) { const b = el('button', text); b.type = 'button'; b.onclick = run; parent.append(b); return b; }
  function clear() { epoch++; host?.remove(); front?.remove(); host = null; front = null; pending = null; busy = false; displayed = ''; }
  // r34 §3: the fee card is a front dialog (never a faded line at the bottom); the invitation sits under the result.
  function slot(cls = 'f49-card f49-completion-request', mode = 'front') {
    clear(); host = el('section', undefined, cls); host.dataset.f99Followup22 = '1';
    if (mode === 'front') { front = el('div', undefined, 'f34-front'); front.id = 'f34FeeFront'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.tabIndex = -1; front.append(host); document.body.append(front); /* r96: page level, above the chat layer and the install tip */ setTimeout(() => { try { host?.focus({ preventScroll: true }); } catch (_) {} }, 0); }
    else { host.id = 'f41-offer'; const menus = chat()?.querySelectorAll('.f25-menu'); const m = menus && menus[menus.length - 1]; if (m) m.before(host); else chat()?.append(host); }
    return host;
  }
  function status(text) { if (!host) return; let p = host.querySelector('[data-f22-status]'); if (!p) { p = el('p'); p.dataset.f22Status = '1'; p.setAttribute('role', 'status'); const a = host.querySelector('.f39-actions'); if (a) a.after(p); else host.append(p); } p.textContent = text; }
  async function rpc(fn, args) { const r = await w.finoRpc(fn, args, 20000); if (!r?.ok || r.data?.ok !== true) throw Error(r?.data?.reason || 'FOLLOWUP_UNAVAILABLE'); return r.data; }
  function args() { const e = entry(); if (!e?.entryToken || !e.deviceId) throw Error('ENTRY_REQUIRED'); return { p_entry_token: e.entryToken, p_device_id: e.deviceId }; }
  async function allowed() {
    const st = await rpc('f99v41_client_completion_status', args());
    if (!st.enabled || !st.has_whatsapp || !st.has_first_calculation) return false;
    const cfg = await rpc('f99v80_public_fee_display', { p_package_key: packageKey() });
    if (cfg.display_mode !== 'last') return true;
    const q = await rpc('f99v23_client_status', args());
    return Number(q.max_calculations) > 0 && Number(q.calculations_remaining) === 0;
  }
  async function quote(r) { return rpc('f99v41_client_completion_quote', { ...args(), p_package_key: packageKey(), p_cash: Number(r.cashAfterDebt || 0), p_principal: Number(r.principalBeforeFees || 0) }); }
  // r39: 5 days from the actual issue time of this calculation (stored once per calculation; reopening never renews it).
  const OFFER_DAYS = 5, ISSUED = 'f99r39_fee_issued';
  const hash = t => { let h = 2166136261; for (const c of String(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  function issuedAt() {
    const marks = chat()?.querySelectorAll('.f85-calc-marker'), last = marks && marks[marks.length - 1];
    const key = hash(entry()?.entryToken || session() || 'x') + ':' + (last?.dataset.f85CalcIndex || calcSeq);
    let map = {}; try { map = JSON.parse(w.localStorage.getItem(ISSUED) || '{}') || {}; } catch (_) {}
    if (!Number.isFinite(map[key])) {
      map[key] = Date.now(); const ks = Object.keys(map).sort((a, b) => map[a] - map[b]); ks.slice(0, Math.max(0, ks.length - 40)).forEach(k => delete map[k]);
      try { w.localStorage.setItem(ISSUED, JSON.stringify(map)); } catch (_) {}
    }
    return map[key];
  }
  function offerEnd(q) { const end = issuedAt() + OFFER_DAYS * 86400000, server = q?.valid_until ? Date.parse(q.valid_until) : NaN; return Number.isFinite(server) ? Math.min(server, end) : end; }
  const fmtDate = t => new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));
  function expiry(q) { return fmtDate(offerEnd(q)); }
  // r96: the offer data of the approved result is prepared silently (same existing server checks: bank intent,
  // eligibility, entry-bound quote). Nothing is shown while preparing; if it is not available the window is
  // simply not shown and the customer's chosen action continues (no «جاري تجهيز…» / «ما قدرت…» in this window).
  let prep = null, inflight = null, gateIsExit = false;
  const PREP_TTL = 15 * 60000;
  function fetchOffer(i) {
    const r = rows()[i]; if (!active() || !r) return Promise.resolve(null);
    const id = session(), sig = snapshot(r);
    if (prep && prep.sig === sig && prep.id === id && prep.index === i && !prep.failed && (!prep.data || Date.now() - prep.at < PREP_TTL)) return prep.promise;
    const me = { sig, id, index: i, at: Date.now(), data: null, failed: false };
    me.promise = (async () => {
      try {
        const want = await bank().api.want({ finance_type: 'personal', bank_id: r.key });
        bank().assertIdentity(id);
        if (want?.ok !== true || !await allowed()) return null;
        const q = await quote(r), raw = await w.finoRpc('f99v25_public_completion_offers', {}, 20000);
        bank().assertIdentity(id);
        bank().requireBinding(q.bank_followup, { finance_type: 'personal', bank_id: r.key });
        if (q.bank_followup.intent_id !== want.bank_followup.intent_id || sig !== snapshot(rows()[i])) return null;
        const n = Number(q.new_price); if (!Number.isFinite(n) || n < 0) return null;
        me.data = { q, offer: raw?.data?.data?.packages?.[packageKey()] || {} }; me.at = Date.now(); return me.data;
      } catch (_) { return null; }
      finally { if (!me.data) me.failed = true; }
    })();
    prep = me; return me.promise;
  }
  const within = (p, ms) => Promise.race([p, new Promise(z => setTimeout(() => z(null), ms))]);
  // opts.then = the customer's chosen action, continued after the window is closed; opts.exit = exit path.
  async function invitation(i = selected(), opts = {}) {
    if (!active() || postponed.has(session())) return false;
    if (host?.isConnected || front?.isConnected) return true; // r96: one window only, never duplicated
    if (inflight) return inflight;
    if (!rows()[i]) i = 0; i = Number(i); if (!rows()[i]) return false;
    inflight = (async () => {
      try {
        const d = await within(fetchOffer(i), 8000);
        if (!d || !active() || postponed.has(session()) || host?.isConnected || !rows()[i]) return false;
        if (typeof opts.then === 'function') gateNext = opts.then;
        gateIsExit = opts.exit === true;
        render(rows()[i], d.q, d.offer, i, session()); responded.add(calcKey()); return true;
      } catch (_) { return false; }
    })();
    try { return await inflight; } finally { inflight = null; }
  }
  function others(h, i) {
    if (!h) return; const a = el('div', undefined, 'f49-actions'); h.append(a);
    rows().forEach((r, n) => { if (n !== Number(i)) button(a, T('pick_result', { entity: r.name, installment: fmt(r.installment) }), () => { busy = false; openCard(n); }); });
    button(a, T('postpone'), cancel);
  }
  // r24: closing the offer continues to the approved end of service (no automatic new offer).
  // r34 §3: «ليس الآن» continues the conversation; only the final exit sequence closes the offer for the session.
  function cancel() {
    const wasActive = active(); responded.add(calcKey()); clear(); bank()?.clearPreviews();
    if (typeof w.__F99R25FollowupDone === 'function') { if (session()) postponed.add(session()); gateNext = null; return w.__F99R25FollowupDone(); }
    const exit = gateIsExit; gateIsExit = false;
    if (wasActive && !exit && typeof w.portalAssistant === 'function') w.portalAssistant('<div class="portal-note">' + escH(T('continue', { client: who() })) + '</div>');
    const g = gateNext; gateNext = null; if (typeof g === 'function') return g();
  }
  function addText(parent, key, vars, tag = 'p', cls) { if (shown(key)) parent.append(el(tag, T(key, vars), cls)); }
  function congrats(offer) {
    const name = who().trim(); let head = T('congrats', { client: name }); if (!name) head = head.replace(/\s*يا\s*!/, '!').replace(/يا\s+،/, '');
    const lines = String(offer?.message || '').split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('⏳'));
    let lead = lines.join('\n').replace(/^(?:🎉)?\s*مبروك[^!،.]*[!،.]?\s*/u, '').trim();
    if (!lead) lead = T('congrats_lead');
    return [head, lead];
  }
  const legalText = t => String(t || '').split('\n').filter(x => !x.trim().startsWith('⏳')).join('\n').trim();
  function render(r, q, offer, index, id, prev) {
    const h = slot('f49-card f49-completion-request f39-fee'), current = Number(q.new_price), old = Number(q.old_price);
    if (!Number.isFinite(current) || current < 0) throw Error('FEE_INVALID');
    const discounted = q.discount_active === true && Number.isFinite(old) && old > current;
    pending = { index, key: r.key, quote: q, snapshot: snapshot(r), session: id, offer };
    displayed = pending.snapshot;
    // r96 layout: congratulation → struck «before» fee → big «after» fee → saving + approved % → 5 days → 2 buttons.
    const [head] = congrats(offer);
    h.classList.add('f96-fee'); h.setAttribute('aria-label', T('congrats_sub'));
    const hero = el('div', undefined, 'f39-hero'); h.append(hero);
    hero.append(el('div', head, 'f39-congrats'), el('p', T('congrats_sub'), 'f39-lead'));
    if (shown('entity')) hero.append(el('p', 'الجهة المرشحة: ' + r.name, 'f39-entity'));
    const box = el('div', undefined, 'f39-price'); hero.append(box);
    if (discounted && shown('previous')) { const was = el('div', undefined, 'f39-was'); was.append(el('small', T('before_label'), 'f96-cap'), el('s', fmt(old) + ' ريال', 'f96-old')); box.append(was); }
    box.append(el('small', discounted ? T('after_label') : 'أتعاب المتابعة', 'f39-label'), el('div', fmt(current) + ' ريال', 'f39-now'));
    if (discounted) {
      // r25: the saving shown is exactly the difference between the two approved prices.
      const saving = Math.round((old - current) * 100) / 100;
      if (q.discount_amount != null && Math.abs(Number(q.discount_amount) - saving) > 0.005) console.warn('FINO99 fee: discount_amount differs from price difference');
      const chips = el('div', undefined, 'f96-chips');
      if (shown('saving')) chips.append(el('span', T('saving', { amount: fmt(saving) }), 'f39-save'));
      if (shown('discount') && q.discount_percent != null && Number.isFinite(Number(q.discount_percent))) chips.append(el('span', T('discount', { percent: fmt(q.discount_percent) }), 'f96-pct'));
      if (chips.childNodes.length) box.append(chips);
    }
    const end = offerEnd(q), expired = Date.now() >= end, tm = el('div', undefined, 'f39-time'); h.append(tm);
    tm.append(el('b', '⏳ ' + T('offer_days', { days: OFFER_DAYS })), el('small', expired ? T('offer_expired') : T('offer_ends', { expiry: fmtDate(end) })));
    const actions = el('div', undefined, 'f39-actions'); h.append(actions);
    const yes = button(actions, T('consent'), send); yes.className = 'f39-yes'; yes.disabled = expired;
    // r96: «ليس الآن» closes the window only, then the chosen action continues (no request, no charge).
    const later = button(actions, T('postpone'), () => { if (later.dataset.f96Done) return; later.dataset.f96Done = '1'; cancel(); }); later.className = 'f39-later';
    const legal = el('div', undefined, 'f39-legal'); h.append(legal);
    const terms = legalText(offer?.terms || offer?.validTerms || offer?.disclaimer) || 'الحسبة مبدئية، والنتيجة النهائية وشروطها لدى الجهة التمويلية.';
    addText(legal, 'terms', { terms }, 'p');
    if (offer?.show_documents && offer.documents?.length) addText(legal, 'terms', { terms: offer.documents.join('\n') }, 'pre');
    addText(legal, 'service_note', {}, 'p', 'f34-service');
    try { h.scrollTop = 0; } catch (_) {}
  }
  // r34 §4: only the entities the calculator actually recommended; a new quote, no new calculation or charge.
  function pickOther(i) {
    if (!host) return; host.querySelector('[data-f34-others]')?.remove();
    const box = el('div', undefined, 'f34-others'); box.dataset.f34Others = '1'; box.append(el('p', T('other_pick')));
    const a = el('div', undefined, 'f49-actions'); box.append(a); host.append(box); const prev = pending?.quote;
    rows().forEach((r, n) => { if (n !== Number(i)) button(a, T('pick_result', { entity: r.name, installment: fmt(r.installment) }), () => { busy = false; openCard(n, prev); }); });
    a.querySelector('button')?.focus({ preventScroll: true });
  }
  // r96: opens the card only from prepared data; never a loading/failure card.
  async function openCard(i) {
    i = Number(i); if (!active() || !rows()[i]) return false;
    const d = await within(fetchOffer(i), 8000);
    if (!d || !active() || !rows()[i]) return false;
    busy = false; render(rows()[i], d.q, d.offer, i, session()); return true;
  }
  function message(r, q) {
    // Call the ORIGINAL full-detail builder only after the actual consent button.
    const original = w.F99V50DetailedText(r, q, expiry(q));
    const text = original.split('\n').map(line => {
      const part = messageParts.find(([, template, , prefix]) => prefix ? line.startsWith(prefix) : line === template);
      const [key, , , prefix] = part || ['extra', '', [], ''];
      if (T('wa_show_' + key) === '0') return '';
      return T('wa_' + key, { client: who(), value: prefix ? line.slice(prefix.length) : line }, line);
    }).filter(Boolean).join('\n');
    return T('final_message', { message: text }, text);
  }
  async function send() {
    const p = pending; if (!p || busy || !active()) return;
    busy = true; const generation = epoch, yesBtn = host?.querySelector('.f39-yes'); if (yesBtn) yesBtn.disabled = true;
    const r = rows()[p.index];
    try {
      bank().assertIdentity(p.session);
      if (!r || r.key !== p.key) throw Error('RESULT_CHANGED');
      await bank().api.verify(p.quote.bank_followup);
      if (!await allowed()) throw Error('FOLLOWUP_UNAVAILABLE');
      const q = await quote(r);
      const raw = await w.finoRpc('f99v25_public_completion_offers', {}, 20000);
      if (raw?.ok !== true || raw.data?.ok !== true) throw Error('OFFER_UNAVAILABLE');
      const offer = raw.data.data?.packages?.[packageKey()] || {};
      if (p !== pending || generation !== epoch) return; bank().assertIdentity(p.session);
      bank().requireBinding(q.bank_followup, { finance_type: 'personal', bank_id: r.key });
      if (q.bank_followup.intent_id !== p.quote.bank_followup.intent_id) throw Error('B17_STALE_BANK_INTENT');
      const approved = x => JSON.stringify([x.old_price, x.new_price, x.discount_amount, x.discount_percent, x.discount_active, x.valid_until, x.whatsapp]);
      if (p.snapshot !== snapshot(rows()[p.index]) || approved(q) !== approved(p.quote) || JSON.stringify(offer) !== JSON.stringify(p.offer)) {
        render(rows()[p.index], q, offer, p.index, p.session); status(T('changed')); return;
      }
      if (Date.now() >= offerEnd(q)) { status(T('offer_expired')); return; }
      if (!/^9665\d{8}$/.test(q.whatsapp) || (q.valid_until && Date.now() >= Date.parse(q.valid_until))) throw Error('QUOTE_INVALID');
      const msg = message(rows()[p.index], q);
      w.open('https://wa.me/' + q.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
      status(T('prepared')); const lt = host?.querySelector('.f39-later'); if (lt) lt.textContent = T('close');
    } catch (e) { if (generation === epoch) { if (bank().paused(e)) { pending = null; bank().showApology(host); others(host, p.index); } else status(T('send_retry')); } }
    finally { if (generation === epoch) { busy = false; const b = host?.querySelector('.f39-yes'); if (b && pending) b.disabled = Date.now() >= offerEnd(pending.quote); } }
  }
  const originalOwner = w.F99V41CompletionOwner;
  if (typeof originalOwner === 'function') w.F99V41CompletionOwner = async function (...args) {
    const result = await originalOwner.apply(this, args);
    const target = document.querySelector('#f41-owner .f41-owner-card');
    if (target && w.F99BotTextsPortal && !target.querySelector('[data-f22-texts]')) {
      const b = button(target, 'نصوص العرض وواتساب', () => w.F99BotTextsPortal && w.F99BotTextsPortal.open({ category: 'عروض المتابعة' })); b.dataset.f22Texts = '1';
    }
    return result;
  };
  // r34 §3/§8: automatic invitation under each eligible result (once per calculation), and before a new
  // calculation the due offer is shown first. Owner control: «توقيت ظهور الأتعاب» + show_completion + texts.
  const featureOn = () => w.F99V38FeatureAllowed?.('show_completion') === true;
  // r96: never shown automatically over a result (first, middle or last). After a result we only stamp the
  // issue time (5-day window) and prepare the offer data silently; the window appears on «حسبة جديدة» or exit.
  function autoInvite() {
    installGate(); if (!active() || !rows().length || !featureOn() || host?.isConnected || front?.isConnected) return;
    if (!chat()?.querySelector('.f25-menu')) return; const k = calcKey(); if (!k || invitedKey === k) return;
    invitedKey = k; issuedAt(); setTimeout(() => { if (calcKey() === k && active()) void fetchOffer(rows()[selected()] ? selected() : 0); }, 1400);
  }
  let gateWait = null;
  function installGate() {
    if (gateInstalled || typeof w.F99V82RequestNewCalculation !== 'function') return; gateInstalled = true;
    const original = w.F99V82RequestNewCalculation;
    w.F99V82RequestNewCalculation = function (...a) {
      const self = this, go = () => { calcSeq++; return original.apply(self, a); }, k = calcKey();
      if (gateWait) return gateWait; // r96: a repeated tap while the offer opens does not start twice
      if (!gateNext && active() && rows().length && featureOn() && k && !responded.has(k)) {
        gateNext = go;
        gateIsExit = false;
        gateWait = invitation(selected(), { front: true }).then(ok => { if (!ok && gateNext === go) { gateNext = null; return go(); } return ok; },
          () => { if (gateNext === go) { gateNext = null; return go(); } }).finally(() => { gateWait = null; });
        return gateWait;
      }
      return go();
    };
  }
  let tick = 0;
  new MutationObserver(() => { if (tick) return; tick = setTimeout(() => { tick = 0; autoInvite(); }, 300); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installGate, { once: true }); else setTimeout(installGate, 0);
  (function css() {
    const st = el('style'); st.id = 'f34-fee-front-css';
    st.textContent = '#f34FeeFront{position:fixed;top:0;right:0;bottom:0;left:0;z-index:99990;background:rgba(3,8,16,.62);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl}'
      + '#f34FeeFront>section{width:100%;max-width:460px;max-height:88vh;overflow:auto;-webkit-overflow-scrolling:touch;margin:0;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.45);padding:18px;outline:none}'
      + '#finoBotChat .f34-invite>b{display:block;white-space:pre-line;line-height:1.9}#finoBotChat .f34-invite{border:2px solid #d4af37}'
      + '.f99v18-spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;vertical-align:middle;margin-inline-end:6px;animation:f99v18spin .8s linear infinite}@keyframes f99v18spin{to{transform:rotate(360deg)}}'
      + '#f34FeeFront .f34-service{font-size:13px;color:#526c7f;margin:8px 0}#f34FeeFront .f34-others{margin-top:12px;border-top:1px solid #e3edf3;padding-top:10px}'
      + '#f34FeeFront>section.f39-fee{max-width:480px;padding:0;border-radius:22px;border:1px solid #e9d9a6;font-family:Cairo,Tajawal,system-ui,sans-serif;color:#10263d;text-align:center}'
      + '#f34FeeFront .f39-hero{background:linear-gradient(150deg,#0d2742 0%,#16466c 60%,#1d5a85 100%);color:#fff;padding:24px 18px 20px;border-radius:21px 21px 0 0;position:relative}'
      + '#f34FeeFront .f39-congrats{font-size:clamp(22px,6.4vw,28px);font-weight:900;line-height:1.5;color:#f6d77a;letter-spacing:0}'
      + '#f34FeeFront .f39-lead{margin:8px auto 0;max-width:400px;font-size:clamp(15px,4.2vw,17px);line-height:1.9;font-weight:700;color:#fff;white-space:pre-line}'
      + '#f34FeeFront .f39-entity{margin:10px auto 0;font-size:14px;color:#d6e6f5;font-weight:700}'
      + '#f34FeeFront .f39-price{margin:16px auto 0;background:rgba(255,255,255,.08);border:1px solid rgba(246,215,122,.55);border-radius:18px;padding:14px 12px;max-width:360px}'
      + '#f34FeeFront .f39-was{margin:0 0 4px;color:#c9d9ea;font-size:14px}#f34FeeFront .f39-was s{color:#ffb4b4;text-decoration-thickness:2px}'
      + '#f34FeeFront .f39-label{display:block;color:#d6e6f5;font-size:13px;font-weight:700}'
      + '#f34FeeFront .f39-now{font-size:clamp(32px,9.5vw,42px);font-weight:900;color:#fff;line-height:1.3;direction:rtl}'
      + '#f34FeeFront .f39-save{display:inline-block;margin-top:8px;background:#e8fff1;color:#06603a;border-radius:999px;padding:6px 14px;font-size:14px;font-weight:900}'
      + '#f34FeeFront .f39-time{margin:16px 16px 0;background:#fff8e3;border:1px solid #f0d78c;border-radius:14px;padding:11px 12px;display:flex;flex-direction:column;gap:3px}'
      + '#f34FeeFront .f39-time b{font-size:15px;color:#6b4b00;line-height:1.7}#f34FeeFront .f39-time small{font-size:13px;color:#7a5d12}'
      + '#f34FeeFront .f39-actions{display:flex;flex-direction:column;gap:9px;margin:16px 16px 0}'
      + '#f34FeeFront .f39-actions button{min-height:48px;border-radius:14px;font:800 15px Cairo,Tajawal,system-ui,sans-serif;cursor:pointer;width:100%}'
      + '#f34FeeFront .f39-yes{background:linear-gradient(135deg,#f3d37a,#d4a72c);color:#1d1400;border:0;font-size:18px!important;min-height:56px!important;box-shadow:0 8px 20px rgba(212,167,44,.35)}'
      + '#f34FeeFront .f39-yes:disabled{opacity:.55;box-shadow:none}#f34FeeFront .f39-alt{background:#fff;color:#16466c;border:1.5px solid #16466c}'
      + '#f34FeeFront .f39-later{background:#f3f6f9;color:#40576b;border:1px solid #dbe4ec}'
      + '#f34FeeFront .f39-legal{margin:16px 16px 0;padding:12px 2px 16px;border-top:1px solid #e7edf2;text-align:right}'
      + '#f34FeeFront .f39-legal p,#f34FeeFront .f39-legal pre{margin:4px 0;font-size:12.5px;line-height:1.85;color:#5b6b7f;white-space:pre-line;font-family:inherit}'
      + '#f34FeeFront .f39-fee [data-f22-status]{margin:0 16px 16px;font-size:13px;color:#16466c;font-weight:700}#f34FeeFront .f39-loading{padding:28px 16px 6px;font-weight:800;color:#16466c}'
      + '#f34FeeFront .f39-fee .f34-others{margin:12px 16px 0}#f34FeeFront .f39-fee .f49-actions{display:flex;flex-direction:column;gap:8px}'
      + '@media (max-width:440px){#f34FeeFront{padding:6px}#f34FeeFront>section.f39-fee{max-height:calc(100vh - 12px);max-height:calc(100dvh - 12px);border-radius:18px}#f34FeeFront .f39-hero{padding:12px 12px 10px;border-radius:17px 17px 0 0}#f34FeeFront .f39-congrats{font-size:20px;line-height:1.35}#f34FeeFront .f39-lead{margin-top:3px;font-size:14px;line-height:1.55}#f34FeeFront .f39-entity{margin-top:4px;font-size:13px;line-height:1.5}#f34FeeFront .f39-price{margin-top:8px;padding:7px 10px 8px;border-radius:14px}#f34FeeFront .f39-was{margin:0;font-size:13px;line-height:1.5}#f34FeeFront .f39-label{font-size:12.5px;line-height:1.5}#f34FeeFront .f39-now{font-size:30px;line-height:1.2}#f34FeeFront .f39-save{margin-top:5px;padding:3px 10px;font-size:13px;line-height:1.5}#f34FeeFront .f39-time{margin:8px 12px 0;padding:6px 10px;gap:0;border-radius:12px}#f34FeeFront .f39-time b{font-size:13.5px;line-height:1.5}#f34FeeFront .f39-time small{font-size:12px;line-height:1.5}#f34FeeFront .f39-actions{gap:6px;margin:8px 12px 0}#f34FeeFront .f39-actions button{min-height:44px;font-size:14.5px;border-radius:12px}#f34FeeFront .f39-yes{font-size:17px!important;min-height:48px!important}#f34FeeFront .f39-legal{margin:8px 12px 0;padding:6px 2px 8px}#f34FeeFront .f39-legal p,#f34FeeFront .f39-legal pre{margin:2px 0;font-size:12px;line-height:1.55}#f34FeeFront .f39-fee [data-f22-status]{margin:0 12px 10px}#f34FeeFront .f39-fee .f34-others{margin:8px 12px 0}}'; // r57: phone-only sizing of the fee card (no text/colour/order change)
    document.head.append(st);
    // r96: approved marketing layout of the fee window only (FINO99 navy/gold identity; no page redesign).
    const s96 = el('style'); s96.id = 'f96-fee-window-css';
    s96.textContent = '#f34FeeFront{z-index:2147483600;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));overflow:hidden;overscroll-behavior:contain}'
      + '#f34FeeFront>section.f96-fee{box-sizing:border-box;width:100%;max-width:420px;max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}'
      + '#f34FeeFront .f96-fee *{box-sizing:border-box;max-width:100%;overflow-wrap:anywhere}'
      + '#f34FeeFront .f96-fee .f39-hero{padding:18px 16px 16px}'
      + '#f34FeeFront .f96-fee .f39-congrats{font-size:clamp(20px,5.8vw,26px);line-height:1.4}'
      + '#f34FeeFront .f96-fee .f39-lead{margin:4px auto 0;font-size:clamp(15px,4.3vw,17px);line-height:1.6;color:#fff;font-weight:800}'
      + '#f34FeeFront .f96-fee .f39-entity{margin:4px auto 0;font-size:13px;line-height:1.5}'
      + '#f34FeeFront .f96-fee .f39-price{margin:12px auto 0;padding:12px 10px;max-width:340px}'
      + '#f34FeeFront .f96-fee .f39-was{display:flex;align-items:baseline;justify-content:center;gap:8px;flex-wrap:wrap;margin:0 0 4px}'
      + '#f34FeeFront .f96-cap{font-size:13px;color:#c9d9ea;font-weight:700}'
      + '#f34FeeFront .f96-fee s.f96-old{font-size:clamp(18px,5.2vw,22px);font-weight:800;color:#ffc9c9;text-decoration:line-through;text-decoration-color:#ff5c5c;text-decoration-thickness:3px;white-space:nowrap;overflow-wrap:normal}'
      + '#f34FeeFront .f96-fee .f39-label{font-size:13px;color:#f6d77a;font-weight:800}'
      + '#f34FeeFront .f96-fee .f39-now{font-size:clamp(34px,10.5vw,46px);color:#fff;white-space:nowrap;overflow-wrap:normal;line-height:1.2;text-shadow:0 2px 12px rgba(246,215,122,.3)}'
      + '#f34FeeFront .f96-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px}'
      + '#f34FeeFront .f96-chips .f39-save{margin:0;padding:5px 12px;font-size:14px;line-height:1.5}'
      + '#f34FeeFront .f96-pct{display:inline-block;background:#f6d77a;color:#3a2a00;border-radius:999px;padding:5px 12px;font-size:14px;font-weight:900;line-height:1.5}'
      + '#f34FeeFront .f96-fee .f39-time{margin:12px 14px 0;padding:9px 10px;gap:2px}'
      + '#f34FeeFront .f96-fee .f39-time b{font-size:14px;line-height:1.6}#f34FeeFront .f96-fee .f39-time small{font-size:12.5px;line-height:1.6}'
      + '#f34FeeFront .f96-fee .f39-actions{margin:12px 14px 0;gap:8px}'
      + '#f34FeeFront .f96-fee .f39-yes{min-height:54px!important;font-size:18px!important}'
      + '#f34FeeFront .f96-fee .f39-later{min-height:44px;background:transparent;border:1px solid #dbe4ec;color:#40576b}'
      + '#f34FeeFront .f96-fee [data-f22-status]{margin:8px 14px 0;font-size:13px;line-height:1.6;color:#06603a;font-weight:800;text-align:center}'
      + '#f34FeeFront .f96-fee .f39-legal{margin:10px 14px 0;padding:8px 2px 12px}'
      + '#f34FeeFront .f96-fee .f39-legal p,#f34FeeFront .f96-fee .f39-legal pre{font-size:11.5px;line-height:1.6;margin:2px 0}'
      + '@media (max-width:440px){#f34FeeFront>section.f96-fee{border-radius:18px}#f34FeeFront .f96-fee .f39-hero{padding:14px 12px 12px}#f34FeeFront .f96-fee .f39-price{margin-top:10px;padding:10px 8px}#f34FeeFront .f96-fee .f39-time{margin:10px 12px 0;padding:7px 9px}#f34FeeFront .f96-fee .f39-actions{margin:10px 12px 0;gap:7px}#f34FeeFront .f96-fee .f39-yes{min-height:50px!important;font-size:17px!important}#f34FeeFront .f96-fee .f39-legal{margin:8px 12px 0;padding:6px 2px 10px}#f34FeeFront .f96-fee [data-f22-status]{margin:8px 12px 0}}'
      + '@media (max-height:620px){#f34FeeFront .f96-fee .f39-hero{padding:10px 12px 10px}#f34FeeFront .f96-fee .f39-congrats{font-size:19px}#f34FeeFront .f96-fee .f39-now{font-size:32px}#f34FeeFront .f96-fee .f39-price{margin-top:8px;padding:8px}#f34FeeFront .f96-fee .f39-time{margin-top:8px}#f34FeeFront .f96-fee .f39-actions{margin-top:8px}#f34FeeFront .f96-fee .f39-yes{min-height:46px!important}#f34FeeFront .f96-fee .f39-later{min-height:40px}}';
    document.head.append(s96);
  })();
  // r34 §5 owner editor: «تسعيرة أتعاب المتابعة» inside each bank's settings. Server validates and resolves.
  const feeReason = { NOT_SET: 'لا توجد تسعيرة خاصة لهذا البنك؛ تُعتمد تسعيرة الأتعاب العامة للباقة.', DISABLED: 'التسعيرة الخاصة معطلة؛ تُعتمد تسعيرة الأتعاب العامة للباقة.',
    INCOMPLETE: 'التسعيرة الخاصة ناقصة (يلزم المبلغ الأساسي والمبلغ بعد الخصم)؛ لم تُعتمد، وتبقى التسعيرة العامة.', NOT_POSITIVE: 'المبالغ يجب أن تكون أكبر من صفر؛ لم تُعتمد، وتبقى التسعيرة العامة.',
    FINAL_ABOVE_BASE: 'المبلغ بعد الخصم أعلى من المبلغ الأساسي؛ لم تُعتمد، وتبقى التسعيرة العامة.', STALE_VERSION: 'تغيّرت التسعيرة من جلسة أخرى؛ أعد فتح إعدادات البنك ثم احفظ.',
    COMPLETION_OFFER_NOT_CONFIGURED_FOR_PACKAGE: 'لا يوجد عرض متابعة معتمد لهذه الباقة.', INVALID_ARGUMENT: 'قيمة غير صالحة (أرقام موجبة بحد أقصى منزلتين عشريتين).', NO_ADMIN_TOKEN: 'سجّل دخول المالك أولًا.' };
  const reasonText = c => { const k = String(c || '').replace(/^BANK_FEE_/, ''); return feeReason[k] || ('تعذر الحفظ: ' + (c || 'خطأ غير معروف')); };
  w.F99R34BankFeeEditor = function (box, bankId) {
    if (!box || !bankId || typeof w.finoCentralAdminCall !== 'function') return null;
    let alive = true, rev = 0; const sec = el('section', undefined, 'admin-field'); sec.dataset.r34Editor = '1'; box.append(sec);
    sec.append(el('h4', 'تسعيرة أتعاب المتابعة'), el('small', 'خاصة بهذا البنك داخل الباقة المختارة. إذا كانت معطلة أو فارغة أو غير صالحة تُعتمد تسعيرة الأتعاب العامة للباقة تلقائيًا.'));
    const field = (label, input) => { const l = el('label', label + ' '); l.style.display = 'block'; l.append(input); sec.append(l); return input; };
    const pkg = field('الباقة', el('select')), on = el('input'); on.type = 'checkbox';
    const onLab = el('label'); onLab.style.display = 'block'; onLab.append(on, el('span', ' تفعيل التسعيرة الخاصة لهذا البنك')); sec.append(onLab);
    const num = label => { const i = el('input'); i.type = 'number'; i.min = '0.01'; i.step = '0.01'; i.inputMode = 'decimal'; return field(label, i); };
    const base = num('مبلغ الأتعاب الأساسي (ريال)'), fin = num('مبلغ الأتعاب بعد الخصم (ريال)');
    const general = el('p'), info = el('p'); info.setAttribute('role', 'status'); const actions = el('div', undefined, 'f49-actions'); sec.append(general, actions, info);
    const saveBtn = button(actions, 'حفظ تسعيرة هذا البنك', save);
    if (w.F99BotTextsPortal) button(actions, 'نصوص العرض', () => w.F99BotTextsPortal.open({ category }));
    const value = i => { const t = String(i.value || '').trim(); return t === '' ? null : Number(t); };
    async function load() {
      if (!pkg.value) return; info.textContent = 'جاري القراءة من المركزية...';
      const r = await w.finoCentralAdminCall('f99r34_owner_bank_fee_read', { p_package_key: pkg.value, p_bank_id: bankId });
      if (!alive) return; if (!r?.ok || r.data?.ok !== true) { info.textContent = reasonText(r?.data?.reason || r?.reason); saveBtn.disabled = true; return; }
      const d = r.data; rev = Number(d.revision || 0); on.checked = d.enabled === true; base.value = d.base_amount ?? ''; fin.value = d.final_amount ?? ''; saveBtn.disabled = false;
      const g = d.general || {}; general.textContent = g.enabled ? 'التسعيرة العامة للباقة: ' + fmt(g.base_amount) + ' ريال، خصم ' + fmt(g.discount_percent) + '٪.' : 'التسعيرة العامة للباقة غير مفعّلة.';
      info.textContent = d.problem ? reasonText(d.problem) : 'التسعيرة الخاصة مفعّلة وتُعتمد لهذا البنك: ' + fmt(d.base_amount) + ' ريال ← ' + fmt(d.final_amount) + ' ريال.';
    }
    async function save() {
      const b = value(base), f = value(fin);
      if (on.checked) { if (b == null || f == null) { info.textContent = reasonText('INCOMPLETE'); return; } if (!(b > 0) || !(f > 0)) { info.textContent = reasonText('NOT_POSITIVE'); return; } if (f > b) { info.textContent = reasonText('FINAL_ABOVE_BASE'); return; } }
      saveBtn.disabled = true; info.textContent = 'جاري الحفظ في المركزية...';
      try {
        const r = await w.finoCentralAdminCall('f99r34_owner_bank_fee_save', { p_package_key: pkg.value, p_bank_id: bankId, p_base: b, p_final: f, p_enabled: on.checked, p_expected_revision: rev });
        if (!alive) return; if (!r?.ok || r.data?.ok !== true) { info.textContent = reasonText(r?.data?.reason || r?.reason); return; }
        await load(); if (alive) info.textContent = 'تم الحفظ والتحقق من المركزية. ' + info.textContent;
      } catch (_) { info.textContent = 'تعذر الحفظ الآن؛ لم يتغير شيء.'; } finally { if (alive) saveBtn.disabled = false; }
    }
    pkg.onchange = () => void load();
    (async () => {
      try {
        const raw = await w.finoRpc('f99v25_public_completion_offers', {}, 20000); if (!alive) return;
        const list = raw?.data?.data?.packages || {}; Object.keys(list).forEach(k => pkg.append(new Option(list[k]?.package_name || list[k]?.name || list[k]?.title || k, k)));
        if (!pkg.options.length) { info.textContent = reasonText('COMPLETION_OFFER_NOT_CONFIGURED_FOR_PACKAGE'); saveBtn.disabled = true; return; }
        const main = w.F99V32MainAccess?.()?.packageKey; if (main && list[main]) pkg.value = main; await load();
      } catch (_) { if (alive) info.textContent = 'تعذر قراءة الباقات من المركزية.'; }
    })();
    return { destroy() { alive = false; sec.remove(); } };
  };
  w.F99Followup22 = Object.freeze({ invitation, openCard, cancel });
  w.F99V82OpenOffer = () => invitation();
  w.F99V49CompletionOpen = () => invitation();
  w.F99V49CompletionSelect = i => openCard(Number(i));
  w.F99V41Pick = i => openCard(Number(i));
  w.F99V37StartCompletion = i => openCard(Number(i));
  w.F99V49CompletionSend = w.F99V37ConfirmCompletion = send;
  w.F99V49CompletionCancel = w.F99V37CancelCompletion = w.F99V41LeaveOrStay = cancel;
  w.F99V42RequestCompletion = () => invitation();
  // Never accept a prebuilt/stored message from older wrappers.
  w.F99V49SetCompletionText = () => false;
})(window);
