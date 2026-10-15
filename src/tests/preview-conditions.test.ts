import {expect,it} from 'vitest';
import {IDOLS} from '../data/idols';
import {SONGS,songById} from '../data/songs';
import {createGame,clonePlayer,createCpuPreview,executeRound,preview} from '../game/engine';
import {formationFromArray,posOf} from '../game/formation';
import {setAnalysisSkillMasks} from '../game/analysis-skills';
import {cpuCandidates,type CoarseEvaluation} from '../game/cpu-search';
import {battlePlayers} from '../components/battle-view';
import {prng} from '../simulation/random';
import type {Game} from '../game/types';

const make=(enemy=[8,10,18,24,27,9,32,13])=>createGame([8,10,18,24,27,9,32,48],enemy,['A','B','C'],['D','E','F'],'local',()=>.5,{interactiveBursts:true});
function isolate(game:Game,id:number) {
 setAnalysisSkillMasks(game.p1,game.p1.ids.filter(other=>other!==id).map(other=>({id:other,kind:'ALL'})));
 setAnalysisSkillMasks(game.p2,game.p2.ids.map(other=>({id:other,kind:'ALL'})));
}
function secondRound(game:Game) {game.round=2;game.p1.round=game.p2.round=2;}
function verifyExecution(game:Game) {
 const before=structuredClone(game),prediction=preview(game),cpu=createCpuPreview(game)();
 expect(cpu.p1.total).toBe(prediction.p1.total);expect(cpu.p2.total).toBe(prediction.p2.total);
 expect(cpu.p1.members.map(m=>m.val)).toEqual(prediction.p1.members.map(m=>m.val));
 expect(cpu.p2.members.map(m=>m.val)).toEqual(prediction.p2.members.map(m=>m.val));
 expect(game).toEqual(before);
 const actual=executeRound(game);
 expect(actual.p1).toEqual(prediction.p1);expect(actual.p2).toEqual(prediction.p2);
 return prediction;
}
function coarse(game:Game) {
 // A single legal candidate isolates the value being tested from team search.
 for(const id of game.p1.ids)game.p1.states[id].lockedPos=posOf(game.p1,id);
 let result:CoarseEvaluation|undefined;
 const candidates=cpuCandidates(game,1,{mode:'two-stage',previewCandidates:100},value=>{
  result=value;return [value.points,value.outcome,value.difference,-value.fatigue];
 });
 expect(candidates).toHaveLength(1);return result!;
}

it('村井Cと移動楽曲は編集中の候補からBACKS登場を再計算し、UI/CPU/実行が一致する',()=>{
 const game=make();secondRound(game);isolate(game,9);game.roundSong=songById('F');
 const formation=formationFromArray([9,32,48,24,27]);
 // UI edits the formation directly; previous positions and public state stay intact.
 game.p1.formation=formation;expect(game.p1.enteredThisRoundIds).toEqual([]);
 game.publicPlayers=[clonePlayer(game.p1),clonePlayer(game.p2)];
 const [p1,p2]=battlePlayers(game,0),shown=preview({...game,p1,p2});
 expect(shown.players[0].enteredThisRoundIds).toEqual([9,32,48]);
 for(const id of [9,32,48])expect(shown.p1.members.find(m=>m.id===id)!.breakdown).toEqual(expect.arrayContaining([
  expect.objectContaining({sourceId:9,kind:'C',amount:1}),expect.objectContaining({kind:'曲',amount:1}),
 ]));
 for(const id of [24,27])expect(shown.p1.members.find(m=>m.id===id)!.breakdown!.some(m=>m.kind==='C'||m.kind==='曲')).toBe(false);
 const predicted=verifyExecution(game);expect(predicted.p1).toEqual(shown.p1);
});

it.each(['B','D'])('村井の登場免疫は曲%sの減算/疲労倍率にも適用し、概算も過小評価しない',song=>{
 const game=make();secondRound(game);isolate(game,9);game.roundSong=songById(song);
 game.p1.formation=formationFromArray([9,10,18,24,27]);game.p1.states[9].fatigue=4;
 const prediction=preview(game),murai=prediction.p1.members.find(m=>m.id===9)!;
 expect(murai.val).toBe(6); // base4 + CENTER2 + entry C1 - existing fatigue1
 expect(prediction.players[0].states[9].negativeShield).toBe(true);
 expect(coarse(game).total).toBe(prediction.p1.total);verifyExecution(game);
});

