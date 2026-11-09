import {qualityNames} from './fast-quality.mjs';
import {writeFile} from 'node:fs/promises';
import {ENTRY_FEATURES} from './entry-model-features.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
import {runSweepWatch} from './sweep-watch.mjs';
const testRoot=fileURLToPath(new URL('./.sweep/',import.meta.url));await mkdir(testRoot,{recursive:true});
const t=Math.floor(Date.now()/60000)*60000,now=t+10000,baseSeed={id:'seed',version:'sweep-reclaim-v9',provider:'binance-futures',symbol:'TESTUSDT',side:'SHORT',seededAt:new Date(t-180000).toISOString(),level:100,atr14:2,quality:{total:90},features:{volumeRatio:3,closeStrength:.7}};
for(const testCase of ['fastReversalSpreadRecovery','fastReversalBtcShadow','fastReversalGap','fastReversalBlocked','fastReversal','mlTie','momentum','approved','groqApproved','rejected','deliveryUnknown','oppositeBTC','stale','gap','postPrice','held']){
 const scenario=testCase.startsWith('fastReversal')?'fastReversal':testCase;
 const blocked=testCase==='fastReversalBlocked';
 const folder=await mkdtemp(join(testRoot,'test-')),dir=pathToFileURL(folder+'/watch/');let state={watch:{},done:{},journal:{},count:0},caption=null,sends=0,ai=0,quotes=0;
 if(scenario==='fastReversal')await writeFile(join(folder,'fast-quality-policy.json'),JSON.stringify({version:'fast-quality-study-v1',model:{featureNames:qualityNames,mean:Array(6).fill(0),scale:Array(6).fill(1),weights:Array(6).fill(0),bias:0},rules:[{id:'reject_everything',feature:'score',operator:'gte',threshold:1}]}));
 if(testCase==='fastReversalGap'||blocked)state.lastAttemptAt=new Date(now-(blocked?59999:60000)).toISOString();
 if(scenario==='gap')state.lastAttemptAt=new Date(now-1000).toISOString();
 const seed=scenario==='stale'?{...baseSeed,seededAt:new Date(t-300000).toISOString()}:baseSeed;
 if(scenario==='mlTie'){
   await mkdir(join(folder,'.ml'));
   await writeFile(join(folder,'.ml','entry-model-v9.json'),JSON.stringify({
     version:'test-model',trainedAt:new Date(now-60000).toISOString(),trainingCount:23,
     featureNames:ENTRY_FEATURES,mean:Array(8).fill(0),scale:Array(8).fill(1),weights:[1,0,0,0,0,0,0,0],bias:0
   }));
 }
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
 const fetchImpl=async(url,options={})=>{url=String(url);let body;try{body=JSON.parse(options.body);}catch{}
 if(url.endsWith('/getChat'))return response({ok:true,result:{pinned_message:{document:{file_name:'no1-monitor-state.json',file_id:'MAIN'}}}});
 if(url.endsWith('/getFile'))return response({ok:true,result:{file_path:body.file_id}});
 if(url.endsWith('/MAIN')&&scenario==='fastReversal')return response({sweepStateMessageId:321});
 if(url.endsWith('/MAIN'))return response(scenario==='momentum'?{sweepStateMessageId:321,momentumSeeds:{'binance-futures':[{...seed,mode:'momentum',expiresAt:now+60000}]}}:{sweepStateMessageId:321,sweepSeeds:scenario==='mlTie'?{seed,second:{...seed,id:'second',symbol:'SECONDUSDT',features:{...seed.features,volumeRatio:6}}}:{seed}});
 if(url.endsWith('/SWEEP'))return response(state);
 if(url.endsWith('/editMessageCaption')){if(scenario==='held'||caption===body.caption)return response({ok:false,description:'message is not modified'},400);caption=body.caption;return response({ok:true,result:{document:{file_name:'no1-sweep-state.json',file_id:'SWEEP'}}});}
 if(url.endsWith('/editMessageMedia')){assert.equal(JSON.parse(options.body.get('media')).caption,caption);state=JSON.parse(await options.body.get('state').text());return response({ok:true});}
 if(url.endsWith('/sendMessage')){sends++;assert.equal(state.journal[Object.keys(state.journal)[0]].status,'delivery_pending','Persist attempt before sending');assert.match(body.text,scenario==='fastReversal'?/กลับตัวเร็ว 1 นาที/:scenario==='momentum'?/Momentum 1 นาที/:/ปิดกลับ 2 แท่ง/);if(scenario==='fastReversal'){assert.doesNotMatch(body.text,/Stop|2R|TP|SL/);assert.match(body.text,/ราคาอ้างอิง 102.6/);}if(scenario==='deliveryUnknown')return response({ok:false},503);return response({ok:true,result:{message_id:999,date:Math.floor(now/1000)}});}
 if(url.endsWith('/exchangeInfo'))return response({symbols:[{symbol:'TESTUSDT',status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USDT',underlyingType:'COIN'}]});
 if(url.endsWith('/fapi/v1/time'))return response({serverTime:now});
 if(url.includes('limit=23')&&scenario==='fastReversal')return response(Array.from({length:22},(_,i)=>{
   const time=t-(22-i)*60000;
   const data=i===20?[103.48,103.56,100.48,100.84,392000,130536]:
     i===21?[100.84,103.32,100.8,102.6,183000,127734]:[103,108.4,102.16,103,120000,60000];
   const [open,high,low,close,quote,buy]=data;
   return [time,open,high,low,close,100,time+59999,quote,1,0,buy];
 }));
 if(url.includes('interval=1m')&&scenario==='momentum')return response(Array.from({length:21},(_,i)=>{
   const time=t-(21-i)*60000;
   return i===20?[time,99.4,99.6,98.95,99,250,time+59999]:[time,99.5,99.8,99.3,99.5,100,time+59999];
 }));
 if(url.includes('interval=1m')){const start=scenario==='stale'?t-300000:t-180000;return response(Array.from({length:5},(_,i)=>[start+i*60000,99,i===0?101:100,98,99,100,start+(i+1)*60000-1]));}
 if(url.includes('/klines?'))return response(Array.from({length:40},(_,i)=>{let close=105-i*.15;if(['oppositeBTC','fastReversal'].includes(scenario)&&testCase!=='fastReversalBtcShadow'&&url.includes('symbol=BTCUSDT'))close=95+i*.15;const time=t-(40-i)*900000;return [time,close,close+1,close-1,close,100,time+899999];}));
 if(url.includes('/ticker/bookTicker')){quotes++;if(scenario==='fastReversal')return response(testCase==='fastReversalSpreadRecovery'&&quotes===1?{bidPrice:102.4,askPrice:102.6}:{bidPrice:102.59,askPrice:102.6});return response({bidPrice:scenario==='postPrice'&&quotes>1?99.9:99,askPrice:scenario==='postPrice'&&quotes>1?99.91:99.01});}
 if(url.includes('api.groq.com')){assert.equal(options.method,'POST');assert.equal(body.model,'openai/gpt-oss-120b');assert.equal(body.response_format.type,'json_schema');assert.ok(body.messages.some(m=>m.role==='user'));ai++;return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify({approve:true,reason:'fixture Groq',runnerPotential:'unclear',runnerReason:'fixture'})}}]});}
 if(url.includes('generativelanguage.googleapis.com')){assert.equal(options.method,'POST');assert.equal(typeof options.body,'string');assert.equal(body.contents[0].role,'user');const evidence=JSON.parse(body.contents[0].parts[0].text).confirmation;
 if(scenario==='fastReversal'){assert.ok(evidence.shockCandle.low<evidence.priorRangeLevel);assert.ok(evidence.bounceCandle.close>evidence.priorRangeLevel);}else if(scenario==='momentum'){assert.ok(evidence.breakoutCandle.close<evidence.priorRange.bottom);assert.equal(evidence.volumeRatio,2.5);}else{
 assert.equal(evidence.reclaimCandles.length,2);
 assert.equal(evidence.reclaimCandles[1].time-evidence.reclaimCandles[0].time,60000);
 assert.equal(evidence.reclaimCandles[1].end,evidence.confirmedAt);
 assert.ok(evidence.sweepCandle.high>100);
 assert.ok(evidence.reclaimCandles.every(bar=>bar.close<100));}ai++;return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({approve:scenario!=='rejected',reason:'fixture',runnerPotential:'unclear',runnerReason:'fixture'})}]}}]});}
 throw Error('Unexpected isolated sweep request');};
 try{const options={env:{TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_CHAT_ID:'test-chat',GEMINI_API_KEY:'test-key',GROQ_API_KEY:scenario==='groqApproved'?'test-groq':'',MONITOR_ORIGIN:'local',NO1_FAST_REVERSAL:scenario==='fastReversal'?'1':'0'},fetchImpl,clock:()=>now,dir};const result=await runSweepWatch(options);
 const delivery=!blocked&&testCase!=='fastReversalBtcShadow'&&['fastReversal','mlTie','momentum','approved','groqApproved','deliveryUnknown'].includes(scenario);assert.equal(sends,delivery?1:0);assert.equal(ai,!blocked&&testCase!=='fastReversalBtcShadow'&&['fastReversal','mlTie','momentum','approved','groqApproved','rejected','deliveryUnknown','postPrice'].includes(scenario)?1:0);
 if(delivery){const record=Object.values(state.journal)[0];assert.equal(record.strategyVersion,scenario==='fastReversal'?'fast-reversal-v1':scenario==='momentum'?'momentum-v1':'sweep-reclaim-v9');assert.equal(record.status,['fastReversal','mlTie','momentum','approved','groqApproved'].includes(scenario)?'sent':'delivery_unknown');assert.ok(state.lastAttemptAt);if(scenario==='fastReversal'){assert.equal(record.qualityShadow.decisions.reject_everything,false);assert.equal(record.qualityShadow.affectsLiveSelection,false);assert.ok(record.latency.confirmationToQuoteMs>=0);assert.equal(result.fastReversalChecked,1);assert.equal(result.fastReversalConfirmed,1);assert.equal(record.side,'LONG');assert.equal(record.stop,undefined);assert.equal(record.target,undefined);}else assert.equal(state.done[scenario==='mlTie'?'second':'seed'].status,'delivery_attempted');if(scenario==='mlTie'){assert.equal(record.symbol,'SECONDUSDT');assert.equal(record.mlExperimental.mode,'live_tiebreak');assert.equal(result.mlReordered,true);}}
 if(testCase==='fastReversalBtcShadow'){const observation=Object.values(state.fastAssessments)[0];assert.equal(observation.finalDecision,'opposing_btc_trend');assert.equal(observation.initialAssessment.btcContextChallenger.pass,true);assert.equal(sends,0);}
 if(testCase==='fastReversalSpreadRecovery'){const observation=Object.values(state.fastAssessments)[0];assert.equal(observation.initialAssessment.quoteAttempts.length,2);assert.equal(sends,1);}
 if(blocked){assert.equal(result.fastReversalChecked,1);assert.equal(result.fastReversalConfirmed,1);assert.equal(result.cooldownBlocked,1);}
 if(scenario==='rejected'){assert.equal(state.done.seed.review.reason,'fixture');assert.ok(state.done.seed.review.model);}
 if(scenario==='held')assert.equal(result.skipped,true);
 if(scenario==='approved'){const again=await runSweepWatch(options);assert.equal(again.skipped,true);assert.equal(sends,1,'Same minute must not deliver twice');}
 }finally{assert.ok(resolve(folder).startsWith(resolve(testRoot)+sep));await rm(folder,{recursive:true,force:true});}
}
console.log('Sweep watch integration passed: approval/rejection, BTC veto, stale/gap/price guards, atomic ownership and delivery ambiguity');
