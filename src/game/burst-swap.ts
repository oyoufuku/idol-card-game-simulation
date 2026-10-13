import type {Game,Player,Outcome} from './types';
import {idsBack,posOf,validateFormation} from './formation';
import {clonePlayer,preview} from './engine';
import {resolveCenterSkills} from './appeal';
import {applyFatigueAndPost} from './fatigue';
import {scoreRound} from './scoring';
import {compareCpuEvaluations,type CpuEvaluation} from './cpu';
export function chargeBackCandidates(p:Player,id:number){
 const slot=posOf(p,id);
 return slot==='BACK'?[]:idsBack(p).filter(target=>!validateFormation(p,{...p.formation,[slot]:target}));
}
// Both formations are revealed at performance end. The next song is unknown:
// compare legal swaps using only this revealed state and the current song.
export function chooseChargeBackTarget(game:Game,p:Player,id:number,random:()=>number){
 const candidates=chargeBackCandidates(p,id);if(!candidates.length)return 0;
 const side=p===game.p1?0:1,round=Math.min(7,game.round+1);
 const players=[clonePlayer(game.p1),clonePlayer(game.p2)] as const;
 for(const player of players)player.round=round;
 const view={...game,p1:players[0],p2:players[1],round},slot=posOf(p,id);
 let best:CpuEvaluation|undefined,target=0,ties=0;
 for(const candidate of candidates){
  const formation={...p.formation,[slot]:candidate};
  const prediction=preview(view,side===0?formation:view.p1.formation,side===1?formation:view.p2.formation,false);
  const own=side===0?prediction.p1:prediction.p2,opp=side===0?prediction.p2:prediction.p1,score=scoreRound(own.total,opp.total,round);
  const [a,b]=prediction.players,[ca,cb]=resolveCenterSkills(a,b,game.roundSong);
  const outcome:Outcome=prediction.p1.total>prediction.p2.total?'win':prediction.p1.total<prediction.p2.total?'loss':'draw';
  applyFatigueAndPost(a,b,outcome,ca,game.roundSong);applyFatigueAndPost(b,a,outcome==='win'?'loss':outcome==='loss'?'win':'draw',cb,game.roundSong);
  const evaluation:CpuEvaluation={formation,total:own.total,opponentTotal:opp.total,points:score.winner===1?score.points:0,outcome:score.winner===1?1:score.winner===2?-1:0,difference:own.total-opp.total,fatigue:prediction.players[side].ids.reduce((n,member)=>n+prediction.players[side].states[member].fatigue,0)};
  const comparison=best?compareCpuEvaluations(evaluation,best):1;
  if(comparison>0){best=evaluation;target=candidate;ties=1;}else if(comparison===0&&random()<1/++ties)target=candidate;
 }
 return target;
}
