/* FINO99 local OCR sidecar: existing free Tesseract, no service, inference or writer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.F99LocalRateOCR=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const FIELDS=['bank_id','finance_type','segment','salary_min','salary_max','term_scope','product_scope','rate_type','effective_date'];
  const unknown=()=>Object.fromEntries(FIELDS.map(k=>[k,'']));
  const fail=s=>{throw Error(s);};
  const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)]||1;
  function metadata(data,width,height){
    const lines=Array.isArray(data.lines)?data.lines:(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const source=Array.isArray(data.words)&&data.words.length?data.words:lines.flatMap(l=>l.words||[]);
    if(source.length>20000||String(data.text||'').length>600000)fail('OCR_OUTPUT_TOO_LARGE');
    const words=[],invalid=[];
    source.forEach((v,i)=>{const b=v.bbox,t=String(v.text??'');
      if(!t.trim())return;
      if(!b||!['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k]))||b.x0<0||b.y0<0||b.x1<=b.x0||b.y1<=b.y0||b.x1>width||b.y1>height){invalid.push({id:i,text:t,bbox:b||null});return;}
      words.push({id:i,text:t,confidence:Number.isFinite(v.confidence)?v.confidence:0,bbox:{...b}});
    });
    return {words,invalid,lines:lines.map(l=>({text:String(l.text||''),bbox:l.bbox||null}))};
  }
  function inferGrid(words,width,height){
    if(words.length<4)return null;
    const h=median(words.map(w=>w.bbox.y1-w.bbox.y0)), bands=[];
    for(const w of words.slice().sort((a,b)=>a.bbox.y0-b.bbox.y0)){
      const b=w.bbox, row=bands.find(r=>Math.min(r.y1,b.y1)-Math.max(r.y0,b.y0)>=.5*Math.min(r.y1-r.y0,b.y1-b.y0));
      if(row){row.y0=Math.min(row.y0,b.y0);row.y1=Math.max(row.y1,b.y1);row.words.push(w);}else bands.push({y0:b.y0,y1:b.y1,words:[w]});
    }
    bands.sort((a,b)=>a.y0-b.y0);
    if(bands.length<2||bands.length>200||bands.some((r,i)=>i&&r.y0<=bands[i-1].y1))return null;
    // Columns require persistent whitespace across ALL boxes, never text-line token splitting.
    const spans=[];
    for(const w of words.slice().sort((a,b)=>a.bbox.x0-b.bbox.x0)){
      const b=w.bbox,last=spans.at(-1);
      if(last&&b.x0-last[1]<h*1.2)last[1]=Math.max(last[1],b.x1);else spans.push([b.x0,b.x1]);
    }
    if(spans.length<2||spans.length>32)return null;
    const x=[0,...spans.slice(1).map((s,i)=>(spans[i][1]+s[0])/2),width];
    if(spans.some((s,i)=>bands.filter(r=>r.words.some(w=>w.bbox.x0>=x[i]&&w.bbox.x1<=x[i+1])).length<2))return null;
    return {x,y:[0,...bands.slice(1).map((r,i)=>(bands[i].y1+r.y0)/2),height]};
  }
  function checkGrid(grid,width,height){
    if(!grid||!Array.isArray(grid.x)||!Array.isArray(grid.y))fail('GRID_REQUIRED');
    for(const [edges,max,limit] of [[grid.x,width,33],[grid.y,height,201]]){
      if(edges.length<2||edges.length>limit||edges[0]!==0||edges.at(-1)!==max||edges.some((v,i)=>!Number.isFinite(v)||(i&&v<=edges[i-1])))fail('FULL_IMAGE_GRID_REQUIRED');
    }
    if((grid.x.length-1)*(grid.y.length-1)>2000)fail('MATRIX_TOO_LARGE');
    return grid;
  }
  function build(data,width,height,options={}){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16000000)fail('IMAGE_DIMENSIONS');
    const meta=metadata(data,width,height), warnings=['OWNER_SOURCE_AND_EVERY_CELL_REVIEW_REQUIRED','ALL_HEADERS_AND_SCOPES_UNKNOWN','OCR_CONFIDENCE_IS_NOT_ACCURACY'];
    let grid=!meta.words.length?null:options.grid?checkGrid(options.grid,width,height):inferGrid(meta.words,width,height);
    if(grid&&(grid.x.length-1)*(grid.y.length-1)>2000)grid=null;
    const physical=[],unassigned=[...meta.invalid], rows=[];
    if(grid){
      warnings.push(options.grid?'OWNER_GRID_STILL_REQUIRES_CELL_REVIEW':'PROVISIONAL_BBOX_GRID_NOT_VERIFIED');
      for(let r=0;r<grid.y.length-1;r++){
        const cells=[];
        for(let c=0;c<grid.x.length-1;c++){
          const bbox={x0:grid.x[c],y0:grid.y[r],x1:grid.x[c+1],y1:grid.y[r+1]};
          const found=meta.words.filter(w=>w.bbox.x0>=bbox.x0&&w.bbox.x1<=bbox.x1&&w.bbox.y0>=bbox.y0&&w.bbox.y1<=bbox.y1);
          // Retain Tesseract's word order, including RTL; no numeric normalization/conversion.
          const text=found.map(w=>w.text).join(' '), confidence=found.length?Math.min(...found.map(w=>w.confidence)):null;
          if(text.length>300)fail('CELL_TOO_LONG_USE_MANUAL_TABLE');
          const cell={row:r,column:c,bbox,text,status:!found.length?'missing':confidence>=85?'clear':'unclear',confidence,word_ids:found.map(w=>w.id)};
          physical.push(cell);cells.push({text:cell.text,status:cell.status});
        }
        rows.push({id:'r'+r,cells});
      }
      const assigned=new Set(physical.flatMap(c=>c.word_ids));meta.words.filter(w=>!assigned.has(w.id)).forEach(w=>unassigned.push(w));
    }else warnings.push('GEOMETRY_UNRESOLVED_NO_PHYSICAL_CELLS_INFERRED');
    if(unassigned.length)warnings.push('CROSSING_OR_INVALID_BOXES_UNASSIGNED');
    // A required importer slot is NOT a detected rate when geometry is unresolved.
    const n=grid?grid.x.length-1:1;
    const matrix={schema_version:1,complete:false,tables:[{id:grid?'local_bbox_provisional':'local_geometry_unresolved',
      columns:Array.from({length:n},(_,c)=>({id:'c'+c,label:grid?'UNMAPPED physical column '+c:'NO GEOMETRY — manual transcription required',field:'rate',scope:unknown()})),
      rows:grid?rows:[{id:'unresolved',cells:[{text:'',status:'missing'}]}]}]};
    return {matrix,physical_cells:physical,raw_text:String(data.text||''),words:meta.words,lines:meta.lines,unassigned,warnings,grid:grid||null,image:{width,height}};
  }
  function showReview(w,result){
    const host=w.document?.querySelector('.f99ri14-dialog .f99ri14');if(!host)return;
    host.querySelector('[data-local-ocr-review]')?.remove();
    const details=w.document.createElement('details');details.dataset.localOcrReview='';details.open=true;
    const title=w.document.createElement('summary');title.textContent='قراءة محلية أولية — النص الكامل والصناديق؛ لا اعتماد تلقائي';
    const pre=w.document.createElement('pre');pre.dir='auto';pre.style.whiteSpace='pre-wrap';
    pre.textContent=(typeof result.raw_text==='string'?result.raw_text+'\n\n':'')+JSON.stringify(result,null,2);details.append(title,pre);host.append(details);
  }
  function createTransport(w,options={}){
    let original=null,active=false,generation=0;
    const timeoutMs=Math.min(90000,Math.max(1,options.timeoutMs||85000));
    const emit=result=>(options.onReview||((r)=>showReview(w,r)))(result);
    async function transport(payload){
      if(active)return {ok:false,reason:'LOCAL_OCR_BUSY'};
      active=true;let worker=null,expired=false,initializing=false,timer=null,task;
      const token=++generation;
      const alive=()=>{if(expired||token!==generation)fail('LOCAL_OCR_CANCELLED');};
      const stop=()=>{try{const p=worker?.terminate();if(p?.catch)p.catch(()=>{});}catch(_){}worker=null;};
      try{
        emit({state:'RUNNING',warning:'OCR is local, provisional and never approval.'});
        task=(async()=>{
          const file=original; if(!file)fail('ORIGINAL_FILE_REQUIRED');
          if(!payload||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(payload.image_data_url||'')||payload.image_data_url.length>1300000)fail('INVALID_PREPARED_PAYLOAD');
          const api=w.F99RateTableImport;if(!api?.prepareImage||!api?.sha256)fail('IMPORTER_REQUIRED');
          // Bind original bytes to the exact payload the owner reviewed. No stale file fallback.
          const prepared=await api.prepareImage(w,file);alive();
          if(prepared.data_url!==payload.image_data_url)fail('ORIGINAL_PREVIEW_MISMATCH');
          const bitmap=await w.createImageBitmap(file,{imageOrientation:'from-image'});
          const width=bitmap.width,height=bitmap.height;bitmap.close?.();alive();
          if(typeof w.ensureFINOLocalTesseract!=='function')fail('EXISTING_TESSERACT_LOADER_REQUIRED');
          const T=await w.ensureFINOLocalTesseract();alive();
          if(typeof T?.createWorker!=='function')fail('TESSERACT_WORKER_API_REQUIRED');
          // Existing loader explicitly references @5. Use owned v5+ worker for termination.
          const creating=T.createWorker('ara+eng',1,{cacheMethod:'none',logger:()=>{},workerBlobURL:false,workerPath:'/vendor/fino99-ocr/tesseract-5.1.1-core-5.1.1-data-1.0.0/worker.min.js',corePath:'/vendor/fino99-ocr/tesseract-5.1.1-core-5.1.1-data-1.0.0/core',langPath:'/vendor/fino99-ocr/tesseract-5.1.1-core-5.1.1-data-1.0.0/lang'});
          initializing=true;try{worker=await creating;}finally{initializing=false;}
          if(expired||token!==generation){stop();fail('LOCAL_OCR_CANCELLED');}
          if(typeof worker.recognize!=='function')fail('TESSERACT_RECOGNIZE_REQUIRED');
          // v5 words; v6 needs blocks:true. Never assume data.words exists.
          const result=await worker.recognize(file,{}, {text:true,blocks:true,hocr:false,tsv:false});alive();
          if(!result?.data)fail('OCR_METADATA_MISSING');
          const review=build(result.data,width,height,{grid:options.getGrid?.()});
          if(!review.words.length)review.warnings.push('NO_VALID_WORD_BOXES_RAW_TEXT_ONLY');
          const hash=prepared.upload_sha256;
          if(!/^[a-f0-9]{64}$/.test(hash||''))fail('PREVIEW_HASH_REQUIRED');
          alive();emit(review);
          return {ok:true,transport_sha256:hash,matrix:review.matrix,review};
        })();
        return await Promise.race([task,new Promise((_,reject)=>{timer=w.setTimeout(()=>{expired=true;stop();reject(Error('LOCAL_OCR_TIMEOUT'));},timeoutMs);})]);
      }catch(e){const reason=/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'LOCAL_OCR_FAILED';emit({state:'FAILED',reason});return {ok:false,reason};}
      finally{const timedOut=expired;expired=true;w.clearTimeout(timer);stop();original=null;
        if(timedOut&&initializing&&task)task.catch(()=>{}).finally(()=>{active=false;});else active=false;
      }
    }
    transport.setOriginalFile=file=>{if(active)fail('LOCAL_OCR_BUSY');original=file||null;};
    transport.clear=()=>{original=null;generation++;};
    return transport;
  }
  return {build,metadata,inferGrid,checkGrid,createTransport,showReview};
});
