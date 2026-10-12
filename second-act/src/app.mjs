const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = v => Math.round(Number(v) * 10) / 10;
const money = v => '$' + Number(v).toLocaleString('en-US');
let state, initialState, current, currentTab = 'desk', config = {}, toastTimer, revision = 0, requestSerial = 0;

function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3500); }
function error(message) { $('error').textContent = message; $('error').hidden = !message; }
function setTab(tab) {
  currentTab = tab;
  for (const name of ['desk','inventory','audience','evidence']) $('panel-' + name).hidden = name !== tab;
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  $('breadcrumb').textContent = 'Workspace / ' + ({desk:'Recovery desk',inventory:'Rights ledger',audience:'Audience signals',evidence:'Evidence log'}[tab]);
}
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function download(filename, contents, type='application/json') {
  const url = URL.createObjectURL(new Blob([contents], {type}));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function brief() {
  return {mode:$('mode').value, inventory:state.inventory,cohorts:state.cohorts,constraints:{budget:Number($('budget').value),maxRuntime:Number($('runtime').value),eventDate:$('event-date').value,territory:$('territory').value},fairness:Number($('fairness').value)/100,excludedIds:state.excludedIds || []};
}
function invalidate() { revision++; current=null; $('export-evidence').disabled=true; $('alternatives').hidden=true; $('evidence-panel').className='card evidence-empty'; $('evidence-panel').textContent='Inputs changed. Run a recovery to create a new evidence trail.'; $('result').innerHTML='<div class="empty-state"><span class="empty-glyph" aria-hidden="true">II</span><p class="eyebrow">THE BRIEF HAS CHANGED</p><h2>A new decision deserves new evidence.</h2><p>Run the recovery again to evaluate your updated catalog, audience or constraints.</p></div>'; }
function modeBanner() {
  const live = $('mode').value === 'live';
  $('mode-title').textContent = live ? 'Live Qloo mode' : 'Sample mode';
  $('mode-description').textContent = live ? ' · Your catalog records remain organizer-reported. Live taste evidence is fetched on recovery.' : ' · Fictional audience, contract records and taste scores. No live API calls.';
  if(live && !config.qlooConfigured) error('Live Qloo needs a server-side QLOO_API_KEY. The sample demo works now; live mode never substitutes sample evidence.');
  else error('');
}
function renderInputs() {
  $('incident-details').textContent=$('event-date').value+' · 7:30 pm · '+state.cohorts.reduce((s,c)=>s+c.size,0)+' expected guests / Distributor availability withdrawn';
  $('cohort-summary').innerHTML=state.cohorts.map((c,i)=>`<div class="cohort-mini"><span class="avatar ${['','orange','green'][i]}">${['R','N','F'][i]}</span><div><b>${esc(c.name)}</b><small>${esc(c.anchors.map(a=>a.name).join(' · '))}</small></div><span>${c.size} guests</span></div>`).join('');
  $('ledger').innerHTML=state.inventory.map(f=>`<tr><td><b>${esc(f.title)}</b><small>${esc(f.contractRef || f.id)} · organizer-reported</small></td><td>${f.runtime} min</td><td>${money(f.cost)}</td><td>${esc(f.rightsStart)}<small>to ${esc(f.rightsEnd)}</small></td><td>${esc(f.territory)} / ${f.screeningsRemaining}</td><td><button class="text-button" data-toggle-film="${esc(f.id)}">${f.available ? 'Available · withdraw ' : 'Withdrawn · restore '}</button></td></tr>`).join('');
  $('cohort-edit').innerHTML=state.cohorts.map((c,i)=>`<section class="card cohort-editor" data-cohort="${esc(c.id)}"><span class="avatar ${['','orange','green'][i]}">${['R','N','F'][i]}</span><h3 style="margin-top:15px">${esc(c.name)}</h3><label>Group name<input class="cohort-name" maxlength="80" value="${esc(c.name)}"></label><label>Group size<input class="cohort-size" type="number" min="1" max="10000" value="${c.size}"></label><div class="small-caps muted" style="margin:22px 0 12px">CULTURAL ANCHORS</div>${c.anchors.map(a=>`<div class="anchor-group"><div class="anchor-row"><select class="anchor-kind" aria-label="Anchor kind">${['movie','artist','book'].map(k=>`<option ${a.kind===k?'selected':''} value="${k}">${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select><input class="anchor-name" aria-label="Anchor name" maxlength="200" value="${esc(a.name)}"></div><label class="anchor-uuid">Optional Qloo entity UUID<input class="anchor-id" aria-label="Qloo entity UUID" placeholder="For ambiguous exact matches" value="${esc(a.qlooEntityId || '')}"></label></div>`).join('')}</section>`).join('');
}
function draftFor(film) {
  return `An update for our ${current.constraints.eventDate} film night: Moonrise Kingdom is no longer available. Our proposed replacement is ${film.title} (${film.runtime} minutes), with the same 7:30 pm start at The Lantern Cinema. We’re reviewing the distributor’s screening permission before confirming the change. We’ll share a confirmed update once that review is complete.`;
}
function renderResult() {
  $('incident-details').textContent=current.constraints.eventDate+' · 7:30 pm · '+current.incident.audience+' expected guests / Distributor availability withdrawn';
  $('export-evidence').disabled=false;
  if(current.infeasible) {
    $('result').innerHTML=`<section class="card infeasible"><p class="small-caps">NO SAFE CATALOG MATCH</p><h2>The brief needs your decision.</h2><p>No title has complete taste evidence and passes every recorded catalog rule. No rights gate has been overridden.</p>${current.relaxations.slice(0,3).map(r=>`<div class="relax-row"><div><b>${esc(r.film.title)}</b><br>Would need ${money(r.requiredBudget)} budget and ${r.requiredRuntime} minutes.</div><button class="button" data-relax="${esc(r.film.id)}">Apply these limits </button></div>`).join('')}<button class="text-button" style="margin-top:20px" data-tab="evidence">Inspect all blockers </button></section>`;
    $('alternatives').hidden=true; renderEvidence(); return;
  }
  const choice=current.chosen, f=choice.film, gain=current.metrics.minimumGain;
  $('result').innerHTML=`<section class="card result-card"><div class="result-top"><p class="eyebrow">PROPOSED SECOND ACT</p><span class="pill green">${current.mode==='sample'?'Sample':'Live Qloo'} evidence</span></div><div class="choice"><div class="poster" style="background:${/^#[0-9a-f]{6}$/i.test(f.color)?f.color:'#416c59'}"><span>SECOND ACT / CATALOG STUDY</span><div class="poster-title">${esc(f.title)}</div><small>${esc(f.year || 'REPLACEMENT')} · ORIGINAL COVER STUDY</small></div><div class="choice-info"><p class="small-caps">A NEW CHAPTER FOR THIS EVENING</p><h2>${esc(f.title)}</h2><p class="movie-meta">${esc(f.director || 'Imported catalog')} ${f.year?'· '+esc(f.year):''}</p><div class="movie-tags"><span>${esc(f.genre || 'Catalog title')}</span><span>Fits recorded limits</span></div><div class="film-detail"><div><span>SCREENING COST</span><b>${money(f.cost)}</b></div><div><span>RUNTIME</span><b>${f.runtime} <small>min</small></b></div></div></div></div><div class="fairness-story"><div class="fairness-head"><h3>Leave fewer guests behind.</h3><span class="gain">${gain>=0?'+':''}${n(gain)} weakest-cohort points</span></div>${current.cohorts.map((c,i)=>`<div class="score-row"><span>${esc(c.name)}</span><div class="score-track"><div class="score-fill" style="width:${choice.scores[c.id]}%;background:${['#8480bf','#c79767','#6f9a81'][i]}"></div></div><b>${n(choice.scores[c.id])}</b></div>`).join('')}<p class="rank-caption">${current.mode==='sample'?'Authored sample indices':'Relative Qloo rank indices'} · not enjoyment probabilities. Compared with ${esc(current.baseline.film.title)}, the best population-weighted mean within the same eligible catalog. This heuristic uses ${Math.round(current.fairness*100)}% weakest-cohort fit.</p></div><div class="decision-foot"><p>Catalog gates passed. Distributor permission still needs your review.</p><button class="button warm" id="simulate">Simulate another withdrawal </button></div></section><section class="card draft-card"><div class="section-top"><h3>A careful audience update</h3><span class="small-caps muted">DRAFT ONLY</span></div><textarea id="notice" aria-label="Audience notice draft">${esc(draftFor(f))}</textarea><p class="draft-label" id="notice-label">Template draft · Review the rights and wording before use. Nothing is sent.</p><div class="draft-actions"><button class="button" id="copy-notice">Copy draft</button><button class="button" id="model-notice" ${config.nebiusConfigured?'':'disabled'} title="Requires server-side Nebius key and an available NVIDIA Nemotron model">Draft with Nemotron ✳</button><button class="text-button" data-tab="evidence">View evidence </button></div></section>`;
  $('alternatives').hidden=false;
  $('alternatives').innerHTML=`<div class="alternative-top"><h2>Other eligible second acts</h2><p>${current.ranked.length} eligible / ${current.blocked.length} excluded</p></div><div class="alternate-grid">${current.ranked.slice(1,4).map(r=>`<button class="alternate" data-inspect="${esc(r.film.id)}" style="--poster:${/^#[0-9a-f]{6}$/i.test(r.film.color)?r.film.color:'#657761'}"><h3>${esc(r.film.title)}</h3><p>${r.film.runtime} minutes · ${money(r.film.cost)} · ${esc(r.film.genre || 'Imported title')}</p><div class="alternate-bottom"><span>Weakest cohort ${n(r.minimum)}</span><span>Inspect </span></div></button>`).join('')}</div><div class="blocked-summary">${current.blocked.length} titles excluded by catalog rules, missing evidence or organizer withdrawal. <button class="text-button" data-tab="evidence">See why </button></div>`;
  renderEvidence();
}
function renderEvidence() {
  $('evidence-panel').className='card';
  $('evidence-panel').innerHTML=`<div class="trace-head"><p class="small-caps muted">${esc(current.provider.toUpperCase())} / ${esc(current.createdAt)}</p><h3 style="margin-top:10px">A decision you can follow.</h3><p>${esc(current.methodology)} The inventory is organizer-reported; this app does not clear screening rights.</p></div>${current.trace.map((step,i)=>`<div class="trace-row"><span class="trace-number">${String(i+1).padStart(2,'0')}</span><div><b>${esc(step.tool)}</b><p>${esc(step.detail)}</p></div><span>${esc(step.status)}</span></div>`).join('')}<div class="trace-head"><h3>Excluded titles</h3></div>${current.blocked.map(b=>`<div class="block-item"><b>${esc(b.film.title)}</b><p>${esc(b.reasons.join(' '))}</p></div>`).join('')}`;
}
async function run() {
  if(!$('brief').reportValidity()) return;
  const requestRevision=revision, serial=++requestSerial;
  error(''); $('run').disabled=true; $('run').innerHTML='<span class="busy-dots">Reading the brief…</span>'; $('result').innerHTML='<div class="pending-result"><div><span class="busy-dots">◈</span><br>Collecting evidence and checking the catalog.<br>No rights or budget limits are silently changed.</div></div>'; $('alternatives').hidden=true;
  try { const result=await api('/api/recover',brief()); if(revision!==requestRevision || requestSerial!==serial)return; current=result; renderResult(); }
  catch(e) { if(revision===requestRevision && requestSerial===serial){invalidate(); error(e.message);} }
  finally { if(requestSerial===serial){$('run').disabled=false; $('run').innerHTML='<span>Find a second act</span><span aria-hidden="true"></span>'; } }
}
function parseCSV(text) {
  if(text.length>60000) throw new Error('Keep the CSV under 60 KB and at most 20 titles.');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell!=='')throw new Error('Unexpected quote in CSV.');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('A CSV quote was not closed.');row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  const keys=(rows.shift() || []).map(v=>v.trim().replace(/^\uFEFF/,''));
  const required=['id','title','runtime','cost','available','rightsConfirmed','rightsStart','rightsEnd','territory','screeningsRemaining'];
  if(required.some(k=>!keys.includes(k))||new Set(keys).size!==keys.length)throw new Error('The CSV must have every required ledger column, with no duplicate headers. Export the example as a template.');
  if(rows.length<1||rows.length>20)throw new Error('Import between 1 and 20 titles.');
  const seen=new Set();
  return rows.map(values=>{if(values.length!==keys.length)throw new Error('Each CSV row must match the header column count.');const r=Object.fromEntries(keys.map((k,i)=>[k,values[i].trim()]));if(!r.id||seen.has(r.id)||['__proto__','constructor','prototype'].includes(r.id))throw new Error('Each film needs a unique safe ID.');seen.add(r.id);for(const k of ['runtime','cost','screeningsRemaining']){if(r[k]==='')throw new Error('Missing numeric catalog field: '+k);r[k]=Number(r[k]);if(!Number.isFinite(r[k])||r[k]<0)throw new Error('Invalid catalog field: '+k);}if(r.runtime<=0||!Number.isInteger(r.screeningsRemaining))throw new Error('Runtime must be positive; remaining screenings must be an integer.');for(const k of ['available','rightsConfirmed']){if(!['true','false'].includes(r[k].toLowerCase()))throw new Error(k+' must be true or false.');r[k]=r[k].toLowerCase()==='true';}for(const k of ['rightsStart','rightsEnd'])if(!/^\d{4}-\d{2}-\d{2}$/.test(r[k]))throw new Error('Rights windows need YYYY-MM-DD dates.');if(!r.title||!r.territory)throw new Error('Missing title or territory.');if(!r.qlooEntityId)delete r.qlooEntityId;return r;});
}
document.addEventListener('click',async event=>{
  const tab=event.target.closest('[data-tab]'); if(tab){setTab(tab.dataset.tab);return;}
  const toggle=event.target.closest('[data-toggle-film]');if(toggle){const f=state.inventory.find(f=>f.id===toggle.dataset.toggleFilm);f.available=!f.available;invalidate();renderInputs();return;}
  const relax=event.target.closest('[data-relax]');if(relax){const r=current.relaxations.find(r=>r.film.id===relax.dataset.relax);$('budget').value=r.requiredBudget;$('runtime').value=r.requiredRuntime;await run();toast('Your chosen budget and runtime limits were applied.');return;}
  const inspect=event.target.closest('[data-inspect]');if(inspect){const r=current.ranked.find(r=>r.film.id===inspect.dataset.inspect);toast(r.film.title+': weakest cohort '+n(r.minimum)+', group mean '+n(r.mean)+', blended index '+n(r.utility)+'.');return;}
  if(event.target.closest('#simulate')){state.excludedIds=[...new Set([...(state.excludedIds || []),current.chosen.film.id])];await run();toast('Withdrawal simulated. Every recorded gate was rechecked.');}
  if(event.target.closest('#copy-notice')){try{await navigator.clipboard.writeText($('notice').value);toast('Draft copied. Review it before sending.');}catch{toast('Select the draft text and copy it manually.');}}
  if(event.target.closest('#model-notice')){const button=$('model-notice'),decision=current;button.disabled=true;try{const data=await api('/api/notice',{film:current.chosen.film,incident:{...state.incident,eventDate:$('event-date').value},evidence:{provider:current.provider,minimum:current.chosen.minimum,mean:current.chosen.mean,cohortNames:state.cohorts.map(c=>c.name)}});if(current!==decision)return;$('notice').value=data.notice;$('notice-label').textContent=data.disclosure+' Model: '+data.model+'. Nothing is sent.';current.trace.push(...data.trace);current.noticeDraft={notice:data.notice,provider:data.provider,model:data.model};renderEvidence();}catch(e){if(current===decision)error(e.message);}finally{if(button.isConnected)button.disabled=false;}}
});
$('brief').addEventListener('submit',e=>{e.preventDefault();run();});
for(const id of ['budget','runtime','event-date','territory'])$(id).addEventListener('change',invalidate);
$('fairness').addEventListener('input',()=>{$('fairness-value').textContent=$('fairness').value+'%';});
$('fairness').addEventListener('change',invalidate);
$('mode').addEventListener('change',()=>{invalidate();modeBanner();});
$('export-evidence').addEventListener('click',()=>current&&download('second-act-recovery-pack.json',JSON.stringify(current,null,2)));
$('export-catalog').addEventListener('click',()=>{const keys=['id','title','runtime','cost','available','rightsConfirmed','rightsStart','rightsEnd','territory','screeningsRemaining','qlooEntityId'];const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';download('second-act-catalog.csv',[keys.join(','),...state.inventory.map(f=>keys.map(k=>quote(f[k])).join(','))].join('\n'),'text/csv');});
$('import-catalog').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{state.inventory=parseCSV(await file.text());state.excludedIds=[];invalidate();renderInputs();error('');toast('Catalog imported. Run recovery to validate all rows.');}catch(e){error(e.message);}finally{$('import-catalog').value='';}});
$('save-cohorts').addEventListener('click',()=>{try{const updated=Array.from(document.querySelectorAll('.cohort-editor')).map((el,i)=>{const c={...state.cohorts[i],name:el.querySelector('.cohort-name').value.trim(),size:Number(el.querySelector('.cohort-size').value)};if(!c.name||!Number.isInteger(c.size)||c.size<1||c.size>10000)throw new Error('Each group needs a name and a size from 1 to 10,000.');c.anchors=Array.from(el.querySelectorAll('.anchor-group')).map(row=>{const name=row.querySelector('.anchor-name').value.trim();if(!name)throw new Error('Every cultural anchor needs a name.');const a={name,kind:row.querySelector('.anchor-kind').value};const id=row.querySelector('.anchor-id').value.trim();if(id)a.qlooEntityId=id;return a;});return c;});state.cohorts=updated;invalidate();renderInputs();setTab('desk');toast('Audience saved. Changed anchors need live evidence.');}catch(e){error(e.message);}});
$('reset').addEventListener('click',async()=>{state=structuredClone(initialState);state.excludedIds=[];$('budget').value=state.constraints.budget;$('runtime').value=state.constraints.maxRuntime;$('event-date').value=state.constraints.eventDate;$('territory').value=state.constraints.territory;$('fairness').value=70;$('fairness-value').textContent='70%';$('mode').value='sample';invalidate();renderInputs();modeBanner();setTab('desk');toast('Fictional example restored.');});
try{[state,config]=await Promise.all([api('/api/scenario'),api('/api/status')]);initialState=structuredClone(state);state.excludedIds=[];renderInputs();$('model-notice')?.setAttribute('disabled','');}catch(e){error('Could not load the workspace: '+e.message);$('run').disabled=true;}

if(typeof document.modelContext?.registerTool==='function') {
  const lifecycle=new AbortController();
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try {
    Promise.resolve(document.modelContext.registerTool({
      name:'prepare_cinema_recovery',
      description:'Run the current cinema recovery brief, gather sample or live Qloo evidence, validate catalog rules and show a replacement proposal. Does not book or send.',
      inputSchema:{type:'object',properties:{mode:{enum:['sample','live']}},required:['mode'],additionalProperties:false},
      async execute(input) {
        if(!input||!['sample','live'].includes(input.mode)||Object.keys(input).some(k=>k!=='mode'))throw new Error('Provide only mode: sample or live.');
        if($('run').disabled)throw new Error('A recovery is already in progress.');
        $('mode').value=input.mode;invalidate();modeBanner();setTab('desk');await run();
        if(!current)throw new Error($('error').textContent || 'The recovery brief changed before completion.');
        return {provider:current.provider,chosen:current.chosen?.film.title || null,blocked:current.blocked.map(x=>({title:x.film.title,reasons:x.reasons})),infeasible:current.infeasible};
      }
    },{signal:lifecycle.signal})).catch(()=>{});
  }catch{}
}
