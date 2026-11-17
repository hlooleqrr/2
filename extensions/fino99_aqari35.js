/* FINO99 r35 — «قبل تاخذ العقاري». Reuses the existing appointment engine (f99r22h/f99a9) through f99r35_* RPCs.
   No calculator, finance, rates, other packages, codes or stock logic here. Client sees only server-approved data. */
(function (w, d) {
  'use strict';
  if (w.F99Aqari35) return;
  const TZ = 'Asia/Riyadh', DAYS = {1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت', 7: 'الأحد'};
  let pub = null, pubAt = 0, pubBusy = null, ov = null, serial = 0, adTimer = 0;
  const reduce = () => { try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  function el(tag, cls, text) { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function btn(host, label, fn, cls) { const b = el('button', 'f35-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.onclick = fn; host.append(b); return b; }
  function uuid() { try { if (w.crypto?.randomUUID) return w.crypto.randomUUID(); } catch (_) {} const a = new Uint8Array(16); w.crypto.getRandomValues(a); a[6] = a[6] & 15 | 64; a[8] = a[8] & 63 | 128; const h = [...a].map(x => x.toString(16).padStart(2, '0')).join(''); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20); }
  function device() { try { return String(w.finoCentralDeviceId?.() || ''); } catch (_) { return ''; } }
  function money(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}) : ''; }
  function dur(sec) { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return s ? m + ' دقيقة و' + s + ' ثانية' : m + ' دقيقة'; }
  function fmtDate(iso) { try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'}).format(new Date(iso)); } catch (_) { return String(iso).slice(0, 10); } }
  function fmtTime(iso) { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true}).format(new Date(iso)); } catch (_) { return String(iso).slice(11, 16); } }
  function fmtDay(day) { return fmtDate(day + 'T12:00:00+03:00'); }
  const REASONS = {SALE_CLOSED: 'الباقة غير مطروحة للشراء حاليًا.', TERMS_CHANGED: 'تم تحديث الشروط، اقرأها مرة ثانية.', SESSION_OR_CODE_NOT_VALID: 'الكود غير صالح لهذه الباقة أو انتهت الجلسة. أدخل الكود مرة ثانية.',
    SLOT_TAKEN: 'هذا الوقت انحجز قبل قليل، اختر وقتًا ثانيًا.', SLOT_UNAVAILABLE: 'هذا الوقت غير متاح، اختر وقتًا ثانيًا.', BOOKING_LIMIT_REACHED: 'كودك استُخدم لحجز سابق. لحجز جلسة جديدة جدّد موعدك.',
    CANCEL_CUTOFF_PASSED: 'الإلغاء الاعتيادي متاح فقط قبل الموعد بأكثر من 24 ساعة، مع حفظ حقوقك النظامية.', CHANGE_CUTOFF_PASSED: 'التعديل متاح حتى قبل موعدك بعشر دقائق فقط.',
    COMP_CHOICE_REQUIRED: 'اختر طريقة التعويض أولًا.', REFUND_REQUESTED: 'طلب الاسترداد مسجل.', BUSY_RETRY: 'ضغط مؤقت، حاول بعد لحظات.', MISSING_CONSENT_OR_INVALID_CONTACT: 'تأكد من الاسم ورقم الجوال.'};
  function reasonText(r) { const k = String(r || ''); if (/CANCEL/.test(k) && /WINDOW|CUTOFF/.test(k)) return REASONS.CANCEL_CUTOFF_PASSED; if (/(RESCHEDULE|CHANGE|MOVE)/.test(k) && /WINDOW|CUTOFF/.test(k)) return REASONS.CHANGE_CUTOFF_PASSED; for (const key of Object.keys(REASONS)) if (k.includes(key)) return REASONS[key]; if (/PHONE|CONTACT|NAME/i.test(k)) return REASONS.MISSING_CONSENT_OR_INVALID_CONTACT; if (/SLOT|OVERLAP|CONFLICT|EXCLU|TAKEN|23P01/i.test(k)) return REASONS.SLOT_TAKEN; if (/CUTOFF|TOO_LATE|NOTICE/i.test(k)) return 'انتهت المهلة المسموحة لهذا الإجراء.'; if (/LIMIT|QUOTA|USED/i.test(k)) return REASONS.BOOKING_LIMIT_REACHED; return 'تعذر إكمال الطلب الآن. حاول مرة ثانية.'; }
  async function rpc(fn, args) { if (typeof w.finoRpc !== 'function') throw Error('RPC_UNAVAILABLE'); const r = await w.finoRpc(fn, args, 20000); const v = r?.data; if (!r?.ok || !v || v.ok !== true) { const e = Error(String(v?.reason || r?.error?.message || r?.error?.code || 'RPC_UNAVAILABLE')); throw e; } return v; }
  async function owner(action, data) { if (typeof w.finoCentralAdminCall !== 'function') throw Error('NO_ADMIN'); const r = await w.finoCentralAdminCall('f99r35_owner', {p_action: action, p_data: data || {}}); const v = r?.data; if (!r?.ok || !v || v.ok !== true) throw Error(String(v?.reason || r?.reason || r?.error?.message || 'RPC_UNAVAILABLE')); return v; }
  async function loadPublic(force) { if (!force && pub && Date.now() - pubAt < 60000) return pub; if (pubBusy) return pubBusy; pubBusy = rpc('f99r35_public', {}).then(v => { pub = v; pubAt = Date.now(); return v; }).finally(() => { pubBusy = null; }); return pubBusy; }
  function keys() { const a = pub?.aqari; return a ? [a.base_key, a.renew_key] : ['f99o2-mortgage-guidance', 'f99o2-aqari-renew']; }
  function isAqari(k) { return !!k && keys().includes(String(k)); }

  /* ---------- overlay ---------- */
  function sheet(title) {
    if (!ov) { ov = el('div', 'f35-ov'); ov.id = 'f35-aqari'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.dir = 'rtl'; d.body.append(ov);
      ov.addEventListener('click', e => { if (e.target === ov) close(); }); d.addEventListener('keydown', e => { if (e.key === 'Escape' && ov && !ov.hidden) close(); }); }
    if (ov.nextSibling) d.body.append(ov); serial++; ov.hidden = false; ov.textContent = ''; const box = el('div', 'f35-sheet'), head = el('div', 'f35-head'); head.append(el('h2', '', title)); btn(head, 'إغلاق', close, 'f35-x');
    const body = el('div', 'f35-body'); box.append(head, body); ov.append(box); d.documentElement.classList.add('f35-lock'); box.scrollTop = 0; return body;
  }
  function close() { serial++; if (ov) { ov.hidden = true; ov.textContent = ''; } d.documentElement.classList.remove('f35-lock'); }
  function note(host, t, cls) { const p = el('p', 'f35-note' + (cls ? ' ' + cls : ''), t); host.append(p); return p; }
  function wait(host) { const p = el('p', 'f35-wait', 'جاري التحميل…'); host.append(p); return p; }

  /* ---------- public detail + terms + checkout ---------- */
  async function openDetail(key) {
    const s = serial + 1, body = sheet('قبل تاخذ العقاري'), wt = wait(body); let v;
    try { v = await loadPublic(true); } catch (e) { if (s !== serial) return; wt.remove(); note(body, 'تعذر قراءة تفاصيل الباقة من المركزية. حاول مرة ثانية.', 'f35-err'); return; }
    if (s !== serial) return; wt.remove(); const a = v.aqari, renew = key === a.renew_key;
    ov.querySelector('h2').textContent = renew ? a.renew_name : a.name;
    if (a.image_url) { const img = el('img', 'f35-img'); img.alt = a.name; img.loading = 'lazy'; img.src = a.image_url; body.append(img); }
    const tag = el('div', 'f35-tagline', renew ? a.renew_body : a.tagline); body.append(tag);
    const meta = el('div', 'f35-meta'); meta.append(el('span', '', '⏱️ ' + a.session_minutes + ' دقيقة هاتفية'), el('span', '', '🧭 ' + a.service_type));
    const price = Number(renew ? a.renew_price : a.price); if (price > 0) meta.append(el('span', 'f35-price', 'السعر: ' + money(price) + ' ريال'));
    body.append(meta);
    const cp = renew ? a.renew_coupon : a.base_coupon; if (cp && cp.code) note(body, '🎁 كوبون الخصم: ' + cp.code + ' — خصم ' + money(cp.percent) + '% يُدخل في صفحة الدفع.', 'f35-coupon');
    if (!renew) { const sec = el('section', 'f35-topics'); sec.append(el('h3', '', a.details_title)); const ol = el('ol'); (a.topics || []).forEach(t => ol.append(el('li', '', t))); sec.append(ol, el('p', 'f35-closing', a.closing)); body.append(sec); }
    const open = renew ? a.renew_open : a.sale_open, act = el('div', 'f35-actions'); body.append(act);
    if (open) btn(act, renew ? a.renew_button : a.cta, () => openTerms(key), 'f35-primary');
    else { const b = btn(act, renew ? a.renew_button : a.cta, () => {}, 'f35-primary'); b.disabled = true; note(body, 'الشراء غير متاح حاليًا. ستطلق الباقة قريبًا بإذن الله.', 'f35-soon'); }
    note(body, 'عندك كود؟ أدخله في خانة الأكواد الرئيسية في الصفحة.');
  }
  function toCheckout(u) { if (/^https:\/\/salla\.sa\//.test(String(u || ''))) w.location.assign(u); }
  async function openTerms(key) {
    const s = serial + 1, body = sheet('الشروط والأحكام'); let v;
    try { v = await loadPublic(true); } catch (_) { if (s === serial) note(body, 'تعذر قراءة الشروط. حاول مرة ثانية.', 'f35-err'); return; }
    if (s !== serial) return; const a = v.aqari; ov.querySelector('h2').textContent = a.terms_title;
    const list = el('div', 'f35-terms'); (a.terms || []).forEach((t, i) => { const it = el('section', 'f35-term'); it.append(el('h3', '', (i + 1) + '. ' + t.q), el('p', '', t.a)); list.append(it); }); body.append(list);
    const lab = el('label', 'f35-consent'), cb = el('input'); cb.type = 'checkbox'; lab.append(cb, el('span', '', a.consent)); body.append(lab);
    const act = el('div', 'f35-actions'), msg = el('p', 'f35-note'); body.append(act, msg);
    const go = btn(act, a.pay_button, async () => {
      if (!cb.checked) return; go.disabled = true; msg.textContent = 'جاري حفظ موافقتك…';
      try { const r = await rpc('f99r35_consent', {p_device_id: device(), p_product_key: key, p_revision: Number(a.revision), p_accepted: true});
        msg.textContent = 'تم حفظ موافقتك. جاري فتح صفحة الدفع…'; toCheckout(r.checkout_url);
      } catch (e) { msg.textContent = reasonText(e.message); msg.className = 'f35-note f35-err'; go.disabled = !cb.checked; if (/TERMS_CHANGED/.test(e.message)) void openTerms(key); }
    }, 'f35-primary');
    go.disabled = true; cb.onchange = () => { go.disabled = !cb.checked; };
    btn(act, 'رجوع', () => openDetail(key));
  }

  /* ---------- client (code entered) ---------- */
  function entry() { try { return w.finoCentralRestoreEntry?.() || null; } catch (_) { return null; } }
  function access() { try { return typeof activeAccess !== 'undefined' ? activeAccess : w.activeAccess; } catch (_) { return w.activeAccess; } }
  function codeKey() { const a = access(), e = entry(); for (const x of [a?.record?.centralData, a?.record, e]) { const f = x?.config?.f99x || x?.code?.config?.f99x || {}; const k = f.effective_package_key || f.store_package_key || x?.store_package_key; if (typeof k === 'string' && k.trim()) return k.trim(); } return ''; }
  function session(key) { const e = entry(), t = e?.entryToken || e?.entry_token, dv = String(e?.deviceId || e?.device_id || device()); return t && dv ? {token: t, device: dv, key} : null; }
  async function client(s, action, data) { return rpc('f99r35_client', {p_entry_token: s.token, p_device_id: s.device, p_product_key: s.key, p_action: action, p_data: data || {}}); }
  function saved() { try { return JSON.parse(w.localStorage.getItem('f35_contact') || '{}') || {}; } catch (_) { return {}; } }
  function remember(n, p) { try { w.localStorage.setItem('f35_contact', JSON.stringify({name: n, phone: p})); } catch (_) {} }
  function phoneOk(p) { let x = String(p || '').replace(/[\s()-]/g, '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)); if (/^9665\d{8}$/.test(x)) x = '+' + x; if (/^5\d{8}$/.test(x)) x = '0' + x; return /^(\+9665|05)\d{8}$/.test(x) ? x : ''; }
  async function openClient(key) {
    let last = ''; try { last = w.sessionStorage.getItem('f35_key') || ''; } catch (_) {}
    const ck = codeKey(), k = key || (isAqari(ck) ? ck : '') || (isAqari(last) ? last : '') || keys()[0];
    let s = session(k); const my = serial + 1, body = sheet('قبل تاخذ العقاري — مواعيدي');
    if (!s) { note(body, 'أدخل كودك في خانة الأكواد الرئيسية أولًا.', 'f35-err'); return; }
    const wt = wait(body); let ctx;
    try {
      await loadPublic(false).catch(() => null);
      try { ctx = await client(s, 'context'); }
      catch (e) { // key not given: the server decides which of the two aqari products this code belongs to.
        const alt = keys().find(x => x !== s.key);
        if (key || !alt || !/SESSION_OR_CODE_NOT_VALID|NOT_AQARI_PRODUCT/.test(e.message)) throw e;
        s = session(alt); ctx = await client(s, 'context');
      }
      try { w.sessionStorage.setItem('f35_key', s.key); } catch (_) {}
    } catch (e) { if (my !== serial) return; wt.remove(); const n = note(body, reasonText(e.message), 'f35-err'); if (n?.dataset) n.dataset.reason = String(e.message || '').slice(0, 80); return; }
    if (my !== serial) return; wt.remove(); render(body, s, ctx);
  }
  function render(body, s, ctx) {
    const a = pub?.aqari || {}, r = ctx.r35 || {}, now = Date.now(), list = Array.isArray(ctx.bookings) ? ctx.bookings : [];
    const act = list.filter(b => ['pending', 'confirmed'].includes(b.status) && Date.parse(b.ends_at) > now).sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at))[0];
    const secs = Number(r.session_seconds) || (Number(a.session_minutes) || 25) * 60;
    if (r.comp?.refund_requested) { note(body, 'تم تسجيل اختيارك استرداد المبلغ كاملًا، وسيتواصل معك فريق FINO99 لإتمامه وفق حقوقك النظامية.', 'f35-ok'); return; }
    if (r.comp?.choice_needed) {
      const c = el('section', 'f35-card'); c.append(el('h3', '', 'نعتذر منك، تعذر علينا تقديم موعدك مرتين'), el('p', '', 'من حقك تختار: استرداد المبلغ كاملًا، أو جلسة بديلة مجانية مدتها 37 دقيقة و30 ثانية.')); body.append(c);
      const row = el('div', 'f35-actions'); c.append(row);
      const pick = async ch => { row.querySelectorAll('button').forEach(b => { b.disabled = true; }); try { await client(s, 'comp_choose', {choice: ch}); void openClient(s.key); } catch (e) { note(c, reasonText(e.message), 'f35-err'); row.querySelectorAll('button').forEach(b => { b.disabled = false; }); } };
      btn(row, 'جلسة بديلة 37:30 دقيقة', () => pick('session'), 'f35-primary'); btn(row, 'استرداد المبلغ كاملًا', () => pick('refund')); return;
    }
    if (act) { bookingCard(body, s, act, secs, r); return; }
    if (r.renewal?.show) { renewalCard(body, r.renewal); return; }
    const remaining = Number(ctx.quota?.remaining || 0);
    if (remaining <= 0) { note(body, REASONS.BOOKING_LIMIT_REACHED, 'f35-err'); return; }
    if (Number(r.comp?.failures) > 0) note(body, 'نعتذر عن تعذر الموعد السابق. موعدك البديل مجاني ومدته ' + dur(secs) + '.', 'f35-ok');
    contactStep(body, s, secs, list);
  }
  function contactStep(body, s, secs, list) {
    const a = pub?.aqari || {}, last = list.slice().reverse().find(b => b.name) || {}, sv = saved();
    const f = el('form', 'f35-form'); f.noValidate = true;
    const l1 = el('label', '', a.ask_name || 'وش اسمك؟'), n = el('input'); n.autocomplete = 'name'; n.maxLength = 80; n.value = last.name || sv.name || ''; l1.append(n);
    const l2 = el('label', '', a.ask_phone || 'وش رقم جوالك للتواصل؟'), p = el('input'); p.type = 'tel'; p.inputMode = 'tel'; p.autocomplete = 'tel'; p.dir = 'ltr'; p.placeholder = '05XXXXXXXX'; p.value = last.phone || sv.phone || ''; l2.append(p);
    const m = el('p', 'f35-note'); f.append(l1, l2, m); const row = el('div', 'f35-actions'); f.append(row); const go = btn(row, 'اعرض المواعيد المتاحة', null, 'f35-primary'); go.type = 'submit';
    f.onsubmit = ev => { ev.preventDefault(); const name = n.value.trim(), phone = phoneOk(p.value); if (name.length < 2) { m.textContent = 'اكتب اسمك.'; return; } if (!phone) { m.textContent = 'اكتب رقم جوال سعودي صحيح يبدأ بـ05.'; return; } remember(name, phone); void daysStep(s, {name, phone}, secs, null); };
    body.append(f); setTimeout(() => { try { (n.value ? p : n).focus({preventScroll: true}); } catch (_) {} }, 50);
  }
  async function daysStep(s, who, secs, booking) {
    const my = serial + 1, body = sheet(booking ? 'تعديل موعدي' : 'اختر موعدك'); const wt = wait(body); let v;
    try { v = await client(s, 'days', booking ? {exclude_booking_id: booking.id} : {}); } catch (e) { if (my !== serial) return; wt.remove(); note(body, reasonText(e.message), 'f35-err'); btn(body, 'رجوع', () => openClient(s.key)); return; }
    if (my !== serial) return; wt.remove(); note(body, 'المواعيد بتوقيت الرياض • مدة الجلسة ' + dur(secs) + '.');
    if (!v.days?.length) { note(body, 'لا توجد مواعيد متاحة حاليًا. نضيف مواعيد جديدة باستمرار، ارجع لاحقًا بنفس كودك.', 'f35-soon'); btn(body, 'رجوع', () => openClient(s.key)); return; }
    const grid = el('div', 'f35-days'), slots = el('div', 'f35-slots'); body.append(grid, slots);
    v.days.forEach((x, i) => { const b = btn(grid, fmtDay(x.day), () => pick(x.day, b), 'f35-day'); b.append(el('small', '', x.count + ' وقت')); if (i === 0) setTimeout(() => b.click(), 0); });
    btn(body, 'رجوع', () => openClient(s.key));
    async function pick(day, b) {
      grid.querySelectorAll('.f35-day').forEach(x => x.classList.toggle('on', x === b)); slots.textContent = ''; const w2 = wait(slots), mine = serial; let r;
      try { r = await client(s, 'slots', booking ? {day, exclude_booking_id: booking.id} : {day}); } catch (e) { if (mine !== serial) return; w2.remove(); note(slots, reasonText(e.message), 'f35-err'); return; }
      if (mine !== serial) return; w2.remove(); const items = r.items || [];
      if (!items.length) { note(slots, 'انحجزت أوقات هذا اليوم، اختر يومًا ثانيًا.'); return; }
      items.forEach(it => btn(slots, fmtTime(it.starts_at), () => confirmStep(s, who, secs, booking, it), 'f35-slot'));
    }
  }
  function confirmStep(s, who, secs, booking, it) {
    const body = sheet(booking ? 'تأكيد تعديل الموعد' : 'تأكيد الموعد'), c = el('section', 'f35-card');
    c.append(el('p', '', '📅 ' + fmtDate(it.starts_at)), el('p', '', '🕘 ' + fmtTime(it.starts_at) + ' بتوقيت الرياض'), el('p', '', '⏱️ ' + dur(secs)));
    if (!booking) c.append(el('p', '', '👤 ' + who.name + ' • ' + who.phone)); body.append(c);
    const row = el('div', 'f35-actions'), m = el('p', 'f35-note'); body.append(row, m); const rid = uuid();
    const go = btn(row, booking ? 'اعتمد الموعد الجديد' : 'أكّد الحجز', async () => {
      go.disabled = true; m.textContent = 'جاري التأكد من خلو الوقت وحفظ الحجز…';
      try {
        const r = booking ? await client(s, 'reschedule', {request_id: rid, booking_id: booking.id, start: it.starts_at})
          : await client(s, 'book', {request_id: rid, start: it.starts_at, name: who.name, phone: who.phone, accepted: true});
        const ctx = await client(s, 'context'); const b = r.booking || (ctx.bookings || []).find(x => x.status === 'confirmed' && Date.parse(x.ends_at) > Date.now());
        const body2 = sheet('✅ تم حجز موعدك بنجاح!'); bookingCard(body2, s, b, secs, ctx.r35 || {}, true);
      } catch (e) { m.textContent = reasonText(e.message); m.className = 'f35-note f35-err'; go.disabled = false; if (/SLOT|TAKEN|OVERLAP|UNAVAILABLE|23P01/i.test(e.message)) btn(row, 'اختر وقتًا ثانيًا', () => daysStep(s, who, secs, booking)); }
    }, 'f35-primary');
    btn(row, 'رجوع', () => daysStep(s, who, secs, booking));
  }
  function bookingCard(body, s, b, secs, r, fresh) {
    const a = pub?.aqari || {}, c = el('section', 'f35-card f35-booking');
    if (fresh) c.append(el('h3', 'f35-okh', a.confirm_title || '✅ تم حجز موعدك بنجاح!')); else c.append(el('h3', '', 'موعدك الحالي'));
    const txt = String(a.confirm_body || '').replace(/\{name\}/g, b.name || '').replace(/\{date\}/g, fmtDate(b.starts_at)).replace(/\{time\}/g, fmtTime(b.starts_at)).replace(/\{duration\}/g, dur(secs));
    c.append(el('div', 'f35-pre', txt)); const cn = r.contact || a.contact; if (cn) c.append(el('p', 'f35-contact', '📞 ' + cn)); body.append(c);
    const left = Date.parse(b.starts_at) - Date.now(), row = el('div', 'f35-actions'), m = el('p', 'f35-note'); c.append(row, m);
    const canChange = left > (Number(r.change_cutoff_minutes) || 10) * 60000, canCancel = left > (Number(r.cancel_cutoff_minutes) || 1440) * 60000;
    const e = btn(row, 'تعديل موعدي', () => { const sv = saved(); void daysStep(s, {name: b.name || sv.name, phone: b.phone || sv.phone}, secs, b); }); e.disabled = !canChange;
    const x = btn(row, 'إلغاء موعدي', async () => {
      if (x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = 'تأكيد إلغاء الموعد'; m.textContent = 'اضغط مرة ثانية لتأكيد الإلغاء.'; return; }
      x.disabled = true; try { await client(s, 'cancel', {request_id: uuid(), booking_id: b.id}); m.textContent = 'تم إلغاء موعدك. كودك محفوظ وتقدر تحجز موعدًا ثانيًا.'; e.disabled = true; setTimeout(() => openClient(s.key), 1200); }
      catch (er) { m.textContent = reasonText(er.message); x.disabled = false; }
    }); x.disabled = !canCancel;
    if (!canChange) m.textContent = REASONS.CHANGE_CUTOFF_PASSED; else if (!canCancel) m.textContent = REASONS.CANCEL_CUTOFF_PASSED;
  }
  function renewalCard(body, rn) {
    const a = pub?.aqari || {}, c = el('section', 'f35-card f35-renew'); c.append(el('h3', '', a.renew_title || '🏡 باقي عندك أسئلة عن العقاري؟'), el('p', '', a.renew_body || ''));
    if (rn.coupon?.code) c.append(el('p', 'f35-coupon', '🎁 كوبون ' + rn.coupon.code + ' — خصم ' + money(rn.coupon.percent) + '% في صفحة الدفع.'));
    const row = el('div', 'f35-actions'); c.append(row); body.append(c);
    const go = btn(row, a.renew_button || 'جدّد موعدك الآن', () => openDetail(a.renew_key || keys()[1]), 'f35-primary'); if (!rn.open) { go.disabled = true; c.append(el('p', 'f35-note', 'التجديد غير متاح للشراء حاليًا.')); }
    btn(row, a.renew_later || 'ليس الآن', close);
    note(body, 'بعد الدفع واستلام كود التجديد، أدخله في خانة الأكواد واختر موعدك الجديد.');
  }

  /* ---------- storefront: owner button texts + ads ---------- */
  function products() { try { return w.FINO99ReadStorefront?.()?.products || []; } catch (_) { return []; } }
  function decorate() {
    const root = d.getElementById('f99s-modal'); if (!root || root.hidden) { stopAds(); return; }
    const list = root.querySelector('.f99v6-tiles'); if (!list) { stopAds(); return; }
    if (!pub) { void loadPublic(false).then(decorate).catch(() => {}); return; }
    const st = pub.store || {}, prods = products();
    // Store tiles only: a missing cover file (e.g. 404) must not show a broken-image box; the card keeps its text layout.
    list.querySelectorAll('.f99v6-tile img').forEach(im => { const drop = () => im.remove(); if (im.complete) { if (!im.naturalWidth) drop(); } else if (!im.dataset.f35Img) { im.dataset.f35Img = '1'; im.addEventListener('error', drop, {once: true}); } });
    list.querySelectorAll('.f99v6-tile').forEach(tile => {
      const name = tile.querySelector('h3')?.textContent || tile.querySelector('.f36-coming-title')?.textContent, p = prods.find(x => x.name === name); if (!p) return;
      tile.dataset.f35Key = p.key; const t = st.buttons?.[p.key], b = tile.querySelector('.f99v6-primary'); if (t && b && b.textContent !== t) b.textContent = t;
    });
    const ads = Array.isArray(st.ads) ? st.ads : []; let bar = root.querySelector('#f35-ads');
    const sig = JSON.stringify([st.version, ads.map(x => x.id)]);
    if (!ads.length) { bar?.remove(); stopAds(); return; }
    if (bar && bar.dataset.sig === sig && bar.nextElementSibling === list) return;
    bar?.remove(); stopAds(); bar = el('div', 'f35-ads'); bar.id = 'f35-ads'; bar.dataset.sig = sig; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'إعلانات المتجر');
    ads.forEach((ad, i) => { const it = el(ad.product_key ? 'button' : 'div', 'f35-ad m-' + (ad.motion || 'none') + (i ? '' : ' on'), ad.text); if (ad.product_key) { it.type = 'button'; it.onclick = () => { const tile = list.querySelector('[data-f35-key="' + CSS.escape(ad.product_key) + '"] .f99v6-primary'); if (tile) tile.click(); else if (isAqari(ad.product_key)) void openDetail(ad.product_key); }; } bar.append(it); });
    list.before(bar);
    if (ads.length > 1 && !reduce()) { let i = 0; adTimer = w.setInterval(() => { if (!bar.isConnected || d.hidden) return; const n = bar.children; n[i].classList.remove('on'); i = (i + 1) % n.length; n[i].classList.add('on'); }, 6000); }
    else bar.classList.add('f35-stack');
  }
  function stopAds() { if (adTimer) { w.clearInterval(adTimer); adTimer = 0; } }

  /* ---------- owner ---------- */
  function isOwner() { const a = access(); try { return a?.record?.owner === true && !!finoCentralAdminToken; } catch (_) { return a?.record?.owner === true; } }
  function ownerButton() {
    if (!isOwner() || d.getElementById('f35-owner-btn')) return;
    const bar = d.querySelector('#f73-owner-shortcuts .f73-owner-quick'), grid = d.querySelector('#ownerHub .owner-grid'); if (!bar && !grid) return;
    const b = el('button', bar ? 'f73-owner-btn' : 'owner-tile', null); b.id = 'f35-owner-btn'; b.type = 'button';
    if (bar) { b.textContent = '🏡 قبل تاخذ العقاري • حالات المنتجات والإعلانات'; bar.append(b); } else { b.append(el('span', 'owner-icon', '🏡'), el('b', '', 'قبل تاخذ العقاري'), el('small', '', 'المواعيد والأكواد وحالات المنتجات والإعلانات')); grid.prepend(b); }
    b.onclick = () => void openOwner('content');
  }
  let OD = null;
  async function openOwner(tab) {
    const my = serial + 1, body = sheet('إدارة «قبل تاخذ العقاري» والمتجر'), wt = wait(body);
    try { OD = await owner('get'); } catch (e) { if (my !== serial) return; wt.remove(); note(body, 'تعذر القراءة: ' + e.message, 'f35-err'); return; }
    if (my !== serial) return; wt.remove();
    const tabs = el('div', 'f35-tabs'), pane = el('div', 'f35-pane'); body.append(tabs, pane);
    const T = {content: 'المحتوى والروابط والكوبونات', schedule: 'الأيام والمواعيد', bookings: 'الحجوزات والتعويض', codes: 'الأكواد', store: 'حالات المنتجات والإعلانات'};
    Object.entries(T).forEach(([k, t]) => { const b = btn(tabs, t, () => show(k)); b.dataset.k = k; });
    function show(k) { tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); pane.textContent = ''; ({content: oContent, schedule: oSchedule, bookings: oBookings, codes: oCodes, store: oStore})[k](pane); }
    show(T[tab] ? tab : 'content');
  }
  function field(host, label, val, opt) { const l = el('label', 'f35-f'), x = el(opt?.area ? 'textarea' : 'input'); l.append(el('span', '', label)); if (opt?.type) x.type = opt.type; if (opt?.area) x.rows = opt.rows || 3; if (opt?.type === 'checkbox') x.checked = !!val; else x.value = val == null ? '' : String(val); if (opt?.ltr) x.dir = 'ltr'; l.append(x); host.append(l); return x; }
  function status(host) { let p = host.querySelector('.f35-status'); if (!p) { p = el('p', 'f35-note f35-status'); p.setAttribute('role', 'status'); host.append(p); } return p; }
  function oContent(p) {
    const c = OD.content, F = {}; const S = (k, label, o) => { F[k] = field(p, label, c[k], o); };
    S('name', 'اسم الباقة'); S('service_type', 'نوع الخدمة'); S('tagline', 'النص تحت اسم الباقة', {area: 1, rows: 7}); S('cta', 'نص الزر التسويقي'); S('image_url', 'رابط الصورة (https) — اختياري', {ltr: 1});
    S('details_title', 'عنوان التفاصيل'); F.topics = field(p, 'الموضوعات (سطر لكل موضوع)', (c.topics || []).join('\n'), {area: 1, rows: 10}); S('closing', 'النص الختامي', {area: 1});
    S('terms_title', 'عنوان صفحة الشروط'); F.terms = field(p, 'الشروط (السؤال في سطر ثم الإجابة في السطر التالي، وسطر فارغ بين كل بند)', (c.terms || []).map(t => t.q + '\n' + t.a).join('\n\n'), {area: 1, rows: 16});
    S('consent', 'نص الإقرار', {area: 1}); S('pay_button', 'زر الانتقال للدفع'); S('session_minutes', 'مدة الجلسة بالدقائق', {type: 'number'});
    S('price', 'سعر الباقة الأساسية (كما في سلة)', {type: 'number'}); S('base_url', 'رابط شراء الباقة الأساسية', {ltr: 1}); S('renew_price', 'سعر التجديد (كما في سلة)', {type: 'number'}); S('renew_url', 'رابط شراء التجديد', {ltr: 1});
    const cps = {}; ['base_coupon', 'renew_coupon'].forEach(k => { const box = el('fieldset', 'f35-fs'); box.append(el('legend', '', k === 'base_coupon' ? 'كوبون الباقة الأساسية' : 'كوبون التجديد')); cps[k] = {code: field(box, 'الكود', c[k]?.code, {ltr: 1}), percent: field(box, 'نسبة الخصم %', c[k]?.percent, {type: 'number'}), enabled: field(box, 'إظهار الكوبون للعميل (فعّله فقط بعد إنشائه في سلة)', c[k]?.enabled, {type: 'checkbox'})}; p.append(box); });
    S('contact', 'وسيلة التواصل الظاهرة في تأكيد الحجز', {area: 1}); S('ask_name', 'سؤال الاسم'); S('ask_phone', 'سؤال الجوال'); S('confirm_title', 'عنوان بطاقة التأكيد'); S('confirm_body', 'نص التأكيد ({name} {date} {time} {duration})', {area: 1, rows: 8});
    S('renew_name', 'اسم منتج التجديد'); S('renew_title', 'عنوان بطاقة التجديد'); S('renew_body', 'نص بطاقة التجديد', {area: 1}); S('renew_button', 'زر التجديد'); S('renew_later', 'زر الرفض');
    const st = status(p); btn(p, 'حفظ في المركزية', async ev => {
      const n = {}; Object.keys(F).forEach(k => { n[k] = F[k].value; }); ['session_minutes', 'price', 'renew_price'].forEach(k => { n[k] = Number(n[k]); });
      n.topics = String(F.topics.value).split('\n').map(x => x.trim()).filter(Boolean);
      n.terms = String(F.terms.value).split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(b => { const i = b.indexOf('\n'); return {q: (i < 0 ? b : b.slice(0, i)).trim(), a: (i < 0 ? '' : b.slice(i + 1)).trim()}; });
      Object.entries(cps).forEach(([k, v]) => { n[k] = {code: v.code.value.trim(), percent: Number(v.percent.value), enabled: v.enabled.checked}; });
      ev.target.disabled = true; st.textContent = 'جاري الحفظ…';
      try { const r = await owner('save_content', {expected_revision: OD.content.revision, content: n}); st.textContent = 'تم الحفظ (نسخة ' + r.revision + ').'; OD = await owner('get'); pub = null; }
      catch (e) { st.textContent = e.message === 'VERSION_CONFLICT' ? 'تغيّرت الإعدادات من جلسة ثانية؛ أعد فتح اللوحة.' : 'لم يُحفظ: ' + e.message; } finally { ev.target.disabled = false; }
    }, 'f35-primary');
  }
  function oSchedule(p) {
    const sc = OD.content.schedule || {}, days = new Set((sc.days || []).map(Number)); note(p, 'الأوقات بتوقيت الرياض. لا يظهر للعميل إلا الوقت المفتوح وغير المحجوز. الأقصى المسموح لنهاية الفترة 23:59.');
    const dy = el('fieldset', 'f35-fs'); dy.append(el('legend', '', 'الأيام المفتوحة')); const cb = {}; Object.entries(DAYS).forEach(([k, t]) => { cb[k] = field(dy, t, days.has(Number(k)), {type: 'checkbox'}); }); p.append(dy);
    const r1 = field(p, 'بداية الفترة الاعتيادية', sc.regular?.start, {type: 'time'}), r2 = field(p, 'نهاية الفترة الاعتيادية', sc.regular?.end, {type: 'time'});
    const e1 = field(p, 'بداية الفترة الإضافية', sc.extra?.start, {type: 'time'}), e2 = field(p, 'نهاية الفترة الإضافية', sc.extra?.end, {type: 'time'});
    const xb = field(p, 'فتح الفترة الإضافية لحجوزات الباقة الأساسية والتعويضات', sc.extra_base, {type: 'checkbox'}), xr = field(p, 'فتح الفترة الإضافية للتجديدات', sc.extra_renew, {type: 'checkbox'});
    const bl = field(p, 'أيام مغلقة (YYYY-MM-DD مفصولة بفواصل)', (sc.blocked_dates || []).join(', '), {ltr: 1}), hz = field(p, 'كم يوم قدام يظهر للعميل', sc.horizon_days || 30, {type: 'number'});
    const st = status(p); btn(p, 'حفظ المواعيد', async ev => {
      const n = {days: Object.keys(cb).filter(k => cb[k].checked).map(Number), regular: {start: r1.value, end: r2.value}, extra: {start: e1.value, end: e2.value}, extra_base: xb.checked, extra_renew: xr.checked,
        blocked_dates: bl.value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean), horizon_days: Number(hz.value)};
      ev.target.disabled = true; st.textContent = 'جاري الحفظ…';
      try { await owner('save_schedule', {expected_revision: OD.content.revision, schedule: n}); OD = await owner('get'); st.textContent = 'تم حفظ المواعيد.'; } catch (e) { st.textContent = 'لم يُحفظ: ' + e.message; } finally { ev.target.disabled = false; }
    }, 'f35-primary');
    note(p, 'فتح البيع أو الإيقاف من تبويب «حالات المنتجات والإعلانات».');
  }
  function oBookings(p) {
    const L = {confirmed: 'مؤكد', pending: 'بانتظار', cancelled: 'ملغي', completed: 'تمت الجلسة', no_show: 'لم يحضر'}, bs = OD.bookings || [];
    if (!bs.length) note(p, 'لا توجد حجوزات بعد.');
    bs.forEach(b => {
      const c = el('section', 'f35-card'); c.append(el('h3', '', fmtDate(b.starts_at) + ' • ' + fmtTime(b.starts_at)), el('p', '', (L[b.status] || b.status) + ' • ' + (b.name || '') + ' • ' + (b.phone || '') + ' • كود …' + (b.code_tail || '')));
      if (b.product_key === OD.content.renew_key) c.append(el('small', '', 'تجديد')); if (b.comp) c.append(el('small', '', 'تعذر رقم ' + b.comp.failure_no + ': ' + b.comp.reason)); if (b.owner_note) c.append(el('small', '', b.owner_note));
      if (b.status === 'confirmed') { const row = el('div', 'f35-actions'), m = el('p', 'f35-note'); c.append(row, m);
        const set = async (s, why) => { try { await owner('booking_status', {booking_id: b.id, status: s, note: why || ''}); OD = await owner('get'); p.textContent = ''; oBookings(p); } catch (e) { m.textContent = e.message === 'SESSION_NOT_STARTED' ? 'لا يمكن قبل وقت الموعد.' : 'تعذر: ' + e.message; } };
        btn(row, 'تمت الجلسة', () => set('completed')); btn(row, 'لم يحضر (بعد التحقق)', () => set('no_show'));
        btn(row, 'تعذرنا نحن (تعويض)', () => { const why = w.prompt('سبب التعذر (يُحفظ في السجل):'); if (why && why.trim().length >= 3) void set('provider_failed', why.trim()); }); }
      p.append(c);
    });
    const comps = (OD.comps || []).filter(x => x.choice === 'refund'); if (comps.length) { p.append(el('h3', '', 'طلبات الاسترداد')); comps.forEach(x => { const c = el('section', 'f35-card'); c.append(el('p', '', 'كود …' + x.code_tail + ' • ' + (x.refund_status === 'done' ? 'تم الاسترداد' : 'بانتظار الاسترداد'))); if (x.refund_status === 'requested') btn(c, 'تم الاسترداد', async () => { const n = w.prompt('ملاحظة الاسترداد (اختياري):') || ''; try { await owner('refund_done', {comp_id: x.id, note: n}); OD = await owner('get'); p.textContent = ''; oBookings(p); } catch (e) { c.append(el('p', 'f35-err', e.message)); } }); p.append(c); }); }
  }
  function oCodes(p) {
    note(p, 'كل دفعة منفصلة ومربوطة بمنتجها. الأكواد المحجوزة معطلة ولا تُعتبر مبيعة بالتصدير؛ لا تنشرها إلا بعد رفع الملف نفسه في منتج سلة الصحيح.');
    (OD.codes || []).forEach(a => {
      const renew = a.package_key === OD.content.renew_key, c = el('section', 'f35-card'), fname = renew ? 'FINO99_AQARI_RENEWAL_300_CODES.txt' : 'FINO99_AQARI_300_CODES.txt';
      c.append(el('h3', '', (renew ? 'أكواد التجديد' : 'أكواد الباقة الأساسية') + ' • ' + a.item_count + ' كود'), el('p', '', 'الحالة: ' + (a.state === 'published' ? 'منشورة للبيع' : 'محجوزة (غير مبيعة)') + ' • مستخدم: ' + a.used));
      const row = el('div', 'f35-actions'), m = el('p', 'f35-note'); c.append(row, m);
      btn(row, 'تنزيل ' + fname, async () => { try { const r = await owner('codes_export', {allocation_id: a.allocation_id}); const codes = extract(r); if (!codes.length) throw Error('NO_CODES'); const blob = new Blob([codes.join('\n') + '\n'], {type: 'text/plain'}); const u = URL.createObjectURL(blob), x = el('a'); x.href = u; x.download = fname; d.body.append(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); m.textContent = 'تم تنزيل ' + codes.length + ' كود.'; } catch (e) { m.textContent = 'تعذر: ' + e.message; } });
      if (a.state !== 'published') btn(row, 'رفعتها في سلة — انشرها', async ev => { if (ev.target.dataset.sure !== '1') { ev.target.dataset.sure = '1'; ev.target.textContent = 'تأكيد: رفعت الملف في منتج سلة الصحيح'; return; } try { await owner('codes_publish', {allocation_id: a.allocation_id, confirm_salla: true}); OD = await owner('get'); p.textContent = ''; oCodes(p); } catch (e) { m.textContent = 'تعذر: ' + e.message; } });
      p.append(c);
    });
  }
  function extract(r) { const out = new Set(); const walk = v => { if (typeof v === 'string') out.add(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.code === 'string') out.add(v.code); else Object.values(v).forEach(walk); } }; walk(r.codes || r.items || r.allocation?.codes || r); return [...out].filter(x => /^[A-Z0-9-]{6,64}$/.test(x)); }
  function oStore(p) {
    const sf = OD.storefront || {}, st = OD.store || {version: 1, buttons: {}, ads: []};
    note(p, 'لكل باقة حالة مستقلة: «تفاصيل المنتج» (منشورة، والشراء يبقى حسب تفعيلها وجاهزيتها)، «ستطلق قريبًا» (بدون شراء)، أو «إخفاء» (تبقى محفوظة بكامل إعداداتها وأكوادها).');
    const L = {details: 'تفاصيل المنتج', coming_soon: 'ستطلق قريبًا', hidden: 'إخفاء'}, inputs = {};
    (sf.products || []).filter(x => x.archived !== true).forEach(x => {
      const c = el('section', 'f35-card'), cur = x.catalog_visible === false ? 'hidden' : x.launch_status === 'coming_soon' ? 'coming_soon' : 'details';
      c.append(el('h3', '', x.name || x.key)); const sel = el('select'); Object.entries(L).forEach(([k, t]) => { const o = el('option', '', t); o.value = k; o.selected = k === cur; sel.append(o); });
      const m = el('p', 'f35-note'); const l = el('label', 'f35-f'); l.append(el('span', '', 'الحالة'), sel); c.append(l);
      inputs[x.key] = field(c, 'نص زر البطاقة (اتركه فارغًا للنص الافتراضي)', st.buttons?.[x.key] || '');
      btn(c, 'تطبيق الحالة', async ev => { ev.target.disabled = true; try { const r = await owner('product_state', {key: x.key, state: sel.value, expected_version: String(OD.storefront.version)}); OD = await owner('get'); m.textContent = 'تم: ' + L[sel.value] + (sel.value === 'details' && r.product?.enabled !== true ? ' — الشراء غير مفعّل لهذه الباقة.' : ''); pub = null; } catch (e) { m.textContent = /STOCK|CHECKOUT|URL/i.test(e.message) ? 'لا يمكن فتح البيع قبل نشر أكواد في المخزون ورابط دفع صحيح.' : 'تعذر: ' + e.message; } finally { ev.target.disabled = false; } });
      c.append(m); p.append(c);
    });
    if (typeof w.F99V49OpenStoreContent === 'function') btn(p, 'نص «ستطلق قريبًا» وحركته وصور الباقات (المحرر الحالي)', () => { close(); void w.F99V49OpenStoreContent(); });
    const adsBox = el('section', 'f35-card'); adsBox.append(el('h3', '', 'إعلانات المتجر (شريط بسيط أعلى الباقات)')); p.append(adsBox); const rows = [];
    const addRow = ad => { const r = el('fieldset', 'f35-fs'), o = {id: ad.id || ('ad-' + uuid().slice(0, 8))}; o.text = field(r, 'نص الإعلان', ad.text || ''); const ps = el('select'); [['', 'عام']].concat((sf.products || []).map(x => [x.key, x.name || x.key])).forEach(([k, t]) => { const op = el('option', '', t); op.value = k; op.selected = (ad.product_key || '') === k; ps.append(op); }); const l1 = el('label', 'f35-f'); l1.append(el('span', '', 'مرتبط بباقة (يفتح تفاصيلها)'), ps); r.append(l1); o.product = ps;
      const ms = el('select'); [['none', 'ثابت'], ['fade', 'ظهور ناعم'], ['slide', 'انزلاق خفيف']].forEach(([k, t]) => { const op = el('option', '', t); op.value = k; op.selected = (ad.motion || 'fade') === k; ms.append(op); }); const l2 = el('label', 'f35-f'); l2.append(el('span', '', 'الحركة'), ms); r.append(l2); o.motion = ms;
      o.visible = field(r, 'ظاهر', ad.visible !== false, {type: 'checkbox'}); o.ends = field(r, 'ينتهي في (اختياري)', ad.ends_at ? String(ad.ends_at).slice(0, 16) : '', {type: 'datetime-local'});
      btn(r, 'حذف الإعلان', () => { r.remove(); rows.splice(rows.indexOf(o), 1); }); adsBox.append(r); rows.push(o); };
    (st.ads || []).forEach(addRow); const row = el('div', 'f35-actions'); p.append(row); btn(row, 'إضافة إعلان', () => addRow({}));
    const ss = status(p); btn(row, 'حفظ الإعلانات ونصوص الأزرار', async ev => {
      const buttons = {}; Object.entries(inputs).forEach(([k, i]) => { if (i.value.trim()) buttons[k] = i.value.trim(); });
      const ads = rows.map(o => ({id: o.id, text: o.text.value.trim(), visible: o.visible.checked, motion: o.motion.value, product_key: o.product.value || null, ends_at: o.ends.value ? new Date(o.ends.value).toISOString() : null}));
      ev.target.disabled = true; try { await owner('store_save', {expected_version: st.version, buttons, ads}); OD = await owner('get'); pub = null; ss.textContent = 'تم الحفظ.'; p.textContent = ''; oStore(p); } catch (e) { ss.textContent = 'لم يُحفظ: ' + e.message; } finally { ev.target.disabled = false; }
    }, 'f35-primary');
  }

  /* ---------- hooks (wrap, never replace engines) ---------- */
  function hook() {
    const A = w.F99Appointments;
    if (A && !A.f35) { w.F99Appointments = Object.freeze({...A, f35: true,
      openOffer: function (k) { return isAqari(k) ? openDetail(k) : A.openOffer.apply(this, arguments); },
      openClient: function (e, k) { const key = (typeof k === 'string' && k) || codeKey(); return isAqari(key) ? openClient(key) : A.openClient.apply(this, arguments); }}); }
    for (const n of ['F99O2OpenForEntry', 'F99O2OpenClient']) { const f = w[n]; if (typeof f === 'function' && !f.f35) { const g = function (e, k) { const key = (typeof k === 'string' && k) || codeKey(); return isAqari(key) ? openClient(key) : f.apply(this, arguments); }; g.f35 = true; w[n] = g; } }
  }
  // Window capture registered before service_tools/appointments: only «قبل تاخذ العقاري» tiles are taken; all others untouched.
  w.addEventListener('click', ev => {
    const b = ev.target?.closest?.('#f99s-modal .f99v6-tile .f99v6-primary'); if (!b) return;
    const tile = b.closest('.f99v6-tile'), key = tile?.dataset.productKey || tile?.dataset.f35Key; if (!isAqari(key)) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); void openDetail(key);
  }, true);
  let queued = false;
  function tick() { if (queued) return; queued = true; (w.requestAnimationFrame || setTimeout)(() => { queued = false; try { hook(); decorate(); ownerButton(); } catch (_) {} }); }
  function start() { tick(); if (typeof w.MutationObserver === 'function') new w.MutationObserver(tick).observe(d.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden']}); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, {once: true}); else start();
  w.F99Aqari35 = Object.freeze({openDetail, openTerms, openClient, openOwner, reload: () => loadPublic(true)});
})(window, document);
