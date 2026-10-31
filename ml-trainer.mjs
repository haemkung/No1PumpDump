import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {featureVector,fit,evaluate} from './ml-model.mjs';
import {evaluateMaturedSignal} from './ml-outcomes.mjs';
const dir=new URL('./.ml/',import.meta.url);await mkdir(dir,{recursive:true});
async function read(name,fallback){try{return JSON.parse(await readFile(new URL(name,dir),'utf8'));}catch{return fallback;}}
async function save(name,data){const url=new URL(name,dir),tmp=new URL(name+'.tmp',dir);await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,url);}
async function json(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Remote service HTTP '+r.status);
  const data=await r.json();if(Number(r.headers.get('x-mbx-used-weight-1m'))>=1700)await new Promise(resolve=>setTimeout(resolve,61000-Date.now()%60000));return data;
}
try{
  const records=await read('records.json',{}),seed=await read('seed.json',{results:[]});
  for(const r of seed.results){if(!records[r.id])records[r.id]={...r,provider:'binance-futures',status:'sent'};}
  const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  if(!token||!chat)throw Error('Missing local credentials');
  const root='https://api.telegram.org/bot'+token;
  const c=await json(root+'/getChat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat})});
  if(c.result?.pinned_message?.document?.file_name!=='no1-monitor-state.json')throw Error('Missing private state');
  const f=await json(root+'/getFile?file_id='+encodeURIComponent(c.result.pinned_message.document.file_id));
  const state=await json('https://api.telegram.org/file/bot'+token+'/'+f.result.file_path);
  for(const r of Object.values(state.journal||{}))if(r.provider==='binance-futures'&&r.status==='sent'&&r.sentAt)records[r.id]={...records[r.id],...r};
  let failed=0;
  for(const r of Object.values(records)){
    if(r.label||Date.now()<Date.parse(r.sentAt)+4*3600000||!featureVector(r))continue;
    try{
      const old=r.event4h;
      if(old?.kind==='TP'||old?.kind==='SL')r.label={kind:old.kind,time:old.time,target:old.kind==='TP'?1:0};
      else if(old?.kind==='none'&&r.fullyObserved4h)r.label={kind:'no_touch_4h',time:Date.parse(r.sentAt)+4*3600000,target:0};
      else r.label=await evaluateMaturedSignal(r,json);
    }catch{failed++;}
  }
  await save('records.json',records);
  const samples=Object.values(records).filter(r=>r.label&&Date.now()>=Date.parse(r.sentAt)+4*3600000).sort((a,b)=>Date.parse(a.sentAt)-Date.parse(b.sentAt)).map(r=>({id:r.id,time:r.sentAt,x:featureVector(r),y:r.label.target,ml:r.mlExperimental})).filter(s=>s.x);
  const fingerprint=createHash('sha256').update(JSON.stringify(samples.map(s=>[s.id,s.x,s.y]))).digest('hex');
  const previous=await read('model.json',null);
  if(previous?.fingerprint===fingerprint){await save('runtime.json',{checkedAt:new Date().toISOString(),status:'unchanged',matured:samples.length,mode:'shadow',failed});console.log(JSON.stringify({status:'unchanged',matured:samples.length,mode:'shadow',aiCalls:0}));}
  else if(samples.length<20||new Set(samples.map(s=>s.y)).size<2){await save('runtime.json',{checkedAt:new Date().toISOString(),status:'collecting',matured:samples.length,required:20,mode:'shadow',failed});console.log(JSON.stringify({status:'collecting',matured:samples.length,aiCalls:0}));}
  else{
    const split=Math.max(12,Math.floor(samples.length*.75)),training=samples.slice(0,split),test=samples.slice(split),prior=training.reduce((s,r)=>s+r.y,0)/training.length;
    const temporal=evaluate(fit(training),test,prior),model=fit(samples),now=new Date().toISOString();
    const bundle={...model,version:'ml-shadow-'+now,trainedAt:now,trainedThrough:samples.at(-1).time,trainingCount:samples.length,positives:samples.filter(s=>s.y===1).length,fingerprint,mode:'shadow',affectsLiveSelection:false,calibrated:false,target:'TP before SL within four hours; no touch is target=0',retrospectiveTemporalTest:temporal,prospectiveObservations:samples.filter(s=>s.ml?.mode==='shadow'&&Date.parse(s.ml.trainedAt)<Date.parse(s.time)).length};
    await save('model.json',bundle);await save('runtime.json',{checkedAt:now,status:'trained',matured:samples.length,modelVersion:bundle.version,mode:'shadow',failed,retrospectiveTemporalTest:temporal});
    console.log(JSON.stringify({status:'trained',matured:samples.length,mode:'shadow',temporalTest:temporal,aiCalls:0}));
  }
}catch{await save('runtime.json',{checkedAt:new Date().toISOString(),status:'service_unavailable',mode:'shadow'});console.error('ML update deferred; existing model retained. No credentials logged.');process.exitCode=1;}
