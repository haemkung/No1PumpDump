// Heuristic quality rubric, not a calibrated win probability.
// A validated breakout/retest and Gemini approval are prerequisites.
export function signalScore({volumeRatio,spreadRatio,entryDrift,ageMs,approved}){
  if(approved!==true||![volumeRatio,spreadRatio,entryDrift,ageMs].every(Number.isFinite)||volumeRatio<1.5||spreadRatio<0||entryDrift<0||ageMs<0||ageMs>180000)return null;
  const clamp=x=>Math.min(1,Math.max(0,x));
  const parts={structure:30,volume:Math.round(25*clamp((volumeRatio-1.5)/1.5)),spread:Math.round(15*clamp(1-spreadRatio/.001)),entry:Math.round(15*clamp(1-entryDrift/.003)),freshness:Math.round(15*clamp(1-ageMs/180000))};
  return {total:Object.values(parts).reduce((a,b)=>a+b,0),parts,version:'quality-v1',calibrated:false};
}
