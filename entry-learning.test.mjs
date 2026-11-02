import assert from 'node:assert/strict';
import {entryLearningEvidence,learningEvidenceText} from './entry-learning.mjs';
import {FEATURES} from './ml-model.mjs';
const now=Date.parse('2026-11-02T10:00:00Z'),model={version:'fixture',trainedAt:new Date(now-1000).toISOString(),trainingCount:64,featureNames:FEATURES,scale:[1,1,1,1],mean:[0,0,0,0],weights:[0,0,0,0],bias:0};
const candidate={side:'LONG',entry:100,stop:99,features:{volumeRatio:2,closeStrength:.8}};
const row=(id,kind,overrides={})=>({...candidate,id,provider:'binance-futures',status:'sent',sentAt:new Date(now-14400001).toISOString(),label:{kind,target:kind==='TP'?1:0},...overrides});
const rows=[row('tp','TP'),row('sl','SL'),row('none','no_touch_4h'),row('future','TP',{sentAt:new Date(now-60000).toISOString()}),row('other-side','TP',{side:'SHORT'}),row('other-provider','TP',{provider:'kraken-futures'}),row('unknown','unlabelled')];
const e=entryLearningEvidence(rows,model,candidate,now);assert.equal(e.nearbyCases,3);assert.deepEqual([e.tpBeforeStop,e.stopBeforeTp,e.noTouch],[1,1,1]);assert.equal(e.rawModelScore,.5);assert.equal(e.affectsLiveSelection,true);assert.match(learningEvidenceText(e),/เทียบ 3/);
assert.equal(entryLearningEvidence(rows,{...model,trainedAt:new Date(now+1).toISOString()},candidate,now).available,false,'Future-trained models cannot confirm an earlier entry');
assert.equal(entryLearningEvidence(rows,{...model,scale:[0,1,1,1]},candidate,now).available,false);
console.log('Entry learning passed: mature past-only same-side/provider evidence, no calibrated-win claim, model validation');

assert.equal(entryLearningEvidence(rows,{...model,weights:null},candidate,now).available,false,'Malformed model must not crash the scanner');
