import { expect,it } from 'vitest';
import { randomTeam,generateArchetypes,themes } from '../simulation/teams';
import { randomSchedule,archetypeSchedule } from '../simulation/schedule';
import { runMatch,mirror,assertFinite } from '../simulation/match';
import { prng } from '../simulation/random';
import {usesTheme} from '../simulation/ability-semantics';
import { IDOLS } from '../data/idols';
import { compareCpuEvaluations,evaluateCpuFormation } from '../game/cpu';
import { createGame,preview } from '../game/engine';
import { formationFromArray } from '../game/formation';
it('RANDOMは48人から8人、通常20曲から3曲を重複なし・seed再現で選ぶ',()=>{for(let seed=0;seed<100;seed++){const t=randomTeam(seed,'T');expect(t).toEqual(randomTeam(seed,'T'));expect(t.members).toHaveLength(8);expect(new Set(t.members).size).toBe(8);expect(new Set(t.songs).size).toBe(3);}});
it('アーキタイプの構築が再現可能で、3人以上の主タグ・8人・3曲・理由を持つ',()=>{const teams=generateArchetypes(1);expect(teams).toEqual(generateArchetypes(1));expect(teams.length).toBe(themes().length*3+3);for(const t of teams){expect(new Set(t.members).size).toBe(8);expect(new Set(t.songs).size).toBe(3);expect(t.members.filter(id=>t.archetype==='対単一属性メタ'?IDOLS[id-1].themeTags.includes(t.mainTags[0]):usesTheme(IDOLS[id-1],t.mainTags[0])).length).toBeGreaterThanOrEqual(t.archetype==='対単一属性メタ'?2:3);expect(Object.keys(t.reasons)).toHaveLength(11);}});
it('mirrorは同じseed・編成・曲を保ち、P1/P2を交換するフラグだけが変わる',()=>{const schedule=archetypeSchedule(1,2);for(let i=0;i<schedule.length;i+=2){expect(schedule[i+1]).toEqual(mirror(schedule[i]));expect(mirror(schedule[i+1])).toEqual(schedule[i]);}expect(()=>archetypeSchedule(1,3)).toThrow();});
it('NaN/Infinity/undefinedは保存前に拒否する',()=>{for(const x of [NaN,Infinity,-Infinity,undefined])expect(()=>assertFinite({x})).toThrow();expect(()=>assertFinite({x:0,y:null})).not.toThrow();});
it('評価順は得点、勝敗、Appeal差、疲労である',()=>{
 const base={points:1,outcome:1,difference:1,fatigue:10};expect(compareCpuEvaluations({...base,points:2,fatigue:100},base)).toBeGreaterThan(0);
 expect(compareCpuEvaluations({...base,points:0,outcome:0},{...base,points:0,outcome:-1})).toBeGreaterThan(0);
 expect(compareCpuEvaluations({...base,difference:9,fatigue:100},base)).toBeGreaterThan(0);expect(compareCpuEvaluations({...base,fatigue:9},base)).toBeGreaterThan(0);
});
it('CPUは自軍Appealだけでなく妨害後の差を最大化し、相手未確定配置を覗かない',()=>{
 const g=createGame([1,3,5,17,19,23,33,37],[10,14,18,25,26,27,28,30],['A','B','C'],['D','E','F'],'local',()=>.5);
 const before=structuredClone(g),a=evaluateCpuFormation(g,1,prng(1));expect(g).toEqual(before);
 // The old own-Appeal maximizer picks 24 versus 29. The shared new CPU chooses 21 versus 17.
 expect(a.total).toBe(21);expect(a.opponentTotal).toBe(16);expect(a.outcome).toBe(1);
 const selfish=preview(g,formationFromArray([1,5,19,23,37]),g.p2.formation);expect(selfish.p1.total).toBe(24);expect(selfish.p2.total).toBe(29);
 g.p2.formation=formationFromArray([...g.p2.ids].reverse());for(const id of g.p2.ids)g.p2.states[id].pos='BACK';
 const b=evaluateCpuFormation(g,1,prng(1));expect(b).toEqual(a);
 const view={...g,p1:g.publicPlayers![0],p2:g.publicPlayers![1]},p=preview(view,a.formation,view.p2.formation);expect(a.difference).toBe(p.p1.total-p.p2.total);
},20000);
it('同一seedの通常/fastで全7ラウンド・ゲーム状態が完全一致し、暗黙Math.randomに依存しない',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('unseeded random');};
 try {const spec=randomSchedule(876,1)[0],a=runMatch(spec),b=runMatch(spec,{fastSimulation:true}),expected={...a};delete expected.chargeTrace;expect(b).toEqual({...expected,fastSimulation:true});expect(a.rounds).toBe(7);expect(a.songs).toHaveLength(7);assertFinite(a);for(const p of a.players)for(const id of p.ids)expect(Object.values(p.states[id].stats.positions).reduce((a,b)=>a+b,0)).toBe(7);}
 finally{Math.random=original;}
},90000);
