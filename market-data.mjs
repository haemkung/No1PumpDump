export function binanceSymbols(exchange){
  return exchange.symbols.filter(s=>s.status==='TRADING'&&s.contractType==='PERPETUAL'&&s.quoteAsset==='USDT'&&s.underlyingType==='COIN').map(s=>s.symbol);
}
export function createMarketData(provider,json){
  if(provider==='binance-futures')return {
    label:'Binance USDT Futures',provider,
    async universe(){
      const [exchange,clock]=await Promise.all([json('https://fapi.binance.com/fapi/v1/exchangeInfo'),json('https://fapi.binance.com/fapi/v1/time')]);
      const symbols=binanceSymbols(exchange);
      return {symbols,totalMarkets:symbols.length,serverTime:Number(clock.serverTime),scope:'all_active_crypto_usdt_perpetual'};
    },
    async bars(symbol,serverTime){
      const raw=await json('https://fapi.binance.com/fapi/v1/klines?symbol='+encodeURIComponent(symbol)+'&interval=15m&limit=80');
      return raw.map(b=>({time:Number(b[0]),end:Number(b[6]),high:Number(b[2]),low:Number(b[3]),close:Number(b[4]),volume:Number(b[5])})).filter(b=>b.end<serverTime).sort((a,b)=>a.time-b.time);
    },
    quote(symbol){return json('https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol='+encodeURIComponent(symbol));}
  };
  if(provider!=='kraken-futures')throw Error('Unsupported market provider');
  const tickers=()=>json('https://futures.kraken.com/derivatives/api/v3/tickers');
  return {
    label:'Kraken Futures (ราคาและรายชื่ออาจต่างจาก Binance)',provider,
    async universe(){
      const snapshot=await tickers();
      const markets=snapshot.tickers.filter(t=>t.tag==='perpetual'&&/^PF_[A-Z0-9]+USD$/.test(t.symbol)&&!t.suspended);
      return {symbols:markets.filter(t=>Number(t.volumeQuote)>=1000000).map(t=>t.symbol),totalMarkets:markets.length,serverTime:Date.now(),scope:'kraken_backup_volume_1m'};
    },
    async bars(symbol,serverTime){
      const raw=await json('https://futures.kraken.com/api/charts/v1/trade/'+encodeURIComponent(symbol)+'/15m');
      return raw.candles.map(b=>({time:Number(b.time),end:Number(b.time)+899999,high:Number(b.high),low:Number(b.low),close:Number(b.close),volume:Number(b.volume)})).filter(b=>b.end<serverTime).sort((a,b)=>a.time-b.time).slice(-80);
    },
    async quote(symbol){const snapshot=await tickers();const t=snapshot.tickers.find(t=>t.symbol===symbol);if(!t)throw Error('Missing quote');return {bidPrice:t.bid,askPrice:t.ask};}
  };
}
