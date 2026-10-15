import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { GAME_RULE_VERSION,executeRound,preview } from '../game/engine';
import { calculationContext } from '../game/context';
import { prng } from '../simulation/random';
import { optimizationCases } from './helpers/engine-optimization-cases';
import baseline from './fixtures/engine-fatigue-meta-20261015.json';
import priorBaseline from './fixtures/engine-facing-20261015.json';
import { runMatch } from '../simulation/match';
import matches from './fixtures/matches-fatigue-meta-20261015.json';
import priorMatches from './fixtures/matches-facing-20261015.json';
import type {MatchSpec} from '../simulation/match';
import {INPUT_FINGERPRINT} from '../simulation/input-fingerprint';

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)).digest('hex');
it('予測用の説明省略は全44盤面でAppeal・終了状態・BURST・演出イベントを変えない',()=>{
 const full=optimizationCases(),compact=optimizationCases();
 for(const [index,{game}] of full.entries()){
  const other=compact[index].game,a=executeRound(game,game.p1.formation,game.p2.formation,prng(400+index)),b=executeRound(other,other.p1.formation,other.p2.formation,prng(400+index),{detailedAppeal:false});
  const values=(r:typeof a)=>[r.p1,r.p2].map(t=>({total:t.total,members:t.members.map(({details,breakdown,...m})=>m)}));
  expect(values(a),full[index].name).toEqual(values(b));expect([game.p1,game.p2],full[index].name).toEqual([other.p1,other.p2]);expect(game.skillEffects).toEqual(other.skillEffects);
 }
});
it('全22曲44盤面は守屋C強化後の基準値と一致し、守屋不在の従来計算を維持する',()=>{
 const cases=optimizationCases();expect(cases).toHaveLength(baseline.length);
 for(const [{name,game},index] of cases.map((scenario,index)=>[scenario,index] as const)){
  const normal=preview(game),compact=preview(game,game.p1.formation,game.p2.formation,false);
  const result=executeRound(game,game.p1.formation,game.p2.formation,prng(400+index));
  if(![...game.p1.ids,...game.p2.ids].includes(23))expect(digest(compact),name).toBe(priorBaseline[index].compact);
  expect({name,normal:digest(normal),compact:digest(compact),execution:digest({result,players:[game.p1,game.p2],effects:game.skillEffects,logs:game.logs})},name).toEqual(baseline[index]);
 }
});
it('共有した計算コールバックも乱数とBURSTを禁止し、指定logを保持する',()=>{
 const {game}=optimizationCases()[0],messages:string[]=[],ctx=calculationContext(game.p1,game.p2,game.p1.ids[0],game.roundSong,message=>messages.push(message));
 ctx.log('確認');expect(messages).toEqual(['確認']);expect(ctx.target('koji')).toBe(0);
 expect(()=>ctx.random()).toThrow('計算中の乱数使用');expect(()=>ctx.burst(1,false)).toThrow('計算中のBURST');
});
// These are new goldens for the approved card rules, not old-balance compatibility.
it('守屋C強化後も通常CPU/CHARGE試合をseed・全状態で再現する',()=>{
 for(const {spec,digest:expected} of matches){
  const result=runMatch(spec as unknown as MatchSpec);
  expect(result.ruleVersion).toBe(GAME_RULE_VERSION);expect(result.inputFingerprint).toBe(INPUT_FINGERPRINT);
  expect(digest(result),spec.pairId).toBe(expected);
  if(![...spec.a.members,...spec.b.members].some(id=>[23,32,34,38,44].includes(id))){
   // Preserve the old full-state golden for the unaffected normal-CPU team;
   // only the deliberately changed snapshot metadata is normalized.
   const previous=priorMatches.find(m=>m.spec.pairId===spec.pairId)!;
   expect(digest({...result,ruleVersion:'facing-opponent-20261015-v4',inputFingerprint:'29d69533d6577563ec4783ed44990d8ac3f7c4cb5e012c4bb7dc3d69aeaee17c'})).toBe(previous.digest);
  }
 }
},60000);
