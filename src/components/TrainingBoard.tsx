import {useEffect,useMemo,useRef,useState} from 'react';
import {SLOTS,type Slot} from '../game/types';
import {byId} from '../game/formation';
import {preview} from '../game/engine';
import {burstTargetKind,burstTargetOptions} from '../game/burst';
import {applyTrainingAction,advanceTrainingStep,createTrainingSession,trainingCourse,trainingMessages,type TrainingAction,type TrainingSession} from '../tutorial/training';
import {CardBoard} from './CardBoard';
import {CardInspector} from './CardInspector';
import {AppealBreakdown} from './AppealBreakdown';
import {TargetMessage} from './SkillPlaybackStatus';
import {playbackAttributePlayers} from './battle-view';

function TrainingBurst({session,onAction}:{session:TrainingSession;onAction:(action:TrainingAction)=>void}){
 const [target,setTarget]=useState<number|null>(null),g=session.game,job=g.pendingBursts?.[0];if(!job)return null;
 const kind=burstTargetKind(job.id),options=kind?burstTargetOptions(g,job):[],needsTarget=job.side===0&&!!kind&&options.length>0;
 return <section className="training-burst-panel" aria-label="練習のBURST対象選択"><h4>{job.side===0?'P1':'練習相手'} {byId(job.id).name}のBURST</h4><p>{byId(job.id).B}</p>{needsTarget&&<label>対象を選択<select aria-label="練習のBURST対象" value={target??''} onChange={e=>setTarget(Number(e.target.value))}><option value="" disabled>対象を選んでください</option>{options.map(id=><option key={id} value={id}>{byId(id).name}</option>)}</select></label>}<button type="button" disabled={needsTarget&&target===null} onClick={()=>onAction({type:'burst',...(needsTarget?{target:target!}:{})})}>このカードをBURST</button><small>残っているBURSTを1枚ずつ解決します。通常対戦と同じB効果・対象選択です。</small></section>;
}
export function TrainingBoard({session,onChange}:{session:TrainingSession;onChange:(session:TrainingSession)=>void}){
 const root=useRef<HTMLDivElement>(null);
 const [error,setError]=useState(''),course=trainingCourse(session.courseId),step=course.steps[session.stepIndex],g=session.game;
 const forecast=useMemo(()=>g.roundResolved?null:preview(g),[g]),prediction=g.roundResolved?g.result:forecast,messages=useMemo(()=>trainingMessages(session),[session.observedEffects,g]);
 const active=messages[session.effectIndex],attributes=playbackAttributePlayers(g,!!active,active?.phase)||forecast?.players;
 const selected=session.selected,player=selected?(selected.side===0?g.p1:g.p2):null;
 const focus=session.appealFocus,appeal=focus?prediction?.[focus.side===0?'p1':'p2'].members.find(m=>m.id===focus.id):undefined;
 const action=(event:TrainingAction)=>{try{onChange(applyTrainingAction(session,event));setError('');}catch(e){setError((e as Error).message);}};
 const advance=()=>{try{onChange(advanceTrainingStep(session));setError('');}catch(e){setError((e as Error).message);}};
 let hintId:number|undefined,hintSide:0|1=0,hintSlot:Slot|undefined;
 if(!session.complete&&!session.stepComplete){const goal=step.goal;if(goal.type==='inspect'||goal.type==='appeal'){hintId=goal.id;hintSide=goal.side??0;}else if(goal.type==='place'){hintId=goal.id;hintSlot=goal.slot;if(goal.formation){const index=SLOTS.findIndex((slot,index)=>g.p1.formation[slot]!==goal.formation![index]);if(index>=0){hintId=goal.formation[index];hintSlot=SLOTS[index];}}}}
 useEffect(()=>{
  if(session.complete||session.stepComplete)return;
  let frame=0;
  const reveal=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const view=root.current,field=view?.querySelector<HTMLElement>('.training-field');if(!view||!field)return;
   const goal=step.goal;let target:HTMLElement|null=null;
   if(hintId)target=field.querySelector<HTMLElement>(`[data-player-side="${hintSide}"] .card-wrap[data-card-id="${hintId}"]`);
   if(goal.type==='place'&&hintSlot&&session.selected?.side===0&&session.selected.id===hintId)target=field.querySelector<HTMLElement>(`[data-player-side="0"] .slot-${hintSlot.toLowerCase()} > .slot-label`);
   if(goal.type==='perform'||goal.type==='advance-round')target=field.querySelector<HTMLElement>(`[data-training-action="${goal.type}"]`);
   if(goal.type==='burst')target=field.querySelector<HTMLElement>('.training-burst-panel');
   if(goal.type==='review-result')target=field.querySelector<HTMLElement>('.training-result');
   if(goal.type==='review-effect'){
    const t=active?.messageType==='target'?active.targets[0]:undefined;
    target=t?field.querySelector<HTMLElement>(`[data-player-side="${t.side}"] .card-wrap[data-card-id="${t.id}"]`):field.querySelector<HTMLElement>('.training-effect-panel');
   }
   if(!target)return;
   // Only scroll the field. The coach, card details and dialog stay in place.
   const pane=field.getBoundingClientRect(),rect=target.getBoundingClientRect();
   const scale=pane.height/field.offsetHeight;
   if(rect.top<pane.top+8||rect.bottom>pane.bottom-8)field.scrollTop+=(rect.top+rect.bottom-pane.top-pane.bottom)/(2*scale);
   if(rect.left<pane.left||rect.right>pane.right)field.scrollLeft+=(rect.left+rect.right-pane.left-pane.right)/(2*scale);

  });};
  const field=root.current?.querySelector('.training-field'),observer=new ResizeObserver(reveal);
  if(field)observer.observe(field);reveal();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[session.stepIndex,session.stepComplete,session.complete,hintId,hintSide,hintSlot,session.selected?.id,session.effectIndex]);
 useEffect(()=>{root.current?.querySelector('.training-inspector')?.scrollTo({top:0});},[selected?.side,selected?.id,focus]);
 const boardEffects=(side:0|1)=>({playerSide:side,effects:active?.targets.filter(target=>target.side===side)||[],activeId:active?.side===side?active.id??undefined:undefined,effectKey:`training:${g.round}:${session.effectIndex}:${session.effectVersion}`,hintId:hintSide===side?hintId:undefined});
 return <div className="training-mode" ref={root}>
  <section className={`training-coach ${session.stepComplete?'training-goal-met':''}`} aria-live="polite"><div><small>{session.complete?'練習クリア':`課題 ${session.stepIndex+1} / ${course.steps.length}`}</small><h3>{session.complete?'できました！ 続けて自由に練習できます。':step.title}</h3><p>{session.complete?'別の練習へ移るか、この盤面で続きを試せます。閉じると元の画面へ戻ります。':session.stepComplete?step.success:step.instruction}</p>{!session.complete&&step.goal.type==='review-effect'&&active?.messageType==='target'&&<p className="training-coach-effect"><TargetMessage game={g} event={active}/><button type="button" onClick={()=>action({type:'review-effect',index:session.effectIndex})}>表示中の効果を確認</button></p>}</div><button type="button" disabled={!session.stepComplete||session.complete||session.stepIndex===course.steps.length-1&&!!g.pendingBursts?.length} onClick={advance}>{session.stepIndex===course.steps.length-1?'練習をクリア':'次の課題へ →'}</button></section>
  <div className="training-round"><strong>練習 ROUND {g.round} / 7 {g.round===7&&'ENCORE'}</strong><span>P1 {g.p1.points} — {g.p2.points} 練習相手</span><details className="training-overview"><summary>練習の説明</summary><p>{course.description}　相手は固定配置です。元の対戦には影響しません。</p></details><button type="button" onClick={()=>{onChange(createTrainingSession(session.courseId));setError('');}}>この練習を最初から</button></div>
  <div className="training-workspace">
   <aside className="training-inspector">{focus&&<section className="training-appeal" aria-label="練習のAppeal内訳"><h4>{byId(focus.id).name}の{g.roundResolved?'確定':'予測'}Appeal {appeal?.val??'—'}</h4><AppealBreakdown appeal={appeal} cpuMode={false}/></section>}{selected&&player?<><CardInspector player={player} attributePlayer={attributes?.[selected.side]} id={selected.id} editable={selected.side===0&&!g.roundResolved} onClose={()=>action({type:'clear-selection'})}/>{forecast&&<p className="training-preview-fatigue">{byId(selected.id).name}：現在疲労 {player.states[selected.id].fatigue} → 計算直前の疲労予測 {forecast.players[selected.side].states[selected.id].fatigue}</p>}</>:<aside className="card-inspector inspector-empty"><div className="empty-card-outline"><span aria-hidden="true">◇</span><strong>カードをタップ</strong><p>黄色い枠のカードを選ぶと、ここに詳細が出ます。</p></div></aside>}</aside>
   <div className="training-field"><section className="training-song"><b>楽曲：{g.roundSong.name}〈{g.roundSong.type}〉</b><p>{g.roundSong.effect}</p></section><section className="training-opponent"><h4>練習相手の配置 · {prediction?.p2.total??'—'} Appeal</h4><CardBoard {...boardEffects(1)} player={g.p2} attributePlayer={attributes?.[1]} prediction={prediction?.p2} editable={false} resolved={g.roundResolved} facingOpponent onPlace={()=>{}} onSelect={id=>id===null?action({type:'clear-selection'}):action({type:'inspect',side:1,id})} onAppeal={id=>action({type:'appeal',side:1,id})} selectedId={selected?.side===1?selected.id:null}/></section>
      <div className="training-actions"><button type="button" data-training-action="perform" disabled={g.roundResolved||!session.complete&&step.goal.type!=='perform'} onClick={()=>action({type:'perform'})}>パフォーマンス開始</button><button type="button" data-training-action="advance-round" disabled={!g.roundResolved||g.done||!!g.pendingBursts?.length||!session.complete&&step.goal.type!=='advance-round'} onClick={()=>action({type:'advance-round'})}>次のラウンドへ</button></div>
  {error&&<p className="training-error" role="alert">{error}</p>}
  {!!g.pendingBursts?.length&&<TrainingBurst key={`${g.pendingBursts[0].side}:${g.pendingBursts[0].id}:${g.lastBurst?.count||0}`} session={session} onAction={action}/>}
