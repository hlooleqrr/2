/* FINO99 r38 — additive owner desk, aqari appointments board, contracts & payments portal, client contract gate, card polish.
   No calculator, ratio, price, package, code or inventory logic is touched. Old tools stay reachable under «النسخة السابقة». */
(function () {
  'use strict';
  const W = window, D = document;
  if (W.F99R38) return;
  /* ---------------- helpers ---------------- */
  const el = (t, c, x) => { const n = D.createElement(t); if (c) n.className = c; if (x != null) n.textContent = String(x); return n; };
  const btn = (h, label, fn, c) => { const b = el('button', 'f38-btn' + (c ? ' ' + c : ''), label); b.type = 'button'; b.onclick = fn; h.append(b); return b; };
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}) : '0'; };
  const RF = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {timeZone: 'Asia/Riyadh', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true});
  const DF = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {timeZone: 'Asia/Riyadh', weekday: 'long', month: '2-digit', day: '2-digit'});
  const TF = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: true});
  const when = v => { try { return v ? RF.format(new Date(v)) : '—'; } catch (_) { return String(v || '—'); } };
  const day = v => { try { return DF.format(new Date(String(v).length === 10 ? v + 'T12:00:00+03:00' : v)); } catch (_) { return String(v); } };
  const hm = v => { try { return TF.format(new Date(v)); } catch (_) { return String(v); } };
  const riyadhISO = (date, time) => date + 'T' + (time || '00:00') + ':00+03:00';
  const field = (host, label, value, o = {}) => {
    const w = el('label', 'f38-field' + (o.wide ? ' f38-wide' : '')); w.append(el('span', '', label));
    let i;
    if (o.area) { i = el('textarea'); i.rows = o.rows || 4; } else if (o.options) { i = el('select'); o.options.forEach(([v, t]) => { const op = el('option', '', t); op.value = v; i.append(op); }); }
    else { i = el('input'); i.type = o.type || 'text'; }
    if (o.type === 'checkbox') { i.checked = !!value; w.classList.add('f38-check'); w.prepend(i); } else { i.value = value == null ? '' : String(value); w.append(i); }
    if (o.ltr) i.dir = 'ltr'; if (o.ph) i.placeholder = o.ph; if (o.max) i.maxLength = o.max; host.append(w); return i;
  };
  const say = (host, t, c) => { const p = el('p', 'f38-note' + (c ? ' ' + c : ''), t); host.append(p); return p; };
  async function pub(fn, args) {
    if (typeof W.finoRpc !== 'function') return {ok: false, reason: 'RPC_UNAVAILABLE'};
    try { const r = await W.finoRpc(fn, args, 25000); return r?.data && typeof r.data === 'object' ? r.data : {ok: false, reason: r?.error?.message || 'RPC_UNAVAILABLE'}; }
    catch (e) { return {ok: false, reason: e?.message || 'RPC_UNAVAILABLE'}; }
  }
  async function adm(fn, args) {
    if (typeof W.finoCentralAdminCall !== 'function') return {ok: false, reason: 'NO_ADMIN'};
    try { const r = await W.finoCentralAdminCall(fn, args || {}); return r?.data && typeof r.data === 'object' ? r.data : {ok: false, reason: r?.reason || r?.error?.message || 'RPC_UNAVAILABLE'}; }
    catch (e) { return {ok: false, reason: e?.message || 'RPC_UNAVAILABLE'}; }
  }
  const REASONS = {
    ADMIN_UNAUTHORIZED: 'انتهت جلسة المالك. سجل الدخول مرة أخرى.', NO_ADMIN: 'سجّل دخول المالك أولًا.', SLOT_NOT_AVAILABLE: 'الوقت المختار لم يعد متاحًا. اختر وقتًا آخر.',
    SLOT_TAKEN: 'الوقت محجوز لعميل آخر.', BOOKING_NOT_MOVABLE: 'لا يمكن نقل هذا الموعد.', BOOKING_NOT_CANCELLABLE: 'لا يمكن إلغاء هذا الموعد.', INVALID_TIME: 'الوقت غير صالح.',
    CLOSURE_OVERLAPS_RESERVED_BOOKING: 'الفترة فيها موعد محجوز؛ انقل الموعد أو اعتذر عنه أولًا.', TPL_INVALID: 'النص قصير أو ينقصه {name}.',
    K_DRAFT_CONFLICT: 'تغيّرت المسودة من جلسة أخرى؛ أعد فتحها.', K_TITLE: 'اكتب عنوان العقد.', K_CLIENT_NAME: 'اكتب اسم العميل.', K_CLIENT_ID: 'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ1 أو 2.',
    K_CLIENT_PHONE: 'رقم الجوال غير صحيح.', K_OPEN_KEY: 'رمز الفتح غير صالح (4 إلى 80 حرفًا، ولا يبدأ بـ FK).', K_OPEN_KEY_IN_USE: 'رمز الفتح مستخدم في عقد نشط آخر.',
    K_PIN_FORMAT: 'الرقم السري من 4 إلى 8 أرقام.', K_PIN_REQUIRED_FOR_WEAK_KEY: 'الرقم السري الإضافي إلزامي لكل عقد حتى لا يُفتح بالتخمين.', K_OPEN_KEY_IS_PACKAGE: 'هذا الرمز مستخدم كود باقة؛ اختر رمزًا آخر.', K_OPEN_KIND: 'طريقة الفتح غير متاحة.',
    K_VALIDITY: 'مدة الصلاحية غير صالحة.', K_DEVICES: 'عدد الأجهزة من 1 إلى 5.', K_PAY_URL: 'رابط الدفع يجب أن يبدأ بـ https://', K_AMOUNT_INVALID: 'المبلغ غير صالح.',
    K_TEMPLATE_SINGLE_PARTY_ONLY: 'هذا القالب متعدد الأطراف؛ أنشئه من بوابة العقود الكاملة.', K_TEMPLATE_NOT_FOUND: 'اختر قالبًا.', K_IBAN: 'الآيبان يجب أن يبدأ بـ SA ويتكون من 24 خانة.',
    K_NOTE_REQUIRED: 'اكتب سبب الرفض.', K_PAYMENT_NOT_PENDING: 'الدفعة رُوجعت مسبقًا.', K_CODE_INVALID: 'الرمز غير صحيح.', K_TOO_MANY_ATTEMPTS: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول.',
    K_DEVICE_LIMIT: 'هذا العقد مرتبط بجهاز آخر. تواصل مع صاحب العقد لإعادة السماح.', K_CODE_EXPIRED: 'انتهت صلاحية الدخول لهذا العقد.', K_CODE_REVOKED: 'أُلغي رمز هذا العقد.',
    K_SESSION_INVALID: 'انتهت جلسة العقد. أدخل الرمز مرة أخرى.', K_PIN_INVALID: 'الرقم السري غير صحيح.', K_PIN_LOCKED: 'أُوقف الإدخال 30 دقيقة بسبب محاولات خاطئة.',
    K_GEO_CONSENT: 'يلزم الموافقة على مشاركة الموقع.', K_GEO_INVALID: 'تعذر قراءة الموقع.', K_SIGN_FIRST: 'وافق على العقد أولًا.', K_NOTHING_DUE: 'لا يوجد مبلغ مطلوب حاليًا.',
    K_PAYMENT_PENDING: 'يوجد إيصال تحت المراجعة.', K_PAY_DISABLED: 'طريقة الدفع غير مفعلة لهذا العقد.', K_RECEIPT_INVALID: 'الملف يجب أن يكون صورة JPG/PNG أو PDF.',
    K_RECEIPT_SIZE: 'حجم الإيصال يجب أن يكون بين 1 كيلوبايت و1.5 ميجابايت.', K_IDENTITY_MISMATCH: 'رقم الهوية لا يطابق الهوية المسجلة في العقد.', K_VERSION_CHANGED: 'صدرت نسخة جديدة من العقد؛ راجعها.'
  };
  const why = r => REASONS[r?.reason] || ('تعذر التنفيذ: ' + (r?.reason || 'خطأ غير معروف'));
  /* ---------------- sheet ---------------- */
  let ov = null;
  function sheet(title, wide) {
    if (!ov) { ov = el('div', 'f38-ov'); ov.id = 'f38-ov'; ov.dir = 'rtl'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); D.body.append(ov);
      D.addEventListener('keydown', e => { if (e.key === 'Escape' && ov && !ov.hidden) closeSheet(); }); }
    ov.hidden = false; ov.textContent = ''; ov.classList.toggle('f38-wide', !!wide); D.body.append(ov);
    const box = el('div', 'f38-sheet'), head = el('div', 'f38-head'); head.append(el('h2', '', title)); btn(head, 'إغلاق', closeSheet, 'f38-x');
    const body = el('div', 'f38-body'); box.append(head, body); ov.append(box); D.documentElement.classList.add('f38-lock'); return body;
  }
  function closeSheet() { if (ov) { ov.hidden = true; ov.textContent = ''; } D.documentElement.classList.remove('f38-lock', 'f38-noprint'); stopClientTimer(); }
  function tabs(host, list, active, onPick) {
    const bar = el('div', 'f38-tabs'); bar.setAttribute('role', 'tablist'); host.append(bar); const pane = el('div', 'f38-pane'); host.append(pane);
    const pick = k => { bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k))); pane.textContent = ''; onPick(k, pane); };
    list.forEach(([k, t, badge]) => { const b = btn(bar, t, () => pick(k), 'f38-tab'); b.dataset.k = k; b.setAttribute('role', 'tab'); if (badge) b.append(el('i', 'f38-badge', badge)); });
    pick(active || list[0][0]); return pick;
  }
  const waLink = (phone, text) => { let p = String(phone || '').replace(/[^\d+]/g, ''); if (/^05\d{8}$/.test(p)) p = '966' + p.slice(1); else if (/^5\d{8}$/.test(p)) p = '966' + p; p = p.replace(/^\+/, '').replace(/^00/, '');
    return 'https://wa.me/' + (/^\d{9,15}$/.test(p) ? p : '') + '?text=' + encodeURIComponent(text || ''); };
  function msgBox(host, text, phone) {
    const box = el('div', 'f38-msg'); box.append(el('pre', '', text)); const row = el('div', 'f38-row'); box.append(row);
    const a = el('a', 'f38-btn f38-wa', 'فتح واتساب العميل برسالة جاهزة'); a.href = waLink(phone, text); a.target = '_blank'; a.rel = 'noopener'; row.append(a);
    btn(row, 'نسخ الرسالة', async ev => { try { await navigator.clipboard.writeText(text); ev.target.textContent = 'تم النسخ'; } catch (_) { ev.target.textContent = 'انسخها يدويًا'; } });
    say(box, 'واتساب يفتح برسالة جاهزة من جوالك؛ الإرسال يتم منك يدويًا ولا يُرسل تلقائيًا. وسيظهر الإشعار للعميل أيضًا عند دخوله بكوده.', 'f38-muted');
    host.append(box); return box;
  }
  /* ================= OWNER DESK ================= */
  const OCATS = [['executive', 'مكتب المدير التنفيذي'], ['banks', 'البنوك والنسب'], ['fees', 'عروض الأتعاب'], ['human', 'الخدمات البشرية'], ['docs', 'العقود والمستندات السابقة'], ['extra', 'الخدمات الإضافية'], ['calculators', 'كل الحاسبات']];
  let homeTimer = 0, homeData = null;
  function desk() {
    const root = D.getElementById('f99od13-desktop'), hub = D.getElementById('ownerHub');
    if (!root || !hub || root.querySelector('.f38-home')) return;
    hub.classList.add('f38-new');
    const home = el('section', 'f38-home'); home.setAttribute('aria-label', 'لوحة المالك');
    const urgent = el('div', 'f38-urgent'); urgent.setAttribute('role', 'status'); urgent.append(el('b', '', 'التنبيهات'), el('span', 'f38-muted', 'جاري التحميل…')); home.append(urgent);
    const grid = el('div', 'f38-grid'); home.append(grid);
    const tile = (k, icon, title, sub, fn, cls) => { const b = el('button', 'f38-tile' + (cls ? ' ' + cls : '')); b.type = 'button'; b.dataset.k = k; b.onclick = fn;
      b.append(el('span', 'f38-ic', icon), el('b', '', title), el('small', '', sub)); grid.append(b); return b; };
    // r39 order (owner): alerts above, then appointments + contracts side by side, calculator, store packages, codes & settings, previous version.
    tile('appts', '🗓️', 'المواعيد', '«قبل تاخذ العقاري» وأي باقة مواعيد لاحقة', () => openAppts(), 'f38-main');
    tile('k', '📝', 'العقود والاتفاقات', 'عقود الأتعاب والعقود الحرة والسداد', () => openK(), 'f38-main');
    tile('buyout', '∑', 'حاسبة شراء المديونية', 'احسب تمويل عميلك مباشرة', () => { if (typeof W.ownerOpenBuyout === 'function') W.ownerOpenBuyout(); else openCat('calculators'); });
    tile('packages', '🛍️', 'باقات المتجر', 'كل الباقات: التشغيل والإيقاف والتعديل والأكواد', () => openPkgs());
    tile('settings', '⚙️', 'الأكواد والإعدادات', 'المخزون والصلاحيات والإعدادات الأساسية', () => openCats());
    tile('legacy', '🗂️', 'النسخة السابقة', 'واجهة الإدارة السابقة كاملة بكل خدماتها', () => legacy(true), 'f38-old');
    const back = btn(home, '↩ الرجوع للوحة الجديدة', () => legacy(false), 'f38-back'); back.hidden = true;
    const head = root.querySelector('.f99od13-head'); if (head) head.after(home); else root.prepend(home);
    loadHome(); clearInterval(homeTimer); homeTimer = setInterval(() => { if (!D.getElementById('f99od13-desktop')) { clearInterval(homeTimer); return; } if (D.visibilityState === 'visible') loadHome(); }, 60000);
  }
  function legacy(on, panel) {
    const hub = D.getElementById('ownerHub'); if (!hub) return; hub.classList.toggle('f38-legacy', !!on && !panel); hub.classList.toggle('f38-panel', !!panel);
    const home = D.querySelector('.f38-home'); if (home) { home.querySelector('.f38-grid').hidden = !!on; home.querySelector('.f38-urgent').hidden = !!on && !panel; home.querySelector('.f38-back').hidden = !on; }
    if (on && !panel) { const lg = D.querySelector('details.f99od13-legacy'); if (lg) lg.open = true; }
    if (!on) W.F99OwnerDesktop?.openCategory?.('');
    (home || hub).scrollIntoView({block: 'start', behavior: 'smooth'});
  }
  // Opens one original category (its original buttons and listeners) on its own, with a way back.
  function openCat(k) { closeSheet(); legacy(true, true); W.F99OwnerDesktop?.openCategory?.(k); setTimeout(() => D.getElementById('f99od13-panel')?.scrollIntoView({block: 'start', behavior: 'smooth'}), 60); }
  const CATS2 = [['packages', '🔑', 'الأكواد والمخزون والتجديد', 'إصدار الأكواد ومخزون كل باقة وتجديدها'], ['banks', '🏦', 'البنوك والنسب', 'المصدر الأساسي ومراجعة النسب'],
    ['fees', '٪', 'عروض الأتعاب', 'أتعاب المتابعة والخصومات ونصوصها'], ['human', '👥', 'الخدمات البشرية', 'الخدمات والحجوزات الأصلية'], ['docs', '§', 'العقود والمستندات السابقة', 'الأنظمة السابقة بقوالبها وأرشيفها'],
    ['executive', '◎', 'مكتب المدير التنفيذي', 'ملخص المنصة والأولويات'], ['calculators', '∑', 'كل الحاسبات', 'الشخصي وتحويل المديونية والعقاري'], ['extra', '▦', 'الإعدادات الإضافية', 'السياسات والمظهر والصوت والصلاحيات']];
  function openCats() {
    const body = sheet('الأكواد والإعدادات'); say(body, 'كل بند يفتح أدواته الأصلية كما هي، دون نسخ أو تغيير بياناتها.', 'f38-muted');
    const g = el('div', 'f38-list'); body.append(g);
    CATS2.forEach(([k, ic, t, sub]) => { const b = el('button', 'f38-row-btn'); b.type = 'button'; b.dataset.cat = k; b.append(el('span', 'f38-ic', ic), el('b', '', t), el('small', '', sub)); b.onclick = () => openCat(k); g.append(b); });
  }
  /* ================= STORE PACKAGES (r39) ================= */
  const PST = {available: ['متاحة للشراء', 'f39-av'], coming_soon: ['ستطلق قريبًا', 'f39-cs'], stopped: ['موقوفة (مخفية)', 'f39-st'], archived: ['محذوفة (مؤرشفة)', 'f39-ar']};
  const PREASON = {CONFIRM_NAME: 'اكتب اسم الباقة كما هو بالضبط لتأكيد الحذف.', PKG_HAS_BOOKINGS: 'لا يمكن حذف باقة لها مواعيد قادمة؛ أوقفها أولًا أو أنهِ الحجوزات.', PRODUCT_NOT_FOUND: 'الباقة غير موجودة في المتجر.', INVALID_STATE: 'حالة غير صحيحة.'};
  const pwhy = r => PREASON[r?.reason] || why(r);
  const ref = path => { let o = W; for (const k of String(path).split('.')) { o = o?.[k]; if (o == null) return null; } return typeof o === 'function' ? o : null; };
  const runExt = (path, ...args) => { const fn = ref(path); if (!fn) return false; closeSheet(); const ks = String(path).split('.'); const self = ks.slice(0, -1).reduce((o, k) => o?.[k], W) || W; try { void fn.apply(self, args); } catch (e) { console.warn(e); } return true; };
  const money = v => v == null || v === '' ? '' : Number(v).toLocaleString('en-US', {maximumFractionDigits: 2}) + ' ريال';
  async function openPkgs(notice) {
    const body = sheet('باقات المتجر', true); const wt = say(body, 'جاري التحميل…');
    const r = await adm('f99r39_owner_pkg', {p_action: 'list', p_data: {}}); wt.remove();
    if (!r.ok) { say(body, why(r), 'f38-err'); return; } if (notice) say(body, notice, 'f38-ok');
    say(body, 'اختر الباقة لإدارتها من داخلها: الحالة، التعديل، الأكواد والمخزون، التجديد، المعاينة، الحذف.', 'f38-muted');
    const real = r.items.filter(x => !x.fixture), live = real.filter(x => x.state !== 'archived'), arch = real.filter(x => x.state === 'archived');
    const list = el('div', 'f38-list'); body.append(list);
    const row = x => { const b = el('button', 'f38-row-btn f38-pkg'); b.type = 'button'; b.dataset.key = x.key; const st = PST[x.state] || [x.state, ''];
      b.append(el('b', '', x.name || x.key), el('small', '', [money(x.price), x.service ? 'باقة مواعيد' + (x.upcoming ? ' • ' + x.upcoming + ' موعد قادم' : '') : ''].filter(Boolean).join(' • ')), el('i', 'f39-pill ' + st[1], st[0]));
      b.onclick = () => openPkg(x.key); return b; };
    live.forEach(x => list.append(row(x))); if (!live.length) say(list, 'لا توجد باقات.', 'f38-muted');
    if (arch.length) { const d = el('details', 'f38-arch'); d.append(el('summary', '', 'الباقات المحذوفة (محفوظة في الأرشيف): ' + arch.length)); arch.forEach(x => d.append(row(x))); body.append(d); }
  }
  // r43: sale/renewal preparation for the package managed by f99r43_owner (other packages: nothing rendered).
  const R43W = {STORE_VERSION_CONFLICT: 'تغيّر المتجر من جهاز آخر؛ أعد فتح الباقة ثم احفظ.', INVALID_PRICE: 'سعر العرض غير صالح.', INVALID_OLD_PRICE: 'السعر الأصلي غير صالح.',
    OLD_PRICE_MUST_EXCEED_PRICE: 'السعر الأصلي يجب أن يكون أعلى من سعر العرض.', OLD_PRICE_REQUIRED_FOR_OFFER: 'أدخل السعر الأصلي لتفعيل التخفيض.', INVALID_OFFER_FLAG: 'خيار التخفيض غير صالح.',
    INVALID_BASE_URL: 'رابط الباقة الأساسية يجب أن يكون رابط سلة يبدأ بـ https://salla.sa/', INVALID_RENEWAL_URL: 'رابط التجديد يجب أن يكون رابط سلة يبدأ بـ https://salla.sa/',
    BASE_AND_RENEWAL_URL_MUST_DIFFER: 'رابط التجديد يجب أن يختلف عن رابط الباقة الأساسية.', INVALID_RENEWAL_PRICE: 'سعر التجديد غير صالح.', WARNING_TOO_LONG: 'التنويه أطول من 600 حرف.',
    CONFIRM_ACTUAL_SALLA_IMPORT_FIRST: 'أكّد أولًا أنك استوردت ملف أكواد التجديد في منتج التجديد بسلة.', RENEWAL_URL_AND_PRICE_REQUIRED: 'احفظ رابط التجديد وسعره أولًا.',
    RENEWAL_BIND_FAILED: 'تعذر ربط أكواد التجديد.', OFFER_ALLOCATION_POLICY_OR_SALLA_URL_MISMATCH: 'رابط التجديد أو سياسة الدفعة غير مطابقة.', NO_ACTIVE_CODES: 'لا توجد أكواد فعالة في الدفعة.'};
  const r43why = r => R43W[r?.reason] || why(r);
  function r43file(name, text) { const b = new Blob([text], {type: name.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'}); const a = el('a'); a.href = URL.createObjectURL(b); a.download = name; a.hidden = true; D.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  async function mountSale43(body, key, before) {
    const sec = el('div', 'f38-sec f43-sale'); sec.hidden = true; body.insertBefore(sec, before || null);
    const g = await adm('f99r43_owner', {p_action: 'get', p_data: {key}});
    if (!g.ok) { if (!['NOT_MANAGED', 'NOT_CONFIGURED', 'PACKAGE_NOT_FOUND'].includes(g.reason)) { sec.hidden = false; sec.append(el('h4', '', 'البيع والتجديد')); say(sec, r43why(g), 'f38-err'); } return; }
    render43(sec, key, g);
  }
  function render43(sec, key, g, notice) {
    sec.hidden = false; sec.textContent = ''; const p = g.product || {}, b = g.base || {}, rn = g.renewal || {};
    sec.append(el('h4', '', 'البيع والتجديد — الأسعار والروابط والتنويه'));
    say(sec, p.enabled === true ? 'حالة البيع: مفتوح للعملاء.' : 'حالة البيع: مغلق — لا يظهر للعميل سعر أو زر شراء حتى تفتح البيع بنفسك من «تعديل الباقة» بعد اعتماد الحاسبة.', p.enabled === true ? 'f38-ok' : 'f38-muted');
    const old = field(sec, 'السعر الأصلي (ريال) — يظهر مشطوبًا', p.old_price ?? '', {ltr: 1, max: 8});
    const price = field(sec, 'سعر العرض الحالي (ريال)', p.price ?? '', {ltr: 1, max: 8});
    const offer = field(sec, 'تفعيل التخفيض (إظهار السعر الأصلي مشطوبًا)', p.offer_enabled !== false, {type: 'checkbox'});
    const prev = say(sec, '', 'f43-prev');
    const upd = () => { const o = Number(old.value), n = Number(price.value); prev.textContent = 'يراه العميل عند فتح البيع: ' + (offer.checked && o > n ? money(o) + ' (مشطوب) ← ' : '') + (n > 0 ? money(n) : '—'); };
    [old, price].forEach(i => i.addEventListener('input', upd)); offer.addEventListener('change', upd); upd();
    const url = field(sec, 'رابط شراء الباقة الأساسية (سلة)', p.url || '', {ltr: 1, wide: 1, ph: 'https://salla.sa/…', max: 1000});
    const rurl = field(sec, 'رابط شراء باقة التجديد (سلة)', rn.url || '', {ltr: 1, wide: 1, ph: 'https://salla.sa/…', max: 1000});
    const rprice = field(sec, 'سعر التجديد (ريال) — تحدده أنت', rn.price ?? '', {ltr: 1, max: 8, ph: 'غير محدد'});
    const warn = field(sec, 'التنويه الظاهر في صفحة الباقة (قابل للتعديل أو الاستبدال)', p.warning_text || '', {area: 1, rows: 5, wide: 1, max: 600});
    say(sec, 'زر الشراء يتحول للرابط المحفوظ عند فتح البيع. لا يُصرف كود قبل تأكيد الدفع في سلة. باقي محتوى الصفحة (الاسم، الوصف التفصيلي — يمكن تركه فارغًا، الأسئلة، الشروط، الصورة) من «تعديل الباقة».', 'f38-muted');
    const st = el('p', notice ? 'f38-ok f43-st' : 'f38-muted f43-st', notice || ''); sec.append(st);
    btn(sec, 'حفظ الأسعار والروابط والتنويه', async ev => {
      ev.target.disabled = true; st.className = 'f38-muted f43-st'; st.textContent = 'جاري الحفظ والتحقق في المركزية…';
      const r = await adm('f99r43_owner', {p_action: 'save', p_data: {key, expected_version: g.store_version, price: price.value.trim(), old_price: old.value.trim(), offer_enabled: offer.checked,
        url: url.value.trim(), renewal_url: rurl.value.trim(), renewal_price: rprice.value.trim(), warning_text: warn.value.trim()}});
      ev.target.disabled = false;
      if (!r.ok) { st.className = 'f38-err f43-st'; st.textContent = r43why(r); return; }
      try { W.F99V33RefreshStorefront?.(); } catch (_) {}
      render43(sec, key, r, '✓ تم الحفظ في المركزية.');
    }, 'f43-save');
    const sk = el('div', 'f43-stock'); sec.append(sk); sk.append(el('h4', '', 'مخزون الأكواد (منفصل) — جاهز للاستيراد في سلة'));
    const stockRow = (title, s, file) => {
      const row = el('div', 'f43-srow'); row.dataset.kind = file;
      row.append(el('b', '', title), el('small', '', 'جاهز للبيع: ' + (s.ready ?? 0) + ' من ' + (s.total ?? 0) + (s.used ? ' • مستخدم: ' + s.used : '') + (s.exported_times ? ' • صُدّر ' + s.exported_times + ' مرة' : ' • لم يُصدّر بعد')));
      const bx = el('div', 'f43-btns'); row.append(bx); const es = el('small', 'f38-muted'); row.append(es);
      ['txt', 'csv'].forEach(fmt => btn(bx, 'تنزيل ' + fmt.toUpperCase(), async ev => {
        if (!s.allocation_id || !W.confirm('تنزيل ملف ' + title + ' (' + (s.total || 0) + ' كود) للاستيراد في سلة؟ يُسجَّل التصدير في المركزية، ولا يعني بيعًا.')) return;
        ev.target.disabled = true; es.textContent = 'جاري التحقق والتصدير…';
        const r = await adm('f99v17_admin_export_batch', {p_allocation_id: s.allocation_id}); ev.target.disabled = false;
        const codes = Array.isArray(r.codes) ? r.codes.map(String) : [];
        if (!r.ok || !codes.length || codes.length !== Number(r.count) || new Set(codes).size !== codes.length) { es.className = 'f38-err'; es.textContent = r.ok ? 'الملف غير مطابق للمركزية؛ لم يُنزّل.' : r43why(r); return; }
        const day = new Date().toISOString().slice(0, 10), name = 'FINO99_MORTGAGE_' + file + '_' + codes.length + '_' + day + '.' + fmt;
        r43file(name, fmt === 'csv' ? 'code\n' + codes.join('\n') + '\n' : codes.join('\n') + '\n');
        es.className = 'f38-ok'; es.textContent = '✓ ' + name + ' — ' + codes.length + ' كود فريد.';
      }, 'f43-exp'));
      sk.append(row);
    };
    stockRow('الأكواد الأساسية', b, 'BASE'); stockRow('أكواد التجديد', rn, 'RENEWAL');
    say(sk, 'كل دفعة 500 كود فريد، تبدأ صلاحية الكود من أول تفعيل فعلي، وتعمل على هذه الباقة وحدها. الأساسية لمنتج الباقة في سلة، والتجديد لمنتج التجديد فقط. عند نفاد أكواد منتج في سلة يتوقف بيعه هناك حتى تضيف مخزونًا.', 'f38-muted');
    const bd = el('div', 'f43-bind'); sec.append(bd); bd.append(el('h4', '', 'ربط أكواد التجديد بعرض التجديد'));
    if (rn.offer) say(bd, 'مربوط: سعر التجديد ' + money(rn.offer.price) + ' • ' + (rn.offer.visible ? 'ظاهر للعملاء' : 'مخفي عن العملاء') + '. الظهور والإيقاف من «التجديد».', 'f38-ok');
    else {
      say(bd, 'غير مربوط بعد. الخطوات: احفظ رابط التجديد وسعره ← نزّل ملف أكواد التجديد واستورده في منتج التجديد بسلة ← أكّد هنا. لا يُعتمد كود تجديد للعميل إلا بعد تأكيد الدفع.', 'f38-muted');
      const ck = field(bd, 'أؤكد أنني استوردت ملف أكواد التجديد في منتج التجديد بسلة', false, {type: 'checkbox'});
      const vis = field(bd, 'إظهار عرض التجديد للعملاء بعد الربط', false, {type: 'checkbox'});
      const bs = el('p', 'f38-muted'); bd.append(bs);
      btn(bd, 'ربط أكواد التجديد', async ev => {
        if (!ck.checked) { bs.className = 'f38-err'; bs.textContent = R43W.CONFIRM_ACTUAL_SALLA_IMPORT_FIRST; return; }
        ev.target.disabled = true; const r = await adm('f99r43_owner', {p_action: 'bind_renewal', p_data: {key, confirm_salla_import: true, visible: vis.checked}}); ev.target.disabled = false;
        if (!r.ok) { bs.className = 'f38-err'; bs.textContent = r43why(r); return; } render43(sec, key, r, '✓ تم ربط أكواد التجديد بعرض التجديد.');
      }, 'f43-bind-btn');
    }
    const cp = el('button', 'f38-row-btn f43-coupons'); cp.type = 'button';
    cp.append(el('span', 'f38-ic', '🎟️'), el('b', '', 'إدارة كوبونات الخصم'), el('small', '', ref('F99ServiceTools.openOwnerCoupons') ? 'إنشاء كوبون، نسبته أو مبلغه، تفعيله وإيقافه وصلاحيته — للباقة أو التجديد بشكل مستقل' : 'غير متاح في هذه الصفحة الآن'));
    cp.disabled = !ref('F99ServiceTools.openOwnerCoupons'); cp.onclick = () => runExt('F99ServiceTools.openOwnerCoupons'); sec.append(cp);
  }
  async function openPkg(key, notice) {
    const body = sheet('إدارة الباقة', true); const wt = say(body, 'جاري التحميل…');
    const r = await adm('f99r39_owner_pkg', {p_action: 'list', p_data: {}}); wt.remove();
    const x = r.ok ? r.items.find(i => i.key === key) : null; if (!x) { say(body, r.ok ? 'الباقة غير موجودة.' : why(r), 'f38-err'); return; }
    if (notice) say(body, notice, 'f38-ok');
    const st = PST[x.state] || [x.state, ''];
    const top = el('div', 'f38-pkg-head'); top.append(el('h3', '', x.name || x.key), el('i', 'f39-pill ' + st[1], st[0])); body.append(top);
    const info = el('div', 'f38-money'); [['السعر', money(x.price)], ['قبل الخصم', money(x.old_price)], ['عدد الحسبات', x.max_calculations ?? ''], ['الأسئلة', x.questions || '']].forEach(([a, v]) => { if (v === '' || v == null) return; const d = el('div'); d.append(el('small', '', a), el('b', '', String(v))); info.append(d); }); body.append(info);
    if (x.url) { const l = el('a', 'f38-muted', 'رابط الشراء: ' + x.url); l.href = x.url; l.target = '_blank'; l.rel = 'noopener'; body.append(l); }
    const sct = el('div', 'f38-sec'); sct.append(el('h4', '', 'حالة الظهور والبيع')); body.append(sct);
    if (x.state === 'archived') {
      say(sct, 'الباقة محذوفة من الواجهة ومحفوظة ببياناتها وأكوادها.', 'f38-muted');
      btn(sct, 'استرجاع الباقة (تعود موقوفة)', async ev => { ev.target.disabled = true; const q = await adm('f99r39_owner_pkg', {p_action: 'restore', p_data: {key}}); if (q.ok) openPkg(key, 'تم الاسترجاع. الباقة الآن موقوفة؛ فعّلها عند الحاجة.'); else { ev.target.disabled = false; say(sct, pwhy(q), 'f38-err'); } }, 'f38-primary');
    } else {
      const seg = el('div', 'f38-seg'); sct.append(seg);
      [['available', 'متاحة للشراء'], ['coming_soon', 'ستطلق قريبًا'], ['stopped', 'موقوفة']].forEach(([k, t]) => {
        const b = btn(seg, (x.state === k ? '✓ ' : '') + t, async ev => { if (x.state === k) return;
          if (!W.confirm('تغيير حالة «' + (x.name || key) + '» إلى «' + t + '»؟' + (x.service ? '\nالحجوزات القائمة وحقوق العملاء الحاليين لا تتأثر.' : ''))) return;
          seg.querySelectorAll('button').forEach(z => { z.disabled = true; }); const q = await adm('f99r39_owner_pkg', {p_action: 'state', p_data: {key, state: k}});
          if (q.ok) { try { W.F99V33RefreshStorefront?.(); W.F99Aqari35?.reload?.(); } catch (_) {} openPkg(key, 'تم: الباقة الآن «' + t + '».'); } else { seg.querySelectorAll('button').forEach(z => { z.disabled = false; }); say(sct, pwhy(q), 'f38-err'); } }, x.state === k ? 'f38-primary' : '');
        b.dataset.state = k; });
      say(sct, x.service ? 'الإيقاف أو «ستطلق قريبًا» يمنع الشراء الجديد فقط؛ الحجوزات القائمة وتعديلها والتعويض تبقى تعمل.' : '«ستطلق قريبًا» تُظهر الباقة دون شراء، و«موقوفة» تخفيها من المتجر. الأكواد المباعة تبقى صالحة.', 'f38-muted');
    }
    const lb = el('div', 'f38-sec'); lb.append(el('h4', '', 'نص زر الباقة')); body.append(lb);
    const lf = field(lb, 'نص زر الباقة', '', {max: 50, wide: 1}); lf.placeholder = 'اشتر الآن'; const lst = el('p', 'f38-muted'); lb.append(lst);
    say(lb, 'النص الظاهر للعميل على زر هذه الباقة في المتجر (الافتراضي «اشتر الآن»). يمكنك كتابة «تفاصيل الباقة» أو أي نص؛ لا يغيّر الرابط أو وظيفة الزر.', 'f38-muted');
    Promise.resolve(W.F99V70ButtonLabel?.(key)).then(v => { lf.value = (v && v.value) || 'اشتر الآن'; }).catch(() => { lf.value = 'اشتر الآن'; });
    btn(lb, 'حفظ نص الزر', async ev => { ev.target.disabled = true; try { const v = await W.F99V70SaveButtonLabel(key, lf.value); lf.value = v; lst.className = 'f38-ok'; lst.textContent = '✓ تم الحفظ: يظهر «' + v + '» على زر هذه الباقة فقط.'; } catch (e) { lst.className = 'f38-err'; lst.textContent = 'تعذر الحفظ: ' + ((e && e.message) || e); } finally { ev.target.disabled = false; } });
    const ed = el('div', 'f38-sec'); ed.append(el('h4', '', 'الإدارة من داخل الباقة')); body.append(ed); if (!x.service) void mountSale43(body, key, ed); const g = el('div', 'f38-list'); ed.append(g);
    const item = (ic, t, sub, path, ...args) => { const fn = ref(path); const b = el('button', 'f38-row-btn'); b.type = 'button'; b.dataset.act = path; b.append(el('span', 'f38-ic', ic), el('b', '', t), el('small', '', fn ? sub : 'غير متاح في هذه الصفحة الآن'));
      b.disabled = !fn; b.onclick = () => runExt(path, ...args); g.append(b); };
    if (x.service) {
      item('✏️', 'المحتوى والأسعار والروابط والكوبونات', 'الاسم والوصف والنصوص والأسئلة والشروط', 'F99Aqari35.openOwner', 'content');
      item('🗓️', 'الأيام والمواعيد', 'أوقات العمل ومدة الجلسة', 'F99Aqari35.openOwner', 'schedule');
      item('🔑', 'الأكواد والمخزون', 'دفعات الأكواد الأساسية والتجديد', 'F99Aqari35.openOwner', 'codes');
      item('📋', 'الحجوزات والتعويض', 'حجوزات العملاء وحالاتها', 'F99Aqari35.openOwner', 'bookings');
      item('👁️', 'معاينة العميل', 'بطاقة الباقة كما يراها العميل', 'F99Aqari35.openDetail');
    } else {
      item('✏️', 'تعديل الباقة', 'الاسم والوصف والنصوص والأسئلة والأسعار والروابط', 'F99SOpenOwner', key);
      item('🔑', 'الأكواد والمخزون', 'إصدار الأكواد ومراجعة المخزون', 'F99V17OpenInventory', key);
      item('🔄', 'التجديد', 'عرض التجديد وأكواده وسعره', 'FINO99V76.ownerPackage', key);
      item('👁️', 'معاينة العميل', 'المتجر كما يراه العميل', 'FINO99OpenStorefront');
    }
    if (x.state !== 'archived') {
      const dl = el('details', 'f38-sec f39-del'); dl.append(el('summary', '', '🗑️ حذف الباقة')); body.append(dl);
      say(dl, 'الحذف يخفي الباقة نهائيًا من المتجر ويحفظها في الأرشيف مع أكوادها وسجلاتها (لا تُحذف بيانات). الأكواد المباعة تبقى صالحة لأصحابها.' + (x.upcoming ? ' لا يمكن حذفها الآن لوجود ' + x.upcoming + ' موعد قادم.' : ''), 'f38-muted');
      const cf = field(dl, 'للتأكيد اكتب اسم الباقة: ' + (x.name || ''), '', {max: 200, wide: 1}); const st2 = el('p', 'f38-err'); dl.append(st2);
      btn(dl, 'حذف الباقة', async ev => { if (cf.value.trim() !== String(x.name || '').trim()) { st2.textContent = PREASON.CONFIRM_NAME; return; } if (!W.confirm('تأكيد حذف «' + x.name + '» من المتجر؟')) return;
        ev.target.disabled = true; const q = await adm('f99r39_owner_pkg', {p_action: 'archive', p_data: {key, confirm_name: cf.value.trim()}}); ev.target.disabled = false;
        if (q.ok) { try { W.F99V33RefreshStorefront?.(); } catch (_) {} openPkgs('تم حذف «' + x.name + '» من المتجر (محفوظة في الأرشيف).'); } else st2.textContent = pwhy(q); }, 'f39-del-btn');
    }
    btn(body, '↩ كل الباقات', () => openPkgs(), 'f38-back');
  }
  async function loadHome() {
    const box = D.querySelector('.f38-home .f38-urgent'); if (!box) return;
    const r = await adm('f99r38_owner_home', {}); homeData = r.ok ? r : null;
    box.textContent = ''; box.append(el('b', '', 'التنبيهات العاجلة'));
    if (!r.ok) { box.append(el('span', 'f38-muted', why(r))); return; }
    const a = r.appts, k = r.contracts, items = [
      [a.today, 'مواعيد اليوم', () => openAppts('today')], [a.needs_close, 'مواعيد انتهت وتحتاج إغلاق', () => openAppts('close')],
      [a.new24, 'حجوزات جديدة (24 ساعة)', () => openAppts('upcoming')], [a.changes24, 'تعديلات العملاء (24 ساعة)', () => openAppts('log')],
      [a.refunds, 'طلبات استرداد', () => W.F99Aqari35?.openOwner?.('bookings')], [k.owner_turn, 'عقود بانتظار إجرائك', () => openK('fee')],
      [k.receipts, 'إيصالات للمراجعة', () => openK('fee')], [k.unseen, 'ردود عملاء العقود غير المقروءة', () => W.F99KContracts?.openOwner?.()]];
    let any = false; const row = el('div', 'f38-chips'); box.append(row);
    items.forEach(([n, t, fn]) => { n = Number(n) || 0; if (n > 0) any = true; const c = btn(row, '', fn, 'f38-chip' + (n > 0 ? ' f38-hot' : '')); c.append(el('b', '', n), el('span', '', t)); });
    if (!any) box.append(el('span', 'f38-muted', 'لا توجد إجراءات عاجلة الآن.'));
    const g = D.querySelectorAll('.f38-tile[data-k="appts"] .f38-badge, .f38-tile[data-k="k"] .f38-badge'); g.forEach(x => x.remove());
    const put = (k2, n) => { if (n > 0) D.querySelector('.f38-tile[data-k="' + k2 + '"]')?.append(el('i', 'f38-badge', n)); };
    put('appts', (Number(a.today) || 0) + (Number(a.needs_close) || 0)); put('k', (Number(k.owner_turn) || 0) + (Number(k.receipts) || 0));
  }
  /* ================= APPOINTMENTS ================= */
  const ST = {pending: 'بانتظار التأكيد', confirmed: 'محجوز', completed: 'تمت الجلسة', no_show: 'لم يحضر', provider_failed: 'تعذر من جهتنا', cancelled: 'ملغى'};
  let AB = null;
  async function openAppts(tab) {
    const body = sheet('مواعيد «قبل تاخذ العقاري»', true); const wt = say(body, 'جاري التحميل…');
    const r = await adm('f99r38_owner_appts', {p_action: 'board', p_data: {}}); wt.remove();
    if (!r.ok) { say(body, why(r), 'f38-err'); return; } AB = r;
    const now = Date.parse(r.now), t0 = new Date(new Date(now).toLocaleString('en-US', {timeZone: 'Asia/Riyadh'})); t0.setHours(0, 0, 0, 0);
    const todayKey = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Riyadh'}).format(new Date(now));
    const dkey = v => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Riyadh'}).format(new Date(v));
    const B = r.bookings || [], live = b => ['pending', 'confirmed'].includes(b.status);
    const G = {
      upcoming: B.filter(b => live(b) && Date.parse(b.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      today: B.filter(b => b.status !== 'cancelled' && dkey(b.starts_at) === todayKey).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      close: B.filter(b => b.status === 'confirmed' && Date.parse(b.ends_at) <= now),
      ended: B.filter(b => ['completed', 'no_show', 'provider_failed'].includes(b.status)),
      cancelled: B.filter(b => b.status === 'cancelled'),
      moved: B.filter(b => b.status !== 'cancelled' && (Number(b.reschedule_count) > 0 || Number(b.owner_moves) > 0))
    };
    const free = (r.days || []).reduce((s, x) => s + (x.slots || []).length, 0);
    tabs(body, [['upcoming', 'المحجوزة', G.upcoming.length], ['today', 'اليوم', G.today.length], ['close', 'تحتاج إغلاق', G.close.length], ['moved', 'المؤجلة والمعدلة', G.moved.length],
      ['ended', 'المنتهية', G.ended.length], ['cancelled', 'الملغاة', G.cancelled.length], ['free', 'الأوقات المتاحة', free], ['log', 'سجل التعديلات'], ['msgs', 'رسائل الاعتذار'], ['content', 'محتوى الباقة']],
    tab || 'upcoming', (k, pane) => {
      if (G[k]) { if (!G[k].length) say(pane, 'لا توجد مواعيد في هذا القسم.', 'f38-muted'); G[k].forEach(b => pane.append(bookingCard(b, now))); return; }
      if (k === 'free') return freePane(pane, r); if (k === 'log') return logPane(pane, r); if (k === 'msgs') return msgPane(pane, r); if (k === 'content') return contentPane(pane);
    });
  }
  function bookingCard(b, now) {
    const c = el('article', 'f38-card f38-bk f38-st-' + b.status);
    const h = el('div', 'f38-card-h'); h.append(el('b', '', b.name || 'عميل'), el('span', 'f38-pill', ST[b.status] || b.status)); if (b.renew) h.append(el('span', 'f38-pill f38-pill2', 'تجديد')); c.append(h);
    const mins = Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000);
    c.append(el('p', 'f38-when', '📅 ' + when(b.starts_at) + ' • ' + mins + ' دقيقة'));
    const meta = el('p', 'f38-muted'); meta.textContent = '📱 ' + (b.phone || '—') + ' • الكود …' + (b.code_tail || '') + ' • حُجز ' + when(b.created_at)
      + (Number(b.reschedule_count) ? ' • عدّل العميل موعده ' + b.reschedule_count + ' مرة' : '') + (Number(b.owner_moves) ? ' • نقلته ' + b.owner_moves + ' مرة' : ''); c.append(meta);
    if (b.question) c.append(el('p', 'f38-q', '❓ ' + b.question)); if (b.owner_note) c.append(el('p', 'f38-muted', '🗒️ ' + b.owner_note));
    const act = el('div', 'f38-row'); c.append(act); const out = el('div'); c.append(out);
    if (b.status === 'confirmed' && Date.parse(b.starts_at) > now) {
      btn(act, 'تغيير الموعد', () => movePane(out, b), 'f38-primary');
      btn(act, 'اعتذار وإلغاء', () => apologyPane(out, b), 'f38-danger');
    }
    if (b.status === 'confirmed' && Date.parse(b.starts_at) <= now) {
      [['completed', 'تمت الجلسة'], ['no_show', 'لم يحضر'], ['provider_failed', 'تعذر من جهتنا']].forEach(([s, t]) => btn(act, t, async ev => {
        const note = s === 'completed' ? '' : (W.prompt('اكتب ملاحظة مختصرة (اختياري):', '') || '');
        if (!W.confirm('تأكيد: ' + t + '؟')) return; ev.target.disabled = true;
        const r = await adm('f99r35_owner', {p_action: 'booking_status', p_data: {booking_id: b.id, status: s, note}});
        if (r.ok) openAppts('close'); else { ev.target.disabled = false; out.textContent = ''; say(out, why(r), 'f38-err'); }
      }));
    }
    if (b.phone) { const a = el('a', 'f38-btn f38-wa', 'واتساب'); a.href = waLink(b.phone, 'يا ' + (b.name || '') + '، '); a.target = '_blank'; a.rel = 'noopener'; act.append(a); }
    return c;
  }
  function movePane(out, b) {
    out.textContent = ''; const box = el('div', 'f38-sub'); out.append(box); box.append(el('b', '', 'اختر اليوم ثم الوقت الجديد (بتوقيت الرياض)'));
    const days = el('div', 'f38-chips'); box.append(days); const slots = el('div', 'f38-chips'); box.append(slots);
    const comp = field(box, 'التعويض (اختياري، يظهر في الرسالة)', '', {ph: 'مثال: نصف مدة الجلسة زيادة مجانًا', max: 300, wide: 1}); const st = el('p', 'f38-note'); box.append(st);
    (AB?.days || []).forEach(dd => btn(days, day(dd.day), async ev => {
      days.querySelectorAll('button').forEach(x => x.classList.remove('f38-on')); ev.target.classList.add('f38-on'); slots.textContent = ''; st.textContent = 'جاري قراءة الأوقات…';
      const r = await adm('f99r38_owner_appts', {p_action: 'slots', p_data: {booking_id: b.id, day: dd.day}}); st.textContent = '';
      if (!r.ok) { st.textContent = why(r); return; } if (!r.slots.length) { st.textContent = 'لا توجد أوقات متاحة في هذا اليوم.'; return; }
      r.slots.forEach(s => btn(slots, hm(s), async e2 => {
        if (!W.confirm('نقل موعد ' + (b.name || '') + ' إلى ' + when(s) + '؟')) return; e2.target.disabled = true; st.textContent = 'جاري التثبيت…';
        const m = await adm('f99r38_owner_appts', {p_action: 'move', p_data: {booking_id: b.id, start: s, comp: comp.value}});
        if (!m.ok) { st.textContent = why(m); e2.target.disabled = false; return; }
        box.textContent = ''; box.append(el('b', 'f38-ok', '✅ تم تثبيت الموعد الجديد وتحرير القديم.')); msgBox(box, m.message, m.phone); AB = null;
        btn(box, 'تحديث اللوحة', () => openAppts('upcoming'));
      }, 'f38-slot'));
    }, 'f38-day'));
  }
  function apologyPane(out, b) {
    out.textContent = ''; const box = el('div', 'f38-sub'); out.append(box);
    box.append(el('b', '', 'اعتذار وإلغاء موعد ' + when(b.starts_at)));
    const comp = field(box, 'التعويض (اختياري)', '', {ph: 'مثال: موعد بديل مع نصف مدة إضافية', max: 300, wide: 1}); const st = el('p', 'f38-note'); box.append(st);
    say(box, 'الإلغاء من جهتك لا يُحتسب على العميل، ويعود له حق الحجز من جديد بكوده.', 'f38-muted');
    btn(box, 'تأكيد الاعتذار والإلغاء', async ev => {
      if (!W.confirm('سيُلغى الموعد ويُحفظ إشعار الاعتذار للعميل. متابعة؟')) return; ev.target.disabled = true;
      const m = await adm('f99r38_owner_appts', {p_action: 'apology', p_data: {booking_id: b.id, comp: comp.value}});
      if (!m.ok) { st.textContent = why(m); ev.target.disabled = false; return; }
      box.textContent = ''; box.append(el('b', 'f38-ok', '✅ أُلغي الموعد وحُفظ إشعار الاعتذار.')); msgBox(box, m.message, m.phone); btn(box, 'تحديث اللوحة', () => openAppts('cancelled'));
    }, 'f38-danger');
  }
  function freePane(pane, r) {
    say(pane, 'العميل يرى فقط هذه الأوقات. أيام وساعات العمل الأساسية تُعدّل من «أوقات العمل»، والإغلاق الفوري من النموذج أدناه.', 'f38-muted');
    const row = el('div', 'f38-row'); pane.append(row); btn(row, 'تعديل أيام وساعات العمل', () => W.F99Aqari35?.openOwner?.('schedule'), 'f38-primary');
    const f = el('div', 'f38-sub'); pane.append(f); f.append(el('b', '', 'إغلاق فترة فورًا'));
    const dd = field(f, 'التاريخ', new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Riyadh'}).format(new Date()), {type: 'date'});
    const a = field(f, 'من الساعة', '19:00', {type: 'time'}), z = field(f, 'إلى الساعة', '21:00', {type: 'time'}), rs = field(f, 'السبب (داخلي)', 'إغلاق من المالك', {max: 200});
    const st = el('p', 'f38-note'); f.append(st);
    btn(f, 'إغلاق الفترة', async ev => { ev.target.disabled = true; const x = await adm('f99r38_owner_appts', {p_action: 'close', p_data: {start: riyadhISO(dd.value, a.value), end: riyadhISO(dd.value, z.value), reason: rs.value}});
      ev.target.disabled = false; if (!x.ok) { st.textContent = why(x); return; } openAppts('free'); }, 'f38-danger');
    if ((r.closures || []).length) { const c = el('div', 'f38-sub'); pane.append(c); c.append(el('b', '', 'الفترات المغلقة'));
      r.closures.forEach(x => { const it = el('div', 'f38-line'); it.append(el('span', '', when(x.start) + ' ← ' + hm(x.end) + ' • ' + (x.reason || ''))); c.append(it);
        btn(it, 'إعادة فتح', async ev => { ev.target.disabled = true; const y = await adm('f99r38_owner_appts', {p_action: 'reopen', p_data: {closure_id: x.id}}); if (y.ok) openAppts('free'); else { ev.target.disabled = false; it.append(el('span', 'f38-err', why(y))); } }); }); }
    (r.days || []).forEach(x => { const c = el('div', 'f38-dayrow'); c.append(el('b', '', day(x.day) + ' — ' + (x.slots || []).length + ' وقت متاح'));
      const ch = el('div', 'f38-chips'); (x.slots || []).forEach(s => ch.append(el('span', 'f38-chip f38-free', hm(s)))); if (!(x.slots || []).length) ch.append(el('span', 'f38-muted', 'لا أوقات متاحة'));
      c.append(ch); pane.append(c); });
  }
  const ACT = {'f99o2_bookings:insert': 'حجز جديد', 'f99o2_bookings:update': 'تعديل', 'client:apologize': 'اعتذار العميل'};
  const ACTOR = {client: 'العميل', owner: 'المالك', system: 'النظام'};
  function logPane(pane, r) {
    const byB = {}; (r.bookings || []).forEach(b => { byB[b.id] = b; });
    const per = {}; (r.log || []).forEach(e => { const b = byB[e.booking_id]; if (!b) return; const k = b.client_ref || b.id; per[k] = per[k] || {name: b.name, phone: b.phone, n: 0, last: e.at};
      if (e.actor === 'client' && e.action !== 'f99o2_bookings:insert') per[k].n++; if (e.at > per[k].last) per[k].last = e.at; });
    const sum = el('div', 'f38-sub'); pane.append(sum); sum.append(el('b', '', 'عدد تعديلات كل عميل'));
    const list = Object.values(per).filter(x => x.n > 0).sort((a, b) => b.n - a.n); if (!list.length) say(sum, 'لا توجد تعديلات من العملاء.', 'f38-muted');
    list.forEach(x => sum.append(el('div', 'f38-line', (x.name || 'عميل') + ' • ' + (x.phone || '') + ' — ' + x.n + ' تعديل • آخر عملية ' + when(x.last))));
    const t = el('div', 'f38-sub'); pane.append(t); t.append(el('b', '', 'السجل الكامل (الأحدث أولًا)'));
    (r.log || []).forEach(e => { const b = byB[e.booking_id] || {}; let what = ACT[e.action] || e.action;
      if (e.old_start && e.new_start && e.old_start !== e.new_start) what = 'نقل الموعد من ' + when(e.old_start) + ' إلى ' + when(e.new_start);
      else if (e.old_status && e.new_status && e.old_status !== e.new_status) what = 'الحالة: ' + (ST[e.old_status] || e.old_status) + ' ← ' + (ST[e.new_status] || e.new_status);
      t.append(el('div', 'f38-line', when(e.at) + ' • ' + (ACTOR[e.actor] || e.actor || '') + ' • ' + (b.name || '') + ' — ' + what)); });
    say(pane, 'تنبيهات البريد الإلكتروني للحجوزات الجديدة غير مفعلة: تتطلب ربط مزود بريد رسمي بمفتاح خاص. التنبيهات الحالية تظهر أعلى لوحة المالك.', 'f38-muted');
  }
  function msgPane(pane, r) {
    const f = el('div', 'f38-sub'); pane.append(f); f.append(el('b', '', 'نصوص رسائل الاعتذار'));
    say(f, 'المتغيرات: {name} اسم العميل، {old} الموعد القديم، {new} الموعد الجديد، {comp} التعويض.', 'f38-muted');
    const mv = field(f, 'رسالة تغيير الموعد', r.tpl?.move, {area: 1, rows: 5, wide: 1}), ap = field(f, 'رسالة الاعتذار والإلغاء', r.tpl?.apology, {area: 1, rows: 5, wide: 1});
    const st = el('p', 'f38-note'); f.append(st);
    btn(f, 'حفظ النصوص', async ev => { ev.target.disabled = true; const x = await adm('f99r38_owner_appts', {p_action: 'save_tpl', p_data: {move: mv.value, apology: ap.value}}); ev.target.disabled = false; st.textContent = x.ok ? 'تم الحفظ.' : why(x); }, 'f38-primary');
    const l = el('div', 'f38-sub'); pane.append(l); l.append(el('b', '', 'الإشعارات المحفوظة للعملاء'));
    if (!(r.notices || []).length) say(l, 'لا توجد إشعارات.', 'f38-muted');
    (r.notices || []).forEach(n => { const it = el('div', 'f38-line'); it.append(el('span', '', when(n.at) + ' • ' + (n.kind === 'moved' ? 'تغيير موعد' : 'اعتذار') + ' • ' + (n.seen_at ? 'اطلع عليه العميل ' + when(n.seen_at) : 'لم يطلع عليه بعد'))); l.append(it); });
  }
  /* aqari content: structured editor with preview before publishing (saves through the existing r35 owner function). */
  async function contentPane(pane) {
    const wt = say(pane, 'جاري التحميل…'); const g = await adm('f99r35_owner', {p_action: 'get', p_data: {}}); wt.remove();
    if (!g.ok) { say(pane, why(g), 'f38-err'); return; }
    const c = JSON.parse(JSON.stringify(g.content || {})); const f = el('div', 'f38-sub'); pane.append(f);
    const row0 = el('div', 'f38-row'); f.append(row0); btn(row0, 'المحرر الكامل (الأسعار والروابط والكوبونات والتأكيد والتجديد)', () => W.F99Aqari35?.openOwner?.('content'));
    const F = {}; [['name', 'اسم الباقة'], ['tagline', 'المقدمة', 1], ['details_title', 'عنوان قسم الأسئلة'], ['closing', 'النص الختامي', 1], ['terms_title', 'عنوان صفحة الشروط'], ['consent', 'نص الإقرار', 1]]
      .forEach(([k, t, a]) => { F[k] = field(f, t, c[k], {area: a, rows: a ? 5 : 0, wide: 1}); });
    const list = (title, items, mk, read) => { const box = el('div', 'f38-sub'); f.append(box); box.append(el('b', '', title)); const host = el('div'); box.append(host);
      const draw = () => { host.textContent = ''; items.forEach((it, i) => { const r = el('div', 'f38-item'); host.append(r); mk(r, it, i);
        const ctl = el('div', 'f38-row'); r.append(ctl);
        btn(ctl, '▲', () => { read(); if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); } }); btn(ctl, '▼', () => { read(); if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); } });
        btn(ctl, 'حذف', () => { read(); if (items.length > 1 && W.confirm('حذف هذا البند؟')) { items.splice(i, 1); draw(); } }, 'f38-danger'); }); };
      draw(); return {draw, box}; };
    const topics = (c.topics || []).slice(), terms = (c.terms || []).map(t => ({q: t.q, a: t.a}));
    const TI = [], QI = [];
    const readT = () => { TI.forEach((i, n) => { if (i.isConnected) topics[n] = i.value; }); }; const readQ = () => { QI.forEach((p, n) => { if (p.q.isConnected) terms[n] = {q: p.q.value, a: p.a.value}; }); };
    const tl = list('الأسئلة الظاهرة في تفاصيل الباقة', topics, (r, it, i) => { TI[i] = field(r, 'سؤال ' + (i + 1), it, {wide: 1, max: 200}); }, readT);
    btn(tl.box, '+ إضافة سؤال', () => { readT(); if (topics.length < 20) { topics.push(''); TI.length = 0; tl.draw(); } });
    const ql = list('الشروط والأحكام (سؤال وجواب)', terms, (r, it, i) => { QI[i] = {q: field(r, 'السؤال ' + (i + 1), it.q, {wide: 1, max: 150}), a: field(r, 'الإجابة', it.a, {area: 1, rows: 3, wide: 1, max: 1200})}; }, readQ);
    btn(ql.box, '+ إضافة بند', () => { readQ(); if (terms.length < 20) { terms.push({q: '', a: ''}); QI.length = 0; ql.draw(); } });
    const pv = el('div', 'f38-preview'); const st = el('p', 'f38-note'); const act = el('div', 'f38-row'); f.append(act, st, pv);
    const collect = () => { readT(); readQ(); const n = Object.assign({}, c); Object.keys(F).forEach(k => { n[k] = F[k].value.trim(); });
      n.topics = topics.map(x => String(x || '').trim()).filter(Boolean); n.terms = terms.map(x => ({q: String(x.q || '').trim(), a: String(x.a || '').trim()})).filter(x => x.q || x.a); return n; };
    btn(act, 'معاينة كما يراها العميل', () => { const n = collect(); pv.textContent = ''; pv.append(el('small', 'f38-muted', 'معاينة — لم تُنشر بعد'), el('h3', '', n.name), el('p', 'f38-pre', n.tagline), el('h4', '', n.details_title));
      const ol = el('ol'); n.topics.forEach(t => ol.append(el('li', '', t))); pv.append(ol, el('p', '', n.closing), el('h4', '', n.terms_title));
      n.terms.forEach(t => { const d2 = el('details'); d2.append(el('summary', '', t.q), el('p', '', t.a)); pv.append(d2); }); pv.append(el('p', 'f38-muted', '☑️ ' + n.consent)); pv.scrollIntoView({block: 'start', behavior: 'smooth'}); });
    btn(act, 'نشر التعديلات', async ev => { const n = collect(); if (!W.confirm('نشر التعديلات للعملاء الآن؟')) return; ev.target.disabled = true; st.textContent = 'جاري النشر…';
      const r = await adm('f99r35_owner', {p_action: 'save_content', p_data: {expected_revision: c.revision, content: n}}); ev.target.disabled = false;
      if (r.ok) { st.textContent = 'تم النشر (نسخة ' + r.revision + ').'; c.revision = r.revision; try { W.F99Aqari35?.reload?.(); } catch (_) {} }
      else st.textContent = r.reason === 'VERSION_CONFLICT' ? 'تغيّر المحتوى من جلسة أخرى؛ أعد فتح التبويب.' : r.reason === 'INVALID_CONTENT' ? 'تحقق من الأطوال: السؤال 3–200 حرف، والشروط سؤال 2–150 وإجابة 5–1200، ومن 1 إلى 20 بندًا.' : why(r); }, 'f38-primary');
  }
  /* ================= CONTRACTS (owner) ================= */
  const FEE_KINDS = ['followup_plain', 'followup_deposit', 'deferred_sale'];
  const KST = {active: 'نشط', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغى'};
  const OPEN = [['custom', 'رمز خاص يحدده المالك (أرقام أو أحرف عربية أو إنجليزية)'], ['vault', 'كود العقد (FK)'], ['phone', 'جوال العميل'], ['id', 'هوية العميل'], ['package_code', 'كود باقة (لم يعد متاحًا)']];
  const TXT = {review: 'بعد رفع إيصال التحويل', salla_review: 'بعد بلاغ الدفع عبر سلة', approved_pay: 'بعد اعتماد الدفعة', rejected_pay: 'بعد رفض الدفعة', thanks: 'صفحة الشكر', approved: 'صفحة تم الاعتماد',
    done: 'صفحة تم الانتهاء', rejected: 'بعد رفض العقد', apology: 'رسالة الاعتذار والإغلاق', geo_consent: 'نص طلب مشاركة الموقع'};
  let KL = null;
  async function openK(tab) {
    const body = sheet('العقود والاتفاقات', true); const wt = say(body, 'جاري التحميل…'); const r = await adm('f99r38_owner_k', {p_action: 'list', p_data: {}}); wt.remove();
    if (!r.ok) { say(body, why(r), 'f38-err'); return; } KL = r;
    const fee = r.deals.filter(d => FEE_KINDS.includes(d.kind)), free = r.deals.filter(d => !FEE_KINDS.includes(d.kind));
    const badge = list => list.filter(d => d.owner_turn || d.receipts_review > 0).length || '';
    tabs(body, [['fee', 'عقود الأتعاب', badge(fee)], ['free', 'العقود الحرة والاتفاقات', badge(free)], ['drafts', 'المسودات', r.drafts.length || ''], ['settings', 'السداد والنصوص']].concat(W.F99R52K?.ownerTabs?.() || []), tab || 'fee', (k, pane) => {
      if (W.F99R52K?.ownerPane?.(k, pane, r)) return;
      if (k === 'settings') return kSettings(pane, r.settings);
      if (k === 'drafts') { if (!r.drafts.length) say(pane, 'لا توجد مسودات.', 'f38-muted');
        r.drafts.forEach(x => { const c = el('article', 'f38-card'); c.append(el('b', '', x.title), el('p', 'f38-muted', (x.client || '—') + ' • آخر حفظ ' + when(x.updated_at) + ' • مراجعة ' + x.revision));
          const row = el('div', 'f38-row'); c.append(row); btn(row, 'فتح وتعديل', () => editDraft(x.id), 'f38-primary');
          btn(row, 'أرشفة', async () => { if (!W.confirm('أرشفة المسودة؟ (تبقى محفوظة في المركزية)')) return; await adm('f99r38_owner_k', {p_action: 'draft_archive', p_data: {id: x.id}}); openK('drafts'); }); pane.append(c); }); return; }
      const grp = k === 'fee' ? FEE_KINDS : null; const row = el('div', 'f38-row'); pane.append(row);
      btn(row, '+ إنشاء عقد جديد / عقد حر', () => editDraft(null, k), 'f38-primary'); btn(row, 'بوابة العقود الكاملة (المراحل والأرشيف)', () => W.F99KContracts?.openOwner?.());
      if (k === 'fee') say(pane, 'عقد البيع بالأجل متعدد الأطراف يُنشأ من «بوابة العقود الكاملة».', 'f38-muted');
      const list = k === 'fee' ? fee : free; if (!list.length) say(pane, 'لا توجد عقود بعد.', 'f38-muted'); list.forEach(d => pane.append(dealCard(d)));
      void grp;
    });
  }
  function dealCard(d) {
    const c = el('article', 'f38-card f38-deal'); const h = el('div', 'f38-card-h'); h.append(el('b', '', d.title), el('span', 'f38-pill', KST[d.status] || d.status)); c.append(h);
    if (d.owner_turn) h.append(el('span', 'f38-pill f38-hotpill', 'بانتظار إجرائك')); if (d.receipts_review > 0) h.append(el('span', 'f38-pill f38-hotpill', 'إيصال للمراجعة'));
    c.append(el('p', 'f38-muted', 'رقم الاتفاق ' + d.ref + ' • النسخة ' + d.version + (d.stage_label ? ' • المرحلة: ' + d.stage_label : '') + ' • ' + when(d.created_at)));
    (d.parties || []).forEach(p => c.append(el('p', '', '👤 ' + (p.name || p.label) + ' • كود ' + p.code + ' • الأجهزة ' + p.devices + '/' + p.device_limit + (p.signed ? ' • ✅ وافق' : ' • لم يوافق بعد')
      + (p.expires_at ? ' • ينتهي الدخول ' + when(p.expires_at) : p.first_used_at ? '' : ' • الصلاحية تبدأ من أول دخول'))));
    if (d.r38) c.append(el('p', 'f38-muted', '🔐 الفتح: ' + (OPEN.find(x => x[0] === d.open_kind)?.[1] || d.open_kind) + (d.open_hint ? ' (' + d.open_hint + ')' : '') + (d.pin ? ' • رقم سري' : '') + (d.require_geo ? ' • الموقع مطلوب (' + d.geo_count + ')' : '') + (d.allow_pdf ? ' • PDF للعميل' : '')));
    if (d.money && Number(d.money.total) > 0) { const m = el('div', 'f38-money'); [['الإجمالي', d.money.total], ['المدفوع', d.money.paid], ['المتبقي', d.money.remaining]].forEach(([t, v]) => { const x = el('div'); x.append(el('small', '', t), el('b', '', num(v) + ' ريال')); m.append(x); }); c.append(m); }
    const row = el('div', 'f38-row'); c.append(row); const out = el('div'); c.append(out);
    if (d.r38) btn(row, 'السداد والإيصالات', () => payPane(out, d), d.receipts_review > 0 ? 'f38-primary' : '');
    if (d.r38 && d.require_geo) btn(row, 'المواقع المسجلة', () => geoPane(out, d));
    if (d.r38) btn(row, 'إلغاء ارتباط الأجهزة', async ev => { if (!W.confirm('سيُلغى ارتباط كل الأجهزة وتُغلق الجلسات، ويستطيع العميل الدخول من جديد. متابعة؟')) return; ev.target.disabled = true;
      const r = await adm('f99r38_owner_k', {p_action: 'reset_devices', p_data: {deal_id: d.id}}); ev.target.disabled = false; out.textContent = ''; say(out, r.ok ? 'تم إلغاء الارتباط.' : why(r), r.ok ? 'f38-ok' : 'f38-err'); });
    btn(row, 'نسخ كعقد جديد', async () => { const r = await adm('f99r38_owner_k', {p_action: 'copy', p_data: {deal_id: d.id}}); if (r.ok) editDraft(r.id); else { out.textContent = ''; say(out, why(r), 'f38-err'); } });
    btn(row, 'PDF للمالك', () => ownerPdf(d));
    btn(row, 'إدارة المراحل', () => W.F99KContracts?.openOwner?.());
    W.F99R52K?.dealButtons?.(row, d, out);
    return c;
  }
  async function ownerPdf(d) {
    await W.F99R52K?.ownerCtx?.(d); const r = await adm('f99k_owner_deal', {p_deal_id: d.id});
    const body = r?.deal?.body || r?.body || r?.versions?.[0]?.body || '';
    printDoc(d.title, d.ref + ' • النسخة ' + d.version, body || 'افتح «إدارة المراحل» لعرض نص العقد.', 'نسخة المالك • ' + d.ref);
  }
  async function payPane(out, d) {
    out.textContent = ''; const box = el('div', 'f38-sub'); out.append(box); const r = await adm('f99r38_owner_k', {p_action: 'payments', p_data: {deal_id: d.id}});
    if (!r.ok) { say(box, why(r), 'f38-err'); return; }
    box.append(el('b', '', 'المدفوع ' + num(r.money.paid) + ' من ' + num(r.money.total) + ' ريال • المطلوب الآن ' + num(r.money.due_now)));
    if (!r.items.length) say(box, 'لا توجد دفعات أو إيصالات.', 'f38-muted');
    r.items.forEach(p => { const it = el('div', 'f38-item'); box.append(it);
      it.append(el('p', '', (p.method === 'bank' ? '🏦 تحويل بنكي' : p.method === 'salla' ? '🛒 بلاغ دفع عبر سلة' : '✍️ تسجيل يدوي') + ' • ' + num(p.amount) + ' ريال • ' + when(p.at) + ' • '
        + (p.status === 'review' ? 'تحت المراجعة' : p.status === 'approved' ? 'معتمد ' + num(p.approved_amount) : 'مرفوض')));
      if (p.client_note) it.append(el('p', 'f38-muted', 'ملاحظة العميل: ' + p.client_note)); if (p.owner_note) it.append(el('p', 'f38-muted', 'ملاحظتك: ' + p.owner_note));
      const row = el('div', 'f38-row'); it.append(row);
      if (p.has_file) btn(row, 'عرض الإيصال', async () => { const x = await adm('f99r38_owner_k', {p_action: 'receipt', p_data: {payment_id: p.id}}); if (!x.ok) return;
        const bin = atob(x.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], {type: x.mime})); const a = el('a', 'f38-btn', 'فتح الإيصال'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; row.append(a);
        if (x.mime !== 'application/pdf') { const img = el('img', 'f38-receipt'); img.src = url; img.alt = 'إيصال التحويل'; it.append(img); } });
      if (p.status === 'review') {
        const amt = field(it, 'المبلغ المعتمد (ريال)', p.amount, {type: 'number'}), note = field(it, 'ملاحظة (إلزامية عند الرفض)', '', {max: 500});
        if (p.method === 'salla') say(it, 'تحقق من وصول المبلغ في لوحة سلة قبل الاعتماد؛ لا يوجد ربط آلي يؤكد الدفع.', 'f38-muted');
        const r2 = el('div', 'f38-row'); it.append(r2);
        btn(r2, 'اعتماد الدفعة', async ev => { if (!W.confirm('اعتماد ' + amt.value + ' ريال؟')) return; ev.target.disabled = true; const x = await adm('f99r38_owner_k', {p_action: 'review', p_data: {payment_id: p.id, decision: 'approve', amount: String(amt.value), note: note.value}}); if (x.ok) payPane(out, d); else { ev.target.disabled = false; it.append(el('p', 'f38-err', why(x))); } }, 'f38-primary');
        btn(r2, 'رفض', async ev => { ev.target.disabled = true; const x = await adm('f99r38_owner_k', {p_action: 'review', p_data: {payment_id: p.id, decision: 'reject', note: note.value}}); if (x.ok) payPane(out, d); else { ev.target.disabled = false; it.append(el('p', 'f38-err', why(x))); } }, 'f38-danger');
      } });
    const man = el('div', 'f38-item'); box.append(man); man.append(el('b', '', 'تسجيل دفعة مستلمة يدويًا'));
    const ma = field(man, 'المبلغ (ريال)', '', {type: 'number'}), mn = field(man, 'ملاحظة', '', {max: 500});
    btn(man, 'تسجيل واعتماد', async ev => { if (!W.confirm('تسجيل ' + ma.value + ' ريال كدفعة معتمدة؟')) return; ev.target.disabled = true; const x = await adm('f99r38_owner_k', {p_action: 'record_payment', p_data: {deal_id: d.id, amount: String(ma.value), note: mn.value}}); if (x.ok) payPane(out, d); else { ev.target.disabled = false; man.append(el('p', 'f38-err', why(x))); } });
  }
  async function geoPane(out, d) {
    out.textContent = ''; const box = el('div', 'f38-sub'); out.append(box); const r = await adm('f99r38_owner_k', {p_action: 'geo', p_data: {deal_id: d.id}}); if (!r.ok) { say(box, why(r), 'f38-err'); return; }
    if (!r.items.length) say(box, 'لم يشارك العميل موقعه بعد.', 'f38-muted');
    r.items.forEach(g => { const it = el('div', 'f38-line'); it.append(el('span', '', when(g.at) + ' • ' + [g.city, g.district].filter(Boolean).join(' / ') + ' • دقة ' + (g.accuracy_m ?? '—') + ' م • ' + g.lat + ', ' + g.lng));
      const a = el('a', 'f38-btn', 'الخريطة'); a.href = 'https://maps.google.com/?q=' + g.lat + ',' + g.lng; a.target = '_blank'; a.rel = 'noopener'; it.append(a); box.append(it); });
  }
  function kSettings(pane, s) {
    const f = el('div', 'f38-sub'); pane.append(f); f.append(el('b', '', 'بيانات الحساب البنكي المعتمد (تظهر للعميل عند التحويل)'));
    const bn = field(f, 'اسم البنك', s.bank.bank_name, {max: 120}), ho = field(f, 'اسم صاحب الحساب', s.bank.holder, {max: 120}), ib = field(f, 'الآيبان', s.bank.iban, {ltr: 1, max: 34});
    const t = el('div', 'f38-sub'); pane.append(t); t.append(el('b', '', 'نصوص حالات العقد والسداد'));
    const TI = {}; Object.keys(TXT).forEach(k => { TI[k] = field(t, TXT[k], s.texts[k], {area: 1, rows: 2, wide: 1, max: 1500}); });
    const st = el('p', 'f38-note'); pane.append(st);
    btn(pane, 'حفظ', async ev => { ev.target.disabled = true; const texts = {}; Object.keys(TI).forEach(k => { texts[k] = TI[k].value; });
      const r = await adm('f99r38_owner_k', {p_action: 'settings_save', p_data: {bank: {bank_name: bn.value, holder: ho.value, iban: ib.value}, texts}}); ev.target.disabled = false; st.textContent = r.ok ? 'تم الحفظ.' : why(r); }, 'f38-primary');
  }
  async function editDraft(id, group) {
    const body = sheet(id ? 'تعديل مسودة عقد' : 'عقد جديد', true); if (!KL) { const r = await adm('f99r38_owner_k', {p_action: 'list', p_data: {}}); if (!r.ok) { say(body, why(r), 'f38-err'); return; } KL = r; }
    let rev = null, data = {};
    if (id) { const r = await adm('f99r38_owner_k', {p_action: 'draft_get', p_data: {id}}); if (!r.ok) { say(body, why(r), 'f38-err'); return; } rev = r.revision; data = r.data || {}; }
    const tpls = KL.templates.filter(t => t.single && (group ? (group === 'fee') === FEE_KINDS.includes(t.kind) : true));
    const f = el('div', 'f38-form'); body.append(f);
    const tp = field(f, 'القالب', data.template_id || tpls[0]?.id, {options: tpls.map(t => [t.id, t.name]), wide: 1});
    if (data.template_id && !tpls.find(t => t.id === data.template_id)) { const t = KL.templates.find(x => x.id === data.template_id); if (t) { const o = el('option', '', t.name); o.value = t.id; tp.append(o); tp.value = t.id; } }
    const title = field(f, 'عنوان العقد', data.title || '', {wide: 1, max: 200});
    const sec = t => { const s = el('fieldset', 'f38-fs'); s.append(el('legend', '', t)); f.append(s); return s; };
    const cl = sec('بيانات العميل'), C = data.client || {};
    const cn = field(cl, 'الاسم', C.name, {max: 120}), cid = field(cl, 'رقم الهوية (للتحقق عند الموافقة)', C.id, {ltr: 1, max: 10}), cp = field(cl, 'الجوال', C.phone, {ltr: 1, max: 14}), cb = field(cl, 'تاريخ الميلاد (اختياري)', C.birth, {type: 'date'});
    const tm = sec('بنود القالب والمبالغ'); const TI = {}; const LBL = {fees: 'الأتعاب (ريال)', discount: 'الخصم (ريال)', deposit: 'العربون (ريال)', first_party: 'الطرف الأول', subject: 'موضوع الاتفاق', obligations: 'التزامات الطرفين', agreement_text: 'نص الاتفاق', payment_schedule: 'المبالغ ومواعيد الدفع'};
    const bodyF = field(f, 'نص العقد (يمكن تعديله بلا حد عملي؛ المتغيرات {{...}} تُملأ تلقائيًا)', data.body || '', {area: 1, rows: 14, wide: 1});
    const drawTerms = () => { const t = KL.templates.find(x => x.id === tp.value) || {}; const T0 = Object.assign({}, t.terms || {}, data.terms || {}); tm.querySelectorAll('label').forEach(x => x.remove());
      Object.keys(TI).forEach(k => delete TI[k]); Object.keys(T0).filter(k => !/^client_|^issue_date$/.test(k)).forEach(k => { const long = /text|obligations|subject|schedule/.test(k); TI[k] = field(tm, LBL[k] || k, T0[k], {area: long, rows: long ? 4 : 0, wide: long}); });
      if (!bodyF.value || bodyF.dataset.tpl === bodyF.value) { bodyF.value = t.body || ''; bodyF.dataset.tpl = bodyF.value; } };
    tp.onchange = () => { data.terms = {}; drawTerms(); }; drawTerms();
    const py = sec('السداد بعد الموافقة'), P = data.pay || {};
    const pa = field(py, 'المبلغ المطلوب بعد القبول (مثل عربون 500؛ فارغ = العربون أو الإجمالي)', P.amount, {type: 'number'});
    const ps = field(py, 'الدفع المباشر عبر رابط سلة/بوابة', P.salla, {type: 'checkbox'}), pu = field(py, 'رابط الدفع', P.salla_url, {ltr: 1, wide: 1, ph: 'https://salla.sa/...'});
    const pb = field(py, 'التحويل البنكي مع إرفاق إيصال', P.bank, {type: 'checkbox'});
    say(py, 'لا يوجد تحقق آلي من سلة: يظهر الدفع «تحت المراجعة» حتى تعتمده يدويًا بعد التأكد من وصول المبلغ.', 'f38-muted');
    const ac = sec('الدخول والحماية'), A = data.access || {};
    const ok2 = field(ac, 'طريقة فتح العقد', A.open_kind && A.open_kind !== 'package_code' ? A.open_kind : 'custom', {options: OPEN.filter(o => o[0] !== 'package_code')}), ky = field(ac, 'رمز فتح العقد (يُدخله العميل في خانة «أدخل الكود» نفسها؛ مطابقة كاملة)', A.open_key, {max: 80});
    const pin = field(ac, 'رقم سري إضافي (إلزامي، 4–8 أرقام) يُطلب بعد الرمز وقبل عرض أي بيانات', A.pin, {ltr: 1, max: 8});
    const vv = field(ac, 'مدة الصلاحية من أول دخول', A.valid_value || 3, {type: 'number'}), vu = field(ac, 'الوحدة', A.valid_unit || 'days', {options: [['minutes', 'دقائق'], ['hours', 'ساعات'], ['days', 'أيام']]});
    const dm = field(ac, 'الأجهزة المسموحة', A.device_mode || 'client', {options: [['client', 'جهاز العميل فقط'], ['client_owner', 'جهاز العميل وجهاز المالك'], ['custom', 'أجهزة مصرح بها (عدد)']]});
    const dl = field(ac, 'عدد الأجهزة (للخيار الأخير)', A.device_limit || 2, {type: 'number'});
    const FL = data.flags || {}; const geo = field(ac, 'طلب مشاركة الموقع بإذن العميل', FL.require_geo, {type: 'checkbox'}), pdf = field(ac, 'السماح للعميل بتنزيل/طباعة PDF', FL.allow_pdf, {type: 'checkbox'}), wm = field(ac, 'علامة مائية باسم العميل', FL.watermark !== false, {type: 'checkbox'});
    const po = sec('صفحة ما بعد انتهاء العقد'), PO = data.post || {};
    const pk = field(po, 'النوع', PO.kind || 'thanks', {options: [['thanks', 'شكر'], ['approved', 'تم الاعتماد'], ['done', 'تم الانتهاء'], ['custom', 'نص خاص']]}), pt = field(po, 'النص الخاص (اختياري)', PO.text, {area: 1, rows: 3, wide: 1, max: 2000});
    const R52E = W.F99R52K?.editor ? W.F99R52K.editor(f, sec, data, bodyF, tp, title) : null;
    const st = el('p', 'f38-note'); const act = el('div', 'f38-row f38-sticky'); const pv = el('div'); body.append(st, act, pv);
    const collect = () => { const terms = {}; Object.keys(TI).forEach(k => { terms[k] = TI[k].value; });
      return {template_id: tp.value, title: title.value.trim(), body: bodyF.value, terms, client: {name: cn.value.trim(), id: cid.value.trim(), phone: cp.value.trim(), birth: cb.value},
        pay: {amount: pa.value ? String(pa.value) : '', salla: ps.checked, salla_url: pu.value.trim(), bank: pb.checked},
        access: {open_kind: ok2.value, open_key: ky.value.trim(), pin: pin.value.trim(), valid_value: Number(vv.value), valid_unit: vu.value, device_mode: dm.value, device_limit: Number(dl.value)},
        flags: {require_geo: geo.checked, allow_pdf: pdf.checked, watermark: wm.checked}, post: {kind: pk.value, text: pt.value}, r52: R52E ? R52E.collect() : (data.r52 || {})}; };
    const save = async () => { const r = await adm('f99r38_owner_k', {p_action: 'draft_save', p_data: {id, revision: rev, data: collect()}}); if (r.ok) { id = r.id; rev = r.revision; } return r; };
    btn(act, 'حفظ كمسودة', async ev => { ev.target.disabled = true; const r = await save(); ev.target.disabled = false; st.textContent = r.ok ? 'حُفظت المسودة (غير منشورة).' : why(r); }, '');
    btn(act, 'معاينة الصفحات', () => { const x = collect(); let t = x.body; const vals = Object.assign({}, x.terms, {client_name: x.client.name, client_id_masked: x.client.id ? x.client.id.slice(0, 2) + '******' + x.client.id.slice(-2) : '', issue_date: new Date().toLocaleDateString('en-CA')});
      t = t.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) => vals[k] != null && vals[k] !== '' ? vals[k] : '…'); pv.textContent = ''; W.F99R52K?.previewCtx?.(pv, x); pages(pv, x.title, t, false); pv.scrollIntoView({block: 'start', behavior: 'smooth'}); });
    btn(act, 'اعتماد ونشر', async ev => { if (!W.confirm('بعد الاعتماد يُنشر العقد ويُصدر كوده، ولا تتغير النسخة الموافق عليها إلا بإصدار جديد. متابعة؟')) return; ev.target.disabled = true; st.textContent = 'جاري الحفظ والنشر…';
      const s = await save(); if (!s.ok) { ev.target.disabled = false; st.textContent = why(s); return; }
      const r = await adm('f99r38_owner_k', {p_action: 'publish', p_data: {id}}); ev.target.disabled = false; if (!r.ok) { st.textContent = why(r); return; }
      published(body, r, collect()); }, 'f38-primary');
    R52E?.acts?.(act, collect, st);
  }
  function published(body, r, x) {
    body.textContent = ''; const c = el('div', 'f38-card f38-pub'); body.append(c); c.append(el('h3', '', '✅ تم اعتماد العقد ونشره'));
    const link = location.origin + '/#contract';
    [['رقم الاتفاق', r.ref], ['كود العقد', r.code], ['طريقة الفتح', OPEN.find(o => o[0] === r.open_kind)?.[1]], ['رمز الفتح', r.open_key || r.code], ['الرقم السري', r.pin || 'لا يوجد'],
      ['الصلاحية من أول دخول', r.valid_minutes >= 1440 && r.valid_minutes % 1440 === 0 ? r.valid_minutes / 1440 + ' يوم' : r.valid_minutes >= 60 && r.valid_minutes % 60 === 0 ? r.valid_minutes / 60 + ' ساعة' : r.valid_minutes + ' دقيقة'],
      ['الأجهزة', r.device_limit], ['رابط الدخول', link]].forEach(([k, v]) => { const p = el('p'); p.append(el('small', '', k + ': '), el('b', '', v)); c.append(p); });
    say(c, 'الرقم السري يظهر هنا مرة واحدة فقط ولا يُحفظ نصًا في المركزية؛ أرسله للعميل في رسالة مستقلة.', 'f38-warn');
    const msg = 'يا ' + x.client.name + '، تم إصدار ' + x.title + ' (رقم ' + r.ref + ').\nللاطلاع والموافقة: ' + link + '\nرمز الفتح: ' + (r.open_kind === 'vault' ? r.code : r.open_kind === 'phone' ? 'رقم جوالك' : r.open_kind === 'id' ? 'رقم هويتك' : r.open_key) + '\n— FINO99';
    msgBox(c, msg, x.client.phone); btn(c, 'العودة للعقود', () => openK());
  }
  /* ---------------- paged document + print ---------------- */
  function pages(host, title, text, protect, wm) {
    const paras = String(text || '').split(/\n{2,}/); const P = []; let cur = '';
    paras.forEach(p => { if ((cur + p).length > 1700 && cur) { P.push(cur); cur = ''; } cur += (cur ? '\n\n' : '') + p; }); if (cur || !P.length) P.push(cur); if (W.F99R52K?.split) P.splice(0, P.length, ...W.F99R52K.split(text));
    const box = el('div', 'f38-doc' + (protect ? ' f38-protect' : '')); host.append(box); const pg = el('div', 'f38-page'); const nav = el('div', 'f38-row f38-pnav'); box.append(pg, nav); W.F99R52K?.decorate?.(box, pg);
    if (wm) { pg.dataset.wm = wm; pg.classList.add('f38-wm'); }
    let i = 0; const state = {last: P.length === 1, onLast: null};
    const draw = () => { pg.textContent = ''; if (i === 0) pg.append(el('h3', '', title)); if (W.F99R52K?.render) pg.append(W.F99R52K.render(P[i], i, P.length)); else pg.append(el('div', 'f38-pre', P[i])); info.textContent = 'صفحة ' + (i + 1) + ' من ' + P.length; prev.disabled = i === 0; next.disabled = i === P.length - 1;
      if (i === P.length - 1 && !state.last) { state.last = true; state.onLast?.(); } };
    const prev = btn(nav, 'السابقة', () => { i--; draw(); }), info = el('span', 'f38-muted'), next = btn(nav, 'التالية', () => { i++; draw(); box.scrollIntoView({block: 'start'}); }, 'f38-primary'); nav.insertBefore(info, next);
    if (protect) { box.addEventListener('contextmenu', e => e.preventDefault()); box.addEventListener('copy', e => e.preventDefault()); }
    draw(); return state;
  }
  function printDoc(title, sub, text, wm) {
    if (W.F99R52K?.print) { W.F99R52K.print(title, sub, text, wm); return; } const wdw = W.open('', '_blank'); if (!wdw) { W.alert('اسمح بالنوافذ المنبثقة لفتح PDF.'); return; }
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
    wdw.document.write('<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:15px/2 Tahoma,Arial,sans-serif;margin:24mm 18mm;color:#111}h1{font-size:20px;margin:0 0 4px}small{color:#555}pre{white-space:pre-wrap;font:inherit}'
      + '.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:42px;color:rgba(0,0,0,.07);transform:rotate(-28deg);pointer-events:none;z-index:9}@page{size:A4;margin:16mm}</style>'
      + '<div class="wm">' + esc(wm) + '</div><h1>' + esc(title) + '</h1><small>' + esc(sub) + '</small><pre>' + esc(text) + '</pre></html>');
    wdw.document.close(); setTimeout(() => { try { wdw.focus(); wdw.print(); } catch (_) {} }, 350);
  }
  /* ================= CONTRACT GATE (client) ================= */
  const KDEV = () => { try { const d = W.finoCentralDeviceId?.(); if (d && /^[A-Za-z0-9_.:-]{8,128}$/.test(d)) return d; } catch (_) {}
    let d = null; try { d = localStorage.getItem('F99K_DEVICE'); } catch (_) {} if (!d) { d = 'k-' + (crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2))); try { localStorage.setItem('F99K_DEVICE', d); } catch (_) {} } return d; };
  const SKEY = 'F99R38_PARTY';
  let clientTimer = 0; function stopClientTimer() { clearInterval(clientTimer); clientTimer = 0; }
  function openEntry(prefill, err) {
    const body = sheet('دخول العقود والاتفاقات'); const f = el('div', 'f38-form'); body.append(f);
    say(f, 'أدخل رمز فتح العقد الذي وصلك كما هو تمامًا.', 'f38-muted');
    const k = field(f, 'رمز فتح العقد', prefill || '', {wide: 1, max: 120}); k.autocomplete = 'off'; const st = el('p', 'f38-err'); f.append(st); if (err) st.textContent = err;
    const go = async ev => { const v = k.value.trim(); if (!v) return; ev.target.disabled = true; st.textContent = '';
      const r = await pub('f99r38_party_enter', {p_key: v, p_device_id: KDEV()}); ev.target.disabled = false;
      if (!r.ok) { st.textContent = (r.msg && r.msg.t) || why(r); return; } try { sessionStorage.setItem(SKEY, r.session); } catch (_) {} openParty(r.session); };
    btn(f, 'دخول', go, 'f38-primary'); k.addEventListener('keydown', e => { if (e.key === 'Enter') go({target: e.target}); });
    setTimeout(() => { try { k.focus(); } catch (_) {} }, 50);
  }
  async function openParty(session, notice) {
    const body = sheet('العقد'); const wt = say(body, 'جاري التحميل…'); const call = (a, d) => pub('f99r38_party', {p_session: session, p_device_id: KDEV(), p_action: a, p_data: d || {}});
    const v = await call('view'); wt.remove(); if (notice) say(body, notice, 'f38-ok');
    if (v.reason === 'K_PIN_REQUIRED') { body.append(el('h3', '', 'تحقق إضافي'), el('p', 'f38-muted', 'أدخل الرقم السري الذي وصلك مع رمز العقد. لن تظهر أي بيانات قبل التحقق.'));
      const p = field(body, 'الرقم السري الإضافي', '', {ltr: 1, max: 8, type: 'password'}); p.inputMode = 'numeric'; const st = el('p', 'f38-err'); body.append(st);
      btn(body, 'تحقق', async ev => { ev.target.disabled = true; const r = await call('pin', {pin: p.value.trim()}); ev.target.disabled = false;
        if (r.ok) openParty(session); else st.textContent = why(r) + (r.left ? ' (متبقي ' + r.left + ' محاولات)' : ''); }, 'f38-primary'); return; }
    if (v.reason === 'K_GEO_REQUIRED') { const g = v.gate || {}; body.append(el('h3', '', 'تحقق إضافي'), el('p', '', g.geo_consent || ''));
      const ok = field(body, 'أوافق على مشاركة موقعي الحالي لهذا الغرض', false, {type: 'checkbox'}); const city = field(body, 'المدينة (اختياري)', '', {max: 80}), dist = field(body, 'الحي (اختياري)', '', {max: 80});
      const st = el('p', 'f38-err'); body.append(st);
      btn(body, 'مشاركة موقعي', ev => { if (!ok.checked) { st.textContent = REASONS.K_GEO_CONSENT; return; } if (!navigator.geolocation) { st.textContent = 'جهازك لا يدعم تحديد الموقع.'; return; } ev.target.disabled = true; st.textContent = 'جاري قراءة الموقع من جهازك…';
        navigator.geolocation.getCurrentPosition(async pos => { const r = await call('geo', {consent: true, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude), accuracy: String(Math.round(pos.coords.accuracy || 0)), city: city.value, district: dist.value});
          ev.target.disabled = false; if (r.ok) openParty(session); else st.textContent = why(r); },
        () => { ev.target.disabled = false; st.textContent = 'لم يُسمح بالوصول للموقع. فعّل إذن الموقع للمتصفح ثم حاول.'; }, {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}); }, 'f38-primary'); return; }
    if (!v.ok) { try { sessionStorage.removeItem(SKEY); } catch (_) {} body.textContent = ''; openEntry('', (v.msg && v.msg.t) || why(v)); return; }
    if (!v.r38) { // not an r38 deal: hand over to the original contracts portal unchanged.
      closeSheet(); try { sessionStorage.setItem('F99K_PARTY_SESSION', session); } catch (_) {} return false; }
    const x = v.r38; D.documentElement.classList.toggle('f38-noprint', !x.allow_pdf);
    const head = el('div', 'f38-khead'); head.append(el('h3', '', v.title), el('p', 'f38-muted', 'رقم الاتفاق ' + v.ref + ' • النسخة ' + v.version + ' • ' + (KST[v.status] || v.status))); body.append(head);
    if (v.code_expires_at) { const t = el('p', 'f38-muted'); head.append(t); const tick = () => { const s = Math.max(0, Math.floor((Date.parse(v.code_expires_at) - Date.now()) / 1000));
      t.textContent = s > 0 ? 'ينتهي الدخول بعد ' + Math.floor(s / 3600) + ' ساعة و' + Math.floor(s % 3600 / 60) + ' دقيقة' : 'انتهت صلاحية الدخول.'; if (s <= 0) { stopClientTimer(); closeSheet(); openEntry('', REASONS.K_CODE_EXPIRED); } };
      tick(); stopClientTimer(); clientTimer = setInterval(tick, 30000); }
    W.F99R52K?.party?.(body, v, session, notice);
    if (x.post) { const c = el('div', 'f38-post f38-post-' + x.post.kind); c.append(el('b', '', x.post.text)); body.append(c); }
    if (v.body) { const bh = W.F99R52K?.bodyHost ? W.F99R52K.bodyHost(body, v) : body; const stv = pages(bh, v.title, v.body, !x.allow_pdf, x.watermark ? x.wm : '');
      if (x.allow_pdf) btn(body, 'تنزيل / طباعة PDF', () => printDoc(v.title, 'رقم الاتفاق ' + v.ref + ' • النسخة ' + v.version, v.body, x.watermark ? x.wm : ''));
      const stg = v.stage; if (stg && (stg.action === 'sign' || stg.action === 'submit')) signForm(body, v, stg, stv, session); }
    else if (v.waiting_for) say(body, 'العقد الآن بانتظار: ' + v.waiting_for + '. سيظهر لك هنا عند جاهزيته.', 'f38-muted');
    if (v.stage && !v.body && (v.stage.action === 'submit')) signForm(body, v, v.stage, {last: true}, session);
    if (x.signed && Number(x.money?.total) > 0) payBox(body, v, x, call, session);
    W.F99R52K?.partyEnd?.(body, v, session);
    if (v.notice) say(body, v.notice, 'f38-muted');
  }
  function signForm(body, v, stg, pagesState, session) {
    const box = el('div', 'f38-sign'); body.append(box); box.append(el('b', '', stg.label || 'الموافقة'));
    const inputs = {};
    (stg.fields || []).forEach(fd => { const t = fd.type === 'checkbox' ? 'checkbox' : fd.type === 'date' ? 'date' : fd.type === 'number' ? 'number' : 'text';
      inputs[fd.key] = field(box, fd.label + (fd.required ? ' *' : ''), fd.type === 'checkbox' ? false : (v.my_data?.[fd.key] || ''), {type: t, area: fd.type === 'textarea', ltr: ['iban', 'id', 'phone'].includes(fd.type)}); inputs[fd.key].dataset.t = fd.type; });
    if (stg.verify_identity) inputs.id_confirm = field(box, 'أعد إدخال رقم هويتك للتحقق *', '', {ltr: 1, max: 10});
    const st = el('p', 'f38-err'); box.append(st); const row = el('div', 'f38-row'); box.append(row);
    const data = () => { const o = {}; Object.entries(inputs).forEach(([k, i]) => { o[k] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; };
    const run = async (a, d) => { st.textContent = ''; const r = await pub('f99k_party_act', {p_session: session, p_device_id: KDEV(), p_action: a, p_data: d, p_version: v.version});
      if (r.ok !== true) { st.textContent = why(r); return; } openParty(session, (W.F99R52K?.doneMsg?.(v, a)) || (a === 'approve' ? 'تم حفظ موافقتك على ' + v.title + ' بتاريخها ووقتها.' : 'تم الإرسال.')); };
    const main = btn(row, (W.F99R52K?.btnLabel ? W.F99R52K.btnLabel(v, stg) : (stg.action === 'sign' ? 'أوافق على ' + v.title : 'إرسال')), () => {
      const d = data(); if (stg.action === 'sign' && d.read_ack === false) { st.textContent = 'أكّد أنك قرأت العقد.'; return; } run(stg.action === 'sign' ? 'approve' : 'submit', d); }, 'f38-primary');
    if (stg.action === 'sign') { main.disabled = !pagesState.last; if (!pagesState.last) { const h = say(box, 'اقرأ العقد حتى الصفحة الأخيرة ليتفعل زر الموافقة.', 'f38-muted'); pagesState.onLast = () => { main.disabled = false; h.remove(); }; }
      const note = field(box, 'استفسار أو سبب الرفض (اختياري)', '', {area: 1, rows: 2, wide: 1});
      btn(row, 'استفسار', () => run('clarify', {reason: note.value.trim()})); btn(row, 'رفض', () => { if (W.confirm('تأكيد رفض العقد؟ ستُغلق المعاملة.')) run('reject', {reason: note.value.trim()}); }, 'f38-danger'); }
  }
  function payBox(body, v, x, call, session) {
    const m = x.money, box = el('div', 'f38-paybox'); body.append(box); box.append(el('h3', '', 'السداد')); W.F99R52K?.payPatch?.(v, x, box);
    const g = el('div', 'f38-money'); [['الإجمالي', m.total], ['المدفوع', m.paid], ['المتبقي', m.remaining], ['المطلوب الآن', m.due_now]].forEach(([t, n]) => { const d = el('div'); d.append(el('small', '', t), el('b', '', num(n) + ' ريال')); g.append(d); }); box.append(g);
    const pend = (x.payments || []).find(p => p.status === 'review'); const lastRej = (x.payments || []).find(p => p.status === 'rejected');
    (x.payments || []).forEach(p => box.append(el('p', 'f38-muted', when(p.at) + ' • ' + num(p.amount) + ' ريال • ' + (p.status === 'review' ? 'تحت المراجعة' : p.status === 'approved' ? 'معتمد' : 'مرفوض') + (p.owner_note ? ' — ' + p.owner_note : ''))));
    if (pend) { say(box, pend.method === 'salla' ? x.texts.salla_review : x.texts.review, 'f38-warn'); return; }
    if (Number(m.due_now) <= 0) { if (Number(m.paid) > 0) say(box, x.texts.approved_pay, 'f38-ok'); return; }
    if (lastRej) say(box, x.texts.rejected_pay, 'f38-err');
    const st = el('p', 'f38-err');
    if (x.pay?.salla_url) { const s = el('div', 'f38-sub'); box.append(s); s.append(el('b', '', 'الدفع المباشر'));
      const a = el('a', 'f38-btn f38-primary', 'ادفع ' + num(m.due_now) + ' ريال'); a.href = x.pay.salla_url; a.target = '_blank'; a.rel = 'noopener'; s.append(a);
      btn(s, 'دفعت — أبلغ صاحب العقد للمراجعة', async ev => { ev.target.disabled = true; const r = await call('pay_notice', {}); if (r.ok) openParty(session); else { ev.target.disabled = false; st.textContent = why(r); } }); }
    if (x.pay?.bank) { const s = el('div', 'f38-sub'); box.append(s); s.append(el('b', '', 'التحويل البنكي'));
      const b = x.pay.bank; [['البنك', b.bank_name], ['اسم الحساب', b.holder], ['الآيبان', b.iban]].forEach(([k, val]) => { if (val) { const p = el('p'); p.append(el('small', '', k + ': '), el('b', '', val)); s.append(p); } }); W.F99R52K?.bankExtra?.(s, b);
      const fi = el('input'); fi.type = 'file'; fi.accept = 'image/jpeg,image/png,application/pdf'; const lb = el('label', 'f38-field f38-wide'); lb.append(el('span', '', 'إرفاق إيصال التحويل (إلزامي، صورة أو PDF حتى 1.5 ميجابايت)'), fi); s.append(lb);
      const nt = field(s, 'ملاحظة (اختياري)', '', {max: 500});
      btn(s, 'إرسال الإيصال', async ev => { const file = fi.files?.[0]; if (!file) { st.textContent = 'أرفق صورة الإيصال.'; return; }
        if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { st.textContent = REASONS.K_RECEIPT_INVALID; return; } if (file.size > 1600000 || file.size < 1000) { st.textContent = REASONS.K_RECEIPT_SIZE; return; }
        ev.target.disabled = true; st.textContent = 'جاري الرفع…'; const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => res(''); fr.readAsDataURL(file); });
        const r = await call('receipt', {mime: file.type, b64, note: nt.value}); ev.target.disabled = false; if (r.ok) openParty(session); else st.textContent = why(r); }, 'f38-primary'); }
    box.append(st);
  }
  /* FK codes typed in the main code box: r38 deals open here; other deals continue to the original portal unchanged. */
  function hookLogin() {
    const FK = /^FK-?[A-Z0-9]{5}-?[A-Z0-9]{5}$/i; let pass = false, busy = false;
    const quick = async (fn, args) => { try { const r = await W.finoRpc(fn, args, 8000); return r?.data && typeof r.data === 'object' ? r.data : {ok: false}; } catch (_) { return {ok: false}; } };
    const handle = ev => {
      if (pass) return; const input = D.getElementById('f99l-code'); if (!input) return;
      const raw = String(input.value || '').trim(); if (raw.length < 4 || raw.length > 120) return;
      ev.preventDefault(); ev.stopImmediatePropagation(); if (busy) return; busy = true;
      const err = D.getElementById('f99l-error');
      void (async () => {
        try {
          // r39: one box for packages and contracts. The server matches the contract key exactly; package codes are never contract keys.
          const r = await quick('f99r38_party_enter', {p_key: raw, p_device_id: KDEV()});
          if (r.ok && r.session) {
            const chk = await quick('f99r38_party', {p_session: r.session, p_device_id: KDEV(), p_action: 'view', p_data: {}});
            if (chk.r38 || chk.reason === 'K_PIN_REQUIRED' || chk.reason === 'K_GEO_REQUIRED') { if (err) { err.textContent = ''; err.style.display = 'none'; } try { sessionStorage.setItem(SKEY, r.session); } catch (_) {} input.value = ''; openParty(r.session); return; }
            if (W.F99KContracts?.partyEnter) { const ok = await W.F99KContracts.partyEnter(raw.toUpperCase().replace(/\s+/g, ''), err); if (ok && err) { err.textContent = ''; err.style.display = 'none'; } return; }
          }
          if (!r.ok && r.msg && r.msg.t && r.reason !== 'K_CODE_INVALID' && err) { err.textContent = r.msg.t; err.style.display = 'block'; return; }
          if (FK.test(raw.replace(/\s+/g, '')) && W.F99KContracts?.partyEnter) { const ok = await W.F99KContracts.partyEnter(raw.toUpperCase().replace(/\s+/g, ''), err); if (ok && err) { err.textContent = ''; err.style.display = 'none'; } return; }
          pass = true; try { D.getElementById('f99l-enter')?.click(); } finally { pass = false; }
        } finally { busy = false; }
      })();
    };
    W.addEventListener('click', ev => { if (ev.target?.closest?.('#f99l-enter')) handle(ev); }, true);
    W.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target?.id === 'f99l-code') handle(ev); }, true);
  }
  // r39: no separate contract link on the home page (owner order); remove it if an older build added it.
  function entryLink() { D.getElementById('f38-klink')?.remove(); }
  function footer() {
    if (D.getElementById('f39-rights')) return; const f = D.getElementById('f99l-footer'); if (!f) return;
    const c = el('div', 'f39-rights', '© FINO99 | الحلول التمويلية الذكية — جميع الحقوق محفوظة'); c.id = 'f39-rights'; c.setAttribute('role', 'contentinfo'); f.append(c);
  }
  /* ================= aqari client notices ================= */
  const noticed = new WeakSet();
  async function aqariNotices(sheetEl) {
    if (noticed.has(sheetEl)) return; noticed.add(sheetEl);
    let e = null; try { e = W.finoCentralRestoreEntry?.() || null; } catch (_) {} const t = e?.entryToken || e?.entry_token, dv = String(e?.deviceId || e?.device_id || ''); if (!t || !dv) return;
    const keys = ['f99o2-mortgage-guidance', 'f99o2-aqari-renew'];
    for (const k of keys) { const r = await pub('f99r38_client_notices', {p_entry_token: t, p_device_id: dv, p_product_key: k}); if (!r.ok || !r.items?.length) continue;
      const body = sheetEl.querySelector('.f35-body'); if (!body) return; const box = el('div', 'f38-notices'); box.append(el('b', '', '🔔 إشعارات موعدك'));
      r.items.forEach(n => { const p = el('div', 'f38-notice' + (n.new ? ' f38-new' : '')); p.append(el('pre', '', n.message), el('small', 'f38-muted', when(n.at))); box.append(p); }); body.prepend(box); return; }
  }
  /* ================= cards (calculation chat) ================= */
  const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة', 'الرابعة عشرة', 'الخامسة عشرة', 'السادسة عشرة', 'السابعة عشرة', 'الثامنة عشرة', 'التاسعة عشرة', 'العشرون'];
  async function calcStart(marker) {
    if (marker.querySelector('.f38-start')) return; let s = null; try { const e = W.F99S12Runtime?.entry?.() || W.finoCentralRestoreEntry?.(); if (e?.entryToken) { const r = await W.finoRpc('f99v23_client_status', {p_entry_token: e.entryToken, p_device_id: e.deviceId}, 14000); if (r?.ok && r.data?.ok) s = r.data; } } catch (_) {}
    let n = Number(marker.dataset.f85CalcIndex) || 1; const max = Number(s?.max_calculations), left = s?.calculations_remaining == null ? NaN : Number(s.calculations_remaining);
    if (max > 0 && Number.isFinite(left)) n = Math.min(max, Math.max(1, max - left + 1));
    let name = ''; try { const I = W.F99R22Identity; name = (I?.beneficiary?.() || I?.owner?.() || '').toString().trim(); } catch (_) {}
    if (!marker.isConnected || marker.querySelector('.f38-start')) return;
    const p = el('p', 'f38-start', (name ? 'يا ' + name + '، ' : '') + 'بدأت الحسبة ' + (ORD[n - 1] || ('رقم ' + n)) + (max > 0 ? ' من ' + max : '')); p.setAttribute('role', 'status'); marker.prepend(p);
  }
  function restartBar(chat) {
    const btns = [...chat.querySelectorAll('.f82-end-actions button')].filter(b => !b.disabled && !b.hidden && /حسبة جديدة|من جديد/.test(b.textContent));
    let bar = chat.querySelector('.f38-restart'); const target = btns[btns.length - 1];
    if (!target) { bar?.remove(); return; }
    if (!bar) { bar = el('div', 'f38-restart'); const b = btn(bar, '🔄 بدء من جديد', () => { const t = [...chat.querySelectorAll('.f82-end-actions button')].filter(x => !x.disabled && !x.hidden && /حسبة جديدة|من جديد/.test(x.textContent)).pop(); t?.click(); }, 'f38-restart-btn'); b.setAttribute('aria-label', 'بدء حسبة جديدة'); chat.prepend(bar); }
  }
  function exitNote(ovl) { const box = ovl.querySelector('.f36-exit-box'); if (!box || box.querySelector('.f38-exit-note')) return;
    const p = el('p', 'f38-exit-note', 'تنبيه: الخروج يُنهي هذه المحادثة نهائيًا ولا يمكن استرجاع نتائجها المعروضة بعده. لا يُخصم بسبب الخروج أي رصيد، وكودك يبقى صالحًا ضمن مدته.'); box.querySelector('#f36-exit-title')?.after(p); }
  const exhaustedShown = new Set();
  async function afterEnd(row) {
    if (row.querySelector('button') && [...row.querySelectorAll('button')].some(b => /حسبة جديدة/.test(b.textContent))) return; // balance remains
    let e = null; try { e = W.F99S12Runtime?.entry?.() || W.finoCentralRestoreEntry?.(); } catch (_) {} const id = e?.entryToken || ''; if (!id || exhaustedShown.has(id)) return;
    let s = null; try { const r = await W.finoRpc('f99v23_client_status', {p_entry_token: e.entryToken, p_device_id: e.deviceId}, 14000); if (r?.ok && r.data?.ok) s = r.data; } catch (_) {}
    if (!s || !(Number(s.max_calculations) > 0) || Number(s.calculations_remaining) > 0 || typeof W.F99Renewal22?.openCurrent !== 'function') return;
    exhaustedShown.add(id); setTimeout(() => { try { W.F99Renewal22.openCurrent({onLater: () => {}}); } catch (_) {} }, 900);
  }
  /* ================= wiring ================= */
  let tick = 0;
  function scan() {
    tick = 0; desk(); entryLink(); footer();
    const aq = D.getElementById('f35-aqari'); if (aq && !aq.hidden) { const h = aq.querySelector('.f35-head h2'); if (h && /مواعيدي/.test(h.textContent)) aqariNotices(aq.querySelector('.f35-sheet')); }
    const chat = D.getElementById('finoBotChat'); if (chat) { chat.querySelectorAll('.f85-calc-marker:not([data-f38])').forEach(m => { m.dataset.f38 = '1'; void calcStart(m); }); restartBar(chat);
      chat.querySelectorAll('.f82-end-actions:not([data-f38])').forEach(r => { r.dataset.f38 = '1'; void afterEnd(r); }); }
    const ex = D.getElementById('f24-exit-warning'); if (ex) exitNote(ex);
  }
  new MutationObserver(() => { if (!tick) tick = setTimeout(scan, 120); }).observe(D.documentElement, {childList: true, subtree: true});
  hookLogin();
  const route = () => { if (/^#(contract|k)$/i.test(location.hash)) { let s = null; try { s = sessionStorage.getItem(SKEY); } catch (_) {} if (s) openParty(s); else openEntry(); } };
  W.addEventListener('hashchange', route);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', () => { scan(); route(); }, {once: true}); else { setTimeout(() => { scan(); route(); }, 0); }
  W.F99R38K = {el, btn, field, say, adm, pub, why, REASONS, sheet, closeSheet, tabs, num, when, pages, printDoc, editDraft, openK, openParty, KDEV, SKEY};
  W.F99R38 = Object.freeze({version: 'r39a', openAppts, openK, openEntry, openParty, openPkgs, openPkg, openCats, refreshHome: loadHome});
})();
