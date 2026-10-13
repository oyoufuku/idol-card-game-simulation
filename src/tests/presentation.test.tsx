import { expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame,preview,clonePlayer } from '../game/engine';
import { applyBurst } from '../game/burst';
import { byId,formationFromArray } from '../game/formation';
import { songById } from '../data/songs';
import { battlePlayers } from '../components/battle-view';
import { buildSkillMessages } from '../components/presentation';
import { AppealBreakdown } from '../components/AppealBreakdown';
import { CardBoard } from '../components/CardBoard';
import type { SkillEffect } from '../game/types';
const make=()=>createGame([1,8,13,16,17,26,42,43],[10,14,18,25,26,27,28,30],['A','B','C'],['D','E','F'],'local',()=>.5);
it('未確定の相手配置は公開済み配置を表示し、確定後は実盤面を表示する。双方操作に対応',()=>{
 const g=make(),old=structuredClone(g.publicPlayers);
 g.p2.formation=formationFromArray([30,28,27,26,25]);g.p1.formation=formationFromArray([43,42,26,17,16]);
 expect(battlePlayers(g,0)[1]).toEqual(old![1]);expect(battlePlayers(g,0)[0]).toBe(g.p1);
 expect(battlePlayers(g,1)[0]).toEqual(old![0]);expect(battlePlayers(g,1)[1]).toBe(g.p2);
 g.roundResolved=true;expect(battlePlayers(g,0)).toEqual([g.p1,g.p2]);
});
it('反転は表示専用で、フォーメーションとIDを変更しない',()=>{
 const g=make(),before=structuredClone(g.p2);
 const html=renderToStaticMarkup(<CardBoard player={g.p2} facingOpponent editable={false} resolved={false} onPlace={()=>{}} onSelect={()=>{}} onAppeal={()=>{}}/>);
 expect(html).toContain('facing-opponent');expect(html).toContain('data-facing="opponent"');expect(html).toContain('data-card-id="10"');expect(g.p2).toEqual(before);
});
it('発動者告知の後、1人1効果ずつ増減を説明し、同じ発動者を重複告知しない',()=>{
 const event:SkillEffect={side:0,id:16,kind:'A',phase:'performance',position:'MIDDLE-L',label:'大沼',targets:[{side:0,id:8,label:'Appeal',delta:2},{side:1,id:25,label:'疲労値',delta:2},{side:1,id:25,label:'Appeal',delta:-1}]};
 const before=structuredClone(event),messages=buildSkillMessages([event]);
 expect(messages.map(m=>m.messageType)).toEqual(['source','target','target','target']);expect(messages[0].targets).toEqual([]);expect(messages.slice(1).every(m=>m.targets.length===1)).toBe(true);
 expect(messages.slice(1).flatMap(m=>m.targets)).toEqual(event.targets);expect(messages.every(m=>m.durationMs>=2600)).toBe(true);expect(event).toEqual(before);
});
it('告知順はP1のMIDDLE→FRONT→CENTER、BURST連鎖は発動順を維持する',()=>{
 const source=(id:number,phase:'performance'|'burst'):SkillEffect=>({side:0,id,kind:'A',phase,position:id===1?'CENTER':id===8?'FRONT-L':'MIDDLE-L',label:byId(id).name,targets:[{side:0,id,label:'Appeal',delta:1}]});
 expect(buildSkillMessages([source(1,'performance'),source(8,'performance'),source(16,'performance')]).filter(m=>m.messageType==='source').map(m=>m.id)).toEqual([16,8,1]);
 expect(buildSkillMessages([source(1,'burst'),source(8,'burst'),source(16,'burst')]).filter(m=>m.messageType==='source').map(m=>m.id)).toEqual([1,8,16]);
});
it('内訳は発動者・A/B/C・曲の効果文を保有し、増減の合計が実Appealになる',()=>{
 const g=make();g.roundSong=songById('A');g.p2.states[10].fatigue=5;
 const r=preview(g);
 for(const team of [r.p1,r.p2])for(const member of team.members)expect(member.breakdown!.reduce((n,c)=>n+c.amount,0)).toBe(member.val);
 const member=r.p2.members.find(m=>m.id===10)!;
 expect(member.breakdown).toContainEqual(expect.objectContaining({side:0,sourceId:1,kind:'A',amount:-2,effect:byId(1).A}));
 expect(member.breakdown).toContainEqual(expect.objectContaining({side:1,sourceId:10,kind:'A',amount:2,effect:byId(10).A}));
 expect(member.breakdown!.some(e=>e.kind==='曲'&&e.effect===g.roundSong.effect)).toBe(true);
 const html=renderToStaticMarkup(<AppealBreakdown appeal={member} cpuMode={false}/>);expect(html).toContain('P1：');expect(html).toContain('P2：');expect(html).toContain('Aスキル');expect(html).toContain('【スキル効果】');expect(html).toContain('amount-positive');expect(html).toContain('amount-negative');
});
it('軽減・無効・下限・位置2倍も数値を変えず内訳へ反映、簡略CPU計算に内訳を作らない',()=>{
 const g=make();g.roundSong=songById('B');g.p1.states[26].fatigue=20;applyBurst(g,g.p2,g.p1,18);const before=structuredClone(g);
 const detailed=preview(g),simple=preview(g,g.p1.formation,g.p2.formation,false);expect(g).toEqual(before);
 for(const [a,b] of [[detailed.p1,simple.p1],[detailed.p2,simple.p2]]){
  expect(a.total).toBe(b.total);for(const member of a.members)expect(member.breakdown!.reduce((n,c)=>n+c.amount,0)).toBe(member.val);
  expect(b.members.every(m=>m.breakdown===undefined)).toBe(true);
 }
});
it('複数の固定Bの発動者を保持し、合算した軽減計算を独自に分割しない。cloneはメタデータも独立',()=>{
 const g=make();g.targets[0].kousaka=10;applyBurst(g,g.p1,g.p2,17);applyBurst(g,g.p1,g.p2,17,true);
 expect(g.p2.states[10].burstDebuffSources).toEqual([{id:17,amount:-6},{id:17,amount:-6}]);
 const cloned=clonePlayer(g.p2);cloned.states[10].burstDebuffSources![0].amount=100;expect(g.p2.states[10].burstDebuffSources![0].amount).toBe(-6);
 const member=preview(g).p2.members.find(m=>m.id===10)!;expect(member.breakdown!.some(e=>e.sourceId===17&&e.kind==='B'&&e.amount===-12)).toBe(true);
});
it('CENTER効果は受け手ではなく実際のCENTERを発動者として記録する',()=>{
 const g=createGame([12,8,13,1,16,17,26,42],[10,18,24,27,28,1,2,3],['A','B','C'],['D','E','F'],'local',()=>.5);applyBurst(g,g.p1,g.p2,8);
 const member=preview(g).p1.members.find(m=>m.id===8)!;
 expect(member.breakdown).toContainEqual(expect.objectContaining({side:0,sourceId:12,sourceName:'松田里奈',kind:'C',amount:2,effect:byId(12).C}));
});
