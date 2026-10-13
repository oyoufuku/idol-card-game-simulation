import { formationFromArray } from './formation';
import type { Formation } from './types';

export function* permutations5(ids:number[],chosen:number[]=[]):Generator<number[]> {
 if(chosen.length===5){yield chosen;return;}
 for(const id of ids)if(!chosen.includes(id))yield* permutations5(ids,[...chosen,id]);
}
// Preserve roster order: changing enumeration order changes seeded tie breaking.
// A bounded LRU avoids retaining thousands of RANDOM rosters in each worker.
export const CPU_CANDIDATE_CACHE_LIMIT=32;
const cache=new Map<string,readonly Formation[]>();
export function formationCandidates(ids:number[]):readonly Formation[] {
 const key=ids.join(','),saved=cache.get(key);
 if(saved){cache.delete(key);cache.set(key,saved);return saved;}
 const candidates=Object.freeze(Array.from(permutations5(ids),values=>Object.freeze(formationFromArray(values))));
 cache.set(key,candidates);
 if(cache.size>CPU_CANDIDATE_CACHE_LIMIT)cache.delete(cache.keys().next().value!);
 return candidates;
}
