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
 scenario:'CUSTOM'|'A'|'B'|'C';mode:'random'|'archetype';selection:'legacy'|'balanced';cpuStrategy:StrategySelection;
 matchesPerMatchup:number;randomMatches:number;seed:number;workers:number;fast:boolean;search:'exhaustive'|'two-stage';
 candidates:number;maxNewMatches:number;minutes:number;retentionDays:number;resumeRunId:string;
}
export interface Context {sha:string;repository:string;runId:string;attempt:string}
const keys=['scenario','mode','archetype_selection','cpu_strategy','matches_per_matchup','random_matches','seed','workers','fast_simulation','cpu_search','preview_candidates','max_new_matches','runtime_minutes','retention_days','resume_run_id'];
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
 const mode=choice(raw.mode,'archetype',['random','archetype'],'mode');
 if(scenario!=='CUSTOM'&&mode!=='archetype')throw new Error('A/B/C are ARCHETYPE comparisons; choose CUSTOM for RANDOM');
 let selection=choice(raw.archetype_selection,'balanced',['legacy','balanced'],'archetype_selection');
 let cpuStrategy=choice(raw.cpu_strategy,'burst-charge-archetype',['normal','charge-archetype','burst','burst-charge-archetype'] as const,'cpu_strategy');
 if(scenario!=='CUSTOM'){selection=scenario==='A'?'legacy':'balanced';cpuStrategy=scenario==='C'?'burst-charge-archetype':'normal';}
 const matchesPerMatchup=integer(raw.matches_per_matchup,2,2,1000,'matches_per_matchup');if(matchesPerMatchup%2)throw new Error('matches_per_matchup must be even, including mirrors');
 const configuredWorkers=integer(raw.workers,0,0,32,'workers');if(configuredWorkers>cpuCount)throw new Error('workers exceeds available CPUs; use 0 for auto');
 const fast=raw.fast_simulation??true;if(![true,false,'true','false'].includes(fast as boolean|string))throw new Error('Invalid fast_simulation');
 const resumeRunId=String(raw.resume_run_id??'');if(resumeRunId&&!/^\d{1,20}$/.test(resumeRunId))throw new Error('Invalid resume_run_id');
 const candidates=integer(raw.preview_candidates,100,100,300,'preview_candidates');if(![100,200,300].includes(candidates))throw new Error('preview_candidates must be 100/200/300');
 return {scenario,mode,selection,cpuStrategy,matchesPerMatchup,randomMatches:integer(raw.random_matches,1,1,50000,'random_matches'),seed:integer(raw.seed,1,0,4294967295,'seed'),workers:configuredWorkers||Math.min(cpuCount,4),fast:fast===true||fast==='true',search:choice(raw.cpu_search,'two-stage',['exhaustive','two-stage'],'cpu_search'),candidates,maxNewMatches:integer(raw.max_new_matches,2,0,50000,'max_new_matches'),minutes:integer(raw.runtime_minutes,300,1,330,'runtime_minutes'),retentionDays:integer(raw.retention_days,7,1,90,'retention_days'),resumeRunId};
}
export function contract(config:Config,context:Context){
 if(!/^[a-f\d]{40}$/.test(context.sha)||!/^[-\w.]+\/[-\w.]+$/.test(context.repository)||!/^\d+$/.test(context.runId)||!/^\d+$/.test(context.attempt))throw new Error('Invalid GitHub execution context');
 const teams=config.mode==='archetype'?generateArchetypes(config.seed,3,config.selection):[];
 const specs=withStrategies(config.mode==='archetype'?archetypeSchedule(config.seed,config.matchesPerMatchup,teams):randomSchedule(config.seed,config.randomMatches),config.cpuStrategy);
 const hash=createHash('sha256');for(const spec of specs)hash.update(JSON.stringify(spec)+'\n');
 return {commitSha:context.sha,inputFingerprint:INPUT_FINGERPRINT,mode:config.mode,seed:config.seed,cpuStrategy:config.cpuStrategy,selection:config.selection,search:config.search,candidates:config.candidates,fast:config.fast,matches:config.mode==='archetype'?config.matchesPerMatchup:config.randomMatches,plannedGames:specs.length,planHash:hash.digest('hex')};
}
export function cliArgs(config:Config,out:string,resume=false,maxNewMatches=config.maxNewMatches,checkpointOnly=false){
 const args=['--mode',config.mode,'--archetype-selection',config.selection,'--cpu-strategy',config.cpuStrategy,'--matches-per-matchup',String(config.matchesPerMatchup),'--random-matches',String(config.randomMatches),'--seed',String(config.seed),'--workers',String(config.workers),'--cpu-search',config.search,'--preview-candidates',String(config.candidates),'--out',out];
 if(config.fast)args.push('--fast-simulation');if(resume)args.push('--resume');if(checkpointOnly||maxNewMatches>0)args.push('--max-new-matches',String(maxNewMatches));return args;
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
export function validateResume(dir:string,expected:ReturnType<typeof contract>,context:Context,runId:string){
 const prior=JSON.parse(readFileSync(join(dir,'remote-manifest.json'),'utf8'));
 if(prior.schemaVersion!==1||prior.repository!==context.repository||prior.latestRunId!==runId||JSON.stringify(prior.contract)!==JSON.stringify(expected))throw new Error('Resume rejected: commit/inputFingerprint/seed/CPU/construction/search/fast mode/match plan mismatch');
 if(!prior.files||typeof prior.files!=='object'||Array.isArray(prior.files))throw new Error('Resume rejected: missing file hashes');
 const current=fileHashes(dir);if(JSON.stringify(Object.keys(current).sort())!==JSON.stringify(Object.keys(prior.files).sort()))throw new Error('Resume rejected: artifact file list mismatch');
 for(const [path,hash] of Object.entries(prior.files)){
  if(isAbsolute(path)||path.split(/[\\/]/).includes('..')||!/^[a-f\d]{64}$/.test(String(hash))||current[path]!==hash)throw new Error('Resume rejected: artifact checksum mismatch');
 }
 if(!existsSync(join(dir,`${expected.mode}-checkpoint.jsonl`)))throw new Error('Resume rejected: checkpoint not saved');return prior;
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
 const row=summary[config.mode],newGames=Number(row?.newGames??0),sessionSeconds=newGames&&Number(row?.sessionGamesPerMinute)>0?newGames*60/Number(row.sessionGamesPerMinute):elapsedSeconds;
 const perGame=newGames?sessionSeconds/newGames:null;
 return {cpuStrategy:config.cpuStrategy,newGames,sessionSeconds,averageWallSecondsPerGame:perGame,effectiveWorkers:row?.effectiveWorkers??config.workers,sampleStatus:newGames>=100?'100+ games measured':'Small sample; run 100-game benchmark before selecting workers',estimatedSeconds: Object.fromEntries([900,2250,5000].map(n=>[n,perGame===null?null:n*perGame]))};
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
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),name=`simulation-results-${config.mode}-${config.cpuStrategy}-${config.selection}-seed${config.seed}-${stamp}-${context.runId}-${context.attempt}`;
 mkdirSync(resolve(root(),'simulation-results'),{recursive:true});json(requestPath(),{config,context,contract:expected,artifactName:name,hardware:hardware()});
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`resume_run_id=${config.resumeRunId}\nartifact_name=${name}\nretention_days=${config.retentionDays}\n`);
 console.log(JSON.stringify({mode:config.mode,scenario:config.scenario,cpu:config.cpuStrategy,plannedGames:expected.plannedGames,maxNewMatches:config.maxNewMatches,workers:config.workers,hardware:hardware()}));
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
 if(config.resumeRunId){const selected=restoredArtifactRoot(restored,config.resumeRunId),prior=validateResume(selected,request.contract,context,config.resumeRunId);if(existsSync(out))throw new Error('Output already exists');renameSync(selected,out);lineage=prior.lineage??[];}
 else {if(existsSync(out))throw new Error('Output already exists; choose a clean workspace');mkdirSync(out,{recursive:true});}
 let reason='completed',code=0,elapsed=0,aggregateError:string|null=null;
 const log=join(out,`run-${context.runId}-${context.attempt}.log`);
 json(join(out,'remote-running.json'),{startedAt:new Date().toISOString(),config,context,hardware:request.hardware});
 try{
  if(config.resumeRunId)repairInterruptedTail(join(out,`${config.mode}-checkpoint.jsonl`));
  else {const result=await executeCli([...cliArgs(config,out,false,0),'--generate-only'],log,120000);if(result.code)throw new Error('CLI preflight failed');}
  const result=await executeCli(cliArgs(config,out,!!config.resumeRunId),log,config.minutes*60000,r=>{reason=r;});elapsed=result.elapsed;code=result.code;
  if(code&&reason==='completed')reason='failed';
 }catch(error){reason='failed';code=1;aggregateError=String(error);}
 // Only aggregate completed checkpoints; never create extra games during recovery.
 if(existsSync(join(out,`${config.mode}-checkpoint.jsonl`))){
  try{repairInterruptedTail(join(out,`${config.mode}-checkpoint.jsonl`));
   repairInterruptedSummary(join(out,'summary.json'));
   if(code||!existsSync(join(out,'analysis.xlsx'))){const result=await executeCli(cliArgs(config,out,true,0,true),log,600000);if(result.code)throw new Error('Checkpoint-only aggregation failed');}
  }catch(error){aggregateError=String(error);code=1;reason='failed';}
 }
 const summary=existsSync(join(out,'summary.json'))?JSON.parse(readFileSync(join(out,'summary.json'),'utf8')):{};
 const complete=summary[config.mode]?.complete===true;if(!complete&&reason==='completed')reason='partial';
 const report={state:reason,complete,elapsedSeconds:elapsed,exitCode:code,aggregateError,context,hardware:request.hardware,config,performance:performanceReport(summary,elapsed,config)};
 json(join(out,'remote-status.json'),report);
 json(join(out,`run-${context.runId}-${context.attempt}.json`),report);
 const manifest={schemaVersion:1,repository:context.repository,latestRunId:context.runId,contract:request.contract,lineage:[...lineage,{runId:context.runId,attempt:context.attempt,state:reason}],files:fileHashes(out)};
 json(join(out,'remote-manifest.json'),manifest);
 const text=`# Remote simulation\n\nStatus: **${reason}**; completed games: **${summary[config.mode]?.games??0}/${request.contract.plannedGames}**.\n\nCommit: \`${context.sha}\`; inputFingerprint: \`${INPUT_FINGERPRINT}\`.\n\nCPU: ${config.cpuStrategy}; ${config.search}/${config.candidates}; workers: ${config.workers}.\n\n${JSON.stringify(report.performance,null,2)}\n\nArtifacts expire after ${config.retentionDays} days. Upload is a separate workflow step; no remote upload has been verified by this script.\n`;
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
