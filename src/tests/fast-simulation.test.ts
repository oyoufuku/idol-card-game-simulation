import { expect,it } from 'vitest';
import { formationCandidates,CPU_CANDIDATE_CACHE_LIMIT } from '../game/cpu-candidates';
import { permutations5,evaluateCpuFormation } from '../game/cpu';
import { createGame,clonePlayer,createCpuPreview,preview } from '../game/engine';
import { formationFromArray,posOf,validateFormation,hasAttr,attributesOf,countAttr,idsStage,idsBack } from '../game/formation';
import { finishPerformance } from '../game/performance';
import { songById,SONGS } from '../data/songs';
import { ATTRS,randomTeam } from '../simulation/teams';
import { prng } from '../simulation/random';
import { evaluateChargeFormation } from '../simulation/charge-cpu';
import baseline from './fixtures/cpu-front-charge-20261015.json';
import { applyFatigueAndPost } from '../game/fatigue';
import { resolveCenterSkills } from '../game/appeal';
import { applyBurst } from '../game/burst';
function freeze(value:object){if(Object.isFrozen(value))return;Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);}

it('候補キャッシュは8P5全6720件と列挙順を保持し、選出順・LRU・不変性を守る',()=>{
 const ids=[1,3,5,7,9,11,13,15],a=formationCandidates(ids);
 expect(a).toHaveLength(6720);expect(a).toEqual([...permutations5(ids)].map(formationFromArray));expect(formationCandidates([...ids])).toBe(a);
 expect(Object.isFrozen(a)).toBe(true);expect(a.every(Object.isFrozen)).toBe(true);
 expect(formationCandidates([...ids].reverse())[0]).toEqual(formationFromArray([...ids].reverse()));
 for(let start=0;start<=CPU_CANDIDATE_CACHE_LIMIT;start++)formationCandidates(Array.from({length:8},(_,i)=>16+(start+i)%33));
 const reloaded=formationCandidates(ids);expect(reloaded).not.toBe(a);expect(reloaded).toEqual(a);
});
it('属性/位置の軽量判定はPLAIN・属性追加・変更を含め従来の集合計算と一致する',()=>{
 const g=createGame([1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16],['A','B','C'],['D','E','F'],'local',()=>.5);
 for(const plain of [false,true])for(const type of [null,...ATTRS])for(const added of [[],ATTRS]){
  g.p1.tempAttr=type;g.p1.addedAttributes=[...added];
  for(const id of g.p1.ids){const s=g.p1.states[id];s.plain=plain;s.attributeOverride=id%2?type:null;s.addedAttributes=id%3?[...ATTRS]:[];
   for(const attr of ATTRS)expect(hasAttr(g.p1,id,attr)).toBe(attributesOf(g.p1,id).includes(attr));
  }
  for(const attr of ATTRS)expect(countAttr(g.p1,attr)).toBe(idsStage(g.p1).filter(id=>attributesOf(g.p1,id).includes(attr)).length);
  expect(idsBack(g.p1)).toEqual(g.p1.ids.filter(id=>!idsStage(g.p1).includes(id)));
 }
});
it('CPU projectionは全22曲・多様な状態で通常previewと一致し、終了処理から公開状態を保護する',()=>{
 for(let seed=0;seed<SONGS.length;seed++){
  const a=randomTeam(seed,'A'),b=randomTeam(seed+100,'B'),g=createGame(a.members,b.members,a.songs,b.songs,'local',prng(seed));
  g.round=5;g.roundSong=SONGS[seed];
  for(const p of [g.p1,g.p2]){p.round=5;for(const id of p.ids){const s=p.states[id];s.fatigue=(id+seed)%9;s.charge=id%6;s.burstActive=id%2===0;s.burstStacks=+s.burstActive;s.burstSelfAppeal=+s.burstActive*2;s.prevPos=id%3?'BACK':posOf(p,id);s.addedAttributes=[ATTRS[id%3]];s.positionCounts.CENTER=2;s.symmetries=[id];}}
  const before=structuredClone(g),predict=createCpuPreview(g,true),normal=createCpuPreview(g),first=formationCandidates(g.p1.ids)[0],last=formationCandidates(g.p1.ids)[6719];
  freeze(g.p1);freeze(g.p2);
  for(const formation of [first,last,first]){
   const regular=normal(formation,g.p2.formation);expect(regular).toEqual(preview(g,formation,g.p2.formation,false));
   const [n1,n2]=regular.players,[c1,c2]=resolveCenterSkills(n1,n2,g.roundSong);
   applyFatigueAndPost(n1,n2,'loss',c1,g.roundSong);applyFatigueAndPost(n2,n1,'win',c2,g.roundSong);
   const result=predict(formation,g.p2.formation);expect(result).toEqual(preview(g,formation,g.p2.formation,false));
   const [p1,p2]=result.players;finishPerformance(p1,p2,g.roundSong);finishPerformance(p2,p1,g.roundSong);
   const probe={...g,p1,p2,cpuBoth:true,logs:[],burstChain:[],burstSeen:[]};applyBurst(probe,p1,p2,p1.ids[0],true,prng(seed));
   for(const p of result.players){p.addedAttributes.push('キュート');p.burstBackCandidates.push(999);const s=p.states[p.ids[0]];s.burstDebuffSources=[{id:999,amount:-4}];s.stats.positions.CENTER+=10;}
  }
  expect(g).toEqual(before);
 }
});
it('CPU projectionも通常previewと同じ位置固定違反を拒否する',()=>{
 const a=randomTeam(1,'A'),b=randomTeam(2,'B'),g=createGame(a.members,b.members,a.songs,b.songs,'local',()=>.5);
 g.p1.states[g.p1.formation.CENTER].lockedPos='CENTER';const f=formationCandidates([...g.p1.ids].reverse())[0];
 expect(validateFormation(g.p1,f)).not.toBeNull();expect(()=>createCpuPreview(g)(f,g.p2.formation)).toThrow();
});
it('確定した満充填登場+2・左右対面・CHARGE v2の10ケースと配置・全評価値・同値乱数回数が一致する',()=>{
 for(const expected of baseline){
  const round=expected.round,g=createGame([32,38,44,43,45,13,9,17],[10,14,18,25,26,27,28,30],['L','J','C'],['A','B','C'],'local',()=>.5);
  g.round=round;g.roundSong=songById('J');g.p1.formation=formationFromArray([45,43,9,13,17]);for(const p of [g.p1,g.p2])p.round=round;
  g.p1.states[45].lockedPos='CENTER';g.p1.states[13].lockedPos='MIDDLE-L';
  for(const id of g.p1.ids){const s=g.p1.states[id];s.prevPos=s.pos=posOf(g.p1,id);s.fatigue=round>1?3:0;}
  for(const id of [32,38,44]){const s=g.p1.states[id];s.charge=round===1?0:round===4?3:5;if(round===6){s.prevPos='FRONT-L';s.normalUsed=true;s.burstCount=1;s.lastSpentCharge=4;}}
  g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];let calls=0;const r=prng(1);
  const evaluation=(expected.strategy==='normal'?evaluateCpuFormation:evaluateChargeFormation)(g,1,()=>{calls++;return r();});
  expect({round,strategy:expected.strategy,calls,evaluation}).toEqual(expected);
  // Returned formations remain independently editable despite the frozen cache.
  const saved={...evaluation.formation};evaluation.formation.CENTER=999;expect(formationCandidates(g.p1.ids).some(f=>f.CENTER===999)).toBe(false);evaluation.formation=saved;
 }
},20000);
