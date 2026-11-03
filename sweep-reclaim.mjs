export const sweepRules=Object.freeze({version:'sweep-reclaim-v9',watchMs:14400000,reclaimMs:900000,freshMs:90000,gapMs:900000,bufferAtr:.15});
export function sweepConfirmation(seed,bars,now=Date.now()){
 const start=Date.parse(seed.seededAt),dir=seed.side==='LONG'?1:seed.side==='SHORT'?-1:0,deadline=start+sweepRules.watchMs;
 if(!Number.isFinite(start)||!dir||!(seed.level>0&&seed.atr14>0)||!Array.isArray(bars))return {status:'invalid_seed'};
 const closed=bars.filter(b=>b.time>=Math.ceil(start/60000)*60000&&b.end<now&&b.end<=deadline&&['time','end','high','low','close'].every(k=>Number.isFinite(b[k]))).sort((a,b)=>a.time-b.time);
 const at=closed.findIndex(b=>dir===1?b.low<seed.level:b.high>seed.level);if(at<0)return {status:now>=deadline?'expired_watch':'waiting_sweep'};
 const first=closed[at],until=Math.min(deadline,first.time+sweepRules.reclaimMs);let streak=0,last=null,extreme=dir===1?first.low:first.high;
 for(const b of closed.slice(at)){if(b.end>until)break;if(last!==null&&b.time-last!==60000)streak=0;last=b.time;extreme=dir===1?Math.min(extreme,b.low):Math.max(extreme,b.high);streak=dir*(b.close-seed.level)>0?streak+1:0;
  if(streak>=2){const stop=extreme-dir*sweepRules.bufferAtr*seed.atr14;const invalidated=bars.some(n=>n.time>b.end&&n.time<=now&&(dir===1?n.low<=stop:n.high>=stop))||bars.some(n=>n.time>b.end&&n.end<now&&dir*(n.close-seed.level)<=0);if(invalidated)return {status:'expired_invalidated',confirmedAt:b.end};return {status:now-b.end>sweepRules.freshMs?'expired_confirmation':'confirmed',confirmedAt:b.end,sweepTime:first.time,extreme,stop,reference:b.close};}
 }
 return {status:now>=until?'expired_reclaim':'waiting_reclaim',sweepTime:first.time};
}
export function sweepEntry(seed,confirmation,bid,ask,context,benchmark,now=Date.now()){
 if(confirmation.status!=='confirmed'||now-confirmation.confirmedAt<0||now-confirmation.confirmedAt>sweepRules.freshMs)return {pass:false,reason:'stale_confirmation'};
 if(!context?.available||!benchmark?.available)return {pass:false,reason:'missing_current_context'};
 const dir=seed.side==='LONG'?1:-1,entry=dir===1?ask:bid,risk=dir*(entry-confirmation.stop),spread=ask-bid;
 if(![bid,ask].every(Number.isFinite)||!(bid>0&&ask>=bid&&risk>0)||risk/entry<.003||risk/entry>.03||spread/bid>.001||spread/risk>.1)return {pass:false,reason:'quote_stop_or_cost'};
 if(!(dir*(entry-seed.level)>0)||Math.abs(entry-confirmation.reference)/confirmation.reference>.003||Math.abs(entry-confirmation.reference)/risk>.2)return {pass:false,reason:'reclaim_lost_or_chase'};
 const relative=dir*(context.return30m-benchmark.return30m);if(benchmark.direction===-dir||(!seed.isBenchmark&&relative<0))return {pass:false,reason:'current_market_or_relative_strength'};
 return {pass:true,entry,stop:confirmation.stop,target:entry+dir*2*risk,risk,entryAssessment:{version:sweepRules.version,atr14:context.atr,baseDistanceAtr:Math.abs(entry-seed.level)/context.atr,relativeReturn30m:relative,spreadToRisk:spread/risk,riskRatio:risk/entry,seedAtr:seed.atr14}};
}
