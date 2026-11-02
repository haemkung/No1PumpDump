function ema(values,period){const k=2/(period+1),out=[values[0]];for(const v of values.slice(1))out.push(k*v+(1-k)*out.at(-1));return out;}
export function runnerContext(bars,side,entry,stop){
 if(bars.length<25||!['LONG','SHORT'].includes(side)||![entry,stop].every(Number.isFinite)||entry<=0||entry===stop||bars.some(b=>!['high','low','close','volume'].every(k=>Number.isFinite(b[k]))))return {available:false};
 const closes=bars.map(b=>b.close),fast=ema(closes,9),slow=ema(closes,21),direction=side==='LONG'?1:-1;
 const tr=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close))),atr=tr.slice(-14).reduce((a,b)=>a+b,0)/14;
 const recentVolume=bars.slice(-4).reduce((s,b)=>s+b.volume,0)/4,baselineVolume=bars.slice(-24,-4).reduce((s,b)=>s+b.volume,0)/20;
 return {available:true,timeframe:'15m',barsObserved:bars.length,ema9:fast.at(-1),ema21:slow.at(-1),trendAligned:direction*(fast.at(-1)-slow.at(-1))>0&&direction*(entry-fast.at(-1))>0,ema21SlopeOneHour:direction*(slow.at(-1)-slow.at(-5)),atr14:atr,extensionFromEma9Atr:atr>0?direction*(entry-fast.at(-1))/atr:null,recentToBaselineVolume:baselineVolume>0?recentVolume/baselineVolume:null,referenceRiskPct:Math.abs(entry-stop)/entry*100,note:'Observed 15-minute context only; no higher-timeframe, news or order-flow confirmation.'};
}
export function runnerAssessment(review,context){
 const valid=['supported','unclear','weak'].includes(review.runnerPotential)&&typeof review.runnerReason==='string'&&review.runnerReason.length<=700;
 const potential=valid?review.runnerPotential:'unclear';
 const supported=potential==='supported'&&context.available&&context.trendAligned&&context.ema21SlopeOneHour>0;
 const reason=potential==='supported'&&!supported?'ข้อมูลแนวโน้มยังไม่สอดคล้องพอที่จะติดป้ายไปต่อยาว':valid?review.runnerReason:'ข้อมูลประเมินการไปต่อยังไม่ครบ';
 return {potential:potential==='supported'&&!supported?'unclear':potential,reason,supported,context,calibrated:false,affectsEntrySelection:false,version:'runner-context-v1'};
}
