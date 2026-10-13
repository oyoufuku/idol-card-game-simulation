import { join } from 'node:path';
import type { MatchResult } from './match';
import { csv } from './output';
import { sampleEvidence } from './samples';
export function writeChargeStats(dir:string,matches:MatchResult[]) {
 const traces=matches.flatMap(m=>(m.chargeTrace||[]).map(row=>({pairId:m.spec.pairId,seed:m.spec.seed,mirror:m.spec.mirror,...row})));
 csv(join(dir,'charge_round_trace.csv'),traces,['pairId','seed','mirror','round','team','cpuStrategy','id','name','position','entered','chargeBefore','chargeAfter','spentCharge','burstRecoveries','recoveredCharge','burstCountBefore','burstCountAfter']);
 const aggregates=new Map<string,{id:number;name:string;cpuStrategy:string;games:number;maxTotal:number;reached:number;consumed:number;recoveries:number;r5:number;r6:number;r7:number}>();
 const strategies=new Map<string,{cpuStrategy:string;archetype:string;games:number;wins:number;draws:number;points:number;appeal:number}>();
 for(const m of matches)for(const [side,team] of [[0,m.spec.a],[1,m.spec.b]] as const){
  const strategy=m.cpuStrategies?.[side]||'normal',win=m.winner===(side===0?'A':'B'),key=`${team.archetype}:${strategy}`;
  const stat=strategies.get(key)||{cpuStrategy:strategy,archetype:team.archetype,games:0,wins:0,draws:0,points:0,appeal:0};
  stat.games++;stat.wins+=+win;stat.draws+=+(m.winner==='draw');stat.points+=side===0?m.pointsA:m.pointsB;stat.appeal+=side===0?m.appealA:m.appealB;strategies.set(key,stat);
  const own=(m.chargeTrace||[]).filter(t=>t.team===(side===0?'A':'B'));
  for(const id of new Set(own.map(t=>t.id))){
   const rows=own.filter(t=>t.id===id),first=rows[0],key=`${id}:${strategy}`;
   const c=aggregates.get(key)||{id,name:first.name,cpuStrategy:strategy,games:0,maxTotal:0,reached:0,consumed:0,recoveries:0,r5:0,r6:0,r7:0};
   const maximum=Math.max(...rows.flatMap(t=>[t.chargeBefore,t.chargeAfter,t.spentCharge]));c.games++;c.maxTotal+=maximum;c.reached+=+(maximum>=3);
   c.consumed+=rows.filter(t=>t.entered&&t.spentCharge>0).length;c.recoveries+=rows.reduce((n,t)=>n+t.burstRecoveries,0);
   c.r5+=+rows.some(t=>t.round===5&&t.entered);c.r6+=+rows.some(t=>t.round===6&&t.position==='BACK');c.r7+=+rows.some(t=>t.round===7&&t.entered);aggregates.set(key,c);
  }
 }
 const rows=[...aggregates.values()].map(c=>({id:c.id,name:c.name,cpuStrategy:c.cpuStrategy,games:c.games,averageMaxCharge:c.maxTotal/c.games,charge3ReachedRate:c.reached/c.games,chargeConsumptionCount:c.consumed,averageChargeConsumptions:c.consumed/c.games,burstChargeRecoveryCount:c.recoveries,averageBurstChargeRecoveries:c.recoveries/c.games,r5StageEntryRate:c.r5/c.games,r6BacksRate:c.r6/c.games,r7StageEntryRate:c.r7/c.games,...sampleEvidence(c.games)}));
 csv(join(dir,'charge_idol_stats.csv'),rows,['id','name','cpuStrategy','games','averageMaxCharge','charge3ReachedRate','chargeConsumptionCount','averageChargeConsumptions','burstChargeRecoveryCount','averageBurstChargeRecoveries','r5StageEntryRate','r6BacksRate','r7StageEntryRate','sampleCount','sampleStatus','sufficientSamples']);
 csv(join(dir,'cpu_strategy_stats.csv'),[...strategies.values()].map(c=>({cpuStrategy:c.cpuStrategy,archetype:c.archetype,games:c.games,wins:c.wins,draws:c.draws,winRate:c.wins/c.games,averagePoints:c.points/c.games,averageAppeal:c.appeal/c.games,...sampleEvidence(c.games)})),['cpuStrategy','archetype','games','wins','draws','winRate','averagePoints','averageAppeal','sampleCount','sampleStatus','sufficientSamples']);
 return rows;
}
