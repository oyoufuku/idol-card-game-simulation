import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { executeRound,preview } from '../game/engine';
import { calculationContext } from '../game/context';
import { prng } from '../simulation/random';
import { optimizationCases } from './helpers/engine-optimization-cases';
import baseline from './fixtures/engine-balance-20261015.json';
import { runMatch } from '../simulation/match';
import matches from './fixtures/matches-balance-20261015.json';
import type {MatchSpec} from '../simulation/match';

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)).digest('hex');
it('予測用の説明省略は全44盤面でAppeal・終了状態・BURST・演出イベントを変えない',()=>{
 const full=optimizationCases(),compact=optimizationCases();
 for(const [index,{game}] of full.entries()){
  const other=compact[index].game,a=executeRound(game,game.p1.formation,game.p2.formation,prng(400+index)),b=executeRound(other,other.p1.formation,other.p2.formation,prng(400+index),{detailedAppeal:false});
  const values=(r:typeof a)=>[r.p1,r.p2].map(t=>({total:t.total,members:t.members.map(({details,breakdown,...m})=>m)}));
  expect(values(a),full[index].name).toEqual(values(b));expect([game.p1,game.p2],full[index].name).toEqual([other.p1,other.p2]);expect(game.skillEffects).toEqual(other.skillEffects);
 }
});
it('全22曲44盤面は20261015の好花A・石塚B変更後の基準と一致する',()=>{
 const cases=optimizationCases();expect(cases).toHaveLength(baseline.length);
 for(const [{name,game},index] of cases.map((scenario,index)=>[scenario,index] as const)){
  const normal=preview(game),compact=preview(game,game.p1.formation,game.p2.formation,false);
  const result=executeRound(game,game.p1.formation,game.p2.formation,prng(400+index));
  expect({name,normal:digest(normal),compact:digest(compact),execution:digest({result,players:[game.p1,game.p2],effects:game.skillEffects,logs:game.logs})},name).toEqual(baseline[index]);
 }
});
it('共有した計算コールバックも乱数とBURSTを禁止し、指定logを保持する',()=>{
 const {game}=optimizationCases()[0],messages:string[]=[],ctx=calculationContext(game.p1,game.p2,game.p1.ids[0],game.roundSong,message=>messages.push(message));
 ctx.log('確認');expect(messages).toEqual(['確認']);expect(ctx.target('koji')).toBe(0);
 expect(()=>ctx.random()).toThrow('計算中の乱数使用');expect(()=>ctx.burst(1,false)).toThrow('計算中のBURST');
});
// These are new goldens for the approved card rules, not old-balance compatibility.
it('確定カード変更後の通常CPU/CHARGE試合をseed・全状態で再現する',()=>{
 for(const {spec,digest:expected} of matches)expect(digest(runMatch(spec as unknown as MatchSpec)),spec.pairId).toBe(expected);
},60000);
