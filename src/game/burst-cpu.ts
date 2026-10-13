import type { Formation, Game, Player } from './types';
import { SLOTS } from './types';
import { clonePlayer, executeRound, nextRound, createCpuPreview } from './engine';
import { validateFormation } from './formation';
import { formationCandidates } from './cpu-candidates';
import { evaluateCpuFormation } from './cpu';
import { cpuSearchConfiguration, type CpuSearchOptions } from './cpu-search';
import { songById } from '../data/songs';
import { setRandomSources } from './random-source';
import { scoreRound } from './scoring';
import { prng, seedFor } from './seeded-random';

export const BURST_CPU_POLICY = 'burst-public-one-round-v1';
export interface BurstForecast {
 currentPoints: number; currentOutcome: number; currentDifference: number;
 nextPoints: number; nextOutcome: number; nextDifference: number;
 nextAppeal: number; nextOpponentAppeal: number; nextSongs: string[];
 nextFinalOutcome: number;
 predictedBursts: {side:1|2;id:number;normal:number;forced:number}[];
 recoverable: boolean; utility: number; fatigue: number;
}
export interface BurstEvaluation extends BurstForecast {formation:Formation;total:number;opponentTotal:number;checked:number;screened:number;policy:string}
// An estimate against a public reference formation, not a calibrated win rate.
export function burstUtility(current: {points:number;outcome:number;difference:number}, next: {points:number;outcome:number;difference:number}) {
 const value=(v:typeof current)=>12*v.points+2*v.outcome+.25*v.difference;
 return value(current)+.6*value(next);
}
function silentLogs():string[] {const logs:string[]=[];logs.push=()=>0;return logs;}
function targets(p:Player,opp:Player){return {koji:p.ids[0],matono:opp.ids[0],kousaka:opp.ids[0]};}
/** Construct explicitly: never copy/read the live game, secret deck or targets. */
function publicProbe(game:Game):Game {
 if(!game.publicPlayers)throw new Error('公開済みラウンド開始状態がありません');
 const p1=clonePlayer(game.publicPlayers[0]),p2=clonePlayer(game.publicPlayers[1]);
 return {round:game.round,done:false,cpuMode:false,cpuLocked:false,cpuBoth:true,p1,p2,
  songDeck:[],roundSong:{...game.roundSong},roundResolved:false,targets:[targets(p1,p2),targets(p2,p1)],logs:silentLogs(),result:null,
  playedSongs:game.playedSongs?[...game.playedSongs]:[game.roundSong.id]};
}
function forecastRandom(game:Game) {
 // Public state only; common random numbers across candidates, isolated from
 // the actual game's effect/tie streams. Random BURST targets are one sample.
 const seed=seedFor(13,BURST_CPU_POLICY,game.round,game.p1.ids.join(','),game.p2.ids.join(','));
 setRandomSources(game,{players:[prng(seedFor(seed,'P1')),prng(seedFor(seed,'P2'))]});
 return prng(seedFor(seed,'round'));
}
export function publicNextSongs(game:Game):string[] {
 if(game.round>=7)return [];
 if(game.songOverride)return [game.songOverride];
 if(game.round===6){const {p1,p2}=game;return [...(p1.points<p2.points?p1.songs:p2.points<p1.points?p2.songs:[...p1.songs,...p2.songs])];}
 const pool=[...game.p1.songs,...game.p2.songs];
 for(const id of game.playedSongs??[game.roundSong.id]){
  if(songById(id).selectable===false)continue;
  const index=pool.indexOf(id);if(index>=0)pool.splice(index,1);
 }
 return pool.length?pool:[...game.p1.songs,...game.p2.songs];
}
/** Bounded next-round replies: hold, stage swaps, individual and group entries.
 * The opponent stays at its public reference + any engine-forced movements. */
