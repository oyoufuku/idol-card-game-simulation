import type { Game,Player } from './types';
export interface RandomSources {players:[()=>number,()=>number]}
const sources=new WeakMap<Game,RandomSources>();
export const setRandomSources=(g:Game,s:RandomSources)=>sources.set(g,s);
export function playerRandom(g:Game,p:Player,fallback:()=>number){return sources.get(g)?.players[p===g.p1?0:1]||fallback;}
