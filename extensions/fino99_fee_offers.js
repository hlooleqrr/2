/* FINO99 F13: explicit mounts only. NEW owner_defined SSOT; no calculator/session/code mutation.
 * No payment, signature, official invoice or legal-compliance claim. No server PDF binary.
 * S12 calls mountClientOffer at FEES endflow; parent owns single-session decline suppression.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.F99FeeOffers = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const textDefs = [
    ['f13_title','عنوان عرض الأتعاب','{title}',['title']],
    ['f13_amount','أتعاب العرض','{amount} ريال',['amount']],
    ['f13_amounts','الأتعاب السابقة والخصم','المبلغ الأساسي: {base} — الخصم الثابت: {discount}',['base','discount']],
    ['f13_meta','مدة عرض المالك','أتعاب حددها المالك • {start} • حتى {expiry}',['start','expiry']],
    ['f13_terms_title','عنوان الشروط','الشروط قبل الإقرار',[]],
    ['f13_notice','حدود الموافقة','الموافقة هنا إقرار بالشروط وإبداء اهتمام فقط؛ ليست توقيع عقد أو سدادًا أو تنفيذ تمويل.',[]],
    ['f13_ack','نص الإقرار','قرأت الشروط وأقر بها وأبدي اهتمامي بالعرض.',[]],
    ['f13_accept','زر الموافقة','إقرار بالشروط وإبداء اهتمام',[]],
    ['f13_read_terms','تنبيه قراءة الشروط','اقرأ الشروط ثم حدد الإقرار أولًا.',[]],
    ['f13_existing','موافقة مسجلة','تم تسجيل الاهتمام والإقرار بهذه النسخة؛ ليست عملية سداد أو توقيع.',[]],
    ['f13_accepted','بعد الموافقة','سُجل إقرارك واهتمامك فقط. يراجع المالك الخطوة التالية.',[]],
    ['f13_retry','تعذر تأكيد الاتصال','تعذر تأكيد الاتصال؛ أعد المحاولة بنفس الطلب.',[]],
    ['f13_refresh','تحديث العرض','تحديث العرض وقراءة الشروط',[]],
    ['f13_load_error','تعذر تحميل العرض','تعذر تحميل العرض؛ لا يوجد مبلغ مؤكد محليًا.',[]],
    ['f13_external_notice','حدود رابط العرض','رابط خارجي فقط — لا يوجد اتصال checkout أو تحقق دفع.',[]],
    ['f13_external_action','إجراء العرض الخارجي','فتح المنصة الخارجية',[]],
    ['f13_error_changed','تغير العرض','تغيّر العرض؛ حدّث البيانات وأعد قراءة الشروط قبل المحاولة.',[]],
    ['f13_error','تعذر التنفيذ','تعذر التنفيذ بأمان: {reason}',['reason']]
  ];
  if (typeof window !== 'undefined') window.F99Texts?.register(textDefs.map(([key,label,text,vars]) => ({key:'followup22.'+key,label,text,vars,category:key.includes('ack')||key.includes('accept')||key.includes('notice')||key.includes('retry')||key.includes('error')?'الموافقة والاعتذار والتأجيل':'عروض المتابعة'})));
  const T = (key, vars, fallback) => typeof window !== 'undefined' && window.F99T ? window.F99T('followup22.' + key, vars, fallback) : fallback;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const NOTICE = 'الموافقة هنا إقرار بالشروط وإبداء اهتمام فقط؛ ليست توقيع عقد أو سدادًا أو تنفيذ تمويل.';
  const DRAFT_NOTICE = 'مسودة فاتورة/مطالبة فقط، ليست وثيقة ضريبية معتمدة ولا إثبات سداد. إصدار الفاتورة النظامية والضريبة والسداد محجوب.';
  function safeHttps(value) {
    if (typeof value !== 'string' || value.length > 1500 || /[\s\u0000-\u001f\u007f<>"'\\]/.test(value)) return false;
    try { const u = new URL(value); return /^https:\/\/[A-Za-z0-9]/.test(value) && u.protocol === 'https:' && !u.username && !u.password; }
    catch (_) { return false; }
  }
  function newRequestId(o) {
    const id = o?.requestId?.() || globalThis.crypto?.randomUUID?.();
    if (!UUID.test(id || '')) throw new Error('REQUEST_UUID_REQUIRED');
    return id;
  }
  function createApi(options) {
    const o = options || {};
    if (typeof o.rpc !== 'function') throw new Error('RPC_REQUIRED');
    async function unpack(response) {
      const r = await response;
      if (r?.error) throw new Error('RPC_FAILED');
      // Supports both original finoRpc wrapper and Supabase-like data envelope, no logs.
      if (r && Object.prototype.hasOwnProperty.call(r, 'data')) {
        if (r.ok === false) throw new Error('RPC_FAILED');
        return r.data;
      }
      return r;
    }
    async function owner(action, payload = {}) {
      // Actor source supplied by original custom-admin session. No service-role bypass.
      const actor = await o.ownerActor?.();
      const token = typeof actor === 'string' ? actor : actor?.token;
      if (!UUID.test(token || '') || typeof o.ownerRpc !== 'function') throw new Error('OWNER_SESSION_REQUIRED');
      return unpack(o.ownerRpc('f99f13_owner', { p_token: token, p_action: action, p_payload: payload }));
    }
    async function client(action, payload = {}) {
      const ctx = await o.entryContext?.();
      if (!UUID.test(ctx?.entryToken || '') || !ctx?.deviceId) throw new Error('ENTRY_SESSION_REQUIRED');
      // Server assert_entry is FIRST on every read/accept; S12 owns final session close guard.
      return unpack(o.rpc('f99f13_client', { p_entry_token: ctx.entryToken, p_device_id: ctx.deviceId, p_action: action, p_payload: payload }));
    }
    return Object.freeze({
      catalog: (payload = {}) => owner('catalog', payload),
      lookupCode: code => owner('lookup_code', { p_code: String(code || '') }),
      saveOffer: payload => owner('save_offer', payload), setEnabled: payload => owner('set_enabled', payload),
      documents: (payload = {}) => owner('documents', payload),
      invoiceOwner: payload => owner('invoice_owner', payload),
      previewDocument: id => owner('preview_document', { document_id: id }),
      acceptances: (payload = {}) => owner('acceptances', payload),
      prepareContractDraft: id => owner('prepare_contract_draft', { acceptance_id: id }),
      linkExistingContract: payload => owner('link_existing_contract', payload),
      getClientOffer: () => client('context'), readcontext: () => client('readcontext'),
      accept: payload => client('accept', payload)
    });
  }
  function node(doc, tag, text, cls) {
    const e = doc.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (cls) e.className = cls;
    return e;
  }
  function requireHost(host) {
    if (!host?.ownerDocument || typeof host.appendChild !== 'function') throw new Error('EXPLICIT_CONTAINER_REQUIRED');
  }
  function button(doc, host, label, run) {
    const b = node(doc, 'button', label, 'f99f13-button'); b.type = 'button'; b.onclick = run; host.appendChild(b); return b;
  }
  function field(doc, host, label, type, value = '') {
    const wrap = node(doc, 'label', '', 'f99f13-field'); wrap.appendChild(node(doc, 'span', label));
    const input = node(doc, type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
    if (!['textarea', 'select'].includes(type)) input.type = type;
    if (type === 'checkbox') input.checked = value === true; else input.value = value;
    wrap.appendChild(input); host.appendChild(wrap); return input;
  }
  function option(doc, select, value, label) {
    const o = node(doc, 'option', label); o.value = value; select.appendChild(o);
  }
  function textError(status, r) {
    status.textContent = r?.reason === 'F13_CAS_CONFLICT' || r?.reason === 'F13_OFFER_CHANGED'
      ? T('f13_error_changed', {}, 'تغيّر العرض؛ حدّث البيانات وأعد قراءة الشروط قبل المحاولة.')
      : T('f13_error', {reason:String(r?.reason || 'تعذر الاتصال.')}, 'تعذر التنفيذ بأمان: ' + String(r?.reason || 'تعذر الاتصال.'));
  }
  function offerPanel(doc, host, offer) {
    host.appendChild(node(doc, 'h3', T('f13_title', {title:offer.title}, offer.title)));
    host.appendChild(node(doc, 'p', T('f13_amount', {amount:offer.trueOfferAmount}, offer.trueOfferAmount + ' ريال'), 'f99f13-amount'));
    host.appendChild(node(doc, 'p', T('f13_amounts', {base:offer.baseAmount,discount:offer.discountAmount}, 'المبلغ الأساسي: ' + offer.baseAmount + ' — الخصم الثابت: ' + offer.discountAmount)));
    host.appendChild(node(doc, 'p', T('f13_meta', {start:offer.owner_defined_at,expiry:offer.expires_at}, 'أتعاب حددها المالك • ' + offer.owner_defined_at + ' • حتى ' + offer.expires_at), 'f99f13-meta'));
    host.appendChild(node(doc, 'h4', T('f13_terms_title', {}, 'الشروط قبل الإقرار')));
    host.appendChild(node(doc, 'pre', offer.validTerms, 'f99f13-terms'));
    host.appendChild(node(doc, 'p', T('f13_notice', {}, NOTICE), 'f99f13-notice'));
    if (offer.scope === 'external_link') {
      host.appendChild(node(doc, 'p', T('f13_external_notice', {}, 'رابط خارجي فقط — لا يوجد اتصال checkout أو تحقق دفع.'), 'f99f13-notice'));
      if (safeHttps(offer.external_url)) { const a = node(doc, 'a', T('f13_external_action', {}, 'فتح المنصة الخارجية')); a.href = offer.external_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; host.appendChild(a); }
    }
  }
  function mountClientOffer(container, options) {
    requireHost(container);
    const o = options || {}, api = o.api, doc = container.ownerDocument;
    if (!api?.getClientOffer || !api?.accept) throw new Error('F13_API_REQUIRED');
    const root = node(doc, 'section', '', 'f99f13 f99f13-client'); root.dir = 'rtl'; root.hidden = true; container.appendChild(root);
    const status = node(doc, 'p', '', 'f99f13-status'); status.setAttribute('role', 'status');
    let destroyed = false, generation = 0, current = null, busy = false, pending = null;
    async function refresh() {
      const gen = ++generation;
      try {
        const r = await api.getClientOffer();
        if (destroyed || gen !== generation) return r;
        root.replaceChildren(); current = null; pending = null;
        /* B17_FRONTEND_INTEGRATION_V1 */
        if ((r?.reason === 'BANK_FOLLOWUP_PAUSED' || r?.followup_reason === 'BANK_FOLLOWUP_PAUSED') && window.F99B17Integration?.hasIntent()) {
          current = null; pending = null; root.hidden = false; window.F99BankFollowup17.showApology(root); return r;
        }
        if (!r?.ok) { root.hidden = false; root.appendChild(status); textError(status, r); return r; }
        if (!r.offer) { root.hidden = true; return r; }
        current = r.offer; root.hidden = false; offerPanel(doc, root, current); root.appendChild(status);
        if (r.acceptance) { status.textContent = T('f13_existing', {}, 'تم تسجيل الاهتمام والإقرار بهذه النسخة؛ ليست عملية سداد أو توقيع.'); return r; }
        const ack = field(doc, root, T('f13_ack', {}, 'قرأت الشروط وأقر بها وأبدي اهتمامي بالعرض.'), 'checkbox', false);
        const accept = button(doc, root, T('f13_accept', {}, 'إقرار بالشروط وإبداء اهتمام'), async () => {
          if (busy || destroyed || !ack.checked) { status.textContent = T('f13_read_terms', {}, 'اقرأ الشروط ثم حدد الإقرار أولًا.'); return; }
          busy = true; accept.disabled = true;
          try {
            // Keep request UUID stable for uncertain transport retries, never send client amount/package.
            pending ||= { request_id: newRequestId(o), offer_id: current.id, expected_revision: current.revision, accepted: true, terms_ack: true, interest: true };
            const res = await api.accept(pending);
            if (destroyed || gen !== generation) return;
            if (res?.reason === 'BANK_FOLLOWUP_PAUSED') {
              current = null; pending = null; window.F99BankFollowup17.showApology(root); return res;
            }
            if (res?.ok) { status.textContent = T('f13_accepted', {}, 'سُجل إقرارك واهتمامك فقط. يراجع المالك الخطوة التالية.'); ack.disabled = true; o.onAccepted?.(res.acceptance); }
            else { textError(status, res); accept.disabled = false; if (res?.reason === 'F13_OFFER_CHANGED') { current = null; accept.disabled = true; button(doc, root, T('f13_refresh', {}, 'تحديث العرض وقراءة الشروط'), refresh); } }
          } catch (_) { if (!destroyed) { status.textContent = T('f13_retry', {}, 'تعذر تأكيد الاتصال؛ أعد المحاولة بنفس الطلب.'); accept.disabled = false; } }
          finally { busy = false; }
        });
        button(doc, root, T('close', {}, 'إغلاق العرض'), () => { if (busy) return; root.hidden = true; o.onDecline?.(); });
        return r;
      } catch (_) { if (!destroyed && gen === generation) { root.hidden = false; root.replaceChildren(status); status.textContent = T('f13_load_error', {}, 'تعذر تحميل العرض؛ لا يوجد مبلغ مؤكد محليًا.'); } return { ok: false }; }
    }
    const ready = refresh();
    return { root, ready, refresh, clearFollowup() { generation++; current = null; pending = null; root.replaceChildren(); root.hidden = true; }, destroy() { destroyed = true; generation++; root.remove(); current = null; pending = null; } };
  }
  function documentText(s) {
    return ['FINO99 — مسودة فاتورة/مطالبة', 'رقم المستند: ' + s.documentNo, 'التاريخ: ' + s.created_at,
      'العميل: ' + s.customer_name, 'الخدمة: ' + s.service_description,
      'الأساسي: ' + s.base_amount + ' ريال', 'الخصم: ' + s.discount_amount + ' ريال',
      'الإجمالي: ' + s.total_amount + ' ريال', s.notice || DRAFT_NOTICE].join('\n');
  }
  function previewPanel(container, result, options) {
    requireHost(container);
    const o = options || {}, doc = container.ownerDocument, s = result?.snapshot;
    if (!result?.ok || !s || s.state !== 'DRAFT' || s.invoice_issued !== false || s.tax_document !== false) throw new Error('AUTHORITATIVE_DRAFT_PREVIEW_REQUIRED');
    const root = node(doc, 'article', '', 'f99f13-preview');
    root.appendChild(node(doc, 'pre', documentText(s), 'f99f13-terms')); container.appendChild(root);
    const status = node(doc, 'p', 'طباعة أو حفظ PDF عبر المتصفح فقط؛ لا يُحفظ ملف PDF خادميًا.'); root.appendChild(status);
    button(doc, root, 'طباعة / حفظ PDF من المتصفح', () => {
      const win = doc.defaultView?.open?.('', '_blank');
      if (!win?.document) { status.textContent = 'اسمح بنافذة الطباعة في المتصفح.'; return; }
      const d = win.document; d.title = 'FINO99 — مسودة فاتورة/مطالبة';
      const article = node(d, 'article', '', 'f99f13'); article.dir = 'rtl'; article.appendChild(node(d, 'pre', documentText(s), 'f99f13-terms'));
      const css = node(d, 'link'); css.rel = 'stylesheet'; css.href = new URL('/extensions/fino99_fee_offers.css', doc.baseURI).href;
      d.head.appendChild(css); d.body.replaceChildren(article);
      win.addEventListener('afterprint', () => win.close(), { once: true });
      // Wait stylesheet load, with a bounded fallback; all content is textContent.
      let printed = false; const run = () => { if (!printed) { printed = true; win.print(); } }; css.onload = run; css.onerror = run; win.setTimeout(run, 1000);
    });
    button(doc, root, 'مشاركة نص المسودة', async () => {
      try { const nav = doc.defaultView?.navigator; if (nav?.share) await nav.share({ title: 'مسودة فاتورة/مطالبة', text: documentText(s) });
        else if (nav?.clipboard?.writeText) await nav.clipboard.writeText(documentText(s)); else throw new Error('NO_SHARE');
        status.textContent = 'النص جاهز للمشاركة بوصفه مسودة، وليس فاتورة ضريبية.';
      } catch (_) { status.textContent = 'تعذرت المشاركة؛ انسخ نص المعاينة.'; }
    });
    o.onPreview?.(s); return root;
  }
  function prepareOwnerDraft(container, options) {
    requireHost(container); const o = options || {}, api = o.api, doc = container.ownerDocument;
    const root = node(doc, 'section', '', 'f99f13'); root.dir = 'rtl'; container.appendChild(root);
    root.appendChild(node(doc, 'h3', 'مسودة فاتورة/مطالبة')); root.appendChild(node(doc, 'p', DRAFT_NOTICE, 'f99f13-notice'));
    const form = node(doc, 'form', '', 'f99f13-form'); root.appendChild(form);
    const name = field(doc, form, 'اسم العميل', 'text'), desc = field(doc, form, 'وصف الخدمة', 'textarea');
    const base = field(doc, form, 'المبلغ الأساسي بالريال', 'text'), discount = field(doc, form, 'الخصم الثابت بالريال', 'text', '0');
    base.inputMode = discount.inputMode = 'decimal';
    const status = node(doc, 'p', '', 'f99f13-status'); status.setAttribute('role', 'status'); root.appendChild(status);
    const preview = node(doc, 'div'); root.appendChild(preview);
    let busy = false, pending = null;
    form.oninput = () => { pending = null; };
    const submit = button(doc, form, 'حفظ مسودة جديدة ومعاينتها', async () => {
      if (busy) return; busy = true; submit.disabled = true;
      try {
        pending ||= { request_id: newRequestId(o), customer_name: name.value, service_description: desc.value, base_amount: base.value, discount_amount: discount.value };
        const r = await api.invoiceOwner(pending);
        if (!r?.ok) { textError(status, r); return; }
        // Authoritative DB read required for every printable/shareable preview.
        const p = await api.previewDocument(r.id); if (!p?.ok) { textError(status, p); return; }
        preview.replaceChildren(); previewPanel(preview, p, o); status.textContent = 'حُفظت مسودة جديدة في السجل غير القابل للتعديل.'; pending = null; o.onSaved?.(p);
      } catch (_) { status.textContent = 'تعذر الاتصال؛ لا نعرض إجماليًا محسوبًا من العميل كمستند محفوظ.'; }
      finally { busy = false; submit.disabled = false; }
    });
    form.onsubmit = event => event.preventDefault();
    return { root, destroy() { root.remove(); } };
  }
  function openOwner(container, options) {
    requireHost(container); const o = options || {}, api = o.api, doc = container.ownerDocument;
    if (!api?.catalog || !api?.saveOffer) throw new Error('F13_API_REQUIRED');
    const root = node(doc, 'section', '', 'f99f13 f99f13-owner'); root.dir = 'rtl'; container.appendChild(root);
    root.appendChild(node(doc, 'h2', 'عروض الأتعاب'));
    if (typeof window !== 'undefined' && window.F99BotTextsPortal) button(doc, root, 'نصوص العرض وواتساب', () => window.F99BotTextsPortal && window.F99BotTextsPortal.open({category:'عروض المتابعة'}));
    root.appendChild(node(doc, 'p', 'بوابة واحدة: كود محدد أولًا، ثم الباقة، ثم الرابط الخارجي. مبالغ مستقلة يحددها المالك، لا تغيّر أسعار الباقات.', 'f99f13-notice'));
    const nav = node(doc, 'nav', '', 'f99f13-actions'), status = node(doc, 'p', '', 'f99f13-status'), body = node(doc, 'div'); root.appendChild(nav); root.appendChild(status); root.appendChild(body);
    status.setAttribute('role', 'status'); let destroyed = false, version = 0, catalog = null;
    const fail = r => textError(status, r);
    async function load() {
      const gen = ++version; status.textContent = 'جاري قراءة عروض المالك…';
      try { const r = await api.catalog(); if (destroyed || gen !== version) return r; if (!r?.ok) { fail(r); return r; }
        catalog = r; status.textContent = ''; body.replaceChildren();
        button(doc, body, 'إعداد عرض جديد', () => editor());
        (r.items || []).forEach(offer => {
          const card = node(doc, 'article', '', 'f99f13-card'); body.appendChild(card); offerPanel(doc, card, offer);
          card.appendChild(node(doc, 'p', 'النطاق: ' + offer.scope + ' • ' + offer.scopeKey + ' • ' + (offer.enabled ? 'مفعّل' : 'متوقف')));
          button(doc, card, 'تعديل العرض بإصدار جديد', () => editor(offer));
          const toggle = button(doc, card, offer.enabled ? 'تعطيل العرض' : 'تفعيل العرض', async () => {
            toggle.disabled = true;
            try { const r2 = await api.setEnabled({ id: offer.id, expected_revision: offer.revision, enabled: !offer.enabled, approved: true, request_id: newRequestId(o) }); if (r2?.ok) await load(); else fail(r2); }
            catch (_) { fail(); } finally { toggle.disabled = false; }
          });
        });
        if (r.has_more) status.textContent = 'تُعرض أحدث 100 سجل؛ بقية السجلات متاحة عبر catalog.offset.';
        return r;
      } catch (_) { if (!destroyed) fail(); return { ok: false }; }
    }
    function editor(offer) {
      body.replaceChildren(); const form = node(doc, 'form', '', 'f99f13-form'); body.appendChild(form);
      const scope = field(doc, form, 'طريقة الربط', 'select'); [['code','كود عميل محدد'],['package','باقة'],['external_link','رابط خارجي لباقته']].forEach(([v,l]) => option(doc, scope, v, l)); scope.value = offer?.scope || 'package'; scope.disabled = !!offer;
      const packageSelect = field(doc, form, 'الباقة المؤهلة (مباشرة من storefront/O2)', 'select');
      (catalog.eligiblePackages || []).forEach(p => option(doc, packageSelect, p.packageKey, p.name));
      const secret = field(doc, form, 'كود العميل — لا يُحفظ في دفتر العروض', 'password'); secret.autocomplete = 'off';
      const target = node(doc, 'p'); form.appendChild(target); let code = null;
      const services = field(doc, form, 'الخدمة المؤهلة', 'select');
      const url = field(doc, form, 'رابط HTTPS خارجي فقط', 'url', offer?.external_url || '');
      const title = field(doc, form, 'عنوان العرض', 'text', offer?.title || ''), terms = field(doc, form, 'الشروط كاملة قبل موافقة العميل', 'textarea', offer?.validTerms || '');
      const base = field(doc, form, 'الأتعاب الأساسية', 'text', offer?.baseAmount || ''), disc = field(doc, form, 'خصم ثابت واحد', 'text', offer?.discountAmount || '0');
      base.inputMode = disc.inputMode = 'decimal';
      const starts = field(doc, form, 'بداية بصيغة ISO مع +03:00', 'text', offer?.starts_at || ''), ends = field(doc, form, 'النهاية بصيغة ISO مع +03:00', 'text', offer?.expires_at || '');
      const enabled = field(doc, form, 'تفعيل العرض', 'checkbox', offer?.enabled ?? true), approval = field(doc, form, 'أعتمد صراحة مبلغ هذا العرض الجديد المستقل', 'checkbox', false);
      function setServices(values) { services.replaceChildren(); values.forEach(v => option(doc, services, v, v)); if (offer) services.value = offer.serviceKey; }
      function change() { secret.parentNode.hidden = scope.value !== 'code'; packageSelect.parentNode.hidden = scope.value === 'code'; url.parentNode.hidden = scope.value !== 'external_link';
        if (scope.value === 'code') setServices(offer ? [offer.serviceKey] : code?.allowedServices || []);
        else setServices((catalog.eligiblePackages || []).find(p => p.packageKey === packageSelect.value)?.allowedServices || []); }
      if (offer) { if (offer.scope === 'code') { code = { CodeId: offer.scopeKey, allowedServices: [offer.serviceKey] }; secret.parentNode.hidden = true; target.textContent = 'الكود مرتبط بمعرفه، ولا يعاد عرض سره.'; }
        else packageSelect.value = offer.scopeKey; packageSelect.disabled = services.disabled = true; }
      const lookup = button(doc, form, 'التعرف على الكود وصلاحياته', async () => {
        const value = secret.value; secret.value = ''; code = null;
        try { const r = await api.lookupCode(value); if (!r?.ok) { fail(r); return; } code = r.code;
          target.textContent = code.name + ' • ' + code.masked + ' • ' + code.packageKey + ' • ' + code.status;
          setServices(code.allowedServices || []);
        } catch (_) { fail(); }
      });
      scope.onchange = () => { code = null; lookup.hidden = scope.value !== 'code'; change(); }; packageSelect.onchange = change; change(); lookup.hidden = scope.value !== 'code' || !!offer;
      let busy = false, pending = null; form.oninput = () => { pending = null; };
      const save = button(doc, form, 'اعتماد وحفظ العرض', async () => {
        if (busy) return;
        if (!approval.checked || (scope.value === 'code' && (!code || (code.status && code.status !== 'eligible')))) { status.textContent = 'تعرف على كود مؤهل واعتمد المبلغ صراحة أولًا.'; return; }
        busy = true; save.disabled = true;
        try { pending ||= { request_id: newRequestId(o), expected_revision: offer?.revision || 0, scope: scope.value,
          scope_key: scope.value === 'code' ? code.CodeId : packageSelect.value, service_key: services.value, title: title.value, terms: terms.value,
          base_amount: base.value, discount_amount: disc.value, starts_at: starts.value, expires_at: ends.value, enabled: enabled.checked, approved: true,
          ...(offer ? { id: offer.id } : {}), ...(scope.value === 'external_link' ? { external_url: url.value } : {}) };
          const r = await api.saveOffer(pending); if (r?.ok) await load(); else fail(r);
        } catch (_) { fail(); } finally { busy = false; save.disabled = false; }
      });
      button(doc, form, 'الرجوع دون حفظ', load); form.onsubmit = event => event.preventDefault();
    }
    async function documents() {
      ++version; body.replaceChildren(); prepareOwnerDraft(body, { ...o, onSaved: () => {} });
      try { const r = await api.documents(); if (!r?.ok) { fail(r); return; }
        (r.items || []).forEach(item => button(doc, body, item.snapshot.documentNo + ' — معاينة مسودة محفوظة', async () => {
          const p = await api.previewDocument(item.id); if (!p?.ok) { fail(p); return; } previewPanel(body, p, o);
        }));
      } catch (_) { fail(); }
    }
    async function acceptances() {
      ++version; body.replaceChildren();
      try { const r = await api.acceptances(); if (!r?.ok) { fail(r); return; }
        (r.items || []).forEach(item => {
          const card = node(doc, 'article', '', 'f99f13-card'); body.appendChild(card); offerPanel(doc, card, item.snapshot);
          card.appendChild(node(doc, 'p', 'إقرار اهتمام محفوظ: ' + item.id + ' — ' + item.accepted_at));
          button(doc, card, 'عرض حدود الربط بالعقود وsnapshot', async () => {
            const res = await api.prepareContractDraft(item.id); if (res?.state !== 'BLOCKED') { fail(res); return; }
            card.appendChild(node(doc, 'p', 'BLOCKED: منظومة العقود الحالية لا توفر بروتوكول إنشاء مسودة؛ لا ننشئ عقدًا أو نصرف أكوادًا تلقائيًا.', 'f99f13-notice'));
            card.appendChild(node(doc, 'pre', 'fees: ' + res.proposedTerms.fees + '\ndiscount: 0\ndeposit: 0\n' + res.snapshot.validTerms, 'f99f13-terms'));
            card.appendChild(node(doc, 'p', 'اختر القالب المعتمد والأطراف بنفسك في مركز العقود. المبلغ المقترح من القبول SSOT، دون خصم ثانٍ.'));
            if (typeof o.openexistingContractOwner === 'function') button(doc, card, 'فتح مركز العقود الحالي', () => o.openexistingContractOwner(item.contract_id || null));
            else card.appendChild(node(doc, 'p', 'فتح مركز العقود غير موصول في هذه التركيبة. لا توجد عملية إنشاء متاحة.'));
          });
          if (!item.contract_id) {
            const id = field(doc, card, 'معرف عقد موجود اختاره المالك (ربط مرجعي فقط)', 'text');
            const approve = field(doc, card, 'أؤكد اختيار العقد ومراجعة قالبِه وأطرافه والمبلغ بلا خصم ثانٍ', 'checkbox', false);
            const link = button(doc, card, 'ربط مرجعي بالعقد الموجود', async () => {
              if (!approve.checked || !UUID.test(id.value)) { status.textContent = 'اختر عقدًا فعليًا وأقر بمراجعته أولًا.'; return; }
              link.disabled = true;
              try { const v = await api.linkExistingContract({ request_id: newRequestId(o), acceptance_id: item.id, deal_id: id.value, approved: true });
                if (v?.ok) { status.textContent = 'سُجل ربط مرجعي فقط؛ لم يتغير العقد ولم ينفّذ.'; link.disabled = true; } else { fail(v); link.disabled = false; }
              } catch (_) { fail(); link.disabled = false; }
            });
          }
        });
      } catch (_) { fail(); }
    }
    button(doc, nav, 'العروض', load); button(doc, nav, 'مسودات المستندات', documents); button(doc, nav, 'إقرارات الاهتمام / العقود الحالية', acceptances);
    const ready = load(); return { root, ready, refresh: load, destroy() { destroyed = true; version++; root.remove(); } };
  }
  return Object.freeze({ createApi, openOwner, mountClientOffer, prepareOwnerDraft, previewPanel, documentText, safeHttps, NOTICE, DRAFT_NOTICE });
});
