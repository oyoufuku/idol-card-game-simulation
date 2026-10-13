import {expect,it} from 'vitest';
import {createGame,executeRound,nextRound,preview,clonePlayer} from '../game/engine';
import {queueBursts,resolvePendingBursts,applyBurst,checkBurstConditions} from '../game/burst';
import {skillEnabled,setAnalysisSkillMasks} from '../game/analysis-skills';
import {skillFor} from '../game/skills';
import {byId,posOf,validateFormation} from '../game/formation';
import {songById} from '../data/songs';
import {forecastBurstFormation} from '../game/burst-cpu';
import {prng} from '../game/seeded-random';

function scenario(target=26){
 const g=createGame([19,8,10,18,24,27,28,30],[8,14,18,24,27,target,28,30],['A','B','C'],['D','E','F'],'local',()=>0,{recordEffects:true});
 g.roundSong=songById('A');return g;
}
it('終了処理の相手BACKSのみから抽選し、旧CENTERをBACKSへ、対象をCENTER固定+Bのみ無効にする',()=>{
 const g=scenario();queueBursts(g,[],[14,26,28]);resolvePendingBursts(g,()=>0);
 expect(g.p2.formation.CENTER).toBe(26);expect(posOf(g.p2,8)).toBe('BACK');expect(validateFormation(g.p2,g.p2.formation)).toBeNull();
 expect(g.p2.states[26]).toMatchObject({lockedPos:'CENTER',burstDisabledUntilRound:2,burstDebuff:0,burstSelfAppeal:0,burstCount:1,normalUsed:true,burstActive:true,fatigue:0});
 expect(g.p1.states[19].burstCount).toBe(1);expect(g.p2.burstBackCandidates).toEqual([26,28]);
 expect(skillEnabled(g.p2,26,'AUTO')).toBe(true);expect(skillEnabled(g.p2,26,'CENTER')).toBe(true);expect(skillEnabled(g.p2,26,'BURST')).toBe(false);
 expect(g.skillEffects!.some(e=>e.id===19&&e.targets.some(t=>t.id===26&&t.label==='Bスキル無効'))).toBe(true);
});
it('小坂のAUTO倍化とCENTER加算は残し、Bの+3と終了時疲労+5を止める',()=>{
 const g=scenario();queueBursts(g,[],[26]);resolvePendingBursts(g,()=>0);g.roundResolved=true;g.songDeck=['A'];nextRound(g,()=>0);
 const predicted=preview(g),member=predicted.p2.members.find(m=>m.id===26)!;
 expect(member.details).toContain('位置+6');expect(member.details).not.toContain('小坂菜緒B+3');
 executeRound(g,g.p1.formation,g.p2.formation,()=>0);expect(g.p2.states[26].fatigue).toBe(6);expect(g.p2.states[26].burstDisabledUntilRound).toBeUndefined();expect(skillEnabled(g.p2,26,'BURST')).toBe(true);
});
it('完了済みのチャージ回復・BURST疲労回復は残し、次回のAUTO消費も有効',()=>{
 const g=scenario(32);g.p2.states[32].charge=1;g.p2.states[32].lastSpentCharge=4;g.p2.states[32].fatigue=6;
 queueBursts(g,[],[32]);resolvePendingBursts(g,()=>0);
 expect(g.p2.states[32]).toMatchObject({charge:4,fatigue:0,burstCount:1,lockedPos:'CENTER'});
 g.round=g.p1.round=g.p2.round=2;const predicted=preview(g);expect(predicted.players[1].states[32].spentCharge).toBe(4);
 expect(predicted.p2.members.find(m=>m.id===32)!.autoGain).toBe(4);
});
it('次回の通常BURST条件を無効にし、終了処理後に解除する。通常使用済み・累計回数は巻き戻さない',()=>{
 const g=scenario(41);queueBursts(g,[],[41]);resolvePendingBursts(g,()=>0);
 expect(g.p2.states[41].normalUsed).toBe(false);expect(g.p2.states[41].burstCount).toBe(1);expect(g.p2.states[41].burstSelfAppeal).toBe(0);
 g.round=g.p1.round=g.p2.round=2;g.p2.states[41].matchedAttribute='クール';
 expect(checkBurstConditions(g,g.p2,g.p1,'draw')).not.toContain(41);
 executeRound(g,g.p1.formation,g.p2.formation,()=>0);
 expect(g.p2.states[41].burstCount).toBe(1);expect(g.p2.states[41].burstDisabledUntilRound).toBeUndefined();
 expect(skillFor(41,g.p2).condition).toBeDefined();
});
it('強制BURSTの共通回復・履歴は記録するが、無効期間中のB効果と連鎖は発動しない',()=>{
 const g=scenario(41);queueBursts(g,[],[41]);resolvePendingBursts(g,()=>0);
 g.round=g.p1.round=g.p2.round=2;g.p2.states[41].fatigue=7;applyBurst(g,g.p2,g.p1,41,true,()=>0);
 expect(g.p2.states[41]).toMatchObject({fatigue:0,burstCount:2,forcedBurstCount:1,burstSelfAppeal:0,burstDisabledUntilRound:2});
 queueBursts(g,[],[]);resolvePendingBursts(g,()=>0);applyBurst(g,g.p2,g.p1,41,true,()=>0);expect(g.p2.states[41].burstSelfAppeal).toBe(2);
});
it('相手効果無効・既存位置固定を優先し、抽選後に勝手に別対象へ選び直さない',()=>{
 for(const protectedState of ['shield','negativeShield','lockedPos'] as const){const g=scenario();if(protectedState==='lockedPos')g.p2.states[26].lockedPos='BACK';else g.p2.states[26][protectedState]=true;
  g.p2.burstBackCandidates=[26];applyBurst(g,g.p1,g.p2,19,false,()=>0);
  expect(g.p2.formation.CENTER).toBe(8);expect(g.p2.states[26].burstDisabledUntilRound).toBeUndefined();
 }
});
it('通常/UI/BURST CPUの予測は、新しいB無効状態を共通engineで計算する',()=>{
 const g=scenario(41);queueBursts(g,[],[41]);resolvePendingBursts(g,()=>0);g.round=g.p1.round=g.p2.round=2;
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];const p=preview(g),forecast=forecastBurstFormation(g,2,g.p2.formation);
 expect(forecast.total).toBe(p.p2.total);expect(forecast.predictedBursts.filter(b=>b.id===41)).toEqual([]);expect(byId(19).B).toContain('Bスキルを無効');expect(byId(19).B).not.toContain('Appealを-');
});
it('B無効とWARのAUTO ablationを同時に適用してもAUTOを復活させない',()=>{
 const g=scenario(26);queueBursts(g,[],[26]);resolvePendingBursts(g,()=>0);setAnalysisSkillMasks(g.p2,[{id:26,kind:'AUTO'}]);
 expect(skillFor(26,g.p2).positionMultiplier).toBeUndefined();expect(skillFor(26,g.p2).postFatigue).toBeUndefined();expect(skillFor(26,g.p2).centerPositionBonus).toBeDefined();
});
