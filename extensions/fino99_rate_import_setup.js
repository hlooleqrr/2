/* FINO99: one existing-image-icon bridge; local OCR and existing audited rate writer only. */
(function (w) {
  'use strict';
  if (w.F99RateImport14 || !w.installF99RateImportWithLocalOCR) return;
  const io = {
    async call(fn, args) {
      try {
        const r = await w.finoCentralAdminCall(fn, args || {});
        if (!r || r.ok !== true) return {ok:false, reason:String(r?.data?.reason || r?.reason || r?.error?.code || 'TRANSPORT')};
        return r.data && typeof r.data === 'object' ? (r.data.ok === undefined ? {ok:true,...r.data} : r.data) : {ok:false,reason:'TRANSPORT'};
      } catch (_) { return {ok:false,reason:'TRANSPORT'}; }
    },
    ownerActive: () => w.F99S12Runtime?.owner() === true && !!w.F99S12Runtime.ownerToken(),
    getPendingImage: () => typeof finoBotPendingImage === 'undefined' ? null : finoBotPendingImage,
    async openHistory() {
      w.document.querySelector('.f99ri14-dialog')?.close();
      await w.F99ExecGateway.open();
      return w.F99ExecGateway.send('سجل نسب البنوك');
    }
  };
  w.F99RateImport14 = w.installF99RateImportWithLocalOCR(io);
})(window);
