import type { Player,Skill } from './types';
import { IDOLS } from '../data/idols';

export function burstSkillSuppressed(p:Player,id:number){const until=p.states[id]?.burstDisabledUntilRound;return until!==undefined&&p.round<=until;}
const suppressedSkills=new WeakMap<Skill,Skill>();
export function suppressBurstHooks(skill:Skill,keys:readonly (keyof Skill)[]):Skill {
 let result=suppressedSkills.get(skill);
 if(!result){result={...skill};for(const key of keys)delete result[key];result.burst=()=>{};suppressedSkills.set(skill,result);}
 return result;
}
/** Suspend continuing effects; never undo resolved recovery, movement, charge,
 * attribute additions, song changes, permanent base changes or BURST history. */
export function disableBurstSkill(p:Player,opp:Player,id:number,untilRound:number){
 const s=p.states[id];s.burstDisabledUntilRound=Math.max(s.burstDisabledUntilRound??0,untilRound);
 s.burstSelfAppeal=0;s.activeAutoCarry=0;s.nextAutoCarry=0;s.muraiDoubleC=false;s.appealReductionShield=false;
 const kind=IDOLS.find(c=>c.id===id)!.skill;
 if(kind==='taniguchi')p.cuteOnly=false;
 if(kind==='murayama')p.burstCoolBonus=0;
 // Locks/movements already applied by a B remain; its continuing Appeal
 // reduction does not. Keep reductions from other sources separately.
 for(const target of opp.ids){const state=opp.states[target],sources=state.burstDebuffSources;
  if(sources){state.burstDebuff-=sources.filter(source=>source.id===id).reduce((n,source)=>n+source.amount,0);state.burstDebuffSources=sources.filter(source=>source.id!==id);}
 }
}
export function expireBurstSuppression(p:Player){for(const id of p.ids){const s=p.states[id];if(s.burstDisabledUntilRound!==undefined&&s.burstDisabledUntilRound<=p.round)delete s.burstDisabledUntilRound;}}
