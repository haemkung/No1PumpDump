import assert from 'node:assert/strict';
import {summarizeComparisons} from './rule-comparison.mjs';
const rows=[{assessment:{baseline:true,A:true,B:true,C:true},outcomes:{baseline:{kind:'TP',grossR:2,fundingR:.01,riskRatio:.01},C:{kind:'SL',grossR:-1,fundingR:0,riskRatio:.01}}},{assessment:{baseline:true,A:false,B:false,C:false},outcomes:{baseline:{kind:'no_touch_4h',grossR:.2,fundingR:0,riskRatio:.01}}}];
const r=summarizeComparisons(rows);assert.equal(r.baseline.observed,2);assert.equal(r.baseline.timedOut,1);assert.equal(r.baseline.grossR,2.2);assert.equal(r.A.pending,1);assert.equal(r.C.sl,1);assert.equal(r.C.netCostScenarios['10bps_roundtrip'],-1.1);assert.ok(Math.abs(r.baseline.netCostScenarios['10bps_roundtrip']-1.99)<1e-12);
console.log('Prospective comparison passed: distinct cohorts, pending/timeout and funding/cost accounting');
