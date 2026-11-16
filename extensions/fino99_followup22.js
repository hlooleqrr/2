/* Round22 E: view != consent. Existing fee design and original WhatsApp builder;
 * server quotes/entry/bank guards remain authoritative. No result/image mutation. */
(function (w) {
  'use strict';
  const defs = [], category = 'عروض المتابعة', consentCategory = 'الموافقة والاعتذار والتأجيل', shareCategory = 'نصوص المشاركة عبر واتساب';
  function define(key, label, text, vars = [], cat = category, note = '') {
    defs.push({ key: 'followup22.' + key, category: cat, label, text, vars, note });
  }
  define('invite', 'دعوة مشاهدة العرض', 'يا {client}، عندك عرض خاص لمتابعة إجراءات تمويلك. ودك تشوف التفاصيل؟', ['client']);
  define('view', 'قبول مشاهدة العرض', 'نعم، أشوف العرض', [], consentCategory);
  define('postpone', 'إغلاق العرض دون متابعة', 'إغلاق العرض', [], consentCategory);
  define('title', 'عنوان بطاقة العرض', 'يا {client}، عرض متابعة إجراءات تمويلك', ['client']);
  define('entity', 'الجهة المرتبطة بالنتيجة', 'يا {client}، هذا عرض المتابعة الخاص بك على {entity}', ['client', 'entity']);
  define('previous', 'الأتعاب السابقة', 'السعر السابق: {amount} ريال', ['amount']);
  define('saving', 'التوفير المعتمد', 'وفّرت {amount} ريال على أتعاب المتابعة', ['amount']);
  define('discount', 'الخصم المعتمد', 'نسبة الخصم: {percent}٪', ['percent']);
  define('discount_amount', 'الخصم الثابت المعتمد', 'الخصم المعتمد: {amount} ريال', ['amount']);
  define('fee', 'الأتعاب', 'أتعاب المتابعة: {amount} ريال', ['amount']);
  define('discounted_fee', 'الأتعاب بعد الخصم', 'أتعاب المتابعة بعد الخصم: {amount} ريال', ['amount']);
  define('terms', 'الشروط المعتمدة', '{terms}', ['terms']);
  define('expiry', 'صلاحية العرض', 'صلاحية العرض حتى: {expiry} (بتوقيت الرياض)', ['expiry']);
  define('consent', 'الموافقة الفعلية على المتابعة', 'أبي تتابعون إجراءات تمويلي — فتح واتساب', [], consentCategory);
  define('close', 'إغلاق بطاقة العرض', 'إغلاق العرض', [], consentCategory);
  define('prepared', 'ملاحظة التجهيز دون إرسال تلقائي', 'جهّزنا رسالتك في واتساب. راجعها وأرسلها بنفسك؛ لا يتم اعتماد أي طلب تلقائيًا.', [], consentCategory);
  define('unavailable', 'تعذر تحميل العرض', 'ما قدرت أجيب عرضًا معتمدًا لهذا الكود الآن. لم يتم إرسال أي طلب.', [], consentCategory);
  define('changed', 'تحديث العرض قبل الموافقة', 'تغيّرت الحسبة أو شروط العرض؛ راجع البطاقة المحدثة قبل قبول المتابعة.', [], consentCategory);
  define('pick', 'اختيار الجهة قبل العرض', 'اختر الحسبة المناسبة لك، وأعرض لك أتعاب المتابعة المعتمدة والخصم الساري قبل إرسال أي طلب.');
  define('pick_result', 'زر اختيار حسبة', '{entity} — قسط {installment} ريال', ['entity', 'installment']);
  define('apology', 'اعتذار توقف متابعة البنك', w.F99BankFollowup17?.APOLOGY || 'نعتذر منك، خدمة متابعة إجراءات التمويل عبرنا لهذا البنك غير متاحة حاليًا.', [], consentCategory);
  define('no_financial_offer', 'لا يوجد عرض مالي معتمد', 'لا يوجد عرض متابعة مالي معتمد متاح الآن. لم يتم تسجيل طلب أو قبول.', [], consentCategory);
  define('final_message', 'نص واتساب النهائي', '{message}', ['message'], shareCategory, 'النص الأصلي الكامل في {message}. لا يتجهز إلا بعد قبول المتابعة؛ المتغير لا يتضمن أكوادًا أو بيانات جلسة.');
  ['title', 'entity', 'previous', 'saving', 'discount', 'expiry', 'terms'].forEach(k => define('show_' + k, 'إظهار النص: ' + k, '1', [], category, '1 إظهار / 0 إخفاء النص فقط؛ لا يغير الأتعاب أو الشروط المعتمدة.'));
  const messageParts = [
    ['greeting', 'السلام عليكم ورحمة الله وبركاته', [], null],
    ['intro', 'أنا {client}، أطلب عرض خدمات متابعة معاملتي التمويلية.', ['client'], 'أنا '],
    ['data_heading', '— بيانات الحسبة المبدئية —', [], null],
    ['client', 'اسم صاحب الحسبة: {value}', ['value'], 'اسم صاحب الحسبة: '],
    ['scenario', 'ملاحظة: {value}', ['value'], 'ملاحظة: '],
    ['sector', 'القطاع: {value}', ['value'], 'القطاع: '],
    ['salary_bank', 'جهة الراتب: {value}', ['value'], 'جهة الراتب: '],
    ['entity', 'الجهة المرشحة: {value}', ['value'], 'الجهة المرشحة: '],
    ['salary', 'صافي الراتب الشهري: {value}', ['value'], 'صافي الراتب الشهري: '],
    ['obligations', 'الالتزامات الشهرية الأخرى: {value}', ['value'], 'الالتزامات الشهرية الأخرى: '],
    ['settlement', 'السداد المبكر للمديونية الحالية: {value}', ['value'], 'السداد المبكر للمديونية الحالية: '],
    ['rate', 'هامش الربح السنوي: {value}', ['value'], 'هامش الربح السنوي: '],
    ['duration', 'المدة: {value}', ['value'], 'المدة: '],
    ['installment', 'القسط الشهري المتوقع: {value}', ['value'], 'القسط الشهري المتوقع: '],
    ['principal', 'أصل التمويل قبل الرسوم: {value}', ['value'], 'أصل التمويل قبل الرسوم: '],
    ['profit', 'إجمالي أرباح التمويل: {value}', ['value'], 'إجمالي أرباح التمويل: '],
    ['gross', 'إجمالي التمويل مع الأرباح: {value}', ['value'], 'إجمالي التمويل مع الأرباح: '],
    ['admin_fee', 'الرسوم الإدارية: {value}', ['value'], 'الرسوم الإدارية: '],
    ['admin_vat', 'ضريبة الرسوم الإدارية: {value}', ['value'], 'ضريبة الرسوم الإدارية: '],
    ['commodity_fee', 'رسوم السلعة إن وجدت: {value}', ['value'], 'رسوم السلعة إن وجدت: '],
    ['net', 'صافي التمويل بعد الرسوم وقبل سداد المديونية: {value}', ['value'], 'صافي التمويل بعد الرسوم وقبل سداد المديونية: '],
    ['cash', 'صافي الكاش المتوقع بعد سداد المديونية: {value}', ['value'], 'صافي الكاش المتوقع بعد سداد المديونية: '],
    ['offer_heading', '— عرض المتابعة —', [], null],
    ['fee', 'أتعاب المتابعة المعتمدة: {value}', ['value'], 'أتعاب المتابعة المعتمدة: '],
    ['previous', 'الأتعاب قبل الخصم: {value}', ['value'], 'الأتعاب قبل الخصم: '],
    ['saving', 'قيمة الخصم الساري: {value}', ['value'], 'قيمة الخصم الساري: '],
    ['percent', 'نسبة خصم الأتعاب: {value}', ['value'], 'نسبة خصم الأتعاب: '],
    ['expiry', 'صلاحية العرض حتى: {value}', ['value'], 'صلاحية العرض حتى: '],
    ['requirements', 'أرغب في معرفة المستندات والمتطلبات وخطوات المتابعة.', [], null],
    ['disclaimer', 'وأعلم أنا {client} أن هذه الحسبة مبدئية وإرشادية، وأن التمويل النهائي وشروطه من اختصاص الجهات التمويلية، وأن FINO99 وسيط خدمات وليست جهة مانحة للتمويل.', ['client'], 'وأعلم أنا '],
    ['site', 'المنصة الذكية للحلول التمويلية: {value}', ['value'], 'المنصة الذكية للحلول التمويلية: ']
  ];
  messageParts.forEach(([k, text, vars]) => {
    define('wa_' + k, 'واتساب: ' + text.split(':')[0], text, vars, shareCategory);
    define('wa_show_' + k, 'تضمين واتساب: ' + text.split(':')[0], '1', [], shareCategory, '1 تضمين / 0 إخفاء هذا التفصيل من الرسالة.');
  });
  define('wa_extra', 'النص الإضافي المعتمد في واتساب', '{value}', ['value'], shareCategory);
  define('wa_show_extra', 'تضمين النص الإضافي', '1', [], shareCategory, '1 تضمين / 0 إخفاء.');
  w.F99Texts?.register(defs);
  const T = (key, vars = {}, fallback) => w.F99T('followup22.' + key, vars, fallback);
  const shown = key => T('show_' + key) !== '0';
  const bank = () => w.F99B17Integration;
  const chat = () => document.getElementById('finoBotChat');
  const who = () => typeof clientName !== 'undefined' ? String(clientName || '') : '';
  const rows = () => typeof latestResults !== 'undefined' && Array.isArray(latestResults) ? latestResults : [];
  const data = () => typeof finoPortal !== 'undefined' ? finoPortal.data || {} : {};
  const active = () => w.F99S12Runtime?.owner?.() !== true && typeof finoPortal !== 'undefined' && finoPortal.step === 'buyout_result' && !!chat();
  const selected = () => typeof selectedResultIndex !== 'undefined' ? Number(selectedResultIndex) : -1;
  const fmt = v => typeof money === 'function' ? money(v) : String(v);
  const packageKey = () => w.F99V32MainAccess?.()?.packageKey || w.fino99ActivePackage?.()?.key;
  const entry = () => w.F99S12Runtime?.entry?.();
  const snapshot = r => JSON.stringify({ result: r, data: data(), client: who() });
  const session = () => bank()?.identity() || '';
  const postponed = new Set();
  let host = null, pending = null, epoch = 0, busy = false, displayed = '';
  function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function button(parent, text, run) { const b = el('button', text); b.type = 'button'; b.onclick = run; parent.append(b); return b; }
  function clear() { epoch++; host?.remove(); host = null; pending = null; busy = false; displayed = ''; }
  function slot(cls = 'f49-card f49-completion-request') { clear(); host = el('section', undefined, cls); host.dataset.f99Followup22 = '1'; chat()?.append(host); return host; }
  function status(text) { if (!host) return; let p = host.querySelector('[data-f22-status]'); if (!p) { p = el('p'); p.dataset.f22Status = '1'; p.setAttribute('role', 'status'); host.append(p); } p.textContent = text; }
  async function rpc(fn, args) { const r = await w.finoRpc(fn, args, 20000); if (!r?.ok || r.data?.ok !== true) throw Error(r?.data?.reason || 'FOLLOWUP_UNAVAILABLE'); return r.data; }
  function args() { const e = entry(); if (!e?.entryToken || !e.deviceId) throw Error('ENTRY_REQUIRED'); return { p_entry_token: e.entryToken, p_device_id: e.deviceId }; }
  async function allowed() {
    const st = await rpc('f99v41_client_completion_status', args());
    if (!st.enabled || !st.has_whatsapp || !st.has_first_calculation) return false;
    const cfg = await rpc('f99v80_public_fee_display', { p_package_key: packageKey() });
    if (cfg.display_mode !== 'last') return true;
    const q = await rpc('f99v23_client_status', args());
    return Number(q.max_calculations) > 0 && Number(q.calculations_remaining) === 0;
  }
  async function quote(r) { return rpc('f99v41_client_completion_quote', { ...args(), p_package_key: packageKey(), p_cash: Number(r.cashAfterDebt || 0), p_principal: Number(r.principalBeforeFees || 0) }); }
  function expiry(q) { return q.valid_until && Number.isFinite(Date.parse(q.valid_until)) ? new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(q.valid_until)) : ''; }
  async function invitation(i = selected()) {
    if (!active() || postponed.has(session())) return false;
    if (host?.isConnected && displayed === snapshot(rows()[i])) return true;
    if (host?.isConnected) clear();
    const id = session();
    try {
      if (!await allowed()) return false;
      bank().assertIdentity(id); if (!active() || postponed.has(id)) return false;
      const h = slot('f41-offer');
      displayed = snapshot(rows()[i]);
      if (!rows()[i]) {
        h.append(el('p', T('pick'))); const a = el('div', undefined, 'f49-actions'); h.append(a);
        rows().forEach((r, n) => button(a, T('pick_result', { entity: r.name, installment: fmt(r.installment) }), () => { clear(); invitation(n); }));
        button(a, T('postpone'), cancel); return true;
      }
      h.append(el('b', T('invite', { client: who() })));
      const a = el('div', undefined, 'f41-options'); h.append(a);
      const yes = button(a, T('view'), async () => { if (busy) return; busy = true; yes.disabled = true; await openCard(Number(i)); });
      yes.className = 'f41-primary'; button(a, T('postpone'), cancel); return true;
    } catch (_) { return false; }
  }
  function cancel() { if (session()) postponed.add(session()); clear(); bank()?.clearPreviews(); }
  function addText(parent, key, vars, tag = 'p', cls) { if (shown(key)) parent.append(el(tag, T(key, vars), cls)); }
  function render(r, q, offer, index, id) {
    const h = slot(), current = Number(q.new_price), old = Number(q.old_price);
    if (!Number.isFinite(current) || current < 0) throw Error('FEE_INVALID');
    const discounted = q.discount_active === true && Number.isFinite(old) && old > current;
    pending = { index, key: r.key, quote: q, snapshot: snapshot(r), session: id, offer };
    displayed = pending.snapshot;
    addText(h, 'entity', { client: who(), entity: r.name }, 'strong');
    const hero = el('div', undefined, 'f82-fee-hero'); h.append(hero);
    addText(hero, 'title', { client: who() }, 'strong');
    if (Number.isFinite(old) && shown('previous')) {
      const before = el('p'); const text = T('previous', { amount: fmt(old) });
      const amount = fmt(old) + ' ريال', at = text.indexOf(amount);
      if (at >= 0) { before.append(document.createTextNode(text.slice(0, at)), el('s', amount), document.createTextNode(text.slice(at + amount.length))); } else before.textContent = text;
      hero.append(before);
    }
    if (discounted) {
      addText(hero, 'saving', { amount: fmt(q.discount_amount ?? old - current) }, 'div', 'f82-fee-saving');
      if (q.discount_percent != null && Number.isFinite(Number(q.discount_percent))) addText(hero, 'discount', { percent: fmt(q.discount_percent) }, 'small');
      else if (shown('discount') && q.discount_amount != null) hero.append(el('small', T('discount_amount', { amount: fmt(q.discount_amount) })));
    }
    hero.append(el('div', T(discounted ? 'discounted_fee' : 'fee', { amount: fmt(current) }), 'f82-fee-price'));
    const terms = offer?.terms || offer?.validTerms || offer?.disclaimer || 'الحسبة مبدئية، والنتيجة النهائية وشروطها لدى الجهة التمويلية.';
    addText(h, 'terms', { terms });
    if (offer?.show_documents && offer.documents?.length) addText(h, 'terms', { terms: offer.documents.join('\n') }, 'pre');
    if (expiry(q)) addText(h, 'expiry', { expiry: expiry(q) });
    const actions = el('div', undefined, 'f49-actions'); h.append(actions);
    button(actions, T('consent', {}, offer?.button_text || 'أبي تتابعون إجراءات تمويلي — فتح واتساب'), send);
    button(actions, T('close'), cancel);
    h.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  async function openCard(i) {
    if (!active() || !rows()[i]) return;
    const id = session(), r = rows()[i], generation = epoch, sig = snapshot(r);
    try {
      const want = await bank().api.want({ finance_type: 'personal', bank_id: r.key });
      if (generation !== epoch) return; bank().assertIdentity(id);
      if (want?.reason === 'BANK_FOLLOWUP_PAUSED') { bank().showApology(host); busy = false; return; }
      if (want?.ok !== true || !await allowed()) throw Error('FOLLOWUP_UNAVAILABLE');
      const q = await quote(r), raw = await w.finoRpc('f99v25_public_completion_offers', {}, 20000);
      if (generation !== epoch) return; bank().assertIdentity(id);
      bank().requireBinding(q.bank_followup, { finance_type: 'personal', bank_id: r.key });
      if (q.bank_followup.intent_id !== want.bank_followup.intent_id || sig !== snapshot(rows()[i])) throw Error('RESULT_CHANGED');
      render(rows()[i], q, raw?.data?.data?.packages?.[packageKey()] || {}, i, id);
    } catch (_) { if (generation === epoch) { busy = false; status(T('unavailable')); } }
  }
  function message(r, q) {
    // Call the ORIGINAL full-detail builder only after the actual consent button.
    const original = w.F99V50DetailedText(r, q, expiry(q));
    const text = original.split('\n').map(line => {
      const part = messageParts.find(([, template, , prefix]) => prefix ? line.startsWith(prefix) : line === template);
      const [key, , , prefix] = part || ['extra', '', [], ''];
      if (T('wa_show_' + key) === '0') return '';
      return T('wa_' + key, { client: who(), value: prefix ? line.slice(prefix.length) : line }, line);
    }).filter(Boolean).join('\n');
    return T('final_message', { message: text }, text);
  }
  async function send() {
    const p = pending; if (!p || busy || !active()) return;
    busy = true; const generation = epoch;
    const r = rows()[p.index];
    try {
      bank().assertIdentity(p.session);
      if (!r || r.key !== p.key) throw Error('RESULT_CHANGED');
      await bank().api.verify(p.quote.bank_followup);
      if (!await allowed()) throw Error('FOLLOWUP_UNAVAILABLE');
      const q = await quote(r);
      const raw = await w.finoRpc('f99v25_public_completion_offers', {}, 20000);
      if (raw?.ok !== true || raw.data?.ok !== true) throw Error('OFFER_UNAVAILABLE');
      const offer = raw.data.data?.packages?.[packageKey()] || {};
      if (p !== pending || generation !== epoch) return; bank().assertIdentity(p.session);
      bank().requireBinding(q.bank_followup, { finance_type: 'personal', bank_id: r.key });
      if (q.bank_followup.intent_id !== p.quote.bank_followup.intent_id) throw Error('B17_STALE_BANK_INTENT');
      const approved = x => JSON.stringify([x.old_price, x.new_price, x.discount_amount, x.discount_percent, x.discount_active, x.valid_until, x.whatsapp]);
      if (p.snapshot !== snapshot(rows()[p.index]) || approved(q) !== approved(p.quote) || JSON.stringify(offer) !== JSON.stringify(p.offer)) {
        render(rows()[p.index], q, offer, p.index, p.session); status(T('changed')); return;
      }
      if (!/^9665\d{8}$/.test(q.whatsapp) || (q.valid_until && Date.now() >= Date.parse(q.valid_until))) throw Error('QUOTE_INVALID');
      const msg = message(rows()[p.index], q);
      w.open('https://wa.me/' + q.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
      status(T('prepared'));
    } catch (e) { if (generation === epoch) { if (bank().paused(e)) { pending = null; bank().showApology(host); } else status(T('unavailable')); } }
    finally { if (generation === epoch) busy = false; }
  }
  const originalOwner = w.F99V41CompletionOwner;
  if (typeof originalOwner === 'function') w.F99V41CompletionOwner = async function (...args) {
    const result = await originalOwner.apply(this, args);
    const target = document.querySelector('#f41-owner .f41-owner-card');
    if (target && w.F99BotTextsPortal && !target.querySelector('[data-f22-texts]')) {
      const b = button(target, 'نصوص العرض وواتساب', () => w.F99BotTextsPortal && w.F99BotTextsPortal.open({ category: 'عروض المتابعة' })); b.dataset.f22Texts = '1';
    }
    return result;
  };
  w.F99Followup22 = Object.freeze({ invitation, openCard, cancel });
  w.F99V82OpenOffer = () => invitation();
  w.F99V49CompletionOpen = () => invitation();
  w.F99V49CompletionSelect = i => openCard(Number(i));
  w.F99V41Pick = i => openCard(Number(i));
  w.F99V37StartCompletion = i => openCard(Number(i));
  w.F99V49CompletionSend = w.F99V37ConfirmCompletion = send;
  w.F99V49CompletionCancel = w.F99V37CancelCompletion = w.F99V41LeaveOrStay = cancel;
  w.F99V42RequestCompletion = () => invitation();
  // Never accept a prebuilt/stored message from older wrappers.
  w.F99V49SetCompletionText = () => false;
})(window);
