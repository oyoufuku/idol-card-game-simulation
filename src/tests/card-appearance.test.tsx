import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkPlayer } from '../game/engine';
import { attributesOf, byId } from '../game/formation';
import { IdolCardFace } from '../components/IdolCardFace';
import { cardAppearance } from '../components/card-appearance';
it('拡大カードは名前→画像枠→A/B条件/B/Cの順で、省略しない能力文を描画する', () => {
  const card = byId(12), html = renderToStaticMarkup(<IdolCardFace card={card} attributes={['ユーモア']} expanded/>);
  expect(html.indexOf('idol-name')).toBeLessThan(html.indexOf('card-picture'));
  expect(html.indexOf('card-picture')).toBeLessThan(html.indexOf('card-skill-list'));
  expect(html.match(/class="card-skill"/g)).toHaveLength(4);
  expect(html.indexOf('>A</b>')).toBeLessThan(html.indexOf('>B条件</b>'));
  expect(html.indexOf('>B条件</b>')).toBeLessThan(html.indexOf('>B</b>'));
  expect(html.indexOf('>B</b>')).toBeLessThan(html.indexOf('>C</b>'));
  for(const text of [card.A,card.Bcond,card.B,card.C])if(text)expect(html).toContain(text);
});
it('現在の追加・変更属性を使用し、2属性は2色、3属性は3色、重複は同じ色を増やさない', () => {
  const p = mkPlayer('P1',[1,2,3,4,5,6,7,8],['A','B','C']);
  p.states[1].attributeOverride='クール';p.states[1].addedAttributes=['キュート','キュート'];
  const two=cardAppearance(attributesOf(p,1));expect(two.label).toBe('クール / キュート');expect(two.tone).toBe('multi-attribute');
  expect(two.style['--card-frame' as keyof typeof two.style]).toContain('#709bd0 0% 50%');
  expect(two.style['--card-frame' as keyof typeof two.style]).toContain('#d97d98 50% 100%');
  p.addedAttributes=['ユーモア'];const three=cardAppearance(attributesOf(p,1));expect(three.label).toBe('クール / ユーモア / キュート');
  expect(three.style['--card-frame' as keyof typeof three.style]).toContain('#c7a348');
});
it('PLAINは追加属性より優先して無属性の灰色カードになり、盤面と拡大で同じ色を表示する', () => {
  const p=mkPlayer('P1',[1,2,3,4,5,6,7,8],['A','B','C']);p.states[1].plain=true;p.addedAttributes=['クール','ユーモア'];
  const attrs=attributesOf(p,1),appearance=cardAppearance(attrs);expect(appearance.label).toBe('PLAIN');expect(appearance.tone).toBe('plain');
  for(const expanded of [false,true]){const html=renderToStaticMarkup(<IdolCardFace card={byId(1)} attributes={attrs} expanded={expanded}/>);expect(html).toContain('data-attributes="PLAIN"');expect(html).toContain('#949c99');}
});
