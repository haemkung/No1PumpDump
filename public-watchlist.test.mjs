import assert from 'node:assert/strict';
import {publicWatchlist,sanitizeFeed} from './public-watchlist.mjs';
const at='2026-11-08T19:33:19Z';
const data=publicWatchlist({lastCheck:at,token:'SECRET',done:{'momentum-v1-binance-futures-EVAAUSDT-LONG-123':{status:'reclaim_lost_or_chase',at,review:{reason:'PRIVATE'}},sent:{status:'delivery_attempted',at},fast:{symbol:'ONUSDT',side:'LONG',provider:'binance-futures',status:'quote_spread',at}}});
assert.equal(data.items.length,2);assert.equal(data.items[0].symbol,'EVAAUSDT');assert.doesNotMatch(JSON.stringify(data),/SECRET|PRIVATE|review|token/);
assert.equal(sanitizeFeed({checkedAt:at,items:[{...data.items[0],symbol:'<script>'}]}).items.length,0);
assert.equal(sanitizeFeed({checkedAt:'bad',items:[]}),null);
assert.equal(publicWatchlist({lastCheck:'2026-11-10T00:00:00Z',done:{'momentum-v1-binance-futures-XUSDT-LONG-123':{at,status:'ai_rejected'}}}).items.length,0);
console.log('Public watchlist passed: only approved fields, expired history and no private state');
