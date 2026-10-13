import {expect,it} from 'vitest';
import {cpuCandidates,cpuSearchConfiguration} from '../game/cpu-search';
import {evaluateCpuFormation} from '../game/cpu';
import {evaluateChargeFormation} from '../simulation/charge-cpu';
import {createGame,clonePlayer} from '../game/engine';
import {formationCandidates} from '../game/cpu-candidates';
import {formationFromArray,validateFormation} from '../game/formation';
import {prng} from '../simulation/random';
import {randomSchedule} from '../simulation/schedule';
import {runMatch} from '../simulation/match';
const make=()=>{const g=createGame([32,38,44,43,26,5,20,25],[1,3,7,13,16,21,26,36],['L','M','C'],['A','B','C'],'local',()=>.5);g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];return g;};
it('全候補評価を既定で維持し、二段階の上位100/200/300を決定的に選ぶ',()=>{
 const g=make(),original=structuredClone(g),all=formationCandidates(g.p1.ids);expect(cpuCandidates(g,1)).toBe(all);
 for(const n of [100,200,300]){const search={mode:'two-stage',previewCandidates:n} as const,a=cpuCandidates(g,1,search);expect(a).toHaveLength(n);expect(a).toEqual(cpuCandidates(g,1,search));expect(a.every(f=>!validateFormation(g.p1,f))).toBe(true);expect(a.map(f=>all.indexOf(f))).toEqual(a.map(f=>all.indexOf(f)).sort((a,b)=>a-b));}
 expect(g).toEqual(original);for(const n of [0,99,301,NaN])expect(()=>cpuSearchConfiguration({mode:'two-stage',previewCandidates:n})).toThrow();
});
it('通常/CHARGEとも精密評価数を制限し、非公開配置を参照せずseed再現する',()=>{
 for(const evaluate of [evaluateCpuFormation,evaluateChargeFormation]){const g=make(),search={mode:'two-stage',previewCandidates:100} as const,before=structuredClone(g),a=evaluate(g,1,prng(1),search);expect(a.checked).toBe(100);expect(g).toEqual(before);
  g.p2.formation=formationFromArray([...g.p2.ids].reverse());for(const id of g.p2.ids)g.p2.states[id].fatigue=999;
  const original=Math.random;Math.random=()=>{throw new Error('非seed乱数');};try{expect(evaluate(g,1,prng(1),search)).toEqual(a);}finally{Math.random=original;}
 }
},30000);
it('合法配置が100未満なら全て精密評価し、位置固定も守る',()=>{
 const g=make();g.p1.states[32].lockedPos='CENTER';g.p1.states[38].lockedPos='FRONT-L';g.p1.states[44].lockedPos='BACK';g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
 const a=evaluateCpuFormation(g,1,prng(1),{mode:'two-stage',previewCandidates:100});expect(a.checked).toBe(60);expect(validateFormation(g.p1,a.formation)).toBeNull();
});
it('二段階の7ラウンド実試合はseed再現し、fastでも配置・状態・統計を維持する',()=>{
 const spec=randomSchedule(42,1)[0],cpuSearch={mode:'two-stage',previewCandidates:100} as const,a=runMatch(spec,{cpuSearch}),b=runMatch(spec,{cpuSearch,fastSimulation:true}),expected={...a};delete expected.chargeTrace;
 expect(b).toEqual({...expected,fastSimulation:true});expect(a.rounds).toBe(7);expect(a.cpuSearch).toMatchObject(cpuSearch);
},30000);
