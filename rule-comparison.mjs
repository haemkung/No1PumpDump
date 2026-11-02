import {readFile,writeFile,rename} from 'node:fs/promises';
import {evaluateMaturedSignal} from './ml-outcomes.mjs';
export function summarizeComparisons(records){
 const groups={};for(const key of ['baseline','A','B','C']){const rows=records.filter(r=>r.assessment[key]),evaluated=rows.map(r=>r.outcomes?.[key]).filter(Boolean),complete=evaluated.filter(o=>Number.isFinite(o.grossR)&&Number.isFinite(o.fundingR)&&Number.isFinite(o.riskRatio)&&o.riskRatio>0);let balance=0,peak=0,maxDrawdown=0;for(const o of [...complete].sort((a,b)=>a.time-b.time)){balance+=o.grossR-o.fundingR-.001/o.riskRatio;peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,peak-balance);}const marketDays=new Set(rows.filter(r=>r.outcomes?.[key]&&Number.isFinite(Date.parse(r.observedAt))).map(r=>new Date(Date.parse(r.observedAt)+25200000).toISOString().slice(0,10))).size;groups[key]={marketDays,minimumReviewCheckpointReached:complete.length>=100&&marketDays>=7,referenceDrawdownRAt10bps:maxDrawdown,observed:rows.length,pending:rows.length-evaluated.length,tp:evaluated.filter(o=>o.kind==='TP').length,sl:evaluated.filter(o=>o.kind==='SL').length,timedOut:evaluated.filter(o=>o.kind==='no_touch_4h').length,priced:complete.length,grossR:complete.reduce((s,o)=>s+o.grossR,0),netCostScenarios:Object.fromEntries([5,10,20].map(bps=>[bps+'bps_roundtrip',complete.reduce((s,o)=>s+o.grossR-o.fundingR-bps/10000/o.riskRatio,0)]))};}return groups;
}
export async function updateRuleComparisons(shared,json,dir=new URL('./.ml/',import.meta.url)){
 const read=async(name,fallback)=>{try{return JSON.parse(await readFile(new URL(name,dir),'utf8'));}catch{return fallback;}},records=await read('challenger-records.json',{});
 const add=r=>{if(r.provider==='binance-futures'&&r.assessment&&r.id&&!records[r.id])records[r.id]=r;};for(const r of Object.values(shared||{}))add(r);
 try{for(const line of (await readFile(new URL('challenger-observations.jsonl',dir),'utf8')).split('\n'))if(line.trim()){try{add(JSON.parse(line));}catch{}}}catch{}
 const cache=new Map();const fetchOnce=async url=>{if(!cache.has(url))cache.set(url,await json(url));return cache.get(url);};let failed=0,processed=0;
 for(const r of Object.values(records).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt))){if(Date.now()<Date.parse(r.observedAt)+14400000)continue;if(processed>=40)break;
  for(const key of ['baseline','A','B','C']){if(!r.assessment[key]||r.outcomes?.[key])continue;processed++;try{
   const start=Date.parse(r.observedAt),until=start+14400000,sign=r.side==='LONG'?1:-1,stop=key==='C'?r.assessment.stop:r.originalStop,risk=sign*(r.entry-stop);if(!(risk>0&&r.entry>0))throw Error('Invalid reference risk');
   const target=r.entry+sign*2*risk,o=await evaluateMaturedSignal({...r,stop,target,sentAt:r.observedAt},fetchOnce);if(!o)continue;
   let grossR=o.kind==='TP'?2:o.kind==='SL'?-1:null,exitTime=o.time;
   if(o.kind==='no_touch_4h'){const raw=await fetchOnce(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(r.symbol)}&interval=1m&startTime=${Math.floor(start/60000)*60000}&endTime=${until}&limit=1000`),last=raw.filter(b=>Number(b[6])<=until).at(-1);if(!last)throw Error('Missing timeout reference');grossR=sign*(Number(last[4])-r.entry)/risk;exitTime=Number(last[6]);}
   const funding=await fetchOnce(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${encodeURIComponent(r.symbol)}&startTime=${start}&endTime=${exitTime}&limit=1000`);if(!Array.isArray(funding)||funding.some(f=>![Number(f.fundingRate),Number(f.markPrice)].every(Number.isFinite)))throw Error('Missing funding data');
   const fundingR=funding.reduce((sum,f)=>sum+sign*Number(f.fundingRate)*Number(f.markPrice)/risk,0);
   r.outcomes??={};r.outcomes[key]={...o,grossR,fundingR,riskRatio:risk/r.entry,timeoutReference:o.kind==='no_touch_4h'?'last fully closed 1m close no later than four-hour horizon':null};
  }catch{failed++;}}
 }
 const report={checkedAt:new Date().toISOString(),version:'structure-regime-atr-v8',mode:'prospective_paper_comparison',promotionAutomatic:false,failed,groups:summarizeComparisons(Object.values(records)),limitations:'All detected candidates before AI approval; this is not the delivered-alert cohort. Reference entry at observed executable-side quote, original/ATR Stop, four-hour horizon; timeout marked at last fully closed 1m close. Gross/funding and assumed total fee+slippage scenarios are reference estimates, not actual fills/account PnL. No automatic claim of improvement or promotion.'};
 for(const [name,value] of [['challenger-records.json',records],['challenger-report.json',report]]){const dest=new URL(name,dir),tmp=new URL(name+'.tmp',dir);await writeFile(tmp,JSON.stringify(value,null,2));await rename(tmp,dest);}return report;
}
