(()=>{
const reasons={reclaim_lost_or_chase:'เสียระดับยืนยันหรือราคาไกลเกินเกณฑ์',quote_stop_or_cost:'ไม่ผ่านเกณฑ์ราคา ระยะ Stop หรือต้นทุน',opposing_btc_trend:'สวนแนวโน้ม BTC',post_ai_price_or_freshness:'ราคาเปลี่ยนหรือสัญญาณเก่าหลังตรวจ AI',ai_rejected:'AI ยังไม่ยืนยัน',expired_reclaim:'หมดเวลารอยืนยัน',expired_watch:'หมดเวลาเฝ้ารอ',stale_confirmation:'ข้อมูลยืนยันเก่า',quote_spread:'ส่วนต่างซื้อขายไม่ผ่าน',missing_current_context:'ข้อมูลปัจจุบันไม่ครบ'};
const el=id=>document.getElementById(id),fmt=t=>new Date(t).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});let busy=false;
async function update(){if(busy)return;busy=true;try{
 let data,local=false;
 try{const r=await fetch('http://127.0.0.1:18741/watchlist.json',{cache:'no-store',signal:AbortSignal.timeout(2500)});if(!r.ok)throw Error();data=await r.json();if(!Array.isArray(data.items)||!Number.isFinite(Date.parse(data.checkedAt)))throw Error();local=true;}catch{
 const r=await fetch('https://raw.githubusercontent.com/haemkung/No1PumpDump/main/watchlist.json?t='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();data=await r.json();}
 if(!Array.isArray(data.items)||!Number.isFinite(Date.parse(data.checkedAt)))throw Error();
 el('watch-update').textContent=(local?'เชื่อมตัวสแกนในเครื่อง · ตรวจข้อมูลทุก 1 นาที':'เชื่อมในเครื่องไม่ได้ · ใช้ข้อมูล GitHub สำรองที่อาจล่าช้า')+' · ข้อมูล ณ '+fmt(data.checkedAt)+(Date.now()-Date.parse(data.checkedAt)>(local?120000:35*60000)?' · ข้อมูลล่าช้า ยังยืนยันสถานะปัจจุบันไม่ได้':'')+' · รายการย้อนหลัง ไม่ใช่จุดเข้าปัจจุบัน';
 el('watch-rows').replaceChildren();
 for(const item of data.items){const tr=document.createElement('tr');for(const text of [item.symbol+' '+item.side+' · '+item.market,fmt(item.at),reasons[item.reason]||'ยังไม่ผ่านเกณฑ์']){const td=document.createElement('td');td.textContent=text;tr.append(td);}el('watch-rows').append(tr);}
 el('watch-empty').hidden=!!data.items.length;
}catch{el('watch-update').textContent='อ่านข้อมูลล่าสุดไม่ได้ · รายการที่ค้างอยู่ไม่ใช่ข้อมูลปัจจุบัน';}finally{busy=false;}}
update();setInterval(update,60000);document.getElementById('refresh')?.addEventListener('click',update);
})();
