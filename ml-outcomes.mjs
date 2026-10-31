export async function evaluateMaturedSignal(r,json){
  const start=Date.parse(r.sentAt),horizon=r.evaluationHorizonMs??4*3600000,until=start+horizon;
  if(!Number.isFinite(start)||Date.now()<until)return null;
  const touch=p=>r.side==='LONG'?(p<=r.stop?'SL':p>=r.target?'TP':null):(p>=r.stop?'SL':p<=r.target?'TP':null);
  const raw=await json(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(r.symbol)}&interval=1m&startTime=${Math.floor(start/60000)*60000}&endTime=${until}&limit=1000`);
  if(!raw.length||Number(raw[0][0])>start||Number(raw.at(-1)[6])<until-60000)throw Error('Incomplete outcome window');
  for(const b of raw){
    const time=Number(b[0]),end=Number(b[6]),high=Number(b[2]),low=Number(b[3]);
    if(end<start||time>=until)continue;
    const sl=r.side==='LONG'?low<=r.stop:high>=r.stop,tp=r.side==='LONG'?high>=r.target:low<=r.target;
    if(!sl&&!tp)continue;
    if(sl&&tp||time<start||end>=until){
      const from=Math.max(time,start),to=Math.min(end,until-1);let fromId=null,done=false;
      for(let page=0;page<15;page++){
        const query=fromId===null?`startTime=${from}&endTime=${to}`:`fromId=${fromId}`;
        const trades=await json(`https://fapi.binance.com/fapi/v1/aggTrades?symbol=${encodeURIComponent(r.symbol)}&${query}&limit=1000`);
        for(const t of trades)if(t.T>=from&&t.T<=to){const event=touch(Number(t.p));if(event)return {kind:event,time:Number(t.T),target:event==='TP'?1:0};}
        if(!trades.length||trades.length<1000||Number(trades.at(-1).T)>=to){done=true;break;}
        fromId=Number(trades.at(-1).a)+1;
      }
      if(!done)throw Error('Ambiguous outcome sequence');
    }else return {kind:sl?'SL':'TP',time,target:tp?1:0};
  }
  return {kind:horizon===4*3600000?'no_touch_4h':'no_touch_window',time:until,target:0};
}
