import {disableBurstSkill} from '../game/skill-suppression';
import {applyFatigueAndPost} from '../game/fatigue';
import {effectsFor} from '../game/effects';
import {expect,it} from 'vitest';
import {createGame,executeRound,nextRound,preview} from '../game/engine';
import {applyBurst,checkBurstConditions,pendingBurst,resolvePendingBursts} from '../game/burst';
import {songById} from '../data/songs';
import {skillFor} from '../game/skills';
import {calculationContext} from '../game/context';
import {attributesOf,formationFromArray,posOf,hasThreeBackAttributes} from '../game/formation';
const eight=(ids:number[])=>[...new Set([...ids,8,10,18,24,27,28,30,31])].slice(0,8);
function game(a:number[],b:number[]=[8,10,18,24,27,28,30,31]){const g=createGame(eight(a),eight(b),['A','B','C'],['D','E','F'],'local',()=>.2,{interactiveBursts:true,recordEffects:true});g.roundSong=songById('A');for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;return g;}
const condition=(g:ReturnType<typeof game>,id:number)=>skillFor(id,g.p1).condition!(calculationContext(g.p1,g.p2,id,g.roundSong));
it('石森は実際のAUTO成功を伴う出場2回、遠藤理子は疲労2以上の終了2回で成立する',()=>{
 const g=game([1,2],[18]);g.p1.states[2].fatigue=3;g.p1.states[1].normalUsed=g.p1.states[2].normalUsed=false;
 executeRound(g);expect(g.p1.states[1].autoSuccessRounds).toBe(1);expect(g.p1.states[1].burstCount).toBe(0);expect(g.p1.states[2].burstCount).toBe(0);
 resolvePendingBursts(g,()=>.2);nextRound(g,()=>.2);g.roundSong=songById('A');executeRound(g);expect(g.pendingBursts?.map(j=>j.id)).toEqual(expect.arrayContaining([1,2]));
});
it('条件参照だけでは回数履歴を増やさない',()=>{const g=game([4,11]);for(let n=0;n<3;n++){checkBurstConditions(g,g.p1,g.p2,'win');preview(g);}expect(g.p1.states[4].positionCounts).toEqual({});expect(g.p1.states[11].positionCounts).toEqual({});expect(g.p1.states[8].stageWins).toBeUndefined();});
it('村井Bは本人が登場・出場しなくても次のステージ全員を+1し、敵のA/C無効と曲減少を防ぐ',()=>{
 const g=game([8,10,18,24,27,9],[7,1]);applyBurst(g,g.p1,g.p2,9,true);g.roundSong=songById('B');const r=preview(g),p=r.players[0];
 expect(posOf(p,9)).toBe('BACK');for(const id of Object.values(p.formation)){expect(p.states[id].shield).toBe(true);expect(p.states[id].negativeShield).toBe(true);expect(r.p1.members.find(m=>m.id===id)!.breakdown).toContainEqual(expect.objectContaining({sourceId:9,kind:'B',amount:1}));}
 expect(r.p1.members[0].details.join('|')).not.toContain('AUTO無効');
});
it('小島Bは交換先だけへ統合防御を付与し、次回終了で解除する',()=>{const g=game([4,8],[7,16]);g.targets[0].koji=8;g.p1.states[8].fatigue=5;applyBurst(g,g.p1,g.p2,4,true);expect(g.p1.states[8].shield).toBe(true);expect(g.p1.states[4].shield).toBe(false);expect(g.p1.states[4].fatigue).toBe(5);expect(preview(g).players[0].states[8].negativeShield).toBe(true);executeRound(g);expect(g.p1.states[8].shield).toBe(false);});
it('新開始前Bは曲疲労・山口AUTOより先に解決し、JOYFULでは解除される',()=>{
 const g=game([21],[42]);applyBurst(g,g.p1,g.p2,21,true);g.roundSong=songById('C');const r=preview(g);expect(r.players[1].states[42].fatigue).toBe(7); // +8, then Yamaguchi's own recovery -1; Humor avoids song fatigue.
 expect(r.players[1].states[42].autoTriggered).toBe(true);g.roundSong=songById('V');expect(preview(g).players[1].states[42].fatigue).toBe(0);
});
it('小田倉の上書きはクールのみ、免疫を尊重しJOYFULで元に戻る',()=>{const g=game([3],[11,1]);applyBurst(g,g.p2,g.p1,11,true);applyBurst(g,g.p1,g.p2,3,true);expect(attributesOf(g.p2,1)).toEqual(['クール']);g.roundSong=songById('V');expect(attributesOf(preview(g).players[1],1)).toEqual(['キュート']);});
it('守屋の条件は1回の純減で判定し、増加と相殺する',()=>{const g=game([23]);g.p1.states[23].lastOppositeReduction=5;g.p1.states[23].lastOppositeGain=3;expect(condition(g,23)).toBe(false);g.p1.states[23].lastOppositeGain=2;expect(condition(g,23)).toBe(true);applyBurst(g,g.p1,g.p2,23,true);expect(g.p2.states[g.p2.formation.CENTER].lockedPos).toBe('CENTER');});
it('宮地Bは対面の永続基礎を下限0で下げ、位置ボーナスを無効化しない',()=>{const g=game([37],[26]);applyBurst(g,g.p1,g.p2,37,true);expect(g.p2.states[26].permBonus).toBe(-2);applyBurst(g,g.p1,g.p2,37,true);applyBurst(g,g.p1,g.p2,37,true);expect(g.p2.states[26].permBonus).toBe(-5);expect(preview(g).p2.members[0].details).toContain('位置+6');});
it('清水のBACKS3属性は異なる3人へ割当できることが必要',()=>{const g=game([35,8,10,18,24,22,5,1]);g.p1.states[22].addedAttributes=['クール','ユーモア'];expect(hasThreeBackAttributes(g.p1)).toBe(false);g.p1.states[5].addedAttributes=['クール'];expect(hasThreeBackAttributes(g.p1)).toBe(true);g.p1.states[35].qualifiedBackRounds=2;expect(condition(g,35)).toBe(true);});
it('松田好花は自軍の前2終了処理だけを参照し、今回や相手のBURSTは妨げない',()=>{const g=game([48]);g.round=g.p1.round=g.p2.round=3;g.p2.burstRounds=[1,2];g.p1.burstRounds=[3];expect(condition(g,48)).toBe(true);g.p1.burstRounds=[2];expect(condition(g,48)).toBe(false);});
it('富田は同じステージから重複なく3人を強制BURSTし、通常権利を残す',()=>{const g=game([47,8,10,18,24]);applyBurst(g,g.p1,g.p2,47,true,()=>.2);const targets=g.p1.ids.filter(id=>id!==47&&g.p1.states[id].forcedBurstCount);expect(targets).toHaveLength(3);expect(new Set(targets).size).toBe(3);for(const id of targets)expect(g.p1.states[id].normalUsed).toBe(true);expect(g.p1.states[47].burstCount).toBe(1);});
it('強制BURST後も通常未使用なら通常BURSTでき、使用済みならリセットまで不可',()=>{const g=game([18]);g.p1.states[18].normalUsed=false;applyBurst(g,g.p1,g.p2,18,true);expect(g.p1.states[18].normalUsed).toBe(false);applyBurst(g,g.p1,g.p2,18);expect(g.p1.states[18].normalUsed).toBe(true);expect(g.p1.states[18].burstCount).toBe(2);applyBurst(g,g.p1,g.p2,18);expect(g.p1.states[18].burstCount).toBe(2);expect(pendingBurst(g)).toBeUndefined();});

