/* FINO99 R22 H: date grid only. Availability and all mutations stay server-authoritative. */
(function (w) {
  'use strict';
  const texts = [
    ['appointment22.calendar_title', 'التقويم المتاح — توقيت الرياض'],
    ['appointment22.previous', 'الشهر السابق'], ['appointment22.next', 'الشهر التالي'],
    ['appointment22.choose_day', 'اختر يومًا لعرض الأوقات المتاحة من المركزية.'],
    ['appointment22.policy_denied', 'لا تسمح سياسة المالك بهذه العملية.'],
    ['appointment22.postpone', 'تأجيل الموعد وفق سياسة المالك'],
    ['appointment22.apologize', 'الاعتذار عن الموعد وفق سياسة المالك'],
    ['appointment22.consent_time', 'وقت الموافقة: {time}'],
    ['appointment22.booked_time', 'وقت الحجز: {time}'],
    ['appointment22.timeline', 'سجل حالات الحجز'],
    ['appointment22.timeline_event', '{status} — {time}'],
    ['appointment22.apology_confirm', 'تأكيد الاعتذار وإلغاء هذا الموعد وفق سياسة المالك؟'],
    ['appointment22.apology_title', 'الاعتذار عن الموعد'],
    ['appointment22.permission_note', 'التعديل والإلغاء والتأجيل والاعتذار حسب سياسة المالك والمهلة المركزية.'],
    ['appointment22.duplicate', 'لديك حجز لهذا الوقت بالفعل. حدّث حجوزاتك بدلًا من تكرار الحجز.']
  ];
  w.F99Texts?.register(texts.map(([key, text]) => ({key, category: 'المواعيد', label: text.split(' {')[0], text,
    vars: [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1])})));
  function t(key, vars = {}) {
    const fallback = texts.find(x => x[0] === key)?.[1] || key;
    return typeof w.F99T === 'function' ? w.F99T(key, vars, fallback) : fallback.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  function addMonths(day, n) {
    const [y, m, d] = day.split('-').map(Number), date = new Date(Date.UTC(y, m - 1 + n, 1, 12));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(d, last)); return date.toISOString().slice(0, 10);
  }
  function create(host, options = {}) {
    const doc = host.ownerDocument, wrap = doc.createElement('section'); wrap.className = 'f99a22-calendar';
    wrap.setAttribute('aria-label', t('appointment22.calendar_title')); host.append(wrap);
    let selected = options.selected || '', month = (selected || options.from || new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Riyadh'}).format(new Date())).slice(0, 7) + '-01';
    function node(tag, value, cls) { const e = doc.createElement(tag); if (value !== undefined) e.textContent = value; if (cls) e.className = cls; return e; }
    function render() {
      wrap.replaceChildren(); const nav = node('div', undefined, 'f99a22-monthnav'), label = node('strong', new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {timeZone: 'Asia/Riyadh', month: 'long', year: 'numeric'}).format(new Date(month + 'T12:00:00Z')));
      label.setAttribute('aria-live', 'polite');
      for (const [n, key] of [[-1, 'appointment22.previous'], [1, 'appointment22.next']]) {
        const b = node('button', n === -1 ? '‹' : '›', 'f99a9-button'); b.type = 'button'; b.setAttribute('aria-label', t(key));
        b.onclick = () => { month = addMonths(month, n); render(); options.onMonth?.(month); }; nav.append(b);
      }
      nav.insertBefore(label, nav.lastChild); wrap.append(nav);
      const grid = node('div', undefined, 'f99a22-monthgrid'); grid.setAttribute('role', 'group');
      ['اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'].forEach(v => grid.append(node('span', v, 'f99a22-weekday')));
      const date = new Date(month + 'T12:00:00Z'), offset = (date.getUTCDay() + 6) % 7, count = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      for (let n = 0; n < offset; n++) grid.append(node('span'));
      for (let n = 1; n <= count; n++) {
        const day = month.slice(0, 7) + '-' + String(n).padStart(2, '0'), b = node('button', String(n), 'f99a22-date'); b.type = 'button'; b.dataset.day = day;
        b.setAttribute('aria-label', day); b.setAttribute('aria-pressed', String(selected === day));
        b.disabled = !!((options.from && day < options.from) || (options.to && day > options.to));
        const state = options.state?.(day); if (state) b.dataset.state = state;
        b.onclick = () => { selected = day; render(); options.onSelect?.(day); }; grid.append(b);
      }
      wrap.append(grid);
    }
    render(); return {refresh: render, select(day) {selected = day; month = day.slice(0, 7) + '-01'; render();}, setRange(from, to) {options.from = from; options.to = to; render();}};
  }
  w.F99AppointmentCalendar22 = Object.freeze({create, addMonths, t});
})(window);
