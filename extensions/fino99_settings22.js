/* FINO99 round 22 shared owner settings (presentation only).
 * Never blocks the page; when central is unavailable or a key is unset every
 * caller must fall back to the ORIGINAL behaviour.
 *
 *   F99Settings.ready                      -> Promise (first central load attempt)
 *   F99Settings.value(key)                 -> object ({} when unset)
 *   F99Settings.packageOption(id, name, d) -> per-package option or default d
 *   F99Settings.onChange(fn)               -> fn(items) after cache/central/save
 *   F99Settings.refresh()                  -> force a central re-read
 *   Owner: adminGet(key) / adminSave(key, value, expectedVersion) /
 *          adminRestore(key, version, expectedVersion)   (version 0 = original)
 */
(function () {
  'use strict';
  if (window.F99Settings && window.F99Settings.__v === 1) return;

  var CACHE = 'f99s22_public_v1';
  var items = {};
  var source = 'none';
  var listeners = [];
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });
  var inflight = null;

  function emit() {
    listeners.slice().forEach(function (fn) { try { fn(items); } catch (_) {} });
    try { window.dispatchEvent(new CustomEvent('f99settings:changed', { detail: { source: source } })); } catch (_) {}
  }

  function applyTexts() {
    if (!window.F99Texts) return;
    var bt = items.bot_texts;
    var overrides = bt && bt.value && bt.value.overrides && typeof bt.value.overrides === 'object' ? bt.value.overrides : {};
    window.F99Texts.setOverrides(overrides, { version: bt ? bt.version : 0, source: source === 'central' ? 'central' : 'cache' });
  }

  function apply(next, from) {
    items = next && typeof next === 'object' ? next : {};
    source = from;
    applyTexts();
    emit();
  }

  try {
    var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (cached && cached.items && typeof cached.items === 'object') apply(cached.items, 'cache');
  } catch (_) {}

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function rpcFn(name) {
    for (var i = 0; i < 100 && typeof window[name] !== 'function'; i++) await wait(50);
    return typeof window[name] === 'function' ? window[name] : null;
  }

  function load() {
    if (inflight) return inflight;
    inflight = (async function () {
      try {
        var rpc = await rpcFn('finoRpc');
        if (!rpc) return { ok: false, reason: 'NO_RPC' };
        var r = await rpc('f99r22_settings_public', {}, 8000);
        if (r && r.ok && r.data && r.data.ok === true) {
          apply(r.data.items || {}, 'central');
          try { localStorage.setItem(CACHE, JSON.stringify({ items: items, t: Date.now() })); } catch (_) {}
          return { ok: true };
        }
        return { ok: false, reason: 'LOAD_FAILED' };
      } catch (_) {
        return { ok: false, reason: 'LOAD_FAILED' };
      } finally {
        inflight = null;
        readyResolve();
      }
    })();
    return inflight;
  }

  function value(key) {
    var it = items[key];
    return it && it.value && typeof it.value === 'object' ? it.value : {};
  }

  function packageOption(id, name, dflt) {
    var all = value('package_options');
    var p = id != null && all[String(id)];
    return p && Object.prototype.hasOwnProperty.call(p, name) && p[name] !== null ? p[name] : dflt;
  }

  async function adminCall(fn, args) {
    var call = await rpcFn('finoCentralAdminCall');
    if (!call) return { ok: false, reason: 'NO_ADMIN_RPC' };
    var r = await call(fn, args);
    if (!r || !r.ok) return { ok: false, reason: (r && (r.reason || (r.error && r.error.message))) || 'CENTRAL_UNAVAILABLE' };
    return r.data && typeof r.data === 'object' ? r.data : { ok: false, reason: 'BAD_RESPONSE' };
  }

  async function afterWrite(res, key) {
    if (res && res.ok && key !== 'owner_layout') await load();
    return res;
  }

  window.F99Settings = {
    __v: 1,
    ready: ready,
    value: value,
    packageOption: packageOption,
    source: function () { return source; },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    refresh: load,
    adminGet: function (key) { return adminCall('f99r22_admin_settings_get', { p_key: key }); },
    adminSave: async function (key, val, expectedVersion) {
      return afterWrite(await adminCall('f99r22_admin_settings_save', { p_key: key, p_value: val, p_expected_version: expectedVersion }), key);
    },
    adminRestore: async function (key, version, expectedVersion) {
      return afterWrite(await adminCall('f99r22_admin_settings_restore', { p_key: key, p_version: version, p_expected_version: expectedVersion }), key);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { load(); }, { once: true });
  else load();
})();
