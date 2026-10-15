import { skillEnabled } from './analysis-skills';
import { playerRandom } from './random-source';
import type { BurstJob, Game, Outcome, Player, Targets } from './types';
import { byId, posOf } from './formation';
import { skillFor } from './skills';
import { calculationContext } from './context';
import { effectsFor } from './effects';
import {chargeBackCandidates,chooseChargeBackTarget} from './burst-swap';
import {expireBurstSuppression} from './skill-suppression';
export function getTarget(game: Game, p: Player, opp: Player, kind: keyof Targets, source?:number, random=Math.random): number {
  if ((game.cpuBoth || (game.cpuMode && p === game.p2))) {
    if(kind==='chargeBack')return source===undefined?0:chooseChargeBackTarget(game,p,source,random);
    if(kind==='allyBurst')return p.ids.filter(id=>!game.burstSeen?.includes(`${p===game.p1?1:2}:${id}`)).sort((a,b)=>Number(p.states[a].normalUsed)-Number(p.states[b].normalUsed)||byId(b).base-byId(a).base)[0]||0;
    if (kind === 'koji') return p.ids.filter(id => byId(id).skill !== 'kojima').sort((a, b) => p.states[b].fatigue - p.states[a].fatigue || byId(b).base - byId(a).base)[0] || 0;
    const value = (id: number) => byId(id).base + (byId(id).C && skillEnabled(opp,id,'CENTER') ? 3 : 0) + opp.states[id].permBonus;
    return [...opp.ids].sort((a, b) => value(b) - value(a))[0] || 0;
  }
  return game.targets[p === game.p1 ? 0 : 1][kind]??(kind==='chargeBack'&&source!==undefined?chargeBackCandidates(p,source)[0]??0:0);
}
export function applyBurst(game: Game, p: Player, opp: Player, id: number, forced = false, random = Math.random) {
  if(game.round>=7&&game.roundResolved)return;
  if (game.burstTask) {
    game.burstChildren!.push({side:p===game.p1?0:1,id,forced,seen:game.burstTask.seen,phase:'burst'});
    return;
  }
  const effects = effectsFor(game);
  if (effects) return effects.capture(effects.source(p, id, 'B', 'burst'), () => applyBurstInternal(game, p, opp, id, forced, random));
  return applyBurstInternal(game, p, opp, id, forced, random);
}
function applyBurstInternal(game: Game, p: Player, opp: Player, id: number, forced: boolean, random: () => number): void {
  random=playerRandom(game,p,random);
  const st = p.states[id];
  const chainKey=`${p===game.p1?1:2}:${id}`;
  if(game.burstChain?.includes(chainKey))throw new Error('強制BURSTの循環を検出: '+[...game.burstChain,chainKey].join(' -> '));
  if(!game.burstChain?.length)game.burstSeen=game.burstTask?.seen ?? [];
  (game.burstChain??=[]).push(chainKey); (game.burstSeen??=[]).push(chainKey);
  if (!forced) { if (st.normalUsed) { game.burstChain.pop(); return; } st.normalUsed = true; }
  p.burstRounds=[...new Set([...(p.burstRounds||[]),p.round])];
  st.burstActive = true; st.fatigue = 0; st.burstCount++; st.burstStacks++;
  if (forced) st.forcedBurstCount++;
  const log = (s: string) => game.logs.push(s);
  log(`${p.label} ${byId(id).name} BURST${forced ? '（強制・通常回数を消費しない）' : ''}：疲労→0`);
  const burstPosition = posOf(p, id);
  if(burstPosition==='BACK'&&!p.burstBackCandidates.includes(id))p.burstBackCandidates.push(id);
  skillFor(id,p).burst({ game, p, opp, id, song: game.roundSong, log, random,
    target: kind => getTarget(game, p, opp, kind, id, random), burst: (target, force) => applyBurst(game, p, opp, target, force, random) });
  if (game.burstTask) {
    game.burstChildren!.push({...game.burstTask,phase:'reactions',position:burstPosition});
  } else reactToBurst(game,p,opp,burstPosition,random);
  game.burstChain.pop();
}
function reactionPositionAllowed(p:Player,id:number){const required=skillFor(id,p).reactionPosition,pos=posOf(p,id);return !required||(required==='FRONT'?pos.startsWith('FRONT'):pos!=='BACK');}
function reactToBurst(game:Game,p:Player,opp:Player,burstPosition:ReturnType<typeof posOf>,random:()=>number) {
  const log=(s:string)=>game.logs.push(s);
  for (const target of p.ids) {
    const reaction = p.states[target];
    if (skillFor(target,p).reactToTeamBursts && !reaction.normalUsed && !reaction.burstActive && p.ids.filter(member => member !== target && p.states[member].burstActive).length >= 2) {
      log(`${p.label} ${byId(target).name}：同じ終了処理で味方2人以上のBURSTを検知`);
      applyBurst(game, p, opp, target, false, random);
    }
  }
  for (const target of opp.ids) {
    const reaction = opp.states[target];
    if ((skillFor(target,opp).reactToOpponentBurst || (skillFor(target,opp).reactToOpponentBackBurst && burstPosition === 'BACK' && !game.deferredBackReactions)) && reactionPositionAllowed(opp,target) && !reaction.normalUsed && !reaction.burstActive) {
      log(`${opp.label} ${byId(target).name}：相手BURSTを検知`);
      applyBurst(game, opp, p, target, false, random);
    }
  }
}
/** All conditions are checked before any end-of-performance BURST can mutate them. */
export function queueBursts(game:Game, first:number[],second:number[]) {
  game.deferredBackReactions=true; game.p1.burstBackCandidates=[]; game.p2.burstBackCandidates=[];
  game.pendingBursts=[first,second].flatMap((ids,side)=>ids.map(id=>({side:side as 0|1,id,forced:false,seen:[],phase:'burst' as const})));
}
export function pendingBurst(game:Game):BurstJob|undefined {
  const queue=game.pendingBursts;
  if(!queue)return;
  while(true) {
    const job=queue[0];
    if(!job) {
      if(!game.deferredBackReactions){expireBurstSuppression(game.p1);expireBurstSuppression(game.p2);return;}
      game.deferredBackReactions=false;
      for(const [side,p,opp] of [[0,game.p1,game.p2],[1,game.p2,game.p1]] as const)
        if(opp.burstBackCandidates.length)for(const id of p.ids)
          if(skillFor(id,p).reactToOpponentBackBurst&&reactionPositionAllowed(p,id)&&!p.states[id].normalUsed&&!p.states[id].burstActive)
            queue.push({side,id,forced:false,seen:[],phase:'burst'});
      continue;
    }
    const p=job.side===0?game.p1:game.p2,opp=job.side===0?game.p2:game.p1;
    if(job.phase==='reactions') {
      queue.shift();game.burstTask=job;game.burstChildren=[];
      reactToBurst(game,p,opp,job.position!,()=>{throw new Error('反応予約中に乱数を消費できません');});
      queue.unshift(...game.burstChildren);delete game.burstTask;delete game.burstChildren;
      continue;
    }
    if((!job.forced&&p.states[job.id].normalUsed)||job.seen.includes(`${job.side+1}:${job.id}`)){queue.shift();continue;}
    return job;
  }
}
export function burstTargetKind(id:number):keyof Targets|undefined {
  const skill=byId(id).skill;
  return skillFor(id).chargeConsumer?'chargeBack':skill==='matsuda_konoka'?'allyBurst':skill==='kojima'?'koji':skill==='matono'?'matono':skill==='kousaka'?'kousaka':undefined;
}
export function burstTargetOptions(game:Game,job:BurstJob):number[] {
  const p=job.side===0?game.p1:game.p2,opp=job.side===0?game.p2:game.p1;
  return burstTargetKind(job.id)==='chargeBack'?chargeBackCandidates(p,job.id):burstTargetKind(job.id)==='allyBurst'?p.ids.filter(id=>id!==job.id&&!job.seen.includes(`${job.side+1}:${id}`)):burstTargetKind(job.id)==='koji'?p.ids.filter(id=>id!==job.id):[...opp.ids];
}
/** Resolve exactly one card, including its immediate B effect, without replaying RNG. */
export function resolveNextBurst(game:Game,target?:number,random=Math.random) {
  const job=pendingBurst(game);if(!job)return false;
  const kind=burstTargetKind(job.id),human=game.interactiveBursts&&!game.cpuBoth&&!(game.cpuMode&&job.side===1);
  if(kind&&human&&burstTargetOptions(game,job).length) {
    if(target===undefined||!burstTargetOptions(game,job).includes(target))throw new Error('BURSTの対象を選択してください。');
    game.targets[job.side][kind]=target;
  }
  game.pendingBursts!.shift();
  game.lastBurst={side:job.side,id:job.id,count:(game.lastBurst?.count??0)+1};
  game.burstTask=job;game.burstChildren=[];
  const p=job.side===0?game.p1:game.p2,opp=job.side===0?game.p2:game.p1;
  const effectStart=game.skillEffects?.length??0;
  const run=()=>applyBurstInternal(game,p,opp,job.id,job.forced,random),effects=effectsFor(game);
  if(effects)effects.capture(effects.source(p,job.id,'B','burst'),run);else run();
  if(game.skillEffects)game.burstEffectSources=[...(game.burstEffectSources||[]),...game.skillEffects.slice(effectStart)];
  game.pendingBursts!.unshift(...game.burstChildren);delete game.burstTask;delete game.burstChildren;
  const remaining=pendingBurst(game);
  if(!remaining&&game.done&&game.result?.final){const index=game.logs.findIndex(line=>line.startsWith('=== FINAL '));if(index>=0&&index!==game.logs.length-1)game.logs.push(...game.logs.splice(index,1));}
  return true;
}
export function resolvePendingBursts(game:Game,random=Math.random) {
  while(pendingBurst(game))resolveNextBurst(game,undefined,random);
}
export function checkBurstConditions(game: Game, p: Player, opp: Player, outcome: Outcome) {
  if (outcome === 'win') { p.winsStreak++; p.lossStreak = 0; }
  else if (outcome === 'loss') { p.lossStreak++; p.winsStreak = 0; }
  else { p.winsStreak = 0; p.lossStreak = 0; }
  // R7 has no subsequent performance: no normal condition evaluation, READY
  // count, or source BURST from which forced/reaction chains could start.
  if(game.round>=7)return [];
  const eligible:number[]=[];
  p.ids.forEach(id => {
    const st = p.states[id];
    if (st.normalUsed) return;
    if (skillFor(id,p).condition?.(calculationContext(p, opp, id, game.roundSong))) {
      eligible.push(id); st.stats.ready++;
    }
  });
  return eligible;
}
