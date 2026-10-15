import { generateArchetypes,randomTeam,type Team } from './teams';
import { mirror,type MatchSpec } from './match';
import { seedFor } from './random';
import { META_ARCHETYPE } from './meta-teams';
import { CHARGE_POLICY,type CpuStrategy } from './charge-cpu';
import { BURST_CPU_POLICY } from '../game/burst-cpu';
export type StrategySelection='normal'|'charge'|'charge-archetype'|'burst'|'burst-archetype'|'burst-charge-archetype';
const isChargeTheme=(team:Team)=>team.preferredCpuStrategy==='charge'||team.archetype==='チャージ軸'||team.mainTags.includes('チャージ');
export function withStrategies(specs:MatchSpec[],selection:StrategySelection):MatchSpec[]{
 if(selection==='normal')return specs;
 if(selection==='burst-charge-archetype')return specs.map(spec=>({...spec,cpuStrategies:[spec.a,spec.b].map(t=>isChargeTheme(t)?'charge':'burst') as [CpuStrategy,CpuStrategy],cpuPolicy:`${CHARGE_POLICY}+${BURST_CPU_POLICY}`}));
 if(selection==='burst'||selection==='burst-archetype')return specs.map(spec=>({...spec,cpuStrategies:[spec.a,spec.b].map(t=>selection==='burst'||t.archetype==='バースト軸'?'burst':'normal') as [CpuStrategy,CpuStrategy],cpuPolicy:BURST_CPU_POLICY}));
 return specs.map(spec=>({...spec,cpuStrategies:[spec.a,spec.b].map(t=>selection==='charge'||isChargeTheme(t)?'charge':'normal') as [CpuStrategy,CpuStrategy],cpuPolicy:CHARGE_POLICY}));
}
export function chargeComparisonSchedule(seed:number,games:number,teams=generateArchetypes(seed)):MatchSpec[]{
 if(games<2||games%2)throw new Error('--matches-per-matchup はmirrorを含む偶数（2以上）で指定してください');
 const charge=teams.filter(t=>t.archetype==='チャージ軸');if(!charge.length)throw new Error('チャージ軸がありません');
 return Array.from({length:games/2},(_,i)=>{const t=charge[i%charge.length],a={...t,name:`${t.name}（通常CPU）`,archetype:'チャージ軸（通常CPU）'},b={...t,name:`${t.name}（CHARGE CPU）`,archetype:'チャージ軸（CHARGE CPU）'};
 const spec:MatchSpec={mode:'archetype',pairId:`charge-comparison/${i}`,seed:seedFor(seed,'charge-comparison',i),mirror:false,a,b,cpuStrategies:['normal','charge'],cpuPolicy:CHARGE_POLICY};return [spec,mirror(spec)];}).flat();
}
export function randomSchedule(seed:number,count:number):MatchSpec[]{return Array.from({length:count},(_,i)=>({mode:'random',pairId:`random-${i}`,seed:seedFor(seed,'random',i),mirror:false,a:randomTeam(seedFor(seed,'roster',i,'A'),`RANDOM-${i}-A`),b:randomTeam(seedFor(seed,'roster',i,'B'),`RANDOM-${i}-B`)}));}
export function archetypeSchedule(seed:number,games:number,teams=generateArchetypes(seed),representative=false):MatchSpec[]{
 if(games<2||games%2)throw new Error('--matches-per-matchup はmirrorを含む偶数（2以上）で指定してください');
 const groups=new Map<string,Team[]>();for(const t of teams)groups.set(t.archetype,[...(groups.get(t.archetype)||[]),t]);const names=[...groups.keys()],result:MatchSpec[]=[];
 const legacy=names.filter(n=>n!==META_ARCHETYPE),pairs=[...legacy.flatMap((a,i)=>legacy.slice(i).map(b=>[a,b])),...(names.includes(META_ARCHETYPE)?[...legacy.map(a=>[a,META_ARCHETYPE]),[META_ARCHETYPE,META_ARCHETYPE]]:[])];
 const chosen=representative?[[names.find(n=>n==='バースト軸')||names[0],names.find(n=>n==='疲労付与軸')||names[1]],[names.find(n=>n==='クール軸')||names[0],names.find(n=>n==='多属性軸')||names[1]],[names.find(n=>n==='チャージ軸')||names[0],names.find(n=>n==='疲労回復軸')||names[1]]]:pairs;
 for(const [a,b] of chosen)for(let i=0;i<games/2;i++){
  const as=groups.get(a)!,bs=groups.get(b)!,spec:MatchSpec={mode:'archetype',pairId:`${a}/${b}/${i}`,seed:seedFor(seed,'archetype',a,b,i),mirror:false,a:as[i%as.length],b:bs[Math.floor(i/as.length+i)%bs.length]};result.push(spec,mirror(spec));
 }
 return result;
}
