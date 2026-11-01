// Stable text models with documented free-tier availability. No aliases or paid-only models.
export const reviewModels=Object.freeze(['groq:openai/gpt-oss-120b','gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
export function configuredReviewModels(env=process.env,{includeGroq=true}={}){return reviewModels.filter(m=>m.startsWith('groq:')?includeGroq&&Boolean(env.GROQ_API_KEY):Boolean(env.GEMINI_API_KEY));}
export async function reviewWithFallback({request,state,beforeAttempt=async()=>{},persist=async()=>{},now=Date.now,models=reviewModels}){
 state.aiModels??={};
 for(const model of models){
  const retryAt=Date.parse(state.aiModels[model]?.retryAt);if(Number.isFinite(retryAt)&&retryAt>now())continue;
  await beforeAttempt(model);
  let response;
  try{response=await request(model);}catch(error){
   const match=/HTTP (\d{3})\b/.exec(error?.message||''),status=match?Number(match[1]):null;
   if(model.startsWith('groq:')&&[401,403].includes(status)){state.aiModels[model]={retryAt:new Date(now()+86400000).toISOString(),status};await persist();continue;}
   const transient=[429,500,502,503,504,404].includes(status)||['TimeoutError','AbortError'].includes(error?.name);
   if(!transient){state.lastReviewIssue={kind:'request_error',model,status,at:new Date(now()).toISOString()};await persist();throw Error('AI review failed');}
   state.aiModels[model]={retryAt:new Date(now()+(status===404?86400000:60000)).toISOString(),status:status??'timeout'};
   await persist();continue;
  }
  const candidate=response.candidates?.[0];
  // A rejection, refusal or malformed answer must never be retried with another model to obtain approval.
  if(candidate?.finishReason!=='STOP'){state.lastReviewIssue={kind:'incomplete_response',model,at:new Date(now()).toISOString()};await persist();return null;}
  let out;try{out=JSON.parse(candidate.content.parts.filter(p=>!p.thought&&p.text).map(p=>p.text).join(''));}catch{state.lastReviewIssue={kind:'invalid_json',model,at:new Date(now()).toISOString()};await persist();return null;}
  if(typeof out?.approve!=='boolean'||typeof out.reason!=='string'||out.reason.length>1000){state.lastReviewIssue={kind:'invalid_schema',model,at:new Date(now()).toISOString()};await persist();return null;}
  state.aiModels[model]={lastSuccessAt:new Date(now()).toISOString()};state.lastReviewModel=model;state.lastReviewIssue=null;await persist();
  return {...out,model};
 }
 state.lastReviewIssue={kind:'all_models_unavailable',at:new Date(now()).toISOString()};await persist();const error=Error('All configured review models unavailable');error.code='AI_UNAVAILABLE';throw error;
}
export function reviewStatusMessage(state){
 const descriptions={429:'ติดลิมิต',503:'บริการไม่พร้อม',500:'บริการขัดข้อง',502:'บริการขัดข้อง',504:'ตอบช้า',404:'โมเดลใช้ไม่ได้'};
 const lines=['แจ้งสถานะ No1: บางสัญญาณยังตรวจด้วย AI ไม่สำเร็จ'];
 for(const model of reviewModels){const s=state.aiModels?.[model];if(s?.status)lines.push(model+': '+(descriptions[s.status]||String(s.status))+(typeof s.status==='number'?' (HTTP '+s.status+')':''));}
 if(['invalid_json','invalid_schema','incomplete_response'].includes(state.lastReviewIssue?.kind))lines.push('คำตอบจาก '+state.lastReviewIssue.model+' ยังไม่ครบหรือรูปแบบไม่ถูกต้อง จึงไม่ส่งสัญญาณนั้น');
 if(state.lastReviewIssue?.kind==='request_error')lines.push('คำขอ '+state.lastReviewIssue.model+' ไม่สำเร็จ'+(state.lastReviewIssue.status?' (HTTP '+state.lastReviewIssue.status+')':''));
 if(state.lastReviewModel)lines.push('ตัวที่เคยตรวจสำเร็จล่าสุด: '+state.lastReviewModel);
 lines.push('ระบบจะสลับตัวสำรองเมื่อบริการติดขัด และตรวจความสดของราคาใหม่ก่อนส่ง ไม่มีการเปิดการชำระเงินเพิ่ม');return lines.join('\n');
}
