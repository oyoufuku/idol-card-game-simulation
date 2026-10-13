import {spawnSync} from 'node:child_process';
import {expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,existsSync,cpSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseInputs,contract,cliArgs,fileHashes,validateResume,repairInterruptedTail,repairInterruptedSummary,restoredArtifactRoot,performanceReport,executeCli} from '../../scripts/actions-simulation';
const context={sha:'a'.repeat(40),repository:'oyoufuku/idol-card-game',runId:'123',attempt:'1'};
function fixture(dir:string,attempt='1'){
 const expected=contract(parseInputs({}),context);writeFileSync(join(dir,'archetype-checkpoint.jsonl'),'{"index":0}\n');
 writeFileSync(join(dir,'remote-manifest.json'),JSON.stringify({schemaVersion:1,repository:context.repository,latestRunId:context.runId,contract:expected,lineage:[{runId:'123',attempt}],files:fileHashes(dir)}));return expected;
}
it('入力はpresetと混合CPUを正規化し、少数試合・同一探索設定を既定にする',()=>{
 const c=parseInputs({},2);expect(c).toMatchObject({cpuStrategy:'burst-charge-archetype',selection:'balanced',workers:2,maxNewMatches:2,search:'two-stage',candidates:100,retentionDays:7});
 expect(parseInputs({scenario:'A'})).toMatchObject({selection:'legacy',cpuStrategy:'normal'});
 expect(parseInputs({scenario:'B'})).toMatchObject({selection:'balanced',cpuStrategy:'normal'});
 expect(parseInputs({scenario:'C',cpu_strategy:'normal'})).toMatchObject({selection:'balanced',cpuStrategy:'burst-charge-archetype'});
 expect(parseInputs({workers:1,fast_simulation:'false'})).toMatchObject({workers:1,fast:false});
});
it('不正引数・shell injection・上限超過はCLI起動前に拒否する',()=>{
 for(const input of [{seed:'1; rm -rf /'},{workers:16},{random_matches:0},{matches_per_matchup:3},{runtime_minutes:360},{retention_days:91},{resume_run_id:'123\nTOKEN=x'},{cpu_strategy:'evil'},{fast_simulation:'yes'},{preview_candidates:150},{scenario:'A',mode:'random'},{unknown:'x'}])expect(()=>parseInputs(input,4)).toThrow();
});
it('0=全未完了とcheckpoint集計だけの0試合を区別する',()=>{
 const c=parseInputs({max_new_matches:0});expect(cliArgs(c,'out')).not.toContain('--max-new-matches');expect(cliArgs(c,'out',true)).not.toContain('--max-new-matches');
 expect(cliArgs(c,'out',true,0,true).slice(-2)).toEqual(['--max-new-matches','0']);
 expect(cliArgs(parseInputs({max_new_matches:2}),'out',true).slice(-2)).toEqual(['--max-new-matches','2']);
});
it('契約は実予定対戦をhashし、worker/時間/予算の変更を許すがゲーム条件を分離する',()=>{
 const config=parseInputs({});const original=contract(config,context);
 expect(original).toMatchObject({plannedGames:90,cpuStrategy:'burst-charge-archetype'});
 expect(contract({...config,workers:1,minutes:10,maxNewMatches:100,retentionDays:3},context)).toEqual(original);
 for(const change of [{seed:2},{selection:'legacy' as const},{cpuStrategy:'normal' as const},{matchesPerMatchup:10},{fast:false},{search:'exhaustive' as const},{candidates:200}])expect(contract({...config,...change},context)).not.toEqual(original);
 expect(contract(config,{...context,sha:'b'.repeat(40)})).not.toEqual(original);
});
it('resumeはcommit/seed/予定/ファイルchecksumを検証し、失敗時に保存ファイルを書き換えない',()=>{
 const dir=mkdtempSync(join(tmpdir(),'actions-resume-'));try{
  const expected=fixture(dir),before=readFileSync(join(dir,'archetype-checkpoint.jsonl'),'utf8');
  expect(validateResume(dir,expected,{...context,runId:'456'},'123').latestRunId).toBe('123');
  for(const wrong of [{...expected,commitSha:'b'.repeat(40)},{...expected,inputFingerprint:'old'},{...expected,seed:2},{...expected,planHash:'old'}])expect(()=>validateResume(dir,wrong,context,'123')).toThrow('mismatch');
  expect(()=>validateResume(dir,expected,context,'456')).toThrow('mismatch');
  writeFileSync(join(dir,'archetype-checkpoint.jsonl'),before+'{}\n');expect(()=>validateResume(dir,expected,context,'123')).toThrow('checksum');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('artifactのsymlinkと追加/欠落ファイルを拒否する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'actions-files-'));try{
  const expected=fixture(dir);writeFileSync(join(dir,'extra.json'),'{}');expect(()=>validateResume(dir,expected,context,'123')).toThrow('file list');
  rmSync(join(dir,'extra.json'));symlinkSync(join(dir,'archetype-checkpoint.jsonl'),join(dir,'linked'));expect(()=>fileHashes(dir)).toThrow('Non-regular');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('同じrunの最新attemptを選び、異なるrunや曖昧なattemptを混在させない',()=>{
 const base=mkdtempSync(join(tmpdir(),'actions-artifacts-'));try{
  const a=join(base,'old'),b=join(base,'new');mkdirSync(a);mkdirSync(b);fixture(a,'1');fixture(b,'2');expect(restoredArtifactRoot(base,'123')).toBe(b);
  expect(()=>restoredArtifactRoot(base,'456')).toThrow('mismatch');fixture(a,'2');expect(()=>restoredArtifactRoot(base,'123')).toThrow('Ambiguous');
 }finally{rmSync(base,{recursive:true,force:true});}
});
it('途中終了の末尾レコードだけ退避し、途中の破損や完了した不正行は変更せず拒否する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'actions-tail-')),path=join(dir,'checkpoint.jsonl');try{
  writeFileSync(path,'{"index":0}\n{"index":');expect(repairInterruptedTail(path)).toBe(true);expect(readFileSync(path,'utf8')).toBe('{"index":0}\n');expect(readFileSync(path+'.interrupted-tail.txt','utf8')).toBe('{"index":');
  for(const text of ['bad\n{"index":1}\n','{"index":0}\nbad\n']){writeFileSync(path,text);expect(()=>repairInterruptedTail(path)).toThrow();expect(readFileSync(path,'utf8')).toBe(text);}
  writeFileSync(path,'{"index":0}');expect(repairInterruptedTail(path)).toBe(false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('強制終了で壊れたsummaryを退避し、checkpointから再集計できる状態にする',()=>{
 const dir=mkdtempSync(join(tmpdir(),'actions-summary-')),path=join(dir,'summary.json');try{
  expect(repairInterruptedSummary(path)).toBe(false);
  writeFileSync(path,'{"random":');expect(repairInterruptedSummary(path)).toBe(true);expect(existsSync(path)).toBe(false);expect(readFileSync(path+'.interrupted.txt','utf8')).toBe('{"random":');
  writeFileSync(path,'{"random":{"games":1}}');expect(repairInterruptedSummary(path)).toBe(false);expect(readFileSync(path,'utf8')).toBe('{"random":{"games":1}}');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('時間の推定は同じ並列条件の壁時計平均を使い、0試合を0秒と扱わない',()=>{
 const config=parseInputs({});const report=performanceReport({archetype:{newGames:100,sessionGamesPerMinute:30,effectiveWorkers:2}},300,config);
 expect(report).toMatchObject({averageWallSecondsPerGame:2,estimatedSeconds:{900:1800,2250:4500,5000:10000}});
 expect(performanceReport({},1,config).averageWallSecondsPerGame).toBeNull();expect(performanceReport({},1,config).estimatedSeconds['900']).toBeNull();
});

it('実CLIの少数試合を保存し、Artifact復元から完了済みを再実行せず再開する',()=>{
 const repo=process.cwd(),base=mkdtempSync(join(tmpdir(),'actions-cli-')),script=join(repo,'scripts/actions-simulation.ts');
 const sha=spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).stdout.trim();
 const setup=(name:string)=>{const dir=join(base,name);mkdirSync(dir);for(const entry of ['.git','node_modules','src','docs'])symlinkSync(join(repo,entry),join(dir,entry),'dir');return dir;};
 const invoke=(dir:string,phase:string,runId:string,inputs:Record<string,unknown>)=>spawnSync(process.execPath,['--import','tsx',script,phase],{cwd:dir,encoding:'utf8',timeout:30000,env:{...process.env,GITHUB_SHA:sha,GITHUB_REPOSITORY:'oyoufuku/idol-card-game',GITHUB_RUN_ID:runId,GITHUB_RUN_ATTEMPT:'1',SIMULATION_INPUTS:JSON.stringify(inputs)}});
 const inputs={mode:'random',cpu_strategy:'normal',random_matches:2,workers:1,max_new_matches:1};
 try{
  const first=setup('first');expect(invoke(first,'prepare','123',inputs).status).toBe(0);
  const result=invoke(first,'run','123',inputs);expect(result.status,result.stderr).toBe(0);
  const out=join(first,'simulation-results/remote');const saved=readFileSync(join(out,'random-checkpoint.jsonl'),'utf8');
  for(const name of ['summary.json','analysis.xlsx','analysis_bundle.json','CHAT_ANALYSIS.md','remote-manifest.json','remote-status.json'])expect(existsSync(join(out,name))).toBe(true);
  expect(JSON.parse(readFileSync(join(out,'summary.json'),'utf8')).random).toMatchObject({games:1,complete:false,newGames:1});
  const second=setup('second'),restored=join(second,'simulation-results/restored/old-artifact');mkdirSync(restored,{recursive:true});cpSync(out,restored,{recursive:true});
  const resumedInputs={...inputs,max_new_matches:0,resume_run_id:'123'};expect(invoke(second,'prepare','456',resumedInputs).status).toBe(0);
  const resumed=invoke(second,'run','456',resumedInputs);expect(resumed.status,resumed.stderr).toBe(0);
  const resumedOut=join(second,'simulation-results/remote'),summary=JSON.parse(readFileSync(join(resumedOut,'summary.json'),'utf8'));
  expect(summary.random).toMatchObject({games:2,complete:true,resumedGames:1,newGames:1});
  expect(existsSync(join(resumedOut,'run-123-1.json'))).toBe(true);expect(existsSync(join(resumedOut,'run-456-1.json'))).toBe(true);
  expect(readFileSync(join(resumedOut,'random-checkpoint.jsonl'),'utf8').startsWith(saved)).toBe(true);
  const third=setup('mismatch'),thirdRestored=join(third,'simulation-results/restored/artifact');mkdirSync(thirdRestored,{recursive:true});cpSync(out,thirdRestored,{recursive:true});
  expect(invoke(third,'prepare','789',{...inputs,resume_run_id:'123',seed:2}).status).toBe(0);
  expect(invoke(third,'run','789',{...inputs,resume_run_id:'123',seed:2}).status).not.toBe(0);
  expect(readFileSync(join(thirdRestored,'random-checkpoint.jsonl'),'utf8')).toBe(saved);expect(existsSync(join(third,'simulation-results/remote'))).toBe(false);
 }finally{rmSync(base,{recursive:true,force:true});}
},40000);

it('時間予算でCLIを停止し、対戦を追加しないgenerate-only検証を使う',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'actions-stop-'));try{
  let reason='';const result=await executeCli(['--mode','random','--generate-only','--out',join(dir,'out')],join(dir,'run.log'),1,r=>{reason=r;});
  expect(result.stopped).toBe(true);expect(reason).toBe('time-budget');expect(existsSync(join(dir,'out/random-checkpoint.jsonl'))).toBe(false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
