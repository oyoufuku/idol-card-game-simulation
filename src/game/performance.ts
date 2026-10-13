// Shared performance preparation for previews, the browser and the CLI.
import type { Player, Song } from './types';
import { autoEnabled, byId, countAttr, posOf, idsBack, idsStage, hasAttr, positionKind, symmeId } from './formation';
import { skillFor } from './skills';
import { resolveCenterSkills } from './appeal';
import { calculationContext } from './context';
import type { EffectRecorder } from './effects';
export function preparePerformance(p1:Player,p2:Player,song:Song,effects?:EffectRecorder) {
 if(song.rule==='cancelBurst'){
  const cancel=()=>{for(const p of [p1,p2]){
   p.burstCoolBonus=0;p.cuteOnly=false;
   for(const id of p.ids){const s=p.states[id];s.burstActive=false;s.shield=!!s.grantedShield;s.appealReductionShield=false;s.burstSelfAppeal=0;s.activeAutoCarry=0;s.burstDebuff=0;s.muraiDoubleC=false;}
  }};
  if(effects)effects.capture(effects.song('performance'),cancel);else cancel();
 }
 // Immunity is prepared before opposing attributes, fatigue and modifiers.
 for(const p of [p1,p2])for(const id of p.ids)p.states[id].negativeShield=false;
 for(const [p,opp] of [[p1,p2],[p2,p1]]){
  for(const source of p.ids)if(p.states[source].burstActive&&skillFor(source,p).burstPartyShield)
   for(const id of p.ids)if(hasAttr(p,id,'クール')||hasAttr(p,id,'ユーモア'))p.states[id].shield=true;
 }
 for(const [p,opp] of [[p1,p2],[p2,p1]]){
  for(const id of p.ids)if(skillFor(id,p).negativeImmuneOnEntry&&p.enteredThisRoundIds.includes(id)&&autoEnabled(p,opp,id)){
   p.states[id].autoTriggered=true;const targets=p.states[id].muraiDoubleC?idsStage(p):[id];
   for(const target of targets)p.states[target].negativeShield=true;
  }
 }
 const enabled=resolveCenterSkills(p1,p2,song);
 for(const p of [p1,p2])for(const id of p.ids){p.states[id].plain=false;p.states[id].baseAdjustment=0;}
 for(const [i,p,opp] of [[0,p1,p2],[1,p2,p1]] as const)if(enabled[i]){
  const skill=skillFor(p.formation.CENTER,p);
  const apply=()=>{for(const id of opp.ids)if(!opp.states[id].shield&&!opp.states[id].negativeShield){if(skill.plainCenter)opp.states[id].plain=true;if(skill.baseEnemyCenter)opp.states[id].baseAdjustment=1;}};
  if(effects)effects.capture(effects.source(p,p.formation.CENTER,'C','performance'),apply);else apply();
  if(effects&&skill.disableOpponentCenter&&!enabled[1-i]&&!opp.states[opp.formation.CENTER].shield&&byId(opp.formation.CENTER).C)effects.emit(effects.source(p,p.formation.CENTER,'C','performance'),[effects.target(opp,opp.formation.CENTER,'CENTER SKILL無効')]);
 }
 for(const p of [p1,p2])for(const id of p.ids){
  const s=p.states[id],opp=p===p1?p2:p1;s.spentCharge=0;s.swapReduction=0;s.centerTriggered=false;
  if(skillFor(id,p).chargeConsumer && p.enteredThisRoundIds.includes(id)&&autoEnabled(p,opp,id)){
   const consume=()=>{s.spentCharge=s.charge;s.lastSpentCharge=s.charge;s.charge=0;};
   if(effects)effects.capture(effects.source(p,id,'A','performance'),consume);else consume();
  }
 }
 return enabled;
}
export function recordPerformance(p:Player,opp:Player,song:Song) {
 p.performanceBurstCount=[p,opp].reduce((n,t)=>n+t.ids.filter(id=>t.states[id].burstActive).length,0);
 const backs=idsBack(p);p.backGroupStreak=p.previousBackIds&&backs.length===p.previousBackIds.length&&backs.every(id=>p.previousBackIds!.includes(id))?(p.backGroupStreak||0)+1:1;p.previousBackIds=[...backs];
 for(const id of p.ids){const s=p.states[id],pos=posOf(p,id),skill=skillFor(id,p);
  s.stats.positions[pos]++;
  s.positionCounts[pos]=(s.positionCounts[pos]||0)+1;
  if(!s.positionKinds.includes(positionKind(pos)))s.positionKinds.push(positionKind(pos));
  s.samePositionStreak=p.round>1&&pos===s.prevPos?s.samePositionStreak+1:0;
  const t=symmeId(p,id);if(t!==null&&!s.symmetries.includes(t))s.symmetries.push(t);
  s.fatigueAffected=pos!=='BACK'&&s.fatigue>=3;
  s.fatigueStreak=s.fatigueAffected?s.fatigueStreak+1:0;
  s.freshStreak=!s.fatigueAffected?s.freshStreak+1:0;
  if(pos!=='BACK'&&song.type==='キュート')s.cuteRounds++;
  if(countAttr(p,'キュート')===2)s.exactlyTwoCuteRounds++;
  if(skill===skillFor(46,p)&&s.autoTriggered)s.repeatedSongAutos++;
  if(autoEnabled(p,opp,id)&&skill.autoActive?.(calculationContext(p,opp,id,song)))s.autoTriggered=true;
 }
}
export function finishPerformance(p:Player,opp:Player,song:Song,effects?:EffectRecorder){
 for(const id of p.ids){const s=p.states[id],skill=skillFor(id,p);
  if(autoEnabled(p,opp,id)){
   const apply=()=>{if(skill.chargeConsumer&&posOf(p,id)==='BACK'){s.charge=Math.min(5,s.charge+1);s.autoTriggered=true;}skill.post?.(calculationContext(p,opp,id,song));};
   if(effects)effects.capture(effects.source(p,id,'A','post'),apply);else apply();
  }
 }
 for(const id of p.ids){const s=p.states[id];if(s.autoTriggered)s.stats.auto++;if(s.centerTriggered)s.stats.center++;}
 p.songHistory.push(song.type);
 p.noBurstStreak=[p,opp].every(t=>t.ids.every(id=>t.states[id].burstStacks===0))?p.noBurstStreak+1:0;
}
