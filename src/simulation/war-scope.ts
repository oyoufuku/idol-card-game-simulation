import type {MatchResult} from './match';
import {CONSTRUCTED_AXIS_TAGS} from './constructed-teams';
// Keep all baseline results; restrict only paired WAR sampling, on BOTH sides.
export function warScope(results:MatchResult[],excludeSelectionDecks:boolean):MatchResult[]{
 if(!excludeSelectionDecks)return results;
 const axis=(tag:string)=>(CONSTRUCTED_AXIS_TAGS as readonly string[]).includes(tag);
 return results.filter(r=>r.spec.mode==='random'||[r.spec.a,r.spec.b].every(t=>axis(t.mainTags[0])));
}
