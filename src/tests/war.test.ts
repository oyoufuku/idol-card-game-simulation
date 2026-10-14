import { expect,it } from 'vitest';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync,strFromU8 } from 'fflate';
import { byId,formationFromArray } from '../game/formation';
import { GAME_RULE_VERSION,mkPlayer } from '../game/engine';
import { cpuSearchConfiguration } from '../game/cpu-search';
import { IDOLS } from '../data/idols';
import { runMatch,mirror,type MatchResult,type MatchSpec } from '../simulation/match';
import { generateArchetypes,randomTeam,constructionScore } from '../simulation/teams';
import { randomSchedule,archetypeSchedule } from '../simulation/schedule';
import { INPUT_FINGERPRINT } from '../simulation/input-fingerprint';
import { buildWarPlan,replaceCards,hash,type WarOptions } from '../simulation/war-plan';
import { chooseReplacement,replacementEligible } from '../simulation/war-replacement';
import { executeWarPlan,compactWarResult,type WarResult } from '../simulation/war-runner';
import { bootstrap95,summarizeWar } from '../simulation/war-statistics';
import { writeWarOutput } from '../simulation/war-output';
import { exportAnalysis } from '../simulation/analysis-export';
const options:WarOptions={modes:['random','archetype'],detailIds:[1],samplesPerCard:2,seed:1,cardIds:[1],ablations:[],pairs:[],topPairs:0,pairSamples:2,bootstrapIterations:100};
function synthetic(spec:MatchSpec,winner:'A'|'B'|'draw'='A'):MatchResult {
 const players=[mkPlayer('A',spec.a.members,spec.a.songs),mkPlayer('B',spec.b.members,spec.b.songs)] as MatchResult['players'];
 const roundAppeals=Array.from({length:7},()=>winner==='A'?[10,0] as [number,number]:winner==='B'?[0,10] as [number,number]:[5,5] as [number,number]);
 return {inputFingerprint:INPUT_FINGERPRINT,ruleVersion:GAME_RULE_VERSION,spec,cpuStrategies:spec.cpuStrategies??['normal','normal'],winner,rounds:7,pointsA:winner==='A'?15:0,pointsB:winner==='B'?15:0,appealA:roundAppeals.reduce((n,r)=>n+r[0],0),appealB:roundAppeals.reduce((n,r)=>n+r[1],0),burstA:0,burstB:0,forcedBurstA:0,forcedBurstB:0,players,songs:Array(7).fill('A'),roundAppeals,formations:Array.from({length:7},()=>[formationFromArray(spec.a.members),formationFromArray(spec.b.members)])};
}
function spec(mode:'random'|'archetype'='random'):MatchSpec {
 const a={...randomTeam(1,'A'),members:[1,2,3,4,5,6,7,8]},b={...randomTeam(2,'B'),members:[1,9,10,11,12,13,14,15]};
 if(mode==='archetype'){a.archetype='バースト軸';a.mainTags=['バースト'];}
 return {mode,pairId:mode,seed:12,mirror:false,a,b};
}
it('RANDOMの合法代替は同属性・基礎値差±1を優先し、warSeedとチームだけで再現する',()=>{
 for(let seed=0;seed<30;seed++){const team=randomTeam(seed,'R');for(const id of team.members){const r=chooseReplacement(team,id,'random',9);expect(r).toEqual(chooseReplacement(team,id,'random',9));expect(team.members).not.toContain(r.id);expect(byId(r.id!).attr).toBe(byId(id).attr);expect(Math.abs(byId(r.id!).base-byId(id).base)).toBeLessThanOrEqual(1);expect(r.tier).toBe('sameAttribute_baseWithin1');}}
 const card=IDOLS[0],old=card.base;try{card.base=100;expect(chooseReplacement({...randomTeam(1,'T'),members:[1,2,3,4,5,6,7,8]},1,'random',1).tier).toBe('sameAttribute_relaxedBase');}finally{card.base=old;}
});
it('ARCHETYPEは構築条件を維持し中央値を選び、固定コアに人工代替を作らない',()=>{
 const teams=generateArchetypes(1);expect(teams).toEqual(generateArchetypes(1));
 for(const team of teams)for(const id of team.members){const r=chooseReplacement(team,id,'archetype',1);if(r.id===null)continue;expect(replacementEligible(team,id,r.id)).toBe(true);expect(r.id).toBe(r.candidates[Math.floor((r.candidates.length-1)/2)]);}
 const charge=teams.find(t=>t.archetype==='チャージ軸')!;
 for(const id of [32,38,44])expect(chooseReplacement(charge,id,'archetype',1)).toMatchObject({id:null,tier:'replacementUnavailable'});
 for(const id of charge.members.slice(3)){const r=chooseReplacement(charge,id,'archetype',1);if(r.id!==null)expect([...charge.members.filter(i=>i!==id),r.id].some(i=>byId(i).C)).toBe(true);}
 const generic=teams.find(t=>t.archetype==='疲労付与軸')!,id=generic.members[0],r=chooseReplacement(generic,id,'archetype',1);
 const ranked=r.candidates.map(id=>constructionScore(byId(id),generic.members.filter(i=>i!==generic.members[0]).map(byId),generic.mainTags[0],generic.subTags).score);expect(ranked).toEqual(ranked.slice().sort((a,b)=>b-a));
});
it('カード入れ替えは対象側の1枚だけでseed/相手/3曲/CPU/mirror/他7人を保つ',()=>{
 for(const original of [spec(),mirror(spec())]){const changed=replaceCards(original,0,[[1,16]]);expect(changed.b).toBe(original.b);expect({...changed,a:original.a}).toEqual(original);expect(changed.a.songs).toBe(original.a.songs);expect(changed.a.members).toEqual([16,2,3,4,5,6,7,8]);expect(changed.b.members).toContain(1);}
 expect(()=>replaceCards(spec(),0,[[1,2]])).toThrow('Illegal');
});
it('sampling/代替/ジョブ計画は同seedで一致し、ペアは異なる2代替と4条件を使う',()=>{
 const baselines=[synthetic(spec()),synthetic(mirror(spec()))],opts={...options,pairs:[[1,2] as [number,number]]};
 const p=buildWarPlan(baselines,opts);expect(p).toEqual(buildWarPlan(baselines,opts));expect(p.trials.filter(t=>t.kind==='card')).toHaveLength(2);expect(p.pairs).toHaveLength(2);
 for(const pair of p.pairs){expect(pair.replacements[0].id).not.toBe(pair.replacements[1].id);expect(pair.jobs).toHaveLength(3);}
 const bad={...baselines[0],inputFingerprint:'old'};expect(()=>buildWarPlan([bad],opts)).toThrow('fingerprint');
 expect(()=>buildWarPlan([{...baselines[0],cpuStrategies:['charge','normal']}],opts)).toThrow('strategy');
 expect(()=>buildWarPlan([{...baselines[0],roundAppeals:[]}],opts)).toThrow('seven');
});
it('RANDOMとARCHETYPEのWARを合算せずsynergyDependencyはper100の差、roundは本体得点を使う',()=>{
 const r=spec();r.b.members=r.b.members.map(id=>id===1?16:id);const a={...spec('archetype'),a:{...r.a,archetype:'RANDOM',mainTags:[]}},baselines=[synthetic(r,'B'),synthetic(a,'A')],plan=buildWarPlan(baselines,{...options,samplesPerCard:1,ablations:['BURST']});
 const results=new Map<string,WarResult>();for(const job of plan.jobs)results.set(job.key,compactWarResult(synthetic(job.spec,'draw')));
 const archTrial=plan.trials.find(t=>t.mode==='archetype'&&t.kind==='card')!;expect(archTrial.side).toBe(0); // deterministic selection for this fixture
 const data=summarizeWar(plan,baselines,results),ar=data.card_war_stats[0],rr=data.random_card_war_stats[0];
 expect(ar).toMatchObject({pairedSamples:1,cWARPer100:50,positiveFlipRate:1,negativeFlipRate:0,carryGames:1,sampleStatus:'insufficient'});
 expect(rr).toMatchObject({pairedSamples:1,cWARPer100:-50,negativeFlipRate:1});expect(data.card_war_mode_comparison[0]).toMatchObject({synergyDependency:100,archetypeSamples:1,randomSamples:1});
 expect(data.card_round_value_stats.find(row=>row.mode==='archetype'&&row.cardId===1&&row.round===7)).toMatchObject({averagePointDelta:3});
});
it('BURST WARは試合単位・Triggered限定を区別し、R7/複数回/強制混在を二重計上しない',()=>{
 const s=spec();s.b.members=s.b.members.map(id=>id===1?16:id);const baseline=synthetic(s,'A');baseline.players[0].states[1].burstCount=3;baseline.players[0].states[1].forcedBurstCount=1;baseline.burstRoundTrace=[{round:5,side:0,id:1,normal:1,forced:0},{round:7,side:0,id:1,normal:1,forced:1}];
 const plan=buildWarPlan([baseline],{...options,ablations:['BURST']}),results=new Map(plan.jobs.map(job=>[job.key,compactWarResult(synthetic(job.spec,'B'))]));
 const data=summarizeWar(plan,[baseline],results),card=data.random_card_war_stats[0];
 expect(card).toMatchObject({burstRate:1,burstPairedSamples:1,burstWARPer100Selections:100,burstTriggeredSamples:1,burstWinDeltaWhenTriggered:1,burstWARPer100TriggeredGames:100,burstPositiveFlipRate:1,burstNegativeFlipRate:0,burstDecisiveRate:1,totalBurstActivations:3,averageBurstActivationsPerTriggeredGame:3,winDeltaPerBurstActivation:1/3,normalBurstGames:1,forcedBurstGames:1});
 const rounds=data.burst_round_war_stats.filter(row=>row.mode==='random'&&row.cardId===1);expect(rounds.find(row=>row.round===5)).toMatchObject({samples:1,averageWinDelta:1});expect(rounds.find(row=>row.round===7)).toMatchObject({samples:1});expect(rounds.find(row=>row.round===1)).toMatchObject({samples:0,averageWinDelta:null});
 expect(card).not.toHaveProperty('normalBurstContribution');expect(card).not.toHaveProperty('forcedBurstContribution');
 delete baseline.burstRoundTrace;const unmeasured=summarizeWar(plan,[baseline],results).burst_round_war_stats.find(row=>row.mode==='random'&&row.cardId===1)!;expect(unmeasured).toMatchObject({traceUnavailableGames:1,samples:0});
});
it('4条件の勝利価値からpair交互作用を算出し、欠測を0にしない',()=>{
 const s=spec();s.b.members=s.b.members.map(id=>id===1?16:id);const baseline=synthetic(s,'A'),plan=buildWarPlan([baseline],{...options,samplesPerCard:0,pairs:[[1,2]]}),pair=plan.pairs[0];
 const results=new Map(pair.jobs!.map(key=>[key,compactWarResult(synthetic(plan.jobs.find(j=>j.key===key)!.spec,'B'))]));
 expect(summarizeWar(plan,[baseline],results).pair_synergy_war_stats[0]).toMatchObject({averageInteraction:1,synergyWARPer100:100,pairedSamples:1});
 results.delete(pair.jobs![2]);expect(summarizeWar(plan,[baseline],results).pair_synergy_war_stats[0]).toMatchObject({averageInteraction:null,pairedSamples:0,pendingSamples:1});
});
it('paired cluster bootstrapはseed再現しmirrorを独立標本扱いせず欠測をnullにする',()=>{
 const rows=[{value:1,cluster:'a'},{value:1,cluster:'a'},{value:-1,cluster:'b'},{value:-1,cluster:'b'}];expect(bootstrap95(rows,1)).toEqual(bootstrap95(rows,1));expect(bootstrap95(rows,1)).toEqual([-100,100]);expect(bootstrap95([],1)).toEqual([null,null]);
});
it('WAR出力はモード別CSV/JSON/Excelを作り、sampleCountは採用数でなくpairedSamples',()=>{
 const dir=mkdtempSync(join(tmpdir(),'war-output-'));try{const baseline=synthetic(spec()),plan=buildWarPlan([baseline],options),results=new Map(plan.jobs.map(job=>[job.key,compactWarResult(synthetic(job.spec,'draw'))]));
 const stats=writeWarOutput(join(dir,'war'),plan,[baseline],results);writeFileSync(join(dir,'summary.json'),JSON.stringify({inputFingerprint:INPUT_FINGERPRINT,cardWar:{...stats,output:'war'}}));exportAnalysis(dir);
 const bundle=JSON.parse(readFileSync(join(dir,'analysis_bundle.json'),'utf8'));expect(bundle.card_war_stats[0].pairedSamples).toBe(0);expect(bundle.random_card_war_stats[0].pairedSamples).toBe(2);expect(bundle.random_card_war_stats[0].sampleCount).toBe(2);expect(bundle.archetypeCardWAR).toEqual(bundle.card_war_stats);expect(bundle.randomCardWAR).toEqual(bundle.random_card_war_stats);
 const sheets=strFromU8(unzipSync(readFileSync(join(dir,'analysis.xlsx')))['xl/workbook.xml']);expect(sheets).toContain('RANDOM_Card_WAR');expect(sheets).toContain('ARCHETYPE_Card_WAR');expect(sheets).toContain('WAR_モード比較');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
it('実エンジンWARはworkers 1/2で完全一致しresume済みを再実行せず設定/破損の混在を拒否する',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'war-worker-')),matchOptions={fastSimulation:true,cpuSearch:cpuSearchConfiguration({mode:'two-stage',previewCandidates:100})};
 try{
  const base=runMatch(randomSchedule(876,1)[0],matchOptions),ids=base.spec.a.members.slice(0,2),plan=buildWarPlan([base],{...options,samplesPerCard:1,cardIds:ids},matchOptions);
  expect(plan.jobs).toHaveLength(2);const execute=(out:string,workers:number,maxNewJobs=Infinity,resume=false)=>executeWarPlan(plan,join(dir,out),{workers,maxNewJobs,resume});
  const first=await execute('one',1),second=await execute('two',2);expect([...first].sort()).toEqual([...second].sort());expect(summarizeWar(plan,[base],first)).toEqual(summarizeWar(plan,[base],second));
  const cached=await executeWarPlan(plan,join(dir,'cached'),{workers:2,maxNewJobs:0,resume:false,reusePaths:[join(dir,'one')]});expect([...cached].sort()).toEqual([...first].sort());
  const saved=readFileSync(join(dir,'two/checkpoint.jsonl'),'utf8');expect(await execute('two',2,0,true)).toEqual(second);expect(readFileSync(join(dir,'two/checkpoint.jsonl'),'utf8')).toBe(saved);
  await expect(executeWarPlan({...plan,options:{...plan.options,seed:2}},join(dir,'two'),{workers:2,maxNewJobs:0,resume:true})).rejects.toThrow('mismatch');expect(readFileSync(join(dir,'two/checkpoint.jsonl'),'utf8')).toBe(saved);
  const records=saved.trim().split('\n'),entry=JSON.parse(records[0]);entry.result.pointsA++;writeFileSync(join(dir,'two/checkpoint.jsonl'),JSON.stringify(entry)+'\n'+records.slice(1).join('\n')+'\n');await expect(execute('two',1,0,true)).rejects.toThrow('checkpoint');
  const compact=compactWarResult(base);expect(compact.rounds).toBe(7); // baseline is the direct ordinary runMatch result; plan must not mutate it
  expect(plan.baselineHash).toBe(hash([base]));
 }finally{rmSync(dir,{recursive:true,force:true});}
},60000);

