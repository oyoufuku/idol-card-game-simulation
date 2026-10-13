import type { Player } from '../game/types';
import { attributesOf, byId, posOf } from '../game/formation';
import { IdolCardFace } from './IdolCardFace';
import { cardAppearance } from './card-appearance';

export function CardInspector({ player, attributePlayer = player, id, editable, onClose }: { player: Player; attributePlayer?: Player; id: number; editable: boolean; onClose: () => void }) {
  const card = byId(id), state = player.states[id];
  const attributes = attributesOf(attributePlayer, id), appearance = cardAppearance(attributes);
  const status = state.burstActive ? 'BURST発動中' : state.normalUsed ? '通常BURST使用済み' : '通常BURST未使用';
  return <aside className={`card-inspector ${appearance.tone}`} style={appearance.style} aria-label={`${player.label} ${card.name}のカード詳細`}>
    <header className="inspector-header"><small>{player.label} · {editable ? '移動先を選択' : 'カード確認'}</small><button onClick={onClose} aria-label="カード詳細を閉じる">×</button></header>
    <div className="inspector-scroll" key={`${player.label}:${id}`}>
      <IdolCardFace card={card} attributes={attributes} burstActive={state.burstActive} expanded/>
      <dl className="inspector-abilities" aria-label="カードの能力全文">{[['A',card.A],['B条件',card.Bcond],['B',card.B],['C',card.C]].map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text||'なし'}</dd></div>)}</dl>
      <div className="inspector-state"><b>疲労 {state.fatigue}</b><span>{posOf(player, id)}</span><span>{status}</span>{state.lockedPos && <strong>位置固定：{state.lockedPos}</strong>}</div>
      <p className="inspector-instruction">{editable ? state.lockedPos ? '位置固定中です。能力を確認できます。' : '右の配置枠をタップして、このカードを移動できます。' : 'このカードの配置は変更できません。'}</p>
      <div className="detail-state">{state.burstDisabledUntilRound!==undefined&&player.round<=state.burstDisabledUntilRound&&<p><strong>Bスキル無効：R{state.burstDisabledUntilRound}のパフォーマンス終了まで（A・Cは有効）</strong></p>}<p>チャージ {state.charge} / 累計BURST {state.burstCount}回（強制 {state.forcedBurstCount}回）</p><p>永続加算 +{state.permBonus} / 次ラウンド加算 +{state.nextBonus}</p><p>{card.tags.join(' / ')}</p></div>
    </div>
  </aside>;
}
