import { setAnalysisSkillMasks,type AblationKind } from '../game/analysis-skills';
import { GAME_RULE_VERSION, createGame, executeRound, nextRound, shuffle } from '../game/engine';
import { evaluateCpuFormation } from '../game/cpu';
import { evaluateBurstFormation,type BurstEvaluation } from '../game/burst-cpu';
import { prng, seedFor } from './random';
import type { Team } from './teams';
import type { Player, Formation } from '../game/types';
import { evaluateChargeFormation,assertChargePolicy,type CpuStrategy } from './charge-cpu';
import { chargeBefore,chargeRoundTrace,traceFormationPosition,type ChargeRound } from './charge-trace';
import { INPUT_FINGERPRINT } from './input-fingerprint';
import { cpuSearchConfiguration,type CpuSearchOptions } from '../game/cpu-search';
export interface MatchSpec {mode:'random'|'archetype';pairId:string;seed:number;mirror:boolean;a:Team;b:Team;cpuStrategies?:[CpuStrategy,CpuStrategy];cpuPolicy?:string}
export interface MatchOptions {fastSimulation?:boolean;cpuSearch?:CpuSearchOptions;recordBurstRounds?:boolean;skillAblations?:{team:'A'|'B';id:number;kind:AblationKind}[]}
export interface BurstRound {round:number;side:0|1;id:number;normal:number;forced:number}
export interface BurstPlanningRound extends BurstEvaluation {round:number;team:'A'|'B'}
export interface MatchResult {burstPlanningTrace?:BurstPlanningRound[];burstRoundTrace?:BurstRound[];cpuSearch?:ReturnType<typeof cpuSearchConfiguration>;fastSimulation?:boolean;inputFingerprint?:string;cpuStrategy?:CpuStrategy|'mixed';cpuStrategies?:[CpuStrategy,CpuStrategy];chargeTrace?:ChargeRound[];ruleVersion?:string;spec:MatchSpec;winner:'A'|'B'|'draw';rounds:number;pointsA:number;pointsB:number;appealA:number;appealB:number;burstA:number;burstB:number;forcedBurstA:number;forcedBurstB:number;players:[Player,Player];songs:string[];roundAppeals:[number,number][];formations:[Formation,Formation][]}
export function mirror(spec:MatchSpec):MatchSpec{return {...spec,mirror:!spec.mirror};}
export function assertFinite(value:unknown,path='result'):void{
 if(value===undefined)throw new Error(`undefined: ${path}`);
 if(typeof value==='number'&&!Number.isFinite(value))throw new Error(`non-finite: ${path}`);
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))assertFinite(v,`${path}.${k}`);
}
export function runMatch(spec:MatchSpec,options:MatchOptions={}):MatchResult{
 assertChargePolicy(spec);
 const fast=!!options.fastSimulation,search=cpuSearchConfiguration(options.cpuSearch??(spec.cpuStrategies?.includes('burst')?{mode:'two-stage',previewCandidates:100}:{}));
 const rng=prng(seedFor(spec.seed,'engine')), first=spec.mirror?spec.b:spec.a,second=spec.mirror?spec.a:spec.b;
 const deck=shuffle([...spec.a.songs,...spec.b.songs],prng(seedFor(spec.seed,'deck')));
 const streams=[prng(seedFor(spec.seed,'A-effects')),prng(seedFor(spec.seed,'B-effects'))] as [()=>number,()=>number];
 const g=createGame(first.members,second.members,first.songs,second.songs,'local',rng,{songDeck:deck,encorePool:[...spec.a.songs,...spec.b.songs],recordEffects:!fast,...(options.skillAblations?.length?{configureAnalysisPlayers:(p1:Player,p2:Player)=>{for(const [side,p] of [['A',spec.mirror?p2:p1],['B',spec.mirror?p1:p2]] as const)setAnalysisSkillMasks(p,options.skillAblations!.filter(e=>e.team===side));}}:{}),randomSources:{players:spec.mirror?[streams[1],streams[0]]:streams}});g.cpuBoth=true;
 const strategies=spec.cpuStrategies??['normal','normal'],trace:ChargeRound[]=[];
 const planning:BurstPlanningRound[]=[];if(strategies.includes('burst'))g.playedSongs=[g.roundSong.id];
 const choose=(side:1|2,round:number)=>{const team=(side===1)!==spec.mirror?0:1,random=prng(seedFor(spec.seed,'cpu',round,team===0?'A':'B'));
  if(strategies[team]==='burst'){const e=evaluateBurstFormation(g,side,random,search);planning.push({...e,round,team:team===0?'A':'B'});return e.formation;}
  return (strategies[team]==='charge'?evaluateChargeFormation(g,side,random,search):evaluateCpuFormation(g,side,random,search)).formation;};
 const burstRoundTrace:BurstRound[]=[],logicalPlayers=spec.mirror?[g.p2,g.p1]:[g.p1,g.p2];
 const songs:string[]=[],roundAppeals:[number,number][]=[],formations:[Formation,Formation][]=[];
 for(let round=1;round<=7;round++){
  const burstBefore=options.recordBurstRounds?logicalPlayers.map(p=>new Map(p.ids.map(id=>[id,{total:p.states[id].burstCount,forced:p.states[id].forcedBurstCount}]))):undefined;
  const before=fast?undefined:chargeBefore([g.p1,g.p2]);
  const f1=choose(1,round),f2=choose(2,round);
  formations.push(spec.mirror?[f2,f1]:[f1,f2]);
  songs.push(g.roundSong.id);
  const r=executeRound(g,f1,f2,rng);roundAppeals.push(spec.mirror?[r.p2.total,r.p1.total]:[r.p1.total,r.p2.total]);
  if(burstBefore)for(const side of [0,1] as const){const p=logicalPlayers[side];for(const id of p.ids){const previous=burstBefore[side].get(id)!,current=p.states[id],forced=current.forcedBurstCount-previous.forced,total=current.burstCount-previous.total;if(total)burstRoundTrace.push({round,side,id,normal:total-forced,forced});}}
  if(before){
   const rows=chargeRoundTrace(g,before,spec.mirror,strategies);
   for(const row of rows){const teamSide=row.team==='A'?0:1,physicalSide=spec.mirror?1-teamSide:teamSide;row.position=traceFormationPosition(formations[round-1][teamSide],row.id);row.entered=round>1&&before.get(`${physicalSide}:${row.id}`)!.previousPosition==='BACK'&&row.position!=='BACK';}
   trace.push(...rows);
  }
  if(round<7)nextRound(g,rng);
 }
 if(!g.done)throw new Error('試合が7ラウンドで完了しません');
 const a=spec.mirror?g.p2:g.p1,b=spec.mirror?g.p1:g.p2;
 const comparison=a.points-b.points||a.totalAppeal-b.totalAppeal;
 const burst=(p:Player)=>p.ids.reduce((n,id)=>n+p.states[id].burstCount,0),forced=(p:Player)=>p.ids.reduce((n,id)=>n+p.states[id].forcedBurstCount,0);
 const result:MatchResult={...(strategies.includes('burst')?{burstPlanningTrace:planning}:{}),...(options.recordBurstRounds?{burstRoundTrace}:{}),...(search.mode==='two-stage'?{cpuSearch:search}:{}),inputFingerprint:INPUT_FINGERPRINT,cpuStrategies:strategies,cpuStrategy:strategies[0]===strategies[1]?strategies[0]:'mixed',...(fast?{fastSimulation:true}:{chargeTrace:trace}),ruleVersion:GAME_RULE_VERSION,spec,winner:comparison>0?'A':comparison<0?'B':'draw',rounds:7,pointsA:a.points,pointsB:b.points,appealA:a.totalAppeal,appealB:b.totalAppeal,burstA:burst(a),burstB:burst(b),forcedBurstA:forced(a),forcedBurstB:forced(b),players:[a,b],songs,roundAppeals,formations};
 assertFinite(result);
 for(const p of result.players)for(const id of p.ids){const s=p.states[id];
  if(Object.values(s.stats.positions).reduce((a,b)=>a+b,0)!==7||s.stats.auto>7||s.stats.center>s.stats.positions.CENTER)throw new Error(`Invalid event counts: ${spec.pairId}, idol ${id}`);
 }
 return result;
}
