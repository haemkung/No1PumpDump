export function silenceDecision(plan,journal,now){
 if(plan?.enabled!==true)return 'disabled';
 const start=Date.parse(plan.armedAt),end=Date.parse(plan.deadline);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isFinite(now))return 'defer';
 if(now<end)return 'waiting';
 if(!journal||typeof journal!=='object'||Array.isArray(journal))return 'defer';
 const sent=Object.values(journal).some(r=>r?.status==='sent'&&Date.parse(r.sentAt)>=start&&Date.parse(r.sentAt)<end);
 return sent?'keep_confirmed':'restore_early';
}
