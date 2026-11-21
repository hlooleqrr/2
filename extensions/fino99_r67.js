/* FINO99 r67 — «استقطاعك العقاري زايد؟ افحص الآن» (service dbr_check). Guided chat; the check is computed and metered on the
   server (f99r67_client_state / f99r67_client_check: one atomic deduction only when a result is issued; same request id = replay).
   Owner panel via f99r67_owner. Scoped to .r67-*; does not touch any other package or bot. */
(function () {
  'use strict';
  const W = window, D = document, SVC = 'dbr_check', PEND = 'f99r67_pending_v1';
  const el = (t, c, x) => { const e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (p, t, fn, c) => { const b = el('button', 'r67-btn' + (c ? ' ' + c : ''), t); b.type = 'button'; b.onclick = fn; if (p) p.append(b); return b; };
  const digits = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٬,\s]/g, '').replace('٫', '.').replace(/ريال|ر\.س|SAR/gi, '');
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  const tpl = (s, o) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null) ? String(o[k]) : m);
  const cleanName = s => String(s || '').replace(/[<>{}\[\]\\\/"`$|=;:@#%^*~&+]/g, '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const uuid = () => (W.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const isOwner = () => { try { return !!(typeof activeAccess !== 'undefined' && activeAccess && activeAccess.record && activeAccess.record.owner && typeof finoCentralAdminToken !== 'undefined' && finoCentralAdminToken); } catch (e) { return false; } };
  const ent = () => { try { const e = finoCentralRestoreEntry(); return e && e.entryToken ? { t: e.entryToken, d: e.deviceId || finoCentralDeviceId() } : null; } catch (e) { return null; } };
  const riyadhAM = () => { try { return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hourCycle: 'h23' }).format(new Date())) < 12; } catch (e) { return new Date().getUTCHours() + 3 < 12; } };
  const amount = s => { const v = digits(s); if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) return null; const n = Number(v); return n > 0 ? v.replace(/^0+(?=\d)/, '') : null; };
  const getP = () => { try { return JSON.parse(localStorage.getItem(PEND) || 'null'); } catch (e) { return null; } };
  const setP = v => { try { v ? localStorage.setItem(PEND, JSON.stringify(v)) : localStorage.removeItem(PEND); } catch (e) {} };
  const isExp = () => !!(S && S.expires_at && Date.parse(S.expires_at) <= Date.now() + (S.skew || 0));
  const s12 = r => !!(r && r.data && /^S12_SESSION/.test(String(r.data.reason || ''))); // session-security layer blocked the call locally
  const DEF = { two_intro: 'لأنك ما تدري هل اعتمدت جهة التمويل الدعم السكني، حسبنا فحصك بالحالتين:', two_mixed: 'يا {name}، نتيجة فحصك الإرشادي تختلف حسب احتساب جهة التمويل للدعم السكني.',
    note_t1: 'إذا كان تمويلك العقاري ضمن برامج الدعم السكني فقد يختلف الحد الحسابي.', expired: 'انتهت صلاحية كودك', buy: 'اشتر كودًا جديدًا — {checks} فحوصات بـ{price} ريال' };
  // r67 codes used on this device (salted SHA-256 prefix, never the raw code): an expired r67 code re-entered here gets this package's
  // expiry screen + buy button instead of the generic renewal card (this package has no renewal). Other codes are passed through untouched.
  const KC = 'f99r67_codes_v1', normC = c => String(c || '').replace(/\s+/g, '').toUpperCase();
  async function hC(c) { const v = normC(c); if (v.length < 8 || !(W.crypto && crypto.subtle)) return ''; try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('f99r67|' + v)); return Array.from(new Uint8Array(b)).slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
  const known = () => { try { const a = JSON.parse(localStorage.getItem(KC) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  let typed = ''; const grab = () => { const i = D.getElementById('f99l-code'); if (i && i.value) typed = i.value; };
  D.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#f99l-enter')) grab(); }, true);
  D.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'f99l-code') grab(); }, true);
  async function remember() { let c = typed; try { if (!c && typeof f99LastAttemptedCode === 'string') c = f99LastAttemptedCode; } catch (e) {} const k = await hC(c); if (!k) return; const a = known(); if (!a.includes(k)) { a.push(k); try { localStorage.setItem(KC, JSON.stringify(a.slice(-20))); } catch (e) {} } }
  function storeBuy() { try { const p = ((W.FINO99ReadStorefront && W.FINO99ReadStorefront()) || {}).products || []; const x = p.find(y => y && y.key === 'pkg-r67-dbr-check'); return x ? { url: x.url, price: x.price, checks: Number(x.max_calculations) || 3, enabled: x.enabled !== false && x.sold_out !== true } : {}; /* r70: no re-purchase link while «نفدت أكواد هذه الباقة» */ } catch (e) { return {}; } }
  let T = {}, S = null, ui = null, I = null, busy = false, E0 = null, endBusy = false;

  function css() {
    if (D.getElementById('r67-style')) return; const s = el('style'); s.id = 'r67-style';
    s.textContent = `.r67-ov{--k:#0f1f3d;--m:#5b6b85;--l:#e2e8f2;--bg:#f6f8fc;--p:#0f5c7a;--ok:#047857;--bad:#b42335;position:fixed;left:0;right:0;top:var(--r67t,0);height:var(--r67h,100%);z-index:2147483200;background:rgba(10,20,40,.55);display:flex;align-items:flex-end;justify-content:center;font-family:Cairo,'Noto Kufi Arabic',system-ui,sans-serif;direction:rtl}
.r67-sheet{background:#fff;color:var(--k);width:100%;max-width:680px;height:94%;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
.r67-ov.kb .r67-sheet{height:100%;border-radius:0}
.r67-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--l)}
.r67-head b{flex:1;min-width:0;font-size:15px;line-height:1.5}
.r67-q{background:#eef6fa;color:var(--p);border:1px solid #cfe3ec;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}
.r67-x{border:0;background:var(--bg);width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;color:var(--k)}
.r67-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:12px 14px 18px;background:var(--bg);display:flex;flex-direction:column;gap:8px}
.r67-msg{max-width:88%;padding:10px 13px;border-radius:16px;font-size:15px;line-height:1.75;white-space:pre-line;word-break:break-word;align-self:flex-start;background:#fff;border:1px solid var(--l);border-top-right-radius:4px}
.r67-msg.me{align-self:flex-end;background:var(--p);color:#fff;border:0;border-top-left-radius:4px;border-top-right-radius:16px}
.r67-msg.warn{background:#fef2f2;border-color:#fecaca;color:var(--bad)}
.r67-msg.small{font-size:12.5px;color:var(--m);background:transparent;border:0;padding:2px 6px;max-width:100%}
.r67-dock{flex:0 0 auto;border-top:1px solid var(--l);background:#fff;padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;max-height:52%;overflow-y:auto}
.r67-row{display:flex;gap:8px;flex-wrap:wrap}
.r67-in{flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #b9cad5;border-radius:12px;color:var(--k);background:#fff}
.r67-btn{font:inherit;font-size:14.5px;font-weight:700;border:1px solid var(--l);background:#fff;color:var(--k);border-radius:12px;padding:10px 14px;min-height:44px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;flex:1 1 auto}
.r67-btn.pri{background:var(--p);color:#fff;border-color:var(--p)}
.r67-btn.buy{background:#b42335;color:#fff;border-color:#b42335}
.r67-btn:disabled{opacity:.5}
.r67-card{align-self:stretch;background:#fff;border:1px solid var(--l);border-radius:14px;padding:12px 13px;display:flex;flex-direction:column;gap:6px}
.r67-card h4{margin:0 0 2px;font-size:14px;color:var(--p)}
.r67-li{display:flex;justify-content:space-between;gap:10px;font-size:14px;line-height:1.6;border-bottom:1px dashed #edf1f6;padding:3px 0}
.r67-li span{color:var(--m)} .r67-li b{text-align:left;white-space:nowrap}
.r67-li .r67-ed{font-size:12px;min-height:30px;padding:3px 10px;flex:0 0 auto;margin-inline-start:6px}
.r67-big{margin-top:4px;text-align:center;border-radius:12px;padding:10px;background:#fff1f2;color:var(--bad);font-weight:800;font-size:15px}
.r67-big strong{display:block;font-size:30px;line-height:1.3}
.r67-end{text-align:center;gap:8px;padding:16px 14px;border:1.5px solid #f3c6cc;background:linear-gradient(180deg,#fff6f7,#fff);box-shadow:0 8px 22px rgba(15,31,61,.08)}
.r67-end h4{font-size:18px;line-height:1.6;color:var(--k)} .r67-end p{margin:0;font-size:14.5px;line-height:1.75;color:var(--k)} .r67-end .r67-end-q{font-weight:800;color:var(--p)}
.r67-end .r67-row{flex-direction:column;margin-top:6px} .r67-end .r67-btn{width:100%;box-sizing:border-box;min-height:50px;font-size:16px}
.r67-li span{flex:0 1 auto;min-width:0} .r67-li b{min-width:0;white-space:normal;overflow-wrap:anywhere}
.r67-big.ok{background:#ecfdf5;color:var(--ok)}
.r67-sub{font-size:12px;color:var(--m)}
.r67-own label{display:block;font-size:13px;font-weight:700;margin:8px 0 3px;color:#18465c}
.r67-own textarea,.r67-own input[type=text],.r67-own input[type=number],.r67-own input[type=url],.r67-own select{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 10px;border:1px solid #b9cad5;border-radius:10px}
.r67-own details{background:#fff;border:1px solid var(--l);border-radius:14px;padding:10px 12px}
.r67-own summary{font-weight:800;cursor:pointer;color:var(--p)}
.r67-own .r67-st{white-space:pre-wrap;font-size:13px;color:var(--m);line-height:1.7}`;
    D.head.append(s);
  }
  function vv() { if (!ui) return; const v = W.visualViewport; const h = v ? v.height : W.innerHeight, t = v ? v.offsetTop : 0;
    ui.ov.style.setProperty('--r67h', h + 'px'); ui.ov.style.setProperty('--r67t', t + 'px'); ui.ov.classList.toggle('kb', h < W.innerHeight * 0.8); }
  function shell(title, onX) {
    css(); close(); const ov = el('div', 'r67-ov'); const sh = el('div', 'r67-sheet'); const hd = el('div', 'r67-head');
    const q = el('span', 'r67-q'); q.hidden = true; const x = el('button', 'r67-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'إغلاق'); x.onclick = onX;
    hd.append(el('b', '', title), q, x); const body = el('div', 'r67-body'); const dock = el('div', 'r67-dock'); sh.append(hd, body, dock); ov.append(sh); D.body.append(ov);
    ui = { ov, body, dock, q }; vv(); if (W.visualViewport) { W.visualViewport.addEventListener('resize', vv); W.visualViewport.addEventListener('scroll', vv); }
    return ui;
  }
  function close() { if (ui && ui.ov) ui.ov.remove(); if (W.visualViewport) { W.visualViewport.removeEventListener('resize', vv); W.visualViewport.removeEventListener('scroll', vv); } ui = null; }
  const down = () => { if (ui) requestAnimationFrame(() => { ui.body.scrollTop = ui.body.scrollHeight; }); };
  const msg = (t, c) => { if (!ui) return null; const m = el('div', 'r67-msg' + (c ? ' ' + c : ''), t); ui.body.append(m); down(); return m; };
  const clear = () => { if (ui) ui.dock.replaceChildren(); };
  const quota = () => { if (!ui || !S) return; ui.q.hidden = false; ui.q.textContent = 'المتبقي ' + S.remaining + ' من ' + S.max; };
  function choices(opts, cb) { clear(); const r = el('div', 'r67-row'); opts.forEach(([lab, val]) => btn(r, lab, () => { clear(); msg(lab, 'me'); cb(val); })); ui.dock.append(r); }
  function textIn(kind, cb, ph) {
    clear(); const r = el('div', 'r67-row'); const i = el('input', 'r67-in'); i.type = 'text'; i.dir = 'rtl'; i.autocomplete = 'off';
    if (kind === 'num') { i.inputMode = 'decimal'; i.placeholder = ph || 'المبلغ بالريال'; } else { i.placeholder = ph || 'اكتب هنا'; i.maxLength = 40; }
    const err = el('div', 'r67-sub'); const go = () => {
      let v; if (kind === 'num') { v = amount(i.value); if (!v) { err.textContent = 'اكتب مبلغًا صحيحًا بالأرقام (مثال: 10000).'; return; } }
      else { v = cleanName(i.value); if (v.length < 2) { err.textContent = 'اكتب اسمك من فضلك.'; return; } }
      clear(); msg(kind === 'num' ? fmt(v) + ' ريال' : v, 'me'); cb(v); };
    i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    r.append(i); btn(r, 'إرسال', go, 'pri').style.flex = '0 0 auto'; ui.dock.append(r, err); setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  const YN = [['نعم', true], ['لا', false]];
  // ---------- question chain ----------
  function askName(next) { msg(T.ask_name); textIn('txt', v => { I.name = v; if (S) S.name = v; msg(tpl(riyadhAM() ? T.greet_am : T.greet_pm, { name: v })); next(); }, 'اسمك'); }
  const askIncome = next => { msg(T.q_income); textIn('num', v => { I.income = v; next(); }); };
  const askInst = next => { msg(T.q_inst); textIn('num', v => { I.instalments = v; next(); }); };
  function askSupport(next) {
    msg(T.q_support); choices(YN, v => {
      I.has_support = v; delete I.support; delete I.counted; delete I.included; if (!v) return next();
      msg(T.q_support_amount); textIn('num', a => { I.support = a; msg(tpl(T.q_support_counted, { name: I.name }));
        choices([['نعم، أضافوه', 'yes'], ['لا، ما أضافوه', 'no'], ['ما أدري', 'unknown']], c => { I.counted = c; if (c === 'no') return next();
          msg(tpl(T.q_included, { income: fmt(I.income) })); choices([['نعم، يشمله', 'yes'], ['لا، لا يشمله', 'no']], x => { I.included = x; next(); }); }); });
    });
  }
  const askLater = next => { msg(T.q_later); choices(YN, v => { I.later = v; next(); }); };
  function newCheck() {
    if (!S) return; if (S.remaining <= 0) return exhausted(); const nm = S.name || lastName(); I = {}; // r77: each check independent; the name is asked once per code
    if (S.used > 0 && S.remaining === 1) msg(T.start_3); else if (S.used === 1) msg(T.start_2);
    const rest = () => askIncome(() => askInst(() => askSupport(() => askLater(summary))));
    if (nm) { I.name = nm; rest(); } else askName(rest);
  }
  const yn = v => v ? 'نعم' : 'لا';
  const cntTxt = { yes: 'نعم', no: 'لا', unknown: 'ما أدري' };
  function summary() {
    const p = getP(); const locked = !!(p && p.input); const c = el('div', 'r67-card'); c.append(el('h4', '', 'ملخص بياناتك — راجعها قبل الفحص'));
    const li = (lab, val, edit) => { const r = el('div', 'r67-li'); const s = el('span', '', lab); const b = el('b', '', val); r.append(s, b);
      if (edit && !locked) { const e = btn(null, 'تعديل', () => { clear(); edit(summary); }, 'r67-ed'); r.append(e); } c.append(r); };
    li('الاسم', I.name, n => askName(n)); li('الدخل المعتمد', fmt(I.income) + ' ريال', askIncome); li('أقساطك الشهرية', fmt(I.instalments) + ' ريال', askInst);
    li('الدعم السكني الشهري', I.has_support ? fmt(I.support) + ' ريال' : 'لا يوجد', askSupport);
    if (I.has_support) { li('اعتمدته جهة التمويل', cntTxt[I.counted]); if (I.included) li('الدخل المذكور يشمل الدعم', I.included === 'yes' ? 'نعم' : 'لا'); }
    li('تمويل بعد العقاري', yn(I.later), askLater); ui.body.append(c); down();
    clear(); const r = el('div', 'r67-row'); const go = btn(r, 'إظهار نتيجة الفحص', () => send(go), 'pri'); ui.dock.append(r, el('div', 'r67-sub', 'لا يُخصم الفحص إلا عند ظهور النتيجة.'));
  }
  const payload = () => { const o = { name: I.name, income: String(I.income), instalments: String(I.instalments), has_support: I.has_support ? 'true' : 'false', later: I.later ? 'true' : 'false' };
    if (I.has_support) { o.support = String(I.support); o.counted = I.counted; if (I.included) o.included = I.included; } return o; };
  async function send(b) {
    if (busy) return; const e = ent() || E0; if (!e) return lost(); busy = true; if (b) b.disabled = true;
    let p = getP(); if (!p || p.tok !== e.t || !p.input) { p = { tok: e.t, rid: uuid(), input: payload() }; setP(p); }
    const wait = msg('جاري الفحص…', 'small');
    let r; try { r = await finoRpc('f99r67_client_check', { p_entry_token: e.t, p_device_id: e.d, p_request_id: p.rid, p_input: p.input }, 20000); } catch (x) { r = { ok: false, network: true }; }
    busy = false; if (wait) wait.remove();
    if (s12(r) || (!(r && r.ok) && isExp())) { clear(); if (isExp()) { setP(null); return expired(S && S.buy); } return lost(); }
    if (!r || !r.ok || !r.data) { msg('تعذر الاتصال بالمركزية. تحقق من الإنترنت ثم أعد المحاولة — لن يُخصم الفحص مرتين.', 'warn'); clear(); const row = el('div', 'r67-row'); const rb = btn(row, 'إعادة المحاولة', () => send(rb), 'pri'); ui.dock.append(row); return; }
    const d = r.data;
    if (d.ok) { setP(null); S.used = d.used; S.remaining = d.remaining; S.max = d.max; if (d.counted !== false || !S.results.some(x => x.seq === d.seq)) S.results = S.results.filter(x => x.seq !== d.seq).concat([{ seq: d.seq, result: d.result }]); quota(); return result(d.result, false); }
    setP(null);
    if (d.reason === 'CODE_EXPIRED') return expired(d.buy); if (d.reason === 'CHECKS_FINISHED') { S.remaining = 0; quota(); return exhausted(); }
    if (d.reason === 'SESSION_INVALID_OR_EXPIRED' || d.reason === 'NOT_THIS_PACKAGE') return lost();
    if (d.reason === 'NO_RESULT') msg(T.no_result); else if (d.reason === 'INPUT_CONFLICT') msg(T.conflict, 'warn'); else msg('بعض البيانات غير مكتملة أو غير صحيحة. راجعها ثم أعد المحاولة. لم يُخصم أي فحص.', 'warn');
    clear(); const row = el('div', 'r67-row'); btn(row, 'تعديل البيانات', () => { clear(); summary(); }, 'pri'); btn(row, 'تمام، خروج', exit); ui.dock.append(row);
  }
  function card(x, title, res) {
    const c = el('div', 'r67-card'); if (title) c.append(el('h4', '', title));
    const li = (a, b) => { const r = el('div', 'r67-li'); r.append(el('span', '', a), el('b', '', b)); c.append(r); };
    if (!x.available) { c.append(el('div', 'r67-sub', 'في هذه الحالة يبلغ الدخل ' + fmt(x.income) + ' ريال (25,000 أو أكثر)، وتحدد كل جهة تمويل النسبة حسب سياستها الائتمانية، فلا يظهر رقم حسابي.')); return c; }
    const st = res.has_support ? (x.support_included ? ' (شامل الدعم السكني ' + fmt(x.support) + ' ريال)' : ' (بدون الدعم السكني)') : '';
    li('الدخل المستخدم في الفحص', fmt(x.income) + ' ريال' + st); li('أقساطك الشهرية الحالية', fmt(x.instalments) + ' ريال');
    li('الحد الحسابي الإرشادي لأقساطك', fmt(x.limit) + ' ريال'); li('نسبة استقطاعك المحسوبة', Number(x.ratio).toFixed(1).replace(/\.0$/, '') + '%');
    const big = el('div', 'r67-big' + (x.overage > 0 ? '' : ' ok')); if (x.overage > 0) { big.append('مبلغ التجاوز الشهري المحسوب:', el('strong', '', fmt(x.overage) + ' ريال')); } else big.textContent = 'لا يظهر تجاوز حسابي';
    c.append(big); return c;
  }
  function result(res, review) {
    const rows = (res.rows || []), av = rows.filter(r => r.available), nm = res.name || '';
    if (rows.length > 1) {
      const w = rows.find(r => r.key === 'with') || rows[0], wo = rows.find(r => r.key === 'without') || rows[1];
      const o1 = w.available ? w.overage : null; msg(o1 > 0 ? tpl(T.over_1, { name: nm, amount: fmt(o1) }) : (av.some(r => r.overage > 0) ? tpl(T.two_mixed || DEF.two_mixed, { name: nm }) : tpl(T.no_over, { name: nm })));
      msg(T.two_intro || DEF.two_intro, 'small'); ui.body.append(card(w, 'إذا أضافت جهة التمويل الدعم السكني على راتبك', res), card(wo, 'إذا ما أضافت جهة التمويل الدعم السكني على راتبك', res));
    } else { const x = rows[0]; msg(x.overage > 0 ? tpl(T.over_1, { name: nm, amount: fmt(x.overage) }) : tpl(T.no_over, { name: nm })); ui.body.append(card(x, '', res)); }
    if (av.some(r => r.overage > 0)) msg(tpl(T.over_2, { name: nm }));
    if (av.some(r => r.basis === 't1_general')) msg(T.note_t1 || DEF.note_t1, 'small');
    msg(T.note, 'small'); down(); if (!review) after();
  }
  function after() {
    clear(); const row = el('div', 'r67-row');
    if (S.remaining > 0) { btn(row, 'فحص جديد', () => { clear(); newCheck(); }, 'pri'); btn(row, 'تمام، خروج', exit); ui.dock.append(row); }
    else endCard();
  }
  function buyRow(b, noReview) {
    clear(); const row = el('div', 'r67-row'); b = b || (S && S.buy) || {};
    if (b.url && /^https:\/\//.test(b.url) && b.enabled !== false) { const a = el('a', 'r67-btn buy', tpl(T.buy, { checks: b.checks || 3, price: b.price != null ? Number(b.price).toString() : '' })); a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; row.append(a); }
    if (!noReview && S && S.results && S.results.length) btn(row, 'نتائجي السابقة', review);
    btn(row, 'تمام، خروج', exit); ui.dock.append(row);
  }
  function review() { clear(); S.results.slice().sort((a, b) => a.seq - b.seq).forEach(x => { msg('الفحص ' + x.seq + ' — ' + (x.result.name || ''), 'small'); result(x.result, true); }); S.remaining > 0 ? after() : buyRow(S.buy, true); }
  function lastName() { return S && S.results && S.results.length ? S.results[S.results.length - 1].result.name || '' : ''; }
  // r77: all checks used → marketing card inside the package window (below the last result). No renewal of the old code: a new code is bought.
  function endCard() { clear(); if (!ui) return; const b = (S && S.buy) || {}, nm = (S && (S.name || lastName())) || '';
    const c = el('div', 'r67-card r67-end'); c.append(el('h4', '', '🎉 تم الانتهاء من فحوصاتك' + (nm ? ' يا ' + nm : '') + '!'), el('p', '', 'خلصت فحوصات باقتك الثلاث.'), el('p', 'r67-end-q', 'تبي تفحص مرة ثانية؟'), el('p', '', 'اشتر كود جديد، وابدأ 3 فحوصات جديدة خلال 24 ساعة من أول تفعيل للكود، أيهما ينتهي أولًا.'));
    const row = el('div', 'r67-row'); if (b.enabled !== false) { const a = el('a', 'r67-btn buy', 'اشتر كود جديد'); a.href = /^https:\/\//.test(b.url || '') ? b.url : 'https://salla.sa/HloolTamwilia/payment/p1508908354'; a.target = '_blank'; a.rel = 'noopener'; row.append(a); }
    btn(row, 'تمام، خروج', exit); c.append(row); ui.body.append(c); down(); }
  function exhausted() { endCard(); if (S && S.results && S.results.length) { const r = el('div', 'r67-row'); btn(r, 'نتائجي السابقة', review); ui.dock.append(r); } }
  function expired(b) { if (ui) ui.q.hidden = true; msg(T.expired || 'انتهت صلاحية كودك'); S = S || { results: [] }; S.results = []; buyRow(b || (S && S.buy), true); }
  function lost() { msg('انتهت جلسة الدخول. أدخل كودك مرة أخرى للمتابعة — نتائجك المحفوظة لا تضيع.', 'warn'); clear(); const row = el('div', 'r67-row'); btn(row, 'تمام، خروج', exit, 'pri'); ui.dock.append(row); }
  function exit() {
    E0 = null; close(); try { finoCentralClearEntry(); } catch (e) {} try { activeAccess = null; } catch (e) {} try { hideSubscriptionBadge(); } catch (e) {} try { showPage('page1'); } catch (e) {}
  }
  async function open() {
    shell('استقطاعك العقاري زايد؟ افحص الآن', exit); S = null; T = {};
    const e = ent(); E0 = e; if (!e) return lost(); const wait = msg('لحظات…', 'small');
    let r; try { r = await finoRpc('f99r67_client_state', { p_entry_token: e.t, p_device_id: e.d }, 15000); } catch (x) { r = { ok: false }; }
    if (wait) wait.remove();
    if (!r || !r.ok || !r.data) { msg('تعذر الاتصال بالمركزية. تحقق من الإنترنت ثم أعد المحاولة.', 'warn'); clear(); const row = el('div', 'r67-row'); btn(row, 'إعادة المحاولة', open, 'pri'); btn(row, 'خروج', exit); ui.dock.append(row); return; }
    const d = r.data; T = Object.assign({}, DEF, d.texts || {});
    if (d.ok === false) { if (d.reason === 'CODE_EXPIRED') return expired(d.buy); return lost(); }
    S = d; S.skew = d.server_now ? Date.parse(d.server_now) - Date.now() : 0; quota(); remember();
    const p = getP(); if (p && p.tok === e.t && p.input) { I = Object.assign({}, p.input, { has_support: p.input.has_support === 'true', later: p.input.later === 'true' }); msg('نكمل فحصك الذي لم يكتمل إرساله…', 'small'); summary(); return send(null); }
    if (p && p.tok !== e.t) setP(null);
    if (S.remaining <= 0) return exhausted();
    if (S.results.length) { clear(); const row = el('div', 'r67-row'); btn(row, 'ابدأ الفحص', () => { clear(); newCheck(); }, 'pri'); btn(row, 'نتائجي السابقة', () => { review(); }); ui.dock.append(row); msg('لديك ' + S.results.length + (S.results.length === 1 ? ' فحص محفوظ.' : ' فحوصات محفوظة.') + ' عرضها لا يخصم من رصيدك.', 'small'); return; }
    newCheck();
  }

  // ---------- owner panel ----------
  async function oc(action, data) {
    if (typeof finoCentralAdminCall !== 'function') throw Error('اتصال المركزية غير متاح');
    const r = await finoCentralAdminCall('f99r67_owner', { p_action: action, p_data: data || {} });
    if (!r || !r.ok) throw Error((r && (r.reason || (r.error && r.error.message))) || 'تعذر الاتصال بالمركزية'); if (r.data && r.data.ok === false) throw Error(r.data.reason || 'رفض الطلب'); return r.data;
  }
  const TXL = { ask_name: 'سؤال الاسم', greet_am: 'تحية الصباح', greet_pm: 'تحية المساء', q_income: 'سؤال الدخل', q_inst: 'سؤال الأقساط', q_support: 'سؤال الدعم السكني', q_support_amount: 'سؤال مبلغ الدعم',
    q_support_counted: 'سؤال اعتماد الدعم', q_included: 'توضيح شمول الدخل للدعم', q_later: 'سؤال التمويل اللاحق', start_2: 'بداية الفحص الثاني', start_3: 'بداية آخر فحص', over_1: 'نص التجاوز', over_2: 'تفسير التجاوز',
    note: 'الملاحظة الصغيرة', no_over: 'نص عدم التجاوز', exhausted: 'انتهاء الفحوصات', expired: 'انتهاء الصلاحية', buy: 'زر الشراء', no_result: 'لا نتيجة (25,000+)', conflict: 'تعارض البيانات',
    two_intro: 'مقدمة الحالتين', two_mixed: 'نتيجة مختلطة', note_t1: 'ملاحظة شريحة 15,000' };
  const RL = [['authority', 'الجهة'], ['product', 'المنتج'], ['t1_max', 'حد الشريحة الأولى (ريال)'], ['t1_pct', 'نسبة الشريحة الأولى %'], ['t1_supported_pct', 'نسبة الشريحة الأولى للمستفيد من الدعم %'],
    ['t2_max', 'بداية الشريحة الثالثة (ريال)'], ['t2_pct', 'نسبة الشريحة الثانية %'], ['t1_plain_mode', 'الشريحة الأولى بدون دعم (general/dual/beneficiary)'], ['effective', 'تاريخ السريان'], ['source', 'المصدر'], ['source_url', 'رابط المصدر'], ['verified_at', 'تاريخ التحقق']];
  const NUMR = ['t1_max', 't1_pct', 't1_supported_pct', 't2_max', 't2_pct'];
  async function ownerOpen() {
    shell('لوحة باقة «استقطاعك العقاري زايد؟»', close); const box = el('div', 'r67-own'); box.style.cssText = 'display:flex;flex-direction:column;gap:10px'; ui.body.append(box); ui.dock.hidden = true;
    const st = el('div', 'r67-st', 'جاري التحميل…'); box.append(st);
    let g, sk; try { [g, sk] = await Promise.all([oc('get'), oc('stock')]); } catch (e) { st.textContent = 'تعذر التحميل: ' + e.message; return; }
    const cfg = g.settings, pr = g.product || {}, s = sk.stock || {}; st.textContent = 'الإصدار ' + cfg.rev + ' • الأكواد: ' + s.total + ' (غير مفعّلة ' + s.fresh + '، مفعّلة ' + s.activated + ') • فحوصات منفذة ' + s.checks + ' • حالات للمراجعة ' + (g.open_flags || 0);
    const sec = (t, open) => { const d = el('details'); if (open) d.open = true; d.append(el('summary', '', t)); box.append(d); return d; };
    const fld = (p, lab, v, type) => { p.append(el('label', '', lab)); const i = type === 'area' ? el('textarea') : el('input'); if (type !== 'area') i.type = type || 'text'; else i.rows = 3; i.value = v == null ? '' : v; p.append(i); return i; };
    const out = p => { const o = el('div', 'r67-st'); p.append(o); return o; };
    // product
    const A = sec('بيانات الباقة (الاسم، الوصف، السعر، الرابط، الصورة)', true);
    const f = { name: fld(A, 'الاسم', pr.name), tagline: fld(A, 'الوصف', pr.tagline, 'area'), price: fld(A, 'السعر (ريال)', pr.price, 'number'), url: fld(A, 'رابط الشراء (منصة الدفع)', pr.url, 'url'),
      duration_note: fld(A, 'ملاحظة المدة', pr.duration_note), warning_text: fld(A, 'التنبيه', pr.warning_text), terms: fld(A, 'الشروط', pr.terms, 'area') };
    f.price.step = '0.01'; const en = fld(A, 'الباقة مفعّلة للبيع', '', 'checkbox'); en.checked = pr.enabled !== false; const vis = fld(A, 'ظاهرة في المتجر', '', 'checkbox'); vis.checked = pr.catalog_visible !== false;
    A.append(el('label', '', 'الصورة: ' + (pr.has_image ? 'موجودة' : 'لا توجد'))); const file = el('input'); file.type = 'file'; file.accept = 'image/*'; A.append(file); const imgUrl = fld(A, 'أو رابط صورة https', '', 'url');
    const oa = out(A); btn(A, 'حفظ بيانات الباقة', async () => {
      try { oa.textContent = 'جاري الحفظ…'; const d = {}; for (const k in f) { const v = k === 'price' ? Number(f[k].value) : f[k].value; if (String(v) !== String(pr[k] == null ? '' : pr[k])) d[k] = v; }
        if (en.checked !== (pr.enabled !== false)) d.enabled = en.checked; if (vis.checked !== (pr.catalog_visible !== false)) d.catalog_visible = vis.checked;
        if (file.files && file.files[0]) d.image_url = await shrink(file.files[0]); else if (imgUrl.value.trim()) d.image_url = imgUrl.value.trim();
        if (!Object.keys(d).length) { oa.textContent = 'لا توجد تغييرات.'; return; } const r = await oc('product', { product: d }); Object.assign(pr, r.product || {}); oa.textContent = 'تم الحفظ ✓ (يظهر للعميل مباشرة)'; } catch (e) { oa.textContent = 'تعذر الحفظ: ' + e.message; } }, 'pri');
    // policy
    const B = sec('عدد الفحوصات والصلاحية'); const mc = fld(B, 'عدد الفحوصات لكل كود', s.max_max || 3, 'number'); const hr = fld(B, 'الصلاحية بالساعات من أول تفعيل', Math.round((s.minutes || 1440) / 60), 'number'); const ob = out(B);
    btn(B, 'تطبيق على الأكواد غير المفعّلة', async () => { if (!confirm('سيُطبّق ' + mc.value + ' فحوصات و' + hr.value + ' ساعة على الأكواد غير المفعّلة فقط (' + s.fresh + ' كود). الأكواد المفعّلة لا تتغير. متابعة؟')) return;
      try { const r = await oc('apply_policy', { max_checks: Number(mc.value), hours: Number(hr.value), confirm: true }); ob.textContent = 'تم ✓ — عُدّل ' + r.updated + ' كود.'; } catch (e) { ob.textContent = 'تعذر: ' + e.message; } }, 'pri');
    // stock / export
    const C = sec('المخزون والتصدير'); C.append(el('div', 'r67-st', 'الإجمالي ' + s.total + ' • غير مفعّلة ' + s.fresh + ' • مفعّلة ' + s.activated + ' • منتهية ' + s.expired)); const oe = out(C);
    btn(C, 'تصدير الأكواد غير المفعّلة (TXT)', async () => { try { const r = await oc('export'); const blob = new Blob([r.codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'FINO99_DBR_CHECK_' + r.count + '_' + new Date().toISOString().slice(0, 10) + '.txt'; D.body.append(a); a.click(); a.remove(); oe.textContent = 'تم تصدير ' + r.count + ' كود (التصدير لا يغيّر حالة الأكواد).'; } catch (e) { oe.textContent = 'تعذر: ' + e.message; } }, 'pri');
    // texts
    const E = sec('نصوص المحادثة'); const tx = {}; Object.keys(cfg.texts).forEach(k => { tx[k] = fld(E, TXL[k] || k, cfg.texts[k], 'area'); }); const ot = out(E);
    btn(E, 'حفظ النصوص', async () => { const d = {}; for (const k in tx) if (tx[k].value !== cfg.texts[k]) d[k] = tx[k].value; if (!Object.keys(d).length) { ot.textContent = 'لا توجد تغييرات.'; return; }
      try { const r = await oc('save', { expected_rev: cfg.rev, texts: d, note: 'تعديل نصوص' }); Object.assign(cfg, r.settings); ot.textContent = 'تم الحفظ ✓ (الإصدار ' + cfg.rev + ')'; } catch (e) { ot.textContent = 'تعذر: ' + e.message; } }, 'pri');
    // rules
    const F = sec('القواعد ومصدرها (تتطلب اعتمادًا صريحًا)'); const rl = {}; RL.forEach(([k, lab]) => { rl[k] = fld(F, lab, cfg.rules[k], NUMR.includes(k) ? 'number' : 'text'); }); const orr = out(F);
    btn(F, 'مراجعة واعتماد تغيير القواعد', async () => { const d = {}; RL.forEach(([k]) => { const v = NUMR.includes(k) ? Number(rl[k].value) : rl[k].value; if (String(v) !== String(cfg.rules[k] == null ? '' : cfg.rules[k])) d[k] = v; });
      if (!Object.keys(d).length) { orr.textContent = 'لا توجد تغييرات.'; return; } const n = Object.assign({}, cfg.rules, d);
      const ok = confirm('اعتماد تغيير القواعد:\nالجهة: ' + n.authority + '\nالمنتج: ' + n.product + '\nالنسب: ' + n.t1_pct + '% حتى ' + n.t1_max + ' ريال (' + n.t1_supported_pct + '% للمستفيد من الدعم)، ' + n.t2_pct + '% حتى أقل من ' + n.t2_max + ' ريال\nتاريخ السريان: ' + n.effective + '\nالمصدر: ' + n.source + '\n' + (n.source_url || '') + '\n\nهل تعتمد هذا التغيير؟');
      if (!ok) return; try { const r = await oc('save', { expected_rev: cfg.rev, rules: d, confirm_rules: true, note: 'تعديل القواعد باعتماد المالك' }); Object.assign(cfg, r.settings); orr.textContent = 'تم الاعتماد ✓ (الإصدار ' + cfg.rev + ')'; } catch (e) { orr.textContent = 'تعذر: ' + e.message; } }, 'pri');
    // history
    const H = sec('السجل والتراجع'); const oh = out(H); btn(H, 'عرض السجل', async () => { try { const r = await oc('history'); oh.replaceChildren(); r.items.forEach(it => { const row = el('div', 'r67-li'); row.append(el('span', '', new Date(it.at).toLocaleString('ar-SA') + ' — ' + (it.note || it.action)));
      if (['save', 'rollback', 'product', 'rollback_product'].includes(it.action)) row.append(btn(null, 'تراجع', async () => { if (!confirm('استعادة الحالة التي كانت قبل هذا السجل؟' + (it.rules_changed ? '\n(يشمل تغيير القواعد — اعتماد صريح)' : ''))) return;
        try { await oc(it.product ? 'rollback_product' : 'rollback', { audit_id: it.id, confirm_rules: true }); oh.textContent = 'تم التراجع ✓ — أعد فتح اللوحة.'; } catch (e) { oh.textContent = 'تعذر: ' + e.message; } }, 'r67-ed')); oh.append(row); }); if (!r.items.length) oh.textContent = 'لا يوجد سجل.'; } catch (e) { oh.textContent = 'تعذر: ' + e.message; } });
    // flags
    const G = sec('حالات تعارض للمراجعة'); const og = out(G); btn(G, 'عرض الحالات', async () => { try { const r = await oc('flags'); og.replaceChildren(); r.items.forEach(it => { const row = el('div', 'r67-li'); const i = it.input || {};
      row.append(el('span', '', new Date(it.at).toLocaleString('ar-SA') + ' — ' + it.reason + ' — دخل ' + (i.income || '') + ' • أقساط ' + (i.instalments || '') + (i.support ? ' • دعم ' + i.support : '') + (it.resolved ? ' ✓' : '')));
      if (!it.resolved) row.append(btn(null, 'تمت المراجعة', async () => { await oc('resolve_flag', { id: it.id }); row.remove(); }, 'r67-ed')); og.append(row); }); if (!r.items.length) og.textContent = 'لا توجد حالات.'; } catch (e) { og.textContent = 'تعذر: ' + e.message; } });
  }
  function shrink(fileObj) { // owner image → data URL ≤ 108,000 chars (store limit 110,000)
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(Error('تعذر قراءة الصورة')); fr.onload = () => { const im = new Image(); im.onerror = () => rej(Error('ملف صورة غير صالح')); im.onload = () => {
      const cv = D.createElement('canvas'); for (const w of [1000, 900, 800, 720, 640, 560]) { const k = Math.min(1, w / im.width); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
        for (const q of [0.82, 0.72, 0.62]) { for (const t of ['image/webp', 'image/jpeg']) { const u = cv.toDataURL(t, q); if (u.startsWith('data:' + t) && u.length <= 108000) return res(u); } } } rej(Error('الصورة كبيرة جدًا؛ استخدم رابط https')); }; im.src = fr.result; }; fr.readAsDataURL(fileObj); }); }
  function tile() {
    if (!isOwner()) return; const g = D.querySelector('.f38-grid'); if (!g || g.querySelector('[data-k="r67"]')) return;
    const b = el('button', 'f38-tile'); b.type = 'button'; b.dataset.k = 'r67'; b.onclick = ownerOpen;
    b.append(el('span', 'f38-ic', '🧮'), el('b', '', 'باقة «استقطاعك العقاري زايد؟»'), el('small', '', 'الأكواد والتصدير والنصوص والقواعد والسجل'));
    const ref = g.querySelector('[data-k="packages"]'); if (ref) g.insertBefore(b, ref); else g.append(b);
  }
  function hook() {
    const orig = W.F99V13RunService; if (typeof orig !== 'function' || orig.__r67) return;
    const wrap = function (svc) { if (svc === SVC) { open(); return; } return orig.apply(this, arguments); };
    Object.assign(wrap, orig); wrap.__r67 = true; W.F99V13RunService = wrap; // keep other extensions' markers (no re-wrap loop)
  }
  // While the r67 bot is open, the platform's generic end screen (renewal offers) is replaced by this package's own state check:
  // expired → «انتهت صلاحية كودك» + buy button (no renewal); still valid → ignored. Other packages/screens are untouched.
  async function endCheck() {
    if (endBusy || !E0) return; endBusy = true; let r; try { r = await finoRpc('f99r67_client_state', { p_entry_token: E0.t, p_device_id: E0.d }, 15000); } catch (x) { r = null; } endBusy = false;
    if (!ui) return; const d = r && r.ok && r.data; if (d && d.ok) return; clear(); if ((d && d.reason === 'CODE_EXPIRED') || isExp()) { setP(null); return expired((d && d.buy) || S.buy); } lost();
  }
  function hookEnd() {
    const o = W.F99V23ShowEnd; if (typeof o !== 'function' || o.__r67) return;
    const w = function () { if (ui && E0 && S) { endCheck(); return; } return o.apply(this, arguments); };
    Object.assign(w, o); w.__r67 = true; W.F99V23ShowEnd = w;
  }
  function hookRen() {
    const R = W.F99Renewal22; if (!R || typeof R.open !== 'function' || R.open.__r67) return; const o = R.open;
    const w = async function (code, options) {
      if (!(options && options.exit === true)) { const k = await hC(code); if (k && known().includes(k)) { shell('استقطاعك العقاري زايد؟ افحص الآن', exit); T = Object.assign({}, DEF); S = { results: [] }; expired(storeBuy()); return true; } }
      return o.apply(this, arguments); };
    w.__r67 = true; R.open = w;
  }
  W.F99R67 = { open, ownerOpen, version: 'r67' };
  const tick = () => { try { hook(); hookEnd(); hookRen(); tile(); } catch (e) {} };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', tick); else tick();
  setInterval(tick, 1500);
})();
