import { expect,it } from 'vitest';
import { createGame,executeRound,nextRound,preview,prepareRound } from '../game/engine';
import { applyBurst,queueBursts,resolvePendingBursts,checkBurstConditions } from '../game/burst';
import { formationFromArray,attributesOf } from '../game/formation';
import { songById } from '../data/songs';
import { SKILLS } from '../game/skills';
const eight=(ids:number[])=>[...new Set([...ids,8,10,18,24,27,28,30,31])].slice(0,8);
const make=(ids:number[],opp:number[]=[8,10,18,24,27,28,30,31])=>{const g=createGame(eight(ids),eight(opp),['A','B','C'],['D','E','F'],'local',()=>.5);g.roundSong=songById('A');return g;};
const val=(g:ReturnType<typeof make>,id:number,side=0)=>{const r=preview(g);return (side?r.p2:r.p1).members.find(c=>c.id===id)!;};
it('小坂は位置加算・位置疲労・疲労ペナルティを2倍にする',()=>{const g=make([26]);expect(val(g,26).details).toContain('位置+6');g.p1.states[26].fatigue=3;expect(val(g,26).details).toContain('位置+4');g.interactiveBursts=true;executeRound(g);expect(g.p1.states[26].fatigue).toBe(9);});
it('金村の位置維持はR1不発、2回目+1、同じステージ枠累計4でBURST',()=>{const g=make([25]);expect(val(g,25).autoGain).toBe(0);executeRound(g);nextRound(g,()=>.5);expect(val(g,25).autoGain).toBe(1);executeRound(g);nextRound(g,()=>.5);executeRound(g);nextRound(g,()=>.5);executeRound(g);expect(g.p1.states[25].burstActive).toBe(true);});

it.each([32,38,44])('チャージNo.%i：BACKS蓄積、ステージ入りで消費、終了時BURST、B回復',id=>{const g=make([8,10,18,24,27,id]);g.round=2;g.p1.round=2;g.p1.states[id].charge=3;g.p1.formation=formationFromArray([id,10,18,24,27]);const r=preview(g);expect(r.players[0].states[id].spentCharge).toBe(3);expect(r.players[0].states[id].charge).toBe(0);executeRound(g);expect(g.p1.states[id].burstActive).toBe(true);nextRound(g,()=>.5);expect(g.p1.states[id].charge).toBe(3);});
it('竹内は非チャージメンバーにも付与し、チャージ型は5を超えない',()=>{const g=make([43,8,10,18,24,32]);g.p1.states[32].charge=5;executeRound(g);expect(g.p1.states[32].charge).toBe(5);expect(g.p1.states[27].charge).toBe(1);});
it('上村Cは一時的な相手基礎値+1をAUTO条件に反映し、CENTERを外すと消える',()=>{const g=make([33],[8]);const r=preview(g);expect(r.players[1].states[8].baseAdjustment).toBe(1);expect(val(g,8,1).details.join('|')).toContain('上村ひなのA-3');g.p1.formation=formationFromArray([10,33,18,24,8]);expect(preview(g).players[1].states[8].baseAdjustment).toBe(0);});
it('藤嶌CのPLAINは全属性追加より優先し、CENTERを外すと解除',()=>{const g=make([36],[22]);applyBurst(g,g.p2,g.p1,22);const r=preview(g);expect(attributesOf(r.players[1],22)).toEqual([]);g.p1.formation=formationFromArray([10,36,18,24,8]);expect(attributesOf(preview(g).players[1],22)).toHaveLength(3);});
it('宮地は位置維持回数を対面減算し、Bは対面の基礎を永続的に2下げる',()=>{const g=make([37],[26]);expect(val(g,26,1).details).not.toContain('位置+0');g.round=g.p1.round=g.p2.round=2;expect(val(g,26,1).details).toContain('宮地すみれA-1');applyBurst(g,g.p1,g.p2,37);expect(g.p2.states[26].permBonus).toBe(-2);expect(val(g,26,1).details).toContain('位置+6');});

it('山口は最高疲労対象を自軍-1/相手+1、Cは相手BACKS+3',()=>{const g=make([42]);g.p1.states[8].fatigue=5;g.p2.states[10].fatigue=5;const r=preview(g);expect(r.players[0].states[8].fatigue).toBe(4);expect(r.players[1].states[10].fatigue).toBe(6);expect(r.players[1].states[28].fatigue).toBe(3);});

