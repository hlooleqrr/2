/* FINO99 bot text templates core (round 22).
 * Contract: callers keep their ORIGINAL text as the fallback. Without an owner
 * override the fallback is returned unchanged, so behaviour is identical to
 * the original. Owner overrides are plain text only (never HTML/code); the
 * only dynamic parts are whitelisted {variables} declared per key.
 *
 *   F99T(key, vars, fallbackText)      -> plain string
 *   F99T.html(key, vars, fallbackHtml) -> HTML string (override escaped)
 *   F99Texts.register(defs)            -> defs: [{key, category, label, text, vars, note}]
 *   Optional def.allowHide=true permits enabled=false to hide an optional sentence.
 *   Required/unflagged sentences retain their original fallback when disabled.
 *   F99Texts.setOverrides(map, meta)   -> map: {key: {text, enabled}}
 */
(function () {
  'use strict';
  if (window.F99Texts && window.F99Texts.__core === 1) return;

  var KEY_RE = /^[a-z0-9][a-z0-9_.-]{2,79}$/;
  var VAR_RE = /\{([a-z][a-z0-9_]{1,29})\}/g;
  var MAX_LEN = 1200;
  var CACHE_KEY = 'f99t_overrides_v1';
  var registry = new Map();
  var overrides = Object.create(null);
  var meta = { version: 0, source: 'none' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hasOwn(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k); }
  function placeholders(text) {
    var out = []; String(text).replace(VAR_RE, function (m, n) { out.push(n); return m; }); return out;
  }

  function validate(key, text) {
    var errors = [];
    var def = registry.get(key);
    if (!KEY_RE.test(String(key || ''))) errors.push('مفتاح غير صالح');
    if (!def) errors.push('العبارة غير معرّفة في السجل');
    if (typeof text !== 'string' || !text.trim()) errors.push('النص فارغ');
    else {
      if (text.length > MAX_LEN) errors.push('النص أطول من ' + MAX_LEN + ' حرف');
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) errors.push('النص يحتوي رموز تحكم');
      if (/<\s*\/?\s*[a-z!]/i.test(text)) errors.push('غير مسموح بوسوم HTML أو شيفرة');
      if (/javascript:|expression\s*\(|@import|url\s*\(|\b(?:eval|Function|alert|confirm|prompt|fetch|setTimeout|setInterval)\s*\(|=>|\b(?:document|window|console)\s*\.|\b(?:const|let|var)\s+\w+\s*=/i.test(text)) errors.push('غير مسموح بأوامر البرمجة');
      if (/\{\{|\}\}|\$\{/.test(text)) errors.push('صيغة متغير غير مسموحة؛ استخدم {اسم_المتغير}');
      var allowed = (def && def.vars) || [];
      if (/[{}]/.test(text.replace(/\{([a-z][a-z0-9_]{1,29})\}/g, ''))) errors.push('صيغة متغير غير صالحة');
      placeholders(text).forEach(function (n) {
        if (allowed.indexOf(n) < 0) errors.push('متغير غير مسموح: {' + n + '}');
      });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function activeOverride(key) {
    var o = overrides[key];
    if (!o || o.enabled === false || typeof o.text !== 'string') return null;
    if (!registry.has(key)) return o.text; // registered later; validated on save server-side
    return validate(key, o.text).ok ? o.text : null;
  }

  function fill(text, vars) {
    var missing = false;
    var out = String(text).replace(VAR_RE, function (m, n) {
      if (!hasOwn(vars, n) || vars[n] === null || vars[n] === undefined || String(vars[n]).trim() === '') {
        missing = true; return m;
      }
      return String(vars[n]);
    });
    return missing ? null : out;
  }

  function T(key, vars, fallback) {
    try {
      if (registry.get(key)?.allowHide === true && overrides[key]?.enabled === false) return '';
      var o = activeOverride(key);
      if (o !== null) {
        var filled = fill(o, vars || {});
        if (filled !== null) return filled;
      }
    } catch (_) { /* never break the chat because of a template */ }
    if (fallback !== undefined) return fallback;
    var def = registry.get(key);
    if (def) { var d = fill(def.text, vars || {}); if (d !== null) return d; }
    return '';
  }

  T.html = function (key, vars, fallbackHtml) {
    try {
      if (registry.get(key)?.allowHide === true && overrides[key]?.enabled === false) return '';
      var o = activeOverride(key);
      if (o !== null) {
        var safeVars = {};
        Object.keys(vars || {}).forEach(function (k) { safeVars[k] = vars[k] == null ? vars[k] : esc(vars[k]); });
        var filled = fill(esc(o), safeVars);
        if (filled !== null) return filled.replace(/\r?\n/g, '<br>');
      }
    } catch (_) { /* keep original */ }
    if (fallbackHtml !== undefined) return fallbackHtml;
    var def = registry.get(key);
    if (def) { var d = fill(esc(def.text), vars || {}); if (d !== null) return d.replace(/\r?\n/g, '<br>'); }
    return '';
  };

  T.isOverridden = function (key) { return activeOverride(key) !== null; };

  function register(defs) {
    (Array.isArray(defs) ? defs : [defs]).forEach(function (d) {
      if (!d || !KEY_RE.test(String(d.key || '')) || typeof d.text !== 'string') return;
      var prev = registry.get(d.key) || {};
      registry.set(d.key, {
        key: d.key,
        category: String(d.category || prev.category || 'عام'),
        label: String(d.label || prev.label || d.key),
        text: d.text,
        vars: Array.isArray(d.vars) ? d.vars.slice(0, 12) : (prev.vars || []),
        note: d.note ? String(d.note) : (prev.note || ''),
        allowHide: d.allowHide === true || (d.allowHide === undefined && prev.allowHide === true)
      });
    });
    try { window.dispatchEvent(new CustomEvent('f99t:registry')); } catch (_) {}
  }

  function setOverrides(map, m) {
    var next = Object.create(null);
    Object.keys(map || {}).forEach(function (k) {
      var v = map[k];
      if (KEY_RE.test(k) && v && typeof v.text === 'string' && v.text.length <= MAX_LEN) {
        next[k] = { text: v.text, enabled: v.enabled !== false };
      }
    });
    overrides = next;
    meta = { version: Number((m && m.version) || 0), source: (m && m.source) || 'central' };
    try {
      if (meta.source === 'central') localStorage.setItem(CACHE_KEY, JSON.stringify({ v: meta.version, o: overrides }));
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('f99t:changed', { detail: { version: meta.version } })); } catch (_) {}
  }

  // Instant availability from the last central copy; central reload replaces it.
  try {
    var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.o) setOverrides(cached.o, { version: cached.v, source: 'cache' });
  } catch (_) {}

  window.F99T = T;
  window.F99Texts = {
    __core: 1,
    register: register,
    setOverrides: setOverrides,
    validate: validate,
    escape: esc,
    placeholders: placeholders,
    list: function () { return Array.from(registry.values()); },
    get: function (k) { return registry.get(k) || null; },
    overrides: function () { return JSON.parse(JSON.stringify(overrides)); },
    meta: function () { return Object.assign({}, meta); },
    MAX_LEN: MAX_LEN
  };

  var q = window.F99TextsQueue;
  if (Array.isArray(q)) q.forEach(register);
  window.F99TextsQueue = { push: register };
})();
