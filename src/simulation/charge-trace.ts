import type { Game,Formation,Player,Position } from '../game/types';
import { byId,posOf } from '../game/formation';
import { hasChargeTag,type CpuStrategy } from './charge-cpu';
export interface ChargeRound {round:number;team:'A'|'B';cpuStrategy:CpuStrategy;id:number;name:string;position:Position;entered:boolean;chargeBefore:number;chargeAfter:number;spentCharge:number;burstRecoveries:number;recoveredCharge:number;burstCountBefore:number;burstCountAfter:number}
export function chargeBefore(players:[Player,Player]):Map<string,{charge:number;bursts:number;previousPosition:Position}> {
 return new Map(players.flatMap((p,side)=>p.ids.filter(hasChargeTag).map(id=>[`${side}:${id}`,{charge:p.states[id].charge,bursts:p.states[id].burstCount,previousPosition:p.states[id].prevPos}] as const)));
}
export function chargeRoundTrace(game:Game,before:ReturnType<typeof chargeBefore>,mirror:boolean,strategies:[CpuStrategy,CpuStrategy]):ChargeRound[] {
 return [game.p1,game.p2].flatMap((p,side)=>p.ids.filter(hasChargeTag).map(id=>{
  const teamSide=mirror?1-side:side,old=before.get(`${side}:${id}`)!,state=p.states[id];
  const recoveries=(game.skillEffects||[]).filter(e=>e.kind==='B'&&e.id===id&&e.side===side).flatMap(e=>e.targets.filter(t=>t.side===side&&t.id===id&&t.label==='チャージ'&&(t.delta??0)>0));
  return {round:game.round,team:teamSide===0?'A' as const:'B' as const,cpuStrategy:strategies[teamSide],id,name:byId(id).name,position:posOf(p,id),entered:p.enteredThisRoundIds.includes(id),chargeBefore:old.charge,chargeAfter:state.charge,spentCharge:state.spentCharge,burstRecoveries:recoveries.length,recoveredCharge:recoveries.reduce((n,t)=>n+t.delta!,0),burstCountBefore:old.bursts,burstCountAfter:state.burstCount};
 }));
}
export function traceFormationPosition(formation:Formation,id:number):Position{return (Object.entries(formation).find(([,value])=>value===id)?.[0]||'BACK') as Position;}
