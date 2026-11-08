const minuteMs = 60_000;
export const fastReversalFreshMs = 45_000;

export function fastReversal(symbol, rows, now) {
  const bars = rows.map(row => ({
    time:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),
    close:Number(row[4]),end:Number(row[6]),quoteVolume:Number(row[7]),buyQuote:Number(row[10])
  })).filter(bar=>bar.end<now).slice(-22);
  if(bars.length!==22 || bars.some((bar,i)=>
    !Object.values(bar).every(Number.isFinite) || bar.low<=0 ||
    bar.high<Math.max(bar.open,bar.close) || bar.low>Math.min(bar.open,bar.close) ||
    bar.buyQuote<0 || bar.buyQuote>bar.quoteVolume || bar.end!==bar.time+minuteMs-1 ||
    (i>0 && bar.time!==bars[i-1].time+minuteMs)))return null;

  const base=bars.slice(0,-2),shock=bars.at(-2),bounce=bars.at(-1);
  if(now-bounce.end>fastReversalFreshMs || shock.quoteVolume<50_000 || bounce.quoteVolume<=0)return null;
  const average=base.reduce((sum,bar)=>sum+bar.quoteVolume,0)/base.length;
  if(!(average>0))return null;
  const volumeRatio=shock.quoteVolume/average;
  const body=(shock.close-shock.open)/shock.open;
  if(volumeRatio<2.5 || Math.abs(body)<.015)return null;
  const direction=body<0?1:-1;
  const side=direction===1?'LONG':'SHORT';
  const level=direction===1?Math.min(...base.map(bar=>bar.low)):Math.max(...base.map(bar=>bar.high));
  const extreme=direction===1?shock.low:shock.high;
  const bounceExtreme=direction===1?bounce.low:bounce.high;
  const shockBuy=shock.buyQuote/shock.quoteVolume;
  const bounceBuy=bounce.buyQuote/bounce.quoteVolume;
  const reversalFlow=direction===1?bounceBuy:1-bounceBuy;
  const shockFlow=direction===1?1-shockBuy:shockBuy;
  const recovery=direction*(bounce.close-shock.close)/Math.abs(shock.open-shock.close);
  if(direction*(level-extreme)/level<.002 || direction*(bounceExtreme-extreme)<=0 ||
     direction*(bounce.close-level)<=0 || direction*(bounce.close-bounce.open)<=0 ||
     recovery<.5 || shockFlow<.6 || reversalFlow<.6)return null;

  return {
    seed:{id:`fast-reversal-v1-${symbol}-${shock.time}`,mode:'fast-reversal',provider:'binance-futures',
      symbol,side,level,isBenchmark:symbol==='BTCUSDT',sourceTimeframe:'1m',
      features:{volumeRatio,closeStrength:reversalFlow}},
    confirmation:{status:'confirmed',confirmedAt:bounce.end,reference:bounce.close,
      shockCandle:shock,bounceCandle:bounce,priorRangeLevel:level,volumeRatio,recovery,shockFlow,reversalFlow}
  };
}

export async function scanFastReversals(symbols, {fetchImpl, clock, until, candleTime}) {
  let index=0,checked=0,failed=0,rateLimited=false;
  const candidates=[];
  async function worker(){
    while(index<symbols.length && clock()<until && !rateLimited){
      const symbol=symbols[index++];
      try{
        const timeout=Math.max(1,Math.min(2500,until-clock()));
        const response=await fetchImpl('https://fapi.binance.com/fapi/v1/klines?symbol='+encodeURIComponent(symbol)+'&interval=1m&limit=23',
          {signal:AbortSignal.timeout(timeout)});
        const weight=Number(response.headers.get('x-mbx-used-weight-1m'));
        if(response.status===429 || response.status===418 || weight>=1750)rateLimited=true;
        if(!response.ok){failed++;continue;}
        const rows=await response.json();
        if(!Array.isArray(rows)){failed++;continue;}
        checked++;
        const candidate=fastReversal(symbol,rows,clock());
        if(candidate?.confirmation.bounceCandle.time===candleTime)candidates.push(candidate);
      }catch{failed++;}
    }
  }
  await Promise.all(Array.from({length:18},worker));
  return {checked,failed,rateLimited,candidates};
}

export function fastReversalEntry(seed, confirmation, bid, ask, context, benchmark, now) {
  const age=now-confirmation.confirmedAt;
  if(confirmation.status!=='confirmed' || age<0 || age>fastReversalFreshMs)
    return {pass:false,reason:'stale_confirmation'};
  if(!context?.available || !benchmark?.available)
    return {pass:false,reason:'missing_current_context'};
  if(![bid,ask].every(Number.isFinite) || bid<=0 || ask<bid || (ask-bid)/bid>.001)
    return {pass:false,reason:'quote_spread'};
  const direction=seed.side==='LONG'?1:-1;
  const entry=direction===1?ask:bid;
  if(direction*(entry-seed.level)<=0 || Math.abs(entry/confirmation.reference-1)>.003)
    return {pass:false,reason:'reclaim_lost_or_chase'};
  if(benchmark.direction===-direction)
    return {pass:false,reason:'opposing_btc_trend'};
  return {pass:true,entry,spreadRatio:(ask-bid)/bid};
}
