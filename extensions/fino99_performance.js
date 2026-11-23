/* FINO99 public-read performance layer. No response storage, fetch patch, auth changes,
 * timers, DOM scans, or database writes. Load before the root classic script,
 * then call F99Performance.install(window) at that script's first statement.
 */
(function (w) {
  'use strict';
  if (w.F99Performance) return;

  // Verified STABLE read-only SQL; do not expand by naming heuristics.
  // Financial snapshots are deliberately NEVER served from a settled cache.
  const policies = Object.freeze({
    // R93: 20 s settled settings; owner writes still invalidate at dispatch and success.
    fino_public_settings: Object.freeze({ ttl: 20000, args: [] }),
    f99v25_public_completion_offers: Object.freeze({ ttl: 5000, args: [] }),
    f99v27_preflight: Object.freeze({ ttl: 0, args: [] }),
    // essential: never answered by the local 402 cooldown (finance must reach central).
    f99v32_live_snapshot: Object.freeze({ ttl: 0, args: ['p_package_key'], essential: true }),
    // r22: exact read-only definitions audited in DELIVERY_21 schema (voice in EPS).
    // These reads previously fenced one another as unknown writes at startup,
    // causing 5–8 identical settings downloads. No settled cache for these RPCs.
    f99v24_public_studio: Object.freeze({ ttl: 0, args: [] }),
    f99v45_public_theme: Object.freeze({ ttl: 0, args: [] }),
    f99v49_public_copy: Object.freeze({ ttl: 0, args: [] }),
    f99v50_public_experience: Object.freeze({ ttl: 0, args: [] }),
    f99v58_public_ui: Object.freeze({ ttl: 0, args: [] }),
    f99v68_public_configs: Object.freeze({ ttl: 0, args: [] }),
    f99v70_public_presentation: Object.freeze({ ttl: 0, args: [] }),
    f99o3_public_catalog: Object.freeze({ ttl: 0, args: [] }),
    f99v8_public_renewal_settings: Object.freeze({ ttl: 0, args: [] }),
    f99d1_voice_public: Object.freeze({ ttl: 0, args: [] }),
    f99r22_settings_public: Object.freeze({ ttl: 0, args: [] }),
    // R93: SQL-verified STABLE read-only (no DML); previously treated as unknown writes,
    // which wiped the settled cache every ~21 s and ignored the 402 cooldown.
    f99v74_public_review_display: Object.freeze({ ttl: 0, args: [] }),
    f99r65_public: Object.freeze({ ttl: 0, args: [] }),
    // r24 (2026-11-17): read-only session status/feature reads. Production logs showed
    // concurrent identical polls queueing on the same code row lock until 57014.
    // Share one request per session; any write still invalidates (bypass fence).
    f99v23_client_status: Object.freeze({ ttl: 1500, args: ['p_entry_token', 'p_device_id'], session: true }),
    f99v38_client_code_features: Object.freeze({ ttl: 1500, args: ['p_entry_token', 'p_device_id'], session: true })
  });
  const MAX_ENTRIES = 32;
  const MAX_ENTRY_BYTES = 256 * 1024;
  // R93: the real settings envelope is ~285k characters (~570 KiB UTF-16), so the
  // 256 KiB cap prevented it from ever being cached. Total cache remains 1 MiB.
  const MAX_SETTINGS_BYTES = 1024 * 1024;
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
  const stats = { networkReads: 0, cacheHits: 0, coalesced: 0, bypassed: 0, invalidations: 0, staleBlocked: 0, freshRetries: 0, failedRecoveryBudget: 0, quotaSuppressed: 0, quotaPauses: 0, quotaProbes: 0 };
  const now = () => w.performance && typeof w.performance.now === 'function' ? w.performance.now() : Date.now();

  // R93 (2026-11-23): Supabase answered HTTP 402 (egress quota) to every request
  // while public pollers kept retrying. During a 402 cooldown only verified PUBLIC
  // reads are answered locally with the same 402 error. Session/private/unknown
  // calls (codes, usage, blocking, owner writes) are never suppressed or replayed,
  // and no stale success is ever produced. One public probe runs after cooldown;
  // other public readers wait for it. Any real gateway answer restores traffic.
  const QUOTA_KEY = 'f99_public_quota_r93';
  const QUOTA_BASE_MS = 30000;
  const QUOTA_MAX_MS = 60000;
  const wall = () => (w.Date && typeof w.Date.now === 'function' ? w.Date : Date).now();
  let quotaUntil = 0, quotaFailures = 0, quotaSince = 0, quotaProbe = null;
  let quotaError = { code: 'exceed_egress_quota' };
  function quotaStore() { try { return w.sessionStorage || null; } catch (_) { return null; } }
  try {
    const saved = JSON.parse(quotaStore()?.getItem(QUOTA_KEY) || 'null');
    if (saved && saved.failures > 0 && wall() - Number(saved.at) < 10 * 60000) {
      // After a reload, exactly one immediate probe; startup readers wait for it.
      quotaFailures = Math.min(3, Math.floor(saved.failures));
      quotaUntil = quotaSince = wall();
    }
  } catch (_) {}
  function saveQuota() {
    try {
      const store = quotaStore();
      if (!store) return;
      if (quotaFailures) store.setItem(QUOTA_KEY, JSON.stringify({ failures: quotaFailures, at: wall() }));
      else store.removeItem(QUOTA_KEY);
    } catch (_) {}
  }
  function quotaFailed(error) {
    if (error !== undefined) { try { quotaError = clone(error); } catch (_) {} }
    quotaFailures = Math.min(3, quotaFailures + 1);
    quotaSince = wall();
    quotaUntil = quotaSince + Math.min(QUOTA_MAX_MS, QUOTA_BASE_MS * Math.pow(2, quotaFailures - 1));
    stats.quotaPauses += 1;
    // Fail closed: no settled success is served while central rejects requests.
    cache.clear();
    cacheBytes = 0;
    saveQuota();
  }
  function quotaRecovered(started) {
    if (!quotaUntil || started < quotaSince) return;
    quotaUntil = quotaFailures = 0;
    saveQuota();
  }
  function quotaBlocked() {
    stats.quotaSuppressed += 1;
    return { ok: false, httpStatus: 402, quotaBackoff: true,
      retryAfterMs: Math.max(0, Math.round(quotaUntil - wall())), error: clone(quotaError) };
  }
  function dispatch(receiver, call, probe) {
    const started = wall();
    let request;
    try { request = Reflect.apply(original, receiver, call); }
    catch (error) { if (probe) quotaFailed(); throw error; }
    return Promise.resolve(request).then(result => {
      if (result && result.httpStatus === 402) {
        // A burst already in flight is one outage, not several escalations.
        if (probe || !quotaUntil || wall() >= quotaUntil) quotaFailed(result.error);
      } else if (result && (result.ok === true || typeof result.httpStatus === 'number')) {
        quotaRecovered(started);
      } else if (probe) quotaFailed();
      return result;
    }, error => { if (probe) quotaFailed(); throw error; });
  }
  function transport(receiver, call, safe) {
    if (!safe || safe.policy.session || safe.policy.essential || !quotaUntil) return dispatch(receiver, call, false);
    if (quotaProbe) return quotaProbe.then(() => transport(receiver, call, safe));
    if (wall() < quotaUntil) return Promise.resolve(quotaBlocked());
    let settle;
    quotaProbe = new Promise(resolve => { settle = resolve; });
    stats.quotaProbes += 1;
    const release = () => { quotaProbe = null; settle(); };
    let request;
    try { request = dispatch(receiver, call, true); }
    catch (error) { release(); throw error; }
    return request.finally(release);
  }

  function settledKey(safe, key) {
    // R93: settings are timeout-independent once settled; every poller shares one copy.
    // In-flight sharing still keys on exact timeout budgets.
    return safe.name === 'fino_public_settings' ? key.slice(0, key.lastIndexOf('|')) + '|settled' : key;
  }

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
      if ((key === 'p_entry_token' || key === 'p_device_id') && (typeof value !== 'string' || value.length < 8 || value.length > 256)) return null;
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
    if (bytes > (key.endsWith('|settled') ? MAX_SETTINGS_BYTES : MAX_ENTRY_BYTES)) return;
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
    const promise = transport(receiver, call, null);
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
    return { generation, receiver, safe, key, cacheKey: settledKey(safe, key), cacheable, deadline: time + safe.timeout,
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
        return Promise.resolve(transport(entry.receiver,
          [entry.safe.name, args, remaining], entry.safe)).then(result => {
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
        putCached(entry.cacheKey, result, entry.safe.policy.ttl);
        attempt.cached = true;
      }
    }
    return clone(result);
  }

  function read(receiver, call, forceFresh) {
    const safe = safeCall(call);
    if (!safe) return bypass(receiver, call, safe, forceFresh);
    // Session status polls with different caller timeouts share one server read.
    const key = receiverKey(receiver) + '|' + safe.name + '|' + safe.serialized + '|' + (safe.policy.session ? 'session' : safe.timeout);
    const time = now();
    const cacheKey = settledKey(safe, key);
    if (!forceFresh) {
      const cached = cache.get(cacheKey);
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
      if (cached) deleteCached(cacheKey);
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
    const promise = transport(receiver, call, forceFresh ? null : safe);
    entry.promise = Promise.resolve(promise).then(result => {
      if (publicSuccess(result) && !stale(entry) && cacheable && safe.policy.ttl > 0) putCached(cacheKey, result, safe.policy.ttl);
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
    version: '20261123r93', install, invalidate, freshRpc,
    diagnostics: () => Object.freeze({ ...stats, generation, cacheEntries: cache.size,
      cacheBytes, inFlight: inFlight.size, installed: !!wrapped && host.finoRpc === wrapped,
      quotaFailures, quotaCooldownMs: Math.max(0, Math.round(quotaUntil - wall())), quotaProbe: !!quotaProbe }),
    policy: Object.freeze({ fino_public_settings: 20000, f99v25_public_completion_offers: 5000, f99v32_live_snapshot: 0 })
  });
  // Also supports loading immediately after the root script, with slightly
  // less startup coverage. Never use getter traps or a reinstallation timer.
  install(w);
})(window);
