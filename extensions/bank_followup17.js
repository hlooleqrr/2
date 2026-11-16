/* FINO99 section1 additive integration API; no auto-mount, monkeypatch, calculator or global CSS mutation. */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  if (root) root.F99BankFollowup17 = value;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const T = (key, vars, fallback) => typeof window !== 'undefined' && window.F99T ? window.F99T('followup22.' + key, vars, fallback) : fallback;
  const declined = new Set();
  const session = () => typeof window !== 'undefined' ? window.F99B17Integration?.identity?.() || '' : '';
  const APOLOGY = 'نشكرك على ثقتك بنا 🌷\n\nنعتذر منك، خدمة متابعة إجراءات التمويل عبرنا لهذا البنك غير متاحة حاليًا.\n\nتقدر تستفيد من الحسبة وتقارن الخيارات الأخرى، ويسعدنا خدمتك في الخيارات المتاحة.';
  const safe = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  };
  function unpack(value) {
    return Promise.resolve(value).then(r => {
      if (r && r.data !== undefined) { if (r.ok === false) throw Error('B17_TRANSPORT_FAILED'); return r.data; }
      return r;
    });
  }
  function assertOK(r) { if (!r || r.ok !== true) throw Object.assign(Error(r?.reason || 'B17_UNAVAILABLE'), { reason: r?.reason }); return r; }
  function createApi(o) {
    if (typeof o?.rpc !== 'function' || typeof o?.entryContext !== 'function') throw Error('B17_ADAPTER_REQUIRED');
    const client = (action, data) => {
      const e = o.entryContext();
      if (!e?.entryToken || !e?.deviceId) return Promise.reject(Error('ENTRY_REQUIRED'));
      return unpack(o.rpc('f99b17_client', { p_entry_token: e.entryToken, p_device_id: e.deviceId, p_action: action, p_data: data }));
    };
    const owner = (action, data) => {
      const actor = o.ownerActor?.();
      if (!actor?.token) return Promise.reject(Error('ADMIN_UNAUTHORIZED'));
      return unpack((o.ownerRpc || o.rpc)('f99b17_owner', { p_token: actor.token, p_action: action, p_data: data })).then(assertOK);
    };
    return Object.freeze({
      get: bank => owner('get', { finance_type: bank.finance_type, bank_id: bank.bank_id }),
      set: (bank, available, expectedRevision, approved) => owner('set', {
        finance_type: bank.finance_type, bank_id: bank.bank_id, available,
        expected_revision: expectedRevision, approved: approved === true
      }),
      want: bank => client('want_followup', { finance_type: bank.finance_type, bank_id: bank.bank_id, want_followup: true }),
      verify: binding => {
        if (!binding?.intent_id) return Promise.reject(Error('B17_INTENT_UUID_REQUIRED'));
        return client('verify', { intent_id: binding.intent_id }).then(assertOK);
      }
    });
  }
  function scopeStyle(host) {
    const style = safe('style');
    // New rules only inside this module's own newly-created nodes; never existing result/PNG/text selectors.
    style.textContent = '.f99b17-editor{display:grid;gap:.5rem;padding:.75rem;border:1px solid #d6e3e9;border-radius:12px;background:#f8fbfc;color:#24434e}.f99b17-editor select,.f99b17-editor button{font:inherit;padding:.55rem;border:1px solid #b8cdd6;border-radius:8px;background:white;color:#24434e}.f99b17-editor small{line-height:1.7}.f99b17-note{white-space:pre-line;padding:1rem;border:1px solid #d6e3e9;border-radius:12px;background:#f3f8fa;color:#24434e;line-height:1.9}.f99b17-action{display:grid;gap:.6rem}.f99b17-action>button{font:inherit;padding:.7rem;background:#f3f8fa;color:#24434e;border:1px solid #b8cdd6;border-radius:10px}';
    host.append(style);
  }
  function showApology(host) {
    if (!host) throw Error('B17_HOST_REQUIRED');
    const note = safe('div', T('apology', {}, APOLOGY), 'f99b17-note'); note.setAttribute('role', 'status');
    // Host must be a dedicated slot, never a bank/result/card parent.
    host.replaceChildren(); scopeStyle(host); host.append(note);
    return note;
  }
  function mountOwnerField(host, o) {
    if (!host || !o?.api || !['personal', 'mortgage'].includes(o.bank?.finance_type) || !o.bank?.bank_id) throw Error('B17_EXISTING_BANK_HOST_REQUIRED');
    const box = safe('div', undefined, 'f99b17-editor'); box.dir = 'rtl'; scopeStyle(box);
    const label = safe('label', 'خدمة متابعة إجراءات التمويل عبرنا');
    const select = safe('select'); select.setAttribute('aria-label', 'حالة خدمة المتابعة لهذا البنك');
    for (const [v, text] of [['true', 'متاحة'], ['false', 'متوقفة مؤقتًا']]) {
      const option = safe('option', text); option.value = v; select.append(option);
    }
    const help = safe('small', 'هذا الخيار يخص المتابعة عبرنا فقط؛ لا يوقف البنك من الحسبة أو الترشيحات ولا يغيّر النسب أو الأسعار.');
    const save = safe('button', 'اعتماد حالة المتابعة'); save.type = 'button';
    const status = safe('small', 'جارٍ قراءة الحالة المعتمدة…'); status.setAttribute('role', 'status');
    box.append(label, select, help, save, status); host.append(box);
    let state = null, alive = true, busy = false;
    const update = () => { select.disabled = !state || busy; save.disabled = !state || busy || (select.value === String(state.available)); };
    const refresh = async () => {
      state = null; update();
      try { const r = await o.api.get(o.bank); if (!alive) return; state = r.state; select.value = String(state.available); status.textContent = ''; }
      catch (_) { if (alive) status.textContent = 'تعذرت قراءة الحالة. لم يتم تغييرها.'; }
      update();
    };
    select.addEventListener('change', update);
    save.addEventListener('click', async () => {
      if (!state || busy || save.disabled) return;
      const approved = await (o.confirmChange || (text => window.confirm(text)))(
        'هل تعتمد تغيير خدمة المتابعة عبرنا لهذا البنك إلى «' + (select.value === 'true' ? 'متاحة' : 'متوقفة مؤقتًا') + '»؟ لا يؤثر ذلك على الحسبة أو الأسعار.');
      if (!approved || !alive) return;
      const desired = select.value === 'true'; busy = true; update();
      try { const r = await o.api.set(o.bank, desired, state.revision, true); if (alive) { state = r.state; select.value = String(state.available); status.textContent = 'تم اعتماد حالة المتابعة فقط.'; } }
      catch (e) { if (alive) { status.textContent = e.reason === 'B17_CAS_CONFLICT' ? 'تغيرت الحالة في المركزية. أعد قراءتها قبل الاعتماد.' : 'لم يُعتمد التغيير. أعد قراءة الحالة.'; state = null; } }
      finally { busy = false; update(); }
    });
    const ready = refresh();
    return { ready, refresh, destroy: () => { alive = false; box.remove(); } };
  }
  // This is an EXPLICIT follow-up button, NOT the bank-selection/comparison handler.
  function mountCustomerAction(host, o) {
    const box = safe('div', undefined, 'f99b17-action'); scopeStyle(box);
    const id = session();
    if (id && declined.has(id)) return { destroy() {} };
    const client = o.clientName?.() || (typeof clientName !== 'undefined' ? clientName : '');
    const invitation = safe('p', T('invite', {client}, 'يا ' + client + '، عندك عرض خاص لمتابعة إجراءات تمويلك. ودك تشوف التفاصيل؟'));
    const button = safe('button', T('view', {}, 'نعم، أشوف العرض')); button.type = 'button';
    const later = safe('button', T('postpone', {}, 'ليس الآن')); later.type = 'button';
    const output = safe('div'); box.append(invitation, button, later, output); host.append(box);
    later.onclick = () => { if (busy) return; if (id) declined.add(id); box.remove(); };
    let alive = true, busy = false;
    button.addEventListener('click', async () => {
      if (!alive || busy) return; busy = true; button.disabled = true; output.replaceChildren();
      try {
        const bank = o.selectedBank(); // Must return canonical {finance_type,bank_id}; never infer from names or index.
        const r = await o.api.want(bank);
        if (!alive) return;
        if (r?.reason === 'BANK_FOLLOWUP_PAUSED') { showApology(output); return; }
        assertOK(r);
        invitation.remove(); button.hidden = true; later.hidden = true;
        await o.onAvailable?.(r.bank_followup, bank); // Existing fee preview is called only here.
      } catch (_) { if (alive) output.append(safe('p', T('unavailable', {}, 'تعذر التحقق الآن. لم يتم إرسال أي طلب.'))); }
      finally { busy = false; if (alive) button.disabled = false; }
    });
    return { destroy: () => { alive = false; box.remove(); } };
  }
  // Transport adapter for EXISTING F13 component. Financial accept carries the preview's intent,
  // not whatever bank happens to be selected later. Nonfinance F13 payloads remain byte-equivalent.
  function guardedF13Rpc(rpc) {
    const previews = new Map();
    return async (name, args, ...rest) => {
      if (name !== 'f99f13_client') return rpc(name, args, ...rest);
      const key = String(args.p_entry_token) + '\u0000' + String(args.p_device_id);
      let input = args;
      if (args.p_action === 'accept' && previews.has(key)) {
        input = { ...args, p_payload: { ...args.p_payload, bank_intent: previews.get(key).intent_id } };
      }
      const raw = await rpc(name, input, ...rest), r = raw?.data !== undefined ? raw.data : raw;
      if (['context', 'getClientOffer', 'readcontext'].includes(args.p_action)) {
        if (r?.ok === true && r.offer && r.bank_followup?.intent_id) previews.set(key, r.bank_followup);
        else previews.delete(key);
      }
      return raw;
    };
  }
  return Object.freeze({ APOLOGY, createApi, mountOwnerField, mountCustomerAction, showApology, guardedF13Rpc });
});
