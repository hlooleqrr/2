/* FINO99 r52 — contracts extension layered on r38 (fino99_r38.js) and the full contracts portal.
   Owner: templates, design, texts/buttons, links, bans, trash, per-deal view/edit/payments/files.
   Client: owner messages, goods card, extra payment requests, files, linked next step, designed pages/PDF.
   All data goes through f99r52_owner / f99r52_party (server-validated). No secret codes in PDF/QR. */
(function (W, D) {
  'use strict';
  if (W.F99R52K) return;
  const K = () => W.F99R38K || {};
  const el = (t, c, x) => { const e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const okUrl = u => /^https:\/\/[^\s<>"']+$/i.test(String(u || '').trim());
  const FINO_LOGO = () => W.F99_APP_ICON || './icon-192.png?v=r45a';
  const SITE = 'https://www.fino99.com';
  const TXT = [['btn', 'نص زر الإجراء (فارغ = «أوافق على» + اسم العقد)'], ['sent', 'رسالة نجاح الإرسال'], ['review', 'رسالة انتظار المراجعة'], ['approved', 'رسالة الموافقة'],
    ['rejected', 'رسالة الرفض'], ['ended', 'رسالة انتهاء العقد'], ['expired', 'رسالة انتهاء صلاحية الكود'], ['invalid', 'رسالة الكود الخاطئ أو المحظور'],
    ['reentry', 'الرسالة بعد استخدام الكود (إعادة الدخول بعد الاعتماد)'], ['closed', 'رسالة إنهاء الخدمة أو إغلاق الطلب']];
  const VARS = 'المتغيرات: {client_name} اسم العميل • {ref} رقم العقد • {title} اسم العقد • {status} الحالة • {date} التاريخ • {amount} المبلغ • {remaining} المتبقي';
  const DDEF = {logo: {on: false, src: 'fino', file: ''}, logos: [], bg: {on: false, file: '', opacity: 0.08, size: 'cover', repeat: false, pos: 'center'},
    footer: {on: false, text: ''}, red: {on: false, text: ''}, qr: {on: false, kind: 'ref'}, colors: {primary: '#0f766e', text: '#0f172a'}, font: 16, lh: 1.9, h: 22, gap: 10};
  const NEWR = {K_BANNED: 'تعذر الدخول بهذا الكود.', K_BANNED_NEW: 'لا يمكن تنفيذ طلب جديد حاليًا. تواصل مع الإدارة.', K_DEAL_CLOSED: 'تم إغلاق هذا الطلب.',
    K_LINK_WAITING: 'الإجراء التالي غير متاح بعد.', K_OFFER_EXPIRED: 'انتهت مدة صلاحية هذا العرض.', K_GOODS_LOCKED: 'لا يمكن تعديل بيانات السلعة بعد موافقة أحد الأطراف؛ أصدر نسخة معدلة أو ملحقًا.',
    R52_BAN_KIND: 'اختر نوع الحظر.', R52_BAN_VALUE: 'القيمة غير صحيحة.', R52_BAN_SCOPE: 'نطاق الحظر غير صحيح.', R52_BAN_NOT_FOUND: 'الحظر غير موجود أو مرفوع سابقًا.',
    R52_LINK_ACTION: 'اختر الإجراء.', R52_LINK_LOOP: 'هذا الربط يكوّن حلقة متكررة؛ اختر عقدًا آخر.', R52_LINK_TAKEN: 'هذا العقد مرتبط مسبقًا بعقد آخر.', R52_LINK_STATE: 'لا يمكن تنفيذ ذلك في حالة الربط الحالية.',
    R52_AMOUNT: 'أدخل مبلغًا صحيحًا.', R52_PAYREQ_STATE: 'طلب الدفعة غير مفتوح.', R52_FILE_NOT_FOUND: 'الملف غير متاح.', R52_UPLOAD_OFF: 'إرفاق الملفات غير مفعّل لهذا العقد.',
    R52_UPLOAD_LIMIT: 'وصلت للحد الأعلى من المرفقات (10).', R52_FILE_DUP: 'هذا الملف مرفوع مسبقًا.', R52_OFFER_DATE: 'تاريخ صلاحية العرض غير صحيح.',
    K_TEMPLATE_NOT_FOUND: 'القالب غير موجود.', K_DRAFT_NOT_FOUND: 'المسودة غير موجودة.', K_TITLE: 'أدخل اسمًا واضحًا.', K_BODY_LENGTH: 'نص العقد قصير جدًا أو أطول من الحد (500,000 حرف).'};
  let S = null, G = null, ctx = {design: {}, fetch: null, ref: '', goods: null, files: [], bankImage: ''};
  const srcCache = new Map();
  function why(r) { const R = K().REASONS || {}; const k = r?.reason; return (r?.msg && r.msg.t) || R[k] || NEWR[k] || (k ? 'تعذر التنفيذ (' + k + ').' : 'تعذر التنفيذ.'); }
  function addReasons() { const R = K().REASONS; if (R && !R.__r52) { Object.keys(NEWR).forEach(k => { if (!R[k]) R[k] = NEWR[k]; }); try { R.__r52 = 1; } catch (_) {} } }
  const adm = (a, d) => (K().adm ? K().adm('f99r52_owner', {p_action: a, p_data: d || {}}) : Promise.resolve({ok: false, reason: 'NO_ADMIN'}));
  const btn = (h, t, fn, c) => { const b = el('button', 'f38-btn' + (c ? ' ' + c : ''), t); b.type = 'button'; b.addEventListener('click', ev => { if (b.dataset.busy) return; fn(ev); }); h.append(b); return b; };
  const fld = (h, l, v, o) => K().field(h, l, v, o || {});
  const say = (h, t, c) => { const p = el('p', c || 'f38-muted', t); h.append(p); return p; };
  const busy = async (b, fn) => { b.dataset.busy = '1'; b.disabled = true; try { return await fn(); } finally { delete b.dataset.busy; b.disabled = false; } };
  const merge = (a, b) => { const o = JSON.parse(JSON.stringify(a || {})); Object.entries(b || {}).forEach(([k, v]) => { o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? merge(o[k], v) : v; }); return o; };
  const dz = () => merge(DDEF, ctx.design || {});
  const money = n => { const x = Number(n); return Number.isFinite(x) ? x.toLocaleString('en-US', {maximumFractionDigits: 2}) : '0'; };
  function msgCard(m) { const c = el('div', 'f52-msg'); c.style.setProperty('--f52-c', /^#[0-9a-f]{6}$/i.test(m.c || '') ? m.c : '#15803d'); if (m.i) c.append(el('span', 'f52-ic', m.i)); c.append(el('b', '', m.t)); return c; }
  function modal(text, yes, no, onYes) {
    const ov = el('div', 'f52-modal'); const bx = el('div', 'f52-mbox'); ov.append(bx); bx.append(el('p', '', text)); const row = el('div', 'f38-row'); bx.append(row);
    btn(row, yes, () => { ov.remove(); onYes(); }, 'f38-danger'); btn(row, no, () => ov.remove()); D.body.append(ov); return ov;
  }
  function readFile(file, mimes, max) {
    return new Promise(res => { if (!file) return res({err: 'اختر ملفًا.'}); if (!mimes.includes(file.type)) return res({err: 'نوع الملف غير مسموح (صورة JPEG/PNG/WEBP أو PDF).'});
      if (file.size > (max || 1572864) || file.size < 200) return res({err: 'حجم الملف يجب أن يكون حتى 1.5 ميجابايت.'});
      const fr = new FileReader(); fr.onload = () => res({b64: String(fr.result).split(',')[1] || '', mime: file.type, name: file.name}); fr.onerror = () => res({err: 'تعذر قراءة الملف.'}); fr.readAsDataURL(file); });
  }
  const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  function src(id) {
    if (!id || !UUID.test(id) || !ctx.fetch) return Promise.resolve('');
    if (!srcCache.has(id)) srcCache.set(id, ctx.fetch(id).then(r => (r && r.ok && r.b64 ? 'data:' + r.mime + ';base64,' + r.b64 : '')).catch(() => ''));
    return srcCache.get(id);
  }
  function imgEl(id, cls, alt) { const i = el('img', cls || ''); i.alt = alt || ''; i.decoding = 'async'; src(id).then(s => { if (s) i.src = s; else i.remove(); }); return i; }
  const ownerFetch = id => adm('file_get', {id});
  const partyFetch = (session, dev) => id => K().pub('f99r52_party', {p_session: session, p_device_id: dev || K().KDEV(), p_action: 'file_get', p_data: {id}});
  let qrLib = null;
  function qrData(text) {
    if (!qrLib) qrLib = new Promise(res => { if (W.qrcode) return res(W.qrcode); const s = D.createElement('script'); s.src = './vendor/qrcode-gen-1.4.4.js'; s.onload = () => res(W.qrcode || null); s.onerror = () => res(null); D.head.append(s); });
    return qrLib.then(q => { if (!q) return ''; try { const o = q(0, 'M'); o.addData(unescape(encodeURIComponent(text))); o.make(); return o.createDataURL(4, 8); } catch (_) { return ''; } });
  }
  const qrText = d => (d.qr?.kind === 'site' ? SITE : 'FINO99 | رقم العقد ' + (ctx.ref || '—'));

  /* ---------- content: light markup (#, ##, tables |a|b|, [صورة:ID], links, --- page break) ---------- */
  function blocks(text) {
    const out = []; let para = [], tbl = null;
    const pf = () => { if (para.length) { out.push({t: 'p', x: para.join('\n')}); para = []; } };
    const tf = () => { if (tbl) { out.push({t: 'table', rows: tbl}); tbl = null; } };
    String(text || '').split('\n').forEach(raw => { const l = raw.replace(/\s+$/, ''); let m;
      if (/^\s*\|.*\|\s*$/.test(l)) { pf(); const cells = l.trim().slice(1, -1).split('|').map(c => c.trim()); if (!cells.every(c => /^:?-{2,}:?$/.test(c))) (tbl = tbl || []).push(cells); return; }
      tf();
      if ((m = l.match(/^\s*(#{1,2})\s+(.+)$/))) { pf(); out.push({t: m[1].length === 1 ? 'h1' : 'h2', x: m[2]}); return; }
      if ((m = l.match(/^\s*\[(?:صورة|img)\s*:\s*([0-9a-f-]{36})\s*\]\s*$/i))) { pf(); out.push({t: 'img', id: m[1].toLowerCase()}); return; }
      if (/^\s*-{3,}\s*$/.test(l)) { pf(); return; }
      if (!l.trim()) { pf(); return; }
      para.push(l); });
    pf(); tf(); return out;
  }
  function linkify(host, s) {
    String(s).split(/(https:\/\/[^\s<>"']+)/g).forEach((part, i) => { if (i % 2 && okUrl(part)) { const a = el('a', 'f52-a', part); a.href = part; a.target = '_blank'; a.rel = 'noopener noreferrer'; host.append(a); } else if (part) host.append(D.createTextNode(part)); });
    return host;
  }
  function renderBlocks(text) {
    const f = el('div', 'f52-body');
    blocks(text).forEach(b => {
      if (b.t === 'h1' || b.t === 'h2') f.append(linkify(el(b.t === 'h1' ? 'h4' : 'h5', 'f52-' + b.t), b.x));
      else if (b.t === 'img') f.append(imgEl(b.id, 'f52-img'));
      else if (b.t === 'table') { const w = el('div', 'f52-tw'); const t = el('table', 'f52-t'); b.rows.forEach((r, i) => { const tr = el('tr'); r.forEach(c => tr.append(linkify(el(i === 0 ? 'th' : 'td'), c))); t.append(tr); }); w.append(t); f.append(w); }
      else f.append(linkify(el('p', 'f52-p'), b.x));
    });
    return f;
  }
  /* pages split: honours --- page breaks; never drops text; long paragraphs are cut at line/word boundaries. */
  function split(text) {
    const LIM = 1700, P = [];
    String(text || '').split(/\n[ \t]*-{3,}[ \t]*(?:\n|$)/).forEach(seg => {
      let cur = '';
      const pieces = [];
      seg.split(/\n{2,}/).forEach(p => { if (p.length <= LIM) { pieces.push(p); return; }
        let rest = p; while (rest.length > LIM) { let cut = rest.lastIndexOf('\n', LIM); if (cut < LIM * 0.5) cut = rest.lastIndexOf(' ', LIM); if (cut < LIM * 0.5) cut = LIM; pieces.push(rest.slice(0, cut)); rest = rest.slice(cut).replace(/^[ \n]/, ''); } if (rest) pieces.push(rest); });
      pieces.forEach(p => { if ((cur + p).length > LIM && cur) { P.push(cur); cur = ''; } cur += (cur ? '\n\n' : '') + p; });
      if (cur) P.push(cur);
    });
    if (!P.length) P.push('');
    return P;
  }
  function head(d) {
    const h = el('div', 'f52-head'); let any = false;
    if (d.logo?.on) { const i = d.logo.src === 'file' && d.logo.file ? imgEl(d.logo.file, 'f52-logo') : Object.assign(el('img', 'f52-logo'), {src: FINO_LOGO(), alt: 'FINO99'}); h.append(i); any = true; }
    (d.logos || []).filter(x => x && x.file && (x.place || 'head') === 'head').forEach(x => { const i = imgEl(x.file, 'f52-logo', x.label || ''); if (okUrl(x.url)) { const a = el('a'); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.append(i); h.append(a); } else h.append(i); any = true; });
    return any ? h : null;
  }
  function tail(d) {
    const t = el('div', 'f52-tail'); let any = false;
    const fl = (d.logos || []).filter(x => x && x.file && x.place === 'foot'); if (fl.length) { const r = el('div', 'f52-head'); fl.forEach(x => { const i = imgEl(x.file, 'f52-logo', x.label || ''); if (okUrl(x.url)) { const a = el('a'); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.append(i); r.append(a); } else r.append(i); }); t.append(r); any = true; }
    if (d.red?.on && d.red.text) { t.append(el('p', 'f52-red', d.red.text)); any = true; }
    if (d.qr?.on) { const q = el('img', 'f52-qr'); q.alt = 'QR'; qrData(qrText(d)).then(s => { if (s) q.src = s; else q.remove(); }); const w = el('div', 'f52-qrw'); w.append(q, el('small', '', d.qr.kind === 'site' ? SITE : 'رقم العقد ' + (ctx.ref || '—'))); t.append(w); any = true; }
    return any ? t : null;
  }
  function render(text, i, n) {
    const d = dz(); const fr = D.createDocumentFragment();
    if (d.bg?.on && d.bg.file) { const b = el('div', 'f52-bg'); b.style.opacity = String(Math.min(1, Math.max(0.02, Number(d.bg.opacity) || 0.08))); b.style.backgroundSize = ['cover', 'contain', 'auto'].includes(d.bg.size) ? d.bg.size : 'cover';
      b.style.backgroundRepeat = d.bg.repeat ? 'repeat' : 'no-repeat'; b.style.backgroundPosition = ['center', 'top', 'bottom'].includes(d.bg.pos) ? d.bg.pos : 'center'; src(d.bg.file).then(s => { if (s) b.style.backgroundImage = 'url("' + s + '")'; }); fr.append(b); }
    if (i === 0) { const h = head(d); if (h) { fr.append(h); queueMicrotask(() => { const pg = h.parentNode; if (pg) pg.insertBefore(h, pg.querySelector('h3') || pg.firstChild); }); } }
    fr.append(renderBlocks(text));
    if (i === n - 1) { const t = tail(d); if (t) fr.append(t); }
    if (d.footer?.on && d.footer.text) fr.append(el('div', 'f52-foot', d.footer.text));
    return fr;
  }
  function styleVars(node, d) {
    node.classList.add('f52-page'); const c = d.colors || {};
    node.style.setProperty('--f52-p', /^#[0-9a-f]{6}$/i.test(c.primary || '') ? c.primary : '#0f766e'); node.style.setProperty('--f52-t', /^#[0-9a-f]{6}$/i.test(c.text || '') ? c.text : '#0f172a');
    node.style.setProperty('--f52-fs', Math.min(24, Math.max(12, Number(d.font) || 16)) + 'px'); node.style.setProperty('--f52-lh', String(Math.min(2.8, Math.max(1.3, Number(d.lh) || 1.9))));
    node.style.setProperty('--f52-h', Math.min(36, Math.max(14, Number(d.h) || 22)) + 'px'); node.style.setProperty('--f52-gap', Math.min(40, Math.max(0, Number(d.gap) || 10)) + 'px');
  }
  function decorate(box, pg) { styleVars(pg, dz()); }

  /* ---------- PDF / print with design ---------- */
  async function buildHtml(title, sub, text, wm) {
    const d = dz(); const ids = new Set();
    blocks(text).forEach(b => { if (b.t === 'img') ids.add(b.id); });
    if (d.logo?.on && d.logo.src === 'file') ids.add(d.logo.file); (d.logos || []).forEach(x => x?.file && ids.add(x.file)); if (d.bg?.on) ids.add(d.bg.file);
    const g = ctx.goods && ctx.goods.name ? ctx.goods : null; (g?.images || []).forEach(x => ids.add(x));
    const att = (ctx.files || []).filter(f => f.printable && /^image\//.test(f.mime)); att.forEach(f => ids.add(f.id));
    const S2 = {}; await Promise.all([...ids].filter(x => x && UUID.test(x)).map(async x => { S2[x] = await src(x); }));
    const qr = d.qr?.on ? await qrData(qrText(d)) : ''; const vq = g && okUrl(g.video_url) ? await qrData(g.video_url) : '';
    const im = (id, c) => (S2[id] ? '<img class="' + c + '" src="' + S2[id] + '">' : '');
    const link = s => esc(s).replace(/(https:\/\/[^\s&<>"']+)/g, u => '<a href="' + u + '">' + u + '</a>');
    const C = d.colors || {}; const pc = /^#[0-9a-f]{6}$/i.test(C.primary || '') ? C.primary : '#0f766e', tc = /^#[0-9a-f]{6}$/i.test(C.text || '') ? C.text : '#111';
    const fs = Math.min(24, Math.max(12, Number(d.font) || 16)), lh = Math.min(2.8, Math.max(1.3, Number(d.lh) || 1.9)), hs = Math.min(36, Math.max(14, Number(d.h) || 22)), gap = Math.min(40, Math.max(0, Number(d.gap) || 10));
    let h = '<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><title>' + esc(title) + '</title><style>'
      + 'body{font:' + fs + 'px/' + lh + ' Tahoma,Arial,sans-serif;margin:0;color:' + tc + '}main{padding:6mm 2mm 18mm}h1{font-size:' + hs + 'px;margin:0 0 4px;color:' + pc + '}h4{font-size:' + Math.round(hs * 0.85) + 'px;color:' + pc + ';margin:' + gap + 'px 0 4px}h5{font-size:' + Math.round(hs * 0.72) + 'px;margin:' + gap + 'px 0 2px}'
      + 'p{margin:0 0 ' + gap + 'px;white-space:pre-wrap}small{color:#555}table{border-collapse:collapse;width:100%;margin:0 0 ' + gap + 'px}td,th{border:1px solid #cbd5e1;padding:4px 6px;text-align:right;vertical-align:top}th{background:#f1f5f9}'
      + '.head{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.logo{max-height:56px;max-width:160px;object-fit:contain}.img{max-width:100%;max-height:220mm;display:block;margin:6px auto}'
      + '.red{color:#b91c1c;font-weight:700;border:1px solid #fecaca;background:#fef2f2;padding:6px 8px;border-radius:6px}.qr{width:96px;height:96px}.qrw{display:flex;gap:8px;align-items:center;margin-top:8px}'
      + '.foot{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:12px;color:#475569;border-top:1px solid #e2e8f0;padding:3px 0;background:#fff}.pb{break-after:page;page-break-after:always}'
      + '.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:42px;color:rgba(0,0,0,.07);transform:rotate(-28deg);pointer-events:none;z-index:9}'
      + '.bg{position:fixed;inset:0;pointer-events:none;z-index:-1}.goods td:first-child{width:38%;color:#475569}@page{size:A4;margin:14mm 14mm 16mm}</style><body>';
    if (d.bg?.on && S2[d.bg.file]) h += '<div class="bg" style="opacity:' + Math.min(1, Math.max(0.02, Number(d.bg.opacity) || 0.08)) + ';background:url(' + S2[d.bg.file] + ') ' + (['center', 'top', 'bottom'].includes(d.bg.pos) ? d.bg.pos : 'center') + '/' + (['cover', 'contain', 'auto'].includes(d.bg.size) ? d.bg.size : 'cover') + ' ' + (d.bg.repeat ? 'repeat' : 'no-repeat') + '"></div>';
    if (wm) h += '<div class="wm">' + esc(wm) + '</div>';
    if (d.footer?.on && d.footer.text) h += '<div class="foot">' + esc(d.footer.text) + '</div>';
    h += '<main>';
    let hd = ''; if (d.logo?.on) hd += d.logo.src === 'file' ? im(d.logo.file, 'logo') : '<img class="logo" src="' + esc(new URL(FINO_LOGO(), W.location.href).href) + '">';
    (d.logos || []).filter(x => x && x.file && (x.place || 'head') === 'head').forEach(x => { const i = im(x.file, 'logo'); hd += okUrl(x.url) ? '<a href="' + esc(x.url) + '">' + i + '</a>' : i; });
    if (hd) h += '<div class="head">' + hd + '</div>';
    h += '<h1>' + esc(title) + '</h1><small>' + esc(sub) + ' • طُبع ' + esc(new Date().toLocaleString('en-GB')) + '</small>';
    if (g) h += goodsHtml(g, S2, vq);
    String(text || '').split(/\n[ \t]*-{3,}[ \t]*(?:\n|$)/).forEach((seg, si, arr) => {
      blocks(seg).forEach(b => { if (b.t === 'h1') h += '<h4>' + link(b.x) + '</h4>'; else if (b.t === 'h2') h += '<h5>' + link(b.x) + '</h5>'; else if (b.t === 'img') h += im(b.id, 'img');
        else if (b.t === 'table') h += '<table>' + b.rows.map((r, i) => '<tr>' + r.map(c => (i ? '<td>' : '<th>') + link(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>'; else h += '<p>' + link(b.x) + '</p>'; });
      if (si < arr.length - 1) h += '<div class="pb"></div>'; });
    if (att.length) { h += '<h4>المرفقات</h4>'; att.forEach(f => { h += '<p><b>' + esc(f.name) + '</b></p>' + im(f.id, 'img'); }); }
    const other = (ctx.files || []).filter(f => f.printable && !/^image\//.test(f.mime)); if (other.length) h += '<p>مرفقات أخرى: ' + other.map(f => esc(f.name)).join('، ') + '</p>';
    const fl = (d.logos || []).filter(x => x && x.file && x.place === 'foot'); if (fl.length) h += '<div class="head">' + fl.map(x => { const i = im(x.file, 'logo'); return okUrl(x.url) ? '<a href="' + esc(x.url) + '">' + i + '</a>' : i; }).join('') + '</div>';
    if (d.red?.on && d.red.text) h += '<p class="red">' + esc(d.red.text) + '</p>';
    if (qr) h += '<div class="qrw"><img class="qr" src="' + qr + '"><small>' + esc(d.qr.kind === 'site' ? SITE : 'رقم العقد ' + (ctx.ref || '—')) + '</small></div>';
    return h + '</main></body></html>';
  }
  function goodsRows(g) {
    const R = []; const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') R.push([k, String(v)]); };
    add('اسم السلعة', g.name); add('رقم السلعة', g.no); add('الوصف', g.desc); add('سعر السلعة (ريال)', g.price && money(g.price)); add('سعر البيع (ريال)', g.sale_price && money(g.sale_price)); add('سعر الشراء (ريال)', g.buy_price && money(g.buy_price));
    if (Number(g.share_price) > 0 || Number(g.share_count) > 0) { add('سعر السهم (ريال)', money(g.share_price)); add('عدد الأسهم', money(g.share_count)); add('إجمالي قيمة الأسهم (ريال)', money((Number(g.share_price) || 0) * (Number(g.share_count) || 0))); }
    add('صلاحية العرض حتى', g.offer_until && String(g.offer_until).replace('T', ' ')); add('البائع', g.seller); add('المشتري', g.buyer); add('شروط وملاحظات', g.terms);
    return R;
  }
  function goodsHtml(g, S2, vq) {
    let h = '<h4>بيانات السلعة / المبايعة</h4><table class="goods">' + goodsRows(g).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table>';
    (g.images || []).forEach(id => { if (S2[id]) h += '<img class="img" src="' + S2[id] + '">'; });
    if (okUrl(g.video_url)) h += '<div class="qrw">' + (vq ? '<img class="qr" src="' + vq + '">' : '') + '<small>مقطع الفيديو: <a href="' + esc(g.video_url) + '">' + esc(g.video_url) + '</a></small></div>';
    (g.docs || []).filter(okUrl).forEach(u => { h += '<p>مستند: <a href="' + esc(u) + '">' + esc(u) + '</a></p>'; });
    return h;
  }
  function print(title, sub, text, wm) {
    const w = W.open('', '_blank'); if (!w) { W.alert('اسمح بالنوافذ المنبثقة لفتح PDF.'); return true; }
    w.document.write('<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><body style="font:16px Tahoma,Arial;padding:40px">جاري تجهيز المستند…</body></html>');
    buildHtml(title, sub, text, wm).then(html => { w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 800); })
      .catch(() => { w.document.open(); w.document.write('<pre dir="rtl" style="white-space:pre-wrap;font:15px/2 Tahoma">' + esc(title + '\n' + sub + '\n\n' + text) + '</pre>'); w.document.close(); });
    return true;
  }
  function goodsCard(g) {
    const c = el('div', 'f38-sub f52-goods'); c.append(el('b', '', '🛍️ بيانات السلعة / المبايعة')); const t = el('table', 'f52-t'); goodsRows(g).forEach(([k, v]) => { const tr = el('tr'); tr.append(el('td', '', k), linkify(el('td'), v)); t.append(tr); });
    const w = el('div', 'f52-tw'); w.append(t); c.append(w);
    if ((g.images || []).length) { const gl = el('div', 'f52-gal'); g.images.forEach(id => gl.append(imgEl(id, 'f52-gimg'))); c.append(gl); }
    if (okUrl(g.video_url)) { const a = el('a', 'f38-btn', '▶️ مشاهدة مقطع الفيديو'); a.href = g.video_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a); }
    (g.docs || []).filter(okUrl).forEach((u, i) => { const a = el('a', 'f38-btn', '📄 مستند ' + (i + 1)); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a); });
    if (g.offer_until && Date.parse(String(g.offer_until).replace(' ', 'T') + (String(g.offer_until).length <= 10 ? 'T23:59:59' : '')) < Date.now()) c.append(el('p', 'f38-err', 'انتهت مدة صلاحية هذا العرض.'));
    return c;
  }
  async function openFile(fetcher, id) {
    const w = W.open('', '_blank'); const r = await fetcher(id); if (!r || !r.ok) { if (w) w.close(); W.alert(why(r)); return; }
    try { const bin = atob(r.b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const url = URL.createObjectURL(new Blob([u8], {type: r.mime}));
      if (w) w.location.href = url; else W.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 120000); } catch (_) { if (w) w.close(); }
  }

  /* ---------- client (r38 openParty / signForm / payBox hooks) ---------- */
  function party(body, v, session, notice) {
    addReasons(); const r = v.r52; if (!r) return;
    ctx = {design: r.design || {}, fetch: partyFetch(session), ref: r.ref || v.ref, goods: r.goods || null, files: r.files || [], bankImage: r.pay?.bank_image || ''}; srcCache.clear();
    if (r.state && r.msg && r.msg.on !== false && r.msg.t && !notice) body.append(msgCard(r.msg));
    if (r.state && r.state !== 'review') (r.reentry_buttons || []).forEach(b => { if (okUrl(b.url)) { const a = el('a', 'f38-btn f38-primary', b.label); a.href = b.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; body.append(a); } });
    if (r.goods && r.goods.name) body.append(goodsCard(r.goods));
  }
  function bodyHost(body, v) {
    const r = v.r52; if (!r || !r.hide_body_on_pay || !v.r38?.signed) return body;
    const w = el('div', 'f52-eye'); const inner = el('div'); inner.hidden = true; const b = btn(w, '👁 عرض نص العقد', () => { inner.hidden = !inner.hidden; b.textContent = inner.hidden ? '👁 عرض نص العقد' : '🙈 إخفاء نص العقد'; });
    w.append(inner); body.append(w); return inner;
  }
  function btnLabel(v, stg) {
    const t = v?.r52?.texts?.btn; if (t && t.on !== false && String(t.t || '').trim()) return String(t.t).trim();
    if (stg && stg.action === 'submit') return 'إرسال';
    return 'أوافق على ' + String(v?.title || 'العقد').trim();
  }
  function doneMsg(v, a) {
    const m = v?.r52?.texts?.[a === 'approve' ? 'approved' : 'sent']; if (!m) return '';
    if (m.on === false) return '\u200b'; return (m.i ? m.i + ' ' : '') + (m.t || '');
  }
  function partyEnd(body, v, session) {
    const r = v.r52; if (!r) return; const dev = K().KDEV ? K().KDEV() : '';
    const call = (a, d) => K().pub('f99r52_party', {p_session: session, p_device_id: dev, p_action: a, p_data: d || {}});
    const st = el('p', 'f38-err');
    (r.links || []).forEach(l => {
      if (l.status === 'pending_owner') { say(body, '⏳ ' + (l.label || 'الإجراء التالي') + ' — بانتظار مراجعة الإدارة.', 'f38-warn'); return; }
      if ((l.action === 'notify' || l.action === 'end') && l.label) { body.append(msgCard({t: l.label, i: l.action === 'end' ? '🤝' : '🔔', c: '#0f766e'})); return; }
      if (l.status === 'released' && (l.action === 'send_contract' || l.action === 'open_request' || l.action === 'wait_owner')) {
        const b = btn(body, '➡️ ' + (l.label || ('متابعة: ' + (l.title || 'الإجراء التالي'))) + (l.ref ? ' (' + l.ref + ')' : ''), () => busy(b, async () => { st.textContent = '';
          const n = await call('next', {id: l.id}); if (!n.ok) { st.textContent = why(n); return; }
          const e = await K().pub('f99r38_party_enter', {p_key: n.code, p_device_id: dev}); if (!e.ok || !e.session) { st.textContent = why(e); return; }
          const chk = await K().pub('f99r38_party', {p_session: e.session, p_device_id: dev, p_action: 'view', p_data: {}});
          if (chk.r38 || chk.reason === 'K_PIN_REQUIRED' || chk.reason === 'K_GEO_REQUIRED') { try { sessionStorage.setItem(K().SKEY || 'F99R38_PARTY', e.session); } catch (_) {} K().openParty(e.session); return; }
          K().closeSheet?.(); if (W.F99KContracts?.partyEnter) W.F99KContracts.partyEnter(n.code, st); }), 'f38-primary');
      }
    });
    if ((r.files || []).length) { const s = el('div', 'f38-sub'); s.append(el('b', '', '📎 المرفقات')); r.files.forEach(f => btn(s, (f.mine ? 'مرفقك: ' : '') + f.name, () => openFile(partyFetch(session, dev), f.id))); body.append(s); }
    if (r.client_upload && (v.status === 'active' || v.status === 'completed')) { const s = el('div', 'f38-sub'); s.append(el('b', '', 'إرفاق مستند (صورة أو PDF حتى 1.5 ميجابايت)'));
      const fi = el('input'); fi.type = 'file'; fi.accept = MIMES.join(','); s.append(fi);
      const b = btn(s, 'إرفاق', () => busy(b, async () => { st.textContent = ''; const x = await readFile(fi.files?.[0], MIMES); if (x.err) { st.textContent = x.err; return; }
        const q = await call('file_put', {name: x.name, mime: x.mime, b64: x.b64}); if (q.ok) K().openParty(session, '📎 تم إرفاق الملف.'); else st.textContent = why(q); }), 'f38-primary'); body.append(s); }
    body.append(st);
  }
  function payPatch(v, x, box) {
    const r = v.r52; if (!r) return; const p = r.pay || {}; x.pay = x.pay || {};
    if (p.show_salla === false) x.pay.salla_url = ''; else if (okUrl(p.salla_url)) x.pay.salla_url = p.salla_url;
    if (p.show_bank === false) x.pay.bank = null; else if (p.iban) x.pay.bank = {bank_name: p.bank_name || '', holder: p.holder || '', iban: p.iban};
    if (r.pay_text) box.append(el('p', 'f52-paytext', r.pay_text));
    (r.payreq || []).forEach(q => box.append(el('p', 'f38-muted', '🧾 دفعة مطلوبة: ' + (q.label || 'دفعة') + ' — ' + money(q.amount) + ' ريال')));
  }
  function bankExtra(s, b) {
    if (ctx.bankImage) s.append(imgEl(ctx.bankImage, 'f52-bankimg', 'الحساب البنكي'));
    if (!b?.iban) return; const iban = String(b.iban).replace(/\s+/g, '');
    const bt = btn(s, '📋 نسخ الآيبان', async () => { let ok = false; try { await navigator.clipboard.writeText(iban); ok = true; } catch (_) {
      const t = el('textarea'); t.value = iban; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; D.body.append(t); t.select(); try { ok = D.execCommand('copy'); } catch (_) {} t.remove(); }
      bt.textContent = ok ? '✅ تم نسخ الآيبان' : 'انسخ الآيبان يدويًا: ' + iban; setTimeout(() => { bt.textContent = '📋 نسخ الآيبان'; }, 2500); });
  }
  function centerExtra(b, v, o) {
    const r = v.r52; if (!r) return; addReasons();
    ctx = {design: r.design || {}, fetch: partyFetch(o.session, o.dev), ref: r.ref || v.ref, goods: r.goods || null, files: r.files || [], bankImage: ''}; srcCache.clear();
    if (r.state && r.msg && r.msg.on !== false && r.msg.t) b.append(msgCard(r.msg));
    if (r.goods && r.goods.name) b.append(goodsCard(r.goods));
    if ((r.files || []).length) { const s = el('div', 'f38-sub'); s.append(el('b', '', '📎 المرفقات')); r.files.forEach(f => btn(s, f.name, () => openFile(partyFetch(o.session, o.dev), f.id))); b.append(s); }
  }

  /* ---------- owner ---------- */
  async function ensureS(force) { if (S && G && !force) return true; const r = await adm('get'); if (!r.ok) return r; G = r; S = r.settings || {texts: {}, design: {}}; return true; }
  function ownerTabs() { return [['tpls', 'القوالب'], ['design', 'التصميم'], ['texts', 'النصوص والأزرار'], ['links', 'ربط العقود'], ['bans', 'الأكواد والحظر'], ['trash', 'المحذوفات']]; }
  function ownerPane(k, pane, KL) {
    const P = {tpls: tplsPane, design: designPane, texts: textsPane, links: linksPane, bans: bansPane, trash: trashPane}[k]; if (!P) return false; addReasons();
    const wt = say(pane, 'جاري التحميل…'); ensureS(true).then(ok => { wt.remove(); if (ok !== true) { say(pane, why(ok), 'f38-err'); return; } P(pane, KL); }); return true;
  }
  const back = (h, tab) => btn(h, '↩︎ رجوع للعقود', () => K().openK(tab));
  function tplsPane(pane, KL) {
    say(pane, 'كل القوالب قابلة للتعديل والنسخ والحذف إلى «المحذوفات» ثم الاسترجاع. العقود الصادرة لا تتأثر بتعديل القالب.');
    (KL.templates || []).forEach(t => { const c = el('article', 'f38-card'); c.append(el('b', '', t.name), el('p', 'f38-muted', (t.single ? 'طرف واحد' : 'متعدد الأطراف') + ' • ' + (t.kind || ''))); const row = el('div', 'f38-row'); c.append(row); const out = el('div'); c.append(out);
      btn(row, 'تعديل', async () => { out.textContent = ''; const r = await adm('tpl_get', {id: t.id}); if (!r.ok) { say(out, why(r), 'f38-err'); return; }
        const n = fld(out, 'اسم القالب', r.name, {wide: 1, max: 160}), bd = fld(out, 'نص القالب', r.body, {area: 1, rows: 12, wide: 1}); toolbar(out, bd);
        const st = el('p', 'f38-note'); out.append(st); const b = btn(out, 'حفظ القالب', () => busy(b, async () => { const q = await adm('tpl_edit', {id: t.id, name: n.value.trim(), body: bd.value}); st.textContent = q.ok ? 'حُفظ القالب.' : why(q); }), 'f38-primary'); });
      btn(row, 'نسخ كقالب جديد', async () => { const name = W.prompt('اسم القالب الجديد', t.name + ' (نسخة)'); if (!name) return; const r = await adm('tpl_get', {id: t.id}); if (!r.ok) { out.textContent = ''; say(out, why(r), 'f38-err'); return; }
        const q = await adm('tpl_save_as', {template_id: t.id, name, body: r.body}); if (q.ok) K().openK('tpls'); else { out.textContent = ''; say(out, why(q), 'f38-err'); } });
      btn(row, 'حذف', async () => { if (!W.confirm('نقل القالب «' + t.name + '» إلى المحذوفات؟ يمكنك استرجاعه لاحقًا.')) return; const q = await adm('tpl_trash', {id: t.id}); if (q.ok) K().openK('tpls'); else { out.textContent = ''; say(out, why(q), 'f38-err'); } }, 'f38-danger');
      pane.append(c); });
  }
  function toolbar(host, ta) {
    const row = el('div', 'f38-row f52-tools'); host.insertBefore(row, ta.closest ? (ta.closest('label') || ta) : ta);
    const ins = s => { const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a; ta.value = ta.value.slice(0, a) + s + ta.value.slice(b); ta.focus(); try { ta.selectionStart = ta.selectionEnd = a + s.length; } catch (_) {} ta.dispatchEvent(new Event('input')); };
    btn(row, 'عنوان', () => ins('\n# عنوان البند\n')); btn(row, 'بند فرعي', () => ins('\n## بند فرعي\n')); btn(row, 'جدول', () => ins('\n| العنصر | القيمة |\n| مثال | 100 |\n'));
    btn(row, 'ملحق', () => ins('\n---\n# ملحق رقم 1\n')); btn(row, 'فاصل صفحة', () => ins('\n---\n')); btn(row, 'رابط', () => { const u = W.prompt('الرابط (https://…)'); if (okUrl(u)) ins(' ' + u.trim() + ' '); });
    btn(row, 'صورة', async () => { const ok = await ensureS(); const imgs = ok === true ? (G.assets || []).filter(a => /^image\//.test(a.mime)) : []; if (!imgs.length) { W.alert('ارفع الصورة أولًا من تبويب «التصميم» ← الصور والشعارات.'); return; }
      const pick = W.prompt('اكتب رقم الصورة:\n' + imgs.map((a, i) => (i + 1) + ') ' + a.name).join('\n'), '1'); const a = imgs[Number(pick) - 1]; if (a) ins('\n[صورة:' + a.id + ']\n'); });
    say(host, 'التنسيق: «# عنوان» و«## بند» وجدول بأسطر تبدأ وتنتهي بـ| والروابط تصبح قابلة للضغط و«---» صفحة جديدة. لا يوجد حد صغير لطول النص (حتى 500,000 حرف).').classList.add('f52-hint');
  }
  function assetSelect(host, label, value, onlyImg) {
    const opts = [['', '— بدون —']].concat((G?.assets || []).filter(a => !onlyImg || /^image\//.test(a.mime)).map(a => [a.id, a.name]));
    return fld(host, label, value || '', {options: opts});
  }
  function designPane(pane) {
    const d = merge(DDEF, S.design || {}); const f = el('div', 'f38-form'); pane.append(f);
    const sec = t => { const s = el('fieldset', 'f38-fs'); s.append(el('legend', '', t)); f.append(s); return s; };
    const up = sec('الصور والشعارات المرفوعة'); const fi = el('input'); fi.type = 'file'; fi.accept = MIMES.join(','); up.append(fi); const st0 = el('p', 'f38-note'); up.append(st0);
    const ub = btn(up, 'رفع الملف', () => busy(ub, async () => { const x = await readFile(fi.files?.[0], MIMES); if (x.err) { st0.textContent = x.err; return; } const r = await adm('file_put', {name: x.name, mime: x.mime, b64: x.b64}); st0.textContent = r.ok ? 'تم الرفع.' : why(r); if (r.ok) K().openK('design'); }), 'f38-primary');
    (G.assets || []).forEach(a => { const p = el('p', 'f52-asset'); p.append(el('span', '', a.name + ' • ' + Math.round(a.size / 1024) + 'KB')); btn(p, 'حذف', async () => { if (!W.confirm('حذف الملف من الصور المرفوعة؟')) return; await adm('file_del', {id: a.id}); K().openK('design'); }, 'f38-danger'); up.append(p); });
    const lg = sec('شعار أعلى العقد'); const lon = fld(lg, 'إظهار الشعار', d.logo.on, {type: 'checkbox'}), lsrc = fld(lg, 'المصدر', d.logo.src, {options: [['fino', 'شعار FINO99 الحالي'], ['file', 'صورة مرفوعة']]}), lfile = assetSelect(lg, 'الصورة المرفوعة', d.logo.file, true);
    const ls = sec('شعارات إضافية وروابطها (Snapchat، WhatsApp، شعار تجاري…)'); const rows = [];
    const addRow = x => { const r = el('div', 'f52-lrow'); ls.insertBefore(r, addB); const o = {file: assetSelect(r, 'الصورة', x.file, true), url: fld(r, 'رابط عند الضغط (اختياري)', x.url || '', {ltr: 1, ph: 'https://…'}), place: fld(r, 'المكان', x.place || 'head', {options: [['head', 'رأس العقد'], ['foot', 'أسفل العقد']]}), label: fld(r, 'الوصف', x.label || '', {max: 60})};
      btn(r, 'إزالة', () => { r.remove(); rows.splice(rows.indexOf(o), 1); }); rows.push(o); };
    const addB = btn(ls, '+ إضافة شعار', () => addRow({})); (d.logos || []).forEach(addRow);
    const bg = sec('الخلفية والعلامة المائية'); const bon = fld(bg, 'إظهار صورة خلفية', d.bg.on, {type: 'checkbox'}), bfile = assetSelect(bg, 'صورة الخلفية', d.bg.file, true), bop = fld(bg, 'الشفافية (0.02–1؛ القليل = علامة مائية)', d.bg.opacity, {type: 'number'});
    const bsz = fld(bg, 'الحجم', d.bg.size, {options: [['cover', 'تغطية كاملة'], ['contain', 'احتواء'], ['auto', 'الحجم الأصلي']]}), brp = fld(bg, 'تكرار الصورة', d.bg.repeat, {type: 'checkbox'}), bps = fld(bg, 'الموقع', d.bg.pos, {options: [['center', 'الوسط'], ['top', 'أعلى'], ['bottom', 'أسفل']]});
    say(bg, 'العلامة المائية باسم العميل تُضبط لكل عقد من «الدخول والحماية».');
    const ft = sec('الفوتر والتنويهات'); const fon = fld(ft, 'إظهار فوتر', d.footer.on, {type: 'checkbox'}), ftx = fld(ft, 'نص الفوتر', d.footer.text, {wide: 1, max: 300});
    const ron = fld(ft, 'إظهار تنويه أحمر', d.red.on, {type: 'checkbox'}), rtx = fld(ft, 'نص التنويه الأحمر', d.red.text, {area: 1, rows: 2, wide: 1, max: 1000});
    const qq = sec('رمز QR'); const qon = fld(qq, 'إظهار QR', d.qr.on, {type: 'checkbox'}), qk = fld(qq, 'محتوى QR', d.qr.kind, {options: [['ref', 'رقم العقد (بدون أي كود دخول)'], ['site', 'رابط المنصة']]});
    const cs = sec('الألوان والخطوط'); const cp = fld(cs, 'اللون الرئيسي', d.colors.primary, {type: 'color'}), ct = fld(cs, 'لون النص', d.colors.text, {type: 'color'}), cf = fld(cs, 'حجم الخط (12–24)', d.font, {type: 'number'});
    const cl = fld(cs, 'تباعد الأسطر (1.3–2.8)', d.lh, {type: 'number'}), ch = fld(cs, 'حجم العناوين (14–36)', d.h, {type: 'number'}), cg = fld(cs, 'تباعد الفقرات (0–40)', d.gap, {type: 'number'});
    const collect = () => ({logo: {on: lon.checked, src: lsrc.value, file: lfile.value}, logos: rows.map(o => ({file: o.file.value, url: o.url.value.trim(), place: o.place.value, label: o.label.value.trim()})).filter(x => x.file),
      bg: {on: bon.checked, file: bfile.value, opacity: Number(bop.value) || 0.08, size: bsz.value, repeat: brp.checked, pos: bps.value}, footer: {on: fon.checked, text: ftx.value.trim()}, red: {on: ron.checked, text: rtx.value.trim()},
      qr: {on: qon.checked, kind: qk.value}, colors: {primary: cp.value, text: ct.value}, font: Number(cf.value) || 16, lh: Number(cl.value) || 1.9, h: Number(ch.value) || 22, gap: Number(cg.value) || 10});
    const st = el('p', 'f38-note'); const act = el('div', 'f38-row f38-sticky'); const pv = el('div'); pane.append(st, act, pv);
    btn(act, 'معاينة', () => { ctx = {design: collect(), fetch: ownerFetch, ref: 'K-0000', goods: null, files: []}; pv.textContent = ''; K().pages(pv, 'عقد تجريبي', '# البند الأول\nهذا نص تجريبي لمعاينة التصميم والشعارات والخلفية.\n\n| البند | القيمة |\n| الأتعاب | 4,000 ريال |\n\n## ملاحظة\nرابط: https://www.fino99.com', false); pv.scrollIntoView({block: 'start'}); });
    const sb = btn(act, 'حفظ التصميم', () => busy(sb, async () => { const r = await adm('settings_save', {texts: S.texts || {}, design: collect()}); if (r.ok) S = r.settings; st.textContent = r.ok ? 'حُفظ التصميم. يُطبق على العقود الجديدة والجارية، أما العقود المعتمدة فتبقى بتصميم نسخة اعتمادها.' : why(r); }), 'f38-primary');
  }
  function textsPane(pane) {
    const T = S.texts || {}; say(pane, VARS); const I = {};
    TXT.forEach(([k, label]) => { const m = T[k] || {}; const s = el('fieldset', 'f38-fs'); s.append(el('legend', '', label)); pane.append(s);
      I[k] = {t: fld(s, 'النص', m.t || '', {area: 1, rows: k === 'btn' ? 1 : 2, wide: 1, max: 4000}), c: fld(s, 'اللون', m.c || '#15803d', {type: 'color'}), i: fld(s, 'الأيقونة', m.i || '', {max: 4}), on: fld(s, 'إظهار', m.on !== false, {type: 'checkbox'})}; });
    const st = el('p', 'f38-note'); pane.append(st);
    const b = btn(pane, 'حفظ النصوص والأزرار', () => busy(b, async () => { const texts = {}; Object.entries(I).forEach(([k, o]) => { texts[k] = {t: o.t.value, c: o.c.value, i: o.i.value.trim(), on: o.on.checked}; });
      const r = await adm('settings_save', {texts, design: S.design || {}}); if (r.ok) S = r.settings; st.textContent = r.ok ? 'حُفظت النصوص وتظهر للعميل مباشرة.' : why(r); }), 'f38-primary f38-sticky');
    say(pane, 'يمكن تخصيص النصوص لعقد محدد من محرر العقد ← «نصوص هذا العقد».');
  }
  const LACT = [['send_contract', 'إرسال عقد آخر'], ['open_request', 'فتح طلب جديد'], ['notify', 'إرسال إشعار للعميل'], ['wait_owner', 'انتظار مراجعة المالك ثم الإرسال'], ['end', 'إنهاء الإجراء']];
  const LST = {waiting: 'بانتظار اعتماد العقد الأول', pending_owner: 'بانتظار مراجعتك', released: 'متاح للعميل', done: 'منتهٍ', cancelled: 'ملغى'};
  function linksPane(pane) {
    say(pane, 'أنشئ الربط من زر «ربط» أمام العقد. اعتماد العقد الأول لا يعتمد العقد التالي؛ يحتاج موافقة مستقلة من العميل.');
    if (!(G.links || []).length) say(pane, 'لا توجد روابط بعد.');
    (G.links || []).forEach(l => pane.append(linkCard(l)));
  }
  function linkCard(l) {
    const c = el('article', 'f38-card'); c.append(el('b', '', (l.from_ref || '') + ' ← ' + (l.to_ref || (LACT.find(x => x[0] === l.action) || [])[1] || l.action)), el('p', 'f38-muted', (l.label || '') + ' • ' + (LST[l.status] || l.status) + ' • ' + (K().when ? K().when(l.created_at) : '')));
    const row = el('div', 'f38-row'); c.append(row); const out = el('p', 'f38-note'); c.append(out);
    if (l.status === 'pending_owner') btn(row, 'اعتماد وإرسال للعميل', async () => { const r = await adm('release', {id: l.id}); if (r.ok) K().openK('links'); else out.textContent = why(r); }, 'f38-primary');
    if (['waiting', 'pending_owner', 'released'].includes(l.status)) btn(row, 'إلغاء الربط', async () => { if (!W.confirm('إلغاء هذا الربط؟ لا يُحذف أي عقد.')) return; const r = await adm('unlink', {id: l.id}); if (r.ok) K().openK('links'); else out.textContent = why(r); }, 'f38-danger');
    return c;
  }
  function linkForm(host, d, KL) {
    const f = el('div', 'f38-form'); host.append(f);
    const a = fld(f, 'ماذا يحدث بعد اعتماد هذا العقد؟', 'send_contract', {options: LACT});
    const targets = [['', '— اختر —']].concat((KL?.drafts || []).map(x => ['draft:' + x.id, 'مسودة: ' + x.title])).concat((KL?.deals || []).filter(x => x.id !== d.id && x.status === 'active').map(x => ['deal:' + x.id, 'عقد قائم: ' + x.ref + ' — ' + x.title]));
    const t = fld(f, 'العقد أو الطلب التالي (المسودة تُنشر مقفلة حتى اعتماد الأول)', '', {options: targets, wide: 1}), lb = fld(f, 'نص الزر/الإشعار للعميل', '', {wide: 1, max: 300});
    const sync = () => { const need = ['send_contract', 'open_request', 'wait_owner'].includes(a.value); (t.closest('label') || t).hidden = !need; }; a.onchange = sync; sync();
    const st = el('p', 'f38-note'); f.append(st);
    const b = btn(f, 'حفظ الربط', () => busy(b, async () => { const need = ['send_contract', 'open_request', 'wait_owner'].includes(a.value); const p = {deal_id: d.id, action: a.value, label: lb.value.trim()};
      if (need) { if (!t.value) { st.textContent = 'اختر العقد أو الطلب التالي.'; return; } const [kd, id] = t.value.split(':'); if (kd === 'draft') p.draft_id = id; else p.to_deal = id; }
      if (!need && !p.label) { st.textContent = 'اكتب نص الإشعار أو رسالة الإنهاء.'; return; }
      const r = await adm('link', p); st.textContent = r.ok ? 'تم الربط' + (r.publish?.ref ? ' وإصدار العقد ' + r.publish.ref : '') + '. سيظهر للعميل بعد اعتماد العقد الحالي.' : why(r); }), 'f38-primary');
  }
  const BK = {code: 'كود الدخول', phone: 'رقم الجوال', id: 'رقم الهوية'}, BS = {all: 'منع الدخول والطلبات الجديدة', entry: 'منع الدخول', new: 'منع الطلبات والموافقات الجديدة فقط'};
  function bansPane(pane) {
    const f = el('div', 'f38-form'); pane.append(f); say(f, 'الحظر يطابق القيمة كاملة بعد توحيد صيغتها (لا تطابق جزئي)، وتُحفظ القيمة مشفرة بتجزئة ولا تُعرض كاملة. لا تختفي العقود والإيصالات السابقة.');
    const k = fld(f, 'نوع العنصر', 'code', {options: Object.entries(BK)}), v = fld(f, 'القيمة', '', {ltr: 1, max: 60}), sc = fld(f, 'نطاق الحظر', 'all', {options: Object.entries(BS)});
    const rs = fld(f, 'السبب (اختياري)', '', {max: 500, wide: 1}), dy = fld(f, 'المدة بالأيام (فارغ = حتى الرفع)', '', {type: 'number'}); const st = el('p', 'f38-note'); f.append(st);
    const b = btn(f, 'تنفيذ الحظر', () => busy(b, async () => { if (!v.value.trim()) { st.textContent = 'أدخل القيمة.'; return; } if (!W.confirm('تأكيد حظر ' + BK[k.value] + '؟')) return;
      const r = await adm('ban', {kind: k.value, value: v.value.trim(), scope: sc.value, reason: rs.value.trim(), days: Number(dy.value) || 0}); if (r.ok) { W.alert('تم الحظر. العقود المطابقة حاليًا: ' + (r.matches || 0)); K().openK('bans'); } else st.textContent = why(r); }), 'f38-danger');
    const ls = el('div'); pane.append(ls); ls.append(el('h3', '', 'حالات الحظر'));
    if (!(G.bans || []).length) say(ls, 'لا يوجد حظر.');
    (G.bans || []).forEach(x => { const c = el('article', 'f38-card'); c.append(el('b', '', BK[x.kind] + ': ' + x.hint), el('p', 'f38-muted', BS[x.scope] + (x.reason ? ' • ' + x.reason : '') + ' • ' + (x.active ? (x.until ? 'حتى ' + K().when(x.until) : 'نشط حتى الرفع') : 'مرفوع' + (x.lifted_at ? ' ' + K().when(x.lifted_at) : '')) + ' • ' + K().when(x.created_at)));
      if (x.active) btn(c, 'رفع الحظر', async () => { const note = W.prompt('ملاحظة الرفع (اختياري)', '') ; if (note === null) return; const r = await adm('lift', {id: x.id, note}); if (r.ok) K().openK('bans'); else W.alert(why(r)); }, 'f38-primary');
      ls.append(c); });
    if ((G.ban_log || []).length) { const lg = el('details', 'f38-sub'); lg.append(el('summary', '', 'سجل الحظر والرفع')); G.ban_log.forEach(x => lg.append(el('p', 'f38-muted', K().when(x.at) + ' • ' + (x.action === 'ban' ? 'حظر' : 'رفع') + ' • ' + (x.actor || 'المالك') + (x.note ? ' • ' + x.note : '')))); pane.append(lg); }
  }
  const PURGE = 'هل تريد بالفعل حذف هذا العقد نهائيًا؟ لن تتمكن من استرجاعه بعد الحذف.';
  function trashPane(pane) {
    const t = G.trash || [], dr = G.trash_drafts || [], tp = G.trash_tpls || [];
    if (!t.length && !dr.length && !tp.length) say(pane, 'المحذوفات فارغة.');
    const out = el('p', 'f38-note'); pane.append(out);
    if (t.length) pane.append(el('h3', '', 'العقود'));
    t.forEach(x => { const c = el('article', 'f38-card'); c.append(el('b', '', x.title), el('p', 'f38-muted', x.ref + ' • حُذف ' + K().when(x.trashed_at))); const row = el('div', 'f38-row'); c.append(row);
      btn(row, 'استرجاع', async () => { const r = await adm('restore', {deal_id: x.deal_id}); if (r.ok) K().openK('trash'); else out.textContent = why(r); }, 'f38-primary');
      btn(row, 'حذف نهائي', () => modal(PURGE, 'نعم، حذف نهائي', 'إلغاء', async () => { const r = await adm('purge', {deal_id: x.deal_id}); if (r.ok) { if (r.retained) W.alert(r.note); K().openK('trash'); } else out.textContent = why(r); }), 'f38-danger'); pane.append(c); });
    if (dr.length) pane.append(el('h3', '', 'المسودات'));
    dr.forEach(x => { const c = el('article', 'f38-card'); c.append(el('b', '', x.title || 'مسودة'), el('p', 'f38-muted', 'آخر تعديل ' + K().when(x.updated_at))); const row = el('div', 'f38-row'); c.append(row);
      btn(row, 'استرجاع', async () => { const r = await adm('draft_restore', {id: x.id}); if (r.ok) K().openK('trash'); else out.textContent = why(r); }, 'f38-primary');
      btn(row, 'حذف نهائي', () => modal(PURGE, 'نعم، حذف نهائي', 'إلغاء', async () => { const r = await adm('draft_purge', {id: x.id}); if (r.ok) K().openK('trash'); else out.textContent = why(r); }), 'f38-danger'); pane.append(c); });
    if (tp.length) pane.append(el('h3', '', 'القوالب'));
    tp.forEach(x => { const c = el('article', 'f38-card'); c.append(el('b', '', x.name), el('p', 'f38-muted', 'حُذف ' + K().when(x.deleted_at)));
      btn(c, 'استرجاع', async () => { const r = await adm('tpl_restore', {id: x.id}); if (r.ok) K().openK('trash'); else out.textContent = why(r); }, 'f38-primary'); pane.append(c); });
  }
  /* per-contract settings editor (used for drafts and for published deals) */
  function cfgEditor(sec, cfg) {
    cfg = cfg || {}; const g = cfg.goods || {}, p = cfg.pay || {}, T = cfg.texts || {};
    const gs = sec('السلعة / المبايعة (اختياري)');
    const G2 = {name: fld(gs, 'اسم السلعة', g.name, {max: 200}), no: fld(gs, 'رقم السلعة', g.no, {max: 60}), desc: fld(gs, 'وصف السلعة', g.desc, {area: 1, rows: 3, wide: 1, max: 4000}),
      price: fld(gs, 'سعر السلعة (ريال)', g.price, {type: 'number'}), sale_price: fld(gs, 'سعر البيع (ريال)', g.sale_price, {type: 'number'}), buy_price: fld(gs, 'سعر الشراء (ريال)', g.buy_price, {type: 'number'}),
      share_price: fld(gs, 'سعر السهم (ريال)', g.share_price, {type: 'number'}), share_count: fld(gs, 'عدد الأسهم', g.share_count, {type: 'number'}), offer_until: fld(gs, 'صلاحية العرض حتى (تمنع الموافقة بعدها)', g.offer_until, {type: 'datetime-local'}),
      seller: fld(gs, 'بيانات البائع', g.seller, {max: 300, wide: 1}), buyer: fld(gs, 'بيانات المشتري', g.buyer, {max: 300, wide: 1}), video_url: fld(gs, 'رابط مقطع الفيديو', g.video_url, {ltr: 1, wide: 1, ph: 'https://…'}),
      docs: fld(gs, 'روابط المستندات (رابط في كل سطر)', (g.docs || []).join('\n'), {area: 1, rows: 2, wide: 1, ltr: 1}), terms: fld(gs, 'شروط الاتفاق والملاحظات', g.terms, {area: 1, rows: 3, wide: 1, max: 4000})};
    const tot = say(gs, ''); const upd = () => { const t = (Number(G2.share_price.value) || 0) * (Number(G2.share_count.value) || 0); tot.textContent = t ? 'إجمالي قيمة الأسهم: ' + money(t) + ' ريال' : ''; }; G2.share_price.oninput = G2.share_count.oninput = upd; upd();
    say(gs, 'سعر السلعة منفصل عن الأتعاب والخصومات؛ مبالغ السداد تُضبط من قسم السداد.');
    const imgs = (G?.assets || []).filter(a => /^image\//.test(a.mime)); const IM = {};
    if (imgs.length) { const box = el('div', 'f52-checks'); box.append(el('small', '', 'صور السلعة (من الصور المرفوعة في «التصميم»)')); imgs.forEach(a => { IM[a.id] = fld(box, a.name, (g.images || []).includes(a.id), {type: 'checkbox'}); }); gs.append(box); }
    else say(gs, 'لإضافة صور السلعة ارفعها أولًا من تبويب «التصميم».');
    const fs = sec('حقول وأسئلة إضافية للعميل'); const FR = [];
    const addF = x => { const r = el('div', 'f52-lrow'); fs.insertBefore(r, addFB); const o = {label: fld(r, 'السؤال', x.label || '', {max: 120}), type: fld(r, 'النوع', x.type || 'text', {options: [['text', 'نص'], ['number', 'رقم'], ['date', 'تاريخ'], ['checkbox', 'تأكيد'], ['phone', 'جوال'], ['id', 'هوية'], ['iban', 'آيبان']]}), required: fld(r, 'إلزامي', !!x.required, {type: 'checkbox'})};
      btn(r, 'إزالة', () => { r.remove(); FR.splice(FR.indexOf(o), 1); }); FR.push(o); };
    const addFB = btn(fs, '+ إضافة سؤال', () => addF({})); (cfg.fields || []).forEach(addF);
    const ps = sec('وسائل الدفع لهذا العقد (اختياري؛ فارغ = الإعداد العام)');
    const P2 = {bank_name: fld(ps, 'اسم البنك', p.bank_name, {max: 80}), holder: fld(ps, 'اسم المستفيد', p.holder, {max: 120}), iban: fld(ps, 'الآيبان (SA + 22 رقمًا)', p.iban, {ltr: 1, max: 34}),
      bank_image: assetSelect(ps, 'صورة الحساب البنكي', p.bank_image, true), salla_url: fld(ps, 'رابط الدفع المباشر (سلة)', p.salla_url, {ltr: 1, wide: 1, ph: 'https://salla.sa/…'}),
      show_bank: fld(ps, 'إظهار التحويل البنكي', p.show_bank !== false, {type: 'checkbox'}), show_salla: fld(ps, 'إظهار زر الدفع المباشر', p.show_salla !== false, {type: 'checkbox'})};
    const pt = fld(ps, 'نص صفحة الدفع (اختياري)', cfg.pay_text, {area: 1, rows: 2, wide: 1, max: 2000}), hb = fld(ps, 'إخفاء نص العقد في صفحة الدفعات خلف أيقونة العين', !!cfg.hide_body_on_pay, {type: 'checkbox'}), cu = fld(ps, 'السماح للعميل بإرفاق مستندات', !!cfg.client_upload, {type: 'checkbox'});
    const ts = sec('نصوص هذا العقد (اختياري؛ فارغ = النص العام)'); say(ts, VARS); const TI = {};
    TXT.forEach(([k, label]) => { const m = T[k] || {}; TI[k] = {t: fld(ts, label, m.t || '', {area: k !== 'btn', rows: 2, wide: 1, max: 4000}), off: fld(ts, 'إخفاء هذه الرسالة', m.on === false, {type: 'checkbox'})}; });
    const rs = sec('أزرار بعد استخدام الكود (دعم/تواصل/صيانة/إجراء جديد)'); const RB = fld(rs, 'زر في كل سطر: النص | الرابط', (cfg.reentry_buttons || []).map(b => b.label + ' | ' + b.url).join('\n'), {area: 1, rows: 3, wide: 1, ph: 'تواصل معنا | https://wa.me/966…'});
    const ds = sec('الشعار وصورة الشركة والخلفية لهذا العقد'); const DG = merge(DDEF, merge(S?.design || {}, cfg.design || {}));
    const DOV = fld(ds, 'تصميم خاص لهذا العقد (غير مفعّل = التصميم العام)', !!cfg.design, {type: 'checkbox'});
    const DLO = fld(ds, 'إظهار الشعار / صورة الشركة', DG.logo.on, {type: 'checkbox'}), DLS = fld(ds, 'المصدر', DG.logo.src, {options: [['fino', 'شعار FINO99 الحالي'], ['file', 'صورة مرفوعة']]}), DLF = assetSelect(ds, 'الصورة المرفوعة', DG.logo.file, true);
    const DBO = fld(ds, 'إظهار الخلفية / العلامة المائية', DG.bg.on, {type: 'checkbox'}), DBF = assetSelect(ds, 'صورة الخلفية', DG.bg.file, true), DBP = fld(ds, 'الشفافية (0.02–1؛ القليل = علامة مائية)', DG.bg.opacity, {type: 'number'});
    say(ds, 'ترفع الصور من تبويب «التصميم». يظهر التصميم للعميل وفي نسخة PDF، والنسخ المعتمدة سابقًا تبقى بتصميمها وقت الاعتماد.');
    return () => {
      const goods = {}; Object.entries(G2).forEach(([k, i]) => { const v = i.value.trim(); if (k === 'docs') { const L = v.split('\n').map(x => x.trim()).filter(okUrl); if (L.length) goods.docs = L; } else if (v) goods[k] = ['price', 'sale_price', 'buy_price', 'share_price', 'share_count'].includes(k) ? Number(v) : v; });
      const gi = Object.keys(IM).filter(id => IM[id].checked); if (gi.length) goods.images = gi; else if (!imgs.length && (g.images || []).length) goods.images = g.images;
      const texts = {}; Object.entries(TI).forEach(([k, o]) => { const v = o.t.value.trim(); if (o.off.checked) texts[k] = {t: v, on: false, c: (S?.texts?.[k]?.c) || '#15803d', i: (S?.texts?.[k]?.i) || ''}; else if (v) texts[k] = {t: v, on: true, c: (S?.texts?.[k]?.c) || '#15803d', i: (S?.texts?.[k]?.i) || ''}; });
      const pay = {}; Object.entries(P2).forEach(([k, i]) => { pay[k] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
      const fields = FR.map((o, i) => ({key: 'q' + (i + 1), label: o.label.value.trim(), type: o.type.value, required: o.required.checked})).filter(x => x.label);
      const reentry = RB.value.split('\n').map(l => { const [a, b] = l.split('|').map(x => (x || '').trim()); return {label: a, url: b}; }).filter(x => x.label && okUrl(x.url));
      const o = {texts, pay, fields, reentry_buttons: reentry, pay_text: pt.value.trim(), hide_body_on_pay: hb.checked, client_upload: cu.checked};
      if (Object.keys(goods).length) o.goods = goods; if (DOV.checked) o.design = Object.assign({}, cfg.design || {}, {logo: Object.assign({}, DG.logo, {on: DLO.checked, src: DLS.value, file: DLF.value}), bg: Object.assign({}, DG.bg, {on: DBO.checked, file: DBF.value, opacity: Math.min(1, Math.max(0.02, Number(DBP.value) || 0.08))})}); return o;
    };
  }
  function editor(f, sec, data, bodyF, tp, title) {
    addReasons(); toolbar(f, bodyF);
    const holder = el('div'); f.append(holder); let col = null;
    const draw = () => { holder.textContent = ''; const sec2 = t => { const s = el('fieldset', 'f38-fs'); s.append(el('legend', '', t)); holder.append(s); return s; }; col = cfgEditor(sec2, data.r52 || {}); };
    ensureS().then(ok => { if (ok !== true) say(holder, why(ok), 'f38-err'); draw(); });
    return {collect: () => (col ? col() : (data.r52 || {})),
      acts: (act, collect, st) => { btn(act, 'حفظ كقالب', async ev => { const x = collect(); const name = W.prompt('اسم القالب', x.title || ''); if (!name) return; ev.target.disabled = true;
        const r = await adm('tpl_save_as', {template_id: x.template_id, name, body: x.body}); ev.target.disabled = false; st.textContent = r.ok ? 'حُفظ قالب جديد باسم «' + name + '».' : why(r); }); }};
  }
  function previewCtx(pv, x) { ctx = {design: merge(S?.design || {}, x.r52?.design || {}), fetch: ownerFetch, ref: 'معاينة', goods: x.r52?.goods || null, files: []}; srcCache.clear(); if (x.r52?.goods?.name) pv.append(goodsCard(x.r52.goods)); }
  async function ownerCtx(d) {
    await ensureS(); const r = await adm('deal_get', {deal_id: d.id}); const cfg = r.ok ? r.cfg || {} : {};
    ctx = {design: merge(S?.design || {}, cfg.design || {}), fetch: ownerFetch, ref: d.ref, goods: cfg.goods || null, files: r.ok ? (r.files || []).filter(f => f.printable) : [], bankImage: ''}; srcCache.clear();
  }
  function dealButtons(row, d, out) {
    btn(row, 'عرض', () => dealSheet(d, 'view')); btn(row, 'تعديل', () => dealSheet(d, 'edit')); btn(row, 'ربط', () => dealSheet(d, 'link')); btn(row, 'الدفعات والمرفقات', () => dealSheet(d, 'pay')); if (d.r38 && K().accessPane) btn(row, 'الدخول والحماية', () => dealSheet(d, 'access'));
    if (d.status === 'active') btn(row, 'إلغاء', async () => { const note = W.prompt('سبب إلغاء العقد (يبقى سجل الموافقات السابقة محفوظًا)', ''); if (note === null) return;
      const r = await K().adm('f99k_owner_act', {p_deal_id: d.id, p_action: 'cancel', p_data: {note}}); out.textContent = ''; say(out, r.ok ? 'أُلغي العقد وأُوقف التعامل عليه.' : why(r), r.ok ? 'f38-ok' : 'f38-err'); });
    btn(row, 'حذف', async () => { if (!W.confirm('نقل العقد ' + d.ref + ' إلى المحذوفات؟ يمكنك استرجاعه لاحقًا.')) return; const r = await adm('trash', {deal_id: d.id}); if (r.ok) K().openK(); else { out.textContent = ''; say(out, why(r), 'f38-err'); } }, 'f38-danger');
  }
  async function dealSheet(d, tab) {
    addReasons(); const body = K().sheet('العقد ' + d.ref + ' — ' + d.title, true); back(body); const wt = say(body, 'جاري التحميل…');
    const ok = await ensureS(true); const r = await adm('deal_get', {deal_id: d.id}); wt.remove(); if (ok !== true || !r.ok) { say(body, why(ok !== true ? ok : r), 'f38-err'); return; }
    let KL = null; const kl = async () => { if (!KL) { KL = await K().adm('f99r38_owner_k', {p_action: 'list', p_data: {}}); } return KL; };
    K().tabs(body, [['view', 'عرض'], ['edit', 'تعديل']].concat(K().accessPane ? [['access', 'الدخول والحماية']] : [], [['pay', 'الدفعات'], ['files', 'المرفقات'], ['link', 'ربط']]), tab || 'view', async (k, pane) => {
      if (k === 'access') { await K().accessPane(pane, d); return; }
      if (k === 'view') { pane.append(el('p', 'f38-muted', 'الحالة: ' + ({active: 'نشط', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغى'}[r.status] || r.status) + ' • الإصدار ' + r.version + ' • سجلات الإصدارات ' + r.hist));
        const m = r.money || {}; const g = el('div', 'f38-money'); [['الإجمالي', m.total], ['المدفوع', m.paid], ['المتبقي', m.remaining], ['المطلوب الآن', m.due_now]].forEach(([t, n]) => { const x = el('div'); x.append(el('small', '', t), el('b', '', money(n) + ' ريال')); g.append(x); }); pane.append(g);
        const od = await K().adm('f99k_owner_deal', {p_deal_id: d.id}); const txt = od?.deal?.body || od?.body || od?.versions?.[0]?.body || '';
        await ownerCtx(d); btn(pane, 'PDF للمالك', () => K().printDoc(d.title, d.ref + ' • الإصدار ' + d.version, txt, 'نسخة المالك • ' + d.ref), 'f38-primary');
        if (r.cfg?.goods?.name) pane.append(goodsCard(r.cfg.goods)); if (txt) K().pages(pane, d.title, txt, false); return; }
      if (k === 'edit') { const sec = t => { const s = el('fieldset', 'f38-fs'); s.append(el('legend', '', t)); pane.append(s); return s; }; const col = cfgEditor(sec, r.cfg || {}); const st = el('p', 'f38-note'); pane.append(st);
        const b = btn(pane, 'حفظ إعدادات العقد', () => busy(b, async () => { const q = await adm('deal_save', {deal_id: d.id, cfg: col()}); st.textContent = q.ok ? 'حُفظت الإعدادات (تحفظ نسخة سابقة في السجل).' : why(q); }), 'f38-primary');
        if (r.status === 'active') { const od = await K().adm('f99k_owner_deal', {p_deal_id: d.id}); const s = sec('تعديل نص العقد (يصدر إصدارًا جديدًا)'); say(s, 'يُنشأ إصدار جديد ويُطلب من الأطراف الموافقة عليه من جديد، وتبقى نسخة الاعتماد السابقة محفوظة دون تعديل.');
          const ta = fld(s, 'النص', od?.deal?.body || od?.body || '', {area: 1, rows: 12, wide: 1}); toolbar(s, ta); const st2 = el('p', 'f38-note'); s.append(st2);
          const b2 = btn(s, 'إصدار نسخة معدلة', () => { if (!W.confirm('إصدار نسخة معدلة؟ ستلزم موافقة الأطراف من جديد.')) return; busy(b2, async () => { const q = await K().adm('f99k_owner_act', {p_deal_id: d.id, p_action: 'set_text', p_data: {body: ta.value}}); st2.textContent = q.ok ? 'صدر الإصدار الجديد.' : why(q); }); }, 'f38-danger'); }
        return; }
      if (k === 'pay') { const m = r.money || {}; say(pane, 'الإجمالي ' + money(m.total) + ' • المدفوع ' + money(m.paid) + ' • المتبقي ' + money(m.remaining) + ' ريال. الإجمالي التعاقدي لا يتغير من هنا؛ تغييره يتطلب إصدارًا معدلًا وموافقة الأطراف.');
        (r.payreq || []).forEach(q => { const p = el('p', 'f52-asset'); p.append(el('span', '', (q.label || 'دفعة') + ' • ' + money(q.amount) + ' ريال • ' + (q.status === 'open' ? 'مطلوبة' : 'ملغاة') + ' • ' + K().when(q.created_at)));
          if (q.status === 'open') btn(p, 'إلغاء الطلب', async () => { const x = await adm('payreq_cancel', {id: q.id}); if (x.ok) dealSheet(d, 'pay'); else W.alert(why(x)); }); pane.append(p); });
        if (r.status === 'active') { const f = el('div', 'f38-form'); pane.append(f); const am = fld(f, 'مبلغ الدفعة (ريال)', '', {type: 'number'}), lb = fld(f, 'وصف الدفعة', '', {max: 200}); const st = el('p', 'f38-note'); f.append(st);
          const b = btn(f, 'طلب دفعة من العميل', () => busy(b, async () => { const x = await adm('payreq', {deal_id: d.id, amount: Number(am.value), label: lb.value.trim()}); if (x.ok) dealSheet(d, 'pay'); else st.textContent = why(x); }), 'f38-primary'); }
        say(pane, 'مراجعة الإيصالات واعتمادها أو رفضها من زر «السداد والإيصالات» في بطاقة العقد. الدفع عبر سلة يُراجع يدويًا لعدم وجود ربط تقني للتحقق.'); return; }
      if (k === 'files') { const VIS = {always: 'دائمًا', before: 'قبل الموافقة', after: 'بعد الموافقة', owner: 'للمالك فقط'};
        (r.files || []).forEach(x => { const p = el('p', 'f52-asset'); p.append(el('span', '', x.name + ' • ' + (x.by_client ? 'من العميل' : VIS[x.visible]) + (x.printable ? ' • يطبع' : ''))); btn(p, 'فتح', () => openFile(ownerFetch, x.id));
          btn(p, 'حذف', async () => { if (!W.confirm('حذف المرفق؟')) return; await adm('file_del', {id: x.id}); dealSheet(d, 'files'); }, 'f38-danger'); pane.append(p); });
        const f = el('div', 'f38-form'); pane.append(f); const fi = el('input'); fi.type = 'file'; fi.accept = MIMES.join(','); f.append(fi);
        const vs = fld(f, 'يظهر للعميل', 'always', {options: Object.entries(VIS)}), pr = fld(f, 'يُضمّن في PDF (الصور)', true, {type: 'checkbox'}); const st = el('p', 'f38-note'); f.append(st);
        const b = btn(f, 'إرفاق', () => busy(b, async () => { const x = await readFile(fi.files?.[0], MIMES); if (x.err) { st.textContent = x.err; return; } const q = await adm('file_put', {deal_id: d.id, name: x.name, mime: x.mime, b64: x.b64, visible: vs.value, printable: pr.checked}); if (q.ok) dealSheet(d, 'files'); else st.textContent = why(q); }), 'f38-primary'); return; }
      if (k === 'link') { linkForm(pane, d, await kl()); (G.links || []).filter(l => l.from_ref === d.ref || l.to_ref === d.ref).forEach(l => pane.append(linkCard(l))); }
    });
  }
  W.F99R52K = Object.freeze({version: 'r52a', split, render, decorate, print, party, bodyHost, btnLabel, doneMsg, partyEnd, payPatch, bankExtra, centerExtra,
    ownerTabs, ownerPane, dealButtons, editor, previewCtx, ownerCtx, _blocks: blocks});
})(window, document);
