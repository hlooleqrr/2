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
  const fmt2 = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // r48: halalas
  const monthsTxt = n => n === 1 ? 'شهر واحد' : n === 2 ? 'شهران' : (n >= 3 && n <= 10) ? n + ' أشهر' : n + ' شهرًا';
  const yearsTxt = n => n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتان' : (n >= 3 && n <= 10) ? n + ' سنوات' : n + ' سنة';
  const durTxt = m => { const y = Math.floor(m / 12), r = m % 12; if (!y) return monthsTxt(r); if (!r) return yearsTxt(y); return yearsTxt(y) + ' و' + monthsTxt(r); };
  const gStr = g => g ? String(g.d).padStart(2, '0') + '/' + String(g.m).padStart(2, '0') + '/' + g.y : '';
  const first = d => String((d && d.name) || '').replace(/[<>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) // r58: full (compound) name; // r51: the client's first name
  const tpl = (s, d) => String(s || '').replace(/\{name\}/g, first(d));
  const ERR = { BIRTH_INVALID: 'تاريخ الميلاد غير صحيح', AGE_OUT_OF_RANGE: 'العمر خارج النطاق المسموح للتمويل', NET_REQUIRED: 'أدخل الراتب الصافي', RANK_REQUIRED: 'اختر الرتبة',
    RANK_AGE_MISSING: 'سن التقاعد لهذه الرتبة غير محدد في الإعدادات', APPOINT_INVALID: 'تاريخ التعيين غير صحيح', BASIC_REQUIRED: 'أدخل الراتب الأساسي', EXCL_INVALID: 'المدة غير المحتسبة أكبر من مدة خدمتك' };
  // r54: «تحويل المديونية العقارية» texts (owner may override in cfg.transfer.texts)
  const TRT = { greeting: 'أهلًا بك في حاسبة تحويل المديونية العقارية من FINO99. بنسألك أسئلة قصيرة، ونعرض لك عروض البنوك اللي تستقبل تحويل التمويل العقاري.', results_title: 'نتائج تحويل تمويلك العقاري يا {name}',
    duration_title: 'مدة التمويل الجديد لك يا {name}', share_intro: 'ملخص حسبة تحويل مديونيتي العقارية المبدئية من FINO99', no_banks: 'ما فيه بنك مفعّل يستقبل تحويل تمويلك العقاري بحالتك حاليًا.' };
  // r54: personal debt-transfer rate of a bank (read-only from the personal calculator's RATES table, by net salary band) — base for personal buyout / new personal
  function personalBase(id, inp) { try { const key = id === 'SNB' ? (inp.sector === 'military' ? 'SNB_MIL' : 'SNB_CIV') : id; const t = (typeof RATES !== 'undefined' && RATES) ? RATES[key] : null;
    if (!Array.isArray(t) || typeof findRate !== 'function') return NaN; const r = Number(findRate(Number(inp.net) || 0, t)); return r > 0 ? r : NaN; } catch (e) { return NaN; } }
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
    const r = await finoRpc('f99re_public', {}, 12000); if (!r || !r.ok) return null; let d = r.data;
    // r48c: owner trial code — the bot opens for that code's own session only; public visibility is unchanged.
    if (d && d.enabled && !d.visible && !isOwner()) { try { const e = typeof finoCentralRestoreEntry === 'function' ? finoCentralRestoreEntry() : null;
      if (e && e.entryToken) { const t = await finoRpc('f99r50_client_public', { p_entry_token: e.entryToken, p_device_id: e.deviceId || (typeof finoCentralDeviceId === 'function' ? finoCentralDeviceId() : '') }, 12000); if (t && t.ok && t.data && t.data.visible) d = t.data; } } catch (x) {} }
    pubCache = d; pubAt = Date.now(); return pubCache;
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
  // ---------- r50: result image — same values as the screen; sensitive client data hidden by default; official FINO99 icon; optional QR ----------
  // r51: owner colours for the mortgage package only (defaults = the debt-transfer results palette); applied as CSS variables on the bot overlay
  const THEME_DEF = { navy: '#073b67', blue: '#0a5187', green: '#0b7a3e', bg: '#f2f6fa', card: '#ffffff', text: '#16324a', chip_bg: '#eaf2f9', chip_text: '#073b67' };
  const okCol = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));
  function applyTheme(node, th) { const t = Object.assign({}, THEME_DEF); Object.keys(th || {}).forEach(k => { if (okCol(th[k])) t[k] = th[k]; });
    [['--nv', t.navy], ['--p', t.blue], ['--ok', t.green], ['--bg', t.bg], ['--card', t.card], ['--k', t.text], ['--cb', t.chip_bg], ['--ct', t.chip_text]].forEach(([k, v]) => node.style.setProperty(k, v)); return t; }
  const DESIGN_DEF = { name: false, rank: false, employer: false, birth: false, appoint: false, salary: false, retirement: false, salary_bank: false, bank_name: true, rates: true, contact: true, qr: true };
  const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); if (/^https?:/i.test(src) && !src.startsWith(location.origin)) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; setTimeout(() => res(null), 4000); });
  let qrP = null; const loadQR = () => qrP || (qrP = new Promise(res => { if (W.qrcode) return res(W.qrcode); const sc = D.createElement('script'); sc.src = './vendor/qrcode-gen-1.4.4.js'; sc.onload = () => res(W.qrcode || null); sc.onerror = () => { qrP = null; res(null); }; D.head.append(sc); setTimeout(() => res(W.qrcode || null), 5000); }));
  function chipsFor(b, d, cfg) { const pr = (cfg.properties || []).find(p => p.key === (d.property || 'ready')); const sa = b.sup || {}; const out = [pr ? pr.label : 'وحدة جاهزة'];
    out.push(d.supported ? 'مدعوم سكنيًا' : 'غير مدعوم'); if (d.supported && (sa.key === 'monthly' ? sa.monthly > 0 : (sa.upfront > 0 && sa.upfrontCounted))) out.push(sa.key === 'monthly' ? 'دعم شهري' : 'دعم مقدم'); // r58 if (b.etz) out.push('اعتزاز');
    out.push(b.months + ' شهرًا (' + durTxt(b.months) + ')'); out.push(b.plan === 'fixed' ? 'قسط ثابت' : 'قسط متغير'); return out; } // r55
  function supportKV(b, d) { const sa = b.sup || {}; const out = [];
    if (d.supported && sa.key === 'upfront') out.push(['الدعم المقدم', sa.upfront > 0 ? fmt(sa.upfront) + ' ريال' + (sa.upfrontCounted ? '' : ' (غير مجموع مع اعتزاز)') : 'حسب أهليتك — غير مضاف للحسبة']);
    if (sa.monthly > 0) out.push(['الدعم الشهري', fmt(sa.monthly) + ' ريال' + (sa.monthlyMonths > 0 ? ' لمدة ' + sa.monthlyMonths + ' شهرًا' : '')]);
    if (b.etz) out.push(['قرض اعتزاز الحسن (دفعة مقدمة)', fmt(b.etz.amount) + ' ريال']);
    if (b.propertyValueR > b.amountR) out.push(['قيمة الشراء التقديرية (التمويل + ' + [sa.upfrontCounted && sa.upfront > 0 ? 'الدعم' : '', b.etz ? 'اعتزاز' : ''].filter(Boolean).join(' + ') + ')', fmt(b.propertyValueR) + ' ريال']);
    return out; }
  async function drawResult(X) {
    const R = X.R, T = X.T || {}, cfg = X.cfg || {}, d = X.data || {}; const DZ = Object.assign({}, DESIGN_DEF, cfg.card_design || {}, X.design || {});
    const list = X.only || (R ? R.results.slice(0, 3) : []); const RK0 = X.rank || 0, TRX = X.product === 'transfer'; const WD = 1080, M = 36, IN = 30, CW = WD - 2 * M - 2 * IN, XR = WD - M - IN, XL = M + IN;
    const font = (getComputedStyle(D.body).fontFamily || 'sans-serif'); const mc = D.createElement('canvas').getContext('2d'); mc.direction = 'rtl';
    const wrapT = (t, sz, wt, w) => { const lim = w || CW; mc.font = (wt || 400) + ' ' + sz + 'px ' + font; const out = [];
      String(t || '').split('\n').forEach(par => { let cur = ''; par.split(/\s+/).filter(Boolean).forEach(w0 => { let wd = w0;
          while (mc.measureText(wd).width > lim) { let k = wd.length - 1; while (k > 1 && mc.measureText(wd.slice(0, k)).width > lim) k--; if (cur) { out.push(cur); cur = ''; } out.push(wd.slice(0, k)); wd = wd.slice(k); }
          const tt = cur ? cur + ' ' + wd : wd; if (cur && mc.measureText(tt).width > lim) { out.push(cur); cur = wd; } else cur = tt; }); if (cur) out.push(cur); });
      return out; };
    const ops = []; let y = 0; const LH = sz => Math.round(sz * 1.5); const gap = h => { y += h; };
    const text = (t, sz, wt, col) => { wrapT(t, sz, wt).forEach(l => { y += LH(sz); ops.push({ k: 't', t: l, sz, wt: wt || 400, col: col || '#0b2545', x: XR, y: y - Math.round(sz * .42) }); }); };
    const pairs = (arr, sz) => { const half = CW / 2 - 14; for (let k = 0; k < arr.length; k += 2) { const a = arr[k], b = arr[k + 1];
        const la = wrapT(a[0] + ': ' + a[1], sz, 400, half), lb = b ? wrapT(b[0] + ': ' + b[1], sz, 400, half) : []; const n = Math.max(la.length, lb.length);
        for (let j = 0; j < n; j++) { y += LH(sz); const yy = y - Math.round(sz * .42); if (la[j]) ops.push({ k: 't', t: la[j], sz, wt: 400, col: '#223', x: XR, y: yy }); if (lb[j]) ops.push({ k: 't', t: lb[j], sz, wt: 400, col: '#223', x: XR - CW / 2 - 14, y: yy }); } gap(4); } };
    const card = (bg, bd, fn) => { const y0 = y; gap(20); fn(); gap(22); ops.push({ k: 'c', y0, y1: y, bg, bd }); gap(16); };
    const table = (rowsAll) => { const ez = rowsAll.some(r => r.ez > 0), post = rowsAll.some(r => r.post); const rows = rowsAll.length > 8 ? rowsAll.slice(0, 7).concat([rowsAll[rowsAll.length - 1]]) : rowsAll;
      const cols = ['الفترة (شهر)', 'القسط العقاري', 'التزامات أخرى'].concat(ez ? ['اعتزاز'] : []).concat(['إجمالي الاستقطاع']).concat(DZ.salary ? ['الدخل'] : []); const n = cols.length, cw = (CW - 8) / n, rh = 52;
      const row = (vals, bg, col, wt, sz) => { const y0 = y; ops.push({ k: 'r', x0: XL + 4, y0, w: CW - 8, h: rh, bg }); vals.forEach((v, j) => ops.push({ k: 't', t: v, sz, wt, col, x: XR - 4 - cw * j - cw / 2, y: y0 + rh / 2 + sz * .36, al: 'center', max: cw - 8 })); y += rh; };
      text('تفاصيل الأقساط', 24, 700, '#34506b'); gap(6); row(cols, '#e6eef7', '#34506b', 700, 21);
      rows.forEach((r, k) => row([(r.from === r.to ? String(r.from) : r.from + '–' + r.to) + (r.post ? ' تقاعد' : ''), fmt(r.pay), r.ob > 0 ? fmt(r.ob) : '—'].concat(ez ? [r.ez > 0 ? fmt(r.ez) : '—'] : []).concat([fmt(r.total)]).concat(DZ.salary ? [fmt(r.income)] : []), r.post ? '#fbf3e4' : (k % 2 ? '#f5f8fc' : '#ffffff'), '#1d2b3a', 400, 23));
      if (rowsAll.length > 8) text('… عرضنا أول 7 فترات وآخر فترة', 19, 400, '#667'); if (post) text(DZ.salary ? '«تقاعد» = بعد التقاعد، والدخل فيها هو المعاش التقاعدي التقديري' : '«تقاعد» = بعد التقاعد', 19, 400, '#8a5a00'); };
    gap(196); const panel0 = y; gap(14);
    const info = []; const rk = ((cfg.military || {}).ranks || []).find(r => r.key === d.rank); const sb = (cfg.banks || []).find(b => b.id === d.salary_bank); const pr = R && R.profile;
    if (DZ.name && d.name) info.push(['الاسم', d.name]); if (DZ.rank && rk) info.push(['الرتبة', rk.name]); if (DZ.employer && (d.mil_entity || d.employer) && (d.mil_entity || d.employer) !== '-') info.push(['جهة العمل', d.mil_entity || d.employer]);
    if (DZ.birth && d.birth) info.push(['تاريخ الميلاد', gStr(d.birth) + 'م']); if (DZ.appoint && d.appoint) info.push(['تاريخ التعيين', gStr(d.appoint) + 'م']);
    if (DZ.salary && d.net) info.push(['الراتب الصافي', fmt(d.net) + ' ريال']); if (DZ.salary && d.basic) info.push(['الراتب الأساسي', fmt(d.basic) + ' ريال']);
    if (DZ.retirement && pr && pr.sector === 'military' && pr.R > 0) { info.push(['التقاعد', 'بعد ' + pr.R + ' شهرًا']); if (pr.pension != null) info.push(['المعاش التقديري', fmt2(pr.pension) + ' ريال']); }
    if (DZ.salary_bank && sb) info.push(['بنك الراتب', sb.name]);
    if ((cfg.phone || {}).show === true && d.phone) info.push(['الجوال', d.phone]); // r54: future optional field (owner controlled)
    if (TRX) { const ob = (cfg.banks || []).find(b => b.id === d.tr_bank); info.push(['البنك الحالي', ob ? ob.name : 'جهة أخرى']); if (d.tr_left) info.push(['المتبقي على العقد', monthsTxt(d.tr_left)]); }
    text(tpl(T.duration_title || 'مدة التمويل لك يا {name}', DZ.name ? d : {}).replace(/\s+يا\s*$/, ''), 38, 700); text(X.months + ' شهرًا — ' + durTxt(X.months) + (X.extend ? ' — تمتد بعد التقاعد' : ''), 28, 400, '#334');
    text(X.plan === 'fixed' ? 'نوع القسط: ثابت' : (TRX ? 'نوع القسط: متزايد' + (list.some(b => b.rateSource === 'same_margin') ? ' (تقديري على هامش الثابت — غير معتمد من البنوك)' : '') : 'نوع القسط: متغير'), 26, 400, '#334'); // r55
    if (X.scn === 'closed') text('حسبة مشروطة بإقفال العقود المحددة بالكامل قبل التمويل', 22, 700, '#8a5a00');
    if (TRX && X.trScn === 'buy') text('سيناريو: تحويل العقاري مع شراء التمويل الشخصي (تمويل مستقل)', 22, 700, '#8a5a00');
    if (TRX && d.tr_keep) text('الدعم الشهري تقديري، واستمراره مشروط بموافقة الجهات المختصة', 22, 700, '#8a5a00'); gap(10);
    if (info.length) card('#f7f9fc', '#e1e8f0', () => pairs(info, 24));
    if (R && R.etizaz) { const ep = R.etizaz; card('#f3f8ff', '#c9dcf3', () => { text('قرض اعتزاز الحسن ' + fmt(ep.amount) + ' ريال', 30, 800, '#13315c');
        pairs([['القسط الشهري', fmt2(ep.inst) + ' ريال'], ['فترة السماح', monthsTxt(ep.grace)], ['السداد', 'الشهر ' + Math.max(1, ep.firstPay) + ' – ' + ep.lastPay], ['مدة السداد', ep.months + ' شهرًا']], 23); }); }
    const ORDN = ['الترشيح الأول', 'الترشيح الثاني', 'الترشيح الثالث'];
    if (list.length) list.forEach((b, i) => card('#ffffff', i === 0 ? '#9cc0dc' : '#dbe6ef', () => { // r51: one line per value, instalments by period once
        text((ORDN[i + RK0] || 'الترشيح ' + (i + RK0 + 1)) + (DZ.salary_bank && d.salary_bank === b.id ? ' — بنك نزول راتبك' : ''), 23, 800, '#0a5187');
        text((DZ.bank_name ? b.name : 'جهة تمويلية ' + (i + 1)) + (b.test ? ' (اختبار)' : '') + (DZ.rates ? ' — ' + pct(b.rate) : ''), 34, 900, '#073b67');
        const sa = b.sup || {}; const up = sa.upfrontCounted && sa.upfront > 0 ? sa.upfront : 0; const ez = b.etz ? b.etz.amount : 0; const a = []; const UPT = !TRX && up > 0; // r55: total = bank financing + eligible upfront support
        text(TRX ? 'مبلغ التمويل اللازم للتحويل' : (UPT ? 'إجمالي التمويل المتاح مع الدعم' : 'مبلغ التمويل العقاري من البنك'), 23, 700, '#587182'); text(fmt(b.amount + (UPT ? up : 0)) + ' ريال', 56, 900, '#0a5187');
        if (UPT) a.push(['تمويل البنك', fmt(b.amount) + ' ريال']);
        if (up) a.push(['الدعم السكني المقدم', fmt(up) + ' ريال']); if (ez) a.push(['قرض اعتزاز الحسن', fmt(ez) + ' ريال']); if (TRX ? (up || ez) : ez) a.push(['إجمالي القيمة المتاحة للشراء', fmt(b.propertyValueR) + ' ريال']);
        b.stages.slice(0, 6).forEach(st => a.push([(st.from === st.to ? 'قسط الشهر ' + st.from : 'القسط ' + st.from + '–' + st.to) + (st.post ? ' (تقاعد)' : ''), fmt2(st.raw != null ? st.raw : st.amount) + ' ريال']));
        const FE = b.fees || {}; a.push(['إجمالي الأرباح', fmt(b.profit) + ' ريال'], ['الرسوم الإدارية', FE.fee > 0 ? fmt2(FE.total) + ' ريال' : (FE.mode === 'exempt' ? 'معفاة' : 'لا توجد')], ['المدة', b.months + ' شهرًا']);
        const TX = b.transfer; if (TX) { const TC = cfg.transfer || {}; // r54
          if (TX.oldInst > 0) a.push(['قسطك الحالي', fmt2(TX.oldInst) + ' ريال']); if (TX.saving != null && TX.saving > 0.5) a.push(['الفرق الشهري التقديري', fmt2(TX.saving) + ' ريال']);
          if (TX.extra > 0.5 && TC.show_extra !== false) a.push(['كاش إضافي متاح (منفصل)', 'حتى ' + fmt(TX.extra) + ' ريال']); if (TX.shortest && TX.shortest < b.months) a.push(['أقصر مدة متاحة', TX.shortest + ' شهرًا']);
          if (TX.support && TX.support.monthly > 0) a.push(['الدعم الشهري المتوقع (تقديري)', fmt2(TX.support.monthly) + ' ريال']);
          if (TX.personalBuy) a.push(['شراء الشخصي (مستقل)', fmt(TX.personalBuy.amount) + ' ريال — قسط ' + fmt2(TX.personalBuy.inst)]);
          if (TX.personalNew) a.push(['تمويل شخصي جديد (خيار مستقل)', 'حتى ' + fmt(TX.personalNew.amount) + ' ريال' + (TX.personalNew.source === 'assumed' ? ' — نسبة افتراضية' : '')]); }
        pairs(a, 23); }));
    else card('#fff4f4', '#f3c2c2', () => { text('لا توجد جهة مؤهلة حاليًا', 36, 700, '#a00'); text(X.why || tpl(T.no_banks, d), 28, 400, '#7a1d1d'); text('تقدر تعدّل البيانات أو المدة وتعيد الحسبة.', 26, 400, '#556'); });
    text((X.trial ? 'تجربة داخلية — نسب اختبار غير معتمدة. ' : '') + (T.disclaimer || ''), 21, 400, '#555'); gap(20); const panel1 = y;
    const QR = DZ.qr ? await loadQR() : null; const foot = QR ? 210 : 86; gap(foot); const H = Math.ceil(y);
    const logo = await loadImg(W.F99_APP_ICON || './icon-192.png');
    const paint = lg => { const cv = D.createElement('canvas'); cv.width = WD; cv.height = H; const x = cv.getContext('2d'); x.direction = 'rtl'; x.textAlign = 'right';
      const rr = (x0, y0, w, h, r) => { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); };
      x.fillStyle = '#eef3f8'; x.fillRect(0, 0, WD, H); const gr = x.createLinearGradient(0, 0, WD, 180); gr.addColorStop(0, '#0b2545'); gr.addColorStop(1, '#134074'); x.fillStyle = gr; x.fillRect(0, 0, WD, 180);
      let tx = WD - M; if (lg) { x.save(); rr(WD - M - 112, 34, 112, 112, 24); x.clip(); x.drawImage(lg, WD - M - 112, 34, 112, 112); x.restore(); tx = WD - M - 136; }
      x.fillStyle = '#ffffff'; x.font = '800 60px ' + font; x.fillText('FINO99', tx, 98); x.font = '400 30px ' + font; x.fillText(TRX ? 'حسبة تحويل مديونية عقارية مبدئية' : 'حسبة تمويل عقاري مبدئية', tx, 142);
      x.fillStyle = '#ffffff'; rr(M, panel0, WD - 2 * M, panel1 - panel0, 24); x.fill();
      ops.filter(o => o.k === 'c').forEach(o => { x.fillStyle = o.bg; rr(M + 16, o.y0, WD - 2 * M - 32, o.y1 - o.y0, 18); x.fill(); x.strokeStyle = o.bd; x.lineWidth = 2; x.stroke(); });
      ops.filter(o => o.k === 'r').forEach(o => { x.fillStyle = o.bg; x.fillRect(o.x0, o.y0, o.w, o.h); x.fillStyle = '#e3e9f1'; x.fillRect(o.x0, o.y0 + o.h - 1, o.w, 1); });
      ops.filter(o => o.k === 't').forEach(o => { let sz = o.sz; x.font = o.wt + ' ' + sz + 'px ' + font; while (o.max && x.measureText(o.t).width > o.max && sz > 13) { sz--; x.font = o.wt + ' ' + sz + 'px ' + font; }
        x.textAlign = o.al || 'right'; x.fillStyle = o.col; x.fillText(o.t, o.x, o.y); });
      x.textAlign = 'right'; const fy = panel1 + 20;
      if (QR) { try { const q = QR(0, 'M'); q.addData('https://www.fino99.com'); q.make(); const n = q.getModuleCount(), cs = Math.floor(160 / n), qs = cs * n, qx = M + 6, qy = fy + 10; x.fillStyle = '#ffffff'; x.fillRect(qx - 8, qy - 8, qs + 16, qs + 16); x.fillStyle = '#0b2545';
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(qx + c * cs, qy + r * cs, cs, cs); } catch (e) {} }
      if (DZ.contact) { x.fillStyle = '#0b2545'; x.font = '700 32px ' + font; x.fillText('www.fino99.com', WD - M - 10, fy + (QR ? 84 : 46)); x.font = '400 22px ' + font; x.fillStyle = '#556'; x.fillText('FINO99 | للحلول التمويلية الذكية', WD - M - 10, fy + (QR ? 122 : 76)); }
      return cv; };
    let cv = paint(logo), url; try { url = cv.toDataURL('image/png'); } catch (e) { cv = paint(null); url = cv.toDataURL('image/png'); }
    return { cv, url, H };
  }
  function imgSheet(r, title) { const s2 = sheet(title || 'صورة النتيجة', 're42-img'); const im = el('img'); im.alt = 'صورة نتيجة الحسبة'; im.src = r.url; im.dataset.h = String(r.H); s2.body.append(im);
    const row = el('div', 're42-actions'); const a = el('a', 're42-btn', 'حفظ الصورة'); a.href = r.url; a.download = 'FINO99-mortgage.png'; row.append(a);
    if (navigator.canShare) btn(row, 'مشاركة الصورة', () => { r.cv.toBlob(bl => { const f = new File([bl], 'FINO99-mortgage.png', { type: 'image/png' }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: 'https://www.fino99.com' }).catch(() => {}); else a.click(); }); });
    s2.body.append(row); return s2; }
  function sampleCase(c) { const RK = (c.military || {}).ranks || []; const rk = RK.find(r => r.name === 'عريف') || RK[0] || {}; const sb = (c.banks || [])[0];
    const data = { name: 'عميل تجريبي', sector: 'military', rank: rk.key, mil_entity: 'وزارة الدفاع', birth: { y: 1990, m: 3, d: 10 }, appoint: { y: 2011, m: 6, d: 1 }, basic: 6215, net: 9500, salary_bank: sb ? sb.id : null, supported: true, supportType: 'upfront', property: 'ready', obligations: [] };
    const inp = { sector: 'military', rank: rk.key, pilot: false, birth: data.birth, appoint: data.appoint, excludedMonths: 0, basic: 6215, grade: null, net: 9500, obligations: [], supported: true, supportType: 'upfront', property: 'ready', entity: 'وزارة الدفاع', mil_entity: 'وزارة الدفاع', etizaz: false, salary_bank: data.salary_bank };
    const dc = E().durationCard(inp, c); const plan = c.default_plan || 'fixed'; const R = E().compare(inp, c, { plan, months: dc.months, extend: dc.extend });
    return { R, data, months: dc.months, extend: dc.extend, plan, cfg: c, T: c.texts || {}, trial: false, why: R.results.length ? '' : 'لا توجد جهة مؤهلة في الحالة التجريبية' }; }
  async function launchCall(action, data) { if (typeof finoCentralAdminCall !== 'function') throw Error('اتصال المركزية غير متاح'); const r = await finoCentralAdminCall('f99r50_launch_owner', { p_action: action, p_data: data || {} });
    if (!r || !r.ok) throw Error((r && (r.reason || r.error)) || 'تعذر الاتصال بالمركزية'); if (r.data && r.data.ok === false) throw Error(r.data.reason || 'رفض الطلب'); return r.data; }
  async function archCall(action, data) { if (typeof finoCentralAdminCall !== 'function') throw Error('اتصال المركزية غير متاح'); const r = await finoCentralAdminCall('f99r54_archive_owner', { p_action: action, p_data: data || {} }); // r54
    if (!r || !r.ok) throw Error((r && (r.reason || r.error)) || 'تعذر الاتصال بالمركزية'); if (r.data && r.data.ok === false) throw Error(r.data.reason || 'رفض الطلب'); return r.data; }
  function toast(msg, bad) { const t = el('div', 're42-toast' + (bad ? ' bad' : ''), msg); D.body.append(t); setTimeout(() => t.remove(), 3200); }

  // =====================================================================
  //                               THE BOT
  // =====================================================================
  function openBot(opt) {
    const cfg = opt.cfg; const PROD = opt.product === 'transfer' ? 'transfer' : 'quote'; const TRC = cfg.transfer || {}; // r54
    const T = PROD === 'transfer' ? Object.assign({}, cfg.texts || {}, TRT, TRC.texts || {}) : (cfg.texts || {}); const trial = !!opt.trial;
    const S = { data: { obligations: [] }, months: null, extend: null, plan: cfg.default_plan || 'step', offers: {}, plans: {}, entity: null, history: [], showRest: false, metered: {}, cut: null, busy: false, meterP: {}, scn: 'now' };
    if (PROD === 'transfer') { S.plan = TRC.default_plan === 'step' ? 'step' : 'fixed'; S.trScn = 'only'; } // r54
    // r51: the entry captured when the bot opened (the platform heartbeat may clear it on a transient network failure while this overlay is open)
    const ENT0 = (() => { try { const e = typeof finoCentralRestoreEntry === 'function' ? finoCentralRestoreEntry() : null; return e && e.entryToken ? clone(e) : null; } catch (x) { return null; } })();
    // r48: an instalment type is offered only when enabled by the owner AND it has its own approved rates (no reuse of fixed rates for step)
    const IN = cfg.installments || {}; const anyRate = (b, p) => Object.values(((b.rates || {})[p]) || {}).some(v => Number(v) > 0); // r49: same approved margin unless the bank prices step separately
    const planHasRates = p => (trial && Number(IN.sim_rate) > 0) || (cfg.banks || []).some(b => (trial || !b.test) && b.active !== false && (anyRate(b, p) || (IN.same_margin !== false && !(p === 'step' && b.plan_pricing === 'separate') && anyRate(b, p === 'step' ? 'fixed' : 'step'))));
    const planOn = p => (p === 'fixed' ? cfg.plan_fixed_enabled !== false : cfg.plan_step_enabled !== false) && planHasRates(p);
    if (!planOn(S.plan) && planOn(S.plan === 'fixed' ? 'step' : 'fixed')) S.plan = S.plan === 'fixed' ? 'step' : 'fixed';
    const RD = cfg.reduce || {}; const cutOn = t => RD[t] !== false; const termOn = () => RD.term === true;
    const MG = PROD !== 'transfer'; const TP = cfg.term_policy || {}; const FIX = MG && TP.client_change !== true ? Math.max(12, Math.floor(Number(TP.fixed) || 240)) : 0; // r55: fixed package term for the client (owner may allow changes later)
    const fixMsg = () => tpl(String(T.term_fixed_msg || 'باقتك تدعم حاليًا مدة {months} شهرًا فقط، ولا تشمل تغيير المدة.').replace(/\{months\}/g, String(FIX)), S.data);
    const PLN = p => p === 'fixed' ? 'قسط ثابت' : (MG ? 'قسط متغير' : 'قسط متزايد'); const upOf = b => { const sa = b.sup || {}; return MG && sa.upfrontCounted && sa.upfront > 0 ? Number(sa.upfront) : 0; };
    const sh = sheet(PROD === 'transfer' ? (TRC.title || 'تحويل المديونية العقارية') : 'احتساب التمويل العقاري فورًا', 're42-bot' + (PROD === 'transfer' ? ' re54-tr' : '')); const log = el('div', 're42-log'); const dock = el('div', 're42-dock'); sh.body.append(log); sh.box.append(dock); // r49: dock = footer above the keyboard
    if (trial) sh.head.append(el('span', 're42-trial', 'وضع التجربة'));
    if (opt.preview) sh.head.append(el('span', 're42-trial alt', opt.preview));
    applyTheme(sh.ov, cfg.theme); // r51
    const OWN = (opt.mode === 'owner' && !opt.preview) || trial; // r51: technical details for the owner only (not in the client preview)
    // r49: smooth scroll — newest message fully visible (tall cards from their top), no jumps; keyboard-aware via visualViewport; dock is a footer
    const RM = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scroll = () => { requestAnimationFrame(() => requestAnimationFrame(() => { const b = sh.body, t = log.lastElementChild; if (!t) return; const max = b.scrollHeight - b.clientHeight;
      const want = t.offsetHeight > b.clientHeight - 16 ? Math.min(t.offsetTop - 8, max) : max; if (Math.abs(b.scrollTop - want) < 2) return;
      try { b.scrollTo({ top: want, behavior: RM ? 'auto' : 'smooth' }); } catch (e) { b.scrollTop = want; } })); };
    { const vv = W.visualViewport, ov = sh.ov; let lastH = 0;
      const fit = ev => { if (!ov.isConnected) return cleanup(); const h = vv ? vv.height : W.innerHeight; ov.style.setProperty('--vvh', h + 'px'); ov.style.setProperty('--vvt', (vv ? vv.offsetTop : 0) + 'px');
        ov.classList.toggle('kb', !!vv && (W.innerHeight - vv.height) > 120); if (Math.abs(h - lastH) > 40) { lastH = h; scroll(); } };
      const mo = new MutationObserver(() => { if (!ov.isConnected) cleanup(); });
      function cleanup() { if (vv) { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); } W.removeEventListener('resize', fit); D.documentElement.classList.remove('re42-lock'); mo.disconnect(); }
      mo.observe(D.body, { childList: true }); if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); } W.addEventListener('resize', fit);
      D.documentElement.classList.add('re42-lock'); fit(); dock.addEventListener('focusin', () => setTimeout(() => { lastH = 0; fit(); }, 320)); }
    const greetWord = () => { try { if (typeof W.F99SaudiGreetingWord === 'function') return W.F99SaudiGreetingWord(); } catch (e) {} let h = 0; try { h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Riyadh' }).format(new Date())) || 0; } catch (e) { h = new Date().getHours(); } return h < 12 ? 'صباح الخير' : 'مساء الخير'; }; // r58
    const bot = (txt, cls) => { const b = el('div', 're42-msg bot' + (cls ? ' ' + cls : '')); if (txt) b.textContent = txt; log.append(b); scroll(); return b; };
    const me = txt => { const b = el('div', 're42-msg me', txt); log.append(b); scroll(); };
    const clearDock = () => { dock.innerHTML = ''; };
    const sectors = () => (cfg.sectors || []).filter(s => s.enabled !== false);
    const isMil = () => S.data.sector === 'military';
    const rankObj = () => ((cfg.military || {}).ranks || []).find(r => r.key === S.data.rank);
    const entities = sec => (cfg.entities || []).filter(e => !e.sector || e.sector === sec).map(e => e.name);
    const Q = {}; (cfg.questions || []).forEach(q => { Q[q.key] = q; });
    const order = (cfg.questions || []).map(q => q.key);
    { const gi = order.indexOf('grade'); if (gi > -1) order.splice(gi, 1); } // r51: never asked (derived from rank + basic via the scale)
    { const oi = order.indexOf('obligations'); order.splice(oi < 0 ? order.length : oi + 1, 0, 'closing'); } // r51: optional full-closure path
    { const si = order.indexOf('support'), ci = order.indexOf('sector'); if (ci > -1 && si > ci + 1 && cfg.support_first !== false) { order.splice(si, 1); order.splice(ci + 1, 0, 'support'); } } // r50
    { const ei = order.indexOf('etizaz'); if (ei > -1) order.splice(ei, 1); const at = Math.max(order.indexOf('support'), order.indexOf('mil_entity')); order.splice(at < 0 ? order.length : at + 1, 0, 'etizaz'); } // r50: after sector+support+entity
    if (PROD === 'transfer') { ['support', 'etizaz', 'closing', 'property', 'obligations'].forEach(k => { const i = order.indexOf(k); if (i > -1) order.splice(i, 1); }); order.push('tr_bank', 'tr_payoff', 'tr_inst', 'tr_left', 'tr_sup', 'obligations'); } // r54
    if ((cfg.phone || {}).enabled === true) { const ni = order.indexOf('name'); order.splice(ni + 1, 0, 'phone'); } // r54: optional, off by default
    const visible = k => {
      if (k === 'phone') return (cfg.phone || {}).enabled === true; if (String(k).indexOf('tr_') === 0) return PROD === 'transfer'; // r54
      const d = S.data; if (Q[k] && Q[k].enabled === false && !['name', 'sector', 'birth', 'net'].includes(k) && !(isMil() && ['rank', 'mil_entity', 'appoint', 'basic'].includes(k))) return false;
      if (['rank', 'mil_entity'].includes(k)) return isMil();
      if (k === 'appoint' || k === 'basic') return isMil() && needRet(); // r51: only when the financing reaches retirement
      if (k === 'closing') return !!d.obl_done && !!overInfo() && d.obligations.some(o => o.type !== 'other');
      if (k === 'pilot') { const r = rankObj(); return isMil() && r && r.group === 'officer' && Number(r.pilot_age) > 0; }
      if (k === 'grade') return false; // r51
      if (k === 'etizaz') return !!E().etizazEligible({ sector: d.sector, supported: d.supported === true, mil_entity: d.mil_entity, entity: d.mil_entity }, cfg); // r50: military + supported + MoD only
      if (k === 'employer') return !!d.sector && !isMil() && d.sector !== 'retired';
      if (k === 'property') return (cfg.properties || []).filter(p => p.enabled !== false && p.hidden !== true).length > 0;
      return true;
    };
    const answered = k => k === 'tr_sup' ? !!S.data.tr_sup_done : k === 'phone' ? !!S.data.phone_done : k === 'appoint' ? (S.data.appoint != null && S.data.excl_months != null) : k === 'obligations' ? !!S.data.obl_done : k === 'closing' ? !!S.data.close_done : k === 'support' ? S.data.supported != null : k === 'etizaz' ? S.data.etizaz != null : S.data[k] != null && S.data[k] !== '';
    // r51: does the chosen term reach retirement? (birth + rank only)
    function needRet() { const d = S.data; if (!isMil() || !d.birth || !d.rank) return true;
      try { const L = cfg.limits || {}; const p = E().profile(Object.assign(inp(), { appoint: null, basic: null, net: d.net || 1 }), cfg); const want = Math.min(Number(S.months || L.default_term || 240), Number(L.max_term || 300)); return p.R < Math.max(want, Number(L.default_term || 240)); } catch (e) { return true; } }
    // r51: SAMA 15/ب — current non-real-estate obligations above consumer_pct% (income below the second band)
    function overInfo() { const d = S.data; const net = Number(d.net); if (!(net > 0)) return null; const DP = cfg.dti_policy || {}; const cp = Number(DP.consumer_pct == null || DP.consumer_pct === '' ? 45 : DP.consumer_pct);
      if (E().dtiTier(net, DP) >= 3) return null; const ob = d.obligations.reduce((t, o) => t + (Number(o.months) > 0 ? Number(o.amount) || 0 : 0), 0); return ob > net * cp / 100 + 1e-9 ? { ob, net, cp } : null; }
    function next() {
      for (const k of order) if (visible(k) && !answered(k)) return ask(k);
      return durationCard();
    }
    const DEFQ = { close_q: 'هل عندك عقود تمويل تنوي إقفالها بالكامل قبل الحصول على التمويل العقاري؟', close_n: 'كم عقدًا تنوي إقفاله يا {name}؟', etizaz: 'هل أنت مستفيد من مبادرة اعتزاز السكنية؟', grade: 'كم رقم درجتك الحالية في رتبتك حسب سلم الرواتب؟ (نحتاجها لتقدير راتبك الأساسي عند التقاعد)', tr_bank: 'وش البنك الحالي لتمويلك العقاري يا {name}؟', tr_payoff: 'كم مبلغ السداد المبكر لتمويلك العقاري الحالي؟ (حسب خطاب المخالصة من بنكك)', tr_inst: 'كم قسطك العقاري الشهري الحالي؟', tr_left: 'كم شهر متبقي على تمويلك العقاري الحالي؟',
      tr_sup: 'هل تمويلك العقاري الحالي مدعوم بالدعم السكني الشهري؟', tr_keep: 'تبي تنقل تمويلك مع استمرار الدعم أو بدونه؟', tr_sm: 'كم قيمة الدعم الشهري الحالي؟', tr_sp: 'كم عدد الأشهر اللي صُرف فيها الدعم إلى الآن؟', tr_sl: 'كم المدة المتبقية لعقد الدعم بالأشهر؟',
      tr_po: 'كم مبلغ السداد المبكر لهذا التمويل الشخصي؟ (إذا تعرفه)', phone: 'رقم جوالك؟ (اختياري)', appoint_excl: 'هل لديك مدة لا تُحتسب في التقاعد؟ (غياب دون إجازة، أو إجازة بدون راتب عدا المرضية والدراسية، أو حرمان من الراتب) اكتب عدد الأشهر، أو اختر «لا يوجد».' };
    const qText = k => String(k).charAt(0) === '#' ? String(k).slice(1) : tpl((Q[k] || {}).text || DEFQ[k] || k, S.data); // r51: '#' = literal question
    function choice(k, items, onPick, opt2) {
      clearDock(); bot(qText(k)); const wrap = el('div', 're42-choices' + (opt2 && opt2.grid ? ' grid' : ''));
      let done = false; const born = Date.now(); items.forEach(it => { const b = btn(wrap, '', () => { if (done || Date.now() - born < 400) return; done = true; wrap.querySelectorAll('button').forEach(z => { z.disabled = true; }); me(it.label); onPick(it.value); }, 're42-chip'); if (it.logo) b.append(it.logo); b.append(el('span', '', it.label)); });
      dock.append(wrap); scroll();
    }
    function textIn(k, type, onOk, ph, skip) {
      clearDock(); bot(qText(k)); const f = el('form', 're42-input'); const i = el('input'); i.type = 'text'; if (type === 'money' || type === 'int') i.inputMode = 'decimal'; i.placeholder = ph || ''; i.autocomplete = 'off';
      const go = btn(null, 'التالي', null, 're42-go'); go.type = 'submit'; f.append(i, go); const err = el('div', 're42-err'); dock.append(f, err);
      let sent = false; const born = Date.now(); if (skip) btn(dock, skip.label, () => { if (sent || Date.now() - born < 400) return; sent = true; me(skip.label); skip.fn(); }, 're42-skip');
      if (k === 'net') dock.append(el('div', 're42-muted re42-hint', T.net_hint || 'الراتب الصافي هنا: الأساسي بعد حسم التقاعد مع البدلات الثابتة، قبل خصم أقساط التمويلات.'));
      f.onsubmit = ev => { ev.preventDefault(); if (sent || Date.now() - born < 400) return; const v = i.value.trim(); const r = onOk(v); if (typeof r === 'string') { err.textContent = r; i.focus(); } else { sent = true; go.disabled = true; } };
      setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 60); scroll();
    }
    function dateIn(k, onOk) {
      clearDock(); bot(qText(k)); const wrap = el('div', 're42-date'); const src0 = S.data[k + '_src']; let cal = src0 ? src0.cal : (S.calPref || (isMil() ? 'hijri' : 'gregorian'));
      const tabs = el('div', 're42-seg'); const tG = btn(tabs, 'ميلادي', () => setCal('gregorian')); const tH = btn(tabs, 'هجري', () => setCal('hijri'));
      const row = el('div', 're42-drow'); const mk = ph => { const i = el('input'); i.type = 'text'; i.inputMode = 'numeric'; i.placeholder = ph; i.maxLength = 4; row.append(i); return i; };
      const dd = mk('يوم'), mm = mk('شهر'), yy = mk('سنة'); const conv = el('div', 're42-conv'); const err = el('div', 're42-err');
      const ok = btn(null, 'اعتماد التاريخ', () => { if (ok.disabled) return; const g = read(); if (!g) { err.textContent = 'تحقق من اليوم والشهر والسنة'; return; } ok.disabled = true; const h = E().toHijri(g); S.calPref = cal; S.data[k + '_src'] = { cal, d: parseInt(digits(dd.value), 10), m: parseInt(digits(mm.value), 10), y: parseInt(digits(yy.value), 10) }; me(cal === 'hijri' ? gStr(h) + 'هـ (يوافق ' + gStr(g) + 'م)' : gStr(g) + 'م (يوافق ' + gStr(h) + 'هـ)'); onOk(g); }, 're42-go wide');
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
      if (k === 'name') return textIn(k, 'text', v => { if (v.length < 2 || v.length > 40) return 'اكتب اسمك (حرفان على الأقل)'; d.name = v.replace(/[<>]/g, ''); me(d.name); bot(greetWord() + ' يا ' + first(d) + '، حياك الله.'); next(); }); // r58
      if (k === 'sector') return choice(k, sectors().map(s => ({ label: s.label, value: s.key })), v => { d.sector = v; next(); });
      if (k === 'rank') return choice(k, ((cfg.military || {}).ranks || []).map(r => ({ label: r.name, value: r.key })), v => { d.rank = v; d.pilot = null; d.grade = null; next(); }, { grid: true });
      if (k === 'grade') { const sc = E().rankScale(rankObj(), cfg.military || {}) || { grades: 0 }; return textIn(k, 'int', v => { const n = money(v); if (!(Number.isInteger(n) && n >= 1 && n <= sc.grades)) return 'اكتب رقم الدرجة من 1 إلى ' + sc.grades; d.grade = n; me('الدرجة ' + n); next(); }, 'رقم الدرجة', { label: 'ما أعرف', fn: () => { d.grade = 0; next(); } }); }
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
      if (k === 'net' || k === 'basic') return textIn(k, 'money', v => { const n = money(v); if (!(n >= 1000 && n <= 1000000)) return 'أدخل مبلغًا صحيحًا بالريال'; d[k] = n; if (k === 'basic') d.grade = null; me(fmt(n) + ' ريال'); next(); }, 'المبلغ بالريال');
      if (k === 'salary_bank') {
        const list = (cfg.banks || []).filter(b => !b.test && b.salary !== false && b.active !== false && b.id !== 'OTHER');
        const items = list.map(b => ({ label: b.name, value: b.id, logo: logoBox(b) }));
        if (cfg.salary_other && cfg.salary_other.enabled) items.push({ label: 'بنك آخر', value: 'OTHER' });
        return choice(k, items, v => { d.salary_bank = v; next(); }, { grid: true });
      }
      if (k === 'support') {
        const items = [{ label: 'نعم، مدعوم', value: 'yes' }, { label: 'لا، غير مدعوم', value: 'no' }];
        // r50: «اعتزاز» is its own question (3 conditions), no longer a support type
        return choice(k, items, v => {
          if (v === 'no') { d.supported = false; d.supportType = null; return next(); }
          if (v === 'etizaz') { d.supported = true; d.supportType = 'etizaz'; return next(); }
          d.supported = true; d.supportType = 'upfront';
          if ((cfg.support || {}).monthly_enabled && !((cfg.support_options || []).some(o => o.key === 'monthly' && o.enabled === false))) { clearDock(); bot('وش نوع الدعم؟'); const w = el('div', 're42-choices'); btn(w, 'دعم مقدم', () => { me('دعم مقدم'); d.supportType = 'upfront'; next(); }, 're42-chip'); btn(w, 'دعم شهري', () => { me('دعم شهري'); d.supportType = 'monthly'; next(); }, 're42-chip'); dock.append(w); scroll(); return; }
          next();
        });
      }
      if (k === 'etizaz') return choice(k, [{ label: 'نعم، مستفيد', value: true }, { label: 'لا، لست مستفيدًا', value: false }], v => { d.etizaz = v; next(); });
      if (k === 'property') { // r51
        clearDock(); bot(qText(k)); const w = el('div', 're42-choices grid re42-props'); const nt = el('p', 're42-note'); let done = false; const born = Date.now();
        (cfg.properties || []).filter(p => p.hidden !== true).forEach(p => { const on = p.enabled !== false;
          const b = btn(w, '', () => { if (done || Date.now() - born < 400) return; if (!on) { nt.textContent = tpl(T.product_unavailable || 'هذه الخدمة غير مشمولة باشتراكك الحالي', d); return; }
            done = true; w.querySelectorAll('button').forEach(z => { z.disabled = true; }); nt.textContent = ''; me(p.label); d.property = p.key; next(); }, 're42-chip ' + (on ? 'ok' : 'na'));
          b.append(el('span', '', p.label)); if (!on) { b.setAttribute('aria-disabled', 'true'); b.append(el('small', 're42-soon', MG ? tpl(T.product_unavailable || 'اشتراكك في الباقة الحالية لا يدعم هذا المنتج.', d) : 'غير متاح حاليًا')); } }); // r55
        dock.append(w, nt); scroll(); return; }
      if (k === 'phone') return textIn(k, 'int', v => { const n = digits(v); if (!/^(05\d{8}|9665\d{8})$/.test(n)) return 'اكتب رقم جوال صحيح (05xxxxxxxx)'; d.phone = n; d.phone_done = true; me(n); next(); }, '05xxxxxxxx', { label: 'تخطي', fn: () => { d.phone = null; d.phone_done = true; next(); } });
      if (k === 'tr_bank') { const list = (cfg.banks || []).filter(b => !b.test && b.active !== false && b.id !== 'OTHER');
        return choice(k, list.map(b => ({ label: b.name, value: b.id, logo: logoBox(b) })).concat([{ label: 'جهة أخرى', value: 'OTHER' }]), v => { d.tr_bank = v; next(); }, { grid: true }); }
      if (k === 'tr_payoff') return textIn(k, 'money', v => { const n = money(v); if (!(n >= 10000 && n <= 20000000)) return 'أدخل مبلغ السداد المبكر بالريال'; d.tr_payoff = n; me(fmt(n) + ' ريال'); next(); }, 'مبلغ السداد المبكر بالريال');
      if (k === 'tr_inst') return textIn(k, 'money', v => { const n = money(v); if (!(n >= 100 && n <= 500000)) return 'أدخل قيمة القسط الشهري'; d.tr_inst = n; me(fmt(n) + ' ريال'); next(); }, 'القسط الشهري الحالي بالريال');
      if (k === 'tr_left') return textIn(k, 'int', v => { const n = parseInt(digits(v), 10); if (!(n >= 1 && n <= 420)) return 'أدخل عدد الأشهر (1 إلى 420)'; d.tr_left = n; me(monthsTxt(n)); next(); }, 'عدد الأشهر المتبقية');
      if (k === 'tr_sup') return trSupport();
      if (k === 'obligations') return obligations();
      if (k === 'closing') return closing();
      next();
    }
    function trSupport() { // r54: continuation of the monthly support is conditional; the simulation is internal until the owner enables it for clients
      const d = S.data; const SR = TRC.support_remain || {}; const simOK = (opt.mode === 'owner' && !opt.preview) || trial || SR.client_enabled === true;
      const fin = () => { d.tr_sup_done = true; next(); };
      const askSL = () => textIn('tr_sl', 'int', v => { const m = parseInt(digits(v), 10); if (!(m >= 1 && m <= 420)) return 'أدخل عدد الأشهر (1 إلى 420)'; d.tr_sl = m; me(monthsTxt(m)); fin(); }, 'عدد الأشهر المتبقية', { label: 'نفس المدة المتبقية للتمويل', fn: () => { d.tr_sl = d.tr_left; fin(); } });
      const askSP = () => textIn('tr_sp', 'int', v => { const n = parseInt(digits(v), 10); if (!(n >= 0 && n <= 420)) return 'أدخل عدد الأشهر (رقم صحيح)'; d.tr_sp = n; me(n ? monthsTxt(n) : 'لا يوجد'); askSL(); }, 'عدد الأشهر المصروفة', { label: 'لا يوجد', fn: () => { d.tr_sp = 0; askSL(); } });
      const askSM = () => textIn('tr_sm', 'money', v => { const a = money(v); if (!(a > 0 && a <= 50000)) return 'أدخل قيمة الدعم الشهري بالريال'; d.tr_sm = a; me(fmt(a) + ' ريال'); askSP(); }, 'الدعم الشهري بالريال');
      choice('tr_sup', [{ label: 'نعم، مدعوم', value: true }, { label: 'لا، غير مدعوم', value: false }], v => { d.tr_supported = v; d.tr_keep = false; d.tr_sm = d.tr_sp = d.tr_sl = null;
        if (!v) return fin();
        bot(T.tr_keep_note || 'استمرار الدعم بعد نقل التمويل مشروط بموافقة الجهات المختصة (صندوق التنمية العقارية) والبنك الجديد، والحسبة تقديرية.', 'warn');
        if (!simOK) { bot(T.tr_keep_off || 'احتساب استمرار الدعم بعد النقل غير متاح حاليًا، وبنعرض لك الحسبة بدون احتساب الدعم.'); return fin(); }
        choice('tr_keep', [{ label: 'النقل مع استمرار الدعم', value: true }, { label: 'النقل بدون الدعم', value: false }], k2 => { d.tr_keep = k2; if (!k2) return fin(); askSM(); });
      });
    }
    function obligations() {
      const d = S.data; const TYPES = [['personal', 'تمويل شخصي'], ['company', 'التزام شركة تمويل'], ['other', 'التزام شهري آخر']];
      clearDock(); bot(d.obligations.length ? 'تبي تضيف التزامًا آخر؟' : qText('obligations'));
      const w = el('div', 're42-choices');
      let used = false; const born = Date.now(); TYPES.forEach(([t, l]) => btn(w, l, () => { if (used || Date.now() - born < 400) return; used = true; me(l); addOne(t, l); }, 're42-chip'));
      btn(w, d.obligations.length ? 'انتهيت من الالتزامات' : 'ما عندي التزامات', () => { if (used || Date.now() - born < 400) return; used = true; me(d.obligations.length ? 'انتهيت' : 'ما عندي التزامات'); d.obl_done = true; next(); }, 're42-chip end');
      dock.append(w); scroll();
      function askPO(o) { textIn('tr_po', 'money', v => { const a = money(v); if (!(a > 0 && a <= 5000000)) return 'أدخل المبلغ بالريال'; o.payoff = a; me(fmt(a) + ' ريال'); obligations(); }, 'مبلغ السداد المبكر بالريال', { label: 'ما أعرف', fn: () => { o.payoff = null; obligations(); } }); } // r54
      function addOne(t, l) {
        textIn('#كم قسط «' + l + '» الشهري؟', 'money', v => { // r51
          const a = money(v); if (!(a > 0 && a <= 500000)) return 'أدخل قيمة القسط الشهري';
          me(fmt(a) + ' ريال'); clearDock(); bot('كم شهر متبقي على «' + l + '»؟');
          const f = el('form', 're42-input'); const i = el('input'); i.type = 'text'; i.inputMode = 'numeric'; i.placeholder = 'عدد الأشهر المتبقية';
          const g = btn(null, 'إضافة', null, 're42-go'); g.type = 'submit'; f.append(i, g); const err = el('div', 're42-err'); dock.append(f, err);
          f.onsubmit = ev => { ev.preventDefault(); if (g.disabled) return; const m = parseInt(digits(i.value), 10); if (!(m >= 1 && m <= 600)) { err.textContent = 'أدخل عدد الأشهر (1 إلى 600)'; return; } g.disabled = true;
            d.obligations.push({ type: t, label: l, amount: a, months: m }); me(monthsTxt(m)); bot('تمت إضافة: ' + l + ' — ' + fmt(a) + ' ريال لمدة ' + monthsTxt(m)); if (PROD === 'transfer' && t === 'personal') return askPO(d.obligations[d.obligations.length - 1]); obligations(); };
          setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 60); scroll();
        }, 'قيمة القسط الشهري بالريال');
        const last = log.lastElementChild; if (last) last.textContent = 'كم قسط «' + l + '» الشهري؟';
      }
    }
    function closing() { // r55: high non-mortgage obligations → review the contracts (count + details), pick the ones the client can fully close, confirm, then current vs conditional calculation (never treated as closed)
      const d = S.data; const BK = (cfg.banks || []).filter(b => !b.test && b.active !== false && b.id !== 'OTHER'); const TY = { personal: 'تمويل شخصي', company: 'التزام شركة تمويل' };
      const fin = () => d.obligations.map((o, i) => ({ o, i })).filter(x => x.o.type !== 'other'); const rev = [];
      choice('#' + tpl(T.close_warn || 'يا {name}، التزاماتك الحالية مرتفعة، وقد تؤثر على قبول طلبك لدى البنوك. تبي نراجع العقود اللي تقدر تقفلها بالكامل ونحسب لك الفرق؟', d), [{ label: 'نعم، نراجعها', value: true }, { label: 'لا، كمّل بوضعي الحالي', value: false }], v => {
        if (!v) { d.close = []; d.close_done = true; S.scn = 'now'; return next(); }
        const n = Math.max(1, fin().length); const opts = []; for (let k = n; k <= n + 3; k++) opts.push({ label: String(k), value: k });
        choice('#كم عدد عقود التمويل اللي عندك حاليًا؟' + (fin().length ? ' (سجّلت منها ' + fin().length + ' في التزاماتك)' : ''), opts, N => one(0, N));
      });
      { const m = log.querySelectorAll('.re42-msg.bot'); if (m.length) m[m.length - 1].classList.add('warn'); }
      function one(j, N) { if (j >= N) return review(); const ex = fin()[j];
        if (ex) { bot('العقد ' + (j + 1) + ': ' + ex.o.label + ' — قسط ' + fmt(ex.o.amount) + ' ريال — متبقي ' + monthsTxt(ex.o.months)); return ent(ex.i, j, N); }
        choice('#العقد ' + (j + 1) + ': وش نوعه؟', [{ label: TY.personal, value: 'personal' }, { label: TY.company, value: 'company' }], t => {
          textIn('#كم قسط «' + TY[t] + '» الشهري؟', 'money', v => { const a = money(v); if (!(a > 0 && a <= 500000)) return 'أدخل قيمة القسط الشهري'; me(fmt(a) + ' ريال');
            textIn('#كم شهر متبقي على هذا العقد؟', 'int', v2 => { const m = parseInt(digits(v2), 10); if (!(m >= 1 && m <= 600)) return 'أدخل عدد الأشهر (1 إلى 600)'; me(monthsTxt(m));
              d.obligations.push({ type: t, label: TY[t], amount: a, months: m }); ent(d.obligations.length - 1, j, N); }, 'عدد الأشهر المتبقية'); }, 'قيمة القسط الشهري بالريال'); }); }
      function ent(i, j, N) { const o = d.obligations[i];
        choice('#وش جهة «' + o.label + '» (' + fmt(o.amount) + ' ريال شهريًا)؟', BK.map(b => ({ label: b.name, value: b.name, logo: logoBox(b) })).concat([{ label: 'جهة أخرى', value: 'جهة أخرى' }]), v => {
          textIn('#كم مبلغ السداد المبكر لهذا العقد؟ (إذا تعرفه)', 'money', v2 => { const a = money(v2); if (!(a > 0 && a <= 5000000)) return 'أدخل المبلغ بالريال'; me(fmt(a) + ' ريال'); rev.push({ i, entity: v, payoff: a }); one(j + 1, N); }, 'مبلغ السداد المبكر بالريال', { label: 'ما أعرف', fn: () => { rev.push({ i, entity: v, payoff: null }); one(j + 1, N); } });
        }, { grid: true }); }
      function review() { clearDock();
        const line = r => { const o = d.obligations[r.i]; return o.label + ' — ' + r.entity + ' — قسط ' + fmt(o.amount) + ' ريال — متبقي ' + monthsTxt(o.months) + (r.payoff ? ' — سداد مبكر ' + fmt(r.payoff) + ' ريال' : ''); };
        bot('عقودك اللي ذكرتها:\n' + rev.map((r, k) => (k + 1) + ') ' + line(r)).join('\n')); bot('أي عقد تقدر تسدده بالكامل وتنهيه؟ (تقدر تختار أكثر من عقد)');
        const w = el('div', 're42-choices grid re55-multi'); const sel = new Set(); let done = false; const born = Date.now();
        const ok = btn(null, 'تأكيد الاختيار', () => { if (done || !sel.size) return; done = true; w.querySelectorAll('button').forEach(z => { z.disabled = true; }); ok.disabled = true; const pick = rev.filter((r, k) => sel.has(k)); me(pick.map(r => d.obligations[r.i].label + ' — ' + r.entity).join('، ')); confirmPick(pick); }, 're42-go wide'); ok.disabled = true;
        rev.forEach((r, k) => { const o = d.obligations[r.i]; const b = btn(w, '', () => { if (done || Date.now() - born < 400) return; if (sel.has(k)) sel.delete(k); else sel.add(k); b.classList.toggle('on', sel.has(k)); b.setAttribute('aria-pressed', sel.has(k) ? 'true' : 'false'); ok.disabled = !sel.size; }, 're42-chip'); b.setAttribute('aria-pressed', 'false'); b.append(el('span', '', (k + 1) + ') ' + o.label + ' — ' + r.entity + ' — ' + fmt(o.amount) + ' ريال')); });
        const none = btn(null, 'ما أقدر أقفل أي عقد', () => { if (done) return; done = true; me('ما أقدر أقفل أي عقد'); d.close = []; d.close_done = true; S.scn = 'now'; next(); }, 're42-skip');
        dock.append(w, ok, none); scroll(); }
      function confirmPick(pick) { const po = pick.reduce((t, r) => t + (Number(r.payoff) || 0), 0);
        choice('#بنحسب لك حسبتين: وضعك الحالي، وحسبة مشروطة بعد إقفال ' + (pick.length === 1 ? 'العقد المختار' : pick.length + ' عقود') + ' بالكامل (' + pick.map(r => d.obligations[r.i].label + ' — ' + r.entity).join('، ') + ')' + (po > 0 ? '، ومبلغ سدادها المبكر ' + fmt(po) + ' ريال تسدده قبل التمويل وليس جزءًا منه' : '') + '. السيناريو تقديري، ولا يُعتبر أي عقد مقفلًا حتى يتم إقفاله فعليًا. نعتمد؟', [{ label: 'تأكيد', value: true }, { label: 'تعديل الاختيار', value: false }], v => {
          if (!v) return review(); d.close = pick.map(r => ({ i: r.i, entity: r.entity, payoff: r.payoff })); d.close_done = true; S.scn = 'now'; next(); }); }
    }
    // ---------- engine input ----------
    function inp() {
      const d = S.data;
      return { sector: d.sector, rank: d.rank, pilot: !!d.pilot, birth: d.birth, appoint: d.appoint, excludedMonths: d.excl_months || 0, basic: d.basic, grade: d.grade || null, net: d.net,
        obligations: d.obligations.map(o => ({ type: o.type, amount: o.amount, months: o.months, payoff: o.payoff || null })), supported: !!d.supported, supportType: d.supportType || 'upfront',
        property: d.property || 'ready', entity: (d.mil_entity && d.mil_entity !== '-') ? d.mil_entity : (d.employer && d.employer !== '-' ? d.employer : null), salary_bank: d.salary_bank, mil_entity: (d.mil_entity && d.mil_entity !== '-') ? d.mil_entity : null, etizaz: PROD !== 'transfer' && d.etizaz === true,
        transfer: PROD === 'transfer' ? { bank: d.tr_bank, payoff: d.tr_payoff, inst: d.tr_inst, left: d.tr_left } : undefined };
    }
    // ---------- duration card ----------
    let durEl = null, resEl = null;
    function durationCard() {
      clearDock(); if (resEl) { resEl.remove(); resEl = null; }
      let dc; try { dc = E().durationCard(Object.assign(inp(), FIX ? { months: FIX, extend: true } : { months: S.months == null ? Number((cfg.limits || {}).default_term || 300) : S.months, extend: S.extend }), cfg); }
      catch (e) { bot(ERR[e.message] || 'تحقق من البيانات: ' + e.message, 'warn'); return editMenu(); }
      if (FIX) { const p0 = dc.profile; S.months = FIX; S.extend = !!(p0.extendAllowed && p0.R > 0 && p0.R < FIX); } else if (S.extend == null) S.extend = dc.extend; // r55
      if (PROD === 'transfer' && S.data.tr_keep) { const SR = TRC.support_remain || {}; const L = Math.floor(Number(S.data.tr_left) || 0); // r54: not beyond the old contract unless documented + approved by the owner
        if (!(SR.allow_extend === true && String(SR.source || '').trim()) && L >= 12 && dc.months > L) { dc.months = L; dc.cap = Math.min(dc.cap, L); dc.keepCut = L; } }
      if (durEl) durEl.remove(); durEl = el('div', 're42-card re42-dur'); log.append(durEl);
      durEl.append(el('h3', '', tpl(T.duration_title || 'مدة التمويل لك يا {name}', S.data)));
      const big = el('div', 're42-big'); const bm = el('b', '', String(dc.months)); big.append(bm, el('span', '', ' شهر')); const yr = el('div', 're42-years', durTxt(dc.months)); durEl.append(big, yr);
      { const pq = dc.profile; if (pq.sector === 'military' && S.extend && pq.R > 0 && pq.R < dc.months) { // r49: extended term — retirement split
          const rm = el('div', 're42-retmsg'); rm.append(el('p', '', 'يا ' + (S.data.name || '') + '، باقي على تقاعدك ' + durTxt(pq.R) + '، ومدة تمويلك المختارة تمتد بعد التقاعد.'),
            el('p', 're42-muted', (pq.retireDate ? 'تاريخ التقاعد المتوقع: ' + gStr(E().toHijri(pq.retireDate)) + 'هـ (' + gStr(pq.retireDate) + 'م). ' : '') + 'أشهر التمويل قبل التقاعد: ' + monthsTxt(pq.R) + '، وبعده: ' + monthsTxt(dc.months - pq.R) + '.'));
          if (!FIX) btn(rm, 'تقدر تقلل المدة من هنا', () => { const t = durEl.querySelector('.re42-slider,.re42-locked'); if (!t) return; try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} const lb = t.querySelector('button'); if (!termOn() && lb) lb.click(); }, 're42-link');
          durEl.append(rm); } }
      if (FIX && dc.cap < FIX) { const p0 = dc.profile; const ageEnd = Number((cfg.limits || {}).max_age_end || 70); bm.textContent = String(FIX); yr.textContent = durTxt(FIX); // r55: not eligible — no automatic shortening, no result
        durEl.append(el('p', 're42-warn', tpl(p0.monthsToMaxAge < FIX ? 'نعتذر يا {name}، عمرك عند نهاية مدة الباقة (' + FIX + ' شهرًا) سيتجاوز الحد الأعلى لعمر نهاية التمويل (' + ageEnd + ' سنة)، لذلك لا تنطبق عليك مدة الباقة الحالية. لم نغيّر المدة ولم نحسب نتيجة، ولم تُخصم أي حسبة.' : 'نعتذر يا {name}، المدة المتبقية حتى تقاعدك أقل من مدة الباقة (' + FIX + ' شهرًا) والتمويل بعد التقاعد غير متاح لحالتك، لذلك لا تنطبق عليك مدة الباقة الحالية. لم نغيّر المدة ولم نحسب نتيجة، ولم تُخصم أي حسبة.', S.data)));
        return editMenu(); }
      if (dc.cap < 12) { durEl.append(el('p', 're42-warn', 'المدة المتاحة لحالتك أقل من الحد الأدنى للتمويل العقاري حاليًا. تقدر تعدّل بياناتك.')); return editMenu(); }
      if (dc.extendShown && !FIX) {
        const lab = el('label', 're42-switch'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!S.extend; lab.append(cb, el('span', '', T.extend_label || 'تمويل يمتد إلى بعد التقاعد'));
        cb.onchange = () => { S.extend = cb.checked; S.months = null; durationCard(); }; durEl.append(lab);
      }
      const termMsg = tpl(T.term_reduce_unavailable || 'نعتذر منك يا {name}، تقليل المدة غير متاح حاليًا ضمن اشتراكك', S.data);
      const sl = el('div', 're42-slider'); sl.append(el('span', 're42-sl-lab', T.reduce_label || 'تقليل المدة'));
      const r = el('input'); r.type = 'range'; r.min = String(Math.max(12, Math.min(dc.minTerm || 60, dc.cap))); r.max = String(dc.cap); r.step = '1'; r.value = String(dc.months); r.setAttribute('aria-label', 'مدة التمويل بالأشهر');
      const steps = el('div', 're42-steps'); const upd = v => { v = Math.max(Number(r.min), Math.min(Number(r.max), v)); r.value = String(v); bm.textContent = String(v); yr.textContent = durTxt(v); };
      btn(steps, '−12', () => upd(Number(r.value) - 12), 're42-mini'); btn(steps, '−1', () => upd(Number(r.value) - 1), 're42-mini'); btn(steps, '+1', () => upd(Number(r.value) + 1), 're42-mini'); btn(steps, '+12', () => upd(Number(r.value) + 12), 're42-mini');
      r.oninput = () => upd(Number(r.value)); sl.append(r, steps);
      if (termOn() && !FIX) durEl.append(sl); else if (!FIX) { const lk = el('div', 're42-locked'); btn(lk, FIX ? 'تغيير المدة' : (T.reduce_label || 'تقليل المدة'), () => { lk.querySelector('p') || lk.append(el('p', 're42-note', FIX ? fixMsg() : termMsg)); }, 're42-mini'); durEl.append(lk); }
      if (dc.corrected && !FIX) durEl.append(el('p', 're42-note', 'عدّلنا المدة تلقائيًا لتناسب عمرك وحالتك الوظيفية.'));
      if (dc.keepCut) durEl.append(el('p', 're42-note', 'مع استمرار الدعم لا تتجاوز مدة التمويل الجديد المدة المتبقية لعقدك الحالي (' + monthsTxt(dc.keepCut) + ').'));
      const pr = dc.profile; const info = el('details', 're42-info'); info.append(el('summary', '', 'تفاصيل حالتك'));
      const add = (a, b) => { const row = el('div', 're42-kv'); row.append(el('span', '', a), el('b', '', b)); info.append(row); };
      add('العمر الحالي', durTxt(pr.ageMonths));
      if (pr.retireDate) add('تاريخ التقاعد المتوقع', gStr(E().toHijri(pr.retireDate)) + 'هـ — ' + gStr(pr.retireDate) + 'م');
      if (pr.retireDate || pr.sector === 'military') add('المتبقي للتقاعد', pr.R ? durTxt(pr.R) : 'بلغت سن التقاعد');
      if (pr.sector === 'military' && pr.pension != null && S.extend && pr.R < dc.months) { add('أشهر التمويل قبل التقاعد / بعده', pr.R + ' / ' + (dc.months - pr.R)); if (OWN) { add('الراتب الأساسي المتوقع عند التقاعد', fmt2(pr.basic) + ' ريال'); add('المعاش التقاعدي التقديري', fmt2(pr.pension) + ' ريال'); } } // r58
      if (OWN && pr.sector === 'military' && !pr.pensionSkipped) { const ob = el('div', 're42-owner'); ob.append(el('b', '', 'للمالك فقط'));
        const oa = (a, b) => { const row = el('div', 're42-kv'); row.append(el('span', '', a), el('b', '', b)); ob.append(row); };
        oa('الخدمة المحتسبة الآن / عند التقاعد', pr.serviceNow + ' / ' + pr.serviceAtRet + ' شهر' + (pr.serviceCalendar === 'hijri' ? ' (هجري)' : '')); if (pr.excl) oa('مدة غير محتسبة (م6)', durTxt(pr.excl)); oa('سن التقاعد للرتبة', yearsTxt(pr.retireAge)); oa('الأساسي الحالي', fmt(pr.basicCurrent) + ' ريال');
        const sc = pr.basicMethod === 'scale' || pr.basicMethod === 'scale_grade'; if (sc) oa('الدرجة الآن ← عند التقاعد', pr.grade + ' ← ' + pr.gradeAtRet + ' (علاوات: ' + pr.increments + ')');
        oa('الأساسي المتوقع / المعاش', fmt2(pr.basic) + ' / ' + fmt2(pr.pension) + ' ريال');
        ob.append(el('p', 're42-muted', sc ? 'السلم: ' + pr.scaleSource + (pr.scaleStatus === 'owner_approved' ? ' (معتمد من المالك)' : '') + ' — علاوة كل 1 محرم حتى الإحالة، دون ترقية.' : 'ملاحظة: الأساسي المدخل لا يطابق درجة في سلم الرتبة' + (pr.basicMethod === 'no_scale' ? ' (لا يوجد سلم للرتبة)' : '') + '؛ المعاش محسوب على الأساسي الحالي دون علاوات مستقبلية.'));
        ob.append(el('p', 're42-muted', 'م8: آخر أساسي × أشهر الخدمة ÷ 420، بحد أقصى الأساسي.')); if (T.pension_note) ob.append(el('p', 're42-muted', T.pension_note)); info.append(ob); }
      durEl.append(info);
      const go = btn(durEl, T.approve_label || 'اعتماد المدة', async () => { if (S.busy) return; S.busy = true; go.disabled = true; try { S.months = FIX || (termOn() ? Number(r.value) : dc.months); me('اعتمدت ' + S.months + ' شهر'); await results(true); } finally { S.busy = false; go.disabled = false; } }, 're42-go wide');
      go.dataset.k = 'approve'; editMenu(true); scroll();
    }
    // ---------- results ----------
    function snapshot() { return { plan: S.plan, offers: clone(S.offers), plans: clone(S.plans), entity: S.entity, cut: S.cut ? clone(S.cut) : null, scn: S.scn, trScn: S.trScn, months: S.months }; }
    function inpScn() { const I = inp(); const C = S.data.close || []; if (S.scn === 'closed' && C.length) I.obligations = I.obligations.filter((o, i) => !C.some(c => c.i === i)); return I; }
    function compute() { if (PROD === 'transfer') { const d = S.data; return E().transferCompare(inp(), cfg, { plan: S.plan, months: S.months, extend: !!S.extend, trial, plans: S.plans, scn: S.trScn,
        sup: d.tr_keep ? { keep: true, monthly: d.tr_sm, paid: d.tr_sp, left: d.tr_sl || d.tr_left } : null, personalBase }); } // r54
      return E().compare(inpScn(), cfg, cmpOpt()); }
    function cmpOpt() { return { plan: S.plan, months: S.months, extend: !!S.extend, trial, offers: S.offers, plans: S.plans, entity: S.entity || inp().entity, cut: S.cut, fixedTerm: FIX || undefined, rateTerm: Number((cfg.rate_ref || {}).months) || 240 }; // r55
    }
    function scnBest(sc) { const I = inp(); const C = S.data.close || []; if (sc === 'closed') I.obligations = I.obligations.filter((o, i) => !C.some(c => c.i === i)); // r55: capacity difference current vs after closing
      try { const R = E().compare(I, cfg, Object.assign(cmpOpt(), { offers: {}, plans: {}, cut: null })); const b = R.results[0]; return { n: R.results.length, amt: b ? b.amount + upOf(b) : 0, cap: R.capacity ? R.capacity.first : null }; } catch (e) { return null; } }
    function diffBox() { const a = scnBest('now'), c = scnBest('closed'); if (!a || !c) return null; const w = el('div', 're42-sum re55-diff'); w.append(el('b', '', 'الفرق في القدرة التمويلية (تقديري)'));
      w.append(kv('أعلى تمويل متاح — وضعك الحالي', a.n ? fmt(a.amt) + ' ريال' : 'لا يوجد بنك مؤهل'), kv('أعلى تمويل متاح — بعد الإقفال', c.n ? fmt(c.amt) + ' ريال' : 'لا يوجد بنك مؤهل'));
      if (c.amt - a.amt > 0.5) w.append(kv('الفرق', '+' + fmt(c.amt - a.amt) + ' ريال'));
      if (a.cap != null && c.cap != null && Math.abs(c.cap - a.cap) > 0.5) w.append(kv('القسط العقاري المتاح شهريًا (الشهر الأول)', fmt2(Math.max(0, a.cap)) + ' ← ' + fmt2(Math.max(0, c.cap)) + ' ريال'));
      return w; }
    function _r55() { }
    // r48: the real reason when no bank qualifies (never a generic apology, never an invented rate)
    function whyNoneT(R) { // r54
      const rs = R.excluded.map(x => x.reason).filter(r => !['INACTIVE', 'TEST_HIDDEN', 'CURRENT_BANK'].includes(r)); const has = r => rs.includes(r); const out = [];
      if (!rs.length || rs.every(r => r === 'NO_TRANSFER')) return tpl(T.no_banks, S.data);
      if (has('TRANSFER_SHORT')) { const z = R.excluded.filter(x => x.reason === 'TRANSFER_SHORT').sort((a, b) => b.maxAmount - a.maxAmount)[0]; out.push('قدرتك التمويلية بالمدة المختارة (' + fmt(z.maxAmount) + ' ريال) أقل من مبلغ السداد المبكر المطلوب للتحويل (' + fmt(z.need) + ' ريال)'); }
      if (has('NO_CAPACITY') || has('ZERO_STAGE')) out.push('بعد خصم التزاماتك لا يتبقى من حد الاستقطاع قسط كافٍ في بعض أشهر التمويل');
      if (has('PERSONAL_DTI')) out.push('أقساط التمويل الشخصي تتجاوز حد الاستقطاع الشخصي المسموح');
      if (has('NO_PERSONAL') || has('NO_PERSONAL_PAYOFF')) out.push('شراء التمويل الشخصي غير متاح لدى البنوك المفعّلة أو لم يُدخل مبلغ سداده المبكر');
      if (has('NO_TRANSFER_RATE')) out.push('لا توجد نسب تحويل معتمدة لحالتك'); if (has('TERM')) out.push('المدة المتاحة لحالتك أقل من حد الجهات');
      if (has('AGE')) out.push('العمر عند نهاية التمويل يتجاوز حد المنتج'); if (has('MIN_SALARY')) out.push('راتبك أقل من الحد الأدنى لدى الجهات');
      if (!out.length) out.push('لا تنطبق شروط الجهات المفعّلة على حالتك');
      return 'ما فيه بنك مؤهل لتحويل تمويلك حاليًا، والسبب: ' + out.join('، و') + '.';
    }
    function whyNone(R) {
      if (PROD === 'transfer') return whyNoneT(R);
      const rs = R.excluded.map(x => x.reason).filter(r => r !== 'INACTIVE' && r !== 'TEST_HIDDEN'); if (!rs.length) return tpl(T.no_banks, S.data);
      const sk = E().supportKey(inp()); const pr = R.profile; const out = [];
      if (rs.every(r => r === 'NO_RATE' || r === 'NO_STEP_RATE')) {
        if (S.plan === 'step') return T.step_unavailable || 'القسط المتزايد غير متاح حاليًا لعدم اعتماد نسبه الخاصة بعد. اختر القسط الثابت لعرض البنوك.';
        return 'لا توجد حاليًا نسب معتمدة لنوع الدعم في حالتك (' + (sk === 'none' ? 'تمويل غير مدعوم' : sk === 'monthly' ? 'دعم شهري' : 'دعم ' + sk) + ')؛ النسب المعتمدة الحالية للتمويل المدعوم بدعم مقدم. لم نعرض أي بنك حتى لا نعطيك نسبة غير صحيحة.';
      }
      const has = r => rs.includes(r);
      if (has('CONSUMER_OVER')) out.push('التزاماتك غير العقارية الحالية مرتفعة وتتجاوز الحد المسموح لشريحة دخلك' + ((S.data.close || []).length && S.scn !== 'closed' ? '؛ اختر «بعد الإقفال» لعرض الحسبة المشروطة' : '')); // r55: no percentage in the warning
      if (has('BANK_AGE')) out.push('عمرك عند نهاية مدة ' + S.months + ' شهرًا يتجاوز الحد الأعلى للعمر لدى الجهات المفعّلة'); if (has('BANK_TERM')) out.push('مدة الباقة أطول من الحد الأعلى للمدة لدى الجهات المفعّلة'); if (has('NO_TERM_RATE')) out.push('لا توجد نسب معتمدة لهذه المدة لدى الجهات المفعّلة');
      if (has('NO_CAPACITY')) out.push('بعد خصم التزاماتك لا يتبقى من نسبة الاستقطاع المسموحة قسط للتمويل العقاري' + (S.extend && pr && pr.R > 0 && pr.R < S.months ? ' (خصوصًا بعد التقاعد على المعاش التقديري ' + fmt2(pr.pension) + ' ريال)' : '') + '. تقدر تعدّل الالتزامات' + (S.extend ? ' أو توقف التمويل عند التقاعد' : ''));
      if (has('TERM')) out.push('المدة المتاحة لحالتك أقل من حد الجهات');
      if (has('PROPERTY')) out.push('نوع العقار المختار غير مشمول بالنسب المعتمدة حاليًا');
      if (has('SECTOR')) out.push('قطاعك غير مشمول لدى الجهات المفعّلة');
      if (has('MIN_SALARY')) out.push('راتبك أقل من الحد الأدنى لدى الجهات');
      if (has('ZERO_STAGE')) { const z = R.excluded.find(x => x.reason === 'ZERO_STAGE'); out.push('في ' + (z.zeroFrom === z.zeroTo ? 'الشهر ' + z.zeroFrom : 'الأشهر ' + z.zeroFrom + '–' + z.zeroTo) + (z.zeroPost ? ' (بعد التقاعد)' : '') + ' لا يتبقى من حد الاستقطاع قسط عقاري بعد التزاماتك، ولا نفترض فترة سماح غير معتمدة؛ تقدر تعدّل الالتزامات أو المدة' + (S.extend ? ' أو توقف التمويل عند التقاعد' : '')); }
      if (has('SUPPORT')) out.push('نوع الدعم غير مشمول لدى الجهات المفعّلة'); if (has('ENTITY')) out.push('جهة عملك غير مشمولة لدى الجهات المفعّلة'); if (has('ETIZAZ_BANK')) out.push('الجهات المفعّلة لا تشمل اعتزاز لهذا المنتج حاليًا');
      if (has('AGE')) out.push('العمر عند نهاية التمويل يتجاوز حد المنتج'); if (has('MIN_AMOUNT')) out.push('المبلغ أقل من الحد الأدنى للمنتج'); if (has('MAX_SALARY')) out.push('الراتب خارج فئة المنتج');
      if (has('NO_RATE') && !out.length) out.push('لا توجد نسب معتمدة لحالتك');
      return 'ما فيه بنك مؤهل لحالتك حاليًا، والسبب: ' + out.join('، و') + '.';
    }
    // r51: session-safe metering. One request per signature (double taps share the same promise and request id). If the platform heartbeat cleared the
    // entry (transient network failure while the overlay is open), the entry captured at opening is re-verified on the server and restored only if valid.
    // A network failure is retried once with the SAME request id. All security checks stay on the server.
    async function liveEntry() {
      let e = null; try { e = typeof finoCentralRestoreEntry === 'function' ? finoCentralRestoreEntry() : null; } catch (x) {}
      if (e && e.entryToken) return { e };
      if (!ENT0 || typeof finoRpc !== 'function') return { reason: 'NO_ENTRY' };
      const dev = ENT0.deviceId || (typeof finoCentralDeviceId === 'function' ? finoCentralDeviceId() : '');
      for (let k = 0; k < 2; k++) {
        const r = await finoRpc('fino_client_runtime', { p_entry_token: ENT0.entryToken, p_device_id: dev }, 12000);
        if (r && r.ok && r.data && r.data.ok !== false) { try { if (typeof finoCentralStoreEntry === 'function') finoCentralStoreEntry(Object.assign({}, ENT0, { entry_token: ENT0.entry_token || ENT0.entryToken })); if (typeof finoCentralStartHeartbeat === 'function') finoCentralStartHeartbeat(); } catch (x) {} return { e: Object.assign({}, ENT0, { deviceId: dev }) }; }
        if (!(r && r.network)) return { reason: (r && r.data && r.data.reason) || (r && (r.reason || r.error)) || 'ENTRY_INVALID' };
      }
      return { reason: 'NETWORK' };
    }
    function meterMsg(reason) {
      if (reason === 'LAUNCH_FULL') return 'اكتمل عدد مستخدمي الإطلاق المحدود حاليًا، ولم تُخصم أي حسبة.';
      if (reason === 'NETWORK') return 'تعذر الاتصال بالخادم الآن، ولم تُخصم أي حسبة. بياناتك محفوظة؛ اضغط «اعتماد المدة» مرة ثانية بعد التأكد من الاتصال.';
      let m = ''; try { m = typeof finoCentralReasonMessage === 'function' ? finoCentralReasonMessage(reason) : ''; } catch (x) {}
      return (m && m !== reason ? m : 'انتهت صلاحية الكود أو جلسته.') + ' لم تُخصم أي حسبة، وبياناتك محفوظة في المحادثة.';
    }
    function meter() {
      if (opt.mode !== 'client') return Promise.resolve(true); const sig = JSON.stringify([inp(), S.months, S.extend]); if (S.metered[sig]) return Promise.resolve(true);
      if (S.meterP[sig]) return S.meterP[sig];
      const rid = typeof f99v7CreateRequestId === 'function' ? f99v7CreateRequestId() : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
      const pr = (async () => {
        try {
          const le = await liveEntry(); if (!le.e) { bot(meterMsg(le.reason), 'warn'); return false; }
          const e = le.e; const dev = e.deviceId || (typeof finoCentralDeviceId === 'function' ? finoCentralDeviceId() : ''); let r = null;
          for (let k = 0; k < 2; k++) { r = await finoRpc(PROD === 'transfer' ? 'f99r54_client_meter' : 'f99r47_client_meter', { p_entry_token: e.entryToken, p_device_id: dev, p_request_id: rid }, 15000); if (!(r && r.network)) break; }
          if (r && r.network) { bot(meterMsg('NETWORK'), 'warn'); return false; }
          if (!r || !r.ok || (r.data && r.data.ok === false)) { bot(meterMsg((r && r.data && r.data.reason) || (r && (r.reason || r.error)) || 'REFUSED'), 'warn'); return false; }
          S.metered[sig] = true; return true;
        } catch (x) { bot(meterMsg('NETWORK'), 'warn'); return false; } finally { delete S.meterP[sig]; }
      })(); S.meterP[sig] = pr; return pr;
    }
    // r54: owner archive of client calculations (inputs, results, recommendations, chat). Phone is kept only if the owner enabled it. Best effort; never blocks the client.
    function archivePut(R) { try {
      if (opt.mode !== 'client' || typeof finoRpc !== 'function' || (cfg.archive || {}).enabled === false) return;
      let e = null; try { e = typeof finoCentralRestoreEntry === 'function' ? finoCentralRestoreEntry() : null; } catch (x) {} e = (e && e.entryToken) ? e : ENT0; if (!e || !e.entryToken) return;
      const d = clone(S.data); if ((cfg.phone || {}).archive !== true) delete d.phone; delete d.birth_src; delete d.appoint_src;
      const res = (R.results || []).slice(0, 15).map((b, i) => ({ rank: i + 1, id: b.id, name: b.name, rate: b.rate, plan: b.plan, amount: Math.round(b.amount), first: b.firstInstallment, months: b.months, profit: Math.round(b.profit), extra: b.transfer ? Math.round(b.transfer.extra) : null }));
      const chat = Array.from(log.querySelectorAll('.re42-msg')).slice(-150).map(m => (m.classList.contains('me') ? 'C: ' : 'B: ') + String(m.textContent || '').slice(0, 300));
      const rid = typeof f99v7CreateRequestId === 'function' ? f99v7CreateRequestId() : (crypto.randomUUID ? crypto.randomUUID() : null); if (!rid) return;
      Promise.resolve(finoRpc('f99r54_archive_put', { p_entry_token: e.entryToken, p_device_id: e.deviceId || (typeof finoCentralDeviceId === 'function' ? finoCentralDeviceId() : ''), p_request_id: rid, p_product: PROD,
        p_data: { input: d, months: S.months, extend: !!S.extend, plan: S.plan, scn: PROD === 'transfer' ? S.trScn : S.scn, results: res, excluded: (R.excluded || []).map(x => [x.id, x.reason]), chat } }, 12000)).catch(() => {});
    } catch (x) {} }
    // r47: short client note only when the client's case differs from the reference case of the owner-provided rates.
    function refNote(R) {
      const rf = cfg.rate_ref; if (!rf || trial || PROD === 'transfer') return '';
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
      S.last = R; if (fresh) archivePut(R); clearDock(); if (resEl) resEl.remove(); resEl = el('div', 're42-card re42-res'); log.append(resEl);
      resEl.append(el('h3', '', tpl(T.results_title || 'نتائج التمويل العقاري لك يا {name}', S.data)));
      if (trial) resEl.append(el('p', 're42-trialnote', T.trial_note || 'وضع تجربة المالك: بنوك ونسب اختبار داخلية.'));
      const seg = el('div', 're42-seg'); [['step', MG ? 'القسط المتغير' : 'القسط المتزايد'], ['fixed', 'القسط الثابت']].forEach(([k, l]) => { const b = btn(seg, l, () => { if (S.plan === k) return;
          if (!planOn(k)) { toast(k === 'step' ? (T.step_unavailable || 'القسط المتزايد غير متاح حاليًا لعدم اعتماد نسبه الخاصة بعد. النتائج المعروضة بالقسط الثابت.') : 'القسط الثابت غير متاح حاليًا.'); return; }
          S.history.push(snapshot()); S.plan = k; S.plans = {}; S.offers = {}; results(false); }); b.classList.toggle('on', S.plan === k); if (!planOn(k)) { b.classList.add('na'); b.setAttribute('aria-disabled', 'true'); b.title = 'غير متاح حاليًا'; } });
      const RKT = { amount: 'مرتبة حسب أعلى مبلغ تمويل متاح', installment: 'مرتبة حسب أقل قسط شهري', profit: 'مرتبة حسب أقل إجمالي أرباح', rate: 'مرتبة حسب أقل نسبة' }; // r54
      resEl.append(seg, el('p', 're42-crit', PROD === 'transfer' ? RKT[TRC.ranking || 'amount'] || RKT.amount : (T['rank_' + (cfg.ranking || 'amount')] || 'مرتبة حسب أعلى مبلغ تمويل')));
      resEl.append(el('p', 're42-meta', 'المدة: ' + S.months + ' شهر (' + durTxt(S.months) + ')' + (S.extend ? ' — تمتد بعد التقاعد' : '') + (PROD === 'transfer' ? ' — مبلغ التحويل المطلوب: ' + fmt(S.data.tr_payoff || 0) + ' ريال' : '')));
      if (PROD === 'transfer') { // r54: scenarios + notes
        if ((S.data.obligations || []).some(o => o.type === 'personal' && Number(o.payoff) > 0)) { const sg = el('div', 're42-seg re42-scn'); [['only', 'تحويل العقاري فقط'], ['buy', 'العقاري + شراء الشخصي']].forEach(([k, l]) => { const b = btn(sg, l, () => { if (S.trScn === k) return; S.history.push(snapshot()); S.trScn = k; S.plans = {}; results(false); }); b.classList.toggle('on', S.trScn === k); }); resEl.append(sg); }
        if (S.trScn === 'buy') resEl.append(el('p', 're42-cond', 'سيناريو شراء التمويل الشخصي: يُقفل التمويل الشخصي المحدد بمبلغ سداده المبكر ويُستبدل بتمويل شخصي واحد مستقل (حتى 60 شهرًا) بنسبة شخصية مستقلة، ولا يُضاف للتمويل العقاري. لا يُحتسب القرض القديم والجديد معًا.'));
        if (S.data.tr_keep) { resEl.append(el('p', 're42-note', T.tr_sup_note || 'الدعم الشهري المعروض تقديري، واستمراره بعد النقل مشروط بموافقة الجهات المختصة والبنك الجديد، وليس ضمانًا أو اعتمادًا من الصندوق.'));
          if (OWN) resEl.append(el('p', 're42-trialnote', 'للمالك: محرك الدعم المتبقي محاكاة داخلية غير معتمدة رسميًا' + ((TRC.support_remain || {}).client_enabled === true ? '' : ' — معطّل للعملاء') + '.')); }
        if (R.results.some(b => b.rateSource === 'mortgage' || b.rateSource === 'mortgage_est')) resEl.append(el('p', 're42-muted', T.tr_rate_note || 'لا توجد نسب تحويل خاصة معتمدة بعد؛ استخدمنا نسبة التمويل العقاري المعتمدة لكل بنك، وقد تختلف نسبة التحويل الفعلية.')); }
      if ((S.data.close || []).length) { const sg = el('div', 're42-seg re42-scn'); [['now', 'الوضع الحالي'], ['closed', 'بعد الإقفال (مشروط)']].forEach(([k, l]) => { const b = btn(sg, l, () => { if (S.scn === k) return; S.history.push(snapshot()); S.scn = k; S.offers = {}; S.plans = {}; S.cut = null; results(false); }); b.classList.toggle('on', S.scn === k); }); resEl.append(sg); // r51
        if (S.scn === 'closed') { const C = S.data.close; const po = C.reduce((t, c) => t + (Number(c.payoff) || 0), 0);
          resEl.append(el('p', 're42-cond', 'حسبة مشروطة بإقفال ' + (C.length === 1 ? 'العقد المحدد' : C.length + ' عقود') + ' بالكامل قبل التمويل العقاري (' + C.map(c => ((S.data.obligations[c.i] || {}).label || '') + (c.entity ? ' — ' + c.entity : '')).join('، ') + '). لا تُعتبر مقفلة حتى يتم الإقفال فعليًا.' + (po > 0 ? ' مبلغ السداد المبكر المتوقع: ' + fmt(po) + ' ريال، تسدده قبل التمويل وليس جزءًا منه.' : ''))); } }
      if (MG && (S.data.close || []).length) { const db = diffBox(); if (db) resEl.append(db); } // r55
      if (MG && S.scn !== 'closed') { const oi = overInfo(); if (oi) { const lim = oi.net * oi.cp / 100; const dt = el('details', 're42-info re55-over'); dt.append(el('summary', '', 'تفاصيل الالتزامات المرتفعة'));
          dt.append(kv('مجموع التزاماتك غير العقارية', fmt2(oi.ob) + ' ريال'), kv('الحد المسموح لشريحة دخلك', fmt2(lim) + ' ريال (' + oi.cp + '% من دخلك)'), kv('مقدار التجاوز', fmt2(oi.ob - lim) + ' ريال')); resEl.append(dt); } }
      if (MG) resEl.append(el('p', 're42-muted re55-pdef', S.plan === 'fixed' ? 'القسط الثابت: قيمة ثابتة طوال المدة إذا سمحت القدرة التمويلية بذلك.' : 'القسط المتغير: أقساط تختلف بين مراحل التمويل صعودًا أو هبوطًا حسب الراتب والالتزامات والتقاعد.'));
      if (S.extend && R.profile && R.profile.sector === 'military' && R.profile.pension != null && R.profile.R < S.months) resEl.append(el('p', 're42-meta', 'المعاش التقاعدي التقديري: ' + fmt2(R.profile.pension) + ' ريال (تقديري)'));
      { const C = R.capacity; if (C && C.consumerOver && R.results.length && S.scn !== 'closed') resEl.append(el('p', 're42-warn', tpl(T.consumer_over_warn || 'يا {name}، التزاماتك الحالية تتجاوز الحد المسموح به، وقد تؤثر على إمكانية حصولك على التمويل العقاري.', S.data)));
        if (C && OWN && C.stages.some(s => s.amount > 0)) { const cb = el('div', 're42-capbox'); // r49: capacity lines (r51: owner only)
          if (S.plan === 'fixed') { cb.append(el('p', 're42-capline', C.fixedMax > 0 ? 'أعلى قسط ثابت متاح لك: ' + fmt2(C.fixedMax) + ' ريال شهريًا' : 'لا يتوفر قسط ثابت على كامل المدة: في بعض الأشهر لا يتبقى حد استقطاع بعد التزاماتك'),
              el('p', 're42-muted', 'قسط واحد من أول شهر حتى نهاية التمويل، وهو أقل قدرة سداد بين مراحل التمويل' + (C.postMonths ? ' قبل التقاعد وبعده' : '') + '. تقدر تختار قسطًا أقل من «تقليل القسط».')); }
          else { cb.append(el('b', '', 'أقصى قسط عقاري مبدئي حسب المراحل'));
            C.stages.forEach(s => cb.append(el('div', 're42-st', (s.from === s.to ? 'الشهر ' + s.from : 'الأشهر ' + s.from + '–' + s.to) + ': ' + (s.amount > 0 ? fmt2(s.amount) + ' ريال' : 'لا تتوفر قدرة لقسط عقاري') + (s.post ? ' (بعد التقاعد)' : ''))));
            if (R.results.some(b => b.avgAdjusted)) cb.append(el('p', 're42-note', 'وفق المادة 13/هـ من مبادئ التمويل المسؤول تُقيَّم الأقساط غير المتساوية بمتوسطها عند المنح؛ لذلك ضبطنا الأقساط العليا حتى لا يتجاوز متوسط القسط قدرتك الحالية (' + fmt2(C.first) + ' ريال).')); }
          if (C.consumerOver) cb.append(el('p', 're42-warn', 'التزاماتك غير العقارية تتجاوز ' + C.consumerOver.limit + '% من دخلك (م15/ب)؛ قد تطلب الجهة سداد بعضها.'));
          resEl.append(cb); } }
      if (R.etizaz) resEl.append(etzBox(R)); // r50
      { const rs = new Set(R.results.map(b => b.rateSource)); if (!MG && S.plan === 'step' && rs.has('same_margin')) resEl.append(el('p', 're42-muted', T.same_margin_note || 'تقدير: حسبنا القسط المتزايد بهامش القسط الثابت المعتمد لكل بنك، وليس عرضًا متزايدًا مؤكدًا من البنوك؛ إتاحته وشروطه ونسبته تخضع لاعتماد البنك.'));
        if (rs.has('owner_sim')) resEl.append(el('p', 're42-trialnote', 'محاكاة داخلية للمالك: النسبة غير معتمدة — ليست عرض بنك.')); }
      if (S.cut) { const cw = el('div', 're42-applied'); cw.append(el('span', '', 'مطبّق: ' + (S.cut.type === 'amount' ? 'مبلغ تمويل حتى ' : 'قسط شهري حتى ') + fmt(S.cut.value) + ' ريال — نفس المدة والنسبة ')); btn(cw, 'إلغاء التقليل', () => { S.history.push(snapshot()); S.cut = null; results(false); }, 're42-mini'); resEl.append(cw); }
      if (S.history.length) btn(resEl, T.back_prev || 'الرجوع للحسبة السابقة', () => { const p = S.history.pop(); Object.assign(S, p); results(false); }, 're42-back');
      if (!R.results.length) { resEl.append(el('p', 're42-warn', whyNone(R))); // r49: real reason per bank for the owner only
        if (opt.mode === 'owner' || trial) { const RSN = { NO_RATE: 'لا توجد نسبة معتمدة لنوع القسط/الدعم', NO_STEP_RATE: 'تسعير المتزايد مستقل ولم تُدخل نسبته', NO_CAPACITY: 'لا تتبقى قدرة سداد بعد الالتزامات', ZERO_STAGE: 'قسط صفري في مرحلة (لا قدرة) — مستبعد', SUPPORT: 'الدعم غير مشمول', ENTITY: 'الجهة غير مشمولة', ETIZAZ_BANK: 'لا يشمل اعتزاز', AGE: 'تجاوز حد العمر', MIN_AMOUNT: 'أقل من حد المبلغ', MAX_SALARY: 'خارج فئة الراتب', TERM: 'المدة أقل من حد الجهة', PROPERTY: 'نوع العقار غير مشمول', SECTOR: 'القطاع غير مشمول', MIN_SALARY: 'أقل من حد الراتب', INACTIVE: 'غير مفعّل', TEST_HIDDEN: 'بنك اختبار مخفي', OFFER_NOT_ELIGIBLE: 'العرض لا ينطبق', BANK_AGE: 'العمر عند نهاية المدة يتجاوز حد البنك', BANK_TERM: 'المدة أطول من حد البنك', NO_TERM_RATE: 'لا توجد نسبة معتمدة لهذه المدة', CONSUMER_OVER: 'الالتزامات غير العقارية فوق الحد' }; const dt = el('details', 're42-info'); dt.append(el('summary', '', 'السبب لكل جهة (للمالك فقط)')); R.excluded.forEach(z => dt.append(kv(z.name, RSN[z.reason] || z.reason))); resEl.append(dt); } }
      { const rn = refNote(R); if (rn) resEl.append(el('p', 're42-warn re42-refnote', rn)); }
      const ALL = cfg.results_show_all !== false; // r54: every eligible bank as its own card (3, 5 or 10), ranked by the owner's criterion
      if (R.results.length) resEl.append(el('p', 're42-muted re54-tap', MG ? 'اضغط على أي بنك لعرض تفاصيله.' : 'اضغط على أي بنك لعرض التفاصيل نصيًا أو صورة النتيجة.'));
      (ALL ? R.results : R.top).forEach((b, i) => resEl.append(bankCard(b, i)));
      if (!ALL && R.rest.length) {
        const more = el('div', 're42-more'); more.hidden = !S.showRest; R.rest.forEach((b, i) => more.append(bankCard(b, i + R.top.length)));
        btn(resEl, (S.showRest ? 'إخفاء' : 'عرض') + ' بقية البنوك المشمولة (' + R.rest.length + ')', ev => { S.showRest = !S.showRest; more.hidden = !S.showRest; ev.target.textContent = (S.showRest ? 'إخفاء' : 'عرض') + ' بقية البنوك المشمولة (' + R.rest.length + ')'; }, 're42-link');
        resEl.append(more);
      }
      const act = el('div', 're42-actions'); // r55: no merged multi-bank share/image unless the owner enables «مشاركة مقارنة جميع البنوك»
      if (!MG || !R.results.length) { btn(act, 'مشاركة عبر واتساب', share, 're42-wa'); btn(act, 'صورة النتيجة', image); } else if (cfg.share_compare === true) { btn(act, 'مشاركة مقارنة جميع البنوك', () => shareTxt(compareTxt()), 're42-wa'); btn(act, 'صورة مقارنة البنوك', image); }
      btn(act, 'تعديل المدة', () => FIX ? toast(fixMsg()) : durationCard()); btn(act, 'تعديل البيانات', () => editMenu(false, true));
      if (R.results.length && PROD !== 'transfer') { if (cutOn('amount')) btn(act, 'تقليل مبلغ التمويل', () => cutForm('amount', R)); if (cutOn('installment')) btn(act, 'تقليل القسط', () => cutForm('installment', R)); }
      if (FF() && R.results.length) btn(act, S.feeOk ? 'أتعاب المتابعة معروضة في البطاقات' : (T.follow_cta || 'خدمة متابعة إجراءات التمويل'), () => { if (S.feeOk) return; // r51: shown only after consent
          const s2 = sheet('خدمة متابعة إجراءات التمويل', 're42-pick'); applyTheme(s2.ov, cfg.theme); s2.body.append(el('p', 're42-note', (cfg.follow_fee || {}).terms || 'أتعاب متابعة إجراءات تمويلك لدى الجهة التمويلية، بند مستقل لا يُخصم من التمويل أو الدعم.'));
          btn(s2.body, 'أوافق على الشروط وأعرض الأتعاب', () => { s2.ov.remove(); S.feeOk = true; results(false); }, 're42-go wide'); });
      if (!FIX) btn(act, 'تقليل المدة', () => { if (FIX) return toast(fixMsg()); if (termOn()) return durationCard(); toast(tpl(T.term_reduce_unavailable || 'نعتذر منك يا {name}، تقليل المدة غير متاح حاليًا ضمن اشتراكك', S.data)); });
      resEl.append(act, el('p', 're42-disc', T.disclaimer || '')); scroll();
    }
    // r48: reduce amount / installment (no new usage: results(false) is not metered)
    function cutForm(type, R) {
      const old = resEl.querySelector('.re42-cut'); if (old) old.remove();
      const best = R.results[0]; const cur = type === 'amount' ? best.amount : Math.max.apply(null, best.pays);
      const f = el('form', 're42-input re42-cut'); const i = el('input'); i.type = 'text'; i.inputMode = 'decimal'; i.autocomplete = 'off';
      i.placeholder = type === 'amount' ? 'المبلغ المطلوب (أقل من ' + fmt(cur) + ')' : 'القسط المطلوب (أقل من ' + fmt(cur) + ')';
      const go = btn(null, 'تطبيق', null, 're42-go'); go.type = 'submit'; const err = el('div', 're42-err');
      f.append(el('b', '', type === 'amount' ? 'كم مبلغ التمويل اللي تبيه؟' : 'كم القسط الشهري اللي يناسبك؟'), i, go, err);
      f.onsubmit = ev => { ev.preventDefault(); const v = money(i.value); if (!(v >= 1000 || (type === 'installment' && v >= 100)) || !(v < cur)) { err.textContent = 'اكتب رقمًا أقل من ' + fmt(cur) + ' ريال'; return; }
        S.history.push(snapshot()); S.cut = { type, value: v }; results(false); };
      const act = resEl.querySelector('.re42-actions'); resEl.insertBefore(f, act); setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 60);
    }
    function stageLine(s, N) { return (s.from === s.to ? 'الشهر ' + s.from : 'من الشهر ' + s.from + (s.to === N ? ' حتى نهاية التمويل' : ' إلى ' + s.to)) + ': ' + s.amount.toLocaleString('en-US') + ' ريال'; }
    const ORD = ['الترشيح الأول', 'الترشيح الثاني', 'الترشيح الثالث'];
    const FF = () => (cfg.follow_fee || {}).enabled === true;
    function followFee(b) { const F = cfg.follow_fee || {}; const sa = b.sup || {}; const up = sa.upfrontCounted && sa.upfront > 0 ? sa.upfront : 0;
      const base = F.base === 'bank_amount' ? b.amount : b.amount + up; // the Etizaz loan is never part of the base; nothing is counted twice
      return F.mode === 'fixed' ? Math.max(0, Number(F.fixed) || 0) : Math.round(base * Math.max(0, Number(F.pct == null || F.pct === '' ? 2.5 : F.pct))) / 100; }
    function sumRows(b) { const sa = b.sup || {}; const up = sa.upfrontCounted && sa.upfront > 0 ? sa.upfront : 0; const ez = b.etz ? b.etz.amount : 0; const blocked = S.data.supported && sa.key === 'upfront' && sa.upfront > 0 && !sa.upfrontCounted;
      if (!up && !ez && !blocked) return null; const w = el('div', 're42-sum');
      if (up || ez) w.append(kv(MG && up ? 'تمويل البنك' : 'مبلغ التمويل العقاري من البنك', fmt(b.amount) + ' ريال'));
      if (up) w.append(kv(MG ? 'الدعم السكني المقدم' : '+ الدعم السكني المقدم', fmt(up) + ' ريال')); else if (blocked) w.append(kv('الدعم السكني المقدم', 'غير مجموع مع اعتزاز'));
      if (ez) w.append(kv('+ قرض اعتزاز الحسن', fmt(ez) + ' ريال'));
      if (MG && up ? ez : (up || ez)) { /* r55: with support only, the big number already is the total */ const t = el('div', 're42-kv re42-tot'); t.append(el('span', '', '= إجمالي القيمة المتاحة لشراء العقار'), el('b', '', fmt(b.propertyValueR) + ' ريال')); w.append(t); }
      return w; }
    function bankCard(b, i) { // r51: debt-transfer results style (white card, navy name, big blue amount, labelled metrics); details folded
      const c = el('div', 're42-bank' + (i === 0 ? ' top1' : '')); c.dataset.bank = b.id; c.tabIndex = 0; c.setAttribute('role', 'button'); // r54: tap → text / image
      c.addEventListener('click', ev => { if (ev.target.closest('button,a,summary,details,input,select')) return; if (MG) togDet(c); else pickBank(b, i); });
      c.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === c) { ev.preventDefault(); if (MG) togDet(c); else pickBank(b, i); } });
      const rk = el('div', 're42-rk'); rk.append(el('span', 're42-rkl', ORD[i] || ('الترشيح ' + (i + 1)))); if (S.data.salary_bank && S.data.salary_bank === b.id) rk.append(el('span', 're42-tag salary', 'بنك نزول راتبك')); c.append(rk);
      const h = el('div', 're42-bh'); h.append(logoBox(b)); const nm = el('div', 're42-bn'); nm.append(el('b', '', b.name));
      const tg = el('div', 're42-tags'); if (!MG && b.rateSource === 'same_margin') tg.append(el('small', 're42-tag est', 'تقديري — المتزايد غير معتمد من البنك')); if (b.rateSource === 'owner_sim') tg.append(el('small', 're42-tag test', 'محاكاة داخلية للمالك')); if (b.test) tg.append(el('small', 're42-tag test', 'بنك اختبار')); if (tg.childNodes.length) nm.append(tg);
      const rt = el('div', 're42-rate'); rt.append(el('b', '', pct(b.rate)), el('small', '', b.method === 'flat' ? 'هامش ربح ثابت' : 'هامش الربح السنوي')); h.append(nm, rt); c.append(h);
      const amt = el('div', 're42-amt'); amt.append(el('small', '', PROD === 'transfer' ? 'مبلغ التمويل اللازم للتحويل' : (upOf(b) ? (T.total_with_support || 'إجمالي التمويل المتاح مع الدعم') : 'مبلغ التمويل العقاري من البنك')), el('b', '', fmt(b.amount + upOf(b)) + ' ريال')); c.append(amt); // r55
      { const tb = trBox(b); if (tb) c.append(tb); } // r54
      { const sv = sumRows(b); if (sv) c.append(sv); }
      const det = MG ? el('div', 're55-det') : c; if (MG) { det.hidden = true; const s0 = b.stages[0] || {}; const q = el('div', 're55-q'); // r55
        q.append(kv(b.plan === 'fixed' || b.stages.length < 2 ? 'القسط الشهري' : 'القسط المتغير — يبدأ من', fmt2(s0.raw != null ? s0.raw : (s0.amount != null ? s0.amount : b.firstInstallment)) + ' ريال')); c.append(q);
        const ac = el('div', 're55-act'); btn(ac, 'عرض التفاصيل', () => togDet(c), 're42-mini re55-tg'); btn(ac, 'صورة النتيجة', () => bankImage(b, i), 're42-mini'); btn(ac, 'مشاركة', () => shareTxt(bankText(b, i)), 're42-mini re42-wa'); btn(ac, 'حفظ الصورة', () => saveImg(b, i), 're42-mini'); c.append(ac); }
      const ins = el('div', 're42-ins'); ins.append(el('small', '', b.stages.length > 1 ? 'الأقساط حسب الفترات' : 'القسط الشهري'));
      const stl = b.stages.length > 7 ? b.stages.slice(0, 6).concat([b.stages[b.stages.length - 1]]) : b.stages;
      stl.forEach((st, k) => { if (b.stages.length > 7 && k === 6) ins.append(el('div', 're42-insr gap', '…')); const r = el('div', 're42-insr' + (st.post ? ' post' : ''));
        r.append(el('span', '', (st.from === st.to ? 'الشهر ' + st.from : 'الشهر ' + st.from + ' – ' + st.to) + (st.post ? ' (بعد التقاعد)' : '')), el('b', '', fmt2(st.raw != null ? st.raw : st.amount) + ' ريال')); ins.append(r); }); det.append(ins);
      const g = el('div', 're42-grid'); const FE = b.fees || {};
      g.append(kv('إجمالي الأرباح', fmt(b.profit) + ' ريال'), kv('المدة', b.months + ' شهرًا (' + durTxt(b.months) + ')'), kv('الرسوم الإدارية', FE.fee > 0 ? fmt2(FE.total) + ' ريال' + (FE.vat > 0 ? ' شاملة الضريبة' : '') : (FE.mode === 'exempt' ? 'معفاة' : 'لا توجد')), kv('إجمالي السداد', fmt(b.totalDue) + ' ريال'));
      if (S.feeOk && FF()) g.append(kv('أتعاب متابعة الإجراءات (بند مستقل)', fmt2(followFee(b)) + ' ريال'));
      det.append(g);
      const dt = el('details', 're42-more-d'); dt.append(el('summary', '', 'تفاصيل الاستقطاع والأقساط')); if (OWN) dt.append(ptableEl(b)); // r58: deduction table + fee split for the owner only
      if (FE.fee > 0 && OWN) dt.append(kv('الرسوم قبل الضريبة', fmt2(FE.fee) + ' ريال'), kv('ضريبة القيمة المضافة (' + FE.vatPct + '%)', fmt2(FE.vat) + ' ريال'));
      const ch = el('div', 're42-chips'); (PROD === 'transfer' ? chipsT(b) : chipsFor(b, S.data, cfg)).forEach(t => ch.append(el('span', '', t))); if (OWN) { dt.append(ch); det.append(dt); } else det.append(ch);
      const nt = []; if (b.termCut) nt.push('مدة هذا البنك أقصر حسب حدوده'); if (b.amountCapped) nt.push('المبلغ محدود بالحد الأعلى لدى البنك'); if (b.reduced) nt.push(b.reduced === 'amount' ? 'المبلغ مخفّض حسب طلبك بنفس المدة والنسبة' : 'القسط مخفّض حسب طلبك بنفس المدة والنسبة');
      if (nt.length) det.append(el('p', 're42-muted', nt.join(' — ')));
      if (b.offer) c.append(el('div', 're42-applied', 'مطبّق: ' + b.offer.title));
      const offs = el('div', 're42-offers');
      (b.offers || []).forEach(o => {
        if (b.offer && b.offer.id === o.id) return;
        if (o.kind === 'fixed') btn(offs, T.fixed_offer_cta || 'عرض خاص للقسط الثابت', () => tryOffer(b, o, null, 'fixed'), 're42-offer');
        else if (o.kind === 'entity') btn(offs, T.entity_offer_cta || 'عندنا عرض خاص لبعض الجهات — اكتشف إذا يشملك', () => entityPick(b, o), 're42-offer');
        else if (o.eligibleNow) btn(offs, 'عرض خاص: ' + o.title, () => tryOffer(b, o, null, o.plan && o.plan !== 'any' ? o.plan : null), 're42-offer');
      });
      if (offs.childNodes.length) det.append(offs);
      if (MG) c.append(det);
      return c;
    }
    function togDet(c) { const d0 = c.querySelector('.re55-det'); if (!d0) return; const open = d0.hidden; // r55: one bank's details at a time
      (resEl || c.parentNode).querySelectorAll('.re42-bank').forEach(x => { const y = x.querySelector('.re55-det'); if (y) y.hidden = true; x.classList.remove('open'); const t = x.querySelector('.re55-tg'); if (t) t.textContent = 'عرض التفاصيل'; });
      if (open) { d0.hidden = false; c.classList.add('open'); const t = c.querySelector('.re55-tg'); if (t) t.textContent = 'إخفاء التفاصيل'; try { c.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} } }
    // r54: transfer details inside the bank card (amount = transfer need only; extra capacity and personal financing shown separately, never added)
    function chipsT(b) { return ['تحويل مديونية عقارية', S.data.tr_keep ? 'مع استمرار الدعم (مشروط)' : (S.data.tr_supported ? 'بدون الدعم' : null), b.months + ' شهرًا (' + durTxt(b.months) + ')', b.plan === 'fixed' ? 'قسط ثابت' : 'قسط متزايد', S.trScn === 'buy' ? 'مع شراء الشخصي' : null].filter(Boolean); }
    function trBox(b) { const X = b.transfer; if (!X) return null; const w = el('div', 're42-sum re54-trb');
      if (X.oldInst > 0) w.append(kv('قسطك الحالي', fmt2(X.oldInst) + ' ريال'), kv('القسط الجديد (أول شهر)', fmt2(b.firstInstallment) + ' ريال'));
      if (X.saving != null && X.saving > 0.5) w.append(kv('الفرق الشهري التقديري', fmt2(X.saving) + ' ريال'));
      if (X.extra > 0.5 && TRC.show_extra !== false) w.append(kv('كاش إضافي متاح فعليًا (غير مضاف للتحويل)', 'حتى ' + fmt(X.extra) + ' ريال'));
      if (X.shortest && X.shortest < b.months) { w.append(kv('أقصر مدة متاحة لتغطية التحويل', X.shortest + ' شهرًا (' + durTxt(X.shortest) + ')')); if (termOn()) btn(w, 'احسب بأقصر مدة', () => { S.history.push(snapshot()); S.months = X.shortest; results(false); }, 're42-mini'); }
      if (X.support && X.support.monthly > 0) w.append(kv('الدعم الشهري المتوقع (تقديري)', fmt2(X.support.monthly) + ' ريال لمدة ' + monthsTxt(X.support.months)));
      if (OWN && X.supportInternal) { const s0 = X.supportInternal; w.append(el('p', 're42-trialnote', 'للمالك فقط — محاكاة: إجمالي تقديري ' + fmt(s0.total) + '، مصروف ' + fmt(s0.paid) + '، متبقٍ ' + fmt(s0.remaining) + ' ريال على ' + s0.months + ' شهرًا')); }
      if (X.personalBuy) { const p = X.personalBuy; w.append(el('b', '', 'شراء التمويل الشخصي (تمويل مستقل عن العقاري)'), kv('مبلغ الشراء', fmt(p.amount) + ' ريال'), kv('القسط الشخصي الجديد', fmt2(p.inst) + ' ريال لمدة ' + monthsTxt(p.months)), kv('النسبة', pct(p.rate) + (p.source === 'personal_transfer' ? ' (نسبة تحويل الشخصي المعتمدة)' : ''))); }
      if (X.personalNew) { const p = X.personalNew; const o = el('div', 're42-applied re54-pn'); o.append(el('b', '', 'خيار مستقل: تمويل شخصي جديد'), el('div', '', 'حتى ' + fmt(p.amount) + ' ريال — قسط ' + fmt2(p.inst) + ' ريال لمدة ' + monthsTxt(p.months) + ' — نسبة ' + pct(p.rate) + (p.source === 'assumed' ? ' (افتراضية: نسبة تحويل الشخصي + ' + (TRC.personal_new_add == null ? 1 : TRC.personal_new_add) + ' نقطة)' : '')), el('small', 're42-muted', 'غير مضاف للتمويل العقاري، ويخضع لموافقة البنك.')); w.append(o); }
      return w; }
    // r54: per-bank text / image (same values as the card)
    const stLine = s => (s.from === s.to ? 'الشهر ' + s.from : 'الأشهر ' + s.from + '–' + s.to) + (s.post ? ' (بعد التقاعد)' : '') + ': ' + fmt2(s.raw != null ? s.raw : s.amount) + ' ريال';
    function bankText(b, i) {
      const L = [(ORD[i] || 'الترشيح ' + (i + 1)) + ': ' + b.name, 'الاسم: ' + (S.data.name || ''), (upOf(b) ? 'إجمالي التمويل المتاح مع الدعم: ' + fmt(b.amount + upOf(b)) + ' ريال\nتمويل البنك: ' + fmt(b.amount) + ' ريال' : (PROD === 'transfer' ? 'مبلغ التمويل اللازم للتحويل: ' : 'مبلغ التمويل العقاري من البنك: ') + fmt(b.amount) + ' ريال'), 'هامش الربح: ' + pct(b.rate) + ' — ' + PLN(b.plan), 'المدة: ' + b.months + ' شهرًا (' + durTxt(b.months) + ')'];
      const sa = b.sup || {}; if (S.data.supported && sa.upfrontCounted && sa.upfront > 0) L.push('الدعم السكني المقدم: ' + fmt(sa.upfront) + ' ريال'); if (b.etz) L.push('قرض اعتزاز الحسن: ' + fmt(b.etz.amount) + ' ريال'); if (b.propertyValueR > b.amountR && (!MG || b.etz)) L.push('إجمالي القيمة المتاحة للشراء: ' + fmt(b.propertyValueR) + ' ريال');
      L.push('الأقساط حسب الفترات:'); b.stages.slice(0, 8).forEach(s => L.push('• ' + stLine(s)));
      const FE = b.fees || {}; L.push('إجمالي الأرباح: ' + fmt(b.profit) + ' ريال', 'الرسوم الإدارية: ' + (FE.fee > 0 ? fmt2(FE.total) + ' ريال' : (FE.mode === 'exempt' ? 'معفاة' : 'لا توجد')), 'إجمالي السداد: ' + fmt(b.totalDue) + ' ريال');
      const X = b.transfer; if (X) { if (X.oldInst > 0) L.push('قسطك الحالي: ' + fmt2(X.oldInst) + ' ريال'); if (X.extra > 0.5 && TRC.show_extra !== false) L.push('كاش إضافي متاح فعليًا (منفصل): حتى ' + fmt(X.extra) + ' ريال'); if (X.shortest && X.shortest < b.months) L.push('أقصر مدة متاحة: ' + X.shortest + ' شهرًا');
        if (X.support && X.support.monthly > 0) L.push('الدعم الشهري المتوقع (تقديري ومشروط): ' + fmt2(X.support.monthly) + ' ريال لمدة ' + monthsTxt(X.support.months));
        if (X.personalBuy) L.push('شراء الشخصي (مستقل): ' + fmt(X.personalBuy.amount) + ' ريال — قسط ' + fmt2(X.personalBuy.inst) + ' ريال لمدة ' + monthsTxt(X.personalBuy.months));
        if (X.personalNew) L.push('خيار تمويل شخصي جديد (مستقل): حتى ' + fmt(X.personalNew.amount) + ' ريال — قسط ' + fmt2(X.personalNew.inst) + ' ريال' + (X.personalNew.source === 'assumed' ? ' (نسبة افتراضية)' : '')); }
      if (S.feeOk && FF()) L.push('أتعاب متابعة الإجراءات (بند مستقل): ' + fmt2(followFee(b)) + ' ريال');
      if (trial) L.push('(تجربة داخلية — نسب اختبار غير معتمدة)'); L.push(T.disclaimer || '', 'https://www.fino99.com'); return L.filter(Boolean).join('\n'); }
    function shareTxt(txt) { const w = W.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); if (!w && navigator.share) navigator.share({ text: txt }).catch(() => {}); }
    const imgOf = (b, i) => drawResult({ R: S.last, only: [b], rank: i, product: PROD, data: S.data, months: b.months, extend: S.extend, plan: b.plan, cfg, T, trial, scn: S.scn, trScn: S.trScn });
    async function bankImage(b, i) { try { imgSheet(await imgOf(b, i), 'صورة النتيجة — ' + b.name); } catch (e) { toast('تعذر إنشاء الصورة', true); } }
    async function saveImg(b, i) { let r; try { r = await imgOf(b, i); } catch (e) { toast('تعذر إنشاء الصورة', true); return; } // r55: direct download of this bank's image only
      try { const a = el('a'); a.href = r.url; a.download = 'FINO99-' + String(b.id || 'bank').replace(/[^A-Za-z0-9_-]/g, '') + '.png'; a.rel = 'noopener'; D.body.append(a); a.click(); a.remove(); toast('تم حفظ صورة ' + b.name); } catch (e) { imgSheet(r, 'صورة النتيجة — ' + b.name); } }
    function compareTxt() { const R = S.last || { results: [] }; const L = [T.share_intro || 'ملخص حسبتي العقارية المبدئية من FINO99', 'الاسم: ' + (S.data.name || ''), 'المدة: ' + S.months + ' شهرًا', 'مقارنة البنوك المؤهلة (' + PLN(S.plan) + '):']; // r55 (owner flag, off by default)
      R.results.forEach((b, i) => L.push((i + 1) + ') ' + b.name + ' — ' + pct(b.rate) + ' — ' + (upOf(b) ? 'الإجمالي مع الدعم ' : 'التمويل ') + fmt(b.amount + upOf(b)) + ' ريال — القسط ' + fmt2(b.firstInstallment) + ' ريال'));
      L.push(T.disclaimer || '', 'https://www.fino99.com'); return L.filter(Boolean).join('\n'); }
    function pickBank(b, i) { const s2 = sheet(b.name + ' — ' + (ORD[i] || 'الترشيح ' + (i + 1)), 're42-pick re54-pick'); applyTheme(s2.ov, cfg.theme);
      btn(s2.body, 'عرض التفاصيل نصيًا', () => { s2.ov.remove(); const t = bankText(b, i); const m = bot(t); m.classList.add('re54-txt'); const w = el('div', 're42-actions');
        btn(w, 'مشاركة عبر واتساب', () => shareTxt(t), 're42-wa'); btn(w, 'نسخ النص', () => { try { navigator.clipboard.writeText(t).then(() => toast('تم النسخ'), () => {}); } catch (e) {} }); btn(w, 'عرض صورة النتيجة', () => bankImage(b, i)); m.append(w); scroll(); }, 're42-go wide');
      btn(s2.body, 'عرض صورة النتيجة', () => { s2.ov.remove(); bankImage(b, i); }, 're42-go wide alt'); }
    function ptableEl(b) { // r50: period | mortgage instalment | other obligations | Etizaz | total deduction | income (before/after retirement)
      const t = b.table || []; const ez = t.some(r => r.ez > 0), post = t.some(r => r.post); const w = el('div', 're42-tw'); w.append(el('small', '', 'تفاصيل الأقساط'));
      const tb = el('table', 're42-pt'); const hr = el('tr'); ['الفترة (شهر)', 'القسط العقاري', 'التزامات أخرى'].concat(ez ? ['اعتزاز'] : []).concat(['إجمالي الاستقطاع', post ? 'الدخل (قبل/بعد التقاعد)' : 'الدخل']).forEach(x => hr.append(el('th', '', x))); tb.append(hr);
      const rows = t.length > 8 ? t.slice(0, 7).concat([t[t.length - 1]]) : t;
      rows.forEach((r, k) => { if (t.length > 8 && k === 7) { const sk = el('tr', 'gap'); const td = el('td', '', '…'); td.colSpan = ez ? 6 : 5; sk.append(td); tb.append(sk); }
        const tr = el('tr', r.post ? 'post' : ''); const per = el('td', '', r.from === r.to ? String(r.from) : r.from + '–' + r.to); if (r.post) per.append(el('em', '', 'بعد التقاعد'));
        tr.append(per, el('td', '', fmt(r.pay)), el('td', '', r.ob > 0 ? fmt(r.ob) : '—')); if (ez) tr.append(el('td', '', r.ez > 0 ? fmt(r.ez) : '—')); tr.append(el('td', '', fmt(r.total)), el('td', '', fmt(r.income))); tb.append(tr); });
      w.append(tb); return w;
    }
    function etzBox(R) { // r50: Etizaz qard hasan — its own line, never mixed with housing support or the bank principal
      const ep = R.etizaz, b0 = R.results[0], ez = b0 && b0.etz; const w = el('div', 're42-etz'); w.append(el('b', '', 'قرض اعتزاز الحسن ' + fmt(ep.amount) + ' ريال'));
      w.append(kv('القسط الشهري', fmt2(ep.inst) + ' ريال' + (Math.abs(ep.last - ep.inst) >= 0.005 ? ' (الأخير ' + fmt2(ep.last) + ')' : '')), kv('فترة السماح', monthsTxt(ep.grace)), kv('مدة السداد', ep.months + ' شهرًا (' + durTxt(ep.months) + ')'),
        kv('بداية ونهاية السداد', 'الشهر ' + Math.max(1, ep.firstPay) + ' – ' + ep.lastPay + (ez && ez.beyond ? ' (يمتد بعد نهاية التمويل)' : '')));
      if (ez && OWN) { if (ez.capBefore != null) w.append(kv('قدرتك الشهرية قبل بدء قسط اعتزاز', fmt2(ez.capBefore) + ' ريال')); if (ez.capDuring != null) w.append(kv('قدرتك أثناء سداد اعتزاز', fmt2(ez.capDuring) + ' ريال')); if (ez.capAfter != null) w.append(kv('قدرتك بعد انتهاء اعتزاز', fmt2(ez.capAfter) + ' ريال')); }
      if (OWN && R.support && R.support.combineBlocked && R.support.combineBlocked.length) w.append(el('p', 're42-muted', 'لم نجمع اعتزاز مع ' + R.support.combineBlocked.map(x => x === 'upfront' ? 'الدعم المقدم' : 'الدعم الشهري').join(' و') + ' لعدم اعتماد سياسة الجمع.'));
      w.append(el('p', 're42-note', T.etizaz_note || 'احتساب اعتزاز تقديري، وتخضع أهلية المبادرة وقسطها ومدة سدادها لشروط الجهة المختصة'));
      return w;
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
      const LBL = { name: 'الاسم', sector: 'القطاع', rank: 'الرتبة', pilot: 'طيار', mil_entity: 'الجهة العسكرية', appoint: 'تاريخ التعيين', employer: 'جهة العمل', birth: 'تاريخ الميلاد', net: 'الراتب الصافي', basic: 'الراتب الأساسي', grade: 'الدرجة', etizaz: 'مبادرة اعتزاز', salary_bank: 'بنك الراتب', support: 'الدعم السكني', property: 'نوع العقار', obligations: 'الالتزامات', closing: 'إقفال العقود', tr_bank: 'البنك الحالي', tr_payoff: 'مبلغ السداد المبكر', tr_inst: 'القسط الحالي', tr_left: 'المدة المتبقية', tr_sup: 'الدعم واستمراره', phone: 'رقم الجوال' };
      order.filter(visible).forEach(k => btn(w, LBL[k] || k, () => {
        if (k === 'obligations' || k === 'closing') { if (k === 'obligations') { S.data.obligations = []; S.data.obl_done = false; } S.data.close = null; S.data.close_done = false; S.scn = 'now'; } else if (k === 'support') { S.data.supported = null; S.data.supportType = null; S.data.etizaz = null; } else if (k === 'tr_sup') { S.data.tr_sup_done = false; S.data.tr_keep = false; } else if (k === 'phone') { S.data.phone_done = false; } else S.data[k] = null;
        if (k === 'sector' || k === 'mil_entity') S.data.etizaz = null; // r51: Etizaz is re-asked only if still eligible
        if (k === 'appoint') S.data.excl_months = null; if (k === 'sector') { S.extend = null; } S.months = null; S.offers = {}; S.plans = {}; S.history = []; S.cut = null; ask(k);
      }, 're42-chip'));
      dock.append(w); scroll();
    }
    // ---------- share / image ----------
    function summary() {
      const R = S.last; const b = R && R.top[0]; if (PROD === 'transfer') return [T.share_intro, b ? bankText(b, 0) : (T.disclaimer || ''), b ? '' : 'https://www.fino99.com'].filter(Boolean).join('\n'); const lines = [T.share_intro || 'ملخص حسبتي العقارية المبدئية من FINO99', 'الاسم: ' + (S.data.name || ''), 'مدة التمويل: ' + S.months + ' شهر (' + durTxt(S.months) + ')'];
      if (b) { lines.push('أفضل نتيجة: ' + b.name + ' — مبلغ تمويل تقديري ' + fmt(b.amount) + ' ريال', 'هامش الربح: ' + pct(b.rate) + ' — ' + PLN(S.plan));
        b.stages.slice(0, 4).forEach(s => lines.push('• ' + stageLine(s, b.months))); lines.push('إجمالي الأرباح التقديرية: ' + fmt(b.profit) + ' ريال'); if (b.propertyValueR > b.amountR) lines.push('إجمالي القيمة المتاحة للشراء: ' + fmt(b.propertyValueR) + ' ريال'); if (S.scn === 'closed') lines.push('(حسبة مشروطة بإقفال العقود المحددة)'); }
      if (R && R.etizaz) lines.push('قرض اعتزاز الحسن (تقديري): ' + fmt(R.etizaz.amount) + ' ريال — قسط ' + fmt2(R.etizaz.inst) + ' ريال من الشهر ' + Math.max(1, R.etizaz.firstPay) + ' إلى ' + R.etizaz.lastPay);
      if (trial) lines.push('(تجربة داخلية — نسب اختبار غير معتمدة)');
      lines.push(T.disclaimer || '', 'https://www.fino99.com'); return lines.join('\n');
    }
    function share() {
      const txt = summary(); const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
      const w = W.open(url, '_blank', 'noopener'); if (!w && navigator.share) navigator.share({ text: txt }).catch(() => {});
    }
    async function image() { // r50: shared renderer (same R as the screen)
      const R = S.last; try { imgSheet(await drawResult({ R, data: S.data, months: S.months, extend: S.extend, plan: S.plan, cfg, T, trial, why: R && !R.results.length ? whyNone(R) : '', scn: S.scn, product: PROD, trScn: S.trScn })); } catch (e) { toast('تعذر إنشاء الصورة', true); }
    }
    // start
    if (!(Q.name && Q.name.enabled !== false)) bot(T.greeting || 'أهلًا بك'); next(); // r58: with a name question the chat starts with the introduction
    W.F99RE42._bot = { S, cfg, results, durationCard, compute, PROD, pickBank, bankText };
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
    function validate(c) { // r49: checked before every save
      const ok = v => v == null || v === '' || (Number(v) > 0 && Number(v) <= 100); const DP = c.dti_policy;
      if (DP) { if (!(Number(DP.t1_max == null ? 15000 : DP.t1_max) < Number(DP.t2_max == null ? 25000 : DP.t2_max))) return 'حد الفئة الأولى يجب أن يكون أقل من بداية الفئة الثالثة';
        for (const sct of ['pre', 'post']) { const Xp = DP[sct] || {}; for (const kk of ['t1_pct', 't1_supported_pct', 't2_pct', 't3_fallback_pct']) if (!ok(Xp[kk])) return 'نسبة استقطاع غير صالحة (1–100%)';
          if (Xp.t1_supported_enabled && !String(DP.t1_supported_source || '').trim()) return 'أدخل مصدر قاعدة الدعم قبل تفعيل حد المدعوم'; }
        if (!ok(DP.t3_test_pct) || !ok(DP.consumer_pct)) return 'نسبة غير صالحة (1–100%)'; }
      const Z = c.etizaz; if (Z) { if (!(Number(Z.amount) > 0)) return 'مبلغ اعتزاز غير صالح'; if (!(Number(Z.months) >= 1 && Number(Z.months) <= 360)) return 'مدة سداد اعتزاز بين 1 و360 شهرًا'; if (!(Number(Z.grace_months) >= 0 && Number(Z.grace_months) <= 120)) return 'فترة سماح اعتزاز بين 0 و120 شهرًا'; if (Z.start_offset != null && !(Number(Z.start_offset) >= 0)) return 'إزاحة بداية اعتزاز غير صالحة'; } // r50
      const MF = c.mortgage_fees; if (MF && MF.enabled !== false) { if (!(Number(MF.pct) > 0 && Number(MF.pct) <= 1)) return 'نسبة الرسوم العقارية بين 0 و1%'; if (!(Number(MF.cap) > 0 && Number(MF.cap) <= 5000)) return 'سقف الرسوم العقارية حتى 5,000 ريال قبل الضريبة'; }
      for (const b of c.banks || []) { const F = b.fees || {}; if (F.mode === 'lower' && MF && ((F.lower_pct != null && Number(F.lower_pct) > Number(MF.pct)) || (F.lower_cap != null && Number(F.lower_cap) > Number(MF.cap)))) return 'الرسم الأقل لـ' + b.name + ' يتجاوز السقف'; if (F.valuation != null && !(Number(F.valuation) >= 0)) return 'رسوم التقييم غير صالحة'; }
      for (const r of c.product_matrix || []) { if (!r.bank) return 'اختر البنك لكل صف في المصفوفة'; if (r.rate != null && r.rate !== '' && !(Number(r.rate) > 0 && Number(r.rate) <= 30)) return 'نسبة في المصفوفة خارج النطاق (0–30%)'; }
      const INs = c.installments || {}; if (INs.sim_rate != null && INs.sim_rate !== '' && !(Number(INs.sim_rate) >= 0 && Number(INs.sim_rate) <= 30)) return 'نسبة المحاكاة بين 0 و30%';
      for (const b of c.banks || []) { if (!ok(b.dti_t3)) return 'نسبة استقطاع ' + b.name + ' غير صالحة'; if (b.dti_t3_approved && !(Number(b.dti_t3) > 0 && String(b.dti_t3_source || '').trim())) return 'أدخل نسبة ومصدر سياسة ' + b.name + ' قبل اعتمادها'; }
      return null;
    }
    async function save() {
      if (!dirty) { toast('لا توجد تغييرات'); return; } { const bad = validate(Wc); if (bad) { toast(bad, true); return; } } saveB.disabled = true;
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
    const TABS = [['general', 'عام'], ['dti', 'سياسة الاستقطاع العقاري'], ['plans', 'طريقة الأقساط'], ['banks', 'إعدادات البنوك'], ['limits', 'المدد والترشيح'], ['sectors', 'القطاعات والجهات'], ['ranks', 'الرتب والتقاعد'], ['scale', 'سلم الرواتب العسكرية'], ['support', 'الدعم والعقارات'], ['matrix', 'مصفوفة المنتجات والدعم'], ['etizaz', 'اعتزاز'], ['fees', 'الرسوم العقارية'], ['design', 'تصميم بطاقة النتيجة'], ['theme', 'ألوان وخلفية الباقة'], ['follow', 'أتعاب المتابعة'], ['launch', 'الإطلاق المحدود'], ['questions', 'الأسئلة والنصوص'], ['transfer', 'تحويل المديونية العقارية'], ['archive', 'أرشيف الحسبات'], ['preview', 'معاينة الحسبة'], ['log', 'السجل والتراجع'], ['json', 'متقدم']];
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
          Pb.append(g); Pb.append(el('p', 're42-muted', 'خانة المتزايد فارغة = نفس هامش الثابت المعتمد (حسب «طريقة الأقساط»).'));
          field(Pb, 'تسعير القسط المتزايد', b, 'plan_pricing', 'select', { options: [['same', 'نفس الهامش المعتمد (الافتراضي)'], ['separate', 'تسعير مستقل — يلزم إدخال نسبة المتزايد']], def: 'same' });
          Pb.append(el('h4', '', 'سياسة الاستقطاع لهذا البنك (الفئة الثالثة: دخل 25,000 فأكثر)')); field(Pb, 'نسبة الاستقطاع %', b, 'dti_t3', 'num'); field(Pb, 'مصدر سياسة البنك', b, 'dti_t3_source', 'text'); field(Pb, 'معتمدة للتطبيق على العملاء', b, 'dti_t3_approved', 'bool');
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
        P.append(el('h4', '', 'الترشيح')); field(P, 'معيار الترتيب', Wc, 'ranking', 'select', { options: [['amount', 'أعلى مبلغ تمويل'], ['installment', 'أقل قسط'], ['profit', 'أقل أرباح']] }); field(P, 'عدد البنوك المرشحة', Wc, 'top_n', 'num');
        const Rd = Wc.reduce = Wc.reduce || {}; P.append(el('h4', '', 'خيارات التقليل للعميل'));
        field(P, 'تقليل مبلغ التمويل', Rd, 'amount', 'bool', { def: true }); field(P, 'تقليل القسط (بتخفيض المبلغ بنفس المدة والنسبة)', Rd, 'installment', 'bool', { def: true }); field(P, 'تقليل المدة (فعّله عند اعتماد نسب المدد الأخرى)', Rd, 'term', 'bool', { def: false });
        const TPc = Wc.term_policy = Wc.term_policy || { fixed: 240, client_change: false }; P.append(el('h4', '', 'مدة الباقة (العقاري)')); // r55
        field(P, 'مدة الباقة الثابتة للعميل (شهر)', TPc, 'fixed', 'num'); field(P, 'السماح للعميل بتغيير المدة (يتطلب نسبة معتمدة لكل بنك ومدة في مصفوفة المنتجات)', TPc, 'client_change', 'bool', { def: false });
      }
      if (k === 'dti') { // r49: «سياسة الاستقطاع العقاري» — SAMA Responsible Lending Principles, ch.4 arts 13–17 (mortgage calculator only)
        const DP = Wc.dti_policy = Wc.dti_policy || { enabled: true, t1_max: 15000, t2_max: 25000, pre: {}, post: {} }; DP.pre = DP.pre || {}; DP.post = DP.post || {};
        { const DPx = Wc.dti_policy = Wc.dti_policy || {}; field(P, 'استبعاد البنوك عند تجاوز الالتزامات غير العقارية حد م15/ب (للدخل الأقل من الفئة الثالثة) — مع مسار الإقفال المشروط', DPx, 'consumer_over_exclude', 'bool', { def: true }); } // r51
        P.append(el('p', 're42-muted', 'المرجع: البنك المركزي السعودي — مبادئ التمويل المسؤول للأفراد، الفصل الرابع (المواد 13–17). الدخل المعتمد قبل التقاعد: الراتب الصافي (الأساسي بعد حسم التقاعد + البدلات الثابتة)، وبعد التقاعد: المعاش التقديري. الفئة الأولى حتى حدها شاملًا، والثانية أكثر منه وأقل من بداية الثالثة.'));
        field(P, 'تفعيل السياسة (عند الإيقاف تُستخدم القاعدة الاحتياطية أسفل الصفحة)', DP, 'enabled', 'bool', { def: true }); field(P, 'المصدر', DP, 'source', 'text');
        field(P, 'حد الفئة الأولى (شامل)', DP, 't1_max', 'num'); field(P, 'بداية الفئة الثالثة', DP, 't2_max', 'num');
        [['pre', 'قبل التقاعد (الراتب)'], ['post', 'بعد التقاعد (المعاش)']].forEach(([key, lab]) => { const Xp = DP[key]; P.append(el('h4', '', lab));
          field(P, 'الفئة الأولى — الحد الإجمالي %', Xp, 't1_pct', 'num'); field(P, 'الفئة الأولى — حد العقاري المدعوم المستوفي للشروط %', Xp, 't1_supported_pct', 'num'); field(P, 'تفعيل حد المدعوم (يتطلب مصدر قاعدة دعم موثقة)', Xp, 't1_supported_enabled', 'bool');
          field(P, 'الفئة الثانية — الحد الإجمالي %', Xp, 't2_pct', 'num'); field(P, 'الفئة الثالثة — الحد المحافظ عند عدم وجود سياسة معتمدة للجهة %', Xp, 't3_fallback_pct', 'num'); });
        field(P, 'مصدر قاعدة الدعم الموثقة (إلزامي لتفعيل حد المدعوم)', DP, 't1_supported_source', 'text');
        P.append(el('h4', '', 'الفئة الثالثة — افتراض اختباري')); field(P, 'نسبة اختبارية % (لا تطبق على العملاء)', DP, 't3_test_pct', 'num'); field(P, 'استخدامها في معاينة وتجربة المالك فقط', DP, 't3_test_in_preview', 'bool');
        P.append(el('p', 're42-muted', 'نسبة كل بنك للفئة الثالثة تُدخل من «إعدادات البنوك» مع مصدر سياسته، ولا تطبق على العميل إلا بعد اعتمادها.'));
        P.append(el('h4', '', 'قيود أخرى (م15)')); field(P, 'حد الالتزامات غير العقارية % (تنبيه للعميل)', DP, 'consumer_pct', 'num');
        P.append(el('h4', '', 'القاعدة الاحتياطية (عند إيقاف السياسة)'));
        const Dt = Wc.dti = Wc.dti || {}; Dt.salary = Dt.salary || {}; Dt.retired = Dt.retired || {};
        P.append(el('h4', '', 'قاعدة الاستقطاع (قبل التقاعد)')); field(P, 'حد الراتب', Dt.salary, 'threshold', 'num'); field(P, 'النسبة تحت الحد %', Dt.salary, 'low', 'num'); field(P, 'النسبة من الحد فأعلى %', Dt.salary, 'high', 'num');
        P.append(el('h4', '', 'قاعدة الاستقطاع (بعد التقاعد / المتقاعد)')); field(P, 'حد الدخل', Dt.retired, 'threshold', 'num'); field(P, 'النسبة تحت الحد %', Dt.retired, 'low', 'num'); field(P, 'النسبة من الحد فأعلى %', Dt.retired, 'high', 'num');
      }
      if (k === 'plans') { // r49: «طريقة الأقساط»
        const INs = Wc.installments = Wc.installments || {};
        field(P, 'نوع القسط الافتراضي في النتائج', Wc, 'default_plan', 'select', { options: [['step', 'متغير'], ['fixed', 'ثابت']], def: 'step' });
        field(P, 'إتاحة القسط المتغير', Wc, 'plan_step_enabled', 'bool', { def: true }); field(P, 'إتاحة القسط الثابت', Wc, 'plan_fixed_enabled', 'bool', { def: true });
        field(P, 'تقييم الأقساط غير المتساوية', INs, 'avg_rule', 'select', { options: [['origination', 'م13/هـ: متوسط الأقساط لا يتجاوز القدرة عند المنح (محافظ)'], ['stage', 'حدود كل مرحلة فقط (يتطلب سياسة جهة موثقة)']], def: 'origination' });
        field(P, 'المتزايد بنفس هامش البنك المعتمد ما لم تُدخل له نسبة مستقلة (فصل التسعير عن التوزيع)', INs, 'same_margin', 'bool', { def: true });
        field(P, 'نسبة محاكاة % للمالك فقط عند غياب أي نسبة (لا تظهر للعميل)', INs, 'sim_rate', 'num');
        P.append(el('p', 're42-muted', 'المتزايد: القسط يتبع القدرة بعد خصم الالتزامات القائمة ويرتفع عند انتهاء كل التزام ويُعاد عند التقاعد. الثابت: قسط واحد طوال المدة = أقل قدرة بين جميع المراحل.'));
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
        field(P, 'المعاش على الأساسي المتوقع عند التقاعد (علاوة سنوية كل 1 محرم حتى آخر درجة، دون ترقيات) — يعمل فقط للرتبة التي أُدخل سلمها ومصدره', M, 'expected_basic', 'bool', { def: true });
        P.append(el('p', 're42-muted', 'المصدر: نظام التقاعد العسكري — المادة 8 (جزء من 35) والمادة 11 (سن الإحالة حسب الرتبة).'));
        list(P, M.ranks = M.ranks || [], [{ k: 'name', label: 'الرتبة', type: 'text' }, { k: 'group', label: 'الفئة', type: 'select', options: [['nco', 'أفراد'], ['officer', 'ضباط']] }, { k: 'age', label: 'سن التقاعد', type: 'num' }, { k: 'pilot_age', label: 'سن الطيارين', type: 'num' },
          { k: 'scale_first', label: 'أساسي الدرجة الأولى (السلم الرسمي)', type: 'num' }, { k: 'scale_step', label: 'العلاوة السنوية', type: 'num' }, { k: 'scale_grades', label: 'عدد الدرجات', type: 'num' },
          { k: 'scale_source', label: 'مصدر السلم الرسمي (إلزامي لتفعيله)', type: 'text' }, { k: 'scale_effective', label: 'تاريخ سريان السلم', type: 'text' }],
          { add: () => ({ key: 'r' + Date.now().toString(36), name: '', group: 'nco', age: null }), addLabel: 'إضافة رتبة' });
      }
      if (k === 'scale') { // r48b: «سلم الرواتب العسكرية» — mortgage calculator only
        const M = Wc.military = Wc.military || {}; const SS = M.salary_scale = M.salary_scale || { enabled: true, status: 'pending', ranks: [] }; SS.ranks = SS.ranks || [];
        P.append(el('h4', '', 'سلم الرواتب العسكرية — لتقدير الراتب الأساسي عند التقاعد في الحاسبة العقارية فقط'));
        field(P, 'استخدام السلم في الحساب', SS, 'enabled', 'bool', { def: true }); field(P, 'اسم السلم', SS, 'name', 'text'); field(P, 'تاريخ الإصدار', SS, 'issued', 'text');
        field(P, 'المصدر (إلزامي لتفعيله)', SS, 'source', 'textarea', { rows: 2 });
        field(P, 'حالة التوثيق', SS, 'status', 'select', { options: [['owner_approved', 'معتمد من المالك'], ['pending', 'قيد التحقق الرسمي'], ['verified', 'موثق رسميًا وساري']], def: 'pending' });
        field(P, 'ملاحظات', SS, 'note', 'textarea', { rows: 3 });
        P.append(el('p', 're42-muted', 'لكل رتبة: الراتب الأساسي لكل درجة بالترتيب من الدرجة 1، مفصولة بفواصل. آخر قيمة هي سقف الرتبة ولا تُضاف بعدها علاوات. الحاسبة تضيف علاوة دورية واحدة (الانتقال للدرجة التالية) كل 1 محرم حتى تاريخ الإحالة، دون افتراض ترقية. التعديل والاستبدال يُحفظان كنسخة جديدة قابلة للتراجع.'));
        list(P, SS.ranks, [{ k: 'key', label: 'الرتبة', type: 'select', options: (M.ranks || []).map(r => [r.key, r.name]) }, { k: 'values', label: 'قيم الدرجات (1 ← الأخيرة)', type: 'csv' }, { k: 'increment', label: 'العلاوة الدورية', type: 'text' }],
          { extra: (tools, it) => { const v = (it.values || []).map(x => Number(digits(String(x)))); const ok = v.length && v.every((x, i) => x > 0 && (i === 0 || x > v[i - 1]));
              tools.append(el('small', ok ? 're42-muted' : 're42-err', ok ? v.length + ' درجة — السقف ' + v[v.length - 1].toLocaleString('en-US') : 'قيم غير صالحة (يجب أن تتزايد)')); },
            add: () => ({ key: ((M.ranks || [])[0] || {}).key || '', values: [], increment: '' }), addLabel: 'إضافة رتبة للسلم' });
      }
      if (k === 'support') {
        const Sp = Wc.support = Wc.support || {}; P.append(el('h4', '', 'الدعم السكني')); P.append(el('p', 're42-muted', 'الدعم المقدم هو الافتراضي عند اختيار «مدعوم».'));
        field(P, 'مبلغ الدعم المقدم (يضاف لقيمة العقار التقديرية)', Sp, 'upfront_amount', 'num'); field(P, 'تفعيل الدعم الشهري', Sp, 'monthly_enabled', 'bool'); field(P, 'مبلغ الدعم الشهري', Sp, 'monthly_amount', 'num'); field(P, 'عدد أشهر الدعم الشهري (0 = كامل المدة)', Sp, 'monthly_months', 'num');
        P.append(el('p', 're42-muted', 'اعتزاز طبقة مستقلة تُدار من تبويب «اعتزاز». مصفوفة الدعم وخياراته في تبويب «مصفوفة المنتجات والدعم».'));
        P.append(el('h4', '', 'المنتجات العقارية')); P.append(el('p', 're42-muted', 'المفعّل يظهر للعميل بالأخضر ويكمل الحسبة. غير المفعّل يظهر باهتًا وعند الضغط عليه: «هذه الخدمة غير مشمولة باشتراكك الحالي». المخفي لا يظهر.'));
        list(P, Wc.properties = Wc.properties || [], [{ k: 'label', label: 'الاسم', type: 'text' }, { k: 'enabled', label: 'مفعّل', type: 'bool' }, { k: 'hidden', label: 'مخفي عن العميل', type: 'bool' }], { remove: false, add: () => ({ key: 'p' + Date.now().toString(36), label: 'منتج جديد', enabled: false }), addLabel: 'إضافة منتج' });
        P.append(el('h4', '', 'بنك الراتب')); Wc.salary_other = Wc.salary_other || {}; field(P, 'إظهار «بنك آخر»', Wc.salary_other, 'enabled', 'bool'); field(P, 'نسبة مخصصة لـ«بنك آخر» (اختياري)', Wc.salary_other, 'rate', 'num');
      }
      if (k === 'matrix') { // r50
        P.append(el('p', 're42-note', 'كل صف يسعّر بنكًا لمنتج ودعم ونوع قسط ومدة محددة (مع القطاع/الجهة وفئة الراتب والعمر والحدود). الصف المطابق يُستخدم أولًا، وإن لم يوجد صف مطابق تُستخدم نسب البنك الأساسية كما هي. لا تُستخدم نسبة منتج أو بنك آخر تلقائيًا. نسب الصفوف الحالية هي نسب المالك المرجعية (240 شهرًا، ثابت، دعم مقدم) للمحاكاة وليست عروضًا مصرفية مؤكدة لكل نوع.'));
        const BK = (Wc.banks || []).map(b => [b.id, b.name]); const PRP = [['any', 'أي منتج']].concat((Wc.properties || []).map(p => [p.key, p.label])); const SC = [['any', 'أي قطاع']].concat(SECT());
        list(P, Wc.product_matrix = Wc.product_matrix || [], [{ k: 'bank', label: 'البنك', type: 'select', options: BK }, { k: 'sector', label: 'القطاع', type: 'select', options: SC, def: 'any' }, { k: 'entity', label: 'الجهة (فارغ = الكل)', type: 'text' }, { k: 'property', label: 'المنتج', type: 'select', options: PRP, def: 'any' },
          { k: 'support', label: 'الدعم', type: 'select', options: SUP, def: 'any' }, { k: 'plan', label: 'القسط', type: 'select', options: PLANS, def: 'any' }, { k: 'term_min', label: 'أقل مدة', type: 'num' }, { k: 'term_max', label: 'أعلى مدة', type: 'num' }, { k: 'rate', label: 'النسبة %', type: 'num' },
          { k: 'min_salary', label: 'راتب من', type: 'num' }, { k: 'max_salary', label: 'راتب إلى', type: 'num' }, { k: 'max_age_end', label: 'أقصى عمر عند النهاية', type: 'num' }, { k: 'min_amount', label: 'أقل تمويل', type: 'num' }, { k: 'max_amount', label: 'أعلى تمويل', type: 'num' }, { k: 'conditions', label: 'الشروط/المصدر', type: 'text' }, { k: 'active', label: 'مفعّل', type: 'bool', def: true }],
          { add: () => ({ id: 'mx' + Date.now().toString(36), bank: (BK[0] || [''])[0], sector: 'any', entity: '', property: 'ready', support: 'upfront', plan: 'fixed', term_min: 240, term_max: 240, active: false }), addLabel: 'إضافة صف للمصفوفة' });
        P.append(el('h4', '', 'نطاق كل مصرف')); P.append(el('p', 're42-muted', 'فارغ = بدون قيد. القيود تستبعد البنك من الحالات غير المشمولة ولا تغيّر نسبه.'));
        (Wc.banks || []).filter(b => !b.test).forEach(b => { const bx = el('div', 're42-row'); bx.append(el('b', '', b.name)); P.append(bx);
          list(bx, [b], [{ k: 'properties', label: 'المنتجات المفعّلة', type: 'multi', options: (Wc.properties || []).map(p => [p.key, p.label]) }, { k: 'supports', label: 'الدعم', type: 'multi', options: SUP.filter(x => x[0] !== 'any' && x[0] !== 'etizaz') }, { k: 'entities', label: 'جهات العمل (فارغ = الكل)', type: 'csv' }, { k: 'min_salary', label: 'أقل راتب', type: 'num' }], { remove: false, reorder: false }); });
        P.append(el('h4', '', 'خيارات الدعم السكني')); P.append(el('p', 're42-muted', 'الدعم المقدم مفعّل. الدعم الشهري موجود ومعطّل للعملاء (يتطلب أيضًا تفعيله في «الدعم والعقارات»). الدعم العيني والبرامج الأخرى خيارات مستقبلية لا تظهر للعميل حتى تُعتمد نسبها وشروطها.'));
        list(P, Wc.support_options = Wc.support_options || [], [{ k: 'label', label: 'الخيار', type: 'text' }, { k: 'enabled', label: 'مفعّل للعملاء', type: 'bool' }, { k: 'note', label: 'ملاحظة', type: 'text' }], { remove: false, reorder: false });
        const MX = Wc.support_matrix = Wc.support_matrix || {}; P.append(el('h4', '', 'مرجع مصفوفة الدعم (غير مفعّل افتراضيًا)')); P.append(el('p', 're42-muted', MX.source || ''));
        field(P, 'استخدام باقات الدعم المقدم حسب الدخل (غير مفعّل = مبلغ الدعم المقدم في «الدعم والعقارات»)', MX, 'use_packages', 'bool');
        list(P, MX.packages = MX.packages || [], [{ k: 'from', label: 'الدخل من', type: 'num' }, { k: 'to', label: 'إلى (فارغ = فأعلى)', type: 'num' }, { k: 'amount', label: 'مبلغ الباقة', type: 'num' }], { add: () => ({ from: 0, to: null, amount: 0 }), addLabel: 'إضافة فئة' });
        field(P, 'استخدام الدعم الشهري حسب الدخل (يتطلب تفعيل الدعم الشهري)', MX, 'use_monthly', 'bool');
        list(P, MX.monthly = MX.monthly || [], [{ k: 'from', label: 'الدخل من', type: 'num' }, { k: 'to', label: 'إلى (فارغ = فأعلى)', type: 'num' }, { k: 'amount', label: 'الدعم الشهري', type: 'num' }, { k: 'months', label: 'الأشهر', type: 'num' }], { add: () => ({ from: 0, to: null, amount: 0, months: 240 }), addLabel: 'إضافة فئة' });
      }
      if (k === 'etizaz') { // r50
        const Z = Wc.etizaz = Wc.etizaz || {}; Z.combine = Z.combine || {};
        P.append(el('p', 're42-note', 'اعتزاز قرض حسن مستقل للدفعة المقدمة، لا يُخلط بالدعم السكني ولا بأصل التمويل البنكي. يظهر سؤاله فقط عند اجتماع: القطاع المسموح + «مدعوم سكنيًا» + الجهة المسموحة (الافتراضي: عسكري / وزارة الدفاع). اختيار «نعم» لا يُعد إثبات أهلية. القيم محاكاة قابلة للتعديل وليست قسطًا مصرفيًا موحدًا مؤكدًا.'));
        field(P, 'تفعيل حساب اعتزاز', Z, 'enabled', 'bool'); field(P, 'مبلغ القرض الحسن (ريال)', Z, 'amount', 'num'); field(P, 'فترة السماح (شهر)', Z, 'grace_months', 'num'); field(P, 'مدة السداد (شهر)', Z, 'months', 'num');
        field(P, 'الأشهر المنقضية من قرض اعتزاز عند بدء العقاري (0 = يبدآن معًا)', Z, 'start_offset', 'num'); field(P, 'يتطلب أن يكون مدعومًا سكنيًا', Z, 'require_supported', 'bool', { def: true });
        list(P, [Z], [{ k: 'sectors', label: 'القطاعات المسموحة', type: 'multi', options: SECT() }, { k: 'entities', label: 'الجهات المسموحة', type: 'csv' }, { k: 'banks', label: 'البنوك التي تسمح به (فارغ = الكل)', type: 'multi', options: (Wc.banks || []).filter(b => !b.test).map(b => [b.id, b.name]) }, { k: 'properties', label: 'المنتجات (فارغ = الكل)', type: 'multi', options: (Wc.properties || []).map(p => [p.key, p.label]) }], { remove: false, reorder: false });
        P.append(el('h4', '', 'مصفوفة توافق الجمع')); field(P, 'يُجمع مع الدعم المقدم', Z.combine, 'upfront', 'bool'); field(P, 'يُجمع مع الدعم الشهري', Z.combine, 'monthly', 'bool');
        P.append(el('p', 're42-muted', 'لا تفعّل الجمع إلا بعد التحقق من سياسة الجهة المختصة. عند عدم الجمع يظهر كل مبلغ في خانته مع توضيح أنه غير مجموع.'));
        field(P, 'المصدر/الملاحظة', Z, 'source', 'textarea', { rows: 2 }); const Tx = Wc.texts = Wc.texts || {}; field(P, 'تنويه اعتزاز للعميل', Tx, 'etizaz_note', 'textarea', { rows: 2 });
        const e0 = (Z.entities || [])[0] || 'وزارة الدفاع'; const ex = E().etizazPlan({ etizaz: true, sector: (Z.sectors || [])[0] || 'military', supported: true, mil_entity: e0, entity: e0 }, Object.assign({}, Wc, { etizaz: Object.assign({}, Z, { enabled: true }) }));
        if (ex) P.append(el('p', 're42-capline', 'مثال: القسط ' + fmt2(ex.inst) + ' ريال (الأخير ' + fmt2(ex.last) + ') — السداد من الشهر ' + Math.max(1, ex.firstPay) + ' إلى ' + ex.lastPay));
      }
      if (k === 'fees') { // r50
        const G = Wc.mortgage_fees = Wc.mortgage_fees || {}; P.append(el('p', 're42-note', 'الرسوم الإدارية عند منح التمويل العقاري: الأقل من النسبة أو السقف، قبل ضريبة القيمة المضافة عند انطباقها. لا تُحسب رسوم على قرض اعتزاز، ولا تتكرر التكاليف: رسوم التقييم تُحسب ضمن السقف نفسه.'));
        field(P, 'تطبيق قاعدة الرسوم العقارية', G, 'enabled', 'bool', { def: true }); field(P, 'النسبة القصوى %', G, 'pct', 'num'); field(P, 'السقف قبل الضريبة (ريال)', G, 'cap', 'num'); field(P, 'ضريبة القيمة المضافة %', G, 'vat_pct', 'num'); field(P, 'المصدر', G, 'source', 'textarea', { rows: 2 });
        const exb = el('div', 're42-capbox'); [200000, 500000].forEach(a => { const f = E().feeCalc(a, {}, Wc); exb.append(el('div', 're42-st', fmt(a) + ' ريال ← رسوم ' + fmt2(f.fee) + ' + ضريبة ' + fmt2(f.vat) + ' = ' + fmt2(f.total) + ' ريال')); }); P.append(exb);
        P.append(el('h4', '', 'رسوم كل بنك')); (Wc.banks || []).filter(b => !b.test).forEach(b => { b.fees = b.fees || {}; const r = el('div', 're42-row'); r.append(el('b', '', b.name));
          field(r, 'النوع', b.fees, 'mode', 'select', { options: [['standard', 'وفق القاعدة'], ['lower', 'رسم أقل'], ['exempt', 'إعفاء']], def: 'standard' }); field(r, 'نسبة أقل %', b.fees, 'lower_pct', 'num'); field(r, 'سقف أقل (ريال)', b.fees, 'lower_cap', 'num'); field(r, 'منها رسوم تقييم (ضمن السقف)', b.fees, 'valuation', 'num'); P.append(r); });
      }
      if (k === 'design') { // r50
        const DZ = Wc.card_design = Object.assign({}, DESIGN_DEF, Wc.card_design || {}); P.append(el('p', 're42-note', 'ما يظهر في صورة النتيجة المشتركة. البيانات الشخصية مخفية افتراضيًا. المعاينة تستخدم الإعدادات الحالية (حتى غير المحفوظة) وحالة تجريبية دون استهلاك أي كود.'));
        [['name', 'الاسم'], ['rank', 'الرتبة'], ['employer', 'جهة العمل'], ['birth', 'تاريخ الميلاد'], ['appoint', 'تاريخ التعيين'], ['salary', 'الراتب'], ['retirement', 'التقاعد والمعاش'], ['salary_bank', 'بنك الراتب'], ['bank_name', 'اسم البنك'], ['rates', 'النسب'], ['contact', 'التواصل (الموقع)'], ['qr', 'رمز QR للموقع']].forEach(([kk, l]) => field(P, 'إظهار ' + l, DZ, kk, 'bool'));
        const row = el('div', 're42-actions'); btn(row, 'معاينة حقيقية للصورة', async () => { try { const c = clone(Wc); c.banks = (c.banks || []).filter(b => !b.test && b.approved && b.active !== false && b.included !== false); imgSheet(await drawResult(sampleCase(c)), 'معاينة صورة النتيجة'); } catch (e) { toast('تعذر المعاينة: ' + e.message, true); } }, 're42-go'); P.append(row);
      }
      if (k === 'theme') { // r51: mortgage package colours only, live preview before saving
        const TH = Wc.theme = Object.assign({}, THEME_DEF, Wc.theme || {}); P.append(el('p', 're42-note', 'ألوان وخلفية الباقة العقارية فقط (المحادثة والنتائج). القيم الافتراضية مأخوذة من نتائج تحويل المديونية الحالية دون تعديلها. المعاينة تتحدث فورًا قبل الحفظ.'));
        const pv = el('div', 're42-thbox'); const draw = () => { applyTheme(pv, TH); pv.innerHTML = '';
          const ch = el('div', 're42-choices'); btn(ch, 'رقيب', null, 're42-chip'); btn(ch, 'عريف', null, 're42-chip'); btn(ch, 'وحدة جاهزة من السوق', null, 're42-chip ok'); const fr = el('div', 're42-actions'); btn(fr, 'التالي', null, 're42-go'); btn(fr, 'لا يوجد', null, 're42-skip'); btn(fr, 'ما أعرف', null, 're42-skip');
          const cd = el('div', 're42-bank top1'); const rk = el('div', 're42-rk'); rk.append(el('span', 're42-rkl', 'الترشيح الأول')); cd.append(rk); const h = el('div', 're42-bh'); const nm = el('div', 're42-bn'); nm.append(el('b', '', 'اسم البنك')); const rt = el('div', 're42-rate'); rt.append(el('b', '', '4.25%'), el('small', '', 'هامش الربح السنوي')); h.append(el('span', 're42-logo'), nm, rt); cd.append(h);
          const a = el('div', 're42-amt'); a.append(el('small', '', 'مبلغ التمويل العقاري من البنك'), el('b', '', '850,000 ريال')); cd.append(a); pv.append(el('div', 're42-msg bot', 'وش رتبتك العسكرية يا نايف؟'), ch, fr, cd); };
        [['navy', 'اللون الأساسي (العناوين والأزرار الرئيسية)'], ['blue', 'لون المبالغ'], ['green', 'لون التأكيد والمنتج المتاح'], ['bg', 'خلفية المحادثة'], ['card', 'خلفية البطاقات'], ['text', 'لون النص'], ['chip_bg', 'خلفية الاختيارات'], ['chip_text', 'نص الاختيارات']].forEach(([kk, l]) => { const row = el('label', 're42-f'); const i = el('input'); i.type = 'color'; i.value = okCol(TH[kk]) ? TH[kk] : THEME_DEF[kk]; i.oninput = () => { TH[kk] = i.value; mark(); draw(); }; row.append(el('span', '', l), i); P.append(row); });
        btn(P, 'استعادة الألوان الافتراضية', () => { Object.assign(TH, THEME_DEF); mark(); show('theme'); }, 're42-link'); P.append(el('h4', '', 'معاينة قبل الحفظ'), pv); draw();
        btn(P, 'معاينة المحادثة بهذه الألوان', () => { const c = clone(Wc); c.banks = (c.banks || []).filter(b => !b.test && b.approved && b.active !== false && b.included !== false); openBot({ mode: 'owner', trial: false, cfg: c, preview: 'معاينة الألوان' }); }, 're42-go');
      }
      if (k === 'follow') { // r51: future service — disabled by default; never deducted from the financing or the support; independent of other packages' contracts/fees
        const F = Wc.follow_fee = Object.assign({ enabled: false, mode: 'pct', pct: 2.5, fixed: 0, base: 'amount_plus_support', terms: '' }, Wc.follow_fee || {});
        P.append(el('p', 're42-note', 'أتعاب متابعة إجراءات التمويل العقاري — معطّلة افتراضيًا. عند التفعيل تظهر للعميل كبند مستقل فقط بعد موافقته على الشروط، ولا تُخصم تلقائيًا من التمويل أو الدعم. قرض اعتزاز لا يدخل في أساس الاحتساب، ولا يُحتسب أي مبلغ مرتين. لا علاقة لها بعقود وأتعاب الباقات الأخرى.'));
        field(P, 'تفعيل أتعاب المتابعة للعملاء', F, 'enabled', 'bool'); field(P, 'طريقة الاحتساب', F, 'mode', 'select', { options: [['pct', 'نسبة مئوية'], ['fixed', 'مبلغ مقطوع']], def: 'pct', re: true });
        field(P, 'النسبة % (مثل 2.5 أو 1.5 أو 1)', F, 'pct', 'num'); field(P, 'المبلغ المقطوع (ريال)', F, 'fixed', 'num');
        field(P, 'أساس النسبة', F, 'base', 'select', { options: [['amount_plus_support', 'التمويل البنكي + الدعم السكني المقدم (دون اعتزاز)'], ['bank_amount', 'مبلغ التمويل البنكي فقط']], def: 'amount_plus_support', re: true });
        field(P, 'شروط الخدمة (تظهر للعميل قبل الموافقة)', F, 'terms', 'textarea', { rows: 4 });
        const b0 = 800000, s0 = 150000, z0 = 160000; const base = F.base === 'bank_amount' ? b0 : b0 + s0; const ex = el('div', 're42-capbox');
        ex.append(el('div', 're42-st', 'مثال: تمويل ' + fmt(b0) + ' + دعم ' + fmt(s0) + ' + اعتزاز ' + fmt(z0) + ' (مستثنى) ← الأتعاب ' + fmt2(F.mode === 'fixed' ? Number(F.fixed) || 0 : Math.round(base * Number(F.pct == null || F.pct === '' ? 2.5 : F.pct)) / 100) + ' ريال')); P.append(ex);
      }
      if (k === 'launch') { // r50: limited launch — server-side counter (successful calculations only), no sale opened, no codes generated
        P.append(el('p', 're42-note', 'الإطلاق المحدود يفتح البوت العقاري لأصحاب أكواد الباقة العقارية الأساسية والتجديد فقط، حتى الحد المحدد. يُحتسب المستخدم عند أول حسبة ناجحة فقط (المحاولات الفاشلة لا تُحتسب). البيع العام وحالة المتجر والأكواد والمخزون لا تتغير.'));
        const box = el('div'); P.append(box);
        const act = async (a, dd) => { try { await launchCall(a, dd); toast('تم الحفظ'); pubCache = null; await load(); } catch (e) { toast('لم يتم: ' + e.message, true); } };
        const load = async () => { box.innerHTML = ''; let L; try { L = await launchCall('get'); } catch (e) { box.append(el('p', 're42-err', 'تعذر التحميل: ' + e.message)); return; }
          const sts = el('div', 're42-status'); const pill = (t, ok) => sts.append(el('span', 're42-pill ' + (ok ? 'ok' : 'off'), t));
          pill(L.enabled ? 'الإطلاق المحدود مفعّل' : 'الإطلاق المحدود متوقف', L.enabled); pill(!L.accept_new ? 'لا يقبل مستخدمين جددًا' : L.count >= L.limit ? 'اكتمل العدد' : 'يقبل مستخدمين جددًا', L.enabled && L.accept_new && L.count < L.limit); pill('المستخدمون: ' + L.count + ' من ' + L.limit, true); box.append(sts);
          const row = el('div', 're42-actions');
          btn(row, L.enabled ? 'إيقاف الإطلاق المحدود' : 'تفعيل الإطلاق المحدود', () => { if (!L.enabled && !confirm('سيُفتح البوت العقاري لأصحاب أكواد الباقة العقارية فقط حتى ' + L.limit + ' مستخدمًا. البيع العام والمتجر لا يتغيران. متأكد؟')) return; act('set', { enabled: !L.enabled }); }, L.enabled ? 'danger' : 're42-go');
          btn(row, L.accept_new ? 'إيقاف قبول مستخدمين جدد' : 'استئناف قبول مستخدمين جدد', () => act('set', { accept_new: !L.accept_new })); box.append(row);
          const lf = el('form', 're42-input'); const li = el('input'); li.inputMode = 'numeric'; li.value = String(L.limit); const lb = btn(null, 'حفظ الحد', null, 're42-go'); lb.type = 'submit'; lf.append(el('span', '', 'الحد الأقصى للمستخدمين'), li, lb);
          lf.onsubmit = ev => { ev.preventDefault(); const n = Number(digits(li.value)); if (!(Number.isInteger(n) && n >= 1 && n <= 1000)) { toast('الحد بين 1 و1000', true); return; } act('set', { limit: n }); }; box.append(lf);
          box.append(el('h4', '', 'المستخدمون المقبولون')); if (!(L.users || []).length) box.append(el('p', 're42-muted', 'لا يوجد بعد.'));
          (L.users || []).forEach((u, i) => box.append(kv((i + 1) + '. ' + u.code + (u.stock === 'renewal' ? ' (تجديد)' : ''), new Date(u.first_at).toLocaleString('ar-SA-u-nu-latn'))));
          if ((L.log || []).length) { box.append(el('h4', '', 'سجل التغييرات')); L.log.slice(0, 10).forEach(g => box.append(el('div', 're42-muted', new Date(g.at).toLocaleString('ar-SA-u-nu-latn') + ' — ' + JSON.stringify(g.change)))); } };
        load();
      }
      if (k === 'questions') {
        P.append(el('h4', '', 'ترتيب الأسئلة ونصوصها')); P.append(el('p', 're42-muted', 'استخدم {name} لاسم العميل. أسئلة الرتبة والجهة العسكرية والتعيين والراتب الأساسي تظهر للعسكري فقط.'));
        list(P, Wc.questions = Wc.questions || [], [{ k: 'text', label: 'السؤال', type: 'text' }, { k: 'enabled', label: 'مفعّل', type: 'bool', def: true }], { remove: false });
        P.append(el('h4', '', 'النصوص والنتائج')); const Tx = Wc.texts = Wc.texts || {};
        [['greeting', 'الترحيب'], ['duration_title', 'عنوان بطاقة المدة'], ['extend_label', 'خيار التمويل بعد التقاعد'], ['reduce_label', 'شريط تقليل المدة'], ['approve_label', 'زر اعتماد المدة'], ['results_title', 'عنوان النتائج'],
          ['rank_amount', 'وصف الترتيب (أعلى مبلغ)'], ['entity_offer_cta', 'زر عروض الجهات'], ['fixed_offer_cta', 'زر عرض القسط الثابت'], ['back_prev', 'زر الرجوع للحسبة السابقة'], ['no_banks', 'رسالة عدم وجود بنك مؤهل'], ['step_unavailable', 'رسالة عدم إتاحة القسط المتغير'], ['term_reduce_unavailable', 'رسالة عدم إتاحة تقليل المدة'], ['term_fixed_msg', 'رسالة تثبيت مدة الباقة'], ['close_warn', 'تحذير الالتزامات المرتفعة (إقفال العقود)'], ['total_with_support', 'عنوان الإجمالي مع الدعم'],
          ['pension_note', 'تنويه المعاش'], ['disclaimer', 'التنويه المبدئي'], ['share_intro', 'مقدمة المشاركة'], ['trial_note', 'تنويه وضع التجربة'], ['product_unavailable', 'تنويه المنتج غير المتاح'], ['consumer_over_warn', 'تحذير تجاوز الالتزامات'], ['follow_cta', 'زر خدمة المتابعة']].forEach(([key, l]) => field(P, l, Tx, key, key.length > 12 || ['disclaimer', 'pension_note'].includes(key) ? 'textarea' : 'text', { rows: 2 }));
      }
      if (k === 'transfer') { // r54
        const TR = Wc.transfer = Object.assign({ enabled: true, ranking: 'amount', default_plan: 'fixed', exclude_current: true, rate_fallback: 'mortgage', show_extra: true, personal_new: true, personal_new_add: 1, personal_max_months: 60, personal_new_min: 10000, banks: {} }, Wc.transfer || {});
        TR.banks = TR.banks || {}; const SR = TR.support_remain = Object.assign({ client_enabled: false, total_mode: 'fixed', total_est: 200000, base_cap: 500000, allow_extend: false, source: '' }, TR.support_remain || {});
        P.append(el('p', 're42-note', 'منتج مستقل يستخدم نفس محرك العقاري (الاستقطاع حسب الدخل والدعم والالتزامات، والمراحل والتقاعد). مبلغ التمويل = مبلغ السداد المبكر فقط، وأي قدرة إضافية تظهر منفصلة. يُرشَّح فقط البنك المفعّل له «يستقبل تحويل العقاري».'));
        field(P, 'تفعيل المنتج', TR, 'enabled', 'bool', { def: true });
        field(P, 'ترتيب الترشيحات', TR, 'ranking', 'select', { options: [['amount', 'أعلى مبلغ تمويل متاح'], ['installment', 'أقل قسط'], ['profit', 'أقل أرباح'], ['rate', 'أقل نسبة']], def: 'amount' });
        field(P, 'نوع القسط الافتراضي', TR, 'default_plan', 'select', { options: [['fixed', 'ثابت'], ['step', 'متزايد']], def: 'fixed' });
        field(P, 'استبعاد البنك الحالي للعميل', TR, 'exclude_current', 'bool', { def: true });
        field(P, 'عند عدم وجود نسبة تحويل خاصة', TR, 'rate_fallback', 'select', { options: [['mortgage', 'استخدم نسبة العقاري المعتمدة للبنك (مع تنويه)'], ['none', 'لا ترشح البنك']], def: 'mortgage' });
        field(P, 'إظهار الكاش الإضافي المتاح (منفصلًا)', TR, 'show_extra', 'bool', { def: true });
        P.append(el('h4', '', 'التمويل الشخصي (مستقل عن العقاري)'));
        field(P, 'عرض خيار تمويل شخصي جديد', TR, 'personal_new', 'bool', { def: true }); field(P, 'إضافة على نسبة تحويل الشخصي للشخصي الجديد (نقطة مئوية)', TR, 'personal_new_add', 'num');
        field(P, 'أقصى مدة للشخصي بالأشهر (حتى 60)', TR, 'personal_max_months', 'num'); field(P, 'أدنى مبلغ لخيار الشخصي الجديد', TR, 'personal_new_min', 'num'); field(P, 'حد الاستقطاع الشخصي % (فارغ = حد الالتزامات الاستهلاكية)', TR, 'personal_dti_pct', 'num');
        P.append(el('h4', '', 'البنوك'));
        (Wc.banks || []).filter(b => !b.test).forEach(b => { const TB = TR.banks[b.id] = Object.assign({}, TR.banks[b.id] || {}); const box = el('div', 're42-row'); box.append(el('b', '', b.name + (TB.assumed ? ' (مفعّل مبدئيًا — راجعه)' : '')));
          field(box, 'يستقبل تحويل العقاري', TB, 'enabled', 'bool'); field(box, 'نسبة التحويل % (فارغ = نسبة العقاري)', TB, 'rate', 'num'); field(box, 'شراء الشخصي متاح', TB, 'personal', 'bool', { def: true });
          field(box, 'نسبة شراء الشخصي % (فارغ = نسبة تحويل الشخصي المعتمدة)', TB, 'personal_rate', 'num'); field(box, 'نسبة الشخصي الجديد % (فارغ = افتراضية)', TB, 'personal_new_rate', 'num'); P.append(box); });
        P.append(el('h4', '', 'محرك الدعم الشهري المتبقي (محاكاة داخلية)'));
        P.append(el('p', 're42-warn', 'محاكاة غير معتمدة من صندوق التنمية العقارية وليست ضمانًا لاستمرار الدعم. تبقى معطلة للعملاء حتى تعتمد المصدر والمعادلة.'));
        field(P, 'إتاحة احتساب استمرار الدعم للعملاء', SR, 'client_enabled', 'bool');
        field(P, 'طريقة الإجمالي التقديري', SR, 'total_mode', 'select', { options: [['fixed', 'مبلغ يحدده المالك'], ['schedule', 'الدعم الشهري × (المصروف + المتبقي)']], def: 'fixed' });
        field(P, 'إجمالي الدعم التقديري (ريال)', SR, 'total_est', 'num'); field(P, 'سقف مبلغ التمويل لأساس الدعم (ريال)', SR, 'base_cap', 'num');
        field(P, 'السماح بتجاوز مدة العقد السابق', SR, 'allow_extend', 'bool'); field(P, 'مرجع اعتماد التجاوز (إلزامي ليعمل التجاوز)', SR, 'source', 'text');
        P.append(el('p', 're42-muted', 'المعادلة: المتبقي = الإجمالي التقديري − (الدعم الشهري × الأشهر المصروفة)، يوزع على الأشهر المؤهلة الجديدة (لا تتجاوز المدة المتبقية)، وبحد أقصى أرباح أول ' + fmt(Number(SR.base_cap) || 500000) + ' ريال من التمويل. مثال: 200,000 − (2,000 × 24) = 152,000 ريال.'));
        P.append(el('h4', '', 'رقم الجوال (مستقبلي — معطل)')); const PH = Wc.phone = Object.assign({ enabled: false, show: false, archive: false }, Wc.phone || {});
        field(P, 'طلب رقم الجوال (اختياري للعميل)', PH, 'enabled', 'bool'); field(P, 'إظهاره في صورة النتيجة', PH, 'show', 'bool'); field(P, 'حفظه في الأرشيف', PH, 'archive', 'bool');
        P.append(el('h4', '', 'عام')); field(P, 'عرض جميع البنوك المؤهلة كبطاقات (العقاري والتحويل)', Wc, 'results_show_all', 'bool', { def: true }); field(P, 'مشاركة مقارنة جميع البنوك للعميل (العقاري — معطلة حاليًا)', Wc, 'share_compare', 'bool', { def: false }); // r55
        const AR = Wc.archive = Object.assign({ enabled: true }, Wc.archive || {}); field(P, 'حفظ حسبات العملاء في أرشيف المالك', AR, 'enabled', 'bool', { def: true });
        const row = el('div', 're42-actions'); btn(row, 'تجربة المالك — تحويل العقاري', () => openBot({ mode: 'owner', trial: true, cfg: clone(Wc), product: 'transfer' }), 're42-go');
        btn(row, 'معاينة العميل — تحويل العقاري', () => { const c = clone(Wc); c.banks = (c.banks || []).filter(b => !b.test && b.approved && b.active !== false && b.included !== false); openBot({ mode: 'owner', trial: false, cfg: c, preview: 'معاينة العميل', product: 'transfer' }); }); P.append(row);
      }
      if (k === 'archive') { // r54: owner-only archive
        P.append(el('p', 're42-note', 'أرشيف حسبات العملاء (العقاري والتحويل): المدخلات والنتائج والترشيحات ونص المحادثة. للمالك فقط، ورقم الجوال لا يُحفظ إلا إذا فعّلته. يمكنك حذف أي سجل.'));
        const box = el('div', 're42-list'); P.append(box);
        const load = async () => { box.textContent = 'جاري التحميل…'; let r; try { r = await archCall('list', { limit: 50 }); } catch (e) { box.textContent = 'تعذر التحميل: ' + e.message; return; } box.innerHTML = ''; const rows = (r && r.rows) || [];
          if (!rows.length) box.append(el('p', 're42-muted', 'لا توجد سجلات بعد.'));
          rows.forEach(x => { const it = el('details', 're42-info'); const dd = x.data || {}; const top = (dd.results || [])[0];
            it.append(el('summary', '', new Date(x.at).toLocaleString('ar-SA') + ' — ' + (x.product === 'transfer' ? 'تحويل' : 'عقاري') + ' — ' + ((dd.input && dd.input.name) || '') + (top ? ' — ' + top.name + ' ' + fmt(top.amount) : ' — لا بنوك')));
            it.append(el('pre', 're54-pre', JSON.stringify(dd, null, 1))); btn(it, 'حذف السجل', async () => { if (!confirm('حذف هذا السجل نهائيًا؟')) return; try { await archCall('delete', { id: x.id }); load(); } catch (e) { toast(e.message, true); } }, 're42-mini danger'); box.append(it); }); };
        load();
      }
      if (k === 'preview') {
        P.append(el('p', 're42-note', 'المعاينة تستخدم الإعدادات الحالية في هذه الشاشة (حتى غير المحفوظة) ولا تستهلك أي كود أو حسبة.'));
        const row = el('div', 're42-actions');
        btn(row, 'تجربة المالك (مع بنوك الاختبار)', () => openBot({ mode: 'owner', trial: true, cfg: clone(Wc) }), 're42-go');
        btn(row, 'معاينة كما يراها العميل', () => { const c = clone(Wc); c.banks = (c.banks || []).filter(b => !b.test && b.approved && b.active !== false && b.included !== false); openBot({ mode: 'owner', trial: false, cfg: c, preview: 'معاينة العميل' }); });
        btn(row, 'تجربة المالك — تحويل العقاري', () => openBot({ mode: 'owner', trial: true, cfg: clone(Wc), product: 'transfer' }), 're42-go'); // r54
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
      if ((svc === 'mortgage_buyout' || svc === 'bot_mortgage_buyout') && !isOwner()) { // r54: «تحويل المديونية العقارية»
        try { const p = await pub(); if (p && p.enabled && p.visible && p.mode === 'bot' && p.config && (p.config.transfer || {}).enabled !== false) { openBot({ mode: 'client', trial: false, cfg: p.config, product: 'transfer' }); return; } } catch (e) {}
      }
      if ((svc === 'mortgage_quote' || svc === 'bot_mortgage_quote') && !isOwner()) {
        try { const p = await pub(); if (p && p.enabled && p.visible && p.mode === 'bot' && p.config) { openBot({ mode: 'client', trial: false, cfg: p.config }); return; } } catch (e) {}
      }
      return orig.apply(this, arguments);
    };
    wrap.__re42 = true; W.F99V13RunService = wrap;
  }
  W.F99RE42 = { openBot, openCenter, isOwner, version: 'r54' };
  const tick = () => { try { tile(); hookClient(); } catch (e) {} };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', tick); else tick();
  setInterval(tick, 1500);
})();
