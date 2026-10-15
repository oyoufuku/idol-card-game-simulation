import {expect,it} from 'vitest';
import {createGame,executeRound,preview,createCpuPreview,nextRound} from '../game/engine';
import {setAnalysisSkillMasks} from '../game/analysis-skills';
import {formationFromArray,setFormation} from '../game/formation';
import {songById} from '../data/songs';
import {resolvePendingBursts} from '../game/burst';

function scenario(id:number,charge:number){
 const g=createGame([8,10,18,24,27,32,38,44],[13,15,17,19,21,23,25,27],['J','M','N'],['A','B','C'],'local',()=>.5,{interactiveBursts:true,recordEffects:true});
 g.round=g.p1.round=g.p2.round=2;g.roundSong=songById('N');
 for(const p of [g.p1,g.p2])for(const member of p.ids)p.states[member].normalUsed=true;
 setAnalysisSkillMasks(g.p2,g.p2.ids.map(id=>({id,kind:'ALL'})));
 g.p1.states[id].charge=charge;g.p1.states[id].prevPos='BACK';
 const f=formationFromArray([8,10,18,id,27]);
 if(id===44){g.p1.states[8].fatigue=6;g.p2.states[13].fatigue=6;}
 return {g,f};
}
it.each([32,38,44])('チャージ型%sは5消費時だけ自身AUTOに+2、通常予測・CPU予測・実行が一致する',id=>{
 for(const charge of [0,3,4,5]){
  const {g,f}=scenario(id,charge),before=structuredClone(g),pred=preview(g,f,g.p2.formation),cpu=createCpuPreview(g)(f,g.p2.formation);
  expect(g).toEqual(before);expect(cpu.p1.members.map(m=>m.val)).toEqual(pred.p1.members.map(m=>m.val));
  expect(pred.players[0].states[id].spentCharge).toBe(charge);expect(pred.players[0].states[id].charge).toBe(0);
  const own=pred.p1.members.find(m=>m.id===id)!;
  const actualAuto=(own.breakdown||[]).filter(x=>x.sourceId===id&&x.kind==='A').reduce((n,x)=>n+x.amount,0);
  expect(actualAuto).toBe((id===32?charge:0)+(charge===5?2:0));
  if(id===44){expect(pred.players[0].states[8].fatigue).toBe(6-charge);expect(pred.players[1].states[13].fatigue).toBe(6+charge);}
  const result=executeRound(g,f,g.p2.formation,()=>.5);expect(result.p1.total).toBe(pred.p1.total);expect(result.p1.members.find(m=>m.id===id)!.val).toBe(own.val);
 }
});
it.each([32,38,44])('チャージ型%sの+2は再充填や保持だけでは付かず、登場した1回だけ',id=>{
 const {g,f}=scenario(id,5);executeRound(g,f,g.p2.formation,()=>.5);resolvePendingBursts(g,()=>.5);nextRound(g,()=>.5);g.roundSong=songById('N');
 // Keep the same stage position rather than entering again; even a stored five
 // cannot become a new consumption or a persistent bonus.
 g.p1.states[id].charge=5;setFormation(g.p1,f,g.round);const pred=preview(g);
 expect(pred.players[0].states[id].spentCharge).toBe(0);
 expect((pred.p1.members.find(m=>m.id===id)!.breakdown||[]).filter(x=>x.sourceId===id&&x.kind==='A').reduce((n,x)=>n+x.amount,0)).toBe(0);
});
it.each([32,38,44])('チャージ型%sの満充填追加はAUTO無効なら加算しない',id=>{
 const {g,f}=scenario(id,5);setAnalysisSkillMasks(g.p1,[{id,kind:'AUTO'}]);
 const pred=preview(g,f,g.p2.formation);expect((pred.p1.members.find(m=>m.id===id)!.breakdown||[]).some(x=>x.sourceId===id&&x.kind==='A'&&x.amount>0)).toBe(false);
});
