import type { EffectTarget, Game, SkillEffect } from '../game/types';
import { byId, idsBack, idsStage } from '../game/formation';
import { buildSkillPlayback, type PlaybackStep } from './skill-playback';
export const BURST_PRESENTATION_MS=4600;
export interface MessageStep extends PlaybackStep { messageType:'source'|'target'; durationMs:number; targetGroup?:string }
const isAttribute=(label:string)=>/^(クール|キュート|ユーモア|PLAIN)( \/ (クール|キュート|ユーモア))*$/.test(label);
/** Group only presentation data: every actual target/delta remains available for card effects. */
function targetGroups(step:PlaybackStep,game?:Game):{targets:EffectTarget[];targetGroup?:string}[] {
  if(!game)return step.targets.map(target=>({targets:[target]}));
  const metrics=new Map<string,EffectTarget[]>();
  for(const target of step.targets){
    const key=`${isAttribute(target.label)?'属性':target.label}:${target.delta===undefined?'text':Math.sign(target.delta)}`;
    const list=metrics.get(key)||[];list.push(target);metrics.set(key,list);
  }
  const players=[game.p1,game.p2];
  const covers=(targets:EffectTarget[],side:number,ids:number[])=>ids.length>0&&targets.filter(t=>t.side===side).length===ids.length&&ids.every(id=>targets.some(t=>t.side===side&&t.id===id));
  return [...metrics.values()].flatMap(targets=>{
    if(players.every((p,side)=>covers(targets,side,p.ids)))return [{targets,targetGroup:'全員（P1・P2）'}];
    if(players.every((p,side)=>covers(targets,side,idsStage(p))))return [{targets,targetGroup:'両チームのステージ全員'}];
    return ([0,1] as const).flatMap(side=>{
      const selected=targets.filter(t=>t.side===side);if(!selected.length)return [];
      if(selected.length===1)return [{targets:selected}];
      const p=players[side],team=step.side===null?playerCaption(game,side):`${side===step.side?'自チーム':'相手チーム'}（${playerCaption(game,side)}）`;
      const suffix=covers(selected,side,p.ids)?'全員':covers(selected,side,idsBack(p))?'BACKS全員':covers(selected,side,idsStage(p))?'ステージ全員':`対象メンバー${selected.length}人`;
      return [{targets:selected,targetGroup:`${team}の${suffix}`}];
    });
  });
}
/** Announce an actor, then explain each metric; team-wide effects animate together. */
export function buildSkillMessages(events:SkillEffect[],game?:Game):MessageStep[] {
  const sources=new Map<string,PlaybackStep>();
  for(const step of buildSkillPlayback(events)){
    const source=`${step.phase}:${step.side}:${step.id}:${step.kind}`;
    const existing=sources.get(source);
    if(existing)existing.targets.push(...step.targets);else sources.set(source,{...step,targets:[...step.targets]});
  }
  return [...sources.entries()].flatMap(([source,step]):MessageStep[]=>[
    {...step,key:`${source}:announce`,targets:[],messageType:'source',durationMs:2600},
    ...targetGroups(step,game).map((group,index):MessageStep=>({...step,...group,key:`${source}:target:${index}`,messageType:'target',durationMs:3200})),
  ]);
}
export function skillDescription(game:Game,event:PlaybackStep):string {
  if(event.kind==='曲')return game.roundSong.effect;
  if(event.id===null)return event.label;
  const card=byId(event.id);
  return event.kind==='A'?card.A:event.kind==='B'?card.B:event.kind==='C'?card.C||'CENTER SKILLなし':'パフォーマンス終了後の疲労処理';
}
export function playerCaption(game:Game,side:0|1):string {return side===0?'P1':game.cpuMode?'P2（CPU）':'P2';}
