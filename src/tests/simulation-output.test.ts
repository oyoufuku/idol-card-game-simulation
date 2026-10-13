import { expect,it } from 'vitest';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGame } from '../game/engine';
import { writeMode,writeArchetypeStats } from '../simulation/output';
import type { MatchResult } from '../simulation/match';
import type { Team } from '../simulation/teams';
import { sampleEvidence } from '../simulation/samples';
import { parseCsv } from '../simulation/analysis-export';
const team=(name:string,members:number[]):Team=>({name,archetype:name,members,songs:['A','B','C'],mainTags:[],subTags:[],reasons:{}});
function fixture():MatchResult{
 const a=team('A',[1,2,3,4,5,6,7,8]),b=team('B',[2,9,10,11,12,13,14,15]);
 const g=createGame(a.members,b.members,a.songs,b.songs,'local',()=>.5);
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].stats.positions.BACK=7;
 g.p1.states[1].burstCount=3;g.p1.states[1].forcedBurstCount=1;
 return {spec:{mode:'archetype',pairId:'fixture',seed:1,mirror:false,a,b},winner:'A',rounds:7,pointsA:8,pointsB:2,appealA:200,appealB:150,burstA:3,burstB:0,forcedBurstA:1,forcedBurstB:0,players:[g.p1,g.p2],songs:['A','B','C','A','B','C','A'],roundAppeals:[],formations:[]};
}
it('採用・片側採用・発動試合率・平均発動回数を区別して集計する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'idol-stats-'));
 try {const m=fixture(),rows=writeMode(dir,[m]),one=rows[0],shared=rows[1];
 expect(one.selections).toBe(1);expect(one.wins).toBe(1);expect(one.exclusiveWinRate).toBe(1);expect(one.normalBURST).toBe(2);expect(one.forcedBURST).toBe(1);expect(one.burstRate).toBe(1);expect(one.averageBursts).toBe(3);
 expect(shared.selections).toBe(2);expect(shared.winRate).toBe(.5);expect(shared.exclusiveSelections).toBe(0);
 expect(readFileSync(join(dir,'tag_pair_stats.csv'),'utf8')).toContain('insufficient,false');
 expect(one).toMatchObject({sampleCount:1,sampleStatus:'insufficient',sufficientSamples:false});
 expect(readFileSync(join(dir,'idol_stats.csv'),'utf8')).not.toMatch(/NaN|Infinity|undefined/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
it('標本数の20件・50件境界で3段階に分類する',()=>{
 for(const n of [0,1,19])expect(sampleEvidence(n)).toEqual({sampleCount:n,sampleStatus:'insufficient',sufficientSamples:false});
 for(const n of [20,49])expect(sampleEvidence(n)).toEqual({sampleCount:n,sampleStatus:'provisional',sufficientSamples:false});
 for(const n of [50,100])expect(sampleEvidence(n)).toEqual({sampleCount:n,sampleStatus:'sufficient',sufficientSamples:true});
});
it('P1/P2別勝率とmirror集計、対角の同型出場数を検証する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'archetype-stats-'));
 try {const m=fixture(),mirror={...m,spec:{...m.spec,mirror:true}},stats=writeArchetypeStats(dir,[m,mirror]);
 expect(stats.find(s=>s.archetype==='A')).toMatchObject({games:2,wins:2,p1Games:1,p2Games:1,p1WinRate:1,p2WinRate:1});
 expect(stats.find(s=>s.archetype==='B')).toMatchObject({games:2,wins:0});
 const same={...m,spec:{...m.spec,b:{...m.spec.b,archetype:'A'}}};
 expect(writeArchetypeStats(dir,[same])[0]).toMatchObject({games:2,wins:1,winRate:.5});
 expect(readFileSync(join(dir,'archetype_matchup_matrix.csv'),'utf8')).toContain('A,0.5');
 } finally {rmSync(dir,{recursive:true,force:true});}
});
it('チャージ履歴はCPU別に集計し、最大値・消費・B回復・R5/R6/R7率を分離する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'charge-stats-'));
 try{const m=fixture();m.cpuStrategy='mixed';m.cpuStrategies=['normal','charge'];
 m.chargeTrace=[5,6,7].flatMap(round=>(['A','B'] as const).map(team=>({round,team,cpuStrategy:team==='A'?'normal' as const:'charge' as const,id:32,name:'金村美玖',position:round===6?'BACK' as const:'FRONT-L' as const,entered:round!==6,chargeBefore:4,chargeAfter:round===6?5:4,spentCharge:round===6?0:4,burstRecoveries:round===5?1:0,recoveredCharge:round===5?4:0,burstCountBefore:round===5?0:1,burstCountAfter:1})));
 writeMode(dir,[m]);
 const stats=parseCsv(readFileSync(join(dir,'charge_idol_stats.csv'),'utf8'));expect(stats).toHaveLength(2);
 for(const row of stats)expect(row).toMatchObject({games:'1',averageMaxCharge:'5',charge3ReachedRate:'1',chargeConsumptionCount:'2',burstChargeRecoveryCount:'1',r5StageEntryRate:'1',r6BacksRate:'1',r7StageEntryRate:'1',sampleStatus:'insufficient',sufficientSamples:'false'});
 expect(stats.map(r=>r.cpuStrategy)).toEqual(['normal','charge']);
 const strategy=parseCsv(readFileSync(join(dir,'cpu_strategy_stats.csv'),'utf8'));expect(strategy.map(r=>[r.cpuStrategy,r.winRate])).toEqual([['normal','1'],['charge','0']]);
 expect(readFileSync(join(dir,'matches.csv'),'utf8')).toContain('mixed,normal,charge');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
