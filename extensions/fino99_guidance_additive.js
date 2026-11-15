/* FINO99 G4 guidance-only addon. Load AFTER f99o2-module / f99o3-module.
 * Original authentication, packages, booking, calculators and code inventory stay untouched.
 * No LLM, network client, credentials, prices, localStorage, or new service kinds. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    if (root.F99G4Guidance) return;
    root.F99G4Guidance = api;
    root.F99G4GuidanceUI = Object.freeze(api.install(root) || {});
  }
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const DISCLOSURE = 'هذه إرشادات ومعلومات عامة، وليست استشارة تمويلية مرخصة ولا ضمانًا للموافقة البنكية.';
  const UNKNOWN = 'ما عندي جواب معتمد لهذا السؤال في باقتك. اختر من الأسئلة الموجودة أو راجع المالك.';
  const KINDS = ['guidance_mortgage', 'guidance_personal'];
  function normalize(value) {
    return String(value || '').normalize('NFKC').toLowerCase()
      .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }
  function resolve(content, query, selectedId) {
    const faqs = (Array.isArray(content?.faqs) ? content.faqs : []).filter(q => q.enabled !== false);
    const unknown = content?.unknown_text || UNKNOWN;
    if (selectedId) {
      const selected = faqs.find(q => q.id === selectedId);
      return selected ? {kind: 'answer', id: selected.id, text: selected.answer} : {kind: 'unknown', text: unknown};
    }
    const input = normalize(query);
    if (!input) return {kind: 'unknown', text: unknown};
    const exact = faqs.filter(q => normalize(q.question) === input);
    if (exact.length === 1) return {kind: 'answer', id: exact[0].id, text: exact[0].answer};
    if (exact.length > 1) return {kind: 'unknown', text: unknown};
    const candidates = faqs.filter(q => (Array.isArray(q.keywords) ? q.keywords : []).some(k => {
      const keyword = normalize(k);
      return keyword.length >= 2 && (' ' + input + ' ').includes(' ' + keyword + ' ');
    }));
    return candidates.length === 1 ? {kind: 'answer', id: candidates[0].id, text: candidates[0].answer}
      : {kind: 'unknown', text: unknown};
  }
  function defaults(content) {
    return {enabled: content?.enabled === true, intro: String(content?.intro || ''),
      unknown_text: String(content?.unknown_text || UNKNOWN),
      faqs: JSON.parse(JSON.stringify(Array.isArray(content?.faqs) ? content.faqs : []))};
  }
  // PostgreSQL jsonb reorders object keys; compare a canonical, fixed-order form instead of raw JSON text.
  function canonical(content) {
    const c = defaults(content);
    return JSON.stringify({enabled: c.enabled, intro: c.intro, unknown_text: c.unknown_text,
      faqs: c.faqs.map(q => ({id: String(q?.id || ''), enabled: q?.enabled === true, question: String(q?.question || ''),
        answer: String(q?.answer || ''), keywords: Array.isArray(q?.keywords) ? q.keywords.map(String) : []}))});
  }
  function restoreDraft(snapshot, current) {
    const restored = defaults(snapshot);
    const ids = new Set(restored.faqs.map(q => q.id));
    for (const q of current.faqs || []) if (!ids.has(q.id)) restored.faqs.push({...q, enabled: false});
    return restored;
  }
  function validate(content) {
    if (!content || typeof content.enabled !== 'boolean' || typeof content.intro !== 'string'
      || content.intro.length > 2000 || typeof content.unknown_text !== 'string'
      || content.unknown_text.trim().length < 5 || content.unknown_text.length > 1000
      || !Array.isArray(content.faqs) || content.faqs.length > 100) throw Error('راجع حقول الإرشادات وحدود أطوالها.');
    const ids = new Set();
    for (const q of content.faqs) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(q.id) || ids.has(q.id)
        || typeof q.enabled !== 'boolean' || typeof q.question !== 'string'
        || q.question.trim().length < 3 || q.question.length > 300
        || typeof q.answer !== 'string' || q.answer.trim().length < 3 || q.answer.length > 5000
        || !Array.isArray(q.keywords) || q.keywords.length > 20
        || q.keywords.some(k => typeof k !== 'string' || k.trim().length < 2 || k.length > 80)) {
        throw Error('راجع نص السؤال وإجابته والكلمات المفتاحية. لا تترك سؤالًا بلا إجابة، ولو كان معطلًا.');
      }
      ids.add(q.id);
    }
    if (new TextEncoder().encode(JSON.stringify(content)).length > 150000) throw Error('المحتوى أكبر من الحد المسموح.');
    return content;
  }
  function install(w) {
    const d = w.document;
    if (!d) return;
    let ownerModal = null;
    let panelSession = null;
    const owner = () => typeof activeAccess !== 'undefined' && !!activeAccess?.record?.owner
      && !!activeAccess?.record?.central && typeof finoCentralAdminToken !== 'undefined' && !!finoCentralAdminToken;
    function clientSession() {
      if (typeof activeAccess === 'undefined' || activeAccess?.record?.owner || !activeAccess?.record?.central) return null;
      const data = activeAccess.record.centralData || {};
      const config = data.config?.f99x || data.code?.config?.f99x || {};
      const key = String(config.effective_package_key ?? config.store_package_key ?? data.store_package_key ?? '');
      const services = data.allowed_services || data.code?.allowed_services || [];
      const entry = typeof finoCentralRestoreEntry === 'function' ? finoCentralRestoreEntry() : null;
      if (!key || !Array.isArray(services) || !services.some(x => KINDS.includes(x)) || !entry?.entryToken || !entry.deviceId) return null;
      return {key, token: entry.entryToken, device: entry.deviceId};
    }
    function sameSession(old) {
      const current = clientSession();
      return !!current && current.key === old.key && current.token === old.token && current.device === old.device;
    }
    function el(tag, cls, text) {
      const n = d.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n;
    }
    function button(host, text, run) {
      const b = el('button', 'o3-btn', text); b.type = 'button'; b.onclick = run; host.append(b); return b;
    }
    function field(host, label, value, multiline, limit) {
      const l = el('label', 'o3-field'); l.append(el('span', '', label));
      const input = el(multiline ? 'textarea' : 'input'); if (!multiline) input.type = 'text';
      input.value = value || ''; if (limit) input.maxLength = limit; if (multiline) input.rows = 3;
      l.append(input); host.append(l); return input;
    }
    function checkbox(host, label, checked) {
      const l = el('label', 'o3-switch'); const input = el('input'); input.type = 'checkbox'; input.checked = checked;
      l.append(input, el('span', '', label)); host.append(l); return input;
    }
    function errorText(error) {
      const reason = String(error?.message || error || '');
      if (reason.includes('VERSION_CONFLICT')) return 'تغيرت الباقة في جلسة أخرى. احتفظ بمسودتك، ثم حدّث من المركزية وراجع التعديل قبل الحفظ.';
      if (reason.includes('ADMIN_UNAUTHORIZED') || reason.includes('NO_ADMIN')) return 'انتهت جلسة المالك. أعد تسجيل الدخول.';
      if (reason.includes('GUIDANCE_NOT_ENABLED')) return 'الإجابات المعتمدة غير مفعلة لهذه الباقة. تظل خدمة المواعيد الأصلية كما هي.';
      if (reason.includes('DISABLE_INSTEAD_OF_DELETE')) return 'لا تحذف سؤالًا محفوظًا؛ عطّله بدلًا من حذفه.';
      return 'تعذر التحقق من الطلب من المركزية. إن كان حفظًا، حدّث القراءة قبل تكراره. وإن كان سؤالًا، فلا يوجد جواب معتمد يمكن عرضه الآن.';
    }
    async function admin(name, args = {}) {
      if (!owner() || typeof w.finoCentralAdminCall !== 'function') throw Error('ADMIN_UNAUTHORIZED');
      const response = await w.finoCentralAdminCall(name, args);
      if (!owner()) throw Error('ADMIN_UNAUTHORIZED');
      if (!response?.ok || response.data?.ok !== true) throw Error(response?.data?.reason || response?.error?.message || 'RPC_FAILED');
      return response.data;
    }
    async function clientRead(session) {
      if (!sameSession(session) || typeof w.finoRpc !== 'function') throw Error('SESSION_INVALID');
      const response = await w.finoRpc('f99g4_client_read', {p_entry_token: session.token,
        p_device_id: session.device, p_product_key: session.key}, 20000);
      if (!sameSession(session)) throw Error('SESSION_CHANGED');
      if (!response?.ok || response.data?.ok !== true) throw Error(response?.data?.reason || 'RPC_FAILED');
      if (response.data.package_key !== session.key || !KINDS.includes(response.data.service)) throw Error('PACKAGE_MISMATCH');
      return response.data;
    }
    async function openOwner(packageKey = '') {
      if (!owner()) return;
      if (ownerModal) ownerModal.remove();
      const modal = el('div', 'o3-overlay f99g4-overlay'); modal.id = 'f99g4-owner'; ownerModal = modal;
      modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'أسئلة وإجابات الباقة المعتمدة');
      const shell = el('main', 'o3-shell'); modal.append(shell);
      const header = el('header', 'o3-header'); header.append(el('strong', '', 'إرشادات الباقة — النصوص المعتمدة'));
      button(header, 'إغلاق دون حفظ', () => {modal.remove(); if (ownerModal === modal) ownerModal = null;}); shell.append(header);
      const status = el('p', 'o3-status', 'جاري قراءة الباقات من جلسة المالك الأصلية...'); status.setAttribute('role', 'status'); shell.append(status);
      const body = el('div', 'o3-body'); shell.append(body); d.body.append(modal);
      const live = () => modal.isConnected && ownerModal === modal && owner();
      try {
        const catalog = await admin('f99o2_owner_catalog'); if (!live()) return;
        const products = (catalog.products || []).filter(p => KINDS.includes(p.kind));
        if (!products.length) {status.textContent = 'لا توجد باقات إرشادات حالية. أنشئها من المحرر الأصلي؛ الإضافة لا تنشئ أنواع خدمات.'; return;}
        if (packageKey && !products.some(p => p.product_key === packageKey)) {
          status.textContent = 'الباقة المحددة ليست باقة إرشادات حالية. استخدم محررها الأصلي؛ لم يتم اختيار باقة أخرى بدلًا منها.';
          return;
        }
        const selectLabel = el('label', 'o3-field'); selectLabel.append(el('span', '', 'اختر باقة الإرشادات'));
        const select = el('select'); for (const p of products) {const option = el('option', '', p.title); option.value = p.product_key; select.append(option);}
        select.value = products.some(p => p.product_key === packageKey) ? packageKey : products[0].product_key;
        selectLabel.append(select); body.append(selectLabel);
        const editor = el('section', 'o3-box'); body.append(editor);
        let row, draft, readDraft;
        function render() {
          row = products.find(p => p.product_key === select.value); draft = defaults(row.guidance_content); editor.replaceChildren();
          editor.append(el('p', 'o3-muted', DISCLOSURE), el('p', 'o3-muted', 'عدّل الأسئلة والإجابات والكلمات المفتاحية ثم احفظ صراحةً. تعطيل سؤال لا يحذفه. لا تتغير الأسعار أو المواعيد أو الأكواد.'));
          const enabled = checkbox(editor, 'تفعيل الإجابات المعتمدة لهذه الباقة', draft.enabled);
          const intro = field(editor, 'تمهيد سعودي واضح (اختياري)', draft.intro, true, 2000);
          const unknown = field(editor, 'الرد عند عدم وجود إجابة معتمدة أو عند تعدد المطابقات', draft.unknown_text, true, 1000);
          const list = el('div', 'f99g4-faqs'); editor.append(list);
          const fields = [];
          function addQuestion(q) {
            const block = el('article', 'o3-box'); block.dataset.faqId = q.id;
            const on = checkbox(block, 'السؤال مفعّل للعميل', q.enabled === true);
            const question = field(block, 'السؤال', q.question, true, 300);
            const answer = field(block, 'الإجابة المعتمدة', q.answer, true, 5000);
            const keywords = field(block, 'كلمات أو عبارات مفتاحية — كل عبارة في سطر (اختياري)', (q.keywords || []).join('\n'), true, 1620);
            fields.push({q, on, question, answer, keywords}); list.append(block);
          }
          draft.faqs.forEach(addQuestion);
          button(editor, 'إضافة سؤال وإجابة', () => {
            if (fields.length >= 100) {status.textContent = 'الحد 100 سؤال لكل باقة.'; return;}
            const q = {id: 'faq_' + w.crypto.randomUUID(), question: '', answer: '', keywords: [], enabled: false};
            draft.faqs.push(q); addQuestion(q); status.textContent = 'سؤال مسودة غير مفعّل. اكتب الإجابة وراجعها قبل الحفظ.';
          });
          readDraft = () => ({enabled: enabled.checked, intro: intro.value, unknown_text: unknown.value.trim(),
            faqs: fields.map(f => ({id: f.q.id, enabled: f.on.checked, question: f.question.value.trim(),
              answer: f.answer.value.trim(), keywords: f.keywords.value.split(/\n/).map(s => s.trim()).filter(Boolean)}))});
          const save = button(editor, 'حفظ واعتماد الأسئلة والإجابات', async () => {
            let saveAcknowledged = false;
            try {
              const payload = validate(readDraft()); save.disabled = true; select.disabled = true;
              const result = await admin('f99g4_owner_save', {p_product_key: row.product_key,
                p_expected_revision: row.revision, p_content: payload}); if (!live()) return;
              saveAcknowledged = true; row.revision = result.revision; row.guidance_content = payload;
              const savedCatalog = await admin('f99o2_owner_catalog'); if (!live()) return;
              const actual = (savedCatalog.products || []).find(p => p.product_key === row.product_key);
              if (!actual || Number(actual.revision) !== Number(result.revision)
                || canonical(actual.guidance_content) !== canonical(payload)) {
                throw Error('READBACK_NOT_CONFIRMED');
              }
              Object.assign(row, actual); status.textContent = 'تم الحفظ وإعادة قراءة المحتوى المعتمد من المركزية. المراجعة: ' + result.revision;
            } catch (error) {if (live()) status.textContent = saveAcknowledged
              ? 'المركزية أكدت الحفظ، لكن تعذرت مطابقة إعادة القراءة. لا تكرر الحفظ؛ حدّث من المركزية وراجع آخر نسخة.'
              : errorText(error);}
            finally {save.disabled = false; select.disabled = false;}
          });
          button(editor, 'تحديث من المركزية (يلغي المسودة بعد موافقتك)', async () => {
            if (!w.confirm('تحديث الباقة وإلغاء المسودة غير المحفوظة؟')) return;
            await openOwner(row.product_key);
          });
          const history = el('div', 'f99g4-history'); editor.append(history);
          button(editor, 'عرض سجل التعديلات والاسترجاع', async () => {
            try {
              const key = row.product_key;
              const result = await admin('f99g4_owner_history', {p_product_key: key, p_limit: 20});
              if (!live() || row.product_key !== key || !history.isConnected) return;
              history.replaceChildren();
              if (!result.items.length) history.append(el('p', '', 'لا توجد تعديلات مسجلة بواسطة هذه الإضافة بعد.'));
              for (const item of result.items) button(history, 'استرجاع مسودة قبل المراجعة ' + item.after_revision, () => {
                if (!w.confirm('استرجاع هذه النسخة كمسودة؟ لن تحفظ حتى تضغط حفظ واعتماد.')) return;
                const restored = restoreDraft(item.before_guidance, readDraft());
                row.guidance_content = restored; render(); status.textContent = 'استرجعت مسودة سابقة. الأسئلة الأحدث محفوظة ومعطلة؛ راجع ثم احفظ صراحةً.';
              });
            } catch (error) {if (live()) status.textContent = errorText(error);}
          });
        }
        select.onchange = () => {if (w.confirm('تبديل الباقة وإلغاء أي تعديل غير محفوظ؟')) {render(); status.textContent = '';}
          else select.value = row.product_key;}; render(); status.textContent = 'هذه إضافة للأسئلة والإجابات فقط، وليست بديلًا عن محرر الباقة الأصلي.';
      } catch (error) {if (live()) status.textContent = errorText(error);}
    }
    function attachClient(host, session) {
      const panel = el('section', 'o2-card f99g4-client'); panel.id = 'f99g4-client';
      panel.append(el('h3', '', 'اسأل من الإجابات المعتمدة في باقتك'), el('p', 'o2-muted', DISCLOSURE),
        el('p', 'o2-muted', 'نبحث في أسئلة وإجابات اعتمدها المالك. هذه ليست محادثة حرة أو إجابة مولّدة.'));
      const intro = el('p', 'f99g4-text'); panel.append(intro);
      const status = el('p', 'o2-muted', 'جاري التحقق من كود باقتك...'); status.setAttribute('role', 'status'); panel.append(status);
      const choices = el('div', 'o2-actions'); panel.append(choices);
      const form = el('form'); const query = field(form, 'سؤالك أو عبارة مفتاحية', '', false, 500);
      const ask = el('button', 'o3-btn', 'ابحث في الإجابات المعتمدة'); ask.type = 'submit'; ask.disabled = true;
      form.append(ask); panel.append(form);
      const answer = el('p', 'f99g4-text'); answer.setAttribute('role', 'status'); panel.append(answer); host.prepend(panel);
      panelSession = session;
      let requestSerial = 0;
      const live = () => panel.isConnected && sameSession(session);
      function renderChoices(content) {
        intro.textContent = content.intro || ''; choices.replaceChildren();
        for (const q of content.faqs || []) button(choices, q.question, () => void answerQuery('', q.id));
        status.textContent = content.faqs?.length ? 'اختر سؤالًا أو اكتب عبارة مفتاحية. كل إجابة يعاد التحقق من اعتمادها وصلاحية الكود.' : 'ما فيه إجابات مفعلة لهذه الباقة حاليًا.';
      }
      async function answerQuery(text, id) {
        if (!live()) return;
        const serial = ++requestSerial;
        ask.disabled = true; choices.querySelectorAll('button').forEach(b => b.disabled = true); answer.textContent = '';
        try {
          const content = await clientRead(session); if (!live() || serial !== requestSerial) return;
          renderChoices(content); const result = resolve(content, text, id); answer.textContent = result.text;
        } catch (error) {if (live() && serial === requestSerial) {answer.textContent = errorText(error); choices.replaceChildren(); intro.textContent = '';}}
        finally {if (live() && serial === requestSerial) {ask.disabled = false; choices.querySelectorAll('button').forEach(b => b.disabled = false);}}
      }
      form.onsubmit = event => {event.preventDefault(); void answerQuery(query.value);};
      clientRead(session).then(content => {if (live()) {renderChoices(content); ask.disabled = false;}})
        .catch(error => {if (live()) status.textContent = errorText(error);});
    }
    function decorate() {
      if (!owner()) {
        if (ownerModal) {ownerModal.remove(); ownerModal = null;}
        d.querySelectorAll('[data-g4-owner]').forEach(n => n.remove());
      } else {
        const grid = d.querySelector('.owner-grid');
        if (grid && !d.getElementById('f99g4-owner-entry')) {
          const entry = button(grid, 'أسئلة وإجابات باقات الإرشادات', () => void openOwner());
          entry.id = 'f99g4-owner-entry'; entry.className = 'owner-tile'; entry.dataset.g4Owner = '1';
        }
        const originalSave = d.querySelector('#f99o2-main #o2-save');
        if (originalSave && !d.getElementById('f99g4-o2-edit')) {
          const b = button(originalSave.parentElement, 'الأسئلة والأجوبة المعتمدة لهذه الباقة', () => {
            const key = d.querySelector('#f99o2-main .o2-focused [data-service]')?.dataset.service || '';
            void openOwner(key);
          }); b.id = 'f99g4-o2-edit'; b.dataset.g4Owner = '1';
        }
        const originalFields = d.querySelector('#f99o3-overlay .o3-inputs');
        const actions = originalFields?.querySelector('.o3-actions');
        if (actions && !actions.querySelector('[data-g4-owner]')) {
          const b = button(actions, 'تحرير أسئلة وإجابات الإرشادات (إن كانت الباقة إرشادية)', () => {
            const key = originalFields.parentElement.querySelector('select')?.value || ''; void openOwner(key);
          }); b.dataset.g4Owner = '1';
        }
      }
      const current = clientSession();
      let existing = d.getElementById('f99g4-client');
      if (existing && (!panelSession || !sameSession(panelSession))) {existing.remove(); existing = null; panelSession = null;}
      if (!current) {if (existing) existing.remove(); panelSession = null; return;}
      const host = d.querySelector('#f99o2-main'); const overlay = d.getElementById('f99o2-overlay');
      // Approved FAQ access is independent of booking; the RPC still enforces package, service, session and explicit FAQ enablement.
      if (host && overlay && !overlay.hidden && !existing) attachClient(host, current);
    }
    let scheduled = false;
    function schedule() {if (!scheduled) {scheduled = true; w.setTimeout(() => {scheduled = false; decorate();}, 80);}}
    function boot() {decorate(); new w.MutationObserver(schedule).observe(d.body,
      {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']});}
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
    return {openOwner, decorate};
  }
  return Object.freeze({normalize, resolve, defaults, restoreDraft, validate, install, DISCLOSURE, UNKNOWN});
});
