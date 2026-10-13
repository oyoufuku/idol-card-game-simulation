import {IDOLS} from '../data/idols';
import {byId} from '../game/formation';
import type {Idol,Song} from '../game/types';
import {constructionScore,type Team} from './teams';
import {META_ARCHETYPE,metaConstructionScore} from './meta-teams';
import {abilitySemantics} from './ability-semantics';
import {chargeSupportPolicy} from './charge-team-policy';
import {prng,seedFor} from './random';

export const TACTICAL_POLICY='tactical-role-coverage-v2';
type Profile={name:string;support:number[];anchor?:number;release?:boolean};
// Explicit, pre-match role shortlists, reviewed against ability text. These are
// tactical alternatives, not a strength/WAR ranking. Coverage cannot escape them.
export const TACTICAL_PROFILES:Record<string,Profile[]>={
 'クール':[
  {name:'クール連動＋優勢時・BACKS防御支援',anchor:8,support:[11,14,28,8,15,4,27,18,2,13]},
  {name:'クールシンメ＋条件付き防御支援',anchor:15,support:[11,14,8,15,4,27,18,2,13]},
  {name:'クール連動＋疲労管理支援',anchor:13,support:[11,28,8,15,4,27,18,2,13]},
 ],
 'チャージ':[
  {name:'蓄積中の序盤安定',anchor:11,support:[43,39,40,25,11,22,24]},
  {name:'投入時のCENTER疲労妨害',anchor:26,support:[43,23,34,26,22,11,20,7]},
  {name:'位置維持支援と妨害',anchor:25,support:[43,39,25,11,23,22,37,7]},
 ],
 'バースト':[
  {name:'自軍BURST連鎖＋位置加算',anchor:25,support:[47,16,25,26,22,43,14]},
  {name:'自軍BURST連鎖＋疲労利用',anchor:29,support:[47,16,25,22,29,34,14]},
  {name:'自軍BURST連鎖＋ステージ火力',anchor:22,support:[47,16,25,26,22,43,34]},
 ],
 'フォーメーション移動':[
  {name:'登場・シンメ変更＋疲労軽減',anchor:13,support:[2,13,24,27,34,18,11,42]},
  {name:'登場・シンメ変更＋疲労攻撃',anchor:23,support:[16,23,42,20,18,34,2,27]},
  {name:'登場・シンメ変更＋CENTER安定',anchor:11,support:[2,13,18,20,34,24,27,42,11]},
 ],
 '多属性':[
  {name:'属性数利用＋3属性のステージ/BACKS',support:[30,35,46,29,33,17,18,2,15,13,4]},
  {name:'属性追加＋条件付き妨害',support:[30,35,46,29,33,17,18,2,15,13,4]},
  {name:'楽曲履歴＋BACKS妨害',support:[30,35,46,29,33,17,18,2,15,13,4]},
 ],
 '対スキル':[
  {name:'相手BURSTを残す封殺',support:[20,37,34,26,35,11,2],anchor:26},
  {name:'継続BURST解除と低BURST運用',support:[48,11,33,36,2,30,13],anchor:48,release:true},
  {name:'登場保護とAUTO・位置妨害',support:[35,37,34,26,11,2,13,19],anchor:11},
 ],
 '疲労回復':[
  {name:'低疲労条件＋BACKS回復支援',support:[13,42,31,39,4,2,24,44,17,48,15]},
  {name:'回復＋条件付きCENTER',support:[13,42,31,39,4,2,24,44,17,48,15]},
  {name:'低疲労維持＋チャージ回復',support:[13,42,31,39,4,2,24,44,17,48,15]},
 ],
 '疲労付与':[
  {name:'疲労付与＋疲労利用',support:[45,34,42,29,37,1,44,13]},
  {name:'相手高疲労＋位置妨害',support:[42,16,21,29,37,1,44,13]},
  {name:'位置疲労＋持久支援',support:[34,21,45,29,37,1,44,13]},
 ],
 '対単一属性':[
  {name:'対クール＋条件付き支援',support:[17,13,15,5,36,2,7,20]},
  {name:'PLAINと属性参照のCENTER切替',support:[17,13,15,5,46,30,33,2,18]},
  {name:'単独最多属性＋スキル妨害',support:[17,13,15,5,36,2,7,33,37]},
 ],
};
export function tacticalProfile(team:Team){const profiles=TACTICAL_PROFILES[team.mainTags[0]],index=(team.name.charCodeAt(team.name.length-1)-65)%3;return profiles?.[index];}
export function tacticalEligible(team:Team,c:Idol){const p=tacticalProfile(team);return !!p&&p.support.includes(c.id)&&(team.mainTags[0]!=='チャージ'||!chargeSupportPolicy(c).excluded.length);}
export function tacticalMinimumAttributes(team:Team){return team.mainTags[0]==='多属性'?2:team.mainTags[0]==='対単一属性'&&team.name.endsWith('B')?1:0;}
export function satisfiesTacticalAttributes(team:Team,cards:Idol[]){const min=tacticalMinimumAttributes(team);return ['クール','キュート','ユーモア'].every(a=>cards.filter(c=>c.attr===a).length>=min);}
export function tacticalScore(team:Team,c:Idol,selected:Idol[]){
 const tag=team.mainTags[0],variant=(team.name.charCodeAt(team.name.length-1)-65)%3;
 const score=tag==='対単一属性'?metaConstructionScore(c,selected,variant):constructionScore(c,selected,tag,team.subTags);
 const add=(n:number,why:string)=>{score.score+=n;score.reasons.push(`${why} (${n>=0?'+':''}${n})`);};
 const m=abilitySemantics(c),profile=tacticalProfile(team)!;
 add(8,`戦術に合う支援候補：${profile.name}`);
 if(['クール','多属性','疲労回復'].includes(tag)){
  if(/ポイントで勝|ポイントで負|受けない|自身がBACKS|疲労.*入れ替え/.test(c.A+c.B+(c.C||'')))add(6,'強い軸の支援を優勢・劣勢・防御などの条件付き役へ分散');
 }else if(['チャージ','フォーメーション移動','対スキル'].includes(tag)){
  if(c.base>=4)add(3,'序盤のステージ得点を支える基礎値');
  if(c.C)add(3,'CENTER候補を確保して序盤の得点を補う');
  if(m.ownRecovery)add(6,'出場・移動を支える疲労軽減/回復');
 }
 if(tag==='バースト'&&/クールとユーモア|3枠にクール・キュート・ユーモア/.test(c.A+c.Bcond))add(6,'ユーモアコアにクールを合わせた3属性BURST条件');
 if(tag==='フォーメーション移動'&&c.attr==='クール')add(4,'小西のクールのシンメ候補');
 if(tag==='対スキル'&&profile.release&&/BURST中のメンバーが1人以下|BURST中のメンバーが0人/.test(c.A+(c.C||'')))add(8,'BURST解除後の低BURST条件を使う');
 return score;
}
export function buildTacticalTeams(legacy:Team[],seed:number):Team[]{
 const built:Team[]=[];
 return legacy.map(old=>{
  const tag=old.mainTags[0],variant=(old.name.charCodeAt(old.name.length-1)-65)%3;
  const team:Team={...old,members:[],songs:[],reasons:{},scores:{},selectionPolicy:TACTICAL_POLICY};
  const p=tacticalProfile(team)!;
  const core=tag==='バースト'?[6,12,41]:tag==='対スキル'?(variant===0?[7,19,9]:variant===1?[7,15,9]:[7,20,9]):old.members.slice(0,3);
  const fixed=[...core,...(p.anchor&&!core.includes(p.anchor)?[p.anchor]:[])];
  team.construction={...old.construction,profile:old.construction?.profile||p.name,plan:`${p.name}。戦術の成立を優先し、条件付き支援・序盤得点・疲労管理の役割で構築する。`,caveats:[...(old.construction?.caveats||[]),'旧勝率・WARを選出スコアへ使用しない。強弱の改善は未検証。'],fixedMembers:fixed};
  const rng=prng(seedFor(seed,TACTICAL_POLICY,team.name)),jitter=new Map(IDOLS.map(c=>[c.id,rng()*4]));
  for(let slot=0;slot<8;slot++){
   const selected=team.members.map(byId),min=tacticalMinimumAttributes(team);
   let pool=slot<fixed.length?[byId(fixed[slot])]:IDOLS.filter(c=>!team.members.includes(c.id)&&tacticalEligible(team,c));
   // Keep enough remaining slots to realize both stage and BACKS three-color conditions.
   pool=pool.filter(c=>{const after=[...selected,c],left=IDOLS.filter(x=>!after.some(y=>y.id===x.id)&&tacticalEligible(team,x));
    return ['クール','キュート','ユーモア'].every(a=>Math.max(0,min-after.filter(x=>x.attr===a).length)<=left.filter(x=>x.attr===a).length)&&['クール','キュート','ユーモア'].reduce((n,a)=>n+Math.max(0,min-after.filter(x=>x.attr===a).length),0)<=7-slot;
   });
   if(slot===7){if(!selected.some(c=>c.C))pool=pool.filter(c=>c.C);
    pool=pool.filter(c=>!built.some(t=>t.archetype===team.archetype&&sameRoster(t.members,[...team.members,c.id])));
   }
   const ranked=pool.map(c=>({c,...tacticalScore(team,c,selected)})).sort((a,b)=>(b.score+jitter.get(b.c.id)!)-(a.score+jitter.get(a.c.id)!)||a.c.id-b.c.id);
   if(!ranked.length)throw new Error(`${team.name}: 戦術の構築条件を満たせません`);
   const pick=ranked[slot<fixed.length?0:(variant+slot)%Math.min(3,ranked.length)];team.members.push(pick.c.id);
   team.reasons[String(pick.c.id)]=[...pick.reasons,...(slot<core.length?['戦術コアを維持（固定採用）']:slot<fixed.length?['序盤または戦術の支援役を確保（固定支援）']:[])];
   team.scores![String(pick.c.id)]={construction:pick.score,seedJitter:jitter.get(pick.c.id)!,ranking:pick.score+jitter.get(pick.c.id)!};
  }
  built.push(team);return team;
 });
}
export function tacticalSongAllowed(team:Team,rule:string){
 const tag=team.mainTags[0],p=tacticalProfile(team)!;
 if(['バースト','多属性'].includes(tag)&&['cancelBurst','burstPenalty'].includes(rule))return false;
 if(tag==='対スキル'){
  if(!p.release&&rule==='cancelBurst')return false;
  if(team.members.includes(19)&&rule==='disableCenter')return false;
  if(p.release&&rule==='burstPenalty')return false;
 }
 return true;
}

