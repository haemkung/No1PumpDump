function jsonSchema(schema){const out={...schema,type:String(schema.type).toLowerCase()};if(out.type==='object'){out.additionalProperties=false;out.properties=Object.fromEntries(Object.entries(schema.properties||{}).map(([k,v])=>[k,jsonSchema(v)]));}if(schema.items)out.items=jsonSchema(schema.items);return out;}
export async function requestAIReview(model,options,json,{geminiKey,groqKey}){
 if(!model.startsWith('groq:'))return json('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{...options,headers:{'content-type':'application/json','x-goog-api-key':geminiKey}});
 if(!groqKey)throw Error('Groq credential not configured');
 const body=JSON.parse(options.body);
 const system=(body.systemInstruction?.parts||[]).map(p=>p.text||'').join('\n')+'\nReturn only JSON matching the response schema, including approve (boolean), reason (brief Thai string), and any additional required assessment fields. Never approve missing market data.';
 const messages=[{role:'system',content:system},...(body.contents||[]).map(c=>({role:c.role==='model'?'assistant':'user',content:c.parts.map(p=>p.text||'').join('\n')}))];
 const schema=body.generationConfig?.responseSchema??{type:'OBJECT',properties:{approve:{type:'BOOLEAN'},reason:{type:'STRING'}},required:['approve','reason']};
 const result=await json('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+groqKey},body:JSON.stringify({model:model.slice(5),messages,reasoning_effort:'low',max_completion_tokens:2048,response_format:{type:'json_schema',json_schema:{name:'signal_review',strict:true,schema:jsonSchema(schema)}}})});
 const c=result.choices?.[0];
 return {candidates:[{finishReason:c?.finish_reason==='stop'?'STOP':c?.finish_reason??'MISSING',content:{parts:[{text:c?.message?.content??''}]}}]};
}
