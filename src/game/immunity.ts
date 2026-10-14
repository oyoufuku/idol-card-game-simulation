import type {Player} from './types';
/** The two historical protection types now share their union of coverage. */
export function grantImmunity(p:Player,id:number,source:number,kind:'A'|'B') {
 const s=p.states[id];s.immunitySources=[...(s.immunitySources||[]).filter(x=>x.id!==source||x.kind!==kind),{id:source,kind}];s.shield=true;s.negativeShield=true;
}
export function removeImmunitySource(p:Player,source:number,kind:'A'|'B') {
 for(const id of p.ids){const s=p.states[id];if(!s.immunitySources?.some(x=>x.id===source&&x.kind===kind))continue;
  s.immunitySources=s.immunitySources.filter(x=>x.id!==source||x.kind!==kind);s.shield=s.negativeShield=s.immunitySources.length>0;
 }
}
