import { byId } from '../game/formation';
import { scoreRound } from '../game/scoring';
import type { MatchResult } from './match';
import { prng,seedFor } from './random';
import { sampleEvidence } from './samples';
import { hash,type WarPlan,type WarTrial } from './war-plan';
import type { WarResult } from './war-runner';
export type WarRow=Record<string,unknown>;
interface Delta {win:number;point:number;appeal:number;actual:number;cluster:string;roundAppeal:number[];roundPoints:number[];roundWins:number[];trial:WarTrial}
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
export const outcomeValue=(result:Pick<WarResult,'winner'>,side:0|1)=>result.winner==='draw'?.5:result.winner===(side===0?'A':'B')?1:0;
function roundPoints(result:WarResult,round:number,side:0|1) {const [a,b]=result.roundAppeals[round],r=scoreRound(a,b,round+1);return r.winner===side+1?r.points:0;}
function roundOutcome(result:WarResult,round:number,side:0|1) {const r=scoreRound(...result.roundAppeals[round],round+1);return r.winner===0?.5:r.winner===side+1?1:0;}
export function pairedDelta(actual:MatchResult,replacement:WarResult,trial:WarTrial):Delta {
 const side=trial.side,spec=actual.spec;
 return {win:outcomeValue(actual,side)-outcomeValue(replacement,side),point:(side===0?actual.pointsA-replacement.pointsA:actual.pointsB-replacement.pointsB),appeal:(side===0?actual.appealA-replacement.appealA:actual.appealB-replacement.appealB),actual:outcomeValue(actual,side),cluster:hash({mode:spec.mode,pairId:spec.pairId,seed:spec.seed,a:spec.a,b:spec.b,strategies:spec.cpuStrategies??null}),roundAppeal:actual.roundAppeals.map((r,i)=>r[side]-replacement.roundAppeals[i][side]),roundPoints:actual.roundAppeals.map((_,i)=>roundPoints(actual,i,side)-roundPoints(replacement,i,side)),roundWins:actual.roundAppeals.map((_,i)=>roundOutcome(actual,i,side)-roundOutcome(replacement,i,side)),trial};
}
// Resample paired differences, clustered by original seed/pair (including
// mirror and both team appearances). Never resample actual and replacement separately.
export function bootstrap95(values:{value:number;cluster:string}[],seed:number,iterations=1000):[number|null,number|null] {
 if(!values.length)return [null,null];
 const groups=new Map<string,number[]>();for(const row of values)groups.set(row.cluster,[...(groups.get(row.cluster)||[]),row.value]);
 const clusters=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v),rng=prng(seed),estimates:number[]=[];
 for(let i=0;i<iterations;i++){let sum=0,count=0;for(let j=0;j<clusters.length;j++){const c=clusters[Math.floor(rng()*clusters.length)];sum+=c.reduce((a,b)=>a+b,0);count+=c.length;}estimates.push(sum/count*100);}
 estimates.sort((a,b)=>a-b);const q=(p:number)=>{const index=(estimates.length-1)*p,lo=Math.floor(index),hi=Math.ceil(index);return estimates[lo]+(estimates[hi]-estimates[lo])*(index-lo);};
 return [q(.025),q(.975)];
}
function metrics(rows:Delta[],seed:number,iterations:number):WarRow {
 const n=rows.length,win=mean(rows.map(r=>r.win)),point=mean(rows.map(r=>r.point)),appeal=mean(rows.map(r=>r.appeal)),positive=rows.filter(r=>r.win>0).length,negative=rows.filter(r=>r.win<0).length;
 const [lower,upper]=bootstrap95(rows.map(r=>({value:r.win,cluster:r.cluster})),seed,iterations);
 const pci=bootstrap95(rows.map(r=>({value:r.point,cluster:r.cluster})),seedFor(seed,'points'),iterations),aci=bootstrap95(rows.map(r=>({value:r.appeal,cluster:r.cluster})),seedFor(seed,'appeal'),iterations);
 return {samples:n,pairedSamples:n,...sampleEvidence(n),independentClusters:new Set(rows.map(r=>r.cluster)).size,cWAR:n?rows.reduce((s,r)=>s+r.win,0):null,averageWinDelta:win,cWARPer100:win===null?null:win*100,cWARPer100Selections:win===null?null:win*100,cWARLower95:lower,cWARUpper95:upper,pWARPer100:point===null?null:point*100,pWARLower95:pci[0],pWARUpper95:pci[1],aWARPer100:appeal===null?null:appeal*100,aWARLower95:aci[0],aWARUpper95:aci[1],averagePointDelta:point,averageAppealDelta:appeal,positiveFlips:positive,negativeFlips:negative,sameOutcomes:n-positive-negative,positiveFlipRate:n?positive/n:null,negativeFlipRate:n?negative/n:null,decisiveRate:n?(positive+negative)/n:null,netFlipRate:n?(positive-negative)/n:null,carryGames:rows.filter(r=>r.actual===1&&r.win>0).length};
}
function grouped(rows:Delta[],key:(row:Delta)=>string) {const result=new Map<string,Delta[]>();for(const row of rows){const k=key(row);result.set(k,[...(result.get(k)||[]),row]);}return [...result].sort(([a],[b])=>a.localeCompare(b));}
export function summarizeWar(plan:WarPlan,baselines:MatchResult[],results:Map<string,WarResult>) {
 const completed=plan.trials.flatMap(t=>t.job&&results.has(t.job)?[pairedDelta(baselines[t.baseline],results.get(t.job)!,t)]:[]);
 const stat=(rows:Delta[],key:string)=>metrics(rows,seedFor(plan.options.seed,'bootstrap',key),plan.options.bootstrapIterations);
 const cardRows:WarRow[]=[],archetypeRows:WarRow[]=[],matchupRows:WarRow[]=[],roundRows:WarRow[]=[],skillRows:WarRow[]=[],pairRows:WarRow[]=[],burstRoundRows:WarRow[]=[];
 for(const mode of ['random','archetype'] as const)for(let id=1;id<=48;id++){
  const rows=completed.filter(r=>r.trial.mode===mode&&r.trial.cardId===id&&r.trial.kind==='card'),card=byId(id),trials=plan.trials.filter(t=>t.mode===mode&&t.cardId===id&&t.kind==='card');
  let selections=0,wins=0,exclusiveSelections=0,exclusiveWins=0,burstGames=0,normalBurstGames=0,forcedBurstGames=0;
  for(const result of baselines.filter(r=>r.spec.mode===mode))for(const side of [0,1] as const){const own=side===0?result.spec.a:result.spec.b,opp=side===0?result.spec.b:result.spec.a;if(own.members.includes(id)){selections++;const state=result.players[side].states[id];burstGames+=Number(state.burstCount>0);normalBurstGames+=Number(state.burstCount>state.forcedBurstCount);forcedBurstGames+=Number(state.forcedBurstCount>0);const won=outcomeValue(result,side)===1;wins+=Number(won);if(!opp.members.includes(id)){exclusiveSelections++;exclusiveWins+=Number(won);}}}
  const ownTeam=(r:Delta)=>r.trial.side===0?baselines[r.trial.baseline].spec.a:baselines[r.trial.baseline].spec.b,oppTeam=(r:Delta)=>r.trial.side===0?baselines[r.trial.baseline].spec.b:baselines[r.trial.baseline].spec.a;
  const home=rows.filter(r=>ownTeam(r).mainTags.some(t=>card.themeTags.includes(t))),off=rows.filter(r=>!home.includes(r));
  const homeWAR=mode==='archetype'&&home.length?mean(home.map(r=>r.win))!*100:null,offWAR=mode==='archetype'&&off.length?mean(off.map(r=>r.win))!*100:null;
  const matchups:WarRow[]=grouped(rows,r=>oppTeam(r).archetype).map(([opponentArchetype,g])=>({mode,cardId:id,cardName:card.name,opponentArchetype,...stat(g,`${mode}:${id}:opponent:${opponentArchetype}`)}));
  if(mode==='archetype')for(const [archetype,g] of grouped(rows,r=>ownTeam(r).archetype))archetypeRows.push({mode,cardId:id,cardName:card.name,archetype,homeArchetype:ownTeam(g[0]).mainTags.some(t=>card.themeTags.includes(t)),...stat(g,`${mode}:${id}:own:${archetype}`)});
  matchupRows.push(...matchups);
  const sorted=matchups.slice().sort((a,b)=>(b.cWARPer100 as number)-(a.cWARPer100 as number)||String(a.opponentArchetype).localeCompare(String(b.opponentArchetype))),matchupMean=mean(matchups.map(r=>r.cWARPer100 as number));
  const tiers=[...new Set(rows.map(r=>r.trial.replacement.tier))].sort();
  cardRows.push({mode,cardId:id,cardName:card.name,selections,wins,burstRate:selections?burstGames/selections:null,burstGames,normalBurstGames,forcedBurstGames,rawWinRate:selections?wins/selections:null,exclusiveSelections,exclusiveWins,exclusiveWinRate:exclusiveSelections?exclusiveWins/exclusiveSelections:null,...stat(rows,`${mode}:${id}:card`),requestedSamples:trials.length,replacementUnavailable:trials.filter(t=>!t.job).length,pendingSamples:trials.filter(t=>t.job&&!results.has(t.job)).length,replacementTier:tiers.join(' / ')|| (trials.some(t=>!t.job)?'replacementUnavailable':'notSampled'),bestMatchup:sorted[0]?.opponentArchetype??null,bestMatchupCwarPer100:sorted[0]?.cWARPer100??null,worstMatchupCwarPer100:sorted.at(-1)?.cWARPer100??null,worstMatchup:sorted.at(-1)?.opponentArchetype??null,matchupWarStdDev:matchupMean===null?null:Math.sqrt(matchups.reduce((n,r)=>n+((r.cWARPer100 as number)-matchupMean)**2,0)/matchups.length),homeArchetypeSamples:home.length,offRoleSamples:off.length,homeArchetypeWAR:homeWAR,offRoleWAR:offWAR,roleFitGap:homeWAR===null||offWAR===null?null:homeWAR-offWAR});
  if(plan.options.detailIds.includes(id))for(let round=1;round<=7;round++)roundRows.push({mode,cardId:id,cardName:card.name,round,samples:rows.length,...sampleEvidence(rows.length),averageWinDelta:mean(rows.map(r=>r.roundWins[round-1])),valueScope:'roundOutcome',averageAppealDelta:mean(rows.map(r=>r.roundAppeal[round-1])),averagePointDelta:mean(rows.map(r=>r.roundPoints[round-1]))});
  for(const kind of plan.options.detailIds.includes(id)?plan.options.ablations:[]){
   const g=completed.filter(r=>r.trial.mode===mode&&r.trial.cardId===id&&r.trial.kind===kind),metric=stat(g,`${mode}:${id}:${kind}`);
   const skillRow:WarRow={mode,cardId:id,cardName:card.name,skill:kind,applicable:kind!=='CENTER'||!!card.C,...metric,skillWARPer100:metric.cWARPer100,[{AUTO:'AUTO_WAR',BURST:'BURST_WAR',CENTER:'CENTER_WAR',ALL:'ALL_SKILL_WAR'}[kind]]:metric.cWARPer100};
   if(kind==='BURST'){
    const activation=(r:Delta)=>baselines[r.trial.baseline].players[r.trial.side].states[id].burstCount,triggered=g.filter(r=>activation(r)>0),total=triggered.reduce((sum,r)=>sum+activation(r),0),positive=triggered.filter(r=>r.win>0).length,negative=triggered.filter(r=>r.win<0).length,td=mean(triggered.map(r=>r.win));
    const burst:WarRow={burstRate:selections?burstGames/selections:null,burstGames,normalBurstGames,forcedBurstGames,burstPairedSamples:g.length,burstWARPer100Selections:metric.cWARPer100,burstWARLower95:metric.cWARLower95,burstWARUpper95:metric.cWARUpper95,burstPositiveFlipRate:metric.positiveFlipRate,burstNegativeFlipRate:metric.negativeFlipRate,burstDecisiveRate:metric.decisiveRate,burstPointDeltaPer100:metric.pWARPer100,burstAppealDeltaPer100:metric.aWARPer100,burstTriggeredSamples:triggered.length,burstWinDeltaWhenTriggered:td,burstWARPer100TriggeredGames:td===null?null:td*100,burstPositiveFlipRateWhenTriggered:triggered.length?positive/triggered.length:null,burstNegativeFlipRateWhenTriggered:triggered.length?negative/triggered.length:null,totalBurstActivations:total,averageBurstActivationsPerTriggeredGame:triggered.length?total/triggered.length:null,winDeltaPerBurstActivation:total?triggered.reduce((sum,r)=>sum+r.win,0)/total:null};
    Object.assign(skillRow,burst);Object.assign(cardRows.at(-1)!,burst);
    for(let round=1;round<=7;round++){
     let measured=0;
     const subset=g.filter(r=>{const baseline=baselines[r.trial.baseline];if(baseline.burstRoundTrace){measured++;return baseline.burstRoundTrace.some(t=>t.id===id&&t.side===r.trial.side&&t.round===round);}
      const old=baseline.chargeTrace?.filter(t=>t.id===id&&t.team===(r.trial.side===0?'A':'B'));
      if(old?.length===7){measured++;return old.some(t=>t.round===round&&t.burstCountAfter>t.burstCountBefore);}return false;});
     burstRoundRows.push({mode,cardId:id,cardName:card.name,round,samples:subset.length,...sampleEvidence(subset.length),traceMeasuredGames:measured,traceUnavailableGames:g.length-measured,averageWinDelta:mean(subset.map(r=>r.win)),averagePointDelta:mean(subset.map(r=>r.point)),averageAppealDelta:mean(subset.map(r=>r.appeal))});
    }
   }
   skillRows.push(skillRow);
  }
 }
 const pairGroups=new Map<string,{mode:string;cards:[number,number];values:{value:number;cluster:string}[];unavailable:number;pending:number}>();
 for(const trial of plan.pairs){const key=`${trial.mode}:${trial.cards.join(':')}`,group=pairGroups.get(key)||{mode:trial.mode,cards:trial.cards,values:[],unavailable:0,pending:0};pairGroups.set(key,group);
  if(!trial.jobs){group.unavailable++;continue;}if(trial.jobs.some(k=>!results.has(k))){group.pending++;continue;}
  const actual=baselines[trial.baseline],values=trial.jobs.map(key=>outcomeValue(results.get(key)!,trial.side)),spec=actual.spec;
  group.values.push({value:outcomeValue(actual,trial.side)-values[0]-values[1]+values[2],cluster:hash({seed:spec.seed,pairId:spec.pairId,a:spec.a,b:spec.b,strategies:spec.cpuStrategies??null})});
 }
 for(const [key,g] of [...pairGroups].sort(([a],[b])=>a.localeCompare(b))){const ci=bootstrap95(g.values,seedFor(plan.options.seed,'bootstrap-pair',key),plan.options.bootstrapIterations),avg=mean(g.values.map(v=>v.value));pairRows.push({mode:g.mode,cardIdA:g.cards[0],cardNameA:byId(g.cards[0]).name,cardIdB:g.cards[1],cardNameB:byId(g.cards[1]).name,pairedSamples:g.values.length,...sampleEvidence(g.values.length),averageInteraction:avg,synergyWARPer100:avg===null?null:avg*100,synergyLower95:ci[0],synergyUpper95:ci[1],replacementUnavailable:g.unavailable,pendingSamples:g.pending});}
 const arch=cardRows.filter(r=>r.mode==='archetype'),random=cardRows.filter(r=>r.mode==='random');
 const comparison=arch.map((a,i)=>({cardId:a.cardId,cardName:a.cardName,archetypeCwarPer100:a.cWARPer100,randomCwarPer100:random[i].cWARPer100,synergyDependency:a.cWARPer100===null||random[i].cWARPer100===null?null:(a.cWARPer100 as number)-(random[i].cWARPer100 as number),archetypeSamples:a.pairedSamples,randomSamples:random[i].pairedSamples,archetypeSampleStatus:a.sampleStatus,randomSampleStatus:random[i].sampleStatus}));
 const detailCandidates:WarRow[]=[];
 const eligible=arch.filter(r=>(r.pairedSamples as number)>0),ranked=eligible.slice().sort((a,b)=>(b.cWARPer100 as number)-(a.cWARPer100 as number)||Number(a.cardId)-Number(b.cardId));
 for(const row of eligible){const reasons:string[]=[];
  if(ranked.slice(0,5).includes(row))reasons.push('cWAR上位5');if(ranked.slice(-5).includes(row))reasons.push('cWAR下位5');
  const matchups=matchupRows.filter(r=>r.mode==='archetype'&&r.cardId===row.cardId),values=matchups.map(r=>r.cWARPer100 as number),worst=Math.min(...values),best=Math.max(...values);
  if(worst>3)reasons.push('worstMatchup cWAR > +3');if(best-worst>=20)reasons.push('best/worst差 >= 20');
  if(Number(row.cWARLower95)>0||Number(row.cWARUpper95)<0)reasons.push('95% CIが0を跨がない');
  if(Math.abs(Number(row.rawWinRate)-.5)>=.15&&Math.abs(Number(row.cWARPer100))<3)reasons.push('採用勝率は50%から15pt以上乖離、|cWAR| < 3');
  if(row.roleFitGap!==null&&Math.abs(Number(row.roleFitGap))>=10)reasons.push('|home/offRole差| >= 10');
  if(reasons.length)detailCandidates.push({cardId:row.cardId,cardName:row.cardName,cWARPer100:row.cWARPer100,worstMatchupCwarPer100:worst,bestMatchupCwarPer100:best,pairedSamples:row.pairedSamples,sampleStatus:row.sampleStatus,reasons:reasons.join(' / '),autoRun:false});
 }
 return {detail_candidates:detailCandidates,card_war_stats:arch,random_card_war_stats:random,archetypeCardWAR:arch,randomCardWAR:random,card_war_mode_comparison:comparison,card_archetype_war_stats:archetypeRows,card_matchup_war_stats:matchupRows,card_round_value_stats:roundRows,card_skill_ablation_stats:skillRows,pair_synergy_war_stats:pairRows,burst_round_war_stats:burstRoundRows};
}
