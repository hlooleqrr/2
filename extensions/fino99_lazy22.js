/* FINO99 r22J: explicit non-critical extension loading. Same-origin CSP unchanged.
 * Register only owner/optional modules whose exports are not needed by startup.
 * No RPC, auth/session change, document scan, polling, hidden feature or timer.
 */
(function (w) {
  'use strict';
  if (w.F99Lazy22) return;
  const registrations = new Map();
  function register(name, source, methods) {
    if (w[name] || registrations.has(name)) return false;
    const url = new URL(source, w.document.baseURI);
    if (url.origin !== w.location.origin) throw Error('F99_LAZY_SAME_ORIGIN_REQUIRED');
    let pending = null;
    const stub = {};
    function load() {
      if (w[name] !== stub) return Promise.resolve(w[name]);
      if (pending) return pending;
      pending = new Promise((resolve, reject) => {
        const script = w.document.createElement('script');
        script.src = url.href;
        script.onload = () => {
          if (w[name] === stub) { pending = null; script.remove(); reject(Error('F99_LAZY_EXPORT_MISSING')); }
          else resolve(w[name]);
        };
        script.onerror = () => { pending = null; script.remove(); reject(Error('F99_LAZY_LOAD_FAILED')); };
        w.document.head.append(script);
      });
      return pending;
    }
    methods.forEach(method => {
      stub[method] = function (...args) {
        return load().then(api => {
          if (typeof api[method] !== 'function') throw Error('F99_LAZY_METHOD_MISSING');
          return Reflect.apply(api[method], api, args);
        });
      };
    });
    registrations.set(name, load);
    w[name] = stub;
    return true;
  }
  w.F99Lazy22 = Object.freeze({register, load: name => {
    if (!registrations.has(name)) return Promise.reject(Error('F99_LAZY_NOT_REGISTERED'));
    return registrations.get(name)();
  }});
  register('F99ExecGateway', './extensions/fino99_executive_gateway.js?v=20261117r25', ['open', 'close', 'send']);
})(window);
