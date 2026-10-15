import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createGame,executeRound,nextRound,preview} from '../game/engine';
import {resolvePendingBursts} from '../game/burst';
import {byId,formationFromArray,setFormation} from '../game/formation';
import {calculationContext} from '../game/context';
import {skillFor} from '../game/skills';
import {songById} from '../data/songs';
import {cardProgress} from '../components/card-progress';
import {IdolCardFace} from '../components/IdolCardFace';
import type {Slot} from '../game/types';

function scenario(){
 const g=createGame([34,8,10,18,24,27,28,30],[8,10,18,24,27,28,30,31],['A','B','C'],['D','E','F'],'local',()=>.5,{interactiveBursts:true});
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;
 g.p1.states[34].normalUsed=false;
 return g;
}
function arrange(g:ReturnType<typeof scenario>,slot:Slot|'BACK'){
 const f=formationFromArray([8,10,18,24,27]);if(slot!=='BACK')f[slot]=34;
 setFormation(g.p1,f,g.round);g.roundSong=songById('A');
}
it('石塚は左右FRONTを合算し、休息・別位置を挟んでも3回目の終了で通常BURSTする',()=>{
 const g=scenario(),positions=['FRONT-L','BACK','FRONT-R','MIDDLE-L','FRONT-L'] as const,counts=[1,1,2,2,3];
 for(const [index,slot] of positions.entries()){
  arrange(g,slot);
  const before=structuredClone(g.p1.states[34].positionCounts);preview(g);preview(g);
  expect(g.p1.states[34].positionCounts).toEqual(before);
  executeRound(g,g.p1.formation,g.p2.formation,()=>.5);
  expect(cardProgress(byId(34),g.p1).Bcond).toBe(`（現在累計${counts[index]}/3）`);
  expect(g.pendingBursts?.some(job=>job.side===0&&job.id===34)).toBe(index===4);
  if(index<4)nextRound(g,()=>.5);
 }
 resolvePendingBursts(g,()=>.5);
 expect(g.p1.states[34].burstCount).toBe(1);
 expect(g.p1.states[34].normalUsed).toBe(true);
});
it('FRONT以外の終了は加算せず、既に3回の履歴があっても判定時FRONTでなければ成立しない',()=>{
 const g=scenario(),s=g.p1.states[34];s.positionCounts={'FRONT-L':1,'FRONT-R':2,CENTER:2,BACK:3};
 for(const slot of ['BACK','CENTER','MIDDLE-R'] as const){arrange(g,slot);expect(skillFor(34).condition!(calculationContext(g.p1,g.p2,34,g.roundSong))).toBe(false);expect(cardProgress(byId(34),g.p1).Bcond).toBe('（現在累計3/3）');}
 arrange(g,'FRONT-R');expect(skillFor(34).condition!(calculationContext(g.p1,g.p2,34,g.roundSong))).toBe(true);
});
it('カード印字・盤面・拡大カードの進捗を累計へ揃える',()=>{
 const g=scenario();g.p1.states[34].positionCounts={'FRONT-L':1,'FRONT-R':1};
 for(const expanded of [false,true]){
  const html=renderToStaticMarkup(<IdolCardFace card={byId(34)} player={g.p1} attributes={['キュート']} expanded={expanded}/>);
  expect(html).toContain('FRONTで累計3回終了。');expect(html).toContain('（現在累計2/3）');expect(html).not.toContain('連続終了');
 }
});
it('3回目のFRONT終了がR7なら、新しいBURSTを開始しない',()=>{
 const g=scenario();
 for(const [index,slot] of (['FRONT-L','BACK','FRONT-R','BACK','CENTER','MIDDLE-L','FRONT-R'] as const).entries()){
  arrange(g,slot);executeRound(g,g.p1.formation,g.p2.formation,()=>.5);
  expect(g.pendingBursts).toHaveLength(0);if(index<6)nextRound(g,()=>.5);
 }
 expect(cardProgress(byId(34),g.p1).Bcond).toBe('（現在累計3/3）');expect(g.p1.states[34].burstCount).toBe(0);expect(g.done).toBe(true);
});
