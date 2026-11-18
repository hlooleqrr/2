/* FINO99 r42 — independent real-estate (mortgage) engine. Pure functions, no DOM, no network.
 * Does NOT reuse or alter the personal-finance / debt-buyout formulas. All money kept at full precision;
 * only display values are rounded half-up to the nearest riyal (0.50 and above rounds up).
 * Military pension (نظام التقاعد العسكري م8): pension = last basic × counted service months ÷ 420, capped at basic.
 * Retirement ages by rank (م11) live in config (owner-editable). Month fractions are not counted (م6/د).
 */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  const r1 = x => Math.floor(Number(x) + 0.5 + EPS); // half-up to riyal (amounts are non-negative)
  const num = (x, d = 0) => { const n = Number(x); return Number.isFinite(n) ? n : d; };
  // ---------- dates (all as {y,m,d} Gregorian; UTC arithmetic) ----------
  const toUTC = g => Date.UTC(g.y, g.m - 1, g.d);
  const fromUTC = t => { const x = new Date(t); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const validG = g => g && Number.isInteger(g.y) && Number.isInteger(g.m) && Number.isInteger(g.d) && g.m >= 1 && g.m <= 12 && g.d >= 1 && g.d <= dim(g.y, g.m) && g.y > 1900 && g.y < 2200;
  const cmp = (a, b) => toUTC(a) - toUTC(b);
  // Official Umm al-Qura month lengths (2 bits each: 28..31 days) 1343/01 .. 1500/12 (ummulqura.org.sa tables as packaged by hijri-converter, MIT).
  // Day 0 = 1343-01-01 AH = 1924-08-01 CE. Outside this range we fall back to Intl islamic-umalqura.
  const UQ_HEX = '9a6a2a59999999d8a65a69695a69a5999a5c999a8e6659a69995a69999999a66966669999999a6599a5999999aa65969a9965999999a99999999999999999a9998a999999a99999999999999999a999a6999999999666a66659a666666999a5a99996965a99996669a9999996666669999999a65999a69666699999999999a59a9a5999a59999a69999999999a999a6599999a59999a99599a9999699a65999a9966669999999a66666669a6599a666599a999666a665969a9965a69999999a66666669999669a66599a9996669a65969a9965a69a5966a66659a699996699a66599a9996669a6659aa6595aa69656a69996669a65999a66996669a6599a69965a9a65969a6966666999966a66659a69996669a59999a66666669a59969a96599a999666a66599a69966669999999a6696666a65966a69659a9999669a66599a69996669a65999a996666a59996a66665a66999666a665969a9965a6a65969a6665a6699999999a6659a6999666a66596a9996669a65999a66665a69a59699a9659a699996699a6599a6996666a65966a69659a6a59669a66599a669666669a6599a69965a6a65969a6965a66a59999a66659a6999666a66599a699666699a5999a69665a6a59666a66599a9996669a59999a666666669a5966a', UQ_N = 1896, UQ_Y0 = 1343, UQ_T0 = Date.UTC(1924, 7, 1);
  let UQ = null;
  function uq() { if (UQ) return UQ; const st = [0]; for (let i = 0; i < UQ_N; i++) { const v = (parseInt(UQ_HEX[i >> 1], 16) >> ((i & 1) ? 0 : 2)) & 3; st.push(st[i] + 28 + v); } UQ = st; return st; }
  let HF = null;
  function hijriICU(t) {
    if (!HF) HF = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
    const o = {}; for (const p of HF.formatToParts(new Date(t))) if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
    return { y: o.year, m: o.month, d: o.day };
  }
  function hijriParts(t) {
    const st = uq(), day = Math.round((t - UQ_T0) / 86400000);
    if (day >= 0 && day < st[UQ_N]) { let lo = 0, hi = UQ_N - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (st[mid] <= day) lo = mid; else hi = mid - 1; }
      return { y: UQ_Y0 + Math.floor(lo / 12), m: (lo % 12) + 1, d: day - st[lo] + 1 }; }
    return hijriICU(t);
  }
  function toHijri(g) { return hijriParts(toUTC(g)); }
  // Hijri -> Gregorian. Returns null when the hijri day does not exist in that month.
  function fromHijri(h) {
    if (!h || !(h.m >= 1 && h.m <= 12 && h.d >= 1 && h.d <= 31 && h.y > 1300 && h.y < 1600)) return null;
    const idx = (h.y - UQ_Y0) * 12 + (h.m - 1), st = uq();
    if (idx >= 0 && idx < UQ_N) { if (h.d > st[idx + 1] - st[idx]) return null; return fromUTC(UQ_T0 + (st[idx] + h.d - 1) * 86400000); }
    const approx = Date.UTC(622, 6, 16) + Math.round(((h.y - 1) * 354.36707 + (h.m - 1) * 29.530588 + (h.d - 1)) * 86400000);
    for (let k = -45; k <= 45; k++) { const t = approx + k * 86400000, q = hijriICU(t); if (q.y === h.y && q.m === h.m && q.d === h.d) return fromUTC(t); }
    return null;
  }
  function addYears(g, n, cal) {
    if (cal === 'hijri') { const h = toHijri(g); let r = fromHijri({ y: h.y + n, m: h.m, d: h.d }); if (!r && h.d === 30) r = fromHijri({ y: h.y + n, m: h.m, d: 29 }); return r; }
    const y = g.y + n; return { y, m: g.m, d: Math.min(g.d, dim(y, g.m)) };
  }
  // whole months from a to b (fractions dropped); negative when b < a
  function monthsBetween(a, b) { let m = (b.y - a.y) * 12 + (b.m - a.m); if (b.d < a.d) m -= 1; return m; }
  function riyadhToday(now) { const t = (now == null ? Date.now() : now) + 3 * 3600000; const g = fromUTC(t); return g; }
  // ---------- config helpers ----------
  const sectorOf = (cfg, k) => (cfg.sectors || []).find(s => s.key === k) || null;
  const rankOf = (cfg, k) => ((cfg.military || {}).ranks || []).find(r => r.key === k) || null;
  function dtiRate(rule, income) { rule = rule || {}; return income < num(rule.threshold, 15000) ? num(rule.low, 55) : num(rule.high, 65); }
  // ---------- profile: age, retirement, pension, term limits ----------
  function profile(inp, cfg, now) {
    const today = inp.today && validG(inp.today) ? inp.today : riyadhToday(now);
    const L = cfg.limits || {}; const sector = inp.sector; const sc = sectorOf(cfg, sector) || {};
    const notes = []; const out = { today, sector, notes };
    if (!validG(inp.birth)) throw Error('BIRTH_INVALID');
    const ageMonths = monthsBetween(inp.birth, today); if (ageMonths < 18 * 12 || ageMonths > 90 * 12) throw Error('AGE_OUT_OF_RANGE');
    out.ageMonths = ageMonths;
    const net = num(inp.net); if (!(net > 0)) throw Error('NET_REQUIRED');
    out.pre = net; out.post = net; out.R = 0; out.retireDate = null; out.pension = null; out.extendAllowed = false;
    if (sector === 'military') {
      const M = cfg.military || {}; const rk = rankOf(cfg, inp.rank); if (!rk) throw Error('RANK_REQUIRED');
      const age = inp.pilot && rk.group === 'officer' && num(rk.pilot_age) > 0 ? num(rk.pilot_age) : num(rk.age);
      if (!(age > 0)) throw Error('RANK_AGE_MISSING');
      if (!validG(inp.appoint) || cmp(inp.appoint, today) > 0 || cmp(inp.appoint, inp.birth) <= 0) throw Error('APPOINT_INVALID');
      const basic = num(inp.basic); if (!(basic > 0)) throw Error('BASIC_REQUIRED');
      const rd = addYears(inp.birth, age, M.calendar || 'hijri'); out.retireDate = rd; out.retireAge = age;
      out.R = Math.max(0, monthsBetween(today, rd));
      out.serviceNow = Math.max(0, monthsBetween(inp.appoint, today));
      out.serviceAtRet = out.serviceNow + out.R;
      const div = num(M.pension_divisor_months, 420) || 420;
      let pension = basic * out.serviceAtRet / div; if (M.cap_at_basic !== false) pension = Math.min(pension, basic);
      out.pension = pension; out.post = pension; out.basic = basic;
      out.extendAllowed = sc.extend !== false && out.R > 0;
      if (out.R === 0) notes.push('PAST_RETIREMENT_AGE');
    } else if (sector === 'retired') {
      out.R = 0; out.post = net; out.extendAllowed = false;
    } else {
      const age = num(sc.retire_age, 60); const rd = addYears(inp.birth, age, sc.calendar || 'gregorian');
      out.retireDate = rd; out.retireAge = age; out.R = Math.max(0, monthsBetween(today, rd));
      // civil post-retirement income is not modelled (no military formula for civilians): extension only if owner enabled it AND client gave expected pension
      out.extendAllowed = sc.extend === true && out.R > 0 && num(inp.civilPension) > 0;
      if (out.extendAllowed) out.post = num(inp.civilPension);
    }
    const maxAge = num(L.max_age_end, 70);
    const ageEnd = addYears(inp.birth, maxAge, L.age_calendar_end || 'gregorian');
    out.monthsToMaxAge = Math.max(0, monthsBetween(today, ageEnd));
    return out;
  }
  // max allowed term for the case (global limits); per-bank limits applied later
  function termCap(pr, cfg, extend, bank) {
    const L = cfg.limits || {}; let cap = Math.min(num(L.max_term, 300), pr.monthsToMaxAge);
    if (bank) {
      if (num(bank.max_term) > 0) cap = Math.min(cap, num(bank.max_term));
      if (num(bank.max_age_end) > 0 && pr.birth) { const e = addYears(pr.birth, num(bank.max_age_end), (cfg.limits || {}).age_calendar_end || 'gregorian'); cap = Math.min(cap, Math.max(0, monthsBetween(pr.today, e))); }
    }
    if (pr.sector !== 'retired' && pr.R > 0 && !(extend && pr.extendAllowed)) cap = Math.min(cap, pr.R);
    if (pr.sector !== 'retired' && pr.R === 0 && pr.sector !== 'military') cap = 0; // civil already past retirement age: not modelled
    return Math.max(0, Math.floor(cap));
  }
  function durationCard(inp, cfg, now) {
    const pr = profile(inp, cfg, now); pr.birth = inp.birth;
    const L = cfg.limits || {}; const extendDefault = pr.sector === 'military' && pr.extendAllowed && (cfg.military || {}).extend_default !== false;
    const extend = inp.extend == null ? extendDefault : !!inp.extend;
    const cap = termCap(pr, cfg, extend, null); const want = num(inp.months, num(L.default_term, 300));
    const months = Math.max(0, Math.min(want, cap));
    return { profile: pr, extend, extendShown: pr.extendAllowed, cap, capWithExtend: termCap(pr, cfg, true, null), capNoExtend: termCap(pr, cfg, false, null),
      months, corrected: months < want, minTerm: Math.min(num(L.min_term, 60), cap) };
  }
  // ---------- capacity schedule ----------
  function obligationsAt(obl, m) { let s = 0; for (const o of obl || []) if (m <= num(o.months)) s += num(o.amount); return s; }
  function schedule(pr, inp, cfg, N) {
    const D = cfg.dti || {}; const rows = new Array(N);
    for (let m = 1; m <= N; m++) {
      const post = pr.sector === 'retired' || m > pr.R; const income = post ? pr.post : pr.pre;
      const rule = post && pr.sector !== 'military' ? (D.retired || D.salary) : (post ? (D.retired || D.salary) : D.salary);
      const rate = dtiRate(rule, income); const limit = income * rate / 100; const ob = obligationsAt(inp.obligations, m);
      rows[m - 1] = { m, post, income, rate, limit, ob, cap: Math.max(0, limit - ob) };
    }
    return rows;
  }
  function stages(pays, rows) { // compress equal consecutive payments, split at retirement boundary
    const out = []; for (let i = 0; i < pays.length; i++) {
      const a = r1(pays[i]), post = rows[i].post, last = out[out.length - 1];
      if (last && last.amount === a && last.post === post) last.to = i + 1; else out.push({ from: i + 1, to: i + 1, amount: a, post, raw: pays[i] });
    } return out;
  }
  // ---------- pricing ----------
  function pv(pays, apr, method) {
    const N = pays.length; let s = 0;
    if (method === 'flat') { for (const p of pays) s += p; return s / (1 + (apr / 100) * N / 12); }
    const i = apr / 100 / 12; if (i <= 0) { for (const p of pays) s += p; return s; }
    let f = 1; for (let m = 0; m < N; m++) { f /= (1 + i); s += pays[m] * f; } return s;
  }
  function supportKey(inp) { if (!inp.supported) return 'none'; if (inp.supportType === 'etizaz') return 'etizaz'; return inp.supportType === 'monthly' ? 'monthly' : 'upfront'; }
  function hasPersonal(inp) { return (inp.obligations || []).some(o => o.type === 'personal' && num(o.amount) > 0 && num(o.months) > 0); }
  function offerMatches(o, inp, plan, N, entity) {
    if (!o || o.active === false || !(num(o.rate) > 0)) return false;
    if (o.plan && o.plan !== 'any' && o.plan !== plan) return false;
    if (Array.isArray(o.sectors) && o.sectors.length && !o.sectors.includes(inp.sector)) return false;
    if (o.support && o.support !== 'any' && o.support !== supportKey(inp)) return false;
    if (o.property && o.property !== 'any' && o.property !== inp.property) return false;
    if (o.personal === 'yes' && !hasPersonal(inp)) return false; if (o.personal === 'no' && hasPersonal(inp)) return false;
    if (num(o.min_term) > 0 && N < num(o.min_term)) return false; if (num(o.max_term) > 0 && N > num(o.max_term)) return false;
    if (Array.isArray(o.entities) && o.entities.length) { const e = entity || inp.entity; if (!e || !o.entities.includes(e)) return false; }
    return true;
  }
  function quoteBank(bank, inp, cfg, pr, opt) {
    opt = opt || {}; const plan = opt.plan || 'step'; const res = { id: bank.id, name: bank.name, test: !!bank.test, plan, eligible: false };
    if (bank.active === false || bank.included === false) return Object.assign(res, { reason: 'INACTIVE' });
    if (bank.test && !opt.trial) return Object.assign(res, { reason: 'TEST_HIDDEN' });
    if (Array.isArray(bank.sectors) && bank.sectors.length && !bank.sectors.includes(inp.sector)) return Object.assign(res, { reason: 'SECTOR' });
    if (Array.isArray(bank.properties) && bank.properties.length && !bank.properties.includes(inp.property)) return Object.assign(res, { reason: 'PROPERTY' });
    if (num(bank.min_salary) > 0 && pr.pre < num(bank.min_salary)) return Object.assign(res, { reason: 'MIN_SALARY' });
    const N = Math.min(opt.months, termCap(pr, cfg, opt.extend, bank)); res.months = N; res.termCut = N < opt.months;
    if (!(N >= 12)) return Object.assign(res, { reason: 'TERM' });
    let rate = num(((bank.rates || {})[plan] || {})[supportKey(inp)], NaN);
    if (!(rate > 0) && supportKey(inp) === 'etizaz') rate = num(((bank.rates || {})[plan] || {}).upfront, NaN);
    let offer = null;
    if (opt.offerId) { offer = (bank.offers || []).find(o => o.id === opt.offerId) || null; if (!offerMatches(offer, inp, plan, N, opt.entity)) return Object.assign(res, { reason: 'OFFER_NOT_ELIGIBLE' }); rate = num(offer.rate); }
    if (!(rate > 0)) return Object.assign(res, { reason: 'NO_RATE' });
    const rows = schedule(pr, inp, cfg, N); let pays;
    const ms = inp.supported && supportKey(inp) === 'monthly' && (cfg.support || {}).monthly_enabled ? num((cfg.support || {}).monthly_amount) : 0;
    const msMonths = num((cfg.support || {}).monthly_months);
    const sup = m => (ms > 0 && (msMonths <= 0 || m <= msMonths)) ? ms : 0;
    if (plan === 'fixed') { let mn = Infinity; for (const r of rows) mn = Math.min(mn, r.cap); pays = rows.map(() => mn); }
    else pays = rows.map(r => r.cap);
    if (!pays.length || pays.every(p => p <= 0)) return Object.assign(res, { reason: 'NO_CAPACITY' });
    const method = bank.method === 'flat' ? 'flat' : 'annuity';
    let bankPays = pays.map((p, k) => p + sup(k + 1));
    let P = pv(bankPays, rate, method);
    if (num(bank.max_amount) > 0 && P > num(bank.max_amount)) { const k = num(bank.max_amount) / P; pays = pays.map(p => p * k); bankPays = bankPays.map(p => p * k); P = num(bank.max_amount); res.amountCapped = true; }
    if (!(P > 0)) return Object.assign(res, { reason: 'NO_CAPACITY' });
    const F = bank.fees || {}; const fee = Math.min(P * num(F.admin_pct) / 100, num(F.admin_cap) > 0 ? num(F.admin_cap) : Infinity); const vat = fee * num(F.vat_pct) / 100;
    const totalPays = bankPays.reduce((a, b) => a + b, 0); const profit = totalPays - P;
    const st = stages(pays, rows); const pre = st.filter(s => !s.post), post = st.filter(s => s.post);
    const offersAvail = (bank.offers || []).filter(o => o.active !== false && num(o.rate) > 0).map(o => ({ id: o.id, title: o.title, kind: (o.entities && o.entities.length) ? 'entity' : (o.plan === 'fixed' ? 'fixed' : 'general'), entities: o.entities || [], plan: o.plan || 'any',
      eligibleNow: offerMatches(o, inp, o.plan && o.plan !== 'any' ? o.plan : plan, N, opt.entity) }));
    return Object.assign(res, { eligible: true, rate, method, offer: offer ? { id: offer.id, title: offer.title } : null, amount: P, amountR: r1(P), pays, clientPays: pays, monthlySupport: ms,
      stages: st, preStages: pre, postStages: post, firstInstallment: r1(pays[0]), maxInstallment: r1(Math.max.apply(null, pays)),
      profit, profitR: r1(profit), fee, vat, feeR: r1(fee + vat), totalDue: totalPays + fee + vat, totalDueR: r1(totalPays + fee + vat),
      propertyValueR: r1(P + (inp.supported && supportKey(inp) === 'upfront' ? num((cfg.support || {}).upfront_amount) : 0)), offers: offersAvail, recommended: !!bank.recommended });
  }
  function rank(list, cfg) {
    const by = cfg.ranking || 'amount';
    const key = { amount: (a, b) => b.amount - a.amount || a.profit - b.profit, installment: (a, b) => a.firstInstallment - b.firstInstallment || b.amount - a.amount, profit: (a, b) => a.profit - b.profit || b.amount - a.amount }[by] || ((a, b) => b.amount - a.amount);
    return list.slice().sort(key);
  }
  function compare(inp, cfg, opt) {
    opt = opt || {}; const pr = profile(inp, cfg, opt.now); pr.birth = inp.birth;
    const plan = opt.plan || cfg.default_plan || 'step';
    const all = (cfg.banks || []).map(b => quoteBank(b, inp, cfg, pr, { plan: (opt.plans || {})[b.id] || plan, months: opt.months, extend: opt.extend, trial: !!opt.trial, offerId: (opt.offers || {})[b.id], entity: opt.entity }));
    const ok = rank(all.filter(x => x.eligible), cfg); const top = Math.max(1, num(cfg.top_n, 3));
    return { profile: pr, plan, months: opt.months, extend: !!opt.extend, results: ok, top: ok.slice(0, top), rest: ok.slice(top), excluded: all.filter(x => !x.eligible).map(x => ({ id: x.id, name: x.name, reason: x.reason })) };
  }
  const API = { version: 'r42a', r1, toHijri, fromHijri, addYears, monthsBetween, riyadhToday, validG, profile, durationCard, termCap, schedule, pv, quoteBank, compare, offerMatches, dtiRate, supportKey };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.F99RE42Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
