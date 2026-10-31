export function earlyBase(bars,now){
  if(bars.length<22)return null;
  if(!Number.isFinite(now)||bars.slice(-22).some(b=>!['time','end','open','high','low','close','volume'].every(k=>Number.isFinite(b[k]))||b.low<=0||b.high<b.low||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high||b.volume<0||b.end-b.time!==59999))return null;
  const base=bars.slice(-22,-2),sweep=bars.at(-2),reclaim=bars.at(-1);
  if(now-reclaim.end<0||now-reclaim.end>90000||bars.slice(-22).some((b,i,a)=>i&&b.time-a[i-1].time!==60000))return null;
  const low=Math.min(...base.map(b=>b.low)),high=Math.max(...base.map(b=>b.high)),avg=base.reduce((s,b)=>s+b.volume,0)/20;
  if(!(low>0&&avg>0&&high>low)||high/low-1>.015||sweep.volume<2*avg)return null;
  const range=reclaim.high-reclaim.low;if(!(range>0))return null;
  const strength=(reclaim.close-reclaim.low)/range;
  const common={time:reclaim.time,end:reclaim.end,entry:reclaim.close,baseLow:low,baseHigh:high,volumeRatio:sweep.volume/avg,baseRangePct:(high/low-1)*100};
  if(sweep.low<low*.9995&&reclaim.close>low&&reclaim.close>sweep.high&&reclaim.close>reclaim.open&&strength>=.75)return {...common,side:'LONG',stop:sweep.low*.999,closeStrength:strength};
  if(sweep.high>high*1.0005&&reclaim.close<high&&reclaim.close<sweep.low&&reclaim.close<reclaim.open&&strength<=.25)return {...common,side:'SHORT',stop:sweep.high*1.001,closeStrength:1-strength};
  return null;
}
export function earlyScore(s){return Math.min(100,Math.round(35+25*s.closeStrength+20*Math.min(1,(s.volumeRatio-2)/2)+20*Math.max(0,1-s.baseRangePct/1.5)));}