export function sameRoster(a:number[],b:number[]){return [...a].sort((x,y)=>x-y).join(',')===[...b].sort((x,y)=>x-y).join(',');}
export function tacticalSongScore(team:Team,song:Song,fit:{score:number;reasons:string[];supportsTheme:boolean}){
 const result={...fit,reasons:[...fit.reasons]},tag=team.mainTags[0],p=tacticalProfile(team)!;
 const add=(n:number,why:string)=>{result.score+=n;result.reasons.push(`${why} (+${n})`);};
 if(tag==='フォーメーション移動'){
  if(song.rule==='recoverAll')add(p.anchor===23?2:12,'出場と移動の自軍疲労を回復。相手も回復する');
  if(song.rule==='fatigueRelief')add(8,'移動軸の出場疲労による減点を抑える');
  if(song.rule==='middleBonus'&&p.anchor===23)add(6,'疲労攻撃型の序盤MIDDLE得点を支える');
 }
 if(tag==='チャージ'&&song.rule==='samePosition')add(p.anchor===26?0:10,'蓄積中に同じ位置を維持する支援5人を強化。コア投入には不発');
 if(tag==='バースト'&&song.type==='クール')add(5,'森本の追加属性との一致と、ステージ支援のクール条件を狙う');
 if(tag==='対スキル'&&team.members.includes(19)&&song.rule==='burstPenalty')add(8,'相手BURSTを残しながら田村の反応・妨害を使う');
 return result;
}
