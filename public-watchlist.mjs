export const reasons={reclaim_lost_or_chase:'เสียระดับยืนยันหรือราคาไกลเกินเกณฑ์',quote_stop_or_cost:'ไม่ผ่านเกณฑ์ราคา ระยะ Stop หรือต้นทุน',opposing_btc_trend:'ทิศทางสวนแนวโน้ม BTC',post_ai_price_or_freshness:'ราคาเปลี่ยนหรือสัญญาณเก่าหลังตรวจ AI',ai_rejected:'AI ยังไม่ยืนยัน',expired_reclaim:'หมดเวลารอยืนยัน',expired_watch:'หมดเวลาเฝ้ารอ',stale_confirmation:'ข้อมูลยืนยันเก่าเกินไป',quote_spread:'ส่วนต่างซื้อขายไม่ผ่าน',missing_current_context:'ข้อมูลตลาดปัจจุบันไม่ครบ'};
export function sanitizeFeed(feed){
 if(!Number.isFinite(Date.parse(feed?.checkedAt)))return null;
 const items=(Array.isArray(feed.items)?feed.items:[]).filter(r=>/^[A-Z0-9_]{2,30}$/.test(r.symbol)&&['LONG','SHORT'].includes(r.side)&&['Binance Futures','Kraken Futures'].includes(r.market)&&Object.hasOwn(reasons,r.reason)&&Number.isFinite(Date.parse(r.at))).slice(0,60).map(r=>({symbol:r.symbol,side:r.side,market:r.market,at:new Date(r.at).toISOString(),reason:r.reason}));
 return {version:1,checkedAt:new Date(feed.checkedAt).toISOString(),items};
}
export function publicWatchlist(state){
 const items=[];
 for(const [id,r] of Object.entries(state.done||{})){
  if(!Object.hasOwn(reasons,r.status))continue;
  const match=id.match(/^(?:momentum-v\d+|sweep-reclaim-v\d+)-(binance-futures|kraken-futures)-([A-Z0-9_]+)-(LONG|SHORT)-/);
  if(!match&&!(r.symbol&&r.side&&['binance-futures','kraken-futures'].includes(r.provider)))continue;
  if(Date.parse(state.lastCheck)-Date.parse(r.at)>86400000)continue;
  items.push({symbol:match?.[2]??r.symbol,side:match?.[3]??r.side,market:(match?.[1]??r.provider)==='binance-futures'?'Binance Futures':'Kraken Futures',at:r.at,reason:r.status});
 }
 items.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return sanitizeFeed({checkedAt:state.lastCheck,items});
}
