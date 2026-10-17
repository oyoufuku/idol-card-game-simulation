import { expect, it } from 'vitest';
import { createGame, executeRound, nextRound, preview, prepareRound } from '../game/engine';
import { calcBoth, resolveCenterSkills } from '../game/appeal';
import { applyBurst, checkBurstConditions } from '../game/burst';
import { attributesOf, formationFromArray, hasAttr, setFormation } from '../game/formation';
import { songById } from '../data/songs';
import { applyFatigueAndPost, fatiguePenalty } from '../game/fatigue';
const filler=[2,8,9,10,18,24,14,11];
const eight=(ids:number[])=>[...new Set([...ids,...filler])].slice(0,8);
const make=(ids:number[]=[],opp:number[]=[])=>createGame(eight(ids),eight(opp),['A','B','C'],['D','E','F'],'local',()=>.5);
const result=(g:ReturnType<typeof make>)=>calcBoth(g.p1,g.p2,g.roundSong);
const details=(g:ReturnType<typeof make>,id:number,side:'p1'|'p2'='p1')=>result(g)[side].members.find(m=>m.id===id)!.details.join('|');
it('石森はクールの対面を-2、Bは相手全員-1、出場累計2回とAUTO成功で終了時BURST',()=>{
 const g=make([1],[18]); expect(details(g,18,'p2')).toContain('石森璃花A-2');
 g.p2.lastAppeal=31; expect(checkBurstConditions(g,g.p1,g.p2,'draw')).not.toContain(1);
 g.p1.states[1].positionCounts.CENTER=2;g.p1.states[1].autoSuccessRounds=1;g.p2.lastAppeal=30; expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(1);
 applyBurst(g,g.p1,g.p2,1); expect(details(g,18,'p2')).toContain('石森璃花B-2');
});
it('遠藤理子は疲労2以上終了累計2回でBURST、Bは自身加算ではなく対面-4',()=>{
 const g=make([2],[18]);g.p1.states[2].fatigue=3;g.p1.states[2].fatigueTwoEnds=2;expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(2);
 applyBurst(g,g.p1,g.p2,2);expect(g.p1.states[2].burstSelfAppeal).toBe(0);expect(details(g,18,'p2')).toContain('遠藤理子B-4');
});
it('小田倉は相手ステージのクール数を対面から減算する',()=>{
 const g=make([3],[18,14,15,10,24]);expect(details(g,18,'p2')).toContain('小田倉麗奈A-5');
 applyBurst(g,g.p1,g.p2,3);expect(g.p2.ids.every(id=>hasAttr(g.p2,id,'クール'))).toBe(true);
});
it('小島はバックス時、センターとフロントの相手/楽曲の数値減少を各1軽減',()=>{
 const g=make([18,10,8,9,24,4],[1,3]);g.roundSong=songById('B');
 expect(details(g,18)).toContain('石森璃花A-1（小島A軽減）');expect(details(g,18)).toContain('夏の近道+0（小島A軽減）');
 expect(details(g,9)).toContain('夏の近道-1');
});
it('谷口のAUTOは対面減算、Cは両チームの非キュートを減算、Bはキュートのみへ上書きする',()=>{
 const g=make([5,1,2],[18]);expect(details(g,18,'p2')).toContain('谷口愛季A-2');expect(details(g,18,'p2')).toContain('谷口愛季C-1');
 applyBurst(g,g.p1,g.p2,5);expect(attributesOf(g.p1,8)).toEqual(['キュート']);
});
it('中嶋のAUTOは両チームのBURST中人数を数える',()=>{
 const g=make([6],[18]);g.p1.states[2].burstActive=true;g.p2.states[18].burstActive=true;
 expect(details(g,6)).toContain('中嶋優月A+2');
});
it('村山の条件はクール曲でバックス終了（センターではない）',()=>{
 const g=make([2,4,8,9,13,10]);g.roundSong=songById('A');expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(10);
 const h=make([10]);h.roundSong=songById('A');expect(checkBurstConditions(h,h.p1,h.p2,'draw')).not.toContain(10);
});
it('山下CENTERは楽曲で無効化されず、的野には無効化され、BURSTで相手効果を防ぐ',()=>{
 const g=make([11],[7]);g.roundSong=songById('I');expect(resolveCenterSkills(g.p1,g.p2,g.roundSong)[0]).toBe(true);
 g.roundSong=songById('A');expect(resolveCenterSkills(g.p1,g.p2,g.roundSong)[0]).toBe(false);
 applyBurst(g,g.p1,g.p2,11);expect(resolveCenterSkills(g.p1,g.p2,g.roundSong)[0]).toBe(true);
 expect(details(g,11)).toContain('山下瞳月A+1');expect(details(g,11)).toContain('山下瞳月C+5');
});
it('井上AUTOはシンメまたはバックス時センターを2回復する',()=>{
 const g=make([8,13,2]);g.roundSong=songById('A');g.p1.states[2].fatigue=5;
 expect(preview(g).players[0].states[2].fatigue).toBe(3);
 setFormation(g.p1,formationFromArray([8,18,2,9,10]),1);g.p1.states[8].fatigue=5;
 expect(preview(g).players[0].states[8].fatigue).toBe(3);
});
it('井上BURSTの条件は疲労5以上が2人、効果は全員-2',()=>{
 const g=make([13]);g.p1.ids.forEach(id=>g.p1.states[id].fatigue=5);expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(13);
 applyBurst(g,g.p1,g.p2,13);expect(g.p1.ids.map(id=>g.p1.states[id].fatigue)).toEqual([0,...Array(7).fill(3)]);
});
it('遠藤光莉はクールのシンメと自身に+1、Bでそのラウンドをジャマイカビールへ変更',()=>{
 const g=make([8,14,18]);g.roundSong=songById('A');expect(details(g,14)).toContain('遠藤光莉A+1');expect(details(g,18)).toContain('遠藤光莉A+1');
 applyBurst(g,g.p1,g.p2,14);g.round=2;prepareRound(g,()=>.5);expect(g.roundSong.name).toBe('ジャマイカビール');
});
it('大園は常時マイナス無効で加算を受け、BURST中はプラス2倍、位置補正と疲労は倍にしない',()=>{
 const g=make([15],[1]);g.roundSong=songById('A');const ownDetails=()=>preview(g).p1.members.find(m=>m.id===15)!.details.join('|');expect(ownDetails()).toContain('石森璃花A+0（マイナス無効）');expect(ownDetails()).toContain('Start over!+1');
 applyBurst(g,g.p1,g.p2,15);expect(ownDetails()).toContain('石森璃花A+0（マイナス無効）');expect(ownDetails()).toContain('Start over!+2（大園B×2）');
 expect(ownDetails()).toContain('位置+2');
});
it('大園はR5以降の前列終了でBURST、R6終了直後に発動する',()=>{
 const g=make([15]);g.p1.round=4;expect(checkBurstConditions(g,g.p1,g.p2,'draw')).not.toContain(15);
 g.p1.round=6;expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(15);
});
it('大沼は対面疲労+2、B+5・終了時基礎-1・再使用可能',()=>{
 const g=make([16],[18]);g.roundSong=songById('A');expect(preview(g).players[1].states[18].fatigue).toBe(2);
 applyBurst(g,g.p1,g.p2,16);expect(details(g,16)).toContain('大沼昌保B+5');g.interactiveBursts=true;executeRound(g);
 expect(g.p1.states[16].normalUsed).toBe(false);expect(g.p1.states[16].fatigue).toBe(3);expect(g.p1.states[16].permBonus).toBe(-1);
});

