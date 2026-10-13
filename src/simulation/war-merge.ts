import type { WarRow } from './war-statistics';
// Separate executions/levels can enrich an analysis, but never sum their WARs
// or paired counts. Keep the most sampled row, then attach BURST diagnostics.
export function mergeWarData(runs:{data:Record<string,WarRow[]>;modes:string[]}[]):Record<string,WarRow[]> {
 const keys=['card_war_stats','random_card_war_stats','card_archetype_war_stats','card_matchup_war_stats','card_round_value_stats','card_skill_ablation_stats','pair_synergy_war_stats','burst_round_war_stats','detail_candidates'];
 const result:Record<string,WarRow[]>={};
 for(const key of keys){const rows=new Map<string,WarRow>();
  for(const run of runs)for(const row of run.data[key]||[]){
   const mode=key==='detail_candidates'?'archetype':String(row.mode);if(!run.modes.includes(mode))continue;
   const identity=JSON.stringify([mode,row.cardId??null,row.cardIdA??null,row.cardIdB??null,row.archetype??null,row.opponentArchetype??null,row.round??null,row.skill??null]);
   const existing=rows.get(identity),n=Number(row.pairedSamples??row.samples??0),old=Number(existing?.pairedSamples??existing?.samples??-1);
   if(!existing||n>=old)rows.set(identity,row);
  }
  result[key]=[...rows.values()].sort((a,b)=>String(a.mode??'').localeCompare(String(b.mode??''))||Number(a.cardId??a.cardIdA)-Number(b.cardId??b.cardIdA)||Number(a.round??a.cardIdB??0)-Number(b.round??b.cardIdB??0)||String(a.archetype??a.opponentArchetype??a.skill??'').localeCompare(String(b.archetype??b.opponentArchetype??b.skill??'')));
 }
 for(const key of ['card_war_stats','random_card_war_stats'])for(const row of result[key]){const burst=result.card_skill_ablation_stats.find(b=>b.mode===row.mode&&b.cardId===row.cardId&&b.skill==='BURST');if(burst)for(const [k,v] of Object.entries(burst))if(k.startsWith('burst')||['totalBurstActivations','averageBurstActivationsPerTriggeredGame','winDeltaPerBurstActivation'].includes(k))row[k]=v;}
 result.archetypeCardWAR=result.card_war_stats;result.randomCardWAR=result.random_card_war_stats;
 const ids=[...new Set([...result.card_war_stats,...result.random_card_war_stats].map(r=>Number(r.cardId)))].sort((a,b)=>a-b);
 result.card_war_mode_comparison=ids.map(cardId=>{const a=result.card_war_stats.find(r=>r.cardId===cardId),r=result.random_card_war_stats.find(r=>r.cardId===cardId);return {cardId,cardName:a?.cardName??r?.cardName,archetypeCwarPer100:a?.cWARPer100??null,randomCwarPer100:r?.cWARPer100??null,synergyDependency:a?.cWARPer100==null||r?.cWARPer100==null?null:Number(a.cWARPer100)-Number(r.cWARPer100),archetypeSamples:a?.pairedSamples??0,randomSamples:r?.pairedSamples??0,archetypeSampleStatus:a?.sampleStatus??'insufficient',randomSampleStatus:r?.sampleStatus??'insufficient'};});
 return result;
}
