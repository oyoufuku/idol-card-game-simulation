import { INPUT_FINGERPRINT } from '../simulation/input-fingerprint';
import { GAME_RULE_VERSION } from '../game/engine';
import { expect,it } from 'vitest';
import { mkdtempSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync,strFromU8 } from 'fflate';
import { loadCheckpoint } from '../simulation/checkpoint';
import { archetypeSchedule } from '../simulation/schedule';
import { createGame } from '../game/engine';
import { randomSchedule } from '../simulation/schedule';
import { parseCsv } from '../simulation/analysis-export';
import { TWO_STAGE_POLICY } from '../game/cpu-search';

const archive=unzipSync(readFileSync('docs/simulation/interim/checkpoints.zip'));
const legacyRecord=strFromU8(archive['archetype-checkpoint.jsonl']).split('\n')[0];
// A current-format synthetic record for file validation, not a balance result.
const spec=archetypeSchedule(1,10)[0],g=createGame(spec.a.members,spec.b.members,spec.a.songs,spec.b.songs,'local',()=>.5);
for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].stats.positions.BACK=7;
const entry={index:0,result:{ruleVersion:GAME_RULE_VERSION,inputFingerprint:INPUT_FINGERPRINT,spec,winner:'draw',rounds:7,pointsA:0,pointsB:0,appealA:0,appealB:0,burstA:0,burstB:0,forcedBurstA:0,forcedBurstB:0,players:[g.p1,g.p2],songs:[],roundAppeals:[],formations:[]}};
const record=JSON.stringify(entry);
const cli=(out:string,...args:string[])=>spawnSync(process.execPath,['--import','tsx','src/simulation/cli.ts','--mode','archetype','--out',out,...args],{encoding:'utf8',timeout:20000});
it('checkpointのseed/編成/mirror不一致・重複・破損を拒否する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'checkpoint-')),path=join(dir,'checkpoint.jsonl');
 try{
  const specs=archetypeSchedule(1,10);
  writeFileSync(path,legacyRecord);expect(()=>loadCheckpoint(path,specs)).toThrow('旧BURST');
  writeFileSync(path,JSON.stringify({...entry,result:{...entry.result,inputFingerprint:'old'}}));expect(()=>loadCheckpoint(path,specs)).toThrow('古いカード');
  writeFileSync(path,record+'\n');expect(loadCheckpoint(path,specs).size).toBe(1);
  expect(()=>loadCheckpoint(path,archetypeSchedule(2,10))).toThrow();
  writeFileSync(path,record+'\n'+record+'\n');expect(()=>loadCheckpoint(path,specs)).toThrow('重複');
  writeFileSync(path,record+'\n{"index":');expect(()=>loadCheckpoint(path,specs)).toThrow();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('resumeの0試合制限は既存試合だけを集計し、未完了を明示する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'resume-cli-')),path=join(dir,'archetype-checkpoint.jsonl');
 try{
  writeFileSync(path,record);
  const run=cli(dir,'--resume','--max-new-matches','0');expect(run.status,run.stderr).toBe(0);
  expect(readFileSync(path,'utf8')).toBe(record+'\n');
  expect(JSON.parse(readFileSync(join(dir,'summary.json'),'utf8')).archetype).toMatchObject({games:1,plannedGames:450,resumedGames:1,newGames:0,complete:false});
  const definitions=readFileSync(join(dir,'archetype/archetypes.json'),'utf8');
  const mismatch=cli(dir,'--resume','--seed','2','--max-new-matches','0');expect(mismatch.status).not.toBe(0);expect(readFileSync(path,'utf8')).toBe(record+'\n');expect(readFileSync(join(dir,'archetype/archetypes.json'),'utf8')).toBe(definitions);
 }finally{rmSync(dir,{recursive:true,force:true});}
},30000);
it('再開ファイルがない場合は新規大量実行を始めず停止する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'resume-missing-'));
 try{const run=cli(dir,'--resume');expect(run.status).not.toBe(0);expect(run.stderr).toContain('checkpointがありません');}
 finally{rmSync(dir,{recursive:true,force:true});}
});
it('fast checkpointは同設定だけ再開でき、モード不一致では追記しない',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fast-resume-')),path=join(dir,'archetype-checkpoint.jsonl'),fastRecord=JSON.stringify({...entry,result:{...entry.result,fastSimulation:true}})+'\n';
 try{
  writeFileSync(path,fastRecord);expect(()=>loadCheckpoint(path,archetypeSchedule(1,10))).toThrow('fast-simulation');
  expect(loadCheckpoint(path,archetypeSchedule(1,10),{fastSimulation:true}).size).toBe(1);
  const run=cli(dir,'--resume','--max-new-matches','0','--fast-simulation');expect(run.status,run.stderr).toBe(0);
  const summary=JSON.parse(readFileSync(join(dir,'summary.json'),'utf8'));expect(summary.configuration.fastSimulation).toBe(true);expect(summary.chargeTelemetryAvailable).toBe(false);
  expect(parseCsv(readFileSync(join(dir,'archetype/charge_idol_stats.csv'),'utf8'))).toEqual([]);
  expect(parseCsv(readFileSync(join(dir,'archetype/cpu_strategy_stats.csv'),'utf8'))).toMatchObject([{cpuStrategy:'normal',games:'2'}]);
  expect(readFileSync(path,'utf8')).toBe(fastRecord);
 }finally{rmSync(dir,{recursive:true,force:true});}
},30000);
it('fastのworker実行で7ラウンドを保存し、追加0戦の再開とExcel出力が動く',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fast-worker-'));
 const run=(...args:string[])=>spawnSync(process.execPath,['--import','tsx','src/simulation/cli.ts','--mode','random','--random-matches','1','--seed','876','--workers','2','--fast-simulation','--cpu-search','two-stage','--preview-candidates','100','--out',dir,...args],{encoding:'utf8',timeout:45000});
 try{
  const started=run();expect(started.status,started.stderr).toBe(0);
  expect(started.stdout).toContain('workers=2');expect(started.stdout).toContain('games/min');
  const timing=JSON.parse(readFileSync(join(dir,'random-timing.json'),'utf8'));
  expect(timing).toMatchObject({sessionNewGames:1,effectiveWorkers:1});expect(timing.sessionGamesPerMinute).toBeGreaterThan(0);expect(timing.rssMiB).toBeGreaterThan(0);
  const checkpoint=readFileSync(join(dir,'random-checkpoint.jsonl'),'utf8'),saved=JSON.parse(checkpoint.trim()).result;
  expect(saved).toMatchObject({rounds:7,fastSimulation:true,spec:randomSchedule(876,1)[0]});expect(saved.chargeTrace).toBeUndefined();
  expect(saved.cpuSearch).toMatchObject({mode:'two-stage',previewCandidates:100});
  expect(parseCsv(readFileSync(join(dir,'random/matches.csv'),'utf8'))[0]).toMatchObject({cpuSearch:'two-stage',previewCandidates:'100',cpuSearchPolicy:TWO_STAGE_POLICY});
  const resumed=run('--resume','--max-new-matches','0');expect(resumed.status,resumed.stderr).toBe(0);expect(readFileSync(join(dir,'random-checkpoint.jsonl'),'utf8')).toBe(checkpoint);
  expect(JSON.parse(readFileSync(join(dir,'summary.json'),'utf8')).random).toMatchObject({games:1,resumedGames:1,newGames:0});
  expect(unzipSync(readFileSync(join(dir,'analysis.xlsx')))['xl/workbook.xml']).toBeDefined();
 }finally{rmSync(dir,{recursive:true,force:true});}
},60000);
it('二段階checkpointは探索方式・候補数・policyが同じ時だけ再開する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'search-resume-')),path=join(dir,'checkpoint.jsonl'),cpuSearch={mode:'two-stage' as const,previewCandidates:200,policy:TWO_STAGE_POLICY};
 try{
  writeFileSync(path,JSON.stringify({...entry,result:{...entry.result,cpuSearch}})+'\n');const contents=readFileSync(path,'utf8'),specs=archetypeSchedule(1,10);
  expect(loadCheckpoint(path,specs,{cpuSearch}).size).toBe(1);expect(()=>loadCheckpoint(path,specs)).toThrow('探索方式');
  expect(()=>loadCheckpoint(path,specs,{cpuSearch:{...cpuSearch,previewCandidates:100}})).toThrow('候補数');
  expect(readFileSync(path,'utf8')).toBe(contents);
  writeFileSync(path,JSON.stringify({...entry,result:{...entry.result,cpuSearch:{...cpuSearch,policy:'two-stage-v1'}}})+'\n');
  const old=readFileSync(path,'utf8');expect(()=>loadCheckpoint(path,specs,{cpuSearch})).toThrow('policy');
  expect(readFileSync(path,'utf8')).toBe(old);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

it('CLIは混合CPUを受け付け、generate-onlyで設定を保存し対戦しない',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mixed-cpu-cli-'));
 try{const result=cli(dir,'--generate-only','--cpu-strategy','burst-charge-archetype');expect(result.status,result.stderr).toBe(0);
  const summary=JSON.parse(readFileSync(join(dir,'summary.json'),'utf8'));expect(summary.cpuStrategy).toBe('burst-charge-archetype');expect(summary.generatedTeams).toBe(27);
  expect(summary.configuration.cpuSearch).toMatchObject({mode:'two-stage',previewCandidates:100});expect(summary.configuration.chargePolicy).toBeTruthy();expect(summary.configuration.burstPolicy).toBeTruthy();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