it('武元はクール曲+3、出場中クール累計2回でBURST、Bで曲属性をクールにする',()=>{
 const g=make([18]);g.roundSong=songById('A');expect(details(g,18)).toContain('武元唯衣A+3');
 g.p1.states[18].coolStageRounds=2;expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(18);applyBurst(g,g.p1,g.p2,18);
 g.round=2;g.songDeck[0]='B';prepareRound(g,()=>.5);expect(g.roundSong.type).toBe('クール');expect(g.roundSong.id).toBe('B');
});
it('田村は相手バックスBURSTに即反応し、対象をCENTERへ移動・固定しBのみを無効化する',()=>{
 const g=make([19],[2,4,8,9,10,18]);applyBurst(g,g.p2,g.p1,18,false,()=>0);
 expect(g.p1.states[19].burstActive).toBe(true);expect(g.p2.formation.CENTER).toBe(18);expect(g.p2.states[18].lockedPos).toBe('CENTER');expect(g.p2.states[18].burstDebuff).toBe(0);expect(g.p2.states[18].burstDisabledUntilRound).toBe(2);
});
it('田村はステージでの相手BURSTには反応しない',()=>{
 const g=make([19],[18]);applyBurst(g,g.p2,g.p1,18);expect(g.p1.states[19].burstActive).toBe(false);
});
it('増本は両チームの非ユーモア全員疲労+1、Bは次回開始前に対面疲労+8',()=>{
 const g=make([21],[18]);g.roundSong=songById('A');expect(preview(g).players[1].states[18].fatigue).toBe(1);
 applyBurst(g,g.p1,g.p2,21);expect(g.p2.states[18].fatigue).toBe(0);expect(preview(g).players[1].states[18].fatigue).toBe(9);
});
it('森田はBURST中3属性、対面-2、CENTERは自チームの属性種類数を減算',()=>{
 const g=make([22,18,9],[18]);applyBurst(g,g.p1,g.p2,22);expect(attributesOf(g.p1,22)).toEqual(['キュート','クール','ユーモア']);
 expect(details(g,18,'p2')).toContain('森田ひかるB-2');expect(details(g,18,'p2')).toContain('森田ひかるC-3');
});
it('山崎は旧松田の逆転効果を持ち、永続+2は強制BURSTでも重複する',()=>{
 const g=make([24],[18]);g.p2.points=4;expect(details(g,24)).toContain('山崎天A+4');
 applyBurst(g,g.p1,g.p2,24);applyBurst(g,g.p1,g.p2,24,true);expect(g.p1.states[24].permBonus).toBe(4);expect(g.p1.states[24].burstCount).toBe(2);
});
it('桜月は疲労減少量2倍（7以上は-6）、下限0',()=>{
 expect(fatiguePenalty(10,3,2)).toBe(8);expect(fatiguePenalty(10,5,2)).toBe(6);expect(fatiguePenalty(10,7,2)).toBe(4);expect(fatiguePenalty(-2,7,2)).toBe(0);
});
it('MCタイムは全員疲労-1、Make or Breakは非ユーモア疲労+1',()=>{
 const g=make([18]);g.p1.ids.forEach(id=>g.p1.states[id].fatigue=3);g.roundSong=songById('J');expect(preview(g).players[0].states[18].fatigue).toBe(2);
 g.roundSong=songById('C');expect(preview(g).players[0].states[18].fatigue).toBe(4);
});
it('ジャマイカビールはCENTER/FRONTのクールだけ+2',()=>{
 const g=make([18,10,24,8,9]);g.roundSong=songById('K');expect(details(g,18)).toContain('ジャマイカビール+2');expect(details(g,10)).toContain('ジャマイカビール+2');expect(details(g,8)).not.toContain('ジャマイカビール');
});
it('ドローンはBURST中だけ-1、UDAGAWAは3属性不足チームだけ-1',()=>{
 const g=make([18,10,24,8,14]);g.roundSong=songById('G');expect(details(g,18)).not.toContain('ドローン旋回中');g.p1.states[18].burstActive=true;expect(details(g,18)).toContain('ドローン旋回中-1');
 g.roundSong=songById('H');expect(details(g,18)).toContain('UDAGAWA GENERATION-1');g.p1.addedAttributes=['キュート','ユーモア'];expect(details(g,18)).not.toContain('UDAGAWA GENERATION');
});
it('松田は味方2人のBURSTで即時発動し、累計5回でAUTO+3・発動中C+2',()=>{
 const g=make([12,2,8]);applyBurst(g,g.p1,g.p2,2);expect(g.p1.states[12].burstActive).toBe(false);
 applyBurst(g,g.p1,g.p2,8);expect(g.p1.states[12].burstActive).toBe(true);
 expect(details(g,2)).toContain('松田里奈C+2');applyBurst(g,g.p1,g.p2,8,true);applyBurst(g,g.p1,g.p2,8,true);
 expect(details(g,12)).toContain('松田里奈A+3');
 const before=g.p1.states[2].burstCount;executeRound(g,g.p1.formation,g.p2.formation,()=>.15);
 expect(g.p1.states[2].normalUsed).toBe(false);expect(g.p1.states[2].burstCount).toBe(before);
});
it('幸坂はバックスから相手センター-2、Bは指定メンバーをFRONT-Rへ固定',()=>{
 const g=make([2,8,9,10,18,17],[18]);expect(details(g,18,'p2')).toContain('幸坂茉里乃A-2');
 g.targets[0].kousaka=18;applyBurst(g,g.p1,g.p2,17);expect(g.p2.formation['FRONT-R']).toBe(18);expect(g.p2.states[18].burstDebuff).toBe(-6);
});
it('幸坂のキュート曲でステージ終了が終了時BURST条件、バックスでは満たさない',()=>{
 const g=make([17]);g.roundSong=songById('B');expect(checkBurstConditions(g,g.p1,g.p2,'draw')).toContain(17);
 const h=make([2,8,9,10,18,17]);h.roundSong=songById('B');expect(checkBurstConditions(h,h.p1,h.p2,'draw')).not.toContain(17);
});
it('藤吉は実加算合計4以上で成立し、Bは自身AUTOの加算を次へ引継ぐ',()=>{
 const g=make([20],[18]);g.roundSong=songById('A');applyBurst(g,g.p2,g.p1,18);
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;g.p1.states[20].normalUsed=false;
 executeRound(g);expect(g.p1.states[20].lastAutoGain).toBe(3);expect(g.p1.states[20].lastAppealGain).toBeGreaterThanOrEqual(4);expect(g.p1.states[20].burstActive).toBe(true);expect(g.p1.states[20].appealReductionShield).toBe(false);
 nextRound(g,()=>.5);expect(g.p1.states[20].activeAutoCarry).toBe(3);
});

