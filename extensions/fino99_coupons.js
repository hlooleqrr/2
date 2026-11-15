/* FINO99 C10: explicit opt-in mounts only. No calculator, activation or payment mutation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.F99Coupons = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const NOTICE = 'ربط الدفع الفعلي غير مثبت؛ لا يمكن تطبيق خصم هنا أو تعديل شراء سابق. إعداد المالك للكوبون ليس دليل دفع طلب.';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const normalizeCode = value => String(value || '').trim().toUpperCase();
  function safeHttps(value) {
    if (!value) return true;
    return value.length <= 1500 && /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]+)?(?:[/?#][^\s]*)?$/.test(value)
      && !/[<>"'\\\x00-\x1f\x7f]/.test(value);
  }
  function validateCoupon(c) {
    const errors = [];
    if (!c || typeof c !== 'object' || Array.isArray(c)) return ['INVALID_COUPON_FIELDS'];
    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizeCode(c.coupon_code))) errors.push('INVALID_CODE');
    if (!/^[A-Za-z0-9_:-]{3,120}$/.test(c.product_key || '')) errors.push('INVALID_PRODUCT_KEY');
    if (!['fixed', 'percent'].includes(c.discount_kind) || typeof c.discount_value !== 'number'
      || !Number.isFinite(c.discount_value) || c.discount_value <= 0 || c.discount_value > 999999
      || (c.discount_kind === 'percent' && c.discount_value > 100)
      || Math.abs(c.discount_value * 100 - Math.round(c.discount_value * 100)) > 0.0000001) errors.push('INVALID_VALUE');
    if (!Number.isInteger(c.usage_cap) || c.usage_cap < 1 || c.usage_cap > 2147483647) errors.push('INVALID_CAP');
    const offsetDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
    if (!offsetDate.test(c.starts_at || '') || !offsetDate.test(c.expires_at || '')
      || !Number.isFinite(Date.parse(c.starts_at)) || !Number.isFinite(Date.parse(c.expires_at))
      || Date.parse(c.expires_at) <= Date.parse(c.starts_at)) errors.push('INVALID_DATES');
    if (typeof c.first_enabled !== 'boolean' || typeof c.renewal_enabled !== 'boolean'
      || (c.enabled !== undefined && typeof c.enabled !== 'boolean')
      || (c.payment_verified !== undefined && typeof c.payment_verified !== 'boolean')) errors.push('INVALID_FLAGS');
    for (const key of ['description', 'payment_setup_note']) {
      if (c[key] !== undefined && (typeof c[key] !== 'string' || c[key].length > 1000 || /[<>\x00-\x1f\x7f]/.test(c[key]))) errors.push('PLAIN_TEXT_ONLY');
    }
    if (c.payment_verified && String(c.payment_setup_note || '').trim().length < 10) errors.push('SETUP_ATTESTATION_REQUIRED');
    if (typeof (c.payment_setup_url || '') !== 'string' || !safeHttps(c.payment_setup_url || '')) errors.push('HTTPS_URL_REQUIRED');
    return [...new Set(errors)];
  }
  function formatRiyadh(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T');
  }
  function clientContext(options) {
    const o = options || {};
    if (!/^[A-Za-z0-9_:-]{3,120}$/.test(o.productKey || '') || !['first', 'renewal'].includes(o.stage)) return { allowed: false, reason: 'INVALID_CONTEXT' };
    if (o.activated === true && o.stage === 'first') return { allowed: false, reason: 'PURCHASE_ALREADY_ACTIVATED' };
    if (o.stage === 'renewal' && (o.renewalEligible !== true || !UUID.test(o.offerId || ''))) return { allowed: false, reason: 'RENEWAL_NOT_ELIGIBLE' };
    if (o.stage === 'first' && o.offerId) return { allowed: false, reason: 'INVALID_CONTEXT' };
    return { allowed: true, productKey: o.productKey, stage: o.stage, offerId: o.offerId || null };
  }
  function createApi(options) {
    const o = options || {};
    if (typeof o.rpc !== 'function') throw new Error('PUBLIC_RPC_REQUIRED');
    async function unpack(promise) {
      const response = await promise;
      if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
        if (response.error) throw new Error(response.error.message || 'RPC_FAILED');
        return response.data;
      }
      return response;
    }
    async function owner(action, payload) {
      if (typeof o.ownerRpc !== 'function' || typeof o.getOwnerToken !== 'function') throw new Error('AUTHENTICATED_OWNER_TRANSPORT_REQUIRED');
      const token = await o.getOwnerToken();
      if (!UUID.test(token || '')) throw new Error('OWNER_SESSION_REQUIRED');
      return unpack(o.ownerRpc('f99c10_owner', { p_token: token, p_action: action, p_payload: payload }));
    }
    return Object.freeze({
      catalog: (payload = {}) => owner('catalog', payload),
      save: payload => owner('save', payload),
      disable: payload => owner('disable', payload),
      history: payload => owner('history', payload),
      recordVerifiedUse: payload => owner('record_verified_use', payload),
      quote: (code, key, stage, offerId = null) => unpack(o.rpc('f99c10_quote', {
        p_coupon_code: normalizeCode(code), p_product_key: key, p_stage: stage, p_offer_id: offerId
      }))
    });
  }
  function element(doc, tag, text, className) {
    const e = doc.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (className) e.className = className;
    return e;
  }
  function requireContainer(container) {
    if (!container || !container.ownerDocument || typeof container.appendChild !== 'function') throw new Error('EXPLICIT_CONTAINER_REQUIRED');
  }
  function mountClientWidget(container, options) {
    requireContainer(container);
    const o = options || {}, context = clientContext(o), doc = container.ownerDocument;
    const section = element(doc, 'section', '', 'f99c10 f99c10-client');
    section.dir = 'rtl'; section.hidden = true;
    const text = element(doc, 'p', NOTICE, 'f99c10-notice');
    text.setAttribute('role', 'status'); section.appendChild(text); container.appendChild(section);
    let destroyed = false;
    async function refresh() {
      if (!context.allowed || destroyed) { section.hidden = true; return { enabled: false, reason: context.reason }; }
      try {
        const r = await o.api.quote('', context.productKey, context.stage, context.offerId);
        if (destroyed) return r;
        section.hidden = !(r && r.ok === true && r.enabled === true);
        section.dataset.state = 'needs_payment_integration';
        // Deliberately no apply input/button or theoretical client price: provider proof absent.
        // No caller-supplied frontend flag can turn a local quote into verified payment.
        return r;
      } catch (error) {
        if (!destroyed) { section.hidden = false; section.dataset.state = 'needs_payment_integration'; text.textContent = NOTICE; }
        return { ok: false, reason: 'QUOTE_UNAVAILABLE' };
      }
    }
    const ready = refresh();
    return Object.freeze({ ready, refresh, destroy() { destroyed = true; section.remove(); } });
  }
  function mountOwnerPanel(container, options) {
    requireContainer(container);
    const o = options || {}, api = o.api, doc = container.ownerDocument;
    if (!api || typeof api.catalog !== 'function') throw new Error('OWNER_API_REQUIRED');
    const panel = element(doc, 'section', '', 'f99c10 f99c10-owner'); panel.dir = 'rtl';
    panel.appendChild(element(doc, 'h2', 'كوبونات الخصم — تحكم المالك'));
    panel.appendChild(element(doc, 'p', NOTICE, 'f99c10-notice'));
    const status = element(doc, 'p', '', 'f99c10-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.appendChild(status);
    const catalog = element(doc, 'div', '', 'f99c10-catalog'); panel.appendChild(catalog);
    const nav = element(doc, 'div', '', 'f99c10-actions'); panel.appendChild(nav);
    let offset = 0, selected = null, destroyed = false, busy = false, lastQuote = null;
    const fields = {}, form = element(doc, 'form', '', 'f99c10-editor'); panel.appendChild(form);
    function field(parent, name, label, type = 'text') {
      const wrap = element(doc, 'label', '', 'f99c10-field'); wrap.appendChild(element(doc, 'span', label));
      const input = element(doc, 'input'); input.type = type; input.name = name;
      if (type !== 'checkbox') input.maxLength = 1000;
      wrap.appendChild(input); parent.appendChild(wrap); fields[name] = input; return input;
    }
    function select(parent, name, label, values) {
      const wrap = element(doc, 'label', '', 'f99c10-field'); wrap.appendChild(element(doc, 'span', label));
      const input = element(doc, 'select'); input.name = name;
      for (const [value, title] of values) { const option = element(doc, 'option', title); option.value = value; input.appendChild(option); }
      input.value = values[0][0]; wrap.appendChild(input); parent.appendChild(wrap); fields[name] = input; return input;
    }
    function button(parent, title, handler) {
      const b = element(doc, 'button', title); b.type = 'button'; b.addEventListener('click', handler); parent.appendChild(b); return b;
    }
    const code = field(form, 'coupon_code', 'كود الخصم (ليس كود الباقة)'); code.maxLength = 32;
    const product = field(form, 'product_key', 'مفتاح المنتج القائم'); product.maxLength = 120;
    field(form, 'description', 'وصف نصي');
    select(form, 'discount_kind', 'نوع القيمة', [['percent', 'نسبة مئوية'], ['fixed', 'مبلغ ثابت بالريال']]);
    const val = field(form, 'discount_value', 'قيمة الخصم', 'number'); val.min = '0.01'; val.step = '0.01';
    const cap = field(form, 'usage_cap', 'سقف الاستخدام المحلي (عدد صحيح موجب)', 'number'); cap.min = '1'; cap.max = '2147483647'; cap.step = '1';
    field(form, 'starts_at', 'بداية الصلاحية — توقيت الرياض', 'datetime-local');
    field(form, 'expires_at', 'نهاية الصلاحية الحصرية — توقيت الرياض', 'datetime-local');
    field(form, 'enabled', 'الكوبون نشط', 'checkbox');
    field(form, 'first_enabled', 'متاح لأول شراء قبل تفعيل الباقة', 'checkbox');
    field(form, 'renewal_enabled', 'متاح للتجديد المستحق فقط', 'checkbox');
    field(form, 'payment_verified', 'أجدد إقراري بأنني أعددت هذا الكوبون بنفسي في منصة الدفع (لكل حفظ)؛ ليس إثبات دفع طلب', 'checkbox');
    field(form, 'payment_setup_note', 'وصف الإعداد الذي أجريته بنفسي في منصة الدفع (10 أحرف على الأقل)');
    field(form, 'payment_setup_url', 'رابط إعداد/منصة الدفع اختياري HTTPS فقط', 'url');
    field(form, 'save_approval', 'أعتمد حفظ هذه الإعدادات صراحةً', 'checkbox');
    const saveButton = element(doc, 'button', 'حفظ الكوبون المعتمد'); saveButton.type = 'submit'; form.appendChild(saveButton);
    const editActions = element(doc, 'div', '', 'f99c10-actions'); panel.appendChild(editActions);
    const counters = element(doc, 'p', '', 'f99c10-counter'); panel.appendChild(counters);
    const preview = element(doc, 'section', '', 'f99c10-preview'); panel.appendChild(preview);
    preview.appendChild(element(doc, 'h3', 'اختبار سعر نظري للمالك — لا دفع ولا استهلاك'));
    select(preview, 'quote_stage', 'مرحلة المعاينة', [['first', 'أول شراء'], ['renewal', 'عرض تجديد فعلي']]);
    field(preview, 'quote_offer_id', 'UUID عرض التجديد (إلزامي للتجديد)');
    const quoteOutput = element(doc, 'p', '', 'f99c10-quote'); preview.appendChild(quoteOutput);
    let copyButton;
    const historySection = element(doc, 'section', '', 'f99c10-history'); panel.appendChild(historySection);
    historySection.appendChild(element(doc, 'h3', 'دفتر تحقق المالك وأثر التعديل'));
    const historyOutput = element(doc, 'pre'); historySection.appendChild(historyOutput);
    let historyOffset = 0;
    const recordForm = element(doc, 'form', '', 'f99c10-record'); panel.appendChild(recordForm);
    recordForm.appendChild(element(doc, 'h3', 'تسجيل تحقق يدوي من طلب مدفوع — ليس دفعًا آليًا'));
    recordForm.appendChild(element(doc, 'p', 'لا تسجل إلا بعد مراجعة طلب حقيقي بنفسك. المرجع من منصة الدفع؛ لا مرجع وهمي ولا تغيير حقوق الباقة. الاختبارات المحلية TESTONLY فقط.'));
    field(recordForm, 'order_ref', 'مرجع الطلب الفعلي');
    select(recordForm, 'use_stage', 'مرحلة الطلب الذي راجعته', [['first', 'أول شراء'], ['renewal', 'تجديد']]);
    field(recordForm, 'use_offer_id', 'UUID عرض التجديد للطلب إن كان تجديدًا');
    field(recordForm, 'owner_verification_note', 'وصف مراجعتك للدفع وربطه بالكوبون (10 أحرف على الأقل)');
    field(recordForm, 'paid_verified', 'راجعت بنفسي أن هذا الطلب مدفوع ومرتبط بالكوبون', 'checkbox');
    field(recordForm, 'use_approval', 'أعتمد تسجيل هذا الاستخدام المحلي مرة واحدة', 'checkbox');
    const recordButton = element(doc, 'button', 'تسجيل تحقق المالك فقط'); recordButton.type = 'submit'; recordForm.appendChild(recordButton);
    container.appendChild(panel);
    function show(message, bad = false) { if (!destroyed) { status.textContent = message; status.dataset.error = String(bad); } }
    function resetQuote() { lastQuote = null; quoteOutput.textContent = ''; if (copyButton) copyButton.hidden = true; }
    function populate(c) {
      selected = c; resetQuote(); historyOffset = 0; historyOutput.textContent = '';
      for (const name of ['coupon_code', 'product_key', 'description', 'discount_kind', 'discount_value', 'usage_cap', 'payment_setup_note', 'payment_setup_url']) fields[name].value = c ? String(c[name] == null ? '' : c[name]) : '';
      if (!c) { fields.discount_kind.value = 'percent'; fields.discount_value.value = '10'; fields.usage_cap.value = '1'; }
      for (const name of ['enabled', 'first_enabled', 'renewal_enabled']) fields[name].checked = c ? c[name] === true : name === 'enabled';
      // Editing/saving never silently re-attests a previously configured external coupon.
      fields.payment_verified.checked = false;
      fields.starts_at.value = c ? formatRiyadh(c.starts_at) : ''; fields.expires_at.value = c ? formatRiyadh(c.expires_at) : '';
      fields.coupon_code.disabled = !!c; fields.product_key.disabled = !!c; fields.save_approval.checked = false;
      fields.paid_verified.checked = false; fields.use_approval.checked = false;
      counters.textContent = c ? `العداد المحلي: ${c.used_count} / ${c.usage_cap} | مراجعة: ${c.revision} | توثيق إعداد منصة الدفع: ${c.payment_verified_at ? formatRiyadh(c.payment_verified_at) : 'غير مؤكد'}` : 'كوبون جديد؛ لا استخدام أو دفع تلقائي.';
    }
    function cas() {
      if (!selected) throw new Error('SELECT_COUPON_FIRST');
      return { id: selected.id, expected_revision: selected.revision, expected_updated_at: selected.updated_at };
    }
    function couponFromForm() {
      const c = {};
      for (const name of ['coupon_code', 'product_key', 'description', 'discount_kind', 'payment_setup_note', 'payment_setup_url']) c[name] = fields[name].value.trim();
      c.coupon_code = normalizeCode(c.coupon_code);
      c.discount_value = Number(fields.discount_value.value); c.usage_cap = Number(fields.usage_cap.value);
      c.starts_at = fields.starts_at.value ? fields.starts_at.value + '+03:00' : '';
      c.expires_at = fields.expires_at.value ? fields.expires_at.value + '+03:00' : '';
      for (const name of ['enabled', 'first_enabled', 'renewal_enabled', 'payment_verified']) c[name] = fields[name].checked;
      return c;
    }
    async function perform(work) {
      if (busy || destroyed) return null;
      busy = true; panel.setAttribute('aria-busy', 'true'); saveButton.disabled = true; recordButton.disabled = true;
      try {
        const result = await work();
        if (!destroyed && result && result.ok === false) show(result.reason || 'REQUEST_FAILED', true);
        return result;
      } catch (error) { show(error.message || 'REQUEST_FAILED', true); return null; }
      finally { busy = false; if (!destroyed) { panel.setAttribute('aria-busy', 'false'); saveButton.disabled = false; recordButton.disabled = false; } }
    }
    async function loadCatalog() {
      const r = await api.catalog({ limit: 100, offset });
      if (destroyed || !r || !r.ok) return r;
      catalog.replaceChildren();
      for (const c of r.items || []) {
        const b = button(catalog, `${c.coupon_code} — ${c.product_key} — ${c.used_count}/${c.usage_cap}`, () => { if (!busy) populate(c); });
        b.className = 'f99c10-catalog-item';
      }
      next.disabled = (r.items || []).length < 100; previous.disabled = offset === 0;
      return r;
    }
    const previous = button(nav, 'الصفحة السابقة', () => perform(async () => { offset = Math.max(0, offset - 100); return loadCatalog(); }));
    const next = button(nav, 'الصفحة التالية (100)', () => perform(async () => { offset += 100; return loadCatalog(); }));
    button(nav, 'تحديث الكتالوج', () => perform(loadCatalog));
    button(nav, 'إنشاء كوبون مستقل', () => { if (!busy) populate(null); });
    form.addEventListener('input', resetQuote);
    form.addEventListener('submit', event => {
      event.preventDefault(); perform(async () => {
        if (!fields.save_approval.checked) throw new Error('OWNER_APPROVAL_REQUIRED');
        const coupon = couponFromForm(), errors = validateCoupon(coupon);
        if (errors.length) throw new Error(errors.join(' / '));
        const r = await api.save({ ...(selected ? cas() : {}), approval: true, coupon });
        if (r && r.ok) { populate(r.coupon); await loadCatalog(); show('تم حفظ إعدادات الكوبون فقط؛ لم ينفذ خصم أو دفع.'); }
        return r;
      });
    });
    for (const [stage, label] of [['first', 'تعطيل الشراء الأول فقط'], ['renewal', 'تعطيل التجديد فقط'], ['all', 'تعطيل الكوبون بالكامل']]) {
      button(editActions, label, () => perform(async () => {
        if (!fields.save_approval.checked) throw new Error('OWNER_APPROVAL_REQUIRED');
        const r = await api.disable({ ...cas(), stage, approval: true });
        if (r && r.ok) { populate(r.coupon); await loadCatalog(); show('تم تعطيل المرحلة المحددة محليًا؛ راجع إعداد منصة الدفع منفصلًا.'); }
        return r;
      }));
    }
    button(preview, 'معاينة نظرية من المصدر المركزي', () => perform(async () => {
      const stage = fields.quote_stage.value, offerId = fields.quote_offer_id.value.trim() || null;
      if (stage === 'renewal' && !UUID.test(offerId || '')) throw new Error('REAL_RENEWAL_OFFER_REQUIRED');
      if (stage === 'first' && offerId) throw new Error('FIRST_STAGE_NO_OFFER');
      const r = await api.quote(fields.coupon_code.value, fields.product_key.value, stage, offerId);
      resetQuote();
      if (r && r.ok && r.theoretical_only === true && r.applied === false) {
        lastQuote = r;
        quoteOutput.textContent = `سعر نظري: ${r.base_amount} ر.س — خصم نظري: ${r.discount_amount} ر.س — الناتج النظري: ${r.quoted_amount} ر.س. لم يطبق على دفع. ${NOTICE}`;
        copyButton.hidden = !(r.copy_allowed === true && selected && selected.payment_verified && selected.coupon_code === r.coupon_code);
      }
      return r;
    }));
    copyButton = button(preview, 'نسخ الكوبون لمنصة الدفع فقط', async () => {
      if (!lastQuote || !lastQuote.copy_allowed || !selected || !selected.payment_verified || selected.coupon_code !== lastQuote.coupon_code) return;
      try {
        const clipboard = (doc.defaultView && doc.defaultView.navigator && doc.defaultView.navigator.clipboard);
        if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('COPY_UNAVAILABLE');
        await clipboard.writeText(lastQuote.coupon_code);
        show('نُسخ الكوبون فقط؛ تحقق من قبوله وقيمة الخصم في منصة الدفع.');
      } catch (error) { show(error.message || 'COPY_UNAVAILABLE', true); }
    }); copyButton.hidden = true;
    async function loadHistory() {
      const r = await api.history({ id: cas().id, limit: 100, offset: historyOffset });
      if (r && r.ok && !destroyed) historyOutput.textContent = JSON.stringify({ ledger: r.ledger, audit: r.audit, offset: historyOffset }, null, 2);
      return r;
    }
    button(historySection, 'عرض سجل التحقق والأثر (100)', () => perform(loadHistory));
    button(historySection, 'السجل التالي', () => perform(async () => { historyOffset += 100; return loadHistory(); }));
    button(historySection, 'السجل السابق', () => perform(async () => { historyOffset = Math.max(0, historyOffset - 100); return loadHistory(); }));
    recordForm.addEventListener('submit', event => {
      event.preventDefault(); perform(async () => {
        if (!fields.paid_verified.checked || !fields.use_approval.checked) throw new Error('PAYMENT_VERIFICATION_AND_APPROVAL_REQUIRED');
        const stage = fields.use_stage.value, offerId = fields.use_offer_id.value.trim() || null;
        if ((stage === 'renewal' && !UUID.test(offerId || '')) || (stage === 'first' && offerId)) throw new Error('INVALID_STAGE_OFFER');
        const r = await api.recordVerifiedUse({ ...cas(), product_key: selected.product_key, stage, offer_id: offerId,
          order_ref: fields.order_ref.value.trim(), owner_verification_note: fields.owner_verification_note.value.trim(), paid_verified: true, approval: true });
        if (r && r.ok) {
          if (r.coupon) populate(r.coupon);
          fields.paid_verified.checked = false; fields.use_approval.checked = false;
          await loadCatalog(); show(r.duplicate ? 'هذا المرجع مسجل بالفعل؛ لم يزد العداد.' : 'سُجل تحقق المالك في العداد المحلي فقط؛ لم ينفذ دفعًا أو يمنح حق باقة.');
        }
        return r;
      });
    });
    populate(null);
    const ready = perform(loadCatalog);
    return Object.freeze({ ready, refresh: () => perform(loadCatalog), destroy() { destroyed = true; panel.remove(); selected = null; lastQuote = null; } });
  }
  return Object.freeze({ createApi, mountOwnerPanel, mountClientWidget, clientContext, formatRiyadh, normalizeCode, validateCoupon, NOTICE });
});
