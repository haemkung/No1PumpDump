import {writeFile} from 'node:fs/promises';
import {sanitizeFeed} from './public-watchlist.mjs';
const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
async function json(url,body){const r=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Unavailable');return r.json();}
try{
 const root='https://api.telegram.org/bot'+token;
 const c=await json(root+'/getChat',{chat_id:chat});
 const document=c.result?.pinned_message?.document;
 if(document?.file_name!=='no1-monitor-state.json')throw Error('Missing state');
 const f=await json(root+'/getFile',{file_id:document.file_id});
 const state=await json('https://api.telegram.org/file/bot'+token+'/'+f.result.file_path);
 const feed=sanitizeFeed(state.publicWatchlist);
 if(!feed)throw Error('Feed not ready');
 await writeFile('watchlist.json',JSON.stringify(feed,null,2)+'\n');
 console.log('Public watchlist exported; private state excluded');
}catch{console.error('Watchlist refresh deferred; existing public snapshot retained');process.exitCode=1;}
