import {appendFileSync,copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseInputs,contract,cliArgs,executeCli,fileHashes,type Context,type Config} from './actions-simulation';
import {randomSchedule,archetypeSchedule,withStrategies} from '../src/simulation/schedule';
import {generateArchetypes} from '../src/simulation/teams';
import {loadCheckpoint} from '../src/simulation/checkpoint';
import type {MatchOptions,MatchSpec} from '../src/simulation/match';
const json=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
export function parallelInputs(raw:Record<string,unknown>){
 if(Object.keys(raw).some(k=>!['seed','matches_per_matchup','random_matches','runtime_minutes','retention_days','continue_to_level2','resume_run_id'].includes(k)))throw Error('Unknown parallel workflow input');
 return {scenario:'CUSTOM',mode:'all',archetype_selection:'constructed',cpu_strategy:'charge-archetype',matches_per_matchup:50,random_matches:1000,seed:1,workers:0,fast_simulation:true,burst_round_trace:true,cpu_search:'two-stage',preview_candidates:'100',max_new_matches:0,runtime_minutes:300,retention_days:7,analysis_level:'baseline',war_samples_per_card:50,war_workers:0,war_max_new_jobs:0,war_detail_ids:'',war_skill_ablation:'AUTO,BURST,CENTER,ALL',war_pairs:'',continue_to_level2:true,...raw};
}
export function validateParallelPart(dir:string,mode:'random'|'archetype',expected:ReturnType<typeof contract>,specs:MatchSpec[],options:MatchOptions,requireComplete=true){
 const marker=JSON.parse(readFileSync(join(dir,'parallel-part.json'),'utf8'));
 if(marker.mode!==mode||JSON.stringify(marker.contract)!==JSON.stringify(expected))throw Error('Parallel part commit/seed/card/CPU/schedule mismatch');
 const saved=loadCheckpoint(join(dir,`${mode}-checkpoint.jsonl`),specs,options);
 if(requireComplete&&saved.size!==specs.length)throw Error('Parallel part incomplete; resume that part before aggregation');
 return marker;
}
async function main(){
 const raw=JSON.parse(process.env.PARALLEL_INPUTS||'{}'),inputs=parallelInputs(raw),config=parseInputs(inputs);
 const context:Context={sha:process.env.GITHUB_SHA||'',repository:process.env.GITHUB_REPOSITORY||'',runId:process.env.GITHUB_RUN_ID||'',attempt:process.env.GITHUB_RUN_ATTEMPT||'1'};
 const expected=contract(config,context),task=process.argv[2],out=resolve(process.argv[3]||'simulation-results/remote');
 mkdirSync(out,{recursive:true});
 if(task==='random'||task==='archetype'){
  if(config.resumeRunId){
   const source=resolve('simulation-results/restored',`parallel-baseline-${task}`);
   const specs=withStrategies(task==='random'?randomSchedule(config.seed,config.randomMatches):archetypeSchedule(config.seed,config.matchesPerMatchup,generateArchetypes(config.seed,3,'constructed')),config.cpuStrategy);
   validateParallelPart(source,task,expected,specs,{fastSimulation:true,cpuSearch:{mode:'two-stage',previewCandidates:100},recordBurstRounds:true},false);
   for(const suffix of ['checkpoint.jsonl','timing.json']){const name=`${task}-${suffix}`;if(existsSync(join(source,name)))copyFileSync(join(source,name),join(out,name));}
  }
  const result=await executeCli(cliArgs({...config,mode:task},out,!!config.resumeRunId),join(out,'parallel.log'),config.minutes*60000,()=>{});
  json(join(out,'parallel-part.json'),{mode:task,contract:expected,context,elapsedSeconds:result.elapsed});
  const summary=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));
  if(result.code||!summary[task]?.complete)throw Error('Part incomplete; checkpoint saved, combined analysis not started');
  return;
 }
 if(task!=='aggregate')throw Error('Choose random, archetype, or aggregate');
 const parts=resolve(process.argv[4]||'simulation-results/parts');
 const specs={random:withStrategies(randomSchedule(config.seed,config.randomMatches),config.cpuStrategy),archetype:withStrategies(archetypeSchedule(config.seed,config.matchesPerMatchup,generateArchetypes(config.seed,3,'constructed')),config.cpuStrategy)};
 const options:MatchOptions={fastSimulation:true,cpuSearch:{mode:'two-stage',previewCandidates:100},recordBurstRounds:true};
 // Validate BOTH inputs before writing any combined checkpoints; never concatenate CSVs.
 const provenance=(['random','archetype'] as const).map(mode=>validateParallelPart(join(parts,`parallel-baseline-${mode}`),mode,expected,specs[mode],options));
 for(const mode of ['random','archetype'])for(const suffix of ['checkpoint.jsonl','timing.json']){
  const name=`${mode}-${suffix}`,from=join(parts,`parallel-baseline-${mode}`,name);if(existsSync(from))copyFileSync(from,join(out,name));
 }
 const result=await executeCli(cliArgs(config,out,true,0,true),join(out,'aggregation.log'),600000,()=>{});if(result.code)throw Error('Combined aggregation failed');
 const summary=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));if(!summary.random?.complete||!summary.archetype?.complete)throw Error('Combined baseline incomplete');
 json(join(out,'parallel-provenance.json'),provenance);
 json(join(out,'remote-status.json'),{state:'completed',complete:true,exitCode:0,context,config,baselineOnly:true});
 json(join(out,'remote-manifest.json'),{schemaVersion:1,repository:context.repository,latestRunId:context.runId,contract:expected,lineage:[{runId:context.runId,attempt:context.attempt,state:'completed',analysisLevel:'baseline'}],files:fileHashes(out)});
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Parallel baseline complete: RANDOM ${summary.random.games}, constructed decks ${summary.archetype.games}. Game/CPU/seed validated before aggregation.\n`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await main();}catch(error){console.error(String(error));process.exitCode=1;}
