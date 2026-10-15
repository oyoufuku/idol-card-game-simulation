import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef } from 'react';
import { byId } from '../game/formation';
import type { Game } from '../game/types';
import type { useSkillPlayback } from './useSkillPlayback';
import { playerCaption,skillDescription } from './presentation';
import type { MessageStep } from './presentation';
import { PlaybackSettings } from './PlaybackSettings';

const signed=(amount:number)=>`${amount>0?'+':''}${amount}`;
export function TargetMessage({game,event}:{game:Game;event:MessageStep}) {
  const target=event.targets[0];if(!target)return null;
  const labels=[...new Set(event.targets.map(t=>t.label))],values=[...new Set(event.targets.map(t=>t.delta))];
  const label=labels.length===1?target.label:'属性';
  const name=event.targetGroup||`${playerCaption(game,target.side)} ${byId(target.id).name}`;
  const amounts=values.filter((value):value is number=>value!==undefined).sort((a,b)=>a-b);
  return <>{name}{target.delta===undefined?`：${label}${labels.length>1?'が変更':''}！`:<>の{label}が <b className={target.delta>0?'amount-positive':'amount-negative'}>{amounts.length===1?signed(amounts[0]):`${signed(amounts[0])}〜${signed(amounts[amounts.length-1])}`}</b>！</>}
    {event.targetGroup&&(values.length>1||labels.length>1)&&<small className="group-effect-values">{event.targets.map(t=><span key={`${t.side}:${t.id}`}>{playerCaption(game,t.side)} {byId(t.id).name}：{t.delta===undefined?t.label:<b className={t.delta>0?'amount-positive':'amount-negative'}>{signed(t.delta)}</b>}</span>)}</small>}
  </>;
}
export function SkillPlaybackStatus({ game, playback,onAutoAdvanceChange }: { game: Game; playback: ReturnType<typeof useSkillPlayback>;onAutoAdvanceChange?:(enabled:boolean)=>void }) {
  const event = playback.active;
  const messageRef=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const message=messageRef.current;
    if(!event||!message)return;
    const root=document.documentElement;
    const reserve=()=>{
      const layout=document.querySelector('.battle-layout');
      const clearance=Math.max(0,message.getBoundingClientRect().bottom+6-(layout?.getBoundingClientRect().top??0));
      root.style.setProperty('--skill-message-clearance',`${Math.ceil(clearance)}px`);
    };
    reserve();
    const observer=new ResizeObserver(reserve);
    observer.observe(message);
    window.addEventListener('resize',reserve);
    return ()=>{observer.disconnect();window.removeEventListener('resize',reserve);root.style.removeProperty('--skill-message-clearance');};
  },[!!event]);
  if (!event) return null;
  const source=event.side===null?(event.kind==='曲'?'曲':'終了処理'):playerCaption(game,event.side);
  const name=event.id===null?event.label:byId(event.id).name;
  const kind=event.kind==='曲'?'楽曲効果':event.kind==='終了'?'終了時効果':`${event.kind}スキル`;
  return createPortal(<div className="skill-message-layer">
    <aside ref={messageRef} className="skill-playback-status central-skill-message" aria-label="スキル演出" role="status">
      <div key={`${playback.eventKey}:${playback.autoAdvance}`} className={`skill-message-motion${playback.autoAdvance?'':' manual-playback'}`} style={playback.autoAdvance?{animationDuration:`${event.durationMs}ms`}:undefined}>
        <small className="message-source">{source} · {name} · {kind}　{playback.index+1}/{playback.count}</small>
        <p className="skill-message-text">{event.messageType==='source'?`${source} ${name}の${kind}！`:<TargetMessage game={game} event={event}/>}</p>
        <details className="message-ability" open><summary>スキル効果を確認</summary><p>{skillDescription(game,event)}</p></details>
      </div>
      <div className="message-controls"><div className="message-actions"><button onClick={playback.next}>次へ →</button><button onClick={playback.skip}>スキップ</button></div>
        {onAutoAdvanceChange&&<PlaybackSettings autoAdvance={playback.autoAdvance} onChange={onAutoAdvanceChange}/>}
      </div>
    </aside>
  </div>,document.body);
}
