import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { csv,json } from './output';
import { summarizeWar } from './war-statistics';
import type { WarPlan } from './war-plan';
import type { WarResult } from './war-runner';
import type { MatchResult } from './match';
export function writeWarOutput(out:string,plan:WarPlan,baselines:MatchResult[],results:Map<string,WarResult>) {
 const data=summarizeWar(plan,baselines,results);mkdirSync(out,{recursive:true});
 json(join(out,'statistics.json'),data);
 for(const mode of ['archetype','random'] as const){
  const dir=join(out,mode);mkdirSync(dir,{recursive:true});
  csv(join(dir,'card_war_stats.csv'),mode==='archetype'?data.card_war_stats:data.random_card_war_stats);
  for(const key of ['card_archetype_war_stats','card_matchup_war_stats','card_round_value_stats','card_skill_ablation_stats','pair_synergy_war_stats','burst_round_war_stats'] as const)csv(join(dir,key+'.csv'),data[key].filter(r=>r.mode===mode));
 }
 csv(join(out,'detail_candidates.csv'),data.detail_candidates);
 csv(join(out,'card_war_mode_comparison.csv'),data.card_war_mode_comparison);
 // Audit which exact seed/side/replacement/tier produced each paired delta.
 json(join(out,'paired_trials.json'),{cardTrials:plan.trials.map(t=>({...t,seed:baselines[t.baseline].spec.seed,pairId:baselines[t.baseline].spec.pairId,mirror:baselines[t.baseline].spec.mirror,status:t.job?(results.has(t.job)?'completed':'pending'):t.replacement.tier})),pairTrials:plan.pairs});
 return {policy:plan.policy,inputFingerprint:plan.fingerprint,baselineMatches:baselines.length,baselineHash:plan.baselineHash,plannedJobs:plan.jobs.length,completedJobs:results.size,complete:results.size===plan.jobs.length,options:plan.options};
}
