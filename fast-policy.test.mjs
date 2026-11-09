import assert from 'node:assert/strict';
import {fastReversalEntry,checkFastQuote} from './fast-reversal.mjs';
const t=1800000000000,confirmation={status:'confirmed',confirmedAt:t,reference:100};
const context={available:true,direction:1},benchmark={available:true,direction:0};
for(const side of ['LONG','SHORT']){
 const seed={side,level:side==='LONG'?99:101};
 let now=t+1000,calls=0;
 const options={seed,confirmation,context,benchmark,clock:()=>now,deadline:t+45000,sleep:async ms=>{now+=ms;},initialBook:{bidPrice:99.8,askPrice:100.2},quote:async()=>{calls++;return {bidPrice:99.99,askPrice:100.01};}};
 const recovered=await checkFastQuote(options);assert.equal(recovered.pass,true);assert.equal(calls,1);assert.equal(recovered.quoteAttempts[0].reason,'quote_spread');assert.equal(recovered.quoteAttempts.length,2);
 const opposing={available:true,direction:side==='LONG'?-1:1};
 const blocked=fastReversalEntry(seed,confirmation,99.99,100.01,context,opposing,now);assert.equal(blocked.pass,false);assert.equal(blocked.reason,'opposing_btc_trend');assert.equal(blocked.btcContextChallenger.pass,true);assert.equal(blocked.btcContextChallenger.affectsLiveSelection,false);
 const drift=fastReversalEntry(seed,confirmation,100.5,100.51,context,benchmark,now);assert.equal(drift.reason,'reference_drift');
 const lost=fastReversalEntry(seed,confirmation,side==='LONG'?98:102,side==='LONG'?98.01:102.01,context,benchmark,now);assert.equal(lost.reason,'reclaim_lost');
 calls=0;now=t+44500;const stale=await checkFastQuote({...options,deadline:t+100000,sleep:async()=>{now=t+45001;},quote:async()=>{calls++;return {bidPrice:99.99,askPrice:100.01};}});assert.equal(stale.pass,false);assert.equal(stale.reason,'stale_confirmation');assert.equal(calls,0);
 now=t+1000;calls=0;const spread=await checkFastQuote({...options,quote:async()=>{calls++;return options.initialBook;}});assert.equal(spread.pass,false);assert.equal(calls,2);
 const failed=await checkFastQuote({...options,quote:async()=>{throw Error('offline');}});assert.equal(failed.reason,'quote_unavailable');
 const invalid=fastReversalEntry(seed,confirmation,NaN,100,context,benchmark,now);assert.equal(invalid.reason,'invalid_quote');
}
console.log('Fast policy passed: long/short retry, BTC shadow, expiry, price guards and failed quote');
