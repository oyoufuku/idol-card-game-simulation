import {expect,it} from 'vitest';
import {createGame,preview,clonePlayer,executeRound,nextRound} from '../game/engine';
import {applyBurst,burstTargetKind,burstTargetOptions,pendingBurst,queueBursts,resolveNextBurst} from '../game/burst';
import {chargeBackCandidates,chooseChargeBackTarget} from '../game/burst-swap';
import {byId,formationFromArray,idsBack,posOf} from '../game/formation';
import {calculationContext} from '../game/context';
import {skillFor,SKILLS} from '../game/skills';
import {songById} from '../data/songs';
import {prng} from '../simulation/random';
import {abilitySemantics} from '../simulation/ability-semantics';
const make=(a=[32,8,10,18,24,13,27,39],b=[8,10,18,24,27,28,30,31])=>{const g=createGame(a,b,['A','B','C'],['D','E','F'],'local',()=>.5,{interactiveBursts:true});g.roundSong=songById('A');return g;};
it.each([32,38,44])('チャージ%iの人間操作は合法なBACKSを指定するまで停止し、選んだ相手と交換する',id=>{
 const g=make([id,8,10,18,24,13,27,39]);g.p1.states[id].lastSpentCharge=4;queueBursts(g,[id],[]);
 const job=pendingBurst(g)!;expect(burstTargetKind(id)).toBe('chargeBack');expect(burstTargetOptions(g,job)).toEqual([13,27,39]);
 const before=structuredClone(g);expect(()=>resolveNextBurst(g)).toThrow('対象');expect(g).toEqual(before);expect(()=>resolveNextBurst(g,8)).toThrow('対象');
 resolveNextBurst(g,39,prng(1));expect(g.p1.formation.CENTER).toBe(39);expect(posOf(g.p1,id)).toBe('BACK');expect(g.p1.states[id].charge).toBe(4);
});
it('チャージ交代は位置固定を守り、BACKSにいる場合・合法交換先がない場合は最後の消費値まで回復のみ',()=>{
 for(const back of [false,true]){const g=make();g.p1.states[32].lastSpentCharge=5;g.p1.states[32].spentCharge=0;g.p1.states[32].charge=2;
  if(back)g.p1.formation=formationFromArray([13,8,10,18,24]);else for(const id of idsBack(g.p1))g.p1.states[id].lockedPos='BACK';
  queueBursts(g,[32],[]);expect(burstTargetOptions(g,pendingBurst(g)!)).toEqual([]);expect(resolveNextBurst(g,undefined,prng(1))).toBe(true);
  expect(posOf(g.p1,32)).toBe(back?'BACK':'CENTER');expect(g.p1.states[32].charge).toBe(5);
 }
});
it.each([0,1])('チャージ交代CPU side%iは通常評価順で最善の合法交代を選び、未知の曲を参照せず盤面を変更しない',side=>{
 const g=make();if(side===1){const p=g.p1;g.p1=g.p2;g.p2=p;}const p=side===0?g.p1:g.p2;
 // Candidate base values alone rank 39 (4) > 27 (3) > 13 (2).
 // The real AUTO/CENTER effects must also enter the comparison.
 p.formation=formationFromArray([32,8,10,18,24]);p.ids=[32,8,10,18,24,13,27,39];
 // Keep both players' already revealed formations. No future song draws.
 p.states[32].lastSpentCharge=4;p.states[32].charge=0;g.cpuBoth=true;
 const before=structuredClone(g);expect(chargeBackCandidates(p,32)).toEqual([13,27,39]);const target=chooseChargeBackTarget(g,p,32,prng(12));expect(g).toEqual(before);
 const q=clonePlayer(p);q.states[13].lockedPos='BACK';q.states[27].lockedPos='BACK';expect(chargeBackCandidates(q,32)).toEqual([39]);
 // 39 has more base Appeal, but 27's Cool count AUTO is +2, so the real
 // engine should choose 27 rather than rank only the printed base.
 expect(target).toBe(27);g.songDeck=['F','E','D'];g.encorePool=['F'];expect(chooseChargeBackTarget(g,p,32,prng(12))).toBe(target);
 applyBurst(g,p,side===0?g.p2:g.p1,32,false,prng(12));expect(p.formation.CENTER).toBe(target);expect(p.states[32].charge).toBe(4);
});
it('中嶋はステージのユーモア3人で成立し、味方ユーモアだけからseed付きで強制BURSTする',()=>{
 const g=make([6,9,16,18,24,41,8,10]);expect(skillFor(6).condition!(calculationContext(g.p1,g.p2,6,g.roundSong))).toBe(true);
 expect(burstTargetKind(6)).toBeUndefined();const h=structuredClone(g);applyBurst(g,g.p1,g.p2,6,false,prng(34));applyBurst(h,h.p1,h.p2,6,false,prng(34));expect(g).toEqual(h);
 const forced=g.p1.ids.filter(id=>g.p1.states[id].forcedBurstCount);expect(forced).toHaveLength(1);expect([9,16,41]).toContain(forced[0]);expect(g.p1.states[forced[0]].normalUsed).toBe(false);
 const targets:number[]=[];skillFor(6).burst({...calculationContext(h.p1,h.p2,6,h.roundSong),game:{...h,burstSeen:['1:9','1:16','1:41']},random:()=>{throw new Error('候補なし時の乱数');},burst:id=>targets.push(id)});expect(targets).toEqual([]);
});
it('最新の髙橋・小西・濱岸・松田好花と村井の保護を文面だけでなく実計算で確認する',()=>{
 const g=make([27,28,18,10,24,46,48,9]);g.p1.formation=formationFromArray([48,28,18,27,24]);g.round=2;g.p1.round=2;g.p2.round=2;
 g.p1.songHistory=['クール'];const r=preview(g);expect(r.p1.members.find(m=>m.id===48)!.autoGain).toBe(2);expect(r.p1.members.find(m=>m.id===27)!.autoGain).toBe(2);
 expect(r.p1.members.find(m=>m.id===28)!.details.join('|')).toContain('小西夏菜実A+1');
 expect(skillFor(46).autoAppeal!(calculationContext(g.p1,g.p2,46,g.roundSong))).toBe(2);g.roundSong=songById('B');expect(skillFor(46).autoAppeal!(calculationContext(g.p1,g.p2,46,g.roundSong))).toBe(0);
 g.p1.states[46].repeatedSongAutos=1;expect(skillFor(46).condition!(calculationContext(g.p1,g.p2,46,g.roundSong))).toBe(false);g.p1.states[46].repeatedSongAutos=2;expect(skillFor(46).condition!(calculationContext(g.p1,g.p2,46,g.roundSong))).toBe(true);
 expect(abilitySemantics(byId(9))).toMatchObject({negativeProtection:true,partyProtection:true,antiSkill:true});
});
it('藤吉は対面に与えられた他人AUTO/B/曲をコピーせず、自身AUTO加算のみを引き継ぐ',()=>{
 const g=make([20,8,10,18,24,27,28,30],[18,14,10,8,24,27,28,30]);g.p2.formation=formationFromArray([8,14,18,24,10]);g.p1.formation=formationFromArray([8,20,10,18,24]);
 applyBurst(g,g.p2,g.p1,18);g.p2.states[18].permBonus=10;const m=preview(g).p1.members.find(m=>m.id===20)!;
 // Opposite Takemoto also gets Hikari A+1, B+2 and song+1. Copy only her own A+3.
 expect(m.autoGain).toBe(3);expect(m.skillGain).toBe(4);
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;g.p1.states[20].normalUsed=false;
 executeRound(g);expect(g.p1.states[20].lastAppealGain).toBe(4);resolveNextBurst(g);expect(g.p1.states[20].activeAutoCarry).toBe(3);
 nextRound(g,()=>.5);const actual=preview(g).p1.members.find(m=>m.id===20)!;expect(actual.details.join('|')).toContain('前回AUTO引継ぎB+3');
});

it('藤吉コピーは対面AUTOの定数でなく、無効化・倍率後の最終実適用値を参照する',()=>{
 const original=SKILLS.takemoto;
 // A controlled target-side modifier isolates the resolution order. This
 // test double does not change the catalog or any production card behavior.
 SKILLS.takemoto={...original,immuneAppeal:true};
 try {
  const g=make([20,8,10,24,27,28,30,31],[18,8,10,24,27,28,30,31]);
  for(const bursting of [false,true]){
   g.p2.states[18].burstActive=bursting;g.p2.states[18].burstStacks=+bursting;
   const r=preview(g),copier=r.p1.members.find(m=>m.id===20)!,opposite=r.p2.members.find(m=>m.id===18)!;
   expect(opposite.autoGain).toBe(bursting?6:0);expect(copier.autoGain).toBe(opposite.autoGain);
  }
 }finally{SKILLS.takemoto=original;}
});
