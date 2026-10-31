export const FEATURES=['logVolumeRatio','closeStrength','logStopPercent','isLong'];
export function featureVector(r){
  const v=r.features?.volumeRatio??r.volumeRatio,c=r.features?.closeStrength??r.closeLocation;
  const risk=Math.abs(r.entry-r.stop)/r.entry*100;
  if(!(v>0&&risk>0&&c>=0&&c<=1)||!['LONG','SHORT'].includes(r.side))return null;
  const x=[Math.log(v),c,Math.log(risk),r.side==='LONG'?1:0];return x.every(Number.isFinite)?x:null;
}
const sigmoid=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
export function predict(model,x){
  if(!x||x.length!==FEATURES.length||!x.every(Number.isFinite)||model.featureNames?.join('|')!==FEATURES.join('|'))return null;
  return sigmoid(model.bias+x.reduce((s,v,i)=>s+model.weights[i]*(v-model.mean[i])/model.scale[i],0));
}
export function fit(samples){
  if(samples.length<12||samples.some(s=>!s.x||![0,1].includes(s.y)))throw Error('Insufficient training data');
  const n=samples.length,k=FEATURES.length,mean=Array(k).fill(0),scale=Array(k).fill(0),weights=Array(k).fill(0);
  for(const s of samples)for(let j=0;j<k;j++)mean[j]+=s.x[j]/n;
  for(const s of samples)for(let j=0;j<k;j++)scale[j]+=(s.x[j]-mean[j])**2/n;
  for(let j=0;j<k;j++)scale[j]=Math.sqrt(scale[j])||1;
  const xs=samples.map(s=>s.x.map((v,j)=>(v-mean[j])/scale[j]));let bias=0;
  for(let step=0;step<1800;step++){
    const gradient=Array(k).fill(0);let gb=0;
    for(let i=0;i<n;i++){const error=sigmoid(bias+xs[i].reduce((s,v,j)=>s+v*weights[j],0))-samples[i].y;gb+=error/n;for(let j=0;j<k;j++)gradient[j]+=error*xs[i][j]/n;}
    bias-=.08*gb;for(let j=0;j<k;j++)weights[j]-=.08*(gradient[j]+.08*weights[j]);
  }
  return {algorithm:'L2-logistic-regression',featureNames:FEATURES,mean,scale,weights,bias};
}
export function evaluate(model,samples,prior){
  if(!samples.length)return null;
  const ps=samples.map(s=>({p:predict(model,s.x),y:s.y}));
  const positives=ps.filter(s=>s.y===1),negatives=ps.filter(s=>s.y===0);
  let wins=0;for(const a of positives)for(const b of negatives)wins+=a.p>b.p?1:a.p===b.p?.5:0;
  return {n:ps.length,positives:positives.length,negatives:negatives.length,brier:ps.reduce((s,r)=>s+(r.p-r.y)**2,0)/ps.length,baselineBrier:ps.reduce((s,r)=>s+(prior-r.y)**2,0)/ps.length,auc:positives.length&&negatives.length?wins/(positives.length*negatives.length):null};
}
