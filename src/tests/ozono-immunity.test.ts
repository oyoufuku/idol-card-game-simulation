import {expect,it} from 'vitest';
import {createGame,preview,executeRound,createCpuPreview} from '../game/engine';
import {applyBurst} from '../game/burst';
import {setAnalysisSkillMasks} from '../game/analysis-skills';
import {songById} from '../data/songs';
import {posOf,POSITION_FATIGUE} from '../game/formation';
function supported(){
 const g=createGame([25,14,15,18,27,10,8,24],[1,16,34,36,45,17,21,23],['A','B','C'],['D','E','F'],'local',()=>.5);
 g.round=g.p1.round=g.p2.round=2;g.roundSong=songById('A');
 for(const p of [g.p1,g.p2])for(const id of p.ids){p.states[id].prevPos=posOf(p,id);p.states[id].normalUsed=true;}
 setAnalysisSkillMasks(g.p2,g.p2.ids.map(id=>({id,kind:'ALL'})));
 applyBurst(g,g.p1,g.p2,10,true,()=>.5);g.p1.states[15].fatigue=3;return g;
}
it('大園Aは味方A/B/Cと曲の加算を受け、B中だけ各上昇を2倍にする。位置・既存疲労は倍にしない',()=>{
 const g=supported();
 const gains=(r:ReturnType<typeof preview>)=>r.p1.members.find(m=>m.id===15)!.breakdown!.filter(e=>e.amount>0&&['A','B','C','曲'].includes(e.kind)).map(e=>({kind:e.kind,amount:e.amount}));
 const normal=preview(g);expect(gains(normal)).toEqual([{kind:'A',amount:1},{kind:'B',amount:1},{kind:'C',amount:1},{kind:'曲',amount:1}]);
 applyBurst(g,g.p1,g.p2,15,true,()=>.5);g.p1.states[15].fatigue=3;
 const burst=preview(g);expect(gains(burst)).toEqual(gains(normal).map(e=>({...e,amount:2})));
 expect(burst.p1.members.find(m=>m.id===15)!.val-normal.p1.members.find(m=>m.id===15)!.val).toBe(4);
 expect(createCpuPreview(g)(g.p1.formation,g.p2.formation).p1.total).toBe(burst.p1.total);
 expect(executeRound(g).p1.total).toBe(burst.p1.total);
});
it('大園Aは通常時から相手の疲労付与・PLAINと曲の疲労を防ぎ、位置疲労・既存疲労は受ける',()=>{
 const g=supported();setAnalysisSkillMasks(g.p2,g.p2.ids.filter(id=>![16,36].includes(id)).map(id=>({id,kind:'ALL'})));
 g.p2.formation={CENTER:36,'FRONT-L':16,'FRONT-R':1,'MIDDLE-L':34,'MIDDLE-R':45};g.roundSong=songById('C');
 const r=preview(g);expect(r.players[0].states[15]).toMatchObject({shield:true,negativeShield:true,plain:false,fatigue:3});
 expect(r.p1.members.find(m=>m.id===15)!.breakdown!.filter(e=>e.kind==='疲労').reduce((n,e)=>n+e.amount,0)).toBe(-1);
 executeRound(g);expect(g.p1.states[15].fatigue).toBe(3+POSITION_FATIGUE['FRONT-R']);
});
it('大園のAUTO/BURST除外は独立し、Aを外すとマイナス無効が消え、Bだけを外すと加算は1倍になる',()=>{
 const g=supported();applyBurst(g,g.p1,g.p2,15,true,()=>.5);
 setAnalysisSkillMasks(g.p1,[{id:15,kind:'BURST'}]);const noB=preview(g);expect(noB.players[0].states[15].shield).toBe(true);expect(noB.p1.members.find(m=>m.id===15)!.skillGain).toBe(4);
 setAnalysisSkillMasks(g.p1,[{id:15,kind:'AUTO'}]);const noA=preview(g);expect(noA.players[0].states[15].shield).toBe(false);expect(noA.p1.members.find(m=>m.id===15)!.skillGain).toBe(8);
});
