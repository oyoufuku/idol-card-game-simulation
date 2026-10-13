export function sampleEvidence(sampleCount:number){
 return {sampleCount,sampleStatus:sampleCount<20?'insufficient':sampleCount<50?'provisional':'sufficient',sufficientSamples:sampleCount>=50};
}
