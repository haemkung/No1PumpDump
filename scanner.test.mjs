import assert from 'node:assert/strict';
const originalFetch=globalThis.fetch, originalEnv={...process.env},originalNow=Date.now;
const testNow=Math.floor(originalNow()/900000)*900000+60000;
Date.now=()=>testNow;
try{
  process.env.NODE_ENV='test';process.env.TELEGRAM_BOT_TOKEN='test-token';process.env.TELEGRAM_CHAT_ID='test-chat';process.env.GEMINI_API_KEY='test-key';
  process.env.MONITOR_WATCH_MS='0';process.env.MONITOR_REVIEW_PAUSE_MS='0';
  for(const scenario of ['stale','rejected','unavailable','quiet','approved','held','late','binance','deliveryFail','over50','noTrigger','manyApproved','lowQuality','groqApproved','cloudThenLocal','closedSlotCloud','cloudHadAttempt','missingBenchmark','oppositeBenchmark']){
    process.env.MONITOR_ORIGIN=['binance','manyApproved','cloudThenLocal','cloudHadAttempt'].includes(scenario)?'local':'github';process.env.GROQ_API_KEY=scenario==='groqApproved'?'test-groq':'';
    Date.now=()=>testNow+(scenario==='late'?600000:0);
    const now=Date.now(), end=now-(scenario==='stale'?240000:60000);
    const candles=Array.from({length:20},(_,i)=>({time:end-899999-(21-i)*900000,high:100,low:98,close:99,volume:100}));
    candles.push({time:end-899999-900000,high:102,low:99,close:101,volume:scenario==='lowQuality'?160:300},{time:end-899999,high:101,low:99.8,close:100.5,volume:100});
    {const oldest=candles[0].time;candles.unshift(...Array.from({length:18},(_,i)=>({time:oldest-(18-i)*900000,high:98,low:96,close:97,volume:100})));}
    const state={day:new Date(now+7*3600000).toISOString().slice(0,10),quotaNoticeDay:new Date(now+7*3600000).toISOString().slice(0,10),count:scenario==='over50'?50:49,sent:{},aiVerified:true,cloudStarted:true,lastRunner:'github',provider:'kraken-futures',lastRun:new Date(now-4*3600000).toISOString(),...(scenario==='quiet'?{lastHeartbeat:new Date(now).toISOString()}:{} )};

    if(['cloudThenLocal','closedSlotCloud','cloudHadAttempt'].includes(scenario))state.completedSlot={slot:Math.floor(now/900000),provider:'kraken-futures',attempts:scenario==='cloudHadAttempt'?1:0};
    state.lastProviderNotice=new Date(now).toISOString();
    const minute=Array.from({length:21},(_,i)=>({time:now-1000-59999-(21-i)*60000,end:now-1000-(21-i)*60000,open:100.2,high:100.4,low:99.8,close:100.2,volume:100}));minute.push({time:now-1000-59999,end:now-1000,open:100.2,high:100.55,low:100.1,close:100.5,volume:scenario==='noTrigger'?90:160});
    let saved, aiCalls=0, messages=0, signals=0,marketReads=0,claimedCaption;
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
    globalThis.fetch=async (url,options={})=>{
      url=String(url);
      if(url.endsWith('/sendDocument'))return reply({ok:true,result:{message_id:321}});
      if(url.endsWith('/getChat'))return reply({ok:true,result:{pinned_message:{message_id:1,document:{file_name:'no1-monitor-state.json',file_id:'test-file'}}}});
      if(url.endsWith('/exchangeInfo'))return reply({symbols:(scenario==='manyApproved'?Array.from({length:8},(_,i)=>'C'+i+'USDT'):['TESTUSDT','OTHERUSDT','THINUSDT']).map(symbol=>({symbol,status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USDT',underlyingType:'COIN'}))});
      if(url.endsWith('/fapi/v1/time'))return reply({serverTime:Date.now()});
      if(url.includes('/fapi/v1/klines?'))return reply((url.includes('interval=1m')?minute:candles).map(b=>[b.time,b.open??99,b.high,b.low,b.close,b.volume,b.end??b.time+899999]));
      if(url.includes('/fapi/v1/ticker/bookTicker?'))return reply({bidPrice:100.48,askPrice:100.5});
      if(url.endsWith('/editMessageCaption')){claimedCaption=JSON.parse(options.body).caption;return scenario==='held'?reply({ok:false,description:'Bad Request: message is not modified'},400):reply({ok:true});}
      if(url.includes('/getFile?'))return reply({ok:true,result:{file_path:'private-test-state'}});
      if(url.includes('/file/bottest-token/'))return reply(state);
      if(url.endsWith('/editMessageMedia')){assert.equal(JSON.parse(options.body.get('media')).caption,claimedCaption,'state saves must retain the shared slot lock');saved=JSON.parse(await options.body.get('state').text());return reply({ok:true});}
      if(url.endsWith('/sendMessage')){messages++;const text=JSON.parse(options.body).text;assert.ok(text.includes('\n'),'messages must contain real line breaks');assert.ok(!text.includes('\\n'),'do not send literal backslash-n');if(text.startsWith('สัญญาณทดลอง')){signals++;assert.ok(['approved','deliveryFail','manyApproved','groqApproved'].includes(scenario));assert.match(text,/คะแนนคุณภาพโครงสร้าง \d{1,3}\/100/);assert.ok(text.includes('ไม่ใช่เปอร์เซ็นต์โอกาสชนะ'));assert.ok(text.includes('แท่งปิด'));assert.ok(text.includes('ตรวจยืนยัน'));}else assert.match(text,/รายงานระบบ No1|แจ้งสถานะ No1/);if(scenario==='deliveryFail'&&text.startsWith('สัญญาณทดลอง'))return reply({ok:false},503);return reply({ok:true,result:{message_id:123,date:Math.floor(Date.now()/1000)}});}
      if(url.endsWith('/tickers')){marketReads++;return reply({tickers:[
        {symbol:'PF_TESTUSD',tag:'perpetual',volumeQuote:2000000,bid:100.48,ask:100.5},
        {symbol:'PF_OTHERUSD',tag:'perpetual',volumeQuote:25000000,bid:100.48,ask:100.5},
        {symbol:'PF_THINUSD',tag:'perpetual',volumeQuote:500000,bid:100.48,ask:100.5}]});}
      if(url.includes('/api/charts/')){if(url.includes('PF_XBTUSD')&&scenario==='missingBenchmark')return reply({candles:[]});const data=url.includes('PF_XBTUSD')&&scenario==='oppositeBenchmark'?candles.map(b=>({...b,high:200-b.low,low:200-b.high,close:200-b.close})):candles;return reply({candles:url.endsWith('/1m')?minute:data});}
      if(url.includes('api.groq.com')){assert.equal(scenario,'groqApproved');aiCalls++;return reply({choices:[{finish_reason:'stop',message:{content:JSON.stringify({approve:true,reason:'test Groq review'})}}]});}
      if(url.includes('generativelanguage.googleapis.com')){const supplied=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);assert.equal(typeof supplied.learningEvidence?.available,'boolean','AI receives the learning-evidence status');aiCalls++;if(scenario==='unavailable')return reply({},429);return reply({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({approve:['approved','deliveryFail','manyApproved','groqApproved'].includes(scenario),reason:'test review',runnerPotential:scenario==='approved'?'supported':'unclear',runnerReason:'แนวโน้มและปริมาณซื้อขายมีข้อมูลรองรับ'})}]}}]});}
      throw Error('Unexpected request in isolated test');
    };
    await import('./scanner.mjs?test='+scenario);
    if(['held','late','closedSlotCloud','cloudHadAttempt'].includes(scenario)){assert.equal(saved,undefined,'losing or late runner must not overwrite shared quota');assert.equal(aiCalls,0);assert.equal(messages,0);assert.equal(marketReads,0);continue;}
    assert.equal(saved.scanned,scenario==='manyApproved'?8:['binance','cloudThenLocal'].includes(scenario)?3:2,'Binance includes thin markets; Kraken backup retains its threshold');
    if(scenario==='cloudThenLocal'){assert.match(claimedCaption,/local-followup$/);assert.equal(saved.completedSlot.provider,'binance-futures');}
    if(scenario==='binance'){assert.equal(saved.provider,'binance-futures');assert.equal(saved.lastRunner,'local');assert.equal(saved.lastResult.attempted,3);}
    assert.equal(saved.lastResult.sent,0,'Discovery scanner must no longer send direct entries');assert.equal(signals,0);assert.equal(saved.sweepStateMessageId,321);
    if(!['stale','missingBenchmark','oppositeBenchmark'].includes(scenario)){assert.ok(Object.keys(saved.sweepSeeds||{}).length>0);assert.ok(Object.values(saved.sweepSeeds).every(s=>s.version==='sweep-reclaim-v9'&&s.level>0&&s.atr14>0));}
    if(scenario==='manyApproved')assert.equal(Object.keys(saved.sweepSeeds).length,5,'Only shortlisted bases become sweep watches');
    if(['missingBenchmark','oppositeBenchmark'].includes(scenario)){assert.equal(saved.lastResult.newRuleRejected,2);assert.equal(Object.keys(saved.ruleComparisons).length,2);}
    const expectedCalls=0;
    assert.equal(aiCalls,expectedCalls);
    assert.equal(saved.count,(scenario==='over50'?50:49)+expectedCalls,'no application daily cap; attempts still recorded');
    assert.equal(messages,scenario==='quiet'?0:1,'signals plus throttled heartbeat only');
    if(scenario==='stale')assert.equal(saved.lastResult.stale,2);
    if(scenario==='rejected')assert.equal(saved.lastResult.aiRejected,0,'Discovery must defer AI review to the minute trigger');
    if(scenario==='unavailable')assert.equal(saved.lastResult.aiUnavailable,0,'AI is deferred until the sweep trigger');
  }
}finally{
  globalThis.fetch=originalFetch;
  Date.now=originalNow;
  for(const key of ['NODE_ENV','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GEMINI_API_KEY','GROQ_API_KEY','MONITOR_ORIGIN','MONITOR_WATCH_MS','MONITOR_REVIEW_PAUSE_MS']){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}
}
console.log('PASS: wider coverage, stale rejection, AI rejection/outage, no daily cap, minute confirmation, provider backoff, heartbeat throttling');
