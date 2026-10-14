import {CARD_TEXT} from '../data/card-text';
import { useState } from 'react';
import type { Attribute, Idol } from '../game/types';
import { cardAppearance } from './card-appearance';
import { CARD_ARTWORK, selectCardArtwork, type CardArtwork } from '../data/card-artwork';

/** Identical card text and attribute frame for the board and its enlarged view. */
export function IdolCardFace({ card, attributes, expanded = false, burstActive = false, artwork = CARD_ARTWORK[card.id] }: { card: Idol; attributes: readonly Attribute[]; expanded?: boolean; burstActive?: boolean; artwork?: CardArtwork }) {
  const appearance = cardAppearance(attributes);
  const art = selectCardArtwork(artwork, burstActive), [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = art.url && art.url !== failedUrl ? <img key={art.url} src={art.url} alt="" draggable={false} style={{objectPosition:art.position}} onError={() => setFailedUrl(art.url!)}/> : null;
  const text=CARD_TEXT[card.id]||card;
  const skills = [['Aスキル', 'AUTO', text.A], ['B条件', 'BURST条件', text.Bcond], ['Bスキル', 'BURST', text.B], ['Cスキル', 'CENTER SKILL', text.C]];
  const content=(text:string)=>(text||'—').split(/(【[^】]+】)/g).map((part,i)=>expanded&&part.startsWith('【')?<button type="button" className="card-keyword" key={i} onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent('open-shared-rulebook',{detail:part.slice(1,-1)}));}}>{part}</button>:part);
  return <span className={`idol-card-face ${expanded ? 'expanded-card' : 'mini-card'} ${appearance.tone} ${art.fullArt ? 'burst-full-art' : ''}`} style={appearance.style} data-attributes={appearance.label} data-art-mode={art.fullArt ? 'burst' : 'normal'}>
    {art.fullArt && <span className="card-full-art" aria-hidden="true"><span className="burst-art-placeholder">{appearance.symbol}</span>{image}<span className="burst-art-foil"/></span>}
    <span className="card-nameplate"><strong className="idol-name">{card.name}</strong><span className="card-base" title="基礎Appeal">{card.base}</span></span>
    <span className="card-picture" aria-hidden="true">{!art.fullArt && <><span>{appearance.symbol}</span>{image}</>}{art.fullArt && <span className="full-art-label">BURST</span>}</span>
    <span className="card-identity"><span>{card.no}</span><span className="card-attribute">{appearance.label}</span></span>
    <span className="card-skill-list">{skills.map(([code, label, text]) => <span className="card-skill" key={code}><b title={label || ''}>{code}</b><span className="card-skill-text" title={label==='AUTO'?card.A:label==='BURST条件'?card.Bcond:label==='BURST'?card.B:card.C||'なし'}>{content(text||'—')}</span></span>)}</span>
  </span>;
}
