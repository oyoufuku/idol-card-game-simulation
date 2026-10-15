import {preview} from '../game/engine';
import type { Game, Player,EffectPhase } from '../game/types';
/** An opponent's uncommitted placement never becomes the displayed previous formation. */
export function battlePlayers(game:Game,side:0|1):[Player,Player] {
  if(game.roundResolved)return [game.p1,game.p2];
  const publicOpponent=game.publicPlayers?.[side===0?1:0];
  return side===0?[game.p1,publicOpponent??game.p2]:[publicOpponent??game.p1,game.p2];
}

/** Detailed board prediction uses the same preparation and calculation as CPU
 * preview, with only the opponent's publicly committed round-start state. */
export function battlePrediction(game:Game,side:0|1) {
 if(game.roundResolved)return game.result;
 const [p1,p2]=battlePlayers(game,side);
 return preview({...game,p1,p2});
}

/** Current-performance colors survive the engine's end cleanup during playback.
 * A newly started BURST uses live colors; no expired snapshot leaks into it. */
export function playbackAttributePlayers(game:Game,playing:boolean,phase:EffectPhase|undefined,burstAnimating=false) {
 return game.roundResolved&&playing&&!burstAnimating&&phase!=='burst'?game.performanceAttributePlayers:undefined;
}
