import type { Idol, Player } from '../game/types';
import { posOf } from '../game/formation';
import { MAX_CHARGE } from '../game/charge';
import { skillFor } from '../game/skills';

export type CardProgress = Partial<Record<'A'|'Bcond'|'B'|'C', string>>;
/** Read the engine's completed-performance counters; never predict a success
 * from an uncommitted formation, a future song or a hidden opponent. */
export function cardProgress(card:Idol,player?:Player):CardProgress {
 const s=player?.states[card.id];if(!player||!s)return {};
 const pos=posOf(player,card.id),counts=s.positionCounts;
 const stage=Object.entries(counts).reduce((sum,[slot,n])=>sum+(slot==='BACK'?0:n),0);
 const tally=(label:string,n:number,target:number)=>`（現在${label}${n}/${target}）`;
 const cumulative=(n:number,target:number)=>tally('累計',n,target);
 const consecutive=(n:number,target:number)=>tally('連続',n,target);
 const run=pos===s.prevPos&&(counts[pos]||0)>0?s.samePositionStreak+1:0;
 const progress:CardProgress={};
 if(skillFor(card.id).chargeConsumer){
  progress.A=tally('チャージ',s.charge,MAX_CHARGE);
  progress.Bcond=tally('消費',s.spentCharge,3);
  progress.B=`（最終消費${s.lastSpentCharge}）`;
 }
 switch(card.skill){
  case 'ishimori':progress.Bcond=`（出場${stage}/2・A成功${s.autoSuccessRounds||0}/1）`;break;
  case 'endo':progress.Bcond=cumulative(s.fatigueTwoEnds||0,2);break;
  case 'odakura':progress.Bcond=cumulative(stage,2);break;
  case 'kojima':progress.Bcond=cumulative(counts.BACK||0,3);break;
  case 'mukai':progress.Bcond=cumulative(s.stageWins||0,2);break;
  case 'murai':progress.Bcond=tally('登場',player.enteredThisRoundIds.length,3);break;
  case 'yamashita':progress.Bcond=cumulative(counts.CENTER||0,2);break;
  case 'takemoto':progress.Bcond=cumulative(s.coolStageRounds||0,2);break;
  case 'fujiyoshi':progress.Bcond=tally('実上昇',s.lastAppealGain,4);break;
  case 'moriya':progress.Bcond=tally('純減',s.lastOppositeReduction-(s.lastOppositeGain||0),3);break;
  case 'yamasaki':progress.Bcond=consecutive(player.lossStreak,2);break;
  case 'kanemura':progress.Bcond=cumulative(pos==='BACK'?0:counts[pos]||0,4);break;
  case 'konishi':progress.Bcond=tally('シンメ',s.symmetries.length,3);break;
  case 'shogenji':progress.Bcond=consecutive(s.fatigueStreak,3);break;
  case 'hiraoka':progress.Bcond=tally('経験属性',new Set(s.stageSongAttributes||[]).size,3);break;
  case 'kamimura':progress.Bcond=cumulative(s.autoSuccessRounds||0,3);break;
  case 'ishizuka':progress.Bcond=cumulative((counts['FRONT-L']||0)+(counts['FRONT-R']||0),3);break;
  case 'shimizu':progress.Bcond=cumulative(s.qualifiedBackRounds||0,2);break;
  case 'fujishima':progress.Bcond=cumulative(s.cuteRounds,2);break;
  case 'miyachi':progress.Bcond=consecutive(pos==='BACK'?0:run,3);break;
  case 'nibu':progress.Bcond=cumulative(s.stageFreshRounds||0,3);break;
  case 'takeuchi':{
   const backs=player.ids.filter(id=>posOf(player,id)==='BACK');
   const unchanged=player.previousBackIds?.length===backs.length&&backs.every(id=>player.previousBackIds!.includes(id));
   progress.Bcond=consecutive(unchanged?player.backGroupStreak||0:0,2);break;
  }
  case 'yamashita_haruka':progress.Bcond=tally('経験位置',['CENTER','FRONT','MIDDLE'].filter(kind=>s.positionKinds.includes(kind)).length,3);break;
  case 'hamagishi':progress.Bcond=cumulative(s.repeatedSongAutos,2);break;
  case 'tomita':progress.Bcond=tally('BURST経験者',Object.values(player.formation).filter(id=>player.states[id].burstCount>0).length,5);break;
  case 'matsuda_konoka':{
   let rounds=0;for(let r=player.round-1;r>=1&&rounds<2;r--){if(player.burstRounds?.includes(r))break;rounds++;}
   progress.Bcond=consecutive(rounds,2);break;
  }
 }
 return progress;
}
