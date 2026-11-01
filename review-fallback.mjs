// Stable text models with documented free-tier availability. No aliases or paid-only models.
export const reviewModels=Object.freeze(['gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite']);
export async function reviewWithFallback({request,state,beforeAttempt=async()=>{},persist=async()=>{},now=Date.now}){
 state.aiModels??={};
 for(const model of reviewModels){
  const retryAt=Date.parse(state.aiModels[model]?.retryAt);if(Number.isFinite(retryAt)&&retryAt>now())continue;
  await beforeAttempt(model);
  let response;
  try{response=await request(model);}catch(error){
   const match=/HTTP (\d{3})\b/.exec(error?.message||''),status=match?Number(match[1]):null;
   const transient=[429,500,502,503,504,404].includes(status)||['TimeoutError','AbortError'].includes(error?.name);
   if(!transient)throw Error('AI review failed');
   state.aiModels[model]={retryAt:new Date(now()+(status===404?86400000:60000)).toISOString(),status:status??'timeout'};
   await persist();continue;
  }
  const candidate=response.candidates?.[0];
  // A rejection, refusal or malformed answer must never be retried with another model to obtain approval.
  if(candidate?.finishReason!=='STOP')return null;
  let out;try{out=JSON.parse(candidate.content.parts.filter(p=>!p.thought&&p.text).map(p=>p.text).join(''));}catch{return null;}
  if(typeof out?.approve!=='boolean'||typeof out.reason!=='string'||out.reason.length>1000)return null;
  state.aiModels[model]={lastSuccessAt:new Date(now()).toISOString()};state.lastReviewModel=model;await persist();
  return {...out,model};
 }
 const error=Error('All configured review models unavailable');error.code='AI_UNAVAILABLE';throw error;
}
