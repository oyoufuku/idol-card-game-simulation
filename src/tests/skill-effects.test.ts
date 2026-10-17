import { expect,it } from 'vitest';
import { createGame,executeRound,nextRound,preview } from '../game/engine';
import { applyBurst } from '../game/burst';
import { effectsFor } from '../game/effects';
import { songById } from '../data/songs';
import { randomTeam } from '../simulation/teams';
import { prng } from '../simulation/random';
import { buildSkillPlayback } from '../components/skill-playback';
const make=(a:number[],b:number[])=>createGame(a,b,['A','B','C'],['D','E','F'],'local',()=>.5,{recordEffects:true});
it('Aの対面減少・疲労付与、味方の疲労回復は対象側と実適用値を記録する',()=>{
 const g=make([8,18,13,16,34,1,2,3],[10,8,18,24,27,1,2,3]);
 g.p1.states[18].fatigue=1;g.p2.states[18].fatigue=1;g.roundSong=songById('A');
 executeRound(g);
 expect(g.skillEffects!.some(e=>e.id===13&&e.kind==='A'&&e.targets.some(t=>t.side===0&&t.id===18&&t.label==='疲労値'&&t.delta===-1))).toBe(true);
 expect(g.skillEffects!.some(e=>e.id===16&&e.kind==='A'&&e.targets.some(t=>t.side===1&&t.id===27&&t.label==='疲労値'&&t.delta===2))).toBe(true);
 expect(g.skillEffects!.some(e=>e.id===34&&e.kind==='A'&&e.targets.some(t=>t.side===1&&t.id===27&&t.label==='疲労値'&&t.delta===1))).toBe(false); // MIDDLE does not satisfy FRONT condition.
});
it('軽減・無効化後のAppealを記録し、BACKSへの不適用を加算として表示しない',()=>{
 const g=make([1,8,10,18,24,2,3,4],[8,10,18,24,27,1,2,3]);g.roundSong=songById('A');
 executeRound(g);
 expect(g.skillEffects!.find(e=>e.id===1&&e.side===0&&e.kind==='A')!.targets).toContainEqual({side:1,id:8,label:'Appeal',delta:-2});
 const h=make([1,8,10,18,24,2,3,4],[15,10,18,24,27,1,2,3]);h.p2.states[15].attributeOverride='クール';executeRound(h);
 expect(h.skillEffects!.some(e=>e.id===1&&e.side===0&&e.targets.some(t=>t.side===1&&t.id===15&&t.label==='マイナス無効'&&t.delta===undefined))).toBe(true);
});
it('Cの相手BACKS疲労付与、属性PLAIN、位置ボーナス補正を記録する',()=>{
 const g=make([42,8,10,18,24,1,2,3],[8,10,18,24,27,1,2,3]);executeRound(g);
 const events=g.skillEffects!.filter(e=>e.id===42&&e.side===0&&e.kind==='C');
 for(const id of [1,2,3])expect(events.some(e=>e.targets.some(t=>t.side===1&&t.id===id&&t.label==='疲労値'&&t.delta===(id===2?2:3)))).toBe(true);
 const h=make([36,8,10,18,24,1,2,3],[8,10,18,24,27,1,2,3]);executeRound(h);
 expect(h.skillEffects!.filter(e=>e.id===36&&e.kind==='C').flatMap(e=>e.targets).filter(t=>t.label==='PLAIN')).toHaveLength(8);
 const k=make([26,8,10,18,24,1,2,3],[8,10,18,24,27,1,2,3]);executeRound(k);
 expect(k.skillEffects!.some(e=>e.id===26&&e.kind==='A'&&e.targets.some(t=>t.label==='位置ボーナス'&&t.delta===3))).toBe(true);
});
it('強制BURST連鎖の疲労回復を二重計上せず、正しいB発動者へ結び付ける',()=>{
 const g=make([6,16,8,10,24,1,2,3],[8,10,18,24,27,1,2,3]);g.p1.states[16].fatigue=5;g.targets[0].allyBurst=16;applyBurst(g,g.p1,g.p2,6,false,()=>0);
 const recovery=g.skillEffects!.flatMap(e=>e.targets.filter(t=>t.side===0&&t.id===16&&t.label==='疲労値').map(t=>({source:e.id,delta:t.delta})));
 expect(recovery).toEqual([{source:16,delta:-5}]);
 expect(g.skillEffects!.filter(e=>e.id===16&&e.kind==='B').some(e=>e.targets.some(t=>t.id===16&&t.label==='BURST発動'))).toBe(true);
});
it('開始BURSTの固定減少もパフォーマンスの発動者へ結び付ける',()=>{
 const g=make([17,8,10,18,24,1,2,3],[8,10,18,24,27,1,2,3]);g.targets[0].kousaka=27;applyBurst(g,g.p1,g.p2,17);executeRound(g);
 expect(g.skillEffects!.some(e=>e.id===17&&e.kind==='B'&&e.targets.some(t=>t.side===1&&t.id===27&&t.label==='Appeal'&&t.delta===-6))).toBe(true);
});
it('記録あり/なしで同じseedの実状態・得点・ログが全7ラウンド一致し、previewは記録しない',()=>{
 for(let seed=1;seed<=6;seed++){
  const a=randomTeam(seed,'A'),b=randomTeam(seed+100,'B');
  const plain=createGame(a.members,b.members,a.songs,b.songs,'local',prng(seed));
  const shown=createGame(a.members,b.members,a.songs,b.songs,'local',prng(seed),{recordEffects:true});
  const r1=prng(seed+200),r2=prng(seed+200);
  for(let round=1;round<=7;round++){
   const before=structuredClone(shown.skillEffects);preview(shown);expect(shown.skillEffects).toEqual(before);
   executeRound(plain,plain.p1.formation,plain.p2.formation,r1);executeRound(shown,shown.p1.formation,shown.p2.formation,r2);
   expect(plain.skillEffects).toBeUndefined();const {skillEffects,burstEffectSources,performanceAttributePlayers,...core}=shown;expect(core).toEqual(plain);
   if(round<7){nextRound(plain,r1);nextRound(shown,r2);}
  }
 }
});
it('表示順はP1のMIDDLE L/R→FRONT L/R→CENTERで、各カードA/B/C、続いてP2',()=>{
 const g=make([8,10,18,24,27,1,2,3],[8,10,18,24,27,1,2,3]),rec=effectsFor(g)!;
 for(const p of [g.p2,g.p1])for(const kind of ['C','B','A'] as const)for(const id of [8,10,18,24,27])rec.emit(rec.source(p,id,kind,'performance'),[rec.target(p,id,'Appeal',1)]);
 const steps=buildSkillPlayback(g.skillEffects!);
 expect(steps.map(s=>`${s.side}:${s.id}:${s.kind}`)).toEqual([0,1].flatMap(side=>[24,27,10,18,8].flatMap(id=>['A','B','C'].map(kind=>`${side}:${id}:${kind}`))));
 expect(steps).toHaveLength(30);
 rec.emit(rec.source(g.p2,1,'A','performance'),[rec.target(g.p2,1,'Appeal',1)]);
 rec.emit(rec.source(g.p1,1,'A','performance'),[rec.target(g.p1,1,'Appeal',1)]);
 rec.emit(rec.source(g.p1,8,'A','post'),[rec.target(g.p1,8,'疲労値',-1)]);
 const withBacks=buildSkillPlayback(g.skillEffects!);
 expect(withBacks.slice(0,30)).toEqual(steps);
 expect(withBacks.slice(30).map(s=>`${s.side}:${s.id}:${s.kind}:${s.phase}`)).toEqual(['0:1:A:performance','1:1:A:performance','0:8:A:post']);
});
