import {expect,it} from 'vitest';
import {IDOLS} from '../data/idols';
import {byId} from '../game/formation';
import {generateArchetypes} from '../simulation/teams';
import {teamCoverage,MAX_SUPPORT_FIT_LOSS,coverageReplacementEligible,balanceTeamCoverage,isCoverageCore} from '../simulation/team-coverage';
import {META_ARCHETYPE,META_PROFILES} from '../simulation/meta-teams';
import {abilitySemantics,usesTheme} from '../simulation/ability-semantics';
import {chargeSupportPolicy} from '../simulation/charge-team-policy';
import {songFit} from '../simulation/song-fit';
import {songById} from '../data/songs';
import {buildTacticalTeams,tacticalScore,tacticalSongScore,tacticalEligible,sameRoster} from '../simulation/tactical-team-policy';

it('起用を分散しつつ9軸27チーム・8人3曲・全コアと構築条件を維持する',()=>{
 for(const seed of [1,2,13,123,876]){
  const old=generateArchetypes(seed,3,'legacy'),teams=generateArchetypes(seed);
  expect(teams).toEqual(generateArchetypes(seed));expect(teams).toHaveLength(27);
  expect(teamCoverage(teams).reduce((n,c)=>n+c.teamCount**2,0)).toBeLessThanOrEqual(teamCoverage(old).reduce((n,c)=>n+c.teamCount**2,0));
  for(const [index,t] of teams.entries()){
   if(!['バースト','対スキル'].includes(t.mainTags[0]))expect(t.members.slice(0,3)).toEqual(old[index].members.slice(0,3));
   for(const id of t.construction!.fixedMembers!)expect(t.members).toContain(id);
   for(const id of t.members.filter(id=>!t.construction!.fixedMembers!.includes(id)))expect(tacticalEligible(t,byId(id))).toBe(true);
   expect(teams.filter(other=>other.archetype===t.archetype&&sameRoster(t.members,other.members))).toHaveLength(1);expect(new Set(t.members).size).toBe(8);expect(new Set(t.songs).size).toBe(3);
   expect(Object.keys(t.reasons)).toHaveLength(11);
   if(t.mainTags[0]==='チャージ'){expect(t.members.slice(0,3)).toEqual([32,38,44]);for(const id of t.members.slice(3))expect(chargeSupportPolicy(byId(id)).excluded).toEqual([]);expect(t.members.some(id=>byId(id).C)).toBe(true);}
   else if(t.archetype!==META_ARCHETYPE)expect(t.members.filter(id=>usesTheme(byId(id),t.mainTags[0])).length).toBeGreaterThanOrEqual(3);
   if(t.mainTags[0]==='多属性'||t.construction?.profile===META_PROFILES[1])expect(new Set(t.members.map(id=>byId(id).attr)).size).toBe(3);
   if(t.mainTags[0]==='対スキル')expect(t.members).toContain(9);
   if(t.mainTags[0]==='フォーメーション移動')expect(t.members.slice(0,3).sort((a,b)=>a-b)).toEqual([9,28,45]);
   for(const id of t.songs)expect(songById(id).selectable).not.toBe(false);
  }
 }
});
it('seed1では未採用を解消するが、人数一致を強制せず固定コアの偏りを残す',()=>{
 const before=teamCoverage(generateArchetypes(1,3,'legacy')),after=teamCoverage(generateArchetypes(1));
 expect(before.filter(c=>!c.teamCount).map(c=>c.id)).toEqual([25,33]);expect(after.every(c=>c.teamCount>0)).toBe(true);
 expect(Math.max(...after.map(c=>c.teamCount))).toBeLessThanOrEqual(8);expect(Math.min(...after.map(c=>c.teamCount))).toBeGreaterThan(0);
 expect(after.find(c=>c.id===9)).toMatchObject({teamCount:6,coreCount:6});
});
it('差し替えを重ねても元の支援の適合スコアから許容差を越えて低下しない',()=>{
 const old=buildTacticalTeams(generateArchetypes(1,3,'legacy'),1),raw=balanceTeamCoverage(old,1);
 for(const [i,t] of raw.entries())for(let slot=3;slot<8;slot++)if(t.members[slot]!==old[i].members[slot]){
  const previous=old[i],restOld=previous.members.filter((_,i)=>i!==slot).map(byId),rest=t.members.filter((_,i)=>i!==slot).map(byId);
  const score=(id:number,cards:ReturnType<typeof byId>[])=>tacticalScore(t,byId(id),cards).score;
  expect(score(previous.members[slot],restOld)-score(t.members[slot],rest)).toBeLessThanOrEqual(MAX_SUPPORT_FIT_LOSS);
 }
});
it('平等化のために固定コアやチャージ非合法支援を入れ替えない',()=>{
 const teams=generateArchetypes(1),charge=teams.find(t=>t.mainTags[0]==='チャージ')!,skill=teams.find(t=>t.mainTags[0]==='対スキル')!;
 expect(coverageReplacementEligible(charge,0,8)).toBe(false);
 expect(coverageReplacementEligible(charge,3,25)).toBe(false);
 expect(isCoverageCore(skill,9)).toBe(true);expect(coverageReplacementEligible(skill,skill.members.indexOf(9),8)).toBe(false);
});
it('入れ替え後の曲は新メンバーの実効果で再評価し、理由の値も一致する',()=>{
 const teams=generateArchetypes(1),old=generateArchetypes(1,3,'legacy');
 for(const [i,t] of teams.entries())if(t.members.join(',')!==old[i].members.join(','))for(const id of t.songs){
  const profile=t.archetype===META_ARCHETYPE?META_PROFILES.indexOf(t.construction!.profile):undefined;
  const fit=tacticalSongScore(t,songById(id),songFit(songById(id),t.members.map(byId),t.mainTags[0],profile));
  expect(t.scores![id].construction).toBe(fit.score);expect(t.reasons[id]).toEqual(fit.reasons);
 }
});
it('能力文キャッシュは同IDの改変テキストを旧仕様として扱わない',()=>{
 const c={...IDOLS[18]};expect(abilitySemantics(c).counterBurst).toBe(true);
 c.A='自身のAppealを+1する。';c.B='自身のAppealを+1する。';c.Bcond='自身の疲労値が6以上。';c.C=null;
 expect(abilitySemantics(c).counterBurst).toBe(false);
});

