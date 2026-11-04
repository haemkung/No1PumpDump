export function findSignal(bars, intervalMs=900000) {
  if (bars.length < 22) return null;
  const last=bars.at(-1), breakout=bars.at(-2), base=bars.slice(-22,-2);
  if(last.time-breakout.time!==intervalMs) return null;
  const top=Math.max(...base.map(b=>b.high)), bottom=Math.min(...base.map(b=>b.low));
  const avg=base.reduce((s,b)=>s+b.volume,0)/base.length;
  if(!(avg>0) || breakout.volume<1.5*avg) return null;
  const common={time:last.time,end:last.end,entry:last.close,volumeRatio:breakout.volume/avg};
  const range=last.high-last.low;
  const closeLocation=range>0?(last.close-last.low)/range:.5;
  if(breakout.close>top && last.low<=top*1.001 && last.low>=top*.995 && last.close>top)
    return {...common,side:'LONG',stop:last.low*.999,closeStrength:closeLocation};
  if(breakout.close<bottom && last.high>=bottom*.999 && last.high<=bottom*1.005 && last.close<bottom)
    return {...common,side:'SHORT',stop:last.high*1.001,closeStrength:1-closeLocation};
  return null;
}

export function closedThirtyMinuteBars(bars) {
  const interval = 900000;
  const result = [];
  for (let i = 1; i < bars.length; i++) {
    const first = bars[i - 1], second = bars[i];
    if (first.time % (2 * interval) !== 0 ||
        second.time !== first.time + interval ||
        first.end !== second.time - 1 ||
        second.end !== first.time + 2 * interval - 1) continue;
    result.push({
      time: first.time, end: second.end, open: first.open,
      high: Math.max(first.high, second.high), low: Math.min(first.low, second.low),
      close: second.close, volume: first.volume + second.volume
    });
  }
  // Breakout history must not bridge gaps.
  const gap = result.findLastIndex((bar, i) => i > 0 && bar.time - result[i - 1].time !== 2 * interval);
  return result.slice(gap < 0 ? 0 : gap);
}
