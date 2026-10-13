import { IDOLS } from '../data/idols';
import { SELECTABLE_SONGS } from '../data/songs';
import type { Idol } from '../game/types';
import type { Team } from './teams';
import { songFit } from './song-fit';
import { abilitySemantics } from './ability-semantics';
import { prng,seedFor } from './random';
export const META_ARCHETYPE='対単一属性メタ';
export const META_PROFILES=['対クール重視','属性変更・PLAIN重視','単一属性全般への妨害重視'];
export function metaConstructionScore(c:Idol,selected:Idol[],variant:number) {
 let score=0;const why:string[]=[];const add=(n:number,reason:string)=>{score+=n;why.push(`${reason} (+${n})`);};
    if(abilitySemantics(c).enemyAttributes)add(6,'相手の属性構成を実際に参照・妨害');
    if(c.themeTags.includes('対単一属性'))add(24,'主タグ：対単一属性');
    if(c.themeTags.includes('対クール')||/対面.*クール|相手ステージのクール/.test(c.A))add(variant===0?20:9,'対クールの人数参照・減少');
    if(/単独最多属性|同一属性が4人/.test(c.A+c.Bcond+(c.C||'')))add(variant===2?24:12,'単一属性のAUTO/BURST/CENTER条件を狙う');
    if(/PLAIN/.test(c.C||''))add(variant===1?40:5,'CENTERで相手の属性シナジーを停止');
    if(/相手メンバー全員を.*としても扱う/.test(c.B))add(variant===1?18:9,'属性追加による対属性AUTOとの連携');
    if(/AUTOを無効|CENTER SKILLを無効|ポジションボーナスを0/.test(c.A+(c.C||'')))add(variant===2?12:6,'属性シナジーを支えるスキル・位置を妨害');
    if(c.themeTags.includes('多属性'))add(variant===1?5:0,'多属性楽曲の勝ち筋を補完');
    if(c.C&&!selected.some(x=>x.C))add(8,'CENTERの勝ち筋を確保');
    if(!selected.some(x=>x.attr===c.attr))add(2,'未採用属性を補完');
    add(c.base/2,'基礎Appeal');
    if(/キュート楽曲/.test(c.Bcond))add(2,'キュート妨害楽曲でBURST条件を支援');
    return {score,reasons:why};
}
export function generateMetaArchetypes(seed:number):Team[] {
 return META_PROFILES.map((profile,variant)=>{
  const rng=prng(seedFor(seed,'single-attribute-meta',variant)),selected:Idol[]=[],reasons:Record<string,string[]>={},scores:NonNullable<Team['scores']>={};
  const jitter=new Map(IDOLS.map(c=>[c.id,rng()*2]));
  for(let slot=0;slot<8;slot++){
   let pool=IDOLS.filter(c=>!selected.includes(c));
   // Both actual anti-monotype tags form the core; no invented third tagged card.
   if(slot<2)pool=pool.filter(c=>c.themeTags.includes('対単一属性'));
   if(slot===2&&variant===1)pool=pool.filter(c=>/PLAIN/.test(c.C||''));
   const missing=['クール','キュート','ユーモア'].filter(a=>!selected.some(c=>c.attr===a));
   if(variant===1&&8-slot<=missing.length)pool=pool.filter(c=>missing.includes(c.attr));
   const ranked=pool.map(c=>{
    const {score,reasons:why}=metaConstructionScore(c,selected,variant);
    return {c,construction:score,score:score+jitter.get(c.id)!,why};
   }).sort((a,b)=>b.score-a.score||a.c.id-b.c.id);
   if(!ranked.length)throw new Error('対単一属性メタの構築条件を満たせません');
   const choice=ranked[slot<3?0:variant%Math.min(3,ranked.length)];selected.push(choice.c);reasons[String(choice.c.id)]=choice.why;scores[String(choice.c.id)]={construction:choice.construction,seedJitter:jitter.get(choice.c.id)!,ranking:choice.score};
  }
  const songs=SELECTABLE_SONGS.map(s=>{
   const fit=songFit(s,selected,'対単一属性',variant),jitter=rng();
   return {s,construction:fit.score,jitter,score:fit.score+jitter,why:fit.reasons};
  }).sort((a,b)=>b.score-a.score||a.s.id.localeCompare(b.s.id));
  const picked=songs.slice(0,3);for(const entry of picked){reasons[entry.s.id]=entry.why;scores[entry.s.id]={construction:entry.construction,seedJitter:entry.jitter,ranking:entry.score};}
  return {name:`${META_ARCHETYPE}-${String.fromCharCode(65+variant)}`,archetype:META_ARCHETYPE,members:selected.map(c=>c.id),songs:picked.map(e=>e.s.id),mainTags:['対単一属性'],subTags:variant===0?['対クール','Appeal低下']:variant===1?['多属性','対スキル']:['Appeal低下','対センター'],reasons,scores,construction:{profile,plan:variant===1?'属性変更・PLAINと3属性楽曲を組み合わせる。':'対属性人数・スキル妨害を主な勝ち筋とし、3属性は必須にしない。',caveats:selected.some(c=>/PLAIN/.test(c.C||''))?['PLAINと属性人数参照は同時に有効にならないためCENTERを使い分ける','CENTER無効曲ではPLAINも無効']:[]}};
 });
}
