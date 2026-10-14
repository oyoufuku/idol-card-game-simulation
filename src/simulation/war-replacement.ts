import { IDOLS } from '../data/idols';
import { byId } from '../game/formation';
import { constructionScore,type Team } from './teams';
import { chargeCore,chargeSupportPolicy } from './charge-team-policy';
import {usesTheme} from './ability-semantics';
import { META_ARCHETYPE,META_PROFILES,metaConstructionScore } from './meta-teams';
import { prng,seedFor } from './random';
import {isConstructedTeam} from './constructed-teams';
export interface Replacement {id:number|null;tier:string;reason:string;candidates:number[]}
export function replacementEligible(team:Team,target:number,candidate:number) {
 if(team.members.includes(candidate)||!team.members.includes(target))return false;
 const rest=team.members.filter(id=>id!==target).map(byId),card=byId(candidate),tag=team.mainTags[0];
 if(isConstructedTeam(team)){
  if(team.construction?.fixedMembers?.includes(target))return false;
  if((tag==='櫻坂46'||tag==='日向坂46')&&card.group!==tag)return false;
 }
 if(tag==='チャージ') {
  if(chargeCore().some(c=>c.id===target)||chargeSupportPolicy(card).excluded.length)return false;
  if(![...rest,card].some(c=>c.C))return false;
 }
 if(team.archetype===META_ARCHETYPE) {
  if([...rest,card].filter(c=>c.themeTags.includes('対単一属性')).length<2)return false;
  if(team.construction?.profile===META_PROFILES[1]&&new Set([...rest,card].map(c=>c.attr)).size<3)return false;
  if(team.construction?.profile===META_PROFILES[1]&&/PLAIN/.test(byId(target).C||'')&&!/PLAIN/.test(card.C||''))return false;
 } else if(tag){
  const originalRequired=team.members.map(byId).filter(c=>c.themeTags.includes(tag)&&usesTheme(c,tag)).length,required=isConstructedTeam(team)?originalRequired:3;
  if([...rest,card].filter(c=>c.themeTags.includes(tag)&&usesTheme(c,tag)).length<required)return false;
 }
 if(tag==='多属性'&&new Set([...rest,card].map(c=>c.attr)).size<3)return false;
 // Keep the last existing CENTER role, without inventing a new requirement.
 if(byId(target).C&&!rest.some(c=>c.C)&&!card.C)return false;
 return true;
}
export function chooseReplacement(team:Team,target:number,mode:'random'|'archetype',warSeed:number,excluded:number[]=[],eligibilityTeam:Team=team):Replacement {
 const card=byId(target),available=IDOLS.filter(c=>!team.members.includes(c.id)&&!excluded.includes(c.id));
 if(mode==='random') {
  const tiers:[string,(c:typeof card)=>boolean][]=[
   ['sameAttribute_baseWithin1',c=>c.attr===card.attr&&Math.abs(c.base-card.base)<=1],
   ['sameAttribute_relaxedBase',c=>c.attr===card.attr],
   ['anyAttribute_baseWithin1',c=>Math.abs(c.base-card.base)<=1],
   ['legalPool',()=>true],
  ];
  for(const [tier,test] of tiers){const pool=available.filter(test).sort((a,b)=>a.id-b.id);if(pool.length){const rng=prng(seedFor(warSeed,'random-replacement',target,JSON.stringify(team.members)));return {id:pool[Math.floor(rng()*pool.length)].id,tier,reason:'合法・元チーム未採用。属性/基礎値を段階緩和しwarSeedで選択（勝率不使用）',candidates:pool.map(c=>c.id)};}}
 } else {
  const rest=team.members.filter(id=>id!==target).map(byId),tag=team.mainTags[0],profile=META_PROFILES.indexOf(team.construction?.profile||''),pool=available.filter(c=>replacementEligible(team,target,c.id)&&replacementEligible(eligibilityTeam,target,c.id));
  const rank=(list:typeof pool)=>list.map(c=>({c,score:team.archetype===META_ARCHETYPE?metaConstructionScore(c,rest,Math.max(0,profile)).score:constructionScore(c,rest,tag,team.subTags).score})).sort((a,b)=>b.score-a.score||a.c.id-b.c.id);
  const primary=pool.filter(c=>c.themeTags.some(t=>card.themeTags.includes(t)&&team.mainTags.includes(t)));
  const role=pool.filter(c=>c.themeTags.some(t=>card.themeTags.includes(t))&&(!card.C||!!c.C));
  for(const [tier,list] of [['role',primary],['role',role],['archetype',pool]] as const)if(list.length){const ranked=rank([...list]);return {id:ranked[Math.floor((ranked.length-1)/2)].c.id,tier,reason:'既存generatorのスコア順の中央値（seed jitterと試合結果不使用）',candidates:ranked.map(c=>c.c.id)};}
 }
 return {id:null,tier:'replacementUnavailable',reason:'構築条件を維持する合法な代替がありません（固定コアを含む）',candidates:[]};
}
