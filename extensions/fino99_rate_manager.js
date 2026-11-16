/* FINO99 guarded owner rate manager. Additive; no invented rate math; no automatic approvals. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.F99RateManager = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
  function normalize(s) {
    return String(s || '').toLowerCase().replace(/[٠-٩]/g, d => DIGITS.indexOf(d))
      .replace(/[۰-۹]/g, d => PERSIAN.indexOf(d)).replace(/٫/g, '.').replace(/٪/g, '%')
      .replace(/٬/g, '').replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  }
  const SECTORS = {general: 'عام / حكومي', military: 'عسكري', private: 'قطاع خاص', retired: 'متقاعد', semiGovernment: 'شبه حكومي'};
  function parse(input) {
    const full = normalize(input);
    const n = full.split(/(?:المصدر|مصدر|source)\s*[:：]?/i)[0];
    const out = {query: String(input || ''), finance_type: null, metric: 'annual_profit_margin', old_rate: null, new_rate: null,
      segment: null, salary: null, term_months: null, product: null, source: '', errors: []};
    const src = String(input || '').split(/المصدر|مصدر|source/i); if (src.length > 1) out.source = src.slice(1).join(' ').trim().slice(0, 300);
    const personal = /شخصي|personal/.test(n), mortgage = /عقاري|عقار|رهن|mortgage/.test(n);
    if (personal && mortgage) out.errors.push('AMBIGUOUS_FINANCE_TYPE');
    else out.finance_type = mortgage ? 'mortgage' : personal ? 'personal' : null;
    if (/(?:^|\W)apr(?=\W|\d|$)|معدل (?:النسبه )?السنوي|annual percentage|التكلفه السنوي/.test(n)) out.metric = 'APR';
    if (/شبه حكومي|semi.?government/.test(n)) out.segment = 'semiGovernment';
    else if (/عسكري|military/.test(n)) out.segment = 'military';
    else if (/قطاع خاص|الخاص|private/.test(n)) out.segment = 'private';
    else if (/متقاعد|retired/.test(n)) out.segment = 'retired';
    else if (/حكومي|عام|general|government/.test(n)) out.segment = 'general';
    const salary = n.match(/(?:راتب(?:ه)?|salary)\s*[:=]?\s*(\d+(?:\.\d+)?)/); if (salary) out.salary = Number(salary[1]);
    // Tenure is a scope, NEVER a percentage candidate.
    const term = n.match(/(?:مده\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(سنوات|سنه|عاما|اعوام|years?|اشهر|شهور|شهر|months?)/);
    if (term) out.term_months = Number(term[1]) * (/سن|عام|year/.test(term[2]) ? 12 : 1);
    else if (/خمس سنوات|خمسه سنوات/.test(n)) out.term_months = 60;
    else if (/سنتين/.test(n)) out.term_months = 24;
    else if (/لمده|لمدة|مده|tenure|term/.test(n)) { out.term_months = 'unspecified'; }
    // Narrow product requests cannot be applied to shared rows.
    if (/شراء مديوني|تحويل مديوني|buyout/.test(n)) out.product = 'buyout';
    else if (/حاسبه ذكي|الحاسبه الذكي|smart/.test(n)) out.product = 'smart';
    else if (/مقارن|compare/.test(n)) out.product = 'compare';
    else if (/بناء ذاتي|خارطه|نقل تمويل|منتج|product/.test(n)) out.product = 'specific_product';
    const pair = n.match(/(?:\bfrom\b|\bold\b|من)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:الي|الى|لـ?|→|->|\bto\b|\bnew\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/i);
    if (pair) { out.old_rate = Number(pair[1]); out.new_rate = Number(pair[2]); }
    else {
      const old = n.match(/\bold\s*[:=]?\s*(\d+(?:\.\d+)?)/), fresh = n.match(/\bnew\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      if (old) out.old_rate = Number(old[1]);
      if (fresh) out.new_rate = Number(fresh[1]);
      else {
        const masked = n.replace(/(?:راتب(?:ه)?|salary)\s*[:=]?\s*\d+(?:\.\d+)?/g, '')
          .replace(/\d+(?:\.\d+)?\s*(سنوات|سنه|عاما|اعوام|years?|اشهر|شهور|شهر|months?)/g, '')
          .replace(/\d{4}[\/-]\d{1,2}(?:[\/-]\d{1,2})?/g, '');
        const percentages = [...masked.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
        if (percentages.length === 1) out.new_rate = percentages[0];
        else if (percentages.length > 1) out.errors.push('AMBIGUOUS_RATE');
        else {
          const labeled = [...masked.matchAll(/(?:نسبه|هامش(?: الربح)?|rate|صارت|صار|اجعلها|خليها|الي|الى)\s*(?:الجديده|الجديد|السنوي|الجديده هي|هي|الى|الي)?\s*[:=]?\s*(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]));
          if (labeled.length === 1) out.new_rate = labeled[0];
          else if (labeled.length > 1) out.errors.push('AMBIGUOUS_RATE');
          else {
            const remaining = (masked.match(/\d+(?:\.\d+)?/g) || []).map(Number);
            if (remaining.length === 1) out.new_rate = remaining[0];
            else if (remaining.length > 1) out.errors.push('AMBIGUOUS_RATE');
          }
        }
      }
    }
    if (out.metric === 'APR') out.errors.push('APR_NOT_RATE');
    if (out.term_months !== null || out.product) out.errors.push('UNSUPPORTED_SCOPE');
    if (out.new_rate !== null && (!(out.new_rate > 0) || out.new_rate > 30)) out.errors.push('INVALID_RATE');
    return out;
  }
  const BANK_ALIASES = {SNB: ['الاهلي', 'اهلي', 'snb'], RAJHI: ['الراجحي', 'راجحي', 'alrajhi'], RIYAD: ['الرياض', 'riyad'],
    ALINMA: ['الانماء', 'انماء', 'alinma'], JAZIRA: ['الجزيره', 'jazira'], SAB: ['ساب', 'الاول', 'sab', 'sabb'], SABB: ['sabb'], ANB: ['العربي', 'anb']};
  function candidates(spec, records) {
    let rows = records.filter(r => (!spec.finance_type || r.locator.finance_type === spec.finance_type)
      && (!spec.segment || r.locator.segment === spec.segment)
      && (spec.salary === null || (r.locator.finance_type === 'personal' && spec.salary >= Number(r.scope.salary_min)
        && (r.scope.salary_max == null || spec.salary <= Number(r.scope.salary_max))))
      && (spec.old_rate === null || Number(r.rate) === spec.old_rate));
    const n = normalize(spec.query.split(/المصدر|مصدر|source/i)[0]);
    const banks = [...new Map(records.map(r => [r.locator.bank_id, r])).values()];
    const named = banks.filter(r => {
      const id = r.locator.bank_id;
      const aliases = [normalize(id), normalize(r.bank_name), ...(BANK_ALIASES[id] || []).map(normalize)];
      return aliases.some(a => a && (a.includes(' ') ? n.includes(a) : new RegExp('(^|[\\s:،])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s:،])').test(n)));
    });
    if (named.length) { const ids = new Set(named.map(r => r.locator.bank_id)); rows = rows.filter(r => ids.has(r.locator.bank_id)); }
    // An explicit unknown bank must not broaden into every registered bank.
    else if (/(?:بنك|البنك)\s+\S+|\bbank\s+\S+/.test(n) && !/نسب (?:البنوك|بنوك)/.test(n)) return [];
    return rows;
  }
  function scopeRows(r) {
    const s = r.scope || {}, l = r.locator || {};
    return [['المصدر الفعلي', r.setting_key], ['نوع التمويل', l.finance_type === 'personal' ? 'شخصي' : 'عقاري'],
      ['البنك', r.bank_name || l.bank_id], ...(l.finance_type === 'personal' ? [
        ['السجل المحدد', (SECTORS[l.segment] || l.segment) + ' / راتب ' + s.salary_min + '–' + (s.salary_max == null ? 'بلا حد أعلى' : s.salary_max)],
        ['مسارات جدول السعر (الأهلية لم تتغير)', (s.effective_types || []).join('، ') || 'السجل غير مستخدم حاليًا']
      ] : []), ['المدد المسجلة', 'كل المدد المعتمدة؛ لا عمود مدة مستقل'],
      ['المنتجات المسجلة', l.finance_type === 'personal' ? 'سجل أساس مشترك — لا فصل بين الذكي والمقارنة وشراء المديونية' : 'نسبة أساس عقاري؛ التجاوزات الخاصة بالمنتجات لا تتغير'],
      ['الحاسبات المتأثرة', (s.calculators || []).join('، ')], ['المقياس', 'هامش الربح السنوي (%) — ليس APR']];
  }
  const REASONS = {UNSUPPORTED_SCOPE: 'لا يوجد سجل مستقل لهذه المدة/المنتج. لم يتغير شيء. يلزم طلب جديد يصرّح بنطاق السجل المشترك، لا تطبيق هذا الطلب على كل المدد.',
    APR_NOT_RATE: 'APR ليس هامش الربح السنوي. هذا المسار لا يكتب APR في rate أو baseRate.',
    STALE_PREVIEW: 'تغيرت إعدادات المصدر بعد المعاينة. اطلب معاينة جديدة؛ لم أكتب التغيير.',
    STALE_CATALOG: 'تغير المصدر بعد قراءة السجلات. أعد الطلب.', OWNER_METADATA_REQUIRED: 'أدخل المصدر والتاريخ والحالة بصفتها بيانات يحددها المالك.',
    OLD_RATE_MISMATCH: 'النسبة القديمة في الطلب لا تطابق السجل.', AMBIGUOUS_RATE: 'النسبة الجديدة غير واضحة. اكتب «من 2.99 إلى 2.75».',
    AMBIGUOUS_FINANCE_TYPE: 'حدد تمويلًا شخصيًا أو عقاريًا، وليس الاثنين في طلب واحد.'};
  const reason = r => REASONS[r] || r || 'تعذرت العملية';
  function create(w, io) {
    const rpc = (action, data) => io.call('f99r9_owner', {p_action: action, p_data: data || {}});
    function metadataFields(source) { return [{key: 'source', label: 'المصدر الذي يحدده المالك (ليس تحققًا آليًا)', value: source || ''},
      {key: 'date', label: 'تاريخ المصدر الذي يحدده المالك YYYY-MM-DD', value: ''},
      {key: 'status', label: 'الحالة التي يحددها المالك', type: 'select', options: [['', 'اختر الحالة'], ['owner_set', 'محدد من المالك'], ['owner_unverified', 'غير متحقق — حسب المالك'], ['owner_stale', 'قديم — حسب المالك']]}]; }
    function metadata(v) { return {source: v.source, date: v.date, status: v.status}; }
    async function catalog(type) {
      const rows = []; let offset = 0;
      // Every read is paged, bounded and owner-guarded. Never silently use a truncated catalog.
      for (let page = 0; page < 100; page++) {
        const r = await rpc('catalog', {finance_type: type || '', limit: 100, offset});
        if (!r.ok) throw Error(reason(r.reason));
        rows.push(...(r.items || []));
        if (r.next_offset == null) return rows;
        offset = r.next_offset;
      }
      throw Error('CATALOG_TOO_LARGE: ضيّق النطاق');
    }
    async function show(query) {
      const spec = parse(query || ''), records = await catalog(spec.finance_type);
      io.say('السجلات الفعلية من المركزية (المصدر/التاريخ/الحالة لا تصبح تحققًا مصرفيًا تلقائيًا). هامش الربح السنوي وليس APR.');
      const rows = candidates({...spec, old_rate: null}, records);
      if (!rows.length) return io.say('لا يوجد سجل مطابق للنطاق المطلوب.');
      io.card('سجلات النسب — قراءة فقط', rows.slice(0, 60).map(r => [
        r.bank_name + ' / ' + (r.locator.finance_type === 'personal' ? (SECTORS[r.locator.segment] || '') + ' ' + r.scope.salary_min + '–' + (r.scope.salary_max ?? '∞') : 'عقاري أساس'),
        r.rate + '% — ' + (r.metadata.source || 'لم يحدد المالك المصدر') + ' / ' + (r.metadata.date || 'بلا تاريخ') + ' / ' + r.metadata.status
      ]), [], async () => ({ok: false, reason: 'قراءة فقط', final: true}), {disabled: true,
        note: (rows.length > 60 ? 'أول 60 سجلًا؛ ضيّق البنك/القطاع للعرض. ' : '') + 'سجلات الشخصي مشتركة لكل المدد والذكي والمقارنة وشراء المديونية. لتعديل: «عدل هامش التمويل الشخصي الأهلي من 2.99 إلى 2.75» ثم اختر السجل الناقص.'});
    }
    let refreshSerial = 0;
    async function freshVerify(committed) {
      const seq = ++refreshSerial;
      // Integrated performance invalidation fences pre-write public and V32 snapshots.
      // Optional index fence supports any legacy transport outside that layer.
      if (typeof w.F99ApplyConfirmedFinanceConfig !== 'function'
        || typeof w.F99VerifyConfirmedRate !== 'function') return {ok: false, reason: 'INDEX_RATE_HOOKS_MISSING'};
      const hasPerformanceFence = typeof w.F99Performance?.freshRpc === 'function' && typeof w.F99Performance?.invalidate === 'function';
      if (!hasPerformanceFence && (typeof w.F99BeginFinanceConfigRefresh !== 'function' || typeof w.F99EndFinanceConfigRefresh !== 'function')) {
        return {ok: false, reason: 'FRESHNESS_FENCE_MISSING'};
      }
      const fence = w.F99BeginFinanceConfigRefresh?.();
      try {
        w.F99Performance?.invalidate?.('fino_public_settings');
        let pub;
        if (committed.setting_key === 'f99m_mortgage') {
          // Mortgage source is NOT public: use the existing guarded owner transport.
          const owner = await io.call('f99m_admin_state', {});
          pub = owner?.ok && owner.settings ? {ok: true, data: {settings: {f99m_mortgage: owner.settings}}} : {ok: false};
        } else {
          pub = typeof w.F99Performance?.freshRpc === 'function'
            ? await w.F99Performance.freshRpc('fino_public_settings', {}, 12000)
            : await w.finoRpc('fino_public_settings', {}, 12000);
        }
        if (!pub?.ok || pub.data?.ok === false || seq !== refreshSerial) return {ok: false, reason: 'PUBLIC_REFRESH_FAILED'};
        const settings = pub.data?.settings;
        const cfg = settings?.[committed.setting_key];
        if (!cfg) return {ok: false, reason: 'PUBLIC_SOURCE_MISSING'};
        const l = committed.locator;
        const row = l.finance_type === 'personal' ? cfg.banks?.[l.bank_id]?.tables?.[l.segment]?.[l.row_index] : cfg.banks?.[l.row_index];
        const actual = l.finance_type === 'personal' ? row?.rate : row?.baseRate;
        if (l.finance_type === 'mortgage' && row?.key !== l.bank_id) return {ok: false, reason: 'PUBLIC_LOCATOR_MISMATCH'};
        if (Number(actual) !== Number(committed.new_rate)) return {ok: false, reason: 'PUBLIC_RATE_MISMATCH'};
        const applied = await w.F99ApplyConfirmedFinanceConfig(cfg, {setting_key: committed.setting_key, fence});
        if (applied?.ok === false || applied === false) return {ok: false, reason: 'LOCAL_APPLY_FAILED'};
        const checked = await w.F99VerifyConfirmedRate(committed, cfg);
        if (checked?.ok !== true) return {ok: false, reason: checked?.reason || 'ORIGINAL_CALCULATOR_NOT_VERIFIED'};
        return {ok: true, verification: checked};
      } catch (e) { return {ok: false, reason: 'PUBLIC_OR_CALCULATOR_REFRESH_FAILED'}; }
      finally { w.F99EndFinanceConfigRefresh?.(fence); }
    }
    function approve(preview) {
      const r = preview.record;
      io.card(preview.restore_of ? 'معاينة استعادة — عملية عكسية جديدة' : 'معاينة الخادم — لم تُعتمد بعد', [...scopeRows(r),
        ['النسبة القديمة', preview.old_rate + '%'], ['النسبة الجديدة', preview.new_rate + '%'],
        ['مصدر يحدده المالك', preview.after_metadata.source], ['تاريخ يحدده المالك', preview.after_metadata.date],
        ['حالة يحددها المالك', preview.after_metadata.status], ['صلاحية المعاينة', preview.expires_at]], [], async () => {
        const committed = await rpc('commit', {pending_id: preview.pending_id, approved: true});
        if (!committed.ok) return {ok: false, reason: committed.reason === 'TRANSPORT'
          ? 'لم يتأكد رد الاعتماد؛ قد يكون محفوظًا. أعد هذا الزر بنفس المعاينة فقط، ولا تنشئ تغييرًا بديلًا. الخادم يمنع تكرار العملية.'
          : reason(committed.reason), final: committed.reason !== 'TRANSPORT'};
        const verify = await freshVerify(committed);
        if (!verify.ok) {
          io.say('حُفظت العملية في المركزية وسجل التدقيق، لكن لم أتأكد من قراءة المصدر الفعلي والحاسبة الأصلية. لا تعيد الاعتماد ولا تنشئ تغييرًا بديلًا. رقم التدقيق: ' + committed.audit_id);
          io.card('إعادة التحقق فقط — لا كتابة ثانية', [['رقم التدقيق', committed.audit_id]], [], async () => {
            const retry = await freshVerify(committed);
            if (!retry.ok) return {ok: false, reason: reason(retry.reason)};
            io.say('تم التحقق: المصدر الفعلي والحاسبة الأصلية يستخدمان ' + committed.new_rate + '%.'); return {ok: true};
          }, {okLabel: 'أعد قراءة المصدر وتحقق', note: 'هذا الزر لا يغير أي سجل.'});
          return {ok: false, reason: reason(verify.reason), final: true};
        }
        io.say('تم ✓ اعتمدت ' + r.bank_name + ' ' + committed.new_rate + '%، وأكدت قراءة المصدر والحاسبة الأصلية. النطاق: ' +
          (r.locator.finance_type === 'personal' ? (SECTORS[r.locator.segment] || '') + ' / راتب ' + r.scope.salary_min + '–' + (r.scope.salary_max ?? 'بلا حد أعلى') + '، كل المدد المعتمدة والسجل المشترك' : 'نسبة أساس عقاري مشتركة') +
          '. المصدر والتاريخ والحالة محددة من المالك وليست تحققًا مصرفيًا آليًا. التدقيق: ' + committed.audit_id);
        return {ok: true};
      }, {okLabel: 'اعتمد هذا السجل فقط', requireButton: true,
        note: 'هذه معاينة الخادم. الموافقة منفصلة بالضغط فقط، لا بالصوت أو رسالة «اعتمد». كل القيم الأخرى محفوظة. لا ادعاء بنشر البنك أو التحقق منه.'});
    }
    function draft(spec, records) {
      const selected = records.length === 1 ? records[0] : null;
      const fields = [...(!selected ? [{key: 'target', label: 'اختر السجل الناقص فقط (لا توجد مدة/منتج مستقل)', type: 'select',
        options: [['', 'اختر السجل'], ...records.map((r, i) => [String(i), r.bank_name + ' / ' + (r.locator.finance_type === 'personal' ? 'شخصي ' + (SECTORS[r.locator.segment] || '') + ' راتب ' + r.scope.salary_min + '–' + (r.scope.salary_max ?? '∞') : 'عقاري أساس') + ' / ' + r.rate + '%'])]}] : []),
        ...(spec.new_rate === null ? [{key: 'new_rate', label: 'هامش الربح السنوي الجديد (%) — ليس APR', value: '', numeric: true}] : []), ...metadataFields(spec.source)];
      io.card('استكمال بيانات معاينة النسبة', [...(selected ? scopeRows(selected) : [['الهدف', 'حدد البنك/القطاع/شريحة الراتب الناقصة من السجلات المطابقة فقط']]), ['النسبة الجديدة', spec.new_rate === null ? 'لم تحدد' : spec.new_rate + '%']],
        fields, async v => {
          const r = selected || (v.target !== '' ? records[Number(v.target)] : null);
          if (!r) return {ok: false, reason: 'اختر سجلًا محددًا.'};
          const rawRate = spec.new_rate === null ? normalize(v.new_rate) : String(spec.new_rate);
          if (!/^\d+(?:\.\d+)?%?$/.test(rawRate)) return {ok: false, reason: 'أدخل نسبة جديدة صحيحة.'};
          const newRate = Number(rawRate.replace('%', ''));
          const preview = await rpc('preview', {locator: r.locator, fingerprint: r.fingerprint, old_rate: spec.old_rate, new_rate: newRate,
            metric: spec.metric, requested_scope: {finance_type: r.locator.finance_type, metric: spec.metric,
              ...(spec.segment ? {segment: spec.segment} : {}), ...(spec.salary !== null ? {salary: spec.salary} : {})}, metadata: metadata(v)});
          if (!preview.ok) return {ok: false, reason: reason(preview.reason), final: /STALE/.test(preview.reason || '')};
          approve(preview); return {ok: true, statusText: 'المعاينة جاهزة؛ لم يتم حفظ نسبة بعد.'};
        }, {okLabel: 'اعرض معاينة الخادم فقط', note: 'هذه الخطوة تسجل معاينة مؤقتة فقط، لا تغير نسبة. المصدر/التاريخ/الحالة تدخلها أنت، ولا يتم ملؤها كتحقق تلقائي.'});
    }
    async function change(input) {
      const spec = parse(typeof input === 'string' ? input : input?.query || '');
      if (spec.errors.length) return io.say(reason(spec.errors[0]));
      const records = candidates(spec, await catalog(spec.finance_type));
      if (!records.length) return io.say('لا يوجد سجل مطابق للبنك/نوع التمويل/القطاع/الراتب/النسبة القديمة. لم أوسع النطاق ولم يتغير شيء؛ وضح الهدف.');
      if (records.length > 300) return io.say('حدد البنك أو القطاع أولًا؛ لا أختار نطاقًا واسعًا بدلًا منك.');
      return draft(spec, records);
    }
    async function history(offset) {
      const r = await rpc('history', {offset: offset || 0, limit: 30});
      if (!r.ok) return io.say(reason(r.reason));
      if (!r.items?.length) return io.say('لا توجد عمليات نسب مسجلة في هذه الصفحة.');
      io.card('سجل النسب — الاستعادة لا تحذف التدقيق', r.items.map(a => [a.audit_id,
        a.locator.bank_id + ' / ' + (a.locator.segment || 'عقاري') + ': ' + a.old_rate + '% → ' + a.new_rate + '% / ' + a.created_at]),
      [{key: 'audit_id', label: 'عملية الاستعادة (اختيارية)', type: 'select', options: [['', 'لا استعادة'], ...r.items.map(a => [a.audit_id, a.locator.bank_id + ' ' + a.old_rate + ' → ' + a.new_rate])]}, ...metadataFields('')], async v => {
        if (!v.audit_id) return {ok: false, reason: 'اختر عملية لاستعادة معكوسها أو ألغ.'};
        const p = await rpc('restore', {audit_id: v.audit_id, approved: true, metadata: metadata(v)});
        if (!p.ok) return {ok: false, reason: reason(p.reason)};
        approve(p); return {ok: true, statusText: 'معاينة الاستعادة جاهزة؛ لم تحفظ نسبة بعد.'};
      }, {okLabel: 'جهز استعادة معكوسة للمراجعة', requireButton: true, note: 'الاستعادة معاينة جديدة ثم موافقة منفصلة؛ لا تمحو السجلات القديمة.'});
      if (r.next_offset != null) io.card('المزيد من سجل النسب', [], [], async () => { await history(r.next_offset); return {ok: true}; }, {okLabel: 'الصفحة التالية', note: 'قراءة فقط.'});
    }
    return {show, change, history, freshVerify};
  }
  return {parse, normalize, candidates, scopeRows, create};
});
