import {skillFor} from '../game/skills';
import {cardProgress} from './card-progress';
import {MAX_CHARGE} from '../game/charge';
import {FatigueValue} from './FatigueValue';
import type { Player } from '../game/types';
import { attributesOf, byId, posOf } from '../game/formation';
import { IdolCardFace } from './IdolCardFace';
import { cardAppearance } from './card-appearance';

export function CardInspector({ player, attributePlayer = player, id, editable, onClose }: { player: Player; attributePlayer?: Player; id: number; editable: boolean; onClose: () => void }) {
  const card = byId(id), state = player.states[id], progress=cardProgress(card,player);
  const attributes = attributesOf(attributePlayer, id), appearance = cardAppearance(attributes);
  const status = state.burstActive ? 'BURST発動中' : state.normalUsed ? '通常BURST使用済み' : '通常BURST未使用';
  return <aside className={`card-inspector ${appearance.tone}`} style={appearance.style} aria-label={`${player.label} ${card.name}のカード詳細`}>
    <header className="inspector-header"><small>{player.label} · {editable ? '移動先を選択' : 'カード確認'}</small><button onClick={onClose} aria-label="カード詳細を閉じる">×</button></header>
    <div className="inspector-scroll" key={`${player.label}:${id}`}>
      <IdolCardFace player={player} card={card} attributes={attributes} burstActive={state.burstActive} expanded/>
      <dl className="inspector-abilities" aria-label="カードの能力全文">{[['Aスキル',card.A,progress.A],['B条件',card.Bcond,progress.Bcond],['Bスキル',card.B,progress.B],['Cスキル',card.C,progress.C]].map(([label,text,suffix])=><div key={label}><dt>{label}</dt><dd>{text||'なし'}{suffix}</dd></div>)}</dl>
      <div className="inspector-state"><b><FatigueValue value={state.fatigue}/></b><span>{posOf(player, id)}</span><span>{status}</span>{state.lockedPos && <strong>位置固定：{state.lockedPos}</strong>}</div>
      <p className="inspector-instruction">{editable ? state.lockedPos ? '位置固定中です。能力を確認できます。' : '右の配置枠をタップして、このカードを移動できます。' : 'このカードの配置は変更できません。'}</p>
      <div className="detail-state">{state.burstDisabledUntilRound!==undefined&&player.round<=state.burstDisabledUntilRound&&<p><strong>Bスキル無効：R{state.burstDisabledUntilRound}のパフォーマンス終了まで（A・Cは有効）</strong></p>}<p>{skillFor(id).chargeConsumer&&<>チャージ {state.charge}/{MAX_CHARGE} / </>}累計BURST {state.burstCount}回（強制 {state.forcedBurstCount}回）</p><p className="progress-note">進捗は終了済みのパフォーマンスの記録です。位置の連続条件は、配置変更で外すと0になります。消費効果があるカードのチャージは現在値です。</p><p>永続加算 +{state.permBonus} / 次ラウンド加算 +{state.nextBonus}</p><p>{card.tags.join(' / ')}</p></div>
    </div>
  </aside>;
}
