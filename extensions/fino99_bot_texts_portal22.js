/* FINO99 round 22 B: owner-only plain-text template editor. */
(function (w) {
  'use strict';
  if (w.F99BotTextsPortal) return;
  const d = w.document;
  const categories = Object.freeze([
    'الترحيب الصباحي والمسائي', 'سؤال اسم العميل', 'الحسبة لنفسه أو لشخص آخر',
    'جهة العمل والبنك والراتب', 'السداد المبكر والالتزامات', 'سؤال عدد العقود',
    'الترشيحات والنتائج', 'تعديل القسط والكاش', 'بداية حسبة جديدة', 'انتهاء الحسبة',
    'نفاد الاستخدامات', 'عروض المتابعة', 'الموافقة والاعتذار والتأجيل', 'رسائل التجديد',
    'نصوص المشاركة عبر واتساب'
  ]);
  w.F99TextCategories = categories;
  let root, list, editor, history, status, filter, record, selected = '', busy = false, epoch = 0;
  const owner = () => w.F99OwnerDesktop?.isOwner() === true && w.F99OwnerDesktop.mounted;
  const el = (tag, text, cls) => {
    const n = d.createElement(tag); if (text != null) n.textContent = text;
    if (cls) n.className = cls; return n;
  };
  function message(text, error = false) {
    if (!status) return; status.textContent = text; status.dataset.error = String(error);
  }
  function button(host, text, action, id) {
    const b = el('button', text, 'f99od13-button'); b.type = 'button';
    if (id) b.dataset.action = id;
    b.addEventListener('click', async () => {
      if (!owner()) return close();
      try { await action(); } catch (_) { message('تعذر الاتصال بالمركزية؛ لم يتم حفظ التعديل.', true); }
    }); host.append(b); return b;
  }
  function close() { epoch++; root?.remove(); root = record = null; selected = ''; busy = false; }
  async function reload() {
    if (!owner()) return false;
    const current = epoch;
    const r = await w.F99Settings.adminGet('bot_texts');
    if (!root || !owner() || current !== epoch) return false;
    if (!r?.ok) { record = null; message('تعذر تحميل النصوص من المركزية. أعد المحاولة قبل الحفظ.', true); return false; }
    record = r; renderList(); renderHistory(); if (selected) renderEditor();
    message('حُمّلت النصوص وسجل التعديلات من المركزية.'); return true;
  }
  function renderList() {
    if (!list) return;
    list.replaceChildren(); const defs = w.F99Texts.list();
    const extra = [...new Set(defs.map(x => x.category).filter(x => !categories.includes(x)))];
    for (const cat of [...categories, ...extra]) {
      if (filter.value && filter.value !== cat) continue;
      const group = el('details'); group.open = true; group.dataset.textCategory = cat;
      const entries = defs.filter(x => x.category === cat);
      group.append(el('summary', cat + ' (' + entries.length + ')')); list.append(group);
      if (!entries.length) { group.append(el('p', 'لا توجد عبارات مسجلة في هذا التصنيف بعد.')); continue; }
      for (const def of entries) {
        const b = button(group, '', () => { selected = def.key; renderEditor(); editor.scrollIntoView({block: 'nearest'}); }, 'select-text');
        b.className = 'f99bt22-sentence'; b.dataset.textKey = def.key;
        b.append(el('b', def.label), el('span', record?.value?.overrides?.[def.key]?.text ?? def.text), el('small', def.key));
        b.setAttribute('aria-pressed', String(selected === def.key));
      }
    }
  }
  function samples(def) {
    const known = {name: 'أحمد', client_name: 'أحمد', customer_name: 'أحمد', beneficiary_name: 'محمد',
      bank: 'البنك الأهلي', bank_name: 'البنك الأهلي', installment: '٢٬٥٠٠ ريال', salary: '١٢٬٠٠٠ ريال',
      amount: '١٥٠٬٠٠٠ ريال', cash: '٣٠٬٠٠٠ ريال', remaining: '٢', count: '٣'};
    const out = {}; for (const name of def.vars) out[name] = known[name] || 'قيمة نموذجية (' + name + ')';
    return out;
  }
  function renderEditor() {
    editor.replaceChildren(); const def = w.F99Texts.get(selected); if (!def) return;
    const override = record?.value?.overrides?.[def.key];
    editor.append(el('h3', def.label), el('code', def.key));
    if (def.note) editor.append(el('p', def.note));
    editor.append(el('p', 'قالب نصي فقط؛ المتغيرات تأتي من الحسبة الصحيحة. المعاينة تستخدم قيماً نموذجية ولا تغيّر بيانات العملاء.'));
    const label = el('label', 'صياغة العبارة'); const input = el('textarea'); input.id = 'f99bt22-text';
    input.rows = 5; input.maxLength = w.F99Texts.MAX_LEN; input.value = override?.text ?? def.text;
    label.append(input); editor.append(label);
    const chips = el('div', null, 'f99bt22-chips'); editor.append(chips);
    for (const name of def.vars) {
      const b = button(chips, '{' + name + '}', () => {
        input.setRangeText('{' + name + '}', input.selectionStart, input.selectionEnd, 'end'); preview(); input.focus();
      }); b.className = 'f99bt22-chip';
    }
    if (!def.vars.length) chips.append(el('small', 'لا توجد متغيرات لهذه العبارة.'));
    let enabled;
    if (def.allowHide === true) {
      const l = el('label', 'إظهار هذه العبارة (يمكن إخفاؤها دون تغيير منطق الحسبة)');
      enabled = el('input'); enabled.type = 'checkbox'; enabled.id = 'f99bt22-enabled';
      enabled.checked = override?.enabled !== false; l.prepend(enabled); editor.append(l);
    }
    editor.append(el('h4', 'المعاينة الحية — قيم نموذجية'));
    const previewNode = el('p', null, 'f99bt22-preview'); previewNode.id = 'f99bt22-preview'; editor.append(previewNode);
    const errors = el('p'); errors.id = 'f99bt22-errors'; errors.setAttribute('role', 'alert'); editor.append(errors);
    const actions = el('div', null, 'f99od13-actions'); editor.append(actions);
    const saveButton = button(actions, 'حفظ الصياغة', () => write(def.key, {text: input.value, enabled: enabled ? enabled.checked : true}), 'save-text');
    button(actions, 'استعادة الصياغة الأصلية', () => write(def.key, null), 'reset-text');
    function preview() {
      const result = w.F99Texts.validate(def.key, input.value);
      errors.textContent = result.errors.join('، '); saveButton.disabled = !record || !result.ok || busy;
      previewNode.textContent = !result.ok ? 'صحح النص لعرض المعاينة.' : enabled && !enabled.checked ? 'هذه العبارة مخفية.' : input.value.replace(/\{([a-z][a-z0-9_]{1,29})\}/g, (_, name) => samples(def)[name]);
    }
    input.addEventListener('input', preview); enabled?.addEventListener('change', preview); preview();
    renderList();
  }
  async function write(key, override) {
    if (!owner() || !record || busy) return;
    if (override && !w.F99Texts.validate(key, override.text).ok) return message('النص غير صالح؛ راجع أخطاء القالب.', true);
    const session = epoch; busy = true;
    editor.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const value = {...record.value, overrides: {...(record.value?.overrides || {})}};
      if (override) value.overrides[key] = override; else delete value.overrides[key];
      const r = await w.F99Settings.adminSave('bot_texts', value, record.version);
      if (!owner() || epoch !== session) return;
      busy = false;
      if (r?.reason === 'VERSION_CONFLICT') {
        await reload(); message('تغيّرت النصوص في جلسة أخرى؛ تم تحميل أحدث إصدار. راجع العبارة ثم أعد الحفظ.', true);
      } else if (!r?.ok) {
        renderList(); renderEditor(); renderHistory(); message('تعذر حفظ النص. تأكد من سلامة القالب واتصال المركزية.', true);
      } else {
        await reload(); message(override ? 'حُفظت الصياغة؛ ستظهر في المحادثات اللاحقة.' : 'استُعيدت الصياغة الأصلية لهذه العبارة.');
      }
    } finally {
      if (epoch === session) {
        busy = false;
        editor?.querySelectorAll('button').forEach(b => { b.disabled = false; });
        editor?.querySelector('textarea')?.dispatchEvent(new Event('input'));
      }
    }
  }
  function renderHistory() {
    history.replaceChildren(); history.append(el('h3', 'سجل التعديلات'));
    history.append(el('p', 'الاستعادة تعيد إصدار جميع قوالب البوت، وليس العبارة المحددة فقط.'));
    const actions = {save: 'حفظ', restore: 'استعادة', reset: 'استعادة الأصل'};
    for (const h of record?.history || []) {
      const row = el('div', null, 'f99bt22-history-row'); row.dataset.historyVersion = String(h.version);
      row.append(el('span', 'الإصدار ' + h.version + ' — ' + (actions[h.action] || 'تعديل') + ' — ' + new Date(h.saved_at).toLocaleString('ar-SA')));
      const b = button(row, 'استعادة هذا الإصدار', async () => {
        if (!record || busy || !w.confirm('استعادة هذا الإصدار لجميع نصوص البوت؟')) return;
        const current = epoch; busy = true;
        try {
          const r = await w.F99Settings.adminRestore('bot_texts', h.version, record.version);
          if (!owner() || current !== epoch) return;
          busy = false;
          await reload(); message(r?.ok ? 'استُعيد الإصدار السابق وسُجلت الاستعادة.' : r?.reason === 'VERSION_CONFLICT' ? 'حدث تعارض؛ حُمّل أحدث إصدار. راجع السجل ثم أعد الاستعادة.' : 'تعذر استعادة الإصدار.', !r?.ok);
        } finally { if (current === epoch) busy = false; }
      }, 'restore-version');
      b.disabled = h.version === record.version || busy; history.append(row);
    }
    if (!record?.history?.length) history.append(el('p', 'لا توجد تعديلات محفوظة بعد.'));
  }
  async function open(options = {}) {
    if (!owner()) return false;
    close(); const desktop = d.getElementById('f99od13-desktop'); if (!desktop) return false;
    root = el('section', null, 'f99bt22-module'); root.id = 'f99bt22-portal'; root.dir = 'rtl';
    const head = el('div', null, 'f99od13-actions'); root.append(head);
    const title = el('h2', 'إدارة النصوص والرسائل'); title.tabIndex = -1; head.append(title);
    button(head, 'إغلاق', close, 'close-texts');
    status = el('p'); status.id = 'f99bt22-status'; status.setAttribute('role', 'status'); root.append(status);
    const label = el('label', 'التصنيف'); filter = el('select'); filter.id = 'f99bt22-category';
    filter.append(new Option('جميع التصنيفات', ''));
    const extra = [...new Set(w.F99Texts.list().map(x => x.category).filter(x => !categories.includes(x)))];
    for (const cat of [...categories, ...extra]) filter.append(new Option(cat, cat));
    filter.value = options.category || w.F99Texts.get(options.key)?.category || '';
    filter.addEventListener('change', renderList); label.append(filter); root.append(label);
    const body = el('div', null, 'f99bt22-body'); list = el('div', null, 'f99bt22-list');
    editor = el('section', null, 'f99bt22-editor'); body.append(list, editor); root.append(body);
    history = el('section', null, 'f99bt22-history'); root.append(history);
    desktop.querySelector('.f99od13-gateways').after(root); selected = options.key || '';
    renderList(); message('جارٍ قراءة النصوص وسجل التعديلات من المركزية…');
    button(head, 'تحديث من المركزية', reload, 'reload-texts');
    title.focus(); root.scrollIntoView({block: 'start'}); await reload(); return true;
  }
  w.F99BotTextsPortal = {open, close};
  w.addEventListener('f99owner:destroyed', close);
  w.addEventListener('f99t:registry', () => { if (root && owner()) renderList(); });
  w.F99OwnerDesktop?.registerPortal({id: 'bot-texts', label: 'إدارة النصوص والرسائل',
    sub: 'القوالب الآمنة والمعاينة وسجل التعديلات', icon: '▤', open: () => open()});
})(window);
