export const entryPlan=Object.freeze({version:'structure-regime-atr-v8',maxBaseDistanceAtr:.5,stopBufferAtr:.15,minRiskRatio:.003,maxRiskRatio:.03,maxSpreadRatio:.001,maxSpreadToRisk:.1,maxReferenceDrift:.003});
export function marketContext(bars){
 if(!Array.isArray(bars)||bars.length<25||bars.some(b=>!['high','low','close'].every(k=>Number.isFinite(b[k])))||bars.some(b=>b.high<b.low||b.close<=0))return {available:false};
 const closes=bars.map(b=>b.close),ema=n=>{const a=[closes[0]],k=2/(n+1);for(const v of closes.slice(1))a.push(k*v+(1-k)*a.at(-1));return a;},fast=ema(9),slow=ema(21),slope=slow.at(-1)-slow.at(-5);
 const trs=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));
 const atr=trs.slice(-14).reduce((a,b)=>a+b,0)/14;
 return {available:atr>0,atr,return30m:closes.at(-1)/closes.at(-3)-1,direction:fast.at(-1)>slow.at(-1)&&slope>0?1:fast.at(-1)<slow.at(-1)&&slope<0?-1:0};
}
export function assessEntry(signal,bid,ask,benchmark,benchmarkSymbol){
 const direction=signal.side==='LONG'?1:-1,entry=direction===1?ask:bid,bars=signal.candles,context=marketContext(bars);
 const baselineRisk=direction*(entry-signal.stop),quoteValid=Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>=bid&&Number.isFinite(entry);
 const baseline=quoteValid&&(ask-bid)/bid<=entryPlan.maxSpreadRatio&&Math.abs(entry-signal.entry)/signal.entry<=entryPlan.maxReferenceDrift&&baselineRisk/entry>=entryPlan.minRiskRatio&&baselineRisk/entry<=entryPlan.maxRiskRatio;
 if(!context.available||!benchmark?.available||!quoteValid)return {pass:false,reason:!quoteValid?'invalid_quote':'missing_context',baseline,A:false,B:false,C:false,entry,originalStop:signal.stop};
 const base=bars.slice(-22,-2),level=direction===1?Math.max(...base.map(b=>b.high)):Math.min(...base.map(b=>b.low)),distance=direction*(entry-level)/context.atr;
 const A=baseline&&distance>=0&&distance<=entryPlan.maxBaseDistanceAtr;
 const relative=direction*(context.return30m-benchmark.return30m),regime=benchmark.direction!==-direction&&(signal.symbol===benchmarkSymbol||relative>=0),B=A&&regime;
 const retest=bars.at(-1),stop=direction===1?Math.min(signal.stop,retest.low-entryPlan.stopBufferAtr*context.atr):Math.max(signal.stop,retest.high+entryPlan.stopBufferAtr*context.atr),risk=direction*(entry-stop),spreadToRisk=(ask-bid)/risk;
 const C=B&&risk/entry>=entryPlan.minRiskRatio&&risk/entry<=entryPlan.maxRiskRatio&&Number.isFinite(spreadToRisk)&&spreadToRisk<=entryPlan.maxSpreadToRisk;
 return {pass:C,reason:!baseline?'baseline_quote_or_risk':!A?'extended_from_base':!B?'market_or_relative_strength':!C?'atr_stop_or_cost':'accepted',baseline,A,B,C,entry,originalStop:signal.stop,stop,target:entry+direction*2*risk,baseLevel:level,baseDistanceAtr:distance,atr14:context.atr,relativeReturn30m:relative,benchmark,spreadToRisk,riskRatio:risk/entry,version:entryPlan.version};
}
