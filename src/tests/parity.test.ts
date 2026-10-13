// Only unchanged common mechanics are compared with v0.6. Excel explicitly supersedes its cards/songs.
import { expect, it } from 'vitest';
import { legacyOracle } from './legacyOracle';
import { createGame, shuffle } from '../game/engine';
import { calcEnteredThisRoundIds, formationFromArray, validateFormation } from '../game/formation';
it('シャッフルと初期/バックス登場判定は旧HTMLと一致する', () => {
  const oracle = legacyOracle(); oracle.setRandom(() => 0.25);
  expect(shuffle([1,2,3,4,5,6,7,8], () => 0.25)).toEqual(oracle.run('shuffle([1,2,3,4,5,6,7,8])'));
  const g = createGame([1,2,3,4,5,8,9,10], [1,2,3,4,5,8,9,10], ['A','B','C'], ['D','E','F'], 'local', () => 0.5);
  g.p1.formation = formationFromArray([8,9,10,1,2]); oracle.load(g);
  for (const r of [1,2,7]) expect(calcEnteredThisRoundIds(g.p1,g.p1.formation,r)).toEqual(oracle.run(`calcEnteredThisRoundIds(game.p1,game.p1.formation,${r})`));
});
it('重複・固定位置の検証は旧HTMLと一致する', () => {
  const oracle = legacyOracle();
  const g = createGame([1,2,3,4,5,8,9,10], [1,2,3,4,5,8,9,10], ['A','B','C'], ['D','E','F'], 'local');
  for (const order of [[1,2,3,4,5],[1,1,3,4,5],[2,1,3,4,5]]) {
    g.p1.states[1].lockedPos = 'CENTER'; g.p1.formation = formationFromArray(order); oracle.load(g);
    expect(!!validateFormation(g.p1,g.p1.formation)).toBe(!!oracle.run('validateFormation(game.p1,game.p1.formation)'));
  }
});
