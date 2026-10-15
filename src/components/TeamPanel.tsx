import {FatigueValue} from './FatigueValue';
import { SLOTS, type Game, type TeamAppeal, type Slot, type Targets } from '../game/types';
import { byId, calcEnteredThisRoundIds, idsBack, posOf, symmeId } from '../game/formation';
export function TeamPanel({ game, index, prediction, onPosition, onTarget }: {
  game: Game; index: 0 | 1; prediction?: TeamAppeal;
  onPosition: (slot: Slot, id: number) => void; onTarget: (key: keyof Targets, id: number) => void;
}) {
  const p = index === 0 ? game.p1 : game.p2, opp = index === 0 ? game.p2 : game.p1;
  const cpu = game.cpuMode && index === 1;
  const entries = calcEnteredThisRoundIds(p, p.formation, game.round);
  return <section className="panel"><div className="teamhead"><h2>{p.label}</h2><div>得点 <b>{p.points}</b> / 累計Appeal <b>{p.totalAppeal}</b></div></div>
    <div className="positions">{SLOTS.map(slot => <div className={slot === 'CENTER' ? 'center' : ''} key={slot}><label><b>{slot}</b><select aria-label={`${p.label} ${slot}`} value={p.formation[slot]} disabled={cpu || game.roundResolved} onChange={e => onPosition(slot, +e.target.value)}>{p.ids.map(id => <option key={id} value={id}>{byId(id).name}</option>)}</select></label></div>)}</div>
    <div className="cardline"><b>バックス：</b>{idsBack(p).map(id => byId(id).name).join(' / ')}</div>
    <div className="cardline"><b>この配置でバックスから登場：</b>{entries.length ? entries.map(id => byId(id).name).join(' / ') + `（${entries.length}人）` : 'なし'}</div>
    <h3>BURSTターゲット指定（次ラウンド開始時）</h3>
    {cpu ? <p className="muted">CPU：小島B・的野Bの対象は自動選択。</p> : <div className="row">{(['koji', 'matono'] as const).map(kind => <label key={kind}>{kind === 'koji' ? '小島B→味方' : '的野B→相手'}<select aria-label={`${p.label} ${kind}`} disabled={game.done} value={game.targets[index][kind]} onChange={e => onTarget(kind, +e.target.value)}>{(kind === 'koji' ? p : opp).ids.map(id => <option key={id} value={id}>{byId(id).name}</option>)}</select></label>)}</div>}
    <p className="muted">中嶋Bは他のユーモアからランダム。</p>
    <h3>{game.roundResolved ? 'パフォーマンス結果' : '配置時Appeal予測'}</h3><div className="cardline">{prediction ? <><b>{game.roundResolved ? '総Appeal' : '総Appeal予測'}：{prediction.total}</b>{prediction.members.map(m => <details key={m.slot}><summary>{m.slot}: {byId(m.id).name} → <b>{m.val}</b></summary><small>{m.details.join(' / ')}</small></details>)}</> : <span className="muted">合法な配置を選ぶと予測を表示します。</span>}</div>
    <h3>状態</h3>{p.ids.map(id => { const st = p.states[id], card = byId(id); const marks = [st.burstActive && 'BURST', st.normalUsed && 'B USED', st.permBonus && `永続+${st.permBonus}`, st.activeNextBonus && `松田C発動中+${st.activeNextBonus}`, st.nextBonus && `松田C次R+${st.nextBonus}`, st.lockedPos && `固定:${st.lockedPos}`, st.forcedBurstCount && `強制BURST ${st.forcedBurstCount}回`];
      if (card.skill === 'ishimori') { if (posOf(p, id) === 'BACK') marks.push('A有効:CENTER疲労-1'); else if (symmeId(p, id)) marks.push('A有効:シンメ疲労-2'); }
      if (card.skill === 'kojima' && posOf(p, id) === 'BACK') marks.push('A有効:CENTER数値デバフ軽減1');
      return <div className="cardline" key={id}><b>{card.name}</b>　<FatigueValue value={st.fatigue}/>　<span className="badge">{card.attr}</span>{marks.filter(Boolean).map((m, i) => <span className="badge ready" key={i}>{m}</span>)}</div>;
    })}
  </section>;
}
