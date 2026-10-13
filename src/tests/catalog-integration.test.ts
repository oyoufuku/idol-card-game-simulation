import { expect, it } from 'vitest';
import { IDOLS } from '../data/idols';
import { SELECTABLE_SONGS } from '../data/songs';
import { createGame, executeRound, nextRound, preview, shuffle } from '../game/engine';
import { applyBurst } from '../game/burst';
import { formationFromArray, validateFormation } from '../game/formation';
import { skillFor } from '../game/skills';
const randomFor=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
it.each(IDOLS.map(c=>[c.id,c.name] as const))('No.%i %s：通常/強制BURSTを通して予測と実行が一致する', (id)=>{
 const random=randomFor(id), ids=[id,...IDOLS.filter(c=>c.id!==id).map(c=>c.id)].slice(0,8);
 const opponent=[19,7,11,12,15,20,22,23];
 const g=createGame(ids,opponent,['A','D','L'],['B','I','J'],'local',random);
 expect(skillFor(id)).toBeTruthy();applyBurst(g,g.p1,g.p2,id,false,random);applyBurst(g,g.p1,g.p2,id,true,random);
 expect(g.p1.states[id].burstCount).toBe(2);expect(g.p1.states[id].forcedBurstCount).toBe(1);
 const before=structuredClone(g),predicted=preview(g);expect(g).toEqual(before);
 const result=executeRound(g,g.p1.formation,g.p2.formation,random);
 expect([result.p1.total,result.p2.total]).toEqual([predicted.p1.total,predicted.p2.total]);
 // A surviving flag belongs to a newly earned end-of-performance BURST.
 expect(Object.values(g.p1.states).every(st=>!st.burstActive||st.burstCount>before.p1.states[st.id].burstCount)).toBe(true);
});
it('48人・22曲を使った100試合700ラウンドが予測と実行の一致を維持して完走する',()=>{
 const seen=new Set<number>(),songs=new Set<string>();
 for(let seed=1;seed<=100;seed++){
  const random=randomFor(seed*7919), roster=()=>shuffle(IDOLS.map(c=>c.id),random).slice(0,8), deck=()=>shuffle(SELECTABLE_SONGS.map(s=>s.id),random).slice(0,3);
  const g=createGame(roster(),roster(),deck(),deck(),'local',random);
  for(const p of [g.p1,g.p2])p.ids.forEach(id=>seen.add(id));
  for(let round=1;round<=7;round++){
   songs.add(g.roundSong.id);
   for(const p of [g.p1,g.p2]){
    // Independent legal proposals; a fixed position keeps its existing placement if no sampled proposal fits.
    for(let attempt=0;attempt<30;attempt++){const f=formationFromArray(shuffle(p.ids,random));if(!validateFormation(p,f)){p.formation=f;break;}}
   }
   const snapshot=structuredClone(g),predicted=preview(g);expect(g).toEqual(snapshot);
   const r=executeRound(g,g.p1.formation,g.p2.formation,random);
   expect([r.p1.total,r.p2.total],`seed ${seed} R${round}`).toEqual([predicted.p1.total,predicted.p2.total]);
   for(const p of [g.p1,g.p2]){
    expect(validateFormation(p,p.formation)).toBeNull();
    expect(Object.values(p.states).every(st=>Number.isFinite(st.fatigue)&&st.fatigue>=0)).toBe(true);
   }
   if(round<7)nextRound(g,random);
  }
  expect(g.done).toBe(true);expect(g.result?.final).toBeTruthy();
 }
 expect(seen.size).toBe(48);expect(songs.size).toBeGreaterThanOrEqual(20);
});
