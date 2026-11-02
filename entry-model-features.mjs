import {FEATURES,featureVector} from './ml-model.mjs';
export const ENTRY_FEATURES=[...FEATURES,'baseDistanceAtr','relativeReturn30m','spreadToRisk','riskAtr'];
export function entryFeatureVector(record){const base=featureVector(record),a=record.entryAssessment;if(!base||!a||!(a.atr14>0))return null;const x=[...base,a.baseDistanceAtr,a.relativeReturn30m,a.spreadToRisk,Math.abs(record.entry-record.stop)/a.atr14];return x.every(Number.isFinite)?x:null;}
