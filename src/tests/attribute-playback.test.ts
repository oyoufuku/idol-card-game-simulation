import {expect,it} from 'vitest';
import {createGame,executeRound,nextRound} from '../game/engine';
import {applyBurst} from '../game/burst';
import {attributesOf} from '../game/formation';
import {playbackAttributePlayers} from '../components/battle-view';
import {songById} from '../data/songs';
const make=(a:number[],b:number[])=>{const g=createGame(a,b,['A','B','C'],['D','E','F'],'local',()=>.5,{recordEffects:true,interactiveBursts:true});g.roundSong=songById('A');for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;return g;};
it('PLAINは終了処理で解除されてもパフォーマンス演出中は灰色相当の属性なしを保持する',()=>{
 const g=make([36,8,10,18,24,27,28,30],[1,5,8,10,18,24,27,28]);executeRound(g);
 expect(attributesOf(g.p2,1)).toEqual(['キュート']);
 const held=playbackAttributePlayers(g,true,'performance')!;expect(attributesOf(held[1],1)).toEqual([]);
 expect(playbackAttributePlayers(g,true,'post')).toBe(held);expect(playbackAttributePlayers(g,false,undefined)).toBeUndefined();
 expect(playbackAttributePlayers(g,true,'burst')).toBeUndefined();expect(playbackAttributePlayers(g,true,undefined,true)).toBeUndefined();
 nextRound(g,()=>.5);expect(g.performanceAttributePlayers).toBeUndefined();
});
it('属性上書き・追加は演出中に保持し、次のBURSTと混ぜず、元状態と独立したsnapshotにする',()=>{
 const g=make([5,41,8,10,18,24,27,28],[1,8,10,18,24,27,28,30]);
 applyBurst(g,g.p1,g.p2,5,true,()=>.5);executeRound(g);
 const held=playbackAttributePlayers(g,true,'performance')!;
 for(const id of g.p1.ids)expect(attributesOf(held[0],id)).toEqual(['キュート']);
 expect(attributesOf(g.p1,8)).toEqual(['クール']);expect(held[0]).not.toBe(g.p1);
 g.p1.states[8].plain=true;expect(attributesOf(held[0],8)).toEqual(['キュート']);
 const added=make([41,8,10,18,24,27,28,30],[1,8,10,18,24,27,28,30]);executeRound(added);
 expect(attributesOf(playbackAttributePlayers(added,true,'performance')![0],41)).toEqual(['ユーモア','キュート']);
 expect(attributesOf(added.p1,41)).toEqual(['ユーモア']);
});
it('fast/CPU用の効果非記録では演出snapshotを生成しない',()=>{
 const g=createGame([36,8,10,18,24,27,28,30],[1,8,10,18,24,27,28,30],['A','B','C'],['D','E','F'],'local',()=>.5);
 executeRound(g);expect(g.performanceAttributePlayers).toBeUndefined();
});
