/* FINO99 display terminology only. Result/export/fee/legal DOM and stored values stay untouched. */
(function () {
  'use strict';
  const protectedSelector='script,style,textarea,input,code,pre,[contenteditable="true"],#page3,#results,.result-wrap,.result-bank,.portal-result,.portal-rank-list,.portal-detail-lines,.portal-cash-hero,.f38-full,.f38-image-wrap,.f47-inline-image,.f34-report,.f49-request-shell,.f49-completion-request,.f49-message-preview,.f82-fee-hero,.f82-fee-price,.f82-fee-saving,.f82-last-card,.portal-expert-box,.portal-note,.portal-alert,.portal-trial-conditions,.portal-trial-consent,#portalImageOverlay,#portalImageOverlayImg,#imagePreviewModal,#imagePreviewImg,#phoneModal,#f34-image-preview,#f76-modal,canvas,iframe,object,embed,details,[class*="result"],[class*="card"],[class*="export"],[class*="capture"],[class*="consent"],[class*="legal"],[class*="contract"],[class*="pdf"],[id*="result"],[id*="Result"],[id*="export"],[id*="Export"],[id*="consent"],[id*="Consent"],[id*="legal"],[id*="contract"],[data-export],[data-capture],[data-consent],[data-legal]';
  const label=s=>String(s||'').replace(/سلة/g,'منصة الدفع');
  function protectedNode(element) {
    if(!element||element.closest(protectedSelector))return true;
    const bubble=element.closest('.portal-row,.portal-bubble');
    return !!(bubble&&bubble.querySelector(protectedSelector));
  }
  function walk(node) {
    if(node.nodeType===Node.TEXT_NODE) {
      if(!protectedNode(node.parentElement)&&node.nodeValue.includes('سلة'))node.nodeValue=label(node.nodeValue);
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE||protectedNode(node))return;
    if(!node.querySelector(protectedSelector))for(const a of ['title','aria-label']) {
      const value=node.getAttribute(a);if(value?.includes('سلة'))node.setAttribute(a,label(value));
    }
    for(const child of node.childNodes)walk(child);
  }
  let scheduled=false;const queue=new Set();
  const observer=new MutationObserver(records=>{
    for(const r of records) {
      if(r.type==='childList')for(const n of r.addedNodes)queue.add(n);
      else if(r.target.nodeValue?.includes('سلة'))queue.add(r.target);
    }
    if(!scheduled&&queue.size) {scheduled=true;queueMicrotask(()=>{scheduled=false;const nodes=[...queue];queue.clear();nodes.forEach(walk);});}
  });
  function start(){walk(document.body);observer.observe(document.body,{subtree:true,childList:true,characterData:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
