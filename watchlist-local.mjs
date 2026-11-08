import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {publicWatchlist} from './public-watchlist.mjs';
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(req.headers.host!=='127.0.0.1:18741'||(origin&&origin!=='https://haemkung.github.io')){res.writeHead(403);res.end();return;}
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'https://haemkung.github.io','access-control-allow-methods':'GET, OPTIONS','access-control-allow-private-network':'true','vary':'Origin'};
 if(req.url!=='/watchlist.json'){res.writeHead(404,headers);res.end();return;}
 if(req.method==='OPTIONS'){res.writeHead(204,headers);res.end();return;}
 if(req.method!=='GET'){res.writeHead(405,headers);res.end();return;}
 try{const state=JSON.parse(await readFile(new URL('./.sweep/state.json',import.meta.url),'utf8'));const feed=publicWatchlist(state);if(!feed)throw Error();res.writeHead(200,headers);res.end(JSON.stringify(feed));}
 catch{res.writeHead(503,headers);res.end('{"error":"scanner_data_unavailable"}');}
});
server.on('error',e=>{if(e.code==='EADDRINUSE')process.exit(0);console.error('Local watchlist unavailable');process.exit(1);});
server.listen(18741,'127.0.0.1');
