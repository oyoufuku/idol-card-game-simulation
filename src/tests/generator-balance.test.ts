import {it,expect} from 'vitest';
import {IDOLS} from '../data/idols';
import {SONGS} from '../data/songs';
import {generateArchetypes,synergy,constructionScore} from '../simulation/teams';
import {abilitySemantics} from '../simulation/ability-semantics';
import {archetypeSchedule,withStrategies} from '../simulation/schedule';
import {byId} from '../game/formation';
import {createGame} from '../game/engine';
import {calculationContext} from '../game/context';
import {skillFor} from '../game/skills';
import {metaConstructionScore} from '../simulation/meta-teams';
import {songFit} from '../simulation/song-fit';
it('現行9軸27チーム、固定タグは保持、代表戦はチャージ対疲労回復',()=>{
 const teams=generateArchetypes(1);expect(teams).toHaveLength(27);expect(new Set(teams.map(t=>t.archetype)).size).toBe(9);expect(teams.some(t=>t.archetype==='フォーメーション固定軸')).toBe(false);
 expect(IDOLS.some(c=>c.themeTags.includes('フォーメーション固定'))).toBe(true);expect(SONGS.some(s=>s.tags?.includes('フォーメーション固定'))).toBe(true);
 expect(archetypeSchedule(1,20)).toHaveLength(900);expect(archetypeSchedule(1,2,teams,true).some(s=>s.a.archetype==='チャージ軸'&&s.b.archetype==='疲労回復軸')).toBe(true);
 for(const s of withStrategies(archetypeSchedule(1,2),'charge-archetype'))expect(s.cpuStrategies).toEqual([s.a,s.b].map(t=>t.archetype==='チャージ軸'?'charge':'normal'));
});
it('自軍/相手のBURST・疲労・移動を区別する',()=>{
 expect(abilitySemantics(byId(19)).ownBurst).toBe(false);expect(synergy(byId(19),[],'バースト').reasons.some(r=>r.includes('自軍BURST'))).toBe(false);
 expect(abilitySemantics({...byId(19),themeTags:[]} ).ownBurst).toBe(false);
 for(const id of [6,12,41,47])expect(abilitySemantics(byId(id)).ownBurst).toBe(true);
 expect(abilitySemantics(byId(48)).ownBurst).toBe(true);
 expect(abilitySemantics({...byId(48),B:""}).ownBurst).toBe(false);
 expect(abilitySemantics(byId(26)).enemyFatigue).toBe(false);expect(abilitySemantics(byId(16)).enemyFatigue).toBe(true);expect(abilitySemantics(byId(13)).ownRecovery).toBe(true);
 expect(abilitySemantics(byId(7)).ownMovement).toBe(false);expect(abilitySemantics(byId(45)).ownMovement).toBe(true);
 expect(abilitySemantics(byId(7)).antiSkill).toBe(true);
 expect(constructionScore(byId(26),[],'チャージ',['フォーメーション固定'])).toEqual(constructionScore(byId(26),[],'チャージ',[]));
});
it('村井の新しい免疫・ステージ全体展開を対スキルとして加点する',()=>{
 const card=byId(9),score=synergy(card,[],'対スキル');
 expect(abilitySemantics(card)).toMatchObject({antiSkill:true,negativeProtection:true,partyProtection:true});
 expect(score.reasons.some(r=>r.includes('属性変更への登場時保護'))).toBe(true);
 expect(score.reasons.some(r=>r.includes('味方ステージ5人への展開'))).toBe(true);
 const old={...card,A:'登場した時、自身のAppealを+2する。',B:'次のパフォーマンス中に自身のAppealを+2する。'};
 expect(score.score-synergy(old,[],'対スキル').score).toBe(24);
 expect(generateArchetypes(1).filter(t=>t.archetype==='対スキル軸').every(t=>t.members.includes(9))).toBe(true);
});
it('楽曲は同じタグでも効果の利用/対策・自軍への不利益を区別する',()=>{
 const cards=[6,12,14,18,32,38,41,47].map(byId),song=(id:string)=>SONGS.find(s=>s.id===id)!;
 const use=songFit({...song('F'),tags:['バースト']},cards,'フォーメーション移動');
 const counter=songFit({...song('U'),tags:['フォーメーション移動']},cards,'フォーメーション移動');
 expect(use.supportsTheme).toBe(true);expect(counter.supportsTheme).toBe(false);expect(use.score).toBeGreaterThan(counter.score);
 expect(songFit(song('V'),cards,'バースト').score).toBeLessThan(0);
 expect(songFit(song('G'),cards,'バースト').supportsTheme).toBe(false);
 expect(songFit(song('G'),cards,'対スキル').supportsTheme).toBe(true);
 expect(songFit(song('D'),cards,'疲労回復').score).toBeLessThan(0);
 expect(songFit(song('D'),cards,'疲労付与').supportsTheme).toBe(true);
 expect(songFit(song('J'),cards,'疲労付与').score).toBeLessThan(0);
 expect(songFit(song('T'),cards,'疲労付与').supportsTheme).toBe(false);
 for(const t of generateArchetypes(1).filter(t=>t.archetype==='バースト軸'))expect(t.songs).not.toContain('V');
});
it('多属性は3属性を必須とし、seed再現・メタの低汎用加点を維持',()=>{
 for(let seed=0;seed<20;seed++){const ts=generateArchetypes(seed);expect(ts).toEqual(generateArchetypes(seed));for(const t of ts.filter(t=>t.archetype==='多属性軸'||t.construction?.profile==='属性変更・PLAIN重視'))expect(new Set(t.members.map(id=>byId(id).attr)).size).toBe(3);}
 const card=byId(40);expect(metaConstructionScore({...card,base:5},[],0).score-metaConstructionScore({...card,base:4},[],0).score).toBe(.5);
});
it('谷口AUTO-2・河田AUTO-2、山下は基礎2でAUTO種類数を維持',()=>{
 const g=createGame([5,1,2,3,4,6,7,8],[26,27,28,18,10,14,9,13],['A','B','C'],['D','E','F'],'local',()=>.5);
 expect(skillFor(5).autoEffects!(calculationContext(g.p1,g.p2,5,g.roundSong))).toContainEqual(expect.objectContaining({amount:-2,opponent:true}));
 const h=createGame([40,1,2,3,4,6,7,8],[26,27,28,18,10,14,9,13],['A','B','C'],['D','E','F'],'local',()=>.5);
 expect(skillFor(40).autoEffects!(calculationContext(h.p1,h.p2,40,h.roundSong))).toContainEqual(expect.objectContaining({amount:-2,opponent:true}));
 const y=createGame([45,1,2,3,4,6,7,8],[26,27,28,18,10,14,9,13],['A','B','C'],['D','E','F'],'local',()=>.5);expect(byId(45).base).toBe(2);
 for(const kinds of [[],['CENTER','FRONT'],['CENTER','FRONT','MIDDLE','BACKS']]){y.p1.states[45].positionKinds=kinds;expect(skillFor(45).autoAppeal!(calculationContext(y.p1,y.p2,45,y.roundSong))).toBe(new Set([...kinds,'CENTER']).size);}
});
