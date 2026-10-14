import {appendFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseInputs,type Context} from './actions-simulation';

type Status={state:string;complete:boolean;exitCode:number;context:Context};
export function continuationInputs(raw:Record<string,unknown>,status:Status,context:Context){
 const config=parseInputs(raw);
 if(!config.continueToLevel2)return null;
 if(status.context.repository!==context.repository||status.context.runId!==context.runId||status.context.sha!==context.sha)throw new Error('Continuation status belongs to a different run');
 if(status.state!=='completed'||status.complete!==true||status.exitCode!==0)return null;
 const next=config.analysisLevel==='baseline'?'level1':config.analysisLevel==='level1'?'level2':null;
 if(!next)return null;
 // Preserve all game/CPU/sampling inputs, change only stage and artifact source.
 return {...raw,analysis_level:next,resume_run_id:context.runId,resume_compatible_commit:'',continue_to_level2:true,war_detail_ids:'',war_pairs:''};
}
export function continuationTitle(inputs:Record<string,unknown>){
 return `Simulation ${inputs.analysis_level} / ${inputs.scenario??'CUSTOM'} / ${inputs.mode??'archetype'} / seed ${inputs.seed??1} / parent ${inputs.resume_run_id??''}`;
}
export async function dispatchContinuation(raw:Record<string,unknown>,status:Status,context:Context,ref:string,token:string,request:typeof fetch=fetch){
 const inputs=continuationInputs(raw,status,context);if(!inputs)return {state:'stopped',reason:'Stage incomplete, disabled, or LEVEL 2 reached; no automatic LEVEL 3'};
 if(!/^[-\w.]+\/[-\w.]+$/.test(context.repository)||!ref||!token)throw new Error('Missing dispatch context or GitHub authentication');
 const base=`https://api.github.com/repos/${context.repository}`;
 const api=async(path:string,method='GET',body?:unknown)=>{
  const response=await request(base+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`GitHub continuation API failed (${method}, HTTP ${response.status})`);
  return response.status===204?null:await response.json();
 };
 // An immutable tag is recommended. Even on a branch, fail if it moved since checkout.
 const head=await api(`/commits/${encodeURIComponent(ref)}`);
 if(head.sha!==context.sha)throw new Error('Continuation stopped: dispatch ref changed; use a pinned tag');
 const title=continuationTitle(inputs);
 const previous=await api('/actions/workflows/simulate.yml/runs?event=workflow_dispatch&per_page=100');
 const duplicate=previous.workflow_runs?.find((run:{display_title:string;head_sha:string})=>run.display_title===title&&run.head_sha===context.sha);
 if(duplicate)return {state:'already-dispatched',runId:duplicate.id,url:duplicate.html_url};
 // REST workflow_dispatch accepts string values; parallel defaults include numbers.
 // Normalize only the wire payload so the typed simulation contract stays unchanged.
 const apiInputs=Object.fromEntries(Object.entries(inputs).map(([key,value])=>[key,String(value)]));
 await api('/actions/workflows/simulate.yml/dispatches','POST',{ref,inputs:apiInputs});
 return {state:'dispatched',analysisLevel:inputs.analysis_level,parentRunId:context.runId,ref,sha:context.sha};
}
async function main(){
 const status=JSON.parse(readFileSync('simulation-results/remote/remote-status.json','utf8')) as Status;
 const context={repository:process.env.GITHUB_REPOSITORY??'',runId:process.env.GITHUB_RUN_ID??'',sha:process.env.GITHUB_SHA??'',attempt:process.env.GITHUB_RUN_ATTEMPT??'1'};
 const result=await dispatchContinuation(JSON.parse(process.env.SIMULATION_INPUTS??'{}'),status,context,process.env.GITHUB_REF_NAME??'',process.env.GITHUB_TOKEN??'');
 const text=`\nAutomatic continuation: ${JSON.stringify(result)}\n`;console.log(text);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await main();}catch(error){console.error(String(error));process.exitCode=1;}
