/* Parent-reviewed opt-in. Load AFTER the existing root script, importer and browser_adapter.js.
 * Replace only F99RateTableImport.install(window, existingIO) with
 * installF99RateImportWithLocalOCR(existingIO). No extraction on install/select/open. */
window.installF99RateImportWithLocalOCR=function(existingIO){
  'use strict';
  const w=window;
  let selectedOriginal=null;
  const ocr=w.F99LocalRateOCR.createTransport(w);
  const remember=file=>{selectedOriginal=file||null;};
  const io={...existingIO,
    getPendingImage(){const f=existingIO.getPendingImage?.();if(f)remember(f);return f;},
    extractTransport(payload){ocr.setOriginalFile(selectedOriginal);return ocr(payload);}
  };
  const bridge=w.F99RateTableImport.install(w,io);
  // The existing installed read handler opens the SAME guarded matrix workspace.
  const installedRead=w.readFINOPortalAdminImage;
  const localRead=input=>{remember(input?.files?.[0]);return installedRead(input);};
  if(typeof installedRead==='function')w.readFINOPortalAdminImage=localRead;
  if(typeof installedRead==='function'&&typeof w.readFINOAdminImage==='function')w.readFINOAdminImage=localRead;
  const capture=e=>{
    const input=e.target;
    if(input?.matches?.('.f99ri14 input[type="file"], #portalImageInput'))remember(input.files?.[0]);
  };
  w.document.addEventListener('change',capture,true);
  const open=file=>{if(file)remember(file);return bridge.open(file);};
  w.F99RateImport14Open=open;
  return {bridge,open,get service(){return bridge.service;},
    // Call only when deliberately discarding this review, not during uncertain commits.
    forgetOriginal(){remember(null);ocr.clear();w.document.querySelector('[data-local-ocr-review]')?.remove();},
    dispose(){this.forgetOriginal();w.document.removeEventListener('change',capture,true);
      if(w.readFINOPortalAdminImage===localRead)w.readFINOPortalAdminImage=installedRead;
      if(w.readFINOAdminImage===localRead)w.readFINOAdminImage=installedRead;
      if(w.F99RateImport14Open===open)w.F99RateImport14Open=bridge.open;
    }
  };
};
