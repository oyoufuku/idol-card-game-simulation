import { expect,it } from 'vitest';
import { clonePlayer,createGame,executeRound,nextRound,preview } from '../game/engine';
import { formationFromArray,posOf,validateFormation } from '../game/formation';
import { burstUtility,evaluateBurstFormation,forecastBurstFormation,futureFormations,publicNextSongs,BURST_CPU_POLICY } from '../game/burst-cpu';
import { evaluateCpuFormation } from '../game/cpu';
import { setRandomSources } from '../game/random-source';
import { setAnalysisSkillMasks } from '../game/analysis-skills';
import { prng } from '../game/seeded-random';
import { songById } from '../data/songs';
import { withStrategies,randomSchedule } from '../simulation/schedule';
import {CHARGE_POLICY} from '../simulation/charge-cpu';
import { assertFinite } from '../simulation/match';
import type { Game } from '../game/types';

function scenario(round=2):Game {
 const g=createGame([2,8,10,18,24,27,29,32],[1,7,14,19,20,22,25,30],['A','B','C'],['D','E','F'],'local',prng(1));
 g.round=g.p1.round=g.p2.round=round;g.roundSong=songById('A');g.playedSongs=['A'];
 for(const p of [g.p1,g.p2])for(const id of p.ids){p.states[id].normalUsed=true;p.states[id].prevPos=p.states[id].pos=posOf(p,id);}
 g.p1.states[2].normalUsed=false;g.p1.states[2].fatigue=1;g.p1.states[2].fatigueTwoEnds=1;
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];return g;
}
function lock(g:Game){for(const p of g.publicPlayers!)for(const id of p.ids)p.states[id].lockedPos=posOf(p,id);}

