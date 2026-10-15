import {expect,it} from 'vitest';
import {createGame,preview,executeRound,clonePlayer} from '../game/engine';
import {oppositeSlot,oppositeId,formationFromArray,autoEnabled} from '../game/formation';
import {skillFor} from '../game/skills';
import {songById} from '../data/songs';
import {SLOTS} from '../game/types';
import {cpuCandidates} from '../game/cpu-search';
const make=(a:number[],b:number[])=>{const g=createGame(a,b,['A','B','C'],['D','E','F'],'local',()=>.5,{interactiveBursts:true,recordEffects:true});g.roundSong=songById('A');return g;};
const own=[1,8,10,18,24,27,28,30],enemy=[8,5,18,24,27,28,30,31];
it('CENTERは同士、FRONT/MIDDLEは左右反対を対面とし、逆側からも同じペア・BACKSは対象なし',()=>{
 const g=make(own,enemy),pairs=[['CENTER','CENTER'],['FRONT-L','FRONT-R'],['FRONT-R','FRONT-L'],['MIDDLE-L','MIDDLE-R'],['MIDDLE-R','MIDDLE-L']] as const;
 for(const [slot,other] of pairs){expect(oppositeSlot(slot)).toBe(other);expect(oppositeSlot(other)).toBe(slot);expect(oppositeId(g.p1,g.p2,g.p1.formation[slot])).toBe(g.p2.formation[other]);expect(oppositeId(g.p2,g.p1,g.p2.formation[other])).toBe(g.p1.formation[slot]);}
 expect(oppositeId(g.p1,g.p2,30)).toBeNull();
});
it('FRONT-Lの石森AUTOは相手FRONT-Rへ適用し、内訳・演出・実処理も同じ対象にする',()=>{
 const g=make(own,enemy);g.p1.formation=formationFromArray([8,1,10,18,24]);
 const before=structuredClone(g),a=preview(g);expect(g).toEqual(before);
 expect(a.p2.members.find(m=>m.id===18)!.breakdown).toContainEqual(expect.objectContaining({sourceId:1,kind:'A',amount:-2}));
 expect(a.p2.members.find(m=>m.id===5)!.breakdown!.some(e=>e.sourceId===1&&e.kind==='A')).toBe(false);
 expect(executeRound(g).p2.total).toBe(a.p2.total);
 expect(g.skillEffects).toContainEqual(expect.objectContaining({id:1,kind:'A',targets:expect.arrayContaining([expect.objectContaining({side:1,id:18,delta:-2})])}));
});
it('FRONT-Rの大沼疲労と的野AUTO無効は相手FRONT-Lを対象にする',()=>{
 const g=make([8,10,16,18,24,27,28,30],[8,10,18,24,27,28,30,31]);
 const a=preview(g);expect(a.players[1].states[10].fatigue).toBe(2);expect(a.players[1].states[18].fatigue).toBe(0);
 const m=make([8,10,7,18,24,27,28,30],[8,10,18,24,27,28,30,31]);
 expect(autoEnabled(m.p2,m.p1,10)).toBe(false);expect(autoEnabled(m.p2,m.p1,18)).toBe(true);
});
it('藤吉AUTOのコピーと守屋条件用の対面実増減履歴も左右反転した相手を見る',()=>{
 const f=make([8,20,10,18,24,27,28,30],[8,5,18,24,27,28,30,31]);
 expect(preview(f).p1.members.find(m=>m.id===20)!.autoGain).toBe(3); // opposite FRONT-R: 武元AUTO +3.
 const m=make([8,23,10,18,24,27,28,30],[8,5,18,24,27,28,30,31]);m.p2.states[18].fatigue=7;
 const result=executeRound(m),opponent=result.p2.members.find(row=>row.slot==='FRONT-R')!;
 expect(m.p1.states[23].lastOppositeReduction).toBe(opponent.skillReduction);
 expect(m.p1.states[23].lastOppositeGain).toBe(opponent.skillGain);
});
it('二段階CPUの概算も左右反転の守屋B引継ぎを評価し、公開状態を変更しない',()=>{
 const g=make([8,23,10,18,24,27,28,30],enemy);g.p1.states[23].activeAutoCarry=4;g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
 // Fix every position so the single coarse candidate and precise preview can be compared.
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].lockedPos=SLOTS.find(s=>p.formation[s]===id)||'BACK';
 const before=structuredClone(g);let opponentTotal=0;
 cpuCandidates(g,1,{mode:'two-stage',previewCandidates:100},e=>{opponentTotal=e.opponentTotal;return [e.difference];});
 const a=preview(g);expect(opponentTotal).toBe(a.p2.total);expect(g).toEqual(before);
 expect(skillFor(23,g.p1).burst).toBeTruthy();
});
