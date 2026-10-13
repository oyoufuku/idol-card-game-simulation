import { compactWarResult,validateWarResult } from './war-result';
import { createHash } from 'node:crypto';
import { shuffle,GAME_RULE_VERSION } from '../game/engine';
import { byId } from '../game/formation';
import type { AblationKind } from '../game/analysis-skills';
import { INPUT_FINGERPRINT } from './input-fingerprint';
import { assertFinite,type MatchResult,type MatchSpec,type MatchOptions } from './match';
import { chooseReplacement,type Replacement } from './war-replacement';
import { prng,seedFor } from './random';
export const WAR_POLICY='paired-war-v1';
export interface WarOptions {modes:('random'|'archetype')[];detailIds:number[];samplesPerCard:number;seed:number;cardIds:number[];ablations:AblationKind[];pairs:[number,number][];topPairs:number;pairSamples:number;bootstrapIterations:number}
export interface WarJob {key:string;spec:MatchSpec;options:MatchOptions}
export interface WarTrial {mode:'random'|'archetype';cardId:number;side:0|1;baseline:number;replacement:Replacement;job:string|null;kind:'card'|AblationKind}
export interface PairTrial {mode:'random'|'archetype';cards:[number,number];side:0|1;baseline:number;replacements:[Replacement,Replacement];jobs:[string,string,string]|null}
export interface WarPlan {policy:string;fingerprint:string;options:WarOptions;matchOptions:MatchOptions;baselineHash:string;jobs:WarJob[];trials:WarTrial[];pairs:PairTrial[]}
export const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function replaceCards(spec:MatchSpec,side:0|1,swaps:[number,number][]):MatchSpec {
 const own=side===0?spec.a:spec.b,members=own.members.map(id=>swaps.find(([old])=>old===id)?.[1]??id);
 if(new Set(members).size!==8||members.length!==8||swaps.some(([old])=>!own.members.includes(old)))throw new Error('Illegal WAR replacement');
 members.forEach(byId);return {...spec,[side===0?'a':'b']:{...own,members}};
}
export function validateBaseline(result:MatchResult,options:MatchOptions) {
 if(result.inputFingerprint!==INPUT_FINGERPRINT||result.ruleVersion!==GAME_RULE_VERSION)throw new Error('WAR baseline fingerprint/rule mismatch');
 if(!!result.fastSimulation!==!!options.fastSimulation)throw new Error('WAR baseline fast setting mismatch');
 const expected=options.cpuSearch?.mode==='two-stage'?options.cpuSearch:null;
 if(hash(result.cpuSearch??null)!==hash(expected))throw new Error('WAR baseline CPU search mismatch');
 if(result.rounds!==7||result.roundAppeals.length!==7||result.formations.length!==7||result.songs.length!==7)throw new Error('WAR baseline must contain all seven rounds');
 if(hash(result.cpuStrategies??['normal','normal'])!==hash(result.spec.cpuStrategies??['normal','normal']))throw new Error('WAR baseline CPU strategy mismatch');
 assertFinite(result);validateWarResult(compactWarResult(result));
}
export function buildWarPlan(baselines:MatchResult[],options:WarOptions,matchOptions:MatchOptions={}):WarPlan {
 baselines.forEach(r=>validateBaseline(r,matchOptions));
 const jobs=new Map<string,WarJob>(),trials:WarTrial[]=[],pairs:PairTrial[]=[];
 const job=(spec:MatchSpec,masks:NonNullable<MatchOptions['skillAblations']>=[])=>{
  const opts={...matchOptions,...(masks.length?{skillAblations:masks}:{})},key=hash({spec,options:opts,fingerprint:INPUT_FINGERPRINT,policy:WAR_POLICY});
  jobs.set(key,{key,spec,options:opts});return key;
 };
 // Sample mirror clusters together where available. The limit counts actual
 // team appearances, so an odd limit can include one member of the final pair.
 const sample=(rows:{baseline:number;side:0|1}[],limit:number,label:string)=>{
  const groups=new Map<string,typeof rows>();
  for(const row of rows){const spec=baselines[row.baseline].spec,key=hash({mode:spec.mode,pairId:spec.pairId,seed:spec.seed,a:spec.a,b:spec.b,side:row.side,strategies:spec.cpuStrategies??null});groups.set(key,[...(groups.get(key)||[]),row]);}
  return shuffle([...groups.entries()].sort(([a],[b])=>a.localeCompare(b)),prng(seedFor(options.seed,'war-sample',label))).flatMap(([,g])=>g.sort((a,b)=>Number(baselines[a.baseline].spec.mirror)-Number(baselines[b.baseline].spec.mirror))).slice(0,limit);
 };
 const modes=options.modes;
 const ids=options.cardIds.length?[...options.cardIds].sort((a,b)=>a-b):Array.from({length:48},(_,i)=>i+1);ids.forEach(byId);
 for(const mode of modes)for(const id of ids){
  const available=baselines.flatMap((r,baseline)=>r.spec.mode!==mode?[]:([0,1] as const).filter(side=>(side===0?r.spec.a:r.spec.b).members.includes(id)).map(side=>({baseline,side})));
  for(const {baseline,side} of sample(available,options.samplesPerCard,`${mode}:card:${id}`)){
   const spec=baselines[baseline].spec,team=side===0?spec.a:spec.b,replacement=chooseReplacement(team,id,mode,options.seed);
   trials.push({mode,cardId:id,side,baseline,replacement,job:replacement.id===null?null:job(replaceCards(spec,side,[[id,replacement.id]])),kind:'card'});
   for(const kind of options.detailIds.includes(id)?options.ablations:[]){
    const applicable=kind!=='CENTER'||!!byId(id).C;
    trials.push({mode,cardId:id,side,baseline,replacement:{id:null,tier:applicable?'skillAblation':'notApplicable',reason:kind,candidates:[]},job:applicable?job(spec,[{team:side===0?'A':'B',id,kind}]):null,kind});
   }
  }
 }
 for(const mode of modes){
  const frequencies=new Map<string,{cards:[number,number];count:number}>();
  for(const r of baselines.filter(r=>r.spec.mode===mode))for(const t of [r.spec.a,r.spec.b])for(const [i,a] of t.members.entries())for(const b of t.members.slice(i+1)){const cards=[Math.min(a,b),Math.max(a,b)] as [number,number],key=cards.join(':');const f=frequencies.get(key)||{cards,count:0};f.count++;frequencies.set(key,f);}
  const selected=new Map<string,[number,number]>();
  for(const pair of [...options.pairs,...[...frequencies.values()].sort((a,b)=>b.count-a.count||a.cards[0]-b.cards[0]||a.cards[1]-b.cards[1]).slice(0,options.topPairs).map(f=>f.cards)]){const cards=pair.slice().sort((a,b)=>a-b) as [number,number];cards.forEach(byId);if(cards[0]===cards[1])throw new Error('WAR pair must have different cards');selected.set(cards.join(':'),cards);}
  for(const cards of [...selected.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1])){
   const available=baselines.flatMap((r,baseline)=>r.spec.mode!==mode?[]:([0,1] as const).filter(side=>cards.every(id=>(side===0?r.spec.a:r.spec.b).members.includes(id))).map(side=>({baseline,side})));
   for(const {baseline,side} of sample(available,options.pairSamples,`${mode}:pair:${cards.join(':')}`)){
    const spec=baselines[baseline].spec,team=side===0?spec.a:spec.b;
    const ra=chooseReplacement(team,cards[0],mode,options.seed),joint=ra.id===null?team:{...team,members:team.members.map(id=>id===cards[0]?ra.id!:id)},rb=chooseReplacement(team,cards[1],mode,options.seed,ra.id===null?[]:[ra.id],joint);
    const keys=ra.id===null||rb.id===null?null:[job(replaceCards(spec,side,[[cards[0],ra.id]])),job(replaceCards(spec,side,[[cards[1],rb.id]])),job(replaceCards(spec,side,[[cards[0],ra.id],[cards[1],rb.id]]))] as [string,string,string];
    pairs.push({mode,cards,side,baseline,replacements:[ra,rb],jobs:keys});
   }
  }
 }
 return {policy:WAR_POLICY,fingerprint:INPUT_FINGERPRINT,options,matchOptions,baselineHash:hash(baselines),jobs:[...jobs.values()],trials,pairs};
}
