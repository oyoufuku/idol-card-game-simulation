import { skillEnabled } from './analysis-skills';
import { SLOTS,type Formation,type Game,type Player,type AppealEffect } from './types';
import { formationCandidates } from './cpu-candidates';
import { autoEnabled,baseAppeal,byId,POSITION_BONUS,posOf,validateFormation } from './formation';
import { prepareCpuEstimate } from './engine';
import { resolveCenterSkills,songAppealEffects } from './appeal';
import { fatiguePenalty } from './fatigue';
import { skillFor } from './skills';
import { calculationContext } from './context';
import { scoreRound } from './scoring';
export interface CpuSearchOptions {mode?:'exhaustive'|'two-stage';previewCandidates?:number}
export const TWO_STAGE_POLICY='two-stage-v2-entry-immunity';
export function cpuSearchConfiguration(options:CpuSearchOptions={}) {
 const mode=options.mode??'exhaustive';
 if(mode!=='exhaustive'&&mode!=='two-stage')throw new Error('cpu-search は exhaustive / two-stage');
 const previewCandidates=options.previewCandidates??200;
 if(!Number.isInteger(previewCandidates)||previewCandidates<100||previewCandidates>300)throw new Error('preview-candidates は100〜300の整数');
 return {mode,previewCandidates,policy:TWO_STAGE_POLICY};
}
export interface CoarseEvaluation {formation:Formation;players:readonly [Player,Player];total:number;opponentTotal:number;points:number;outcome:number;difference:number;fatigue:number}
// Ranking heuristic, never the outcome of a game: reuse real preparation,
// position/fatigue helpers and skill/song hooks. Sum their raw effects instead
// of executing full modifier resolution/copy AUTO/end-fatigue/BURST forecast.
// Final selection and every played round still use the real preview/engine.
function estimate(view:Game,side:1|2,formation:Formation):CoarseEvaluation {
 const players=prepareCpuEstimate(view,side===1?formation:view.p1.formation,side===2?formation:view.p2.formation),enabled=resolveCenterSkills(...players,view.roundSong);
 const values:[Record<number,number>,Record<number,number>]=[{},{}];
 const add=(side:number,opp:number,effects:AppealEffect[],kind:'A'|'B'|'C'|'曲')=>{for(const e of effects){
  const target=e.opponent?opp:side,id=e.id;if(values[target][id]===undefined)continue;
  const state=players[target].states[id];
  // Entry immunity is already prepared by the shared engine. Keep its actual
  // target scope: enemy effects / song penalties, rather than all own effects.
  if(e.opponent&&(state.shield||(e.amount<0&&(state.negativeShield||state.appealReductionShield))))continue;
  if(kind==='曲'&&e.amount<0&&state.negativeShield)continue;
  values[target][id]+=e.amount;
 }};
 for(const [index,p] of players.entries()){
  const opp=players[1-index],center=skillFor(p.formation.CENTER,p),ctx=calculationContext(p,opp,p.formation.CENTER,view.roundSong),bonus=enabled[index]?center.centerPositionBonus?.(ctx)||0:0;
  for(const slot of SLOTS){const id=p.formation[slot],s=p.states[id],on=autoEnabled(p,opp,id),facing=opp.formation[slot];
   let position=POSITION_BONUS[slot]+bonus;
   if(view.roundSong.rule==='middleBonus'&&slot.startsWith('MIDDLE'))position+=byId(id).skill==='yamashita_haruka'&&skillEnabled(p,id,'BURST')&&s.burstActive?4:2;
   for(const source of p.ids)if(p.states[source].burstActive)position*=skillFor(source,p).positionTeamMultiplier||1;
   if(!s.shield&&!s.negativeShield&&((autoEnabled(opp,p,facing)&&skillFor(facing,opp).cancelOppositePosition)||(slot.startsWith('FRONT')&&opp.ids.some(i=>opp.states[i].burstActive&&skillFor(i,opp).cancelEnemyFront))))position=0;
   if(on)position*=skillFor(id,p).positionMultiplier||1;
   const fixedDebuff=s.shield||(s.burstDebuff<0&&(s.negativeShield||s.appealReductionShield))?0:s.burstDebuff;
   values[index][id]=baseAppeal(p,id)+position+s.burstSelfAppeal+s.activeNextBonus+fixedDebuff+(byId(id).skill==='moriya'?0:s.activeAutoCarry);
  }
 }
 for(const [index,p] of players.entries()){
  const oppIndex=1-index,opp=players[oppIndex];
  for(const id of p.ids){const s=p.states[id],skill=skillFor(id,p),ctx=calculationContext(p,opp,id,view.roundSong);
   if(autoEnabled(p,opp,id)){if(posOf(p,id)!=='BACK')values[index][id]+=skill.autoAppeal?.(ctx)||0;add(index,oppIndex,skill.autoEffects?.(ctx)||[],'A');}
   if(s.burstActive)add(index,oppIndex,skill.burstEffects?.(ctx)||[],'B');
   if(byId(id).skill==='moriya'&&s.activeAutoCarry){const target=posOf(p,id)==='BACK'?null:opp.formation[posOf(p,id) as keyof Formation];if(target!==null)add(index,oppIndex,[{id:target,opponent:true,amount:-s.activeAutoCarry}],'B');}
  }
  if(enabled[index]){const id=p.formation.CENTER,skill=skillFor(id,p),ctx=calculationContext(p,opp,id,view.roundSong);
   for(const target of SLOTS.map(s=>p.formation[s]))values[index][target]+=skill.centerAppeal?.(ctx,target)||0;
   add(index,oppIndex,skill.centerEffects?.(ctx)||[],'C');
  }
  add(index,oppIndex,songAppealEffects(p,opp,view.roundSong),'曲');
 }
 const totals=players.map((p,index)=>SLOTS.reduce((sum,slot)=>{const id=p.formation[slot],multiplier=(view.roundSong.rule==='doubleFatigue'&&!p.states[id].negativeShield?2:1)*(autoEnabled(p,players[1-index],id)?skillFor(id,p).positionMultiplier||1:1);return sum+fatiguePenalty(values[index][id],p.states[id].fatigue,multiplier,view.roundSong.rule==='fatigueRelief'?1:0);},0));
 const total=totals[side-1],opponentTotal=totals[2-side],score=scoreRound(total,opponentTotal,view.round);
 return {formation,players,total,opponentTotal,points:score.winner===1?score.points:0,outcome:score.winner===1?1:score.winner===2?-1:0,difference:total-opponentTotal,fatigue:players[side-1].ids.reduce((sum,id)=>sum+players[side-1].states[id].fatigue,0)};
}
export function cpuCandidates(view:Game,side:1|2,options:CpuSearchOptions={},rank?:(estimate:CoarseEvaluation)=>number[]):readonly Formation[] {
 const configuration=cpuSearchConfiguration(options),p=side===1?view.p1:view.p2,candidates=formationCandidates(p.ids);
 if(configuration.mode==='exhaustive')return candidates;
 const rows: {formation:Formation;order:number;score:number[]}[]=[];
 for(const [order,formation] of candidates.entries()){
  if(validateFormation(p,formation))continue;
  const e=estimate(view,side,formation),score=rank?rank(e):[e.points,e.outcome,e.difference,-e.fatigue];
  if(!score.every(Number.isFinite))throw new Error('二段階評価の概算値が不正です');
  rows.push({formation,order,score});
 }
 rows.sort((a,b)=>{for(let i=0;i<a.score.length;i++){const d=b.score[i]-a.score[i];if(d)return d;}return a.order-b.order;});
 // Stable original order for final reservoir tie breaking; ranking uses no RNG.
 return rows.slice(0,configuration.previewCandidates).sort((a,b)=>a.order-b.order).map(row=>row.formation);
}