<section className="training-own"><h4>P1の配置 · {prediction?.p1.total??'—'} Appeal</h4><CardBoard {...boardEffects(0)} hintSlot={hintSlot} player={g.p1} attributePlayer={attributes?.[0]} prediction={prediction?.p1} editable={!g.roundResolved&&!g.pendingBursts?.length} resolved={g.roundResolved} onPlace={(slot,id)=>action({type:'place',slot,id})} onSelect={id=>id===null?action({type:'clear-selection'}):action({type:'inspect',side:0,id})} onAppeal={id=>action({type:'appeal',side:0,id})} selectedId={selected?.side===0?selected.id:null}/></section>
     {messages.length>0&&<section className="training-effect-panel" aria-label="練習のスキル効果"><label>確認する効果<select value={session.effectIndex} onChange={e=>action({type:'show-effect',index:Number(e.target.value)})}>{messages.map((event,index)=><option key={event.key+index} value={index}>{index+1}. {event.side===null?'曲':event.side===0?'P1':'P2'} {event.id===null?event.label:byId(event.id).name} {event.kind} {event.messageType==='target'?'対象への効果':'発動'}</option>)}</select></label>{active&&<><p className="training-effect-message">{active.messageType==='source'?`${active.side===null?'楽曲':active.side===0?'P1':'P2'} ${active.id===null?active.label:byId(active.id).name}の${active.kind}発動！`:<TargetMessage game={g} event={active}/>}</p><div className="training-actions"><button type="button" disabled={session.effectIndex===0} onClick={()=>action({type:'show-effect',index:session.effectIndex-1})}>前の効果</button><button type="button" disabled={session.effectIndex>=messages.length-1} onClick={()=>action({type:'show-effect',index:session.effectIndex+1})}>次の効果</button><button type="button" disabled={active.messageType!=='target'} onClick={()=>action({type:'review-effect',index:session.effectIndex})}>この効果を確認</button></div><small>発動者→対象への効果の順です。対象のメッセージで確認ボタンを押します。</small></>}</section>}
  {g.result&&<section className="training-result" aria-label="練習の結果"><h4>R{g.round}の結果</h4><p>P1 Appeal {g.result.p1.total} ／ 練習相手 Appeal {g.result.p2.total}</p><p>{g.result.winner===0?'引き分け：両チーム0ポイント':`${g.result.winner===1?'P1':'練習相手'}が＋${g.result.points}ポイント`}</p>{g.result.final&&<p>{g.result.final}</p>}<button type="button" onClick={()=>action({type:'review-result'})}>結果を確認</button></section>}
   </div>
  </div>
 </div>;
}
