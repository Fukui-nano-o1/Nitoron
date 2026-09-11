// Unconstrained 2D affine regression from fixed 3D priors, not a metric weak-perspective camera.
// Own small Householder QR with column pivoting. No normal-equation inverse or rank-deficient fallback.
export const AFFINE_POLICY=Object.freeze({minimumGroupPoints:5,minimumTrainingPoints:4,
  rankRelativeTolerance:1e-10,maxConditionInfR:1e8,normalization:'training-only isotropic RMS spread'});
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const finite=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
const infNorm=m=>Math.max(...m.map(row=>row.reduce((s,v)=>s+Math.abs(v),0)));
const solveUpper=(r,b)=>{
  const x=Array(r.length).fill(0);
  for(let i=r.length-1;i>=0;i--)x[i]=(b[i]-r[i].slice(i+1).reduce((s,v,j)=>s+v*x[i+1+j],0))/r[i][i];
  return x;
};

function qrLeastSquares(design,targets){
  const a=design.map(row=>row.slice()),y=targets.map(row=>row.slice()),m=a.length,n=4;
  const permutation=[0,1,2,3],diagonal=[];
  const reference=Math.max(...permutation.map(j=>Math.hypot(...a.map(row=>row[j]))));
  let rank=0;
  for(let k=0;k<n;k++){
    let best=k,bestNorm=-1;
    for(let j=k;j<n;j++){
      const norm=Math.hypot(...a.slice(k).map(row=>row[j]));
      if(norm>bestNorm){best=j;bestNorm=norm}
    }
    if(best!==k){for(const row of a)[row[k],row[best]]=[row[best],row[k]];
      [permutation[k],permutation[best]]=[permutation[best],permutation[k]]}
    if(bestNorm<=reference*AFFINE_POLICY.rankRelativeTolerance)break;
    const v=a.slice(k).map(row=>row[k]),alpha=v[0]>=0?-bestNorm:bestNorm;
    v[0]-=alpha;const length=Math.hypot(...v);for(let i=0;i<v.length;i++)v[i]/=length;
    for(let j=k;j<n;j++){
      const product=2*v.reduce((s,x,i)=>s+x*a[k+i][j],0);
      for(let i=0;i<v.length;i++)a[k+i][j]-=product*v[i];
    }
    for(let j=0;j<2;j++){
      const product=2*v.reduce((s,x,i)=>s+x*y[k+i][j],0);
      for(let i=0;i<v.length;i++)y[k+i][j]-=product*v[i];
    }
    a[k][k]=alpha;for(let i=k+1;i<m;i++)a[i][k]=0;
    diagonal.push(Math.abs(alpha));rank++;
  }
  const diagnostics={rank,requiredRank:4,permutation,diagonal,
    rankThreshold:reference*AFFINE_POLICY.rankRelativeTolerance,conditionInfR:null};
  if(rank<4)return {status:'rank-deficient',diagnostics};
  const r=a.slice(0,4).map(row=>row.slice(0,4));
  const inverseColumns=Array.from({length:4},(_,j)=>solveUpper(r,Array.from({length:4},(_,i)=>i===j?1:0)));
  const inverse=Array.from({length:4},(_,i)=>inverseColumns.map(col=>col[i]));
  const condition=infNorm(r)*infNorm(inverse);
  diagnostics.conditionInfR=Number.isFinite(condition)?condition:null;
  if(!Number.isFinite(condition)||condition>AFFINE_POLICY.maxConditionInfR)return {status:'ill-conditioned',diagnostics};
  const coefficients=[0,1].map(j=>{
    const ordered=solveUpper(r,y.slice(0,4).map(row=>row[j])),original=Array(4);
    for(let i=0;i<4;i++)original[permutation[i]]=ordered[i];return original;
  });
  return {status:'fitted',diagnostics,coefficients,inverseR:inverse};
}

export function fitAffineCamera(observations){
  if(!Array.isArray(observations)||observations.some(o=>!finite(o.prior,3)||!finite(o.xy,2)))
    throw new Error('invalid-affine-observations');
  const n=observations.length;
  if(n<AFFINE_POLICY.minimumTrainingPoints)return {status:'insufficient-training-points',trainingPoints:n,minimum:4};
  const center=[0,1,2].map(k=>observations.reduce((s,o)=>s+o.prior[k],0)/n);
  const spread=Math.sqrt(observations.reduce((s,o)=>s+o.prior.reduce((q,x,k)=>q+(x-center[k])**2,0),0)/n);
  if(!Number.isFinite(spread)||spread===0)return {status:'rank-deficient',trainingPoints:n,diagnostics:{rank:1,requiredRank:4,conditionInfR:null}};
  const design=observations.map(o=>[...o.prior.map((x,k)=>(x-center[k])/spread),1]);
  const fit=qrLeastSquares(design,observations.map(o=>o.xy));
  const base={status:fit.status,trainingPoints:n,nominalResidualDegreesPerOutput:n-4,
    justDeterminedIfFullRank:n===4,diagnostics:fit.diagnostics,policy:AFFINE_POLICY};
  if(fit.status!=='fitted')return base;
  const matrix=fit.coefficients.map(row=>row.slice(0,3).map(v=>v/spread));
  const offset=fit.coefficients.map((row,i)=>row[3]-dot(matrix[i],center));
  if(!matrix.flat().concat(offset).every(Number.isFinite))return {...base,status:'non-finite-solution'};
  const lengths=matrix.map(row=>Math.hypot(...row)),product=lengths[0]*lengths[1];
  const rowCosine=product?dot(matrix[0],matrix[1])/product:null;
  const model={type:'unconstrained-affine-2x3',matrix,offset,
    normalization:{center,spread},normalizedCoefficients:fit.coefficients,
    inverseR:fit.inverseR,permutation:fit.diagnostics.permutation,
    rowNormRatio:lengths[1]?lengths[0]/lengths[1]:null,rowCosine,
    physicalCameraVerified:false};
  const trainRmse=Math.sqrt(observations.reduce((s,o)=>s+projectAffine(o.prior,model)
    .reduce((q,x,k)=>q+(x-o.xy[k])**2,0),0)/n);
  return {...base,model,trainingRmsePx:trainRmse};
}

export function projectAffine(point,model){
  if(!finite(point,3))throw new Error('invalid-affine-point');
  // Normalized form avoids cancellation from translating large world coordinates back and forth.
  const x=[...point.map((v,k)=>(v-model.normalization.center[k])/model.normalization.spread),1];
  return model.normalizedCoefficients.map(row=>dot(row,x));
}

export function affinePredictionGain(point,model){
  const x=[...point.map((v,k)=>(v-model.normalization.center[k])/model.normalization.spread),1];
  const xp=model.permutation.map(i=>x[i]);
  return Math.hypot(...[0,1,2,3].map(j=>xp.reduce((s,v,i)=>s+v*model.inverseR[i][j],0)));
}