it('統合防御は曲のC無効・位置疲労・既存疲労減点・自軍負担を防がない',()=>{
 const g=game([9,21,8,10,18],[8]);applyBurst(g,g.p1,g.p2,9,true);g.p1.states[8].fatigue=5;g.roundSong={...songById('A'),rule:'disableCenter'};
 const r=preview(g);expect(r.players[0].states[8].fatigue).toBe(6);expect(r.p1.members.find(m=>m.id===8)!.breakdown).toContainEqual(expect.objectContaining({kind:'疲労',amount:-2}));
 g.p1.enteredThisRoundIds=[8];expect(r.players[0].states[9].centerTriggered).toBe(false);
 const before=g.p1.states[8].fatigue;applyFatigueAndPost(g.p1,g.p2,'draw',false,songById('A'));expect(g.p1.states[8].fatigue).toBe(before+2);
});
it('B無効はそのB由来の防御だけを止め、重複した他の防御は残す',()=>{
 const g=game([4,9,8]);g.targets[0].koji=8;applyBurst(g,g.p1,g.p2,4,true);applyBurst(g,g.p1,g.p2,9,true);const p=preview(g).players[0];
 expect(p.states[8].immunitySources).toEqual(expect.arrayContaining([{id:4,kind:'B'},{id:9,kind:'B'}]));disableBurstSkill(p,g.p2,4,2);expect(p.states[8].shield).toBe(true);disableBurstSkill(p,g.p2,9,2);expect(p.states[8].shield).toBe(false);
});
it('村井Cの登場疲労軽減は小坂AUTOの倍化前に適用し、演出もCの効果として記録する',()=>{
 const g=game([9,26]);g.p1.enteredThisRoundIds=[26];applyFatigueAndPost(g.p1,g.p2,'draw',true,songById('A'),()=>{},effectsFor(g));expect(g.p1.states[26].fatigue).toBe(2);
 expect(g.skillEffects).toContainEqual(expect.objectContaining({id:9,kind:'C',targets:expect.arrayContaining([expect.objectContaining({id:26,delta:-2})])}));
});

it('丹生はExcel通り低疲労での出場累計3回・今回出場が必要で、Bは次回FRONT各−2',()=>{
 const g=game([39]);g.p1.states[39].stageFreshRounds=2;expect(condition(g,39)).toBe(false);
 g.p1.states[39].stageFreshRounds=3;expect(condition(g,39)).toBe(true);const f=g.p1.formation;g.p1.formation=formationFromArray([8,10,18,24,27]);expect(condition(g,39)).toBe(false);g.p1.formation=f;
 applyBurst(g,g.p1,g.p2,39,true);const result=preview(g);for(const slot of ['FRONT-L','FRONT-R'])expect(result.p2.members.find(m=>m.slot===slot)!.breakdown).toContainEqual(expect.objectContaining({sourceId:39,kind:'B',amount:-2}));
});
