import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {binanceSymbols} from './market-data.mjs';
export function mergeClosed(previous,rows,now){
 const m=new Map();for(const r of [...previous,...rows])if(Array.isArray(r)&&[0,1,2,3,4,6,7,10].every(i=>Number.isFinite(Number(r[i])))&&+r[6]===+r[0]+59999&&+r[6]<now)m.set(+r[0],r.map(Number));
 return [...m.values()].sort((a,b)=>a[0]-b[0]).slice(-24);
}
export function usableBars(rows,candleTime){
 if(!Array.isArray(rows))return null;const a=rows.filter(r=>+r[0]<=candleTime).slice(-22);
 return a.length===22&&+a.at(-1)[0]===candleTime&&a.every((r,i)=>+r[6]===+r[0]+59999&&(!i||+r[0]===+a[i-1][0]+60000))?a:null;
}
export async function streamMain(){
 const dir=new URL('./.sweep/',import.meta.url);await mkdir(dir,{recursive:true});let symbols=[],bars={},ws,connected=false,lastEventAt=0,reconnects=0,errors=0,saving=false,closed=false,pauseUntil=0;
 const pending=new Set();
 try{const saved=JSON.parse(await readFile(new URL('fast-stream.json',dir),'utf8'));bars=saved.bars??{};}catch{}
 const json=async url=>{if(Date.now()<pauseUntil)throw Error('backoff');const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(r.status===429||r.status===418||Number(r.headers.get('x-mbx-used-weight-1m'))>=1500)pauseUntil=Math.ceil(Date.now()/60000)*60000+1500;if(!r.ok)throw Error('market unavailable');return r.json();};
 const status=()=>({pid:process.pid,connected,universe:symbols.length,currentClosed:symbols.filter(s=>usableBars(bars[s],Math.floor(Date.now()/60000)*60000-60000)).length,lastEventAt,reconnects,errors,checkedAt:Date.now()});
 const save=async()=>{if(saving)return;saving=true;try{const p=new URL('fast-stream.json',dir),tmp=new URL('fast-stream.json.tmp',dir);await writeFile(tmp,JSON.stringify({version:1,...status(),symbols,bars}));await rename(tmp,p);}catch{errors++;}finally{saving=false;}};
 const server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/health'){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(status()));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(18742,'127.0.0.1',resolve);});
 const hydrate=async symbol=>{if(pending.has(symbol)||Date.now()<pauseUntil)return;pending.add(symbol);try{const r=await json('https://fapi.binance.com/fapi/v1/klines?symbol='+encodeURIComponent(symbol)+'&interval=1m&limit=24');bars[symbol]=mergeClosed(bars[symbol]??[],r,Date.now());}catch{errors++;}finally{pending.delete(symbol);}};
 const connect=()=>{
  if(closed)return;ws=new WebSocket('wss://fstream.binance.com/market/ws');
  ws.onopen=async()=>{connected=true;for(let i=0;i<symbols.length&&ws.readyState===1;i+=100){ws.send(JSON.stringify({method:'SUBSCRIBE',params:symbols.slice(i,i+100).map(s=>s.toLowerCase()+'@kline_1m'),id:i+1}));await new Promise(r=>setTimeout(r,300));}await save();};
  ws.onmessage=event=>{let e;try{e=JSON.parse(event.data);}catch{return;}const k=e?.k;if(!k||k.x!==true||!symbols.includes(k.s))return;lastEventAt=Date.now();const r=[+k.t,+k.o,+k.h,+k.l,+k.c,+k.v,+k.T,+k.q,+k.n,+k.V,+k.Q];bars[k.s]=mergeClosed(bars[k.s]??[],[r],Date.now());if(!usableBars(bars[k.s],+k.t))void hydrate(k.s);void save();};
  ws.onerror=()=>{errors++;};ws.onclose=()=>{connected=false;reconnects++;void save();if(!closed)setTimeout(connect,3000);};
 };
 const refresh=async()=>{try{const exchange=await json('https://fapi.binance.com/fapi/v1/exchangeInfo');symbols=binanceSymbols(exchange);bars=Object.fromEntries(symbols.filter(s=>bars[s]).map(s=>[s,bars[s]]));await save();if(ws)ws.close();else connect();let next=0;await Promise.all(Array.from({length:8},async()=>{while(next<symbols.length){const s=symbols[next++];if(!usableBars(bars[s],Math.floor(Date.now()/60000)*60000-60000))await hydrate(s);}}));await save();}catch{errors++;}};
 await refresh();setInterval(()=>void save(),3000);setInterval(()=>void refresh(),3600000);
 setInterval(()=>{let count=0;for(const s of symbols)if(count<8&&!usableBars(bars[s],Math.floor(Date.now()/60000)*60000-60000)){count++;void hydrate(s);}},10000);
 const stop=()=>{closed=true;ws?.close();server.close();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)streamMain().catch(()=>{console.error('Fast stream unavailable; REST scanner remains available');process.exitCode=1;});
