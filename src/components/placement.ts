import { posOf, validateFormation } from '../game/formation';
import type { Formation, Player, Slot } from '../game/types';
/** Move a back member onto the stage, or swap two stage members. Never mutate the player. */
export function placeCard(player: Player, slot: Slot, id: number): Formation {
  if (!player.ids.includes(id)) throw new Error('編成外のアイドルは配置できません。');
  const next = { ...player.formation }, from = posOf(player, id), replaced = next[slot];
  next[slot] = id;
  if (from !== 'BACK' && from !== slot) next[from] = replaced;
  const error = validateFormation(player, next);
  if (error) throw new Error(error);
  return next;
}
