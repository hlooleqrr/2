/* FINO99 round 22 B: owner_layout never uses public reads or browser storage. */
(function (w) {
  'use strict';
  if (w.F99OwnerLayout) return;
  const d = w.document;
  let host, rows, status, record, draft, busy = false, epoch = 0;
  const owner = () => w.F99OwnerDesktop?.isOwner() === true && w.F99OwnerDesktop.mounted;
  const specs = () => w.F99OwnerDesktop.layoutItems();
  const el = (tag, text) => { const n = d.createElement(tag); if (text != null) n.textContent = text; return n; };
  function normalize(value) {
    const ids = specs().map(x => x.id), locked = new Set(specs().filter(x => x.locked).map(x => x.id));
    return {order: [...new Set([...(Array.isArray(value?.order) ? value.order : []), ...ids])].filter(id => ids.includes(id)),
      hidden: [...new Set(Array.isArray(value?.hidden) ? value.hidden : [])].filter(id => ids.includes(id) && !locked.has(id))};
  }
  function message(text, error = false) { if (status) { status.textContent = text; status.dataset.error = String(error); } }
  function button(parent, text, action, name) {
    const b = el('button', text); b.type = 'button'; b.className = 'f99od13-button';
    if (name) b.dataset.action = name;
    b.addEventListener('click', async () => {
      if (!owner()) return clear();
      try { await action(); } catch (_) { message('تعذر الاتصال بالمركزية؛ لم يُحفظ التخطيط.', true); }
    }); parent.append(b); return b;
  }
  function clear() { epoch++; host?.remove(); host = record = draft = null; busy = false; }
  async function reload() {
    if (!owner() || !host) return false;
    const current = epoch; const r = await w.F99Settings.adminGet('owner_layout');
    if (current !== epoch || !host || !owner()) return false;
    if (!r?.ok) { record = null; message('تعذر قراءة التخطيط؛ بقي ترتيب البوابات الأصلي. أعد المحاولة.', true); return false; }
    record = r; draft = normalize(record.value); w.F99OwnerDesktop.applyLayout(draft); render(); return true;
  }
  function render() {
    if (!rows || !draft) return;
    rows.replaceChildren();
    draft.order.forEach((id, index) => {
      const item = specs().find(x => x.id === id); if (!item) return;
      const row = el('div'); row.className = 'f99layout22-row'; row.dataset.layoutId = id;
      const label = el('label'); const check = el('input'); check.type = 'checkbox'; check.checked = !draft.hidden.includes(id);
      check.disabled = item.locked || busy; check.dataset.layoutVisibility = id;
      check.setAttribute('aria-label', 'إظهار ' + item.label);
      check.addEventListener('change', () => {
        if (!owner() || item.locked) return;
        draft.hidden = check.checked ? draft.hidden.filter(x => x !== id) : [...new Set([...draft.hidden, id])];
        w.F99OwnerDesktop.applyLayout(draft); message('معاينة غير محفوظة؛ اضغط حفظ ترتيب البوابات.');
      });
      label.append(check, el('span', item.label + (item.locked ? ' — مقفلة: إدارة ضرورية' : ''))); row.append(label);
      for (const [direction, text, name] of [[-1, 'أعلى', 'move-up'], [1, 'أسفل', 'move-down']]) {
        const b = button(row, text, () => {
          if (busy) return; const to = index + direction;
          if (to < 0 || to >= draft.order.length) return;
          [draft.order[index], draft.order[to]] = [draft.order[to], draft.order[index]];
          w.F99OwnerDesktop.applyLayout(draft); render(); message('معاينة غير محفوظة؛ اضغط حفظ ترتيب البوابات.');
        }, name); b.disabled = busy || index + direction < 0 || index + direction >= draft.order.length;
        b.setAttribute('aria-label', text + ': ' + item.label);
      }
      rows.append(row);
    });
    host.querySelector('[data-action="save-layout"]').disabled = busy || !record;
  }
  async function save(reset = false) {
    if (!owner() || !record || !draft || busy) return;
    const current = epoch; busy = true; render();
    try {
      const next = normalize(draft);
      // Preserve unrelated presentation fields; reset only our order/hidden fields.
      const value = {...record.value};
      if (reset) { delete value.order; delete value.hidden; }
      else { value.order = next.order; value.hidden = next.hidden; }
      const r = await w.F99Settings.adminSave('owner_layout', value, record.version);
      if (!owner() || current !== epoch) return;
      busy = false;
      if (r?.reason === 'VERSION_CONFLICT') {
        await reload(); message('تغيّر التخطيط في جلسة أخرى؛ حُمّل أحدث إصدار. راجعه ثم أعد الحفظ.', true);
      } else if (!r?.ok) { render(); message('تعذر حفظ تخطيط البوابات؛ بقيت المعاينة غير محفوظة.', true); }
      else { await reload(); message(reset ? 'استُعيد الترتيب الأصلي وإظهار جميع البوابات.' : 'حُفظ ترتيب البوابات وإظهارها في المركزية.'); }
    } finally { if (current === epoch) { busy = false; render(); } }
  }
  async function mount() {
    if (!owner() || host) return;
    const desktop = d.getElementById('f99od13-desktop'); if (!desktop) return;
    host = el('details'); host.className = 'f99layout22-module'; host.id = 'f99layout22';
    host.append(el('summary', 'تنظيم الصفحة الرئيسية للمالك'));
    host.append(el('p', 'رتّب البوابات وأظهرها أو أخفها دون حذف الخدمات. الأمان والخروج وإدارة الأجهزة وأساسيات المركزية مقفلة وتبقى متاحة، ويمكن الوصول إلى الخدمات المخفية من البحث والأدوات الأصلية.'));
    rows = el('div'); host.append(rows);
    const actions = el('div'); actions.className = 'f99od13-actions'; host.append(actions);
    button(actions, 'حفظ ترتيب البوابات', () => save(), 'save-layout').disabled = true;
    button(actions, 'إلغاء المعاينة', reload, 'cancel-layout');
    button(actions, 'استعادة الترتيب الأصلي', () => save(true), 'reset-layout');
    status = el('p'); status.id = 'f99layout22-status'; status.setAttribute('role', 'status'); host.append(status);
    desktop.querySelector('.f99od13-gateways').after(host);
    message('جارٍ قراءة تخطيط المالك من المركزية…'); await reload();
  }
  w.F99OwnerLayout = {reload};
  w.addEventListener('f99owner:mounted', mount);
  w.addEventListener('f99owner:destroyed', clear);
  w.addEventListener('f99owner:gateways', () => {
    if (owner() && record) { draft = normalize(record.value); w.F99OwnerDesktop.applyLayout(draft); render(); }
  });
  mount();
})(window);
