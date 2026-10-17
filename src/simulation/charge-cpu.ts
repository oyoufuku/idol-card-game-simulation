// Simulation-only policy. The browser's CPU and recommendation evaluator stay unchanged.
import { SLOTS,type Formation,type Game,type Player,type Outcome } from '../game/types';
import { evaluateCpuFormation,compareCpuEvaluations,type CpuEvaluation } from '../game/cpu';
import { cpuCandidates,type CpuSearchOptions } from '../game/cpu-search';
import { clonePlayer,preview,createCpuPreview } from '../game/engine';
import { byId,posOf,validateFormation } from '../game/formation';
import { applyFatigueAndPost } from '../game/fatigue';
import { resolveCenterSkills } from '../game/appeal';
import { finishPerformance } from '../game/performance';
import { calculationContext } from '../game/context';
import { applyBurst } from '../game/burst';
import { scoreRound } from '../game/scoring';
import { skillFor } from '../game/skills';
import { prng,seedFor } from './random';
import { setRandomSources } from '../game/random-source';
export type CpuStrategy='normal'|'charge'|'burst';
export const CHARGE_POLICY='charge-v4-score-tradeoff';
export const hasChargeTag=(id:number)=>byId(id).themeTags.includes('チャージ');
export const chargeConsumers=(p:Player)=>p.ids.filter(id=>hasChargeTag(id)&&skillFor(id,p).chargeConsumer);
export interface ChargeEvaluation extends CpuEvaluation {utility:number;futureValue:number;recoverable:boolean;finalOutcome:number;checked:number}
export interface ChargeFuture {stored:number;reuse:number}
/** No action bonuses: charge spent now is already in current Appeal. The
 * inventory includes end-of-round accumulation and any actual B recovery once.
 * At most 9 utility units (< one point's 12) may be credited to uncertain future
 * charge. R5 discounts postponement; R6 values a final R7 entry; R7 has no future. */
export function chargeUtility(round:number,current:CpuEvaluation,future:ChargeFuture) {
 const currentValue=(current.outcome>0?current.points:current.outcome<0?-((Math.abs(current.difference)>=10?2:1)+(round===7?1:0)):0)*12+current.outcome*3+current.difference*.45-current.fatigue*.08;
 const weight=round<=4?.9:round===5?.3:round===6?.65:0;
 const futureValue=Math.min(9,Math.max(0,(future.stored+future.reuse)*weight));
 return {utility:currentValue+futureValue,futureValue};
}
/** Old CHARGE games must never become the actual side of new-policy WAR. */
export function assertChargePolicy(spec:{cpuStrategies?:CpuStrategy[];cpuPolicy?:string}) {
 const components=spec.cpuPolicy?.split('+')??[],charge=components.filter(c=>c.startsWith('charge-'));
 if((spec.cpuStrategies?.includes('charge')||charge.length)&&
    (charge.length!==1||charge[0]!==CHARGE_POLICY))throw Error('CHARGE CPU policy mismatch: new baseline required');
}
/** Value the next charge entry with the actual AUTO/Appeal/fatigue preparation.
 * This is a public-state hypothetical, not a forecast of an unknown enemy formation/song. */
export function chargeEntryValue(view:Game,side:1|2,id:number,charge:number):number {
 if(charge<=0)return 0;
 const p=side===1?view.p1:view.p2;let best=0;
 for(const slot of SLOTS){
  const own=clonePlayer(p),formation={...own.formation},old=Object.keys(formation).find(key=>formation[key as keyof Formation]===id) as keyof Formation|undefined;
  if(old){formation[old]=formation[slot];}formation[slot]=id;
  if(validateFormation(own,formation))continue;
  own.states[id].prevPos='BACK';own.states[id].charge=charge;
  const probe={...view,round:Math.max(2,view.round),p1:side===1?own:view.p1,p2:side===2?own:view.p2};
  const charged=preview(probe,side===1?formation:probe.p1.formation,side===2?formation:probe.p2.formation,false);
  own.states[id].charge=0;
  const zero=preview(probe,side===1?formation:probe.p1.formation,side===2?formation:probe.p2.formation,false);
  const diff=(r:typeof zero)=>side===1?r.p1.total-r.p2.total:r.p2.total-r.p1.total;
  best=Math.max(best,diff(charged)-diff(zero));
 }
 // Immunity, Appeal floors and existing fatigue are resolved by the engine.
 // No positive minimum for a charge that has no effective use in this state.
 return best;
}
/** One opportunity for a card already in BACKS, otherwise a rest is needed.
 * The small reuse option represents one later normal-B recovery, only when
 * there is time to enter twice. It is not a second copy of a recovered charge. */
