import {qualitySummary} from './fast-quality.mjs';
import {compare,report} from './fast-comparison.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fit} from './ml-model.mjs';
export const names=['logShockVolume','recovery','shockFlow','reversalFlow','isLong'];
export function historicalEvidence(records,side,now){
 const cases=Object.values(records||{}).filter(r=>r.strategyVersion==='fast-reversal-v1'&&r.provider==='binance-futures'&&r.status==='sent'&&r.side===side&&Date.parse(r.sentAt)<now&&vector(r));
 const horizons={};
 for(const minutes of [5,30,240]){
  const eligible=cases.filter(r=>r.outcomes?.[minutes]?.maturedAt<=now&&['directionalClosePct','favorablePct','adversePct'].every(k=>Number.isFinite(r.outcomes[minutes][k])));
  horizons[minutes]={count:eligible.length,positiveClose:eligible.filter(r=>r.outcomes[minutes].directionalClosePct>0).length,nonPositiveClose:eligible.filter(r=>r.outcomes[minutes].directionalClosePct<=0).length};
 }
 const recentCases=cases.sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt)).slice(0,8).map(r=>({id:r.id,symbol:r.symbol,sentAt:r.sentAt,outcomes:Object.fromEntries(Object.entries(r.outcomes||{}).filter(([,o])=>o.maturedAt<=now))})).filter(r=>Object.keys(r.outcomes).length);
 return {mode:'historical_context',calibrated:false,recordedAt:new Date(now).toISOString(),horizons,recentCases,limitation:'Selected sent signals only, not a win probability or a trained model. Include losses as well as gains. A negative five-minute close can precede a positive later close. Do not relax current quote, freshness or structure checks based on a successful anecdote.'};
}
export function vector(r){
 const c=r.sweepConfirmation;
 if(!c||!(c.volumeRatio>0)||!['LONG','SHORT'].includes(r.side))return null;
 const x=[Math.log(c.volumeRatio),c.recovery,c.shockFlow,c.reversalFlow,r.side==='LONG'?1:0];
 return x.every(Number.isFinite)?x:null;
}
// Exclude the partially elapsed delivery minute: its high/low may predate delivery.
export function outcome(r,rows,minutes,now){
 const start=Math.ceil(Date.parse(r.sentAt??r.observedAt)/60000)*60000,end=start+minutes*60000;
 if(!Number.isFinite(start)||now<end||!(r.entry>0))return null;
 const bars=rows.filter(b=>Number(b[0])>=start&&Number(b[0])<end);
 if(bars.length!==minutes||bars.some((b,i)=>Number(b[0])!==start+i*60000||Number(b[6])!==Number(b[0])+59999||![2,3,4].every(j=>Number.isFinite(Number(b[j]))&&Number(b[j])>0)))return null;
 const d=r.side==='LONG'?1:-1,returns=bars.flatMap(b=>[d*(Number(b[2])/r.entry-1)*100,d*(Number(b[3])/r.entry-1)*100]);
 return {windowStart:start,maturedAt:end,directionalClosePct:d*(Number(bars.at(-1)[4])/r.entry-1)*100,favorablePct:Math.max(0,...returns),adversePct:Math.min(0,...returns),partialDeliveryMinuteExcluded:true};
}
const probability=(m,x)=>1/(1+Math.exp(-Math.max(-30,Math.min(30,m.bias+x.reduce((sum,v,i)=>sum+m.weights[i]*(v-m.mean[i])/m.scale[i],0)))));
export function train(records,now,{horizon=5,cohort="sent"}={}){
 const samples=Object.values(records).filter(r=>r.status===cohort&&r.outcomes?.[horizon]?.maturedAt<=now&&Number.isFinite(r.outcomes[horizon].directionalClosePct)&&vector(r)).sort((a,b)=>Date.parse(a.sentAt??a.observedAt)-Date.parse(b.sentAt??b.observedAt));
 if(samples.length<40)return null;
 const split=Math.floor(samples.length*.75),test=samples.slice(split),past=samples.slice(0,split).filter(r=>r.outcomes[horizon].maturedAt<=Date.parse(test[0].sentAt??test[0].observedAt));
 const convert=r=>({x:vector(r),y:Number(r.outcomes[horizon].directionalClosePct>0)}),training=past.map(convert);
 if(training.length<20||new Set(training.map(s=>s.y)).size<2)return null;
 const model=fit(training,names),prior=training.reduce((s,r)=>s+r.y,0)/training.length;
 const brier=test.reduce((s,r)=>s+(probability(model,vector(r))-convert(r).y)**2,0)/test.length;
 const baselineBrier=test.reduce((s,r)=>s+(prior-convert(r).y)**2,0)/test.length;
 return {...fit(samples.map(convert),names),trainedAt:new Date(now).toISOString(),trainingCount:samples.length,mode:'shadow',affectsLiveSelection:false,calibrated:false,cohort,horizonMinutes:horizon,target:`Positive directional close after ${horizon} full minutes following ${cohort==='sent'?'delivery':'candidate observation'}, before fees; not profitability`,temporalTest:{n:test.length,trainingCount:training.length,brier,baselineBrier},trainedThrough:samples.at(-1).sentAt??samples.at(-1).observedAt};
}
export async function update({dir=new URL('./.ml/',import.meta.url),stateUrl=new URL('./.sweep/state.json',import.meta.url),fetchImpl=fetch,now=Date.now()}={}){
 await mkdir(dir,{recursive:true});
 const read=async(name,fallback)=>{try{return JSON.parse(await readFile(new URL(name,dir),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
 const save=async(name,data)=>{const target=new URL(name,dir),tmp=new URL(name+'.tmp',dir);await writeFile(tmp,JSON.stringify(data));await rename(tmp,target);};
 const state=JSON.parse(await readFile(stateUrl,'utf8')),records=await read('fast-records.json',{});
 for(const r of Object.values(state.journal||{}))if(r.strategyVersion==='fast-reversal-v1'&&r.status==='sent'&&r.provider==='binance-futures'&&vector(r))records[r.id]={...records[r.id],...r,outcomes:records[r.id]?.outcomes||{}};
 for(const r of Object.values(records))if(r.outcomes?.[5]&&r.outcomes?.[30])r.learningNote={kind:r.outcomes[5].directionalClosePct<=0&&r.outcomes[30].directionalClosePct>0?'delayed_follow_through':'measured_multi_horizon',note:'Keep five-minute and thirty-minute outcomes separate. Do not label a later rise as immediate follow-through.',basedOnMinutes:[5,30]};
 await save('fast-records.json',records);
 const observed=await read('fast-candidate-records.json',{});
 for(const r of Object.values(state.fastAssessments||{}))if(r.provider==='binance-futures'&&vector(r)&&Number.isFinite(r.entry)&&r.entry>0)observed[r.id]={...observed[r.id],...r,outcomes:observed[r.id]?.outcomes||{}};
 await save('fast-candidate-records.json',observed);
 const previous=await read('fast-runtime.json',{});
 if(now-Date.parse(previous.checkedAt)<300000)return;
 let attempted=0,failed=0;
 const deadline=Date.now()+12000;
 for(const r of [...Object.values(records),...Object.values(observed)].sort((a,b)=>(a.lastEvaluationAttempt||0)-(b.lastEvaluationAttempt||0))){
  const start=Math.ceil(Date.parse(r.sentAt??r.observedAt)/60000)*60000;
  const due=[5,30,240].filter(m=>!r.outcomes[m]&&now>=start+m*60000);
  if(!due.length||attempted>=4||Date.now()>=deadline)continue;
  attempted++;r.lastEvaluationAttempt=now;
  try{
   const response=await fetchImpl(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(r.symbol)}&interval=1m&startTime=${start}&endTime=${start+Math.max(...due)*60000-1}&limit=240`,{signal:AbortSignal.timeout(Math.max(1,Math.min(3000,deadline-Date.now())))});
   if(response.status===429||response.status===418||Number(response.headers.get('x-mbx-used-weight-1m'))>=1750){failed++;break;}
   if(!response.ok)throw Error('Market unavailable');
   const rows=await response.json();
   for(const m of due){const result=outcome(r,rows,m,now);if(result)r.outcomes[m]=result;else failed++;}
  }catch{failed++;}
 }
 await save('fast-records.json',records);
 await save('fast-candidate-records.json',observed);
 const model=train(records,now);if(model)await save('fast-model.json',model);
 for(const horizon of [5,30,240]){const candidateModel=train(observed,now,{horizon,cohort:'observed'});if(candidateModel)await save(`fast-candidate-model-${horizon}m.json`,candidateModel);}
 const comparison=compare(observed,now,await read('fast-policy-comparison.json',{}));
 await save('fast-policy-comparison.json',comparison);
 await writeFile(new URL('fast-policy-report.md',dir),report(comparison));
 await save('fast-quality-forward.json',qualitySummary(observed,now));
 const matured=Object.values(records).filter(r=>r.outcomes[5]).length;
 const runtime={checkedAt:new Date(now).toISOString(),records:Object.keys(records).length,candidateRecords:Object.keys(observed).length,matured,attempted,failed,status:model?'shadow_trained':'collecting',affectsLiveSelection:false};
 await save('fast-runtime.json',runtime);console.log(JSON.stringify(runtime));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)update().catch(()=>{console.error('Fast learning update deferred; existing files retained');process.exitCode=1;});
