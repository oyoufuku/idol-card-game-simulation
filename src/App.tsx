import { useCallback, useEffect, useMemo, useState } from 'react';
import {SharedRulebook} from './components/SharedRulebook';
import { FullscreenButton } from './components/FullscreenButton';
import type { Game } from './game/types';
import { burstTargetKind, burstTargetOptions, resolveNextBurst } from './game/burst';
import { effectsFor } from './game/effects';
import { executeRound, nextRound, preview } from './game/engine';
import { cpuChooseBestFormation, recommendPlayerFormation } from './game/cpu-strategy';
import { byId, validateFormation } from './game/formation';
import { resolveCenterSkills } from './game/appeal';
import { Setup } from './components/Setup';
import { CardBoard, cardTone } from './components/CardBoard';
import { CardInspector } from './components/CardInspector';
import { BurstNotice } from './components/BurstNotice';
import { DetailSheet } from './components/DetailSheet';
import { placeCard } from './components/placement';
import { ReferenceTables } from './components/ReferenceTables';
import { useSkillPlayback } from './components/useSkillPlayback';
import { AUTO_ADVANCE_KEY, PlaybackSettings,readAutoAdvance } from './components/PlaybackSettings';
import { AppealBreakdown } from './components/AppealBreakdown';
import { battlePlayers } from './components/battle-view';
import { SkillPlaybackStatus } from './components/SkillPlaybackStatus';
type Inspect = { kind: 'card' | 'appeal'; id: number; side: 0 | 1 } | null;
export default function App() {
  const [game, setGame] = useState<Game | null>(null), [error, setError] = useState(''), [thinking, setThinking] = useState<'cpu' | 'recommend' | null>(null);
  const [side, setSide] = useState<0 | 1>(0), [inspect, setInspect] = useState<Inspect>(null);
  const [opponentOpen, setOpponentOpen] = useState(true);
  const [burstAnimating,setBurstAnimating]=useState(false);
  const [autoAdvance,setAutoAdvance]=useState(readAutoAdvance);
  const finishBurst=useCallback(()=>setBurstAnimating(false),[]);
  const playback = useSkillPlayback(game,burstAnimating,autoAdvance);
  useEffect(()=>{try{window.localStorage.setItem(AUTO_ADVANCE_KEY,String(autoAdvance));}catch{/* Keep the session preference when browser storage is unavailable. */}},[autoAdvance]);
  const burstJob=game?.pendingBursts?.[0], burstKind=burstJob&&burstTargetKind(burstJob.id);
  const chooseBurstTarget=!!(burstJob&&burstKind&&game&&burstTargetOptions(game,burstJob).length>0&&!game.cpuBoth&&!(game.cpuMode&&burstJob.side===1));
  const [burstTarget,setBurstTarget]=useState<number|null>(null);
  const busy = !!thinking || playback.playing || !!burstJob || burstAnimating;

  const effectProps = (playerSide: 0 | 1) => ({ playerSide, effects: playback.active?.targets.filter(t => t.side === playerSide) || [], activeId: playback.active?.side === playerSide ? playback.active.id ?? undefined : undefined, effectKey: playback.eventKey, animating: busy });
  const prediction = useMemo(() => { if (!game) return null; if (game.roundResolved) return game.result; try { const [p1,p2]=battlePlayers(game,side);return preview({...game,p1,p2}); } catch { return null; } }, [game,side]);
  const change = (fn: (g: Game) => void) => { if (!game) return false; try { const draft = structuredClone(game); fn(draft); setGame(draft); setError(''); return true; } catch (e) { setError((e as Error).message); return false; } };
  const advance = (fn: (g: Game) => void) => { if (change(fn)) setInspect(null); };
  const fireBurst=(target?:number)=>{
    if(!game)return;
    const success=change(g=>{ effectsFor(g)?.reset();g.effectRevision=(g.effectRevision??0)+1;resolveNextBurst(g,target); });
    if(success){setBurstTarget(null);setBurstAnimating(true);}
  };
  useEffect(()=>{
    if(!autoAdvance||!burstJob||playback.playing||burstAnimating||chooseBurstTarget)return;
    // Leave a paint between cards so each one receives its own BURST animation.
    const timer=window.setTimeout(()=>fireBurst(),100);
    return ()=>window.clearTimeout(timer);
  },[game,playback.playing,burstAnimating,chooseBurstTarget,autoAdvance]);
  useEffect(()=>{
    if(!burstJob||playback.playing||burstAnimating)return;
    setInspect({kind:'card',side:burstJob.side,id:burstJob.id});
    setBurstTarget(null);
    document.querySelector('.burst-target-panel,.burst-wait-panel')?.scrollIntoView({block:'nearest'});
  },[burstJob,playback.playing,burstAnimating]);
  useEffect(()=>{
    const event=playback.active;
    if(event?.id!=null&&event.side!=null)setInspect({kind:'card',side:event.side,id:event.id});
  },[playback.active]);
  const formationError = game && (validateFormation(game.p1, game.p1.formation) || validateFormation(game.p2, game.p2.formation));
  const shown=game&&battlePlayers(game,side);
  const own=shown&&shown[side],opponent=shown&&shown[side===0?1:0],otherSide=side===0?1:0;
  const ownPrediction = prediction?.[side === 0 ? 'p1' : 'p2'], opponentPrediction = prediction?.[side === 0 ? 'p2' : 'p1'];
  const centers = game && resolveCenterSkills(shown![0], shown![1], game.roundSong);
  const inspectedCard = inspect && byId(inspect.id), inspectedPlayer = game && inspect && shown![inspect.side];
  const attributePlayers = prediction && 'players' in prediction ? prediction.players : undefined;
  const inspectedAppeal = inspect && prediction?.[inspect.side === 0 ? 'p1' : 'p2']?.members.find(m => m.id === inspect.id);
  return <main className={`${game ? 'game-shell' : 'setup-shell'}${autoAdvance?'':' manual-playback-mode'}${playback.active?' skill-playback-mode':''}`} onKeyDown={e => { if (e.key === 'Escape' && inspect?.kind === 'card') setInspect(null); }}>
    <header className="brand"><div><span className="eyebrow">IDOL CARD GAME</span><h1>ステージを、つくろう。</h1><SharedRulebook/></div><FullscreenButton/><details className="playback-settings-panel"><summary>演出設定</summary><PlaybackSettings autoAdvance={autoAdvance} onChange={setAutoAdvance}/><small>OFF：メッセージ・BURSTは「次へ」で進みます。</small></details><span className="version">v0.8</span></header>
    <p className="orientation-hint">スマートフォンは横向きにすると、カードと操作パネルを並べて表示できます。</p>
    {!game ? <><p className="intro">8人のアイドルと3枚の楽曲で、7ラウンドのステージへ。</p><Setup onStart={g => { setGame(g); setSide(0); setError(''); }}/></> : own && opponent && <>
      <SkillPlaybackStatus game={game} playback={playback} onAutoAdvanceChange={setAutoAdvance}/>{burstAnimating&&<BurstNotice game={game} onComplete={finishBurst} autoAdvance={autoAdvance} onAutoAdvanceChange={setAutoAdvance}/>}<div className="match-strip" key={`score-${game.round}-${game.p1.points}-${game.p2.points}`}><span>ROUND <b>{game.round}</b> / 7 {game.round === 7 && 'ENCORE'}</span><strong>{game.p1.label} {game.p1.points} <span>—</span> {game.p2.points} {game.p2.label}</strong></div>
      <div className="battle-layout"><div className="battle-sidebar">
      {inspect?.kind === 'card' && inspectedPlayer ? <CardInspector player={inspectedPlayer} attributePlayer={attributePlayers?.[inspect.side]} id={inspect.id} editable={inspect.side === side && !game.roundResolved && !busy} onClose={() => setInspect(null)}/> : <aside className="card-inspector inspector-empty" aria-label="拡大カードスペース"><div className="empty-card-outline"><span aria-hidden="true">◇</span><strong>カードをタップ</strong><p>ここに拡大カードを表示します</p></div></aside>}
      </div><div className="battle-field">
      <section key={`round-${game.round}`} className="performance-header" aria-label="楽曲とAppeal">
        <div className="song-information"><span className="eyebrow">NOW PLAYING</span><h2>楽曲 {game.roundSong.name} <span className={`attribute-label ${cardTone(game.roundSong.type)}`}>{game.roundSong.type}</span></h2><details className="song-effect"><summary>楽曲効果</summary><p>{game.roundSong.effect}</p></details>
          <details className="center-information"><summary className="center-caption">CENTER SKILL · {byId(own.formation.CENTER).name} · 暫定</summary><p>{byId(own.formation.CENTER).C || 'CENTER SKILLなし'}{byId(own.formation.CENTER).C && !centers?.[side] && <em>（現在無効）</em>}</p></details>
        </div>
        <div className="total-appeal" aria-live="polite"><span>{game.roundResolved ? '確定' : '予測'} TOTAL</span><strong key={`appeal-${ownPrediction?.total}`}>{ownPrediction?.total ?? '—'}</strong><span>APPEAL</span><small>{opponent.label} <b>{opponentPrediction?.total ?? '—'}</b></small></div>
      </section>


      <details className="opponent-area" open={opponentOpen || playback.playing || !!burstJob} onToggle={e => { if (playback.playing || burstJob) { if (!e.currentTarget.open) e.currentTarget.open = true; } else setOpponentOpen(e.currentTarget.open); }}><summary><span>{game.roundResolved?'相手の確定配置':game.round===1?'相手の初期配置':'相手の前回配置'} · {opponent.label}</span><span>カードを確認 ↗</span></summary><p className="opponent-center">CENTER · {byId(opponent.formation.CENTER).name}<br/>{byId(opponent.formation.CENTER).C || 'CENTER SKILLなし'}{byId(opponent.formation.CENTER).C && !centers?.[otherSide] && '（現在無効）'}</p><CardBoard facingOpponent {...effectProps(otherSide)} key={`opponent-${side}-${game.round}`} player={opponent} attributePlayer={attributePlayers?.[otherSide]} prediction={opponentPrediction ?? undefined} editable={false} resolved={game.roundResolved} onPlace={() => {}} selectedId={inspect?.kind === 'card' && inspect.side === otherSide ? inspect.id : null} onSelect={id => setInspect(id === null ? null : { kind: 'card', id, side: otherSide })} onAppeal={id => setInspect({ kind: 'appeal', id, side: otherSide })}/></details>
      <section className="own-stage"><div className="stage-title"><h2>{own.label} <span>YOUR STAGE</span></h2><small>累計Appeal {own.totalAppeal}</small>{!game.cpuMode && <div className="local-controls"><span>ローカル確認用・操作する側</span>{([0, 1] as const).map(i => <button key={i} disabled={busy} aria-pressed={side === i} onClick={() => { setSide(i); setInspect(null); }}>{i === 0 ? 'P1' : 'P2'}</button>)}</div>}<button className="recommend-button" disabled={game.done || game.roundResolved || busy} onClick={() => { setThinking('recommend'); setTimeout(() => { advance(g => { recommendPlayerFormation(g, side === 0 ? 1 : 2); }); setThinking(null); }, 20); }}>{thinking === 'recommend' ? 'おすすめを計算中…' : 'おすすめ配置'}</button>
      <div className="action-dock"><div role="alert" className="action-error">{error || formationError}</div><div className="row">
        {!game.roundResolved && game.cpuMode && !game.cpuLocked ? <button className="primary" disabled={busy || !!formationError} onClick={() => { setThinking('cpu'); setTimeout(() => { advance(cpuChooseBestFormation); setThinking(null); }, 20); }}>{thinking === 'cpu' ? 'CPUが配置を選んでいます…' : 'CPU配置を決定'}</button> : !game.roundResolved ? <button className="primary" disabled={busy || !!formationError} onClick={() => advance(executeRound)}>パフォーマンス開始 <span>→</span></button> : !game.done ? <button className="primary" disabled={busy} onClick={() => advance(nextRound)}>次のラウンドへ <span>→</span></button> : <button className="primary" disabled={busy} onClick={() => { setGame(null); setInspect(null); }}>もう一度プレイ</button>}
      </div><small>{burstJob ? '終了時BURSTを1枚ずつ発動しています' : playback.playing ? 'スキル演出中です。スキップすると操作できます' : game.roundResolved ? 'Appealは実行済みの確定値です' : '配置中のAppealは予測値です'}</small></div>
      </div>
        <CardBoard {...effectProps(side)} key={`${side}-${game.round}`} player={own} attributePlayer={attributePlayers?.[side]} prediction={ownPrediction ?? undefined} editable={!game.roundResolved && !busy} resolved={game.roundResolved} onPlace={(slot, id) => advance(g => { const p = side === 0 ? g.p1 : g.p2; p.formation = placeCard(p, slot, id); if (g.cpuMode) g.cpuLocked = false; })} selectedId={inspect?.kind === 'card' && inspect.side === side ? inspect.id : null} onSelect={id => setInspect(id === null ? null : { kind: 'card', id, side })} onAppeal={id => setInspect({ kind: 'appeal', id, side })}/>
      </section>
      {chooseBurstTarget && burstJob && !playback.playing && !burstAnimating && <section className="panel burst-target-panel" role="dialog" aria-label="BURST対象選択">
        <h2>{burstJob.side===0?'P1':game.p2.label} · {byId(burstJob.id).name} BURST</h2>
        <p>{byId(burstJob.id).B}</p><label>このBスキルの対象を選択<select aria-label="BURST対象" value={burstTarget??''} onChange={e=>setBurstTarget(+e.target.value)}><option value="" disabled>対象を選んでください</option>{burstTargetOptions(game,burstJob).map(id=><option key={id} value={id}>{byId(id).name}</option>)}</select></label>
        <button className="primary" disabled={burstTarget===null} onClick={()=>fireBurst(burstTarget!)}>対象を決定してBURST</button>
      </section>}
      {!autoAdvance&&!chooseBurstTarget&&burstJob&&!playback.playing&&!burstAnimating&&<section className="panel burst-wait-panel" role="dialog" aria-label="次のBURST"><h2>{burstJob.side===0?'P1':game.p2.label} · {byId(burstJob.id).name} BURST</h2><p>{byId(burstJob.id).B}</p><button className="primary" onClick={()=>fireBurst()}>次へ：{byId(burstJob.id).name}をBURST</button></section>}
      {game.result && !busy && <section key={`result-${game.round}`} className={`round-result ${game.done ? 'match-finished' : ''}`} role="status"><span className="eyebrow">ROUND {game.round} RESULT</span><h2>{game.result.p1.total} <span>vs</span> {game.result.p2.total}</h2><p>{game.result.winner ? `${game.result.winner === 1 ? game.p1.label : game.p2.label} +${game.result.points} pt` : 'DRAW'}</p>{game.result.final && <strong>FINAL · {game.result.final}</strong>}</section>}
      <details className="panel battle-log"><summary>対戦ログ</summary><div className="log">{game.logs.join('\n')}</div></details>
      <button className="reset-button" disabled={busy} onClick={() => { if (window.confirm('対戦を終了して編成画面に戻りますか？')) { setGame(null); setInspect(null); setError(''); } }}>編成画面に戻る</button>
      <details className="reference-panel"><summary>すべてのカード・楽曲を見る</summary><ReferenceTables/></details>
      </div></div>
    </>}
    {!game && <details className="reference-panel"><summary>すべてのカード・楽曲を見る</summary><ReferenceTables/></details>}
    {inspect?.kind === 'appeal' && inspectedCard && inspectedPlayer && <DetailSheet title={`${inspectedCard.name} · Appeal内訳`} onClose={() => setInspect(null)}>
      <p className="appeal-explanation">{game?.roundResolved ? 'パフォーマンスで確定した内訳です。' : '自分の配置と相手の前回の公開配置による予測です。配置変更で変わります。'}</p><div className="appeal-result"><span>{game?.roundResolved ? '確定' : '予測'} Appeal</span><strong>{inspectedAppeal?.val ?? '—'}</strong></div><AppealBreakdown appeal={inspectedAppeal??undefined} cpuMode={!!game?.cpuMode}/>
    </DetailSheet>}
  </main>;
}
