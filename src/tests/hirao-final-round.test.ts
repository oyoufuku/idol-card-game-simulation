import {expect,it} from 'vitest';
import {clonePlayer,createGame,executeRound,nextRound,preview} from '../game/engine';
import {formationFromArray,posOf} from '../game/formation';
import {setAnalysisSkillMasks} from '../game/analysis-skills';
import {applyBurst,pendingBurst,resolvePendingBursts} from '../game/burst';
import {SKILLS} from '../game/skills';
import {songById} from '../data/songs';
import {setRandomSources} from '../game/random-source';
import {CARD_TEXT} from '../data/card-text';

function hirao(){
 const g=createGame([8,10,18,24,27,44,30,31],[8,10,18,24,27,28,30,31],['A','B','C'],['D','E','F'],'local',()=>.5,{recordEffects:true,interactiveBursts:true});
 g.round=g.p1.round=g.p2.round=2;g.roundSong=songById('A');
 for(const p of [g.p1,g.p2])for(const id of p.ids){p.states[id].normalUsed=true;p.states[id].prevPos=posOf(p,id);}
 g.p1.formation=formationFromArray([8,44,18,24,27]);g.p1.states[44].charge=3;
 return g;
}
it('平尾はCENTERではなく両軍8人の最高疲労を対象にし、BACKSにも消費チャージ×2を適用する',()=>{
 const g=hirao();g.p1.states[8].fatigue=2;g.p1.states[31].fatigue=8;g.p2.states[8].fatigue=1;g.p2.states[31].fatigue=7;
 const before=structuredClone(g),predicted=preview(g);expect(g).toEqual(before);
 expect(predicted.players[0].states[31].fatigue).toBe(2);expect(predicted.players[1].states[31].fatigue).toBe(13);
 expect(predicted.players[0].states[8].fatigue).toBe(2);expect(predicted.players[1].states[8].fatigue).toBe(1);
 expect(predicted.players[0].states[44]).toMatchObject({spentCharge:3,charge:0});
 const actual=executeRound(g);expect([actual.p1.total,actual.p2.total]).toEqual([predicted.p1.total,predicted.p2.total]);
 const effect=g.skillEffects!.find(e=>e.id===44&&e.kind==='A'&&e.targets.some(t=>t.id===31&&t.label==='疲労値'));
 expect(effect?.targets).toEqual(expect.arrayContaining([expect.objectContaining({side:0,id:31,delta:-6}),expect.objectContaining({side:1,id:31,delta:6})]));
 expect(CARD_TEXT[44].A).toContain('最高疲労');
});
it('平尾の同率抽選はカード別の予約乱数を使い、previewを繰り返しても対象・実処理・乱数を変えない',()=>{
 const g=hirao();for(const id of [8,10])g.p1.states[id].fatigue=8;for(const id of [24,27])g.p2.states[id].fatigue=9;
 g.p1.performanceRandomById={[44]:[.99,0]};
 setRandomSources(g,{players:[()=>{throw Error('live P1 RNG');},()=>{throw Error('live P2 RNG');}]});
 const before=structuredClone(g),a=preview(g);for(let n=0;n<3;n++)expect(preview(g)).toEqual(a);expect(g).toEqual(before);
 expect(a.players[0].states[8].fatigue).toBe(8);expect(a.players[0].states[10].fatigue).toBe(2);
 expect(a.players[1].states[24].fatigue).toBe(15);expect(a.players[1].states[27].fatigue).toBe(9);
 expect(executeRound(g).p1.total).toBe(a.p1.total);
});
it('平尾は最高疲労の免疫対象を選んでも別人へ再抽選せず、回復は0未満にならず、AUTO無効なら消費しない',()=>{
 const g=hirao();g.p1.states[31].fatigue=2;g.p2.states[31].fatigue=9;g.p2.states[31].shield=true;g.p2.states[28].fatigue=8;
 const a=preview(g);expect(a.players[0].states[31].fatigue).toBe(0);expect(a.players[1].states[31].fatigue).toBe(9);expect(a.players[1].states[28].fatigue).toBe(8);
 setAnalysisSkillMasks(g.p1,[{id:44,kind:'AUTO'}]);const b=preview(g);
 expect(b.players[0].states[44]).toMatchObject({charge:3,spentCharge:0});expect(b.players[0].states[31].fatigue).toBe(2);
});
it('平尾と山口を同じチームに置いても抽選を別に予約し、公開スナップショットの配列を共有しない',()=>{
 let draw=0;const g=createGame([44,42,8,10,18,24,27,30],[8,10,18,24,27,28,30,31],['A','B','C'],['D','E','F'],'local',()=>++draw/100);
 expect(g.p1.performanceRandomById![44]).toHaveLength(2);expect(g.p1.performanceRandomById![42]).toEqual(g.p1.performanceRandom);
 expect(g.p1.performanceRandomById![44]).not.toEqual(g.p1.performanceRandomById![42]);
 const copy=clonePlayer(g.p1);expect(copy.performanceRandomById).not.toBe(g.p1.performanceRandomById);expect(copy.performanceRandomById![44]).not.toBe(g.p1.performanceRandomById![44]);
});
it.each([false,true])('R7終了時には条件関数・通常/強制/反応BURSTを実行せず、UI/CPUとも即終了する（interactive=%s）',interactive=>{
 const g=createGame([6,12,41,47,48,13,16,44],[7,19,8,10,18,24,27,30],['A','B','C'],['D','E','F'],'local',()=>.5,{recordEffects:true,interactiveBursts:interactive});
 g.round=g.p1.round=g.p2.round=7;g.roundSong=songById('A');g.cpuBoth=!interactive;
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].burstCount=1;
 const condition=SKILLS.nakashima.condition!;let calls=0;SKILLS.nakashima.condition=c=>{calls++;return condition(c);};
 try{
  executeRound(g);expect(calls).toBe(0);expect(g.done).toBe(true);expect(g.result?.final).toBeTruthy();expect(pendingBurst(g)).toBeUndefined();
  for(const p of [g.p1,g.p2])for(const id of p.ids){expect(p.states[id].burstCount).toBe(1);expect(p.states[id].forcedBurstCount).toBe(0);expect(p.states[id].stats.ready).toBe(0);}
  expect(g.skillEffects!.filter(e=>e.phase==='burst')).toEqual([]);
  const before=structuredClone(g);applyBurst(g,g.p1,g.p2,48,true);resolvePendingBursts(g);expect(g).toEqual(before);
 }finally{SKILLS.nakashima.condition=condition;}
});
it('R6終了時に始まったBURSTはR7計算へ反映し、R7終了後は新たに開始しない',()=>{
 const g=createGame([11,8,10,18,24,27,28,30],[8,10,18,24,27,28,30,31],['A','B','C'],['D','E','F'],'local',()=>.5);
 g.round=g.p1.round=g.p2.round=6;g.roundSong=songById('A');g.p1.states[11].positionCounts.CENTER=1;
 executeRound(g);expect(g.p1.states[11].burstCount).toBe(1);nextRound(g,()=>.5);
 const a=preview(g);expect(a.p1.members.find(m=>m.id===11)!.breakdown).toContainEqual(expect.objectContaining({sourceId:11,kind:'B',amount:2}));
 const counts=[g.p1,g.p2].flatMap(p=>p.ids.map(id=>p.states[id].burstCount));executeRound(g);
 expect([g.p1,g.p2].flatMap(p=>p.ids.map(id=>p.states[id].burstCount))).toEqual(counts);expect(g.done).toBe(true);
});
