export function findSignal(bars) {
  if (bars.length < 22) return null;
  const last=bars.at(-1), breakout=bars.at(-2), base=bars.slice(-22,-2);
  if(last.time-breakout.time!==900000) return null;
  const top=Math.max(...base.map(b=>b.high)), bottom=Math.min(...base.map(b=>b.low));
  const avg=base.reduce((s,b)=>s+b.volume,0)/base.length;
  if(!(avg>0) || breakout.volume<1.5*avg) return null;
  const common={time:last.time,end:last.end,entry:last.close,volumeRatio:breakout.volume/avg};
  if(breakout.close>top && last.low<=top*1.001 && last.low>=top*.995 && last.close>top)
    return {...common,side:'LONG',stop:last.low*.999};
  if(breakout.close<bottom && last.high>=bottom*.999 && last.high<=bottom*1.005 && last.close<bottom)
    return {...common,side:'SHORT',stop:last.high*1.001};
  return null;
}
