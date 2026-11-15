/* FINO99 customer chat polish — ONLY the active «اختصر مشاويرك» original buyout bot.
 * No calculator, result, export, RPC, metering, contract or consent overrides.
 * Fail closed on unknown package/message/markup. All original actions stay synchronous.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.F99CustomerChat) return;
    root.F99CustomerChat = api;
    api.install(root);
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const VERSION = '1.0.0';
  const TARGET_NAME = 'اختصر مشاويرك';
  const PREFIX = 'f99cc-';
  const EXCLUDE = [
    '.portal-result', '.portal-rank-list', '.portal-detail-lines', '.portal-cash-hero',
    '.f38-full', '.f38-image-wrap', '.f47-inline-image', '.f34-report',
    '.f49-request-shell', '.f49-completion-request', '.f49-message-preview',
    '.f82-fee-hero', '.f82-last-card', '.portal-expert-box', '.portal-note', '.portal-alert',
    '.portal-trial-conditions', '.portal-trial-consent',
    '#page3', '#results', '#portalImageOverlay', '#imagePreviewModal', '#phoneModal',
    '[class*="result"]', '[class*="card"]', '[class*="export"]', '[class*="capture"]',
    '[class*="consent"]', '[class*="legal"]', '[class*="contract"]', '[class*="pdf"]',
    '[id*="result"]', '[id*="Result"]', '[id*="export"]', '[id*="Export"]',
    '[id*="consent"]', '[id*="Consent"]', '[id*="legal"]', '[id*="contract"]',
    '[data-export]', '[data-capture]', '[data-consent]', '[data-legal]',
    'canvas', 'iframe', 'object', 'embed', 'pre', 'details', 'input', 'textarea', 'select'
  ].join(',');
  // Supplemental text guard. Even known markup cannot opt legal/fee terms into a rewrite.
  const SENSITIVE = /أوافق|موافقة|أقر|إقرار|الشروط|شروط|عقد|العقد|سياسة|قانون|ضريبة|خصم|٪|%|أتعاب|رسوم|صلاحية العرض/;
  const ENTRY_STEPS = new Set(['buyout_type', 'buyout_bank', 'buyout_salary', 'buyout_settlement', 'buyout_external']);
  const KNOWN_COPY = Object.freeze({
    'اذكر جهة عملك.': 'اختر جهة عملك.',
    'اذكر صافي الراتب الشهري.': 'كم صافي راتبك الشهري؟',
    'كم مبلغ السداد المبكر للمديونية الحالية؟': 'كم مبلغ السداد المبكر لمديونيتك الحالية؟',
    'كم الالتزامات الشهرية الأخرى غير التمويل الشخصي؟ إذا ما فيه اكتب 0.': 'كم التزاماتك الشهرية الأخرى، غير التمويل الشخصي؟ إذا ما فيه، اكتب 0.',
    'اكتب مبلغ السداد المبكر رقم فقط.': 'اكتب مبلغ السداد المبكر بالأرقام فقط.',
    'اكتب الالتزامات رقم فقط، وإذا ما فيه اكتب 0.': 'اكتب الالتزامات بالأرقام فقط، وإذا ما فيه اكتب 0.',
    'اكتب الراتب رقم فقط، مثال: 7800': 'اكتب الراتب بالأرقام فقط، مثال: 7800'
  });
  const PREFIXED_QUESTION = /^(?:يا [^<>\n]{1,80}، |(?:صباح الخير|مساء الخير)(?: يا [^<>\n]{1,80})?، )/;
  const normalizeName = s => String(s || '').replace(/\s+/g, ' ').trim();
  const digitTokens = s => String(s).match(/[0-9٠-٩۰-۹]+(?:[.,٫٬][0-9٠-٩۰-۹]+)*/g) || [];
  function rewriteKnown(text) {
    const raw = String(text), body = raw.trim();
    const prefix = body.match(PREFIXED_QUESTION)?.[0] || '';
    const question = body.slice(prefix.length);
    const replacement = KNOWN_COPY[question];
    if (!replacement || SENSITIVE.test(body)) return raw;
    const changed = raw.replace(body, prefix + replacement);
    return JSON.stringify(digitTokens(raw)) === JSON.stringify(digitTokens(changed)) ? changed : raw;
  }
  function knownQuestion(text) {
    const s = normalizeName(text), prefix = s.match(PREFIXED_QUESTION)?.[0] || '';
    const q = s.slice(prefix.length);
    return Object.hasOwn(KNOWN_COPY, q) || Object.values(KNOWN_COPY).includes(q) ||
      /^اختر(?: يا [^<>\n]{1,80})? البنك اللي ينزل عليه راتبك\.$/.test(s) ||
      /^أبشر(?: يا [^<>\n]{1,80})?\. اختر جهة عملك\.$/.test(s) ||
      q === 'اختر جهة عملك.';
  }
  function isTargetContext(c) {
    if (!c || c.active !== true || c.main?.owner !== false || c.main?.central !== true) return false;
    if (!c.main.packageKey || (c.portal?.mode !== 'buyout' && c.portal?.strictServiceScope !== 'buyout')) return false;
    if (!Array.isArray(c.main.allowedServices) || !c.main.allowedServices.some(x => x === 'buyout' || x === 'bot_buyout')) return false;
    const p = (c.products || []).find(x => x?.key === c.main.packageKey);
    return !!p && normalizeName(p.name) === TARGET_NAME;
  }
  // Content-proportional visual feedback, never a wait before dispatch/render.
  function presentationDuration(text, reducedMotion) {
    if (reducedMotion) return 0;
    const s = normalizeName(text);
    if (!s) return 0;
    return Math.round(Math.max(120, Math.min(620, Array.from(s).length * 7 + (s.match(/[؟،.]/g) || []).length * 18)));
  }
  function blocked(node) {
    return !node || node.nodeType !== 1 || !!node.closest(EXCLUDE) || !!node.querySelector(EXCLUDE);
  }
  function textWithoutTime(bubble) {
    return [...bubble.childNodes].filter(n => !(n.nodeType === 1 && n.matches('time.portal-msg-time')))
      .map(n => n.textContent || '').join('');
  }
  const actionValue = button => (button.getAttribute('onclick') || '').match(/^\s*(chooseFINOPortalType|chooseFINOPortalBank)\('([A-Za-z]+)'\)\s*;?\s*$/);
  function questionShape(row, step) {
    if ((!ENTRY_STEPS.has(step) && step != null) || blocked(row) || !row.matches('.portal-row.assistant')) return null;
    const bubble = row.children[0];
    if (row.children.length !== 1 || !bubble?.matches('.portal-bubble')) return null;
    const options = [...bubble.children].filter(n => n.matches('.portal-options, .portal-bank-grid'));
    const permitted = new Set(['BR', 'TIME', 'DIV', 'BUTTON', 'B', 'IMG']);
    if ([...bubble.querySelectorAll('*')].some(n => !permitted.has(n.tagName))) return null;
    for (const n of bubble.children) {
      if (n.matches('br, time.portal-msg-time')) continue;
      if (!options.includes(n)) return null;
    }
    for (const box of options) {
      if ([...box.children].some(n => !n.matches('button.portal-option, button.portal-bank'))) return null;
      if ([...box.querySelectorAll('button')].some(b => !actionValue(b))) return null;
    }
    const text = [...bubble.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (SENSITIVE.test(text) || (text && !knownQuestion(text))) return null;
    if (!text && !options.length) return null;
    return {bubble, options};
  }
  function install(w) {
    if (!w?.document || w.__F99CustomerChatInstalled) return false;
    const d = w.document;
    let chat = null, observer = null, pageObserver = null, disabled = false;
    const original = {}, wrappers = {}, touched = new Set(), animations = new Set();
    const textEdits = new Map(), attributeEdits = new Map();
    const reduced = () => !!w.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const portal = () => { try { return typeof finoPortal !== 'undefined' ? finoPortal : null; } catch (_) { return null; } };
    function context() {
      try { return {active: d.getElementById('specialistBotPage')?.classList.contains('active') === true,
        main: w.F99V32MainAccess?.(), products: w.FINO99ReadStorefront?.()?.products || [], portal: portal()}; }
      catch (_) { return null; }
    }
    const active = () => !disabled && isTargetContext(context());
    function setText(node, value) {
      if (value === node.textContent) return;
      if (!textEdits.has(node)) textEdits.set(node, {original: node.textContent, current: value});
      else textEdits.get(node).current = value;
      node.textContent = value;
    }
    function setAttribute(node, name, value) {
      if (!attributeEdits.has(node)) attributeEdits.set(node, new Map());
      const values = attributeEdits.get(node);
      if (!values.has(name)) values.set(name, {original: node.getAttribute(name), current: value});
      else values.get(name).current = value;
      node.setAttribute(name, value);
    }
    function mark(node, cls) { node.classList.add(PREFIX + cls); touched.add(node); }
    function rewriteTextNodes(bubble) {
      // Only original direct text nodes; never buttons, time, nested cards or arbitrary substrings.
      for (const n of bubble.childNodes) if (n.nodeType === 3) {
        const next = rewriteKnown(n.textContent);
        setText(n, next);
      }
    }
    function selectKnownOptions() {
      const data = portal()?.data || {};
      for (const b of chat?.querySelectorAll('.f99cc-option') || []) {
        if (blocked(b)) continue;
        const match = actionValue(b); if (!match) continue;
        const selected = (match[1] === 'chooseFINOPortalType' ? data.customerType : data.bankId) === match[2];
        b.classList.toggle('f99cc-selected', selected);
        setAttribute(b, 'aria-pressed', String(selected));
      }
    }
    function animateFeedback(row, text) {
      const duration = presentationDuration(text, reduced());
      if (!duration || !row.animate || d.hidden) return;
      // Decorative ellipsis means the original step has arrived, not a human/AI replying.
      // Text/options are already present and usable; it NEVER hides or delays them.
      const dots = d.createElement('span'); dots.className = 'f99cc-arrival';
      dots.textContent = '···'; dots.setAttribute('aria-hidden', 'true'); row.append(dots); touched.add(dots);
      try {
        const a = dots.animate([{opacity: 0.2}, {opacity: 0.8}, {opacity: 0}], {duration, easing: 'ease-out'});
        animations.add(a); a.finished.then(() => {dots.remove(); touched.delete(dots); animations.delete(a);},
          () => {dots.remove(); touched.delete(dots); animations.delete(a);});
      } catch (_) { dots.remove(); touched.delete(dots); }
    }
    function decorateRow(row, step, animate) {
      if (!active() || row.parentElement !== chat || row.classList.contains('f99cc-row') || blocked(row)) return;
      const shape = questionShape(row, step);
      if (shape) {
        mark(row, 'row'); mark(shape.bubble, 'bubble');
        rewriteTextNodes(shape.bubble);
        for (const box of shape.options) {
          mark(box, box.matches('.portal-bank-grid') ? 'banks' : 'options');
          for (const b of box.children) {
            mark(b, 'option');
            for (const label of b.querySelectorAll('b')) mark(label, 'bank-label');
          }
        }
        if (animate) animateFeedback(row, textWithoutTime(shape.bubble));
        return;
      }
      // User numeric/sector/bank replies are not rewritten, nor are result-bank clicks.
      if (!ENTRY_STEPS.has(step) || !row.matches('.portal-row.user')) return;
      const bubble = row.children[0];
      if (row.children.length !== 1 || !bubble?.matches('.portal-bubble')) return;
      if ([...bubble.children].some(n => !n.matches('time.portal-msg-time'))) return;
      const text = textWithoutTime(bubble).trim();
      const banks = w.BANKS || (typeof BANKS !== 'undefined' ? BANKS : []);
      if (!/^[0-9٠-٩۰-۹.,٫٬+\-\s]+$/.test(text) && !['حكومي', 'شبه حكومي', 'عسكري', 'قطاع خاص', 'متقاعد', ...banks.map(b => b.name)].includes(text)) return;
      mark(row, 'row'); mark(bubble, 'bubble');
    }
    function postActions(node) {
      // Direct known post-result chat message ONLY. Last-use consent and all fee/result cards fail closed.
      if (!active() || node.parentElement !== chat || blocked(node) || !node.matches('div.f49-message.f82-end-actions')) return;
      if (node.classList.contains('f99cc-post')) return;
      if ([...node.children].some(n => !n.matches('strong, p, div'))) return;
      const row = [...node.children].find(n => n.tagName === 'DIV');
      if (row && [...row.children].some(n => n.tagName !== 'BUTTON' || n.children.length)) return;
      const heading = [...node.children].find(n => n.tagName === 'STRONG')?.textContent || '';
      if (!/^يا [^<>\n]{1,80}، (?:استهلكت كامل مرات الحسبة في هذه الباقة\.|انتهينا من مراجعة تفاصيل هذه الحسبة\.)$/.test(heading)) return;
      mark(node, 'post'); // Non-inherited box styling only. Terms/numbers stay untouched.
      for (const child of node.children) {
        if (child.tagName === 'STRONG' && /^يا [^<>\n]{1,80}، استهلكت كامل مرات الحسبة في هذه الباقة\.$/.test(child.textContent)) {
          setText(child, child.textContent.replace('استهلكت كامل مرات الحسبة في هذه الباقة.', 'اكتملت مرات الحسبة المتاحة في باقتك.'));
          mark(child, 'post-text');
        }
        if (child.tagName === 'P' && child.textContent === 'تقدر تطالع جميع رسائل الحسب السابقة هنا قبل الخروج، أو تجدد بكود جديد إذا توفر عرض.') {
          setText(child, 'تقدر تراجع حسباتك السابقة هنا، أو تطّلع على التجديد إذا توفر عرض مناسب لباقتك.');
          mark(child, 'post-text');
        }
        if (child.tagName === 'P' && child.textContent === 'ترشيحاتك ونتائجك ما زالت متاحة هنا. اختر الخطوة اللي تناسبك:') mark(child, 'post-text');
      }
      if (row) for (const b of row.children) {
        if (/^يا [^<>\n]{1,80}، عندك عرض للمتابعة$/.test(b.textContent)) setText(b, 'اطّلع على متابعة التمويل الشخصي — اختياري');
        else if (b.textContent === 'تجديد باقتي') setText(b, 'عرض التجديد المتاح');
        else if (!['أراجع الحسب السابقة', 'أكمل مراجعة الحسبة الحالية', 'أبدأ حسبة جديدة', 'أراجع النتائج'].includes(b.textContent)) continue;
        mark(b, 'post-button');
      }
    }
    function syncComposer(show) {
      const p = portal();
      const allowed = active() && (ENTRY_STEPS.has(p?.step) || ['f37_installment', 'f37_principal', 'f37_cash'].includes(p?.step));
      for (const [id, cls] of [['portalComposer', 'composer'], ['finoBotInput', 'input'], ['finoBotSendBtn', 'send'], ['portalInputHelper', 'helper']]) {
        const node = d.getElementById(id); if (!node) continue;
        if (allowed) mark(node, cls); else node.classList.remove(PREFIX + cls);
      }
      // Do not change the original placeholder, type, helper, requiredness, handler or visibility.
      const input = d.getElementById('finoBotInput');
      if (allowed && show && input && (!input.hasAttribute('aria-label') || attributeEdits.get(input)?.has('aria-label'))) setAttribute(input, 'aria-label', input.placeholder || 'اكتب إجابتك');
    }
    function refresh() {
      if (!active()) { clearPresentation(); return false; }
      const step = portal()?.step;
      for (const node of chat?.children || []) { decorateRow(node, step, false); postActions(node); }
      selectKnownOptions(); syncComposer(false); return true;
    }
    function clearPresentation() {
      for (const a of animations) a.cancel(); animations.clear();
      for (const [node, value] of textEdits) if (node.textContent === value.current) node.textContent = value.original;
      textEdits.clear();
      for (const [node, values] of attributeEdits) for (const [name, value] of values) if (node.getAttribute(name) === value.current) {
        if (value.original === null) node.removeAttribute(name); else node.setAttribute(name, value.original);
      }
      attributeEdits.clear();
      for (const node of touched) {
        if (node.classList?.contains('f99cc-arrival')) {node.remove(); continue;}
        for (const cls of [...node.classList || []]) if (cls.startsWith(PREFIX)) node.classList.remove(cls);
      }
      touched.clear();
    }
    function bind() {
      const next = d.getElementById('finoBotChat');
      if (!next || next === chat) return;
      observer?.disconnect(); chat = next;
      // No subtree/characterData observer: result, export, consent and PDF contents are never traversed by observation.
      observer = new w.MutationObserver(records => {
        if (!active()) {clearPresentation(); return;}
        for (const record of records) if (record.target === chat) for (const node of record.addedNodes) {
          if (node.nodeType !== 1 || blocked(node)) continue;
          decorateRow(node, portal()?.step, false); postActions(node);
        }
      });
      observer.observe(chat, {childList: true});
      const page = d.getElementById('specialistBotPage');
      pageObserver?.disconnect();
      if (page) {pageObserver = new w.MutationObserver(refresh); pageObserver.observe(page, {attributes: true, attributeFilter: ['class']});}
      refresh();
    }
    function hook(name, runAfter) {
      const fn = w[name]; if (typeof fn !== 'function') return false;
      original[name] = fn;
      wrappers[name] = function () {
        // Snapshot original step before the renderer changes it. Preserve this, args, exact return/throw and sync event sequence.
        const step = portal()?.step;
        const value = fn.apply(this, arguments);
        try { if (!disabled) {bind(); runAfter(arguments, step);} } catch (_) { /* polish never interrupts the original bot */ }
        return value;
      };
      w[name] = wrappers[name]; return true;
    }
    // Only presentation helpers. No input, option, calculation, new-use, result, fee or renewal handler is replaced.
    hook('portalAdd', (args, step) => {
      if (!active()) {clearPresentation(); return;}
      const last = chat?.lastElementChild;
      if (last?.matches('.portal-row')) decorateRow(last, step, args[0] === 'assistant');
      selectKnownOptions();
    });
    hook('setPortalInput', args => {syncComposer(args[0] === true);});
    function start() {bind();}
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, {once: true}); else start();
    w.__F99CustomerChatInstalled = true;
    api.refresh = refresh;
    api.uninstall = () => {
      disabled = true; observer?.disconnect(); pageObserver?.disconnect(); clearPresentation();
      d.removeEventListener('DOMContentLoaded', start);
      for (const name of Object.keys(original)) if (w[name] === wrappers[name]) w[name] = original[name];
      w.__F99CustomerChatInstalled = false;
      // Original handlers and still-owned cosmetic text/attributes are restored. No financial state is changed.
    };
    return true;
  }
  const api = {version: VERSION, install, isTargetContext, rewriteKnown, knownQuestion, presentationDuration, questionShape, blocked,
    excludedSelectors: EXCLUDE, supportedEntrySteps: Object.freeze([...ENTRY_STEPS])};
  return api;
});