it('強弱を補う役割を維持し、対策・多属性条件をクールやBURST支援と混同しない',()=>{
 for(const seed of [0,1,13,876]){
  const teams=generateArchetypes(seed);
  for(const id of [22,35])expect(abilitySemantics(byId(id)).ownCool).toBe(false);
  for(const t of teams){
   const tag=t.mainTags[0];
   if(tag==='クール'){expect(t.members).not.toContain(22);expect(t.members).not.toContain(35);expect(t.members).toContain([8,15,13][(t.name.charCodeAt(t.name.length-1)-65)%3]);}
   if(tag==='バースト'){expect(t.members.slice(0,3)).toEqual([6,12,41]);expect(t.members).not.toContain(48);expect(t.members).not.toContain(19);}
   if(tag==='フォーメーション移動')for(const id of [8,12,21,10])expect(t.members).not.toContain(id);
   if(tag==='多属性'){
    expect(t.members).not.toContain(5);for(const a of ['クール','キュート','ユーモア'])expect(t.members.filter(id=>byId(id).attr===a).length).toBeGreaterThanOrEqual(2);
    if(t.members.includes(30))expect(new Set(t.songs.map(id=>songById(id).type)).size).toBe(3);
   }
   if(tag==='対スキル'&&t.members.includes(19)){expect(t.songs).not.toContain('V');expect(t.songs).not.toContain('I');}
   if(tag==='対スキル'&&t.name.endsWith('B')){expect(t.members).toContain(48);expect(t.members).not.toContain(19);expect(t.songs).toContain('V');}
  }
 }
});
