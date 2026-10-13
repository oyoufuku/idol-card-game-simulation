import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {SONGS,SELECTABLE_SONGS,songById} from '../data/songs';
import {createGame,executeRound,nextRound,prepareRound} from '../game/engine';
import {applyBurst} from '../game/burst';
import {randomTeam,generateArchetypes} from '../simulation/teams';
import {Setup} from '../components/Setup';
const make=()=>createGame([14,46,8,10,18,24,27,28],[1,2,3,4,5,6,7,8],['A','B','C'],['D','E','F'],'local',()=>.5);
it('K/Sの22曲データを維持し、通常選択20曲からだけ生成・表示する',()=>{
 expect(SONGS).toHaveLength(22);expect(SELECTABLE_SONGS).toHaveLength(20);
 for(const id of ['K','S'])expect(songById(id).selectable).toBe(false);
 const html=renderToStaticMarkup(createElement(Setup,{onStart:()=>{}}));expect(html).not.toContain('ジャマイカビール');expect(html).not.toContain('NO WAR in the future');
 for(let seed=0;seed<30;seed++)for(const team of [randomTeam(seed,'T'),...generateArchetypes(seed)]){expect(team.songs).toHaveLength(3);expect(new Set(team.songs).size).toBe(3);expect(team.songs.every(id=>songById(id).selectable!==false)).toBe(true);}
});
it('両プレイヤーの選択曲・通常デッキ・ENCORE poolへ特殊曲を指定できない',()=>{
 for(const id of ['K','S']){
  const g=make();for(const side of [1,2])expect(()=>createGame(g.p1.ids,g.p2.ids,side===1?['A','B',id]:g.p1.songs,side===2?['D','E',id]:g.p2.songs,'local')).toThrow('特殊楽曲');
  expect(()=>createGame(g.p1.ids,g.p2.ids,g.p1.songs,g.p2.songs,'local',()=>.5,{songDeck:[id]})).toThrow('特殊楽曲');
  expect(()=>createGame(g.p1.ids,g.p2.ids,g.p1.songs,g.p2.songs,'local',()=>.5,{encorePool:[id]})).toThrow('特殊楽曲');
 }
});
it.each([[14,'K'],[46,'S']] as const)('No.%iのBだけは次の楽曲%sを指定し、通常抽選・消費を省略する',(id,song)=>{
 const g=make(),before=[...g.songDeck];applyBurst(g,g.p1,g.p2,id,false,()=>.5);g.roundResolved=true;
 nextRound(g,()=>{throw new Error('通常抽選なし');});expect(g.roundSong.id).toBe(song);expect(g.songDeck).toEqual(before);expect([...g.p1.songs,...g.p2.songs]).not.toContain(song);
 executeRound(g,g.p1.formation,g.p2.formation,()=>.5);nextRound(g,()=>.5);expect(g.roundSong.id).toBe(before[0]);expect(g.songDeck).toHaveLength(before.length-1);
});
it('ENCORE通常抽選は20曲のみ。R7のB変更は特殊曲にできるが通常候補を変えない',()=>{
 const g=make();g.round=7;
 for(const random of [0,.49,.999]){g.encoreSong=undefined;prepareRound(g,()=>random);expect([...g.p1.songs,...g.p2.songs]).toContain(g.roundSong.id);expect(g.roundSong.selectable).not.toBe(false);}
 const pool=[...g.p1.songs,...g.p2.songs],deck=[...g.songDeck];applyBurst(g,g.p1,g.p2,46,true,()=>.5);prepareRound(g,()=>{throw new Error('特殊楽曲ではENCOREも抽選しない');});expect(g.roundSong.id).toBe('S');expect(g.songDeck).toEqual(deck);expect([...g.p1.songs,...g.p2.songs]).toEqual(pool);
});
