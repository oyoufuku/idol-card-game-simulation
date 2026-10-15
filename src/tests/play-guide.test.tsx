import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DECK_GUIDES,GUIDE_LESSONS} from '../data/play-guide';
import {SHARED_RULES} from '../data/shared-rules';
import {constructedTeams} from '../simulation/constructed-teams';
import {DeckGuideView,GuideLessonView,LessonVisual} from '../components/PlayGuide';
import {createGame,executeRound,nextRound,preview} from '../game/engine';
import {attributesOf,byId,formationFromArray,hasThreeBackAttributes,idsBack,idsStage,oppositeSlot,POSITION_FATIGUE,setFormation,validateFormation} from '../game/formation';
import {scoreRound} from '../game/scoring';
import {songById} from '../data/songs';

it('現行12デッキに戦い方と合法な5人/3人の配置例を1つずつ備え、デッキ自体は変更しない',()=>{
 const teams=constructedTeams(),before=structuredClone(teams);
 expect(DECK_GUIDES).toHaveLength(12);expect(new Set(DECK_GUIDES.map(g=>g.name)).size).toBe(12);
 expect(DECK_GUIDES.map(g=>g.name).sort()).toEqual(teams.map(t=>t.name).sort());
 for(const team of teams){
  const guide=DECK_GUIDES.find(g=>g.name===team.name)!;
  const game=createGame(team.members,team.members,team.songs,team.songs,'local',()=>.5);
  const opening=formationFromArray([...guide.opening]);expect(validateFormation(game.p1,opening),team.name).toBeNull();
  setFormation(game.p1,opening,1);expect(idsBack(game.p1),team.name).toHaveLength(3);
  const gameBefore=structuredClone(game),html=renderToStaticMarkup(<DeckGuideView team={team} guide={guide}/>);
  for(const id of team.members)expect(html).toContain(byId(id).name);
  for(const id of team.songs)expect(html).toContain(songById(id).name);
  expect(html).toContain('狙うBURST');expect(html).toContain('R7終了時に新しくBURSTはしません');
  expect(html.match(/data-opening-slot=/g)).toHaveLength(5);expect(html.match(/data-guide-card=/g)).toHaveLength(8);
  expect(preview(game).p1.members).toHaveLength(5);expect(game).toEqual(gameBefore);
 }
 expect(teams).toEqual(before);
});
it('配置例でクールのシンメ、BURSTのユーモア3人、多属性のFRONTとBACKS条件を実際に満たす',()=>{
 const board=(index:number)=>{const team=constructedTeams()[index],g=createGame(team.members,team.members,team.songs,team.songs,'local',()=>.5);setFormation(g.p1,formationFromArray([...DECK_GUIDES[index].opening]),1);return g.p1;};
 const cool=board(0);expect(cool.formation.CENTER).toBe(11);expect([cool.formation['FRONT-L'],cool.formation['FRONT-R']]).toEqual([14,18]);
 expect(idsStage(cool).filter(id=>attributesOf(cool,id).includes('クール')).length).toBeGreaterThanOrEqual(3);
 const burst=board(2);expect(idsStage(burst).filter(id=>attributesOf(burst,id).includes('ユーモア')).length).toBeGreaterThanOrEqual(3);
 const multi=board(4);expect(multi.formation.CENTER).toBe(22);expect(attributesOf(multi,multi.formation['FRONT-L'])).toContain('クール');expect(attributesOf(multi,multi.formation['FRONT-R'])).toContain('ユーモア');expect(hasThreeBackAttributes(multi)).toBe(true);
 expect(board(5).formation['FRONT-L']).toBe(19);expect(board(6).formation.CENTER).toBe(26);expect(idsBack(board(6))).toContain(13);
});
it('チャージの例は3コアをBACKS・竹内を出場させ、実終了処理で各2ずつ蓄積する',()=>{
 const team=constructedTeams()[1],g=createGame(team.members,team.members,team.songs,team.songs,'local',()=>.5);
 const opening=formationFromArray([...DECK_GUIDES[1].opening]);setFormation(g.p1,opening,1);
 expect(idsBack(g.p1)).toEqual([32,38,44]);expect(idsStage(g.p1)).toContain(43);
 for(let round=1;round<=2;round++){
  g.roundSong=songById('J');executeRound(g);
  for(const id of [32,38,44])expect(g.p1.states[id].charge).toBe(round*2);
  if(round<2)nextRound(g,()=>.5);
 }
});
it('入門8項目の参照先が存在し、得点・左右対面・疲労・R7判定の説明を揃える',()=>{
 expect(GUIDE_LESSONS).toHaveLength(8);expect(new Set(GUIDE_LESSONS.map(l=>l.id)).size).toBe(8);
 for(const lesson of GUIDE_LESSONS){
  for(const code of lesson.rules)expect(SHARED_RULES.some(r=>r.code===code),`${lesson.id}:${code}`).toBe(true);
  const html=renderToStaticMarkup(<GuideLessonView lesson={lesson} onRule={()=>{}}/>);
  expect(html).toContain(lesson.title);expect(html).toContain('やってみよう');
  if(lesson.quiz){expect(lesson.quiz.correct).toBeGreaterThanOrEqual(0);expect(lesson.quiz.correct).toBeLessThan(lesson.quiz.answers.length);}
 }
 expect(scoreRound(8,0,7).points).toBe(2);expect(oppositeSlot('MIDDLE-L')).toBe('MIDDLE-R');expect(POSITION_FATIGUE.CENTER).toBe(3);
 const score=renderToStaticMarkup(<LessonVisual kind="score"/>);expect(score).toContain('<td>3</td>');
 const position=renderToStaticMarkup(<LessonVisual kind="formation"/>);expect(position).toContain('Appeal ＋2');expect(position).toContain('疲労 ＋3');
 const fatigue=renderToStaticMarkup(<LessonVisual kind="fatigue"/>);for(const v of [0,-1,-2,-3])expect(fatigue).toContain(`<td>${v}</td>`);
 expect(GUIDE_LESSONS.find(l=>l.id==='burst')!.points.join('')).toContain('R7終了時には新しくBURSTしません');
});
