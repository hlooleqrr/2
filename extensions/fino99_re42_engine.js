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
  function dtiRate(rule, income) { rule = rule || {}; return income < num(rule.threshold, 15000) ? num(rule.low, 55) : num(rule.high, 65); } // legacy (policy disabled)
  // r49: «سياسة الاستقطاع العقاري» — SAMA Responsible Lending Principles (ch.4, arts 13–17). Income basis: before retirement = net salary as entered
  // (basic after pension deduction + fixed allowances, before financing instalments); after retirement = (estimated) pension. Tier 1: <= t1_max; 2: < t2_max; 3: >= t2_max.
  const nv = (x, d) => (x == null || x === '') ? d : num(x, d);
  function dtiTier(income, DP) { DP = DP || {}; return income <= nv(DP.t1_max, 15000) ? 1 : income < nv(DP.t2_max, 25000) ? 2 : 3; }
  function dtiInfo(cfg, income, post, inp, bank, trial) {
    const DP = cfg.dti_policy;
    if (!DP || DP.enabled === false) { const D = cfg.dti || {}; return { pct: dtiRate(post ? (D.retired || D.salary) : D.salary, income), tier: null, basis: 'legacy' }; }
    const X = Object.assign({}, DP.pre || {}); if (post) Object.keys(DP.post || {}).forEach(k => { if (DP.post[k] != null && DP.post[k] !== '') X[k] = DP.post[k]; });
    const tier = dtiTier(income, DP); let pct, basis;
    if (tier === 1) { pct = nv(X.t1_pct, 55); basis = 't1';
      if (X.t1_supported_enabled === true && inp && inp.supported && String(DP.t1_supported_source || '').trim() && nv(X.t1_supported_pct, 0) > 0) { pct = nv(X.t1_supported_pct, 65); basis = 't1_supported'; } }
    else if (tier === 2) { pct = nv(X.t2_pct, 65); basis = 't2'; }
    else if (bank && bank.dti_t3_approved === true && nv(bank.dti_t3, 0) > 0 && String(bank.dti_t3_source || '').trim()) { pct = nv(bank.dti_t3, 0); basis = 't3_bank'; }
    else if (trial && DP.t3_test_in_preview === true && nv(DP.t3_test_pct, 0) > 0) { pct = nv(DP.t3_test_pct, 80); basis = 't3_test'; }
    else { pct = nv(X.t3_fallback_pct, nv(X.t2_pct, 65)); basis = 't3_fallback'; }
    return { pct: Math.max(1, Math.min(100, pct)), tier, basis };
  }
  // r49: art. 13/هـ — an unequal-instalment obligation is assessed at the monthly average of all its instalments. 'origination' (default):
  // the average step instalment may not exceed the capacity at origination (month 1); upper stages are levelled until it holds. 'stage': stage caps only.
  function avgRule(pays, cfg) {
    const mode = (cfg.installments || {}).avg_rule || 'origination'; const n = pays.length; if (!n || mode === 'stage') return { pays, adjusted: false };
    const A = pays[0]; const avg = a => { let s = 0; for (const x of a) s += x; return s / n; };
    if (avg(pays) <= A + 1e-9) return { pays, adjusted: false };
    let lo = Math.min.apply(null, pays), hi = Math.max.apply(null, pays);
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (avg(pays.map(p => Math.min(p, mid))) <= A + 1e-9) lo = mid; else hi = mid; }
    return { pays: pays.map(p => Math.min(p, lo)), adjusted: true, level: lo };
  }
  // r49: pricing is separate from instalment distribution — the approved margin does not change with the instalment shape unless the bank has its own step rate.
  function pickRate(bank, inp, cfg, plan, trial) {
    const RT = bank.rates || {}; const IN = cfg.installments || {}; const sk = supportKey(inp);
    const get = p => { let r = num((RT[p] || {})[sk], NaN); if (!(r > 0) && sk === 'etizaz') r = num((RT[p] || {}).upfront, NaN); return r; };
    let r = get(plan); if (r > 0) return { rate: r, source: 'own' };
    const sim = trial && nv(IN.sim_rate, 0) > 0 ? { rate: nv(IN.sim_rate, 0), source: 'owner_sim' } : null;
    if (plan === 'step' && bank.plan_pricing === 'separate') return sim || { rate: NaN, reason: 'NO_STEP_RATE' };
    if (IN.same_margin !== false) { r = get(plan === 'step' ? 'fixed' : 'step'); if (r > 0) return { rate: r, source: 'same_margin' }; }
    return sim || { rate: NaN, reason: 'NO_RATE' };
  }
  // r49: client-level capacity (no bank specifics): stage caps, highest fixed instalment (= lowest cap over the whole term), months before/after retirement.
  // r51: SAMA RLP art. 15/ب & 16/ب — current non-real-estate obligations (month 1, as entered; Etizaz excluded) above consumer_pct% of income, income < t2_max
  function consumerOverAt(rows, cfg) { const DP = cfg.dti_policy || {}; const r = rows && rows[0]; if (!r || !(r.income > 0)) return null; const cp = nv(DP.consumer_pct, 45);
    if (dtiTier(r.income, DP) >= 3 || !(r.ob0 > r.income * cp / 100 + 1e-9)) return null; return { m: 1, pct: Math.round(r.ob0 / r.income * 10000) / 100, limit: cp, ob: r.ob0, income: r.income }; }
  function capInfo(pr, inp, cfg, months, extend, trial) {
    try {
      const N = Math.min(num(months), termCap(pr, cfg, extend, null)); if (!(N >= 1)) return null;
      const rows = schedule(pr, inp, cfg, N, null, trial); const r2 = x => Math.round(x * 100) / 100; const st = [];
      rows.forEach(r => { const a = r2(r.cap), l = st[st.length - 1]; if (l && l.amount === a && l.post === r.post) l.to = r.m;
        else st.push({ from: r.m, to: r.m, amount: a, post: r.post, limit: r2(r.limit), ob: r2(r.ob), ez: r2(r.ez || 0), pct: r.rate, tier: r.tier, basis: r.basis, income: r.income }); });
      let mn = Infinity, sum = 0; rows.forEach(r => { mn = Math.min(mn, r.cap); sum += r.cap; });
      const over0 = consumerOverAt(rows, cfg);
      const fp = rows.find(r => !r.post), lp = rows.find(r => r.post);
      return { months: N, stages: st, fixedMax: mn, first: rows[0].cap, avg: sum / N, avgRule: (cfg.installments || {}).avg_rule || 'origination',
        preMonths: rows.filter(r => !r.post).length, postMonths: rows.filter(r => r.post).length,
        pre: fp ? { income: fp.income, pct: fp.rate, tier: fp.tier, basis: fp.basis, limit: r2(fp.limit) } : null,
        post: lp ? { income: lp.income, pct: lp.rate, tier: lp.tier, basis: lp.basis, limit: r2(lp.limit) } : null,
        consumerOver: over0 };
    } catch (e) { return null; }
  }
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
      const rd = addYears(inp.birth, age, M.calendar || 'hijri'); out.retireDate = rd; out.retireAge = age;
      out.R = Math.max(0, monthsBetween(today, rd));
      // r51: appointment date + basic are asked only when the financing reaches retirement; without them no pension / extension is modelled
      if (inp.appoint == null && inp.basic == null) { out.pensionSkipped = true; if (out.R === 0) notes.push('PAST_RETIREMENT_AGE'); } else {
      if (!validG(inp.appoint) || cmp(inp.appoint, today) > 0 || cmp(inp.appoint, inp.birth) <= 0) throw Error('APPOINT_INVALID');
      const basic = num(inp.basic); if (!(basic > 0)) throw Error('BASIC_REQUIRED');
      // r44: counted service (م4/أ، م6): full months only, minus non-counted periods; counted directly appointment -> retirement date
      const svcCal = M.service_calendar === 'hijri' ? 'hijri' : 'gregorian'; out.serviceCalendar = svcCal;
      const mb = (a, b) => svcCal === 'hijri' ? monthsBetween(toHijri(a), toHijri(b)) : monthsBetween(a, b);
      const excl = Math.max(0, Math.floor(num(inp.excludedMonths, 0))); const svcRaw = Math.max(0, mb(inp.appoint, today));
      if (excl > svcRaw) throw Error('EXCL_INVALID');
      out.excl = excl; out.serviceNow = svcRaw - excl;
      out.serviceAtRet = out.R > 0 ? Math.max(0, mb(inp.appoint, rd) - excl) : out.serviceNow;
      const div = num(M.pension_divisor_months, 420) || 420;
      // r48: pension on the EXPECTED last basic at retirement (not today's basic) when the owner entered the rank's official scale
      const eb = expectedBasic(inp, rk, M, today, rd, out.R);
      Object.assign(out, { basicCurrent: basic, basicMethod: eb.method, grade: eb.grade, gradeAtRet: eb.gradeAtRet, increments: eb.increments, gradesMax: eb.grades, scaleSource: eb.source, scaleEffective: eb.effective, scaleStatus: eb.status });
      const base = eb.expected;
      let pension = base * out.serviceAtRet / div; if (M.cap_at_basic !== false) pension = Math.min(pension, base);
      out.pension = pension; out.post = pension; out.basic = base;
      out.extendAllowed = sc.extend !== false && out.R > 0;
      if (out.R === 0) notes.push('PAST_RETIREMENT_AGE');
      }
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
  // r48b: rank salary scale. Preferred: owner-managed «سلم الرواتب العسكرية» (M.salary_scale, explicit basic per grade); legacy: first/step on the rank.
  const nn = x => { const v = Number(String(x == null ? '' : x).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, '')); return String(x == null ? '' : x).trim() === '' ? NaN : v; };
  function rankScale(rk, M) {
    if (!rk) return null; const SS = (M || {}).salary_scale;
    if (SS && SS.enabled !== false && Array.isArray(SS.ranks) && String(SS.source || '').trim()) {
      const e = SS.ranks.find(x => x && x.key === rk.key);
      if (e) { const v = (e.values || []).map(nn); if (!(v.length && v.every((x, i) => x > 0 && (i === 0 || x > v[i - 1])))) return null;
        return { values: v, grades: v.length, top: v[v.length - 1], source: String(SS.name || SS.source).trim(), effective: String(SS.issued || ''), status: (SS.status === 'verified' || SS.status === 'owner_approved') ? SS.status : 'pending' }; }
    }
    const first = num(rk.scale_first), step = num(rk.scale_step, NaN), G = Math.floor(num(rk.scale_grades));
    if (!(first > 0) || !(step >= 0) || !(G >= 1) || !String(rk.scale_source || '').trim()) return null;
    const v = []; for (let g = 1; g <= G; g++) v.push(first + (g - 1) * step);
    return { values: v, grades: G, top: v[G - 1], source: String(rk.scale_source).trim(), effective: String(rk.scale_effective || ''), status: rk.scale_status === 'verified' ? 'verified' : 'pending' };
  }
  function gradeOf(sc, basic) { if (!sc) return null; for (let g = 1; g <= sc.grades; g++) if (Math.abs(sc.values[g - 1] - num(basic)) < 0.005) return g; return null; }
  // Individuals Service Law art. 15: one periodic increment (next grade in the same rank) on every 1 Muharram; capped at the rank's last grade; no promotion assumed.
  function expectedBasic(inp, rk, M, today, rd, R) {
    const basic = num(inp.basic); const o = { expected: basic, method: 'current', grade: null, gradeAtRet: null, increments: 0, grades: null, source: '', effective: '', status: '' };
    if (M.expected_basic === false) { o.method = 'current_rule'; return o; }
    const sc = rankScale(rk, M); if (!sc) { o.method = 'no_scale'; return o; }
    Object.assign(o, { grades: sc.grades, source: sc.source, effective: sc.effective, status: sc.status });
    let g = gradeOf(sc, basic), exact = true;
    if (g == null) { const gi = Math.floor(num(inp.grade, 0)); if (!(gi >= 1 && gi <= sc.grades)) { o.method = 'grade_needed'; return o; } g = gi; exact = false; }
    const n = R > 0 ? Math.max(0, toHijri(rd).y - toHijri(today).y) : 0; // 1 Muharram dates after today up to the retirement date
    const gR = Math.min(sc.grades, g + n); o.grade = g; o.gradeAtRet = gR; o.increments = gR - g;
    if (exact) o.expected = sc.values[gR - 1];
    else o.expected = basic > sc.top ? basic : Math.min(sc.top, basic + sc.values[gR - 1] - sc.values[g - 1]);
    o.method = exact ? 'scale' : 'scale_grade'; return o;
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
    return { profile: pr, extend, extendShown: pr.extendAllowed && pr.R < Math.max(want, num(L.default_term, 300)), cap, capWithExtend: termCap(pr, cfg, true, null), capNoExtend: termCap(pr, cfg, false, null),
      months, corrected: months < want, minTerm: Math.min(num(L.min_term, 60), cap) };
  }
  // ---------- capacity schedule ----------
  // r50: «اعتزاز» — an independent qard-hasan loan (default simulation 160,000 / 24 grace / 216 instalments), NOT part of the bank principal.
  // Its instalment is an obligation of every month it is due (also after retirement); start_offset = months already elapsed in the Etizaz loan at mortgage month 1.
  function etizazEligible(inp, cfg) {
    const Z = cfg.etizaz || {}; if (Z.enabled !== true) return false;
    const sec = Array.isArray(Z.sectors) && Z.sectors.length ? Z.sectors : ['military']; if (!sec.includes(inp.sector)) return false;
    if (Z.require_supported !== false && inp.supported !== true) return false;
    const ents = Array.isArray(Z.entities) && Z.entities.length ? Z.entities : ['وزارة الدفاع']; const e = inp.mil_entity || inp.entity; return !!e && ents.includes(e);
  }
  function etizazPlan(inp, cfg) {
    if (!inp || inp.etizaz !== true || !etizazEligible(inp, cfg)) return null; const Z = cfg.etizaz || {};
    const amount = nv(Z.amount, 160000), grace = Math.max(0, Math.floor(nv(Z.grace_months, 24))), n = Math.max(1, Math.floor(nv(Z.months, 216))), offset = Math.max(0, Math.floor(nv(Z.start_offset, 0)));
    if (!(amount > 0)) return null; const inst = Math.floor(amount / n * 100 + 1e-7) / 100; const last = Math.round((amount - inst * (n - 1)) * 100) / 100;
    return { amount, grace, months: n, offset, inst, last, raw: amount / n, firstPay: grace + 1 - offset, lastPay: grace + n - offset };
  }
  function etzAt(ep, m) { if (!ep) return 0; const k = m + ep.offset; if (k <= ep.grace || k > ep.grace + ep.months) return 0; return k === ep.grace + ep.months ? ep.last : ep.inst; }
  // r50: support amounts — the owner values are used; the uploaded support-matrix rows are a reference until the owner switches them on.
  function supportAmounts(inp, cfg) {
    const Sp = cfg.support || {}, MX = cfg.support_matrix || {}, sk = supportKey(inp), inc = num(inp.net); // r51: the actual net (no rounding down)
    const band = rows => (rows || []).find(r => inc >= num(r.from) && (r.to == null || r.to === '' || inc <= num(r.to)));
    let up = 0, upSrc = null, mo = 0, moMonths = num(Sp.monthly_months), moSrc = null;
    if (inp.supported && sk === 'upfront') { if (MX.use_packages === true) { const b = (Array.isArray(MX.properties) && MX.properties.length && !MX.properties.includes(inp.property || 'ready')) ? null : band(MX.packages); if (b) { up = num(b.amount); upSrc = 'matrix'; } } else if (num(Sp.upfront_amount) > 0) { up = num(Sp.upfront_amount); upSrc = 'owner'; } }
    if (inp.supported && sk === 'monthly' && Sp.monthly_enabled) { if (MX.use_monthly === true) { const b = band(MX.monthly); if (b) { mo = num(b.amount); moMonths = num(b.months, moMonths); moSrc = 'matrix'; } } else if (num(Sp.monthly_amount) > 0) { mo = num(Sp.monthly_amount); moSrc = 'owner'; } }
    const ep = etizazPlan(inp, cfg); const C = (cfg.etizaz || {}).combine || {}; let upCounted = up > 0; const blocked = [];
    if (ep) { if (up > 0 && C.upfront !== true) { upCounted = false; blocked.push('upfront'); } if (mo > 0 && C.monthly !== true) { mo = 0; blocked.push('monthly'); } }
    return { key: sk, upfront: up, upfrontSrc: upSrc, upfrontCounted: upCounted, monthly: mo, monthlyMonths: moMonths, monthlySrc: moSrc, etizaz: ep, combineBlocked: blocked };
  }
  // r50: administrative fee on granting real-estate finance = the lower of pct% of the amount or the cap (default 1% / 5,000), before VAT where applicable.
  // Per bank: standard | lower (own pct/cap, never above the ceiling) | exempt; a valuation part is split INSIDE the same ceiling (no double charging).
  function feeCalc(P, bank, cfg) {
    const G = cfg.mortgage_fees || {}; const F = (bank && bank.fees) || {};
    const vatPct = nv(F.vat_pct != null && F.vat_pct !== '' ? F.vat_pct : G.vat_pct, G.enabled === false ? 0 : 15);
    if (G.enabled === false) { const T = Math.min(P * num(F.admin_pct) / 100, num(F.admin_cap) > 0 ? num(F.admin_cap) : Infinity); return { mode: 'legacy', ceiling: T, admin: T, valuation: 0, fee: T, vat: T * vatPct / 100, vatPct, total: T * (1 + vatPct / 100) }; }
    const pctG = nv(G.pct, 1), capG = nv(G.cap, 5000); const ceiling = Math.min(P * pctG / 100, capG > 0 ? capG : Infinity);
    const mode = F.mode || (num(F.admin_pct) > 0 ? 'lower' : 'standard'); let T;
    if (mode === 'exempt') T = 0;
    else if (mode === 'lower') { const lp = nv(F.lower_pct, nv(F.admin_pct, pctG)), lc = nv(F.lower_cap, nv(F.admin_cap, 0)); T = Math.min(ceiling, P * lp / 100, lc > 0 ? lc : Infinity); }
    else T = ceiling;
    const val = Math.min(Math.max(0, num(F.valuation)), T); const r2 = x => Math.round(x * 100) / 100; const fee = r2(T), vat = r2(T * vatPct / 100);
    return { mode, ceiling: r2(ceiling), admin: r2(T - val), valuation: r2(val), fee, vat, vatPct, total: r2(fee + vat) };
  }
  // r50: «مصفوفة المنتجات والدعم العقاري» — owner rows keyed by bank x sector/entity x product x support x plan x term (+ salary band, age, amount limits).
  // A matching row prices the bank; with no matching row the bank's base rates are used exactly as before (never another bank's or product's rate).
  function matrixRow(bank, inp, cfg, plan, N, pr) {
    const any = v => v == null || v === '' || v === 'any'; const sk = supportKey(inp);
    const cand = (cfg.product_matrix || []).filter(r => r && r.active !== false && r.bank === bank.id && num(r.rate) > 0
      && (any(r.sector) || r.sector === inp.sector) && (any(r.entity) || r.entity === inp.entity) && (any(r.property) || r.property === inp.property)
      && (any(r.support) || r.support === sk) && (any(r.plan) || r.plan === plan) && !(num(r.term_min) > 0 && N < num(r.term_min)) && !(num(r.term_max) > 0 && N > num(r.term_max)));
    if (!cand.length) return null; let why = null;
    for (const r of cand) {
      if (num(r.min_salary) > 0 && pr.pre < num(r.min_salary)) { why = why || 'MIN_SALARY'; continue; }
      if (num(r.max_salary) > 0 && pr.pre > num(r.max_salary)) { why = why || 'MAX_SALARY'; continue; }
      if (num(r.max_age_end) > 0 && pr.birth && monthsBetween(pr.today, addYears(pr.birth, num(r.max_age_end), 'gregorian')) < N) { why = why || 'AGE'; continue; }
      return { row: r };
    }
    return { blocked: why || 'NO_RATE' };
  }
  // r50: instalment table per period — mortgage instalment, other obligations, Etizaz, total deduction, income (before/after retirement).
  function ptable(pays, rows) {
    const r2 = x => Math.round(x * 100) / 100; const out = [];
    for (let i = 0; i < pays.length; i++) { const R = rows[i]; const o = { pay: r2(pays[i]), ob: r2(R.ob0 || 0), ez: r2(R.ez || 0), post: !!R.post, income: r2(R.income), limit: r2(R.limit), pct: R.rate }; const l = out[out.length - 1];
      if (l && l.pay === o.pay && l.ob === o.ob && l.ez === o.ez && l.post === o.post && l.income === o.income) l.to = i + 1; else out.push(Object.assign({ from: i + 1, to: i + 1 }, o)); }
    out.forEach(t => { t.total = r2(t.pay + t.ob + t.ez); }); return out;
  }
  function etzInfo(ep, rows, N) {
    if (!ep) return null; const r2 = x => Math.round(x * 100) / 100; const cap = m => (m >= 1 && m <= rows.length) ? r2(rows[m - 1].cap) : null;
    return { amount: ep.amount, grace: ep.grace, months: ep.months, inst: ep.inst, last: ep.last, offset: ep.offset, start: Math.max(1, ep.firstPay), end: ep.lastPay, beyond: ep.lastPay > N,
      capBefore: ep.firstPay > 1 ? cap(ep.firstPay - 1) : null, capDuring: cap(Math.max(1, ep.firstPay)), capAfter: ep.lastPay < N ? cap(ep.lastPay + 1) : null };
  }
  function obligationsAt(obl, m) { let s = 0; for (const o of obl || []) if (m <= num(o.months)) s += num(o.amount); return s; }
  function schedule(pr, inp, cfg, N, bank, trial) {
    const rows = new Array(N); const ep = etizazPlan(inp, cfg);
    for (let m = 1; m <= N; m++) {
      const post = pr.sector === 'retired' || m > pr.R; const income = post ? pr.post : pr.pre;
      const di = dtiInfo(cfg, income, post, inp, bank, trial); const rate = di.pct; const limit = income * rate / 100; const ob0 = obligationsAt(inp.obligations, m); const ez = etzAt(ep, m); const ob = ob0 + ez;
      rows[m - 1] = { m, post, income, rate, tier: di.tier, basis: di.basis, limit, ob, ob0, ez, cap: Math.max(0, limit - ob) };
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
    if (Array.isArray(bank.supports) && bank.supports.length && !bank.supports.includes(supportKey(inp))) return Object.assign(res, { reason: 'SUPPORT' });
    if (Array.isArray(bank.entities) && bank.entities.length && !bank.entities.includes(inp.entity)) return Object.assign(res, { reason: 'ENTITY' });
    { const ep0 = etizazPlan(inp, cfg), Z = cfg.etizaz || {}; if (ep0 && ((Array.isArray(Z.banks) && Z.banks.length && !Z.banks.includes(bank.id)) || (Array.isArray(Z.properties) && Z.properties.length && !Z.properties.includes(inp.property)))) return Object.assign(res, { reason: 'ETIZAZ_BANK' }); }
    const N = Math.min(opt.months, termCap(pr, cfg, opt.extend, bank)); res.months = N; res.termCut = N < opt.months;
    if (!(N >= 12)) return Object.assign(res, { reason: 'TERM' });
    const mx = matrixRow(bank, inp, cfg, plan, N, pr); if (mx && mx.blocked) return Object.assign(res, { reason: mx.blocked });
    const pk = mx ? { rate: num(mx.row.rate), source: 'matrix' } : pickRate(bank, inp, cfg, plan, !!opt.trial); if (mx) res.matrixRow = mx.row.id || null; let rate = pk.rate; res.rateSource = pk.source || null;
    let offer = null;
    if (opt.offerId) { offer = (bank.offers || []).find(o => o.id === opt.offerId) || null; if (!offerMatches(offer, inp, plan, N, opt.entity)) return Object.assign(res, { reason: 'OFFER_NOT_ELIGIBLE' }); rate = num(offer.rate); res.rateSource = 'offer'; }
    if (!(rate > 0)) return Object.assign(res, { reason: pk.reason || 'NO_RATE' });
    const rows = schedule(pr, inp, cfg, N, bank, !!opt.trial); let pays;
    if ((cfg.dti_policy || {}).consumer_over_exclude !== false && consumerOverAt(rows, cfg)) return Object.assign(res, { reason: 'CONSUMER_OVER' }); // r51
    const SA = supportAmounts(inp, cfg); const ms = SA.monthly;
    const msMonths = SA.monthlyMonths;
    const sup = m => (ms > 0 && (msMonths <= 0 || m <= msMonths)) ? ms : 0;
    if (plan === 'fixed') { let mn = Infinity; for (const r of rows) mn = Math.min(mn, r.cap); pays = rows.map(() => mn); }
    else { pays = rows.map(r => r.cap); const ar = avgRule(pays, cfg); pays = ar.pays; if (ar.adjusted) res.avgAdjusted = true; } // r49: step + 13/هـ
    if (!pays.length || pays.every(p => p <= 0)) return Object.assign(res, { reason: 'NO_CAPACITY' });
    { const z = []; pays.forEach((p, k) => { if (!(p > 0.005)) z.push(k + 1); }); if (z.length) return Object.assign(res, { reason: 'ZERO_STAGE', zeroFrom: z[0], zeroTo: z[z.length - 1], zeroPost: !!rows[z[0] - 1].post }); }
    const method = bank.method === 'flat' ? 'flat' : 'annuity';
    let bankPays = pays.map((p, k) => p + sup(k + 1));
    let P = pv(bankPays, rate, method);
    if (num(bank.max_amount) > 0 && P > num(bank.max_amount)) { const k = num(bank.max_amount) / P; pays = pays.map(p => p * k); bankPays = bankPays.map(p => p * k); P = num(bank.max_amount); res.amountCapped = true; }
    if (mx && num(mx.row.max_amount) > 0 && P > num(mx.row.max_amount)) { const k = num(mx.row.max_amount) / P; pays = pays.map(p => p * k); bankPays = bankPays.map(p => p * k); P = num(mx.row.max_amount); res.amountCapped = true; }
    if (mx && num(mx.row.min_amount) > 0 && P < num(mx.row.min_amount)) return Object.assign(res, { reason: 'MIN_AMOUNT' });
    // r48: client-requested reduction of amount / installment — same term, same rate (PV is linear in the payments)
    const cut = opt.cut; if (cut && num(cut.value) > 0 && (cut.type === 'amount' || cut.type === 'installment')) {
      const sp = bankPays.map((x, i) => x - pays[i]); const pvS = sp.some(x => x) ? pv(sp, rate, method) : 0; let k = 1;
      if (cut.type === 'amount' && P > num(cut.value)) k = Math.max(0, (num(cut.value) - pvS) / (P - pvS));
      if (cut.type === 'installment') { const mx = Math.max.apply(null, pays); if (mx > num(cut.value)) k = num(cut.value) / mx; }
      if (k < 1) { pays = pays.map(p => p * k); bankPays = pays.map((p, i) => p + sp[i]); P = pv(bankPays, rate, method); res.reduced = cut.type; }
    }
    if (!(P > 0)) return Object.assign(res, { reason: 'NO_CAPACITY' });
    const FE = feeCalc(P, bank, cfg); const fee = FE.fee, vat = FE.vat;
    const totalPays = bankPays.reduce((a, b) => a + b, 0); const profit = totalPays - P;
    const st = stages(pays, rows); const pre = st.filter(s => !s.post), post = st.filter(s => s.post);
    const offersAvail = (bank.offers || []).filter(o => o.active !== false && num(o.rate) > 0).map(o => ({ id: o.id, title: o.title, kind: (o.entities && o.entities.length) ? 'entity' : (o.plan === 'fixed' ? 'fixed' : 'general'), entities: o.entities || [], plan: o.plan || 'any',
      eligibleNow: offerMatches(o, inp, o.plan && o.plan !== 'any' ? o.plan : plan, N, opt.entity) }));
    return Object.assign(res, { eligible: true, rate, method, offer: offer ? { id: offer.id, title: offer.title } : null, amount: P, amountR: r1(P), pays, clientPays: pays, monthlySupport: ms,
      stages: st, preStages: pre, postStages: post, firstInstallment: r1(pays[0]), maxInstallment: r1(Math.max.apply(null, pays)),
      profit, profitR: r1(profit), fee, vat, feeR: r1(fee + vat), totalDue: totalPays + fee + vat, totalDueR: r1(totalPays + fee + vat),
      propertyValueR: r1(P + (SA.upfrontCounted ? SA.upfront : 0) + (SA.etizaz ? SA.etizaz.amount : 0)), sup: SA, fees: FE, table: ptable(pays, rows), etz: etzInfo(SA.etizaz, rows, N), offers: offersAvail, recommended: !!bank.recommended });
  }
  function rank(list, cfg) {
    const by = cfg.ranking || 'amount';
    const key = { amount: (a, b) => b.amount - a.amount || a.profit - b.profit, installment: (a, b) => a.firstInstallment - b.firstInstallment || b.amount - a.amount, profit: (a, b) => a.profit - b.profit || b.amount - a.amount }[by] || ((a, b) => b.amount - a.amount);
    return list.slice().sort(key);
  }
  function compare(inp, cfg, opt) {
    opt = opt || {}; const pr = profile(inp, cfg, opt.now); pr.birth = inp.birth;
    const plan = opt.plan || cfg.default_plan || 'fixed';
    const all = (cfg.banks || []).map(b => quoteBank(b, inp, cfg, pr, { plan: (opt.plans || {})[b.id] || plan, months: opt.months, extend: opt.extend, trial: !!opt.trial, offerId: (opt.offers || {})[b.id], entity: opt.entity, cut: opt.cut }));
    const ok = rank(all.filter(x => x.eligible), cfg); const top = Math.max(1, num(cfg.top_n, 3));
    return { profile: pr, plan, months: opt.months, extend: !!opt.extend, capacity: capInfo(pr, inp, cfg, opt.months, !!opt.extend, !!opt.trial), results: ok, top: ok.slice(0, top), rest: ok.slice(top), excluded: all.filter(x => !x.eligible).map(x => ({ id: x.id, name: x.name, reason: x.reason, zeroFrom: x.zeroFrom, zeroTo: x.zeroTo, zeroPost: x.zeroPost })), etizaz: etizazPlan(inp, cfg), support: supportAmounts(inp, cfg) };
  }
  const API = { version: 'r51', consumerOverAt, etizazEligible, etizazPlan, etzAt, supportAmounts, feeCalc, matrixRow, ptable, etzInfo, dtiTier, dtiInfo, avgRule, pickRate, capInfo, rankScale, gradeOf, expectedBasic, r1, toHijri, fromHijri, addYears, monthsBetween, riyadhToday, validG, profile, durationCard, termCap, schedule, pv, quoteBank, compare, offerMatches, dtiRate, supportKey };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.F99RE42Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
