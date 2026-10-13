import { parentPort,workerData } from 'node:worker_threads';
import { runMatch,type MatchSpec } from './match';
parentPort!.on('message',(spec:MatchSpec)=>{try{parentPort!.postMessage({result:runMatch(spec,workerData)});}catch(error){parentPort!.postMessage({error:String(error),stack:(error as Error).stack,spec});}});
