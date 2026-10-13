import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { executeRound,preview } from '../game/engine';
import { calculationContext } from '../game/context';
import { prng } from '../simulation/random';
import { optimizationCases } from './helpers/engine-optimization-cases';
import baseline from './fixtures/engine-final-excel-20261011.json';
import tamuraOverrides from './fixtures/engine-tamura-20261013-overrides.json';
import { runMatch } from '../simulation/match';
import matches from './fixtures/matches-final-excel-20261011.json';
import type {MatchSpec} from '../simulation/match';

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
it('予測用の説明省略は全44盤面でAppeal・終了状態・BURST・演出イベントを変えない',()=>{
 const full=optimizationCases(),compact=optimizationCases();
 for(const [index,{game}] of full.entries()){
  const other=compact[index].game,a=executeRound(game,game.p1.formation,game.p2.formation,prng(400+index)),b=executeRound(other,other.p1.formation,other.p2.formation,prng(400+index),{detailedAppeal:false});
  const values=(r:typeof a)=>[r.p1,r.p2].map(t=>({total:t.total,members:t.members.map(({details,breakdown,...m})=>m)}));
  expect(values(a),full[index].name).toEqual(values(b));expect([game.p1,game.p2],full[index].name).toEqual([other.p1,other.p2]);expect(game.skillEffects).toEqual(other.skillEffects);
 }
});
it('全22曲44盤面は田村の確定変更だけを差分fixtureに反映し、他は旧基準と一致する',()=>{
 const cases=optimizationCases();expect(cases).toHaveLength(baseline.length);
 for(const [{name,game},index] of cases.map((scenario,index)=>[scenario,index] as const)){
  const normal=preview(game),compact=preview(game,game.p1.formation,game.p2.formation,false);
  const result=executeRound(game,game.p1.formation,game.p2.formation,prng(400+index));
  const updated=(tamuraOverrides as Record<string,typeof baseline[number]>)[name];
  if(updated)expect(game.p1.ids.includes(19)||game.p2.ids.includes(19)).toBe(true);
  expect({name,normal:digest(normal),compact:digest(compact),execution:digest({result,players:[game.p1,game.p2],effects:game.skillEffects,logs:game.logs})},name).toEqual(updated??baseline[index]);
 }
});
it('共有した計算コールバックも乱数とBURSTを禁止し、指定logを保持する',()=>{
 const {game}=optimizationCases()[0],messages:string[]=[],ctx=calculationContext(game.p1,game.p2,game.p1.ids[0],game.roundSong,message=>messages.push(message));
 ctx.log('確認');expect(messages).toEqual(['確認']);expect(ctx.target('koji')).toBe(0);
 expect(()=>ctx.random()).toThrow('計算中の乱数使用');expect(()=>ctx.burst(1,false)).toThrow('計算中のBURST');
});
// Neither reference roster contains Tamura. Normalize only the catalog hash:
// the confirmed B text changes provenance, not these games or CPU decisions.
it('田村を含まない既存通常CPU/CHARGE試合は、更新されたカタログhash以外の全状態が一致する',()=>{
 for(const {spec,digest:expected} of matches)expect(digest({...runMatch(spec as unknown as MatchSpec),inputFingerprint:'7767efd628c644ba626b48f279d65e08c32cecb0830780fad818dea6e034f76c'}),spec.pairId).toBe(expected);
},30000);
