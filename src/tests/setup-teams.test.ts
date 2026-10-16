import {expect,it} from 'vitest';
import {RANDOM_PICK_OPTIONS,randomSetupTeam,type RandomPickScope} from '../components/setup-teams';
import {IDOLS} from '../data/idols';
import {SELECTABLE_SONGS} from '../data/songs';
import {songBelongsToGroup,constructedTeams} from '../simulation/constructed-teams';
import {randomTeam} from '../simulation/teams';
import {createGame} from '../game/engine';
it('テストプレイのランダム3種類は各8人・3曲、所属・重複禁止・特殊曲除外を守る',()=>{
 expect(Object.values(RANDOM_PICK_OPTIONS).map(v=>v.label)).toEqual(['オールランダム','櫻坂ランダム','日向坂ランダム']);
 for(const scope of Object.keys(RANDOM_PICK_OPTIONS) as RandomPickScope[])for(let seed=0;seed<24;seed++){
  const team=randomSetupTeam(scope,seed,'P1'),group=RANDOM_PICK_OPTIONS[scope].group;
  expect(team.members).toHaveLength(8);expect(new Set(team.members).size).toBe(8);
  expect(team.songs).toHaveLength(3);expect(new Set(team.songs).size).toBe(3);
  expect(team.songs.every(id=>SELECTABLE_SONGS.some(s=>s.id===id))).toBe(true);
  expect(team.songs).not.toContain('K');expect(team.songs).not.toContain('S');
  if(group){expect(team.members.every(id=>IDOLS.find(c=>c.id===id)!.group===group)).toBe(true);expect(team.songs.every(id=>songBelongsToGroup(id,group))).toBe(true);expect(team.songs).not.toContain('J');}
  expect(randomSetupTeam(scope,seed,'P1')).toEqual(team);
 }
});
it('オールランダムは従来のRANDOMと同じseedで一致し、候補を削らない',()=>{
 const seenMembers=new Set<number>(),seenSongs=new Set<string>();
 for(let seed=0;seed<100;seed++){const t=randomSetupTeam('all',seed,'P1');expect(t).toEqual(randomTeam(seed,'P1'));t.members.forEach(id=>seenMembers.add(id));t.songs.forEach(id=>seenSongs.add(id));}
 expect(seenMembers.size).toBe(48);expect(seenSongs.size).toBe(20);
});
it('構築済み12デッキと所属ランダムを両プレイヤーへ渡して開始でき、手動用の配列も独立する',()=>{
 const decks=constructedTeams();expect(decks).toHaveLength(12);
 for(const [i,deck] of decks.entries()){
  const opponent=randomSetupTeam(i%2?'sakura':'hinata',i,'P2'),before=structuredClone(deck);
  const g=createGame([...deck.members],[...opponent.members],[...deck.songs],[...opponent.songs],'local',()=>.5);
  expect(g.p1.ids).toEqual(deck.members);expect(g.p2.ids).toEqual(opponent.members);expect(g.p1.songs).toEqual(deck.songs);expect(g.p2.songs).toEqual(opponent.songs);
  g.p1.ids[0]=999;g.p1.songs[0]='Z';expect(deck).toEqual(before);
 }
});

it('属性メタは藤嶌から幸坂へ交換し、楽曲と基本9軸の全員1〜2回起用を維持する',()=>{
 const decks=constructedTeams(),meta=decks.find(t=>t.name==='対単一属性・クールメタ')!;
 expect(meta.members).toEqual([3,40,1,5,37,7,19,17]);expect(meta.songs).toEqual(['B','Q','V']);
 expect(meta.reasons['17'].join('')).toContain('BACKS');expect(meta.reasons['36']).toBeUndefined();
 const counts=new Map<number,number>();for(const t of decks.slice(0,9))for(const id of t.members)counts.set(id,(counts.get(id)||0)+1);
 expect(counts.size).toBe(48);for(const n of counts.values())expect([1,2]).toContain(n);
 expect(counts.get(17)).toBe(2);expect(counts.get(36)).toBe(1);
});

it('疲労付与だけ宮地を平尾へ交換し、チャージ軸とともにCHARGE CPUを選ぶ',()=>{
 const decks=constructedTeams(),fatigue=decks.find(t=>t.mainTags[0]==='疲労付与')!,meta=decks.find(t=>t.mainTags[0]==='対単一属性')!;
 expect(fatigue.members).toEqual([16,21,23,42,45,44,29,34]);expect(fatigue.songs).toEqual(['C','D','M']);expect(fatigue.preferredCpuStrategy).toBe('charge');
 expect(meta.members).toEqual([3,40,1,5,37,7,19,17]);expect(meta.preferredCpuStrategy).toBeUndefined();
});

it('疲労回復は河田から松田好花へ交換し、回復コア・楽曲と各人1〜2回の起用を維持する',()=>{
 const decks=constructedTeams(),recovery=decks.find(t=>t.mainTags[0]==='疲労回復')!;
 expect(recovery.members).toEqual([13,42,39,48,2,24,4,26]);expect(recovery.songs).toEqual(['J','N','T']);expect(recovery.preferredCpuStrategy).toBeUndefined();
 const count=(id:number)=>decks.slice(0,9).filter(t=>t.members.includes(id)).length;
 expect(count(48)).toBe(2);expect(count(40)).toBe(1);
});
