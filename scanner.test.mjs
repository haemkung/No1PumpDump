import assert from 'node:assert/strict';
const originalFetch=globalThis.fetch, originalEnv={...process.env},originalNow=Date.now;
const testNow=Math.floor(originalNow()/900000)*900000+60000;
Date.now=()=>testNow;
try{
  process.env.TELEGRAM_BOT_TOKEN='test-token';process.env.TELEGRAM_CHAT_ID='test-chat';process.env.GEMINI_API_KEY='test-key';
  for(const scenario of ['stale','rejected','unavailable','quiet','approved','held','late']){
    Date.now=()=>testNow+(scenario==='late'?600000:0);
    const now=Date.now(), end=now-(scenario==='stale'?240000:60000);
    const candles=Array.from({length:20},(_,i)=>({time:end-899999-(21-i)*900000,high:100,low:98,close:99,volume:100}));
    candles.push({time:end-899999-900000,high:102,low:99,close:101,volume:160},{time:end-899999,high:101,low:99.8,close:100.5,volume:100});
    const state={day:new Date(now+7*3600000).toISOString().slice(0,10),count:49,sent:{},aiVerified:true,cloudStarted:true,lastRun:new Date(now-4*3600000).toISOString(),...(scenario==='quiet'?{lastHeartbeat:new Date(now).toISOString()}:{} )};
    let saved, aiCalls=0, messages=0, signals=0,marketReads=0,claimedCaption;
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
    globalThis.fetch=async (url,options={})=>{
      url=String(url);
      if(url.endsWith('/getChat'))return reply({ok:true,result:{pinned_message:{message_id:1,document:{file_name:'no1-monitor-state.json',file_id:'test-file'}}}});
      if(url.endsWith('/editMessageCaption')){claimedCaption=JSON.parse(options.body).caption;return scenario==='held'?reply({ok:false,description:'Bad Request: message is not modified'},400):reply({ok:true});}
      if(url.includes('/getFile?'))return reply({ok:true,result:{file_path:'private-test-state'}});
      if(url.includes('/file/bottest-token/'))return reply(state);
      if(url.endsWith('/editMessageMedia')){assert.equal(JSON.parse(options.body.get('media')).caption,claimedCaption,'state saves must retain the shared slot lock');saved=JSON.parse(await options.body.get('state').text());return reply({ok:true});}
      if(url.endsWith('/sendMessage')){messages++;const text=JSON.parse(options.body).text;assert.ok(text.includes('\n'),'messages must contain real line breaks');assert.ok(!text.includes('\\n'),'do not send literal backslash-n');if(text.startsWith('สัญญาณทดลอง')){signals++;assert.equal(scenario,'approved');}else assert.match(text,/รายงานระบบ No1/);return reply({ok:true});}
      if(url.endsWith('/tickers')){marketReads++;return reply({tickers:[
        {symbol:'PF_TESTUSD',tag:'perpetual',volumeQuote:2000000,bid:100.48,ask:100.5},
        {symbol:'PF_OTHERUSD',tag:'perpetual',volumeQuote:25000000,bid:100.48,ask:100.5},
        {symbol:'PF_THINUSD',tag:'perpetual',volumeQuote:500000,bid:100.48,ask:100.5}]});}
      if(url.includes('/api/charts/'))return reply({candles});
      if(url.includes('generativelanguage.googleapis.com')){aiCalls++;if(scenario==='unavailable')return reply({},429);return reply({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({approve:scenario==='approved',reason:'test review'})}]}}]});}
      throw Error('Unexpected request in isolated test');
    };
    await import('./scanner.mjs?test='+scenario);
    if(scenario==='held'||scenario==='late'){assert.equal(saved,undefined,'losing or late runner must not overwrite shared quota');assert.equal(aiCalls,0);assert.equal(messages,0);assert.equal(marketReads,0);continue;}
    assert.equal(saved.scanned,2,'include $2M market and exclude $0.5M market');
    assert.equal(saved.lastResult.sent,scenario==='approved'?1:0,'only approved fresh setup may become a signal');
    assert.equal(signals,scenario==='approved'?1:0);
    assert.equal(saved.count,scenario==='stale'?49:50,'persist quota before request and never exceed 50');
    assert.equal(aiCalls,scenario==='stale'?0:1);
    assert.equal(messages,scenario==='quiet'?0:scenario==='approved'?2:1,'status heartbeat must be throttled');
    if(scenario==='stale')assert.equal(saved.lastResult.stale,2);
    if(scenario==='rejected')assert.equal(saved.lastResult.aiRejected,1);
    if(scenario==='unavailable'){assert.equal(saved.lastResult.aiUnavailable,1);assert.equal(saved.error,'partial_failure');}
  }
}finally{
  globalThis.fetch=originalFetch;
  Date.now=originalNow;
  for(const key of ['TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','GEMINI_API_KEY']){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}
}
console.log('PASS: wider coverage, stale rejection, AI rejection/outage, daily cap, heartbeat throttling');
