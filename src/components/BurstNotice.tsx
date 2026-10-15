import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { attributesOf,byId } from '../game/formation';
import type { Game } from '../game/types';
import { cardAppearance } from './card-appearance';
import { IdolCardFace } from './IdolCardFace';
import { BURST_PRESENTATION_MS,playerCaption } from './presentation';
import { PlaybackSettings } from './PlaybackSettings';
import {openPlayGuide} from './guide-events';

/** The cinematic is display-only. B target selection and RNG are handled by the shared engine. */
export function BurstNotice({ game,onComplete,autoAdvance=true,onAutoAdvanceChange }: { game: Game;onComplete:()=>void;autoAdvance?:boolean;onAutoAdvanceChange?:(enabled:boolean)=>void }) {
  const event=game.lastBurst,eventKey=event?`${event.count}`:'';
  useEffect(()=>{
    if(!eventKey||!autoAdvance)return;
    const timer=window.setTimeout(onComplete,BURST_PRESENTATION_MS);
    return ()=>window.clearTimeout(timer);
  },[eventKey,autoAdvance,onComplete]);
  if(!event)return null;
  const player=event.side===0?game.p1:game.p2,card=byId(event.id),attributes=attributesOf(player,event.id),appearance=cardAppearance(attributes);
  return createPortal(<div key={eventKey} className={`burst-cinematic${autoAdvance?'':' manual-playback'}`} style={appearance.style} role="status" aria-label="BURST発動">
    <div className="burst-cinematic-rays" aria-hidden="true"/>
    <div className="burst-cinematic-content">
      <p className="burst-cinematic-player">{playerCaption(game,event.side)} · {card.name}</p>
      <div className="burst-card-entrance"><div className="burst-card-flip">
        <div className="burst-card-front"><IdolCardFace player={player} card={card} attributes={attributes} expanded/></div>
        <div className="burst-card-back"><IdolCardFace player={player} card={card} attributes={attributes} burstActive expanded/></div>
      </div></div>
      <strong className="burst-cinematic-title">BURST!</strong><p className="burst-cinematic-caption">{card.name}がバースト！</p>
    </div>
    <div className="burst-cinematic-controls"><button onClick={onComplete}>{autoAdvance?'BURST演出をスキップ':'次へ：Bスキルの説明'}</button><button onClick={openPlayGuide} aria-label="BURST演出を一時停止して遊び方を開く">遊び方</button>{onAutoAdvanceChange&&<PlaybackSettings autoAdvance={autoAdvance} onChange={onAutoAdvanceChange}/>}</div>
  </div>,document.body);
}
