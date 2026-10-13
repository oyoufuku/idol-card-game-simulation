import { expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame,executeRound } from '../game/engine';
import { applyBurst } from '../game/burst';
import { idsBack } from '../game/formation';
import type { SkillEffect } from '../game/types';
import { buildSkillMessages } from '../components/presentation';
import { TargetMessage } from '../components/SkillPlaybackStatus';
import { AUTO_ADVANCE_KEY,readAutoAdvance } from '../components/PlaybackSettings';
const make=()=>createGame([43,8,13,16,17,1,2,3],[10,14,18,25,26,27,28,30],['A','B','C'],['D','E','F'],'local',()=>.5,{recordEffects:true,interactiveBursts:true});
it('竹内の実AUTOはBACKS3人を1メッセージ・同時カードエフェクトにまとめる',()=>{
 const g=make();executeRound(g);const messages=buildSkillMessages(g.skillEffects!,g);
 const targets=messages.filter(m=>m.id===43&&m.kind==='A'&&m.messageType==='target');
 expect(targets).toHaveLength(1);expect(targets[0].targetGroup).toBe('自チーム（P1）のBACKS全員');
 expect(targets[0].targets.map(t=>t.id)).toEqual(idsBack(g.p1));expect(targets[0].targets.every(t=>t.delta===1)).toBe(true);
 const html=renderToStaticMarkup(<TargetMessage game={g} event={targets[0]}/>);expect(html).toContain('BACKS全員');expect(html).toContain('+1');expect(html).not.toContain('石森璃花');
});
it('小田倉のB属性追加は属性が異なる相手も1つのチームメッセージにし、対象を失わない',()=>{
 const g=make();g.p2.states[14].attributeOverride='キュート';g.p2.states[25].attributeOverride='キュート';g.p2.states[27].attributeOverride='ユーモア';
 applyBurst(g,g.p1,g.p2,3);const before=structuredClone(g.skillEffects);
 const step=buildSkillMessages(g.skillEffects!,g).find(m=>m.id===3&&m.targetGroup?.startsWith('相手チーム'))!;
 // Existing COOL members do not receive a duplicate attribute, so only changed members animate.
 expect(step.targets).toHaveLength(3);expect(step.targetGroup).toContain('対象メンバー3人');expect(step.targets.every(t=>t.delta===undefined)).toBe(true);
 expect(g.skillEffects).toEqual(before);
});
it('全16人への同じ効果は全員、片側8人なら自/相手チームとしてまとめる',()=>{
 const g=make();const event:SkillEffect={side:0,id:16,kind:'A',phase:'performance',position:'MIDDLE-L',label:'全体効果',targets:[g.p1,g.p2].flatMap((p,side)=>p.ids.map(id=>({side:side as 0|1,id,label:'疲労値',delta:1})))};
 const before=structuredClone(event),messages=buildSkillMessages([event],g);expect(messages).toHaveLength(2);expect(messages[1].targetGroup).toBe('全員（P1・P2）');expect(messages[1].targets).toHaveLength(16);expect(event).toEqual(before);
 const one=buildSkillMessages([{...event,side:1,targets:event.targets.filter(t=>t.side===0)}],g);expect(one[1].targetGroup).toBe('相手チーム（P1）の全員');
});
it('減少量の違いは同時表示に残し、正負・発動者・スキル・タイミングは混ぜない',()=>{
 const g=make();const event:SkillEffect={side:0,id:13,kind:'B',phase:'burst',position:'FRONT-R',label:'井上',targets:g.p1.ids.map((id,i)=>({side:0,id,label:'疲労値',delta:i?-2:-1}))};
 const messages=buildSkillMessages([event],g);expect(messages).toHaveLength(2);expect(messages[1].targets.map(t=>t.delta)).toEqual(event.targets.map(t=>t.delta));
 const html=renderToStaticMarkup(<TargetMessage game={g} event={messages[1]}/>);expect(html).toContain('-2〜-1');expect(html).toContain('amount-negative');expect(html).toContain('竹内希来里');
 const mixed={...event,targets:[...event.targets,{side:1 as const,id:10,label:'疲労値',delta:2}]};expect(buildSkillMessages([mixed],g).filter(m=>m.messageType==='target')).toHaveLength(2);
 expect(buildSkillMessages([event,{...event,id:16},{...event,kind:'A'},{...event,phase:'post'}],g).filter(m=>m.messageType==='source')).toHaveLength(4);
});
it('相手BACKSは相手チームとしてまとめ、1人への効果は個人名のまま',()=>{
 const g=make(),event:SkillEffect={side:0,id:16,kind:'A',phase:'performance',position:'MIDDLE-L',label:'効果',targets:idsBack(g.p2).map(id=>({side:1,id,label:'疲労値',delta:1}))};
 const all=buildSkillMessages([event],g)[1];expect(all.targetGroup).toBe('相手チーム（P2）のBACKS全員');
 const one=buildSkillMessages([{...event,targets:event.targets.slice(0,1)}],g)[1];expect(one.targetGroup).toBeUndefined();expect(renderToStaticMarkup(<TargetMessage game={g} event={one}/>)).toContain('髙橋未来虹');
});
it('自動進行は初期ON、保存したOFFを読み込み、保存不可でも動作する',()=>{
 expect(readAutoAdvance({getItem:key=>{expect(key).toBe(AUTO_ADVANCE_KEY);return null;}})).toBe(true);
 expect(readAutoAdvance({getItem:()=> 'false'})).toBe(false);expect(readAutoAdvance({getItem:()=> 'true'})).toBe(true);
 expect(readAutoAdvance({getItem:()=>{throw new Error('blocked');}})).toBe(true);
});
