/* FINO99 — owner-controlled calculation cap (UI side of central migration 06).
   The central functions are authoritative; this module only reads the owner cap,
   exposes it to existing validators (window.F99CalcCapNow) and lets the owner
   change it through f99_owner_calc_policy_save after an explicit save. */
(function (win, d) {
  'use strict';
  if (win.F99CalcPolicy) return;
  const DEFAULT_CAP = 300, ABS_MAX = 1000;
  let cap = DEFAULT_CAP, loaded = false, version = null, loading = null;
  const isOwner = () => { try { return !!activeAccess?.record?.central && !!activeAccess?.record?.owner && !!finoCentralAdminToken; } catch (e) { return false; } };
  const el = (tag, cls, text) => { const x = d.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
  async function admin(name, args) {
    if (!isOwner() || typeof win.finoCentralAdminCall !== 'function') throw Error('جلسة المالك مطلوبة');
    const r = await win.finoCentralAdminCall(name, args || {});
    if (!r?.ok || r.data?.ok !== true) throw Error(r?.data?.reason || r?.error?.message || 'رفضت المركزية الطلب');
    return r.data;
  }
  function applyToInputs() {
    // Only inputs that are explicitly calculation-quota fields of existing editors.
    d.querySelectorAll('input[type=number]').forEach(i => {
      const label = (i.closest('label')?.textContent || i.getAttribute('aria-label') || i.name || '').trim();
      if (/مرات الحسبة|الحسبات المسموحة|max_calculations/.test(label) && Number(i.max) > 0 && Number(i.max) !== cap && (Number(i.max) === 50 || Number(i.max) === 300 || i.dataset.f99CalcCap === '1')) {
        i.max = String(cap); i.dataset.f99CalcCap = '1';
      }
    });
  }
  async function refresh() {
    if (!isOwner()) return cap;
    if (loading) return loading;
    loading = admin('f99_owner_calc_policy').then(p => {
      const n = Number(p.max_calculations_cap);
      if (Number.isInteger(n) && n >= 1 && n <= ABS_MAX) { cap = n; loaded = true; version = p.version ?? null; }
      applyToInputs();
      return p;
    }).finally(() => { loading = null; });
    return loading;
  }
  win.F99CalcCapNow = () => cap;

  async function openOwner() {
    if (!isOwner()) return;
    d.getElementById('f99cp-owner')?.remove();
    const shade = el('div', 'f99me-shade'); shade.id = 'f99cp-owner';
    shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'سياسة عدد الحسبات');
    const box = el('main', 'f99me-sheet'); shade.append(box);
    const head = el('header', 'f99me-head'); head.append(el('strong', '', 'سياسة عدد الحسبات لكل كود'));
    const close = el('button', 'f99me-btn secondary', 'إغلاق دون حفظ'); close.type = 'button'; close.onclick = () => shade.remove(); head.append(close);
    box.append(head);
    const msg = el('p', 'f99me-msg', 'جاري قراءة السياسة من المركزية...'); msg.setAttribute('role', 'status'); box.append(msg);
    d.body.append(shade);
    let p;
    try { p = await refresh(); if (!p) throw Error('تعذر القراءة'); } catch (e) { msg.textContent = 'تعذر القراءة: ' + e.message; return; }
    msg.textContent = 'هذا الحد الأعلى يطبق في كل مكان تحدد فيه عدد الحسبات: محرر المتجر، سياسات الباقات والأكواد، تخصيص الأكواد من المخزون، وعروض وأكواد التجديد. لا يغير أكوادًا مباعة ولا يعيد ضبط حسبات أي عميل.';
    const facts = el('ul', 'f99me-facts');
    [['الحد الحالي', p.max_calculations_cap], ['أعلى قيمة مستخدمة الآن في باقاتك وعروضك', p.in_use_max], ['المسموح للضبط', '1 إلى ' + (p.absolute_max || ABS_MAX)], ['القيمة 0', 'غير محدود حيث تدعمه سياسات الباقات والأكواد']]
      .forEach(([k, v]) => { const li = el('li'); li.append(el('b', '', k + ': '), el('span', '', String(v))); facts.append(li); });
    box.append(facts);
    const form = el('form', 'f99me-form'); box.append(form);
    const l = el('label', 'f99me-field'); l.append(el('span', '', 'الحد الأعلى لعدد الحسبات لكل كود'));
    const input = el('input'); input.type = 'number'; input.min = String(Math.max(1, Number(p.in_use_max) || 1)); input.max = String(p.absolute_max || ABS_MAX); input.step = '1'; input.value = String(p.max_calculations_cap); input.id = 'f99cp-cap';
    l.append(input); form.append(l);
    const save = el('button', 'f99me-btn', 'حفظ واعتماد الحد في المركزية'); save.type = 'submit'; form.append(save);
    const out = el('p', 'f99me-msg'); out.setAttribute('role', 'status'); out.id = 'f99cp-status'; form.append(out);
    form.onsubmit = async ev => {
      ev.preventDefault();
      const n = Number(input.value);
      if (!Number.isInteger(n) || n < 1 || n > (p.absolute_max || ABS_MAX)) { out.textContent = 'أدخل عددًا صحيحًا من 1 إلى ' + (p.absolute_max || ABS_MAX) + '.'; return; }
      if (n < Number(p.in_use_max || 0)) { out.textContent = 'لا يمكن أن يكون الحد أقل من ' + p.in_use_max + ' لأن باقة أو عرضًا قائمًا يستخدم هذا العدد. عدل الباقة أو العرض أولًا.'; return; }
      if (!confirm('اعتماد الحد الأعلى لعدد الحسبات = ' + n + ' لكل الإعدادات الجديدة؟')) return;
      save.disabled = true; out.textContent = 'جاري الحفظ والتحقق...';
      try {
        const r = await admin('f99_owner_calc_policy_save', {p_max_calculations_cap: n, p_expected_version: version});
        if (r.verified !== true || Number(r.max_calculations_cap) !== n) throw Error('التحقق بعد الحفظ لم يطابق');
        cap = n; version = r.version; loaded = true; applyToInputs();
        out.textContent = 'تم الاعتماد والتحقق من المركزية: الحد الأعلى الآن ' + n + ' حسبة لكل كود.';
      } catch (e) {
        const m = String(e.message || e);
        out.textContent = m.includes('CALC_CAP_BELOW_ACTIVE_SETTINGS') ? 'الحد أقل من قيمة مستخدمة حاليًا في باقة أو عرض. عدّلها أولًا.' : m.includes('VERSION_CONFLICT') ? 'عدّل أحد غيرك السياسة الآن؛ أغلق النافذة وافتحها من جديد.' : 'لم يُحفظ: ' + m;
      } finally { save.disabled = false; }
    };
  }

  win.F99CalcPolicy = { refresh, openOwner, cap: () => cap, loaded: () => loaded };
  // Load the cap once an owner session exists; cheap single RPC, no polling loop after success.
  let tries = 0, fails = 0, busy = false;
  const timer = setInterval(() => {
    tries++;
    if (loaded || fails >= 5) { clearInterval(timer); return; }
    if (isOwner() && !busy) { busy = true; refresh().catch(() => { fails++; }).finally(() => { busy = false; }); }
    else if (tries > 2400) clearInterval(timer);
  }, 1500);
  d.addEventListener('focusin', ev => { if (loaded && ev.target?.matches?.('input[type=number]')) applyToInputs(); });
})(window, document);
