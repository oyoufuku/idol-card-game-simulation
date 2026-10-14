import { expect,it } from 'vitest';
import { createGame,executeRound,nextRound,preview } from '../game/engine';
import { burstTargetKind,burstTargetOptions,pendingBurst,queueBursts,resolveNextBurst,resolvePendingBursts } from '../game/burst';
import { attributesOf,countAttr,formationFromArray,validateFormation } from '../game/formation';
import { songById } from '../data/songs';
import { prng } from '../simulation/random';
const ids=[1,2,4,7,8,10,17,24],opp=[8,10,18,24,27,28,30,31];
const make=(interactive=false,a=ids,b=opp)=>createGame(a,b,['A','B','C'],['D','E','F'],'local',()=>.5,{recordEffects:true,interactiveBursts:interactive});
it('終了時に即BURSTしREADY待機なし、確定Appealを変えず次パフォーマンスまで保持する',()=>{
 const g=make();g.roundSong=songById('A');g.p1.states[2].fatigue=3;g.p1.states[2].fatigueTwoEnds=1;
 const predicted=preview(g).p1.total;executeRound(g);
 expect(g.p1.states[2].burstActive).toBe(true);expect(g.p1.states[2].fatigue).toBe(0);expect(g.p1.states[2].normalUsed).toBe(true);
 expect(g.p1.states[2]).not.toHaveProperty('ready');expect(g.logs.join('\n')).not.toContain('READY');expect(g.result!.p1.total).toBe(predicted);
 const count=g.p1.states[2].burstCount;nextRound(g,()=>.5);expect(g.p1.states[2].burstActive).toBe(true);expect(g.p1.states[2].burstCount).toBe(count);
 executeRound(g);expect(g.p1.states[2].burstActive).toBe(false);
});
it('UIは1枚ずつ実際に発動し、反応BURSTも個別処理する。未処理なら次ラウンド不可',()=>{
 const g=make(true);g.p1.formation=formationFromArray([1,7,2,4,8]);g.p1.states[2].fatigue=3;g.p1.states[2].fatigueTwoEnds=1;executeRound(g);
 expect(g.p1.states[2].burstCount).toBe(0);expect(()=>nextRound(g)).toThrow('BURST');
 const initial=[g.p1,g.p2].flatMap(p=>p.ids.map(id=>p.states[id].burstCount));
 expect(resolveNextBurst(g)).toBe(true);
 const now=[g.p1,g.p2].flatMap(p=>p.ids.map(id=>p.states[id].burstCount));
 expect(now.reduce((n,count,i)=>n+count-initial[i],0)).toBe(1);
 while(pendingBurst(g)){const job=pendingBurst(g)!;resolveNextBurst(g,burstTargetKind(job.id)?burstTargetOptions(g,job)[0]:undefined,()=>.5);}
 expect(g.p1.states[7].burstCount).toBe(1);expect(()=>nextRound(g,()=>.5)).not.toThrow();
});
it.each([[4,'koji'],[7,'matono'],[17,'kousaka']] as const)('%iのB対象はその発動時に必須選択し、その対象だけへ即時適用する',(id,kind)=>{
 const g=make(true);queueBursts(g,[id],[]);pendingBurst(g);
 const before=structuredClone(g);expect(()=>resolveNextBurst(g)).toThrow('対象');expect(g).toEqual(before);
 expect(()=>resolveNextBurst(g,999)).toThrow('対象');
 const target=kind==='koji'?2:27;g.p1.states[2].fatigue=5;
 resolveNextBurst(g,target,()=>.5);expect(g.targets[0][kind]).toBe(target);
 if(kind==='koji'){expect(g.p1.states[4].fatigue).toBe(5);expect(g.p1.states[2].fatigue).toBe(0);expect(burstTargetOptions(g,{side:0,id:4,forced:false,phase:'burst',seen:[]})).not.toContain(4);}
 else expect(g.p2.states[target].lockedPos).toBe(kind==='matono'?'MIDDLE-R':'FRONT-R');
});
it('強制Bで的野を選んでも、的野の発動前に止めて対象選択できる',()=>{
 const g=make(true,[48,7,8,10,18,24,27,28]);queueBursts(g,[48],[]);
 resolveNextBurst(g,7,()=>0);expect(g.p1.states[48].burstCount).toBe(1);expect(g.p1.states[7].burstCount).toBe(0);
 expect(pendingBurst(g)).toMatchObject({id:7,forced:true});expect(()=>resolveNextBurst(g)).toThrow('対象');resolveNextBurst(g,27,()=>0);
 expect(g.p1.states[7].forcedBurstCount).toBe(1);expect(g.p2.states[27].lockedPos).toBe('MIDDLE-R');
});
it('終了時の条件を全員分先に判定し、先の疲労回復で後の条件成立を消さない',()=>{
 const g=make(true,[13,2,8,10,18,24,27,28]);for(const id of g.p1.ids)g.p1.states[id].fatigue=4;g.p1.states[2].fatigueTwoEnds=1;
 executeRound(g);expect(g.pendingBursts!.some(job=>job.id===2&&job.side===0)).toBe(true);
 resolveNextBurst(g);expect(g.p1.states[13].burstActive).toBe(true);expect(g.p1.states[2].fatigue).toBe(3);
 resolveNextBurst(g);expect(g.p1.states[2].burstActive).toBe(true);
});
it('BURST固定・属性追加・AUTO引継ぎ・楽曲予約を次ラウンドでも保持する',()=>{
 const g=make(true,[3,14,20,7,8,10,18,24]);g.p1.states[20].lastAutoGain=4;g.roundResolved=true;
 queueBursts(g,[3,14,20,7],[]);while(pendingBurst(g)){const job=pendingBurst(g)!;resolveNextBurst(g,burstTargetKind(job.id)?27:undefined,()=>.5);}
 const deckSize=g.songDeck.length;nextRound(g,()=>.5);
 expect(g.songDeck.length).toBe(deckSize);expect(g.roundSong.id).toBe('K');expect(g.p1.states[20].activeAutoCarry).toBe(4);expect(attributesOf(g.p2,27)).toEqual(['クール']);expect(g.p2.states[27].lockedPos).toBe('MIDDLE-R');
 expect(validateFormation(g.p2,formationFromArray([27,10,18,24,8]))).toContain('固定');
});
it('強制連鎖を分割・cloneしても発動済み除外を保持し、循環しない',()=>{
 let g=make(true,[48,6,12,41,8,10,18,24]);queueBursts(g,[48],[]);let steps=0;
 while(pendingBurst(g)){g=structuredClone(g);const job=pendingBurst(g)!;const options=burstTargetOptions(g,job);resolveNextBurst(g,burstTargetKind(job.id)?options[0]:undefined,()=>0);expect(++steps).toBeLessThan(30);}
 expect(g.p1.states[48].burstCount).toBe(1);expect(g.p1.states[6].burstCount).toBe(1);expect(g.burstChain).toEqual([]);
});
it('CLI一括処理と人間側の1枚ずつ処理は同seed・同対象で7ラウンドの状態と得点が一致する',()=>{
 const a=make(false,[4,7,17,6,48,12,41,8],[4,7,17,6,48,12,41,8]),b=structuredClone(a);b.interactiveBursts=true;
 for(const g of [a,b])for(const targets of g.targets){targets.koji=8;targets.matono=8;targets.kousaka=8;targets.allyBurst=8;}
 const r1=prng(712),r2=prng(712);
 for(let round=1;round<=7;round++){
  executeRound(a,a.p1.formation,a.p2.formation,r1);executeRound(b,b.p1.formation,b.p2.formation,r2);
  while(pendingBurst(b)){const job=pendingBurst(b)!;resolveNextBurst(b,burstTargetKind(job.id)?8:undefined,r2);}
  const {interactiveBursts:ia,...ca}=a,{interactiveBursts:ib,...cb}=b;expect(cb).toEqual(ca);
  if(round<7){nextRound(a,r1);nextRound(b,r2);}
 }
 expect(a.done).toBe(true);
});
it('CPUは対象選択を待たず、R7終了時のBURSTも確定得点と最終勝敗を変えない',()=>{
 const g=make(true);g.cpuBoth=true;g.round=7;g.p1.round=7;g.p2.round=7;g.p1.states[2].fatigue=3;g.p1.states[2].fatigueTwoEnds=1;
 executeRound(g);const score=[g.p1.points,g.p2.points,g.result!.final];resolvePendingBursts(g,()=>.5);
 expect(g.p1.states[2].burstActive).toBe(true);expect([g.p1.points,g.p2.points,g.result!.final]).toEqual(score);expect(g.pendingBursts).toEqual([]);
});
it('小田倉の終了時Bは次の予測・実パフォーマンスへクール追加とAUTO-5を反映し、その終了時に解除する',()=>{
 const g=make(false,[3,8,10,18,24,27,28,30],[1,3,5,17,19,21,23,25]);
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;
 g.p1.states[3].normalUsed=false;g.p1.states[3].positionCounts.CENTER=1;g.roundSong=songById('A');
 expect(countAttr(g.p2,'クール')).toBe(0);executeRound(g);
 expect(g.p1.states[3].burstCount).toBe(1);expect(g.p2.ids.every(id=>attributesOf(g.p2,id).includes('クール'))).toBe(true);
 nextRound(g,()=>.5);g.roundSong=songById('A');const before=structuredClone(g),predicted=preview(g);
 expect(countAttr(g.p2,'クール')).toBe(5);expect(attributesOf(g.p2,1)).toEqual(['クール']);
 expect(predicted.p2.members.find(m=>m.id===1)!.breakdown).toContainEqual(expect.objectContaining({sourceId:3,side:0,kind:'A',amount:-5}));
 const control=structuredClone(g);control.p2.coolOnly=false;for(const id of control.p2.ids)control.p2.states[id].addedAttributes=[];
 const original=preview(control).p2.members.find(m=>m.id===1)!;const affected=predicted.p2.members.find(m=>m.id===1)!;
 expect(affected.val).toBe(Math.max(0,original.val-5));expect(g).toEqual(before);
 executeRound(g);expect(g.result!.p2.total).toBe(predicted.p2.total);expect(g.result!.p2.members.find(m=>m.id===1)!.details.join('|')).toContain('小田倉麗奈A-5');
 expect(g.p1.states[3].burstActive).toBe(false);expect(countAttr(g.p2,'クール')).toBe(0);
 nextRound(g,()=>.5);expect(countAttr(g.p2,'クール')).toBe(0);expect(g.p1.states[3].burstCount).toBe(1);
});
it('小田倉のクール上書きはJOYFUL LOVEで解除し、PLAINを優先し、相手効果無効の対象には付与しない',()=>{
 const g=make(true,[36,3,8,10,18,24,27,28],[11,1,3,5,17,19,21,23]);g.roundResolved=true;
 queueBursts(g,[],[11]);resolveNextBurst(g,undefined,()=>.5);queueBursts(g,[3],[]);resolveNextBurst(g,undefined,()=>.5);
 expect(attributesOf(g.p2,11)).toEqual(['クール']);expect(attributesOf(g.p2,1)).toEqual(['クール']);
 nextRound(g,()=>.5);g.roundSong=songById('V');
 const plain=preview(g);expect(plain.players[1].states[1].plain).toBe(true);expect(countAttr(plain.players[1],'クール')).toBe(0);
 g.p1.formation=formationFromArray([3,36,8,10,18]);const normal=preview(g);
 expect(normal.players[1].coolOnly).toBe(false);expect(attributesOf(normal.players[1],1)).toEqual(['キュート']);
 expect(normal.players[0].states[3].burstActive).toBe(false);
});
