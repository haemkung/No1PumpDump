import assert from 'node:assert/strict';
import {requestAIReview} from './ai-review-client.mjs';
const options={method:'POST',body:JSON.stringify({systemInstruction:{parts:[{text:'Reject empty setups'}]},contents:[{role:'user',parts:[{text:'{}'}]}]})};
let captured;
const r=await requestAIReview('groq:openai/gpt-oss-120b',options,async(url,opts)=>{captured={url,opts};return {choices:[{finish_reason:'stop',message:{content:'{"approve":false,"reason":"ไม่มีข้อมูล"}'}}]};},{geminiKey:'fake-gemini',groqKey:'fake-groq'});
assert.equal(r.candidates[0].finishReason,'STOP');assert.equal(captured.url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(captured.opts.headers['x-goog-api-key'],undefined);
assert.equal(JSON.parse(captured.opts.body).response_format.json_schema.strict,true);
await requestAIReview('gemini-3.1-flash-lite',options,async(url,opts)=>{assert.equal(opts.headers.Authorization,undefined);return {};},{geminiKey:'fake-gemini',groqKey:'fake-groq'});
console.log('Provider adapter passed: strict JSON, response normalization, credentials confined to correct endpoint');
