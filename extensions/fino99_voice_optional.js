/* FINO99 optional Saudi Arabic voice — source-specific, no automatic mount.
 * Reviewed source SHA-256: bc7ed77eaa07a1d558f7e2156da097b56e73e292246c88a22c3bf6da20378519
 * Classic script (not module): must follow ALL original application scripts.
 * No RPC calls, credentials, storage, audio recording, calculator or bot hooks here.
 */
(function (window, document) {
  'use strict';
  if (window.FINO99VoiceOptional) return;
  const MAX_INPUT = 160;
  const PREFIX = 'f99-voice-';
  const HELP = 'اكتب: كم القسط، كم يصفي، وش هامش الربح. للمالك: افتح الباقات، افتح السجل، افتح العقود، جهز 100 كود، جهز سعر 100 ريال. لا تكتب كلمات مرور أو أكواد بيع أو بيانات شخصية.';
  let mounted = null;

  function normalize(text) {
    return String(text).trim().replace(/[\u064b-\u065f\u0670\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
      .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0))
      .replace(/[؟?!.،,]+$/g, '').replace(/\s+/g, ' ');
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > MAX_INPUT || /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/.test(text)) return { kind: 'unknown' };
    const t = normalize(text);
    const explain = {
      'كم القسط': 'installment', 'كم القسط الشهري': 'installment',
      'كم يصفي': 'cash', 'كم صافي الكاش': 'cash', 'وش هامش الربح': 'rate', 'كم هامش الربح': 'rate'
    };
    if (Object.prototype.hasOwnProperty.call(explain, t)) return { kind: 'explain', field: explain[t] };
    const nav = {
      'افتح الباقات': 'packages', 'افتح التجديد': 'packages',
      'افتح السجل': 'history', 'افتح السجلات': 'history', 'افتح العقود': 'contracts'
    };
    if (Object.prototype.hasOwnProperty.call(nav, t)) return { kind: 'nav', target: nav[t] };
    let match = /^(?:جهز|ولد|انشئ) ([1-9]\d{0,5}) (?:كود|اكواد)$/.exec(t);
    if (match) return { kind: 'draft', text: 'مسودة طلب فقط: إنشاء ' + match[1] + ' كود. الباقة والمدة والسعر والصلاحيات لم تحدد بعد.' };
    match = /^(?:جهز سعر|السعر|غير السعر الي|عدل السعر الي) (\d{1,6}(?:\.\d{1,2})?) ريال$/.exec(t);
    if (match) return { kind: 'draft', text: 'مسودة سعر فقط: ' + match[1] + ' ريال، كما طلبت. الباقة وشروط التسعير لم تحدد بعد.' };
    const drafts = {
      'احذف الكود': 'حذف كود غير محدد', 'فعل الكود': 'تفعيل كود غير محدد',
      'اوقف الكود': 'إيقاف كود غير محدد', 'احفظ الباقة': 'حفظ باقة غير محددة',
      'انشر العرض': 'نشر عرض غير محدد', 'صفر الاستخدامات': 'تصفير استخدامات كود غير محدد'
    };
    if (Object.prototype.hasOwnProperty.call(drafts, t)) return { kind: 'draft', text: 'مسودة طلب فقط: ' + drafts[t] + '.' };
    return { kind: 'unknown' };
  }

  // Same reviewed verifier as V60/V76 PLUS central record, token type and expiry.
  // Never infer ownership from labels, adminUnlocked, storage or this feature opt-in.
  // Reads existing in-memory session only. Server revocation is still enforced by
  // the original exported navigation functions; no new auth/SQL contract is assumed.
  function verifiedOwner() {
    try {
      if (typeof activeAccess === 'undefined' || activeAccess?.record?.owner !== true || activeAccess?.record?.central !== true) return false;
      // The reviewed login opens this page only after its dashboard session check.
      if (!activePage('ownerHub')) return false;
      if (typeof finoCentralAdminToken === 'undefined' || typeof finoCentralAdminToken !== 'string' || !finoCentralAdminToken.trim()) return false;
      if (typeof window.finoCentralAdminCall !== 'function' || typeof window.F99V60Test?.owner !== 'function' || window.F99V60Test.owner() !== true) return false;
      const expiry = activeAccess.state?.expiresAt;
      if (expiry !== undefined && expiry !== null && expiry !== 0 && (!Number.isFinite(expiry) || expiry <= Date.now())) return false;
      return true;
    } catch (_) { return false; }
  }
  function activePage(id) {
    const page = document.getElementById(id);
    return !!page && !page.hidden && page.classList.contains('active');
  }
  function smartPortalMatches(result) {
    const data = finoPortal.data;
    if (!data || result.customerType !== data.customerType || result.bank?.id !== data.bankId || result.financeKind !== data.financeKind || result.hasMortgage !== !!data.hasMortgage) return false;
    for (const [resultKey, dataKey] of [['salary', 'salary'], ['rate', 'rate'], ['months', 'months'], ['deductionPercent', 'deductionPercent']]) {
      if (typeof data[dataKey] !== 'number' || !Number.isFinite(data[dataKey]) || result[resultKey] !== data[dataKey]) return false;
    }
    for (const [resultKey, dataKey] of [['earlySettlement', 'settlement'], ['external', 'external'], ['personalInstallment', 'personalInstallment'], ['mortgageCurrent', 'mortgageCurrent'], ['mortgageMax', 'mortgageMax']]) {
      if (result[resultKey] !== Number(data[dataKey] || 0)) return false;
    }
    // runFINOPortalSmart also sets smart_result on a failed eligibility branch;
    // do not explain an old object after a newer failure card. Inspect markers,
    // not chat text; no financial computation or transcript scraping is needed.
    const rows = document.getElementById('finoBotChat')?.querySelectorAll('.portal-row.assistant') || [];
    let valid = false;
    for (const row of rows) {
      if (row.querySelector('.portal-reason-box')) valid = false;
      if (row.querySelector('.portal-result')) valid = true;
    }
    return valid;
  }
  // Avoid stale results from another service. No fallback across finance sources.
  function selectedContext() {
    try {
      const smart = activePage('smartResultPage');
      const buyout = activePage('page3');
      const portal = activePage('specialistBotPage');
      if ([smart, buyout, portal].filter(Boolean).length !== 1) return null;
      let source;
      if (portal) {
        if (typeof finoPortal === 'undefined') return null;
        if (finoPortal.mode === 'buyout' && finoPortal.step === 'buyout_result') source = 'buyout';
        else if (finoPortal.mode === 'smart' && finoPortal.step === 'smart_result') source = 'smart';
        else return null;
      } else source = smart ? 'smart' : 'buyout';
      const result = source === 'smart'
        ? (typeof smartLastResult !== 'undefined' ? smartLastResult : null)
        : (typeof getSelectedResult === 'function' ? getSelectedResult() : null);
      if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
      if (portal && source === 'smart' && !smartPortalMatches(result)) return null;
      return { source, result };
    } catch (_) { return null; }
  }
  function valueText(value) {
    return value.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function explanation(field) {
    const context = selectedContext();
    if (!context) return 'ما فيه نتيجة مختارة في صفحة النتائج الحالية. اختر نتيجة موجودة أولًا؛ ما شغّلنا حسبة جديدة ولا استهلكنا استخدامًا.';
    const { result, source } = context;
    if (field === 'rate' && source === 'smart') {
      try {
        if (typeof smartOwnerShowsRate !== 'function' || smartOwnerShowsRate() !== true) return 'عرض هامش الربح غير متاح في إعدادات النتيجة الحالية.';
      } catch (_) { return 'تعذر التحقق من إعداد عرض هامش الربح.'; }
    }
    const key = field === 'cash' ? 'cashAfterDebt' : field === 'rate' ? 'rate' : 'installment';
    const value = result[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || (field !== 'cash' && value < 0)) return 'هذه القيمة غير متاحة في النتيجة المختارة. ما افترضنا أي مبلغ أو نسبة.';
    let text;
    if (field === 'installment') {
      const months = source === 'smart' ? result.months : result.actualPayments;
      text = 'بحسب النتيجة المختارة، القسط الشهري ' + valueText(value) + ' ريال';
      if (Number.isSafeInteger(months) && months > 0) text += ' لمدة ' + valueText(months) + ' شهر';
      text += '.';
    } else if (field === 'cash') {
      text = 'بحسب النتيجة المختارة، الصافي بعد الرسوم وسداد المديونية ' + valueText(value) + ' ريال.';
      if (value < 0) text += ' الصافي سالب في هذه النتيجة، وليس مبلغًا متاحًا للصرف.';
    } else text = 'هامش الربح المحتسب في النتيجة المختارة ' + valueText(value) + ' بالمئة. هذه نسبة النتيجة وليست وعدًا بنسبة جديدة أو معدل APR.';
    return text + ' الحسبة مبدئية وخاضعة لشروط جهة التمويل؛ لم نغيّرها.';
  }
  function navigation(target) {
    // Only these exact exported entrypoints. Opening them reads the original
    // workspace; save/generate/recalculate/consume helpers are NEVER invoked.
    if (target === 'packages') {
      if (typeof window.FINO99V76?.ownerHome !== 'function') throw Error('unavailable');
      return window.FINO99V76.ownerHome();
    }
    if (target === 'history') {
      if (typeof window.FINO99V76?.ownerCodePrint !== 'function') throw Error('unavailable');
      return window.FINO99V76.ownerCodePrint();
    }
    if (target === 'contracts') {
      if (typeof window.F99V20OpenContracts !== 'function') throw Error('unavailable');
      return window.F99V20OpenContracts('all');
    }
    throw Error('unavailable');
  }

  function mount(options) {
    if (mounted) return mounted;
    const host = options?.host || document.body;
    const recognitionPermitted = options?.permissions?.recognition !== false;
    const synthesisPermitted = options?.permissions?.synthesis !== false;
    if (!host || typeof host.appendChild !== 'function') throw Error('A mounted DOM host is required.');
    const listeners = [];
    let destroyed = false, enabled = false, consented = false, readAllowed = false;
    let recognition = null, active = false, recognitionTimer = null, utterance = null, speechTimer = null;
    let generation = 0, commandGeneration = 0;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = recognitionPermitted && typeof Recognition === 'function';
    const synthesisSupported = synthesisPermitted && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
    function node(tag, text, id) {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      if (id) n.id = PREFIX + id;
      return n;
    }
    function on(el, name, cb) { el.addEventListener(name, cb); listeners.push([el, name, cb]); }
    function trusted(event) { return !!event && event.isTrusted === true; }
    const root = node('details', undefined, 'panel');
    root.dir = 'rtl'; root.lang = 'ar-SA'; root.className = 'f99-voice';
    const summary = node('summary', 'مساعد صوتي اختياري — متوقف', 'summary');
    root.appendChild(summary);
    const body = node('div', undefined, 'body'); root.appendChild(body);
    const title = node('h3', 'إعداد تجربة على هذا الجهاز', 'title'); body.appendChild(title);
    body.appendChild(node('p', 'الصوت متوقف افتراضيًا. التفعيل لهذه الصفحة فقط وليس إعدادًا مركزيًا محفوظًا. الكتابة تعمل بدون ميكروفون.'));
    const enableLabel = node('label'); const enable = node('input', undefined, 'enable');
    enable.type = 'checkbox'; enable.checked = false; enableLabel.appendChild(enable);
    enableLabel.appendChild(node('span', 'تفعيل تجربة الصوت في هذه الصفحة')); body.appendChild(enableLabel);
    const privacy = node('p', 'التعرف الصوتي من المتصفح قد يرسل الصوت إلى مزود خدمة المتصفح. هذه الوحدة لا تسجل الصوت ولا تحتفظ به محليًا، ولا تستخدم مفاتيح API. الأوامر والنتائج هنا مؤقتة ولا نخزنها. احتفاظ مزود المتصفح بالصوت يخضع لسياسته؛ استخدم الكتابة إذا لم توافق.', 'privacy');
    body.appendChild(privacy);
    const consentLabel = node('label'); const consent = node('input', undefined, 'consent');
    consent.type = 'checkbox'; consent.checked = false; consent.setAttribute('aria-describedby', privacy.id);
    consentLabel.appendChild(consent); consentLabel.appendChild(node('span', 'اطلعت وأوافق على استخدام تعرف المتصفح قبل تشغيل الميكروفون')); body.appendChild(consentLabel);
    const support = node('p', supported ? 'التعرف الصوتي متاح في هذا المتصفح. ابدأ بنفسك؛ قد يطلب المتصفح إذن الميكروفون.' : 'التعرف الصوتي غير مدعوم هنا؛ استخدم الكتابة. لا يلزم تشغيل الميكروفون.', 'support'); body.appendChild(support);
    const controls = node('div'); controls.className = 'f99-voice-actions'; body.appendChild(controls);
    const start = node('button', 'ابدأ الاستماع', 'start'); const stop = node('button', 'إيقاف الاستماع', 'stop');
    start.type = stop.type = 'button'; start.disabled = true; stop.disabled = true;
    controls.appendChild(start); controls.appendChild(stop);
    const status = node('p', 'الميكروفون متوقف.', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); body.appendChild(status);
    const help = node('p', HELP, 'help'); body.appendChild(help);
    const form = node('form', undefined, 'form'); body.appendChild(form);
    const inputLabel = node('label', 'اكتب أمرًا قصيرًا', 'input-label'); inputLabel.htmlFor = PREFIX + 'input'; form.appendChild(inputLabel);
    const input = node('input', undefined, 'input'); input.type = 'text'; input.maxLength = MAX_INPUT; input.autocomplete = 'off'; input.setAttribute('aria-describedby', help.id); form.appendChild(input);
    const send = node('button', 'عرض الرد النصي', 'send'); send.type = 'submit'; form.appendChild(send);
    const heard = node('p', '', 'heard'); body.appendChild(heard);
    const output = node('p', '', 'output'); output.setAttribute('role', 'status'); output.setAttribute('aria-live', 'polite'); body.appendChild(output);
    const draft = node('pre', '', 'draft'); draft.hidden = true; draft.setAttribute('aria-label', 'مسودة فقط — لم تنفذ'); body.appendChild(draft);
    const readLabel = node('label'); const readOpt = node('input', undefined, 'read-opt');
    readOpt.type = 'checkbox'; readOpt.checked = false; readOpt.disabled = !synthesisSupported;
    readLabel.appendChild(readOpt); readLabel.appendChild(node('span', 'السماح بقراءة الرد صوتيًا عند الضغط على «اقرأ الرد». قد يستخدم الصوت مزود المتصفح؛ لا يُقرأ تلقائيًا.')); body.appendChild(readLabel);
    const readControls = node('div'); readControls.className = 'f99-voice-actions'; body.appendChild(readControls);
    const read = node('button', 'اقرأ الرد', 'read'); const mute = node('button', 'إيقاف القراءة', 'mute');
    read.type = mute.type = 'button'; read.disabled = mute.disabled = true; readControls.appendChild(read); readControls.appendChild(mute);
    if (!synthesisSupported) body.appendChild(node('p', 'القراءة الصوتية غير مدعومة؛ الرد النصي متاح.'));
    function visible() {
      if (destroyed || document.hidden || !root.open || root.hidden || root.getClientRects().length === 0) return false;
      const style = window.getComputedStyle?.(root);
      return !style || (style.display !== 'none' && style.visibility !== 'hidden');
    }
    function sync() {
      start.disabled = !supported || !enabled || !consented || active;
      stop.disabled = !active;
      read.disabled = !synthesisSupported || !enabled || !readAllowed || !output.textContent || active;
      mute.disabled = !utterance;
      summary.textContent = enabled ? 'مساعد صوتي اختياري — مفعّل لهذه الصفحة' : 'مساعد صوتي اختياري — متوقف';
      root.dataset.listening = active ? 'true' : 'false';
    }
    function cancelSpeech() {
      if (speechTimer) window.clearTimeout(speechTimer); speechTimer = null;
      if (utterance) { utterance.onend = utterance.onerror = null; utterance = null; try { window.speechSynthesis.cancel(); } catch (_) {} }
      sync();
    }
    function halt(message, abort) {
      generation += 1;
      if (recognitionTimer) window.clearTimeout(recognitionTimer); recognitionTimer = null;
      const old = recognition; recognition = null; active = false;
      if (old) { old.onstart = old.onresult = old.onerror = old.onend = null; try { if (abort && typeof old.abort === 'function') old.abort(); else old.stop(); } catch (_) {} }
      if (message) status.textContent = message;
      sync();
    }
    function clearPrivateText() {
      commandGeneration += 1; input.value = ''; heard.textContent = ''; output.textContent = ''; draft.textContent = ''; draft.hidden = true;
    }
    function suspend() { halt('توقف الصوت عند إخفاء اللوحة أو الصفحة.', true); cancelSpeech(); clearPrivateText(); sync(); }
    function answer(text) {
      if (destroyed || !visible()) return;
      const commandId = ++commandGeneration;
      cancelSpeech(); output.textContent = ''; draft.textContent = ''; draft.hidden = true;
      if (typeof text !== 'string' || text.length > MAX_INPUT) {
        heard.textContent = ''; output.textContent = 'الأمر طويل. اكتب أمرًا واحدًا لا يزيد عن 160 حرفًا.'; sync(); return;
      }
      heard.textContent = text ? 'الأمر: ' + text : '';
      const command = parse(text);
      if (command.kind === 'explain') output.textContent = explanation(command.field);
      else if (command.kind === 'unknown') output.textContent = 'الأمر غير مدعوم. استخدم أحد الأوامر الموضحة؛ لم ننفذ أي إجراء.';
      else if (!verifiedOwner()) output.textContent = 'يلزم دخول المالك بجلسة مركزية متحققة. إعداد الصوت لا يمنح صلاحية؛ لم ننفذ أي إجراء ولم ننشئ مسودة.';
      else if (command.kind === 'draft') {
        draft.hidden = false;
        draft.textContent = command.text + '\nلم تُنفذ ولم تُحفظ ولم تُنشأ رموز فعلية. راجع الطلب، ثم استخدم واجهة الإدارة الأصلية يدويًا عند رغبتك؛ هذه اللوحة لا تحتوي زر تنفيذ.';
        output.textContent = 'جهزنا مسودة نصية مؤقتة فقط للمراجعة. لا تغيير في الأسعار أو الأكواد أو الأرصدة أو الاستخدامات.';
      } else if (command.kind === 'nav') {
        halt('الميكروفون متوقف أثناء التنقل.', true);
        try {
          const promise = navigation(command.target);
          output.textContent = 'فتحنا القسم الموجود فقط. الحفظ والتوليد والتعديلات تبقى أفعالًا يدوية في الواجهة الأصلية.';
          if (promise && typeof promise.then === 'function') promise.catch(() => {
            if (!destroyed && commandGeneration === commandId && visible()) { output.textContent = 'تعذر فتح القسم الموجود. تحقق من جلسة المالك؛ لم ننفذ تعديلًا.'; sync(); }
          });
        } catch (_) { output.textContent = 'القسم الموجود غير متاح الآن. لم ننفذ تعديلًا.'; }
      }
      sync();
    }
    on(enable, 'change', event => {
      enabled = trusted(event) && enable.checked; enable.checked = enabled;
      if (!enabled) { halt('الصوت متوقف.', true); cancelSpeech(); consented = readAllowed = false; consent.checked = readOpt.checked = false; }
      sync();
    });
    on(consent, 'change', event => {
      consented = trusted(event) && consent.checked; consent.checked = consented;
      if (!consented) halt('الميكروفون متوقف؛ يلزم موافقة صريحة.', true); sync();
    });
    on(start, 'click', event => {
      if (!trusted(event) || !supported || !enabled || !consented || active || !visible()) return;
      cancelSpeech();
      const id = ++generation;
      try {
        recognition = new Recognition(); active = true; sync(); status.textContent = 'جاري بدء الاستماع؛ اضغط إيقاف في أي وقت.';
        recognition.lang = 'ar-SA'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
        recognition.onstart = () => { if (generation === id && active) status.textContent = 'الميكروفون يستمع الآن — اضغط إيقاف لإغلاقه.'; };
        recognition.onresult = eventResult => {
          if (generation !== id || !active || !visible()) return;
          let text = '';
          for (let i = eventResult.resultIndex || 0; i < (eventResult.results?.length || 0); i++) {
            const result = eventResult.results[i];
            if (result.isFinal === true && typeof result[0]?.transcript === 'string') {
              const part = result[0].transcript;
              if (text.length + part.length + 1 > MAX_INPUT) { halt('الأمر الصوتي طويل؛ استخدم كتابة أمر قصير.', true); heard.textContent = ''; output.textContent = 'لم ننفذ الأمر لأنه تجاوز 160 حرفًا.'; sync(); return; }
              text += (text ? ' ' : '') + part;
            }
          }
          if (!text) return;
          halt('اكتمل الاستماع. الميكروفون متوقف.', false); answer(text);
        };
        recognition.onerror = error => {
          if (generation !== id) return;
          const messages = {
            'not-allowed': 'لم يُسمح بالميكروفون. استخدم الكتابة أو أعد الإذن يدويًا.',
            'service-not-allowed': 'خدمة التعرف غير مسموحة. استخدم الكتابة.',
            'audio-capture': 'الميكروفون غير متاح. استخدم الكتابة.',
            'no-speech': 'ما التقطنا كلامًا. الميكروفون متوقف؛ جرّب الكتابة.',
            'network': 'تعذر اتصال خدمة التعرف. الميكروفون متوقف؛ استخدم الكتابة.',
            'aborted': 'توقف الاستماع.', 'language-not-supported': 'العربية غير متاحة في خدمة التعرف هذه. استخدم الكتابة.'
          };
          halt(messages[error?.error] || 'تعذر التعرف الصوتي. الميكروفون متوقف؛ استخدم الكتابة.', true);
        };
        recognition.onend = () => { if (generation === id) halt('انتهى الاستماع. الميكروفون متوقف؛ لن يعاد تشغيله تلقائيًا.', false); };
        recognitionTimer = window.setTimeout(() => { if (generation === id) halt('انتهت مهلة الاستماع. استخدم الكتابة أو ابدأ بنفسك من جديد.', true); }, 30000);
        recognition.start();
      } catch (_) { halt('تعذر تشغيل الميكروفون. استخدم الكتابة.', true); }
    });
    on(stop, 'click', () => halt('أوقفت الاستماع. الميكروفون متوقف.', false));
    on(form, 'submit', event => {
      event.preventDefault(); if (!trusted(event)) return;
      halt('الميكروفون متوقف أثناء استخدام الكتابة.', true);
      const text = input.value; input.value = ''; answer(text);
    });
    on(readOpt, 'change', event => { readAllowed = trusted(event) && readOpt.checked && synthesisSupported; readOpt.checked = readAllowed; if (!readAllowed) cancelSpeech(); sync(); });
    on(read, 'click', event => {
      if (!trusted(event) || !enabled || !readAllowed || !synthesisSupported || active || !visible() || !output.textContent) return;
      cancelSpeech();
      try {
        const speech = new window.SpeechSynthesisUtterance(output.textContent.slice(0, 1000));
        const voices = window.speechSynthesis.getVoices() || [];
        // Prefer an installed on-device Saudi voice, then Saudi, then local Arabic.
        // No unrelated-language voice is assigned; ar-SA remains the safe default.
        const locale = v => String(v.lang || '').toLowerCase().replace('_', '-');
        const voice = voices.find(v => locale(v) === 'ar-sa' && v.localService === true)
          || voices.find(v => locale(v) === 'ar-sa')
          || voices.find(v => locale(v).startsWith('ar-') && v.localService === true)
          || voices.find(v => locale(v).startsWith('ar-'));
        speech.lang = voice?.lang || 'ar-SA'; if (voice) speech.voice = voice;
        speech.rate = 1; utterance = speech; status.textContent = 'جاري قراءة الرد. النص هو البديل الدائم.';
        speech.onend = () => { if (utterance === speech) { cancelSpeech(); status.textContent = 'انتهت القراءة الصوتية.'; } };
        speech.onerror = () => { if (utterance === speech) { cancelSpeech(); status.textContent = 'تعذرت القراءة الصوتية. الرد النصي متاح.'; } };
        speechTimer = window.setTimeout(() => { if (utterance === speech) { cancelSpeech(); status.textContent = 'توقفت القراءة عند انتهاء المهلة. الرد النصي متاح.'; } }, 30000);
        sync(); window.speechSynthesis.speak(speech);
      } catch (_) { cancelSpeech(); status.textContent = 'القراءة الصوتية غير متاحة الآن. الرد النصي متاح.'; }
    });
    on(mute, 'click', cancelSpeech);
    on(root, 'toggle', () => { if (!root.open) suspend(); });
    on(document, 'visibilitychange', () => { if (document.hidden) suspend(); });
    on(window, 'pagehide', () => {
      suspend(); enabled = consented = readAllowed = false; enable.checked = consent.checked = readOpt.checked = false; sync();
    });
    let observer = null;
    if (typeof window.MutationObserver === 'function') {
      observer = new window.MutationObserver(() => {
        if (!visible() && (active || utterance || input.value || heard.textContent || output.textContent || draft.textContent)) suspend();
      });
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ['hidden', 'style', 'class', 'open'] });
    }
    host.appendChild(root); sync();
    mounted = Object.freeze({
      destroy() {
        if (destroyed) return;
        suspend(); destroyed = true;
        for (const [el, name, cb] of listeners) el.removeEventListener(name, cb);
        observer?.disconnect(); root.remove(); mounted = null;
      }
    });
    return mounted;
  }
  window.FINO99VoiceOptional = Object.freeze({ version: '1.0.0-optional-source-reviewed', mount, parse });
})(window, document);
