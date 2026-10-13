// Opt-in, player-scoped counterfactual masks. Absent masks return the original
// Skill object; no catalog mutation, serialized state or normal-game policy change.
import type { Player,Skill } from './types';
import {burstSkillSuppressed,suppressBurstHooks} from './skill-suppression';
export type AblationKind='AUTO'|'BURST'|'CENTER'|'ALL';
export const SKILL_COMPONENTS:Record<'AUTO'|'BURST'|'CENTER',(keyof Skill)[]>={
 AUTO:['start','post','autoActive','chargeConsumer','positionMultiplier','cancelOppositePosition','pre','autoAppeal','autoEffects','copyOppositeAuto','copyOppositeGain','negativeImmuneOnEntry','fatigueReduction','disableOppositeAuto','backCenterMitigation'],
 BURST:['burst','condition','burstEffects','postBurst','postFatigue','positionTeamMultiplier','cancelEnemyFront','cancelEnemyPositions','burstPartyShield','enemyPositionFatigueMultiplier','reactToOpponentBackBurst','reactToTeamBursts','reactToOpponentBurst'],
 CENTER:['plainCenter','baseEnemyCenter','centerPositionBonus','centerEffects','centerSongImmune','protectCoolFromAuto','disableOpponentCenter','centerPre','centerAppeal','centerLoss'],
};
interface Masks { kinds:Map<number,AblationKind>;cache:Map<number,{base:Skill;filtered:Skill}> }
const masks=new WeakMap<Player,Masks>();
export function setAnalysisSkillMasks(p:Player,entries:{id:number;kind:AblationKind}[]) {
 for(const e of entries)if(!p.ids.includes(e.id)||!['AUTO','BURST','CENTER','ALL'].includes(e.kind))throw new Error('Invalid analysis skill mask');
 masks.set(p,{kinds:new Map(entries.map(e=>[e.id,e.kind])),cache:new Map()});
}
export function inheritAnalysisSkills(source:Player,copy:Player):Player {const m=masks.get(source);if(m)masks.set(copy,m);return copy;}
export function skillEnabled(p:Player,id:number,component:'AUTO'|'BURST'|'CENTER') {if(component==='BURST'&&burstSkillSuppressed(p,id))return false;const kind=masks.get(p)?.kinds.get(id);return kind!=='ALL'&&kind!==component;}
export function analysisSkill(p:Player|undefined,id:number,base:Skill):Skill {
 if(p&&burstSkillSuppressed(p,id))return suppressBurstHooks(analysisSkillWithoutStatus(p,id,base),SKILL_COMPONENTS.BURST);
 return analysisSkillWithoutStatus(p,id,base);
}
function analysisSkillWithoutStatus(p:Player|undefined,id:number,base:Skill):Skill {
 const mask=p?masks.get(p):undefined,kind=mask?.kinds.get(id);if(!mask||!kind)return base;
 const previous=mask.cache.get(id);if(previous?.base===base)return previous.filtered;
 const filtered={...base};
 for(const component of ['AUTO','BURST','CENTER'] as const)if(kind==='ALL'||kind===component)for(const key of SKILL_COMPONENTS[component])delete filtered[key];
 // immuneAppeal is A when inactive, B when bursting; its users gate separately.
 if(kind==='ALL')delete filtered.immuneAppeal;
 filtered.burst??=()=>{};
 mask.cache.set(id,{base,filtered});return filtered;
}
