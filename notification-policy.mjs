// Selection quality is a heuristic, never a calibrated chance of winning.
export const notificationPolicy=Object.freeze({version:'confirmed-top5-v1',minQuality:85,shortlist:5,maxSignalsPerRound:3,earlyWatchNotifications:false});
export function shortlistConfirmed(candidates){return candidates.filter(c=>Number.isFinite(c.selectionQuality?.total)&&c.selectionQuality.total>=notificationPolicy.minQuality).sort((a,b)=>b.selectionQuality.total-a.selectionQuality.total||b.volumeRatio-a.volumeRatio||a.symbol.localeCompare(b.symbol)).slice(0,notificationPolicy.shortlist);}
