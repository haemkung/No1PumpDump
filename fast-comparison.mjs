// Prospective, quote-eligible rule comparison. This does not change live selection.
export const protocol={version:'btc-context-study-v1',minimumCases:100,minimumDays:14,holdoutCases:50,holdoutDays:7,overlapMinutes:240,feeRoundTripPct:0.1,extraExitCostPct:0.1};
const time=r=>Date.parse(r.observedAt);
export function wilson(k,n){
 if(!n)return null;
 const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
 return [Math.max(0,c-h),Math.min(1,c+h)];
}
function summary(rows,now){
 return Object.fromEntries([5,30,240].map(m=>{
  const a=rows.filter(r=>r.outcomes?.[m]?.maturedAt<=now&&['directionalClosePct','favorablePct','adversePct'].every(k=>Number.isFinite(r.outcomes[m][k])));
  const positive=a.filter(r=>r.outcomes[m].directionalClosePct>0).length;
  const net=a.map(r=>r.outcomes[m].directionalClosePct-protocol.feeRoundTripPct-protocol.extraExitCostPct);
  const netPositive=net.filter(x=>x>0).length;
  return [m,{matured:a.length,pending:rows.length-a.length,positiveClose:positive,nonPositiveClose:a.length-positive,netPositive,netNonPositive:a.length-netPositive,netPositiveInterval95:wilson(netPositive,a.length),meanNetClosePct:a.length?net.reduce((s,x)=>s+x,0)/a.length:null,meanAdversePct:a.length?a.reduce((s,r)=>s+r.outcomes[m].adversePct,0)/a.length:null,meanFavorablePct:a.length?a.reduce((s,r)=>s+r.outcomes[m].favorablePct,0)/a.length:null}];
 }));
}
function cohort(rows,now){return {count:rows.length,results:summary(rows,now),bySide:Object.fromEntries(['LONG','SHORT'].map(side=>[side,summary(rows.filter(r=>r.side===side),now)]))};}
function readiness(rows,now,count,days){
 const a=rows.filter(r=>r.outcomes?.[240]?.maturedAt<=now);
 const span=a.length>1?(time(a.at(-1))-time(a[0]))/86400000:0;
 return {maturedCases:a.length,observedSpanDays:span,requiredCases:count,requiredDays:days,ready:a.length>=count&&span>=days};
}
export function compare(records,now,previous={}){
 const eligible=Object.values(records).filter(r=>r.cohort==='prospective_candidate'&&r.status==='observed'&&r.provider==='binance-futures'&&['LONG','SHORT'].includes(r.side)&&Number.isFinite(time(r))&&time(r)<=now&&(r.initialAssessment?.pass||r.initialAssessment?.reason==='opposing_btc_trend'&&r.initialAssessment?.btcContextChallenger?.pass)).sort((a,b)=>time(a)-time(b));
 const last=new Map(),rows=[];
 for(const r of eligible){if(time(r)-(last.get(r.symbol)??-Infinity)<protocol.overlapMinutes*60000)continue;last.set(r.symbol,time(r));rows.push(r);}
 const added=rows.filter(r=>!r.initialAssessment.pass),baseline=rows.filter(r=>r.initialAssessment.pass);
 const discovery=readiness(added,now,protocol.minimumCases,protocol.minimumDays);
 const frozenAt=previous.protocol?.version===protocol.version&&previous.frozenAt?previous.frozenAt:discovery.ready?new Date(now).toISOString():null;
 const held=added.filter(r=>frozenAt&&time(r)>Date.parse(frozenAt));
 const holdout=readiness(held,now,protocol.holdoutCases,protocol.holdoutDays);
 return {protocol,checkedAt:new Date(now).toISOString(),mode:'prospective_shadow',affectsLiveSelection:false,status:!frozenAt?'collecting_discovery':!holdout.ready?'collecting_holdout':'ready_for_review',frozenAt,discovery,holdout,rawEligible:eligible.length,excludedOverlapping:eligible.length-rows.length,btcContextCandidates:added.length,results:summary(added,now),baseline:cohort(baseline,now),challenger:cohort(rows,now),added:cohort(added,now),heldOutAdded:cohort(held,now),limitations:['Pre-AI quote filter comparison, not simulated Telegram delivery or executed trades.','Entry uses recorded executable-side quote; exits use candle closes. Costs are assumptions, not actual fees, funding or fills.','Partial observation minute excluded. Candle highs/lows cannot establish adverse-before-profit order.','Same-symbol events within four hours excluded; remaining market correlation means Wilson intervals are descriptive, not a proof of superiority.','Readiness permits review only. No automatic promotion or live filter relaxation.']};
}
export function report(c){
 const lines=['# ผลเปรียบเทียบตัวกรอง BTC',`อัปเดต ${c.checkedAt}`,`สถานะ: ${c.status} — ยังไม่เปลี่ยนการส่งจริง`, '',`ข้อมูลเพิ่มจากการผ่อน BTC: ${c.discovery.maturedCases}/${c.discovery.requiredCases} เหตุการณ์ที่วัดครบ 4 ชั่วโมง`, `ช่วงข้อมูล ${c.discovery.observedSpanDays.toFixed(1)}/${c.discovery.requiredDays} วัน`, `ตัดเหตุการณ์เหรียญเดียวกันซ้อนใน 4 ชั่วโมง: ${c.excludedOverlapping}`, '', '| ช่วงหลังพบ | วัดครบ | บวกหลังต้นทุนสมมติ | ไม่บวก | ช่วงประมาณ 95% |', '|---|---:|---:|---:|---|'];
 for(const m of [5,30,240]){const r=c.results[m];lines.push(`| ${m} นาที | ${r.matured} | ${r.netPositive} | ${r.netNonPositive} | ${r.netPositiveInterval95?r.netPositiveInterval95.map(x=>(100*x).toFixed(1)+'%').join('–'):'ยังไม่มีข้อมูล'} |`);}
 lines.push('', 'ต้นทุนสมมติ: ค่าธรรมเนียมไปกลับ 0.10% และเผื่อต้นทุนออกอีก 0.10%; ราคาเข้าใช้ฝั่ง bid/ask ที่บันทึก ไม่ใช่ผลกำไรจริง', 'เมื่อครบ 100 เหตุการณ์และช่วงข้อมูล 14 วัน จะตรึงวันแบ่ง แล้วประเมินข้อมูลใหม่อย่างน้อย 50 เหตุการณ์และ 7 วันก่อนทบทวนเปิดใช้', `วันแบ่งข้อมูลใหม่: ${c.frozenAt??'ยังไม่ถึงเกณฑ์'}`, `ข้อมูลใหม่ครบ ${c.holdout.maturedCases}/${c.holdout.requiredCases} เหตุการณ์`, '', 'รายงาน JSON แยก Long/Short และกฎเดิม/ใหม่ ข้อมูลนี้เปรียบเทียบด่านราคา ก่อน AI ไม่ใช่อัตราชนะของข้อความที่ส่งจริง', 'แท่งราคาไม่บอกลำดับการสวนก่อนวิ่งภายในแท่ง และข้อมูลข้ามเหรียญอาจสัมพันธ์กัน จึงยังใช้ช่วงประมาณนี้รับรองความเหนือกว่าไม่ได้');
 return lines.join('\n')+'\n';
}
