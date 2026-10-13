import type { Player } from './types';
export function scoreRound(a: number, b: number, round: number) {
  const winner = a > b ? 1 : b > a ? 2 : 0;
  return { winner, points: winner ? (Math.abs(a - b) >= 10 ? 2 : 1) + (round === 7 ? 1 : 0) : 0 };
}
export function finalResult(p1: Player, p2: Player) {
  if (p1.points !== p2.points) return `${p1.points > p2.points ? p1.label : p2.label} WIN`;
  if (p1.totalAppeal !== p2.totalAppeal) return `${p1.totalAppeal > p2.totalAppeal ? p1.label : p2.label} WIN（累計Appeal）`;
  return 'DRAW';
}
