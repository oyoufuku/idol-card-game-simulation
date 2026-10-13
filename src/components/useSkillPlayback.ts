import { useEffect, useMemo, useState } from 'react';
import type { Game } from '../game/types';
import { buildSkillMessages } from './presentation';

export function useSkillPlayback(game: Game | null,hold=false,autoAdvance=true) {
  const steps = useMemo(() => buildSkillMessages(game?.skillEffects || [],game??undefined), [game]);
  const key = game ? `${game.round}:${game.roundResolved ? 'performance' : 'start'}:${game.effectRevision??0}` : '';
  const [progress, setProgress] = useState({ key: '', index: 0 });
  const index = progress.key === key ? progress.index : 0;
  const current=game?steps[index]:undefined,active=hold?undefined:current;
  useEffect(() => {
    if (!key) { setProgress({ key: '', index: 0 }); return; }
    if (!active || !autoAdvance) return;
    const timer = window.setTimeout(() => setProgress({ key, index: index + 1 }), active.durationMs);
    return () => window.clearTimeout(timer);
  }, [key, index, active?.key,hold,autoAdvance]);
  useEffect(() => {
    if (!active) return;
    const targets=active.targets.length?active.targets:active.side!==null&&active.id!==null?[{side:active.side,id:active.id}]:[];
    const cards=targets.map(target=>document.querySelector(`[data-player-side="${target.side}"] [data-card-id="${target.id}"]`));
    const opened=[...new Set(cards.map(card=>card?.closest<HTMLDetailsElement>('details.opponent-backs')).filter((reserve):reserve is HTMLDetailsElement=>!!reserve&&!reserve.open))];
    opened.forEach(reserve=>reserve.open=true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cards[0]?.scrollIntoView({ block: 'center', inline:'nearest', behavior: reduced ? 'instant' : 'smooth' });
    return ()=>opened.forEach(reserve=>reserve.open=false);
  }, [key, active?.key]);
  return { active, autoAdvance, playing: !!current||hold, index, count: steps.length, eventKey: `${key}:${index}:${active?.key || ''}`,
    next:()=>setProgress({key,index:index+1}), skip: () => setProgress({ key, index: steps.length }) };
}
