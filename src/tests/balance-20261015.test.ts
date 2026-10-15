import { expect, it } from 'vitest';
import { createGame, executeRound, preview } from '../game/engine';
import { applyBurst } from '../game/burst';
import { songById } from '../data/songs';
import { byId, formationFromArray } from '../game/formation';
import { CARD_TEXT } from '../data/card-text';

function scenario(id: number) {
  const g = createGame([id,8,10,18,24,27,28,30], [8,10,18,24,27,28,30,31], ['A','B','C'], ['D','E','F'], 'local', () => .5, {interactiveBursts:true});
  g.roundSong = songById('A');
  for (const p of [g.p1,g.p2]) for (const member of p.ids) p.states[member].normalUsed = true;
  return g;
}

it('好花AはR2以降BURST中1人以下で+2、Cは0人で+3のまま、実行と予測も一致する', () => {
  const g = scenario(48);
  const own = () => preview(g).p1.members.find(m => m.id === 48)!;
  const bonus = (kind: string) => (own().breakdown ?? []).filter(b => b.sourceId === 48 && b.kind === kind).reduce((n,b) => n + b.amount, 0);
  expect(bonus('A')).toBe(0); expect(bonus('C')).toBe(3);
  g.round = g.p1.round = g.p2.round = 2;
  expect(bonus('A')).toBe(2); expect(bonus('C')).toBe(3);
  g.p2.states[8].burstActive = true;
  expect(bonus('A')).toBe(2); expect(bonus('C')).toBe(0);
  g.p2.states[10].burstActive = true;
  expect(bonus('A')).toBe(0); expect(bonus('C')).toBe(0);
  g.p2.states[8].burstActive = g.p2.states[10].burstActive = false;
  const predicted = own().val;
  expect(executeRound(g).p1.members.find(m => m.id === 48)!.val).toBe(predicted);
  expect(byId(48).A).toContain('Appealを+2');
  expect(CARD_TEXT[48].A).toContain('Appeal＋2');
  expect(CARD_TEXT[48].C).toContain('Appeal＋3');
});

it('石塚Bは次回の確定FRONT2人へ開始前疲労+2、位置無効を維持し免疫とJOYFULを尊重する', () => {
  const g = scenario(34);
  applyBurst(g,g.p1,g.p2,34,true);
  // The targets are the next chosen FRONT, not the formation at BURST time.
  g.p2.formation = formationFromArray([8,24,27,10,18]);
  expect(g.p2.states[24].fatigue).toBe(0);
  const before = structuredClone(g), p = preview(g);
  expect(g).toEqual(before);
  for (const id of [24,27]) {
    expect(p.players[1].states[id].fatigue).toBe(2);
    expect(p.p2.members.find(m => m.id === id)!.details).toContain('位置+0');
  }
  expect(p.players[1].states[8].fatigue).toBe(0);
  const actual = executeRound(g);
  expect(actual.p2.total).toBe(p.p2.total);
  for (const id of [24,27]) expect(g.p2.states[id].fatigue).toBe(4); // B +2, then FRONT +2.

  const shielded = scenario(34); applyBurst(shielded,shielded.p1,shielded.p2,34,true);
  shielded.p2.states[10].shield = true;
  const protectedPreview = preview(shielded);
  expect(protectedPreview.players[1].states[10].fatigue).toBe(0);
  expect(protectedPreview.p2.members.find(m => m.id === 10)!.details).toContain('位置+1');

  const joyful = scenario(34); applyBurst(joyful,joyful.p1,joyful.p2,34,true); joyful.roundSong = songById('V');
  const cancelled = preview(joyful);
  expect(cancelled.players[1].states[10].fatigue).toBe(0);
  expect(cancelled.p2.members.find(m => m.id === 10)!.details).toContain('位置+1');
  expect(CARD_TEXT[34].B).toContain('疲労＋2');
});
