import assert from 'node:assert/strict';
import {sweepConfirmation,sweepEntry} from './sweep-reclaim.mjs';
const t=Date.parse('2026-11-03T00:00:00Z'),seed={side:'SHORT',level:100,atr14:2,seededAt:new Date(t).toISOString()},b=(i,h,c)=>({time:t+i*60000,end:t+(i+1)*60000-1,high:h,low:c-1,close:c});
const bars=[b(0,101,99),b(1,100,99)];const c=sweepConfirmation(seed,bars,t+120500);assert.equal(c.status,'confirmed');assert.equal(c.confirmedAt,t+119999);assert.ok(c.stop>101);
assert.equal(sweepConfirmation(seed,bars,t+60000).status,'waiting_reclaim');assert.equal(sweepConfirmation(seed,bars,t+240000).status,'expired_confirmation');assert.notEqual(sweepConfirmation(seed,[b(0,101,99),b(2,100,99)],t+181000).status,'confirmed','Missing minute must break consecutive closes');
const ctx={available:true,atr:2,return30m:-.02},btc={available:true,direction:-1,return30m:-.01};assert.equal(sweepEntry(seed,c,99,99.01,ctx,btc,t+120500).pass,true);assert.equal(sweepEntry(seed,c,99,99.01,ctx,{...btc,direction:1},t+120500).pass,false);assert.equal(sweepEntry(seed,c,100.1,100.11,ctx,btc,t+120500).pass,false);assert.equal(sweepEntry(seed,c,99,99.01,ctx,btc,t+240000).pass,false);
const mirror=bars.map(x=>({...x,high:200-x.low,low:200-x.high,close:200-x.close})),long=sweepConfirmation({...seed,side:'LONG'},mirror,t+120500);assert.equal(long.status,'confirmed');assert.ok(long.stop<99);
console.log('Sweep rules passed: causal two-close confirmation, missing minutes, stale signal, both directions and fresh market checks');

assert.equal(sweepConfirmation(seed,[...bars,b(2,102,99)],t+180001).status,'expired_invalidated','Do not enter a confirmation whose new Stop already broke while waiting');
