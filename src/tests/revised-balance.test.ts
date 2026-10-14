import { it,expect } from 'vitest';
import { byId,formationFromArray } from '../game/formation';
import { createGame,executeRound,preview } from '../game/engine';
import { applyBurst } from '../game/burst';
import { calcBoth } from '../game/appeal';
import { songById } from '../data/songs';
import { calculationContext } from '../game/context';
import { skillFor } from '../game/skills';
const make=(a=[26,8,10,20,24,14,9,13],b=[8,10,18,24,27,28,30,31])=>createGame(a,b,['A','B','C'],['D','E','F'],'local',()=>.5);
it('修正Excelの基礎値・山下C・大沼B/疲労・平岡Bをそのまま反映する',()=>{
 expect([8,40,41].map(id=>byId(id).base)).toEqual([4,5,5]);
 for(const [id,amount] of [[16,5],[30,5]]){const g=make([id,8,10,18,24,27,28,31]);applyBurst(g,g.p1,g.p2,id);expect(g.p1.states[id].burstSelfAppeal).toBe(amount);}
 const g=make([11,8,10,18,24,27,28,31]);expect(preview(g).p1.members[0].breakdown).toContainEqual(expect.objectContaining({sourceId:11,kind:'C',amount:5}));
});
it('藤吉の加算集計は位置ボーナス・位置へのC/曲補正・基礎補正を除外する',()=>{
 const g=make();g.roundSong=songById('M');g.p1.states[20].permBonus=10;
 const member=preview(g).p1.members.find(m=>m.id===20)!;expect(member.skillGain).toBe(0);expect(member.val).toBeGreaterThanOrEqual(10);
});
it('藤吉は自身AUTOが0でも味方B/曲プラスの合計4で条件を満たす',()=>{
 const g=make([42,20,8,10,18,9,14,24],[8,15,18,24,27,28,30,31]);g.roundSong=songById('J');g.p1.states[20].activeNextBonus=4;
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;g.p1.states[20].normalUsed=false;
 executeRound(g);expect(g.p1.states[20].lastAutoGain).toBe(0);expect(g.p1.states[20].lastAppealGain).toBe(4);expect(g.p1.states[20].burstActive).toBe(true);
});

it('守屋の集計は正の加算と相殺せず、位置ボーナス無効を数えない',()=>{
 const g=make([26,8,10,23,37,14,9,13],[8,10,18,24,27,28,30,31]);g.p1.formation=formationFromArray([37,8,10,23,26]);g.roundSong=songById('A');
 const r=calcBoth(g.p1,g.p2,g.roundSong);expect(r.p2.members.find(m=>m.id===8)!.skillReduction).toBe(0);
 g.p2.states[24].fatigue=5;const member=preview(g).p2.members.find(m=>m.id===24)!;expect(member.skillReduction).toBe(4);
});
it('宮田BはR3以降・味方8人の終了時総疲労15以下、AUTOは10以下を維持する',()=>{
 const g=make([31,8,10,18,24,27,28,30]),ctx=calculationContext(g.p1,g.p2,31,g.roundSong),skill=skillFor(31);
 g.p1.round=2;g.p1.states[8].fatigue=15;expect(skill.condition!(ctx)).toBe(false);
 g.p1.round=3;expect(skill.condition!(ctx)).toBe(true);g.p1.states[8].fatigue=16;expect(skill.condition!(ctx)).toBe(false);
 g.p1.states[8].fatigue=14;g.p1.states[30].fatigue=1;expect(skill.condition!(ctx)).toBe(true);g.p1.states[30].fatigue=2;expect(skill.condition!(ctx)).toBe(false);
 g.p1.states[30].fatigue=0;g.p1.states[8].fatigue=10;expect(skill.autoAppeal!(ctx)).toBe(2);g.p1.states[8].fatigue=11;expect(skill.autoAppeal!(ctx)).toBe(0);
});
