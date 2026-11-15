/* FINO99 — Advanced mortgage layer (additive, on top of F99MortgageCore results).
 * - Never changes the original engine, rates, banks, ratios or packages. Every figure below is
 *   derived from F99MortgageCore.calculateBank() outputs or from policies the OWNER typed in the
 *   central 'f99m_mortgage' setting under `advanced` (no invented rates).
 * - Features: bank recommendation by criteria, self-build / off-plan staged disbursement,
 *   mortgage transfer (refinance) comparison, retirement/support payment timeline.
 * - Clients see the card only when the owner enables it; the owner always sees a labelled preview.
 * - A transfer calculation for a client is a new financing amount, so it is metered by the
 *   central f99v21_client_use_and_meter exactly like the original calculator. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.F99MAdv = api; api.install(root); }
})(typeof window !== 'undefined' ? window : null, function (w) {
  'use strict';

  const TEMPLATES = Object.freeze({
    selfBuild: {graceMonths: 12, mode: 'profit_only', stages: [
      {label: 'الأساسات بعد الرخصة', percent: 25, month: 1}, {label: 'الهيكل الخرساني (العظم)', percent: 25, month: 4},
      {label: 'الأعمال الكهربائية والسباكة', percent: 25, month: 8}, {label: 'التشطيب والاستلام', percent: 25, month: 12}]},
    offPlan: {graceMonths: 24, mode: 'profit_only', stages: [
      {label: 'توقيع عقد البيع على الخارطة', percent: 20, month: 1}, {label: 'إنجاز 40% من المشروع', percent: 30, month: 8},
      {label: 'إنجاز 80% من المشروع', percent: 30, month: 16}, {label: 'الإفراغ والاستلام', percent: 20, month: 24}]}
  });
  const PRODUCT_LABEL = {selfBuild: 'البناء الذاتي', offPlan: 'البيع على الخارطة'};
  const MODE_LABEL = {profit_only: 'يدفع العميل الربح فقط على المبلغ المصروف أثناء البناء', capitalized: 'يؤجل الربح ويضاف لأصل التمويل بعد الاستلام'};
  const CRITERIA = {
    cost: 'الأقل تكلفة إجمالية (مع الرسوم الإدارية)',
    installment: 'الأقل قسطًا شهريًا (أعلى قسط في الجدول)',
    capacity: 'الأعلى قدرة تمويلية',
    rate: 'الأقل هامش ربح سنوي',
    fees: 'الأقل رسومًا إدارية',
    balanced: 'متوازن حسب أوزان المالك'
  };

  const num = (x, lo, hi, fb) => { const n = Number(x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
  const int = (x, lo, hi, fb) => Math.round(num(x, lo, hi, fb));
  const r2 = x => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
  const txt = (x, n, fb = '') => String(x ?? fb).trim().slice(0, n);
  const phaseMax = r => Math.max(0, ...(r.customerPaymentPhases || []).map(p => Number(p.value) || 0));
  const phaseFirst = (r, k = 'customerPaymentPhases') => Number(r[k]?.[0]?.value) || 0;

  function normalizeStages(list) {
    return (Array.isArray(list) ? list : []).slice(0, 12).map(s => ({
      label: txt(s?.label, 80, 'دفعة') || 'دفعة', percent: r2(num(s?.percent, 0, 100, 0)), month: int(s?.month, 1, 60, 1)
    })).filter(s => s.percent > 0);
  }
  function normalizeProduct(p, kind) {
    const t = TEMPLATES[kind], s = p && typeof p === 'object' ? p : {};
    const stages = normalizeStages(s.stages ?? t.stages);
    return {
      enabled: s.enabled === true,
      graceMonths: int(s.graceMonths, 1, 60, t.graceMonths),
      mode: s.mode === 'capitalized' ? 'capitalized' : 'profit_only',
      stages: stages.length ? stages : normalizeStages(t.stages),
      source: txt(s.source, 200),
      template: !(p && typeof p === 'object' && Array.isArray(p.stages))
    };
  }
  function normalize(a) {
    const s = a && typeof a === 'object' ? a : {};
    const wts = s.ranking?.weights || {};
    const banks = {};
    for (const [key, b] of Object.entries(s.banks && typeof s.banks === 'object' ? s.banks : {}).slice(0, 40)) {
      if (!/^[A-Za-z0-9_-]{1,60}$/.test(key)) continue;
      banks[key] = {selfBuild: normalizeProduct(b?.selfBuild, 'selfBuild'), offPlan: normalizeProduct(b?.offPlan, 'offPlan'),
        transfer: {enabled: b?.transfer?.enabled !== false}};
      for (const k of ['selfBuild', 'offPlan']) delete banks[key][k].template;
    }
    return {
      enabled: s.enabled === true,
      ranking: {enabled: s.ranking?.enabled !== false, weights: {cost: int(wts.cost, 0, 100, 50), installment: int(wts.installment, 0, 100, 30), capacity: int(wts.capacity, 0, 100, 20)}},
      products: {enabled: s.products?.enabled !== false},
      transfer: {enabled: s.transfer?.enabled !== false},
      timeline: {enabled: s.timeline?.enabled !== false},
      note: txt(s.note, 600, 'كل الأرقام تقديرية مبنية على نسب البنوك المسجلة في المركزية وسياسات يحددها المالك، والمرجع النهائي عرض البنك الرسمي.') ||
        'كل الأرقام تقديرية مبنية على نسب البنوك المسجلة في المركزية وسياسات يحددها المالك، والمرجع النهائي عرض البنك الرسمي.',
      banks
    };
  }
  /* Product policy of one bank: the saved one, or the template (owner preview only). */
  function productPolicy(adv, key, kind) {
    const saved = adv?.banks?.[key]?.[kind];
    return saved ? {...saved, template: false} : {...normalizeProduct(null, kind), template: true};
  }

  /* ---------------- 1) recommendation by criteria (pure re-ordering of engine results) ---------------- */
  function rank(results, criterion, weights) {
    const all = Array.isArray(results) ? results : [];
    const ok = all.filter(r => !r.error && r.eligible && r.finance > 0);
    const excluded = all.filter(r => r.error || !r.eligible).map(r => ({bank: r.bank, reason: r.error || ('المبلغ المطلوب أعلى من القدرة التقديرية لهذا البنك (' + Math.round(r.capacity || 0) + ' ريال)')}));
    const same = ok.every(r => Math.abs(r.finance - ok[0].finance) < 1);
    const metric = {
      cost: r => same ? r.bankTotalWithFees : r.bankTotalWithFees / r.finance,
      installment: phaseMax, capacity: r => r.capacity, rate: r => r.rate, fees: r => r.adminFees
    };
    const lowerBetter = {cost: true, installment: true, capacity: false, rate: true, fees: true};
    const c = CRITERIA[criterion] ? criterion : (same ? 'cost' : 'capacity');
    let items;
    if (c === 'balanced') {
      const w = {cost: num(weights?.cost, 0, 100, 50), installment: num(weights?.installment, 0, 100, 30), capacity: num(weights?.capacity, 0, 100, 20)};
      const tot = w.cost + w.installment + w.capacity || 1;
      const norm = (k, r) => {
        const vals = ok.map(metric[k]), mn = Math.min(...vals), mx = Math.max(...vals), v = metric[k](r);
        if (mx - mn < 1e-9) return 1;
        return lowerBetter[k] ? (mx - v) / (mx - mn) : (v - mn) / (mx - mn);
      };
      items = ok.map(r => ({r, value: null, score: r2(100 * (w.cost * norm('cost', r) + w.installment * norm('installment', r) + w.capacity * norm('capacity', r)) / tot)}))
        .sort((a, b) => b.score - a.score);
    } else {
      items = ok.map(r => ({r, value: metric[c](r), score: null}))
        .sort((a, b) => lowerBetter[c] ? a.value - b.value : b.value - a.value);
    }
    return {criterion: c, label: CRITERIA[c], sameAmount: same, items, excluded};
  }

  /* ---------------- 2) self-build / off-plan staged disbursement ----------------
   * Disbursements follow the owner's stage table. During construction the monthly profit on the
   * amount already disbursed = disbursed × (bank rate / 1200), the same monthly rate the engine uses.
   * profit_only → the client pays it monthly; capitalized → it accrues and the engine's own
   * repayment schedule is scaled linearly to the larger principal (all engine schedules are linear
   * in the financed amount). */
  function construction(result, policy) {
    const F = Number(result?.finance) || 0;
    if (!(F > 0) || !(Number(result.months) > 0)) throw Error('لا يوجد تمويل محسوب لهذا البنك');
    const p = policy;
    const G = int(p.graceMonths, 1, 60, 12);
    const stages = normalizeStages(p.stages).sort((a, b) => a.month - b.month);
    const pct = stages.reduce((s, x) => s + x.percent, 0);
    if (Math.abs(pct - 100) > 0.01) throw Error('مجموع نسب الدفعات المرحلية يجب أن يساوي 100% (الحالي ' + r2(pct) + '%)');
    if (stages.some(s => s.month > G)) throw Error('توجد دفعة بعد نهاية فترة البناء (' + G + ' شهرًا)');
    const rm = Number(result.rate) / 1200;
    let drawn = 0, accrued = 0, paid = 0, maxPay = 0;
    const schedule = [];
    for (let m = 1; m <= G; m++) {
      const add = stages.filter(s => s.month === m).reduce((t, s) => t + F * s.percent / 100, 0);
      drawn += add;
      const profit = (drawn + (p.mode === 'capitalized' ? accrued : 0)) * rm;
      let pay = 0;
      if (p.mode === 'capitalized') accrued += profit; else { pay = profit; paid += pay; }
      maxPay = Math.max(maxPay, pay);
      schedule.push({month: m, disbursed: r2(add), drawn: r2(drawn), profit: r2(profit), pay: r2(pay)});
    }
    const factor = (F + accrued) / F;
    const bankAmort = Number(result.bankTotal) * factor;
    const support = Number(result.estimatedSupport) || 0;
    const firstBank = phaseFirst(result, 'bankPaymentPhases'), firstCustomer = phaseFirst(result);
    return {
      graceMonths: G, mode: p.mode,
      stages: stages.map(s => ({...s, amount: r2(F * s.percent / 100)})),
      schedule,
      constructionPaid: r2(paid),
      capitalizedProfit: r2(accrued),
      maxConstructionPayment: r2(maxPay),
      financeAfterConstruction: r2(F + accrued),
      firstRepayment: r2(firstBank * factor - (firstBank - firstCustomer)),
      repaymentTotal: r2(bankAmort - support),
      totalCost: r2(paid + bankAmort + (Number(result.adminFees) || 0)),
      totalMonths: G + Number(result.months),
      exceedsCapacity: F + accrued > (Number(result.capacity) || 0) + 0.01
    };
  }

  /* ---------------- 3) mortgage transfer (refinance an existing mortgage) ---------------- */
  function transfer(core, banks, scenario, cfg, input, adv) {
    const bal = num(input.balance, 0, 1e9, 0), fees = num(input.settlementFees, 0, 1e8, 0);
    const cur = num(input.currentInstallment, 0, 1e7, 0), rem = int(input.remainingMonths, 1, 360, 0), newMonths = int(input.newMonths, 1, 360, rem);
    if (!(bal > 0)) throw Error('أدخل الرصيد المتبقي للتمويل العقاري الحالي (من خطاب المديونية)');
    if (!(cur > 0) || !(rem > 0)) throw Error('أدخل القسط الحالي وعدد الأشهر المتبقية');
    const request = r2(bal + fees), oldRemaining = r2(cur * rem);
    const sc = {...scenario, propertyPrice: 0, downPayment: 0, upfrontSupport: 0, supported: false, supportMonthly: 0, supportMonths: 0,
      advanceSupport: false, requestedFinance: request, months: newMonths, currentMortgageInstallment: 0};
    const results = (banks || []).map(b => {
      if (adv?.banks?.[b.key]?.transfer?.enabled === false) return {bank: b.name, key: b.key, error: 'هذا البنك لا يقبل نقل المديونية العقارية حسب إعداد المالك'};
      try {
        const r = core.calculateBank(b, sc, cfg);
        if (!r.eligible) return {bank: b.name, key: b.key, error: 'القدرة التقديرية (' + Math.round(r.capacity) + ' ريال) أقل من مبلغ النقل'};
        const first = phaseFirst(r), total = r.bankTotalWithFees;
        return {bank: r.bank, key: r.key, rate: r.rate, months: r.months, finance: r.finance, firstInstallment: r2(first), maxInstallment: r2(phaseMax(r)),
          newTotal: r2(total), adminFees: r.adminFees, saving: r2(oldRemaining - total), monthlyDiff: r2(cur - first), phases: r.customerPaymentPhases};
      } catch (e) { return {bank: b.name, key: b.key, error: e.message}; }
    });
    const ranked = results.filter(r => !r.error).sort((a, b) => b.saving - a.saving);
    return {request, oldRemaining, currentInstallment: cur, remainingMonths: rem, newMonths, sameTerm: newMonths === rem, ranked, results};
  }

  /* ---------------- 4) payment timeline (retirement + support) ---------------- */
  function timeline(result, scenario) {
    const ret = result?.retirement || {};
    const retM = Number.isFinite(Number(ret.months)) && ret.months !== null ? Number(ret.months) : null;
    const supM = Number(scenario?.supportMonths) || 0;
    const seg = [];
    const push = (start, end, value) => {
      const tag = (retM !== null && start > retM ? 'after' : 'before') + (supM && start <= supM && (result.estimatedSupport || 0) > 0 ? '+support' : '');
      const last = seg[seg.length - 1];
      if (last && last.tag === tag && Math.abs(last.end + 1 - start) < 1) { last.end = end; last.min = Math.min(last.min, value); last.max = Math.max(last.max, value); }
      else seg.push({tag, start, end, min: value, max: value});
    };
    for (const p of result?.customerPaymentPhases || []) {
      // split a phase on the retirement and support boundaries
      const cuts = [p.start, p.end + 1];
      if (retM !== null && retM >= p.start && retM < p.end) cuts.push(retM + 1);
      if (supM && supM >= p.start && supM < p.end) cuts.push(supM + 1);
      const c = [...new Set(cuts)].sort((a, b) => a - b);
      for (let i = 0; i < c.length - 1; i++) push(c[i], c[i + 1] - 1, Number(p.value) || 0);
    }
    return {
      segments: seg.map(s => ({...s, min: r2(s.min), max: r2(s.max), afterRetirement: s.tag.startsWith('after'), withSupport: s.tag.endsWith('+support')})),
      retirementDate: ret.retirementDate || null, monthsToRetirement: retM, pension: ret.pension ?? null, pensionSource: ret.source || '',
      estimatedSupport: r2(result?.estimatedSupport || 0), months: Number(result?.months) || 0
    };
  }

  /* ------------------------------------ browser UI ------------------------------------ */
  function install(win) {
    const d = win.document;
    const core = () => win.F99MortgageCore;
    const money = x => Number(x || 0).toLocaleString('ar-SA', {maximumFractionDigits: 0}) + ' ريال';
    const el = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const isOwner = () => { try { return !!activeAccess?.record?.central && !!activeAccess?.record?.owner && !!finoCentralAdminToken; } catch (e) { return false; } };
    const stat = (host, label, value) => { const b = el('div', 'f99ma-stat'); b.append(el('small', '', label), el('b', '', value)); host.append(b); return b; };
    let last = null;

    async function meter(detail, request) {
      let entry = null;
      try { entry = win.finoCentralRestoreEntry(); } catch (x) { entry = null; }
      if (!entry?.entryToken) throw Error('جلسة الكود غير صالحة');
      const allowed = detail.compare ? 'mortgage_compare' : 'mortgage_quote';
      const rid = typeof win.f99v7CreateRequestId === 'function' ? win.f99v7CreateRequestId() : (win.crypto?.randomUUID?.() || '');
      const r = await win.finoRpc('f99v21_client_use_and_meter', {p_entry_token: entry.entryToken, p_device_id: entry.deviceId || win.finoCentralDeviceId(),
        p_service: allowed, p_request: request, p_request_id: rid}, 15000);
      if (!r?.ok || r.data?.ok === false) throw Error('الكود لا يسمح بحسبة إضافية أو انتهى الحد: ' + String(r?.data?.reason || 'خطأ اتصال'));
      return r.data;
    }

    function tabs(card, names) {
      const nav = el('div', 'f99ma-tabs'); nav.setAttribute('role', 'tablist'); card.append(nav);
      const body = el('div', 'f99ma-body'); card.append(body);
      const btns = names.map(([key, label]) => { const b = el('button', 'f99ma-tab', label); b.type = 'button'; b.dataset.tab = key; b.setAttribute('role', 'tab'); nav.append(b); return b; });
      return {nav, body, btns};
    }

    function renderRanking(host, detail, adv) {
      const results = detail.res?.results || [];
      const pick = el('label', 'f99ma-field'); pick.append(el('span', '', 'رتّب البنوك حسب'));
      const sel = el('select'); for (const [k, v] of Object.entries(CRITERIA)) { const o = el('option', '', v); o.value = k; sel.append(o); }
      pick.append(sel); host.append(pick);
      const out = el('div', 'f99ma-out'); out.setAttribute('aria-live', 'polite'); host.append(out);
      const first = rank(results, '', adv.ranking.weights); sel.value = first.criterion;
      const draw = () => {
        const R = rank(results, sel.value, adv.ranking.weights);
        out.replaceChildren();
        if (!R.sameAmount && (sel.value === 'cost')) out.append(el('p', 'f99ma-note', 'المبالغ تختلف بين البنوك (لم تحدد مبلغًا مطلوبًا)، لذلك قارنا التكلفة لكل ريال تمويل.'));
        if (!R.items.length) out.append(el('p', 'f99ma-warn', 'لا يوجد بنك مؤهل لهذا السيناريو.'));
        R.items.forEach((it, i) => {
          const r = it.r, row = el('div', 'f99ma-rank' + (i === 0 ? ' best' : ''));
          row.append(el('strong', '', (i === 0 ? '★ الأفضل: ' : (i + 1) + ') ') + r.bank));
          const g = el('div', 'f99ma-grid'); row.append(g);
          stat(g, 'التمويل', money(r.finance)); stat(g, 'الهامش السنوي', r.rate + '%'); stat(g, 'أعلى قسط', money(phaseMax(r)));
          stat(g, 'الإجمالي مع الرسوم', money(r.bankTotalWithFees)); stat(g, 'القدرة التقديرية', money(r.capacity));
          if (it.score !== null) stat(g, 'درجة التوازن', it.score + ' / 100');
          if (i === 0 && R.items[1] && it.value !== null) {
            const diff = Math.abs(R.items[1].value - it.value);
            const unit = sel.value === 'rate' ? r2(diff) + ' نقطة مئوية' : sel.value === 'cost' && !R.sameAmount ? r2(diff * 1000) + ' ريال لكل 1000 ريال' : money(diff);
            row.append(el('p', 'f99ma-note', 'الفرق عن التالي (' + R.items[1].r.bank + '): ' + unit));
          }
          out.append(row);
        });
        if (R.excluded.length) {
          const ex = el('details', 'f99ma-ex'); ex.append(el('summary', '', 'بنوك مستبعدة وسبب الاستبعاد (' + R.excluded.length + ')'));
          R.excluded.forEach(x => ex.append(el('p', '', x.bank + ': ' + x.reason))); out.append(ex);
        }
      };
      sel.onchange = draw; draw();
    }

    function renderProducts(host, detail, adv, owner) {
      const usable = (detail.res?.results || []).filter(r => !r.error && r.finance > 0);
      const kindL = el('label', 'f99ma-field'); kindL.append(el('span', '', 'نوع العقار'));
      const kind = el('select'); for (const [k, v] of Object.entries(PRODUCT_LABEL)) { const o = el('option', '', v); o.value = k; kind.append(o); }
      kindL.append(kind); host.append(kindL);
      const out = el('div', 'f99ma-out'); out.setAttribute('aria-live', 'polite'); host.append(out);
      const draw = () => {
        out.replaceChildren();
        const k = kind.value; let shown = 0;
        const rows = [];
        for (const r of usable) {
          const pol = productPolicy(adv, r.key, k);
          if (!pol.enabled && !owner) continue;
          let c; try { c = construction(r, pol); } catch (e) { rows.push({r, err: e.message, pol}); continue; }
          rows.push({r, c, pol});
        }
        rows.sort((a, b) => (a.c ? a.c.totalCost : 1e18) - (b.c ? b.c.totalCost : 1e18));
        for (const {r, c, pol, err} of rows) {
          shown++;
          const box = el('article', 'f99ma-prod');
          box.append(el('strong', '', r.bank + ' — ' + PRODUCT_LABEL[k]));
          if (!pol.enabled) box.append(el('p', 'f99ma-owner', pol.template ? 'معاينة للمالك: قالب افتراضي غير معتمد لهذا البنك. عدّله وفعّله من «منتجات العقاري المتقدمة».' : 'معاينة للمالك: المنتج غير مفعّل لهذا البنك.'));
          if (err) { box.append(el('p', 'f99ma-warn', err)); out.append(box); continue; }
          box.append(el('p', 'f99ma-note', MODE_LABEL[c.mode] + (pol.source ? ' — المصدر: ' + pol.source : '')));
          const g = el('div', 'f99ma-grid'); box.append(g);
          stat(g, 'فترة البناء', c.graceMonths + ' شهرًا');
          if (c.mode === 'profit_only') { stat(g, 'أعلى دفعة شهرية أثناء البناء', money(c.maxConstructionPayment)); stat(g, 'مجموع ما يدفعه أثناء البناء', money(c.constructionPaid)); }
          else stat(g, 'أرباح مؤجلة تضاف للأصل', money(c.capitalizedProfit));
          stat(g, 'أول قسط بعد الاستلام', money(c.firstRepayment));
          stat(g, 'إجمالي التكلفة مع الرسوم', money(c.totalCost));
          stat(g, 'المدة الكلية', c.totalMonths + ' شهرًا');
          const t = el('div', 'f99ma-stages'); box.append(t);
          c.stages.forEach(s => { const row = el('div', 'f99ma-stage'); row.append(el('span', '', 'الشهر ' + s.month + ': ' + s.label), el('b', '', s.percent + '% = ' + money(s.amount))); t.append(row); });
          const maxT = Number((detail.cfg?.maxMonths || {})[detail.o?.supported ? 'supported' : 'ordinary']) || (detail.o?.supported ? 300 : 360);
          if (c.totalMonths > maxT) box.append(el('p', 'f99ma-warn', 'فترة البناء + مدة السداد (' + c.totalMonths + ' شهرًا) تتجاوز سقف ' + maxT + ' شهرًا؛ قد يطلب البنك تقليص مدة السداد.'));
          if (c.exceedsCapacity) box.append(el('p', 'f99ma-warn', 'إضافة الأرباح المؤجلة ترفع التمويل فوق القدرة التقديرية؛ قد يطلب البنك دفعة أعلى.'));
          out.append(box);
        }
        if (!shown) out.append(el('p', 'f99ma-note', 'لا يوجد بنك مفعّل لهذا المنتج حاليًا.'));
      };
      kind.onchange = draw; draw();
    }

    function renderTransfer(host, detail, adv) {
      host.append(el('p', 'f99ma-note', 'قارن قسطك الحالي بنقل التمويل العقاري لبنك آخر. أدخل الأرقام من خطاب المديونية/المخالصة من بنكك الحالي. الحسبة لا تفترض استمرار الدعم السكني بعد النقل؛ ذلك يحتاج موافقة الصندوق والبنك.'));
      const g = el('div', 'f99ma-form'); host.append(g);
      const field = (label, v) => { const l = el('label', 'f99ma-field'); l.append(el('span', '', label)); const i = el('input'); i.type = 'number'; i.inputMode = 'decimal'; i.min = '0'; if (v) i.value = String(v); l.append(i); g.append(l); return i; };
      const bal = field('الرصيد المتبقي (أصل التمويل)', ''), fees = field('رسوم السداد المبكر في البنك الحالي (من الخطاب)', ''),
        cur = field('قسطك الحالي الشهري', ''), rem = field('الأشهر المتبقية', ''), nm = field('مدة التمويل الجديد بالأشهر', '');
      const go = el('button', 'f99ma-btn', 'احسب جدوى النقل'); go.type = 'button'; host.append(go);
      const out = el('div', 'f99ma-out'); out.setAttribute('aria-live', 'polite'); host.append(out);
      go.onclick = async () => {
        out.replaceChildren(el('p', 'f99ma-note', 'جاري الحساب...')); go.disabled = true;
        try {
          const banks = Array.isArray(detail.banks) ? detail.banks : [];
          if (!banks.length) throw Error('أعد تشغيل الحسبة أولًا لتحديد البنوك');
          const input = {balance: bal.value, settlementFees: fees.value, currentInstallment: cur.value, remainingMonths: rem.value, newMonths: nm.value || rem.value};
          const T = transfer(core(), banks, detail.o, detail.cfg, input, adv);
          if (detail.client) await meter(detail, {months: T.newMonths, supported: false, requestedFinance: T.request, bankKeys: banks.map(b => b.key)});
          out.replaceChildren();
          const s = el('div', 'f99ma-grid'); out.append(s);
          stat(s, 'مبلغ النقل (الرصيد + الرسوم)', money(T.request)); stat(s, 'المتبقي عليك لو بقيت', money(T.oldRemaining));
          if (!T.sameTerm) out.append(el('p', 'f99ma-warn', 'المدة الجديدة تختلف عن المتبقية؛ التوفير هنا ليس مقارنة مماثلة بالكامل.'));
          if (!T.ranked.length) out.append(el('p', 'f99ma-warn', 'لا يوجد بنك يغطي مبلغ النقل وفق بياناتك.'));
          T.ranked.forEach((x, i) => {
            const row = el('div', 'f99ma-rank' + (i === 0 && x.saving > 0 ? ' best' : ''));
            row.append(el('strong', '', (i === 0 && x.saving > 0 ? '★ الأوفر: ' : '') + x.bank));
            const gg = el('div', 'f99ma-grid'); row.append(gg);
            stat(gg, 'القسط الجديد', money(x.firstInstallment)); stat(gg, 'الهامش', x.rate + '%');
            stat(gg, 'الإجمالي الجديد مع الرسوم', money(x.newTotal));
            stat(gg, x.saving >= 0 ? 'التوفير التقديري' : 'تكلفة إضافية', money(Math.abs(x.saving)));
            stat(gg, x.monthlyDiff >= 0 ? 'ينقص قسطك' : 'يزيد قسطك', money(Math.abs(x.monthlyDiff)));
            out.append(row);
          });
          const bad = T.results.filter(r => r.error);
          if (bad.length) { const ex = el('details', 'f99ma-ex'); ex.append(el('summary', '', 'بنوك لا تناسب النقل (' + bad.length + ')')); bad.forEach(x => ex.append(el('p', '', x.bank + ': ' + x.error))); out.append(ex); }
        } catch (e) { out.replaceChildren(el('p', 'f99ma-warn', e.message)); }
        finally { go.disabled = false; }
      };
    }

    function renderTimeline(host, detail) {
      const usable = (detail.res?.results || []).filter(r => !r.error && r.finance > 0);
      const l = el('label', 'f99ma-field'); l.append(el('span', '', 'البنك')); const sel = el('select');
      usable.forEach((r, i) => { const o = el('option', '', r.bank); o.value = String(i); sel.append(o); }); l.append(sel); host.append(l);
      const out = el('div', 'f99ma-out'); host.append(out);
      const draw = () => {
        const r = usable[Number(sel.value) || 0]; if (!r) return;
        const T = timeline(r, detail.o); out.replaceChildren();
        const g = el('div', 'f99ma-grid'); out.append(g);
        if (T.retirementDate) stat(g, 'تاريخ التقاعد التقديري', T.retirementDate);
        if (T.monthsToRetirement !== null) stat(g, 'أقساط قبل التقاعد', Math.min(T.monthsToRetirement, T.months) + ' شهرًا');
        if (T.pension) stat(g, 'المعاش المعتمد في الحسبة', money(T.pension) + (T.pensionSource ? ' (' + T.pensionSource + ')' : ''));
        if (T.estimatedSupport) stat(g, 'الدعم السكني المقدّر', money(T.estimatedSupport));
        const list = el('div', 'f99ma-stages'); out.append(list);
        T.segments.forEach(s => {
          const lab = (s.afterRetirement ? 'بعد التقاعد' : 'قبل التقاعد') + (s.withSupport ? ' + الدعم' : '');
          const v = Math.abs(s.max - s.min) < 1 ? money(s.max) : money(s.min) + ' إلى ' + money(s.max);
          const row = el('div', 'f99ma-stage' + (s.afterRetirement ? ' after' : '')); row.append(el('span', '', 'الأشهر ' + s.start + '–' + s.end + ' • ' + lab), el('b', '', v)); list.append(row);
        });
      };
      sel.onchange = draw; draw();
    }

    function renderCard(detail) {
      const root = d.getElementById('f99m-results'); if (!root) return;
      d.getElementById('f99ma-card')?.remove();
      const owner = !detail.client && isOwner();
      const adv = normalize(detail.cfg?.advanced);
      if (!adv.enabled && !owner) return;
      if (!(detail.res?.results || []).some(r => !r.error && r.finance > 0) && !(detail.res?.results || []).length) return;
      const card = el('article', 'f99m-card f99ma-card'); card.id = 'f99ma-card';
      card.append(el('h3', '', 'أدوات العقاري المتقدمة'));
      if (!adv.enabled) card.append(el('p', 'f99ma-owner', 'معاينة للمالك فقط: مخفية عن العملاء حتى تفعّلها من «منتجات العقاري المتقدمة».'));
      card.append(el('p', 'f99ma-note', adv.note));
      const names = [];
      if (adv.ranking.enabled || owner) names.push(['rank', 'ترشيح أفضل البنوك']);
      if (adv.products.enabled || owner) names.push(['products', 'بناء ذاتي / على الخارطة']);
      if (adv.transfer.enabled || owner) names.push(['transfer', 'نقل التمويل العقاري']);
      if (adv.timeline.enabled || owner) names.push(['timeline', 'التقاعد والدعم']);
      if (!names.length) return;
      const T = tabs(card, names);
      const show = key => {
        T.btns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === key)));
        T.body.replaceChildren();
        try {
          if (key === 'rank') renderRanking(T.body, detail, adv);
          else if (key === 'products') renderProducts(T.body, detail, adv, owner);
          else if (key === 'transfer') renderTransfer(T.body, detail, adv);
          else renderTimeline(T.body, detail);
        } catch (e) { T.body.append(el('p', 'f99ma-warn', 'تعذر عرض هذا القسم: ' + e.message)); }
      };
      T.btns.forEach(b => { b.onclick = () => show(b.dataset.tab); });
      show(names[0][0]);
      const anchor = d.getElementById('f99me-card') || root.querySelector('.f99m-actions');
      if (anchor) anchor.before(card); else root.append(card);
    }

    win.addEventListener('f99m:result', ev => {
      last = ev.detail || null;
      try { renderCard(last); } catch (e) { /* never break the original result */ }
    });

    /* ------------------------------ owner editor ------------------------------ */
    async function admin(name, args) {
      if (!isOwner() || typeof win.finoCentralAdminCall !== 'function') throw Error('جلسة المالك مطلوبة');
      const r = await win.finoCentralAdminCall(name, args || {});
      if (!r?.ok || r.data?.ok === false) throw Error(String(r?.data?.reason || r?.error?.message || 'تعذر الاتصال بالمركزية'));
      return r.data;
    }
    const stagesToText = st => st.map(s => s.label + ' | ' + s.percent + ' | ' + s.month).join('\n');
    const textToStages = t => String(t || '').split('\n').map(x => x.split('|').map(y => y.trim())).filter(x => x[0]).map(([label, percent, month]) => ({label, percent: Number(percent), month: Number(month)}));

    async function openOwner() {
      if (!isOwner()) return;
      d.getElementById('f99ma-owner')?.remove();
      const shade = el('div', 'f99ma-shade'); shade.id = 'f99ma-owner';
      shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'منتجات العقاري المتقدمة');
      const box = el('main', 'f99ma-sheet'); shade.append(box);
      const head = el('header', 'f99ma-head'); head.append(el('strong', '', 'منتجات العقاري المتقدمة'));
      const close = el('button', 'f99ma-btn secondary', 'إغلاق دون حفظ'); close.type = 'button'; close.onclick = () => shade.remove(); head.append(close); box.append(head);
      const msg = el('p', 'f99ma-msg', 'جاري قراءة إعدادات العقاري من المركزية...'); msg.setAttribute('role', 'status'); box.append(msg);
      d.body.append(shade);
      let state;
      try { state = await admin('f99m_admin_state'); } catch (e) { msg.textContent = 'تعذر القراءة: ' + e.message; return; }
      const settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      const loadedVersion = settings.version ?? null;
      const a = normalize(settings.advanced);
      msg.textContent = 'هذه الأدوات تضاف لنتيجة العقاري ولا تغير نسب البنوك أو معادلات الحسبة. نسب الدفعات المرحلية وفترات البناء سياسات تكتبها أنت لكل بنك حسب عرضه الرسمي؛ القوالب المعروضة أمثلة غير معتمدة.';
      const form = el('form', 'f99ma-form'); box.append(form);
      const check = (host, label, on) => { const l = el('label', 'f99ma-check'); const i = el('input'); i.type = 'checkbox'; i.checked = on; l.append(i, el('span', '', label)); host.append(l); return i; };
      const field = (host, label, value, min, max) => { const l = el('label', 'f99ma-field'); l.append(el('span', '', label)); const i = el('input'); i.type = 'number'; i.value = String(value); i.min = String(min); i.max = String(max); i.inputMode = 'numeric'; l.append(i); host.append(l); return i; };
      const on = check(form, 'إظهار أدوات العقاري المتقدمة للعملاء', a.enabled);
      const fs = el('fieldset', 'f99ma-set'); fs.append(el('legend', '', 'الأقسام الظاهرة')); form.append(fs);
      const onRank = check(fs, 'ترشيح أفضل البنوك', a.ranking.enabled), onProd = check(fs, 'البناء الذاتي والبيع على الخارطة', a.products.enabled),
        onTr = check(fs, 'نقل التمويل العقاري', a.transfer.enabled), onTl = check(fs, 'التقاعد والدعم (الخط الزمني)', a.timeline.enabled);
      const ws = el('fieldset', 'f99ma-set'); ws.append(el('legend', '', 'أوزان الترشيح المتوازن')); form.append(ws);
      const wc = field(ws, 'التكلفة الإجمالية', a.ranking.weights.cost, 0, 100), wi = field(ws, 'القسط الشهري', a.ranking.weights.installment, 0, 100), wk = field(ws, 'القدرة التمويلية', a.ranking.weights.capacity, 0, 100);
      const noteL = el('label', 'f99ma-field'); noteL.append(el('span', '', 'نص التوضيح للعميل')); const note = el('textarea'); note.rows = 2; note.maxLength = 600; note.value = a.note; noteL.append(note); form.append(noteL);
      const editors = [];
      for (const b of (Array.isArray(settings.banks) ? settings.banks : []).filter(x => x && x.key)) {
        const det = el('details', 'f99ma-bank'); det.dataset.key = b.key; det.append(el('summary', '', (b.name || b.key) + (b.enabled === false ? ' (غير مفعل)' : ''))); form.append(det);
        const rec = {key: b.key};
        rec.transfer = check(det, 'يقبل نقل التمويل العقاري', a.banks[b.key]?.transfer?.enabled !== false);
        for (const k of ['selfBuild', 'offPlan']) {
          const pol = productPolicy(a, b.key, k);
          const sub = el('fieldset', 'f99ma-set'); sub.append(el('legend', '', PRODUCT_LABEL[k])); det.append(sub);
          const en = check(sub, 'مفعّل لهذا البنك', pol.enabled);
          const g = field(sub, 'فترة البناء/التسليم بالأشهر', pol.graceMonths, 1, 60);
          const ml = el('label', 'f99ma-field'); ml.append(el('span', '', 'الربح أثناء البناء')); const mode = el('select');
          for (const [mk, mv] of Object.entries(MODE_LABEL)) { const o = el('option', '', mv); o.value = mk; mode.append(o); } mode.value = pol.mode; ml.append(mode); sub.append(ml);
          const sl = el('label', 'f99ma-field'); sl.append(el('span', '', 'الدفعات: سطر لكل دفعة «الوصف | النسبة% | الشهر»')); const st = el('textarea'); st.rows = 4; st.dir = 'rtl'; st.value = stagesToText(pol.stages); sl.append(st); sub.append(sl);
          const srcL = el('label', 'f99ma-field'); srcL.append(el('span', '', 'مصدر السياسة (عرض البنك/التاريخ)')); const src = el('input'); src.type = 'text'; src.maxLength = 200; src.value = pol.source || ''; srcL.append(src); sub.append(srcL);
          rec[k] = {en, g, mode, st, src};
        }
        editors.push(rec);
      }
      const save = el('button', 'f99ma-btn', 'حفظ واعتماد في المركزية'); save.type = 'submit'; form.append(save);
      form.onsubmit = async ev => {
        ev.preventDefault();
        save.disabled = true; msg.textContent = 'جاري التحقق والحفظ...';
        try {
          const banks = {};
          for (const r of editors) {
            banks[r.key] = {transfer: {enabled: r.transfer.checked}};
            for (const k of ['selfBuild', 'offPlan']) {
              const stages = textToStages(r[k].st.value);
              const sum = stages.reduce((s, x) => s + (Number(x.percent) || 0), 0);
              if (r[k].en.checked && Math.abs(sum - 100) > 0.01) throw Error('مجموع نسب ' + PRODUCT_LABEL[k] + ' لبنك ' + r.key + ' = ' + r2(sum) + '% ويجب أن يساوي 100%');
              if (r[k].en.checked && stages.some(s => s.month > Number(r[k].g.value))) throw Error('في ' + PRODUCT_LABEL[k] + ' لبنك ' + r.key + ' دفعة بعد نهاية فترة البناء');
              if (r[k].en.checked && !r[k].src.value.trim()) throw Error('اكتب مصدر سياسة ' + PRODUCT_LABEL[k] + ' لبنك ' + r.key + ' قبل تفعيلها (لا نعتمد سياسة بلا مصدر)');
              banks[r.key][k] = {enabled: r[k].en.checked, graceMonths: Number(r[k].g.value), mode: r[k].mode.value, stages, source: r[k].src.value};
            }
          }
          const next = normalize({enabled: on.checked, ranking: {enabled: onRank.checked, weights: {cost: wc.value, installment: wi.value, capacity: wk.value}},
            products: {enabled: onProd.checked}, transfer: {enabled: onTr.checked}, timeline: {enabled: onTl.checked}, note: note.value, banks});
          const fresh = await admin('f99m_admin_state');
          const cur = fresh.settings && typeof fresh.settings === 'object' ? fresh.settings : {};
          if ((cur.version ?? null) !== loadedVersion) throw Error('تغيرت إعدادات العقاري من جلسة أخرى؛ أغلق النافذة وافتحها من جديد قبل الحفظ.');
          const version = Date.now();
          const r = await win.finoCentralAdminCall('fino_admin_upsert_setting', {p_setting_key: 'f99m_mortgage', p_value: {...cur, advanced: next, version}});
          if (!r?.ok || r.data?.ok === false) throw Error('رفضت المركزية الحفظ');
          const check2 = await admin('f99m_admin_state');
          if (check2.settings?.version !== version || JSON.stringify(normalize(check2.settings?.advanced)) !== JSON.stringify(next)) throw Error('الحفظ لم يتأكد من المركزية؛ أعد القراءة قبل التكرار.');
          msg.textContent = 'تم الحفظ والتأكد من المركزية. ' + (next.enabled ? 'الأدوات ظاهرة للعملاء الآن.' : 'الأدوات مخفية عن العملاء (معاينة للمالك فقط).');
          shade.dataset.saved = String(version);
        } catch (e) { msg.textContent = 'لم يتم الحفظ: ' + e.message; }
        finally { save.disabled = false; }
      };
    }
    return {openOwner};
  }

  const api = {TEMPLATES, CRITERIA, normalize, normalizeProduct, productPolicy, rank, construction, transfer, timeline, install: null};
  api.install = win => { const ui = install(win); api.openOwner = ui.openOwner; };
  return api;
});
