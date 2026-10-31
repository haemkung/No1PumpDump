import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {findSignal} from './strategy.mjs';
import {binanceSymbols} from './market-data.mjs';
import {featureVector,fit,evaluate} from './ml-model.mjs';
const dir=new URL('./.ml/',import.meta.url),cache=new URL('history-bars/',dir);await mkdir(cache,{recursive:true});
const now=Date.now(),until=Math.floor(now/900000)*900000-1,from=until-30*86400000+1;
let pauseUntil=0,requests=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url){
  for(let attempt=0;attempt<4;attempt++){
    if(Date.now()<pauseUntil)await sleep(pauseUntil-Date.now());
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});requests++;
    if(response.status===429){pauseUntil=Date.now()+(Number(response.headers.get('retry-after'))||60)*1000;continue;}
    if(response.status===418)throw Error('Exchange access paused');
    if(!response.ok)throw Error('Exchange HTTP '+response.status);
    const rows=await response.json();
    if(Number(response.headers.get('x-mbx-used-weight-1m'))>=1700)pauseUntil=Math.max(pauseUntil,Date.now()+61000-Date.now()%60000);
    return rows;
  }throw Error('Exchange retry exhausted');
}
async function save(name,value){const out=new URL(name,dir),tmp=new URL(name+'.tmp',dir);await writeFile(tmp,JSON.stringify(value));await rename(tmp,out);}
const exchange=await json('https://fapi.binance.com/fapi/v1/exchangeInfo'),symbols=binanceSymbols(exchange),samples=[];
let completed=0,failed=0,totalBars=0,ambiguous=0,patterns=0;
await save('history-runtime.json',{status:'collecting',startedAt:new Date().toISOString(),markets:symbols.length,days:30});
for(let offset=0;offset<symbols.length;offset+=4){
  await Promise.all(symbols.slice(offset,offset+4).map(async symbol=>{
    try{
      const file=new URL(encodeURIComponent(symbol)+'.json',cache);let raw=[];
      try{raw=JSON.parse(await readFile(file,'utf8'));}catch{}
      raw=raw.filter(b=>Number(b[0])>=from&&Number(b[6])<=until);
      let cursor=raw.length?Number(raw.at(-1)[0])+900000:from;
      while(cursor<until){
        const page=await json(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=15m&startTime=${cursor}&endTime=${until}&limit=499`);
        if(!page.length)break;
        raw.push(...page.filter(b=>Number(b[6])<=until));
        const next=Number(page.at(-1)[0])+900000;if(next<=cursor)throw Error('Non-advancing history');cursor=next;
        if(page.length<499)break;
      }
      raw=[...new Map(raw.map(b=>[Number(b[0]),b])).values()].sort((a,b)=>Number(a[0])-Number(b[0]));
      await writeFile(file,JSON.stringify(raw));
      const bars=raw.map(b=>({time:Number(b[0]),end:Number(b[6]),open:Number(b[1]),high:Number(b[2]),low:Number(b[3]),close:Number(b[4]),volume:Number(b[5])}));totalBars+=bars.length;
      for(let i=21;i+16<bars.length;i++){
        const context=bars.slice(i-21,i+1);if(context.some((b,j)=>j&&b.time-context[j-1].time!==900000))continue;
        const s=findSignal(context);if(!s)continue;patterns++;
        const future=bars.slice(i+1,i+17);if(future.some((b,j)=>b.time!==bars[i].time+(j+1)*900000))continue;
        const entry=future[0].open,risk=s.side==='LONG'?entry-s.stop:s.stop-entry;
        if(Math.abs(entry-s.entry)/s.entry>.003||risk/entry<.003||risk/entry>.03)continue;
        const target=s.side==='LONG'?entry+2*risk:entry-2*risk;
        let event='no_touch_4h';
        for(const b of future){
          const sl=s.side==='LONG'?b.low<=s.stop:b.high>=s.stop,tp=s.side==='LONG'?b.high>=target:b.low<=target;
          if(sl&&tp){event='ambiguous';break;}
          if(sl||tp){event=tp?'TP':'SL';break;}
        }
        if(event==='ambiguous'){ambiguous++;continue;}
        const record={id:`history-${symbol}-${s.side}-${s.time}`,symbol,side:s.side,entry,stop:s.stop,features:{volumeRatio:s.volumeRatio,closeStrength:s.closeStrength}};
        const x=featureVector(record);if(x)samples.push({id:record.id,time:future[0].time,labelEnd:future.at(-1).end,x,y:event==='TP'?1:0,event});
      }
      completed++;
    }catch{failed++;}
  }));
  if((offset/4)%10===0||offset+4>=symbols.length){const status={status:'collecting',checkedAt:new Date().toISOString(),completed,failed,markets:symbols.length,totalBars,patterns,labeled:samples.length,ambiguous,requests};await save('history-runtime.json',status);console.log(JSON.stringify(status));}
}
samples.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
if(failed){await save('history-runtime.json',{status:'incomplete',checkedAt:new Date().toISOString(),completed,failed,markets:symbols.length,totalBars,labeled:samples.length});throw Error('Historical update incomplete; previous model retained');}
const trainEnd=until-9*86400000,validationEnd=until-4*86400000,purge=4*3600000;
const train=samples.filter(s=>s.labelEnd<trainEnd),validation=samples.filter(s=>s.time>=trainEnd+purge&&s.labelEnd<validationEnd),test=samples.filter(s=>s.time>=validationEnd+purge);
if(train.length<20||new Set(train.map(s=>s.y)).size<2)throw Error('Insufficient historical labels');
const model=fit(train),prior=train.reduce((a,s)=>a+s.y,0)/train.length;
const version='history-shadow-'+new Date().toISOString();
const report={status:'trained',version,trainedAt:new Date().toISOString(),from:new Date(from).toISOString(),until:new Date(until).toISOString(),days:30,markets:symbols.length,completed,failed,totalBars,patterns,labeled:samples.length,ambiguousExcluded:ambiguous,requests,trainingCount:train.length,validation:evaluate(model,validation,prior),heldOutTest:evaluate(model,test,prior),mode:'shadow',affectsLiveSelection:false,assumptions:['currently active markets only: survivorship bias','next-bar open reference; historical bid/ask and Gemini not available','same-candle TP/SL ambiguity excluded, not counted as a win','no commission, funding or slippage modeled','global chronological split and four-hour purge']};
await save('historical-samples.json',samples);await save('historical-model.json',{...model,...report});await save('history-runtime.json',report);
console.log(JSON.stringify(report));if(failed)process.exitCode=1;
