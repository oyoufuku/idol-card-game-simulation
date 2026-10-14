import {expect,it} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parallelInputs,validateParallelPart} from '../../scripts/actions-parallel';
import {parseInputs,contract,warCliArgs} from '../../scripts/actions-simulation';
import {randomSchedule} from '../simulation/schedule';
import {warScope} from '../simulation/war-scope';
import {constructedTeams} from '../simulation/constructed-teams';
import {GAME_RULE_VERSION} from '../game/engine';
import {INPUT_FINGERPRINT} from '../simulation/input-fingerprint';
import type {MatchResult} from '../simulation/match';
const context={sha:'a'.repeat(40),repository:'oyoufuku/idol-card-game-simulation',runId:'123',attempt:'1'};
it('並行実行は12固定デッキ3900戦＋RANDOM1000戦を同一CPU・seedで計画する',()=>{
 const config=parseInputs(parallelInputs({})),expected=contract(config,context);
 expect(config).toMatchObject({mode:'all',selection:'constructed',cpuStrategy:'charge-archetype',fast:true,search:'two-stage',candidates:100,randomMatches:1000,matchesPerMatchup:50,continueToLevel2:true});expect(expected.plannedGames).toBe(4900);
 expect(()=>parallelInputs({cpu_strategy:'burst'})).toThrow('Unknown');
 for(const analysisLevel of ['level1','level2','level3'] as const)expect(warCliArgs({...config,analysisLevel},'out')).toContain('--war-exclude-selection-decks');
});
it('統合前に両パートの契約・完了数・旧カード・破損を検証し、原本は書き換えない',()=>{
 const dir=mkdtempSync(join(tmpdir(),'parallel-')),expected=contract(parseInputs(parallelInputs({})),context),specs=randomSchedule(1,1),path=join(dir,'random-checkpoint.jsonl');
 const row={index:0,result:{spec:specs[0],rounds:7,ruleVersion:GAME_RULE_VERSION,inputFingerprint:INPUT_FINGERPRINT}};
 const marker=(c:unknown=expected)=>writeFileSync(join(dir,'parallel-part.json'),JSON.stringify({mode:'random',contract:c}));
 try{
  marker();writeFileSync(path,JSON.stringify(row)+'\n');expect(()=>validateParallelPart(dir,'random',expected,specs,{})).not.toThrow();
  const before=readFileSync(path,'utf8');marker({...expected,seed:2});expect(()=>validateParallelPart(dir,'random',expected,specs,{})).toThrow('mismatch');expect(readFileSync(path,'utf8')).toBe(before);marker();
  writeFileSync(path,'');expect(()=>validateParallelPart(dir,'random',expected,specs,{})).toThrow('incomplete');expect(()=>validateParallelPart(dir,'random',expected,specs,{},false)).not.toThrow();
  writeFileSync(path,JSON.stringify({...row,result:{...row.result,inputFingerprint:'old'}})+'\n');expect(()=>validateParallelPart(dir,'random',expected,specs,{})).toThrow('古いカード');
  writeFileSync(path,'{broken\n');expect(()=>validateParallelPart(dir,'random',expected,specs,{})).toThrow();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('WARは選抜3デッキを自軍/相手両方から除外し、RANDOMと元の12デッキ結果は維持する',()=>{
 const teams=constructedTeams(),make=(a:number,b:number,mode:'random'|'archetype'='archetype')=>({spec:{a:teams[a],b:teams[b],mode}} as MatchResult);
 const results=[make(0,1),make(0,9),make(10,1),make(10,11),make(10,11,'random')],before=JSON.stringify(results);
 expect(warScope(results,true)).toEqual([results[0],results[4]]);expect(warScope(results,false)).toBe(results);expect(JSON.stringify(results)).toBe(before);
});
