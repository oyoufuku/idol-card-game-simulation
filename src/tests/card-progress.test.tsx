import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkPlayer,createGame,executeRound} from '../game/engine';
import {byId,formationFromArray,posOf} from '../game/formation';
import {cardProgress} from '../components/card-progress';
import {IdolCardFace} from '../components/IdolCardFace';
import {CardInspector} from '../components/CardInspector';
import {MAX_CHARGE} from '../game/charge';
import {finishPerformance} from '../game/performance';
import {songById} from '../data/songs';

it('盤面と詳細の効果文へ実際のチャージ・消費・再充填値を追記し、未消費を成立扱いしない',()=>{
 const p=mkPlayer('P1',[32,38,44,43,1,2,3,4],['A','B','C']),s=p.states[32];s.charge=1;s.lastSpentCharge=4;
 expect(cardProgress(byId(32),p)).toEqual({A:'（現在チャージ1/5）',Bcond:'（現在消費0/3）',B:'（最終消費4）'});
 for(const expanded of [false,true]){
  const html=renderToStaticMarkup(<IdolCardFace card={byId(32)} player={p} attributes={['ユーモア']} expanded={expanded}/>);
  for(const text of Object.values(cardProgress(byId(32),p)))expect(html).toContain(text);
 }
 const inspector=renderToStaticMarkup(<CardInspector player={p} id={32} editable onClose={()=>{}}/>);
 expect(inspector).toContain('（現在チャージ1/5）');
 s.spentCharge=3;s.charge=0;expect(cardProgress(byId(32),p).Bcond).toBe('（現在消費3/3）');
 expect(cardProgress(byId(32))).toEqual({});
});
it('累計と連続を分け、移動により連続条件を外すとリセット表示し、実状態を変更しない',()=>{
 const p=mkPlayer('P1',[4,11,25,29,34,35,37,43],['A','B','C']);
 p.states[4].positionCounts.BACK=1;p.states[11].positionCounts.CENTER=1;
 p.formation=formationFromArray([11,34,25,29,37]);
 p.states[34].positionCounts['FRONT-L']=2;p.states[34].samePositionStreak=1;p.states[34].prevPos='FRONT-L';
 p.states[25].positionCounts['FRONT-R']=3;p.states[29].fatigueStreak=1;
 p.states[35].qualifiedBackRounds=1;
 p.previousBackIds=[4,35,43];p.backGroupStreak=1;
 const before=JSON.stringify(p);
 expect(cardProgress(byId(4),p).Bcond).toBe('（現在累計1/3）');
 expect(cardProgress(byId(11),p).Bcond).toBe('（現在累計1/2）');
 expect(cardProgress(byId(25),p).Bcond).toBe('（現在累計3/4）');
 expect(cardProgress(byId(34),p).Bcond).toBe('（現在累計2/3）');
 expect(cardProgress(byId(29),p).Bcond).toBe('（現在連続1/3）');
 expect(cardProgress(byId(35),p).Bcond).toBe('（現在累計1/2）');
 expect(cardProgress(byId(43),p).Bcond).toBe('（現在連続1/2）');
 expect(JSON.stringify(p)).toBe(before);
 p.formation=formationFromArray([11,25,34,29,37]);
 expect(cardProgress(byId(34),p).Bcond).toBe('（現在累計2/3）');
 expect(cardProgress(byId(25),p).Bcond).toBe('（現在累計0/4）');
 p.formation['MIDDLE-L']=4;
 expect(cardProgress(byId(43),p).Bcond).toBe('（現在連続0/2）');
});
it('終了時の実カウンターをそのまま表示し、当該ラウンドを二重加算しない',()=>{
 const g=createGame([11,34,25,29,37,4,35,43],[1,2,3,5,6,8,10,13],['A','B','C'],['L','M','N'],'local',()=>.5);
 executeRound(g,g.p1.formation,g.p2.formation,()=>.5);
 expect(cardProgress(byId(11),g.p1).Bcond).toBe('（現在累計1/2）');
 expect(cardProgress(byId(34),g.p1).Bcond).toBe('（現在累計1/3）');
 expect(cardProgress(byId(43),g.p1).Bcond).toBe('（現在連続1/2）');
});
it('竹内から受ける消費能力なしのメンバーも上限5、自然増加と再充填も上限以内',()=>{
 const p=mkPlayer('P1',[43,32,38,44,1,2,3,4],['A','B','C']),opp=mkPlayer('P2',[5,6,7,8,9,10,11,12],['L','M','N']);
 p.formation=formationFromArray([43,32,38,44,1]);
 for(let i=0;i<8;i++)finishPerformance(p,opp,songById('A'));
 for(const id of p.ids.filter(id=>posOf(p,id)==='BACK')){
  expect(p.states[id].charge).toBe(MAX_CHARGE);
  expect(cardProgress(byId(id),p).A).toBeUndefined();
  const html=renderToStaticMarkup(<CardInspector player={p} id={id} editable onClose={()=>{}}/>);expect(html).not.toContain('現在チャージ');expect(html).not.toContain('チャージ 5/5');
 }
 p.formation['MIDDLE-R']=2;
 finishPerformance(p,opp,songById('A'));
 expect(p.states[1].charge).toBe(1);
});
