import { parentPort } from 'node:worker_threads';
import { runWarJob } from './war-runner';
import type { WarJob } from './war-plan';
parentPort!.on('message',(job:WarJob)=>{try{parentPort!.postMessage({key:job.key,result:runWarJob(job)});}catch(error){parentPort!.postMessage({key:job.key,error:(error as Error).stack||String(error)});}});
