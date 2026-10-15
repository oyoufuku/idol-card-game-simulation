import {expect,it} from 'vitest';
import {createGame} from '../game/engine';
import {byId,validateFormation} from '../game/formation';
import {SLOTS} from '../game/types';
import {burstTargetKind,burstTargetOptions} from '../game/burst';
import {constructedTeams} from '../simulation/constructed-teams';
import {applyTrainingAction,advanceTrainingStep,createTrainingSession,trainingCourse,trainingCourses,trainingMessages,type TrainingSession} from '../tutorial/training';

function resolveOne(s:TrainingSession):TrainingSession{
 const job=s.game.pendingBursts?.[0];if(!job)return s;
 const options=burstTargetKind(job.id)?burstTargetOptions(s.game,job):[];
 return applyTrainingAction(s,{type:'burst',...(options.length?{target:options[0]}:{})});
}
export function completeCourse(id:string){
 let s=createTrainingSession(id),guard=0;
 while(!s.complete&&guard++<200){
  const goal=trainingCourse(id).steps[s.stepIndex].goal;
  // Keep the actual recorded performance effects when resolving queued B jobs.
  if(goal.type!=='burst')while(s.game.pendingBursts?.length)s=resolveOne(s);
  switch(goal.type){
   case 'inspect':case 'appeal':s=applyTrainingAction(s,{type:goal.type,id:goal.id,side:goal.side??0});break;
   case 'place':{
    if(goal.formation){for(const [index,slot] of SLOTS.entries()){
     const member=goal.formation[index];s=applyTrainingAction(s,{type:'inspect',id:member,side:0});s=applyTrainingAction(s,{type:'place',id:member,slot});
    }}else{s=applyTrainingAction(s,{type:'inspect',id:goal.id!,side:0});s=applyTrainingAction(s,{type:'place',id:goal.id!,slot:goal.slot!});}break;
   }
   case 'perform':s=applyTrainingAction(s,{type:'perform'});break;
   case 'advance-round':s=applyTrainingAction(s,{type:'advance-round'});break;
   case 'burst':while(s.game.pendingBursts?.length&&!s.stepComplete)s=resolveOne(s);break;
   case 'review-effect':{
    const index=trainingMessages(s).findIndex(e=>e.messageType==='target'&&(goal.sourceId===undefined||e.side===0&&e.id===goal.sourceId)&&(goal.kind===undefined||e.kind===goal.kind));
    expect(index,`${id}: effect ${goal.sourceId}/${goal.kind}`).toBeGreaterThanOrEqual(0);
    s=applyTrainingAction(s,{type:'review-effect',index});break;
   }
   case 'review-result':s=applyTrainingAction(s,{type:'review-result'});break;
  }
  expect(s.stepComplete,`${id}: step ${s.stepIndex} ${JSON.stringify(goal)}`).toBe(true);
  s=advanceTrainingStep(s);
 }
 expect(s.complete,id).toBe(true);return s;
}
it('入門8＋デッキ12コースは合法な盤面で始まり、カードやデッキの正本を書き換えない',()=>{
 const original=createGame([1,2,3,4,5,6,7,8],[25,26,27,28,29,30,31,32],['A','B','C'],['L','M','N'],'local',()=>.5),before=structuredClone(original),teams=constructedTeams(),teamBefore=structuredClone(teams),courses=trainingCourses();
 expect(courses.filter(c=>c.group==='入門')).toHaveLength(8);expect(courses.filter(c=>c.group==='デッキ')).toHaveLength(12);
 for(const course of courses){const a=createTrainingSession(course.id),b=createTrainingSession(course.id);expect(a).toEqual(b);expect(validateFormation(a.game.p1,a.game.p1.formation),course.id).toBeNull();expect(a.game.p1.ids).toHaveLength(8);expect(a.game.round).toBe(course.prelude+1);a.game.p1.states[a.game.p1.ids[0]].fatigue=999;expect(b.game.p1.states[b.game.p1.ids[0]].fatigue).not.toBe(999);}
 expect(original).toEqual(before);expect(teams).toEqual(teamBefore);
});
it('操作しないと進めず、間違ったカード・相手側・配置では課題を達成しない',()=>{
 let s=createTrainingSession('basic:team');expect(()=>advanceTrainingStep(s)).toThrow('課題');expect(()=>applyTrainingAction(s,{type:'perform'})).toThrow('先に');
 s=applyTrainingAction(s,{type:'inspect',id:25,side:0});expect(s.stepComplete).toBe(false);
 s=applyTrainingAction(s,{type:'inspect',id:31,side:1});expect(s.stepComplete).toBe(false);
 s=applyTrainingAction(s,{type:'inspect',id:31,side:0});expect(s.stepComplete).toBe(true);s=advanceTrainingStep(s);
 s=applyTrainingAction(s,{type:'place',id:31,slot:'FRONT-L'});expect(s.stepComplete).toBe(false);
 s=applyTrainingAction(s,{type:'place',id:31,slot:'MIDDLE-L'});expect(s.stepComplete).toBe(true);
 s=applyTrainingAction(s,{type:'place',id:31,slot:'FRONT-R'});expect(s.stepComplete).toBe(false);
});
it('全20コースが共有エンジンで課題クリアでき、勝利やCPU探索を必須にしない',()=>{
 for(const course of trainingCourses()){const s=completeCourse(course.id);expect(validateFormation(s.game.p1,s.game.p1.formation)).toBeNull();expect(s.game.result).not.toBeNull();}
});
it('チャージの実消費・再充填、3人登場、BACKS支援、R7のBURST廃止を実状態で学べる',()=>{
 const charge=completeCourse('deck:チャージ・序盤安定');expect(charge.game.p1.states[32].lastSpentCharge).toBeGreaterThanOrEqual(3);expect(charge.game.p1.states[32].charge).toBeGreaterThanOrEqual(3);expect(charge.game.p1.states[32].burstCount).toBeGreaterThan(0);
 const moving=completeCourse('deck:移動・疲労軽減');expect(moving.game.p1.states[9].burstCount).toBeGreaterThan(0);expect(moving.game.p1.enteredThisRoundIds).toHaveLength(3);
 const meta=completeCourse('deck:対単一属性・クールメタ');expect(meta.observedEffects.some(e=>e.id===17&&e.kind==='A'&&e.targets.some(t=>t.side===1))).toBe(true);
 const encore=completeCourse('basic:songs');expect(encore.game.round).toBe(7);expect(encore.game.done).toBe(true);expect(encore.game.pendingBursts).toHaveLength(0);expect(encore.game.lastBurst).toEqual(createTrainingSession('basic:songs').game.lastBurst);expect(encore.observedEffects.filter(e=>e.phase==='burst')).toHaveLength(0);
 expect(byId(26).base).toBe(5);
});
