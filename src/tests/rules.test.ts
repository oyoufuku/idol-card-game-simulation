import { describe, expect, it } from 'vitest';
import { createGame, executeRound, nextRound, prepareRound, preview } from '../game/engine';
import { applyBurst, checkBurstConditions } from '../game/burst';
import { applyFatigueAndPost, applyPrePerformance, fatiguePenalty } from '../game/fatigue';
import { appealFor, resolveCenterSkills } from '../game/appeal';
import { calcEnteredThisRoundIds, formationFromArray, setFormation, validateFormation } from '../game/formation';
import { songById } from '../data/songs';
import { finalResult, scoreRound } from '../game/scoring';
import { cpuChooseBestFormation } from '../game/cpu';
import { SKILLS } from '../game/skills';
const team = [1, 2, 4, 5, 6, 9, 11, 24];
function setup(ids = team, opp = [3, 5, 6, 7, 8, 9, 10, 24]) {
  const g = createGame(ids, opp, ['B', 'F', 'H'], ['A', 'I', 'J'], 'local', () => 0.5);
  g.roundSong = songById('J'); return g;
}
describe('疲労の共通ルール', () => {
  it.each([[0, 9], [2, 9], [3, 8], [4, 8], [5, 7], [6, 7], [7, 6], [20, 6]])('疲労%sのペナルティ', (fatigue, expected) => expect(fatiguePenalty(9, fatigue)).toBe(expected));
  it('疲労減算後のAppeal下限は0', () => expect(fatiguePenalty(1, 5)).toBe(0));
});
describe('ゲーム進行・CPU', () => {
  it.each([[10, 0, 1, 2], [9.5, 0, 1, 1], [10, 0, 7, 3], [9, 0, 7, 2], [5, 5, 7, 0]])('ポイント境界 %s/%s R%s', (a, b, r, points) => expect(scoreRound(a, b, r).points).toBe(points));
  it('ポイント同点なら累計Appeal、双方同じならDRAW', () => { const g = setup(); g.p1.totalAppeal = 2; expect(finalResult(g.p1, g.p2)).toContain('累計Appeal'); g.p2.totalAppeal = 2; expect(finalResult(g.p1, g.p2)).toBe('DRAW'); });
  it('予測は非破壊で実行値と一致、7ラウンドで終了し再実行不可', () => {
    const g = setup(); const snapshot = structuredClone(g), pred = preview(g); expect(g).toEqual(snapshot);
    expect(executeRound(g).p1.total).toBe(pred.p1.total); expect(() => executeRound(g)).toThrow();
    for (let r = 2; r <= 7; r++) { nextRound(g, () => 0.5); executeRound(g); }
    expect(g.done).toBe(true); expect(g.result?.final).toBeTruthy(); expect(() => nextRound(g)).toThrow();
  });
  it('R1〜6は選択6枚を重複ごと保持、ENCOREは劣勢側から選ぶ', () => {
    const g = createGame(team, team, ['A', 'B', 'C'], ['A', 'B', 'D'], 'local', () => 0);
    expect([g.roundSong.id,...g.songDeck].sort()).toEqual(['A', 'A', 'B', 'B', 'C', 'D']); g.round = 7; g.p1.points = 5; g.p2.points = 2; prepareRound(g, () => 0.99); expect(g.roundSong.id).toBe('D');
  });
  it('同一配置の重複・的野の位置固定を拒否', () => {
    const g = setup(); expect(validateFormation(g.p1, formationFromArray([1, 1, 2, 4, 5]))).toBeTruthy();
    g.p1.states[1].lockedPos = 'CENTER'; expect(validateFormation(g.p1, formationFromArray([2, 1, 4, 5, 6]))).toContain('固定');
    expect(calcEnteredThisRoundIds(g.p1, formationFromArray([9, 11, 24, 1, 2]), 1)).toEqual([]);
  });
  it('簡易CPUは6720候補を評価し実行可能な配置を確定', () => {
    const g = setup(); g.cpuMode = true; const best = cpuChooseBestFormation(g);
    expect(best.checked).toBe(6720); expect(validateFormation(g.p2, best.formation)).toBeNull(); expect(g.cpuLocked).toBe(true); expect(executeRound(g).p2.total).toBe(best.total);
  });
});
