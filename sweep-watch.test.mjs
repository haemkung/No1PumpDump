import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
import {runSweepWatch} from './sweep-watch.mjs';
const testRoot=fileURLToPath(new URL('./.sweep/',import.meta.url));await mkdir(testRoot,{recursive:true});
const t=Math.floor(Date.now()/60000)*60000,now=t+10000,baseSeed={id:'seed',version:'sweep-reclaim-v9',provider:'binance-futures',symbol:'TESTUSDT',side:'SHORT',seededAt:new Date(t-180000).toISOString(),level:100,atr14:2,quality:{total:90},features:{volumeRatio:3,closeStrength:.7}};
for(const scenario of ['momentum','approved','groqApproved','rejected','deliveryUnknown','oppositeBTC','stale','gap','postPrice','held']){
 const folder=await mkdtemp(join(testRoot,'test-')),dir=pathToFileURL(folder+'/');let state={watch:{},done:{},journal:{},count:0},caption=null,sends=0,ai=0,quotes=0;
 if(scenario==='gap')state.lastAttemptAt=new Date(now-1000).toISOString();
 const seed=scenario==='stale'?{...baseSeed,seededAt:new Date(t-300000).toISOString()}:baseSeed;
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
 const fetchImpl=async(url,options={})=>{url=String(url);let body;try{body=JSON.parse(options.body);}catch{}
 if(url.endsWith('/getChat'))return response({ok:true,result:{pinned_message:{document:{file_name:'no1-monitor-state.json',file_id:'MAIN'}}}});
 if(url.endsWith('/getFile'))return response({ok:true,result:{file_path:body.file_id}});
 if(url.endsWith('/MAIN'))return response(scenario==='momentum'?{sweepStateMessageId:321,momentumSeeds:{'binance-futures':[{...seed,mode:'momentum',expiresAt:now+60000}]}}:{sweepStateMessageId:321,sweepSeeds:{seed}});
 if(url.endsWith('/SWEEP'))return response(state);
 if(url.endsWith('/editMessageCaption')){if(scenario==='held'||caption===body.caption)return response({ok:false,description:'message is not modified'},400);caption=body.caption;return response({ok:true,result:{document:{file_name:'no1-sweep-state.json',file_id:'SWEEP'}}});}
 if(url.endsWith('/editMessageMedia')){assert.equal(JSON.parse(options.body.get('media')).caption,caption);state=JSON.parse(await options.body.get('state').text());return response({ok:true});}
 if(url.endsWith('/sendMessage')){sends++;assert.equal(state.journal[Object.keys(state.journal)[0]].status,'delivery_pending','Persist attempt before sending');assert.match(body.text,scenario==='momentum'?/Momentum 1 นาที/:/ปิดกลับ 2 แท่ง/);if(scenario==='deliveryUnknown')return response({ok:false},503);return response({ok:true,result:{message_id:999,date:Math.floor(now/1000)}});}
 if(url.includes('interval=1m')&&scenario==='momentum')return response(Array.from({length:21},(_,i)=>{
   const time=t-(21-i)*60000;
   return i===20?[time,99.4,99.6,98.95,99,250,time+59999]:[time,99.5,99.8,99.3,99.5,100,time+59999];
 }));
 if(url.includes('interval=1m')){const start=scenario==='stale'?t-300000:t-180000;return response(Array.from({length:5},(_,i)=>[start+i*60000,99,i===0?101:100,98,99,100,start+(i+1)*60000-1]));}
 if(url.includes('/klines?'))return response(Array.from({length:40},(_,i)=>{let close=105-i*.15;if(scenario==='oppositeBTC'&&url.includes('symbol=BTCUSDT'))close=95+i*.15;const time=t-(40-i)*900000;return [time,close,close+1,close-1,close,100,time+899999];}));
 if(url.includes('/ticker/bookTicker')){quotes++;return response({bidPrice:scenario==='postPrice'&&quotes>1?99.9:99,askPrice:scenario==='postPrice'&&quotes>1?99.91:99.01});}
 if(url.includes('api.groq.com')){assert.equal(options.method,'POST');assert.equal(body.model,'openai/gpt-oss-120b');assert.equal(body.response_format.type,'json_schema');assert.ok(body.messages.some(m=>m.role==='user'));ai++;return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify({approve:true,reason:'fixture Groq',runnerPotential:'unclear',runnerReason:'fixture'})}}]});}
 if(url.includes('generativelanguage.googleapis.com')){assert.equal(options.method,'POST');assert.equal(typeof options.body,'string');assert.equal(body.contents[0].role,'user');const evidence=JSON.parse(body.contents[0].parts[0].text).confirmation;
 if(scenario==='momentum'){assert.ok(evidence.breakoutCandle.close<evidence.priorRange.bottom);assert.equal(evidence.volumeRatio,2.5);}else{
 assert.equal(evidence.reclaimCandles.length,2);
 assert.equal(evidence.reclaimCandles[1].time-evidence.reclaimCandles[0].time,60000);
 assert.equal(evidence.reclaimCandles[1].end,evidence.confirmedAt);
 assert.ok(evidence.sweepCandle.high>100);
 assert.ok(evidence.reclaimCandles.every(bar=>bar.close<100));}ai++;return response({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({approve:scenario!=='rejected',reason:'fixture',runnerPotential:'unclear',runnerReason:'fixture'})}]}}]});}
 throw Error('Unexpected isolated sweep request');};
 try{const options={env:{TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_CHAT_ID:'test-chat',GEMINI_API_KEY:'test-key',GROQ_API_KEY:scenario==='groqApproved'?'test-groq':'',MONITOR_ORIGIN:'local'},fetchImpl,clock:()=>now,dir};const result=await runSweepWatch(options);
 const delivery=['momentum','approved','groqApproved','deliveryUnknown'].includes(scenario);assert.equal(sends,delivery?1:0);assert.equal(ai,['momentum','approved','groqApproved','rejected','deliveryUnknown','postPrice'].includes(scenario)?1:0);
 if(delivery){const record=Object.values(state.journal)[0];assert.equal(record.strategyVersion,scenario==='momentum'?'momentum-v1':'sweep-reclaim-v9');assert.equal(record.status,['momentum','approved','groqApproved'].includes(scenario)?'sent':'delivery_unknown');assert.ok(state.lastAttemptAt);assert.equal(state.done.seed.status,'delivery_attempted');}
 if(scenario==='rejected'){assert.equal(state.done.seed.review.reason,'fixture');assert.ok(state.done.seed.review.model);}
 if(scenario==='held')assert.equal(result.skipped,true);
 if(scenario==='approved'){const again=await runSweepWatch(options);assert.equal(again.skipped,true);assert.equal(sends,1,'Same minute must not deliver twice');}
 }finally{assert.ok(resolve(folder).startsWith(resolve(testRoot)+sep));await rm(folder,{recursive:true,force:true});}
}
console.log('Sweep watch integration passed: approval/rejection, BTC veto, stale/gap/price guards, atomic ownership and delivery ambiguity');
