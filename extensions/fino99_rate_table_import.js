/* FINO99 section 5: extraction -> editable review -> explicit one-row CAS approval.
 * Staging integration only. No rate store, calculator, bulk apply, default OCR or auto approval. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.F99RateTableImport = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const FIELDS = ['bank_id','finance_type','segment','salary_min','salary_max','term_scope','product_scope','rate_type','effective_date'];
  const EDIT = [...FIELDS, 'rate', 'cell_status'];
  const LABEL = {bank_id:'معرف البنك',finance_type:'التمويل personal / mortgage',segment:'الفئة',salary_min:'الراتب من',salary_max:'إلى (* بلا حد)',term_scope:'نطاق المدة',product_scope:'نطاق المنتج',rate_type:'نوع النسبة',effective_date:'السريان YYYY-MM-DD',rate:'النسبة %',cell_status:'clear / unclear / missing'};
  const LIMITS = {bytes: 950000, originalBytes: 8000000, pixels: 16000000, side: 12000, cells: 2000, rows: 200, columns: 32, tables: 8};
  const fail = reason => { throw Error(reason); };
  const clone = x => JSON.parse(JSON.stringify(x));
  function digits(v) { return String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g,'.').replace(/٪/g,'%').replace(/[\u200e\u200f\u061c]/g,'').trim(); }
  function number(v, kind) {
    let s = digits(v);
    if (kind === 'max' && ['*','unbounded','بلا حد'].includes(s)) return null;
    if (!s) fail('MISSING_NUMBER');
    if (kind === 'rate') {
      s = s.replace(/\s*%$/, '');
      if (/^\d+[,،]\d{1,2}$/.test(s)) s = s.replace(/[,،]/,'.');
      else if (/[,،٬]/.test(s)) fail('AMBIGUOUS_DECIMAL');
    } else {
      if (/^\d{1,3}(?:[,٬]\d{3})+(?:\.\d{1,2})?$/.test(s)) s = s.replace(/[,٬]/g,'');
      else if (/[,،٬]/.test(s)) fail('AMBIGUOUS_GROUPING');
    }
    if (!/^\d+(?:\.\d+)?$/.test(s)) fail('UNCLEAR_NUMBER');
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || (kind === 'rate' ? n <= 0 || n > 30 : n > 100000000)) fail('NUMBER_OUT_OF_RANGE');
    return n;
  }
  function date(v) {
    const s = digits(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail('DATE_REQUIRED');
    const d = new Date(s + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== s) fail('INVALID_DATE');
    return s;
  }
  function text(v) { return String(v ?? '').trim(); }
  function validateMatrix(doc) {
    if (!doc || doc.schema_version !== 1 || typeof doc.complete !== 'boolean' || !Array.isArray(doc.tables) || !doc.tables.length || doc.tables.length > LIMITS.tables) fail('INVALID_MATRIX');
    let count = 0; const ids = new Set();
    for (const t of doc.tables) {
      if (!t || typeof t.id !== 'string' || !text(t.id) || t.id.length > 80 || ids.has(t.id) || !Array.isArray(t.columns) || !t.columns.length || t.columns.length > LIMITS.columns || !Array.isArray(t.rows) || !t.rows.length || t.rows.length > LIMITS.rows) fail('INVALID_TABLE');
      ids.add(t.id); const columns = new Set(), rows = new Set();
      for (const c of t.columns) {
        if (!c || typeof c.id !== 'string' || !text(c.id) || c.id.length > 80 || columns.has(c.id) || ![...FIELDS,'rate','note'].includes(c.field) || typeof c.label !== 'string' || c.label.length > 160 || !c.scope || typeof c.scope !== 'object' || Array.isArray(c.scope)) fail('INVALID_COLUMN');
        columns.add(c.id);
        if (Object.keys(c.scope).some(k => !FIELDS.includes(k)) || Object.values(c.scope).some(v => typeof v !== 'string' || v.length > 160)) fail('INVALID_COLUMN_SCOPE');
      }
      if (!t.columns.some(c => c.field === 'rate')) fail('RATE_COLUMN_REQUIRED');
      for (const r of t.rows) {
        if (!r || typeof r.id !== 'string' || !text(r.id) || r.id.length > 80 || rows.has(r.id) || !Array.isArray(r.cells) || r.cells.length !== t.columns.length) fail('RAGGED_OR_DUPLICATE_ROW');
        rows.add(r.id);
        for (const c of r.cells) if (!c || typeof c.text !== 'string' || c.text.length > 300 || !['clear','missing','unclear'].includes(c.status) || (c.status === 'clear' && !c.text.trim())) fail('INVALID_CELL');
        count += r.cells.length; if (count > LIMITS.cells) fail('MATRIX_TOO_LARGE');
      }
    }
    return doc;
  }
  function flatten(doc) {
    validateMatrix(doc); const out = [];
    for (const t of doc.tables) for (const r of t.rows) {
      const scope = {}, errors = [];
      t.columns.forEach((c,i) => {
        if (FIELDS.includes(c.field)) {
          if (scope[c.field] !== undefined) errors.push('DUPLICATE_DIMENSION:' + c.field);
          scope[c.field] = r.cells[i].text;
          if (r.cells[i].status !== 'clear') errors.push('UNCLEAR_SCOPE:' + c.field);
        }
      });
      t.columns.forEach((c,i) => {
        if (c.field !== 'rate') return;
        const conflicts = Object.keys(c.scope).filter(k => scope[k] !== undefined && digits(scope[k]) !== digits(c.scope[k]));
        out.push({id: t.id + '/' + r.id + '/' + c.id, source_cell: {table:t.id,row:r.id,column:c.id},
          ...scope, ...c.scope, rate:r.cells[i].text, cell_status:r.cells[i].status,
          extraction_errors:[...errors,...conflicts.map(k=>'CONFLICTING_HEADER:' + k),...(!doc.complete ? ['INCOMPLETE_IMAGE'] : [])], reviewed:false, phase:'DRAFT'});
      });
    }
    return out;
  }
  function normalized(row, today) {
    const errors = [...(row.extraction_errors || [])], n = {};
    for (const k of FIELDS) n[k] = digits(row[k]);
    const attempt = (k,f) => { try { n[k] = f(); } catch(e) { errors.push(k + ':' + e.message); } };
    attempt('rate', () => number(row.rate,'rate'));
    attempt('effective_date', () => date(row.effective_date));
    if (n.effective_date > (today || new Date().toISOString().slice(0,10))) errors.push('FUTURE_EFFECTIVE_DATE_UNSUPPORTED');
    if (!n.bank_id) errors.push('BANK_REQUIRED');
    if (!['personal','mortgage'].includes(n.finance_type)) errors.push('FINANCE_TYPE_REQUIRED');
    if (n.finance_type === 'personal') {
      if (!['general','military','private','retired','semiGovernment'].includes(n.segment)) errors.push('SEGMENT_REQUIRED');
      attempt('salary_min', () => number(row.salary_min,'min'));
      attempt('salary_max', () => number(row.salary_max,'max'));
      if (n.salary_max !== null && n.salary_max < n.salary_min) errors.push('INVALID_SALARY_BAND');
    } else if (n.finance_type === 'mortgage' && (n.segment !== 'not_applicable' || n.salary_min !== 'not_applicable' || n.salary_max !== 'not_applicable')) errors.push('MORTGAGE_SCOPE_MUST_BE_EXPLICIT_NA');
    // Shared base rows cannot store term/product/customer offers. Never widen a source offer.
    if (n.term_scope !== 'all_approved_terms') errors.push('UNSUPPORTED_TERM_SCOPE');
    if (n.product_scope !== (n.finance_type === 'mortgage' ? 'shared_mortgage_base' : 'shared_personal_base')) errors.push('UNSUPPORTED_PRODUCT_SCOPE');
    if (n.rate_type !== 'annual_profit_margin') errors.push(n.rate_type.toUpperCase().includes('APR') ? 'APR_NOT_RATE' : 'ANNUAL_FLAT_BASIS_REQUIRED');
    if (row.cell_status !== 'clear') errors.push('UNCLEAR_OR_MISSING_CELL');
    if (!row.reviewed) errors.push('OWNER_CELL_REVIEW_REQUIRED');
    return {value:n,errors:[...new Set(errors)]};
  }
  function exact(row, records) {
    return records.filter(r => r.locator?.bank_id === row.bank_id && r.locator.finance_type === row.finance_type
      && (row.finance_type === 'mortgage' || (r.locator.segment === row.segment && Number(r.scope?.salary_min) === row.salary_min && (r.scope.salary_max == null ? null : Number(r.scope.salary_max)) === row.salary_max))
      && r.scope?.term_scope === row.term_scope && r.scope.product_scope === row.product_scope
      && r.scope.metric === 'annual_profit_margin' && r.scope.enabled === true
      && (row.finance_type !== 'personal' || r.scope.effective_types?.length > 0));
  }
  function sourceMetadata(source, row) {
    if (!source || !/^[a-f0-9]{64}$/.test(source.sha256 || '') || !/^[a-f0-9]{64}$/.test(source.upload_sha256 || '') || source.reviewed !== true) fail('OWNER_SOURCE_REVIEW_REQUIRED');
    if (!['owner_set','owner_unverified','owner_stale'].includes(source.status)) fail('OWNER_STATUS_REQUIRED');
    // Filename is explicitly owner-reviewable: remove paths, rename if it contains personal data.
    const filename = text(source.filename).split(/[\\/]/).pop();
    if (!filename || filename.length > 60 || /[|\r\n\u0000-\u001f]/.test(filename)) fail('SAFE_FILENAME_REQUIRED');
    const note = text(source.note);
    if (note.length < 4 || note.length > 60 || /[|\r\n]/.test(note)) fail('SOURCE_NOTE_REQUIRED_MAX60');
    const s = 'image14|sha256=' + source.sha256 + '|upload=' + source.upload_sha256 + '|file=' + filename + '|owner=' + note;
    if (s.length > 300) fail('SOURCE_METADATA_TOO_LONG');
    return {source:s,date:row.effective_date,status:source.status};
  }
  function targetKey(n) { return JSON.stringify([n.bank_id,n.finance_type,n.segment,n.salary_min,n.salary_max]); }
  function create(w, io) {
    const manager = io.manager || w.F99RateManager?.create(w, {call:io.call,card:io.card || (()=>fail('USE_EXISTING_RATE_HISTORY_UI')),say:io.say || (()=>{})});
    if (!manager?.freshVerify) fail('EXISTING_RATE_MANAGER_REQUIRED');
    let rows = [], source = null, matrix = null, locked = false;
    const pending = new Map();
    const rpc = async (action,data) => {
      const r = await io.call('f99r9_owner',{p_action:action,p_data:data || {}});
      if (!r?.ok) fail(r?.reason || 'TRANSPORT'); return r;
    };
    function snapshot() { return {rows:clone(rows),source:clone(source),matrix:clone(matrix),previews:clone(Object.fromEntries([...pending].map(([id,p])=>[id,p.preview]))),locked}; }
    function setSource(v) { if (locked || rows.some(r=>['COMMIT_UNKNOWN','SAVED_UNVERIFIED'].includes(r.phase))) fail('RECONCILE_SAVED_ROW_FIRST'); source=clone(v); pending.clear(); rows.forEach(r=>{if(!r.audit_id)r.phase='DRAFT';}); }
    function load(doc, src) {
      if (locked || rows.some(r=>['COMMIT_UNKNOWN','SAVED_UNVERIFIED'].includes(r.phase))) fail('RECONCILE_SAVED_ROW_FIRST');
      rows=flatten(doc); matrix=clone(doc); source=clone(src); pending.clear(); return snapshot();
    }
    function edit(id, patch) {
      if (locked) fail('BUSY'); const r=rows.find(x=>x.id===id); if (!r || r.audit_id || r.phase==='COMMIT_UNKNOWN') fail('ROW_LOCKED');
      if (Object.keys(patch).some(k=>![...EDIT,'reviewed','extraction_errors'].includes(k))) fail('INVALID_EDIT');
      // Clearing extraction flags is a distinct, explicitly owner-reviewed correction.
      if ('extraction_errors' in patch && (!Array.isArray(patch.extraction_errors) || patch.extraction_errors.length || patch.reviewed !== true)) fail('EXPLICIT_CORRECTION_REQUIRED');
      Object.assign(r,clone(patch)); r.phase='DRAFT'; pending.delete(id); return snapshot();
    }
    function inspect(id) {
      const r=rows.find(x=>x.id===id); if(!r)fail('ROW_NOT_FOUND'); const n=normalized(r,io.today);
      const key=targetKey(n.value);
      if (rows.some(x=>x.id!==id && targetKey(normalized(x,io.today).value)===key)) n.errors.push('DUPLICATE_TARGET_IN_IMPORT_INCLUDING_DATES');
      return n;
    }
    async function catalog(type) {
      const result=[];let offset=0;
      for(let i=0;i<100;i++) {const r=await rpc('catalog',{finance_type:type,limit:100,offset});result.push(...(r.items||[])); if(r.next_offset==null)return result; if(r.next_offset<=offset)fail('INVALID_PAGINATION');offset=r.next_offset;}
      fail('CATALOG_TOO_LARGE');
    }
    async function preview(id) {
      if(locked || rows.some(r=>['COMMIT_UNKNOWN','SAVED_UNVERIFIED'].includes(r.phase)))fail('RECONCILE_SAVED_ROW_FIRST'); locked=true;
      try {
        const row=rows.find(r=>r.id===id);if(!row || row.audit_id)fail('ROW_LOCKED');
        const n=inspect(id);if(n.errors.length)fail(n.errors.join(', ')); const md=sourceMetadata(source,n.value);
        const matches=exact(n.value,await catalog(n.value.finance_type));if(matches.length!==1)fail(matches.length?'AMBIGUOUS_TARGET':'EXACT_SCOPE_NOT_FOUND');
        const r=matches[0], p=await rpc('preview',{locator:r.locator,fingerprint:r.fingerprint,old_rate:Number(r.rate),new_rate:n.value.rate,
          metric:'annual_profit_margin',requested_scope:{finance_type:r.locator.finance_type,metric:'annual_profit_margin',...(r.locator.segment?{segment:r.locator.segment}:{})},metadata:md});
        pending.set(id,{preview:p,approvedSnapshot:JSON.stringify({row,source})});row.phase='PREVIEW';return clone(p);
      } finally {locked=false;}
    }
    async function approve(id, approved) {
      if(approved!==true)fail('OWNER_APPROVAL_REQUIRED');if(locked)fail('BUSY'); const r=rows.find(x=>x.id===id),p=pending.get(id);
      if(!r || !p || !['PREVIEW','COMMIT_UNKNOWN'].includes(r.phase))fail('PREVIEW_REQUIRED');
      if(r.phase==='PREVIEW'){const n=inspect(id);if(n.errors.length)fail(n.errors.join(', '));}
      // phase is workflow state, not editable evidence.
      const bound=JSON.parse(p.approvedSnapshot);bound.row.phase=r.phase;
      if(JSON.stringify({row:r,source})!==JSON.stringify(bound))fail('EDITED_AFTER_PREVIEW');
      locked=true;
      try {
        let c;try {c=await rpc('commit',{pending_id:p.preview.pending_id,approved:true});} catch(e) {
          r.phase=e.message==='TRANSPORT'?'COMMIT_UNKNOWN':'DRAFT'; if(r.phase==='DRAFT')pending.delete(id);throw e;
        }
        r.audit_id=c.audit_id;r.committed=c;r.phase='SAVED_UNVERIFIED';
        // O8 fingerprints cover the entire settings row. Other rows MUST be re-previewed.
        for(const x of rows)if(x.id!==id && !x.audit_id){pending.delete(x.id);x.phase='DRAFT';}
        const v=await manager.freshVerify(c);if(v?.ok!==true)return {ok:false,saved:true,audit_id:c.audit_id,reason:v?.reason||'CALCULATOR_NOT_VERIFIED'};
        r.phase='VERIFIED';return {ok:true,audit_id:c.audit_id,verification:v};
      } finally {locked=false;}
    }
    async function verify(id) {
      if(locked)fail('BUSY');const r=rows.find(x=>x.id===id);if(!r?.committed)fail('SAVED_ROW_REQUIRED');locked=true;
      try{const v=await manager.freshVerify(r.committed);if(v?.ok===true)r.phase='VERIFIED';return v;}finally{locked=false;}
    }
    return {load,edit,setSource,inspect,preview,approve,verify,snapshot,history:()=>manager.history()};
  }
  async function sha256(w, bytes) {return Array.from(new Uint8Array(await w.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
  function cropBounds(crop,width,height) {
    if(!crop)return {x:0,y:0,width,height};
    if(!['x','y','width','height'].every(k=>Number.isInteger(crop[k])) || crop.x<0 || crop.y<0 || crop.width<1 || crop.height<1 || crop.x+crop.width>width || crop.y+crop.height>height)fail('CROP_OUT_OF_BOUNDS');
    return crop;
  }
  function imageDimensions(buffer,mime) {
    const v=new DataView(buffer), b=new Uint8Array(buffer), ascii=(p,n)=>String.fromCharCode(...b.slice(p,p+n));
    if(mime==='image/png' && b.length>=24 && v.getUint32(0)===0x89504e47 && v.getUint32(4)===0x0d0a1a0a && ascii(12,4)==='IHDR')return {width:v.getUint32(16),height:v.getUint32(20)};
    if(mime==='image/jpeg' && b[0]===255 && b[1]===216){let p=2;while(p+4<=b.length){if(b[p++]!==255)fail('IMAGE_INVALID');while(b[p]===255)p++;const marker=b[p++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const len=v.getUint16(p);if(len<2||p+len>b.length)fail('IMAGE_INVALID');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(len<8)fail('IMAGE_INVALID');return {height:v.getUint16(p+3),width:v.getUint16(p+5)};}p+=len;}}
    if(mime==='image/webp' && b.length>=30 && ascii(0,4)==='RIFF' && ascii(8,4)==='WEBP'){
      const u24=p=>b[p]+b[p+1]*256+b[p+2]*65536, kind=ascii(12,4);
      if(kind==='VP8X'){if(b[20]&2)fail('ANIMATED_IMAGE_UNSUPPORTED');return {width:1+u24(24),height:1+u24(27)};}
      if(kind==='VP8 ' && b[23]===157 && b[24]===1 && b[25]===42)return {width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383};
      if(kind==='VP8L' && b[20]===47)return {width:1+(b[21]|((b[22]&63)<<8)),height:1+((b[22]>>6)|(b[23]<<2)|((b[24]&15)<<10))};
    }
    fail('IMAGE_HEADER_INVALID');
  }
  async function prepareImage(w,file,crop) {
    if(!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size<1 || file.size>LIMITS.originalBytes)fail('IMAGE_TYPE_OR_SIZE');
    const buffer=await file.arrayBuffer(), dim=imageDimensions(buffer,file.type);
    if(dim.width<1 || dim.height<1 || dim.width>LIMITS.side || dim.height>LIMITS.side || dim.width*dim.height>LIMITS.pixels)fail('IMAGE_DIMENSIONS');
    const hash=await sha256(w,buffer);
    const image=await w.createImageBitmap(file,{imageOrientation:'from-image'});
    try {
      if(image.width>LIMITS.side || image.height>LIMITS.side || image.width*image.height>LIMITS.pixels)fail('IMAGE_DIMENSIONS');
      const c=cropBounds(crop,image.width,image.height), scale=Math.min(1,2400/Math.max(c.width,c.height));
      const canvas=w.document.createElement('canvas');canvas.width=Math.max(1,Math.round(c.width*scale));canvas.height=Math.max(1,Math.round(c.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,c.x,c.y,c.width,c.height,0,0,canvas.width,canvas.height);
      let blob;
      for(const quality of [.94,.86,.76,.66]) {blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob?.size<=LIMITS.bytes)break;}
      if(!blob || blob.size>LIMITS.bytes)fail('IMAGE_TOO_DENSE_USE_CLEAR_SMALLER_TABLE');
      const bytes=await blob.arrayBuffer(), uploadHash=await sha256(w,bytes);
      const data=await new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('IMAGE_READ_FAILED'));r.readAsDataURL(blob);});
      return {data_url:data,sha256:hash,upload_sha256:uploadHash,filename:file.name,width:canvas.width,height:canvas.height,crop:c,cropped:!!crop};
    } finally {image.close?.();}
  }
  async function extract(w,image,options) {
    if(!options?.readable)fail('REVIEW_TRANSMITTED_IMAGE_FIRST');
    // A static deployment has no server endpoint. Never fall back to a public paid API or regex OCR.
    if(typeof options.transport!=='function')return {ok:false,reason:'NOT_CONFIGURED'};
    const r=await options.transport({image_data_url:image.data_url,filename:image.filename});
    if(r?.ok!==true) return {ok:false,reason:r?.reason||'OCR_FAILED'};
    if(r.transport_sha256!==image.upload_sha256)fail('IMAGE_HASH_MISMATCH');
    const matrix=validateMatrix(r.matrix);
    if(image.cropped)matrix.complete=false;
    return {ok:true,matrix};
  }
  function manualTSV(input) {
    const lines=String(input||'').replace(/\r/g,'').split('\n');if(lines.at(-1)==='')lines.pop();
    if(lines.length<2)fail('TSV_HEADER_AND_ROWS_REQUIRED');
    const header=lines.shift().split('\t');
    if(new Set(header).size!==header.length || !header.includes('rate') || header.some(k=>![...FIELDS,'rate','note'].includes(k)))fail('TSV_EXPLICIT_HEADERS_REQUIRED');
    return validateMatrix({schema_version:1,complete:true,tables:[{id:'manual',columns:header.map((field,i)=>({id:'c'+i,label:field,field,scope:{}})),rows:lines.map((line,i)=>({id:'r'+i,cells:line.split('\t').map(v=>({text:v,status:v.trim()?'clear':'missing'}))}))}]});
  }
  function mount(w,host,io,file) {
    const d=w.document, service=create(w,io);host.classList.add('f99ri14');host.dir='rtl';let image=null, busy=false;
    const el=(tag,value)=>{const x=d.createElement(tag);if(value!==undefined)x.textContent=value;return x;};
    const button=(label,action)=>{const b=el('button',label);b.type='button';b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;host.inert=true;try{await action();}catch(e){status.textContent=e.message;}finally{busy=false;host.inert=false;b.disabled=false;}};return b;};
    host.replaceChildren(el('h2','قراءة جدول النسب — مراجعة ثم اعتماد كل سجل منفردًا'));
    host.append(el('p','هامش الربح السنوي FLAT السنوي ليس APR. لن ننشئ شريحة أو نوسّع مدة/منتج، ولن نغير أهلية أو تصميم النتائج. الصور لا تحفظ؛ سجل التدقيق يحفظ البصمة واسم الملف الذي تراجعه فقط.'));
    const status=el('p','اختر صورة واضحة أو الصق جدول TSV. القراءة وحدها لا تغير النسب.');status.setAttribute('role','status');host.append(status);
    const upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label','صورة جدول النسب');host.append(upload);
    const previewImage=el('img');previewImage.alt='الصورة المضغوطة المرسلة للقراءة — تأكد من وضوح كل خلية';previewImage.hidden=true;host.append(previewImage);
    const check=(label)=>{const box=el('label'),input=el('input');input.type='checkbox';box.append(input,d.createTextNode(label));host.append(box);return input;};
    const readable=check('راجعت وضوح الصورة وكل العناوين — أوافق على قراءتها محليًا في متصفحي. قد تُحمّل ملفات القارئ المجانية؛ الصورة لا تُرفع إلى مزود خارجي.');
    const sourceBox=el('fieldset');sourceBox.append(el('legend','مصدر يحدده المالك — ليس تحققًا مصرفيًا آليًا'));host.append(sourceBox);
    const sf={};for(const [k,l] of [['filename','اسم ملف خالٍ من البيانات الشخصية (60 حرفًا)'],['note','وصف مصدر يحدده المالك (4–60 حرفًا)'],['status','الحالة owner_set / owner_unverified / owner_stale']]){const a=el('label',l),i=el('input');i.value=k==='status'?'owner_unverified':'';i.setAttribute('aria-label',l);a.append(i);sourceBox.append(a);sf[k]=i;}
    const sourceReviewed=check('راجعت المصدر والبصمة واسم الملف؛ لا يحتوي الاسم أو الوصف بيانات شخصية');
    function src(){if(!image)fail('SOURCE_IMAGE_REQUIRED');return {sha256:image.sha256,upload_sha256:image.upload_sha256,filename:sf.filename.value,note:sf.note.value,status:sf.status.value,reviewed:sourceReviewed.checked};}
    function sourceChanged(){try{service.setSource(src());render();}catch(e){status.textContent=e.message;}}
    Object.values(sf).forEach(i=>{i.oninput=sourceChanged;});sourceReviewed.onchange=sourceChanged;
    async function select(f){if(!f)return;service.setSource({reviewed:false});image=null;previewImage.hidden=true;render();const prepared=await prepareImage(w,f);image=prepared;service.setSource({sha256:image.sha256,upload_sha256:image.upload_sha256,filename:f.name,reviewed:false});sf.filename.value=f.name;sourceReviewed.checked=false;readable.checked=false;previewImage.src=image.data_url;previewImage.hidden=false;render();status.textContent='بصمة المصدر: '+image.sha256+' — الصورة جاهزة للمراجعة، لم ترسل بعد.';}
    upload.onchange=async()=>{if(busy)return;busy=true;host.inert=true;try{await select(upload.files?.[0]);}catch(e){status.textContent=e.message;}finally{busy=false;host.inert=false;}};
    host.append(button('1. اقرأ جميع خلايا الصورة فقط',async()=>{if(!image)fail('SOURCE_IMAGE_REQUIRED');const r=await extract(w,image,{readable:readable.checked,transport:io.extractTransport});if(!r.ok){status.textContent=r.reason==='NOT_CONFIGURED'?'تعذر تهيئة القارئ المحلي. إدخال الجدول يدويًا متاح؛ لم تُقرأ الصورة.':r.reason;return;}service.load(r.matrix,src());render();}));
    const details=el('details');details.append(el('summary','بديل يدوي: الصق كل الأعمدة من جدول TSV (لا قراءة OCR مدعاة)'));const tsv=el('textarea');tsv.rows=5;tsv.setAttribute('aria-label','جدول TSV كامل');tsv.placeholder=[...FIELDS,'rate'].join('\t');details.append(tsv,button('استورد الجدول للمعاينة فقط',()=>{service.load(manualTSV(tsv.value),src());render();}));host.append(details);
    const tableBox=el('div');tableBox.className='f99ri14-scroll';host.append(tableBox);
    function render() {
      tableBox.replaceChildren();const state=service.snapshot();status.textContent=state.rows.length+' خلايا نسب. كل خلية تبقى ظاهرة حتى لو ناقصة أو غير مدعومة؛ صححها ولا تخمّن. تطبيق متعمد سجلًا بسجل (ليس دفعة ذرية).';
      if(state.matrix){const raw=el('details');raw.append(el('summary','المصفوفة الأصلية كاملة بكل الصفوف والأعمدة والحواشي'));const box=el('div');box.className='f99ri14-raw';for(const t of state.matrix.tables){const rt=el('table'),rh=el('tr');rh.append(el('th',t.id));t.columns.forEach(c=>rh.append(el('th',c.label)));rt.append(rh);for(const r of t.rows){const rr=el('tr');rr.append(el('th',r.id));r.cells.forEach(c=>rr.append(el('td',c.text+' ['+c.status+']')));rt.append(rr);}box.append(rt);}raw.append(box);tableBox.append(raw);}
      const table=el('table'),head=el('tr');['الخلية',...EDIT.map(k=>LABEL[k]),'مراجعة وتصحيح','حالة وأخطاء','إجراء'].forEach(t=>head.append(el('th',t)));table.append(head);
      for(const row of state.rows) {
        const tr=el('tr');tr.append(el('td',row.id));
        for(const k of EDIT){const td=el('td'),i=el('input');i.value=row[k]??'';i.setAttribute('aria-label',row.id+' '+LABEL[k]);i.disabled=!!row.audit_id||row.phase==='COMMIT_UNKNOWN';i.onchange=()=>{service.edit(row.id,{[k]:i.value,reviewed:false});render();};td.append(i);tr.append(td);}
        const reviewed=el('td'),cb=el('input');cb.type='checkbox';cb.checked=row.reviewed;cb.disabled=!!row.audit_id||row.phase==='COMMIT_UNKNOWN';cb.setAttribute('aria-label','راجعت وصححت الخلية '+row.id);cb.onchange=()=>{service.edit(row.id,{reviewed:cb.checked,...(cb.checked?{extraction_errors:[]}: {})});render();};reviewed.append(cb,el('span','راجعت كل نطاق وخلية وعالجت أعلام الاستخراج دون تخمين'));tr.append(reviewed);
        const problems=service.inspect(row.id).errors;tr.append(el('td',row.phase+' '+problems.join(' / ')+(row.audit_id?' التدقيق: '+row.audit_id:'')));
        const acts=el('td');
        const p=state.previews[row.id];if(p&&['PREVIEW','COMMIT_UNKNOWN'].includes(row.phase)){const bound=el('p','معاينة الخادم: '+p.old_rate+'% → '+p.new_rate+'%\n'+JSON.stringify(p.scope)+'\nالمصدر: '+p.after_metadata.source+'\nالسريان: '+p.after_metadata.date+' / '+p.after_metadata.status+'\nتنتهي: '+p.expires_at);acts.append(bound);}
        if(!row.audit_id){const pb=button('2. معاينة الخادم لهذا السجل',async()=>{service.setSource(src());const p=await service.preview(row.id);render();status.textContent='معاينة فقط: '+p.old_rate+'% ← '+p.new_rate+'%؛ '+JSON.stringify(p.scope)+'؛ المصدر '+p.after_metadata.source+'؛ السريان '+p.after_metadata.date+'؛ الحالة '+p.after_metadata.status+'؛ تنتهي '+p.expires_at;});pb.disabled=problems.length>0||row.phase==='COMMIT_UNKNOWN';acts.append(pb);
          if(['PREVIEW','COMMIT_UNKNOWN'].includes(row.phase)){const ab=button(row.phase==='COMMIT_UNKNOWN'?'تحقق من نفس الاعتماد المجهول (نفس المعرف)':'3. أوافق صراحة: اعتمد هذا السجل فقط',async()=>{const r=await service.approve(row.id,true);render();status.textContent=r.ok?'اعتمد وتحقق المصدر والحاسبة الأصلية. التدقيق: '+r.audit_id:'حُفظ لكن غير متحقق؛ لا تعِد الكتابة. التدقيق: '+r.audit_id+' '+r.reason;});ab.disabled=row.phase==='PREVIEW'&&problems.length>0;acts.append(ab);}
        } else acts.append(button('إعادة تحقق فقط — بلا كتابة',async()=>{const r=await service.verify(row.id);render();status.textContent=r.ok?'تحققت الحاسبة الأصلية':r.reason;}));
        tr.append(acts);table.append(tr);
      }
      tableBox.append(table);
    }
    if(io.openHistory)host.append(button('سجل النسب والتراجع من مدير النسب الأصلي',()=>io.openHistory()));
    if(file)select(file).catch(e=>{status.textContent=e.message;});
    return {service,selectFile:select,destroy(){previewImage.removeAttribute('src');image=null;host.replaceChildren();}};
  }
  function install(w,io) {
    if(!io || typeof io.call!=='function')fail('OWNER_TRANSPORT_REQUIRED');
    let modal=null,ui=null,opening=false;
    const notify=message=>{if(io.say)io.say(message);else w.alert(message);};
    async function open(file) {
      if(opening)return;opening=true;
      try{
        const auth=await io.call('f99r9_owner',{p_action:'catalog',p_data:{limit:1,offset:0}});
        if(auth?.ok!==true)fail('OWNER_UNAUTHORIZED');
        if(!modal){modal=w.document.createElement('dialog');modal.className='f99ri14-dialog';modal.setAttribute('aria-label','مراجعة صورة نسب البنوك');const close=w.document.createElement('button');close.type='button';close.textContent='إخفاء — تبقى المعاينات في هذه الجلسة';close.onclick=()=>modal.close();const host=w.document.createElement('section');modal.append(close,host);w.document.body.append(modal);ui=mount(w,host,io);}
        if(!modal.open)modal.showModal();if(file)await ui.selectFile(file);return ui;
      } catch(e){notify(e.message);return null;}finally{opening=false;}
    }
    // Current actual names, not a new parallel icon. Stale legacy confirmation buttons cannot write.
    const replacements={
      readFINOPortalAdminImage:input=>open(input?.files?.[0]),
      analyzeFINOLocalImage:()=>open(io.getPendingImage?.()),
      confirmFINOPortalImageRates:()=>open(),
      confirmFINOLocalRateUpdate:()=>open()
    };
    for(const [name,fn] of Object.entries(replacements))if(typeof w[name]==='function')w[name]=fn;
    if(typeof w.readFINOAdminImage==='function')w.readFINOAdminImage=replacements.readFINOPortalAdminImage;
    // Existing owner AI image attachments must not reach the old single-value action path.
    // Ordinary client chat and non-image messages retain the original function verbatim.
    if(typeof w.sendFINOBotMessage==='function' && io.ownerActive && io.getPendingImage){const original=w.sendFINOBotMessage;w.sendFINOBotMessage=function(...args){const file=io.getPendingImage();return io.ownerActive()&&file?open(file):original.apply(this,args);};}
    w.F99RateImport14Open=open;return {open,get service(){return ui?.service;}};
  }
  return {LIMITS,FIELDS,digits,number,date,validateMatrix,flatten,normalized,exact,sourceMetadata,create,sha256,cropBounds,imageDimensions,prepareImage,extract,manualTSV,mount,install};
});
