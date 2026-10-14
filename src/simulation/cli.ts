import { buildWarPlan,hash,type WarOptions } from './war-plan';
import { executeWarPlan } from './war-runner';
import { writeWarOutput } from './war-output';
import type { AblationKind } from '../game/analysis-skills';
import { GAME_RULE_VERSION } from '../game/engine';
import { exportAnalysis } from './analysis-export';
import { mkdirSync,appendFileSync,writeFileSync,existsSync,readFileSync } from 'node:fs';
import { resolve,join,relative } from 'node:path';
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { availableParallelism } from 'node:os';
import { generateArchetypes,describeTeam,themes } from './teams';
import { randomSchedule,archetypeSchedule,chargeComparisonSchedule,withStrategies,type StrategySelection } from './schedule';
import { runMatch,type MatchSpec,type MatchResult } from './match';
import { csv,json,writeMode,writeArchetypeStats } from './output';
import { loadCheckpoint } from './checkpoint';
import { INPUT_FINGERPRINT } from './input-fingerprint';
import {catalogProvenance,saveCatalogSnapshot} from './catalog-provenance';
import { CHARGE_POLICY } from './charge-cpu';
import { BURST_CPU_POLICY } from '../game/burst-cpu';
import { teamCoverage,COVERAGE_POLICY,MAX_SUPPORT_FIT_LOSS } from './team-coverage';
import {TACTICAL_PROFILES} from './tactical-team-policy';
import { META_ARCHETYPE,META_PROFILES } from './meta-teams';
import { cpuSearchConfiguration } from '../game/cpu-search';
import { CHARGE_CORE_NAMES } from './charge-team-policy';
import {CONSTRUCTED_DECK_POLICY,CONSTRUCTED_DECK_SOURCE,CONSTRUCTED_AXIS_TAGS} from './constructed-teams';
const args=process.argv.slice(2).filter(a=>a!=='--');
const warOnly=args.includes('--war-only'),warRequested=warOnly||['card-war','random-card-war','war-detail-ids','war-skill-ablation','burst-war','war-pairs'].some(flag=>args.includes('--'+flag));
const defaults:Record<string,string>={};
if(warOnly){
 const i=args.indexOf('--out'),path=resolve(i<0?'simulation-results/latest':args[i+1]),saved=join(path,'summary.json');
 if(!existsSync(saved))throw new Error('--war-only requires an existing --out with summary/checkpoints');
 const summary=JSON.parse(readFileSync(saved,'utf8')),config=summary.configuration;
 for(const [key,value] of Object.entries({mode:summary.mode,seed:summary.seed,'random-matches':config.randomMatches,'matches-per-matchup':config.matchesPerMatchup,variants:config.variants,'cpu-strategy':config.cpuStrategy,'archetype-selection':config.archetypeSelection??'legacy',archetypes:(config.archetypes||[]).join(','),'cpu-search':config.cpuSearch?.mode||'exhaustive','preview-candidates':config.cpuSearch?.previewCandidates||200}))defaults[key]=String(value);
 for(const flag of ['fast-simulation','charge-comparison','representative','burst-round-trace'])if(config[{'fast-simulation':'fastSimulation','charge-comparison':'chargeComparison','representative':'representative','burst-round-trace':'recordBurstRounds'}[flag]!])args.push('--'+flag);
 args.push('--resume');
}
const get=(key:string,fallback:string)=>{const i=args.indexOf('--'+key);return i<0?(defaults[key]??fallback):args[i+1];};
const number=(key:string,fallback:number)=>{const n=Number(get(key,String(fallback)));if(!Number.isSafeInteger(n)||n<0)throw new Error(`不正な --${key}`);return n;};
const mode=get('mode',args.includes('--card-war')||args.includes('--war-detail-ids')?'archetype':'random'),seed=number('seed',1),out=resolve(get('out','simulation-results/latest')),workers=Math.max(1,number('workers',1));
if(!['random','archetype','all'].includes(mode))throw new Error('mode must be random/archetype/all');
const cpuStrategy=get('cpu-strategy','normal') as StrategySelection,chargeComparison=args.includes('--charge-comparison');
const fastSimulation=args.includes('--fast-simulation'),cpuSearch=cpuSearchConfiguration({mode:get('cpu-search',cpuStrategy.startsWith('burst')?'two-stage':'exhaustive') as 'exhaustive'|'two-stage',previewCandidates:number('preview-candidates',cpuStrategy.startsWith('burst')?100:200)}),recordBurstRounds=args.includes('--burst-round-trace')||(warRequested&&!args.includes('--resume')),matchOptions={fastSimulation,cpuSearch,...(recordBurstRounds?{recordBurstRounds}: {})};
if(!['normal','charge','charge-archetype','burst','burst-archetype','burst-charge-archetype'].includes(cpuStrategy))throw new Error('--cpu-strategy は normal / charge / charge-archetype / burst / burst-archetype / burst-charge-archetype');
if(chargeComparison&&(mode!=='archetype'||cpuStrategy!=='normal'||args.includes('--representative')))throw new Error('--charge-comparison は --mode archetype で単独指定してください');
let warOptions:WarOptions|null=null;
if(warRequested){
  const detailIds=get('war-detail-ids','').split(',').filter(Boolean).map(Number),cardIds=get('war-card-ids',detailIds.join(',')).split(',').filter(Boolean).map(Number);
  const detailOnly=args.includes('--war-detail-ids'),ablations=get('war-skill-ablation',detailOnly?'AUTO,BURST,CENTER,ALL':'').split(',').filter(Boolean).map(k=>k.toUpperCase()) as AblationKind[];
  if((ablations.length||args.includes('--burst-war')||args.includes('--war-pairs'))&&!detailIds.length)throw new Error('LEVEL 3 requires --war-detail-ids; detail analysis is never automatic');
  if(number('war-top-pairs',0)>0)throw new Error('LEVEL 3 uses specified --war-pairs only, not automatic top pairs');
  const warModes:('random'|'archetype')[]=args.includes('--random-card-war')?(args.includes('--card-war')?['archetype','random']:['random']):['archetype'];
  if(detailIds.some(id=>cardIds.length&&!cardIds.includes(id)))throw new Error('--war-card-ids must include --war-detail-ids');
  if(new Set(detailIds).size!==detailIds.length||new Set(cardIds).size!==cardIds.length)throw new Error('Duplicate WAR card IDs');
  if(ablations.some(k=>!['AUTO','BURST','CENTER','ALL'].includes(k)))throw new Error('--war-skill-ablation is AUTO,BURST,CENTER,ALL');
  const pairs=get('war-pairs','').split(',').filter(Boolean).map(pair=>{const ids=pair.split(':').map(Number);if(ids.length!==2)throw new Error('--war-pairs is e.g. 32:38,38:44');return ids as [number,number];});
  if([...cardIds,...detailIds,...pairs.flat()].some(id=>!Number.isSafeInteger(id)||id<1||id>48))throw new Error('WAR card IDs must be integers 1..48');
  if(pairs.some(pair=>pair.some(id=>!detailIds.includes(id))))throw new Error('--war-pairs members must be included in --war-detail-ids');
  const bootstrapIterations=number('war-bootstrap',1000);if(!bootstrapIterations)throw new Error('--war-bootstrap must be >0');
  if(args.includes('--burst-war')&&!ablations.includes('BURST'))ablations.push('BURST');
  warOptions={modes:warModes,detailIds,samplesPerCard:number('war-samples-per-card',50),seed:number('war-seed',seed),cardIds,ablations,pairs,topPairs:0,pairSamples:number('war-pair-samples',number('war-samples-per-card',50)),bootstrapIterations};

 number('war-workers',1);number('war-max-new-jobs',0);
}
const filter=get('archetypes','').split(',').filter(Boolean);
let budget=warOnly?0:args.includes('--max-new-matches')?number('max-new-matches',0):Infinity;
let interrupted=false;
const stop=()=>{interrupted=true;console.log('停止要求を受け付けました。実行中の試合を保存して終了します。');};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
mkdirSync(out,{recursive:true});
const previousSummaryPath=join(out,'summary.json');
const previousSummary=(args.includes('--resume')||warOnly)&&existsSync(previousSummaryPath)?JSON.parse(readFileSync(previousSummaryPath,'utf8')):null;
const archetypeSelection=get('archetype-selection','balanced') as 'balanced'|'legacy'|'constructed';
if(!['balanced','legacy','constructed'].includes(archetypeSelection))throw new Error('--archetype-selection は balanced / legacy / constructed');
const allTeams=generateArchetypes(seed,Math.max(3,number('variants',3)),archetypeSelection);
for(const name of filter)if(!allTeams.some(t=>t.archetype===name))throw new Error(`存在しないアーキタイプ: ${name}`);
const selectedTeams=filter.length?allTeams.filter(t=>filter.includes(t.archetype)):allTeams;
const comparisonSpecs=chargeComparison?chargeComparisonSchedule(seed,number('matches-per-matchup',10),selectedTeams):[];
const teams=chargeComparison?[...new Map(comparisonSpecs.flatMap(s=>[s.a,s.b]).map(t=>[t.name,t])).values()]:selectedTeams;
const started=performance.now(),summary:Record<string,unknown>={seed,mode,ruleVersion:GAME_RULE_VERSION,configuration:{randomMatches:number('random-matches',1),matchesPerMatchup:number('matches-per-matchup',10),variants:Math.max(3,number('variants',3)),workers},catalog:{idols:48,songs:22,selectableSongs:20,specialSongs:2},cpu:'shared exhaustive 8P5; points > outcome > appeal difference > final fatigue; public snapshot only',matchesPerMatchupIncludesMirrors:true,winRateDefinition:'wins / team appearances; draws count in denominator; no-sample rates are 0 with selections=0',notes:['最新修正シートのタグ3/4と能力・基礎値を使用','試合間・worker間でseedを分離。mirrorは同一デッキ・同一seed・同一編成でP1/P2を交換','BURSTは通常と強制の合計。平均Appealは7ラウンドの試合累計','AUTO/CENTERは効果が発生したパフォーマンス単位で計数。BURST_READY列は互換名として条件成立回数を記録（READY待機状態は廃止）']};
console.log(`[settings] mode=${mode} cpu=${cpuStrategy} workers=${workers} availableCPUs=${availableParallelism()} search=${cpuSearch.mode} previews=${cpuSearch.previewCandidates} fast=${fastSimulation?'on':'off'}`);
const catalogSource=catalogProvenance();summary.catalogSource=catalogSource;
console.log(`[catalog] ${catalogSource.cardDefinitionsFile} / ${catalogSource.specification} / fingerprint=${INPUT_FINGERPRINT}`);
summary.inputFingerprint=INPUT_FINGERPRINT;summary.cpuStrategy=chargeComparison?'normal-vs-charge':cpuStrategy;
summary.configuration={...(summary.configuration as object),cpuStrategy,chargeComparison,archetypeSelection,coveragePolicy:COVERAGE_POLICY,representative:args.includes('--representative'),archetypes:filter,chargePolicy:CHARGE_POLICY,...(cpuStrategy.startsWith('burst')?{burstPolicy:BURST_CPU_POLICY}:{}),fastSimulation,cpuSearch,recordBurstRounds};
summary.chargeTelemetryAvailable=!fastSimulation;
if(cpuStrategy==='charge'||cpuStrategy==='charge-archetype'||chargeComparison)summary.cpu='通常CPUは不変。CHARGEはシミュレーション専用：現在得点/勝敗/差/疲労＋蓄積・BURST回復・R5出場/R6復帰/R7再登場の固定ヒューリスティック。公開状態だけを使用';
if(cpuStrategy.startsWith('burst'))summary.cpu='BURST考慮：公開状態から本番engineで今回終了・BURSTを実行し、公開楽曲候補と次回の合法な交換・同時投入を限定評価。今回得点/勝敗/Appeal差＋0.6×次回平均。通常/CHARGEは不変';
if(cpuStrategy==='burst-charge-archetype')summary.cpu='チャージ軸は従来のCHARGE CPU、その他は本番engineで今回と次回を比較するBURST CPU。RANDOMは全チームBURST CPU。探索方式・候補数は両CPU共通';
if(cpuSearch.mode==='two-stage'){summary.cpu=String(summary.cpu)+`; two-stage ranking, top ${cpuSearch.previewCandidates} exact previews`;summary.notes=[...(summary.notes as string[]),'二段階探索は概算による候補絞り込みを行うため、全候補探索とは配置・勝敗が変わり得る。探索方式/候補数/policyを保持して比較する'];}
summary.notes=[...(summary.notes as string[]),'カードは修正Excelで上書き。旧checkpointは入力データ照合で拒否。RANDOMの乱数・通常CPU評価・生成は現行9軸の意味判定・profile別属性条件に準拠。楽曲候補は指定通り20曲へ変更','チャージ軸は指定3コア＋ステージ支援5人。竹内以外のBACKS依存支援を除外しCENTERを確保','対単一属性タグは実在2人を核に能力文・CENTER・多属性の勝ち筋を組み合わせる','charge_round_trace.csv は実エンジン観測値。最大チャージ/消費/回復/各ラウンドの配置をCPU別に集計'];
if(fastSimulation)summary.notes=[...(summary.notes as string[]),'fast-simulation：効果記録・charge traceを省略。チャージ専用CSVはヘッダーのみ（未計測であり0ではない）。CPU戦略別勝率・通常のカード/BURST/楽曲統計は保持'];
function saveTeams(){if(mode!=='random'){
 mkdirSync(join(out,'archetype'),{recursive:true});json(join(out,'archetype/archetypes.json'),teams.map(t=>({...describeTeam(t),inputFingerprint:INPUT_FINGERPRINT,specification:catalogSource.specification,cardDefinitionsFile:catalogSource.cardDefinitionsFile})));json(join(out,'archetype/construction_rules.json'),{version:8,archetypeSelection,tacticalProfiles:archetypeSelection==='balanced'?TACTICAL_PROFILES:null,constructed:archetypeSelection==='constructed'?{source:CONSTRUCTED_DECK_SOURCE,decks:12,axisDecks:9,extraDecks:3,selectionPolicy:CONSTRUCTED_DECK_POLICY,axisCoverage:'48人全員1〜2回・追加3デッキを除外',policy:'確定済みの8人・3曲を固定し、勝率に応じて対戦中に変更しない'}:null,coverage:{policy:COVERAGE_POLICY,maxSupportFitLoss:MAX_SUPPORT_FIT_LOSS,preserve:'戦術コアと明示した支援役・実際の発動属性条件・チャージ支援条件・候補ごとの異なる8人。多属性は各2人以上でステージ/BACKSの3属性が同時成立可能',objective:'戦術適合を優先し、元支援の構築スコアから許容差以内で全チームの採用回数の平方和を低減。勝率/WAR不使用'},themes:themes(),coreTaggedMembers:3,variants:number('variants',3),charge:{coreNames:CHARGE_CORE_NAMES,centerMinimum:1,exception:'竹内希来里',policy:'指定3人を固定。支援はBACKS依存AUTO/自軍BACKS BURST条件/ステージ移動を除外。基礎値4〜5 +2、CENTER +6、ステージ常駐 +4、竹内支援 +8、多種類位置経験 -8。試合結果不使用'},meta:{name:META_ARCHETYPE,coreTaggedMembers:2,profiles:META_PROFILES,policy:'実在する対単一属性2人を核に能力文で対クール/PLAIN/汎用妨害を評価し、基礎値はbase/2、未採用属性は+2、3属性必須はPLAIN profileのみ。独立seed・試合結果不使用'},policy:'Balanced: pre-match tactical role shortlists, strong axes retain cores with conditional supports, weak axes gain early stage scoring/fatigue support; no win/WAR inputs. Legacy: seven non-charge themes: main tag 12, sub tag 3, attribute 7, center role 4, own/enemy-aware ability synergies, three attributes required for multi-attribute theme, base/2, seeded jitter <=4, rotate top 3; songs use actual engine rules, own-team compatibility and counter/use distinction; matching tags are secondary only. Anti-skill includes counter-BURST +8, negative protection +8 and party protection +6. Charge has the explicit construction policy above. Constructed: fixed 12-deck list. No in-run result optimization.'});
 const legacy=archetypeSelection==='constructed'?[]:generateArchetypes(seed,Math.max(3,number('variants',3)),'legacy').filter(t=>teams.some(s=>s.name===t.name));
 const planned=archetypeSchedule(seed,number('matches-per-matchup',10),teams,args.includes('--representative'));
 csv(join(out,'archetype/team_coverage.csv'),teamCoverage(teams).map(row=>({...row,...(archetypeSelection==='constructed'?{axisDeckCount:teams.filter(t=>(CONSTRUCTED_AXIS_TAGS as readonly string[]).includes(t.mainTags[0])&&t.members.includes(row.id)).length}:{}),legacyTeamCount:legacy.filter(t=>t.members.includes(row.id)).length,plannedMatchSelections:planned.reduce((n,m)=>n+Number(m.a.members.includes(row.id))+Number(m.b.members.includes(row.id)),0),selection:archetypeSelection,policy:archetypeSelection==='balanced'?COVERAGE_POLICY:archetypeSelection==='constructed'?CONSTRUCTED_DECK_POLICY:'legacy'})));
}}
if(args.includes('--generate-only')){saveCatalogSnapshot(out,catalogSource);saveTeams();const count=new Set(teams.map(t=>t.archetype)).size;json(join(out,'summary.json'),{...summary,generatedTeams:teams.length,archetypes:count});console.log(`Generated ${teams.length} teams / ${count} archetypes: ${out}`);process.exit(0);}
async function run(specs:MatchSpec[],label:string){
 const begin=performance.now(),results:MatchResult[]=new Array(specs.length);let next=0,completed=0;
 const checkpoint=join(out,`${label}-checkpoint.jsonl`),timingPath=join(out,`${label}-timing.json`);
 const resume=args.includes('--resume'),timing=resume&&existsSync(timingPath)?JSON.parse(readFileSync(timingPath,'utf8')):{elapsedSeconds:0,incompleteTiming:resume&&existsSync(checkpoint)};
 if(resume){
  if(!existsSync(checkpoint))throw new Error(`再開用checkpointがありません: ${checkpoint}`);
  for(const [i,result] of loadCheckpoint(checkpoint,specs,matchOptions))results[i]=result;
  // A valid last record may lack its final newline. Keep it separate from the next append.
  const contents=readFileSync(checkpoint,'utf8');if(contents&&!contents.endsWith('\n'))appendFileSync(checkpoint,'\n');
 }else{
  if(existsSync(checkpoint)&&!args.includes('--overwrite'))throw new Error(`既存checkpointがあります。--resume または別の --out を指定してください: ${checkpoint}`);
  writeFileSync(checkpoint,'');
 }
 const missing=specs.map((_,i)=>i).filter(i=>!results[i]);completed=specs.length-missing.length;
 const pending=missing.slice(0,budget);budget-=pending.length;
 const resumedGames=completed;
 const effectiveWorkers=Math.min(workers,pending.length);
 console.log(`[${label}] reused ${completed}, remaining ${missing.length}, running at most ${pending.length}, workers=${effectiveWorkers}`);
 const save=(i:number,r:MatchResult)=>{results[i]=r;completed++;appendFileSync(checkpoint,JSON.stringify({index:i,result:r})+'\n');
  const elapsed=performance.now()-begin,newGames=completed-resumedGames,gamesPerMinute=elapsed>0?newGames*60000/elapsed:0;
  json(timingPath,{elapsedSeconds:timing.elapsedSeconds+elapsed/1000,incompleteTiming:timing.incompleteTiming,sessionNewGames:newGames,sessionElapsedSeconds:elapsed/1000,sessionGamesPerMinute:gamesPerMinute,effectiveWorkers,rssMiB:process.memoryUsage().rss/1048576});
  console.log(`[${label}] ${completed}/${specs.length} ${elapsed.toFixed(0)} ms | ${gamesPerMinute.toFixed(1)} games/min`);
 };
 if(workers===1){for(const i of pending){if(interrupted)break;save(i,runMatch(specs[i],matchOptions));await new Promise<void>(resolve=>setImmediate(resolve));}}
 else await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise<void>((done,reject)=>{
  const worker=new Worker(new URL('./worker.ts',import.meta.url),{execArgv:['--import','tsx'],workerData:matchOptions});
  let current=-1;const dispatch=()=>{current=pending[next++];if(current===undefined||interrupted){void worker.terminate();done();}else worker.postMessage(specs[current]);};
  worker.on('message',m=>{if(m.error){void worker.terminate();reject(new Error(m.stack||m.error));return;}save(current,m.result);dispatch();});worker.on('error',reject);dispatch();
 })));
 const finished=results.filter(Boolean);
 const elapsed=performance.now()-begin,newGames=finished.length-resumedGames;
 summary[label]={games:finished.length,plannedGames:specs.length,complete:finished.length===specs.length,newGames,elapsedSeconds:timing.elapsedSeconds+elapsed/1000,incompleteTiming:timing.incompleteTiming,resumedGames,effectiveWorkers,sessionGamesPerMinute:elapsed>0?newGames*60000/elapsed:0,p1Wins:finished.filter(m=>(m.winner==='A'&&!m.spec.mirror)||(m.winner==='B'&&m.spec.mirror)).length,p2Wins:finished.filter(m=>(m.winner==='B'&&!m.spec.mirror)||(m.winner==='A'&&m.spec.mirror)).length,draws:finished.filter(m=>m.winner==='draw').length};
 return finished;
}
try{
 const warBaselines:MatchResult[]=[];
 let randomStats:ReturnType<typeof writeMode>=[],archetypeStats:ReturnType<typeof writeMode>=[];
 if(mode!=='archetype'){const results=await run(withStrategies(randomSchedule(seed,number('random-matches',1)),cpuStrategy),'random');randomStats=writeMode(join(out,'random'),results);warBaselines.push(...results);}
 if(mode!=='random'){const specs=chargeComparison?comparisonSpecs:withStrategies(archetypeSchedule(seed,number('matches-per-matchup',10),teams,args.includes('--representative')),cpuStrategy);const results=await run(specs,'archetype');saveTeams();archetypeStats=writeMode(join(out,'archetype'),results);writeArchetypeStats(join(out,'archetype'),results);warBaselines.push(...results);}
 for(const [kind,stats] of [['random',randomStats],['archetype',archetypeStats]] as const)if(stats.length)csv(join(out,kind,'idol_stats.csv'),stats.map((c,i)=>({...c,randomWinRate:randomStats[i]?.winRate??null,archetypeWinRate:archetypeStats[i]?.winRate??null})));
 csv(join(out,'idol_comparison.csv'),Array.from({length:48},(_,i)=>({id:i+1,name:(randomStats[i]||archetypeStats[i]).name,randomSelections:randomStats[i]?.selections??0,randomWinRate:randomStats[i]?.winRate??null,archetypeSelections:archetypeStats[i]?.selections??0,archetypeWinRate:archetypeStats[i]?.winRate??null})));
 const savedWarRuns=previousSummary?.warRuns??(previousSummary?.cardWar?[previousSummary.cardWar]:[]);
 if(savedWarRuns.length){
  const baselineHash=hash(warBaselines),retained=savedWarRuns.filter((run:{baselineHash:string;inputFingerprint:string})=>run.baselineHash===baselineHash&&run.inputFingerprint===INPUT_FINGERPRINT);
  if(retained.length){summary.warRuns=retained;summary.cardWar=retained.at(-1);}
 }
 if(warOptions){
  const options=warOptions,detailIds=options.detailIds,warModes=options.modes;
  const plan=buildWarPlan(warBaselines,options,matchOptions),warOut=resolve(get('war-out',join(out,'war',detailIds.length?'detail':warModes.length===2?'basic-all':warModes[0]==='random'?'level2-random':'level1-archetype'))),warStarted=performance.now();
  console.log(`[war] baselines=${warBaselines.length}, planned counterfactual jobs=${plan.jobs.length}; RANDOM/ARCHETYPE are separate`);
  if(!warBaselines.some(r=>warModes.includes(r.spec.mode)))throw new Error('No completed baseline for requested WAR mode. RANDOM uses --random-card-war; ARCHETYPE uses --card-war');
  if(args.includes('--war-plan-only')){json(join(out,'war-planned.json'),plan);summary.cardWarPlan={plannedJobs:plan.jobs.length};}
  else{
   const results=await executeWarPlan(plan,warOut,{workers:Math.max(1,number('war-workers',1)),resume:args.includes('--war-resume')||warOnly,maxNewJobs:args.includes('--war-max-new-jobs')?number('war-max-new-jobs',0):Infinity,stopped:()=>interrupted,reusePaths:(previousSummary?.warRuns??(previousSummary?.cardWar?[previousSummary.cardWar]:[])).map((run:{output:string})=>resolve(out,run.output)),progress:(done,total)=>console.log(`[war] ${done}/${total}`)});
   summary.cardWar={...writeWarOutput(warOut,plan,warBaselines,results),baselineHash:plan.baselineHash,output:relative(out,warOut),sessionElapsedSeconds:(performance.now()-warStarted)/1000};
   const prior=(previousSummary?.warRuns??(previousSummary?.cardWar?[previousSummary.cardWar]:[])).filter((run:{baselineHash:string;inputFingerprint:string;output:string;options:{seed:number}})=>run.baselineHash===plan.baselineHash&&run.inputFingerprint===plan.fingerprint&&run.options.seed===plan.options.seed&&run.output!==relative(out,warOut));
   summary.warRuns=[...prior,summary.cardWar];
   if(warModes.includes('archetype'))console.log(`[war] 詳細検査候補のみ保存しました: ${join(warOut,'detail_candidates.csv')}（追加試合は自動開始しません）`);
  }
 }
 saveCatalogSnapshot(out,catalogSource);summary.totalElapsedSeconds=(performance.now()-started)/1000;json(join(out,'summary.json'),summary);exportAnalysis(out);console.log(`Saved ${out}`);
}catch(error){json(join(out,'failure.json'),{error:String(error),stack:(error as Error).stack});throw error;}
