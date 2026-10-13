import type { EffectKind, EffectTarget, SkillEffect } from '../game/types';
const positions = ['MIDDLE-L', 'MIDDLE-R', 'FRONT-L', 'FRONT-R', 'CENTER', 'BACK'];
const kinds: EffectKind[] = ['A', 'B', 'C', '曲', '終了'];
export interface PlaybackStep extends SkillEffect { key: string }
export function buildSkillPlayback(events: SkillEffect[]): PlaybackStep[] {
  const groups = new Map<string, PlaybackStep>();
  for (const event of events) {
    const key = `${event.phase}:${event.side}:${event.id}:${event.kind}`;
    const group = groups.get(key);
    if (group) group.targets.push(...event.targets);
    else groups.set(key, { ...event, key, targets: [...event.targets] });
  }
  // Sum repeated numeric entries only when metric, target and source are identical.
  for (const group of groups.values()) {
    const unique = new Map<string, EffectTarget>();
    for (const target of group.targets) {
      const key = `${target.side}:${target.id}:${target.label}:${target.delta === undefined ? 'text' : 'number'}`;
      const existing = unique.get(key);
      if (existing && existing.delta !== undefined && target.delta !== undefined) existing.delta += target.delta;
      else if (!existing) unique.set(key, { ...target });
    }
    group.targets = [...unique.values()].filter(t => t.delta === undefined || t.delta !== 0);
  }
  const values=[...groups.values()].filter(g => g.targets.length);
  // A BURST batch preserves the actual chain order; performance effects use stage order.
  const sorted = events.every(e=>e.phase==='burst') ? values : values.sort((a, b) =>
    +(a.phase === 'post') - +(b.phase === 'post') ||
    (a.id === null ? 2 : a.position === 'BACK' ? 1 : 0) - (b.id === null ? 2 : b.position === 'BACK' ? 1 : 0) ||
    (a.side ?? 2) - (b.side ?? 2) ||
    (a.position ? positions.indexOf(a.position) : 6) - (b.position ? positions.indexOf(b.position) : 6) ||
    kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
  return sorted.flatMap(group => {
    const batches: EffectTarget[][] = [];
    for (const target of group.targets) {
      let batch = batches.find(items => !items.some(t => t.side === target.side && t.id === target.id));
      if (!batch) { batch = []; batches.push(batch); }
      batch.push(target);
    }
    return batches.map((targets, i) => ({ ...group, key: `${group.key}:${i}`, targets }));
  });
}
