import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { selectCardArtwork } from '../data/card-artwork';
import { IdolCardFace } from '../components/IdolCardFace';
import { CardBoard } from '../components/CardBoard';
import { CardInspector } from '../components/CardInspector';
import { createGame, executeRound } from '../game/engine';
import { applyBurst } from '../game/burst';
import { byId } from '../game/formation';
it('通常画像とBURST画像を切り替え、それぞれのトリミング位置を使用する', () => {
  const art={normal:'normal.png',burst:'burst.png',normalPosition:'50% 40%',burstPosition:'50% 20%'};
  expect(selectCardArtwork(art,false)).toEqual({url:'normal.png',position:'50% 40%',fullArt:false});
  expect(selectCardArtwork(art,true)).toEqual({url:'burst.png',position:'50% 20%',fullArt:true});
});
it('未登録画像は通常画像または仮デザインへフォールバックし、BURST画像だけの登録にも対応する', () => {
  expect(selectCardArtwork({normal:'normal.png',normalPosition:'top'},true)).toEqual({url:'normal.png',position:'top',fullArt:true});
  expect(selectCardArtwork(undefined,true)).toEqual({url:undefined,position:'50% 50%',fullArt:true});
  expect(selectCardArtwork({burst:'burst.png'},false).url).toBeUndefined();
  expect(selectCardArtwork({burst:'burst.png'},true).url).toBe('burst.png');
});
it('盤面と拡大カードはBURST中に全面画像を使い、能力文と複数属性のフレームを保持する', () => {
  for(const expanded of [false,true]){
    const html=renderToStaticMarkup(<IdolCardFace card={byId(1)} attributes={['キュート','クール']} expanded={expanded} burstActive artwork={{normal:'normal.png',burst:'burst.png'}}/>);
    expect(html).toContain('data-art-mode="burst"');expect(html).toContain('class="card-full-art"');expect(html).toContain('src="burst.png"');expect(html).not.toContain('src="normal.png"');
    expect(html.match(/class="card-skill"/g)).toHaveLength(4);expect(html).toContain('data-attributes="キュート / クール"');expect(html).toContain(byId(1).B);
  }
});
it('未発動では通常表示、実際のBURSTで全面表示、パフォーマンス終了で両ビューが通常へ戻る', () => {
  const ids=[1,2,3,4,5,8,10,12],g=createGame(ids,ids,['A','B','C'],['A','B','C'],'local',()=>.5);
  const board=()=>renderToStaticMarkup(<CardBoard player={g.p1} editable={false} resolved={false} onPlace={()=>{}} onSelect={()=>{}} onAppeal={()=>{}}/>);
  const inspector=()=>renderToStaticMarkup(<CardInspector player={g.p1} id={1} editable={false} onClose={()=>{}}/>);
  expect(board()).not.toContain('data-art-mode="burst"');expect(inspector()).toContain('data-art-mode="normal"');
  applyBurst(g,g.p1,g.p2,1);expect(board()).toContain('data-art-mode="burst"');expect(inspector()).toContain('data-art-mode="burst"');
  g.interactiveBursts=true;executeRound(g);expect(board()).not.toContain('data-art-mode="burst"');expect(inspector()).toContain('data-art-mode="normal"');expect(g.p1.states[1].normalUsed).toBe(true);
});
