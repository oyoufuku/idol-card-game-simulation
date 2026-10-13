// Execute the unmodified baseline script in an isolated VM with minimal DOM ports.
// Assertions compare observable state, not a second transcription of the rules.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import type { Game, Player } from '../game/types';
export function legacyOracle() {
  const html = readFileSync(new URL('../../idol_card_testplay_v0_6_codex_ready.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const elements = new Map<string, Record<string, unknown>>();
  const element = (key: string) => {
    if (!elements.has(key)) elements.set(key, { value: '', textContent: '', innerHTML: '', style: {}, addEventListener() {}, disabled: false });
    return elements.get(key)!;
  };
  let random = () => 0.5;
  const math = Object.create(Math); math.random = () => random();
  const context = vm.createContext({ Math: math, structuredClone, document: { getElementById: element, querySelector: element, querySelectorAll: () => [] }, alert: (s: string) => { throw new Error(s); }, location: { reload() {} } });
  vm.runInContext(script, context);
  function run<T>(code: string): T { return vm.runInContext(code, context) as T; }
  return {
    run,
    setRandom(fn: () => number) { random = fn; },
    load(game: Game) {
      context.input = structuredClone(game);
      run('game = input');
      game.targets.forEach((t, i) => { element(`kojiTarget${i + 1}`).value = t.koji; element(`matonoTarget${i + 1}`).value = t.matono; });
      for (const [i, p] of [game.p1, game.p2].entries()) for (const [slot, id] of Object.entries(p.formation)) element(`select[data-team="${i + 1}"][data-slot="${slot}"]`).value = id;
    },
    players: () => run<[Player, Player]>('[game.p1,game.p2]'),
  };
}
