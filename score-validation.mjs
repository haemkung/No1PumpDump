export const recordedScore=r=>r.quality?.total??r.qualityScore;
export const prospectiveStart='2026-11-01T05:02:20.000Z';
function summary(rows){
 const counts={TP:0,SL:0,no_touch:0};for(const r of rows){if(r.label.kind==='TP')counts.TP++;else if(r.label.kind==='SL')counts.SL++;else counts.no_touch++;}
 return {n:rows.length,...counts,tpBeforeStopFraction:rows.length?counts.TP/rows.length:null,touchedBarrierGrossR:2*counts.TP-counts.SL,note:'Barrier R excludes timed exits, fees and slippage; not total strategy PnL.'};
}
export function score85Report(records,now=Date.now()){
 const all=records.filter(r=>r.label&&Number.isFinite(recordedScore(r))&&Date.parse(r.sentAt)+14400000<=now).sort((a,b)=>Date.parse(a.sentAt)-Date.parse(b.sentAt));
 const split=Math.floor(all.length*.7),pivot=all[split]?.sentAt;
 const before=pivot?all.filter(r=>Date.parse(r.sentAt)<Date.parse(pivot)):all,after=pivot?all.filter(r=>Date.parse(r.sentAt)>=Date.parse(pivot)):[];
 const compare=rows=>({withoutAbsoluteCutoff:summary(rows),scoreAtLeast85:summary(rows.filter(r=>recordedScore(r)>=85)),scoreBelow85:summary(rows.filter(r=>recordedScore(r)<85))});
 return {checkedAt:new Date(now).toISOString(),threshold:85,totalRecords:records.length,scoredMatured:all.length,excluded:records.length-all.length,all:compare(all),earlier:compare(before),later:compare(after),laterStarts:pivot??null,prospective:{startsAt:prospectiveStart,...compare(all.filter(r=>Date.parse(r.sentAt)>=Date.parse(prospectiveStart)))},mode:'research_only',affectsLiveSelection:false,limitations:['Delivered signals only; unobserved and rejected candidates are unavailable.','No score imputation; unscored records excluded.','Temporal partitions are descriptive: these historical results have already been inspected.','Prospective cohort begins at the fixed registration timestamp, not a date selected after seeing future outcomes.','Small sample, correlated coins and market regimes; no superiority established.']};
}
