/* FINO99 — Mortgage early settlement (additive layer on top of F99MortgageCore results).
 * - Does NOT change any original mortgage formula, rate, bank or package.
 * - Uses only the bank result already computed by F99MortgageCore (finance, rate, method,
 *   months, bankPaymentPhases) and an owner-editable policy stored centrally inside the
 *   existing 'f99m_mortgage' setting under the key `earlySettlement`.
 * - Clients see it only when the owner enables it; the owner always sees a labelled preview.
 * - Every figure is an estimate; the bank's financing agreement prevails. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.F99MEarly = api; api.install(root); }
})(typeof window !== 'undefined' ? window : null, function (w) {
  'use strict';

  const DEFAULT_POLICY = Object.freeze({
    enabled: false,
    warnPaidMonths: 24,
    minProfitMonths: 24,
    compensationProfitMonths: 3,
    fixedFee: 0,
    note: 'سياسة السداد المبكر تقديرية يحددها المالك، والمرجع النهائي اتفاقية التمويل وجدول البنك الرسمي.'
  });
  const MILESTONES = [12, 24, 36, 60, 120, 180, 240];

  const num = (x, lo, hi, fallback) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  };
  const int = (x, lo, hi, fallback) => Math.round(num(x, lo, hi, fallback));
  const round2 = x => Math.round((Number(x) + Number.EPSILON) * 100) / 100;

  function normalizePolicy(p) {
    const s = p && typeof p === 'object' ? p : {};
    return {
      enabled: s.enabled === true,
      warnPaidMonths: int(s.warnPaidMonths, 0, 120, DEFAULT_POLICY.warnPaidMonths),
      minProfitMonths: int(s.minProfitMonths, 0, 120, DEFAULT_POLICY.minProfitMonths),
      compensationProfitMonths: int(s.compensationProfitMonths, 0, 24, DEFAULT_POLICY.compensationProfitMonths),
      fixedFee: round2(num(s.fixedFee, 0, 1000000, 0)),
      note: String(s.note ?? DEFAULT_POLICY.note).trim().slice(0, 600) || DEFAULT_POLICY.note
    };
  }

  function expandPhases(phases, months) {
    const out = new Array(months).fill(0);
    for (const ph of Array.isArray(phases) ? phases : []) {
      const start = Math.max(1, Number(ph.start) || 1), end = Math.min(months, Number(ph.end) || start);
      for (let i = start; i <= end; i++) out[i - 1] = Number(ph.value) || 0;
    }
    return out;
  }

  /* Per-month profit and outstanding principal reconstructed from the bank's own schedule.
   * reducing: balance(i) = balance(i-1) * (1 + rate/1200) - payment(i)   (same rm as the core)
   * flat:     total profit spread evenly over the term (straight-line estimate). */
  function schedule(result) {
    const months = int(result?.months, 1, 480, 0);
    const principal = Number(result?.finance) || 0;
    if (!months || principal <= 0) throw Error('NO_SCHEDULE');
    const payments = expandPhases(result.bankPaymentPhases, months);
    if (payments.some(x => !(x > 0))) throw Error('NO_SCHEDULE');
    const profit = [], balance = [];
    if (result.method === 'reducing') {
      const rm = Number(result.rate) / 1200;
      let bal = principal;
      for (let i = 0; i < months; i++) {
        const p = bal * rm; profit.push(p); bal = bal + p - payments[i]; balance.push(Math.max(0, bal));
      }
    } else {
      const total = payments.reduce((a, b) => a + b, 0) - principal;
      for (let i = 0; i < months; i++) {
        profit.push(total / months); balance.push(Math.max(0, principal - principal * (i + 1) / months));
      }
    }
    return {months, principal, payments, profit, balance};
  }

  const sum = (arr, from, to) => { let t = 0; for (let i = Math.max(0, from); i < Math.min(arr.length, to); i++) t += arr[i]; return t; };

  /* paidMonths = number of installments already paid before settling in full. */
  function estimate(result, paidMonths, policyInput) {
    const policy = normalizePolicy(policyInput);
    const s = schedule(result);
    const k = int(paidMonths, 1, s.months - 1, Math.min(60, s.months - 1));
    const outstanding = s.balance[k - 1];
    const minProfit = k < policy.minProfitMonths ? sum(s.profit, k, policy.minProfitMonths) : 0;
    const compStart = Math.max(k, policy.minProfitMonths);
    const compensation = sum(s.profit, compStart, compStart + policy.compensationProfitMonths);
    const settlement = outstanding + minProfit + compensation + policy.fixedFee;
    const remainingScheduled = sum(s.payments, k, s.months);
    return {
      paidMonths: k, months: s.months,
      paidSoFar: round2(sum(s.payments, 0, k)),
      outstandingPrincipal: round2(outstanding),
      minProfitCharge: round2(minProfit),
      compensation: round2(compensation),
      fixedFee: policy.fixedFee,
      settlementAmount: round2(settlement),
      remainingScheduled: round2(remainingScheduled),
      estimatedSaving: round2(remainingScheduled - settlement),
      warning: k < policy.warnPaidMonths,
      policy
    };
  }

  function milestones(result, policy) {
    const months = int(result?.months, 1, 480, 0);
    return MILESTONES.filter(m => m < months).map(m => estimate(result, m, policy));
  }

  /* ------------------------------ browser UI ------------------------------ */
  function install(win) {
    const d = win.document;
    let last = null;
    const money = x => Number(x || 0).toLocaleString('ar-SA', {maximumFractionDigits: 0}) + ' ريال';
    const el = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const isOwner = () => { try { return !!activeAccess?.record?.central && !!activeAccess?.record?.owner && !!finoCentralAdminToken; } catch (e) { return false; } };

    function stat(host, label, value) {
      const b = el('div', 'f99me-stat'); b.append(el('small', '', label), el('b', '', value)); host.append(b);
    }

    function renderCard(detail) {
      const root = d.getElementById('f99m-results');
      if (!root) return;
      d.getElementById('f99me-card')?.remove();
      const owner = !detail.client && isOwner();
      const policy = normalizePolicy(detail.cfg?.earlySettlement);
      if (!policy.enabled && !owner) return;
      const usable = (detail.res?.results || []).filter(r => !r.error && r.finance > 0 && r.months > 1);
      if (!usable.length) return;
      const card = el('article', 'f99m-card f99me-card'); card.id = 'f99me-card';
      card.append(el('h3', '', 'السداد المبكر — كم يصير المبلغ لو سددت بدري؟'));
      if (!policy.enabled) card.append(el('p', 'f99me-owner', 'معاينة للمالك فقط: هذه الميزة مخفية عن العملاء حتى تفعّلها من «سياسة السداد المبكر للعقاري».'));
      card.append(el('p', 'f99m-note', policy.note));
      const controls = el('div', 'f99me-controls');
      const bankLabel = el('label', 'f99me-field'); bankLabel.append(el('span', '', 'البنك'));
      const bank = el('select'); usable.forEach((r, i) => { const o = el('option', '', r.bank); o.value = String(i); bank.append(o); });
      bankLabel.append(bank);
      const monthLabel = el('label', 'f99me-field'); monthLabel.append(el('span', '', 'عدد الأقساط المدفوعة قبل السداد'));
      const month = el('input'); month.type = 'number'; month.min = '1'; month.inputMode = 'numeric';
      monthLabel.append(month);
      const range = el('input'); range.type = 'range'; range.min = '1'; range.setAttribute('aria-label', 'شهر السداد المبكر');
      controls.append(bankLabel, monthLabel, range); card.append(controls);
      const out = el('div', 'f99me-out'); out.setAttribute('role', 'status'); out.setAttribute('aria-live', 'polite'); card.append(out);
      const table = el('div', 'f99me-table'); card.append(table);
      card.append(el('p', 'f99m-note', 'التقدير مبني على جدول أقساط البنك المحسوب أعلاه. لا يشمل رسوم التقييم والتأمين والضرائب، ولا يغني عن خطاب المخالصة الرسمي من البنك.'));

      function draw() {
        const r = usable[Number(bank.value) || 0];
        month.max = String(r.months - 1); range.max = String(r.months - 1);
        let k = int(month.value, 1, r.months - 1, Math.min(60, r.months - 1));
        month.value = String(k); range.value = String(k);
        let e;
        try { e = estimate(r, k, policy); } catch (err) { out.replaceChildren(el('p', 'f99m-alert', 'تعذر بناء جدول السداد لهذا البنك.')); table.replaceChildren(); return; }
        out.replaceChildren();
        const grid = el('div', 'f99me-grid'); out.append(grid);
        stat(grid, 'المبلغ التقديري للسداد الكامل', money(e.settlementAmount));
        stat(grid, 'أصل التمويل المتبقي', money(e.outstandingPrincipal));
        stat(grid, 'ربح الحد الأدنى (' + e.policy.minProfitMonths + ' شهرًا من بداية التمويل)', money(e.minProfitCharge));
        stat(grid, 'رسوم إدارية = ربح ' + e.policy.compensationProfitMonths + ' أشهر قادمة', money(e.compensation));
        if (e.fixedFee) stat(grid, 'رسوم ثابتة يحددها المالك', money(e.fixedFee));
        stat(grid, 'لو كملت الأقساط للنهاية', money(e.remainingScheduled));
        stat(grid, e.estimatedSaving >= 0 ? 'التوفير التقديري' : 'تكلفة إضافية تقديرية', money(Math.abs(e.estimatedSaving)));
        if (e.warning) out.append(el('p', 'f99me-warn', 'تنبيه: السداد قبل إكمال ' + e.policy.warnPaidMonths + ' قسطًا مدفوعًا قد يكلفك ربحًا إضافيًا حسب سياسة البنك. راجع البنك قبل القرار.'));
        table.replaceChildren(el('strong', '', 'جدول مقارنة سريع'));
        const rows = milestones(r, policy);
        const list = el('div', 'f99me-rows');
        for (const m of rows) {
          const row = el('button', 'f99me-row'); row.type = 'button';
          row.append(el('span', '', 'بعد ' + m.paidMonths + ' قسط'), el('b', '', money(m.settlementAmount)),
            el('small', '', (m.estimatedSaving >= 0 ? 'توفير ' : 'زيادة ') + money(Math.abs(m.estimatedSaving))));
          row.onclick = () => { month.value = String(m.paidMonths); draw(); };
          list.append(row);
        }
        table.append(list);
      }
      bank.onchange = draw; month.onchange = draw; range.oninput = () => { month.value = range.value; draw(); };
      draw();
      const actions = root.querySelector('.f99m-actions');
      if (actions) actions.before(card); else root.append(card);
    }

    win.addEventListener('f99m:result', ev => { last = ev.detail || null; try { renderCard(last); } catch (e) { /* never break the original result */ } });

    /* ---------------------------- owner policy editor ---------------------------- */
    async function admin(name, args) {
      if (!isOwner() || typeof win.finoCentralAdminCall !== 'function') throw Error('جلسة المالك مطلوبة');
      const r = await win.finoCentralAdminCall(name, args || {});
      if (!r?.ok || r.data?.ok === false) throw Error(String(r?.data?.reason || r?.error?.message || 'تعذر الاتصال بالمركزية'));
      return r.data;
    }

    async function openOwner() {
      if (!isOwner()) return;
      d.getElementById('f99me-owner')?.remove();
      const shade = el('div', 'f99me-shade'); shade.id = 'f99me-owner';
      shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'سياسة السداد المبكر للعقاري');
      const box = el('main', 'f99me-sheet'); shade.append(box);
      const head = el('header', 'f99me-head'); head.append(el('strong', '', 'سياسة السداد المبكر للعقاري'));
      const close = el('button', 'f99me-btn secondary', 'إغلاق دون حفظ'); close.type = 'button'; close.onclick = () => shade.remove(); head.append(close);
      box.append(head);
      const msg = el('p', 'f99me-msg', 'جاري قراءة إعدادات العقاري من المركزية...'); msg.setAttribute('role', 'status'); box.append(msg);
      d.body.append(shade);
      let state;
      try { state = await admin('f99m_admin_state'); } catch (e) { msg.textContent = 'تعذر القراءة: ' + e.message; return; }
      const settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      const loadedVersion = settings.version ?? null;
      const p = normalizePolicy(settings.earlySettlement);
      msg.textContent = 'هذه السياسة تضاف لحسبة العقاري فقط ولا تغير نسب البنوك أو المعادلات. الافتراضي الشائع: تنبيه قبل إكمال سنتين (24 قسطًا)، وأرباح سنتين حدًا أدنى للبنك، ورسوم إدارية = ربح 3 أشهر. كل القيم قابلة للتعديل، والإظهار للعملاء بيدك.';
      const form = el('form', 'f99me-form'); box.append(form);
      const check = (label, on) => { const l = el('label', 'f99me-check'); const i = el('input'); i.type = 'checkbox'; i.checked = on; l.append(i, el('span', '', label)); form.append(l); return i; };
      const field = (label, value, min, max, step) => { const l = el('label', 'f99me-field'); l.append(el('span', '', label)); const i = el('input'); i.type = 'number'; i.value = String(value); i.min = String(min); i.max = String(max); i.step = String(step || 1); i.inputMode = 'decimal'; l.append(i); form.append(l); return i; };
      const enabled = check('إظهار السداد المبكر للعملاء في نتيجة العقاري', p.enabled);
      const warn = field('التنبيه إذا كان عدد الأقساط المدفوعة أقل من', p.warnPaidMonths, 0, 120);
      const minProfit = field('أرباح الحد الأدنى للبنك (بالأشهر من بداية التمويل، سنتان = 24)', p.minProfitMonths, 0, 120);
      const comp = field('الرسوم الإدارية للسداد المبكر = ربح كم شهر قادم', p.compensationProfitMonths, 0, 24);
      const fee = field('رسوم ثابتة إضافية (ريال، اختياري)', p.fixedFee, 0, 1000000, 1);
      const noteL = el('label', 'f99me-field'); noteL.append(el('span', '', 'نص التوضيح للعميل')); const note = el('textarea'); note.rows = 3; note.maxLength = 600; note.value = p.note; noteL.append(note); form.append(noteL);
      const save = el('button', 'f99me-btn', 'حفظ واعتماد السياسة في المركزية'); save.type = 'submit'; form.append(save);
      form.onsubmit = async ev => {
        ev.preventDefault();
        const next = normalizePolicy({enabled: enabled.checked, warnPaidMonths: warn.value, minProfitMonths: minProfit.value,
          compensationProfitMonths: comp.value, fixedFee: fee.value, note: note.value});
        save.disabled = true; msg.textContent = 'جاري الحفظ والتحقق...';
        try {
          const fresh = await admin('f99m_admin_state');
          const cur = fresh.settings && typeof fresh.settings === 'object' ? fresh.settings : {};
          if ((cur.version ?? null) !== loadedVersion) throw Error('تغيرت إعدادات العقاري من جلسة أخرى؛ أغلق النافذة وافتحها من جديد قبل الحفظ.');
          const version = Date.now();
          const value = {...cur, earlySettlement: next, version};
          const r = await win.finoCentralAdminCall('fino_admin_upsert_setting', {p_setting_key: 'f99m_mortgage', p_value: value});
          if (!r?.ok || r.data?.ok === false) throw Error('رفضت المركزية الحفظ');
          const check2 = await admin('f99m_admin_state');
          const saved = normalizePolicy(check2.settings?.earlySettlement);
          if (check2.settings?.version !== version || JSON.stringify(saved) !== JSON.stringify(next)) throw Error('الحفظ لم يتأكد من المركزية؛ أعد القراءة قبل التكرار.');
          msg.textContent = 'تم الحفظ والتأكد من المركزية. ' + (next.enabled ? 'الميزة ظاهرة للعملاء الآن.' : 'الميزة مخفية عن العملاء (معاينة للمالك فقط).');
          shade.dataset.saved = String(version);
        } catch (e) { msg.textContent = 'لم يتم الحفظ: ' + e.message; }
        finally { save.disabled = false; }
      };
    }

    return {openOwner};
  }

  const api = {DEFAULT_POLICY, normalizePolicy, schedule, estimate, milestones, install: null};
  api.install = win => { const ui = install(win); api.openOwner = ui.openOwner; };
  return api;
});