it('藤吉同士のコピーは循環せず、藤吉Cはクールの味方への相手AUTO減少を無効',()=>{
 const g=make([20],[20]);g.roundSong=songById('J');expect(result(g).p1.members[0].autoGain).toBe(0);
 const h=make([20,18],[1,3]);expect(details(h,20)).toContain('石森璃花A+0（藤吉C）');
});
it('守屋は対面の位置以外の純減3以上（疲労含む）でBURSTし、累計にはしない',()=>{
 const g=make([8,23],[10,18]);g.p2.formation=formationFromArray([10,2,18,9,8]);for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;g.p1.states[23].normalUsed=false;
 for(let round=1;round<=2;round++){g.roundSong=songById('A');g.p2.states[18].fatigue=3;executeRound(g);expect(g.p1.states[23].lastOppositeReduction).toBe(3);expect(g.p1.states[23].burstActive).toBe(false);nextRound(g,()=>.5);}
 expect(g.p1.states[23].autoDebuffTotal).toBe(4);g.roundSong=songById('A');g.roundSong=songById('B');g.p2.states[18].fatigue=3;executeRound(g);
 expect(g.p1.states[23].lastOppositeReduction).toBe(4);expect(g.p1.states[23].lastOppositeGain).toBe(0);expect(g.p1.states[23].lastAutoDebuff).toBe(2);expect(g.p1.states[23].burstActive).toBe(true);
 nextRound(g,()=>.5);expect(g.p1.states[23].activeAutoCarry).toBe(2);
});
it('山下の相手効果無効は疲労・属性・強制位置・数値減少を防ぐ',()=>{
 const g=make([11],[3,16,17]);applyBurst(g,g.p1,g.p2,11);g.targets[1].kousaka=11;
 applyBurst(g,g.p2,g.p1,3);applyBurst(g,g.p2,g.p1,17);expect(g.p1.states[11].attributeOverride).toBeNull();expect(g.p1.formation.CENTER).toBe(11);expect(g.p1.states[11].lockedPos).toBeNull();
});
it('小島軽減はMIDDLE、疲労、同チーム由来CENTER減少には適用しない',()=>{
 const g=make([5,18,8,10,9,4]);g.roundSong=songById('B');expect(details(g,18)).toContain('谷口愛季C-1');expect(details(g,10)).toContain('夏の近道-1');
});
it('的野のAUTO無効は遠藤理子の疲労軽減にも適用する',()=>{
 const g=make([2],[7]);g.roundSong=songById('A');g.interactiveBursts=true;executeRound(g);expect(g.p1.states[2].fatigue).toBe(3);
});
it('既存の位置固定と衝突するFRONT-R強制は既存固定を優先する',()=>{
 const g=make([17],[18,2,8]);g.p2.states[8].lockedPos='FRONT-R';g.targets[0].kousaka=18;
 applyBurst(g,g.p1,g.p2,17);expect(g.p2.formation['FRONT-R']).toBe(8);expect(g.p2.states[18].burstDebuff).toBe(0);
});
it('山崎のCENTER敗北時ボーナスはステージだけに次回1回、引き分けでは発動しない',()=>{
 const g=make([24]);g.roundSong=songById('A');
 applyFatigueAndPost(g.p1,g.p2,'draw',true,g.roundSong);expect(g.p1.states[24].nextBonus).toBe(0);
 applyFatigueAndPost(g.p1,g.p2,'loss',true,g.roundSong);expect(g.p1.states[24].nextBonus).toBe(1);expect(g.p1.states[14].nextBonus).toBe(0);
 prepareRound(g,()=>.5);expect(g.p1.states[24].activeNextBonus).toBe(1);executeRound(g);expect(g.p1.states[24].activeNextBonus).toBe(0);
});
