import {expect,it,vi} from 'vitest';
import {continuationInputs,continuationTitle,dispatchContinuation} from '../../scripts/actions-chain';
const context={repository:'oyoufuku/idol-card-game-simulation',sha:'a'.repeat(40),runId:'123',attempt:'1'};
const status={state:'completed',complete:true,exitCode:0,context};
const baseline={mode:'all',scenario:'CUSTOM',archetype_selection:'constructed',cpu_strategy:'charge-archetype',seed:1,matches_per_matchup:50,random_matches:1000,max_new_matches:0,continue_to_level2:true,resume_run_id:'100',resume_compatible_commit:'b'.repeat(40)};
it('baseline→L1→L2は同じCPU・seed・構築・標本数を継承しL3を自動実行しない',()=>{
 const l1=continuationInputs(baseline,status,context)!;expect(l1).toEqual({...baseline,analysis_level:'level1',resume_run_id:'123',resume_compatible_commit:'',war_detail_ids:'',war_pairs:''});
 const l2=continuationInputs(l1,status,context)!;expect(l2.analysis_level).toBe('level2');expect(continuationInputs(l2,status,context)).toBeNull();
});
it('未完了・失敗・明示OFFから次段階を起動せず、別runのstatusも受け付けない',()=>{
 for(const change of [{complete:false},{state:'failed',exitCode:1},{state:'time-budget'},{state:'partial'}])expect(continuationInputs(baseline,{...status,...change},context)).toBeNull();
 expect(continuationInputs({...baseline,continue_to_level2:false},status,context)).toBeNull();
 expect(()=>continuationInputs(baseline,status,{...context,runId:'456'})).toThrow('different run');
});
it('同一ref/commitを確認してworkflow_dispatchし、APIへトークンを渡すが結果に含めない',async()=>{
 const request=vi.fn().mockResolvedValueOnce(Response.json({sha:context.sha})).mockResolvedValueOnce(Response.json({workflow_runs:[]})).mockResolvedValueOnce(new Response(null,{status:204}));
 const result=await dispatchContinuation(baseline,status,context,'pinned-tag','test-token',request);
 expect(result).toMatchObject({state:'dispatched',analysisLevel:'level1',sha:context.sha});expect(JSON.stringify(result)).not.toContain('test-token');
 const [url,options]=request.mock.calls[2];expect(url).toBe(`https://api.github.com/repos/${context.repository}/actions/workflows/simulate.yml/dispatches`);expect(options.method).toBe('POST');expect(options.headers.Authorization).toBe('Bearer test-token');
 const body=JSON.parse(options.body);expect(body.ref).toBe('pinned-tag');expect(body.inputs).toMatchObject({cpu_strategy:'charge-archetype',archetype_selection:'constructed',resume_run_id:'123'});
});
it('ref更新・API拒否では起動せず、同じ親runで起動済みなら重複dispatchしない',async()=>{
 const moved=vi.fn().mockResolvedValue(Response.json({sha:'c'.repeat(40)}));await expect(dispatchContinuation(baseline,status,context,'main','token',moved)).rejects.toThrow('ref changed');expect(moved).toHaveBeenCalledTimes(1);
 const denied=vi.fn().mockResolvedValue(new Response(null,{status:403}));await expect(dispatchContinuation(baseline,status,context,'main','secret',denied)).rejects.toThrow('HTTP 403');
 const duplicate=vi.fn().mockResolvedValueOnce(Response.json({sha:context.sha})).mockResolvedValueOnce(Response.json({workflow_runs:[{display_title:continuationTitle(continuationInputs(baseline,status,context)!),head_sha:context.sha,id:456,html_url:'https://github.com/run/456'}]}));
 expect(await dispatchContinuation(baseline,status,context,'tag','token',duplicate)).toMatchObject({state:'already-dispatched',runId:456});expect(duplicate).toHaveBeenCalledTimes(2);
});
