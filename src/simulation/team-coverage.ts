import { IDOLS } from '../data/idols';
import { byId } from '../game/formation';
import { constructionScore,type Team } from './teams';
import { META_ARCHETYPE,META_PROFILES,metaConstructionScore } from './meta-teams';
import { abilitySemantics,usesTheme } from './ability-semantics';
import { chargeSupportPolicy } from './charge-team-policy';
import { seedFor } from './random';

import {TACTICAL_POLICY,tacticalEligible,tacticalScore,satisfiesTacticalAttributes,sameRoster} from './tactical-team-policy';

export const COVERAGE_POLICY=TACTICAL_POLICY;
export const MAX_SUPPORT_FIT_LOSS=4;
export function isCoverageCore(team:Team,id:number){const s=abilitySemantics(byId(id));return (team.construction?.fixedMembers||team.members.slice(0,3)).includes(id)||(team.mainTags[0]==='対スキル'&&s.negativeProtection&&s.partyProtection);}
export function teamCoverage(teams:Team[]){return IDOLS.map(c=>({id:c.id,name:c.name,teamCount:teams.filter(t=>t.members.includes(c.id)).length,teams:teams.filter(t=>t.members.includes(c.id)).map(t=>t.name),coreCount:teams.filter(t=>t.members.includes(c.id)&&isCoverageCore(t,c.id)).length}));}
function fit(team:Team,id:number,rest:number[]){const cards=rest.map(byId),c=byId(id);if(team.construction?.fixedMembers)return tacticalScore(team,c,cards);return team.archetype===META_ARCHETYPE?metaConstructionScore(c,cards,Math.max(0,META_PROFILES.indexOf(team.construction?.profile||''))):constructionScore(c,cards,team.mainTags[0],team.subTags);}
export function coverageReplacementEligible(team:Team,slot:number,id:number){
 if(slot<3||team.members.includes(id))return false;
 const rest=team.members.filter((_,i)=>i!==slot).map(byId),c=byId(id),tag=team.mainTags[0],cards=[...rest,c];
 if(isCoverageCore(team,team.members[slot]))return false;
 if(team.construction?.fixedMembers&&(!tacticalEligible(team,c)||!satisfiesTacticalAttributes(team,cards)))return false;
 if(tag==='チャージ'&&chargeSupportPolicy(c).excluded.length)return false;
 if(tag==='チャージ'&&!cards.some(c=>c.C))return false;
 if(byId(team.members[slot]).C&&!rest.some(c=>c.C)&&!c.C)return false;
 if(tag==='多属性'||team.construction?.profile===META_PROFILES[1])if(new Set(cards.map(c=>c.attr)).size<3)return false;
 if(team.archetype===META_ARCHETYPE){if(cards.filter(c=>c.themeTags.includes('対単一属性')).length<2)return false;}
 else if(tag!=='チャージ'&&cards.filter(c=>(team.construction?.fixedMembers||c.themeTags.includes(tag))&&usesTheme(c,tag)).length<3)return false;
 return true;
}
/** Global exposure balancing, independent of any match/WAR results. Every
 * replacement must preserve cores and fit within a bounded construction gap.
 * Sum of squared usage strictly decreases, so moves cannot oscillate. */
export function balanceTeamCoverage(input:Team[],seed:number):Team[]{
 const teams=input.map(t=>({...t,members:[...t.members],songs:[...t.songs],reasons:structuredClone(t.reasons),scores:structuredClone(t.scores??{})}));
 const counts=new Map(IDOLS.map(c=>[c.id,teams.filter(t=>t.members.includes(c.id)).length]));
 const baseline=input.map(t=>t.members.map((id,slot)=>fit(t,id,t.members.filter((_,i)=>i!==slot)).score));
 type Move={team:number;slot:number;old:number;id:number;gap:number;tie:number};
 const movesFor=(index:number):Move[]=>{const t=teams[index],moves:Move[]=[];
  for(let slot=3;slot<8;slot++){const old=t.members[slot],rest=t.members.filter((_,i)=>i!==slot),oldScore=baseline[index][slot];
   for(const c of IDOLS)if(coverageReplacementEligible(t,slot,c.id)){const gap=oldScore-fit(t,c.id,rest).score;if(gap<=MAX_SUPPORT_FIT_LOSS&&!teams.some((other,j)=>j!==index&&other.archetype===t.archetype&&sameRoster(other.members,[...rest,c.id])))moves.push({team:index,slot,old,id:c.id,gap,tie:seedFor(seed,COVERAGE_POLICY,t.name,slot,c.id)});}
  }return moves;
 };
 const moves=teams.map((_,i)=>movesFor(i));
 while(true){let chosen:Move|undefined,improvement=0;
  for(const options of moves)for(const move of options){if(teams.some((other,j)=>j!==move.team&&other.archetype===teams[move.team].archetype&&sameRoster(other.members,teams[move.team].members.map((id,slot)=>slot===move.slot?move.id:id))))continue;const gain=2*(counts.get(move.old)!-counts.get(move.id)!-1);
   if(gain>0&&(gain>improvement||(gain===improvement&&(!chosen||move.gap<chosen.gap||(move.gap===chosen.gap&&move.tie<chosen.tie))))){chosen=move;improvement=gain;}
  }
  if(!chosen)break;
  const t=teams[chosen.team],beforeOld=counts.get(chosen.old)!,beforeNew=counts.get(chosen.id)!;
  counts.set(chosen.old,beforeOld-1);counts.set(chosen.id,beforeNew+1);t.members[chosen.slot]=chosen.id;
  const score=fit(t,chosen.id,t.members.filter((_,i)=>i!==chosen!.slot));
  delete t.reasons[String(chosen.old)];delete t.scores[String(chosen.old)];
  t.reasons[String(chosen.id)]=[...score.reasons,`全チームの起用機会を分散：採用${beforeNew}チームの候補を採用${beforeOld}チームの支援と交換。構築スコア差 ${chosen.gap.toFixed(2)}（許容差${MAX_SUPPORT_FIT_LOSS}以内）。固定コア維持・勝率/WAR不使用`];
  t.scores[String(chosen.id)]={construction:score.score,seedJitter:0,ranking:score.score};
  moves[chosen.team]=movesFor(chosen.team);
 }
 return teams.map(t=>({...t,selectionPolicy:COVERAGE_POLICY}));
}
