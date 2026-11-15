/* FINO99 owner desktop 13 — additive, owner-only, no global theme/financial/session writes.
 * Native controls remain the SAME DOM nodes in a legacy drawer; never clone their closures.
 * Visual settings are device-local only. Central approval/CAS requires a separate reviewed contract.
 */
(function (w) {
  'use strict';
  if (w.F99OwnerDesktop) return;
  const d = w.document;
  const STORE = 'f99owner13_design_this_device_v1';
  const ALLOWED = Object.freeze({
    preset: ['navy', 'gold', 'light'], accent: ['blue', 'teal', 'gold'],
    font: ['Tajawal', 'Cairo'], icons: ['outline', 'solid'],
    cards: ['soft', 'sharp'], buttons: ['rounded', 'square'], messages: ['soft', 'outlined']
  });
  const DEFAULT = Object.freeze({preset: 'navy', accent: 'blue', font: 'Tajawal', icons: 'outline', cards: 'soft', buttons: 'rounded', messages: 'soft'});
  const CATS = [
    ['executive', 'مكتب المدير التنفيذي', 'ملخص المنصة والأولويات من البوابة القائمة', '◎'],
    ['banks', 'البنوك والنسب', 'المصدر الأساسي ومراجعة النسب قبل الاعتماد', '▤'],
    ['calculators', 'الحاسبات', 'الشخصي وتحويل المديونية والعقاري', '∑'],
    ['packages', 'الباقات والأكواد', 'المتجر والمخزون والتجديد من مصادرها الأصلية', '⌘'],
    ['human', 'الخدمات البشرية', 'الخدمات والمواعيد والحجوزات', '◷'],
    ['fees', 'عروض الأتعاب', 'الكود أولًا، ثم الباقة والرابط الخارجي', '٪'],
    ['docs', 'العقود والمستندات', 'كل نظام محفوظ بقوالبه وأكوادِه وأرشيفه', '§'],
    ['extra', 'الخدمات الإضافية', 'السياسات والمظهر والصوت والأدوات السابقة', '▦']
  ];
  let root, hub, originalShell, drawer, anchor, category = '', query = '', items = [], status;
  let panel, tools, categoryTitle, packageControls, packageSelect, feeHost, feeMount;
  let design = {...DEFAULT}, approved = {...DEFAULT}, previous = null, history = [], previewing = false;
  let oldFocus, scheduled = false, observer, originalObserver, booted = false;
  let mountedToken = '';
  const displaced = new Map();
  const api = {version: '13.1.0', mounted: false, refresh, destroy, openCategory};
  w.F99OwnerDesktop = api;

  function isOwner() {
    // Read the original lexical session, never introduce a window owner surrogate.
    try {
      return activeAccess?.record?.central === true && activeAccess.record.owner === true &&
        typeof finoCentralAdminToken === 'string' && !!finoCentralAdminToken &&
        typeof w.F99V60Test?.owner === 'function' && w.F99V60Test.owner() === true;
    } catch (_) { return false; }
  }
  function token() { try { return isOwner() ? finoCentralAdminToken : ''; } catch (_) { return ''; } }
  function resolve(path) {
    const parts = path.split('.'); let host = w;
    for (let i = 0; i < parts.length - 1; i++) { host = host?.[parts[i]]; if (!host) return null; }
    const fn = host?.[parts.at(-1)]; return typeof fn === 'function' ? {host, fn} : null;
  }
  function normalize(value) {
    const out = {};
    for (const key of Object.keys(ALLOWED)) out[key] = ALLOWED[key].includes(value?.[key]) ? value[key] : DEFAULT[key];
    return out;
  }
  function loadLocal() {
    approved = {...DEFAULT}; previous = null; history = [];
    try {
      const saved = JSON.parse(w.localStorage.getItem(STORE) || 'null');
      if (saved?.scope === 'this_device' && saved.version === 1) {
        approved = normalize(saved.current); previous = saved.previous ? normalize(saved.previous) : null;
        history = Array.isArray(saved.history) ? saved.history.slice(-8).map(normalize) : [];
      }
    } catch (_) { /* local persistence may be blocked */ }
    design = {...approved}; previewing = false;
  }
  function applyDesign(value) {
    if (!root) return;
    design = normalize(value);
    for (const key of Object.keys(ALLOWED)) root.dataset[key] = design[key];
    root.style.setProperty('--f99od13-font', design.font === 'Cairo' ? 'Cairo, Tahoma, sans-serif' : 'Tajawal, Tahoma, sans-serif');
    root.querySelectorAll('[data-design-control]').forEach(n => { n.value = design[n.dataset.designControl]; });
    const label = root.querySelector('[data-design-state]');
    if (label) label.textContent = previewing ? 'معاينة غير معتمدة — هذا الجهاز' : 'المظهر المعتمد — هذا الجهاز فقط';
  }
  function message(text, error = false) {
    if (!status) return;
    status.textContent = text; status.dataset.error = error ? '1' : '0';
  }
  function node(tag, cls, text) {
    const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n;
  }
  function button(host, text, fn, cls = 'f99od13-button') {
    const b = node('button', cls, text); b.type = 'button';
    b.addEventListener('click', () => {
      if (!isOwner()) { destroy(); return; }
      try { Promise.resolve(fn()).catch(() => message('تعذر فتح الأداة أو التحقق منها؛ لم تُنفذ الوحدة تغييرًا.', true)); }
      catch (_) { message('الأداة غير متاحة الآن؛ راجع تحميل الوحدة الأصلية.', true); }
    }); host.append(b); return b;
  }
  async function callExport(path, args = []) {
    if (!isOwner()) return;
    const r = resolve(path); if (!r) { message('هذه الأداة قيد التوصيل؛ لم يتم تنفيذ أي إجراء.', true); return; }
    return r.fn.apply(r.host, args);
  }
  function spec(id, cat, label, sub, path, args = []) {
    return {id, cat, label, sub, path, args, available: () => !!resolve(path), run: () => callExport(path, args)};
  }
  function nativeCategory(text) {
    if (/تنفيذي|نبض|أولويات/.test(text)) return 'executive';
    if (/بنك|بنوك|نسب|نسبة|شعار/.test(text)) return 'banks';
    if (/حاسب|حسبة|مديونية|عقاري|تمويل/.test(text) && !/سياس/.test(text)) return 'calculators';
    if (/عقد|عقود|أرشيف|مستند|مطبو|فاتور|برنت/.test(text)) return 'docs';
    if (/أتعاب|إنجاز|متابعة/.test(text)) return 'fees';
    if (/موعد|مواعيد|بشرية|حجز|حجوزات/.test(text)) return 'human';
    if (/باقة|باقات|أكواد|كود|مخزون|تجديد|متجر|خزنة/.test(text)) return 'packages';
    return 'extra';
  }
  function originalButtons() {
    if (!drawer) return [];
    // Navigation hubs only, never arbitrary controls/forms or any client subtree.
    return [...drawer.querySelectorAll('.owner-grid > button, #f73-owner-shortcuts .f73-owner-quick > button, #f81-owner-panel .f81-owner-tiles > button, #f81-owner-panel .f81-utilities > button, .owner-hero > button, #f99s12-owner-policy')];
  }
  function collectDirectControls() {
    // S12 deliberately exposes a real DOM control, not an ownerPolicy export.
    // Move the node, keep its closure, and restore its exact position on teardown.
    const n = d.getElementById('f99s12-owner-policy');
    if (!n || !hub.contains(n) || drawer.contains(n)) return;
    const marker = d.createComment('F99 desktop original control position');
    n.before(marker); displaced.set(n, marker); drawer.append(n);
  }
  function collect() {
    collectDirectControls();
    const result = [
      spec('exec', 'executive', 'المدير التنفيذي الذكي', 'قراءة المنصة وتجهيز المهام؛ التغيير الحساس باعتمادك', 'F99ExecGateway.open'),
      spec('owner-access14', 'executive', 'تفويض المدير وكود المالك', 'تفويض الأدوات السبع المدعومة وتغيير الكود عبر المالك الأصلي', 'F99AccessWorkspace.openOwner'),
      spec('core', 'banks', 'البنوك والنسب والشعارات', 'محرر قلب المنصة الأصلي؛ لا نسب جديدة تلقائية', 'FINO99OpenCoreBanks'),
      {id: 'rates', cat: 'banks', label: 'مراجعة وتحديث النسب', sub: 'الأداة التنفيذية القائمة: مصدر وتاريخ ومعاينة واعتماد', available: () => !!resolve('F99RateManager.create') && !!resolve('F99ExecGateway.open') && !!resolve('F99ExecGateway.send'), run: async () => { await callExport('F99ExecGateway.open'); if (isOwner()) await callExport('F99ExecGateway.send', ['حدث نسب البنوك']); }},
      {id: 'personal', cat: 'calculators', label: 'التمويل الشخصي — المحادثة', sub: 'مسار المحادثة الشخصي الأصلي دون تعديل المعادلات', available: () => !!resolve('ownerOpenSmartPortal') && !!resolve('startFINOPortalSmart'), run: () => { callExport('ownerOpenSmartPortal'); if (isOwner()) return callExport('startFINOPortalSmart'); }},
      spec('buyout', 'calculators', 'تحويل المديونية', 'المسار الأصلي لشراء وتحويل المديونية', 'ownerOpenBuyout'),
      spec('buyout-form', 'calculators', 'تحويل المديونية — النموذج الأساسي', 'حاسبة الترشيح الأساسية كاملة دون المرور بالمحادثة', 'openBuyoutFromFree'),
      spec('smart', 'calculators', 'الحاسبة الشخصية الأساسية', 'النموذج الذكي الأصلي: شخصي واستهلاكي وشركات وحسبة عقارية حرة', 'ownerOpenSmartCalculator'),
      spec('mortgage', 'calculators', 'مركز التمويل العقاري', 'الوحدة العقارية الأصلية وأنماطها', 'F99MOpenControl'),
      spec('mortgage-advanced', 'calculators', 'منتجات العقاري المتقدمة', 'بناء ذاتي وعلى الخارطة ونقل وترشيح', 'F99MAdv.openOwner'),
      spec('store', 'packages', 'المتجر والباقات', 'محرر الباقات الأصلي ومصدر المنتجات الواحد', 'F99SOpenOwner'),
      spec('devices14', 'packages', 'إدارة أجهزة الباقات', 'السياسات والأجهزة عبر فحص كود العميل من المركزية', 'F99AccessWorkspace.openDevices'),
      spec('inventory', 'packages', 'المخزون والدفعات', 'أكواد الباقات من المخزون الحالي', 'F99V9OpenInventory'),
      spec('codes', 'packages', 'التحكم بالأكواد', 'الصلاحيات والحالات عبر المكتب الأصلي', 'f99fixOpenCodes'),
      spec('code-lookup', 'packages', 'فحص كود عميل', 'أداة V19 الأصلية للفحص والصلاحيات', 'F99V19OpenCode'),
      spec('renewal', 'packages', 'أكواد التجديد', 'بوابة V76 الحالية عبر منفذ التجديد المعتمد', 'FINO99V74OwnerRenewal'),
      spec('human', 'human', 'الخدمات البشرية والمواعيد', 'واجهة الخدمات الحالية؛ A9/S9 عند تحميلها', 'F99O2OpenAdmin'),
      spec('human-bookings', 'human', 'سجل الحجوزات', 'المواعيد عبر وحدة الخدمات الموصولة', 'F99ServiceTools.openOwnerBookings'),
      spec('human-pending', 'human', 'طلبات الخدمات المعلقة', 'الطلبات المعلقة من الوحدة الحالية', 'F99ServiceTools.openPending'),
      spec('guidance', 'human', 'أسئلة وإرشادات الباقات', 'الواجهة القائمة للإرشادات', 'F99G4GuidanceUI.openOwner'),
      {id: 'fees', cat: 'fees', label: 'عروض الأتعاب', sub: 'الوحدة الحالية: كود وباقة ورابط خارجي؛ دون تغيير سعر الباقة', available: feeAvailable, run: () => openFees(false)},
      spec('contracts-new', 'docs', 'نظام العقود الذكي', 'f99k — الأطراف والمراحل والأكواد المستقلة', 'F99KContracts.openOwner'),
      spec('contracts-v73', 'docs', 'العقود وسجل الإقرار (V73)', 'القوالب السابقة محفوظة؛ نظام مستقل عن f99k', 'FINO99V73OpenOwner', ['templates']),
      spec('contracts-legacy', 'docs', 'العقود والاتفاقات السابقة', 'النظام السابق وقوالبه محفوظة', 'F99V20OpenContracts', ['all']),
      spec('archive', 'docs', 'الأرشيف والعملاء', 'الأرشيف الأصلي دون نقل البيانات', 'ownerOpenAdminSection', ['archive']),
      {id: 'draft', cat: 'docs', label: 'مسودة فاتورة / مطالبة', sub: 'مسودة فقط؛ ليست فاتورة ضريبية معتمدة أو إثبات سداد', available: () => feeAvailable() && !!resolve('F99FeeOffers.prepareOwnerDraft'), run: () => openFees(true)},
      spec('coupons', 'packages', 'أكواد الخصم', 'مكتب الخصم الحالي دون تطبيق خصم إضافي', 'F99V72CouponDesk'),
      spec('policy', 'extra', 'سياسة عدد الحسبات', 'سياسة الاستخدام الأصلية', 'F99CalcPolicy.openOwner'),
      spec('early', 'extra', 'سياسة السداد المبكر للعقاري', 'واجهة السياسة الأصلية', 'F99MEarly.openOwner'),
      spec('health', 'extra', 'فحص المركزية والأكواد', 'التشخيص الأصلي؛ لا نسخ احتياطي جديد أو ادعاء تلقائي', 'F99V20OpenHealth'),
      spec('voice', 'extra', 'إعدادات الصوت', 'الإعدادات الأصلية عندما يكون منفذها متاحًا', 'FINO99VoiceOptional.openOwner'),
      {id: 'idle-policy', cat: 'extra', label: 'سياسة خمول العملاء', sub: 'سياسة S12 الأصلية؛ اعتماد ومراجعة من الوحدة الحالية', available: () => !!d.getElementById('f99s12-owner-policy'), run: () => d.getElementById('f99s12-owner-policy')?.click()},
      {id: 'theme', cat: 'extra', label: 'المظهر والمعاينة', sub: 'مظهر المالك فقط — هذا الجهاز؛ بدون مزامنة مركزية', available: () => true, run: () => { const x = root.querySelector('.f99od13-design'); x.open = true; x.querySelector('select')?.focus(); }}
    ];
    const seenAttr = new Set(), seenFn = new Set();
    const exactCalls = new Map(result.filter(x => x.path).map(x => [x.path + '(' + JSON.stringify(x.args).slice(1, -1).replaceAll('"', "'") + ')', x.id]));
    for (const n of originalButtons()) {
      const attr = (n.getAttribute('onclick') || '').trim().replace(/\s+/g, '').replace(/^window\./, '').replace(/\?\./g, '.').replace(/;$/, '');
      const callable = attr.replace(/\?\(/g, '(');
      // Only identical explicit invocation or identical onclick function references are duplicates.
      const duplicate = (attr && seenAttr.has(attr)) || (!attr && n.onclick && seenFn.has(n.onclick));
      n.classList.toggle('f99od13-identical-entry', !!duplicate);
      if (attr) seenAttr.add(attr); if (n.onclick) seenFn.add(n.onclick);
      if (duplicate || exactCalls.has(callable) || n.id === 'f99s12-owner-policy') continue;
      const label = (n.querySelector('b,strong')?.textContent || n.textContent || '').trim(); if (!label) continue;
      result.push({id: 'native-' + (n.id || result.length), cat: nativeCategory(label), label, sub: n.querySelector('small')?.textContent || 'أداة أصلية محفوظة بمستمعاتها؛ تفتح من العنصر نفسه', native: n, available: () => n.isConnected && !n.disabled, run: () => n.click()});
    }
    items = result;
  }
  function feeAvailable() {
    return !!resolve('F99FeeOffers.createApi') && !!resolve('F99FeeOffers.openOwner') && !!resolve('finoCentralAdminCall');
  }
  function feeOptions() {
    const sessionToken = token();
    const transport = async (fn, args) => {
      if (!isOwner() || token() !== sessionToken) return {ok: false, data: {ok: false, reason: 'OWNER_SESSION_REQUIRED'}};
      return callExport('finoCentralAdminCall', [fn, args]);
    };
    const feeApi = w.F99FeeOffers.createApi({ownerActor: () => isOwner() && token() === sessionToken ? sessionToken : '', ownerRpc: transport, rpc: transport});
    return {api: feeApi, openexistingContractOwner: typeof w.F99KContracts?.openOwner === 'function' ? () => callExport('F99KContracts.openOwner') : undefined};
  }
  function closeFees() { feeMount?.destroy?.(); feeMount = null; if (feeHost) { feeHost.replaceChildren(); feeHost.hidden = true; } }
  function openFees(draft) {
    closeFees(); if (!feeAvailable()) return message('وحدة عروض الأتعاب قيد التوصيل.', true);
    feeHost.hidden = false; const options = feeOptions();
    feeMount = draft ? w.F99FeeOffers.prepareOwnerDraft(feeHost, options) : w.F99FeeOffers.openOwner(feeHost, options);
    feeHost.scrollIntoView({block: 'nearest'});
  }
  function refreshPackages() {
    if (!packageSelect) return;
    let products = []; try { products = w.FINO99ReadStorefront?.()?.products || []; } catch (_) { /* no new DB read */ }
    const signature = JSON.stringify(products.map(p => [p.key, p.name, p.enabled]));
    if (packageSelect.dataset.signature === signature) return;
    packageSelect.dataset.signature = signature; const selected = packageSelect.value;
    packageSelect.replaceChildren(new Option('اختر الباقة من المتجر الحالي', ''));
    products.filter(p => p?.key).forEach(p => packageSelect.append(new Option((p.name || p.key) + (p.enabled === false ? ' — متوقفة' : ''), p.key)));
    if ([...packageSelect.options].some(x => x.value === selected)) packageSelect.value = selected;
    packageControls.querySelectorAll('button').forEach(b => { b.disabled = !packageSelect.value || !resolve(b.dataset.export); b.title = b.disabled ? 'اختر باقة وتأكد من تحميل المنفذ الأصلي' : ''; });
  }
  function renderTools() {
    if (!tools) return;
    tools.replaceChildren(); const needle = query.trim().toLocaleLowerCase('ar');
    const matches = items.filter(x => needle ? (x.label + ' ' + x.sub).toLocaleLowerCase('ar').includes(needle) : x.cat === category);
    categoryTitle.textContent = needle ? 'نتائج البحث في أسماء أدوات المالك' : CATS.find(c => c[0] === category)?.[1] || 'اختر بوابة';
    panel.hidden = !needle && !category; packageControls.hidden = !!needle || category !== 'packages';
    for (const x of matches) {
      const b = button(tools, '', x.run, 'f99od13-tool'); b.dataset.toolId = x.id;
      b.append(node('b', '', x.label), node('small', '', x.sub));
      b.disabled = !x.available(); if (b.disabled) { b.title = 'قيد التوصيل — الوحدة أو المنفذ الأصلي غير متاح الآن'; b.append(node('span', 'f99od13-pending', 'قيد التوصيل')); }
    }
    if (!matches.length && (needle || category)) tools.append(node('p', 'f99od13-empty', 'لا توجد أداة مطابقة. البحث في أسماء البوابات المحملة فقط، وليس بيانات العملاء.'));
    root.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-expanded', String(!needle && b.dataset.category === category)));
    refreshPackages();
  }
  function openCategory(cat) {
    if (!api.mounted || !isOwner() || !CATS.some(c => c[0] === cat)) return;
    closeFees(); category = cat; query = ''; root.querySelector('input[type=search]').value = ''; collect(); renderTools();
    categoryTitle.focus();
  }
  function buildDesign() {
    const details = node('details', 'f99od13-design'); root.append(details);
    details.append(node('summary', '', 'المظهر والمعاينة — هذا الجهاز'));
    details.append(node('p', 'f99od13-notice', 'ثلاثة مظاهر للمالك فقط. المعاينة لا تحفظ شيئًا؛ الاعتماد محلي لهذا الجهاز. لا يغيّر العميل أو صور النتائج أو إعدادات التمويل.'));
    const form = node('div', 'f99od13-design-fields'); details.append(form);
    const labels = {preset: 'المظهر', accent: 'اللون المميز', font: 'الخط القائم', icons: 'الأيقونات', cards: 'البطاقات', buttons: 'الأزرار', messages: 'رسائل المالك'};
    const names = {navy: 'كحلي', gold: 'ذهبي', light: 'فاتح', blue: 'أزرق FINO99', teal: 'فيروزي', Tajawal: 'Tajawal', Cairo: 'Cairo', outline: 'محددة', solid: 'مصمتة', soft: 'ناعمة', sharp: 'مستقيمة', rounded: 'مستديرة', square: 'مربعة', outlined: 'إطار واضح'};
    for (const key of Object.keys(ALLOWED)) {
      const l = node('label', 'f99od13-field'); l.append(node('span', '', labels[key])); const s = node('select'); s.dataset.designControl = key;
      ALLOWED[key].forEach(v => s.append(new Option(names[v] || v, v)));
      s.addEventListener('change', () => { if (!isOwner()) return destroy(); previewing = true; applyDesign({...design, [key]: s.value}); message('معاينة فقط؛ اضغط «اعتماد على هذا الجهاز» للحفظ.'); });
      l.append(s); form.append(l);
    }
    const state = node('p', 'f99od13-design-state'); state.dataset.designState = ''; details.append(state);
    const actions = node('div', 'f99od13-actions'); details.append(actions);
    button(actions, 'اعتماد على هذا الجهاز', () => {
      const next = normalize(design), before = {...approved};
      const nextHistory = [...history, before].slice(-8);
      try {
        w.localStorage.setItem(STORE, JSON.stringify({version: 1, scope: 'this_device', current: next, previous: before, history: nextHistory}));
        previous = before; history = nextHistory; approved = next; previewing = false; applyDesign(approved);
        message('اعتمد المظهر على هذا الجهاز فقط. لم يُحفظ في المركزية.');
      } catch (_) { message('تعذر التخزين على هذا الجهاز؛ بقيت المعاينة غير معتمدة.', true); }
    });
    button(actions, 'إلغاء المعاينة', () => { previewing = false; applyDesign(approved); message('أُلغي التغيير غير المعتمد.'); });
    button(actions, 'معاينة المظهر السابق', () => {
      if (!previous) return message('لا يوجد مظهر سابق محفوظ على هذا الجهاز.');
      previewing = true; applyDesign(previous); message('استُعيد المظهر السابق كمعاينة؛ يلزم اعتماد صريح لحفظه على هذا الجهاز.');
    });
    details.append(node('p', 'f99od13-muted', 'المزامنة المركزية غير موصولة في هذا الإصدار. سجل الاستعادة محلي ومحدود بآخر 8 مظاهر، وليس سجل تدقيق مركزيًا.'));
  }
  function mount() {
    if (api.mounted || !isOwner()) return;
    hub = d.getElementById('ownerHub'); if (!hub?.classList.contains('active')) return;
    originalShell = hub.querySelector('.owner-shell'); if (!originalShell) return;
    oldFocus = d.activeElement; anchor = d.createComment('F99 owner desktop original placement');
    originalShell.before(anchor); root = node('section', 'f99od13-desktop'); root.id = 'f99od13-desktop'; root.dir = 'rtl'; root.setAttribute('aria-label', 'مركز قيادة FINO99 للمالك'); anchor.before(root);
    const head = node('header', 'f99od13-head'); root.append(head);
    const brand = node('div', 'f99od13-brand'); brand.append(node('b', '', 'FINO99'), node('small', '', 'مركز القيادة • صلاحية المالك الأصلية')); head.append(brand);
    button(head, 'خروج', () => { destroy(); const out = resolve('ownerLogout'); if (out) out.fn.apply(out.host); }, 'f99od13-button f99od13-exit');
    const hero = node('div', 'f99od13-hero'); hero.append(node('small', '', 'مساحة عمل واحدة'), node('h1', '', 'كل قرار في مكانه.'), node('p', '', 'اختر بوابة، وابحث عن الأداة، وأنجز عبر وحداتك الأصلية.')); root.append(hero);
    const search = node('input', 'f99od13-search'); search.type = 'search'; search.placeholder = 'ابحث في أدوات المالك: أكواد، عقود، بنوك…'; search.setAttribute('aria-label', 'بحث في أسماء أدوات المالك المحملة');
    search.addEventListener('input', () => { closeFees(); query = search.value; collect(); renderTools(); }); root.append(search);
    const gateways = node('nav', 'f99od13-gateways'); gateways.setAttribute('aria-label', 'بوابات مركز القيادة'); root.append(gateways);
    for (const [id, title, sub, icon] of CATS) {
      const b = button(gateways, '', () => openCategory(id), 'f99od13-gateway'); b.dataset.category = id; b.setAttribute('aria-controls', 'f99od13-panel'); b.setAttribute('aria-expanded', 'false');
      b.append(node('span', 'f99od13-icon', icon), node('b', '', title), node('small', '', sub));
    }
    panel = node('section', 'f99od13-panel'); panel.id = 'f99od13-panel'; panel.hidden = true; root.append(panel);
    categoryTitle = node('h2', 'f99od13-panel-title'); categoryTitle.tabIndex = -1; panel.append(categoryTitle);
    packageControls = node('div', 'f99od13-packages'); panel.append(packageControls);
    const packageLabel = node('label', 'f99od13-field', 'الباقة من المتجر الحالي'); packageSelect = node('select'); packageLabel.append(packageSelect); packageControls.append(packageLabel);
    for (const [label, path] of [['تعديل الباقة', 'F99SOpenOwner'], ['مخزون الباقة', 'F99V17OpenInventory'], ['تجديد الباقة', 'FINO99V76.ownerPackage']]) {
      const b = button(packageControls, label, () => { if (packageSelect.value) return callExport(path, [packageSelect.value]); }); b.dataset.export = path; b.disabled = true;
    }
    packageSelect.addEventListener('change', () => packageControls.querySelectorAll('button').forEach(b => { b.disabled = !packageSelect.value || !resolve(b.dataset.export); }));
    tools = node('div', 'f99od13-tools'); panel.append(tools); feeHost = node('section', 'f99od13-module-frame'); feeHost.hidden = true; panel.append(feeHost);
    status = node('p', 'f99od13-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
    buildDesign(); drawer = node('details', 'f99od13-legacy'); anchor.before(drawer);
    drawer.append(node('summary', '', 'الأدوات والإعدادات الأصلية — محفوظة بالكامل'));
    drawer.append(node('p', 'f99od13-legacy-note', 'الأزرار أدناه أصلية بمستمعاتها. إعدادات الهوية والتصميم القديمة لها نطاقها الأصلي؛ ثيمات مركز القيادة لا تعدّلها.'));
    drawer.append(originalShell); loadLocal(); applyDesign(approved); collect(); renderTools();
    originalObserver = new MutationObserver(() => schedule()); originalObserver.observe(originalShell, {childList: true, subtree: true, characterData: true});
    // Publish mounted ONLY after original authorization and actual DOM construction.
    mountedToken = token();
    api.mounted = true;
    message('البحث في أسماء الأدوات فقط. أسعار الباقات والنسب والعقود لم تتغير.');
  }
  function schedule() {
    if (scheduled) return; scheduled = true;
    w.setTimeout(() => { scheduled = false; refresh(); }, 100);
  }
  function refresh() {
    if (!isOwner()) { if (api.mounted) destroy(); return; }
    if (api.mounted && mountedToken !== token()) destroy();
    if (!api.mounted) { mount(); return; }
    if (!hub.classList.contains('active')) return;
    const before = items.map(x => x.id + ':' + x.label + ':' + x.available()).join('|');
    collect(); const after = items.map(x => x.id + ':' + x.label + ':' + x.available()).join('|');
    if (before !== after) renderTools(); refreshPackages();
  }
  function destroy() {
    if (!root) { api.mounted = false; return; }
    api.mounted = false; originalObserver?.disconnect(); originalObserver = null;
    closeFees(); previewing = false;
    // Restore original node placement, not clones or rewritten owner controls.
    drawer?.querySelectorAll('.f99od13-identical-entry').forEach(n => n.classList.remove('f99od13-identical-entry'));
    for (const [n, marker] of displaced) { if (marker.parentNode) marker.before(n); marker.remove(); }
    displaced.clear(); mountedToken = '';
    if (originalShell && anchor?.parentNode) anchor.before(originalShell);
    const active = d.activeElement; const shouldRestore = root.contains(active) || drawer?.contains(active);
    root.remove(); drawer?.remove(); anchor?.remove();
    if (shouldRestore && oldFocus?.isConnected && !hub?.contains(oldFocus) && oldFocus.getClientRects().length) oldFocus.focus();
    if (shouldRestore) w.requestAnimationFrame(() => {
      if (isOwner() || (d.activeElement !== d.body && d.activeElement?.isConnected)) return;
      const entry = d.querySelector('#page1.active input:not([type=hidden]):not([disabled]), #page1.active button:not([disabled]), #login.active input:not([type=hidden]):not([disabled])');
      if (entry?.getClientRects().length) entry.focus({preventScroll: true});
    });
    root = null; drawer = null; anchor = null; status = null; items = []; category = ''; query = '';
  }
  function boot() {
    if (booted) return; booted = true; hub = d.getElementById('ownerHub');
    if (!hub) return;
    observer = new MutationObserver(schedule); observer.observe(hub, {attributes: true, attributeFilter: ['class', 'aria-hidden']});
    // No network calls or client DOM observers. Timer only checks original access/navigation.
    w.setInterval(() => { if (!d.hidden || api.mounted) refresh(); }, 1500);
    d.addEventListener('visibilitychange', schedule); refresh();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})(window);
