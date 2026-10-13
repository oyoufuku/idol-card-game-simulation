import type { Outcome, Player, Song } from './types';
import { SLOTS } from './types';
import { autoEnabled, clamp0, hasAttr, idsBack, idsStage, POSITION_FATIGUE, posOf, positionKind } from './formation';
import { skillFor } from './skills';
import { calculationContext } from './context';
import type { EffectRecorder } from './effects';
const ignoreLog = (_message:string) => {};
function fatigueSnapshot(p:Player,opp:Player) {
  const values:number[]=[];
  for(const id of p.ids)values.push(p.states[id].fatigue);
  for(const id of opp.ids)values.push(opp.states[id].fatigue);
  return values;
}
function fatigueChanged(before:number[],p:Player,opp:Player) {
  let index=0;
  for(const id of p.ids)if(before[index++]!==p.states[id].fatigue)return true;
  for(const id of opp.ids)if(before[index++]!==opp.states[id].fatigue)return true;
  return false;
}
export function fatiguePenalty(value: number, fatigue: number, multiplier = 1, relief = 0) {
  const base = Math.max(0, value), penalty = fatigue >= 7 ? 3 : fatigue >= 5 ? 2 : fatigue >= 3 ? 1 : 0;
  return Math.max(0, base - Math.max(0, penalty * multiplier - relief));
}
export function applySongFatigue(p: Player, song: Song, opp?:Player) {
  if (song.rule === 'recoverAll') p.ids.forEach(id => p.states[id].fatigue = clamp0(p.states[id].fatigue - 1));
  if(song.rule==='moved'&&p.round>1)p.ids.filter(id=>posOf(p,id)!=='BACK'&&positionKind(posOf(p,id))!==positionKind(p.states[id].prevPos)&&!p.states[id].negativeShield).forEach(id=>{if(opp)increaseFatigue(p,opp,id,2);else p.states[id].fatigue+=2;});
  if (song.rule === 'nonHumorFatigue') idsStage(p).forEach(id => { if (!hasAttr(p, id, 'ユーモア')&&!p.states[id].negativeShield) if(opp)increaseFatigue(p,opp,id,1);else p.states[id].fatigue++; });
}
export function applyPrePerformance(p: Player, opp: Player, song: Song, cEnabled: boolean, log: (s: string) => void = ignoreLog, songAlreadyApplied = false, effects?:EffectRecorder) {
  if (!songAlreadyApplied) applySongFatigue(p, song, opp);
  p.ids.forEach(id => { const pre=skillFor(id,p).pre;if (autoEnabled(p, opp, id) && pre) {
    const before=fatigueSnapshot(p,opp);let draw=0;const ctx={...calculationContext(p,opp,id,song,log),random:()=>p.performanceRandom?.[draw++]??0};
    if(effects)effects.capture(effects.source(p,id,'A','performance'),()=>pre(ctx));else pre(ctx);
    if(fatigueChanged(before,p,opp))p.states[id].autoTriggered=true;
  } });
  const centerPre=skillFor(p.formation.CENTER,p).centerPre;
  if (cEnabled && centerPre) {
    const before=fatigueSnapshot(p,opp),ctx=calculationContext(p,opp,p.formation.CENTER,song,log);
    if(effects)effects.capture(effects.source(p,p.formation.CENTER,'C','performance'),()=>centerPre(ctx));else centerPre(ctx);
    if(fatigueChanged(before,p,opp))p.states[p.formation.CENTER].centerTriggered=true;
  }
}
export function applyFatigueAndPost(p: Player, opp: Player, outcome: Outcome, cEnabled: boolean, song: Song, log: (s: string) => void = ignoreLog, effects?:EffectRecorder) {
  if(song.rule==='doubleCurrentFatigue'){
    const apply=()=>p.ids.forEach(id=>{if(!p.states[id].negativeShield)increaseFatigue(p,opp,id,p.states[id].fatigue);});
    if(effects)effects.capture(effects.song('post'),apply);else apply();
  }
  SLOTS.forEach(slot => { const id = p.formation[slot],enabled=autoEnabled(p,opp,id),reduction=enabled?skillFor(id,p).fatigueReduction||0:0,multiplier=enabled?skillFor(id,p).positionMultiplier||1:1;
    if(enabled&&skillFor(id,p).fatigueReduction)p.states[id].autoTriggered=true;
    const enemyMultiplier=p.states[id].shield||p.states[id].negativeShield?1:opp.ids.reduce((n,source)=>opp.states[source].burstActive?n*(skillFor(source,opp).enemyPositionFatigueMultiplier||1):n,1);
    const increase=Math.max(0,POSITION_FATIGUE[slot]-reduction)*multiplier*enemyMultiplier;p.states[id].fatigue+=increase;
    const prevented=Math.max(0,POSITION_FATIGUE[slot]*multiplier-Math.max(0,POSITION_FATIGUE[slot]-reduction)*multiplier);
    if(effects&&enemyMultiplier>1)for(const source of opp.ids)if(opp.states[source].burstActive&&skillFor(source,opp).enemyPositionFatigueMultiplier)effects.emit(effects.source(opp,source,'B','post'),[effects.target(p,id,'ポジション疲労増加',increase-increase/enemyMultiplier)]);
    if(effects&&prevented)effects.emit(effects.source(p,id,'A','post'),[effects.target(p,id,'疲労増加軽減',-prevented)]);
  });
  idsBack(p).forEach(id => p.states[id].fatigue = clamp0(p.states[id].fatigue - 2));
  const centerLoss=skillFor(p.formation.CENTER,p).centerLoss;
  if (outcome === 'loss' && cEnabled && centerLoss) {const ctx=calculationContext(p,opp,p.formation.CENTER,song,log);
    if(effects)effects.capture(effects.source(p,p.formation.CENTER,'C','post'),()=>centerLoss(ctx));else centerLoss(ctx);
    p.states[p.formation.CENTER].centerTriggered=true;
  }
  for(const id of p.ids)if(p.states[id].burstStacks>0){const post=skillFor(id,p).postFatigue;if(post){const ctx=calculationContext(p,opp,id,song,log);if(effects)effects.capture(effects.source(p,id,'B','post'),()=>post(ctx));else post(ctx);}}
}
export function estimateFutureFatigue(p: Player, opp?: Player) {
  return SLOTS.reduce((sum, slot) => { const id = p.formation[slot]; return sum + p.states[id].fatigue + Math.max(0, POSITION_FATIGUE[slot] - ((!opp || autoEnabled(p, opp, id)) ? skillFor(id,p).fatigueReduction || 0 : 0)); }, 0)
    + idsBack(p).reduce((sum, id) => sum + clamp0(p.states[id].fatigue - 2), 0);
}

export function increaseFatigue(p:Player,opp:Player,id:number,amount:number){
 const reduction=autoEnabled(p,opp,id)?skillFor(id,p).fatigueReduction||0:0;
 if(amount>0&&reduction)p.states[id].autoTriggered=true;
 p.states[id].fatigue+=Math.max(0,amount-reduction);
}