it('山下葉留花Cは相手の左右移動を数えず、ポジション種別移動に疲労+2',()=>{const g=make([45]);g.round=g.p1.round=g.p2.round=2;g.p2.formation=formationFromArray([8,18,10,24,27]);expect(preview(g).players[1].states[10].fatigue).toBe(0);g.p2.formation=formationFromArray([8,24,10,18,27]);expect(preview(g).players[1].states[24].fatigue).toBe(2);});

it('遠藤・濱岸の曲変更では通常カードを消費しない',()=>{for(const id of [14,46]){const g=make([id]);const n=g.songDeck.length;g.round=2;applyBurst(g,g.p1,g.p2,id);prepareRound(g,()=>.5);expect(g.songDeck.length).toBe(n);expect(g.roundSong.id).toBe(id===14?'K':'S');}});
it('キツネは現在疲労を2倍にしてから位置疲労を加算する',()=>{const g=make([8]);g.roundSong=songById('R');g.p1.states[8].fatigue=3;executeRound(g);expect(g.p1.states[8].fatigue).toBe(9);});
it('JOYFULはB即時効果と累計回数を残し、継続加算・免疫を消す',()=>{const g=make([11,7],[8]);g.targets[0].matono=8;applyBurst(g,g.p1,g.p2,11);applyBurst(g,g.p1,g.p2,7);g.roundSong=songById('V');const r=preview(g);expect(r.players[0].states[11].burstActive).toBe(false);expect(r.players[0].states[11].shield).toBe(false);expect(r.players[0].states[11].burstCount).toBe(1);expect(r.players[1].states[8].lockedPos).toBe('CENTER');});
it('Right?は最大同疲労グループ数を比較し、同数なら不発',()=>{const g=make([8]);g.roundSong=songById('T');expect(val(g,8).details.join('|')).not.toContain('Right?');g.p2.states[8].fatigue=1;expect(val(g,8).details).toContain('Right?+3');});
it('田村は同じ終了処理のBACKS BURST全員から1人を抽選する',()=>{const g=make([19],[8,10,18,24,27,28,30,31]);queueBursts(g,[],[28,30]);resolvePendingBursts(g,()=>.99);expect(g.p1.states[19].burstCount).toBe(1);expect(g.p2.states[30].lockedPos).toBe('CENTER');});
it('強制BURSTは同じ連鎖で発動済みの人を抽選から除外し循環しない',()=>{const g=make([48,6,12,41,8,10,18,24]);g.targets[0].allyBurst=6;expect(()=>applyBurst(g,g.p1,g.p2,48,false,()=>0)).not.toThrow();expect(g.p1.states[48].burstCount).toBe(1);expect(g.p1.states[6].burstCount).toBe(1);expect(g.burstChain).toEqual([]);});
it('富田はステージからランダム2人を強制BURSTし、通常使用済みを戻さず、連鎖内で自身を再発動しない',()=>{const g=make([47]);g.p1.states[8].normalUsed=true;g.p1.states[8].burstCount=4;g.p1.states[8].forcedBurstCount=2;applyBurst(g,g.p1,g.p2,47,false,()=>0);expect(g.p1.states[8].normalUsed).toBe(true);expect(g.p1.states[8].burstCount).toBe(5);expect(g.p1.states[8].forcedBurstCount).toBe(3);expect(g.p1.states[47].burstCount).toBe(1);expect(g.burstChain).toEqual([]);});
it('松田好花の無BURST連続数はJOYFULで解除されても発動履歴を消さない',()=>{const g=make([48,8]);applyBurst(g,g.p1,g.p2,8);g.roundSong=songById('V');executeRound(g);expect(g.p1.noBurstStreak).toBe(0);});

it('JOYFUL解除後も開始時に予約した終了時効果は実行する',()=>{const g=make([26]);applyBurst(g,g.p1,g.p2,26);g.roundSong=songById('V');executeRound(g);expect(g.p1.states[26].fatigue).toBe(11);});

it('清水BURSTは自軍クール/ユーモアを相手由来スキルから保護する',()=>{const g=make([35,18],[1,2,3]);const before=val(g,18).val;applyBurst(g,g.p1,g.p2,35);expect(val(g,18).val).toBeGreaterThan(before);expect(preview(g).players[0].states[18].shield).toBe(true);});

it('山崎CENTERの次回加算は受け手自身のCENTER SKILL発動に数えない',()=>{const g=make([8]);g.p1.states[8].activeNextBonus=1;g.p1.states[10].activeNextBonus=1;executeRound(g);expect(g.p1.states[8].stats.center).toBe(0);expect(g.p1.states[10].stats.center).toBe(0);});
