import type { CSSProperties } from 'react';
import type { Attribute } from '../game/types';

export const cardTone = (attr: string) => attr === 'キュート' ? 'cute' : attr === 'クール' ? 'cool' : attr === 'ユーモア' ? 'humor' : 'plain';
const palette = {
  キュート: { color: '#d97d98', pale: '#f9e6ec', ink: '#79354e', symbol: '♡' },
  クール: { color: '#709bd0', pale: '#e3edfa', ink: '#355677', symbol: '◇' },
  ユーモア: { color: '#c7a348', pale: '#f7edcc', ink: '#745b21', symbol: '☆' },
};
const plain = { color: '#949c99', pale: '#e9edeb', ink: '#50615a', symbol: '○' };
export function cardAppearance(attributes: readonly Attribute[]) {
  const attrs = [...new Set(attributes)], colors = attrs.length ? attrs.map(attr => palette[attr]) : [plain];
  const split = (key: 'color' | 'pale') => `linear-gradient(120deg, ${colors.map((color, i) => `${color[key]} ${i * 100 / colors.length}% ${(i + 1) * 100 / colors.length}%`).join(', ')})`;
  return {
    tone: colors.length > 1 ? 'multi-attribute' : cardTone(attrs[0] || 'PLAIN'),
    label: attrs.join(' / ') || 'PLAIN', symbol: colors.map(c => c.symbol).join(' '),
    style: { '--card-frame': split('color'), '--card-surface': split('pale'), '--pale': colors[0].pale, '--ink': colors[0].ink, '--border': colors[0].color, '--aura': colors[0].color, '--aura-soft': `${colors[0].color}70` } as CSSProperties,
  };
}
