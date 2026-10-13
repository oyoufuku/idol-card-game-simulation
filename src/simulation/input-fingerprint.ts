import { createHash } from 'node:crypto';
import { IDOLS } from '../data/idols';
import { SONGS } from '../data/songs';
import { GAME_RULE_VERSION } from '../game/engine';
// Detect overwritten Excel data so stale checkpoints cannot silently contaminate new results.
export const INPUT_FINGERPRINT=createHash('sha256').update(JSON.stringify({rule:GAME_RULE_VERSION,idols:IDOLS,songs:SONGS})).digest('hex');
