/* FINO99 — Smart Executive Manager (owner-only chat). Additive module.
 * WhatsApp-style chat inside the owner panel. Understands Saudi colloquial Arabic (text or voice).
 * - Reads live central data with the owner session (finoCentralAdminCall); never invents numbers or rates.
 * - Routine reads/navigation run immediately. Contracts, code allocation, vault issuing and rate changes
 *   run ONLY after the owner taps «اعتمد» on a confirmation card (never by voice).
 * - Optional AI understanding (/lab/exec/brain) is used only when the local engine does not understand;
 *   it returns an intent, never executes anything itself.
 * - Chat history stays in this browser tab (sessionStorage) only; no audio is stored. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.F99ExecGateway = api; api.install(root); }
})(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  /* ---------------- language engine (pure) ---------------- */
  const rateAPI = () => root?.F99RateManager || (typeof require === 'function' ? require('./fino99_rate_manager.js') : null);
  const DIGITS = {'٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٫': '.'};
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[٠-٩۰-۹٫]/g, d => DIGITS[d]).replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[؟?!،,؛;:"'«»()\[\]{}…]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const words = t => norm(t).split(' ').filter(Boolean);
  // token match: exact, with leading و/ف/ب/ل/ال, or a short suffix (ها/ه/ي/لي/ك/ات)
  const PREFIXES = ['', 'و', 'ف', 'ب', 'ل', 'ال', 'وال', 'بال', 'لل', 'فال'];
  function tokenHas(tokens, w) {
    const x = norm(w);
    return tokens.some(t => PREFIXES.some(p => t === p + x || (x.length >= 3 && t.startsWith(p + x) && t.length - (p + x).length <= 3)));
  }
  function has(text, list) {
    const n = ' ' + norm(text) + ' '; const tokens = words(text);
    return list.some(w => { const x = norm(w); return x.includes(' ') ? n.includes(' ' + x + ' ') || n.includes(x) : tokenHas(tokens, x); });
  }

  const UNITS = {'واحد': 1, 'وحده': 1, 'اثنين': 2, 'ثنين': 2, 'اثنان': 2, 'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4, 'خمس': 5, 'خمسه': 5, 'ست': 6, 'سته': 6, 'سبع': 7, 'سبعه': 7,
    'ثمان': 8, 'ثمانيه': 8, 'ثمني': 8, 'تسع': 9, 'تسعه': 9, 'عشر': 10, 'عشره': 10, 'عشرين': 20, 'ثلاثين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70, 'ثمانين': 80, 'تسعين': 90,
    'ميتين': 200, 'مئتين': 200, 'ثلاثميه': 300, 'ثلثميه': 300, 'اربعميه': 400, 'ربعميه': 400, 'خمسميه': 500, 'ستميه': 600, 'سبعميه': 700, 'ثمانميه': 800, 'ثمنميه': 800, 'تسعميه': 900, 'الفين': 2000};
  /* Pure: first number in the text (digits or Saudi number words). */
  function parseNumber(text) {
    const n = norm(text); const m = n.match(/(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]);
    let total = 0, cur = 0, seen = false;
    for (let t of n.split(' ')) {
      if (t.length > 2 && t.startsWith('و')) t = t.slice(1);
      if (UNITS[t] !== undefined) { const v = UNITS[t]; if (v >= 200) { total += v; } else cur += v; seen = true; }
      else if (t === 'ميه' || t === 'مئه' || t === 'مية') { cur = (cur || 1) * 100; seen = true; }
      else if (t === 'الف' || t === 'الاف') { total += (cur || 1) * 1000; cur = 0; seen = true; }
      else if (seen && !['و', 'كود', 'اكواد', 'ريال'].includes(t)) break;
    }
    return seen ? total + cur : null;
  }
  const allNumbers = text => (norm(text).match(/\d+(?:\.\d+)?/g) || []).map(Number);

  /* Pure: "سوّ لي باقة ..." detection and slot parsing (draft only; the owner edits every field before saving). */
  const PKG_SERVICES = [['buyout', 'شراء مديونية التمويل الشخصي'], ['smart', 'الحاسبة الذكية'], ['compare', 'مقارنات عروض البنوك'], ['mortgage_quote', 'التمويل العقاري'],
    ['mortgage_compare', 'مقارنات العقاري'], ['contract', 'العقود والاتفاقيات'], ['guidance_mortgage', 'إرشادات عامة للتمويل العقاري'], ['guidance_personal', 'إرشادات عامة للتمويل الشخصي']];
  function isPkgCreate(input) {
    const n = norm(input);
    if (!/(^| )(ال|ل|و)?باق(ه|ات)( |$)/.test(n)) return false;
    if (has(input, ['خصص', 'تخصيص', 'وزع', 'توزيع'])) return false;
    return /باقه جديده/.test(n) || /(^| )(سو|سوي|سوو|اسوي|سويلي|اعمل|جهز|انشئ|انشي|ابي|ابغى|ابغي|نبي|نبغى|ضيف|اضف|ابا)( لي| لنا)? باقه/.test(n);
  }
  function parsePackageSpec(input) {
    const n = norm(input); const spec = {services: []};
    const nm = n.match(/باقه (?:جديده )?(?:اسمها |باسم |اسم )?(.+?)(?= بسعر| سعرها| السعر| ب ?\d| فيها| تشمل| مدتها| لمده| مده| بمده| وتجديد| تجديد| مع | و?عدد| \d|$)/);
    if (nm) { const t = nm[1].replace(/ و$/, '').trim(); if (t && t.length <= 60 && !/^(فيها|تشمل|جديده)$/.test(t) && !/^(لل|ل)/.test(t)) spec.name = t; }
    const ren = n.match(/تجديد\D{0,20}?(\d+(?:\.\d+)?)/); if (ren) spec.renewalPrice = Number(ren[1]);
    const priceRx = /(?:بسعر|سعرها|السعر|ب)\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s?(?:ريال|رس)/g; let m;
    while ((m = priceRx.exec(n))) { const v = Number(m[1] || m[2]); const before = n.slice(Math.max(0, m.index - 22), m.index); if (/تجديد/.test(before) || (spec.renewalPrice === v && /تجديد/.test(n.slice(Math.max(0, m.index - 30), m.index + 4)))) continue; spec.price = v; break; }
    const days = n.match(/(\d+)\s?(يوم|ايام)/), hours = n.match(/(\d+)\s?(ساعه|ساعات)/), weeks = n.match(/(\d+)\s?(اسبوع|اسابيع)/), months = n.match(/(\d+)\s?(شهر|شهور|اشهر)/);
    if (days) spec.days = Number(days[1]); else if (weeks) spec.days = Number(weeks[1]) * 7; else if (months) spec.days = Number(months[1]) * 30; else if (hours) spec.hours = Number(hours[1]);
    else if (/يومين/.test(n)) spec.days = 2; else if (/اسبوعين/.test(n)) spec.days = 14; else if (/(^| )اسبوع( |$)/.test(n)) spec.days = 7; else if (/شهرين/.test(n)) spec.days = 60; else if (/(^| )شهر( |$)/.test(n)) spec.days = 30; else if (/(^| )(يوم|يوم واحد)( |$)/.test(n)) spec.days = 1;
    const calcs = n.match(/(\d+)\s?(حسبه|حسبات|عمليه|عمليات|مرات|مره)/); if (calcs) spec.calcs = Number(calcs[1]);
    const codes = n.match(/(\d+)\s?(كود|اكواد)/); if (codes) spec.codes = Number(codes[1]);
    const add = k => { if (!spec.services.includes(k)) spec.services.push(k); };
    n.split(/ و| مع |،| \+ /).forEach(c => {
      const g = /ارشاد/.test(c);
      if (g && /عقار/.test(c)) add('guidance_mortgage'); else if (g) add('guidance_personal');
      else if (/عقار/.test(c) && /مقارن/.test(c)) add('mortgage_compare'); else if (/عقار/.test(c)) add('mortgage_quote');
      if (!g && /مديوني|تحويل|شراء دين/.test(c)) add('buyout');
      if (!g && !/عقار/.test(c) && /مقارن/.test(c)) add('compare');
      if (!g && /(^| )(ال)?(حاسبه|ذكي|ذكيه|شخصي)( |$)/.test(c) && !/عقار/.test(c)) add('smart');
      if (/(^| )(ال)?عقود?( |$)|اتفاقي/.test(c)) add('contract');
    });
    return spec;
  }
  /* Pure: early-settlement policy changes from a colloquial sentence (months). */
  function parseEarlyPolicy(input) {
    const n = norm(input); const out = {};
    const months = (num, unit) => (/سن/.test(unit || '') ? num * 12 : num);
    const grab = rx => { const m = n.match(rx); return m ? months(Number(m[1]), m[2]) : undefined; };
    if (/سنتين/.test(n) && /تحذير|نبه|انذار/.test(n) && !/تحذير\D{0,25}\d/.test(n)) out.warnPaidMonths = 24;
    const w = grab(/(?:تحذير|نبه|انذار)\D{0,30}?(\d+)\s?(شهر|اشهر|شهور|سنه|سنوات)?/); if (w !== undefined) out.warnPaidMonths = w;
    const mp = grab(/(?:حد ادنى|الحد الادنى|ادنى ربح|لا يقل)\D{0,30}?(\d+)\s?(شهر|اشهر|شهور|سنه|سنوات)?/); if (mp !== undefined) out.minProfitMonths = mp;
    if (/ربح سنتين/.test(n) && out.minProfitMonths === undefined) out.minProfitMonths = 24;
    const cp = grab(/(?:تعويض|رسوم اداريه|رسوم الاداريه|غرامه)\D{0,25}?(\d+)\s?(شهر|اشهر|شهور)/); if (cp !== undefined) out.compensationProfitMonths = cp;
    const ff = n.match(/(?:رسوم ثابته|رسم ثابت|مبلغ ثابت)\D{0,15}?(\d+(?:\.\d+)?)/); if (ff) out.fixedFee = Number(ff[1]);
    if (/(^| )(فعل|شغل|اظهر|افتح)/.test(n)) out.enabled = true; if (/(^| )(اوقف|عطل|اخف|اخفي|سكر|قفل)/.test(n)) out.enabled = false;
    return out;
  }

  const CREATE = ['سو', 'سوي', 'سوو', 'اسوي', 'سويلي', 'اعمل', 'جهز', 'انشئ', 'انشي', 'ابي', 'ابغى', 'ابغي', 'ودي', 'اكتب', 'حضر', 'طلع', 'افتح', 'ابدا', 'نبي', 'نبغى', 'عطني'];
  const CHANGE = ['غير', 'عدل', 'بدل', 'حدث', 'حط', 'خل', 'خلي', 'ارفع', 'نزل', 'زود', 'قلل'];
  const SHOW = ['ورني', 'وريني', 'ورنا', 'اعرض', 'عطني', 'ابي اشوف', 'ابغى اشوف', 'وش', 'ايش', 'كم', 'كيف', 'تقرير', 'ملخص', 'وضع', 'حاله', 'شف', 'شوف', 'اشوف', 'فين', 'وين'];
  const YES = ['ايه', 'ايوه', 'اي', 'نعم', 'تمام', 'اعتمد', 'موافق', 'اوكي', 'ok', 'okay', 'يلا', 'نفذ', 'اكد', 'اكيد', 'طيب', 'زين', 'ماشي', 'تم', 'وافق', 'اعتمدها', 'نفذها'];
  const NO = ['لا', 'لاء', 'الغ', 'الغي', 'الغاء', 'بطل', 'وقف', 'كنسل', 'cancel', 'خلاص لا', 'لا تسوي', 'لا تنفذ', 'ما ابي', 'ماابي'];
  const TOPICS = [
    ['sales', ['مبيعات', 'بيع', 'مبيع', 'ارباح', 'دخل', 'سله']], ['stock', ['مخزون', 'المخزون', 'متاح', 'خزنه']], ['contracts', ['عقود', 'عقد', 'العقود']],
    ['alerts', ['تنبيه', 'تنبيهات', 'مشاكل', 'مشكله']], ['codes', ['اكواد', 'كود', 'عملاء', 'دخول', 'العملاء']], ['renewal', ['تجديد', 'التجديد']]];

  const exact = (text, list) => { const n = norm(text); return list.some(w => n === norm(w) || n === norm(w) + ' ' + 'يا مدير' || n.startsWith(norm(w) + ' ') && n.split(' ').length <= 3); };

  /* Pure: understand an owner message. ctx: {awaiting?:string, pending?:bool}. */
  function understand(input, ctx) {
    ctx = ctx || {};
    const text = norm(input);
    if (!text) return {intent: 'empty'};
    if (ctx.awaiting === 'contract_body' && !exact(input, NO) && text.length >= 20) return {intent: 'contract_body', body: String(input).trim()};
    if (ctx.awaiting === 'lawyer') { if (has(input, ['بدون', 'بلا', 'لا'])) return {intent: 'lawyer', value: false}; if (exact(input, YES) || has(input, ['محامي', 'مع'])) return {intent: 'lawyer', value: true}; }
    if (ctx.awaiting === 'deposit') { if (has(input, ['بدون', 'بلا', 'لا'])) return {intent: 'deposit', value: false}; if (exact(input, YES) || has(input, ['عربون', 'مع'])) return {intent: 'deposit', value: true}; }
    if ((ctx.pending || ctx.awaiting) && exact(input, NO)) return {intent: 'cancel'};
    if (ctx.pending && exact(input, YES)) return {intent: 'confirm'};
    if (has(input, ['السلام عليكم', 'هلا', 'مرحبا', 'صباح الخير', 'مساء الخير', 'هلا والله', 'اهلين', 'مرحب']) && text.split(' ').length <= 4) return {intent: 'greet'};
    if (has(input, ['شكرا', 'يعطيك العافيه', 'مشكور', 'تسلم', 'الله يعطيك']) && text.split(' ').length <= 5) return {intent: 'thanks'};
    if (has(input, ['وش تقدر', 'ساعدني', 'مساعده', 'وش تسوي', 'الاوامر', 'help'])) return {intent: 'help'};

    // A screenshot is not calculator input. This static gateway has no vision endpoint.
    if (has(input, ['صورة حسبة', 'صوره حسبه', 'اقرأ الصورة', 'اقرا الصوره', 'محتوى الصورة', 'هذه الصورة', 'صورة الحساب', 'صورة النتيجة', 'قراءة الصور'])) return {intent: 'image'};
    if (has(input, CHANGE.concat(['اصلح', 'اصلاح'])) && has(input, ['تقني', 'برمجي', 'كود الموقع', 'html', 'css', 'javascript', 'ملف', 'الاداء', 'البطء'])) return {intent: 'technical_edit', query: input};
    if (/apr|معدل النسبه السنوي|التكلفه السنوي/.test(text) && has(input, ['ما هو', 'ما هي', 'وش', 'ايش', 'معنى', 'الفرق'])) return {intent: 'question', answer: 'APR هو معدل النسبة السنوي للتكلفة الإجمالية للتمويل، وليس هامش الربح السنوي؛ لا يُستبدل أحدهما بالآخر في الحاسبة.'};
    if (has(input, ['هل تغير', 'هل تعدل', 'تغير بنفسك', 'صلاحيتك', 'صلاحياتك'])) return {intent: 'question', answer: 'لا أغيّر نسب البنوك أو العقود أو المخزون من تلقاء نفسي. أعرض مسودة، والتنفيذ الحساس يحتاج مراجعتك واعتمادك بالزر.'};

    const count = parseNumber(input);
    const isContract = has(input, ['عقد', 'عقود', 'العقد', 'العقود']);
    // contracts
    if (has(input, ['بيع بالاجل', 'بالاجل', 'اجل', 'تقسيط', 'بالتقسيط']) && (isContract || has(input, ['بيع']))) {
      const lawyer = has(input, ['بدون محامي', 'بلا محامي', 'من غير محامي']) ? false : has(input, ['محامي', 'مراجع']) ? true : undefined;
      return {intent: 'contract_deferred', lawyer};
    }
    if (isContract && has(input, ['متابعه', 'تعقيب', 'خدمه'])) {
      const deposit = has(input, ['بدون عربون', 'بلا عربون', 'من غير عربون']) ? false : has(input, ['عربون']) ? true : undefined;
      return {intent: 'contract_followup', deposit};
    }
    if (isContract && has(input, ['معلق', 'معلقه', 'وين وصل', 'وش صار', 'جاريه', 'بانتظار', 'تابع', 'متابعتي'])) {
      const more = TOPICS.filter(([, w]) => has(input, w)).map(([k]) => k);
      return {intent: 'report', topics: more.length > 1 ? more : ['contracts']};
    }
    if ((has(input, ['خزنه']) || (has(input, ['اكواد', 'كود']) && isContract)) && has(input, ['اصدر', 'ولد', 'زود', 'ضيف', 'اضف', 'طلع', 'جهز', 'سو', 'سوي'])) return {intent: 'vault_issue', count};
    if (isContract && has(input, CREATE.concat(['جديد']))) return {intent: 'contract_free'};
    if (isPkgCreate(input)) return {intent: 'package_create', spec: parsePackageSpec(input), query: input};
    // codes, renewal, packages
    if (has(input, ['تجديد']) && (has(input, ['عرض', 'سعر', 'ريال']) || count)) return {intent: 'renewal_offer', price: count, query: input};
    if (has(input, ['خصص', 'تخصيص', 'وزع', 'توزع', 'توزيع', 'خصصلي', 'خصص لي']) || (count && has(input, ['كود', 'اكواد']) && has(input, ['باقه', 'لباقه', 'للباقه']) && has(input, CREATE))) return {intent: 'allocate', count, query: input};
    if (has(input, ['باقه', 'الباقه']) && has(input, ['صوره', 'اسم', 'وصف', 'تصميم', 'لون', 'شعار', 'سعر']) && has(input, CHANGE.concat(CREATE))) {
      const fields = ['صوره', 'اسم', 'وصف', 'سعر', 'تصميم'].filter(f => has(input, [f])); return {intent: 'package_edit', fields, query: input};
    }
    // rates
    if ((has(input, ['نسب', 'نسبه', 'فائده', 'هامش', 'فوائد', 'apr', 'معدل']) || /\bapr(?=\W|\d|$)/.test(text)) && (has(input, ['بنك', 'بنوك', 'البنوك', 'البنك']) || /\d/.test(text) || has(input, ['شخصي', 'عقاري', 'سجل', 'استعاده']))) {
    if (has(input, ['سجل', 'تاريخ التعديلات', 'استعاده', 'استرجاع'])) return {intent: 'bank_rate_history', query: input};
      const spec = rateAPI()?.parse(input);
      if (has(input, CHANGE.concat(['صارت', 'صار'])) || spec?.new_rate !== null && spec?.new_rate !== undefined || spec?.metric === 'APR') {
        return {intent: 'bank_rate_set', rate: spec?.new_rate ?? null, source: spec?.source || '', spec, query: input};
      }
      return {intent: 'bank_rates', query: input};
    }
    if ((has(input, ['سياسه', 'سياسات']) && has(input, ['عقاري', 'العقاري', 'العقاريه', 'سداد مبكر', 'السداد المبكر'])) || (has(input, ['سداد مبكر', 'السداد المبكر']) && (has(input, CHANGE) || /\d/.test(text) || has(input, ['فعل', 'شغل', 'اوقف', 'عطل', 'سنتين']))))
      return {intent: 'mortgage_policy', changes: parseEarlyPolicy(input)};
    // A question about a calculator is not permission to open it or recompute.
    if (/^(ما هو|ما هي|ما معني|وش معني|ايش معني)/.test(text)) {
      if (/عقار|رهن/.test(text)) return {intent: 'question', answer: 'التمويل العقاري تمويل لشراء أو بناء عقار بضمانه عادةً. تختلف شروطه حسب البنك والمنتج؛ لا أعتمد عرضًا أو أعيد حساب حسبة دون طلبك.'};
      if (/مديوني/.test(text)) return {intent: 'question', answer: 'شراء المديونية هو نقل الالتزام القائم إلى جهة تمويل أخرى لتسويته وفق عرضها. المقارنة تحتاج شروط العرض الفعلي، وليست موافقة مصرفية.'};
      return {intent: 'unknown'};
    }
    if (/^كيف/.test(text) && /افتح|ادخل|استخدم/.test(text)) return {intent: 'question', answer: 'اختر بوابة الخدمة المطلوبة من مكتب المالك، ثم افتح أداتها الأصلية. حدّد اسم الخدمة لأوضح مكانها؛ لم أفتح حاسبة أو أنفذ تغييرًا.'};
    // navigation
    if (has(input, ['سداد مبكر', 'السداد المبكر'])) return {intent: 'open', route: 'early'};
    if (has(input, ['بناء ذاتي', 'البناء الذاتي', 'على الخارطه', 'الخارطه', 'نقل التمويل العقاري', 'نقل المديونيه العقاريه', 'ترشيح البنوك', 'منتجات العقاري'])) return {intent: 'open', route: 'advanced'};
    if (has(input, ['عقاري', 'العقاري', 'رهن', 'عقار', 'سكني'])) return {intent: 'open', route: 'mortgage'};
    if (has(input, ['ارشاد', 'ارشادات', 'اسئله', 'faq', 'اجابات'])) return {intent: 'open', route: 'guidance'};
    if (has(input, ['مديونيه', 'تحويل مديونيه'])) return {intent: 'open', route: 'buyout'};
    if (has(input, ['كوبون', 'كوبونات', 'كود خصم', 'اكواد الخصم', 'خصم'])) return {intent: 'open', route: 'coupons'};
    if (has(input, ['افحص', 'ابحث', 'تحقق', 'فحص']) && has(input, ['كود'])) return {intent: 'open', route: 'code'};
    if (has(input, ['البنوك', 'بنوك', 'الشعارات'])) return {intent: 'open', route: 'banks'};
    // reports
    const topics = TOPICS.filter(([, w]) => has(input, w)).map(([k]) => k);
    if (topics.length && has(input, SHOW)) return {intent: 'report', topics};
    if (has(input, ['تقرير', 'ملخص المنصة', 'ملخص المنصه', 'وضع المنصة', 'وضع المنصه'])) return {intent: 'report', topics: ['summary']};
    // A topic word with a number but no "show" verb is probably an action phrased differently: ask the server brain.
    if (topics.length && count === null) return {intent: 'report', topics};
    return {intent: 'unknown'};
  }

  /* Pure: best package match by token overlap; returns {item, score, ties}. */
  function matchPackage(query, items) {
    const STOP = new Set(['باقه', 'الباقه', 'لباقه', 'للباقه', 'كود', 'اكواد', 'خصص', 'عرض', 'تجديد', 'ريال', 'لي', 'ابي', 'سو', 'سوي', 'غير', 'صوره', 'اسم', 'واسمها', 'وصورتها', 'صورتها', 'اسمها', 'عدل', 'انشئ', 'بسعر', 'سعر', 'جديد', 'الجديد']);
    const q = words(query).filter(t => !/^\d/.test(t) && !STOP.has(t) && t.length >= 2);
    let best = null, score = 0, ties = [];
    for (const it of items || []) {
      const nameT = words((it.name || '') + ' ' + (it.label || '') + ' ' + String(it.key || '').replace(/[-_]/g, ' '));
      const s = q.reduce((acc, t) => acc + (nameT.some(n => n === t || (t.length >= 3 && (n.startsWith(t) || t.startsWith(n)) && Math.min(n.length, t.length) >= 3)) ? 1 : 0), 0);
      if (s > score) { best = it; score = s; ties = [it]; } else if (s === score && s > 0) ties.push(it);
    }
    if (!best && (items || []).length === 1) return {item: items[0], score: 0, ties: [items[0]]};
    return {item: ties.length === 1 ? best : null, score, ties};
  }

  const num = x => (Number.isFinite(Number(x)) ? Number(x) : null);
  const WAITING = ['interest_received', 'awaiting_acceptance', 'acceptance_pending_identity'];
  /* Pure: deterministic priorities from live readings. */
  function priorities(data) {
    const out = [];
    const alerts = data.alerts?.items; if (Array.isArray(alerts) && alerts.length) out.push({level: 'high', text: 'لديك ' + alerts.length + ' تنبيه من المركزية تحتاج مراجعة.'});
    const st = data.stock; if (st && num(st.available) !== null) { const a = num(st.available), t = num(st.total) || 0;
      if (a === 0) out.push({level: 'high', text: 'مخزون الأكواد العام المتاح = 0. لا تفتح البيع قبل تغذية مخزون معتمد.', route: 'renewal'});
      else if (a < 20 || (t > 0 && a / t < 0.1)) out.push({level: 'medium', text: 'مخزون الأكواد العام منخفض (' + a + ' متاح).', route: 'renewal'}); }
    const kv = data.kvault; if (kv && num(kv.available) !== null && num(kv.available) < 10) out.push({level: num(kv.available) === 0 ? 'high' : 'medium', text: 'خزنة أكواد العقود: ' + kv.available + ' متاح فقط.', route: 'contracts'});
    const kd = data.kdeals; const turn = Array.isArray(kd?.items) ? kd.items.filter(x => x.owner_turn).length : 0;
    if (turn) out.push({level: 'medium', text: turn + ' معاملة عقود بانتظار إجرائك.', route: 'contracts'});
    if (num(kd?.unseen)) out.push({level: 'low', text: kd.unseen + ' حدث جديد من أطراف العقود.', route: 'contracts'});
    const items = Array.isArray(data.cases?.items) ? data.cases.items : []; const waiting = items.filter(c => WAITING.includes(String(c.stage || c.status || '')));
    if (waiting.length) out.push({level: 'medium', text: waiting.length + ' عميل بانتظار متابعتك في العقود السابقة (V60).', route: 'contracts_old'});
    if (!out.length) out.push({level: 'ok', text: 'لا توجد أولويات حرجة في القراءات الحالية.'});
    const order = {high: 0, medium: 1, low: 2, ok: 3}; return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  /* Pure: report text strictly from readings. */
  function report(topic, data) {
    const s = data.dashboard?.summary || {}; const miss = 'ما قدرت أقرأ هذا من المركزية الحين.';
    if (topic === 'sales') {
      const p = Array.isArray(data.packages?.items) ? data.packages.items : null;
      const lines = ['المبيعات: ما فيه ربط آلي بمبيعات سلة داخل المنصة، فما أقدر أعطيك رقم مبيعات بدون ما أخترعه.'];
      if (num(s.codes_active) !== null) lines.push('أقرب مؤشر حقيقي: ' + s.codes_active + ' كود نشط من ' + s.codes_total + '، و' + (s.entries_total ?? 0) + ' مرة دخول مسجلة.');
      if (p) lines.push('عروض التجديد: ' + p.reduce((a, x) => a + (num(x.offer_count) || 0), 0) + ' عرض، منها ' + p.reduce((a, x) => a + (num(x.visible_offer_count) || 0), 0) + ' ظاهر للعملاء.');
      return lines.join('\n');
    }
    if (topic === 'stock') {
      const st = data.stock; if (!st || num(st.available) === null) return miss;
      let t = 'المخزون العام: ' + st.available + ' متاح، ' + (st.reserved ?? 0) + ' محجوز، ' + (st.published ?? 0) + ' منشور، من إجمالي ' + (st.total ?? 0) + '.';
      if (data.kvault && num(data.kvault.available) !== null) t += '\nخزنة أكواد العقود: ' + data.kvault.available + ' متاح، ' + (data.kvault.assigned ?? 0) + ' مخصص لأطراف.';
      const last = Array.isArray(st.allocations) ? st.allocations[0] : null; if (last) t += '\nآخر دفعة: ' + (last.package_name || last.package_key) + ' (' + last.item_count + ' كود، ' + (last.state === 'published' ? 'معتمدة' : last.state) + ').';
      return t;
    }
    if (topic === 'contracts') {
      const kd = data.kdeals; if (!kd?.counts) return miss; const c = kd.counts;
      const turn = (kd.items || []).filter(x => x.owner_turn);
      let t = 'العقود: ' + (c.active || 0) + ' جارية، ' + (c.completed || 0) + ' مكتملة، ' + (c.rejected || 0) + ' مرفوضة.';
      if (turn.length) t += '\nبانتظارك: ' + turn.slice(0, 5).map(x => x.ref + ' (' + x.stage_label + ')').join('، ') + '.';
      const waitingParty = (kd.items || []).filter(x => x.status === 'active' && !x.owner_turn);
      if (waitingParty.length) t += '\nبانتظار الأطراف: ' + waitingParty.slice(0, 5).map(x => x.ref + ' — ' + (x.waiting_for || '')).join('، ') + '.';
      if (num(kd.unseen)) t += '\nأحداث جديدة ما شفتها: ' + kd.unseen + '.';
      return t;
    }
    if (topic === 'alerts') { const a = data.alerts?.items; if (!Array.isArray(a)) return miss; return a.length ? 'عندك ' + a.length + ' تنبيه:\n' + a.slice(0, 5).map(x => '• ' + String(x.title || x.message || x.kind || 'تنبيه').slice(0, 140)).join('\n') : 'ما فيه تنبيهات مفتوحة.'; }
    if (topic === 'codes') { if (num(s.codes_total) === null) return miss; return 'الأكواد: ' + s.codes_total + ' إجمالي، ' + (s.codes_active ?? 0) + ' نشط. مرات الدخول: ' + (s.entries_total ?? 0) + '. الأرشيف: ' + (s.archives_total ?? 0) + '.'; }
    if (topic === 'renewal') { const p = data.packages?.items; if (!Array.isArray(p)) return miss;
      return p.length ? 'عروض التجديد حسب الباقة:\n' + p.map(x => '• ' + (x.name || x.key) + ': ' + (x.offer_count || 0) + ' عرض (' + (x.visible_offer_count || 0) + ' ظاهر)' + (x.stock_confirmed ? '' : ' — المخزون غير مؤكد')).join('\n') : 'ما فيه باقات تجديد مهيأة.'; }
    if (num(s.codes_total) === null) return miss;
    return 'ملخص سريع: ' + s.codes_total + ' كود (' + (s.codes_active ?? 0) + ' نشط)، ' + (s.entries_total ?? 0) + ' دخول.' + (data.stock && num(data.stock.available) !== null ? ' المخزون المتاح: ' + data.stock.available + '.' : '')
      + (data.kdeals?.counts ? ' العقود الجارية: ' + (data.kdeals.counts.active || 0) + '.' : '');
  }

  const ROUTES = {
    renewal: ['عروض تجديد الأكواد والمخزون', (w, k) => w.FINO99V74OwnerRenewal?.(k || '')],
    contracts: ['نظام العقود الذكي', w => w.F99KContracts?.openOwner?.()],
    contracts_old: ['العقود السابقة (V73)', w => w.FINO99V73OpenOwner?.('templates')],
    guidance: ['إرشادات الباقات', w => w.F99G4GuidanceUI?.openOwner?.()],
    early: ['سياسة السداد المبكر للعقاري', w => w.F99MEarly?.openOwner?.()],
    advanced: ['منتجات العقاري المتقدمة (بناء ذاتي، على الخارطة، نقل، ترشيح)', w => w.F99MAdv?.openOwner?.()],
    mortgage: ['مركز تحكم التمويل العقاري', w => w.F99MOpenControl?.()],
    coupons: ['أكواد الخصم', w => w.F99V72CouponDesk?.()],
    banks: ['البنوك والنسب والشعارات (الشخصي)', w => w.FINO99OpenCoreBanks?.()],
    buyout: ['تحويل المديونية', w => w.ownerOpenBuyout?.()],
    code: ['فحص كود عميل', w => w.F99V19OpenCode?.()],
    inventory: ['المخزون والدفعات وملفات سلة', (w, k) => w.F99V9OpenInventory?.(k || '')],
    package: ['محرر الباقة', (w, k) => w.F99SOpenOwner?.(k || '')]
  };
  const HELP = ['ورني المبيعات والمخزون والعقود المعلقة', 'سوّ لي باقة جديدة', 'عدّل سياسة الحاسبة العقارية', 'سوّ لي عقد', 'أبي عقد بيع بالأجل', 'عقد متابعة بعربون', 'خصص 100 كود لباقة ...', 'أنشئ عرض تجديد للباقة بـ17 ريال', 'حدث نسب البنوك', 'افتح العقاري وعدل سياسته', 'اصدر 50 كود عقود'];

  /* ---------------- UI + executor ---------------- */
  function install(w) {
    const d = w.document; const HKEY = 'F99XC_CHAT_V1';
    let modal = null, list = null, input = null, data = {}, readAt = 0, ctx = {}, pending = null, recognizer = null, speakOn = false, brainOff = false, lastDeal = null;
    const isOwner = () => { try { return !!activeAccess?.record?.central && !!activeAccess?.record?.owner && !!finoCentralAdminToken; } catch (e) { return false; } };
    const el = (tag, cls, text) => { const x = d.createElement(tag); if (cls) x.className = cls; if (text !== undefined && text !== null) x.textContent = String(text); return x; };
    const btn = (host, text, run, cls) => { const b = el('button', cls || 'f99xc-chip', text); b.type = 'button'; b.onclick = run; host.append(b); return b; };
    async function call(fn, args) { try { const r = await w.finoCentralAdminCall(fn, args || {}); if (!r || r.ok !== true) return {ok: false, reason: String(r?.data?.reason || r?.error?.code || r?.error || 'TRANSPORT')}; return r.data && typeof r.data === 'object' ? (r.data.ok === undefined ? {ok: true, ...r.data} : r.data) : {ok: true, value: r.data}; } catch (e) { return {ok: false, reason: 'TRANSPORT'}; } }
    const products = () => { try { return (w.FINO99ReadStorefront?.()?.products || []).filter(p => p && p.key); } catch (e) { return []; } };

    const SOURCES = [['dashboard', 'fino_admin_dashboard', {}], ['alerts', 'f99v78_owner_alerts', {}], ['stock', 'f99v9_admin_stock_summary', {}], ['cases', 'f99v60_admin_cases', {p_limit: 30}],
      ['packages', 'f99v76_owner_packages', {}], ['kdeals', 'f99k_owner_deals', {p_limit: 60}], ['kvault', 'f99k_owner_vault', {}]];
    const TOPIC_SOURCES = {sales: ['dashboard', 'packages'], stock: ['stock', 'kvault'], contracts: ['kdeals'], alerts: ['alerts'], codes: ['dashboard'], renewal: ['packages'], summary: ['dashboard', 'stock', 'kdeals']};
    const reads = new Map();
    let dataOwner = '';
    async function read(force, topics = ['summary']) {
      if (!isOwner()) return ['owner'];
      const actor = finoCentralAdminToken;
      if (dataOwner !== actor) { data = {}; reads.clear(); dataOwner = actor; }
      const wanted = new Set(topics.flatMap(t => TOPIC_SOURCES[t] || []));
      const got = await Promise.all(SOURCES.filter(([k]) => wanted.has(k)).map(([k, fn, a]) => {
        // Share only concurrent reads in this owner session, never cache protected data.
        if (!reads.has(k)) {
          const promise = call(fn, a).then(r => [k, r]).finally(() => { if (reads.get(k) === promise) reads.delete(k); });
          reads.set(k, promise);
        }
        return reads.get(k);
      }));
      if (!isOwner() || finoCentralAdminToken !== actor || !modal) return ['session_changed'];
      const failed = []; got.forEach(([k, r]) => { if (r.ok) data[k] = r; else { delete data[k]; failed.push(k); } }); readAt = Date.now(); return failed;
    }

    function save() { try { const items = [...(list?.querySelectorAll('.f99xc-msg[data-plain]') || [])].slice(-40).map(m => ({who: m.dataset.who, text: m.dataset.plain})); sessionStorage.setItem(HKEY, JSON.stringify(items)); } catch (e) { /* ignore */ } }
    function bubble(who, text, keep = true) {
      if (!list || !isOwner()) return null;
      const m = el('div', 'f99xc-msg ' + who); const b = el('div', 'f99xc-bubble'); String(text).split('\n').forEach((line, i) => { if (i) b.append(el('br')); b.append(d.createTextNode(line)); });
      const t = el('time', '', new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute: '2-digit'})); b.append(t); m.append(b);
      if (keep) { m.dataset.who = who; m.dataset.plain = String(text).slice(0, 2000); }
      list.append(m); m.scrollIntoView({block: 'end'}); if (keep) save();
      if (who === 'bot' && speakOn && 'speechSynthesis' in w) { try { w.speechSynthesis.cancel(); const u = new w.SpeechSynthesisUtterance(String(text).replace(/\n/g, '. ').slice(0, 400)); u.lang = 'ar-SA'; w.speechSynthesis.speak(u); } catch (e) { /* text stays */ } }
      return b;
    }
    const say = t => bubble('bot', t);
    function chips(labels) { const row = el('div', 'f99xc-chips'); labels.forEach(l => btn(row, l, () => send(l))); const m = el('div', 'f99xc-msg bot'); m.append(row); list.append(m); m.scrollIntoView({block: 'end'}); }
    function go(route, key) { const r = ROUTES[route]; if (!r) return; say('أفتح لك: ' + r[0] + '.'); setTimeout(() => { closeChat(true); try { r[1](w, key); } catch (e) { /* ignore */ } }, 300); }
    function openBtn(host, route, key, label) { const r = ROUTES[route]; if (r) btn(host, label || ('افتح ' + r[0]), () => go(route, key), 'f99xc-chip'); }

    /* confirmation card: rows [label,value] and optional inputs [{key,label,value,type}] */
    function card(title, rows, inputs, onConfirm, opts) {
      opts = opts || {};
      const m = el('div', 'f99xc-msg bot'); const c = el('article', 'f99xc-card'); m.append(c);
      c.append(el('strong', '', title));
      const dl = el('dl'); rows.forEach(([k, v]) => dl.append(el('dt', '', k), el('dd', '', v))); c.append(dl);
      const fields = {};
      (inputs || []).forEach(f => { const l = el('label', 'f99xc-field'); let i;
        if (f.type === 'checks') { const box = el('div', 'f99xc-checks'); const sel = new Set(f.value || []); (f.options || []).forEach(([v, t]) => { const lb = el('label', 'f99xc-check'); const cb = el('input'); cb.type = 'checkbox'; cb.value = v; cb.checked = sel.has(v); lb.append(cb, d.createTextNode(' ' + t)); box.append(lb); }); fields[f.key] = {get value() { return [...box.querySelectorAll('input:checked')].map(x => x.value); }}; l.append(el('span', '', f.label), box); c.append(l); return; }
        if (f.type === 'textarea') { i = el('textarea'); i.rows = 5; } else if (f.type === 'select') { i = el('select'); (f.options || []).forEach(([v, t]) => i.append(new Option(t, v))); } else { i = el('input'); i.type = 'text'; if (f.numeric) i.inputMode = 'decimal'; }
        i.value = f.value ?? ''; i.setAttribute('aria-label', f.label); fields[f.key] = i; l.append(el('span', '', f.label), i); c.append(l); });
      if (opts.warn) c.append(el('p', 'f99xc-warn', opts.warn));
      c.append(el('p', 'f99xc-muted', opts.note || 'ما نفذت شيء للحين. راجع واضغط «اعتمد».'));
      const acts = el('div', 'f99xc-actions'); c.append(acts);
      const status = el('p', 'f99xc-status'); status.setAttribute('role', 'status');
      const cardActor = finoCentralAdminToken;
      const ok = btn(acts, opts.okLabel || 'اعتمد ونفّذ', async ev => {
        if (ev?.isTrusted !== true || !isOwner() || finoCentralAdminToken !== cardActor || !c.isConnected) return;
        if (ok.disabled || c.classList.contains('done') || c.classList.contains('cancelled')) return;
        ok.disabled = true; no.disabled = true; status.textContent = 'جاري التنفيذ في المركزية...';
        const vals = {}; Object.entries(fields).forEach(([k, i]) => { vals[k] = typeof i.value === 'string' ? i.value.trim() : i.value; });
        let res; try { res = await onConfirm(vals, status); } catch (e) { res = {ok: false, reason: e.message || 'ERROR'}; }
        if (pending && pending.card === c) pending = null; ctx.pending = !!pending;
        if (res && res.ok === false) { status.textContent = 'ما تم: ' + res.reason; ok.disabled = !!res.final; no.disabled = false; if (!res.final) pending = {card: c, run: opts.requireButton ? () => say('اضغط زر البطاقة بنفسك لاعتماد النسبة.') : () => ok.click(), voiceBlocked: true}; ctx.pending = !!pending; return; }
        status.textContent = res?.statusText || 'تم ✓'; c.classList.add('done');
      }, 'f99xc-chip primary');
      if (opts.disabled) ok.disabled = true;
      const no = btn(acts, 'إلغاء', () => { c.classList.add('cancelled'); ok.disabled = true; no.disabled = true; status.textContent = 'أُلغيت المسودة.'; if (pending?.card === c) pending = null; ctx.pending = !!pending; }, 'f99xc-chip');
      c.append(status); list.append(m); m.scrollIntoView({block: 'end'});
      if (!opts.disabled) { pending = {card: c, run: opts.requireButton ? () => say('اعتماد النسبة يتطلب الضغط على زر البطاقة بنفسك، وليس رسالة أو صوتًا.') : () => ok.click(), voiceBlocked: true}; ctx.pending = true; }
      return c;
    }
    function codeBlock(host, label, code, ref) {
      const row = el('div', 'f99xc-code'); row.append(el('span', '', label + ': '), el('b', '', code));
      btn(row, 'نسخ الرسالة', async ev => { const t = 'كود دخولك لعقد FINO99 (' + ref + ') بصفتك ' + label + ': ' + code + '\nادخل www.fino99.com ثم «أدخل الكود».';
        try { await navigator.clipboard.writeText(t); ev.currentTarget.textContent = 'نُسخ ✓'; } catch (e) { w.prompt?.('انسخ:', t); } }, 'f99xc-chip small'); host.append(row);
    }
    const KR = r => (w.F99KContractsReason ? w.F99KContractsReason(r) : r);

    async function template(kind) { const list2 = await (w.F99KContracts?.templates?.() || Promise.resolve([])); return list2.find(t => t.kind === kind && t.enabled) || null; }
    function partyConfig(t, settings, minutes, devices) {
      const roles = (t.roles || []).filter(r => (t.stages || []).some(s => s.role === r.role && s.enabled !== false && (!s.requires_setting || settings[s.requires_setting] === true)));
      const parties = {}; roles.forEach(r => { parties[r.role] = {valid_minutes: minutes, device_limit: devices}; }); return {roles, parties};
    }
    async function createDeal(t, title, body, terms, settings, minutes, devices) {
      const {parties} = partyConfig(t, settings, minutes, devices);
      const r = await w.F99KContracts.ocall('f99k_owner_deal_create', {p_data: {template_id: t.id, title, body, terms, settings, parties}});
      if (!r.ok) return {ok: false, reason: KR(r.reason)};
      lastDeal = r.deal_id; const b = say('تم ✓ أنشأت المعاملة ' + r.ref + '. أرسل لكل طرف كوده فقط، وأنا أتابع لك دخولهم وموافقاتهم.');
      const host = b.parentElement; const box = el('div', 'f99xc-card done'); (r.parties || []).forEach(p => codeBlock(box, p.label, p.code, r.ref));
      const acts = el('div', 'f99xc-actions'); btn(acts, 'افتح المعاملة وتابعها', () => { closeChat(true); w.F99KContracts.openOwner('deals', r.deal_id); }, 'f99xc-chip primary'); box.append(acts); host.append(box);
      box.append(el('p', 'f99xc-muted', 'المتبقي في خزنة العقود: ' + r.vault_available + '. اسألني «وش صار على العقد» في أي وقت.'));
      readAt = 0; return {ok: true};
    }
    const DUR = [['10080', 'أسبوع'], ['4320', '3 أيام'], ['1440', 'يوم'], ['720', '12 ساعة'], ['120', 'ساعتين'], ['43200', '30 يوم']];
    const DEV = [['1', 'جهاز واحد'], ['2', 'جهازين'], ['3', '3 أجهزة']];

    async function doContractFree(body) {
      const t = await template('free'); if (!t) return say('قالب العقد الحر غير مفعل. فعّله من «القوالب والمراحل».');
      card('مسودة عقد حر', [['النوع', 'عقد حر — طرف واحد'], ['طول النص', body.length + ' حرف'], ['النص يبدأ بـ', body.slice(0, 120) + (body.length > 120 ? '…' : '')]],
        [{key: 'title', label: 'عنوان العقد', value: 'عقد حر — ' + new Date().toLocaleDateString('ar-SA')}, {key: 'minutes', label: 'صلاحية الكود من أول استخدام', type: 'select', options: DUR}, {key: 'devices', label: 'عدد الأجهزة', type: 'select', options: DEV}],
        v => createDeal(t, v.title, body, {}, {...(t.settings || {})}, Number(v.minutes), Number(v.devices)), {okLabel: 'اعتمد وأصدر الكود'});
    }
    async function doDeferred(lawyer) {
      const t = await template('deferred_sale'); if (!t) return say('قالب البيع بالأجل غير مفعل.');
      const settings = {...(t.settings || {}), lawyer_enabled: !!lawyer};
      const stages = (t.stages || []).filter(s => s.enabled !== false && (!s.requires_setting || settings[s.requires_setting] === true));
      const {roles} = partyConfig(t, settings, 0, 1);
      card('مسودة عقد بيع بالأجل متعدد الأطراف', [['الأطراف', roles.map(r => r.label).join('، ')], ['المراحل بالترتيب', stages.map((s, i) => (i + 1) + '. ' + s.label).join(' ← ')], ['مرحلة المحامي', lawyer ? 'مفعلة' : 'غير مفعلة'],
        ['خيارات المشتري بعد الشراء', Object.keys(settings.post_options || {}).filter(k => settings.post_options[k] !== false).map(k => ({keep: 'الاحتفاظ', defer: 'تأجيل البيع', agent: 'توكيل'}[k] || k)).join('، ')]],
        [{key: 'title', label: 'عنوان المعاملة', value: t.name}, {key: 'minutes', label: 'صلاحية كل كود من أول استخدام', type: 'select', options: DUR}, {key: 'devices', label: 'عدد الأجهزة لكل طرف', type: 'select', options: DEV}],
        v => createDeal(t, v.title, t.body, {...(t.terms || {})}, settings, Number(v.minutes), Number(v.devices)), {okLabel: 'اعتمد وأصدر أكواد الأطراف'});
    }
    async function doFollowup(deposit) {
      const t = await template(deposit ? 'followup_deposit' : 'followup_plain'); if (!t) return say('قالب عقد المتابعة غير مفعل.');
      const terms = {...(t.terms || {})}; const inputs = [{key: 'title', label: 'عنوان المعاملة', value: t.name}];
      [['service_description', 'وصف الخدمة'], ['fees', 'الأتعاب (ريال)'], ['deposit', 'العربون (ريال)'], ['discount', 'الخصم (ريال)']].forEach(([k, l]) => { if (k in terms) inputs.push({key: 't_' + k, label: l, value: terms[k], numeric: k !== 'service_description'}); });
      inputs.push({key: 'minutes', label: 'صلاحية الكود', type: 'select', options: DUR});
      card('مسودة عقد متابعة ' + (deposit ? 'بعربون' : 'بدون عربون'), [['المراحل', (t.stages || []).filter(s => s.enabled !== false).map(s => s.label).join(' ← ')]], inputs, v => {
        const tt = {...terms}; Object.keys(v).filter(k => k.startsWith('t_')).forEach(k => { tt[k.slice(2)] = v[k]; });
        for (const k of ['fees', 'deposit', 'discount']) if (k in tt && !/^\d+(\.\d{1,2})?$/.test(String(tt[k]))) return {ok: false, reason: 'المبلغ غير صحيح: ' + k};
        return createDeal(t, v.title, t.body, tt, {...(t.settings || {})}, Number(v.minutes), 1);
      }, {okLabel: 'اعتمد وأصدر الكود'});
    }
    async function doDealStatus() {
      if (!lastDeal) { await read(true); return say(report('contracts', data)); }
      const r = await w.F99KContracts.ocall('f99k_owner_deal', {p_deal_id: lastDeal}); if (!r.ok) return say('ما قدرت أقرأ المعاملة: ' + KR(r.reason));
      const st = r.stages?.[r.current_stage]; const ev = (r.events || [])[0];
      say('المعاملة ' + r.ref + ': ' + ({active: 'جارية', completed: 'مكتملة', rejected: 'مرفوضة', cancelled: 'ملغاة'}[r.status] || r.status) + (st && r.status === 'active' ? '\nالمرحلة الحالية: ' + st.label + ' — بانتظار ' + st.role_label : '') + (ev ? '\nآخر حدث: ' + ev.action + ' — ' + new Date(ev.at).toLocaleString('ar-SA') : ''));
    }
    async function doVault(count) {
      const n = Math.round(count || 50); if (n < 1 || n > 500) return say('العدد لازم يكون بين 1 و500.');
      const v = await call('f99k_owner_vault');
      card('مسودة إصدار أكواد عقود', [['العدد', String(n)], ['المتاح حاليًا', v.ok ? String(v.available) : '—'], ['الخزنة', 'مستقلة عن أكواد الباقات والتجديد']], [{key: 'batch', label: 'اسم الدفعة (اختياري)', value: ''}],
        async val => { const r = await call('f99k_owner_vault_issue', {p_count: n, p_batch: val.batch || null}); if (!r.ok) return {ok: false, reason: KR(r.reason)}; say('تم ✓ صدر ' + r.issued + ' كود عقد. المتاح الآن ' + r.available + '.'); readAt = 0; return {ok: true}; });
    }
    function packagePick(query, then) {
      const items = products(); if (!items.length) { say('ما لقيت باقات محفوظة في المركزية.'); return; }
      const m = matchPackage(query, items);
      if (m.item) return then(m.item);
      say(m.ties.length > 1 ? 'لقيت أكثر من باقة قريبة. أي وحدة تقصد؟' : 'أي باقة تقصد؟');
      const row = el('div', 'f99xc-chips'); (m.ties.length > 1 ? m.ties : items).slice(0, 12).forEach(p => btn(row, p.name || p.key, () => then(p))); const mm = el('div', 'f99xc-msg bot'); mm.append(row); list.append(mm); mm.scrollIntoView({block: 'end'});
    }
    const human = mins => { const m = Number(mins) || 0; return m % 1440 === 0 ? (m / 1440) + ' يوم' : m % 60 === 0 ? (m / 60) + ' ساعة' : m + ' دقيقة'; };
    async function doAllocate(count, query) {
      const n = Math.round(count || 0); if (!n) return say('كم كود تبي أخصص؟ مثال: «خصص 100 كود لباقة ...».');
      packagePick(query, p => allocateFor(p, n));
    }
    function downloadSalla(batch) {
      const codes = Array.isArray(batch?.codes) ? batch.codes : []; const n = Number(batch?.count);
      if (batch?.state !== 'published' || (batch?.published !== undefined && batch.published !== true)) throw Error('الدفعة غير معتمدة في المركزية بعد.');
      if (!Number.isInteger(n) || n < 1 || n > 500 || codes.length !== n || new Set(codes).size !== n || codes.some(c => !/^[A-Z0-9-]{8,32}$/.test(c))) throw Error('عدد الأكواد غير مطابق؛ أُلغي التنزيل.');
      if (typeof w.F99V17BuildSallaXlsx !== 'function') throw Error('مُنشئ ملف سلة غير موجود.');
      const file = w.F99V17BuildSallaXlsx(codes, batch.last_day || null);
      const name = 'FINO99_' + String(batch.package_key || 'PACKAGE').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) + '_' + String(batch.allocation_id).slice(0, 8) + '_' + n + '.xlsx';
      const url = URL.createObjectURL(new Blob([file], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a = d.createElement('a'); a.href = url; a.download = name; d.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); return name;
    }
    async function sallaFile(allocationId, status) {
      const r = await call('f99v17_admin_export_batch', {p_allocation_id: allocationId}); if (!r.ok) throw Error('رفضت المركزية التصدير: ' + r.reason);
      const name = downloadSalla(r); if (status) status.textContent = 'نزل الملف: ' + name; return name;
    }
    async function allocateFor(p, count) {
      let n = Math.round(count || 0); const over = n > 500; if (over) n = 500;
      {
        if (over) say('الحد لكل دفعة 500 كود (حماية المركزية وملف سلة). أجهز لك دفعة 500 الآن، وبعدها اطلب الباقي في دفعة ثانية.');
        const pre = await call('f99v16_owner_preflight');
        const available = pre.ok ? Number(pre.available || 0) : null; const services = Array.isArray(p.services) ? p.services : [];
        const mins = Number(p.duration_minutes || 4320), cap = Number(p.max_calculations), last = String(p.key || '').includes('bronze') ? (p.redeem_last_day || null) : null;
        if (!Number.isInteger(cap) || cap < 1) { say('حدد عدد الحسبات لهذه الباقة من إدارة الباقات أولًا؛ لا أفترض عددًا من عندي.'); return; }
        const short = available !== null && available < n;
        card('مسودة تخصيص أكواد', [['الباقة', p.name || p.key], ['العدد المطلوب', String(n)], ['المخزون غير المخصص الآن', available === null ? 'تعذرت القراءة' : String(available)], ['مدة الكود', human(mins)],
          ['الحسبات لكل كود', String(cap)], ['الخدمات', services.join('، ') || 'حسب الباقة'], ['آخر يوم للاستخدام', last || 'لا يوجد']], [],
          async () => {
            const r = await call('f99v19_admin_allocate_custom', {p_package_key: p.key, p_count: n, p_duration_minutes: mins, p_services: services, p_max_calculations: cap, p_last_day: last});
            if (!r.ok) return {ok: false, reason: r.reason + ' — لا تعيد المحاولة قبل فتح قائمة الدفعات؛ ربما نجح الحجز.', final: true};
            const chk = r.allocation_id ? await call('f99v13_admin_allocation_date', {p_allocation_id: r.allocation_id}) : {ok: false};
            let fileNote = 'ملف سلة: نزّله من «الدفعات السابقة».';
            if (chk.ok && chk.state === 'published' && Number(chk.count) === n && chk.package_key === p.key) {
              try { const name = downloadSalla({...r, state: chk.state, count: n, last_day: chk.last_day || null, package_key: p.key}); fileNote = 'نزّلت لك ملف سلة: ' + name + ' (كل كود في صف مستقل).'; }
              catch (e) { try { const name = await sallaFile(r.allocation_id); fileNote = 'نزّلت لك ملف سلة: ' + name + '.'; } catch (e2) { fileNote = 'الدفعة محفوظة، لكن الملف ما نزل: ' + e2.message + ' — استخدم زر التنزيل تحت ولا تخصص دفعة بديلة.'; } }
            }
            const b = say('تم ✓ خُصصت ' + n + ' كود لباقة ' + (p.name || p.key) + (chk.ok ? ' (الحالة: ' + (chk.state === 'published' ? 'معتمدة' : chk.state) + ')' : '') + '.\n' + fileNote + '\nالتنزيل ليس رفعًا لسلة ولا بيعًا: ارفع الملف في منتج سلة نفسه وطابق العدد قبل فتح البيع.');
            const acts = el('div', 'f99xc-actions'); const st2 = el('p', 'f99xc-status');
            if (r.allocation_id) btn(acts, 'نزّل ملف سلة مرة ثانية', async () => { try { await sallaFile(r.allocation_id, st2); } catch (e) { st2.textContent = e.message; } }, 'f99xc-chip primary');
            openBtn(acts, 'inventory', p.key, 'افتح الدفعات والمخزون'); b.parentElement.append(acts, st2); readAt = 0; return {ok: true};
          }, {disabled: short, warn: short ? 'المخزون غير المخصص لا يكفي. زوّد المخزون أولًا من شاشة المخزون.' : null, okLabel: 'اعتمد التخصيص'});
        if (short) { const acts = el('div', 'f99xc-actions'); openBtn(acts, 'inventory', p.key); list.lastChild.querySelector('.f99xc-card').append(acts); }
      }
    }
    async function doRenewal(price, query) {
      packagePick(query, async p => {
        const [offers, stock] = await Promise.all([call('f99v74_owner_offers', {p_package_key: p.key}), call('f99v77_owner_stock', {p_package_key: p.key})]);
        const items = offers.ok && Array.isArray(offers.items) ? offers.items : [];
        const rows = [['الباقة', p.name || p.key], ['السعر المطلوب', price ? price + ' ريال' : 'لم يحدد'], ['العروض الحالية', String(items.length)], ['مخزون التجديد', stock.ok ? (stock.available ?? stock.ready ?? '—') + ' متاح' : 'تعذرت القراءة']];
        const m = el('div', 'f99xc-msg bot'); const c = el('article', 'f99xc-card'); m.append(c); c.append(el('strong', '', 'مسودة عرض تجديد'));
        const dl = el('dl'); rows.forEach(([k, v]) => dl.append(el('dt', '', k), el('dd', '', v))); c.append(dl);
        c.append(el('p', 'f99xc-muted', 'عرض التجديد يحتاج رابط منتج سلة ومخزون أكواد مستقل وسياسة الظهور. أفتح لك محرر هذه الباقة؛ أدخل السعر' + (price ? ' (' + price + ')' : '') + ' ورابط سلة واحفظ، والخادم يتحقق قبل النشر.'));
        const acts = el('div', 'f99xc-actions'); c.append(acts); btn(acts, 'افتح محرر عرض التجديد للباقة', () => { closeChat(true); w.FINO99V74OwnerRenewal?.(p.key); setTimeout(() => prefillPrice(price), 1500); }, 'f99xc-chip primary');
        list.append(m); m.scrollIntoView({block: 'end'});
      });
    }
    function prefillPrice(price) { if (!price) return; try { const box = d.querySelector('[id*="v76"],[id*="v74"],[class*="v76"]'); const inp = box && [...box.querySelectorAll('input')].find(i => /سعر|price/i.test((i.getAttribute('aria-label') || '') + (i.placeholder || '') + (i.id || '') + (i.closest('label')?.textContent || ''))); if (inp && !inp.value) { inp.value = String(price); inp.dispatchEvent(new Event('input', {bubbles: true})); } } catch (e) { /* manual entry stays */ } }
    async function doPackageEdit(fields, query) {
      packagePick(query, p => {
        const m = el('div', 'f99xc-msg bot'); const c = el('article', 'f99xc-card'); m.append(c); c.append(el('strong', '', 'مسودة تعديل باقة: ' + (p.name || p.key)));
        const img = p.image || p.image_url || p.cover || p.banner_image_url; if (img && /^https:\/\//.test(img)) { const i = el('img', 'f99xc-img'); i.alt = 'الصورة الحالية'; i.src = img; c.append(i); }
        const dl = el('dl'); dl.append(el('dt', '', 'الاسم الحالي'), el('dd', '', p.name || '—'), el('dt', '', 'المطلوب تعديله'), el('dd', '', (fields || []).join('، ') || 'غير محدد')); c.append(dl);
        c.append(el('p', 'f99xc-muted', 'التعديل والمعاينة والحفظ من محرر الباقة الأصلي، حتى تشوف الشكل قبل ما يظهر للعملاء. الأسعار ما تتغير إلا بحفظك.'));
        const acts = el('div', 'f99xc-actions'); c.append(acts); btn(acts, 'افتح محرر الباقة مع المعاينة', () => go('package', p.key), 'f99xc-chip primary'); list.append(m); m.scrollIntoView({block: 'end'});
      });
    }
    async function mortgageState() { const r = await call('f99m_admin_state'); return r.ok ? r.settings || {} : null; }
    let ratesUI = null;
    function rateManager() {
      const api = w.F99RateManager;
      if (!api?.create) { say('وحدة إدارة النسب غير محملة؛ لم يتغير أي إعداد.'); return null; }
      if (!ratesUI) ratesUI = api.create(w, {call, card, say});
      return ratesUI;
    }
    async function doBankRates(query) {
      if (has(query, ['جدول', 'جداول', 'تقرير', 'سجلات', 'اعرض النسب', 'ورني نسب'])) return rateManager()?.show(query || '');
      return say('لا أقترح نسبة من دون مصدر وتاريخ ونوع منتج ونسبة دقيقة، ولا أعتمدها تلقائيًا. حدّد البنك والسجل المطلوب؛ ويمكنك طلب «اعرض جدول النسب» لقراءة السجلات الحالية فقط.');
    }
    async function doBankRateSet(rate, source, query) {
      // Reparse the original sentence; never trust old allNumbers/AI rate slots.
      return rateManager()?.change(query || '');
    }

    /* ---- «سوّ لي باقة»: saved as a hidden draft (enabled:false) through the original V39 save; codes/renewal follow with their own approval ---- */
    const STORE_FALLBACK = '1525498116';
    async function storefront() { const r = await w.finoRpc('fino_public_settings', {}, 12000); const st = r?.ok ? r.data?.settings?.f99x_storefront : null; return st && Array.isArray(st.products) ? st : null; }
    async function doPackageCreate(spec) {
      const st = await storefront(); if (!st) return say('ما قدرت أقرأ المتجر من المركزية الحين. ما تغير شيء.');
      const cap = Number(w.F99CalcPolicy?.cap?.()) || 300; spec = spec || {};
      const days = spec.hours ? null : (spec.days || 3), calcs = Math.min(spec.calcs || 3, cap);
      const plan = ['1) حفظ الباقة كمسودة مخفية (لا تظهر ولا تُباع).'];
      if (spec.codes) plan.push('2) تخصيص ' + spec.codes + ' كود + ملف سلة — ببطاقة موافقة مستقلة بعد الحفظ.');
      if (spec.renewalPrice) plan.push((spec.codes ? '3' : '2') + ') عرض تجديد بـ' + spec.renewalPrice + ' ريال — يفتح محرر التجديد لإضافة رابط سلة.');
      plan.push('التصميم والصورة والأسئلة والظهور: من محرر الباقة الأصلي مع المعاينة.');
      card('مسودة باقة جديدة', [['الحالة بعد الحفظ', 'مسودة مخفية'], ['عدد الباقات الحالية', String(st.products.length)], ['الخطة', plan.join('\n')]],
        [{key: 'name', label: 'اسم الباقة', value: spec.name || ''}, {key: 'tagline', label: 'وصف مختصر (اختياري)', value: ''},
          {key: 'price', label: 'السعر (ريال)', value: spec.price ?? '', numeric: true}, {key: 'days', label: spec.hours ? 'المدة بالساعات' : 'مدة الكود بالأيام', value: spec.hours || days, numeric: true},
          {key: 'calcs', label: 'الحسبات لكل كود (الحد ' + cap + ')', value: calcs, numeric: true},
          {key: 'services', label: 'الخدمات', type: 'checks', options: PKG_SERVICES, value: spec.services && spec.services.length ? spec.services : []},
          {key: 'category', label: 'التصنيف', type: 'select', options: [['finance', 'باقات التمويل'], ['contracts', 'العقود'], ['digital', 'الخدمات الرقمية'], ['other', 'خدمات أخرى']]}],
        async v => {
          const name = String(v.name || '').trim(), price = Number(v.price), dur = Number(v.days), cl = Number(v.calcs), services = Array.isArray(v.services) ? v.services : [];
          if (name.length < 2 || name.length > 80) return {ok: false, reason: 'اكتب اسم الباقة (2 إلى 80 حرف).'};
          if (!/^\d+(\.\d{1,2})?$/.test(String(v.price)) || price > 100000) return {ok: false, reason: 'السعر غير صحيح.'};
          const minutes = spec.hours ? Math.round(dur * 60) : Math.round(dur * 1440);
          if (!Number.isFinite(minutes) || minutes < 60 || minutes > 3650 * 1440) return {ok: false, reason: 'المدة غير صحيحة.'};
          if (!Number.isInteger(cl) || cl < 1 || cl > cap) return {ok: false, reason: 'الحسبات لازم تكون بين 1 و' + cap + '.'};
          if (!services.length) return {ok: false, reason: 'اختر خدمة وحدة على الأقل.'};
          const cur = await storefront(); if (!cur) return {ok: false, reason: 'تعذرت قراءة المتجر؛ ما تغير شيء.'};
          if (cur.products.length >= 60) return {ok: false, reason: 'وصلت الحد الأقصى 60 باقة.', final: true};
          if (cur.products.some(x => norm(x.name) === norm(name))) return {ok: false, reason: 'فيه باقة بنفس الاسم. غيّر الاسم.'};
          const key = 'pkg-' + (w.crypto?.randomUUID ? w.crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
          const prod = {key, name, tagline: String(v.tagline || '').slice(0, 160), price, duration_minutes: minutes, max_calculations: cl, services, category: v.category || 'finance',
            enabled: false, catalog_visible: false, checkout_mode: 'link', url: '', salla_product_id: '', allowed_sectors: [], banks: [], restarts: 3};
          const expected = Number(cur.version || 0);
          const value = {...cur, store_id: /^[0-9]{5,20}$/.test(String(cur.store_id || '')) ? cur.store_id : STORE_FALLBACK, products: [...cur.products, prod], version: Math.max(Date.now(), expected + 1)};
          const r = await call('f99v39_admin_save_store_and_quota', {p_value: value, p_expected_version: expected});
          if (!r.ok) return {ok: false, reason: 'رفضت المركزية الحفظ: ' + r.reason};
          const chk = await storefront(); if (!chk || Number(chk.version) !== value.version || !chk.products.some(x => x.key === key)) return {ok: false, reason: 'الحفظ ما تأكد من المركزية؛ لا تعيد الإنشاء قبل فتح محرر الباقات.', final: true};
          const b = say('تم ✓ حفظت «' + name + '» كمسودة مخفية في المركزية. ما تظهر للعملاء ولا تنباع إلا لما تضيف رابط سلة وتفعّل الظهور من محرر الباقة.');
          const acts = el('div', 'f99xc-actions'); btn(acts, 'افتح محرر الباقة (التصميم والمعاينة)', () => go('package', key), 'f99xc-chip primary');
          if (!spec.codes) btn(acts, 'خصص أكواد لها', () => say('اكتب: «خصص 100 كود لباقة ' + name + '»'), 'f99xc-chip');
          b.parentElement.append(acts); readAt = 0;
          if (spec.codes) setTimeout(() => allocateFor(prod, spec.codes), 200);
          if (spec.renewalPrice) { const a2 = el('div', 'f99xc-actions'); btn(a2, 'جهّز عرض التجديد بـ' + spec.renewalPrice + ' ريال', () => { closeChat(true); w.FINO99V74OwnerRenewal?.(key); setTimeout(() => prefillPrice(spec.renewalPrice), 1500); }, 'f99xc-chip'); b.parentElement.append(a2); }
          return {ok: true};
        }, {okLabel: 'اعتمد واحفظ كمسودة', note: 'ما نفذت شيء للحين. عدّل الحقول ثم اضغط «اعتمد». الأسعار والأكواد الحالية ما تتأثر.'});
    }

    /* ---- «عدّل سياسة الحاسبة العقارية»: early-settlement policy with a worked impact example before approval ---- */
    function impactExample(s, policy) {
      const E = w.F99MEarly; if (!E?.estimate) return null;
      const bank = (Array.isArray(s.banks) ? s.banks : []).find(b => b.enabled !== false && Number(b.baseRate) > 0); if (!bank) return null;
      try {
        const months = 300, finance = 500000, rate = Number(bank.baseRate), rm = rate / 1200, pay = finance * rm / (1 - Math.pow(1 + rm, -months));
        const result = {months, finance, rate, method: 'reducing', bankPaymentPhases: [{start: 1, end: months, value: pay}]};
        return {bank: bank.name, rate, rows: [12, 24, 36, 60].map(k => [k, E.estimate(result, k, policy)])};
      } catch (e) { return null; }
    }
    const SAR = x => Math.round(Number(x) || 0).toLocaleString('ar-SA') + ' ريال';
    async function doMortgagePolicy(changes) {
      const E = w.F99MEarly; if (!E?.normalizePolicy) return say('وحدة السداد المبكر غير محملة. افتحها من «التحكم المباشر».');
      const s = await mortgageState(); if (!s) return say('ما قدرت أقرأ إعدادات العقاري من المركزية.');
      const cur = E.normalizePolicy(s.earlySettlement || {}); const next = E.normalizePolicy({...cur, ...(changes || {})});
      const L = {enabled: 'إظهار السداد المبكر للعميل', warnPaidMonths: 'التحذير قبل (شهر مدفوع)', minProfitMonths: 'حد أدنى للأرباح (شهر)', compensationProfitMonths: 'تعويض/رسوم إدارية (شهر أرباح)', fixedFee: 'رسوم ثابتة (ريال)'};
      const diff = Object.keys(L).filter(k => cur[k] !== next[k]);
      const rows = Object.keys(L).map(k => [L[k], (k === 'enabled' ? (cur[k] ? 'ظاهر' : 'مخفي') : cur[k]) + (diff.includes(k) ? ' ← ' + (k === 'enabled' ? (next[k] ? 'ظاهر' : 'مخفي') : next[k]) : '')]);
      const ex = impactExample(s, next), exOld = impactExample(s, cur);
      if (ex) rows.push(['الأثر (مثال: 500 ألف، 25 سنة، ' + ex.bank + ' ' + ex.rate + '%)', ex.rows.map(([k, r], i) => 'بعد ' + k + ' شهر: ' + SAR(r.settlementAmount) + (exOld && diff.length ? ' (كان ' + SAR(exOld.rows[i][1].settlementAmount) + ')' : '')).join('\n')]);
      card('مسودة تعديل سياسة الحاسبة العقارية (السداد المبكر)', rows,
        [{key: 'enabled', label: 'إظهار السداد المبكر للعميل', type: 'select', options: next.enabled ? [['1', 'ظاهر'], ['0', 'مخفي']] : [['0', 'مخفي'], ['1', 'ظاهر']]},
          {key: 'warnPaidMonths', label: L.warnPaidMonths, value: next.warnPaidMonths, numeric: true}, {key: 'minProfitMonths', label: L.minProfitMonths, value: next.minProfitMonths, numeric: true},
          {key: 'compensationProfitMonths', label: L.compensationProfitMonths, value: next.compensationProfitMonths, numeric: true}, {key: 'fixedFee', label: L.fixedFee, value: next.fixedFee, numeric: true}],
        async v => {
          const pol = E.normalizePolicy({...next, enabled: v.enabled === '1', warnPaidMonths: Number(v.warnPaidMonths), minProfitMonths: Number(v.minProfitMonths), compensationProfitMonths: Number(v.compensationProfitMonths), fixedFee: Number(v.fixedFee)});
          const fresh = await mortgageState(); if (!fresh || fresh.version !== s.version) return {ok: false, reason: 'تغيرت الإعدادات من مكان آخر؛ أعد الطلب.', final: true};
          const val = {...fresh, earlySettlement: pol, version: Date.now()};
          const r = await call('fino_admin_upsert_setting', {p_setting_key: 'f99m_mortgage', p_value: val}); if (!r.ok) return {ok: false, reason: 'فشل الحفظ: ' + r.reason};
          const chk = await mortgageState(); if (!chk || chk.version !== val.version) return {ok: false, reason: 'الحفظ لم يتأكد من المركزية.', final: true};
          say('تم ✓ حُدثت سياسة السداد المبكر في الحاسبة العقارية' + (pol.enabled ? ' وهي ظاهرة للعملاء.' : ' وهي مخفية عن العملاء.') + ' معادلات البنك نفسها ما تغيرت؛ هذا تقدير فوق جدول البنك.');
          return {ok: true};
        }, {okLabel: 'اعتمد السياسة', note: 'الأثر محسوب على مثال توضيحي من نسبة بنك مسجل. ما نفذت شيء قبل «اعتمد».'});
      const acts = el('div', 'f99xc-actions'); openBtn(acts, 'early', null, 'افتح محرر السداد المبكر الكامل'); openBtn(acts, 'advanced', null, 'سياسات المنتجات المتقدمة لكل بنك'); list.lastChild.querySelector('.f99xc-card')?.append(acts);
    }

    async function brain(text) {
      if (brainOff) return null;
      // The AI brain exists only on the private preview server; on the static official site it is skipped
      // so the owner token is never posted to a host that cannot verify it.
      if (!/(^|\.)manus\.space$|^127\.0\.0\.1$|^localhost$/.test(location.hostname)) { brainOff = true; return null; }
      try {
        const r = await fetch('./lab/exec/brain', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({p_token: finoCentralAdminToken, text: String(text).slice(0, 500)})});
        if (r.status === 404 || r.status === 405) { brainOff = true; return null; }
        const j = await r.json(); return j && j.ok ? j : null;
      } catch (e) { return null; }
    }

    async function handle(u, text, fromVoice) {
      switch (u.intent) {
        case 'greet': say('هلا بك. ما سؤالك أو طلبك المحدد؟'); return;
        case 'thanks': say('العفو، حاضر.'); return;
        case 'help': say('أجيب عن الاستخدام وأقرأ بيانات المنصة عند طلبها، وأعرض مسودة قبل التغيير الحساس. قراءة الصور غير متاحة في النسخة الثابتة، والفهم اللغوي العام يحتاج خادمًا موثوقًا.'); return;
        case 'question': return say(u.answer);
        case 'image': return say('قراءة الصور وفهم محتوى صورة الحسبة غير متاحين في هذه النسخة الثابتة. لا أستطيع تأكيد أي رقم منها ولن أعيد حسابها. انسخ النص أو حدّد السطر المطلوب، وسأشرح ما ترسله أو أقترح تعديلًا محددًا فقط.');
        case 'technical_edit': {
          const q = norm(u.query || text);
          const place = /نسب|بنك/.test(q) ? 'public/extensions/fino99_rate_manager.js' : /مساعد|تنفيذي/.test(q) ? 'public/extensions/fino99_executive_gateway.js' : /بطء|اداء/.test(q) ? 'public/extensions/fino99_performance.js' : 'public/index.html';
          return say('المكان المبدئي للمراجعة: ' + place + '. لا أملك وصولًا لملفات النشر من الموقع الثابت. أرسل اسم الدالة أو مقطع الكود والنتيجة المطلوبة؛ سأحدد التعديل وأعرض الفرق قبل أي تغيير حساس. لم أغيّر ملفًا أو نسبًا أو عقدًا أو مخزونًا.');
        }
        case 'confirm': if (!pending) return say('ما فيه شيء بانتظار الموافقة.'); return say('التنفيذ الحساس لا يُعتمد برسالة أو صوت. راجع التفاصيل واضغط زر الاعتماد بنفسك.');
        case 'cancel': if (pending) { pending.card.querySelector('.f99xc-actions button:last-child')?.click(); } ctx.awaiting = null; say('تمام، ألغيت.'); return;
        case 'contract_free': ctx.awaiting = 'contract_body'; say('أبشر. أرسل لي نص العقد كامل في رسالة وحدة (أقل شي 20 حرف)، وأجهز لك المسودة والكود.'); return;
        case 'contract_body': ctx.awaiting = null; return doContractFree(u.body);
        case 'contract_deferred': if (u.lawyer === undefined) { ctx.awaiting = 'lawyer'; say('تبي نضيف مرحلة المحامي/المراجع المستقل في عقد البيع بالأجل؟'); chips(['ايه مع محامي', 'لا بدون محامي']); return; } return doDeferred(u.lawyer);
        case 'lawyer': ctx.awaiting = null; return doDeferred(u.value);
        case 'contract_followup': if (u.deposit === undefined) { ctx.awaiting = 'deposit'; say('عقد المتابعة بعربون ولا بدون عربون؟'); chips(['بعربون', 'بدون عربون']); return; } return doFollowup(u.deposit);
        case 'deposit': ctx.awaiting = null; return doFollowup(u.value);
        case 'vault_issue': return doVault(u.count);
        case 'allocate': return doAllocate(u.count, u.query || text);
        case 'renewal_offer': return doRenewal(u.price, u.query || text);
        case 'package_edit': return doPackageEdit(u.fields, u.query || text);
        case 'package_create': return doPackageCreate(u.spec || parsePackageSpec(text));
        case 'mortgage_policy': return doMortgagePolicy(u.changes || parseEarlyPolicy(text));
        case 'bank_rates': return doBankRates(u.query || text);
        case 'bank_rate_set': return doBankRateSet(u.rate, u.source, u.query || text);
        case 'bank_rate_history': return rateManager()?.history();
        case 'open': return go(u.route);
        case 'report': {
          if ((u.topics || []).length === 1 && u.topics[0] === 'contracts' && lastDeal && has(text, ['وش صار', 'وين وصل'])) return doDealStatus();
          const failed = await read(true, u.topics || ['summary']); if (!modal || failed.includes('session_changed')) return;
          const parts = (u.topics || ['summary']).map(t => report(t, data));
          say(parts.join('\n\n') + (failed.length ? '\n(تعذرت قراءة: ' + failed.join('، ') + ')' : ''));
          const acts = el('div', 'f99xc-actions'); (u.topics || []).forEach(t => { const r = {stock: 'inventory', contracts: 'contracts', renewal: 'renewal', alerts: null, codes: 'code', sales: 'renewal'}[t]; if (r) openBtn(acts, r); });
          if (acts.childElementCount) list.lastChild.querySelector('.f99xc-bubble').append(acts); drawPulse(); return;
        }
        default: {
          const b = await brain(text);
          if (b && b.intent && b.intent !== 'unknown' && b.intent !== 'chat') return handle({...b.slots, intent: b.intent, query: text}, text, fromVoice);
          if (b && b.reply) return say(String(b.reply).slice(0, 300));
          say('لم أستطع فهم هذا السؤال بثقة. النسخة الثابتة تعتمد على أوامر محلية وليست مساعدًا عامًا متصلًا بالذكاء الاصطناعي. حدّد المطلوب أو أرسل النص الذي تريد شرحه.');
        }
      }
    }

    async function send(text, fromVoice) {
      const t = String(text || '').trim().slice(0, 4000); if (!t || !modal || !isOwner()) return;
      bubble('me', t); if (input) input.value = '';
      const u = understand(t, {awaiting: ctx.awaiting, pending: !!pending});
      const typing = el('div', 'f99xc-msg bot typing'); typing.append(el('div', 'f99xc-bubble', '…')); list.append(typing);
      try { await handle(u, t, fromVoice); } catch (e) { say('صار خطأ أثناء التنفيذ. ما تغير شيء غير المؤكد أعلاه.'); }
      typing.remove();
    }

    let pulse = null;
    function drawPulse() {
      if (!pulse) return; pulse.replaceChildren();
      const s = data.dashboard?.summary || {};
      const k = (l, v) => { const c = el('span', 'f99xc-kpi'); c.append(el('small', '', l), el('b', '', v === undefined || v === null ? '—' : String(v))); pulse.append(c); };
      k('أكواد نشطة', s.codes_active); k('المخزون المتاح', data.stock?.available); k('عقود جارية', data.kdeals?.counts?.active); k('بانتظارك', Array.isArray(data.kdeals?.items) ? data.kdeals.items.filter(x => x.owner_turn).length : null);
      k('خزنة العقود', data.kvault?.available); k('تنبيهات', Array.isArray(data.alerts?.items) ? data.alerts.items.length : null);
    }

    function closeChat(keepHistory) { stopVoice(); if (modal) modal.remove(); modal = null; list = null; pending = null; ctx = {}; if (!keepHistory) { /* history kept in this tab by design */ } }
    function stopVoice() { try { recognizer?.abort?.(); } catch (e) { /* ignore */ } recognizer = null; try { w.speechSynthesis?.cancel?.(); } catch (e) { /* ignore */ } }

    async function open() {
      if (!isOwner()) { w.alert?.('سجّل دخول المالك أولًا.'); return; }
      closeChat(true);
      modal = el('div', 'f99xc-shade'); modal.id = 'f99xg-gateway'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'المدير التنفيذي الذكي');
      const box = el('main', 'f99xc-app'); modal.append(box);
      const head = el('header', 'f99xc-head'); const av = el('span', 'f99xc-avatar', 'م'); const ti = el('div'); ti.append(el('b', '', 'المدير التنفيذي الذكي'), el('small', 'f99xc-online', 'متصل بالمركزية • للمالك فقط'));
      const tools = el('div', 'f99xc-tools'); head.append(av, ti, tools); box.append(head);
      const sp = el('button', 'f99xc-icon', '🔈'); sp.type = 'button'; sp.title = 'قراءة الردود صوتيًا'; sp.setAttribute('aria-pressed', 'false'); sp.onclick = () => { speakOn = !speakOn; sp.textContent = speakOn ? '🔊' : '🔈'; sp.setAttribute('aria-pressed', String(speakOn)); if (!speakOn) try { w.speechSynthesis?.cancel(); } catch (e) { /* ignore */ } }; tools.append(sp);
      btn(tools, 'مسح', () => { try { sessionStorage.removeItem(HKEY); } catch (e) { /* ignore */ } list.replaceChildren(); greet(); }, 'f99xc-icon');
      btn(tools, '✕', () => closeChat(true), 'f99xc-icon');
      pulse = el('section', 'f99xc-pulse'); pulse.setAttribute('aria-label', 'نبض المنصة'); box.append(pulse);
      list = el('div', 'f99xc-list'); list.setAttribute('role', 'log'); list.setAttribute('aria-live', 'polite'); box.append(list);
      const form = el('form', 'f99xc-compose');
      input = el('textarea'); input.rows = 1; input.maxLength = 4000; input.placeholder = 'اكتب أمرك بالعامية…'; input.setAttribute('aria-label', 'رسالة للمدير التنفيذي');
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } });
      const mic = el('button', 'f99xc-mic', '🎤'); mic.type = 'button'; mic.setAttribute('aria-label', 'تحدث'); mic.setAttribute('aria-pressed', 'false');
      const go2 = el('button', 'f99xc-send', 'إرسال'); go2.type = 'submit';
      form.append(mic, input, go2); box.append(form);
      form.onsubmit = e => { e.preventDefault(); void send(input.value); };
      mic.onclick = () => {
        if (recognizer) { stopVoice(); mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); return; }
        const SR = w.SpeechRecognition || w.webkitSpeechRecognition; if (!SR) return say('المتصفح هذا ما يدعم التعرف على الصوت. اكتب أمرك.');
        try { recognizer = new SR(); recognizer.lang = 'ar-SA'; recognizer.interimResults = false; recognizer.maxAlternatives = 1; recognizer.continuous = false;
          recognizer.onresult = e => { const t = String(e.results?.[0]?.[0]?.transcript || '').slice(0, 500); if (t) void send(t, true); };
          recognizer.onerror = () => say('ما اكتمل الاستماع (رفض الإذن أو ما فيه صوت). تقدر تكتب.');
          recognizer.onend = () => { recognizer = null; mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); };
          recognizer.start(); mic.classList.add('on'); mic.setAttribute('aria-pressed', 'true');
        } catch (e) { recognizer = null; say('تعذر تشغيل الميكروفون. اكتب أمرك.'); }
      };
      modal.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(true); });
      d.body.append(modal);
      let restored = []; try { restored = JSON.parse(sessionStorage.getItem(HKEY) || '[]'); } catch (e) { restored = []; }
      restored.forEach(m => bubble(m.who === 'me' ? 'me' : 'bot', m.text, true));
      if (!restored.length) greet();
      input.focus?.();
      // No unsolicited dashboard/report reads. Only the requested topic is fetched.
    }
    function greet() { say('هلا بك. أجيب باختصار بحسب طلبك، ولا أنفذ تغييرًا حساسًا دون مراجعتك واعتمادك. قراءة الصور غير متاحة في النسخة الثابتة.'); }

    return {open, close: () => closeChat(true), send};
  }

  const api = {understand, parseNumber, matchPackage, priorities, report, norm, parsePackageSpec, parseEarlyPolicy, isPkgCreate, install: null};
  api.install = w => { const ui = install(w); api.open = ui.open; api.close = ui.close; api.send = ui.send; };
  return api;
});
