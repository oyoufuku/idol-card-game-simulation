import { useMemo, useState } from 'react';
import { IDOLS } from '../data/idols';
import { SONGS,SELECTABLE_SONGS } from '../data/songs';
import type { Game, Mode } from '../game/types';
import { createGame } from '../game/engine';
import { generateArchetypes, randomTeam, type Team } from '../simulation/teams';
type PickMode = 'manual' | 'random' | 'archetype';
export function Setup({ onStart }: { onStart: (game: Game) => void }) {
  const [ids, setIds] = useState([[1, 2, 4, 5, 9, 11, 13, 24], [3, 6, 7, 10, 12, 14, 18, 22]]);
  const [songs, setSongs] = useState([['B', 'F', 'H'], ['A', 'I', 'J']]);
  const [mode, setMode] = useState<Mode>('cpu'), [error, setError] = useState('');
  const [cpuStrategy,setCpuStrategy]=useState<'normal'|'burst'>('normal');
  const decks = useMemo(() => generateArchetypes(1), []);
  const archetypes = [...new Set(decks.map(deck => deck.archetype))];
  const [picks, setPicks] = useState<PickMode[]>(['manual', 'manual']);
  const [deckNames, setDeckNames] = useState([decks[0].name, decks[0].name]);
  const applyTeam = (n: number, team: Team) => {
    setIds(old => old.map((value, i) => i === n ? [...team.members] : value));
    setSongs(old => old.map((value, i) => i === n ? [...team.songs] : value));
    setError('');
  };
  const pickRandom = (n: number) => applyTeam(n, randomTeam(Math.floor(Math.random() * 0x100000000), `Player ${n + 1}`));
  const pickDeck = (n: number, name: string) => {
    setDeckNames(old => old.map((value, i) => i === n ? name : value));
    applyTeam(n, decks.find(deck => deck.name === name)!);
  };
  const changePick = (n: number, pick: PickMode) => {
    setPicks(old => old.map((value, i) => i === n ? pick : value));
    setError('');
    if (pick === 'random') pickRandom(n);
    if (pick === 'archetype') pickDeck(n, deckNames[n]);
  };
  return <section className="panel"><h2>ステージの準備</h2><p className="muted">Excel更新版 · アイドル48人 / 通常楽曲20曲・BURST専用2曲</p>
    <label>対戦モード <select className="inline-select" value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="cpu">P1（あなた） vs CPU</option><option value="local">P1 vs P2（この端末で操作）</option></select></label>
    <p className="muted">CPUは予測獲得ポイント・勝敗・Appeal差・終了時疲労を比較して配置を選びます。</p>
    <label>CPU・おすすめ配置の思考 <select className="inline-select" value={cpuStrategy} onChange={e=>setCpuStrategy(e.target.value as 'normal'|'burst')}><option value="normal">通常</option><option value="burst">BURSTを考慮（次回まで予測）</option></select></label>
    {cpuStrategy==='burst'&&<p className="muted">今回と次回の得点・Appeal差を比較します。相手の公開配置が基準です。計算には通常より時間がかかります。</p>}
    <div className="grid2">{[0, 1].map(n => {
      const deck = decks.find(deck => deck.name === deckNames[n])!;
      const label = n === 0 ? 'P1（あなた）' : mode === 'cpu' ? 'CPU' : 'P2';
      return <section className="setup-team" aria-label={`${label}のデッキ`} key={n}><h3>{label}</h3>
      <div className="pick-modes" role="group" aria-label="カードの選び方">
        {([['manual', '手動選択'], ['random', 'ランダムピック'], ['archetype', 'アーキタイプ']] as const).map(([pick, title]) => <button key={pick} aria-pressed={picks[n] === pick} onClick={() => changePick(n, pick)}>{title}</button>)}
      </div>
      {picks[n] === 'random' && <div className="pick-options"><p className="muted">48人から8人、通常20曲から3曲を重複なしで選びます。</p><button onClick={() => pickRandom(n)}>引き直す</button></div>}
      {picks[n] === 'archetype' && <div className="pick-options">
        <div className="deck-selects"><label>テーマ<select value={deck.archetype} onChange={e => pickDeck(n, decks.find(candidate => candidate.archetype === e.target.value)!.name)}>{archetypes.map(name => <option key={name}>{name}</option>)}</select></label>
          <label>デッキ候補<select value={deck.name} onChange={e => pickDeck(n, e.target.value)}>{decks.filter(candidate => candidate.archetype === deck.archetype).map(candidate => <option key={candidate.name}>{candidate.name}</option>)}</select></label></div>
        <p className="muted">主タグ：{deck.mainTags.join(' / ')}<br/>関連タグ：{deck.subTags.join(' / ')}</p>
      </div>}
      {picks[n] === 'manual' ? <><b>アイドル8人（選択 {ids[n].length}/8）</b>
      <div className="setup-list">{IDOLS.map(card => <label className="chk" key={card.id}><input type="checkbox" checked={ids[n].includes(card.id)} onChange={e => setIds(old => old.map((a, i) => i === n ? IDOLS.filter(c => c.id === card.id ? e.target.checked : a.includes(c.id)).map(c => c.id) : a))}/>{card.name} ({card.base}/{card.attr})</label>)}</div>
      <h3>楽曲3枚（選択 {songs[n].length}/3）</h3><div className="setup-list">{SELECTABLE_SONGS.map(song => <label className="chk" key={song.id}><input type="checkbox" checked={songs[n].includes(song.id)} onChange={e => setSongs(old => old.map((a, i) => i === n ? SELECTABLE_SONGS.filter(s => s.id === song.id ? e.target.checked : a.includes(s.id)).map(s => s.id) : a))}/>{song.name}【{song.type}】: {song.effect}</label>)}</div>
      </> : <div className="deck-preview"><h3>アイドル8人</h3><div className="deck-members">{ids[n].map(id => {
        const card = IDOLS.find(card => card.id === id)!;
        return <details key={id} data-member-id={id}><summary><b>{card.name}</b><small>{card.attr} · 基礎Appeal {card.base}</small></summary><dl><dt>AUTO</dt><dd>{card.A}</dd><dt>BURST条件</dt><dd>{card.Bcond}</dd><dt>BURST</dt><dd>{card.B}</dd><dt>CENTER SKILL</dt><dd>{card.C || 'なし'}</dd></dl></details>;
      })}</div><h3>楽曲3曲</h3><ul className="deck-songs">{songs[n].map(id => {
        const song = SONGS.find(song => song.id === id)!;
        return <li key={id} data-song-id={id}><b>{song.name}【{song.type}】</b><p>{song.effect}</p></li>;
      })}</ul><button onClick={() => changePick(n, 'manual')}>この編成を手動で調整</button></div>}
    </section>;
    })}</div>
    <div className="row actions"><button className="primary" onClick={() => { try { const game=createGame(ids[0], ids[1], songs[0], songs[1], mode, Math.random, {recordEffects:true, interactiveBursts:true});if(cpuStrategy==='burst'){game.cpuStrategy='burst';game.playedSongs=[game.roundSong.id];}onStart(game); } catch (e) { setError((e as Error).message); } }}>ゲーム開始</button><span role="alert">{error}</span></div>
  </section>;
}
