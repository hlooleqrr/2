/* FINO99 r42 — «احتساب التمويل العقاري فورًا»: smart bot + independent owner control center.
 * Uses only new RPCs f99re_owner / f99re_public and the independent engine F99RE42Engine.
 * Does not modify personal finance, debt buyout, codes, contracts, fees or payments. Banks/logos are read from the existing BANKS list (read-only).
 */
(function () {
  'use strict';
  if (window.F99RE42) return;
  const W = window, D = document, E = () => W.F99RE42Engine;
  const el = (t, c, x) => { const e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (p, t, fn, c) => { const b = el('button', 're42-btn' + (c ? ' ' + c : ''), t); b.type = 'button'; b.onclick = fn; if (p) p.append(b); return b; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const digits = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٬,\s]/g, '').replace('٫', '.');
  const money = s => { const v = Number(digits(s)); return Number.isFinite(v) ? v : NaN; };
  const fmt = n => (E() ? E().r1(n) : Math.round(n)).toLocaleString('en-US');
  const pct = n => Number(n).toFixed(2) + '%';
  const monthsTxt = n => n === 1 ? 'شهر واحد' : n === 2 ? 'شهران' : (n >= 3 && n <= 10) ? n + ' أشهر' : n + ' شهرًا';
  const yearsTxt = n => n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتان' : (n >= 3 && n <= 10) ? n + ' سنوات' : n + ' سنة';
  const durTxt = m => { const y = Math.floor(m / 12), r = m % 12; if (!y) return monthsTxt(r); if (!r) return yearsTxt(y); return yearsTxt(y) + ' و' + monthsTxt(r); };
  const gStr = g => g ? String(g.d).padStart(2, '0') + '/' + String(g.m).padStart(2, '0') + '/' + g.y : '';
  const tpl = (s, d) => String(s || '').replace(/\{name\}/g, (d && d.name) || '');
  const ERR = { BIRTH_INVALID: 'تاريخ الميلاد غير صحيح', AGE_OUT_OF_RANGE: 'العمر خارج النطاق المسموح للتمويل', NET_REQUIRED: 'أدخل الراتب الصافي', RANK_REQUIRED: 'اختر الرتبة',
    RANK_AGE_MISSING: 'سن التقاعد لهذه الرتبة غير محدد في الإعدادات', APPOINT_INVALID: 'تاريخ التعيين غير صحيح', BASIC_REQUIRED: 'أدخل الراتب الأساسي', EXCL_INVALID: 'المدة غير المحتسبة أكبر من مدة خدمتك' };
  // ---------- platform access (read-only use of existing globals) ----------
  function isOwner() { try { return !!(typeof activeAccess !== 'undefined' && activeAccess && activeAccess.record && activeAccess.record.owner && typeof finoCentralAdminToken !== 'undefined' && finoCentralAdminToken); } catch (e) { return false; } }
  async function ownerCall(action, data) {
    if (typeof finoCentralAdminCall !== 'function') throw Error('اتصال المركزية غير متاح');
    const r = await finoCentralAdminCall('f99re_owner', { p_action: action, p_data: data || {} });
    if (!r || !r.ok) throw Error((r && r.reason) || 'تعذر الاتصال بالمركزية');
    if (r.data && r.data.ok === false) throw Error(r.data.reason || 'رفض الطلب');
    return r.data;
  }
  let pubCache = null, pubAt = 0;
  async function pub() {
    if (pubCache && Date.now() - pubAt < 60000) return pubCache;
    if (typeof finoRpc !== 'function') return null;
    const r = await finoRpc('f99re_public', {}, 12000); if (!r || !r.ok) return null; pubCache = r.data; pubAt = Date.now(); return pubCache;
  }
  function bankLogo(id) { try { if (typeof BANKS !== 'undefined') { const b = BANKS.find(x => x.id === id); if (b && b.logo) return b.logo; } } catch (e) {} return ''; }
  function logoBox(b) {
    const box = el('span', 're42-logo'); const src = !b.test && bankLogo(b.id);
    if (src) { const i = el('img'); i.src = src; i.alt = 'شعار ' + b.name; i.loading = 'lazy'; box.append(i); } else box.append(el('b', '', b.test ? 'اختبار' : (b.name || '?').slice(0, 2)));
    return box;
  }
  // ---------- overlay ----------
  function sheet(title, cls) {
    const ov = el('div', 're42-ov' + (cls ? ' ' + cls : '')); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.dir = 'rtl';
    const box = el('div', 're42-sheet'); const head = el('div', 're42-head'); head.append(el('b', '', title));
    const x = btn(head, '✕', () => ov.remove(), 're42-x'); x.setAttribute('aria-label', 'إغلاق');
    const body = el('div', 're42-body'); box.append(head, body); ov.append(box); D.body.append(ov); return { ov, box, body, head };
  }
  function toast(msg, bad) { const t = el('div', 're42-toast' + (bad ? ' bad' : ''), msg); D.body.append(t); setTimeout(() => t.remove(), 3200); }

  // =====================================================================
  //                               THE BOT
  // =====================================================================
  function openBot(opt) {
    const cfg = opt.cfg; const T = cfg.texts || {}; const trial = !!opt.trial;
    const S = { data: { obligations: [] }, months: null, extend: null, plan: cfg.default_plan || 'step', offers: {}, plans: {}, entity: null, history: [], showRest: false, metered: {} };
    const sh = sheet('احتساب التمويل العقاري فورًا', 're42-bot'); const log = el('div', 're42-log'); const dock = el('div', 're42-dock'); sh.body.append(log, dock);
    if (trial) sh.head.append(el('span', 're42-trial', 'وضع التجربة'));
    if (opt.preview) sh.head.append(el('span', 're42-trial alt', opt.preview));
    const scroll = () => { requestAnimationFrame(() => { sh.body.scrollTop = sh.body.scrollHeight; }); };
    const bot = (txt, cls) => { const b = el('div', 're42-msg bot' + (cls ? ' ' + cls : '')); if (txt) b.textContent = txt; log.append(b); scroll(); return b; };
    const me = txt => { const b = el('div', 're42-msg me', txt); log.append(b); scroll(); };
    const clearDock = () => { dock.innerHTML = ''; };
    const sectors = () => (cfg.sectors || []).filter(s => s.enabled !== false);
    const isMil = () => S.data.sector === 'military';
    const rankObj = () => ((cfg.military || {}).ranks || []).find(r => r.key === S.data.rank);
    const entities = sec => (cfg.entities || []).filter(e => !e.sector || e.sector === sec).map(e => e.name);
    const Q = {}; (cfg.questions || []).forEach(q => { Q[q.key] = q; });
    const order = (cfg.questions || []).map(q => q.key);
    const visible = k => {
      const d = S.data; if (Q[k] && Q[k].enabled === false && !['name', 'sector', 'birth', 'net'].includes(k) && !(isMil() && ['rank', 'mil_entity', 'appoint', 'basic'].includes(k))) return false;
      if (['rank', 'mil_entity', 'appoint', 'basic'].includes(k)) return isMil();
      if (k === 'pilot') { const r = rankObj(); return isMil() && r && r.group === 'officer' && Number(r.pilot_age) > 0; }
      if (k === 'employer') return !!d.sector && !isMil() && d.sector !== 'retired';
      if (k === 'property') return (cfg.properties || []).filter(p => p.enabled !== false).length > 0;
      return true;
    };
    const answered = k => k === 'appoint' ? (S.data.appoint != null && S.data.excl_months != null) : k === 'obligations' ? !!S.data.obl_done : k === 'support' ? S.data.supported != null : S.data[k] != null && S.data[k] !== '';
    function next() {
      for (const k of order) if (visible(k) && !answered(k)) return ask(k);
      return durationCard();
    }
    const DEFQ = { appoint_excl: 'هل لديك مدة لا تُحتسب في التقاعد؟ (غياب دون إجازة، أو إجازة بدون راتب عدا المرضية والدراسية، أو حرمان من الراتب) اكتب عدد الأشهر، أو اختر «لا يوجد».' };
    const qText = k => tpl((Q[k] || {}).text || DEFQ[k] || k, S.data);
    function choice(k, items, onPick, opt2) {
      clearDock(); bot(qText(k)); const wrap = el('div', 're42-choices' + (opt2 && opt2.grid ? ' grid' : ''));
      items.forEach(it => { const b = btn(wrap, '', () => { me(it.label); onPick(it.value); }, 're42-chip'); if (it.logo) b.append(it.logo); b.append(el('span', '', it.label)); });
      dock.append(wrap); scroll();
    }
    function textIn(k, type, onOk, ph, skip) {
      clearDock(); bot(qText(k)); const f = el('form', 're42-input'); const i = el('input'); i.type = 'text'; if (type === 'money' || type === 'int') i.inputMode = 'decimal'; i.placeholder = ph || ''; i.autocomplete = 'off';
      const go = btn(null, 'التالي', null, 're42-go'); go.type = 'submit'; f.append(i, go); const err = el('div', 're42-err'); dock.append(f, err);
      if (skip) btn(dock, skip.label, () => { me(skip.label); skip.fn(); }, 're42-link');
      f.onsubmit = ev => { ev.preventDefault(); const v = i.value.trim(); const r = onOk(v); if (typeof r === 'string') { err.textContent = r; i.focus(); } };
      setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 60); scroll();
    }
    function dateIn(k, onOk) {
      clearDock(); bot(qText(k)); const wrap = el('div', 're42-date'); const src0 = S.data[k + '_src']; let cal = src0 ? src0.cal : (S.calPref || (isMil() ? 'hijri' : 'gregorian'));
      const tabs = el('div', 're42-seg'); const tG = btn(tabs, 'ميلادي', () => setCal('gregorian')); const tH = btn(tabs, 'هجري', () => setCal('hijri'));
      const row = el('div', 're42-drow'); const mk = ph => { const i = el('input'); i.type = 'text'; i.inputMode = 'numeric'; i.placeholder = ph; i.maxLength = 4; row.append(i); return i; };
      const dd = mk('يوم'), mm = mk('شهر'), yy = mk('سنة'); const conv = el('div', 're42-conv'); const err = el('div', 're42-err');
      const ok = btn(null, 'اعتماد التاريخ', () => { const g = read(); if (!g) { err.textContent = 'تحقق من اليوم والشهر والسنة'; return; } const h = E().toHijri(g); S.calPref = cal; S.data[k + '_src'] = { cal, d: parseInt(digits(dd.value), 10), m: parseInt(digits(mm.value), 10), y: parseInt(digits(yy.value), 10) }; me(cal === 'hijri' ? gStr(h) + 'هـ (يوافق ' + gStr(g) + 'م)' : gStr(g) + 'م (يوافق ' + gStr(h) + 'هـ)'); onOk(g); }, 're42-go wide');
      wrap.append(tabs, row, conv, err, ok); dock.append(wrap);
      function read() {
        const d = parseInt(digits(dd.value), 10), m = parseInt(digits(mm.value), 10), y = parseInt(digits(yy.value), 10); if (!(d && m && y)) return null;
        if (cal === 'hijri') return E().fromHijri({ y, m, d }); const g = { y, m, d }; return E().validG(g) ? g : null;
      }
      function show() { const g = read(); err.textContent = ''; conv.textContent = g ? (cal === 'hijri' ? 'يوافق ' + gStr(g) + 'م' : 'يوافق ' + gStr(E().toHijri(g)) + 'هـ') : ''; }
      function setCal(c) { const g = read(); cal = c; tG.classList.toggle('on', c === 'gregorian'); tH.classList.toggle('on', c === 'hijri'); yy.placeholder = c === 'hijri' ? 'سنة (مثل 1410)' : 'سنة (مثل 1990)';
        if (g) { const v = c === 'hijri' ? E().toHijri(g) : g; dd.value = v.d; mm.value = v.m; yy.value = v.y; } show(); }
      [dd, mm, yy].forEach(i => i.addEventListener('input', show)); setCal(cal);
      if (src0) { dd.value = src0.d; mm.value = src0.m; yy.value = src0.y; show(); } else { const prev = S.data[k]; if (prev) { dd.value = prev.d; mm.value = prev.m; yy.value = prev.y; cal = 'gregorian'; setCal('gregorian'); } }
      scroll();
    }
    function ask(k) {
      const d = S.data;
      if (k === 'name') return textIn(k, 'text', v => { if (v.length < 2 || v.length > 40) return 'اكتب اسمك (حرفان على الأقل)'; d.name = v.replace(/[<>]/g, ''); me(d.name); next(); });
      if (k === 'sector') return choice(k, sectors().map(s => ({ label: s.label, value: s.key })), v => { d.sector = v; next(); });
      if (k === 'rank') return choice(k, ((cfg.military || {}).ranks || []).map(r => ({ label: r.name, value: r.key })), v => { d.rank = v; d.pilot = null; next(); }, { grid: true });
      if (k === 'pilot') return choice(k, [{ label: 'نعم', value: true }, { label: 'لا', value: false }], v => { d.pilot = v; next(); });
      if (k === 'mil_entity' || k === 'employer') {
        const list = entities(k === 'mil_entity' ? 'military' : d.sector);
        const other = () => textIn(k, 'text', v => { if (v.length < 2) return 'اكتب اسم الجهة'; d[k] = v.slice(0, 80); me(d[k]); next(); }, 'اسم الجهة', k === 'employer' ? { label: 'تخطي', fn: () => { d[k] = '-'; next(); } } : null);
        if (!list.length) return other();
        return choice(k, list.map(n => ({ label: n, value: n })).concat([{ label: 'جهة أخرى', value: '__other' }]), v => { if (v === '__other') other(); else { d[k] = v; next(); } });
      }
      if (k === 'appoint') {
        const excl = () => textIn('appoint_excl', 'int', v => { const n = money(v); if (!(Number.isInteger(n) && n >= 0 && n <= 600)) return 'اكتب عدد الأشهر (رقم صحيح)'; d.excl_months = n; me(n ? n + ' شهر' : 'لا يوجد'); next(); }, 'عدد الأشهر', { label: 'لا يوجد', fn: () => { d.excl_months = 0; next(); } });
        if (d.appoint != null && d.excl_months == null) return excl();
        return dateIn(k, g => { d.appoint = g; d.excl_months = null; excl(); });
      }
      if (k === 'birth') return dateIn(k, g => { d.birth = g; next(); });
      if (k === 'net' || k === 'basic') return textIn(k, 'money', v => { const n = money(v); if (!(n >= 1000 && n <= 1000000)) return 'أدخل مبلغًا صحيحًا بالريال'; d[k] = n; me(fmt(n) + ' ريال'); next(); }, 'المبلغ بالريال');
      if (k === 'salary_bank') {
        const list = (cfg.banks || []).filter(b => !b.test && b.salary !== false && b.active !== false && b.id !== 'OTHER');
        const items = list.map(b => ({ label: b.name, value: b.id, logo: logoBox(b) }));
        if (cfg.salary_other && cfg.salary_other.enabled) items.push({ label: 'بنك آخر', value: 'OTHER' });
        return choice(k, items, v => { d.salary_bank = v; next(); }, { grid: true });
      }
      if (k === 'support') {
        const items = [{ label: 'مدعوم', value: 'yes' }, { label: 'غير مدعوم', value: 'no' }];
        if (isMil() && (cfg.support || {}).etizaz_enabled) items.splice(1, 0, { label: 'اعتزاز', value: 'etizaz' });
        return choice(k, items, v => {
          if (v === 'no') { d.supported = false; d.supportType = null; return next(); }
          if (v === 'etizaz') { d.supported = true; d.supportType = 'etizaz'; return next(); }
          d.supported = true; d.supportType = 'upfront';
          if ((cfg.support || {}).monthly_enabled) { clearDock(); bot('وش نوع الدعم؟'); const w = el('div', 're42-choices'); btn(w, 'دعم مقدم', () => { me('دعم مقدم'); d.supportType = 'upfront'; next(); }, 're42-chip'); btn(w, 'دعم شهري', () => { me('دعم شهري'); d.supportType = 'monthly'; next(); }, 're42-chip'); dock.append(w); scroll(); return; }
          next();
        });
      }
      if (k === 'property') return choice(k, (cfg.properties || []).filter(p => p.enabled !== false).map(p => ({ label: p.label, value: p.key })), v => { d.property = v; next(); });
      if (k === 'obligations') return obligations();
      next();
    }
    function obligations() {
      const d = S.data; const TYPES = [['personal', 'تمويل شخصي'], ['company', 'التزام شركة تمويل'], ['other', 'التزام شهري آخر']];
      clearDock(); bot(d.obligations.length ? 'تبي تضيف التزامًا آخر؟' : qText('obligations'));
      const w = el('div', 're42-choices');
      TYPES.forEach(([t, l]) => btn(w, l, () => { me(l); addOne(t, l); }, 're42-chip'));
      btn(w, d.obligations.length ? 'انتهيت من الالتزامات' : 'ما عندي التزامات', () => { me(d.obligations.length ? 'انتهيت' : 'ما عندي التزامات'); d.obl_done = true; next(); }, 're42-chip end');
      dock.append(w); scroll();
      function addOne(t, l) {
        textIn('obligations', 'money', v => {
          const a = money(v); if (!(a > 0 && a <= 500000)) return 'أدخل قيمة القسط الشهري';
          me(fmt(a) + ' ريال'); clearDock(); bot('كم شهر متبقي على «' + l + '»؟');
          const f = el('form', 're42-input'); const i = el('input'); i.type = 'text'; i.inputMode = 'numeric'; i.placeholder = 'عدد الأشهر المتبقية';
          const g = btn(null, 'إضافة', null, 're42-go'); g.type = 'submit'; f.append(i, g); const err = el('div', 're42-err'); dock.append(f, err);
          f.onsubmit = ev => { ev.preventDefault(); const m = parseInt(digits(i.value), 10); if (!(m >= 1 && m <= 600)) { err.textContent = 'أدخل عدد الأشهر (1 إلى 600)'; return; }
            d.obligations.push({ type: t, label: l, amount: a, months: m }); me(monthsTxt(m)); bot('تمت إضافة: ' + l + ' — ' + fmt(a) + ' ريال لمدة ' + monthsTxt(m)); obligations(); };
          setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 60); scroll();
        }, 'قيمة القسط الشهري بالريال');
        const last = log.lastElementChild; if (last) last.textContent = 'كم قسط «' + l + '» الشهري؟';
      }
    }
    // ---------- engine input ----------
    function inp() {
      const d = S.data;
      return { sector: d.sector, rank: d.rank, pilot: !!d.pilot, birth: d.birth, appoint: d.appoint, excludedMonths: d.excl_months || 0, basic: d.basic, net: d.net,
        obligations: d.obligations.map(o => ({ type: o.type, amount: o.amount, months: o.months })), supported: !!d.supported, supportType: d.supportType || 'upfront',
        property: d.property || 'ready', entity: (d.mil_entity && d.mil_entity !== '-') ? d.mil_entity : (d.employer && d.employer !== '-' ? d.employer : null), salary_bank: d.salary_bank };
    }
    // ---------- duration card ----------
    let durEl = null, resEl = null;
    function durationCard() {
      clearDock(); if (resEl) { resEl.remove(); resEl = null; }
      let dc; try { dc = E().durationCard(Object.assign(inp(), { months: S.months == null ? Number((cfg.limits || {}).default_term || 300) : S.months, extend: S.extend }), cfg); }
      catch (e) { bot(ERR[e.message] || 'تحقق من البيانات: ' + e.message, 'warn'); return editMenu(); }
      if (S.extend == null) S.extend = dc.extend;
      if (durEl) durEl.remove(); durEl = el('div', 're42-card re42-dur'); log.append(durEl);
      durEl.append(el('h3', '', tpl(T.duration_title || 'مدة التمويل لك يا {name}', S.data)));
      const big = el('div', 're42-big'); const bm = el('b', '', String(dc.months)); big.append(bm, el('span', '', ' شهر')); const yr = el('div', 're42-years', durTxt(dc.months)); durEl.append(big, yr);
      if (dc.cap < 12) { durEl.append(el('p', 're42-warn', 'المدة المتاحة لحالتك أقل من الحد الأدنى للتمويل العقاري حاليًا. تقدر تعدّل بياناتك.')); return editMenu(); }
      if (dc.extendShown) {
        const lab = el('label', 're42-switch'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!S.extend; lab.append(cb, el('span', '', T.extend_label || 'تمويل يمتد إلى بعد التقاعد'));
        cb.onchange = () => { S.extend = cb.checked; S.months = null; durationCard(); }; durEl.append(lab);
      }
      const sl = el('div', 're42-slider'); sl.append(el('span', 're42-sl-lab', T.reduce_label || 'تقليل المدة'));
      const r = el('input'); r.type = 'range'; r.min = String(Math.max(12, Math.min(dc.minTerm || 60, dc.cap))); r.max = String(dc.cap); r.step = '1'; r.value = String(dc.months); r.setAttribute('aria-label', 'مدة التمويل بالأشهر');
      const steps = el('div', 're42-steps'); const upd = v => { v = Math.max(Number(r.min), Math.min(Number(r.max), v)); r.value = String(v); bm.textContent = String(v); yr.textContent = durTxt(v); };
      btn(steps, '−12', () => upd(Number(r.value) - 12), 're42-mini'); btn(steps, '−1', () => upd(Number(r.value) - 1), 're42-mini'); btn(steps, '+1', () => upd(Number(r.value) + 1), 're42-mini'); btn(steps, '+12', () => upd(Number(r.value) + 12), 're42-mini');
      r.oninput = () => upd(Number(r.value)); sl.append(r, steps); durEl.append(sl);
      if (dc.corrected) durEl.append(el('p', 're42-note', 'عدّلنا المدة تلقائيًا لتناسب عمرك وحالتك الوظيفية.'));
      const pr = dc.profile; const info = el('details', 're42-info'); info.append(el('summary', '', 'تفاصيل حالتك'));
      const add = (a, b) => { const row = el('div', 're42-kv'); row.append(el('span', '', a), el('b', '', b)); info.append(row); };
      add('العمر الحالي', durTxt(pr.ageMonths));
      if (pr.sector === 'military') {
        add('مدة الخدمة المحتسبة حتى الآن', durTxt(pr.serviceNow)); if (pr.excl) add('مدة غير محتسبة (م6)', durTxt(pr.excl)); add('سن التقاعد النظامي للرتبة', yearsTxt(pr.retireAge) + ((cfg.military || {}).calendar === 'hijri' ? ' هجرية' : ''));
        if (pr.retireDate) add('تاريخ الإحالة المتوقع', gStr(E().toHijri(pr.retireDate)) + 'هـ — ' + gStr(pr.retireDate) + 'م');
        add('المتبقي للتقاعد', pr.R ? durTxt(pr.R) : 'بلغت سن التقاعد'); add('الخدمة المحتسبة عند التقاعد', durTxt(pr.serviceAtRet)); add('الراتب الأساسي المعتمد للمعاش', fmt(pr.basic) + ' ريال'); add('المعاش التقاعدي التقديري', fmt(pr.pension) + ' ريال');
        info.append(el('p', 're42-note', T.pension_note || ''));
        info.append(el('p', 're42-muted', 'وفق نظام التقاعد العسكري (م8): آخر راتب أساسي × أشهر الخدمة المحتسبة ÷ 420، بحد أقصى الراتب الأساسي. محسوب على راتبك الأساسي الحالي دون افتراض زيادات، ودون العلاوات والبدلات (م2)، ولا يشمل المدد الإضافية (م5) أو التمديد بعد السن (م13).'));
      } else if (pr.retireDate) add('المتبقي للتقاعد', pr.R ? durTxt(pr.R) : 'بلغت سن التقاعد');
      durEl.append(info);
      const go = btn(durEl, T.approve_label || 'اعتماد المدة', async () => { S.months = Number(r.value); me('اعتمدت ' + S.months + ' شهر'); await results(true); }, 're42-go wide');
      go.dataset.k = 'approve'; editMenu(true); scroll();
    }
    // ---------- results ----------
    function snapshot() { return { plan: S.plan, offers: clone(S.offers), plans: clone(S.plans), entity: S.entity }; }
    function compute() { return E().compare(inp(), cfg, { plan: S.plan, months: S.months, extend: !!S.extend, trial, offers: S.offers, plans: S.plans, entity: S.entity || inp().entity }); }
    async function meter() {
      if (opt.mode !== 'client') return true; const sig = JSON.stringify([inp(), S.months, S.extend]); if (S.metered[sig]) return true;
      try {
        const e = typeof finoCentralRestoreEntry === 'function' ? finoCentralRestoreEntry() : null; if (!e || !e.entryToken) throw Error('NO_ENTRY');
        const r = await finoRpc('f99r47_client_meter', { p_entry_token: e.entryToken, p_device_id: e.deviceId || (typeof finoCentralDeviceId === 'function' ? finoCentralDeviceId() : ''),
          p_request_id: typeof f99v7CreateRequestId === 'function' ? f99v7CreateRequestId() : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) }, 15000);
        if (!r || !r.ok || (r.data && r.data.ok === false)) { bot('الكود لا يسمح بهذه العملية أو انتهى الحد.', 'warn'); return false; }
        S.metered[sig] = true; return true;
      } catch (e) { bot('تعذر التأكد من صلاحية الكود؛ لم نعتمد النتيجة.', 'warn'); return false; }
    }
    // r47: short client note only when the client's case differs from the reference case of the owner-provided rates.
    function refNote(R) {
      const rf = cfg.rate_ref; if (!rf || trial) return '';
      const d = [];
      if (rf.plan && S.plan !== rf.plan) d.push(rf.plan === 'fixed' ? 'نوع القسط (النسب الحالية للقسط الثابت)' : 'نوع القسط');
      let sk = ''; try { sk = E().supportKey(inp()); } catch (e) {}
      if (rf.support && sk && sk !== rf.support) d.push('نوع الدعم السكني');
      const ms = R.results.length ? R.results.map(b => Number(b.months)) : [Number(S.months)];
      if (rf.months && ms.some(m => m !== Number(rf.months))) d.push('مدة التمويل (المرجع ' + rf.months + ' شهرًا)');
      const hp = (S.data.obligations || []).some(o => o.type === 'personal' && Number(o.amount) > 0 && Number(o.months) > 0);
      if (rf.personal === 'yes' && !hp) d.push('عدم وجود تمويل شخصي');
      if (!d.length) return '';
      return String(T.rate_ref_note || 'تنبيه: النسب الحالية مرجعية لحالة محددة، وحالتك تختلف في: {diff}. لذلك قد تختلف النسبة الفعلية لدى الجهة التمويلية.').replace(/\{diff\}/g, d.join('، '));
    }
    async function results(fresh) {
      if (fresh && !(await meter())) return;
      let R; try { R = compute(); } catch (e) { bot(ERR[e.message] || 'تعذر الحساب: ' + e.message, 'warn'); return; }
      S.last = R; clearDock(); if (resEl) resEl.remove(); resEl = el('div', 're42-card re42-res'); log.append(resEl);
      resEl.append(el('h3', '', tpl(T.results_title || 'نتائج التمويل العقاري لك يا {name}', S.data)));
      if (trial) resEl.append(el('p', 're42-trialnote', T.trial_note || 'وضع تجربة المالك: بنوك ونسب اختبار داخلية.'));
      const seg = el('div', 're42-seg'); [['step', 'القسط المتزايد'], ['fixed', 'القسط الثابت']].forEach(([k, l]) => { const b = btn(seg, l, () => { if (S.plan === k) return; S.history.push(snapshot()); S.plan = k; S.plans = {}; S.offers = {}; results(false); }); b.classList.toggle('on', S.plan === k); });
      resEl.append(seg, el('p', 're42-crit', T['rank_' + (cfg.ranking || 'amount')] || 'مرتبة حسب أعلى مبلغ تمويل'));
      resEl.append(el('p', 're42-meta', 'المدة: ' + S.months + ' شهر (' + durTxt(S.months) + ')' + (S.extend ? ' — تمتد بعد التقاعد' : '')));
      if (S.history.length) btn(resEl, T.back_prev || 'الرجوع للحسبة السابقة', () => { const p = S.history.pop(); Object.assign(S, p); results(false); }, 're42-back');
      if (!R.results.length) resEl.append(el('p', 're42-warn', tpl(T.no_banks, S.data)));
      { const rn = refNote(R); if (rn) resEl.append(el('p', 're42-warn re42-refnote', rn)); }
      R.top.forEach((b, i) => resEl.append(bankCard(b, i)));
      if (R.rest.length) {
        const more = el('div', 're42-more'); more.hidden = !S.showRest; R.rest.forEach((b, i) => more.append(bankCard(b, i + R.top.length)));
        btn(resEl, (S.showRest ? 'إخفاء' : 'عرض') + ' بقية البنوك المشمولة (' + R.rest.length + ')', ev => { S.showRest = !S.showRest; more.hidden = !S.showRest; ev.target.textContent = (S.showRest ? 'إخفاء' : 'عرض') + ' بقية البنوك المشمولة (' + R.rest.length + ')'; }, 're42-link');
        resEl.append(more);
      }
      const act = el('div', 're42-actions'); btn(act, 'مشاركة عبر واتساب', share, 're42-wa'); btn(act, 'صورة النتيجة', image); btn(act, 'تعديل المدة', () => durationCard()); btn(act, 'تعديل البيانات', () => editMenu(false, true));
      resEl.append(act, el('p', 're42-disc', T.disclaimer || '')); scroll();
    }
    function stageLine(s, N) { return (s.from === s.to ? 'الشهر ' + s.from : 'من الشهر ' + s.from + (s.to === N ? ' حتى نهاية التمويل' : ' إلى ' + s.to)) + ': ' + s.amount.toLocaleString('en-US') + ' ريال'; }
    function bankCard(b, i) {
      const c = el('div', 're42-bank' + (i === 0 ? ' best' : '')); c.dataset.bank = b.id;
      const h = el('div', 're42-bh'); h.append(logoBox(b)); const nm = el('div', 're42-bn'); nm.append(el('b', '', b.name)); if (i === 0) nm.append(el('small', 're42-tag', 'الأفضل لحالتك'));
      if (b.test) nm.append(el('small', 're42-tag test', 'بنك اختبار — نسبة تجريبية غير معتمدة')); h.append(nm); c.append(h);
      const amt = el('div', 're42-amt'); amt.append(el('small', '', 'مبلغ التمويل العقاري التقديري'), el('b', '', fmt(b.amount) + ' ريال')); c.append(amt);
      const st = el('div', 're42-stages'); st.append(el('small', '', 'القسط الشهري')); const show = b.stages.length > 5 ? b.stages.slice(0, 4) : b.stages;
      show.forEach(s => st.append(el('div', 're42-st', stageLine(s, b.months)))); if (b.stages.length > 5) st.append(el('div', 're42-st', '… ثم ' + stageLine(b.stages[b.stages.length - 1], b.months)));
      c.append(st);
      if (b.postStages.length && b.preStages.length) {
        const pp = el('div', 're42-pp'); const rng = a => { const v = a.map(s => s.amount); const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v); return mn === mx ? mn.toLocaleString('en-US') : mn.toLocaleString('en-US') + ' – ' + mx.toLocaleString('en-US'); };
        pp.append(kv('قبل التقاعد', rng(b.preStages) + ' ريال'), kv('بعد التقاعد', rng(b.postStages) + ' ريال')); c.append(pp);
      }
      const g = el('div', 're42-grid');
      g.append(kv(b.method === 'flat' ? 'هامش الربح السنوي الثابت' : 'هامش الربح السنوي (APR)', pct(b.rate)), kv('مدة التمويل', b.months + ' شهر'), kv('إجمالي الأرباح التقديرية', fmt(b.profit) + ' ريال'),
        kv('الرسوم المطبقة', b.feeR ? fmt(b.fee + b.vat) + ' ريال' : 'لا توجد'), kv('إجمالي المبالغ المستحقة', fmt(b.totalDue) + ' ريال'));
      if (b.termCut) g.append(kv('ملاحظة', 'مدة هذا البنك أقصر حسب حدوده'));
      if (b.monthlySupport > 0) g.append(kv('الدعم الشهري', fmt(b.monthlySupport) + ' ريال'));
      c.append(g);
      if (b.offer) c.append(el('div', 're42-applied', 'مطبّق: ' + b.offer.title));
      const offs = el('div', 're42-offers');
      (b.offers || []).forEach(o => {
        if (b.offer && b.offer.id === o.id) return;
        if (o.kind === 'fixed') btn(offs, T.fixed_offer_cta || 'عرض خاص للقسط الثابت', () => tryOffer(b, o, null, 'fixed'), 're42-offer');
        else if (o.kind === 'entity') btn(offs, T.entity_offer_cta || 'عندنا عرض خاص لبعض الجهات — اكتشف إذا يشملك', () => entityPick(b, o), 're42-offer');
        else if (o.eligibleNow) btn(offs, 'عرض خاص: ' + o.title, () => tryOffer(b, o, null, o.plan && o.plan !== 'any' ? o.plan : null), 're42-offer');
      });
      if (offs.childNodes.length) c.append(offs);
      return c;
    }
    function kv(a, b) { const r = el('div', 're42-kv'); r.append(el('span', '', a), el('b', '', b)); return r; }
    function tryOffer(b, o, entity, plan) {
      const snap = snapshot(); S.history.push(snap); S.offers[b.id] = o.id; if (plan) S.plans[b.id] = plan; if (entity) S.entity = entity;
      let R; try { R = compute(); } catch (e) { R = null; }
      if (!R || !R.results.some(x => x.id === b.id && x.offer && x.offer.id === o.id)) { S.history.pop(); Object.assign(S, snap); toast('هذا العرض لا يشمل حالتك حاليًا، وبقيت نتيجتك كما هي.'); return; }
      toast('تم تطبيق العرض على ' + b.name + ' فقط'); results(false);
    }
    function entityPick(b, o) {
      const s2 = sheet('الجهات المشمولة بالعرض', 're42-pick'); s2.body.append(el('p', 're42-note', o.title));
      (o.entities || []).forEach(n => btn(s2.body, n, () => { s2.ov.remove(); tryOffer(b, o, n, o.plan && o.plan !== 'any' ? o.plan : null); }, 're42-chip'));
      btn(s2.body, 'جهتي ليست ضمن القائمة', () => { s2.ov.remove(); toast('العرض لا يشمل جهتك، وبقيت نتيجتك كما هي.'); }, 're42-link');
    }
    function editMenu(compact, open) {
      if (compact) { const w = el('div', 're42-choices'); btn(w, 'تعديل البيانات', () => editMenu(false, true), 're42-chip end'); dock.append(w); return; }
      if (!open) { clearDock(); const w = el('div', 're42-choices'); btn(w, 'تعديل البيانات', () => editMenu(false, true), 're42-chip end'); dock.append(w); return; }
      clearDock(); bot('وش تبي تعدّل؟ بياناتك الباقية محفوظة.'); const w = el('div', 're42-choices');
      const LBL = { name: 'الاسم', sector: 'القطاع', rank: 'الرتبة', pilot: 'طيار', mil_entity: 'الجهة العسكرية', appoint: 'تاريخ التعيين', employer: 'جهة العمل', birth: 'تاريخ الميلاد', net: 'الراتب الصافي', basic: 'الراتب الأساسي', salary_bank: 'بنك الراتب', support: 'الدعم السكني', property: 'نوع العقار', obligations: 'الالتزامات' };
      order.filter(visible).forEach(k => btn(w, LBL[k] || k, () => {
        if (k === 'obligations') { S.data.obligations = []; S.data.obl_done = false; } else if (k === 'support') { S.data.supported = null; S.data.supportType = null; } else S.data[k] = null;
        if (k === 'appoint') S.data.excl_months = null; if (k === 'sector') { S.extend = null; } S.months = null; S.offers = {}; S.plans = {}; S.history = []; ask(k);
      }, 're42-chip'));
      dock.append(w); scroll();
    }
    // ---------- share / image ----------
    function summary() {
      const R = S.last; const b = R && R.top[0]; const lines = [T.share_intro || 'ملخص حسبتي العقارية المبدئية من FINO99', 'الاسم: ' + (S.data.name || ''), 'مدة التمويل: ' + S.months + ' شهر (' + durTxt(S.months) + ')'];
      if (b) { lines.push('أفضل نتيجة: ' + b.name + ' — مبلغ تمويل تقديري ' + fmt(b.amount) + ' ريال', 'هامش الربح: ' + pct(b.rate) + ' — ' + (S.plan === 'fixed' ? 'قسط ثابت' : 'قسط متزايد'));
        b.stages.slice(0, 4).forEach(s => lines.push('• ' + stageLine(s, b.months))); lines.push('إجمالي الأرباح التقديرية: ' + fmt(b.profit) + ' ريال'); }
      if (trial) lines.push('(تجربة داخلية — نسب اختبار غير معتمدة)');
      lines.push(T.disclaimer || '', 'https://www.fino99.com'); return lines.join('\n');
    }
    function share() {
      const txt = summary(); const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
      const w = W.open(url, '_blank', 'noopener'); if (!w && navigator.share) navigator.share({ text: txt }).catch(() => {});
    }
    function image() {
      const R = S.last; const b = R && R.top[0]; const cv = D.createElement('canvas'); cv.width = 1080; cv.height = 1350; const x = cv.getContext('2d');
      const font = (getComputedStyle(D.body).fontFamily || 'sans-serif'); x.fillStyle = '#0b2545'; x.fillRect(0, 0, 1080, 1350); x.fillStyle = '#ffffff'; x.fillRect(40, 190, 1000, 1040);
      x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = '#ffffff'; x.font = '700 64px ' + font; x.fillText('FINO99', 1020, 110); x.font = '400 34px ' + font; x.fillText('حسبة تمويل عقاري مبدئية', 1020, 160);
      let y = 270; const line = (t, sz, wt, col) => { x.font = (wt || 400) + ' ' + sz + 'px ' + font; x.fillStyle = col || '#0b2545'; x.fillText(t, 1000, y); y += sz + 26; };
      line(tpl(T.duration_title || 'مدة التمويل لك يا {name}', S.data), 44, 700); line(S.months + ' شهر — ' + durTxt(S.months), 38, 400, '#334');
      if (b) { line(b.name + (b.test ? ' (اختبار)' : ''), 40, 700, '#13315c'); line('مبلغ التمويل التقديري', 32, 400, '#556'); line(fmt(b.amount) + ' ريال', 86, 800, '#0a7a4f');
        line('هامش الربح ' + pct(b.rate) + ' — ' + (S.plan === 'fixed' ? 'قسط ثابت' : 'قسط متزايد'), 32, 400, '#334');
        b.stages.slice(0, 4).forEach(s => line(stageLine(s, b.months), 32, 400, '#223')); line('إجمالي الأرباح التقديرية: ' + fmt(b.profit) + ' ريال', 32, 400, '#334'); }
      else line(tpl(T.no_banks, S.data), 32, 400, '#a00');
      x.font = '400 24px ' + font; x.fillStyle = '#666'; const disc = (trial ? 'تجربة داخلية — نسب اختبار غير معتمدة. ' : '') + (T.disclaimer || '');
      let ly = 1170; const words = disc.split(' '); let cur = ''; for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (x.measureText(t).width > 940) { x.fillText(cur, 1000, ly); ly += 34; cur = wd; } else cur = t; } if (cur) x.fillText(cur, 1000, ly);
      x.fillStyle = '#ffffff'; x.font = '400 28px ' + font; x.textAlign = 'center'; x.fillText('www.fino99.com', 540, 1305);
      const s2 = sheet('صورة النتيجة', 're42-img'); const im = el('img'); im.alt = 'صورة نتيجة الحسبة'; im.src = cv.toDataURL('image/png'); s2.body.append(im);
      const row = el('div', 're42-actions'); const a = el('a', 're42-btn', 'حفظ الصورة'); a.href = im.src; a.download = 'FINO99-mortgage.png'; row.append(a);
      if (navigator.canShare) btn(row, 'مشاركة الصورة', () => { cv.toBlob(bl => { const f = new File([bl], 'FINO99-mortgage.png', { type: 'image/png' }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: 'https://www.fino99.com' }).catch(() => {}); else a.click(); }); });
      s2.body.append(row);
    }
    // start
    bot(T.greeting || 'أهلًا بك'); next();
    W.F99RE42._bot = { S, cfg, results, durationCard, compute };
    return sh;
  }

  // =====================================================================
  //                      OWNER CONTROL CENTER
  // =====================================================================
  async function openCenter() {
    if (!isOwner()) { toast('مركز التحكم متاح للمالك فقط', true); return; }
    const sh = sheet('مركز التحكم بالتمويل العقاري', 're42-center'); const st = el('p', 're42-note', 'جاري التحميل من المركزية…'); sh.body.append(st);
    let S; try { S = await ownerCall('get'); } catch (e) { st.textContent = 'تعذر التحميل: ' + e.message; return; }
    let Wc = clone(S.config), dirty = false; st.remove();
    const tabs = el('div', 're42-tabs'); const pane = el('div', 're42-pane'); const bar = el('div', 're42-savebar'); sh.body.append(tabs, pane); sh.box.append(bar);
    const note = el('input'); note.placeholder = 'ملاحظة التعديل (اختياري)'; note.maxLength = 200; const saveB = btn(null, 'حفظ التغييرات', save, 're42-go'); const dirtyL = el('span', 're42-muted', 'لا توجد تغييرات');
    bar.append(dirtyL, note, saveB);
    const mark = () => { dirty = true; dirtyL.textContent = 'تغييرات غير محفوظة'; dirtyL.classList.add('dirty'); };
    async function save() {
      if (!dirty) { toast('لا توجد تغييرات'); return; } saveB.disabled = true;
      try { const r = await ownerCall('save', { config: Wc, note: note.value.trim(), expected_revision: S.revision }); toast('تم الحفظ (نسخة ' + r.revision + ')'); await reload(); }
      catch (e) { toast('لم يتم الحفظ: ' + reason(e.message), true); } finally { saveB.disabled = false; }
    }
    async function reload(keepTab) { S = await ownerCall('get'); Wc = clone(S.config); dirty = false; dirtyL.textContent = 'لا توجد تغييرات'; dirtyL.classList.remove('dirty'); note.value = ''; show(cur); }
    async function setFlag(d, msg) { try { const r = await ownerCall('set', Object.assign({ expected_revision: S.revision, note: msg }, d)); toast(msg); pubCache = null; if (dirty) { S.revision = r.revision; S.enabled = r.enabled; S.visible = r.visible; S.mode = r.mode; show(cur); } else await reload(); } catch (e) { toast(reason(e.message), true); } }
    const reason = c => ({ REVISION_CONFLICT: 'تم تعديل الإعدادات من جهاز آخر؛ أعد فتح المركز', ADMIN_UNAUTHORIZED: 'انتهت جلسة المالك', MAX_TERM_RANGE: 'المدة القصوى بين 12 و420 شهرًا', MAX_AGE_RANGE: 'عمر نهاية التمويل بين 50 و85',
      DTI_RANGE: 'نسبة الاستقطاع بين 1 و100', PENSION_DIVISOR_RANGE: 'قاسم المعاش غير منطقي', BANK_ID_INVALID: 'معرّف بنك مكرر أو فارغ' }[c] || (String(c).startsWith('REAL_RATE_NEEDS_DOCS') ? 'لا يمكن اعتماد نسبة بنك حقيقي دون المنتج والمصدر وتاريخ السريان' : String(c).startsWith('RATE_RANGE') || String(c).startsWith('OFFER_RATE_RANGE') ? 'نسبة خارج النطاق (0–30%)' : c));
    // field helpers
    function field(p, label, obj, key, type, opts) {
      opts = opts || {}; const row = el('label', 're42-f' + (type === 'bool' ? ' bool' : '')); const cap = el('span', '', label); let i;
      if (type === 'bool') { i = el('input'); i.type = 'checkbox'; i.checked = obj[key] === undefined ? !!opts.def : !!obj[key]; i.onchange = () => { obj[key] = i.checked; mark(); if (opts.re) show(cur); }; row.append(i, cap); }
      else if (type === 'select') { i = el('select'); (opts.options || []).forEach(([v, l]) => { const o = el('option', '', l); o.value = v; i.append(o); }); i.value = obj[key] == null ? (opts.def || '') : String(obj[key]); i.onchange = () => { obj[key] = opts.num ? Number(i.value) : i.value; mark(); if (opts.re) show(cur); }; row.append(cap, i); }
      else if (type === 'textarea') { i = el('textarea'); i.rows = opts.rows || 3; i.value = obj[key] == null ? '' : obj[key]; i.oninput = () => { obj[key] = i.value; mark(); }; row.append(cap, i); }
      else { i = el('input'); i.type = 'text'; if (type === 'num') i.inputMode = 'decimal'; i.value = obj[key] == null ? '' : String(obj[key]);
        i.oninput = () => { if (type === 'num') { const v = i.value.trim() === '' ? null : Number(digits(i.value)); if (i.value.trim() !== '' && !Number.isFinite(v)) { row.classList.add('bad'); return; } row.classList.remove('bad'); if (v == null) delete obj[key]; else obj[key] = v; } else obj[key] = i.value; mark(); }; row.append(cap, i); }
      p.append(row); return i;
    }
    function list(p, arr, cols, opts) {
      opts = opts || {}; const box = el('div', 're42-list');
      const draw = () => { box.innerHTML = ''; arr.forEach((it, idx) => {
        const r = el('div', 're42-row'); cols.forEach(c => {
          if (c.type === 'multi') { const g = el('div', 're42-multi'); g.append(el('span', '', c.label)); (c.options || []).forEach(([v, l]) => { const lb = el('label'); const cb = el('input'); cb.type = 'checkbox'; it[c.k] = it[c.k] || []; cb.checked = it[c.k].includes(v); cb.onchange = () => { it[c.k] = cb.checked ? it[c.k].concat([v]) : it[c.k].filter(x => x !== v); mark(); }; lb.append(cb, el('span', '', l)); g.append(lb); }); r.append(g); }
          else if (c.type === 'csv') { const lb = el('label', 're42-f'); lb.append(el('span', '', c.label)); const i = el('input'); i.value = (it[c.k] || []).join('، '); i.oninput = () => { it[c.k] = i.value.split(/[،,\n]/).map(s => s.trim()).filter(Boolean); mark(); }; lb.append(i); r.append(lb); }
          else field(r, c.label, it, c.k, c.type, c);
        });
        const tools = el('div', 're42-tools');
        if (opts.reorder !== false) { btn(tools, '▲', () => { if (idx > 0) { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; mark(); draw(); } }, 're42-mini'); btn(tools, '▼', () => { if (idx < arr.length - 1) { [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; mark(); draw(); } }, 're42-mini'); }
        if (opts.extra) opts.extra(tools, it, idx);
        if (opts.remove !== false) btn(tools, 'حذف', () => { if (confirm('حذف هذا العنصر؟')) { arr.splice(idx, 1); mark(); draw(); } }, 're42-mini danger');
        r.append(tools); box.append(r);
      }); };
      draw(); p.append(box); if (opts.add) btn(p, opts.addLabel || 'إضافة', () => { arr.push(opts.add()); mark(); draw(); }, 're42-link'); return box;
    }
    const SECT = () => (Wc.sectors || []).map(s => [s.key, s.label]);
    const PLANS = [['any', 'أي نظام'], ['step', 'متزايد'], ['fixed', 'ثابت']], SUP = [['any', 'أي حالة'], ['none', 'غير مدعوم'], ['upfront', 'دعم مقدم'], ['monthly', 'دعم شهري'], ['etizaz', 'اعتزاز']];
    const TABS = [['general', 'عام'], ['banks', 'البنوك والنسب'], ['limits', 'المدد والاستقطاع'], ['sectors', 'القطاعات والجهات'], ['ranks', 'الرتب والتقاعد'], ['support', 'الدعم والعقارات'], ['questions', 'الأسئلة والنصوص'], ['preview', 'معاينة'], ['log', 'السجل والتراجع'], ['json', 'متقدم']];
    let cur = 'general'; TABS.forEach(([k, l]) => { const b = btn(tabs, l, () => show(k), 're42-tab'); b.dataset.tab = k; });
    function show(k) {
      cur = k; tabs.querySelectorAll('.re42-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === k)); pane.innerHTML = ''; const P = pane;
      if (k === 'general') {
        const sts = el('div', 're42-status'); const chip = (t, ok) => sts.append(el('span', 're42-pill ' + (ok ? 'ok' : 'off'), t));
        chip(S.enabled ? 'الباقة مفعّلة' : 'الباقة معطّلة', S.enabled); chip(S.visible ? 'ظاهرة للعملاء' : 'مخفية عن العملاء (تجربة المالك فقط)', S.visible); chip('طريقة العرض: ' + (S.mode === 'bot' ? 'بوت ذكي' : 'حاسبة تقليدية'), true); P.append(sts);
        const row = el('div', 're42-actions');
        btn(row, S.enabled ? 'تعطيل الباقة' : 'تشغيل الباقة', () => setFlag({ enabled: !S.enabled }, S.enabled ? 'تم تعطيل الباقة' : 'تم تشغيل الباقة'), S.enabled ? 'danger' : 're42-go');
        btn(row, S.visible ? 'إخفاء عن العملاء' : 'إظهار للعملاء', () => {
          if (!S.visible) { const real = (Wc.banks || []).filter(b => !b.test && b.approved && b.active !== false && b.included !== false).length;
            if (!confirm(real ? 'سيظهر البوت للعملاء أصحاب أكواد التمويل العقاري مع ' + real + ' بنك معتمد فقط. متأكد؟' : 'لا يوجد أي بنك حقيقي معتمد بعد؛ لن يرى العملاء أي نتائج. متأكد من الإظهار؟')) return; }
          setFlag({ visible: !S.visible }, S.visible ? 'تم الإخفاء عن العملاء' : 'تم الإظهار للعملاء');
        }, S.visible ? 'danger' : '');
        btn(row, S.mode === 'bot' ? 'التحويل إلى الحاسبة التقليدية' : 'التحويل إلى البوت الذكي', () => setFlag({ mode: S.mode === 'bot' ? 'classic' : 'bot' }, 'تم تغيير طريقة العرض'));
        btn(row, 'إيقاف فوري (تعطيل وإخفاء)', () => { if (confirm('تعطيل الباقة وإخفاؤها عن العملاء الآن؟')) setFlag({ enabled: false, visible: false }, 'تم الإيقاف الفوري'); }, 'danger');
        P.append(row, el('p', 're42-note', 'حالة بيع الباقة في المتجر تُدار من «باقات المتجر» ولم يغيّرها هذا المركز. الإعدادات هنا مستقلة عن التمويل الشخصي وتحويل المديونية.'));
        P.append(el('h4', '', 'افتراضات تحتاج اعتمادك قبل الإظهار للعملاء')); const ul = el('ul', 're42-ul'); (Wc.assumptions || []).forEach(a => ul.append(el('li', '', a))); P.append(ul);
        P.append(el('p', 're42-muted', 'النسخة الحالية: ' + S.revision + ' — آخر تحديث: ' + new Date(S.updated_at).toLocaleString('ar-SA-u-nu-latn')));
      }
      if (k === 'banks') {
        P.append(el('p', 're42-note', 'نسب البنوك الحقيقية فارغة. لا تُعتمد نسبة حقيقية إلا مع المنتج والمصدر وتاريخ السريان وتفعيل «معتمد». بنوك الاختبار لا تظهر للعملاء أبدًا.'));
        Wc.banks = Wc.banks || [];
        const box = el('div', 're42-list'); P.append(box);
        const draw = () => { box.innerHTML = ''; Wc.banks.forEach((b, idx) => {
          const r = el('div', 're42-row bank'); const h = el('div', 're42-bh'); h.append(logoBox(b)); const nm = el('div', 're42-bn'); nm.append(el('b', '', b.name));
          const rates = b.rates && b.rates.step ? Object.values(b.rates.step).filter(x => x > 0) : [];
          nm.append(el('small', 're42-tag' + (b.test ? ' test' : ''), b.test ? 'بنك اختبار' : (b.approved ? 'معتمد' : (rates.length ? 'نسب غير معتمدة' : 'بدون نسب')))); h.append(nm); r.append(h);
          const flags = el('div', 're42-flags'); field(flags, 'مفعّل', b, 'active', 'bool', { def: true }); field(flags, 'مشمول بالترشيح', b, 'included', 'bool', { def: true }); field(flags, 'موصى به', b, 'recommended', 'bool'); if (!b.test) field(flags, 'يظهر في بنك الراتب', b, 'salary', 'bool', { def: true }); r.append(flags);
          const tools = el('div', 're42-tools'); btn(tools, 'تعديل البنك والعروض', () => editBank(b), 're42-mini'); btn(tools, '▲', () => { if (idx > 0) { [Wc.banks[idx - 1], Wc.banks[idx]] = [Wc.banks[idx], Wc.banks[idx - 1]]; mark(); draw(); } }, 're42-mini');
          btn(tools, 'حذف', () => { if (confirm('حذف ' + b.name + ' من الإعدادات العقارية فقط؟')) { Wc.banks.splice(idx, 1); mark(); draw(); } }, 're42-mini danger'); r.append(tools); box.append(r);
        }); };
        draw();
        const add = el('div', 're42-actions'); btn(add, 'إضافة بنك أو جهة تمويل', () => { const id = prompt('معرّف قصير بالإنجليزية (مثل SNB أو NEWBANK):'); if (!id) return; const nm = prompt('اسم الجهة:'); if (!nm) return;
          Wc.banks.push({ id: id.trim().toUpperCase().slice(0, 40), name: nm.trim().slice(0, 80), test: false, active: true, included: true, salary: true, approved: false, method: 'annuity', product: '', source: '', effective_date: '', rates: {}, fees: {}, offers: [], sectors: [], properties: [] }); mark(); draw(); });
        btn(add, 'إضافة بنك اختبار', () => { const n = Wc.banks.filter(b => b.test).length + 1; Wc.banks.push({ id: 'TEST' + n + '_' + Date.now().toString(36).slice(-3).toUpperCase(), name: 'بنك اختبار (' + n + ')', test: true, active: true, included: true, salary: false, approved: false, method: 'annuity', rates: { step: { none: 4, upfront: 4 }, fixed: { none: 4.25, upfront: 4.25 } }, fees: {}, offers: [] }); mark(); draw(); });
        P.append(add);
        function editBank(b) {
          const s2 = sheet('إعدادات ' + b.name, 're42-center re42-sub'); const Pb = s2.body; b.rates = b.rates || {}; b.fees = b.fees || {}; b.offers = b.offers || [];
          field(Pb, 'اسم الجهة', b, 'name', 'text'); if (!b.test) { field(Pb, 'المنتج العقاري', b, 'product', 'text'); field(Pb, 'مصدر النسبة (رابط أو مستند)', b, 'source', 'text'); field(Pb, 'تاريخ السريان', b, 'effective_date', 'text'); field(Pb, 'معتمد من المالك للظهور للعملاء', b, 'approved', 'bool'); }
          field(Pb, 'طريقة التسعير', b, 'method', 'select', { options: [['annuity', 'قسط متناقص — APR'], ['flat', 'هامش ربح ثابت سنوي']] });
          Pb.append(el('h4', '', 'النسب حسب نوع القسط والدعم (%)')); const g = el('table', 're42-rates'); const hr = el('tr'); hr.append(el('th', '', '')); [['none', 'غير مدعوم'], ['upfront', 'دعم مقدم'], ['monthly', 'دعم شهري'], ['etizaz', 'اعتزاز']].forEach(([, l]) => hr.append(el('th', '', l))); g.append(hr);
          [['step', 'القسط المتزايد'], ['fixed', 'القسط الثابت']].forEach(([pk, pl]) => { const tr = el('tr'); tr.append(el('th', '', pl)); b.rates[pk] = b.rates[pk] || {};
            ['none', 'upfront', 'monthly', 'etizaz'].forEach(sk => { const td = el('td'); const i = el('input'); i.inputMode = 'decimal'; i.value = b.rates[pk][sk] == null ? '' : b.rates[pk][sk]; i.oninput = () => { const v = Number(digits(i.value)); if (i.value.trim() === '') delete b.rates[pk][sk]; else if (Number.isFinite(v)) b.rates[pk][sk] = v; mark(); }; td.append(i); tr.append(td); }); g.append(tr); });
          Pb.append(g);
          Pb.append(el('h4', '', 'الحدود والرسوم')); field(Pb, 'مدة التمويل القصوى لهذا البنك (شهر)', b, 'max_term', 'num'); field(Pb, 'عمر نهاية التمويل لهذا البنك', b, 'max_age_end', 'num'); field(Pb, 'أقل راتب', b, 'min_salary', 'num'); field(Pb, 'أعلى مبلغ تمويل', b, 'max_amount', 'num');
          field(Pb, 'الرسوم الإدارية %', b.fees, 'admin_pct', 'num'); field(Pb, 'حد الرسوم الإدارية (ريال)', b.fees, 'admin_cap', 'num'); field(Pb, 'ضريبة القيمة المضافة على الرسوم %', b.fees, 'vat_pct', 'num');
          const ms = el('div'); Pb.append(ms); list(ms, [b], [{ k: 'sectors', label: 'القطاعات المشمولة (فارغ = الكل)', type: 'multi', options: SECT() }, { k: 'properties', label: 'أنواع العقار المشمولة (فارغ = الكل)', type: 'multi', options: (Wc.properties || []).map(p => [p.key, p.label]) }], { reorder: false, remove: false });
          Pb.append(el('h4', '', 'العروض والخصائص الخاصة'));
          list(Pb, b.offers, [{ k: 'title', label: 'عنوان العرض', type: 'text' }, { k: 'rate', label: 'النسبة %', type: 'num' }, { k: 'plan', label: 'نوع القسط', type: 'select', options: PLANS }, { k: 'support', label: 'الدعم', type: 'select', options: SUP },
            { k: 'personal', label: 'التمويل الشخصي', type: 'select', options: [['any', 'لا يهم'], ['yes', 'لديه تمويل شخصي'], ['no', 'بدون تمويل شخصي']] }, { k: 'property', label: 'نوع العقار', type: 'select', options: [['any', 'أي نوع']].concat((Wc.properties || []).map(p => [p.key, p.label])) },
            { k: 'min_term', label: 'أقل مدة (شهر)', type: 'num' }, { k: 'max_term', label: 'أعلى مدة (شهر)', type: 'num' }, { k: 'sectors', label: 'القطاعات (فارغ = الكل)', type: 'multi', options: SECT() },
            { k: 'entities', label: 'الجهات المشمولة (افصل بفاصلة)', type: 'csv' }, { k: 'active', label: 'مفعّل', type: 'bool', def: true }],
          { add: () => ({ id: 'o' + Date.now().toString(36), title: 'عرض خاص', rate: null, plan: 'any', support: 'any', personal: 'any', property: 'any', sectors: [], entities: [], active: true }), addLabel: 'إضافة عرض خاص' });
          btn(Pb, 'تم', () => { s2.ov.remove(); draw(); }, 're42-go wide');
        }
      }
      if (k === 'limits') {
        const L = Wc.limits = Wc.limits || {}; P.append(el('h4', '', 'حدود المدة والعمر'));
        field(P, 'مدة التمويل القصوى (شهر)', L, 'max_term', 'num'); field(P, 'أقل مدة (شهر)', L, 'min_term', 'num'); field(P, 'المدة الافتراضية في بطاقة المدة (شهر)', L, 'default_term', 'num'); field(P, 'عمر نهاية التمويل', L, 'max_age_end', 'num');
        field(P, 'تقويم عمر نهاية التمويل', L, 'age_calendar_end', 'select', { options: [['gregorian', 'ميلادي'], ['hijri', 'هجري']] });
        const Dt = Wc.dti = Wc.dti || {}; Dt.salary = Dt.salary || {}; Dt.retired = Dt.retired || {};
        P.append(el('h4', '', 'قاعدة الاستقطاع (قبل التقاعد)')); field(P, 'حد الراتب', Dt.salary, 'threshold', 'num'); field(P, 'النسبة تحت الحد %', Dt.salary, 'low', 'num'); field(P, 'النسبة من الحد فأعلى %', Dt.salary, 'high', 'num');
        P.append(el('h4', '', 'قاعدة الاستقطاع (بعد التقاعد / المتقاعد)')); field(P, 'حد الدخل', Dt.retired, 'threshold', 'num'); field(P, 'النسبة تحت الحد %', Dt.retired, 'low', 'num'); field(P, 'النسبة من الحد فأعلى %', Dt.retired, 'high', 'num');
        P.append(el('h4', '', 'الترشيح')); field(P, 'معيار الترتيب', Wc, 'ranking', 'select', { options: [['amount', 'أعلى مبلغ تمويل'], ['installment', 'أقل قسط'], ['profit', 'أقل أرباح']] }); field(P, 'عدد البنوك المرشحة', Wc, 'top_n', 'num');
        field(P, 'نوع القسط الافتراضي', Wc, 'default_plan', 'select', { options: [['step', 'متزايد'], ['fixed', 'ثابت']] });
      }
      if (k === 'sectors') {
        P.append(el('h4', '', 'القطاعات')); list(P, Wc.sectors = Wc.sectors || [], [{ k: 'label', label: 'الاسم الظاهر', type: 'text' }, { k: 'enabled', label: 'مفعّل', type: 'bool', def: true }, { k: 'retire_age', label: 'سن التقاعد (مدني)', type: 'num' },
          { k: 'calendar', label: 'تقويم التقاعد', type: 'select', options: [['gregorian', 'ميلادي'], ['hijri', 'هجري']] }, { k: 'extend', label: 'يسمح بالتمويل بعد التقاعد', type: 'bool' }], { remove: false });
        P.append(el('p', 're42-muted', 'العسكري يحسب تقاعده من الرتبة (تبويب الرتب). المتقاعد يحسب على المعاش حتى عمر نهاية التمويل.'));
        P.append(el('h4', '', 'الجهات (وزارات وجهات عمل)')); list(P, Wc.entities = Wc.entities || [], [{ k: 'name', label: 'اسم الجهة', type: 'text' }, { k: 'sector', label: 'القطاع', type: 'select', options: SECT() }], { add: () => ({ name: '', sector: 'gov' }), addLabel: 'إضافة جهة' });
      }
      if (k === 'ranks') {
        const M = Wc.military = Wc.military || {}; field(P, 'تقويم سن التقاعد العسكري', M, 'calendar', 'select', { options: [['hijri', 'هجري'], ['gregorian', 'ميلادي']] }); field(P, 'قاسم المعاش بالأشهر (35 سنة = 420)', M, 'pension_divisor_months', 'num'); field(P, 'تقويم عدّ أشهر الخدمة', M, 'service_calendar', 'select', { options: [['gregorian', 'ميلادي'], ['hijri', 'هجري']] });
        field(P, 'المعاش لا يتجاوز الراتب الأساسي', M, 'cap_at_basic', 'bool', { def: true }); field(P, 'التمويل بعد التقاعد مفعّل افتراضيًا للعسكري', M, 'extend_default', 'bool', { def: true });
        P.append(el('p', 're42-muted', 'المصدر: نظام التقاعد العسكري — المادة 8 (جزء من 35) والمادة 11 (سن الإحالة حسب الرتبة).'));
        list(P, M.ranks = M.ranks || [], [{ k: 'name', label: 'الرتبة', type: 'text' }, { k: 'group', label: 'الفئة', type: 'select', options: [['nco', 'أفراد'], ['officer', 'ضباط']] }, { k: 'age', label: 'سن التقاعد', type: 'num' }, { k: 'pilot_age', label: 'سن الطيارين', type: 'num' }],
          { add: () => ({ key: 'r' + Date.now().toString(36), name: '', group: 'nco', age: null }), addLabel: 'إضافة رتبة' });
      }
      if (k === 'support') {
        const Sp = Wc.support = Wc.support || {}; P.append(el('h4', '', 'الدعم السكني')); P.append(el('p', 're42-muted', 'الدعم المقدم هو الافتراضي عند اختيار «مدعوم».'));
        field(P, 'مبلغ الدعم المقدم (يضاف لقيمة العقار التقديرية)', Sp, 'upfront_amount', 'num'); field(P, 'تفعيل الدعم الشهري', Sp, 'monthly_enabled', 'bool'); field(P, 'مبلغ الدعم الشهري', Sp, 'monthly_amount', 'num'); field(P, 'عدد أشهر الدعم الشهري (0 = كامل المدة)', Sp, 'monthly_months', 'num');
        field(P, 'إظهار «اعتزاز» للعسكري', Sp, 'etizaz_enabled', 'bool');
        P.append(el('h4', '', 'المنتجات العقارية')); list(P, Wc.properties = Wc.properties || [], [{ k: 'label', label: 'الاسم', type: 'text' }, { k: 'enabled', label: 'مفعّل', type: 'bool' }], { remove: false });
        P.append(el('h4', '', 'بنك الراتب')); Wc.salary_other = Wc.salary_other || {}; field(P, 'إظهار «بنك آخر»', Wc.salary_other, 'enabled', 'bool'); field(P, 'نسبة مخصصة لـ«بنك آخر» (اختياري)', Wc.salary_other, 'rate', 'num');
      }
      if (k === 'questions') {
        P.append(el('h4', '', 'ترتيب الأسئلة ونصوصها')); P.append(el('p', 're42-muted', 'استخدم {name} لاسم العميل. أسئلة الرتبة والجهة العسكرية والتعيين والراتب الأساسي تظهر للعسكري فقط.'));
        list(P, Wc.questions = Wc.questions || [], [{ k: 'text', label: 'السؤال', type: 'text' }, { k: 'enabled', label: 'مفعّل', type: 'bool', def: true }], { remove: false });
        P.append(el('h4', '', 'النصوص والنتائج')); const Tx = Wc.texts = Wc.texts || {};
        [['greeting', 'الترحيب'], ['duration_title', 'عنوان بطاقة المدة'], ['extend_label', 'خيار التمويل بعد التقاعد'], ['reduce_label', 'شريط تقليل المدة'], ['approve_label', 'زر اعتماد المدة'], ['results_title', 'عنوان النتائج'],
          ['rank_amount', 'وصف الترتيب (أعلى مبلغ)'], ['entity_offer_cta', 'زر عروض الجهات'], ['fixed_offer_cta', 'زر عرض القسط الثابت'], ['back_prev', 'زر الرجوع للحسبة السابقة'], ['no_banks', 'رسالة عدم وجود بنك مؤهل'],
          ['pension_note', 'تنويه المعاش'], ['disclaimer', 'التنويه المبدئي'], ['share_intro', 'مقدمة المشاركة'], ['trial_note', 'تنويه وضع التجربة']].forEach(([key, l]) => field(P, l, Tx, key, key.length > 12 || ['disclaimer', 'pension_note'].includes(key) ? 'textarea' : 'text', { rows: 2 }));
      }
      if (k === 'preview') {
        P.append(el('p', 're42-note', 'المعاينة تستخدم الإعدادات الحالية في هذه الشاشة (حتى غير المحفوظة) ولا تستهلك أي كود أو حسبة.'));
        const row = el('div', 're42-actions');
        btn(row, 'تجربة المالك (مع بنوك الاختبار)', () => openBot({ mode: 'owner', trial: true, cfg: clone(Wc) }), 're42-go');
        btn(row, 'معاينة كما يراها العميل', () => { const c = clone(Wc); c.banks = (c.banks || []).filter(b => !b.test && b.approved && b.active !== false && b.included !== false); openBot({ mode: 'owner', trial: false, cfg: c, preview: 'معاينة العميل' }); });
        btn(row, 'معاينة الحاسبة التقليدية', () => { const t = D.getElementById('f99m-owner-quote'); if (t) { sh.ov.remove(); t.click(); } else toast('افتح «النسخة السابقة» من لوحة المالك ثم «حاسبة التمويل العقاري»', true); });
        P.append(row);
      }
      if (k === 'log') {
        P.append(el('p', 're42-note', 'كل حفظ أو تشغيل أو إخفاء يُسجل كنسخة. التراجع ينشئ نسخة جديدة مطابقة للنسخة المختارة دون حذف السجل.'));
        (S.versions || []).forEach(v => { const r = el('div', 're42-row'); r.append(el('b', '', 'نسخة ' + v.revision + ' — ' + ({ seed: 'إعداد أولي', save: 'حفظ', set: 'تشغيل/إظهار', rollback: 'تراجع' }[v.action] || v.action)),
          el('span', 're42-muted', new Date(v.at).toLocaleString('ar-SA-u-nu-latn') + (v.note ? ' — ' + v.note : '') + ' — ' + (v.enabled ? 'مفعّلة' : 'معطّلة') + '، ' + (v.visible ? 'ظاهرة' : 'مخفية')));
          if (v.revision !== S.revision) btn(r, 'تراجع لهذه النسخة', async () => { if (!confirm('التراجع إلى النسخة ' + v.revision + '؟')) return; try { await ownerCall('rollback', { version_id: v.id, expected_revision: S.revision }); toast('تم التراجع'); pubCache = null; await reload(); } catch (e) { toast(reason(e.message), true); } }, 're42-mini');
          P.append(r); });
      }
      if (k === 'json') {
        P.append(el('p', 're42-muted', 'للمستخدم المتقدم: الإعدادات كاملة بصيغة JSON. التطبيق هنا لا يحفظ حتى تضغط «حفظ التغييرات».'));
        const ta = el('textarea', 're42-json'); ta.rows = 18; ta.value = JSON.stringify(Wc, null, 1); P.append(ta);
        btn(P, 'تطبيق على الشاشة', () => { try { const v = JSON.parse(ta.value); if (!v || typeof v !== 'object') throw 0; Wc = v; mark(); toast('تم التطبيق؛ اضغط حفظ'); } catch (e) { toast('صيغة JSON غير صحيحة', true); } }, 're42-link');
      }
    }
    show('general');
    W.F99RE42._center = { get S() { return S; }, get Wc() { return Wc; }, show };
  }

  // ---------- owner tile in the r38 owner home ----------
  function tile() {
    if (!isOwner()) return; const g = D.querySelector('.f38-grid'); if (!g || g.querySelector('[data-k="re42"]')) return;
    const b = el('button', 'f38-tile re42-tile'); b.type = 'button'; b.dataset.k = 're42'; b.onclick = openCenter;
    b.append(el('span', 'f38-ic', '🏡'), el('b', '', 'مركز التحكم بالتمويل العقاري'), el('small', '', 'البوت العقاري والبنوك والنسب والرتب — وضع التجربة'));
    const ref = g.querySelector('[data-k="packages"]'); if (ref) g.insertBefore(b, ref); else g.append(b);
  }
  // ---------- client route: only when owner enabled + visible + bot mode ----------
  function hookClient() {
    const orig = W.F99V13RunService; if (typeof orig !== 'function' || orig.__re42) return;
    const wrap = async function (svc) {
      if ((svc === 'mortgage_quote' || svc === 'bot_mortgage_quote') && !isOwner()) {
        try { const p = await pub(); if (p && p.enabled && p.visible && p.mode === 'bot' && p.config) { openBot({ mode: 'client', trial: false, cfg: p.config }); return; } } catch (e) {}
      }
      return orig.apply(this, arguments);
    };
    wrap.__re42 = true; W.F99V13RunService = wrap;
  }
  W.F99RE42 = { openBot, openCenter, isOwner, version: 'r42a' };
  const tick = () => { try { tile(); hookClient(); } catch (e) {} };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', tick); else tick();
  setInterval(tick, 1500);
})();