export function chargeInventoryFuture(round:number,p:Player,consumers:number[],value:(id:number,n:number)=>number):ChargeFuture {
 const future:ChargeFuture={stored:0,reuse:0};
 for(const id of consumers){
  const state=p.states[id],rest=posOf(p,id)==='BACK'?0:1,opportunities=7-round-rest;
  if(opportunities<1)continue;
  const effective=value(id,state.charge)*(rest?.5:1);
  future.stored+=effective;
  if(opportunities>=2&&!state.normalUsed&&state.charge>=3&&skillFor(id,p).condition)future.reuse+=effective*.25;
 }
 return future;
}
export function evaluateChargeFormation(game:Game,side:1|2,random:()=>number,search:CpuSearchOptions={}):ChargeEvaluation|ReturnType<typeof evaluateCpuFormation> {
 if(!game.publicPlayers)throw new Error('公開済みラウンド開始状態がありません');
 const view={...game,p1:game.publicPlayers[0],p2:game.publicPlayers[1]},player=side===1?view.p1:view.p2,consumers=chargeConsumers(player);
 if(!consumers.length)return evaluateCpuFormation(game,side,random,search);
 const predict=createCpuPreview(view,true,side);
 const values=new Map<string,number>(),value=(id:number,n:number)=>{const key=`${id}:${n}`;if(!values.has(key))values.set(key,chargeEntryValue(view,side,id,n));return values.get(key)!;};
 let best:ChargeEvaluation|null=null,checked=0,ties=0;
 const candidates=cpuCandidates(view,side,search,e=>{
  // Isolate telemetry because the shared post hook records AUTO statistics.
  // This cheap pass resolves real BACKS charge/support, without full Appeal or
  // reaction-B search. The same marginal-value table is used by the final pass.
  const own=clonePlayer(e.players[side-1]),opp=clonePlayer(e.players[2-side]);
  finishPerformance(own,opp,game.roundSong);
  const future=chargeInventoryFuture(game.round,own,consumers,value);
  const signedPoints=e.outcome*(e.outcome===1?e.points:(Math.abs(e.difference)>=10?2:1)+(game.round===7?1:0)),remaining=game.round<7?(6-game.round)*2+3:0;
  const final=Math.sign(player.points-opp.points+signedPoints||player.totalAppeal+e.total-opp.totalAppeal-e.opponentTotal),recoverable=+(player.points-opp.points+signedPoints+remaining>=0);
  return [recoverable,...(game.round===7?[final,e.points,e.outcome]:[]),chargeUtility(game.round,e,future).utility,e.points,e.outcome,e.difference,-e.fatigue];
 });
 for(const formation of candidates){
  if(validateFormation(player,formation))continue;checked++;
  const prediction=predict(side===1?formation:view.p1.formation,side===2?formation:view.p2.formation);
  const ownResult=side===1?prediction.p1:prediction.p2,enemyResult=side===1?prediction.p2:prediction.p1;
  const score=scoreRound(ownResult.total,enemyResult.total,game.round),outcome=score.winner===1?1:score.winner===2?-1:0;
  const [p1,p2]=prediction.players,[c1,c2]=resolveCenterSkills(p1,p2,game.roundSong),o1:Outcome=prediction.p1.total>prediction.p2.total?'win':prediction.p1.total<prediction.p2.total?'loss':'draw';
  applyFatigueAndPost(p1,p2,o1,c1,game.roundSong);applyFatigueAndPost(p2,p1,o1==='win'?'loss':o1==='loss'?'win':'draw',c2,game.roundSong);
  const own=prediction.players[side-1],opp=prediction.players[2-side],fatigue=own.ids.reduce((sum,id)=>sum+own.states[id].fatigue,0);
  finishPerformance(p1,p2,game.roundSong);finishPerformance(p2,p1,game.roundSong);
  // Hypothetical reaction BURSTs must never consume the live effect streams.
  const forecastSources=[prng(seedFor(0,'charge-forecast',game.round,1)),prng(seedFor(0,'charge-forecast',game.round,2))] as [()=>number,()=>number];
  const probe:Game={...view,p1,p2,cpuBoth:true,logs:[],skillEffects:undefined,burstTask:undefined,pendingBursts:undefined,burstChain:[],burstSeen:[]};
  setRandomSources(probe,{players:forecastSources});
  // Reuse the card's real condition and B; do not invent charge consumption/recovery rules.
  if(game.round<7)for(const id of own.ids.filter(hasChargeTag))if(!own.states[id].normalUsed&&skillFor(id,own).condition?.(calculationContext(own,opp,id,game.roundSong)))applyBurst(probe,own,opp,id,false,forecastSources[side-1]);
  const future=chargeInventoryFuture(game.round,own,consumers,value);
  const current:CpuEvaluation={formation,total:ownResult.total,opponentTotal:enemyResult.total,points:outcome===1?score.points:0,outcome,difference:ownResult.total-enemyResult.total,fatigue};
  const signedPoints=outcome*score.points,remaining=game.round<7?(6-game.round)*2+3:0;
  const ownPoints=player.points+(outcome>0?score.points:0),enemyPoints=opp.points+(outcome<0?score.points:0);
  const finalOutcome=Math.sign(ownPoints-enemyPoints||player.totalAppeal+ownResult.total-(opp.totalAppeal+enemyResult.total));
  const candidate:ChargeEvaluation={...current,...chargeUtility(game.round,current,future),recoverable:player.points-opp.points+signedPoints+remaining>=0,finalOutcome,checked};
  const comparison=!best?1:+candidate.recoverable-+best.recoverable||
   (game.round===7?(candidate.finalOutcome-best.finalOutcome||candidate.points-best.points||candidate.outcome-best.outcome):0)||
   (candidate.utility-best.utility)||compareCpuEvaluations(candidate,best);
  if(comparison>0){best=candidate;ties=1;}else if(comparison===0&&random()<1/++ties)best=candidate;
 }
 if(!best)throw new Error('CHARGE CPUが合法な配置を見つけられませんでした');
 return {...best,formation:{...best.formation},checked};
}