it('R1の初期配置・ステージ内移動には村井の登場A/Cを付けない',()=>{
 for(const round of [1,2]){
  const game=make();game.round=game.p1.round=game.p2.round=round;isolate(game,9);game.roundSong=songById('B');
  game.p1.states[9].prevPos=round===1?'BACK':'FRONT-L';game.p1.formation=formationFromArray([9,10,18,24,27]);
  const prediction=preview(game);expect(prediction.players[0].states[9].negativeShield).toBe(false);
  expect(prediction.p1.members.find(m=>m.id===9)!.val).toBe(5);verifyExecution(game);
 }
});

it('村井BURSTの全員免疫と固定Bの減算も概算に反映し、自軍Cの減算は免疫対象にしない',()=>{
 const party=make();secondRound(party);isolate(party,9);party.roundSong=songById('B');
 party.p1.formation=formationFromArray([9,10,18,24,27]);
 party.p1.states[9].burstActive=true;party.p1.states[9].burstStacks=1;party.p1.states[9].muraiDoubleC=true;
 party.p1.states[10].burstDebuff=-4;
 const prediction=preview(party);
 expect(Object.values(party.p1.formation).every(id=>prediction.players[0].states[id].negativeShield)).toBe(true);
 expect(coarse(party).total).toBe(prediction.p1.total);verifyExecution(party);
 const own=make();secondRound(own);own.roundSong=songById('B');
 own.p1.ids[0]=5;delete own.p1.states[8];own.p1.states[5]={...own.p1.states[10],id:5};
 own.p1.formation=formationFromArray([5,9,18,24,27]);
 setAnalysisSkillMasks(own.p1,own.p1.ids.filter(id=>id!==9).map(id=>({id,kind:id===5?'AUTO':'ALL'})));
 setAnalysisSkillMasks(own.p2,own.p2.ids.map(id=>({id,kind:'ALL'})));
 const actual=preview(own);expect(actual.p1.members.find(m=>m.id===9)!.val).toBe(4); // base4+FRONT1-own C1; song is blocked
 expect(coarse(own).total).toBe(actual.p1.total);verifyExecution(own);
});

it.each([3,1,5])('村井の登場免疫は相手カード%iのA/B/C減算も概算に反映する',enemy=>{
 const game=make([enemy,10,18,24,27,9,32,13]);secondRound(game);isolate(game,9);game.roundSong=songById('A');
 game.p1.formation=formationFromArray([9,10,18,24,27]);
 setAnalysisSkillMasks(game.p2,game.p2.ids.map(id=>({id,kind:id!==enemy?'ALL':enemy===3?'BURST':'AUTO'})));
 if(enemy===1){game.p2.states[1].burstActive=true;game.p2.states[1].burstStacks=1;}
 const prediction=preview(game);expect(prediction.p1.members.find(m=>m.id===9)!.val).toBe(7);
 expect(coarse(game).total).toBe(prediction.p1.total);verifyExecution(game);
});

it.each([false,true])('村井の登場免疫は石塚BのFRONT位置ボーナス無効も防ぐ（全員免疫=%s）',party=>{
 const game=make([34,10,18,24,27,9,32,13]);secondRound(game);isolate(game,9);game.roundSong=songById('A');
 game.p1.formation=formationFromArray([8,9,18,24,27]);
 setAnalysisSkillMasks(game.p2,game.p2.ids.map(id=>({id,kind:id===34?'AUTO':'ALL'})));
 game.p2.states[34].burstActive=true;game.p2.states[34].burstStacks=1;
 game.p1.states[9].muraiDoubleC=party;game.p1.states[9].burstActive=party;game.p1.states[9].burstStacks=+party;
 const prediction=preview(game);expect(prediction.p1.members.find(m=>m.id===9)!.val).toBe(party?6:5);
 expect(coarse(game).total).toBe(prediction.p1.total);verifyExecution(game);
});

