import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=await mkdtemp(join(tmpdir(),'early-watch-test-'));
try{
 const bootstrap=join(root,'mock.mjs');
 await writeFile(bootstrap,`const RealDate=Date;const fixed=RealDate.parse(process.env.TEST_MODE==='restore'?'2026-11-01T17:01:00Z':'2026-11-01T06:00:00Z');globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};const now=Date.now(),t=Math.floor(now/60000)*60000;let sent=0;
 const b=Array.from({length:22},(_,i)=>[t+(i-22)*60000,100.2,100.5,100,100.1,100,t+(i-21)*60000-1]);
 b[20]=[t-120000,100.1,100.1,99.8,99.95,250,t-60001];b[21]=[t-60000,99.95,100.3,99.95,100.3,120,t-1];
 globalThis.fetch=async(url)=>{let data;
 if(url.includes('exchangeInfo'))data={symbols:[{symbol:'TESTUSDT',status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USDT',underlyingType:'COIN'}]};
 else if(url.endsWith('/time'))data={serverTime:now};else if(url.includes('/klines'))data=b;
 else if(url.includes('bookTicker'))data={bidPrice:'100.29',askPrice:'100.3'};
 else if(url.includes('generateContent')){if(process.env.TEST_MODE==='outage')return new Response('',{status:429});data={candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({approve:process.env.TEST_MODE!=='reject',reason:'รูปแบบทดลอง',confidence:process.env.TEST_MODE==='restore'?'high':'medium'})}]}}]};}
 else if(url.endsWith('/getChat'))data={ok:true,result:{pinned_message:{document:{file_name:'no1-monitor-state.json',file_id:'fixture'}}}};
 else if(url.includes('/getFile?'))data={ok:true,result:{file_path:'fixture-state'}};
 else if(url.includes('/file/bot'))data={journal:{}};
 else if(url.includes('sendMessage')){if(process.env.TEST_MODE!=='restore')throw Error('Early-watch notifications must remain disabled');data={ok:true,result:{date:Math.floor(now/1000),message_id:123}};}
 else throw Error('Unexpected network destination');return new Response(JSON.stringify(data),{status:200});};`);
 for(const mode of ['approve','reject','outage','uncertain','restore']){
  const stateDir=join(root,mode),args=['--import',pathToFileURL(bootstrap).href,fileURLToPath(new URL('./early-watch.mjs',import.meta.url))];
  const env={...process.env,TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_CHAT_ID:'test-only',GEMINI_API_KEY:'test-only',EARLY_WATCH_STATE_DIR:stateDir,TEST_MODE:mode};
  const result=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);
  const state=JSON.parse(await readFile(join(stateDir,'state.json'),'utf8')),rows=Object.values(state.journal);
  if(mode==='approve'||mode==='uncertain'||mode==='restore'){
   assert.equal(rows.length,1);if(mode==='restore'){assert.equal(rows[0].status,'watch_sent');assert.equal(rows[0].aiAssessment,'high');assert.ok(rows[0].sentAt);}else{assert.equal(rows[0].status,'watch_observed');assert.ok(rows[0].observedAt);assert.equal(rows[0].sentAt,undefined);}
   const repeat=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:20000});assert.equal(repeat.status,0,repeat.stderr);
   const again=JSON.parse(await readFile(join(stateDir,'state.json'),'utf8'));assert.equal(again.aiCount,1,'Sent/uncertain alert must not be sent or reviewed again');
  }else assert.equal(rows.length,0,'Rejected/unavailable AI must not send a watch');
 }
 console.log('Early watch integration passed: silent approved observations, rejected/outage/dedup, no fake delivery');
}finally{await rm(root,{recursive:true,force:true});}
