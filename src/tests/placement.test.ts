import { expect, it } from 'vitest';
import { mkPlayer } from '../game/engine';
import { placeCard } from '../components/placement';
import { validateFormation } from '../game/formation';
const player = () => mkPlayer('P1', [1, 2, 3, 4, 5, 6, 7, 8], ['A', 'B', 'C']);
it('ステージ同士を入れ替え、重複を作らず元の状態を保持する', () => {
  const p = player(), before = structuredClone(p);
  const result = placeCard(p, 'CENTER', 2);
  expect(result.CENTER).toBe(2);
  expect(result['FRONT-L']).toBe(1);
  expect(validateFormation(p, result)).toBeNull();
  expect(p).toEqual(before);
});
it('バックスからステージへ交代できる', () => {
  const p = player(), result = placeCard(p, 'CENTER', 6);
  expect(result.CENTER).toBe(6);
  expect(Object.values(result)).not.toContain(1);
  expect(validateFormation(p, result)).toBeNull();
});
it('位置固定中のカードは移動・交代できず、他のカードは動かせる', () => {
  const p = player();
  p.states[1].lockedPos = 'CENTER';
  p.states[6].lockedPos = 'BACK';
  expect(() => placeCard(p, 'FRONT-L', 1)).toThrow('固定');
  expect(() => placeCard(p, 'CENTER', 2)).toThrow('固定');
  expect(() => placeCard(p, 'FRONT-L', 6)).toThrow('固定');
  expect(validateFormation(p, placeCard(p, 'FRONT-L', 7))).toBeNull();
});
it('編成外を拒否し、同じ場所への配置は状態を変えない', () => {
  const p = player();
  expect(() => placeCard(p, 'CENTER', 12)).toThrow('編成外');
  expect(placeCard(p, 'CENTER', 1)).toEqual(p.formation);
});
