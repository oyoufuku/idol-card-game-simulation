import { mkdirSync,existsSync,readFileSync,writeFileSync,appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { runMatch } from './match';
import { hash,type WarPlan,type WarJob } from './war-plan';
export { compactWarResult,validateWarResult,type WarResult } from './war-result';
import { compactWarResult,validateWarResult,type WarResult } from './war-result';
export function runWarJob(job:WarJob) {return compactWarResult(runMatch(job.spec,job.options));}
export async function executeWarPlan(plan:WarPlan,out:string,options:{workers:number;resume:boolean;maxNewJobs:number;stopped?:()=>boolean;reusePaths?:string[];progress?:(completed:number,total:number)=>void}) {
 mkdirSync(out,{recursive:true});
 const manifest=join(out,'plan.json'),checkpoint=join(out,'checkpoint.jsonl'),planHash=hash(plan),results=new Map<string,WarResult>();
 // Validate everything before appending. The manifest covers data, baseline,
 // sample selection, CPU options, masks, mirror, replacement and bootstrap seed.
 if(existsSync(manifest)){
  if(!options.resume)throw new Error('WAR output exists: use --war-resume or a different --war-out');
  if(hash(JSON.parse(readFileSync(manifest,'utf8')))!==planHash)throw new Error('WAR plan mismatch: do not mix fingerprint/seed/baseline/CPU/sampling settings');
  const legal=new Set(plan.jobs.map(j=>j.key));
  if(existsSync(checkpoint))for(const line of readFileSync(checkpoint,'utf8').split('\n').filter(Boolean)){
   const entry=JSON.parse(line);if(entry.planHash!==planHash||!legal.has(entry.key)||results.has(entry.key)||entry.resultHash!==hash(entry.result))throw new Error('Invalid/duplicate WAR checkpoint record');
   validateWarResult(entry.result);results.set(entry.key,entry.result);
  }
 }else{writeFileSync(manifest,JSON.stringify(plan,null,2)+'\n');writeFileSync(checkpoint,'');}
 if(existsSync(checkpoint)){const contents=readFileSync(checkpoint,'utf8');if(contents&&!contents.endsWith('\n'))appendFileSync(checkpoint,'\n');}
 const save=(job:WarJob,result:WarResult)=>{validateWarResult(result);appendFileSync(checkpoint,JSON.stringify({planHash,key:job.key,result,resultHash:hash(result)})+'\n');results.set(job.key,result);options.progress?.(results.size,plan.jobs.length);};
 const reusable=new Map<string,WarResult>(),legalJobs=new Set(plan.jobs.map(j=>j.key));
 for(const path of options.reusePaths||[]){
  if(path===out||!existsSync(join(path,'plan.json')))continue;
  const sourcePlan:WarPlan=JSON.parse(readFileSync(join(path,'plan.json'),'utf8'));
  if(sourcePlan.fingerprint!==plan.fingerprint||sourcePlan.policy!==plan.policy||sourcePlan.baselineHash!==plan.baselineHash)continue;
  const sourceHash=hash(sourcePlan),sourceKeys=new Set(sourcePlan.jobs.map(j=>j.key)),seen=new Set<string>();
  if(existsSync(join(path,'checkpoint.jsonl')))for(const line of readFileSync(join(path,'checkpoint.jsonl'),'utf8').split('\n').filter(Boolean)){
   const entry=JSON.parse(line);if(entry.planHash!==sourceHash||entry.resultHash!==hash(entry.result)||!sourceKeys.has(entry.key)||seen.has(entry.key))throw new Error('Invalid reusable WAR checkpoint');
   seen.add(entry.key);validateWarResult(entry.result);
   if(legalJobs.has(entry.key)){
    const existing=results.get(entry.key)??reusable.get(entry.key);if(existing&&hash(existing)!==hash(entry.result))throw new Error('Conflicting WAR results for identical job');
    reusable.set(entry.key,entry.result);
   }
  }
 }
 for(const job of plan.jobs)if(!results.has(job.key)&&reusable.has(job.key))save(job,reusable.get(job.key)!);
 const pending=plan.jobs.filter(j=>!results.has(j.key)).slice(0,options.maxNewJobs);
 if(options.workers<=1){for(const job of pending){if(options.stopped?.())break;save(job,runWarJob(job));await new Promise<void>(resolve=>setImmediate(resolve));}}
 else{
  let next=0;const pool:Worker[]=[];
  try{await Promise.all(Array.from({length:Math.min(options.workers,pending.length)},()=>new Promise<void>((done,reject)=>{
   const worker=new Worker(new URL('./war-worker.ts',import.meta.url),{execArgv:['--import','tsx']});pool.push(worker);let current:WarJob;
   const dispatch=()=>{const job=pending[next++];if(!job||options.stopped?.()){void worker.terminate();done();}else{current=job;worker.postMessage(job);}};
   worker.on('message',message=>{try{if(message.error)throw new Error(message.error);if(message.key!==current.key)throw new Error('WAR worker job mismatch');save(current,message.result);dispatch();}catch(error){reject(error);}});worker.on('error',reject);worker.on('exit',code=>{if(code!==0&&current&&!results.has(current.key))reject(new Error(`WAR worker exited ${code}`));});dispatch();
  })));}finally{await Promise.all(pool.map(w=>w.terminate()));}
 }
 return results;
}