it('現在Appealだけでなく、次回の得点を取り返す候補を重み付きで評価する',()=>{
 const current={points:1,outcome:1,difference:2},next={points:0,outcome:0,difference:0};
 expect(burstUtility(current,{points:2,outcome:1,difference:10})).toBeGreaterThan(burstUtility({...current,difference:8},next));
 expect(burstUtility({...current,points:-2,outcome:-1},next)).toBeLessThan(burstUtility(current,next));
});
it('BURST条件・回数・疲労・次回効果は終了時の本番engineと一致する',()=>{
 const g=scenario(),forecast=forecastBurstFormation(g,1,g.p1.formation),predicted=preview(g);
 expect(forecast.total).toBe(predicted.p1.total);expect(forecast.opponentTotal).toBe(predicted.p2.total);
 const actual=executeRound(g,g.p1.formation,g.p2.formation,prng(4));
 expect(actual.p1.total).toBe(forecast.total);expect(g.p1.states[2].burstCount).toBe(1);
 expect(forecast.predictedBursts).toEqual([{side:1,id:2,normal:1,forced:0}]);
 expect(forecast.fatigue).toBe(g.p1.ids.reduce((n,id)=>n+g.p1.states[id].fatigue,0));
 const disabled=scenario();setAnalysisSkillMasks(disabled.publicPlayers![0],[{id:2,kind:'BURST'}]);
 const without=forecastBurstFormation(disabled,1,disabled.p1.formation);
 expect(without.predictedBursts).toEqual([]);expect(forecast.nextDifference).toBeGreaterThan(without.nextDifference);
 assertFinite(forecast);
});
it('公開楽曲の多重度・使用履歴・特殊曲・ENCOREの劣勢側プールを扱う',()=>{
 const g=scenario();g.p2.songs=['A','D','E'];g.playedSongs=['A','K'];
 expect(publicNextSongs(g)).toEqual(['B','C','A','D','E']);g.songOverride='S';expect(publicNextSongs(g)).toEqual(['S']);
 delete g.songOverride;g.round=6;g.p1.points=1;g.p2.points=4;expect(publicNextSongs(g)).toEqual(g.p1.songs);
 g.p1.points=5;expect(publicNextSongs(g)).toEqual(g.p2.songs);g.p1.points=4;expect(publicNextSongs(g)).toEqual([...g.p1.songs,...g.p2.songs]);
 g.round=7;expect(publicNextSongs(g)).toEqual([]);
});
it('予測は非公開デッキ・相手の編集状態・実試合の乱数・手動対象を使わず、元状態も変えない',()=>{
 const g=scenario();lock(g);const before=structuredClone(g),expected=evaluateBurstFormation(g,1,prng(7));
 expect(g).toEqual(before);
 setRandomSources(g,{players:[()=>{throw Error('live RNG');},()=>{throw Error('live RNG');}]});
 for(const field of ['p1','p2','songDeck','encoreSong','targets','logs'])Object.defineProperty(g,field,{get(){throw Error(`hidden ${field}`);}});
 const original=Math.random;Math.random=()=>{throw Error('unseeded RNG');};
 try{expect(evaluateBurstFormation(g,1,prng(7))).toEqual(expected);}finally{Math.random=original;}
});
it('R7は次回価値ゼロで通常CPUと同じ配置を選び、終了後BURSTを加点しない',()=>{
 const g=scenario(7);lock(g);const normal=evaluateCpuFormation(g,1,prng(3),{mode:'two-stage',previewCandidates:100});
 const best=evaluateBurstFormation(g,1,prng(3));expect(best.formation).toEqual(normal.formation);
 expect(best.nextPoints).toBe(0);expect(best.nextDifference).toBe(0);expect(best.nextFinalOutcome).toBe(0);expect(best.nextSongs).toEqual([]);
});
it('数学的に取り返せない今回の損失を判定し、R6では実得点のENCOREを予測する',()=>{
 const g=scenario(6);g.p1.points=0;g.p2.points=4;for(const id of g.p1.ids)g.p1.states[id].fatigue=20;
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];const forecast=forecastBurstFormation(g,1,g.p1.formation);
 expect(forecast.currentOutcome).toBe(-1);expect(forecast.recoverable).toBe(false);expect(forecast.nextFinalOutcome).toBeLessThanOrEqual(0);
 expect(Math.abs(forecast.nextPoints)).toBeLessThanOrEqual(3);
});
it('次回の候補にはCENTER交換・BACKS登場を含め、位置固定は破らない',()=>{
 const g=scenario(),p=g.p1;p.states[2].lockedPos='CENTER';
 const candidates=futureFormations(p);expect(candidates.length).toBeGreaterThan(1);
 for(const f of candidates){expect(validateFormation(p,f)).toBeNull();expect(f.CENTER).toBe(2);}
 expect(candidates.some(f=>Object.values(f).includes(32))).toBe(true);
 p.states[2].lockedPos=null;expect(futureFormations(p)).toHaveLength(86);
 expect(futureFormations(p).some(f=>[27,29,32].every(id=>Object.values(f).includes(id)))).toBe(true);
});
it('チャージBでBACKS復帰・回復した状態から次回投入を計算する',()=>{
 const g=scenario(5);g.p1.formation=formationFromArray([32,8,10,18,24]);g.p1.states[32].normalUsed=false;g.p1.states[32].charge=5;g.p1.states[32].prevPos='BACK';
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];const forecast=forecastBurstFormation(g,1,g.p1.formation);
 expect(forecast.predictedBursts.some(b=>b.id===32)).toBe(true);
 executeRound(g,g.p1.formation,g.p2.formation,prng(5));expect(posOf(g.p1,32)).toBe('BACK');expect(g.p1.states[32].charge).toBe(5);
 g.songDeck=['A','A'];nextRound(g,prng(5));
 // The B swap is after the performance history snapshot. R6 stays BACKS,
 // then R7 is a real BACKS-to-stage entry and spends the recovered charge.
 executeRound(g,g.p1.formation,g.p2.formation,prng(5));nextRound(g,prng(5));
 const entry=futureFormations(g.p1).find(f=>Object.values(f).includes(32))!,next=preview(g,entry,g.p2.formation);
 expect(next.players[0].states[32].spentCharge).toBe(5);
});
it('通常/CHARGEのscheduleを変更せず、追加戦略のpolicyとmirrorを保持する',()=>{
 const specs=randomSchedule(1,2);expect(withStrategies(specs,'normal')).toBe(specs);
 const added=withStrategies(specs,'burst');expect(added[0]).toEqual({...specs[0],cpuStrategies:['burst','burst'],cpuPolicy:BURST_CPU_POLICY});
 const mixed=withStrategies([{...specs[0],a:{...specs[0].a,archetype:'バースト軸'}}],'burst-archetype');expect(mixed[0].cpuStrategies).toEqual(['burst','normal']);
});
it('実候補の現在Appeal差を少し犠牲にして、B疲労付与と次回得点の高い配置を選べる',()=>{
 const g=createGame([32,38,44,43,45,13,9,17],[10,14,18,25,26,27,28,30],['L','J','C'],['A','B','C'],'local',()=>.5);
 g.round=g.p1.round=g.p2.round=4;g.roundSong=songById('J');g.playedSongs=['L','J','C','J'];
 g.p1.formation=formationFromArray([45,43,9,13,17]);
 for(const p of [g.p1,g.p2])for(const id of p.ids)p.states[id].normalUsed=true;
 for(const id of g.p1.ids){const s=g.p1.states[id];s.prevPos=s.pos=posOf(g.p1,id);s.fatigue=3;}
 for(const id of [32,38,44]){const s=g.p1.states[id];s.charge=3;s.normalUsed=false;s.prevPos='BACK';}
 g.p1.states[38].charge=0;
 for(const slot of ['CENTER','FRONT-L','FRONT-R','MIDDLE-L'] as const)g.p1.states[g.p1.formation[slot]].lockedPos=slot;
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
 const normal=evaluateCpuFormation(g,1,prng(1)),normalForecast=forecastBurstFormation(g,1,normal.formation),burst=evaluateBurstFormation(g,1,prng(1));
 expect(normal.formation['MIDDLE-R']).toBe(32);expect(burst.formation['MIDDLE-R']).toBe(44);
 expect(burst.currentDifference).toBeLessThan(normal.difference);expect(burst.nextPoints).toBeGreaterThan(normalForecast.nextPoints);
 expect(burst.utility).toBeGreaterThan(normalForecast.utility);expect(burst.predictedBursts.some(b=>b.id===44)).toBe(true);
});
it('正源司の疲労条件のA/C加算は実計算に含まれ、疲労を一律に価値から減算しない',()=>{
 const g=scenario();g.p1.formation=formationFromArray([29,8,10,18,24]);g.p1.states[29].fatigue=3;
 g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];const active=forecastBurstFormation(g,1,g.p1.formation);
 setAnalysisSkillMasks(g.publicPlayers[0],[{id:29,kind:'ALL'}]);const disabled=forecastBurstFormation(g,1,g.p1.formation);
 expect(active.total-disabled.total).toBe(3);
 expect(active.utility).toBe(burstUtility({points:active.currentPoints,outcome:active.currentOutcome,difference:active.currentDifference},{points:active.nextPoints,outcome:active.nextOutcome,difference:active.nextDifference}));
});
it('田村の対BURST A/Cは、相手の公開基準で予測した終了時Bを次回の妨害へ反映する',()=>{
 const g=scenario();g.p2.formation=formationFromArray([19,7,14,1,20]);g.publicPlayers=[clonePlayer(g.p1),clonePlayer(g.p2)];
 const active=forecastBurstFormation(g,1,g.p1.formation);
 setAnalysisSkillMasks(g.publicPlayers[1],[{id:19,kind:'ALL'}]);const disabled=forecastBurstFormation(g,1,g.p1.formation);
 expect(active.total).toBe(disabled.total);expect(active.predictedBursts.some(b=>b.id===2)).toBe(true);
 expect(active.nextDifference).toBeLessThan(disabled.nextDifference);
});

it('混合戦略はチャージ軸だけCHARGE・その他BURST、mirrorでもチームに追随する',()=>{
 const base=randomSchedule(1,1)[0],original=structuredClone(base);
 for(const [a,b,expected] of [['チャージ軸','クール軸',['charge','burst']],['クール軸','チャージ軸',['burst','charge']],['チャージ軸','チャージ軸',['charge','charge']],['クール軸','対スキル軸',['burst','burst']],['RANDOM','RANDOM',['burst','burst']]] as const){
  const spec={...base,a:{...base.a,archetype:a},b:{...base.b,archetype:b}};
  const actual=withStrategies([spec,{...spec,mirror:true}],'burst-charge-archetype');
  for(const [i,row] of actual.entries())expect(row).toEqual({...spec,mirror:!!i,cpuStrategies:expected,cpuPolicy:`${CHARGE_POLICY}+${BURST_CPU_POLICY}`});
 }
 expect(base).toEqual(original);
});
