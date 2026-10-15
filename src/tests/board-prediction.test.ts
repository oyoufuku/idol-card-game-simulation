import {expect,it} from 'vitest';
import {IDOLS} from '../data/idols';
import {createGame,clonePlayer,executeRound} from '../game/engine';
import {applyBurst} from '../game/burst';
import {formationFromArray} from '../game/formation';
import {songById} from '../data/songs';
import {battlePrediction} from '../components/battle-view';
import {optimizationCases} from './helpers/engine-optimization-cases';

it('画面の予測は48人の代表AUTO/C/B状態で、相手の公開配置が同じなら実パフォーマンスと一致する',()=>{
 for(const card of IDOLS){
  const own=[card.id,...IDOLS.filter(c=>c.id!==card.id).map(c=>c.id)].slice(0,8),enemy=[7,19,21,26,34,36,42,48];
  const g=createGame(own,enemy,['A','B','C'],['D','E','F'],'local',()=>.5);g.cpuBoth=true;g.round=g.p1.round=g.p2.round=4;g.roundSong=songById('A');
  for(const p of [g.p1,g.p2])for(const id of p.ids){p.states[id].fatigue=id%8;p.states[id].charge=4;p.states[id].prevPos='BACK';}
  applyBurst(g,g.p1,g.p2,card.id,true,()=>.5);g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
  const before=structuredClone(g),prediction=battlePrediction(g,0)!;expect(g,card.name).toEqual(before);
  const actual=executeRound(g,g.p1.formation,g.p2.formation,()=>.5);
  expect([prediction.p1,prediction.p2],card.name).toEqual([actual.p1,actual.p2]);
 }
});
it('全22曲・44盤面とP1/P2の両方で、画面予測の数値・内訳を実処理と照合する',()=>{
 for(const {name,game} of optimizationCases()){
  game.publicPlayers=[clonePlayer(game.p1),clonePlayer(game.p2)];
  const a=battlePrediction(game,0)!,b=battlePrediction(game,1)!;
  const result=executeRound(game,game.p1.formation,game.p2.formation,()=>.5);
  expect([a.p1,a.p2],name).toEqual([result.p1,result.p2]);expect([b.p1,b.p2],name).toEqual([result.p1,result.p2]);
  for(const team of [a.p1,a.p2])for(const m of team.members)expect(m.breakdown!.reduce((sum,e)=>sum+e.amount,0),name).toBe(m.val);
 }
});
it('相手の未確定配置・疲労を覗かず、自分の配置変更と登場を反映する。確定後は実結果を返す',()=>{
 const g=createGame([9,8,10,18,24,27,28,30],[7,19,21,26,34,36,42,48],['A','B','C'],['D','E','F'],'local',()=>.5);
 g.round=g.p1.round=g.p2.round=2;g.p1.states[9].prevPos='BACK';g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
 const a=battlePrediction(g,0)!;g.p2.formation=formationFromArray([...g.p2.ids].reverse());for(const id of g.p2.ids)g.p2.states[id].fatigue=999;
 expect(battlePrediction(g,0)).toEqual(a);
 g.p1.formation=formationFromArray([8,9,10,18,24]);const b=battlePrediction(g,0)!;
 expect(b.p1.members.find(m=>m.id===9)!.slot).toBe('FRONT-L');expect('players' in b&&b.players[0].enteredThisRoundIds).toContain(9);
 g.p2=clonePlayer(g.publicPlayers![1]);executeRound(g);expect(battlePrediction(g,0)).toBe(g.result);
});
