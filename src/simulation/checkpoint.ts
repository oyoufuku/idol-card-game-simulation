import { GAME_RULE_VERSION } from '../game/engine';
import { readFileSync } from 'node:fs';
import { assertFinite, type MatchSpec, type MatchResult, type MatchOptions } from './match';
import { INPUT_FINGERPRINT } from './input-fingerprint';
import { cpuSearchConfiguration } from '../game/cpu-search';

// Validate the entire saved input before appending anything to it.
export function loadCheckpoint(path:string,specs:MatchSpec[],options:MatchOptions={}):Map<number,MatchResult>{
 const saved=new Map<number,MatchResult>();
 for(const line of readFileSync(path,'utf8').split('\n').filter(Boolean)){
  const entry=JSON.parse(line);
  const expectedSearch=cpuSearchConfiguration(options.cpuSearch??(specs[entry.index]?.cpuStrategies?.includes('burst')?{mode:'two-stage',previewCandidates:100}:{}));
  if(entry.result?.ruleVersion!==GAME_RULE_VERSION)throw new Error('checkpoint は旧BURSTルールです。別の --out で新規実行してください');
  if(entry.result?.inputFingerprint!==INPUT_FINGERPRINT)throw new Error('checkpoint は古いカード・楽曲データです。--overwrite または別の --out で新規実行してください');
  if(!!entry.result.fastSimulation!==!!options.fastSimulation)throw new Error('checkpoint の --fast-simulation 記録設定が一致しません。同じ設定で再開してください');
  const stored=entry.result.cpuSearch??cpuSearchConfiguration();
  if(stored.mode!==expectedSearch.mode||(stored.mode==='two-stage'&&stored.previewCandidates!==expectedSearch.previewCandidates))throw new Error('checkpoint のCPU探索方式・候補数が一致しません。同じ設定で再開してください');
  if(stored.mode==='two-stage'&&stored.policy!==expectedSearch.policy)throw new Error('checkpoint のCPU探索policyは旧実装です。--overwrite または別の --out で新規実行してください');
  if(!Number.isInteger(entry.index)||!specs[entry.index]||JSON.stringify(entry.result?.spec)!==JSON.stringify(specs[entry.index]))throw new Error('checkpoint と実行条件が一致しません');
  if(entry.result.rounds!==7)throw new Error('checkpoint のラウンド数が不正です');
  assertFinite(entry.result);
  if(saved.has(entry.index))throw new Error('checkpoint の試合番号が重複しています');
  saved.set(entry.index,entry.result);
 }
 return saved;
}
