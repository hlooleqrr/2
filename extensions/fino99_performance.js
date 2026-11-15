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
    f99v27_preflight: Object.freeze({ ttl: 0, args: [] }),
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
  const stats = { networkReads: 0, cacheHits: 0, coalesced: 0, bypassed: 0, invalidations: 0, staleBlocked: 0, freshRetries: 0, failedRecoveryBudget: 0 };
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

  // API11 verified: state/touch update session activity only, never bank rates,
  // packages, financial policy or quotas. Private responses are NEVER cached.
  // End/feedback/login and all unknown actions retain the original write fence.
  function sessionActivityCall(call) {
    try {
      if (call[0] !== 'f99s12_client_session' || call.length > 3) return false;
      const args = call[1];
      const plain = value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const proto = Object.getPrototypeOf(value);
        return proto === null || (Object.getPrototypeOf(proto) === null &&
          Object.getOwnPropertyDescriptor(proto, 'constructor')?.value?.name === 'Object');
      };
      const data = (value, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor?.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
      };
      if (!plain(args) || Reflect.ownKeys(args).some(key => typeof key !== 'string' ||
        !['p_entry_token', 'p_device_id', 'p_action', 'p_payload'].includes(key))) return false;
      const action = data(args, 'p_action'), token = data(args, 'p_entry_token'), device = data(args, 'p_device_id');
      if (!['state', 'touch'].includes(action) || typeof token !== 'string' || typeof device !== 'string' || !device) return false;
      const payload = data(args, 'p_payload');
      if (!plain(payload)) return false;
      const keys = Reflect.ownKeys(payload);
      return keys.length === 0 || (keys.length === 1 && keys[0] === 'scope' &&
        ['entry', 'receipt'].includes(data(payload, 'scope')));
    } catch (_) { return false; }
  }

  function bypass(receiver, call, safe, fresh) {
    stats.bypassed += 1;
    // Unknown/protected calls may write even if their names sound like reads.
    // Fence at both dispatch and successful completion, conservatively.
    const publicName = typeof call[0] === 'string' && Object.prototype.hasOwnProperty.call(policies, call[0]);
    const mayWrite = (!publicName || !safe) && !sessionActivityCall(call);
    if (mayWrite) invalidate();
    const promise = Reflect.apply(original, receiver, call);
    return Promise.resolve(promise).then(result => {
      if (mayWrite) {
        if (succeeded(result)) invalidate();
        return result;
      }
      // r19b: a forced fresh read is a real network response requested before any
      // later write completed; it is returned to its caller and never cached.
      return result;
    });
  }

  function stale(attempt) {
    return attempt.obsolete || attempt.source?.obsolete || attempt.generation !== generation;
  }

  function makeEntry(receiver, safe, key, time, cacheable) {
    return { generation, receiver, safe, key, cacheable, deadline: time + safe.timeout,
      promise: null, recovery: null, recoveryAttempt: null, budgetFailed: false };
  }

  function recoveryBudgetFailed(entry, invalidated) {
    if (!entry.budgetFailed) {
      entry.budgetFailed = true;
      stats.failedRecoveryBudget += 1;
    }
    return invalidated;
  }

  function recover(entry) {
    // One shared recovery per original entry, never a loop or an old-value fallback.
    if (!entry.recovery) {
      const invalidated = blockedStale();
      entry.recovery = Promise.resolve().then(() => {
        // Reconstruct only the already validated immutable canonical resource.
        // Never inspect the caller's possibly mutated object for the retry.
        const args = JSON.parse(entry.safe.serialized);
        const remaining = Math.floor(entry.deadline - now());
        if (remaining <= 0) return { result: recoveryBudgetFailed(entry, invalidated) };
        const attempt = { generation, obsolete: false, result: null,
          blocked: null, cached: false, invalidated };
        entry.recoveryAttempt = attempt;
        // Let later identical reads share this recovery, without replacing a
        // separate new-generation request already running under the same key.
        if (entry.cacheable && !inFlight.has(entry.key) && inFlight.size < MAX_ENTRIES) inFlight.set(entry.key, entry);
        stats.freshRetries += 1;
        stats.networkReads += 1;
        return Promise.resolve(Reflect.apply(original, entry.receiver,
          [entry.safe.name, args, remaining])).then(result => {
          attempt.result = result;
          return attempt;
        });
      });
    }
    return entry.recovery;
  }

  function deliverRecovery(entry, attempt) {
    const result = attempt.result;
    // Real transport/business failures are not replaced with synthetic errors.
    if (publicSuccess(result)) {
      // r19b: the recovery is itself a fresh network read; a concurrent unrelated
      // completion only prevents caching it, never discards the server answer.
      if (stale(attempt)) return clone(result);
      if (now() >= entry.deadline) return clone(recoveryBudgetFailed(entry, attempt.invalidated));
      if (entry.cacheable && entry.safe.policy.ttl > 0 && !attempt.cached) {
        putCached(entry.key, result, entry.safe.policy.ttl);
        attempt.cached = true;
      }
    }
    return clone(result);
  }

  function read(receiver, call, forceFresh) {
    const safe = safeCall(call);
    if (!safe) return bypass(receiver, call, safe, forceFresh);
    const key = receiverKey(receiver) + '|' + safe.name + '|' + safe.serialized + '|' + safe.timeout;
    const time = now();
    if (!forceFresh) {
      const cached = cache.get(key);
      if (cached && cached.expires > time) {
        stats.cacheHits += 1;
        // Concurrent deliveries of this hit share one recovery if a write
        // fences it before the microtask returns; no stale cached value escapes.
        if (!cached.delivery) {
          cached.delivery = makeEntry(receiver, safe, key, time, true);
          cached.delivery.source = cached;
          cached.delivery.promise = Promise.resolve(cached.value);
        }
        const entry = cached.delivery;
        return deliver(entry).finally(() => {
          if (cached.delivery === entry) cached.delivery = null;
        });
      }
      if (cached) deleteCached(key);
      const pending = inFlight.get(key);
      if (pending) {
        stats.coalesced += 1;
        return deliver(pending);
      }
    }
    const cacheable = !forceFresh && inFlight.size < MAX_ENTRIES;
    if (!cacheable) stats.bypassed += 1;
    stats.networkReads += 1;
    const entry = makeEntry(receiver, safe, key, time, cacheable);
    // Primary invocation retains exact caller arguments/receiver/timeout.
    const promise = Reflect.apply(original, receiver, call);
    entry.promise = Promise.resolve(promise).then(result => {
      if (publicSuccess(result) && !stale(entry) && cacheable && safe.policy.ttl > 0) putCached(key, result, safe.policy.ttl);
      return result;
    });
    if (cacheable) inFlight.set(key, entry);
    return deliver(entry);
  }

  function deliver(entry) {
    return entry.promise.then(result => {
      // r19b ROOT RULE: invalidate() already detaches in-flight reads, so only
      // callers that asked BEFORE a write receive this network answer (valid
      // ordering). Stale network answers are never cached (see read()).
      // Re-read only a cache-served value or a read superseded by freshRpc.
      if (publicSuccess(result) && stale(entry) && (entry.source || entry.obsolete))
        return recover(entry).then(attempt => deliverRecovery(entry, attempt));
      return clone(result);
    }).finally(() => {
      // Old deliveries must not remove another generation's request.
      if (inFlight.get(entry.key) === entry) inFlight.delete(entry.key);
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
        if (key.includes(match)) {
          entry.obsolete = true;
          if (entry.recoveryAttempt) entry.recoveryAttempt.obsolete = true;
          inFlight.delete(key);
        }
      }
    }
    return read(host, call, true);
  }

  w.F99Performance = Object.freeze({
    version: '20261115-r19b', install, invalidate, freshRpc,
    diagnostics: () => Object.freeze({ ...stats, generation, cacheEntries: cache.size,
      cacheBytes, inFlight: inFlight.size, installed: !!wrapped && host.finoRpc === wrapped }),
    policy: Object.freeze({ fino_public_settings: 5000, f99v25_public_completion_offers: 5000, f99v32_live_snapshot: 0 })
  });
  // Also supports loading immediately after the root script, with slightly
  // less startup coverage. Never use getter traps or a reinstallation timer.
  install(w);
})(window);
