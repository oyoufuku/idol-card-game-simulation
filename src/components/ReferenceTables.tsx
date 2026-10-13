import { IDOLS } from '../data/idols';
import { SONGS } from '../data/songs';
export function ReferenceTables() {
  return <section className="panel"><h2>カード確認</h2><div className="scroll"><table><thead><tr>{['No.', '名前', '属性', 'タグ', '基礎', 'AUTO', 'BURST条件', 'BURST効果', 'CENTER SKILL'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{IDOLS.map(c => <tr key={c.id}>{[c.no, c.name, c.attr, c.tags.join(' / '), c.base, c.A, c.Bcond, c.B, c.C || 'なし'].map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></div>
    <h2>楽曲確認</h2><div className="scroll"><table><thead><tr><th>楽曲</th><th>属性</th><th>効果</th></tr></thead><tbody>{SONGS.map(s => <tr key={s.id}><td>{s.name}</td><td>{s.type}</td><td>{s.effect}</td></tr>)}</tbody></table></div></section>;
}