export function futureFormations(p:Player):Formation[] {
 const result:Formation[]=[];
 const add=(f:Formation)=>{if(!validateFormation(p,f))result.push(f);};
 add({...p.formation});
 for(let i=0;i<SLOTS.length;i++)for(let j=i+1;j<SLOTS.length;j++){
  const a=SLOTS[i],b=SLOTS[j],f={...p.formation};[f[a],f[b]]=[f[b],f[a]];add(f);
 }
 const backs=p.ids.filter(id=>!Object.values(p.formation).includes(id));
 for(const id of backs)for(const slot of SLOTS)add({...p.formation,[slot]:id});
 // Include simultaneous entries: one-card-only replies miss Murai's three
 // entrants and a full charge core returning for ENCORE. This is still bounded
 // forecasting, not an exhaustive second-round search (at most 86 replies).
 for(let a=0;a<backs.length;a++)for(let b=a+1;b<backs.length;b++)for(let i=0;i<SLOTS.length;i++)for(let j=i+1;j<SLOTS.length;j++)add({...p.formation,[SLOTS[i]]:backs[a],[SLOTS[j]]:backs[b]});
 if(backs.length===3)for(let i=0;i<SLOTS.length;i++)for(let j=i+1;j<SLOTS.length;j++)for(let k=j+1;k<SLOTS.length;k++)for(let rotate=0;rotate<3;rotate++)add({...p.formation,[SLOTS[i]]:backs[rotate],[SLOTS[j]]:backs[(rotate+1)%3],[SLOTS[k]]:backs[(rotate+2)%3]});
 return result;
}
function nextProbe(ended:Game,song:string):Game {
 const p1=clonePlayer(ended.p1),p2=clonePlayer(ended.p2);
 const game:Game={round:ended.round,done:false,cpuMode:false,cpuLocked:false,cpuBoth:true,p1,p2,
  roundResolved:true,roundSong:{...ended.roundSong},songDeck:[song],encoreSong:songById(song),
  targets:[targets(p1,p2),targets(p2,p1)],logs:silentLogs(),result:null,
  songOverride:ended.songOverride,songAttributeOverride:ended.songAttributeOverride};
 nextRound(game,forecastRandom(game));return game;
}
export function forecastBurstFormation(game:Game,side:1|2,formation:Formation,screening=false):Omit<BurstEvaluation,'checked'|'screened'|'policy'> {
 const probe=publicProbe(game),before=[probe.p1,probe.p2].map(p=>p.ids.map(id=>[id,p.states[id].burstCount,p.states[id].forcedBurstCount] as const));
 const result=executeRound(probe,side===1?formation:probe.p1.formation,side===2?formation:probe.p2.formation,forecastRandom(probe),{detailedAppeal:false});
 const own=side===1?probe.p1:probe.p2,opp=side===1?probe.p2:probe.p1;
 const total=side===1?result.p1.total:result.p2.total,opponentTotal=side===1?result.p2.total:result.p1.total;
 const score=scoreRound(total,opponentTotal,game.round),currentOutcome=score.winner===1?1:score.winner===2?-1:0,currentPoints=currentOutcome*score.points,currentDifference=total-opponentTotal;
 const predictedBursts:BurstForecast['predictedBursts']=[];
 for(const [index,p] of [probe.p1,probe.p2].entries())for(const [id,count,forced] of before[index]){
  const now=p.states[id],delta=now.burstCount-count,forcedDelta=now.forcedBurstCount-forced;
  if(delta)predictedBursts.push({side:(index+1) as 1|2,id,normal:delta-forcedDelta,forced:forcedDelta});
 }
 const songs=publicNextSongs(probe),evaluatedSongs=screening?songs.slice(0,1):songs;
 let nextPoints=0,nextOutcome=0,nextDifference=0,nextAppeal=0,nextOpponentAppeal=0,nextFinalOutcome=0;
 // Duplicates are weights in the public normal/ENCORE pool; calculate once.
 const cache=new Map<string,{points:number;outcome:number;difference:number;total:number;opponentTotal:number}>();
 for(const song of evaluatedSongs){let best=cache.get(song);
  if(!best){
   const future=nextProbe(probe,song),p=side===1?future.p1:future.p2,predict=createCpuPreview(future,false,side);
   for(const f of screening?[p.formation]:futureFormations(p)){
    const prediction=predict(side===1?f:future.p1.formation,side===2?f:future.p2.formation);
    const a=side===1?prediction.p1.total:prediction.p2.total,b=side===1?prediction.p2.total:prediction.p1.total,s=scoreRound(a,b,future.round),outcome=s.winner===1?1:s.winner===2?-1:0;
    const candidate={points:outcome*s.points,outcome,difference:a-b,total:a,opponentTotal:b};
    if(!best||candidate.points>best.points||(candidate.points===best.points&&(candidate.outcome>best.outcome||(candidate.outcome===best.outcome&&candidate.difference>best.difference))))best=candidate;
   }
   if(!best)throw new Error('次回の合法な予測配置がありません');cache.set(song,best);
  }
  nextPoints+=best.points;nextOutcome+=best.outcome;nextDifference+=best.difference;nextAppeal+=best.total;nextOpponentAppeal+=best.opponentTotal;
  if(game.round===6)nextFinalOutcome+=Math.sign(own.points-opp.points+best.points||own.totalAppeal-opp.totalAppeal+best.difference);
 }
 const n=evaluatedSongs.length||1;nextPoints/=n;nextOutcome/=n;nextDifference/=n;nextAppeal/=n;nextOpponentAppeal/=n;nextFinalOutcome/=n;
 const remaining=game.round<7?2*Math.max(0,6-game.round)+3:0;
 return {formation:{...formation},total,opponentTotal,currentPoints,currentOutcome,currentDifference,nextPoints,nextOutcome,nextDifference,nextAppeal,nextOpponentAppeal,nextFinalOutcome,nextSongs:songs,predictedBursts,
  recoverable:own.points-opp.points+remaining>=0,fatigue:own.ids.reduce((n,id)=>n+own.states[id].fatigue,0),
  utility:burstUtility({points:currentPoints,outcome:currentOutcome,difference:currentDifference},{points:nextPoints,outcome:nextOutcome,difference:nextDifference})+40*nextFinalOutcome};
}
function compare(a:BurstForecast,b:BurstForecast){return +a.recoverable-+b.recoverable||a.utility-b.utility||b.fatigue-a.fatigue;}
export function evaluateBurstFormation(game:Game,side:1|2,random=Math.random,search:CpuSearchOptions={mode:'two-stage',previewCandidates:100}):BurstEvaluation {
 const configuration=cpuSearchConfiguration(search);
 if(game.round===7){const normal=evaluateCpuFormation(game,side,random,configuration),forecast=forecastBurstFormation(game,side,normal.formation);return {...forecast,checked:normal.checked,screened:normal.checked,policy:BURST_CPU_POLICY};}
 if(!game.publicPlayers)throw new Error('公開済みラウンド開始状態がありません');
 const p=game.publicPlayers[side-1],legal=formationCandidates(p.ids).filter(f=>!validateFormation(p,f));
 let candidates=legal;
 if(configuration.mode==='two-stage'){
  const ranked=legal.map((formation,order)=>({formation,order,value:forecastBurstFormation(game,side,formation,true)}));
  ranked.sort((a,b)=>compare(b.value,a.value)||a.order-b.order);
  candidates=ranked.slice(0,configuration.previewCandidates).sort((a,b)=>a.order-b.order).map(row=>row.formation);
 }
 let best:ReturnType<typeof forecastBurstFormation>|undefined,ties=0;
 for(const formation of candidates){const value=forecastBurstFormation(game,side,formation),comparison=best?compare(value,best):1;
  if(comparison>0){best=value;ties=1;}else if(comparison===0&&random()<1/++ties)best=value;
 }
 if(!best)throw new Error('CPUが合法な配置を見つけられませんでした。');
 return {...best,checked:candidates.length,screened:legal.length,policy:BURST_CPU_POLICY};
}
