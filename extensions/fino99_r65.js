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
  const E = () => W.F99RE42Engine || null;
  async function pub() {
    if (PUB && Date.now() - PUBAT < 60000) return PUB;
    if (typeof W.finoRpc !== 'function') return null;
    if (PUBQ) return PUBQ;
    PUBQ = (async () => { try { const r = await W.finoRpc('f99r65_public', {}, 12000); if (r && r.ok && r.data && r.data.ok) { PUB = r.data; PUBAT = Date.now(); } } catch (e) {} PUBQ = null; return PUB; })();
    return PUBQ;
  }
  function closeAll() { const o = D.getElementById('r65-ov'); if (o) o.remove(); }
  function shell(title) {
    closeAll(); const ov = el('div', 'r65-ov'); ov.id = 'r65-ov'; ov.setAttribute('dir', 'rtl');
    const box = el('div', 'r65-box'); const hd = el('div', 'r65-hd'); hd.append(el('b', '', title || ''));
    btn(hd, '×', closeAll, 'r65-x').setAttribute('aria-label', 'إغلاق');
    const body = el('div', 'r65-body'); box.append(hd, body); ov.append(box);
    ov.addEventListener('click', e => { if (e.target === ov) closeAll(); }); D.body.append(ov); return body;
  }
  // r70: package state «نفدت أكواد هذه الباقة» (saved by the owner in the store product) — no new purchase from this page; activation codes keep working.
  const SOLD = key => { try { const a = ((W.FINO99ReadStorefront && W.FINO99ReadStorefront()) || {}).products || []; const x = a.find(y => y && y.key === key); return x && x.sold_out === true && x.enabled === true && x.launch_status !== 'coming_soon' ? (String(x.sold_out_text || '').trim().slice(0, 180) || 'نفدت أكواد هذه الباقة') : ''; } catch (e) { return ''; } };
  const soldNote = (host, t) => { const d = el('div', 'r65-soldout', t); d.setAttribute('role', 'note'); d.setAttribute('aria-disabled', 'true'); host.append(d); };
  function T(P, k, d) { const t = (P && P.texts) || {}; return t[k] != null && t[k] !== '' ? t[k] : d; }
  function buy(P) {
    const so = SOLD(P.key); if (so) { const b = shell('حسبة التمويل العقاري'); act(b); soldNote(b, so); return; }
    const u = String((P.product || {}).url || '');
    if (/^https:\/\//.test(u)) { W.open(u, '_blank', 'noopener'); return; }
    const body = shell('اشتر الآن'); body.append(el('p', 'r65-note', 'الشراء سيتاح قريبًا.')); btn(body, 'رجوع', () => page(P), 'alt');
  }
  // r68: «لديك كود خصم؟» — same server mechanism as «اختصر مشاويرك» (f99v55_coupon_availability / f99v55_stacked_coupon_preview), mortgage key only.
  // A discount code is never used to activate anything inside FINO99; it is copied and pasted at the payment platform.
  async function copyText(t) {
    try { if (W.navigator.clipboard && W.isSecureContext) { await W.navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { const a = el('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; D.body.append(a); a.select(); a.setSelectionRange(0, t.length); const ok = D.execCommand('copy'); a.remove(); return !!ok; } catch (e) { return false; }
  }
  const CPN = { INVALID_COUPON: 'أدخل كودًا صالحًا.', COUPON_NOT_ACTIVE_FOR_PACKAGE: 'الكود غير صالح لهذه الباقة.', COUPON_PAUSED_OR_OUTSIDE_WINDOW: 'الكود غير متاح حاليًا.', COUPON_LIMIT_OR_PAYMENT_NOT_READY: 'الكود غير متاح حاليًا.', COUPON_FIELD_DISABLED: 'الخصم غير متاح حاليًا لهذه الباقة.' };
  async function disc(P, host) {
    let a = null; try { const r = await W.finoRpc('f99v55_coupon_availability', { p_package_key: P.key }, 12000); a = r && r.ok ? r.data : null; } catch (e) {}
    if (!a || a.available !== true || !host.isConnected) return;
    const w = el('div', 'r65-disc'); const f = el('div', 'r65-disc-f'); f.hidden = true;
    const i = el('input'); i.placeholder = 'أدخل كود الخصم'; i.maxLength = 40; i.autocapitalize = 'characters'; i.setAttribute('dir', 'ltr'); f.append(i);
    btn(w, 'لديك كود خصم؟', () => { f.hidden = !f.hidden; if (!f.hidden) i.focus(); }, 'alt'); w.append(f);
    const out = el('div', 'r65-disc-o');
    const ap = btn(f, 'تطبيق الكود وعرض السعر الجديد', async () => {
      const code = String(i.value || '').replace(/\s+/g, '').toUpperCase(); out.innerHTML = '';
      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) { out.append(el('p', 'r65-err', 'أدخل كودًا صالحًا.')); return; }
      ap.disabled = true; let q = null;
      try { const r = await W.finoRpc('f99v55_stacked_coupon_preview', { p_package_key: P.key, p_code: code }, 12000); q = r && r.ok ? r.data : null; } catch (e) {} ap.disabled = false;
      if (!q || q.ok !== true) { out.append(el('p', 'r65-err', CPN[q && q.reason] || 'تعذر التحقق من الكود، حاول مرة أخرى.')); return; }
      out.append(el('p', 'r65-ok', 'السعر بعد خصم الكود: ' + fmt(q.final_preview) + ' ريال'));
      out.append(el('p', 'r65-note', 'كود الخصم للدفع فقط، وكود تفعيل الباقة يصلك بعد إتمام الشراء.'));
      const cd = el('div', 'r65-code', code); cd.setAttribute('dir', 'ltr'); out.append(cd);
      const msg = el('p', ''); const row = el('div', 'r65-row');
      btn(row, 'نسخ الكود', async () => { const ok = await copyText(code); msg.className = ok ? 'r65-ok' : 'r65-warn'; msg.textContent = ok ? 'تم نسخ الرمز، الصقه في خانة كود الخصم عند إتمام الدفع.' : 'انسخ الرمز يدويًا: ' + code; pay.hidden = false; }, 'go');
      const pay = btn(row, 'إكمال الدفع', () => buy(P), 'go'); pay.hidden = true; out.append(row, msg);
    }, 'go');
    f.append(out); host.append(w);
  }
  // r69: «هل لديك كود؟» = the package ACTIVATION code (not a discount code), inline inside this page, same shape/position as the store tile box
  // (above «اشتر الآن»). It uses the existing central login (#password + window.login) — entering a code or opening the chat consumes no calculation.
  function act(host) {
    const box = el('section', 'r65-act'); const f = el('div', 'r65-act-f'); f.hidden = true;
    const i = el('input'); i.id = 'r65-code'; i.autocomplete = 'off'; i.autocapitalize = 'characters'; i.spellcheck = false; i.setAttribute('dir', 'ltr'); i.maxLength = 40; i.placeholder = 'الصق الكود هنا';
    const st = el('p', 'r65-act-s'); st.setAttribute('role', 'status');
    btn(box, 'هل لديك كود؟', () => { f.hidden = !f.hidden; if (!f.hidden) i.focus(); }, 'r65-tog'); f.append(i, st); box.append(f);
    const ok = btn(f, 'تأكيد الكود', async () => {
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
    host.append(box); return box;
  }
  function page(P) {
    const pr = P.product || {}, pk = P.package || {};
    const body = shell(pr.name || 'حسبة التمويل العقاري');
    if (pr.image) { const im = el('img', 'r65-img'); im.src = pr.image; im.alt = pr.name || ''; body.append(im); }
    const pz = el('div', 'r65-price');
    if (Number(pr.old_price) > Number(pr.price)) pz.append(el('s', '', fmt(pr.old_price) + ' ريال'));
    if (pr.price != null && pr.price !== '') pz.append(el('b', '', fmt(pr.price) + ' ريال'));
    body.append(pz);
    const hrs = Number(pk.hours) || 24, qr = Number(pk.quota_ref) || 3, qc = pk.custom_enabled === false ? 0 : (Number(pk.quota_custom) || 0);
    const ul = el('ul', 'r65-list');
    ul.append(el('li', '', 'الصلاحية: ' + (hrs === 24 ? 'يوم واحد (24 ساعة)' : hrs + ' ساعة') + ' من أول تفعيل'));
    ul.append(el('li', '', qr + ' حسبات بالنسب المرجعية المعلنة'));
    if (qc) ul.append(el('li', '', 'قارن حتى ' + qc + ' نسب تمويلية تدخلها بنفسك'));
    body.append(el('p', 'r65-sub', T(P, 'r65_landing_sub', 'حسبة مبدئية لتمويلك العقاري مع مقارنة البنوك.')), ul);
    act(body); const so = SOLD(P.key); if (so) { soldNote(body, so); return; } const row = el('div', 'r65-row'); btn(row, 'اشتر الآن', () => elig(P), 'go'); body.append(row);
  }
  // ---------- eligibility (no salary or financing data) — r71 order: وحدة جاهزة ← سكني ← سعودي ← القطاع ← الميلاد; texts/show/allowed sectors editable by the owner ----------
  function elig(P) {
    const body = shell('فحص أهلية مبدئي'); const st = {};
    const EL = (P.package && P.package.elig) || {}; const on = k => !(EL[k] && EL[k].show === false); const SE = EL.sector || {};
    const allowed = Array.isArray(SE.allowed) ? SE.allowed : ['gov', 'semi', 'military', 'retired'];
    const stop = t => { body.innerHTML = ''; body.append(el('p', 'r65-note', t)); const r = el('div', 'r65-row'); btn(r, 'تعديل الإجابة', () => q0(), 'alt'); btn(r, 'إغلاق', closeAll, 'alt'); body.append(r); };
    const yn = (q, yes, no, ly, ln) => { body.innerHTML = ''; body.append(el('p', 'r65-q', q)); const r = el('div', 'r65-row'); btn(r, ly || 'نعم', yes); btn(r, ln || 'لا', () => stop(no), 'alt'); body.append(r); };
    // r71: first question — ready unit from the market only (no = apology, no move to the calculation); owner can edit/hide it.
    const q0 = () => on('ready') ? yn(T(P, 'r65_q_ready', 'هل تمويلك العقاري لشراء وحدة سكنية جاهزة من السوق؟'), qS, T(P, 'r65_no_ready', 'نعتذر منك، هذه الباقة مخصصة لحساب تمويل شراء الوحدات السكنية الجاهزة من السوق فقط، ولا تشمل الرهن العقاري أو البناء الذاتي أو البيع على الخارطة.'), 'نعم، وحدة جاهزة من السوق', 'لا') : qS();
    const qS = () => on('sakani') ? yn(T(P, 'r65_q_sakani', 'هل أنت مدعوم من سكني؟'), q1, T(P, 'r65_no_sakani', 'نعتذر منك، هذه الباقة متاحة حاليًا للمستفيدين المدعومين من سكني فقط.')) : q1();
    const q1 = () => on('saudi') ? yn(T(P, 'r65_q_saudi', 'هل أنت سعودي؟'), q2, T(P, 'r65_not_saudi', 'نعتذر منك، هذه الباقة متاحة حاليًا للمواطنين السعوديين فقط.')) : q2();
    const q2 = () => { if (!on('sector')) { st.sector = { key: '', label: '', extend: true, retire_age: null }; q3(); return; }
      body.innerHTML = ''; body.append(el('p', 'r65-q', T(P, 'r65_q_sector', 'ما قطاع عملك؟'))); const g = el('div', 'r65-grid');
      (P.sectors || []).forEach(s => { const ok = allowed.indexOf(s.key) >= 0; if (ok || SE.show_na !== false) btn(g, s.label, () => { if (!ok) { stop(T(P, 'r65_sector_na', 'نعتذر منك، هذا القطاع غير متاح حاليًا في هذه الباقة.')); return; } st.sector = s; q3(); }, 'alt'); });
      body.append(g); };
    const q3 = () => { body.innerHTML = ''; const s = st.sector; const n = s.key ? T(P, 'r65_note_' + s.key, '') : '';
      if (s.label) body.append(el('p', 'r65-meta', 'القطاع: ' + s.label)); if (n) body.append(el('p', 'r65-warn', n));
      body.append(el('p', 'r65-q', 'تاريخ الميلاد')); let cal = 'hijri';
      const tg = el('div', 'r65-row'); const bh = btn(tg, 'هجري', () => setCal('hijri'), 'tg on'); const bg = btn(tg, 'ميلادي', () => setCal('greg'), 'tg'); body.append(tg);
      const f = el('div', 'r65-date'); const mk = ph => { const i = el('input'); i.type = 'text'; i.inputMode = 'numeric'; i.placeholder = ph; i.maxLength = 4; f.append(i); return i; };
      const dd = mk('اليوم'), mm = mk('الشهر'), yy = mk('السنة'); body.append(f); const er = el('p', 'r65-err'); body.append(er);
      function setCal(c) { cal = c; bh.classList.toggle('on', c === 'hijri'); bg.classList.toggle('on', c === 'greg'); yy.placeholder = c === 'hijri' ? 'السنة مثل 1405' : 'السنة مثل 1985'; }
      setCal('hijri');
      btn(body, 'تحقق', () => { er.textContent = ''; const x = { y: num(yy.value), m: num(mm.value), d: num(dd.value) }; const e = E();
        if (!e) { er.textContent = 'تعذر التحقق الآن، حاول مرة أخرى.'; return; }
        let g = null; try { g = cal === 'hijri' ? (x.y >= 1300 && x.y <= 1450 && x.m >= 1 && x.m <= 12 && x.d >= 1 && x.d <= 30 ? e.fromHijri(x) : null) : (x.y >= 1900 && e.validG(x) ? x : null); } catch (z) { g = null; }
        if (!g) { er.textContent = 'اكتب تاريخًا صحيحًا (اليوم / الشهر / السنة).'; return; }
        st.birth = g; result(); }, 'go');
    };
    const result = () => { body.innerHTML = ''; const e = E(); const s = st.sector; const L = P.limits || {}; const term = Number(P.term) || 240;
      let age = 0; try { age = e.monthsBetween(e.toHijri(st.birth), e.toHijri(e.riyadhToday())); } catch (z) { age = 0; } // Hijri months
      const maxAge = Math.max(Number(L.max_age_end) || 70, Number(P.bank_max_age) || 0);
      const toMax = maxAge * 12 - age; const ret = Number(s.retire_age) || 0;
      const avail = s.extend === true || !ret ? toMax : Math.min(toMax, ret * 12 - age);
      const yrs = Math.floor(age / 12);
      body.append(el('p', 'r65-meta', (s.label ? 'القطاع: ' + s.label + ' — ' : '') + 'العمر التقريبي: ' + yrs + ' سنة هجرية'));
      if (age < 18 * 12) { body.append(el('p', 'r65-warn', 'العمر أقل من الحد المطلوب للتمويل.')); btn(body, 'تعديل البيانات', () => q0(), 'alt'); return; }
      if (avail >= term) {
        body.append(el('p', 'r65-ok', 'مبدئيًا: عمرك وقطاعك يسمحان بالتمويل حتى ' + term + ' شهرًا' + (s.extend === true && ret && age + term > ret * 12 ? ' مع التمويل بعد التقاعد حسب سياسة البنك.' : '.')));
        body.append(el('p', 'r65-note', 'هذا فحص مبدئي للعمر والمدة فقط، والحسبة الكاملة بعد التفعيل.'));
        act(body); const r = el('div', 'r65-row'); btn(r, 'اشتر الآن', () => buy(P), 'go'); body.append(r); disc(P, body);
      } else {
        const m = Math.max(0, Math.floor(avail));
        body.append(el('p', 'r65-warn', 'حسب عمرك وقطاعك، المدة المتاحة مبدئيًا ' + m + ' شهرًا، وهي أقل من ' + term + ' شهرًا المعتمدة حاليًا في هذه الباقة؛ لذلك قد لا تناسبك الباقة الآن.'));
        const r = el('div', 'r65-row'); btn(r, 'تعديل البيانات', () => q0(), 'alt'); btn(r, 'إغلاق', closeAll, 'alt'); body.append(r);
      }
    };
    q0();
  }
  async function open() {
    let b0 = null; if (!(PUB && Date.now() - PUBAT < 60000)) { b0 = shell('حسبة التمويل العقاري'); b0.append(el('p', 'r65-note', 'جاري التحميل…')); }
    const P = await pub(); if (b0 && !b0.isConnected) return;
    if (!P) { const b = shell('حسبة التمويل العقاري'); b.append(el('p', 'r65-note', 'تعذر تحميل الباقة الآن، حاول مرة أخرى.')); return; } page(P);
  }
  // store button of this package → this page (capture phase; other packages untouched). r68: also before f99r65_public has loaded (known key), so the click never falls through to the generic store window.
  D.addEventListener('click', async ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('[data-f40-key]') : null; if (!t) return;
    const P = PUB || null; if (t.dataset.f40Key !== (P && P.key ? P.key : MKEY)) return; if (P && !(P.product && P.product.enabled === true)) return;
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); open();
  }, true);
  W.F99R65 = { open, eligibility: async () => { const P = await pub(); if (P) elig(P); } };
  function css68() { // r68: the package page must sit above the store window (#f99s-modal z 2147483100), otherwise it opens behind it and «اشتر الآن» looks unresponsive
     if (D.getElementById('r65-css68')) return; const s = el('style'); s.id = 'r65-css68'; s.textContent = '#r65-ov.r65-ov{z-index:2147483200}.r65-disc,.r65-disc-f,.r65-disc-o{display:flex;flex-direction:column;gap:8px}.r65-disc-f[hidden],.r65-btn[hidden]{display:none}.r65-disc input{font-size:16px;padding:10px;border:1px solid #cfd8e3;border-radius:10px;text-align:center;letter-spacing:1px}#r65-ov .r65-act,#r65-ov .r65-act-f{display:grid;gap:7px;direction:rtl}#r65-ov .r65-act{padding:8px 0 10px;margin-top:7px}#r65-ov .r65-act *{box-sizing:border-box}#r65-ov .r65-act-f[hidden]{display:none!important}#r65-ov .r65-act .r65-btn{appearance:none;width:100%;border:1px solid #c2d7e3;border-radius:11px;background:#f3f8fb;color:#185375;min-height:44px;padding:10px 13px;font-family:inherit;font-weight:850;cursor:pointer}#r65-ov .r65-act .r65-btn.r65-tog{border:1px dashed #9bbdcf;background:#f7fbfd;color:#245b77}#r65-ov .r65-act .r65-btn.r65-cbtn{background:#14658b;color:#fff;border-color:#14658b}#r65-ov .r65-act .r65-btn:disabled{opacity:.55;cursor:wait}#r65-ov .r65-act input{width:100%;padding:9px;border:1px solid #afcad8;border-radius:10px;font-size:16px;direction:ltr;text-align:left}#r65-ov .r65-act-s{margin:0;font-size:12px;line-height:1.7;color:#285e77}#r65-ov .r65-act-s:empty{display:none}#r65-ov .r65-act-s.r65-err{color:#b42318}#r65-ov .r65-soldout{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:12px;border-radius:12px;border:1px solid #e7c3c3;background:#fff4f4;color:#9b1c1c;font-weight:900;text-align:center;line-height:1.6;cursor:default;-webkit-user-select:none;user-select:none}.r65-code{font:800 20px/1.4 ui-monospace,Menlo,monospace;text-align:center;border:2px dashed #0a5187;border-radius:12px;padding:10px;color:#0a5187;-webkit-user-select:all;user-select:all}'; (D.head || D.documentElement).append(s); }
  const go = () => { css68(); try { if (new URLSearchParams(W.location.search).get('p') === 'mortgage') setTimeout(open, 400); } catch (e) {} pub(); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', go); else go();
})();
