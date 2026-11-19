/* FINO99 — Smart Contracts System UI (f99k). Additive module.
 * Owner center: deals, new deal, templates (stages/roles/fields/options are data), independent code vault, notifications.
 * Party portal: a contract-vault code (FK-XXXXX-XXXXX) entered in the normal "أدخل الكود" box opens the party's own stage.
 * All decisions are enforced in the database functions (order, roles, versions, device limits, expiry, identity re-check).
 * All dynamic text is rendered with textContent (no HTML injection).
 * Legal boundary shown to users: in-platform approval is an internal timestamped record, not legal identity verification. */
(function () {
  'use strict';
  const W = window, D = document;
  if (!D || W.F99KContracts) return;

  const el = (tag, cls, text) => { const x = D.createElement(tag); if (cls) x.className = cls; if (text !== undefined && text !== null) x.textContent = String(text); return x; };
  const btn = (host, text, run, cls) => { const b = el('button', cls || 'f99k-btn', text); b.type = 'button'; b.onclick = run; host.append(b); return b; };
  const fmtDate = v => { if (!v) return '—'; try { return new Date(v).toLocaleString('ar-SA', {dateStyle: 'medium', timeStyle: 'short'}); } catch (e) { return String(v); } };
  const short = h => (h ? String(h).slice(0, 12) + '…' : '—');
  const isOwner = () => { try { return !!finoCentralAdminToken; } catch (e) { return false; } };
  const deviceId = () => { try { const d = W.finoCentralDeviceId?.(); if (d && /^[A-Za-z0-9_.:-]{8,128}$/.test(d)) return d; } catch (e) { /* fallback */ }
    let d = null; try { d = localStorage.getItem('F99K_DEVICE'); } catch (e) { /* private mode */ }
    if (!d) { d = 'k-' + (crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2))); try { localStorage.setItem('F99K_DEVICE', d); } catch (e) { /* ignore */ } }
    return d; };
  const CODE_RE = /^FK-?[A-Z0-9]{5}-?[A-Z0-9]{5}$/i;

  const REASONS = {
    K_CODE_INVALID: 'الكود غير صحيح أو غير مفعل.', K_CODE_EXPIRED: 'انتهت صلاحية الكود. تواصل مع إدارة FINO99 لتمديده.',
    K_DEVICE_LIMIT: 'استُخدم هذا الكود على العدد المسموح من الأجهزة.', K_TOO_MANY_ATTEMPTS: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول.',
    K_DEVICE_INVALID: 'تعذر تعريف هذا الجهاز. حدّث الصفحة وحاول.', K_SESSION_INVALID: 'انتهت الجلسة على هذا الجهاز. أدخل الكود من جديد.',
    K_BANNED: 'تعذر الدخول بهذا الكود.', K_BANNED_NEW: 'لا يمكن تنفيذ طلب جديد حاليًا. تواصل مع الإدارة.', K_DEAL_CLOSED: 'تم إغلاق هذا الطلب.', K_OFFER_EXPIRED: 'انتهت مدة صلاحية هذا العرض.',
    K_CODE_REVOKED: 'أُوقف هذا الكود وصدر كود بديل من الإدارة.', K_VERSION_CHANGED: 'صدرت نسخة أحدث من العقد؛ حُدّثت الصفحة فاقرأ النسخة الجديدة.',
    K_NOT_YOUR_STAGE: 'ليست مرحلتك الآن.', K_DEAL_CLOSED: 'هذه المعاملة مغلقة.', K_IDENTITY_MISMATCH: 'رقم الهوية المدخل للتحقق لا يطابق المسجل.',
    K_DEFER_RANGE: 'مدة التأجيل خارج الحد المسموح.', K_OPTION_INVALID: 'الخيار غير متاح.', K_NOTE_REQUIRED: 'اكتب السبب أو الملاحظة أولًا.',
    K_VAULT_EMPTY: 'خزنة أكواد العقود فارغة. أصدر أكوادًا من تبويب «خزنة الأكواد».', K_TEMPLATE_CONFLICT: 'عُدّل القالب من مكان آخر. أعد فتحه ثم احفظ.',
    K_TEMPLATE_DISABLED: 'القالب موقوف.', K_TEMPLATE_NOT_FOUND: 'القالب غير موجود.', K_BODY_LENGTH: 'نص العقد قصير جدًا أو طويل جدًا.', K_TITLE: 'عنوان العقد غير صالح.',
    K_CHECKLIST_INCOMPLETE: 'أكمل جميع بنود التحقق قبل الاعتماد النهائي.', K_AMOUNT_INVALID: 'المبلغ غير صحيح.', K_NOT_OWNER_STAGE: 'المرحلة الحالية ليست مرحلة الإدارة.',
    K_NO_CLARIFICATION: 'لا يوجد استفسار مفتوح.', K_DEAL_CLOSED_NEW_DEAL_REQUIRED: 'المعاملة مغلقة؛ أي تعديل يتطلب عقدًا جديدًا.', K_MINUTES_RANGE: 'المدة خارج النطاق.',
    K_PARTY_NOT_FOUND: 'الطرف غير موجود.', K_NO_RETURN_TARGET: 'لا توجد مرحلة يُعاد إليها.', K_ACTION_INVALID: 'الإجراء غير متاح في هذه المرحلة.', K_VAULT_COUNT_RANGE: 'العدد بين 1 و500.',
    K_FIELD_REQUIRED: 'حقل مطلوب: ', K_FIELD_ID: 'رقم الهوية يجب أن يكون 10 أرقام يبدأ بـ1 أو 2: ', K_FIELD_PHONE: 'رقم الجوال غير صحيح: ',
    K_FIELD_IBAN: 'رقم الآيبان يجب أن يبدأ بـ SA ويتكون من 24 خانة: ', K_FIELD_NUMBER: 'قيمة رقمية غير صحيحة: ', K_FIELD_DATE: 'تاريخ غير صحيح: ',
    K_FIELD_TOO_LONG: 'النص طويل جدًا: ', K_FIELD_INVALID: 'قيمة غير صحيحة: ', TRANSPORT: 'تعذر الاتصال بالمركزية. تحقق من الإنترنت وحاول.'
  };
  let labelOf = {};
  function reason(r) {
    const s = String(r || 'TRANSPORT'); const [code, arg] = s.split(':');
    const base = REASONS[code] || (code.startsWith('K_TEMPLATE') ? 'إعداد القالب غير صالح (' + s + ').' : 'تعذر التنفيذ (' + s + ').');
    return arg && base.endsWith(': ') ? base + (labelOf[arg] || arg) : base;
  }
  const ACTIONS = {created: 'إنشاء المعاملة', entered: 'دخول الطرف', resumed: 'عودة الطرف', submitted: 'إرسال البيانات', approved: 'موافقة',
    rejected: 'رفض', change_requested: 'طلب تعديل', clarification_requested: 'استفسار', clarification_answered: 'رد الإدارة على الاستفسار',
    new_version: 'إصدار نسخة جديدة', review_approved: 'اعتماد المراجعة', returned_for_correction: 'إعادة للتصحيح', deposit_confirmed: 'تأكيد العربون',
    service_completed: 'إنجاز الخدمة', final_approved: 'الاعتماد النهائي', completed: 'اكتمال المعاملة', cancelled: 'إلغاء',
    expired_code_attempt: 'محاولة بكود منتهي', device_limit_blocked: 'منع جهاز إضافي'};
  const actionLabel = a => { const s = String(a || ''); if (ACTIONS[s]) return ACTIONS[s];
    const [k, v] = s.split(':'); return ({'option': 'اختيار: ', 'archived': 'أرشفة: ', 'code_reissued': 'إعادة إصدار كود: ', 'code_extended': 'تمديد كود: ', 'sensitive_viewed': 'عرض بيانات حساسة: '}[k] || s + ' ') + (v || ''); };
  const STATUS = {active: 'جارية', completed: 'مكتملة', rejected: 'مرفوضة', cancelled: 'ملغاة', done: 'تمت', current: 'الحالية', pending: 'لاحقة',
    returned: 'أعيدت للتصحيح', reset: 'تحتاج إعادة موافقة', clarify: 'استفسار مفتوح', change_requested: 'طُلب تعديل'};
  const KINDS = {free: 'عقد حر', followup_deposit: 'متابعة بعربون', followup_plain: 'متابعة بدون عربون', deferred_sale: 'بيع بالأجل متعدد الأطراف', custom: 'قالب مخصص'};
  const SNAP = {final: 'النسخة النهائية', approved_contract: 'العقد المعتمد من الأطراف', agency_request: 'طلب التوكيل', rejected: 'أرشيف الرفض', cancelled: 'أرشيف الإلغاء'};
  const OPT_LABEL = {keep: 'الاحتفاظ بالسلعة', defer: 'تأجيل بيعها لمدة محددة', agent: 'توكيل شخص آخر لبيعها'};

  async function ocall(fn, args) {
    try { const r = await W.finoCentralAdminCall(fn, args || {}); if (!r || r.ok !== true) return {ok: false, reason: 'TRANSPORT'}; return r.data || {ok: false, reason: 'TRANSPORT'}; }
    catch (e) { return {ok: false, reason: 'TRANSPORT'}; }
  }
  async function pcall(fn, args) {
    try { const r = await W.finoRpc(fn, args || {}, 20000); if (!r || r.ok !== true) return {ok: false, reason: 'TRANSPORT'}; return r.data || {ok: false, reason: 'TRANSPORT'}; }
    catch (e) { return {ok: false, reason: 'TRANSPORT'}; }
  }
  async function copy(text, b) {
    try { await navigator.clipboard.writeText(text); if (b) { const o = b.textContent; b.textContent = 'نُسخ ✓'; setTimeout(() => { b.textContent = o; }, 1400); } }
    catch (e) { W.prompt?.('انسخ النص:', text); }
  }

  /* ---------- printable archive (save as PDF from the print sheet) ---------- */
  function printSnapshot(snap) {
    const p = snap?.payload || {}; let host = D.getElementById('f99k-print');
    if (host) host.remove();
    host = el('section'); host.id = 'f99k-print'; host.dir = 'rtl';
    host.append(el('h1', '', 'FINO99 — ' + (p.title || 'عقد')));
    const meta = el('p', 'f99k-print-meta', 'المرجع: ' + (p.ref || '—') + ' • النوع: ' + (KINDS[p.kind] || p.kind || '—') + ' • ' + (SNAP[snap.kind] || snap.kind) +
      ' • النسخة: ' + (p.version ?? '—') + ' • الحالة: ' + (STATUS[p.status] || p.status || '—'));
    host.append(meta, el('p', 'f99k-print-meta', 'بصمة الأرشيف SHA-256: ' + (snap.sha256 || '—')), el('p', 'f99k-print-meta', 'بصمة النص: ' + (p.body_sha256 || '—') + ' • تاريخ الأرشفة: ' + fmtDate(snap.created_at)));
    host.append(el('h2', '', 'نص العقد'), el('pre', 'f99k-print-body', p.body || ''));
    const shared = Object.values(p.shared || {}); if (shared.length) { host.append(el('h2', '', 'بيانات المعاملة')); const ul = el('ul'); shared.forEach(x => ul.append(el('li', '', (x.label || '') + ': ' + (x.value || '')))); host.append(ul); }
    if (Array.isArray(p.parties)) { host.append(el('h2', '', 'الأطراف')); const ul = el('ul');
      p.parties.forEach(x => { const masked = Object.entries(x.sensitive_masked || {}).map(([k, v]) => (labelOf[k] || k) + ' ' + v).join(' • ');
        ul.append(el('li', '', (x.label || x.role) + (masked ? ' — ' + masked : ''))); }); host.append(ul); }
    if (Array.isArray(p.stages)) { host.append(el('h2', '', 'المراحل')); const ul = el('ul');
      p.stages.forEach(s => ul.append(el('li', '', s.label + ' — ' + (STATUS[s.status] || s.status) + (s.at ? ' — ' + fmtDate(s.at) : '') + (s.version ? ' — نسخة ' + s.version : '')))); host.append(ul); }
    if (p.extra) { host.append(el('h2', '', 'تفاصيل إضافية')); const ul = el('ul'); Object.entries(p.extra).forEach(([k, v]) => { if (k !== 'notice') ul.append(el('li', '', (labelOf[k] || k) + ': ' + v)); }); host.append(ul);
      if (p.extra.notice) host.append(el('p', 'f99k-print-note', p.extra.notice)); }
    if (Array.isArray(p.events)) { host.append(el('h2', '', 'سجل التدقيق')); const ul = el('ul'); p.events.forEach(e => ul.append(el('li', '', fmtDate(e.at) + ' — ' + actionLabel(e.action) + (e.version ? ' (نسخة ' + e.version + ')' : '')))); host.append(ul); }
    host.append(el('p', 'f99k-print-note', p.notice || ''));
    D.body.append(host); D.documentElement.classList.add('f99k-printing');
    const done = () => { D.documentElement.classList.remove('f99k-printing'); host.remove(); W.removeEventListener('afterprint', done); };
    W.addEventListener('afterprint', done);
    setTimeout(() => { try { W.print(); } catch (e) { done(); } }, 60);
    setTimeout(() => { if (D.documentElement.classList.contains('f99k-printing') && !W.matchMedia?.('print').matches) done(); }, 120000);
  }

  /* ---------- shared sheet ---------- */
  let sheetRoot = null, timer = null;
  function openSheet(title, sub) {
    closeSheet();
    sheetRoot = el('div', 'f99k-shade'); sheetRoot.id = 'f99k-sheet'; sheetRoot.setAttribute('role', 'dialog'); sheetRoot.setAttribute('aria-modal', 'true'); sheetRoot.setAttribute('aria-label', title);
    const sheet = el('main', 'f99k-panel'); sheetRoot.append(sheet);
    const head = el('header', 'f99k-head'); const t = el('div'); t.append(el('small', '', sub || 'FINO99'), el('h2', '', title)); head.append(t);
    const tools = el('div', 'f99k-tools'); head.append(tools); btn(tools, 'إغلاق', closeSheet, 'f99k-btn small ghost');
    const status = el('p', 'f99k-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const body = el('div', 'f99k-body'); sheet.append(head, status, body); D.body.append(sheetRoot);
    sheetRoot.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    return {sheet, head, tools, status, body};
  }
  function closeSheet() { if (timer) clearInterval(timer); timer = null; sheetRoot?.remove(); sheetRoot = null; }
  const busyGuard = () => { const a = D.activeElement; return !!(sheetRoot && a && sheetRoot.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)); };

  function fieldInput(f, value) {
    const wrap = el('label', 'f99k-field' + (f.type === 'checkbox' ? ' check' : ''));
    let input;
    if (f.type === 'textarea') { input = el('textarea'); input.rows = 3; }
    else { input = el('input'); input.type = {number: 'text', date: 'date', checkbox: 'checkbox', phone: 'tel'}[f.type] || 'text';
      if (f.type === 'number' || f.type === 'id') input.inputMode = f.type === 'id' ? 'numeric' : 'decimal';
      if (f.type === 'id') input.maxLength = 10; if (f.type === 'iban') input.maxLength = 34; }
    input.dataset.key = f.key; input.dataset.type = f.type || 'text';
    if (f.type === 'checkbox') input.checked = value === 'true' || value === true; else if (value !== undefined && value !== null) input.value = String(value);
    if (f.required) input.required = true; input.setAttribute('aria-label', f.label);
    const lab = el('span', '', f.label + (f.required ? ' *' : '') + (f.sensitive ? ' (محمي)' : ''));
    if (f.type === 'checkbox') wrap.append(input, lab); else wrap.append(lab, input);
    return wrap;
  }
  const collect = host => { const o = {}; host.querySelectorAll('[data-key]').forEach(i => { o[i.dataset.key] = i.type === 'checkbox' ? (i.checked ? 'true' : 'false') : i.value.trim(); }); return o; };

  function timeline(host, stages) {
    const ol = el('ol', 'f99k-timeline');
    (stages || []).forEach(s => { const li = el('li', 'f99k-step ' + (s.status || 'pending'));
      li.append(el('b', '', s.label), el('small', '', (s.role_label ? s.role_label + ' • ' : '') + (STATUS[s.status] || s.status || '') + (s.at ? ' • ' + fmtDate(s.at) : '')));
      if (s.state?.note) li.append(el('small', 'f99k-note', 'ملاحظة: ' + s.state.note)); if (s.state?.reply) li.append(el('small', 'f99k-note', 'رد الإدارة: ' + s.state.reply));
      ol.append(li); });
    host.append(ol);
  }

  /* =================== PARTY PORTAL =================== */
  const PKEY = 'F99K_PARTY_SESSION';
  async function partyEnter(code, errorEl) {
    const c = String(code || '').toUpperCase().replace(/\s+/g, '');
    const r = await pcall('f99k_party_enter', {p_code: c, p_device_id: deviceId()});
    if (r.ok !== true) { if (errorEl) { errorEl.textContent = (r.msg && r.msg.t) || reason(r.reason); errorEl.style.display = 'block'; } return false; }
    try { sessionStorage.setItem(PKEY, r.session); } catch (e) { /* ignore */ }
    if (errorEl) { errorEl.textContent = ''; }
    await partyOpen(r.session);
    return true;
  }
  async function partyOpen(session) {
    const ui = openSheet('بوابة أطراف العقود', 'FINO99 | دخول بكود عقد مستقل');
    let view = null;
    async function load() {
      const r = await pcall('f99k_party_view', {p_session: session, p_device_id: deviceId()});
      if (!sheetRoot) return;
      if (r.ok !== true) { ui.status.textContent = (r.msg && r.msg.t) || reason(r.reason); if (/SESSION|REVOKED|EXPIRED/.test(String(r.reason))) { try { sessionStorage.removeItem(PKEY); } catch (e) { /* ignore */ } } return; }
      view = r; draw();
    }
    function draw() {
      const v = view; const b = ui.body; b.replaceChildren(); labelOf = {};
      (v.stage?.fields || []).forEach(f => { labelOf[f.key] = f.label; });
      const card = el('section', 'f99k-card'); card.append(el('h3', '', v.title), el('p', 'f99k-muted', 'المرجع ' + v.ref + ' • ' + (KINDS[v.kind] || '') + ' • صفتك: ' + v.role_label + ' • الحالة: ' + (STATUS[v.status] || v.status)));
      card.append(el('p', 'f99k-muted', 'النسخة ' + v.version + ' • بصمة النص ' + short(v.body_sha256) + (v.code_expires_at ? ' • صلاحية الكود حتى ' + fmtDate(v.code_expires_at) : '')));
      if (v.notice) card.append(el('p', 'f99k-notice', v.notice)); b.append(card); W.F99R52K?.centerExtra?.(b, v, {session, dev: deviceId()});
      const tl = el('section', 'f99k-card'); tl.append(el('h3', '', 'مراحل المعاملة')); timeline(tl, v.timeline); b.append(tl);
      const shared = Object.values(v.shared || {}); if (shared.length) { const sc = el('section', 'f99k-card'); sc.append(el('h3', '', 'بيانات المعاملة'));
        const dl = el('dl', 'f99k-dl'); shared.forEach(x => dl.append(el('dt', '', x.label), el('dd', '', x.value))); sc.append(dl); b.append(sc); }
      if (v.body) { const bc = el('section', 'f99k-card'); bc.append(el('h3', '', 'نص العقد (النسخة ' + v.version + ')')); bc.append(el('pre', 'f99k-bodytext', v.body)); b.append(bc); }
      const masked = Object.entries(v.my_sensitive_masked || {}); if (masked.length) { const mc = el('section', 'f99k-card'); mc.append(el('h3', '', 'بياناتك المحمية (مخفية)'));
        mc.append(el('p', 'f99k-muted', masked.map(([k, x]) => (labelOf[k] || k) + ': ' + x).join(' • '))); b.append(mc); }
      if (v.stage) b.append(stageForm(v)); else if (v.status === 'active') b.append(el('p', 'f99k-wait', 'بانتظار: ' + (v.waiting_for || 'الطرف التالي') + '. ستتحدث هذه الصفحة تلقائيًا.'));
      else b.append(el('p', 'f99k-wait', 'المعاملة ' + (STATUS[v.status] || v.status) + '.'));
      if ((v.snapshots || []).length) { const ac = el('section', 'f99k-card'); ac.append(el('h3', '', 'الأرشيف والنسخ المعتمدة'));
        v.snapshots.forEach(s => { const row = el('div', 'f99k-row'); row.append(el('span', '', (SNAP[s.kind] || s.kind) + ' • نسخة ' + s.version + ' • ' + fmtDate(s.created_at)));
          btn(row, 'عرض / حفظ PDF', async () => { const r = await pcall('f99k_party_snapshot', {p_session: session, p_device_id: deviceId(), p_snapshot_id: s.id}); if (r.ok) printSnapshot(r); else ui.status.textContent = reason(r.reason); }, 'f99k-btn small');
          ac.append(row); }); b.append(ac); }
      ui.status.textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-SA');
    }
    function stageForm(v) {
      const st = v.stage; const box = el('section', 'f99k-card f99k-action'); box.append(el('h3', '', 'مرحلتك الآن: ' + st.label));
      if (st.note) box.append(el('p', 'f99k-muted', st.note));
      if (st.state?.status === 'returned' && st.state?.note) box.append(el('p', 'f99k-warn', 'أعيدت إليك هذه المرحلة: ' + st.state.note));
      if (st.state?.status === 'clarify') box.append(el('p', 'f99k-warn', 'استفسارك: ' + (st.state.note || '') + (st.state.reply ? ' — رد الإدارة: ' + st.state.reply : ' — بانتظار رد الإدارة.')));
      if (st.state?.status === 'reset') box.append(el('p', 'f99k-warn', 'صدرت نسخة جديدة من العقد؛ يلزم قراءتها والموافقة عليها من جديد.'));
      const form = el('div', 'f99k-form'); box.append(form);
      const msg = el('p', 'f99k-error'); msg.setAttribute('role', 'alert');
      const run = async (action, data) => { msg.textContent = ''; const r = await pcall('f99k_party_act', {p_session: session, p_device_id: deviceId(), p_action: action, p_data: data, p_version: v.version});
        if (r.ok !== true) { msg.textContent = reason(r.reason); if (r.reason === 'K_VERSION_CHANGED') await load(); return; } view = r; draw(); };
      if (st.action === 'submit' || st.action === 'sign') {
        (st.fields || []).forEach(f => form.append(fieldInput(f, v.my_data?.[f.key])));
        if (st.verify_identity) form.append(fieldInput({key: 'id_confirm', label: 'أعد إدخال رقم هويتك للتحقق', type: 'id', required: true}, ''));
        const acts = el('div', 'f99k-actions'); box.append(acts);
        if (st.action === 'submit') btn(acts, 'إرسال', () => run('submit', collect(form)), 'f99k-btn primary');
        else {
          btn(acts, W.F99R52K?.btnLabel ? W.F99R52K.btnLabel(v, {action: 'sign'}) : 'أوافق على ' + v.title, () => run('approve', collect(form)), 'f99k-btn primary');
          const note = el('textarea', 'f99k-note-input'); note.rows = 2; note.placeholder = 'اكتب السبب أو الاستفسار هنا'; note.setAttribute('aria-label', 'السبب أو الاستفسار'); box.insertBefore(note, acts);
          btn(acts, 'استفسار', () => run('clarify', {reason: note.value.trim()}), 'f99k-btn');
          if (st.allow_change_request) btn(acts, 'طلب تعديل', () => run('request_change', {reason: note.value.trim()}), 'f99k-btn');
          btn(acts, 'رفض', () => { if (W.confirm('تأكيد رفض العقد؟ سيتم إغلاق المعاملة.')) run('reject', {reason: note.value.trim()}); }, 'f99k-btn danger');
        }
      } else if (st.action === 'options') {
        const opts = el('div', 'f99k-options'); form.append(opts); let chosen = null; const extra = el('div', 'f99k-form');
        (st.options || []).forEach(o => { const l = el('label', 'f99k-field check'); const r = el('input'); r.type = 'radio'; r.name = 'f99k-opt'; r.value = o.key;
          r.onchange = () => { chosen = o.key; extra.replaceChildren();
            if (o.key === 'defer') extra.append(fieldInput({key: 'months', label: 'مدة التأجيل بالأشهر (حتى ' + (v.defer_max_months || 12) + ')', type: 'number', required: true}, ''));
            if (o.key === 'agent') { [{key: 'agent_name', label: 'اسم الوكيل', type: 'text', required: true}, {key: 'agent_id', label: 'هوية الوكيل', type: 'id', required: true, sensitive: true},
              {key: 'agent_phone', label: 'جوال الوكيل', type: 'phone', required: true, sensitive: true}].forEach(f => { labelOf[f.key] = f.label; extra.append(fieldInput(f, '')); });
              extra.append(el('p', 'f99k-muted', 'سيصدر طلب توكيل داخلي مرتبط بالعقد والسلعة. إذا كانت الوكالة تتطلب إصدارًا رسميًا فتُستكمل عبر ناجز أو الجهة المختصة.')); } };
          l.append(r, el('span', '', o.label || OPT_LABEL[o.key] || o.key)); opts.append(l); });
        form.append(extra); const acts = el('div', 'f99k-actions'); box.append(acts);
        btn(acts, 'تأكيد الاختيار', () => { if (!chosen) { msg.textContent = 'اختر أحد الخيارات.'; return; } run('choose', {option: chosen, ...collect(extra)}); }, 'f99k-btn primary');
      }
      box.append(msg); return box;
    }
    btn(ui.tools, 'تحديث', () => void load(), 'f99k-btn small ghost');
    btn(ui.tools, 'خروج', () => { try { sessionStorage.removeItem(PKEY); } catch (e) { /* ignore */ } closeSheet(); }, 'f99k-btn small ghost');
    ui.status.textContent = 'جاري التحميل...';
    await load();
    timer = setInterval(() => { if (!busyGuard() && D.visibilityState === 'visible') void load(); }, 20000);
  }

  // Intercept contract-vault codes typed into the normal code box (capture phase, before the package-code handler).
  function hookLogin() {
    const handle = ev => {
      const input = D.getElementById('f99l-code'); if (!input) return;
      const v = String(input.value || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!CODE_RE.test(v)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const err = D.getElementById('f99l-error'); if (err) { err.textContent = 'جاري فتح بوابة العقد...'; err.style.display = 'block'; }
      void partyEnter(v, err).then(ok => { if (ok && err) { err.textContent = ''; err.style.display = 'none'; } });
    };
    D.addEventListener('click', ev => { if (ev.target?.closest?.('#f99l-enter')) handle(ev); }, true);
    D.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target?.id === 'f99l-code') handle(ev); }, true);
  }

  /* =================== OWNER CENTER =================== */
  let templates = [];
  async function loadTemplates() { const r = await ocall('f99k_owner_templates'); if (r.ok) templates = r.items || []; return r; }
  function tplLabels(t) { labelOf = {}; (t?.stages || []).forEach(s => (s.fields || []).forEach(f => { labelOf[f.key] = f.label; })); }

  async function openOwner(tab, dealId) {
    if (!isOwner()) { W.alert?.('سجّل دخول المالك أولًا.'); return; }
    const ui = openSheet('نظام العقود الذكي', 'FINO99 | للمالك فقط');
    const tabs = el('nav', 'f99k-tabs'); ui.sheet.insertBefore(tabs, ui.status);
    const TABS = [['deals', 'المعاملات'], ['new', 'عقد جديد'], ['templates', 'القوالب والمراحل'], ['vault', 'خزنة الأكواد'], ['alerts', 'الإشعارات']];
    let current = tab || 'deals', currentDeal = dealId || null;
    const tabBtns = {};
    TABS.forEach(([k, l]) => { tabBtns[k] = btn(tabs, l, () => { currentDeal = null; show(k); }, 'f99k-tab'); });
    async function badge() { const r = await ocall('f99k_owner_notifications', {p_limit: 1}); if (r.ok && tabBtns.alerts) tabBtns.alerts.textContent = 'الإشعارات' + (r.unseen ? ' (' + r.unseen + ')' : ''); updateHubBadge(r.unseen || 0); }
    async function show(k) {
      current = k; Object.entries(tabBtns).forEach(([x, b]) => b.classList.toggle('on', x === k)); ui.body.replaceChildren(); ui.status.textContent = 'جاري التحميل...';
      try {
        if (k === 'deals') await (currentDeal ? dealView(ui, currentDeal, () => show('deals')) : dealsList(ui, id => { currentDeal = id; show('deals'); }));
        else if (k === 'new') await newDeal(ui, id => { currentDeal = id; show('deals'); });
        else if (k === 'templates') await templatesView(ui);
        else if (k === 'vault') await vaultView(ui);
        else if (k === 'alerts') await alertsView(ui, id => { currentDeal = id; show('deals'); });
      } catch (e) { ui.status.textContent = 'تعذر عرض القسم.'; }
      void badge();
    }
    await loadTemplates(); await show(current);
    timer = setInterval(() => { if (!busyGuard() && D.visibilityState === 'visible' && (current === 'deals' || current === 'alerts')) void show(current); }, 25000);
  }

  async function dealsList(ui, openDeal) {
    const r = await ocall('f99k_owner_deals', {p_limit: 100});
    if (!r.ok) { ui.status.textContent = reason(r.reason); return; }
    const c = r.counts || {}; const b = ui.body;
    const kp = el('section', 'f99k-kpis'); [['جارية', c.active], ['مكتملة', c.completed], ['مرفوضة', c.rejected], ['ملغاة', c.cancelled], ['أحداث جديدة', r.unseen]].forEach(([l, v]) => { const a = el('article', 'f99k-kpi'); a.append(el('small', '', l), el('b', '', v ?? 0)); kp.append(a); });
    b.append(kp);
    const filter = el('select', 'f99k-select'); filter.setAttribute('aria-label', 'تصفية المعاملات');
    [['', 'كل المعاملات'], ['owner', 'بانتظاري'], ['active', 'جارية'], ['completed', 'مكتملة'], ['rejected', 'مرفوضة'], ['cancelled', 'ملغاة']].forEach(([v, l]) => filter.append(new Option(l, v)));
    const list = el('div', 'f99k-list'); b.append(filter, list);
    const draw = () => { list.replaceChildren(); const f = filter.value;
      const items = (r.items || []).filter(x => !f || (f === 'owner' ? x.owner_turn : x.status === f));
      if (!items.length) list.append(el('p', 'f99k-muted', 'لا توجد معاملات بهذا التصنيف.'));
      items.forEach(x => { const row = el('article', 'f99k-item' + (x.owner_turn ? ' turn' : ''));
        const t = el('div'); t.append(el('b', '', x.title), el('small', '', x.ref + ' • ' + (KINDS[x.kind] || x.kind) + ' • ' + (STATUS[x.status] || x.status) + ' • نسخة ' + x.version));
        if (x.stage_label) t.append(el('small', '', 'المرحلة: ' + x.stage_label + ' — بانتظار ' + (x.waiting_for || '')));
        row.append(t); if (x.unseen) row.append(el('span', 'f99k-pill', x.unseen + ' جديد'));
        btn(row, 'فتح', () => openDeal(x.id), 'f99k-btn small'); list.append(row); }); };
    filter.onchange = draw; draw();
    ui.status.textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-SA');
  }

  function partiesCard(ui, d, refresh) {
    const pc = el('section', 'f99k-card'); pc.append(el('h3', '', 'الأطراف وأكواد الدخول'));
    (d.parties || []).forEach(p => { const row = el('div', 'f99k-party');
      const info = el('div'); info.append(el('b', '', p.label), el('small', '', 'الكود: ' + (p.code || '—') + ' • ' + (p.code_status === 'assigned' ? 'فعال' : p.code_status) +
        ' • صلاحية ' + p.valid_minutes + ' دقيقة • الأجهزة ' + p.devices_used + '/' + p.device_limit + (p.expires_at ? ' • ينتهي ' + fmtDate(p.expires_at) : ' • لم يُستخدم بعد') + (p.last_seen_at ? ' • آخر ظهور ' + fmtDate(p.last_seen_at) : '')));
      const masked = Object.entries(p.sensitive_masked || {}); if (masked.length) info.append(el('small', '', masked.map(([k, v]) => (labelOf[k] || k) + ' ' + v).join(' • ')));
      row.append(info); const acts = el('div', 'f99k-actions'); row.append(acts);
      btn(acts, 'نسخ رسالة الدخول', e => copy('كود دخولك لعقد FINO99 (' + d.ref + ') بصفتك ' + p.label + ': ' + p.code + '\nادخل www.fino99.com ثم «أدخل الكود».', e.currentTarget), 'f99k-btn small');
      if (d.status === 'active') {
        btn(acts, 'تمديد', async () => { const h = W.prompt('مدة التمديد بالساعات:', '24'); const m = Math.round(Number(h) * 60); if (!m) return; const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'extend_code', p_data: {role: p.role, minutes: m}}); ui.status.textContent = r.ok ? 'تم التمديد.' : reason(r.reason); refresh(); }, 'f99k-btn small ghost');
        btn(acts, 'كود بديل', async () => { if (!W.confirm('إيقاف الكود الحالي لهذا الطرف وإصدار كود بديل من الخزنة؟')) return; const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'reissue_code', p_data: {role: p.role}}); ui.status.textContent = r.ok ? 'صدر كود بديل: ' + r.result.code : reason(r.reason); refresh(); }, 'f99k-btn small ghost');
      }
      if (masked.length) btn(acts, 'إظهار المحمي', async () => { if (!W.confirm('سيُسجل عرض البيانات الحساسة في سجل التدقيق. متابعة؟')) return; const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'reveal', p_data: {role: p.role}});
        if (r.ok) W.alert(Object.entries(r.result.sensitive || {}).map(([k, v]) => (labelOf[k] || k) + ': ' + v).join('\n')); else ui.status.textContent = reason(r.reason); }, 'f99k-btn small ghost');
      pc.append(row); });
    return pc;
  }

  function ownerStage(ui, d, refresh) {
    const st = d.status === 'active' ? d.stages[d.current_stage] : null; if (!st) return null;
    const box = el('section', 'f99k-card f99k-action');
    if (st.role !== 'admin') { box.append(el('h3', '', 'المرحلة الحالية: ' + st.label), el('p', 'f99k-wait', 'بانتظار ' + st.role_label + '.'));
      const cl = st.state?.status === 'clarify' ? st : null; if (cl) { box.append(el('p', 'f99k-warn', 'استفسار من ' + st.role_label + ': ' + (st.state.note || '')));
        const ta = el('textarea'); ta.rows = 2; ta.setAttribute('aria-label', 'الرد على الاستفسار'); box.append(ta);
        btn(box, 'إرسال الرد', async () => { const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'reply', p_data: {note: ta.value.trim(), stage_key: st.key}}); ui.status.textContent = r.ok ? 'أُرسل الرد.' : reason(r.reason); refresh(); }, 'f99k-btn primary'); }
      return box; }
    box.append(el('h3', '', 'مرحلتك: ' + st.label));
    const note = el('textarea'); note.rows = 2; note.placeholder = 'ملاحظة (اختيارية، ومطلوبة عند الإعادة أو الرفض)'; note.setAttribute('aria-label', 'ملاحظة الإدارة');
    const acts = el('div', 'f99k-actions');
    const act = async (action, data, ok) => { const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: action, p_data: data}); ui.status.textContent = r.ok ? ok : reason(r.reason); if (r.ok) refresh(); };
    if (st.action === 'review') {
      box.append(note, acts);
      btn(acts, 'اعتماد والانتقال للمرحلة التالية', () => act('approve', {note: note.value.trim()}, 'تم الاعتماد.'), 'f99k-btn primary');
      if (st.return_to) btn(acts, 'إعادة للتصحيح', () => act('return', {note: note.value.trim()}, 'أُعيدت للطرف للتصحيح.'), 'f99k-btn');
      btn(acts, 'رفض', () => { if (W.confirm('رفض وإغلاق المعاملة؟')) act('reject', {note: note.value.trim()}, 'رُفضت المعاملة.'); }, 'f99k-btn danger');
    } else if (st.action === 'text') {
      const ta = el('textarea', 'f99k-bodyedit'); ta.rows = 14; ta.value = d.body || ''; ta.setAttribute('aria-label', 'الصيغة النهائية للعقد');
      box.append(el('p', 'f99k-muted', 'عدّل الصيغة النهائية. يمكنك استخدام بيانات الأطراف المشتركة مثل {{seller_name}} و{{buyer_name}} و{{item_title}} و{{deferred_price}}.'), ta, note, acts);
      btn(acts, 'اعتماد الصيغة وإرسالها للأطراف', () => act('set_text', {body: ta.value, note: note.value.trim()}, 'اعتمدت الصيغة وانتقلت المعاملة للمرحلة التالية.'), 'f99k-btn primary');
    } else if (st.action === 'deposit') {
      const amt = el('input'); amt.inputMode = 'decimal'; amt.placeholder = 'مبلغ العربون المستلم'; amt.value = d.terms?.deposit && d.terms.deposit !== '0' ? d.terms.deposit : ''; amt.setAttribute('aria-label', 'مبلغ العربون');
      const ref = el('input'); ref.placeholder = 'مرجع التحويل (اختياري)'; ref.setAttribute('aria-label', 'مرجع التحويل');
      box.append(el('p', 'f99k-muted', 'لا يبدأ العمل قبل تأكيد استلام العربون. هذا تسجيل داخلي لما استلمته فعليًا، ولا تنفذ المنصة أي عملية دفع.'), amt, ref, note, acts);
      btn(acts, 'تأكيد استلام العربون', () => { if (W.confirm('تأكيد استلام ' + amt.value + ' ريال؟')) act('confirm_deposit', {amount: amt.value.trim(), reference: ref.value.trim(), note: note.value.trim()}, 'سُجل استلام العربون.'); }, 'f99k-btn primary');
    } else if (st.action === 'complete') {
      const fees = Number(d.terms?.fees || 0), disc = Number(d.terms?.discount || 0);
      const dep = Math.max(0, ...d.stages.filter(s => s.action === 'deposit').map(s => Number(s.state?.amount || 0)));
      box.append(el('p', 'f99k-calc', 'الأتعاب ' + fees + ' − العربون ' + dep + (d.terms?.discount != null && String(d.terms.discount).trim() !== '' ? ' − الخصم ' + disc : '') + ' = المتبقي ' + Math.max(0, fees - dep - disc) + ' ريال'), note, acts);
      btn(acts, 'تأكيد إنجاز الخدمة', () => act('complete', {note: note.value.trim()}, 'سُجل الإنجاز واكتملت المعاملة.'), 'f99k-btn primary');
    } else if (st.action === 'final') {
      const list = el('div', 'f99k-form'); const checks = (st.checklist || []).map(t => { const l = el('label', 'f99k-field check'); const c = el('input'); c.type = 'checkbox'; l.append(c, el('span', '', t)); list.append(l); return c; });
      box.append(list, note, acts);
      const go = btn(acts, 'الاعتماد النهائي', () => act('final', {confirm_all: checks.every(c => c.checked) ? 'true' : 'false', note: note.value.trim()}, 'تم الاعتماد النهائي.'), 'f99k-btn primary');
      const sync = () => { go.disabled = !checks.every(c => c.checked); }; checks.forEach(c => { c.onchange = sync; }); sync();
    }
    return box;
  }

  async function dealView(ui, id, back) {
    const d = await ocall('f99k_owner_deal', {p_deal_id: id});
    if (!d.ok) { ui.status.textContent = reason(d.reason); return; }
    labelOf = {}; (d.stages || []).forEach(s => (s.fields || []).forEach(f => { labelOf[f.key] = f.label; }));
    const refresh = () => void dealView(ui, id, back).catch(() => {});
    const b = ui.body; b.replaceChildren();
    const top = el('div', 'f99k-actions'); btn(top, '→ كل المعاملات', back, 'f99k-btn small ghost'); b.append(top);
    const h = el('section', 'f99k-card'); h.append(el('h3', '', d.title), el('p', 'f99k-muted', d.ref + ' • ' + (KINDS[d.kind] || d.kind) + ' • ' + (STATUS[d.status] || d.status) + ' • النسخة ' + d.version + ' • بصمة ' + short(d.body_sha256)));
    b.append(h);
    const os = ownerStage(ui, d, refresh); if (os) b.append(os);
    const tl = el('section', 'f99k-card'); tl.append(el('h3', '', 'المراحل')); timeline(tl, d.stages); b.append(tl);
    b.append(partiesCard(ui, d, refresh));
    const shared = Object.values(d.shared || {}); if (shared.length) { const sc = el('section', 'f99k-card'); sc.append(el('h3', '', 'بيانات المعاملة')); const dl = el('dl', 'f99k-dl'); shared.forEach(x => dl.append(el('dt', '', x.label), el('dd', '', x.value))); sc.append(dl); b.append(sc); }
    const bc = el('section', 'f99k-card'); bc.append(el('h3', '', 'نص العقد الحالي'), el('pre', 'f99k-bodytext', d.body || '')); b.append(bc);
    if (d.status === 'active' && d.stages[d.current_stage]?.action !== 'text') {
      const det = el('details', 'f99k-card'); det.append(el('summary', '', 'تعديل النص (يصدر نسخة جديدة ويُلزم بإعادة الموافقات)'));
      const ta = el('textarea', 'f99k-bodyedit'); ta.rows = 10; ta.value = d.body || ''; ta.setAttribute('aria-label', 'تعديل نص العقد'); det.append(ta);
      btn(det, 'إصدار نسخة جديدة', async () => { if (!W.confirm('إصدار نسخة جديدة؟ ستلغى الموافقات السابقة على النسخة القديمة.')) return; const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'set_text', p_data: {body: ta.value}}); ui.status.textContent = r.ok ? 'صدرت نسخة جديدة.' : reason(r.reason); refresh(); }, 'f99k-btn');
      b.append(det);
    }
    const vc = el('section', 'f99k-card'); vc.append(el('h3', '', 'النسخ والأرشيف'));
    (d.versions || []).forEach(v => vc.append(el('p', 'f99k-muted', 'نسخة ' + v.version + ' • ' + fmtDate(v.created_at) + ' • ' + short(v.sha256))));
    (d.snapshots || []).forEach(s => { const row = el('div', 'f99k-row'); row.append(el('span', '', (SNAP[s.kind] || s.kind) + ' • نسخة ' + s.version + ' • ' + fmtDate(s.created_at)));
      btn(row, 'عرض / حفظ PDF', async () => { const r = await ocall('f99k_owner_snapshot', {p_snapshot_id: s.id}); if (r.ok) printSnapshot(r); else ui.status.textContent = reason(r.reason); }, 'f99k-btn small'); vc.append(row); });
    b.append(vc);
    const ec = el('section', 'f99k-card'); ec.append(el('h3', '', 'سجل التدقيق'));
    (d.events || []).slice(0, 60).forEach(e => ec.append(el('p', 'f99k-muted' + (e.seen ? '' : ' f99k-new'), fmtDate(e.at) + ' — ' + (e.actor === 'owner' ? 'الإدارة' : e.actor === 'system' ? 'النظام' : (d.parties.find(p => 'party:' + p.role === e.actor)?.label || e.actor)) + ' — ' + actionLabel(e.action) + (e.note ? ' — ' + e.note : ''))));
    b.append(ec);
    if (d.status === 'active') { const cx = el('div', 'f99k-actions'); btn(cx, 'إلغاء المعاملة', async () => { const n = W.prompt('سبب الإلغاء:'); if (n === null) return; const r = await ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'cancel', p_data: {note: n}}); ui.status.textContent = r.ok ? 'أُلغيت المعاملة.' : reason(r.reason); refresh(); }, 'f99k-btn danger'); b.append(cx); }
    if ((d.events || []).some(e => !e.seen)) void ocall('f99k_owner_act', {p_deal_id: d.id, p_action: 'mark_seen'});
    ui.status.textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-SA');
  }

  const UNITS = [['m', 'دقيقة', 1], ['h', 'ساعة', 60], ['d', 'يوم', 1440]];
  function durationInput(minutes) {
    const wrap = el('span', 'f99k-duration'); const n = el('input'); n.inputMode = 'numeric'; n.setAttribute('aria-label', 'المدة'); const u = el('select'); u.setAttribute('aria-label', 'الوحدة');
    UNITS.forEach(([k, l]) => u.append(new Option(l, k)));
    const m = Number(minutes) || 10080; const unit = m % 1440 === 0 ? 'd' : m % 60 === 0 ? 'h' : 'm'; u.value = unit; n.value = String(m / UNITS.find(x => x[0] === unit)[2]);
    wrap.append(n, u); wrap.minutes = () => Math.round(Number(n.value) * UNITS.find(x => x[0] === u.value)[2]); return wrap;
  }
  function fillPreview(body, terms) { return String(body || '').replace(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g, (m, k) => (terms[k] !== undefined && terms[k] !== '' ? terms[k] : m)); }

  async function newDeal(ui, opened) {
    if (!templates.length) await loadTemplates();
    const b = ui.body; const live = templates.filter(t => t.enabled);
    if (!live.length) { ui.status.textContent = 'لا توجد قوالب مفعلة.'; return; }
    const sel = el('select', 'f99k-select'); sel.setAttribute('aria-label', 'القالب'); live.forEach(t => sel.append(new Option(t.name + ' — ' + (KINDS[t.kind] || ''), t.id)));
    const form = el('div', 'f99k-form'); b.append(el('label', 'f99k-field', 'اختر نوع العقد/القالب'), sel, form);
    function draw() {
      const t = live.find(x => x.id === sel.value); tplLabels(t); form.replaceChildren();
      const title = el('input'); title.value = t.name; title.setAttribute('aria-label', 'عنوان العقد');
      const lt = el('label', 'f99k-field'); lt.append(el('span', '', 'عنوان المعاملة'), title); form.append(lt);
      const terms = {}; const tbox = el('div', 'f99k-form');
      Object.entries(Object.assign({}, t.terms || {}, {discount: ''})).forEach(([k, v]) => { const l = el('label', 'f99k-field'); const i = el('input'); i.value = v; i.dataset.term = k; i.setAttribute('aria-label', k);
        l.append(el('span', '', ({fees: 'الأتعاب (ريال)', deposit: 'العربون (ريال)', discount: 'الخصم (ريال) — اختياري؛ فارغ = لا يظهر', service_description: 'وصف الخدمة', start_condition: 'شرط بدء العمل', refund_terms: 'شروط استرداد العربون', payment_terms: 'موعد استحقاق الأتعاب'}[k] || k)), i); tbox.append(l); });
      if (tbox.childElementCount) form.append(el('h4', '', 'بنود قابلة للتعديل'), tbox);
      const body = el('textarea', 'f99k-bodyedit'); body.rows = 12; body.value = t.body; body.setAttribute('aria-label', 'نص العقد');
      const lb = el('label', 'f99k-field'); lb.append(el('span', '', 'نص العقد (قابل للتعديل بالكامل)'), body); form.append(lb);
      const settings = {...(t.settings || {})}; const sbox = el('div', 'f99k-form');
      if (t.kind === 'deferred_sale' || 'lawyer_enabled' in settings) { const l = el('label', 'f99k-field check'); const c = el('input'); c.type = 'checkbox'; c.checked = !!settings.lawyer_enabled; c.onchange = () => { settings.lawyer_enabled = c.checked; drawParties(); }; l.append(c, el('span', '', 'إضافة مرحلة المحامي/المراجع المستقل')); sbox.append(l); }
      if (settings.post_options) { settings.post_options = {...settings.post_options}; Object.keys(settings.post_options).forEach(k => { const l = el('label', 'f99k-field check'); const c = el('input'); c.type = 'checkbox'; c.checked = settings.post_options[k] !== false; c.onchange = () => { settings.post_options[k] = c.checked; }; l.append(c, el('span', '', 'إظهار خيار: ' + (OPT_LABEL[k] || k))); sbox.append(l); }); }
      if ('defer_max_months' in settings) { const l = el('label', 'f99k-field'); const i = el('input'); i.inputMode = 'numeric'; i.value = settings.defer_max_months; i.onchange = () => { settings.defer_max_months = Number(i.value) || 12; }; l.append(el('span', '', 'أقصى مدة تأجيل (أشهر)'), i); sbox.append(l); }
      if (sbox.childElementCount) form.append(el('h4', '', 'إعدادات المعاملة'), sbox);
      const pbox = el('div', 'f99k-form'); form.append(el('h4', '', 'أكواد الأطراف (من خزنة العقود المستقلة)'), pbox); const pcfg = {};
      function drawParties() { pbox.replaceChildren();
        const roles = (t.roles || []).filter(r => (t.stages || []).some(s => s.role === r.role && s.enabled !== false && (!s.requires_setting || settings[s.requires_setting] === true)));
        roles.forEach(r => { const row = el('div', 'f99k-party'); const dur = durationInput(settings.code_valid_minutes); const dev = el('input'); dev.inputMode = 'numeric'; dev.value = settings.code_device_limit || 1; dev.setAttribute('aria-label', 'عدد الأجهزة');
          pcfg[r.role] = () => ({valid_minutes: dur.minutes(), device_limit: Number(dev.value) || 1});
          const l1 = el('label', 'f99k-field'); l1.append(el('span', '', r.label + ' — صلاحية الكود من أول استخدام'), dur); const l2 = el('label', 'f99k-field'); l2.append(el('span', '', 'عدد الأجهزة'), dev);
          row.append(l1, l2); pbox.append(row); });
        Object.keys(pcfg).forEach(k => { if (!roles.some(r => r.role === k)) delete pcfg[k]; }); }
      drawParties();
      const prev = el('pre', 'f99k-bodytext'); prev.hidden = true;
      const acts = el('div', 'f99k-actions'); form.append(acts, prev);
      const readTerms = () => { tbox.querySelectorAll('[data-term]').forEach(i => { terms[i.dataset.term] = i.value.trim(); }); return terms; };
      btn(acts, 'معاينة العقد', () => { prev.hidden = false; prev.textContent = fillPreview(body.value, readTerms()); }, 'f99k-btn');
      btn(acts, 'إنشاء المعاملة وإصدار الأكواد', async e => {
        const b2 = e.currentTarget; b2.disabled = true;
        const parties = {}; Object.entries(pcfg).forEach(([k, f]) => { parties[k] = f(); });
        const r = await ocall('f99k_owner_deal_create', {p_data: {template_id: t.id, title: title.value.trim(), body: body.value, terms: readTerms(), settings, parties}});
        b2.disabled = false;
        if (!r.ok) { ui.status.textContent = reason(r.reason); return; }
        form.replaceChildren(); const res = el('section', 'f99k-card'); res.append(el('h3', '', 'أُنشئت المعاملة ' + r.ref), el('p', 'f99k-muted', 'أرسل لكل طرف كوده فقط. المتبقي في الخزنة: ' + r.vault_available));
        (r.parties || []).forEach(p => { const row = el('div', 'f99k-row'); row.append(el('b', '', p.label + ': ' + p.code));
          btn(row, 'نسخ الرسالة', ev => copy('كود دخولك لعقد FINO99 (' + r.ref + ') بصفتك ' + p.label + ': ' + p.code + '\nادخل www.fino99.com ثم «أدخل الكود».', ev.currentTarget), 'f99k-btn small'); res.append(row); });
        btn(res, 'فتح المعاملة ومتابعتها', () => opened(r.deal_id), 'f99k-btn primary'); form.append(res); ui.status.textContent = 'تم الإنشاء.';
      }, 'f99k-btn primary');
    }
    sel.onchange = draw; draw(); ui.status.textContent = 'اختر القالب ثم عدّل ما تريد.';
  }

  async function templatesView(ui) {
    const r = await loadTemplates(); if (!r.ok) { ui.status.textContent = reason(r.reason); return; }
    const b = ui.body; b.append(el('p', 'f99k-muted', 'كل القوالب والمراحل والأطراف والحقول والخيارات هنا بيدك. التعديل يطبق على المعاملات الجديدة فقط؛ المعاملات القائمة تحتفظ بنسختها.'));
    templates.forEach(t => { const row = el('article', 'f99k-item'); const i = el('div'); i.append(el('b', '', t.name), el('small', '', (KINDS[t.kind] || t.kind) + ' • ' + (t.enabled ? 'مفعل' : 'موقوف') + ' • مراجعة ' + t.revision + ' • ' + (t.stages || []).length + ' مراحل'));
      row.append(i); btn(row, 'تعديل', () => editTemplate(ui, t), 'f99k-btn small'); btn(row, 'نسخ كقالب جديد', () => editTemplate(ui, {...JSON.parse(JSON.stringify(t)), id: null, revision: 0, name: t.name + ' (نسخة)'}), 'f99k-btn small ghost'); b.append(row); });
    ui.status.textContent = templates.length + ' قالب.';
  }

  function editTemplate(ui, t0) {
    const t = JSON.parse(JSON.stringify(t0)); const b = ui.body; b.replaceChildren(); tplLabels(t);
    const top = el('div', 'f99k-actions'); btn(top, '→ القوالب', () => { b.replaceChildren(); void templatesView(ui); }, 'f99k-btn small ghost'); b.append(top);
    const form = el('div', 'f99k-form'); b.append(form);
    const field = (label, input) => { const l = el('label', 'f99k-field'); l.append(el('span', '', label), input); form.append(l); return input; };
    const name = field('اسم القالب', el('input')); name.value = t.name;
    const kind = field('النوع', el('select')); Object.entries(KINDS).forEach(([k, l]) => kind.append(new Option(l, k))); kind.value = t.kind;
    const en = el('input'); en.type = 'checkbox'; en.checked = t.enabled !== false; const le = el('label', 'f99k-field check'); le.append(en, el('span', '', 'القالب مفعل')); form.append(le);
    const body = field('نص القالب — استخدم {{اسم_البند}} للبنود والبيانات المشتركة', el('textarea')); body.rows = 12; body.className = 'f99k-bodyedit'; body.value = t.body;
    form.append(el('h4', '', 'البنود الافتراضية'));
    const tbox = el('div', 'f99k-form'); form.append(tbox);
    const termRow = (k, v) => { const row = el('div', 'f99k-row'); const ki = el('input'); ki.value = k; ki.placeholder = 'اسم_البند'; ki.dataset.tk = '1'; ki.setAttribute('aria-label', 'اسم البند'); const vi = el('input'); vi.value = v; vi.dataset.tv = '1'; vi.setAttribute('aria-label', 'القيمة');
      row.append(ki, vi); btn(row, 'حذف', () => row.remove(), 'f99k-btn small ghost'); tbox.append(row); };
    Object.entries(t.terms || {}).forEach(([k, v]) => termRow(k, v)); btn(form, '+ بند', () => termRow('', ''), 'f99k-btn small');
    form.append(el('h4', '', 'الأطراف'));
    (t.roles || []).forEach(r => { const i = el('input'); i.value = r.label; i.oninput = () => { r.label = i.value; }; const l = el('label', 'f99k-field'); l.append(el('span', '', 'اسم الطرف (' + r.role + ')'), i); form.append(l); });
    form.append(el('h4', '', 'المراحل بالترتيب'));
    (t.stages || []).forEach((s, idx) => { const det = el('details', 'f99k-stage'); det.append(el('summary', '', (idx + 1) + '. ' + s.label + ' — ' + (s.role === 'admin' ? 'الإدارة' : ((t.roles || []).find(r => r.role === s.role)?.label || s.role))));
      const li = el('input'); li.value = s.label; li.oninput = () => { s.label = li.value; }; const l1 = el('label', 'f99k-field'); l1.append(el('span', '', 'اسم المرحلة'), li); det.append(l1);
      const ce = el('input'); ce.type = 'checkbox'; ce.checked = s.enabled !== false; ce.onchange = () => { s.enabled = ce.checked; }; const l2 = el('label', 'f99k-field check'); l2.append(ce, el('span', '', 'المرحلة مفعلة')); det.append(l2);
      const no = el('textarea'); no.rows = 2; no.value = s.note || ''; no.oninput = () => { s.note = no.value; }; const l3 = el('label', 'f99k-field'); l3.append(el('span', '', 'تعليمات تظهر للطرف'), no); det.append(l3);
      (s.fields || []).forEach(f => { const row = el('div', 'f99k-row'); const fl = el('input'); fl.value = f.label; fl.oninput = () => { f.label = fl.value; }; fl.setAttribute('aria-label', 'اسم الحقل');
        const rq = el('input'); rq.type = 'checkbox'; rq.checked = !!f.required; rq.onchange = () => { f.required = rq.checked; }; const lr = el('label', 'f99k-field check'); lr.append(rq, el('span', '', 'مطلوب'));
        row.append(fl, lr, el('small', '', ({text: 'نص', textarea: 'نص طويل', number: 'رقم', date: 'تاريخ', checkbox: 'إقرار', phone: 'جوال', id: 'هوية (محمية)', iban: 'آيبان (محمي)'}[f.type] || f.type)));
        btn(row, 'حذف', () => { s.fields = s.fields.filter(x => x !== f); row.remove(); }, 'f99k-btn small ghost'); det.append(row); });
      if (s.role !== 'admin' && s.action !== 'options') btn(det, '+ حقل', () => { const label = W.prompt('اسم الحقل:'); if (!label) return; const type = W.prompt('النوع: text, textarea, number, date, checkbox, phone, id, iban', 'text') || 'text';
        const key = 'f_' + Date.now().toString(36); s.fields = s.fields || []; s.fields.push({key, label, type, required: false, sensitive: type === 'id' || type === 'iban' || undefined}); editTemplate(ui, {...t, body: body.value, name: name.value}); }, 'f99k-btn small');
      if (s.action === 'final') { const ta = el('textarea'); ta.rows = 4; ta.value = (s.checklist || []).join('\n'); ta.oninput = () => { s.checklist = ta.value.split('\n').map(x => x.trim()).filter(Boolean); }; const l = el('label', 'f99k-field'); l.append(el('span', '', 'بنود التحقق قبل الاعتماد النهائي (سطر لكل بند)'), ta); det.append(l); }
      if (s.action === 'options') (s.options || []).forEach(o => { const i = el('input'); i.value = o.label; i.oninput = () => { o.label = i.value; }; const l = el('label', 'f99k-field'); l.append(el('span', '', 'نص الخيار (' + o.key + ')'), i); det.append(l); });
      form.append(det); });
    const adv = el('details', 'f99k-stage'); adv.append(el('summary', '', 'تحكم متقدم (JSON): الأطراف والمراحل والإعدادات'));
    const aj = el('textarea'); aj.rows = 12; aj.dir = 'ltr'; aj.className = 'f99k-json'; aj.setAttribute('aria-label', 'إعدادات متقدمة');
    const syncAdv = () => { aj.value = JSON.stringify({roles: t.roles, stages: t.stages, settings: t.settings}, null, 1); }; adv.ontoggle = () => { if (adv.open) syncAdv(); };
    adv.append(el('p', 'f99k-muted', 'الإجراءات المتاحة: للأطراف submit/sign/options، وللإدارة review/text/deposit/complete/final. يتحقق الخادم من صحة البنية قبل الحفظ.'), aj); form.append(adv);
    const acts = el('div', 'f99k-actions'); form.append(acts);
    btn(acts, 'حفظ القالب', async () => {
      const terms = {}; tbox.querySelectorAll('.f99k-row').forEach(r => { const k = r.querySelector('[data-tk]')?.value.trim(); const v = r.querySelector('[data-tv]')?.value ?? ''; if (k) terms[k] = v; });
      let roles = t.roles, stages = t.stages, settings = t.settings || {};
      if (adv.open) { try { const j = JSON.parse(aj.value); roles = j.roles; stages = j.stages; settings = j.settings || {}; } catch (e) { ui.status.textContent = 'صيغة JSON غير صحيحة.'; return; } }
      const r = await ocall('f99k_owner_template_save', {p_template: {id: t.id || null, revision: t.revision, name: name.value.trim(), kind: kind.value, enabled: en.checked, body: body.value, terms, roles, stages, settings}});
      if (!r.ok) { ui.status.textContent = reason(r.reason); return; }
      await loadTemplates(); ui.status.textContent = 'حُفظ القالب (مراجعة ' + r.revision + ').'; editTemplate(ui, templates.find(x => x.id === r.id) || t);
    }, 'f99k-btn primary');
    ui.status.textContent = t.id ? 'تعديل القالب.' : 'قالب جديد.';
  }

  async function vaultView(ui) {
    const v = await ocall('f99k_owner_vault'); if (!v.ok) { ui.status.textContent = reason(v.reason); return; }
    const b = ui.body; const kp = el('section', 'f99k-kpis'); [['متاح', v.available], ['مخصص لأطراف', v.assigned], ['موقوف', v.revoked], ['الإجمالي', v.total]].forEach(([l, x]) => { const a = el('article', 'f99k-kpi'); a.append(el('small', '', l), el('b', '', x ?? 0)); kp.append(a); });
    b.append(kp, el('p', 'f99k-muted', 'خزنة أكواد العقود مستقلة تمامًا عن أكواد الباقات والتجديد. كل طرف يأخذ كودًا واحدًا عند إنشاء المعاملة، ولا يعاد استخدام كود.'));
    if (v.available < 10) b.append(el('p', 'f99k-warn', 'المتاح منخفض — أصدر دفعة جديدة قبل إنشاء معاملات.'));
    const row = el('div', 'f99k-row'); const n = el('input'); n.inputMode = 'numeric'; n.value = '50'; n.setAttribute('aria-label', 'عدد الأكواد'); const bn = el('input'); bn.placeholder = 'اسم الدفعة (اختياري)'; bn.setAttribute('aria-label', 'اسم الدفعة');
    row.append(n, bn); btn(row, 'إصدار أكواد', async () => { const c = Number(n.value); if (!W.confirm('إصدار ' + c + ' كود عقد جديد في الخزنة؟')) return; const r = await ocall('f99k_owner_vault_issue', {p_count: c, p_batch: bn.value.trim() || null});
      ui.status.textContent = r.ok ? 'صدر ' + r.issued + ' كود. المتاح الآن ' + r.available + '.' : reason(r.reason); b.replaceChildren(); void vaultView(ui); }, 'f99k-btn primary'); b.append(row);
    const bl = el('section', 'f99k-card'); bl.append(el('h3', '', 'آخر الدفعات')); (v.batches || []).forEach(x => bl.append(el('p', 'f99k-muted', x.batch + ' • ' + x.count + ' كود • ' + fmtDate(x.at)))); b.append(bl);
    ui.status.textContent = 'الخزنة محدثة.';
  }

  async function alertsView(ui, openDeal) {
    const r = await ocall('f99k_owner_notifications', {p_limit: 60}); if (!r.ok) { ui.status.textContent = reason(r.reason); return; }
    const b = ui.body; if (!(r.items || []).length) b.append(el('p', 'f99k-muted', 'لا توجد أحداث جديدة من الأطراف.'));
    (r.items || []).forEach(x => { const row = el('article', 'f99k-item turn'); const i = el('div'); i.append(el('b', '', x.title + ' (' + x.ref + ')'), el('small', '', fmtDate(x.at) + ' — ' + x.role_label + ' — ' + actionLabel(x.action)));
      row.append(i); btn(row, 'فتح', () => openDeal(x.deal_id), 'f99k-btn small'); b.append(row); });
    ui.status.textContent = (r.unseen || 0) + ' حدث جديد.';
  }

  /* hub badge on the owner shortcut (light polling only while the owner panel is visible) */
  function updateHubBadge(n) { const b = D.getElementById('f99k-hub-badge'); if (b) { b.textContent = n ? String(n) : ''; b.hidden = !n; } }
  setInterval(async () => {
    if (!isOwner() || D.visibilityState !== 'visible' || sheetRoot) return;
    const hub = D.getElementById('ownerHub'); if (!hub || !(hub.offsetWidth || hub.offsetHeight)) return;
    const r = await ocall('f99k_owner_notifications', {p_limit: 1}); if (r.ok) updateHubBadge(r.unseen || 0);
  }, 120000);

  // owner summary used by the executive gateway (read-only)
  async function summary() {
    const [deals, vault] = await Promise.all([ocall('f99k_owner_deals', {p_limit: 30}), ocall('f99k_owner_vault')]);
    return {deals, vault};
  }

  hookLogin();
  W.F99KContractsReason = reason;
  W.F99KContracts = {openOwner, partyEnter, summary, ocall, templates: async () => { await loadTemplates(); return templates; }, KINDS};
})();
