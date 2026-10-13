import type { Context, Player, Song } from './types';
const ignoreLog = (_message: string) => {};
const noRandom = () => { throw new Error('計算中の乱数使用'); };
const noTarget = () => 0;
const noBurst = () => { throw new Error('計算中のBURST'); };
// Read/calculation hooks cannot accidentally consume randomness or trigger BURST.
export function calculationContext(p: Player, opp: Player, id: number, song: Song, log: (s: string) => void = ignoreLog): Context {
  return { p, opp, id, song, log, random: noRandom, target: noTarget, burst: noBurst };
}
