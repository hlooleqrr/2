/* FINO99 r65 — mortgage package page before payment: «هل لديك كود؟ (تفعيل) | اشتر الآن» + short pre-purchase eligibility check.
   No payment gateway is created; «اشتر الآن» opens the payment link the owner saves in the package settings.
   No salary or financing data is asked before payment. Visibility/launch flags are not changed here. */
(function () {
  'use strict';
  const W = window, D = document;
  let PUB = null, PUBAT = 0, PUBQ = null;
  const MKEY = 'pkg-c0bbb7e7-55d8-4ad6-ae0a-27045c96639f'; // r68: mortgage store key, used only until f99r65_public has loaded
  const el = (t, c, x) => { const e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (p, label, fn, c) => { const b = el('button', 'r65-btn' + (c ? ' ' + c : ''), label); b.type = 'button'; b.onclick = fn; p.append(b); return b; };
  const num = v => Number(String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^0-9.]/g, ''));
  const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmt2 = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const E = () => W.F99RE42Engine || null;
  async function pub() {
    if (PUB && Date.now() - PUBAT < 60000) return PUB;
    if (typeof W.finoRpc !== 'function') return null;
    if (PUBQ) return PUBQ;
    PUBQ = (async () => { try { const r = await W.finoRpc('f99r65_public', {}, 12000); if (r && r.ok && r.data && r.data.ok) { PUB = r.data; PUBAT = Date.now(); } } catch (e) {} PUBQ = null; return PUB; })();
    return PUBQ;
  }
  // r72: the package page is a real page inside the store window (#f99s-modal), same structure/classes as «اختصر مشاويرك» detail page — no overlay over the store.
  const NM = P => String(((P && P.product) || {}).name || '').trim() || 'حسبة فورية للتمويل العقاري';
  const SM = () => D.getElementById('f99s-modal');
  function closeAll() { const o = D.getElementById('r65-ov'); if (o && o.classList.contains('r65-ov')) o.remove(); const m = SM(); if (m && !m.hidden) { try { m.click(); } catch (e) {} if (!m.hidden) { m.hidden = true; m.replaceChildren(); } } }
  const store = () => { if (typeof W.FINO99OpenStorefront === 'function') W.FINO99OpenStorefront(); else closeAll(); };
  function shell(title, back) {
    let m = SM(); if (!m && typeof W.FINO99OpenStorefront === 'function') { try { W.FINO99OpenStorefront(); } catch (e) {} m = SM(); }
    if (!m) { m = el('div'); m.id = 'f99s-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); D.body.append(m); }
    m.replaceChildren(); const box = el('main', 'f99s-sheet'); const hd = el('header', 'f99v6-h'); const h = el('h2', '', title || ''); h.id = 'f99s-dialog-title'; hd.append(h);
    const x = el('button', '', 'رجوع'); x.type = 'button'; x.onclick = back || closeAll; hd.append(x); box.append(hd);
    const w = el('div'); w.id = 'r65-ov'; w.setAttribute('dir', 'rtl'); box.append(w); m.append(box); m.hidden = false; try { m.scrollTop = 0; box.scrollTop = 0; } catch (e) {} return w;
  }
  const pbtn = (p, label, fn, c) => { const b = el('button', c || 'f99v6-primary', label); b.type = 'button'; b.onclick = fn; p.append(b); return b; };
  const NOPAY = 'رابط الدفع لهذه الباقة غير متاح حاليًا، ولم يُفتح أي رابط. إذا كان لديك كود تفعيل فأدخله من «هل لديك كود؟».';
  // r70: package state «نفدت أكواد هذه الباقة» (saved by the owner in the store product) — no new purchase from this page; activation codes keep working.
  const SOLD = key => { try { const a = ((W.FINO99ReadStorefront && W.FINO99ReadStorefront()) || {}).products || []; const x = a.find(y => y && y.key === key); return x && x.sold_out === true && x.enabled === true && x.launch_status !== 'coming_soon' ? (String(x.sold_out_text || '').trim().slice(0, 180) || 'نفدت أكواد هذه الباقة') : ''; } catch (e) { return ''; } };
  const soldNote = (host, t) => { const d = el('div', 'r65-soldout', t); d.setAttribute('role', 'note'); d.setAttribute('aria-disabled', 'true'); host.append(d); };
  function T(P, k, d) { const t = (P && P.texts) || {}; return t[k] != null && t[k] !== '' ? t[k] : d; }
  function buy(P, host) { // r72: opens the saved payment link only; without a link it says so in place (no page loop)
    const so = SOLD(P.key); if (so) { if (host) soldNote(host, so); return; }
    const u = String((P.product || {}).url || '');
    if (/^https:\/\/[^\s]+$/.test(u)) { W.open(u, '_blank', 'noopener'); return; }
    if (host) host.append(el('p', 'f99v10-msg', NOPAY));
  }
  // r68: «لديك كود خصم؟» — same server mechanism as «اختصر مشاويرك» (f99v55_coupon_availability / f99v55_stacked_coupon_preview), mortgage key only.
  // A discount code is never used to activate anything inside FINO99; it is copied and pasted at the payment platform.
  async function copyText(t) {
    try { if (W.navigator.clipboard && W.isSecureContext) { await W.navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { const a = el('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; D.body.append(a); a.select(); a.setSelectionRange(0, t.length); const ok = D.execCommand('copy'); a.remove(); return !!ok; } catch (e) { return false; }
  }
  const CBAD = 'كود الخصم غير صحيح، تأكد من الرمز وحاول مرة ثانية'; // r76
  const CPN = { INVALID_COUPON: CBAD, COUPON_NOT_ACTIVE_FOR_PACKAGE: CBAD, COUPON_PAUSED_OR_OUTSIDE_WINDOW: 'الكود غير متاح حاليًا.', COUPON_LIMIT_OR_PAYMENT_NOT_READY: 'الكود غير متاح حاليًا.', COUPON_FIELD_DISABLED: 'الخصم غير متاح حاليًا لهذه الباقة.' };
  async function disc(P, host) {
    let a = null; try { const r = await W.finoRpc('f99v55_coupon_availability', { p_package_key: P.key }, 12000); a = r && r.ok ? r.data : null; } catch (e) {}
    if (!a || a.available !== true || !host.isConnected) return;
    const w = el('div', 'r65-disc'); const f = el('div', 'r65-disc-f'); f.hidden = true;
    const i = el('input'); i.placeholder = 'ألصق كود الخصم هنا'; i.maxLength = 40; i.autocapitalize = 'characters'; i.setAttribute('dir', 'ltr'); f.append(el('p', 'r65-note', 'هذه الخانة لكود الخصم، وليست لتفعيل الباقة'), i); // r78
    btn(w, 'هل لديك كود خصم؟', () => { f.hidden = !f.hidden; if (!f.hidden) i.focus(); }, 'alt'); w.append(f);
    const out = el('div', 'r65-disc-o');
    const ap = btn(f, 'تطبيق الكود وعرض السعر الجديد', async () => {
      const code = String(i.value || '').replace(/\s+/g, '').toUpperCase(); out.innerHTML = '';
      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) { out.append(el('p', 'r65-err', CBAD)); return; }
      ap.disabled = true; let q = null;
      try { const r = await W.finoRpc('f99v55_stacked_coupon_preview', { p_package_key: P.key, p_code: code }, 12000); q = r && r.ok ? r.data : null; } catch (e) {} ap.disabled = false;
      if (!q || q.ok !== true) { out.append(el('p', 'r65-err', CPN[q && q.reason] || 'تعذر التحقق من الكود، حاول مرة أخرى.')); return; }
      out.append(el('p', 'r65-ok', 'السعر بعد خصم الكود: ' + fmt(q.final_preview) + ' ريال'));
      out.append(el('p', 'r65-note', 'كود الخصم للدفع فقط، وكود تفعيل الباقة يصلك بعد إتمام الشراء.'));
      const cd = el('div', 'r65-code', code); cd.setAttribute('dir', 'ltr'); out.append(cd);
      const msg = el('p', ''); const row = el('div', 'r65-row');
      btn(row, 'نسخ الكود', async () => { const ok = await copyText(code); msg.className = ok ? 'r65-ok' : 'r65-warn'; msg.textContent = ok ? 'تم نسخ الرمز، الصقه في خانة كود الخصم عند إتمام الدفع.' : 'انسخ الرمز يدويًا: ' + code; pay.hidden = false; }, 'go');
      const pay = btn(row, 'إكمال الدفع', () => buy(P, out), 'go'); pay.hidden = true; out.append(row, msg);
    }, 'go');
    f.append(out); host.append(w);
  }
  // r69: «هل لديك كود؟» = the package ACTIVATION code (not a discount code), inline inside this page, same shape/position as the store tile box
  // (above «اشتر الآن»). It uses the existing central login (#password + window.login) — entering a code or opening the chat consumes no calculation.
  function act(host, ref) { // r76: ref = place the box before it (store tile, above «اشتر الآن»); same single activation path
    const box = el('section', 'r65-act'); const f = el('div', 'r65-act-f'); f.hidden = true;
    const i = el('input'); if (!ref) i.id = 'r65-code'; i.autocomplete = 'off'; i.autocapitalize = 'characters'; i.spellcheck = false; i.setAttribute('dir', 'ltr'); i.maxLength = 40; i.placeholder = 'ألصق كود التفعيل هنا';
    const st = el('p', 'r65-act-s'); st.setAttribute('role', 'status');
    btn(box, 'هل لديك كود؟', () => { f.hidden = !f.hidden; if (!f.hidden) i.focus(); }, 'r65-tog'); f.append(i, st); box.append(f);
    const ok = btn(f, 'تفعيل الكود', async () => {
      const raw = String(i.value || '').trim(); const x = typeof W.F99V8ExtractCode === 'function' ? W.F99V8ExtractCode(raw) : raw.toUpperCase();
      const s = /^[A-Z0-9-]{8,32}$/.test(x) ? x : ''; if (s) i.value = s;
      if (!s) { st.className = 'r65-act-s r65-err'; st.textContent = 'أدخل كودًا صحيحًا بدون كلمات إضافية.'; return; }
      const pw = D.getElementById('password'), le = D.getElementById('loginError'), lc = D.getElementById('f99l-code'), SS = W.F99SessionSecurity;
      if (!pw || typeof W.login !== 'function') { st.className = 'r65-act-s r65-err'; st.textContent = 'نظام الدخول غير متاح حاليًا.'; return; }
      const tk = () => { try { return SS && typeof SS.entryContext === 'function' ? (SS.entryContext() || {}).entryToken || '' : null; } catch (e) { return ''; } }, t0 = tk();
      pw.value = s; if (lc) lc.value = s; if (le) { le.style.display = 'none'; le.textContent = ''; } ok.disabled = true; st.className = 'r65-act-s'; st.textContent = 'جاري التحقق من الكود...';
      try { await W.login(); } catch (e) {} ok.disabled = false;
      const t1 = tk(), fine = t1 === null ? !(le && le.style.display === 'block') : !!t1 && t1 !== t0;
      if (!fine) { const t = le && le.style.display === 'block' ? String(le.textContent || '').trim() : ''; st.className = 'r65-act-s r65-err'; st.textContent = !t || /المركزية|SQL|V2[0-9]|وظيف|rpc|PGRST/i.test(t) ? 'تعذر التحقق من الكود. تأكد منه وأعد المحاولة.' : t; return; }
      st.textContent = ''; closeAll(); const m = D.getElementById('f99s-modal'); if (m && !m.hidden) { try { m.click(); } catch (e) {} }
    }, 'r65-cbtn');
    f.append(ok); i.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ok.click(); } });
    if (ref) ref.before(box); else host.append(box); return box;
  }
  // r76: the same activation box on the mortgage store tile, above «اشتر الآن» (like «اختصر مشاويرك»). If the owner enables discount coupons for this
  // package, the f64 discount box on this tile is labelled «هل لديك كود خصم؟» so activation and discount never mix. Other tiles untouched.
  let TQ = 0;
  function tile() { TQ = 0; const m = SM(); if (!m || m.hidden) return; if (PUB && !(PUB.product && PUB.product.enabled === true)) return;
    const b = m.querySelector('.f99v6-tile [data-f40-key="' + (PUB && PUB.key ? PUB.key : MKEY) + '"]'); const t = b && b.closest('.f99v6-tile'); if (!t) return;
    const d = t.querySelector('.f64-code-entry .f64-toggle'); if (d && d.textContent !== 'هل لديك كود خصم؟') { d.textContent = 'هل لديك كود خصم؟'; const x = t.querySelector('.f64-code-entry input'); if (x) x.placeholder = 'ألصق كود الخصم هنا'; }
    if (!t.querySelector('.r65-act')) act(t, t.querySelector('.f64-code-entry') || b); }
  // r78: red notice (shared builder in fino99_re42.js) — from the first page of the mortgage calculation
  const note78 = (host, P) => { try { if (typeof W.F99R78Notice === 'function') W.F99R78Notice(host, null, P && P.rates_dates); } catch (e) {} };
  // r78: store «اشتر الآن» → the first eligibility question directly (no intermediate page repeating image/price/buttons)
  function page(P) {
    const body = shell(NM(P), store); note78(body, P);
    const so = SOLD(P.key); if (so) { soldNote(body, so); act(body); return; }
    elig(P, body);
  }
  function summary(P, host) { // r78: package details on the purchase page (texts/limits unchanged)
    const pr = P.product || {}, pk = P.package || {};
    const pz = el('div', 'f99v6-summary'); pz.append(el('h3', 'r65-name', NM(P)));
    if (pr.price != null && pr.price !== '') pz.append(el('strong', '', fmt2(pr.price) + ' ريال'));
    if (Number(pr.old_price) > Number(pr.price)) pz.append(el('s', '', fmt2(pr.old_price) + ' ريال'));
    host.append(pz);
    const hrs = Number(pk.hours) || 24, qr = Number(pk.quota_ref) || 3, qc = pk.custom_enabled === false ? 0 : (Number(pk.quota_custom) || 0);
    const ul = el('ul', 'r65-list');
    ul.append(el('li', '', 'الصلاحية: ' + (hrs === 24 ? 'يوم واحد (24 ساعة)' : hrs + ' ساعة') + ' من أول تفعيل'));
    ul.append(el('li', '', qr + ' حسبات بالنسب المرجعية المعلنة'));
    if (qc) ul.append(el('li', '', 'قارن حتى ' + qc + ' نسب تمويلية تدخلها بنفسك'));
    ul.append(el('li', '', 'المنتج المدعوم: شراء وحدة سكنية جاهزة من السوق فقط'));
    ul.append(el('li', '', 'المدة المدعومة: ' + (Number(P.term) || 240) + ' شهرًا فقط'));
    pz.append(el('p', 'r65-sub', T(P, 'r65_landing_sub', 'حسبة مبدئية لتمويلك العقاري مع مقارنة جهات التمويل.')), ul);
  }
  // ---------- eligibility (no salary or financing data) inside the same page, «اختصر مشاويرك» flow style (الخطوة n من N + اختيار + السابق/التالي)
  // r78 order: سعودي ← سكني ← القطاع ← وحدة جاهزة ← مدة 240 شهرًا ← الميلاد (existing age/term check); texts/show/allowed sectors editable by the owner. No RPC, no use deducted.
  function elig(P, body) {
    const st = {}; const fl = el('section', 'f99v10-flow'); body.append(fl);
    const EL = (P.package && P.package.elig) || {}; const on = k => !(EL[k] && EL[k].show === false); const SE = EL.sector || {};
    const allowed = Array.isArray(SE.allowed) ? SE.allowed : ['gov', 'semi', 'military', 'retired'];
    const S = ['saudi', 'sakani', 'sector', 'ready'].filter(on).concat(on('term') ? ['term'] : []).concat(['birth']); const N = S.length;
    const top = () => { try { fl.scrollIntoView({ block: 'start' }); } catch (e) {} };
    const frame = (i, t) => { fl.replaceChildren(); const h = el('div', 'f99v10-flowhead'); h.append(el('span', '', 'الخطوة ' + (i + 1) + ' من ' + N), el('strong', '', t)); fl.append(h); };
    const note = (t, k) => { const n = el('p', 'f99v10-msg', t || ''); n.dataset.kind = k || 'error'; fl.append(n); return n; };
    const acts = (i, fn, cap) => { const r = el('div', 'f99v10-actions'); if (i > 0) pbtn(r, 'السابق', () => step(i - 1), 'f99v6-text'); if (fn) pbtn(r, cap || 'التالي', fn); fl.append(r); };
    const stop = (i, t) => { fl.replaceChildren(); const x = el('section', 'f99v13-rejection'); x.append(el('h3', '', 'نعتذر لك'), el('p', '', t)); fl.append(x); const r = el('div', 'f99v10-actions'); pbtn(r, 'تعديل الإجابة', () => step(i), 'f99v6-text'); pbtn(r, 'العودة إلى المتجر', store); fl.append(r); top(); };
    const sel = (i, q, opts, val, pick) => { frame(i, q); const lb = el('label', 'f99v10-field'); const s = D.createElement('select'); s.setAttribute('aria-label', q); /* r76: question shown once (step head) */ opts.forEach(([v, t]) => s.append(new Option(t, v))); s.value = val || ''; lb.append(s); fl.append(lb); const out = note('', 'info');
      const go = () => { if (!s.value) { out.textContent = 'اختر إجابة للمتابعة.'; return; } pick(s.value); }; s.onchange = go; acts(i, go); top(); };
    const yn = (i, k, q, no, ly, ln) => sel(i, q, [['', 'اختر الإجابة'], ['yes', ly || 'نعم'], ['no', ln || 'لا']], st[k], v => { st[k] = v; if (v === 'yes') step(i + 1); else stop(i, no); });
    const Q = {
      // r71: ready unit from the market only (no = apology, no move to the calculation)
      ready: i => yn(i, 'ready', T(P, 'r65_q_ready', 'هل تمويلك العقاري لشراء وحدة سكنية جاهزة من السوق؟'), T(P, 'r65_no_ready', 'نعتذر منك، هذه الباقة مخصصة لحساب تمويل شراء الوحدات السكنية الجاهزة من السوق فقط، ولا تشمل الرهن العقاري أو البناء الذاتي أو البيع على الخارطة.'), 'نعم، وحدة جاهزة من السوق', 'لا'),
      sakani: i => yn(i, 'sakani', T(P, 'r65_q_sakani', 'هل أنت مدعوم من سكني؟'), T(P, 'r65_no_sakani', 'نعتذر منك، هذه الباقة متاحة حاليًا للمستفيدين المدعومين من سكني فقط.')),
      saudi: i => yn(i, 'saudi', T(P, 'r65_q_saudi', 'هل أنت سعودي؟'), T(P, 'r65_not_saudi', 'نعتذر منك، هذه الباقة متاحة حاليًا للمواطنين السعوديين فقط.')),
      sector: i => { const L = (P.sectors || []).filter(s => allowed.indexOf(s.key) >= 0 || SE.show_na === true); // r78: supported sectors only
        sel(i, T(P, 'r65_q_sector', 'ما قطاع عملك؟'), [['', 'حدد القطاع']].concat(L.map(s => [s.key, s.label])), st.sector && st.sector.key, v => { const s = L.find(x => x.key === v); if (!s || allowed.indexOf(v) < 0) { stop(i, T(P, 'r65_sector_na', 'نعتذر منك، هذا القطاع غير متاح حاليًا في هذه الباقة.')); return; } st.sector = s; step(i + 1); }); },
      birth: i => { frame(i, 'تاريخ الميلاد'); const s = st.sector; const n = s.key ? T(P, 'r65_note_' + s.key, '') : '';
        if (s.label) fl.append(el('p', 'r65-meta', 'القطاع: ' + s.label)); if (n) fl.append(el('p', 'r65-warn', n));
        const lb = el('label', 'f99v10-field', 'نوع التاريخ'); const cs = D.createElement('select'); [['hijri', 'هجري'], ['greg', 'ميلادي']].forEach(([v, t]) => cs.append(new Option(t, v))); cs.value = st.cal || 'hijri'; lb.append(cs); fl.append(lb);
        const f = el('div', 'r65-date'); const mk = ph => { const x = el('input'); x.type = 'text'; x.inputMode = 'numeric'; x.placeholder = ph; x.maxLength = 4; f.append(x); return x; };
        const dd = mk('اليوم'), mm = mk('الشهر'), yy = mk('السنة'); fl.append(f); const er = note('');
        const setCal = () => { yy.placeholder = cs.value === 'hijri' ? 'السنة مثل 1405' : 'السنة مثل 1985'; }; cs.onchange = setCal; setCal();
        acts(i, () => { er.textContent = ''; const x = { y: num(yy.value), m: num(mm.value), d: num(dd.value) }; const e = E(); const cal = cs.value;
          if (!e) { er.textContent = 'تعذر التحقق الآن، حاول مرة أخرى.'; return; }
          let g = null; try { g = cal === 'hijri' ? (x.y >= 1300 && x.y <= 1450 && x.m >= 1 && x.m <= 12 && x.d >= 1 && x.d <= 30 ? e.fromHijri(x) : null) : (x.y >= 1900 && e.validG(x) ? x : null); } catch (z) { g = null; }
          if (!g) { er.textContent = 'اكتب تاريخًا صحيحًا (اليوم / الشهر / السنة).'; return; }
          st.cal = cal; st.birth = g; result(i); }); top(); },
      // r72: mandatory last question before payment — the package calculates 240 months only (term/formulas unchanged); «لا» = apology and no payment step.
      term: i => yn(i, 'term', T(P, 'r65_q_term', 'هل تعلم أن هذه الباقة تدعم مدة تمويل 240 شهرًا (20 سنة) فقط؟'), T(P, 'r65_no_term', 'نعتذر منك، هذه الباقة مخصصة لحساب التمويل العقاري لمدة 20 سنة (240 شهرًا) فقط، ولا تدعم حاليًا حساب مدد تمويل أخرى.'), 'نعم، أعلم', 'لا، لا أعلم')
    };
    const step = i => { if (i >= N) { checkout(P, st.okMsg); return; } Q[S[i]](i); };
    const result = i => { const e = E(); const s = st.sector; const L = P.limits || {}; const term = Number(P.term) || 240;
      let age = 0; try { age = e.monthsBetween(e.toHijri(st.birth), e.toHijri(e.riyadhToday())); } catch (z) { age = 0; } // Hijri months
      const maxAge = Math.max(Number(L.max_age_end) || 70, Number(P.bank_max_age) || 0);
      const toMax = maxAge * 12 - age; const ret = Number(s.retire_age) || 0;
      const avail = s.extend === true || !ret ? toMax : Math.min(toMax, ret * 12 - age);
      const meta = (s.label ? 'القطاع: ' + s.label + ' — ' : '') + 'العمر التقريبي: ' + Math.floor(age / 12) + ' سنة هجرية. ';
      if (age < 18 * 12) { stop(i, meta + 'العمر أقل من الحد المطلوب للتمويل.'); return; }
      if (avail < term) { stop(i, meta + 'حسب عمرك وقطاعك، المدة المتاحة مبدئيًا ' + Math.max(0, Math.floor(avail)) + ' شهرًا، وهي أقل من ' + term + ' شهرًا المعتمدة حاليًا في هذه الباقة؛ لذلك قد لا تناسبك الباقة الآن.'); return; }
      st.okMsg = 'مبدئيًا: عمرك وقطاعك يسمحان بالتمويل حتى ' + term + ' شهرًا' + (s.extend === true && ret && age + term > ret * 12 ? ' مع التمويل بعد التقاعد حسب سياسة جهة التمويل.' : '.');
      step(i + 1); };
    if (!on('sector')) st.sector = { key: '', label: '', extend: true, retire_age: null };
    step(0);
  }
  // r72: purchase step after eligibility (same shape as the store checkout page): instructions, discount code (payment only), the saved payment link, activation code.
  function checkout(P, okMsg) {
    const b = shell('إتمام شراء ' + NM(P), () => page(P)); note78(b, P); summary(P, b); // r78: short purchase page (name, price, struck price, details)
    if (okMsg) b.append(el('p', 'r65-ok', okMsg)); b.append(el('p', 'r65-note', 'هذا فحص مبدئي للعمر والمدة فقط، والحسبة الكاملة بعد التفعيل.'));
    const so = SOLD(P.key); if (so) { soldNote(b, so); act(b); return; }
    let C = {}; try { C = (W.FINO99ReadStorefront && W.FINO99ReadStorefront()) || {}; } catch (e) {}
    const tx = String(C.checkout_instructions || '1. أكمل الدفع واستلم رمز التفعيل.\n2. انسخ الرمز وحده كما يظهر لك.\n3. ارجع إلى موقع FINO99 واختر «أدخل الكود» ثم اضغط «دخول».').slice(0, 1100);
    const g = el('section', 'f26-checkout-guide'); g.append(el('h3', '', 'بعد إتمام الشراء')); const s = el('div', 'f27-instructions'); tx.split(/\n/).map(x => x.trim()).filter(Boolean).forEach(l => s.append(el('p', '', l))); g.append(s); b.append(g);
    const dh = el('div'); b.append(dh); disc(P, dh);
    const u = String((P.product || {}).url || '');
    if (/^https:\/\/[^\s]+$/.test(u)) { const a = el('a', 'f99v6-primary', 'إتمام الشراء'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.checkout = 'link'; b.append(a); }
    else b.append(el('p', 'f99v10-msg', NOPAY));
  }
  async function open() {
    let b0 = null; if (!(PUB && Date.now() - PUBAT < 60000)) { b0 = shell(NM(PUB)); b0.append(el('p', 'r65-note', 'جاري التحميل…')); }
    const P = await pub(); if (b0 && !b0.isConnected) return;
    if (!P) { const b = shell(NM(null)); b.append(el('p', 'r65-note', 'تعذر تحميل الباقة الآن، حاول مرة أخرى.')); return; } page(P);
  }
  // store button of this package → this page (capture phase; other packages untouched). r68: also before f99r65_public has loaded (known key), so the click never falls through to the generic store window.
  D.addEventListener('click', async ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('[data-f40-key]') : null; if (!t) return;
    const P = PUB || null; if (t.dataset.f40Key !== (P && P.key ? P.key : MKEY)) return; if (P && !(P.product && P.product.enabled === true)) return;
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); open();
  }, true);
  W.F99R65 = { open, eligibility: async () => { const P = await pub(); if (P) page(P); } };
  function css68() { // r68: the package page must sit above the store window (#f99s-modal z 2147483100), otherwise it opens behind it and «اشتر الآن» looks unresponsive
     if (D.getElementById('r65-css68')) return; const s = el('style'); s.id = 'r65-css68'; s.textContent = '#r65-ov .r65-img{display:block;width:auto;max-width:100%;height:auto;max-height:none;object-fit:contain;margin:0 auto 12px;border-radius:12px}#r65-ov .r65-sub{margin:8px 0 4px;font-size:14px;color:inherit}#r65-ov .r65-list{margin:0;padding-inline-start:18px;font-size:14px;line-height:1.8}#r65-ov .r65-low{display:grid;gap:10px;margin-top:12px}#r65-ov a.f99v6-primary,#r65-ov .r65-low>.f99v6-primary{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;margin-top:10px}#r65-ov .r65-ok,#r65-ov .r65-note{margin:8px 0}#r65-ov .r65-date{margin:4px 0 6px}#r65-ov.r65-ov{z-index:2147483200}.r65-disc,.r65-disc-f,.r65-disc-o{display:flex;flex-direction:column;gap:8px}.r65-disc-f[hidden],.r65-btn[hidden]{display:none}.r65-disc input{font-size:16px;padding:10px;border:1px solid #cfd8e3;border-radius:10px;text-align:center;letter-spacing:1px}:is(#r65-ov,#f99s-modal) .r65-act,:is(#r65-ov,#f99s-modal) .r65-act-f{display:grid;gap:7px;direction:rtl}:is(#r65-ov,#f99s-modal) .r65-act{padding:8px 0 10px;margin-top:7px}:is(#r65-ov,#f99s-modal) .r65-act *{box-sizing:border-box}:is(#r65-ov,#f99s-modal) .r65-act-f[hidden]{display:none!important}:is(#r65-ov,#f99s-modal) .r65-act .r65-btn{appearance:none;width:100%;border:1px solid #c2d7e3;border-radius:11px;background:#f3f8fb;color:#185375;min-height:44px;padding:10px 13px;font-family:inherit;font-weight:850;cursor:pointer}:is(#r65-ov,#f99s-modal) .r65-act .r65-btn.r65-tog{border:1px dashed #9bbdcf;background:#f7fbfd;color:#245b77}:is(#r65-ov,#f99s-modal) .r65-act .r65-btn.r65-cbtn{background:#14658b;color:#fff;border-color:#14658b}:is(#r65-ov,#f99s-modal) .r65-act .r65-btn:disabled{opacity:.55;cursor:wait}:is(#r65-ov,#f99s-modal) .r65-act input{width:100%;padding:9px;border:1px solid #afcad8;border-radius:10px;font-size:16px;direction:ltr;text-align:left}:is(#r65-ov,#f99s-modal) .r65-act-s{margin:0;font-size:12px;line-height:1.7;color:#285e77}:is(#r65-ov,#f99s-modal) .r65-act-s:empty{display:none}:is(#r65-ov,#f99s-modal) .r65-act-s.r65-err{color:#b42318}#r65-ov .r65-soldout{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:12px;border-radius:12px;border:1px solid #e7c3c3;background:#fff4f4;color:#9b1c1c;font-weight:900;text-align:center;line-height:1.6;cursor:default;-webkit-user-select:none;user-select:none}.r65-code{font:800 20px/1.4 ui-monospace,Menlo,monospace;text-align:center;border:2px dashed #0a5187;border-radius:12px;padding:10px;color:#0a5187;-webkit-user-select:all;user-select:all}#f99s-modal .r65-act input{padding:9px 6px;text-align:center}#f99s-modal .r65-act input::placeholder{font-size:12px}#r65-ov .r65-img{max-height:210px;width:auto;margin:0 auto 10px}#r65-ov .f99v6-summary>strong{display:inline-block}#r65-ov .f99v6-summary>s{display:inline-block;margin-inline-start:10px}#r65-ov .r65-low{margin-top:8px;gap:8px}#r65-ov .f99v10-flow{margin-top:10px}#r65-ov .f99v10-flowhead strong{font-size:19px;line-height:1.5}#r65-ov .f99v10-field select{width:100%;max-width:100%;box-sizing:border-box}#r65-ov .f99v10-actions{display:flex;flex-wrap:wrap;gap:8px}#r65-ov .f99v10-actions>button{flex:1 1 0;min-width:0}#r65-ov .r65-name{margin:0 0 6px;font-size:17px;line-height:1.5}'; (D.head || D.documentElement).append(s); }
  const go = () => { css68(); try { new MutationObserver(() => { if (!TQ) TQ = requestAnimationFrame(tile); }).observe(D.documentElement, { childList: true, subtree: true }); } catch (e) {} try { if (new URLSearchParams(W.location.search).get('p') === 'mortgage') setTimeout(open, 400); } catch (e) {} pub(); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', go); else go();
})();
