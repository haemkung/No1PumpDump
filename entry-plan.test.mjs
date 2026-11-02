import assert from 'node:assert/strict';
import {assessEntry,marketContext,entryPlan} from './entry-plan.mjs';
const bars=Array.from({length:38},()=>({high:100,low:98,close:99}));bars.push({high:102,low:99,close:101},{high:101,low:99.8,close:100.5});
const s={symbol:'ALT',side:'LONG',entry:100.5,stop:99.7002,candles:bars};const benchmark={available:true,direction:1,return30m:0};
const ok=assessEntry(s,100.48,100.5,benchmark,'BTC');assert.equal(ok.pass,true);assert.ok(ok.stop<s.stop);assert.equal(ok.target,ok.entry+2*(ok.entry-ok.stop));
assert.equal(assessEntry(s,100.48,100.5,{...benchmark,direction:-1},'BTC').reason,'market_or_relative_strength');
assert.equal(assessEntry(s,100.48,100.5,{...benchmark,return30m:1},'BTC').pass,false);
assert.equal(assessEntry(s,100.48,100.5,{available:false},'BTC').reason,'missing_context');
assert.equal(assessEntry(s,NaN,100.5,benchmark,'BTC').reason,'invalid_quote');
const extended={...s,entry:101.2,candles:bars.map((b,i)=>i===39?{...b,close:101.2}:b)};assert.equal(assessEntry(extended,101.18,101.2,benchmark,'BTC').reason,'extended_from_base');
const mirror=b=>({high:200-b.low,low:200-b.high,close:200-b.close});const short={...s,side:'SHORT',entry:99.5,stop:100.2998,candles:bars.map(mirror)};const shortPlan=assessEntry(short,99.5,99.52,{available:true,direction:-1,return30m:0},'BTC');assert.equal(shortPlan.pass,true);assert.ok(shortPlan.stop>short.stop);assert.equal(shortPlan.target,shortPlan.entry-2*(shortPlan.stop-shortPlan.entry));
assert.equal(marketContext(bars.slice(0,22)).available,false);assert.equal(entryPlan.version,'structure-regime-atr-v8');
console.log('Entry plan passed: long/short structural ATR Stops, extension, regime, relative strength and missing-context rejection');

const {entryFeatureVector,ENTRY_FEATURES}=await import('./entry-model-features.mjs');const {fit,predict}=await import('./ml-model.mjs');
const x=entryFeatureVector({...s,entryAssessment:ok,features:{volumeRatio:3,closeStrength:.7}});assert.equal(x.length,8);assert.ok(x.every(Number.isFinite));assert.equal(entryFeatureVector(s),null);
const trained=fit(Array.from({length:24},(_,i)=>({x:x.map((v,j)=>j===0?v+i/24:v),y:i>=12?1:0})),ENTRY_FEATURES);assert.ok(Number.isFinite(predict(trained,x)));assert.equal(predict(trained,x.slice(0,4)),null);
