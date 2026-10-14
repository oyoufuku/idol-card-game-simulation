import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {appendFileSync,existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {availableParallelism,cpus,totalmem} from 'node:os';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateArchetypes} from '../src/simulation/teams';
import {archetypeSchedule,randomSchedule,withStrategies,type StrategySelection} from '../src/simulation/schedule';
import {INPUT_FINGERPRINT} from '../src/simulation/input-fingerprint';

export interface Config {
 scenario:'CUSTOM'|'A'|'B'|'C';mode:'random'|'archetype'|'all';selection:'legacy'|'balanced'|'constructed';cpuStrategy:StrategySelection;
 matchesPerMatchup:number;randomMatches:number;seed:number;workers:number;fast:boolean;search:'exhaustive'|'two-stage';
 candidates:number;maxNewMatches:number;minutes:number;retentionDays:number;resumeRunId:string;burstRoundTrace:boolean;
 analysisLevel:'baseline'|'level1'|'level2'|'level3';warSamplesPerCard:number;warWorkers:number;warMaxNewJobs:number;
 warDetailIds:number[];warSkillAblation:string;warPairs:string;continueToLevel2:boolean;resumeCompatibleCommit:string;
}
export interface Context {sha:string;repository:string;runId:string;attempt:string}
const keys=['scenario','mode','archetype_selection','cpu_strategy','matches_per_matchup','random_matches','seed','workers','fast_simulation','cpu_search','preview_candidates','max_new_matches','runtime_minutes','retention_days','resume_run_id','burst_round_trace','analysis_level','war_samples_per_card','war_workers','war_max_new_jobs','war_detail_ids','war_skill_ablation','war_pairs','continue_to_level2','resume_compatible_commit'];
function choice<T extends string>(value:unknown,fallback:T,allowed:readonly T[],name:string):T {
 const v=value??fallback;if(typeof v!=='string'||!allowed.includes(v as T))throw new Error(`Invalid ${name}`);return v as T;
}
function integer(value:unknown,fallback:number,min:number,max:number,name:string){
 const s=String(value??fallback);if(!/^\d+$/.test(s))throw new Error(`Invalid ${name}`);
 const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`Invalid ${name}`);return n;
}
export function parseInputs(raw:Record<string,unknown>,cpuCount=availableParallelism()):Config {
 if(!raw||Array.isArray(raw)||typeof raw!=='object'||Object.keys(raw).some(k=>!keys.includes(k)))throw new Error('Unknown workflow input');
 const scenario=choice(raw.scenario,'CUSTOM',['CUSTOM','A','B','C'],'scenario');
 const mode=choice(raw.mode,'archetype',['random','archetype','all'],'mode');
 if(scenario!=='CUSTOM'&&mode==='random')throw new Error('A/B/C construction applies to ARCHETYPE; choose all or archetype');
 let selection=choice(raw.archetype_selection,'balanced',['legacy','balanced','constructed'],'archetype_selection');
 let cpuStrategy=choice(raw.cpu_strategy,'charge-archetype',['normal','charge-archetype','burst','burst-charge-archetype'] as const,'cpu_strategy');
 if(scenario!=='CUSTOM'){selection=scenario==='A'?'legacy':'balanced';cpuStrategy=scenario==='C'?'burst-charge-archetype':scenario==='B'?'charge-archetype':'normal';}
 const matchesPerMatchup=integer(raw.matches_per_matchup,2,2,1000,'matches_per_matchup');if(matchesPerMatchup%2)throw new Error('matches_per_matchup must be even, including mirrors');
 const configuredWorkers=integer(raw.workers,0,0,32,'workers');if(configuredWorkers>cpuCount)throw new Error('workers exceeds available CPUs; use 0 for auto');
 const fast=raw.fast_simulation??true;if(![true,false,'true','false'].includes(fast as boolean|string))throw new Error('Invalid fast_simulation');
 const burstRoundTrace=raw.burst_round_trace??false;if(![true,false,'true','false'].includes(burstRoundTrace as boolean|string))throw new Error('Invalid burst_round_trace');
 const resumeRunId=String(raw.resume_run_id??'');if(resumeRunId&&!/^\d{1,20}$/.test(resumeRunId))throw new Error('Invalid resume_run_id');
 const candidates=integer(raw.preview_candidates,100,100,300,'preview_candidates');if(![100,200,300].includes(candidates))throw new Error('preview_candidates must be 100/200/300');
 const analysisLevel=choice(raw.analysis_level,'baseline',['baseline','level1','level2','level3'],'analysis_level');
 const warDetailText=String(raw.war_detail_ids??'').trim();if(warDetailText&&!/^\d{1,2}(,\d{1,2})*$/.test(warDetailText))throw new Error('war_detail_ids must be comma-separated card IDs');
 const warDetailIds=warDetailText?warDetailText.split(',').map(Number):[];if(new Set(warDetailIds).size!==warDetailIds.length||warDetailIds.some(id=>id<1||id>48))throw new Error('war_detail_ids must be unique integers 1..48');
 const warSkillAblation=choice(raw.war_skill_ablation,'AUTO,BURST,CENTER,ALL',['AUTO,BURST,CENTER,ALL','AUTO','BURST','CENTER','ALL'],'war_skill_ablation');
 const warPairs=String(raw.war_pairs??'').trim();if(warPairs&&!/^\d{1,2}:\d{1,2}(,\d{1,2}:\d{1,2})*$/.test(warPairs))throw new Error('war_pairs must be card pairs such as 1:2,3:4');
 for(const id of warPairs.split(/[,:]/).filter(Boolean).map(Number))if(id<1||id>48||!warDetailIds.includes(id))throw new Error('war_pairs IDs must be 1..48 and included in war_detail_ids');
 if(analysisLevel!=='baseline'&&mode!=='all')throw new Error('WAR pipeline requires mode=all so ARCHETYPE and RANDOM stay in one analysis output');
 if(analysisLevel!=='baseline'&&!resumeRunId)throw new Error('L1/L2/L3 require resume_run_id from the preceding artifact');
 if(analysisLevel==='level3'&&!warDetailIds.length)throw new Error('LEVEL 3 requires explicit war_detail_ids');
 const chain=raw.continue_to_level2??false;if(![true,false,'true','false'].includes(chain as boolean|string))throw new Error('Invalid continue_to_level2');
 const continueToLevel2=chain===true||chain==='true';
 if(continueToLevel2&&(mode!=='all'||analysisLevel==='level3'||warDetailIds.length||warPairs))throw new Error('Automatic pipeline requires mode=all and baseline/L1/L2 only');
 const resumeCompatibleCommit=String(raw.resume_compatible_commit??'');if(resumeCompatibleCommit&&(!/^[a-f\d]{40}$/.test(resumeCompatibleCommit)||!resumeRunId))throw new Error('resume_compatible_commit requires a full commit SHA and resume_run_id');
 const configuredWarWorkers=integer(raw.war_workers,0,0,32,'war_workers');if(configuredWarWorkers>cpuCount)throw new Error('war_workers exceeds available CPUs; use 0 for auto');
 return {scenario,mode,selection,cpuStrategy,matchesPerMatchup,randomMatches:integer(raw.random_matches,1,1,50000,'random_matches'),seed:integer(raw.seed,1,0,4294967295,'seed'),workers:configuredWorkers||Math.min(cpuCount,4),fast:fast===true||fast==='true',search:choice(raw.cpu_search,'two-stage',['exhaustive','two-stage'],'cpu_search'),candidates,maxNewMatches:integer(raw.max_new_matches,2,0,50000,'max_new_matches'),minutes:integer(raw.runtime_minutes,300,1,330,'runtime_minutes'),retentionDays:integer(raw.retention_days,7,1,90,'retention_days'),resumeRunId,burstRoundTrace:burstRoundTrace===true||burstRoundTrace==='true',analysisLevel,warSamplesPerCard:integer(raw.war_samples_per_card,50,1,5000,'war_samples_per_card'),warWorkers:configuredWarWorkers||Math.min(cpuCount,4),warMaxNewJobs:integer(raw.war_max_new_jobs,0,0,500000,'war_max_new_jobs'),warDetailIds,warSkillAblation,warPairs,continueToLevel2,resumeCompatibleCommit};
}
export function contract(config:Config,context:Context){
 if(!/^[a-f\d]{40}$/.test(context.sha)||!/^[-\w.]+\/[-\w.]+$/.test(context.repository)||!/^\d+$/.test(context.runId)||!/^\d+$/.test(context.attempt))throw new Error('Invalid GitHub execution context');
 const teams=config.mode==='random'?[]:generateArchetypes(config.seed,3,config.selection);
 const specs=[...(config.mode==='archetype'?[]:withStrategies(randomSchedule(config.seed,config.randomMatches),config.cpuStrategy)),...(config.mode==='random'?[]:withStrategies(archetypeSchedule(config.seed,config.matchesPerMatchup,teams),config.cpuStrategy))];
 const hash=createHash('sha256');for(const spec of specs)hash.update(JSON.stringify(spec)+'\n');
 return {commitSha:context.sha,inputFingerprint:INPUT_FINGERPRINT,mode:config.mode,seed:config.seed,cpuStrategy:config.cpuStrategy,selection:config.selection,search:config.search,candidates:config.candidates,fast:config.fast,burstRoundTrace:config.burstRoundTrace,matches:config.mode==='archetype'?config.matchesPerMatchup:config.mode==='random'?config.randomMatches:{random:config.randomMatches,archetype:config.matchesPerMatchup},plannedGames:specs.length,planHash:hash.digest('hex')};
}
export function cliArgs(config:Config,out:string,resume=false,maxNewMatches=config.maxNewMatches,checkpointOnly=false){
 const args=['--mode',config.mode,'--archetype-selection',config.selection,'--cpu-strategy',config.cpuStrategy,'--matches-per-matchup',String(config.matchesPerMatchup),'--random-matches',String(config.randomMatches),'--seed',String(config.seed),'--workers',String(config.workers),'--cpu-search',config.search,'--preview-candidates',String(config.candidates),'--out',out];
 if(config.fast)args.push('--fast-simulation');if(config.burstRoundTrace)args.push('--burst-round-trace');if(resume)args.push('--resume');if(checkpointOnly||maxNewMatches>0)args.push('--max-new-matches',String(maxNewMatches));return args;
}
export function warCliArgs(config:Config,out:string,maxNewJobs:number|undefined=config.warMaxNewJobs||undefined){
 const args=['--war-only','--out',out,'--war-samples-per-card',String(config.warSamplesPerCard),'--war-seed',String(config.seed),'--war-workers',String(config.warWorkers)];
 if(maxNewJobs!==undefined)args.push('--war-max-new-jobs',String(maxNewJobs));
 if(config.analysisLevel==='level1')args.push('--card-war');
 else if(config.analysisLevel==='level2')args.push('--random-card-war');
 else if(config.analysisLevel==='level3'){
  args.push('--card-war','--war-detail-ids',config.warDetailIds.join(','),'--war-skill-ablation',config.warSkillAblation);
  if(config.warPairs)args.push('--war-pairs',config.warPairs);
 }
 return args;
}
export function validateAnalysisPrerequisites(config:Config,summary:Record<string,any>){
 if(config.analysisLevel==='baseline')return;
 const runs=summary.warRuns??(summary.cardWar?[summary.cardWar]:[]),completed=(output:string)=>runs.some((run:{output:string;complete:boolean})=>run.output===output&&run.complete===true);
 if(summary.random?.complete!==true||summary.archetype?.complete!==true)throw new Error('WAR requires completed ARCHETYPE and RANDOM baselines in the restored artifact');
 if((config.analysisLevel==='level2'||config.analysisLevel==='level3')&&!completed('war/level1-archetype'))throw new Error('LEVEL 2/3 requires completed LEVEL 1 in the restored artifact');
 if(config.analysisLevel==='level3'&&!completed('war/level2-random'))throw new Error('LEVEL 3 requires completed LEVEL 2 in the restored artifact');
}
const json=(path:string,value:unknown)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
function files(dir:string,prefix=''):string[]{return readdirSync(join(dir,prefix)).flatMap(name=>{const path=join(prefix,name),stat=lstatSync(join(dir,path));if(stat.isSymbolicLink()||!stat.isDirectory()&&!stat.isFile())throw new Error('Non-regular file in artifact');return stat.isDirectory()?files(dir,path):[path];}).sort();}
export function fileHashes(dir:string){return Object.fromEntries(files(dir).filter(p=>p!=='remote-manifest.json').map(path=>[path.split('\\').join('/'),createHash('sha256').update(readFileSync(join(dir,path))).digest('hex')]));}
export function restoredArtifactRoot(base:string,runId:string){
 const dirs=existsSync(join(base,'remote-manifest.json'))?[base]:readdirSync(base).map(name=>join(base,name)).filter(path=>lstatSync(path).isDirectory()&&!lstatSync(path).isSymbolicLink());
 const candidates=dirs.map(path=>{
  if(!existsSync(join(path,'remote-manifest.json')))throw new Error('Restored artifact has no remote manifest');
  const manifest=JSON.parse(readFileSync(join(path,'remote-manifest.json'),'utf8'));
  const attempt=manifest.lineage?.at(-1)?.attempt;
  if(manifest.latestRunId!==runId||!/^\d+$/.test(String(attempt)))throw new Error('Artifact run ID/attempt mismatch');
  return {path,attempt:Number(attempt)};
 }).sort((a,b)=>b.attempt-a.attempt);
 if(!candidates.length||candidates[0].attempt===candidates[1]?.attempt)throw new Error('Ambiguous or missing resume artifact');
 return candidates[0].path;
}
// This recovery exception permits only serialization/pipeline repairs, never game changes.
export function validateMetadataMigration(prior:ReturnType<typeof contract>,expected:ReturnType<typeof contract>,compatibleCommit:string,changedPaths:string[]){
 if(!/^[a-f\d]{40}$/.test(compatibleCommit)||prior.commitSha!==compatibleCommit)throw new Error('Resume rejected: incompatible prior commit');
 if(JSON.stringify({...prior,commitSha:expected.commitSha})!==JSON.stringify(expected))throw new Error('Resume rejected: simulation contract mismatch');
 const allowed=(path:string)=>['.github/workflows/simulate.yml','scripts/actions-simulation.ts','scripts/actions-chain.ts','src/simulation/constructed-teams.ts','SIMULATION.md'].includes(path)||/^src\/tests\/[^/]+\.test\.ts$/.test(path)||path.startsWith('docs/');
 if(changedPaths.some(path=>!allowed(path)))throw new Error('Resume rejected: game/CPU or unsupported code changed');
}
export function validateResume(dir:string,expected:ReturnType<typeof contract>,context:Context,runId:string,compatibleCommit=''){
 const prior=JSON.parse(readFileSync(join(dir,'remote-manifest.json'),'utf8'));
 if(prior.schemaVersion!==1||prior.repository!==context.repository||prior.latestRunId!==runId)throw new Error('Resume rejected: artifact identity mismatch');
 if(JSON.stringify(prior.contract)!==JSON.stringify(expected)){
  if(!compatibleCommit)throw new Error('Resume rejected: commit/inputFingerprint/seed/CPU/construction/search/fast mode/match plan mismatch');
  // Fail closed if the historical commit is missing; do not infer compatibility from fingerprints alone.
  const diff=spawnSync('git',['diff','--name-only','--no-renames',compatibleCommit,context.sha],{encoding:'utf8'});
  if(diff.status!==0)throw new Error('Resume rejected: cannot verify compatible commit history');
  validateMetadataMigration(prior.contract,expected,compatibleCommit,diff.stdout.trim().split('\n').filter(Boolean));
 }
 if(!prior.files||typeof prior.files!=='object'||Array.isArray(prior.files))throw new Error('Resume rejected: missing file hashes');
 const current=fileHashes(dir);if(JSON.stringify(Object.keys(current).sort())!==JSON.stringify(Object.keys(prior.files).sort()))throw new Error('Resume rejected: artifact file list mismatch');
 for(const [path,hash] of Object.entries(prior.files)){
  if(isAbsolute(path)||path.split(/[\\/]/).includes('..')||!/^[a-f\d]{64}$/.test(String(hash))||current[path]!==hash)throw new Error('Resume rejected: artifact checksum mismatch');
 }
 const checkpoints=expected.mode==='all'?['random-checkpoint.jsonl','archetype-checkpoint.jsonl']:[`${expected.mode}-checkpoint.jsonl`];
 if(checkpoints.some(path=>!existsSync(join(dir,path))))throw new Error('Resume rejected: checkpoint not saved');return prior;
}
export function repairInterruptedTail(path:string){
 const text=readFileSync(path,'utf8'),lines=text.split('\n'),last=lines.at(-1)===''?lines.length-2:lines.length-1;
 let removed=false;
 for(let i=0;i<=last;i++)try{JSON.parse(lines[i]);}catch{
  if(i!==last||text.endsWith('\n'))throw new Error('Malformed checkpoint before final unterminated record');
  writeFileSync(path+'.interrupted-tail.txt',lines[i]);writeFileSync(path,lines.slice(0,i).join('\n')+(i?'\n':''));removed=true;
 }
 return removed;
}
export function repairInterruptedSummary(path:string){
 if(!existsSync(path))return false;
 try{JSON.parse(readFileSync(path,'utf8'));return false;}
 catch{renameSync(path,path+'.interrupted.txt');return true;}
}
export function performanceReport(summary:Record<string,any>,elapsedSeconds:number,config:Config){
 const rows=config.mode==='all'?[summary.random,summary.archetype].filter(Boolean):[summary[config.mode]].filter(Boolean),newGames=rows.reduce((n,row)=>n+Number(row?.newGames??0),0);
 const measuredSeconds=rows.reduce((n,row)=>n+(Number(row?.newGames??0)&&Number(row?.sessionGamesPerMinute)>0?Number(row.newGames)*60/Number(row.sessionGamesPerMinute):0),0),sessionSeconds=measuredSeconds||elapsedSeconds;
 const perGame=newGames?sessionSeconds/newGames:null;
 return {cpuStrategy:config.cpuStrategy,newGames,sessionSeconds,averageWallSecondsPerGame:perGame,effectiveWorkers:rows[0]?.effectiveWorkers??config.workers,sampleStatus:newGames>=100?'100+ games measured':'Small sample; run 100-game benchmark before selecting workers',estimatedSeconds: Object.fromEntries([900,2250,5000].map(n=>[n,perGame===null?null:n*perGame]))};
}
function contextFromEnv():Context {
 const sha=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});if(sha.status!==0)throw new Error('Cannot identify checked-out commit');
 const actual=sha.stdout.trim();if(process.env.GITHUB_SHA&&actual!==process.env.GITHUB_SHA)throw new Error('Checked-out commit differs from GITHUB_SHA');
 return {sha:actual,repository:process.env.GITHUB_REPOSITORY||'oyoufuku/idol-card-game',runId:process.env.GITHUB_RUN_ID||'0',attempt:process.env.GITHUB_RUN_ATTEMPT||'1'};
}
const root=()=>process.cwd(),outPath=()=>resolve(root(),'simulation-results/remote'),requestPath=()=>resolve(root(),'simulation-results/remote-request.json');
function hardware(){return {cpuModel:cpus()[0]?.model??'unknown',availableCPUs:availableParallelism(),memoryGiB:totalmem()/1073741824,nodeVersion:process.version,platform:process.platform,architecture:process.arch};}
function prepare(){
 const config=parseInputs(JSON.parse(process.env.SIMULATION_INPUTS||'{}')),context=contextFromEnv(),expected=contract(config,context);
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),name=`simulation-results-${config.analysisLevel}-${config.mode}-${config.cpuStrategy}-${config.selection}-seed${config.seed}-${stamp}-${context.runId}-${context.attempt}`;
 mkdirSync(resolve(root(),'simulation-results'),{recursive:true});json(requestPath(),{config,context,contract:expected,artifactName:name,hardware:hardware()});
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`resume_run_id=${config.resumeRunId}\nartifact_name=${name}\nretention_days=${config.retentionDays}\n`);
 console.log(JSON.stringify({analysisLevel:config.analysisLevel,mode:config.mode,scenario:config.scenario,cpu:config.cpuStrategy,plannedGames:expected.plannedGames,maxNewMatches:config.maxNewMatches,warMaxNewJobs:config.warMaxNewJobs,workers:config.workers,warWorkers:config.warWorkers,hardware:hardware()}));
}
export async function executeCli(args:string[],log:string,maxMs:number,onStop?:(reason:string)=>void){
 const started=Date.now(),processChild=spawn(process.execPath,['--import','tsx','src/simulation/cli.ts',...args],{cwd:root(),stdio:['ignore','pipe','pipe'],shell:false});
 for(const [stream,output] of [[processChild.stdout,process.stdout],[processChild.stderr,process.stderr]] as const)stream.on('data',chunk=>{output.write(chunk);appendFileSync(log,chunk);});
 let stopped=false,killTimer:ReturnType<typeof setTimeout>|undefined;
 const stop=(reason:string)=>{if(stopped)return;stopped=true;onStop?.(reason);processChild.kill('SIGINT');killTimer=setTimeout(()=>processChild.kill('SIGKILL'),60000);};
 const sigint=()=>stop('cancelled'),sigterm=()=>stop('cancelled');process.on('SIGINT',sigint);process.on('SIGTERM',sigterm);
 const timer=setTimeout(()=>stop('time-budget'),maxMs);
 try{return await new Promise<{code:number;elapsed:number;stopped:boolean}>((done,reject)=>{processChild.on('error',reject);processChild.on('close',(code)=>done({code:code??1,elapsed:(Date.now()-started)/1000,stopped}));});}
 finally{clearTimeout(timer);if(killTimer)clearTimeout(killTimer);process.off('SIGINT',sigint);process.off('SIGTERM',sigterm);}
}
async function run(){
 const request=JSON.parse(readFileSync(requestPath(),'utf8')) as {config:Config;context:Context;contract:ReturnType<typeof contract>;hardware:ReturnType<typeof hardware>};
 const {config,context}=request,out=outPath(),restored=resolve(root(),'simulation-results/restored');let lineage:unknown[]=[];
 // Validate before moving or changing any saved result. Existing CLI checks every result/spec again.
 if(config.resumeRunId){const selected=restoredArtifactRoot(restored,config.resumeRunId),prior=validateResume(selected,request.contract,context,config.resumeRunId,config.resumeCompatibleCommit);if(existsSync(out))throw new Error('Output already exists');renameSync(selected,out);lineage=prior.lineage??[];if(prior.contract.commitSha!==context.sha)lineage.push({migration:{from:prior.contract.commitSha,to:context.sha,reason:'Verified metadata-only repair; identical game contract and plan; artifact checksums validated'}});}
 else {if(existsSync(out))throw new Error('Output already exists; choose a clean workspace');mkdirSync(out,{recursive:true});}
 let reason='completed',code=0,elapsed=0,aggregateError:string|null=null;
 const log=join(out,`run-${context.runId}-${context.attempt}.log`);
 json(join(out,'remote-running.json'),{startedAt:new Date().toISOString(),config,context,hardware:request.hardware});
 try{
  const baselineCheckpoints=config.mode==='all'?['random-checkpoint.jsonl','archetype-checkpoint.jsonl']:[`${config.mode}-checkpoint.jsonl`];
  if(config.resumeRunId)for(const path of baselineCheckpoints)repairInterruptedTail(join(out,path));
  else {const result=await executeCli([...cliArgs(config,out,false,0),'--generate-only'],log,120000);if(result.code)throw new Error('CLI preflight failed');}
  if(config.analysisLevel!=='baseline'){
   const before=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));validateAnalysisPrerequisites(config,before);
   const warDir=config.analysisLevel==='level1'?'war/level1-archetype':config.analysisLevel==='level2'?'war/level2-random':`war/detail-${config.warDetailIds.join('-')}`;
   const checkpoint=join(out,warDir,'checkpoint.jsonl');if(existsSync(checkpoint))repairInterruptedTail(checkpoint);
   const args=[...warCliArgs(config,out), '--war-out',join(out,warDir)];
   const result=await executeCli(args,log,config.minutes*60000,r=>{reason=r;});elapsed=result.elapsed;code=result.code;
  }else{
   const result=await executeCli(cliArgs(config,out,!!config.resumeRunId),log,config.minutes*60000,r=>{reason=r;});elapsed=result.elapsed;code=result.code;
  }
  if(code&&reason==='completed')reason='failed';
 }catch(error){reason='failed';code=1;aggregateError=String(error);}
 // Only aggregate completed checkpoints; never create extra games during recovery.
 const baselineCheckpoints=config.mode==='all'?['random-checkpoint.jsonl','archetype-checkpoint.jsonl']:[`${config.mode}-checkpoint.jsonl`];
 if(baselineCheckpoints.every(path=>existsSync(join(out,path)))){
  try{for(const path of baselineCheckpoints)repairInterruptedTail(join(out,path));
   repairInterruptedSummary(join(out,'summary.json'));
   if(config.analysisLevel==='baseline'&&(code||!existsSync(join(out,'analysis.xlsx')))){const result=await executeCli(cliArgs(config,out,true,0,true),log,600000);if(result.code)throw new Error('Checkpoint-only aggregation failed');}
   if(config.analysisLevel!=='baseline'&&code){
    const warDir=config.analysisLevel==='level1'?'war/level1-archetype':config.analysisLevel==='level2'?'war/level2-random':`war/detail-${config.warDetailIds.join('-')}`;
    const checkpoint=join(out,warDir,'checkpoint.jsonl');if(existsSync(checkpoint)){repairInterruptedTail(checkpoint);
     const result=await executeCli([...warCliArgs(config,out,0),'--war-out',join(out,warDir)],log,600000);if(result.code)throw new Error('WAR checkpoint-only aggregation failed');}
   }
  }catch(error){aggregateError=String(error);code=1;reason='failed';}
 }
 const summary=existsSync(join(out,'summary.json'))?JSON.parse(readFileSync(join(out,'summary.json'),'utf8')):{};
 const runs=summary.warRuns??(summary.cardWar?[summary.cardWar]:[]),warOutput=config.analysisLevel==='level1'?'war/level1-archetype':config.analysisLevel==='level2'?'war/level2-random':config.analysisLevel==='level3'?`war/detail-${config.warDetailIds.join('-')}`:'';
 const baselineComplete=config.mode==='all'?summary.random?.complete===true&&summary.archetype?.complete===true:summary[config.mode]?.complete===true;
 const complete=config.analysisLevel==='baseline'?baselineComplete:runs.some((run:{output:string;complete:boolean})=>run.output===warOutput&&run.complete===true);if(!complete&&reason==='completed')reason='partial';
 const report={state:reason,complete,elapsedSeconds:elapsed,exitCode:code,aggregateError,context,hardware:request.hardware,config,performance:performanceReport(summary,elapsed,config)};
 json(join(out,'remote-status.json'),report);
 json(join(out,`run-${context.runId}-${context.attempt}.json`),report);
 const manifest={schemaVersion:1,repository:context.repository,latestRunId:context.runId,contract:request.contract,lineage:[...lineage,{runId:context.runId,attempt:context.attempt,state:reason,analysisLevel:config.analysisLevel}],files:fileHashes(out)};
 json(join(out,'remote-manifest.json'),manifest);
 const completedGames=config.mode==='all'?Number(summary.random?.games??0)+Number(summary.archetype?.games??0):Number(summary[config.mode]?.games??0);
 const text=`# Remote simulation\n\nStage: **${config.analysisLevel}**; status: **${reason}**; baseline games: **${completedGames}/${request.contract.plannedGames}**.\n\nCommit: \`${context.sha}\`; inputFingerprint: \`${INPUT_FINGERPRINT}\`.\n\nCPU: ${config.cpuStrategy}; ${config.search}/${config.candidates}; workers: ${config.workers}; WAR workers: ${config.warWorkers}.\n\n${JSON.stringify(report.performance,null,2)}\n\nArtifacts expire after ${config.retentionDays} days. Upload is a separate workflow step; no remote upload has been verified by this script.\n`;
 writeFileSync(join(out,'REMOTE_RUN.md'),text);
 // REMOTE_RUN is included in checksums too; manifest itself is excluded to avoid a self hash.
 manifest.files=fileHashes(out);json(join(out,'remote-manifest.json'),manifest);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
 if(!complete)console.log('::warning::Simulation is incomplete. Resume from this run artifact with matching conditions.');
 if(code)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const command=process.argv[2];try{if(command==='prepare')prepare();else if(command==='run')await run();else throw new Error('Use prepare / run');}catch(error){console.error(String(error));process.exitCode=1;}
}
