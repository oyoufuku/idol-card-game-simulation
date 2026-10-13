import type { Game, Player, EffectKind, EffectPhase, EffectSource, EffectTarget } from './types';
import { attributesOf, baseAppeal, byId, hasAttr, posOf } from './formation';
import { songById } from '../data/songs';

// Observe actual state changes; never invoke a skill a second time for animation.
const recorders = new WeakMap<Game, EffectRecorder>();
export function effectsFor(game: Game): EffectRecorder | undefined {
  if (!game.skillEffects) return undefined;
  let recorder = recorders.get(game);
  if (!recorder) { recorder = new EffectRecorder(game); recorders.set(game, recorder); }
  return recorder;
}
function snapshot(game: Game) {
  return [game.p1, game.p2].flatMap((p, side) => p.ids.map(id => {
    const s = p.states[id];
    return { side: side as 0 | 1, id, fatigue: s.fatigue, charge: s.charge, base: baseAppeal(p, id),
      next: s.nextBonus, burstBonus: s.burstSelfAppeal + (hasAttr(p, id, 'クール') ? p.burstCoolBonus : 0),
      carry: s.activeAutoCarry, debuff: s.burstDebuff, attrs: attributesOf(p, id).join(' / ') || 'PLAIN',
      position:posOf(p,id), lock: s.lockedPos, shield: s.shield, normalUsed: s.normalUsed, bursts: s.burstCount,
      doubleC: s.muraiDoubleC, active: s.burstActive, burstDisabled:s.burstDisabledUntilRound??0 };
  }));
}
type Snapshot = ReturnType<typeof snapshot>;
interface Frame { source: EffectSource; before: Snapshot; song: string | undefined; songAttribute: string | undefined }
export class EffectRecorder {
  private frames: Frame[] = [];
  // Keep the single-source identity of fixed BURST debuffs through a UI clone.
  private previous: Game['skillEffects'];
  constructor(private game: Game) { this.previous = game.skillEffects?.slice(); }
  reset() { this.previous = this.game.skillEffects?.slice(); this.game.skillEffects = []; }
  source(p: Player, id: number, kind: EffectKind, phase: EffectPhase): EffectSource {
    return { side: p === this.game.p1 ? 0 : 1, id, position: posOf(p, id), kind, phase, label: byId(id).name };
  }
  song(phase: EffectPhase): EffectSource { return { side: null, id: null, position: null, kind: '曲', phase, label: this.game.roundSong.name }; }
  target(p: Player, id: number, label: string, delta?: number): EffectTarget {
    return { side: p === this.game.p1 ? 0 : 1, id, label, ...(delta === undefined ? {} : { delta }) };
  }
  emit(source: EffectSource, targets: EffectTarget[]) {
    if (targets.length) this.game.skillEffects!.push({ ...source, targets });
  }
  fixedBurstSource(p: Player, id: number): EffectSource | undefined {
    const origins = [...(this.previous||[]),...(this.game.burstEffectSources||[])].filter(e => e.kind === 'B' && e.id !== null && e.targets.some(t => t.side === (p === this.game.p1 ? 0 : 1) && t.id === id && t.label === 'BURST減少')) || [];
    const ids = new Set(origins.map(e => `${e.side}:${e.id}`));
    if (ids.size === 1) return this.source(origins[0].side === 1 ? this.game.p2 : this.game.p1, origins[0].id!, 'B', 'performance');
    return undefined;
  }
  private flush(frame: Frame) {
    const after = snapshot(this.game), targets: EffectTarget[] = [];
    for (let i = 0; i < after.length; i++) {
      const a = frame.before[i], b = after[i];
      const add = (label: string, delta?: number) => targets.push({ side: b.side, id: b.id, label, ...(delta === undefined ? {} : { delta }) });
      for (const [key, label] of [['fatigue', '疲労値'], ['charge', 'チャージ'], ['base', '基礎Appeal'], ['next', '次回Appeal'], ['burstBonus', 'BURST加算'], ['carry', 'BURST引継ぎ'], ['debuff', 'BURST減少']] as const) {
        if (a[key] !== b[key]) add(label, b[key] - a[key]);
      }
      if (a.attrs !== b.attrs) add(b.attrs);
      if(a.position!==b.position)add(`配置 ${a.position}→${b.position}`);
      if (a.lock !== b.lock) add(b.lock ? `位置固定 ${b.lock}` : '位置固定解除');
      if (a.shield !== b.shield) add(b.shield ? '相手効果無効' : '相手効果無効解除');
      if (a.normalUsed && !b.normalUsed) add('通常BURST再使用可');
      if (a.bursts !== b.bursts) add('BURST発動');
      if (a.active && !b.active) add('BURST状態解除');
      if (a.doubleC !== b.doubleC) add(b.doubleC ? 'AUTO効果をステージ全員へ適用' : 'AUTO全体化解除');
      if(a.burstDisabled!==b.burstDisabled)add(b.burstDisabled?'Bスキル無効':'Bスキル無効解除');
    }
    const p = frame.source.side === 1 ? this.game.p2 : this.game.p1;
    if (frame.source.id !== null) {
      if (frame.song !== this.game.songOverride && this.game.songOverride) targets.push(this.target(p, frame.source.id, `楽曲 ${songById(this.game.songOverride).name}`));
      if (frame.songAttribute !== this.game.songAttributeOverride && this.game.songAttributeOverride) targets.push(this.target(p, frame.source.id, `楽曲属性 ${this.game.songAttributeOverride}`));
    }
    this.emit(frame.source, targets);
    frame.before = after; frame.song = this.game.songOverride; frame.songAttribute = this.game.songAttributeOverride;
  }
  capture<T>(source: EffectSource, run: () => T): T {
    const parent = this.frames.at(-1);
    if (parent) this.flush(parent); // Nested forced BURST belongs to its own actor.
    const frame: Frame = { source, before: snapshot(this.game), song: this.game.songOverride, songAttribute: this.game.songAttributeOverride };
    this.frames.push(frame);
    try { const result = run(); this.flush(frame); return result; }
    finally {
      this.frames.pop();
      if (parent) { parent.before = snapshot(this.game); parent.song = this.game.songOverride; parent.songAttribute = this.game.songAttributeOverride; }
    }
  }
}
