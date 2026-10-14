import { expect, it } from 'vitest';
import fixture from './fixtures/catalog-codex.json';
import reviewed from '../../docs/simulation/balance-overrides-20261014.json';
import { IDOLS } from '../data/idols';
import { SONGS } from '../data/songs';
it('Codex実装用Excelの48人の数値・文面・タグを全項目照合する',()=>{expect(IDOLS).toEqual(reviewed);expect(IDOLS.map(c=>c.id)).toEqual(Array.from({length:48},(_,i)=>i+1));});
it('Codex実装用Excelの22曲の効果・属性・タグを全項目照合する',()=>{expect(SONGS.map(({selectable,...song})=>song)).toEqual(fixture.songs);expect(SONGS).toHaveLength(22);expect(SONGS.at(-1)?.name).toBe('JOYFUL LOVE');});
