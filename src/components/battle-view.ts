import type { Game, Player } from '../game/types';
/** An opponent's uncommitted placement never becomes the displayed previous formation. */
export function battlePlayers(game:Game,side:0|1):[Player,Player] {
  if(game.roundResolved)return [game.p1,game.p2];
  const publicOpponent=game.publicPlayers?.[side===0?1:0];
  return side===0?[game.p1,publicOpponent??game.p2]:[publicOpponent??game.p1,game.p2];
}
