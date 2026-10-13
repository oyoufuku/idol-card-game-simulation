import { attributesOf, byId, idsBack } from '../game/formation';
import { SLOTS, type Player, type Slot, type TeamAppeal, type EffectTarget } from '../game/types';
import { IdolCardFace } from './IdolCardFace';
import { cardAppearance } from './card-appearance';
export { cardTone } from './card-appearance';
const labels: Record<Slot, string> = { CENTER: 'CENTER', 'FRONT-L': 'FRONT L', 'FRONT-R': 'FRONT R', 'MIDDLE-L': 'MIDDLE L', 'MIDDLE-R': 'MIDDLE R' };
export function CardBoard({ player, attributePlayer = player, prediction, editable, resolved, onPlace, onSelect, selectedId = null, onAppeal, effects = [], activeId, effectKey, animating = false, playerSide, facingOpponent = false }: {
  player: Player; attributePlayer?: Player; prediction?: TeamAppeal; editable: boolean; resolved: boolean;
  onPlace: (slot: Slot, id: number) => void; onSelect: (id: number | null) => void; selectedId?: number | null; onAppeal: (id: number) => void;
  effects?: EffectTarget[]; activeId?: number; effectKey?: string; animating?: boolean; playerSide?: 0 | 1; facingOpponent?:boolean;
}) {
  const selected = selectedId;
  function card(id: number, back = false) {
    const c = byId(id), st = player.states[id], appeal = prediction?.members.find(m => m.id === id), attributes = attributesOf(attributePlayer, id), appearance = cardAppearance(attributes);
    const changes = effects.filter(target => target.id === id);
    return <div className={`card-wrap ${selected === id ? 'is-selected' : ''} ${st.burstActive ? 'burst-active' : ''} ${activeId === id ? 'skill-source-active' : ''} ${changes.length ? 'has-skill-effect' : ''} ${appearance.tone}`} style={appearance.style} key={id} data-card-id={id}>
      <div className="card-art">
      {changes.length > 0 && <div className="skill-effect-stack" key={effectKey} aria-label={`${player.label} ${c.name}への効果`}>{changes.map((change, i) => <span key={i} className={`skill-effect-popup ${change.delta === undefined ? 'effect-neutral' : change.delta > 0 ? 'effect-up' : 'effect-down'}`} data-delta={change.delta} data-effect-label={change.label}>
        <small>{change.label}</small>{change.delta !== undefined && <b><span aria-hidden="true">{change.delta > 0 ? '↑' : '↓'}</span>{change.delta > 0 ? '+' : ''}{change.delta}</b>}
      </span>)}</div>}
      {st.burstActive && <><span className="burst-aura" aria-hidden="true"/><span className="burst-sparks" aria-hidden="true"><i/><i/><i/><i/></span><span className="burst-ribbon">BURST</span></>}
      <button className="idol-card" disabled={animating} aria-label={`${player.label} ${c.name}、${appearance.label}、疲労${st.fatigue}${st.burstActive ? '、BURST発動中' : ''}。タップでカード詳細${editable ? 'と移動先選択' : ''}`} aria-pressed={selected === id} onClick={() => onSelect(id)}>
        <IdolCardFace card={c} attributes={attributes} burstActive={st.burstActive}/>
        <span className="card-state"><span>疲労 {st.fatigue}</span><span>{st.burstDisabledUntilRound!==undefined&&player.round<=st.burstDisabledUntilRound?'B無効・固定':st.lockedPos ? '固定' : st.burstActive ? 'BURST' : st.normalUsed ? 'B USED' : 'B 未使用'}</span></span>
      </button>
      </div>
      {back ? <span className="back-caption">BACK</span> : <button className="appeal-chip" aria-label={`${player.label} ${c.name}のAppeal内訳`} disabled={!appeal || animating} onClick={() => onAppeal(id)}><span>{resolved ? '確定' : '予測'} Appeal</span><b>{appeal?.val ?? '—'}</b><span aria-hidden="true">⌕</span></button>}
    </div>;
  }
  return <div className={`card-board ${editable ? '' : 'read-only'} ${animating ? 'skill-animating' : ''} ${facingOpponent?'facing-opponent':''}`}  data-player-side={playerSide} data-facing={facingOpponent?'opponent':'own'}>
    {editable && <div className="placement-help" aria-live="polite">{selected ? <><b>{byId(selected).name}</b> の配置先を選択<button onClick={() => onSelect(null)}>解除</button></> : 'カードをタップ → 詳細を確認して移動先を選択'}</div>}
    <div className="formation-stage" aria-label={`${player.label}のフォーメーション`}>
      {SLOTS.map(slot => <div className={`formation-slot slot-${slot.toLowerCase()}`} key={slot}>
        <button className={`slot-label ${selected !== null && editable ? 'can-place' : ''}`} aria-label={`${player.label} ${labels[slot]}に配置`} disabled={!editable || selected === null} onClick={() => { if (selected !== null) onPlace(slot, selected); }}>{selected !== null && editable ? 'ここに配置 · ' : ''}{labels[slot]}</button>
        {card(player.formation[slot])}
      </div>)}
    </div>
    {facingOpponent?<details className="opponent-backs" open><summary>BACKS · {idsBack(player).length}人</summary><div className="backs-row">{idsBack(player).map(id=>card(id,true))}</div></details>:<section className="reserve-cards" aria-label="自チームのBACKS"><div className="backs-heading"><span>BACKS</span></div>
    <div className="backs-row">{idsBack(player).map(id => card(id, true))}</div></section>}
    <p className="board-hint">カードをタップで詳細 · 数値をタップでAppeal内訳</p>
  </div>;
}
