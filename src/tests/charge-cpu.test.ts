import { expect,it } from 'vitest';
import { createHash } from 'node:crypto';
import { clonePlayer,createGame,executeRound } from '../game/engine';
import { formationFromArray,posOf,validateFormation } from '../game/formation';
import { evaluateCpuFormation } from '../game/cpu';
import { songById } from '../data/songs';
import { IDOLS } from '../data/idols';
import { evaluateChargeFormation,chargeUtility,chargeConsumers } from '../simulation/charge-cpu';
import { chargeBefore,chargeRoundTrace } from '../simulation/charge-trace';
import { generateArchetypes } from '../simulation/teams';
import { generateMetaArchetypes } from '../simulation/meta-teams';
import { randomSchedule,archetypeSchedule,chargeComparisonSchedule,withStrategies } from '../simulation/schedule';
import { runMatch,assertFinite } from '../simulation/match';
import { setRandomSources } from '../game/random-source';
import { chargeCore,chargeSupportPolicy } from '../simulation/charge-team-policy';
import { prng } from '../simulation/random';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function scenario(round:number){
 const g=createGame([32,38,44,43,45,13,9,17],[10,14,18,25,26,27,28,30],['L','J','C'],['A','B','C'],'local',()=>.5);
 g.round=round;g.roundSong=songById('J');g.p1.formation=formationFromArray([45,43,9,13,17]);
 for(const p of [g.p1,g.p2])p.round=round;
 g.p1.states[45].lockedPos='CENTER';g.p1.states[13].lockedPos='MIDDLE-L';
 for(const id of g.p1.ids){const s=g.p1.states[id];s.prevPos=s.pos=posOf(g.p1,id);s.fatigue=round>1?3:0;}
 for(const id of [32,38,44]){const s=g.p1.states[id];s.charge=round===1?0:round===4?3:5;if(round===6){s.prevPos='FRONT-L';s.normalUsed=true;s.burstCount=1;s.lastSpentCharge=4;}}
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];return g;
}
it('R1は3人をBACKS、R5は投入、R6は回復後に戻し、R7で再投入する。通常CPUとは異なる',()=>{
 for(const round of [1,4,5,6,7]){
  const g=scenario(round),before=structuredClone(g),charge=evaluateChargeFormation(g,1,prng(1));expect(g).toEqual(before);expect(validateFormation(g.p1,charge.formation)).toBeNull();expect(charge.checked).toBe(120);
  const stage=Object.values(charge.formation).filter(id=>chargeConsumers(g.p1).includes(id));
  if(round===1||round===6)expect(stage).toHaveLength(0);if(round===4)expect(stage.length).toBeLessThan(3);if(round===5||round===7)expect(stage).toHaveLength(3);
  if(round===1)expect(charge.formation).not.toEqual(evaluateCpuFormation(g,1,prng(1)).formation);
 }
},20000);
it('CHARGEも公開状態だけを参照し、同seed再現・同評価の選択に非seed乱数を使わない',()=>{
 const g=scenario(5),a=evaluateChargeFormation(g,1,prng(31)),original=Math.random;
 g.p2.formation=formationFromArray([...g.p2.ids].reverse());for(const id of g.p2.ids)g.p2.states[id].fatigue=999;
 Math.random=()=>{throw new Error('unseeded');};try{expect(evaluateChargeFormation(g,1,prng(31))).toEqual(a);}finally{Math.random=original;}
},20000);
it('R6で予測敗北が数学的に確定する候補はチャージ温存より回避する',()=>{
 const g=scenario(6);g.p1.points=0;g.p2.points=3;for(const id of g.p2.ids)g.p2.states[id].fatigue=7;g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
 const evaluation=evaluateChargeFormation(g,1,prng(1));expect('recoverable' in evaluation&&evaluation.recoverable).toBe(true);expect(evaluation.outcome).toBeGreaterThanOrEqual(0);
},20000);
it('固定された現在得点と将来価値の重みは、R6の復帰・R5/R7の投入を評価する',()=>{
 const current={formation:formationFromArray([1,2,3,4,5]),total:10,opponentTotal:10,points:0,outcome:0,difference:0,fatigue:0},empty={stored:0,reserve:0,backGain:0,entered:0,returned:0,burst:0};
 expect(chargeUtility(6,current,{...empty,returned:3}).utility).toBeGreaterThan(chargeUtility(6,current,empty).utility);
 expect(chargeUtility(5,current,{...empty,entered:3}).futureValue).toBeGreaterThan(chargeUtility(7,current,{...empty,entered:3}).futureValue);
});
it('候補内のチャージBURSTと松田の反応抽選は、本試合の乱数ストリームを消費しない',()=>{
 const g=createGame([32,38,44,43,45,13,9,8],[10,14,18,25,26,27,28,30],['L','J','C'],['A','B','C'],'local',()=>.5);
 g.round=5;g.roundSong=songById('J');g.p1.round=g.p2.round=5;
 g.p1.formation=formationFromArray([45,43,9,13,8]);g.p1.states[45].lockedPos='CENTER';g.p1.states[13].lockedPos='MIDDLE-L';
 for(const id of [32,38,44]){g.p1.states[id].charge=5;g.p1.states[id].prevPos='BACK';}
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];setRandomSources(g,{players:[()=>{throw new Error('live P1 RNG');},()=>{throw new Error('live P2 RNG');}]});
 expect(()=>evaluateChargeFormation(g,1,prng(1))).not.toThrow();
},20000);
it('チャージ実処理を記録し、消費とB回復を分離する。mirrorでもCPU戦略はA/Bへ追随する',()=>{
 const g=scenario(5),before=chargeBefore([g.p1,g.p2]);g.skillEffects=[];g.interactiveBursts=false;const f=evaluateChargeFormation(g,1,prng(1)).formation;executeRound(g,f,g.p2.formation,()=>.5);
 const trace=chargeRoundTrace(g,before,true,['normal','charge']);expect(trace.filter(t=>t.team==='B').every(t=>t.cpuStrategy==='charge')).toBe(true);
 expect(trace.filter(t=>t.id===32).map(t=>[t.chargeBefore,t.spentCharge,t.chargeAfter])).toEqual([[5,5,5]]);
 expect(trace.find(t=>t.id===32)?.burstRecoveries).toBe(1);expect(trace.find(t=>t.id===32)?.recoveredCharge).toBe(5);
},20000);
it('通常20曲への変更後もRANDOM1000件のseed・メンバーは不変、normalとmirrorは互換',()=>{
 const specs=randomSchedule(1,1000);expect(digest(specs.map(s=>({pairId:s.pairId,seed:s.seed,mirror:s.mirror,a:s.a.members,b:s.b.members})))).toBe('e33e30322267d4d2501f470a316f3c3d72ee6581fd7f239d5777b0c945cf9e42');expect(withStrategies(specs,'normal')).toBe(specs);
 const comparison=chargeComparisonSchedule(1,2);expect(comparison[0].a.members).toEqual(comparison[0].b.members);expect(comparison[0].a.songs).toEqual(comparison[0].b.songs);
 expect(comparison[1]).toEqual({...comparison[0],mirror:true});expect(comparison[0].cpuStrategies).toEqual(['normal','charge']);
 const scheduled=withStrategies(archetypeSchedule(1,2),'charge-archetype');for(const spec of scheduled)expect(spec.cpuStrategies).toEqual([spec.a,spec.b].map(t=>t.archetype==='チャージ軸'?'charge':'normal'));
});
it('チャージ軸は指定3コア＋BACKS非依存の支援5人とCENTER役を確保する',()=>{
 const core=chargeCore().map(c=>c.id);expect(core).toEqual([32,38,44]);
 for(let seed=0;seed<12;seed++)for(const t of generateArchetypes(seed,seed%2?3:5).filter(t=>t.archetype==='チャージ軸')){
  expect(t.members.slice(0,3)).toEqual(core);expect(new Set(t.members).size).toBe(8);expect(new Set(t.songs).size).toBe(3);
  const supports=t.members.slice(3).map(id=>IDOLS[id-1]);expect(supports.some(c=>c.C)).toBe(true);for(const c of supports)expect(chargeSupportPolicy(c).excluded).toEqual([]);
  expect(t.members.some(id=>[4,9,10,13,17].includes(id))).toBe(false);
 }
 expect(chargeSupportPolicy(IDOLS[42])).toMatchObject({exception:true,excluded:[]});
 expect(chargeSupportPolicy(IDOLS[18]).excluded).toEqual([]);
 expect(chargeSupportPolicy(IDOLS[44]).deprioritized).not.toHaveLength(0);
});
it('新メタ3候補は実在タグ・能力・profile別属性・8人・3曲・理由を持ち再現可能',()=>{
 const teams=generateMetaArchetypes(1);expect(teams).toHaveLength(3);expect(teams).toEqual(generateMetaArchetypes(1));expect(new Set(teams.map(t=>[...t.members].sort().join(','))).size).toBe(3);
 for(const t of teams){expect(new Set(t.members).size).toBe(8);expect(new Set(t.songs).size).toBe(3);if(t.construction?.profile==='属性変更・PLAIN重視')expect(new Set(t.members.map(id=>IDOLS[id-1].attr)).size).toBe(3);expect(t.members.filter(id=>IDOLS[id-1].themeTags.includes('対単一属性'))).toHaveLength(2);expect(Object.keys(t.reasons)).toHaveLength(11);}
 expect(teams[1].members.some(id=>IDOLS[id-1].C?.includes('PLAIN'))).toBe(true);
});
it('CHARGE対通常CPUの7ラウンド実試合は通常/fastで全状態が一致する',()=>{
 const team={name:'チャージ検証',archetype:'チャージ軸',members:[32,38,44,43,45,13,9,17],songs:['L','J','C'],mainTags:['チャージ'],subTags:[],reasons:{}};
 const spec=chargeComparisonSchedule(1,2,[team])[0],original=Math.random;
 Math.random=()=>{throw new Error('unseeded actual match');};
 try{const a=runMatch(spec),b=runMatch(spec,{fastSimulation:true}),expected={...a};delete expected.chargeTrace;expect(b).toEqual({...expected,fastSimulation:true});expect(b.chargeTrace).toBeUndefined();assertFinite(a);expect(a.rounds).toBe(7);expect(a.cpuStrategy).toBe('mixed');expect(a.cpuStrategies).toEqual(['normal','charge']);expect(a.chargeTrace).toHaveLength(56);expect(a.chargeTrace!.some(t=>t.burstRecoveries>0)).toBe(true);}
 finally{Math.random=original;}
},90000);
