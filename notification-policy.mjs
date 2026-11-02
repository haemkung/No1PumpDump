// Selection quality is a heuristic, never a calibrated chance of winning.
export const notificationPolicy=Object.freeze({version:'original-15m-retest-v6',minQuality:0,shortlist:5,maxSignalsPerRound:1,earlyMaxSignalsPerRound:1,earlyMinGapMs:900000,earlyWatchNotifications:false,earlyHighOnly:true});
export function earlyNotificationDue(state,now=Date.now()){
 const times=[Date.parse(state.lastEarlyAttemptAt),Number(state.lastEarlyAttemptRound)*60000,...Object.values(state.journal||{}).filter(r=>['watch_sent','delivery_pending','delivery_unknown'].includes(r.status)).map(r=>Date.parse(r.deliveryAttemptAt??r.sentAt))].filter(Number.isFinite);
 return !times.length||now-Math.max(...times)>=notificationPolicy.earlyMinGapMs;
}
export function shortlistConfirmed(candidates){return candidates.filter(c=>Number.isFinite(c.selectionQuality?.total)&&c.selectionQuality.total>=notificationPolicy.minQuality).sort((a,b)=>b.selectionQuality.total-a.selectionQuality.total||b.volumeRatio-a.volumeRatio||a.symbol.localeCompare(b.symbol)).slice(0,notificationPolicy.shortlist);}
