/* FINO99 r65 — mortgage package page before payment: «اشتر الآن | لديك كود؟» + short pre-purchase eligibility check.
   No payment gateway is created; «اشتر الآن» opens the payment link the owner saves in the package settings.
   No salary or financing data is asked before payment. Visibility/launch flags are not changed here. */
(function () {
  'use strict';
  const W = window, D = document;
  let PUB = null, PUBAT = 0;
  const el = (t, c, x) => { const e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (p, label, fn, c) => { const b = el('button', 'r65-btn' + (c ? ' ' + c : ''), label); b.type = 'button'; b.onclick = fn; p.append(b); return b; };
  const num = v => Number(String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^0-9.]/g, ''));
  const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const E = () => W.F99RE42Engine || null;
  async function pub() {
    if (PUB && Date.now() - PUBAT < 60000) return PUB;
    if (typeof W.finoRpc !== 'function') return null;
    try { const r = await W.finoRpc('f99r65_public', {}, 12000); if (r && r.ok && r.data && r.data.ok) { PUB = r.data; PUBAT = Date.now(); } } catch (e) {}
    return PUB;
  }
  function closeAll() { const o = D.getElementById('r65-ov'); if (o) o.remove(); }
  function shell(title) {
    closeAll(); const ov = el('div', 'r65-ov'); ov.id = 'r65-ov'; ov.setAttribute('dir', 'rtl');
    const box = el('div', 'r65-box'); const hd = el('div', 'r65-hd'); hd.append(el('b', '', title || ''));
    btn(hd, '×', closeAll, 'r65-x').setAttribute('aria-label', 'إغلاق');
    const body = el('div', 'r65-body'); box.append(hd, body); ov.append(box);
    ov.addEventListener('click', e => { if (e.target === ov) closeAll(); }); D.body.append(ov); return body;
  }
  function T(P, k, d) { const t = (P && P.texts) || {}; return t[k] != null && t[k] !== '' ? t[k] : d; }
  function buy(P) {
    const u = String((P.product || {}).url || '');
    if (/^https:\/\//.test(u)) { W.open(u, '_blank', 'noopener'); return; }
    const body = shell('اشتر الآن'); body.append(el('p', 'r65-note', 'الشراء سيتاح قريبًا.')); btn(body, 'رجوع', () => page(P), 'alt');
  }
  function haveCode() {
    closeAll(); const m = D.getElementById('f99s-modal'); if (m && !m.hidden && m.offsetParent !== null) { try { m.click(); } catch (e) {} }
    setTimeout(() => { const l = D.getElementById('f99l-code-link'); if (l && l.offsetParent !== null) { l.click(); }
      setTimeout(() => { const i = D.getElementById('f99l-code') || D.getElementById('password'); if (i) { try { i.scrollIntoView({ block: 'center' }); i.focus(); } catch (e) {} } }, 120); }, 80);
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
    if (qc) ul.append(el('li', '', qc + ' حسبات بنسبة أو عرض خاص من بنكك'));
    body.append(el('p', 'r65-sub', T(P, 'r65_landing_sub', 'حسبة مبدئية لتمويلك العقاري مع مقارنة البنوك.')), ul);
    const row = el('div', 'r65-row'); btn(row, 'اشتر الآن', () => elig(P), 'go'); btn(row, 'لديك كود؟', haveCode, 'alt'); body.append(row);
  }
  // ---------- eligibility (no salary or financing data) ----------
  function elig(P) {
    const body = shell('فحص أهلية مبدئي'); const st = {};
    const q1 = () => { body.innerHTML = ''; body.append(el('p', 'r65-q', 'هل أنت سعودي الجنسية؟')); const r = el('div', 'r65-row');
      btn(r, 'نعم', () => q2()); btn(r, 'لا', () => { body.innerHTML = ''; body.append(el('p', 'r65-note', T(P, 'r65_not_saudi', 'نعتذر منك، هذه الباقة متاحة حاليًا للمواطنين السعوديين فقط.'))); btn(body, 'إغلاق', closeAll, 'alt'); }, 'alt'); body.append(r); };
    const q2 = () => { body.innerHTML = ''; body.append(el('p', 'r65-q', 'اختر القطاع')); const g = el('div', 'r65-grid');
      (P.sectors || []).forEach(s => btn(g, s.label, () => { st.sector = s; q3(); }, 'alt')); body.append(g); };
    const q3 = () => { body.innerHTML = ''; const s = st.sector; const n = T(P, 'r65_note_' + s.key, '');
      body.append(el('p', 'r65-meta', 'القطاع: ' + s.label)); if (n) body.append(el('p', 'r65-warn', n));
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
      body.append(el('p', 'r65-meta', 'القطاع: ' + s.label + ' — العمر التقريبي: ' + yrs + ' سنة هجرية'));
      if (age < 18 * 12) { body.append(el('p', 'r65-warn', 'العمر أقل من الحد المطلوب للتمويل.')); btn(body, 'تعديل البيانات', () => q1(), 'alt'); return; }
      if (avail >= term) {
        body.append(el('p', 'r65-ok', 'مبدئيًا: عمرك وقطاعك يسمحان بالتمويل حتى ' + term + ' شهرًا' + (s.extend === true && ret && age + term > ret * 12 ? ' مع التمويل بعد التقاعد حسب سياسة البنك.' : '.')));
        body.append(el('p', 'r65-note', 'هذا فحص مبدئي للعمر والمدة فقط، والحسبة الكاملة بعد التفعيل.'));
        const r = el('div', 'r65-row'); btn(r, 'اشتر الآن', () => buy(P), 'go'); btn(r, 'لديك كود؟', haveCode, 'alt'); body.append(r);
      } else {
        const m = Math.max(0, Math.floor(avail));
        body.append(el('p', 'r65-warn', 'حسب عمرك وقطاعك، المدة المتاحة مبدئيًا ' + m + ' شهرًا، وهي أقل من ' + term + ' شهرًا المعتمدة حاليًا في هذه الباقة؛ لذلك قد لا تناسبك الباقة الآن.'));
        const r = el('div', 'r65-row'); btn(r, 'تعديل البيانات', () => q1(), 'alt'); btn(r, 'إغلاق', closeAll, 'alt'); body.append(r);
      }
    };
    q1();
  }
  async function open() { const P = await pub(); if (!P) { const b = shell('حسبة التمويل العقاري'); b.append(el('p', 'r65-note', 'تعذر تحميل الباقة الآن، حاول مرة أخرى.')); return; } page(P); }
  // store button of this package → this page, only once the owner has enabled the product (capture phase; other packages untouched)
  D.addEventListener('click', async ev => {
    const t = ev.target && ev.target.closest ? ev.target.closest('[data-f40-key]') : null; if (!t) return;
    const P = PUB || null; if (!P || !P.key || t.dataset.f40Key !== P.key || !(P.product && P.product.enabled === true)) return;
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); open();
  }, true);
  W.F99R65 = { open, eligibility: async () => { const P = await pub(); if (P) elig(P); } };
  const go = () => { try { if (new URLSearchParams(W.location.search).get('p') === 'mortgage') setTimeout(open, 400); } catch (e) {} pub(); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', go); else go();
})();
