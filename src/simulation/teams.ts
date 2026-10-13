import { IDOLS } from '../data/idols';
import { byId } from '../game/formation';
import { SONGS,SELECTABLE_SONGS } from '../data/songs';
import type { Attribute, Idol } from '../game/types';
import { shuffle } from '../game/engine';
import { prng, seedFor } from './random';
import { generateMetaArchetypes } from './meta-teams';
import { songFit } from './song-fit';
import { abilitySemantics,usesTheme,legacyOwnCool } from './ability-semantics';
import { chargeCore,chargeSupportPolicy } from './charge-team-policy';
import { balanceTeamCoverage } from './team-coverage';
import { buildTacticalTeams,tacticalSongAllowed,tacticalProfile,tacticalSongScore } from './tactical-team-policy';
export interface Team {selectionPolicy?:string;name:string;archetype:string;members:number[];songs:string[];mainTags:string[];subTags:string[];reasons:Record<string,string[]>;scores?:Record<string,{construction:number;seedJitter:number;ranking:number}>;construction?:{profile:string;plan:string;caveats:string[];fixedMembers?:number[]}}
export const ATTRS:Attribute[]=['クール','キュート','ユーモア'];
export function randomTeam(seed:number,name:string):Team{const r=prng(seed);return {name,archetype:'RANDOM',members:shuffle(IDOLS.map(c=>c.id),r).slice(0,8),songs:shuffle(SELECTABLE_SONGS.map(s=>s.id),r).slice(0,3),mainTags:[],subTags:[],reasons:{}};}
// Fixed construction policy, before any match results are available. Generic
// numeric tags are support themes; a theme needs >= 3 tagged core cards.
export function themes(){
 const tags=new Map<string,number>();for(const c of IDOLS)for(const tag of new Set(c.themeTags))tags.set(tag,(tags.get(tag)||0)+1);
 return ['クール','チャージ','バースト','フォーメーション移動','多属性','対スキル','疲労回復','疲労付与'].map(t=>[t,tags.get(t)||0] as const).sort(([a],[b])=>a.localeCompare(b,'ja')).map(([tag,count])=>{
  const related=new Map<string,number>();for(const c of IDOLS.filter(c=>c.themeTags.includes(tag)))for(const t of c.themeTags)if(t!==tag)related.set(t,(related.get(t)||0)+1);
  return {tag,count,subTags:[...related].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja')).slice(0,3).map(([t])=>t)};
 });
}
export function synergy(c:Idol,selected:Idol[],tag:string,legacyCool=false):{score:number;reasons:string[]}{
 let score=0;const reasons:string[]=[];const add=(n:number,reason:string)=>{score+=n;reasons.push(`${reason} (+${n})`);};
 if(c.themeTags.includes(tag)&&usesTheme(c,tag))add(12,`能力対象が一致する主タグ ${tag}`);
 if(ATTRS.includes(tag as Attribute)&&c.attr===tag)add(7,`属性 ${tag}`);
 if(c.C&&!selected.some(x=>x.C))add(4,'CENTER役を確保');
 const meaning=abilitySemantics(c);
 if(tag==='バースト'&&meaning.ownBurst)add(meaning.burstEngine?16:6,'自軍BURST利用・回数・連鎖');
 if(tag==='疲労付与'&&meaning.enemyFatigue)add(10,'相手への疲労付与');
 if(tag==='疲労回復'&&meaning.ownRecovery)add(10,'自軍の低疲労維持');
 if(tag==='クール'&&(legacyCool?legacyOwnCool(c):meaning.ownCool))add(12,'自軍クール人数・楽曲・CENTER・シンメを利用');
 if(tag==='多属性'&&meaning.multiAttribute)add(12,'属性追加・属性種類数・楽曲多様性を利用');
 if(tag==='チャージ'&&meaning.chargeSupport)add(10,'実際のチャージ蓄積・支援');
 if(tag==='フォーメーション移動'&&meaning.ownFixed)add(-8,'位置維持は自軍移動シナジーではない');
 if(tag==='多属性'&&!selected.some(x=>x.attr===c.attr))add(5,'未採用属性を補完');
 if(tag==='フォーメーション移動'&&meaning.ownMovement)add(10,'自軍の移動・シンメ・位置経験');
 if(tag==='対スキル'&&meaning.counterBurst)add(8,'相手BURSTへの反応・妨害（対スキル）');
 if(tag==='対スキル'&&meaning.antiSkill)add(10,'相手スキル妨害・相手効果への耐性');
 if(tag==='対スキル'&&meaning.negativeProtection)add(8,'Appeal減少・疲労付与・位置無効・属性変更への登場時保護');
 if(tag==='対スキル'&&meaning.partyProtection)add(6,'BURSTによる保護AUTOの味方ステージ5人への展開');
 add(c.base/2,'基礎Appeal');return {score,reasons};
}
export function constructionScore(c:Idol,selected:Idol[],tag:string,subTags:string[],fixedCore=false,legacyCool=false) {
 const syn=synergy(c,selected,tag,legacyCool);for(const t of subTags)if(c.themeTags.includes(t)&&!(tag==='チャージ'&&t==='フォーメーション固定')&&!(tag==='バースト'&&t==='対バースト')&&(!(t==='バースト'||t==='疲労付与'||t==='疲労回復'||t==='多属性'||t==='対スキル'||t==='フォーメーション移動')||usesTheme(c,t))){syn.score+=3;syn.reasons.push(`副タグ ${t} (+3)`);}
    if(tag==='チャージ'){const add=(n:number,why:string)=>{syn.score+=n;syn.reasons.push(`${why} (+${n})`);};
     if(fixedCore)syn.reasons.push('指定されたチャージコア（固定採用）');
     else{const policy=chargeSupportPolicy(c);if(policy.exception)add(8,'竹内の例外採用：BACKSコアへチャージ付与');else add(4,'BACKSに頼らずステージで働ける支援');
      if(c.base>=4)add(2,'基礎Appeal4〜5のステージ支援');if(c.C)add(6,'CENTER役・ステージの勝ち筋');
      for(const reason of policy.deprioritized)add(-8,reason);
     }
    }
    return syn;
}
export function generateArchetypes(seed:number,variants=3,selection:'balanced'|'legacy'='balanced'):Team[]{
 const teams:Team[]=[];
 for(const theme of themes())for(let variant=0;variant<variants;variant++){
  const r=prng(seedFor(seed,theme.tag,variant)),selected:Idol[]=[],reasons:Record<string,string[]>={},memberScores:NonNullable<Team['scores']>={};
  const isCharge=theme.tag==='チャージ',core=isCharge?chargeCore():[];
  const jitter=new Map(IDOLS.map(c=>[c.id,r()*4]));
  for(let slot=0;slot<8;slot++){
   let pool=isCharge&&slot<3?[core[slot]]:IDOLS.filter(c=>!selected.includes(c)&&(isCharge||slot>=Math.min(3,theme.count)||c.themeTags.includes(theme.tag)&&usesTheme(c,theme.tag)));
   if(isCharge&&slot>=3)pool=pool.filter(c=>chargeSupportPolicy(c).excluded.length===0);
   if(isCharge&&slot===7&&!selected.some(c=>c.C))pool=pool.filter(c=>c.C);
   const missing=ATTRS.filter(a=>!selected.some(c=>c.attr===a));
   if(theme.tag==='多属性'&&8-slot<=missing.length)pool=pool.filter(c=>missing.includes(c.attr));
   if(!pool.length)throw new Error(`${theme.tag}の構築条件を満たせません`);
   const scores=pool.map(c=>{const syn=constructionScore(c,selected,theme.tag,theme.subTags,isCharge&&slot<3,true);
    return {c,...syn,construction:syn.score,score:syn.score+jitter.get(c.id)!};}).sort((a,b)=>b.score-a.score||a.c.id-b.c.id);
   // Diversify by rotating a small, high-scoring shortlist. No outcome feedback.
   const choice=scores[(variant+slot)%Math.min(3,scores.length)];selected.push(choice.c);reasons[String(choice.c.id)]=choice.reasons;memberScores[String(choice.c.id)]={construction:choice.construction,seedJitter:jitter.get(choice.c.id)!,ranking:choice.score};
  }
  const songs=SELECTABLE_SONGS.map(s=>{
   const fit=songFit(s,selected,theme.tag);let score=fit.score;const why=[...fit.reasons];
   if(fit.supportsTheme&&s.tags?.includes(theme.tag)){score+=4;why.push(`実効果一致の主タグ ${theme.tag} (+4)`);}
   const jitter=r()*3;return {s,semanticSong:fit.supportsTheme,construction:score,jitter,score:score+jitter,why};
  }).sort((a,b)=>b.score-a.score||a.s.id.localeCompare(b.s.id));
  const primary=songs.find(x=>x.semanticSong&&!(theme.tag==='バースト'&&x.s.rule==='cancelBurst'))||songs[0];
  const rest=songs.filter(x=>x!==primary && !(theme.tag==='バースト'&&x.s.rule==='cancelBurst'));
  const picked=[primary,rest[variant%2],rest[2+variant%3]];
  for(const s of picked){reasons[s.s.id]=s.why;memberScores[s.s.id]={construction:s.construction,seedJitter:s.jitter,ranking:s.score};}
  teams.push({name:`${theme.tag}軸-${String.fromCharCode(65+variant)}`,archetype:`${theme.tag}軸`,members:selected.map(c=>c.id),songs:picked.map(x=>x.s.id),mainTags:[theme.tag],subTags:theme.subTags,reasons,scores:memberScores,...(isCharge?{construction:{profile:'固定チャージコア3人＋ステージ支援5人',plan:'渡邉美穂・渡辺莉奈・平尾帆夏がBACKSで蓄積し、残り5人でステージを維持。竹内の支援は例外として採用可能。CENTER役を最低1人確保。',caveats:['BACKS依存AUTO・自軍BACKSのBURST条件・BACKSからの登場条件を持つ支援は除外（竹内を除く）','多種類ポジション経験は優先度を下げる。相手BACKSへの反応条件は自軍BACKS条件と区別する']}}:{})});
 }
 const legacy=[...teams,...generateMetaArchetypes(seed)];
 if(selection==='legacy')return legacy;
 return balanceTeamCoverage(buildTacticalTeams(legacy,seed),seed).map(team=>{
  const cards=team.members.map(byId),tag=team.mainTags[0],variant=Number(team.name.at(-1)!.charCodeAt(0))-65,profile=tag==='対単一属性'?variant:undefined;
  const rng=prng(seedFor(seed,'coverage-songs',team.name));
  const entries=SELECTABLE_SONGS.map(song=>{const fit=tacticalSongScore(team,song,songFit(song,cards,tag,profile)),jitter=rng()*3;return {song,fit,jitter,score:fit.score+jitter};}).sort((a,b)=>b.score-a.score||a.song.id.localeCompare(b.song.id));
  const allowed=entries.filter(e=>tacticalSongAllowed(team,e.song.rule)&&!(tag==='クール'&&e.song.rule==='disableCenter')&&!(tag==='疲労回復'&&['cancelBurst','burstPenalty'].includes(e.song.rule)));
  const primary=(tag==='対スキル'&&tacticalProfile(team)?.release?allowed.find(e=>e.song.rule==='cancelBurst'):undefined)||allowed.find(e=>e.fit.supportsTheme)||allowed[0],rest=allowed.filter(e=>e!==primary);
  const picked=tag==='対単一属性'?allowed.slice(0,3):[primary,rest[variant%2],rest[2+variant%3]];
  if(tag==='多属性'&&cards.some(c=>/3属性の楽曲/.test(c.Bcond))){
   picked.splice(0,picked.length,...ATTRS.map(attr=>allowed.find(e=>e.song.type===attr)!));
  }
  for(const id of team.songs){delete team.reasons[id];delete team.scores![id];}
  team.songs=picked.map(e=>e.song.id);
  for(const e of picked){team.reasons[e.song.id]=e.fit.reasons;team.scores![e.song.id]={construction:e.fit.score,seedJitter:e.jitter,ranking:e.score};}
  return team;
 });
}
export function describeTeam(t:Team){const cards=t.members.map(id=>IDOLS.find(c=>c.id===id)!);return {...t,archetype_name:t.archetype,main_tags:t.mainTags,sub_tags:t.subTags,members:cards.map(c=>({id:c.id,name:c.name,attribute:c.attr,base:c.base,AUTO:c.A,BURST_condition:c.Bcond,BURST:c.B,CENTER:c.C})),member_tags:cards.map(c=>({id:c.id,tags:c.themeTags})),songs:t.songs.map(id=>SONGS.find(s=>s.id===id)!),song_tags:t.songs.map(id=>({id,tags:SONGS.find(s=>s.id===id)!.tags})),attribute_composition:Object.fromEntries(ATTRS.map(a=>[a,cards.filter(c=>c.attr===a).length])),average_base_appeal:cards.reduce((n,c)=>n+c.base,0)/8};}