it.each([[1,0,0,3],[2,0,2,3],[2,1,2,0],[2,2,0,0]] as const)('松田好花はR%i・BURST人数%iでA=%i/C=%iを予測する',(round,count,a,c)=>{
 const game=make();game.round=game.p1.round=game.p2.round=round;isolate(game,48);game.roundSong=songById('I');
 game.p1.formation=formationFromArray([48,10,18,24,27]);
 // Cumulative activations / normal-used are deliberately high and unrelated.
 for(const p of [game.p1,game.p2])for(const id of p.ids){p.states[id].burstCount=10;p.states[id].normalUsed=true;}
 if(count>0){game.p1.states[9].burstActive=true;game.p1.states[9].burstStacks=1;} // own BACKS counts too
 if(count>1){game.p2.states[32].burstActive=true;game.p2.states[32].burstStacks=1;} // opposing BACKS counts too
 game.roundSong=songById('A'); // HUMOR Konoka receives no song bonus
 const prediction=preview(game),member=prediction.p1.members.find(m=>m.id===48)!;
 expect(member.autoGain).toBe(a);expect(member.val).toBe(3+2+a+c);
 expect(coarse(game).total).toBe(prediction.p1.total);verifyExecution(game);
});

it('JOYFUL LOVEの解除後のBURST人数を松田好花A/Cへ反映する',()=>{
 const game=make();secondRound(game);isolate(game,48);game.p1.formation=formationFromArray([48,10,18,24,27]);
 game.p1.states[9].burstActive=game.p2.states[32].burstActive=true;game.p1.states[9].burstStacks=game.p2.states[32].burstStacks=1;game.roundSong=songById('V');
 const prediction=preview(game);expect(prediction.p1.members.find(m=>m.id===48)!.val).toBe(10);
 expect(game.p1.states[9].burstActive).toBe(true);expect(coarse(game).total).toBe(prediction.p1.total);verifyExecution(game);
});

it('予測は未確定の相手配置や非公開状態を覗かず、公開済み情報だけを使う',()=>{
 const game=make();secondRound(game);game.roundSong=songById('F');
 game.publicPlayers=[clonePlayer(game.p1),clonePlayer(game.p2)];
 const shown=()=>{const [p1,p2]=battlePlayers(game,0);return preview({...game,p1,p2});};
 const before=shown();game.p2.formation=formationFromArray([...game.p2.ids].reverse());
 for(const id of game.p2.ids){game.p2.states[id].fatigue=999;game.p2.states[id].burstActive=true;}
 expect(shown()).toEqual(before);
});

it('48人×22曲の履歴・疲労・チャージ・BURST状態で通常/CPU previewと実戦Appealが一致する',()=>{
 for(const [index,song] of SONGS.entries())for(const card of IDOLS){
  const roster=[card.id,...IDOLS.filter(other=>other.id!==card.id).map(other=>other.id)].slice(0,8);
  const enemy=Array.from({length:8},(_,i)=>(card.id+23+i)%48+1);
  const game=createGame(roster,enemy,['A','B','C'],['D','E','F'],'local',prng(index*48+card.id),{interactiveBursts:true});
  game.round=2+index%5;game.roundSong=song;
  for(const p of [game.p1,game.p2]){
   p.round=game.round;p.songHistory=['クール','ユーモア'];p.points=p===game.p1?2:4;
   for(const id of p.ids){const s=p.states[id];s.prevPos=(id+index)%3===0?posOf(p,id):'BACK';s.pos=posOf(p,id);
    s.fatigue=(id+index)%8;s.charge=3;s.burstActive=(id+index)%2===0;s.burstStacks=+s.burstActive;s.burstCount=2;s.normalUsed=true;
    s.burstSelfAppeal=s.burstActive?2:0;s.permBonus=1;s.activeNextBonus=1;s.activeAutoCarry=1;
    s.positionCounts.CENTER=2;s.positionKinds=['CENTER','FRONT'];s.samePositionStreak=2;s.symmetries=[p.ids[1]];
   }
  }
  verifyExecution(game);
 }
},20000);
