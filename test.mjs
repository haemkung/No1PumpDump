import assert from 'node:assert/strict';
import {findSignal} from './strategy.mjs';
const bars=Array.from({length:20},(_,i)=>({time:i*900000,high:100,low:98,close:99,volume:100}));
bars.push({time:18000000,high:102,low:99,close:101,volume:160},{time:18900000,high:101,low:99.8,close:100.5,volume:100});
assert.equal(findSignal(bars).side,'LONG');bars.at(-2).volume=149;assert.equal(findSignal(bars),null);bars.at(-2).volume=160;bars.at(-1).close=99;assert.equal(findSignal(bars),null);
bars[20]={time:18000000,high:99,low:96,close:97,volume:160};bars[21]={time:18900000,high:98.2,low:96,close:97.5,volume:100};assert.equal(findSignal(bars).side,'SHORT');bars[21].time+=900000;assert.equal(findSignal(bars),null);console.log('PASS: long/short, weak volume, invalid retest, missing candle');
