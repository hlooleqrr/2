/* FINO99 public-read performance layer. No storage, fetch patch, auth changes,
 * timers, DOM scans, or database writes. Load before the root classic script,
 * then call F99Performance.install(window) at that script's first statement.
 */
(function (w) {
  'use strict';
  if (w.F99Performance) return;

  // Verified STABLE read-only SQL; do not expand by naming heuristics.
  // Financial snapshots are deliberately NEVER served from a settled cache.
  const policies = Object.freeze({
    fino_public_settings: Object.freeze({ ttl: 5000, args: [] }),
    f99v25_public_completion_offers: Object.freeze({ ttl: 5000, args: [] }),
    f99v32_live_snapshot: Object.freeze({ ttl: 0, args: ['p_package_key'] })
  });
  const MAX_ENTRIES = 32;
  const MAX_ENTRY_BYTES = 256 * 1024;
  const MAX_CACHE_BYTES = 1024 * 1024;
  const cache = new Map();
  const inFlight = new Map();
  const receiverIds = new WeakMap();
  let nextReceiverId = 0;
  let cacheBytes = 0;
  let generation = 0;
  let original = null;
  let host = null;
  let wrapped = null;
  const stats = { networkReads: 0, cacheHits: 0, coalesced: 0, bypassed: 0, invalidations: 0, staleBlocked: 0 };
  const now = () => w.performance && typeof w.performance.now === 'function' ? w.performance.now() : Date.now();

  function invalidate() {
    generation += 1;
    cache.clear();
    cacheBytes = 0;
    // Do not abort transport: existing failures/timeouts must remain visible.
    // Detach old promises, so later reads cannot join a pre-write request.
    inFlight.clear();
    stats.invalidations += 1;
    return generation;
  }

  function succeeded(result) {
    return result && result.ok === true && result.data?.ok !== false && !result.error;
  }

  function publicSuccess(result) {
    return succeeded(result) && result.data?.ok === true;
  }

  function clone(value) {
    if (typeof w.structuredClone === 'function') return w.structuredClone(value);
    // Root finoRpc returns parsed JSON envelopes, never Response objects.
    return JSON.parse(JSON.stringify(value));
  }

  function receiverKey(receiver) {
    // The actual root is a non-strict classic function: bare and window calls
    // have the same effective receiver. The invocation still uses exact this.
    const effective = receiver == null ? host : receiver;
    if ((typeof effective === 'object' && effective !== null) || typeof effective === 'function') {
      if (!receiverIds.has(effective)) receiverIds.set(effective, ++nextReceiverId);
      return 'o' + receiverIds.get(effective);
    }
    return typeof effective + ':' + String(effective);
  }

  function safeCall(call) {
    try { return inspectSafeCall(call); }
    catch (_) { return null; } // Proxies/exotic objects retain root semantics.
  }

  function inspectSafeCall(call) {
    const name = call[0];
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(policies, name) || call.length > 3) return null;
    const policy = policies[name];
    const timeout = call[2] === undefined ? 12000 : call[2];
    // Never let a longer transport hide a shorter caller's timeout. Exotic
    // argument/timeout coercions pass through to the original unchanged.
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0 || timeout > 120000) return null;
    const args = call[1] == null ? {} : call[1];
    if (typeof args !== 'object' || Array.isArray(args)) return null;
    const proto = Object.getPrototypeOf(args);
    // Accept plain JSON objects across realms, but not custom prototypes.
    if (proto !== null && (Object.getPrototypeOf(proto) !== null ||
      Object.getOwnPropertyDescriptor(proto, 'constructor')?.value?.name !== 'Object')) return null;
    const keys = Reflect.ownKeys(args);
    const clean = {};
    for (const key of keys) {
      if (typeof key !== 'string' || !policy.args.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(args, key);
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      const value = descriptor.value;
      if (key === 'p_package_key' && (typeof value !== 'string' || value.length > 120 || (value !== '' && !/^[A-Za-z0-9_:-]+$/.test(value)))) return null;
      clean[key] = value;
    }
    return { name, policy, timeout, serialized: JSON.stringify(clean) };
  }

  function deleteCached(key) {
    const entry = cache.get(key);
    if (!entry) return;
    cacheBytes -= entry.bytes;
    cache.delete(key);
  }

  function putCached(key, result, ttl) {
    // Estimate UTF-16 heap size conservatively; no unbounded response storage.
    const bytes = JSON.stringify(result).length * 2;
    if (bytes > MAX_ENTRY_BYTES) return;
    const time = now();
    for (const [oldKey, entry] of cache) if (entry.expires <= time) deleteCached(oldKey);
    deleteCached(key);
    while (cache.size >= MAX_ENTRIES || cacheBytes + bytes > MAX_CACHE_BYTES) deleteCached(cache.keys().next().value);
    cache.set(key, { value: clone(result), expires: time + ttl, bytes });
    cacheBytes += bytes;
  }

  function blockedStale() {
    stats.staleBlocked += 1;
    return { ok: false, performanceStale: true, error: 'F99_PUBLIC_READ_INVALIDATED',
      data: { ok: false, reason: 'F99_PUBLIC_READ_INVALIDATED' } };
  }

  function bypass(receiver, call, safe, fresh) {
    stats.bypassed += 1;
    // Unknown/protected calls may write even if their names sound like reads.
    // Fence at both dispatch and successful completion, conservatively.
    const publicName = typeof call[0] === 'string' && Object.prototype.hasOwnProperty.call(policies, call[0]);
    const mayWrite = !publicName || !safe;
    if (mayWrite) invalidate();
    const startedGeneration = generation;
    const promise = Reflect.apply(original, receiver, call);
    return Promise.resolve(promise).then(result => {
      if (mayWrite) {
        if (succeeded(result)) invalidate();
        return result;
      }
      // Forced fresh read remains a network request and never fills a cache.
      if (fresh && publicSuccess(result) && startedGeneration !== generation) return blockedStale();
      return result;
    });
  }

  function read(receiver, call, forceFresh) {
    const safe = safeCall(call);
    if (forceFresh || !safe) return bypass(receiver, call, safe, forceFresh);
    const key = receiverKey(receiver) + '|' + safe.name + '|' + safe.serialized + '|' + safe.timeout;
    const time = now();
    const cached = cache.get(key);
    if (cached && cached.expires > time) {
      const startedGeneration = generation;
      stats.cacheHits += 1;
      // A write can be dispatched before this microtask hands back a hit.
      return Promise.resolve().then(() => startedGeneration === generation && !cached.obsolete ? clone(cached.value) : blockedStale());
    }
    if (cached) deleteCached(key);
    const pending = inFlight.get(key);
    if (pending) {
      stats.coalesced += 1;
      return deliver(pending);
    }
    if (inFlight.size >= MAX_ENTRIES) return bypass(receiver, call, safe, true);
    stats.networkReads += 1;
    const entry = { generation, promise: null };
    // Invoke immediately with the exact arguments/this and original timeout.
    const promise = Reflect.apply(original, receiver, call);
    entry.promise = Promise.resolve(promise).then(result => {
      if (publicSuccess(result) && !entry.obsolete && entry.generation === generation && safe.policy.ttl > 0) putCached(key, result, safe.policy.ttl);
      return result;
    }).finally(() => {
      // An old request must not remove a new-generation request with its key.
      if (inFlight.get(key) === entry) inFlight.delete(key);
    });
    inFlight.set(key, entry);
    return deliver(entry);
  }

  function deliver(entry) {
    return entry.promise.then(result => {
      // Preserve genuine network/business failures, including abort timeouts.
      if (publicSuccess(result) && (entry.obsolete || entry.generation !== generation)) return blockedStale();
      return clone(result);
    });
  }

  function install(target) {
    target = target || w;
    if (wrapped) return target === host && target.finoRpc === wrapped;
    if (typeof target.finoRpc !== 'function') return false;
    original = target.finoRpc;
    host = target;
    wrapped = function finoRpc(fn, args = {}, timeoutMs = 12000) {
      return read(this, Array.prototype.slice.call(arguments), false);
    };
    target.finoRpc = wrapped;
    return target.finoRpc === wrapped;
  }

  function freshRpc(name, args, timeout) {
    if (!wrapped && !install(w)) throw new Error('FINO99 root RPC is not ready');
    const call = Array.prototype.slice.call(arguments);
    const safe = safeCall(call);
    if (safe) {
      // Supersede only this public resource, across timeout/receiver variants.
      // Distinct fresh resources can safely be read with Promise.all. Writes
      // still fence ALL resources using the global generation token.
      const match = '|' + safe.name + '|' + safe.serialized + '|';
      for (const [key, entry] of cache) {
        if (key.includes(match)) { entry.obsolete = true; deleteCached(key); }
      }
      for (const [key, entry] of inFlight) {
        if (key.includes(match)) { entry.obsolete = true; inFlight.delete(key); }
      }
    }
    return read(host, call, true);
  }

  w.F99Performance = Object.freeze({
    version: '20261115a', install, invalidate, freshRpc,
    diagnostics: () => Object.freeze({ ...stats, generation, cacheEntries: cache.size,
      cacheBytes, inFlight: inFlight.size, installed: !!wrapped && host.finoRpc === wrapped }),
    policy: Object.freeze({ fino_public_settings: 5000, f99v25_public_completion_offers: 5000, f99v32_live_snapshot: 0 })
  });
  // Also supports loading immediately after the root script, with slightly
  // less startup coverage. Never use getter traps or a reinstallation timer.
  install(w);
})(window);
