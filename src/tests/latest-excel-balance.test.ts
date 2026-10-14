import {it,expect} from 'vitest';
import {createGame,executeRound,preview,nextRound,prepareRound,clonePlayer} from '../game/engine';
import {applyBurst,burstTargetOptions,queueBursts,resolveNextBurst,pendingBurst} from '../game/burst';
import {attributesOf,hasAttr,posOf,idsBack,byId,formationFromArray} from '../game/formation';
import {songById} from '../data/songs';
import {skillFor} from '../game/skills';
import {calculationContext} from '../game/context';
import {prng} from '../simulation/random';
import {abilitySemantics} from '../simulation/ability-semantics';
import {generateArchetypes,synergy} from '../simulation/teams';
import {applySongFatigue} from '../game/fatigue';
const eight=(ids:number[])=>[...new Set([...ids,8,10,18,24,27,28,30,31])].slice(0,8);
const make=(a:number[],b:number[]=[8,10,18,24,27,28,30,31])=>{const g=createGame(eight(a),eight(b),['A','B','C'],['D','E','F'],'local',()=>.5);g.roundSong=songById('A');return g;};
it('Make or Breakは非ユーモアのステージだけに疲労を付与する',()=>{
 const g=make([1,3,5,8,10,18,24,27]);applySongFatigue(g.p1,songById('C'),g.p2);
 for(const id of g.p1.ids)expect(g.p1.states[id].fatigue).toBe(posOf(g.p1,id)!=='BACK'&&!hasAttr(g.p1,id,'ユーモア')?1:0);
});
it('指定基礎値と石森・遠藤・小坂の新条件の境界',()=>{
 expect([27,39,40,45,48].map(id=>byId(id).base)).toEqual([4,4,5,2,3]);
 const g=make([1,2,26]);g.p1.states[1].positionCounts.CENTER=2;g.p1.states[1].autoSuccessRounds=1;expect(skillFor(1).condition!(calculationContext(g.p1,g.p2,1,g.roundSong))).toBe(true);
 g.p1.states[2].fatigueTwoEnds=2;expect(skillFor(2).condition!(calculationContext(g.p1,g.p2,2,g.roundSong))).toBe(true);
 g.p1.formation=formationFromArray([26,1,2,8,10]);for(const value of [7,8]){g.p1.states[26].fatigue=value;expect(skillFor(26).condition!(calculationContext(g.p1,g.p2,26,g.roundSong))).toBe(value===8);}
});
it('谷口は8人キュートのみ、PLAIN優先、JOYFULで解除し元の属性へ戻る',()=>{
 const g=make([5,22,41],[36]);applyBurst(g,g.p1,g.p2,22);applyBurst(g,g.p1,g.p2,5);
 for(const id of g.p1.ids)expect(attributesOf(g.p1,id)).toEqual(['キュート']);
 expect(abilitySemantics(byId(5)).multiAttribute).toBe(false);
 expect(preview(g).players[0].ids.every(id=>attributesOf(preview(g).players[0],id).length===0)).toBe(true);
 g.roundSong=songById('V');g.p2.formation=formationFromArray([8,36,10,18,24]);const r=preview(g);expect(attributesOf(r.players[0],22)).toEqual(['キュート','クール','ユーモア']);expect(r.players[0].cuteOnly).toBe(false);
});
it('村井の登場AUTOは属性変更・位置無効・疲労付与・曲減算を防ぎ、通常疲労は適用',()=>{
 const g=make([8,10,18,24,27,9],[36,16,37]);g.round=2;g.p1.round=g.p2.round=2;
 g.p1.formation=formationFromArray([8,9,18,24,27]);g.p1.states[9].fatigue=4;applyBurst(g,g.p2,g.p1,37);g.roundSong=songById('B');
 const r=preview(g),s=r.players[0].states[9],m=r.p1.members.find(m=>m.id===9)!;
 expect(s.fatigue).toBe(4);expect(attributesOf(r.players[0],9)).toEqual(['ユーモア']);expect(m.details).toContain('位置+1');expect(m.details.join('|')).toContain('夏の近道+0');
 g.interactiveBursts=true;executeRound(g);expect(g.p1.states[9].fatigue).toBe(6);expect(g.result!.p1.members.find(m=>m.id===9)!.val).toBe(m.val);
});
it('村井BURSTは登場時に味方ステージ全員へ免疫を展開、BACKSには展開しない',()=>{
 const g=make([8,10,18,24,27,9],[36]);g.round=2;g.p1.round=g.p2.round=2;g.p1.formation=formationFromArray([8,9,18,24,27]);applyBurst(g,g.p1,g.p2,9);
 const p=preview(g).players[0];for(const id of Object.values(p.formation))expect(p.states[id].negativeShield).toBe(true);for(const id of idsBack(p))expect(p.states[id].negativeShield).toBe(false);
});
it('小島Bは交換先へ免疫を与え、清水の継続免疫はJOYFULで解除される',()=>{
 const g=make([4,8],[3,16]);g.targets[0].koji=8;applyBurst(g,g.p1,g.p2,4);expect(g.p1.states[8].shield).toBe(true);g.roundSong=songById('V');expect(preview(g).players[0].states[8].shield).toBe(false);
 const h=make([35,8],[3]);applyBurst(h,h.p1,h.p2,35);expect(preview(h).players[0].states[8].shield).toBe(true);h.roundSong=songById('V');expect(preview(h).players[0].states[8].shield).toBe(false);
});
it('的野はユーモアもAUTO/Cを無効にし、Cで自身疲労+2',()=>{
 const g=make([7],[48]);const r=preview(g);expect(r.p2.members.find(m=>m.id===48)!.details.join('|')).toContain('AUTO無効');expect(r.players[0].states[7].fatigue).toBe(2);
 const h=make([7],[26]);expect(preview(h).players[0].states[7].fatigue).toBe(2);
});
it('藤吉は対面自身のAUTOだけコピーし、A/B/C/曲の合計4でAUTO引継ぎBURST',()=>{
 const g=make([20],[18,28,14]);g.roundSong=songById('A');applyBurst(g,g.p2,g.p1,18);g.p2.states[18].permBonus=20;
 const m=preview(g).p1.members.find(m=>m.id===20)!;expect(m.autoGain).toBe(3);expect(m.skillGain).toBe(4); // 武元自身A3だけコピー。曲1はBURST条件に含む。基礎/位置/Bはコピーしない。
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;g.p1.states[20].normalUsed=false;
 executeRound(g);expect(g.p1.states[20].appealReductionShield).toBe(false);expect(g.p1.states[20].activeAutoCarry).toBe(3);expect(preview(g).p1.members.find(m=>m.id===20)!.details.join('|')).toContain('前回AUTO引継ぎB+3');
});
it('山口のランダム最高疲労対象はpreviewと実処理・seed再現で一致、Cは相手BACKS+3',()=>{
 const g=make([42]);g.p1.states[8].fatigue=4;g.p1.states[10].fatigue=4;g.p2.states[18].fatigue=5;g.p2.states[24].fatigue=5;g.p1.performanceRandom=[.99,0];
 const before=structuredClone(g),r=preview(g);expect(g).toEqual(before);expect(r.players[0].states[10].fatigue).toBe(3);expect(r.players[1].states[18].fatigue).toBe(6);
 for(const id of idsBack(g.p2))expect(r.players[1].states[id].fatigue).toBe(3);
 const h=structuredClone(g);executeRound(g);executeRound(h);expect(g).toEqual(h);
});
it('竹内は同じBACKS集合2回で成立し、並び順を問わず変更時にリセット',()=>{
 const g=make([43]);g.interactiveBursts=true;for(const p of [g.p1,g.p2])for(const id of p.ids)if(id!==43)p.states[id].normalUsed=true;executeRound(g);expect(g.p1.backGroupStreak).toBe(1);nextRound(g);executeRound(g);expect(g.p1.backGroupStreak).toBe(2);expect(pendingBurst(g)?.id).toBe(43);
});
it.each([32,38,44])('チャージ%iはBURSTで最初の合法なBACKSと交換、回復は実消費分',id=>{
 const g=make([id]);g.p1.states[id].lastSpentCharge=4;const first=idsBack(g.p1)[0];applyBurst(g,g.p1,g.p2,id);expect(posOf(g.p1,id)).toBe('BACK');expect(g.p1.formation.CENTER).toBe(first);expect(g.p1.states[id].charge).toBe(4);
 const h=make([id]);for(const back of idsBack(h.p1))h.p1.states[back].lockedPos='BACK';applyBurst(h,h.p1,h.p2,id);expect(posOf(h.p1,id)).toBe('CENTER');
});
it('山下Bは次回開始前に相手ステージ疲労+1、C/アザトカワイイは相手移動/両者移動に疲労+2',()=>{
 const g=make([45],[8]);applyBurst(g,g.p1,g.p2,45);g.interactiveBursts=true;executeRound(g);expect(g.p2.states[8].fatigue).toBe(4);
 const h=make([45]);h.round=2;h.p1.round=h.p2.round=2;h.roundSong=songById('U');h.p2.formation=formationFromArray([8,24,18,10,27]);const r=preview(h);
 expect(r.players[1].states[24].fatigue).toBe(4);expect(r.players[1].states[10].fatigue).toBe(4);expect(r.players[1].states[18].fatigue).toBe(0);
});
it('富田は配置を問わずステージ5人のBURST履歴を参照し、本人もステージなら条件対象',()=>{
 const g=make([47,8,10,18,24,27]);g.p1.formation=formationFromArray([8,10,18,24,27]);
 for(const id of Object.values(g.p1.formation))g.p1.states[id].burstCount=1;
 expect(skillFor(47).condition!(calculationContext(g.p1,g.p2,47,g.roundSong))).toBe(true);
 g.p1.states[27].burstCount=0;expect(skillFor(47).condition!(calculationContext(g.p1,g.p2,47,g.roundSong))).toBe(false);
 g.p1.formation.CENTER=47;g.p1.states[27].burstCount=1;
 expect(skillFor(47).condition!(calculationContext(g.p1,g.p2,47,g.roundSong))).toBe(false);
 g.p1.states[47].burstCount=1;expect(skillFor(47).condition!(calculationContext(g.p1,g.p2,47,g.roundSong))).toBe(true);
});
it('富田はseed再現でステージから異なる3人を強制BURSTし、通常使用済みを消費しない',()=>{
 const start=()=>{const g=make([47,8,10,18,24,27]);g.p1.formation=formationFromArray([8,10,18,24,27]);return g;};
 const g=start(),h=start();applyBurst(g,g.p1,g.p2,47,false,prng(123));applyBurst(h,h.p1,h.p2,47,false,prng(123));expect(g).toEqual(h);
 const chosen=g.p1.ids.filter(id=>g.p1.states[id].forcedBurstCount>0);expect(chosen).toHaveLength(3);
 for(const id of chosen){expect(Object.values(g.p1.formation)).toContain(id);expect(g.p1.states[id].normalUsed).toBe(false);}
 for(const id of idsBack(g.p1).filter(id=>id!==47))expect(g.p1.states[id].burstCount).toBe(0);
 expect(g.p1.states[47].burstCount).toBe(1);expect(g.p1.states[47].forcedBurstCount).toBe(0);
});
it('富田のランダム対象は本人/同一連鎖の発動済みを除外し、候補不足なら残りだけ発動',()=>{
 for(const remaining of [0,1,2]){
  const g=make([47,8,10,18,24,27]);g.p1.formation=formationFromArray([8,10,18,24,27]);
  g.burstTask={side:0,id:47,forced:false,seen:['1:47',...Object.values(g.p1.formation).slice(remaining).map(id=>`1:${id}`)],phase:'burst'};
  g.burstSeen=g.burstTask.seen;const targets:number[]=[];let draws=0;
  skillFor(47).burst({...calculationContext(g.p1,g.p2,47,g.roundSong),game:g,random:()=>{draws++;return 0;},burst:id=>targets.push(id)});
  expect(targets).toEqual(Object.values(g.p1.formation).slice(0,remaining));expect(draws).toBe(remaining);
 }
});
it('手動強制対象と循環除外',()=>{
 const h=make([48,7]);h.interactiveBursts=true;queueBursts(h,[48],[]);resolveNextBurst(h,7);expect(pendingBurst(h)?.id).toBe(7);expect(burstTargetOptions(h,pendingBurst(h)!)).toEqual(h.p2.ids);
});
it('田村は対スキルで加点、BURST・多属性の意味誤認なし、27チームはscores付き',()=>{
 expect(synergy(byId(19),[],'対スキル').reasons.some(r=>r.includes('相手BURST'))).toBe(true);expect(abilitySemantics(byId(19)).ownBurst).toBe(false);
 expect(abilitySemantics(byId(36)).multiAttribute).toBe(false);expect(abilitySemantics(byId(28)).ownCool).toBe(true);
 for(const t of generateArchetypes(1)){expect(Object.keys(t.scores||{})).toHaveLength(11);expect(new Set(t.members).size).toBe(8);expect(new Set(t.songs).size).toBe(3);}
});
