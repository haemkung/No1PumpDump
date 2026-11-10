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
     recovery<.5 || shockFlow<.55 || reversalFlow<.6)return null;

  return {
    seed:{id:`fast-reversal-v1-${symbol}-${shock.time}`,mode:'fast-reversal',provider:'binance-futures',
      symbol,side,level,isBenchmark:symbol==='BTCUSDT',sourceTimeframe:'1m',
      features:{volumeRatio,closeStrength:reversalFlow}},
    confirmation:{status:'confirmed',confirmedAt:bounce.end,reference:bounce.close,
      shockCandle:shock,bounceCandle:bounce,priorRangeLevel:level,volumeRatio,recovery,shockFlow,reversalFlow,ruleRevision:'shock55-bounce60-v2'}
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
  const direction=seed.side==='LONG'?1:-1,entry=direction===1?ask:bid;
  const validQuote=[bid,ask].every(Number.isFinite)&&bid>0&&ask>=bid;
  const diagnostics={assessedAt:now,bid,ask,entry,level:seed.level,reference:confirmation.reference,
    ageMs:now-confirmation.confirmedAt,spreadRatio:validQuote?(ask-bid)/bid:null,
    referenceDrift:Number.isFinite(entry)&&confirmation.reference>0?Math.abs(entry/confirmation.reference-1):null,
    benchmarkDirection:benchmark?.direction??null,coinDirection:context?.direction??null,
    policy:'fast-quote-retry-v2',btcPolicy:'veto_with_context_challenger'};
  const reject=reason=>({pass:false,reason,diagnostics});
  if(confirmation.status!=='confirmed'||diagnostics.ageMs<0||diagnostics.ageMs>fastReversalFreshMs)return reject('stale_confirmation');
  if(!context?.available||!benchmark?.available)return reject('missing_current_context');
  if(!validQuote)return reject('invalid_quote');
  if(diagnostics.spreadRatio>.001)return reject('quote_spread');
  if(direction*(entry-seed.level)<=0)return reject('reclaim_lost');
  if(diagnostics.referenceDrift>.003)return reject('reference_drift');
  if(benchmark.direction===-direction)return {...reject('opposing_btc_trend'),btcContextChallenger:{pass:true,mode:'shadow',affectsLiveSelection:false,entry}};
  return {pass:true,entry,spreadRatio:diagnostics.spreadRatio,diagnostics,btcContextChallenger:{pass:true,mode:'shadow',affectsLiveSelection:false,entry}};
}

export async function checkFastQuote({seed,confirmation,context,benchmark,quote,clock,deadline,sleep=ms=>new Promise(r=>setTimeout(r,ms)),initialBook}){
 const attempts=[];let book=initialBook??await quote();
 for(let i=0;i<3;i++){
  const result=fastReversalEntry(seed,confirmation,Number(book.bidPrice),Number(book.askPrice),context,benchmark,clock());
  attempts.push({at:clock(),...result});
  if(result.reason!=='quote_spread'||i===2||clock()+10400>=deadline||clock()+400>=confirmation.confirmedAt+fastReversalFreshMs)return {...result,quoteAttempts:attempts};
  await sleep(350);
  // A new quote must pass all checks; recovery of the spread never bypasses price or freshness.
  if(clock()+10000>=deadline||clock()>=confirmation.confirmedAt+fastReversalFreshMs)return {...fastReversalEntry(seed,confirmation,Number(book.bidPrice),Number(book.askPrice),context,benchmark,clock()),quoteAttempts:attempts};
  try{book=await quote();}catch{return {pass:false,reason:'quote_unavailable',diagnostics:attempts.at(-1).diagnostics,quoteAttempts:attempts};}
 }
}
