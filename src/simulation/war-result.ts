import { scoreRound } from '../game/scoring';
import { assertFinite,type MatchResult } from './match';
export type WarResult=Pick<MatchResult,'winner'|'pointsA'|'pointsB'|'appealA'|'appealB'|'roundAppeals'|'rounds'>;
export function compactWarResult(result:MatchResult):WarResult {const {winner,pointsA,pointsB,appealA,appealB,roundAppeals,rounds}=result;return {winner,pointsA,pointsB,appealA,appealB,roundAppeals,rounds};}
export function validateWarResult(result:WarResult) {
 assertFinite(result);
 if(!result||result.rounds!==7||!['A','B','draw'].includes(result.winner)||!Array.isArray(result.roundAppeals)||result.roundAppeals.length!==7||result.roundAppeals.some(r=>r.length!==2||r.some(n=>typeof n!=='number'||n<0)))throw new Error('Invalid WAR checkpoint result');
 for(const key of ['pointsA','pointsB','appealA','appealB'] as const)if(typeof result[key]!=='number'||result[key]<0)throw new Error('Invalid WAR checkpoint totals');
 let pointsA=0,pointsB=0,appealA=0,appealB=0;
 for(const [i,[a,b]] of result.roundAppeals.entries()){appealA+=a;appealB+=b;const score=scoreRound(a,b,i+1);if(score.winner===1)pointsA+=score.points;if(score.winner===2)pointsB+=score.points;}
 const difference=pointsA-pointsB||appealA-appealB,winner=difference>0?'A':difference<0?'B':'draw';
 if(result.pointsA!==pointsA||result.pointsB!==pointsB||result.appealA!==appealA||result.appealB!==appealB||result.winner!==winner)throw new Error('WAR checkpoint totals/outcome do not match round scoring');
}
