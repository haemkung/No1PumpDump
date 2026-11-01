import {requestAIReview} from './ai-review-client.mjs';
import {reviewWithFallback} from './review-fallback.mjs';
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Service HTTP '+r.status);return r.json();}
try{
 if(!process.env.GROQ_API_KEY||!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)throw Error('Required Secrets unavailable');
 const model='groq:openai/gpt-oss-120b';
 const review=await reviewWithFallback({models:[model],state:{},request:m=>requestAIReview(m,{method:'POST',body:JSON.stringify({systemInstruction:{parts:[{text:'Assess experimental trading setups using numeric data only. Reject an empty setup; explain briefly in Thai.'}]},contents:[{role:'user',parts:[{text:'{"symbol":"TEST_ONLY","candles":[]}'}]}]})},json,{groqKey:process.env.GROQ_API_KEY})});
 if(review?.approve!==false)throw Error('Empty setup check failed');
 const text='ทดสอบ GitHub + Groq + Telegram สำเร็จ\nส่งจากเซิร์ฟเวอร์ GitHub โดยใช้ '+review.model+'\nAI ปฏิเสธข้อมูลว่างถูกต้อง ไม่มีการสแกนหรือส่งคำสั่งซื้อขายในแบบทดสอบนี้\nข้อความนี้เป็นการทดสอบการเชื่อมต่อ ไม่ใช่สัญญาณเข้าเทรด';
 const r=await json('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text})});
 if(!r.ok)throw Error('Telegram test failed');
 console.log(JSON.stringify({groqVerified:true,model:review.model,emptySetupRejected:true,telegramDelivered:true,messageId:r.result.message_id,origin:'github'}));
}catch{console.error('Cloud Groq/Telegram check failed; credentials are not logged.');process.exitCode=1;}
