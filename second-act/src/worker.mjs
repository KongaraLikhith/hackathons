import page from './page.html';
import app from './app.mjs?raw';
import style from './style.css';
import sourceZip from '../work/source-base64.txt';
import guide from '../README.md';
import submission from '../docs/SUBMISSION.md';
import readiness from '../docs/READINESS.md';
import { recover, createNotice, scenario } from './service.mjs';
import { recoveryTool } from './tool-contract.mjs';

const limits = new Map();
const security = {'x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"};
const response = (body,type,status=200,headers={}) => new Response(body,{status,headers:{...security,'content-type':type,...headers}});
const json = (data,status=200) => response(JSON.stringify(data),'application/json; charset=utf-8',status,{'cache-control':'no-store'});
const safeHTML = s => s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function rateLimit(request,env,kind) {
  // A conservative per-isolate guard, not a global billing limit. Provider free
  // credit budgets must also be configured before enabling live calls.
  if(env.LIVE_CALLS_ENABLED !== 'true') { const e = new Error('Live calls are disabled. Configure free provider credits and LIVE_CALLS_ENABLED=true on the server before enabling them.');e.status=503;throw e; }
  const identity = request.headers.get('oai-authenticated-user-id') || request.headers.get('cf-connecting-ip') || 'anonymous';
  const hour=Math.floor(Date.now()/3600000),key=hour+':'+kind+':'+identity,globalKey=hour+':'+kind+':total';
  if(limits.size>100) for(const k of limits.keys()) if(!k.startsWith(hour+':'))limits.delete(k);
  const maximum=kind==='recovery'?3:5,globalMaximum=kind==='recovery'?6:10;
  if((limits.get(key)||0)>=maximum || (limits.get(globalKey)||0)>=globalMaximum){const e=new Error('The free-demo live call allowance for this hour has been reached. Use sample mode or wait for the next hour.');e.status=429;throw e;}
  limits.set(key,(limits.get(key)||0)+1);limits.set(globalKey,(limits.get(globalKey)||0)+1);
}
async function readBody(request) {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin){const e=new Error('Cross-origin write requests are not accepted.');e.status=403;throw e;}
  if(!request.headers.get('content-type')?.startsWith('application/json')){const e=new Error('Use application/json for API requests.');e.status=415;throw e;}
  if(Number(request.headers.get('content-length'))>65536){const e=new Error('The request must be under 64 KB.');e.status=413;throw e;}
  const reader=request.body?.getReader();
  if(!reader){const e=new Error('A JSON request body is required.');e.status=400;throw e;}
  const chunks=[];let size=0;
  for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();const e=new Error('The request must be under 64 KB.');e.status=413;throw e;}chunks.push(value);}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(buffer));}catch{const e=new Error('Request body is not valid JSON.');e.status=400;throw e;}
}
export default {
  async fetch(request,env={}) {
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='GET') {
      if(path==='/')return response(page,'text/html; charset=utf-8');
      if(path==='/app.js')return response(app,'application/javascript; charset=utf-8');
      if(path==='/style.css')return response(style,'text/css; charset=utf-8');
      if(path==='/favicon.ico')return new Response(null,{status:204});
      if(path==='/api/scenario')return json(scenario);
      if(path==='/api/status')return json({qlooConfigured:!!env.QLOO_API_KEY&&env.LIVE_CALLS_ENABLED==='true',nebiusConfigured:!!env.NEBIUS_API_KEY&&!!env.NEBIUS_MODEL&&env.LIVE_CALLS_ENABLED==='true',liveCallsEnabled:env.LIVE_CALLS_ENABLED==='true',sampleIsSynthetic:true});
      if(path==='/guide')return response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Second Act — Project guide</title><style>body{font:15px/1.7 system-ui;margin:40px auto;max-width:850px;padding:0 24px;background:#f4f1eb;color:#242c38}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}a{color:#65775b}</style><a href="/">← Back to Second Act</a><pre>'+safeHTML(guide+'\n\n'+readiness+'\n\n'+submission)+'</pre></html>','text/html; charset=utf-8');
      if(path==='/download/source.zip')return response(Uint8Array.from(atob(sourceZip.trim()),c=>c.charCodeAt(0)),'application/zip',200,{'content-disposition':'attachment; filename="second-act-source.zip"'});
      if(path==='/agent-tools.json')return json(recoveryTool);
      return response('Not found','text/plain',404);
    }
    if(request.method==='POST' && (path==='/api/recover'||path==='/api/notice')) {
      try {
        const body=await readBody(request);
        if(path==='/api/recover'){if(body?.mode==='live')rateLimit(request,env,'recovery');return json(await recover(body,env));}
        rateLimit(request,env,'notice');return json(await createNotice(body,env));
      } catch(e) {
        const status=Number.isInteger(e.status)&&e.status>=400&&e.status<600?e.status:500;
        const identity = status===422 && ['ENTITY_AMBIGUOUS','ENTITY_NOT_FOUND'].includes(e.code)
          ? {resolutions:e.resolutions||[],resolvedEntities:e.resolvedEntities||[]} : {};
        return json({error:status===500?'The recovery could not be completed. Check the catalog and retry.':e.message,code:e.code||'REQUEST_FAILED',trace:e.trace||[],...identity},status);
      }
    }
    return response('Method not allowed','text/plain',405,{'allow':'GET, POST'});
  }
};
