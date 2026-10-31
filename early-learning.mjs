import {featureVector,predict} from './ml-model.mjs';
export function earlyForecast(model,record,now){
  if(model?.mode!=='shadow'||!(Date.parse(model.trainedAt)<now)||!model.fingerprint)return null;
  const estimate=predict(model,featureVector(record));if(!Number.isFinite(estimate))return null;
  return {mode:'shadow',trainedAt:model.trainedAt,recordedAt:new Date(now).toISOString(),modelFingerprint:model.fingerprint,uncalibratedEstimate:estimate,target:'early_watch_0.5R_before_invalidation_5m',affectsLiveSelection:false};
}
export function prospectiveEarlyMetrics(records){
 // Telegram dates have one-second resolution; the local pre-send timestamp preserves ordering.
 const rows=records.filter(r=>r.reaction5m&&r.mlExperimental?.target==='early_watch_0.5R_before_invalidation_5m'&&Date.parse(r.mlExperimental.trainedAt)<Date.parse(r.mlExperimental.recordedAt)&&Date.parse(r.mlExperimental.recordedAt)<=Date.parse(r.deliveryAttemptAt)&&Date.parse(r.deliveryAttemptAt)<Date.parse(r.sentAt)+1000&&Number.isFinite(r.mlExperimental.uncalibratedEstimate));
 return {n:rows.length,brier:rows.length?rows.reduce((sum,r)=>sum+(r.mlExperimental.uncalibratedEstimate-r.reaction5m.target)**2,0)/rows.length:null,mode:'prospective_shadow',affectsLiveSelection:false};
}