it('CLIのLEVEL 1/2は別実行でき、デフォルトで能力除外/ペア/Round Valueを実行しない',()=>{
 const dir=mkdtempSync(join(tmpdir(),'war-level-cli-'));
 const cli=(...args:string[])=>spawnSync(process.execPath,['--import','tsx','src/simulation/cli.ts','--out',dir,...args],{encoding:'utf8',timeout:20000});
 try{
  // A format/schedule fixture: no CPU games run in this CLI test.
  const random=randomSchedule(1,1)[0];
  const a=generateArchetypes(1)[0];
  // Get the real schedule without executing it.
  const scheduled=archetypeSchedule(1,2)[0];
  writeFileSync(join(dir,'random-checkpoint.jsonl'),JSON.stringify({index:0,result:synthetic(random)})+'\n');
  writeFileSync(join(dir,'archetype-checkpoint.jsonl'),JSON.stringify({index:0,result:synthetic(scheduled)})+'\n');
  const first=cli('--mode','all','--random-matches','1','--matches-per-matchup','2','--resume','--max-new-matches','0','--card-war','--war-max-new-jobs','0','--war-bootstrap','10');expect(first.status,first.stderr).toBe(0);
  let bundle=JSON.parse(readFileSync(join(dir,'analysis_bundle.json'),'utf8'));expect(bundle.random_card_war_stats).toEqual([]);expect(bundle.card_round_value_stats).toEqual([]);expect(bundle.card_skill_ablation_stats).toEqual([]);expect(bundle.pair_synergy_war_stats).toEqual([]);
  const checkpoint=readFileSync(join(dir,'archetype-checkpoint.jsonl'),'utf8');
  const second=cli('--war-only','--random-card-war','--war-max-new-jobs','0','--war-bootstrap','10');expect(second.status,second.stderr).toBe(0);expect(second.stdout).toContain('running at most 0');expect(readFileSync(join(dir,'archetype-checkpoint.jsonl'),'utf8')).toBe(checkpoint);
  bundle=JSON.parse(readFileSync(join(dir,'analysis_bundle.json'),'utf8'));expect(bundle.card_war_stats).toHaveLength(48);expect(bundle.random_card_war_stats).toHaveLength(48);expect(bundle.card_war_mode_comparison).toHaveLength(48);expect(bundle.summary.warRuns).toHaveLength(2);
  const detail=cli('--war-only','--card-war','--war-detail-ids',String(a.members[0]),'--war-max-new-jobs','0','--war-bootstrap','10');expect(detail.status,detail.stderr).toBe(0);
  const plan=JSON.parse(readFileSync(join(dir,'war/detail/plan.json'),'utf8'));expect(plan.options.detailIds).toEqual([a.members[0]]);expect(plan.trials.every((t:{cardId:number})=>t.cardId===a.members[0])).toBe(true);expect(plan.options.ablations).toEqual(['AUTO','BURST','CENTER','ALL']);
  const keep=cli('--mode','all','--random-matches','1','--matches-per-matchup','2','--resume','--max-new-matches','0');expect(keep.status,keep.stderr).toBe(0);expect(JSON.parse(readFileSync(join(dir,'analysis_bundle.json'),'utf8')).summary.warRuns).toHaveLength(3);
  const invalid=cli('--war-only','--card-war','--war-skill-ablation','BURST','--war-max-new-jobs','0');expect(invalid.status).not.toBe(0);expect(invalid.stderr).toContain('--war-detail-ids');
 }finally{rmSync(dir,{recursive:true,force:true});}
},30000);

it('指定調整後のgenerator全チーム・楽曲・採用理由が複数seedで固定される',()=>{
 for(const [seed,digest] of [[1,'363658972ac1f40acb28d7eae4591e3926f88e138b22232800875fd072f9333f'],[123,'9cac547d1caa5f87bfc45447b6379a9882f5e8157be29eb77a2e4bd2b64ea464'],[876,'20b590dc77bca5247587aa2a8c53de8cf1cb4a41ad2df5aba1364efa4ffcb737']] as const)expect(hash(generateArchetypes(seed,3,'legacy'))).toBe(digest);
});
