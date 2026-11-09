export const qualityNames=['extensionPct','recovery','reversalFlow','logVolumeRatio','logBounceVolumeRatio','isLong'];
export function qualityFeatures(seed,c,entry){
 const shock=c?.shockCandle,bounce=c?.bounceCandle;
 if(!['LONG','SHORT'].includes(seed?.side)||!(seed.level>0&&entry>0&&c?.volumeRatio>0&&shock?.quoteVolume>0&&bounce?.quoteVolume>0))return null;
 const x=[(seed.side==='LONG'?1:-1)*(entry/seed.level-1)*100,c.recovery,c.reversalFlow,Math.log(c.volumeRatio),Math.log(bounce.quoteVolume/shock.quoteVolume),seed.side==='LONG'?1:0];
 return x.every(Number.isFinite)?x:null;
}
export function qualityScore(model,x){
 if(!x||!x.every(Number.isFinite)||model?.featureNames?.join('|')!==qualityNames.join('|')||![model.bias,...(model.weights??[]),...(model.mean??[]),...(model.scale??[])].every(Number.isFinite)||[model.weights,model.mean,model.scale].some(a=>a?.length!==x.length)||model.scale.some(v=>v<=0))return null;
 const z=model.bias+x.reduce((s,v,i)=>s+model.weights[i]*(v-model.mean[i])/model.scale[i],0);return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
}
export function qualitySummary(records,now){
 const all=Object.values(records).filter(r=>r.cohort==='prospective_candidate'&&r.initialAssessment?.pass&&r.qualityShadow?.available&&Date.parse(r.observedAt)<=now).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const last=new Map(),rows=[];
 for(const r of all){const t=Date.parse(r.observedAt);if(t-(last.get(r.symbol)??-Infinity)<14400000)continue;last.set(r.symbol,t);rows.push(r);}
 const ids=[...new Set(rows.flatMap(r=>Object.keys(r.qualityShadow.decisions)))];
 const count=(a,m)=>{const v=a.filter(r=>r.outcomes?.[m]?.maturedAt<=now&&Number.isFinite(r.outcomes[m].directionalClosePct));return {n:v.length,positiveNet:v.filter(r=>r.outcomes[m].directionalClosePct>.2).length,nonPositiveNet:v.filter(r=>r.outcomes[m].directionalClosePct<=.2).length};};
 return {checkedAt:new Date(now).toISOString(),mode:'forward_shadow',affectsLiveSelection:false,calibrated:false,rawCases:all.length,distinctCases:rows.length,assumedExitAndFeesPct:.2,baseline:Object.fromEntries([5,30,240].map(m=>[m,count(rows,m)])),rules:Object.fromEntries(ids.map(id=>[id,Object.fromEntries([5,30,240].map(m=>[m,{kept:count(rows.filter(r=>r.qualityShadow.decisions[id]===true),m),dropped:count(rows.filter(r=>r.qualityShadow.decisions[id]===false),m)}]))])),limitation:'Pre-AI candidates, not executed returns. Actual recorded entry quote; assumed exit costs. No automatic promotion.'};
}
export function qualityShadow(seed,c,entry,policy){
 const x=qualityFeatures(seed,c,entry);if(!x||policy?.version!=='fast-quality-study-v1')return {available:false,affectsLiveSelection:false};
 const score=qualityScore(policy.model,x),decisions={};
 for(const rule of policy.rules??[]){const v=rule.feature==='score'?score:x[qualityNames.indexOf(rule.feature)];decisions[rule.id]=Number.isFinite(v)?(rule.operator==='lte'?v<=rule.threshold:v>=rule.threshold):null;}
 return {available:true,policyVersion:policy.version,policyFrozenAt:policy.frozenAt,features:Object.fromEntries(qualityNames.map((name,i)=>[name,x[i]])),score,calibrated:false,decisions,mode:'shadow',affectsLiveSelection:false};
}
