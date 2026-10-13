import type { Formation, Game, Outcome } from './types';
import { setFormation, validateFormation } from './formation';
import { createCpuPreview } from './engine';
import { cpuCandidates,type CpuSearchOptions } from './cpu-search';
export { permutations5 } from './cpu-candidates';
import { applyFatigueAndPost } from './fatigue';
import { resolveCenterSkills } from './appeal';
import { scoreRound } from './scoring';
export interface CpuEvaluation {formation:Formation;total:number;opponentTotal:number;points:number;outcome:number;difference:number;fatigue:number}
export function compareCpuEvaluations(a:Pick<CpuEvaluation,'points'|'outcome'|'difference'|'fatigue'>,b:Pick<CpuEvaluation,'points'|'outcome'|'difference'|'fatigue'>){return a.points-b.points||a.outcome-b.outcome||a.difference-b.difference||b.fatigue-a.fatigue;}
// Only the public round-start state is visible. Neither player's uncommitted
// edits or the other CPU's proposed formation enter this shared evaluator.
export function evaluateCpuFormation(game:Game, side:1|2, random= Math.random,search:CpuSearchOptions={}){
 const publicPlayers=game.publicPlayers;
 if(!publicPlayers)throw new Error('公開済みラウンド開始状態がありません');
 const view={...game,p1:publicPlayers[0],p2:publicPlayers[1]},player=side===1?view.p1:view.p2;
 const predict=createCpuPreview(view,false,side);
 let best:CpuEvaluation|null=null,checked=0,ties=0;
 for(const formation of cpuCandidates(view,side,search)){
  if(validateFormation(player,formation))continue;
  const prediction=predict(side===1?formation:view.p1.formation,side===2?formation:view.p2.formation);
  const total=side===1?prediction.p1.total:prediction.p2.total,opponentTotal=side===1?prediction.p2.total:prediction.p1.total;
  const score=scoreRound(total,opponentTotal,game.round),points=score.winner===1?score.points:0,outcome=score.winner===1?1:score.winner===2?-1:0,difference=total-opponentTotal;
  checked++;
  if(best&&(points<best.points||(points===best.points&&outcome<best.outcome)||(points===best.points&&outcome===best.outcome&&difference<best.difference)))continue;
  // Reuse actual deterministic end-of-performance fatigue processing. Random
  // resets do not change fatigue and are intentionally not consumed here.
  const [p1,p2]=prediction.players,[c1,c2]=resolveCenterSkills(p1,p2,game.roundSong);
  const o1:Outcome=prediction.p1.total>prediction.p2.total?'win':prediction.p1.total<prediction.p2.total?'loss':'draw';
  applyFatigueAndPost(p1,p2,o1,c1,game.roundSong);applyFatigueAndPost(p2,p1,o1==='win'?'loss':o1==='loss'?'win':'draw',c2,game.roundSong);
  const p=prediction.players[side-1],fatigue=p.ids.reduce((n,id)=>n+p.states[id].fatigue,0); const candidate:CpuEvaluation={formation,total,opponentTotal,points,outcome,difference,fatigue};
  const comparison=best?compareCpuEvaluations(candidate,best):1;
  if(comparison>0){best=candidate;ties=1;}else if(comparison===0){ties++;if(random()<1/ties)best=candidate;}
 }
 if(!best)throw new Error('CPUが合法な配置を見つけられませんでした。');
 return {...best,formation:{...best.formation},checked};
}
export function cpuChooseBestFormation(game: Game) {
 if(!game.cpuMode||game.done||game.roundResolved)throw new Error('CPU配置を決定できません。');
 const best=evaluateCpuFormation(game,2);
 setFormation(game.p2,best.formation,game.round);game.cpuLocked=true;
 game.logs.push(`CPU配置決定：${best.checked}候補 / 予測 ${best.points}pt / Appeal差 ${best.difference}`);
 return best;
}
/** Apply the same public-information evaluator to the player currently being edited. */
export function recommendPlayerFormation(game: Game, side: 1 | 2, random = Math.random) {
 if(game.done||game.roundResolved||(game.cpuMode&&side===2))throw new Error('おすすめ配置はプレイヤーの配置中のみ使用できます。');
 const best=evaluateCpuFormation(game,side,random),player=side===1?game.p1:game.p2;
 setFormation(player,best.formation,game.round);
 if(game.cpuMode)game.cpuLocked=false;
 game.logs.push(`${player.label} おすすめ配置：${best.checked}候補 / 公開済み配置で予測 ${best.points}pt / Appeal差 ${best.difference}`);
 return best;
}
