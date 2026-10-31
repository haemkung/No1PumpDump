export function rankTargets(candidates,board){
  const values=board.map(r=>r.return30m).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!values.length)return [];
  const rank=(x,side)=>Math.round(100*(side==='LONG'?values.filter(v=>v<=x).length:values.filter(v=>v>=x).length)/values.length);
  return candidates.map(s=>{const change=board.find(b=>b.symbol===s.symbol)?.return30m;return {...s,relativeRank:rank(change,s.side),return30m:change};}).filter(s=>Number.isFinite(s.return30m)&&s.relativeRank>=90&&(s.side==='LONG'?s.return30m>0:s.return30m<0));
}
export function confirmMinute(bars,side,now){
  if(bars.length<22)return null;
  const last=bars.at(-1),previous=bars.at(-2),base=bars.slice(-21,-1);
  if(now-last.end<0||now-last.end>75000||last.time-previous.time!==60000)return null;
  const avg=base.reduce((sum,b)=>sum+b.volume,0)/base.length,range=last.high-last.low;
  if(!(avg>0&&range>0)||last.volume<1.5*avg)return null;
  const strength=(last.close-last.low)/range;
  const ok=side==='LONG'?last.close>previous.high&&last.close>last.open&&strength>=.75:last.close<previous.low&&last.close<last.open&&strength<=.25;
  return ok?{time:last.time,end:last.end,entry:last.close,volumeRatio:last.volume/avg,closeStrength:side==='LONG'?strength:1-strength}:null;
}
export function triggerStillValid(trigger,side,bid,ask){
  if(!(bid>0&&ask>=bid&&trigger.entry>0))return false;
  const price=side==='LONG'?ask:bid;
  return Math.abs(price/trigger.entry-1)<=.001&&(side==='LONG'?bid>=trigger.entry*.9995:ask<=trigger.entry*1.0005);
}
