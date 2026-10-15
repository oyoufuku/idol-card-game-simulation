import { inheritAnalysisSkills } from './analysis-skills';
import { playerRandom,setRandomSources,type RandomSources } from './random-source';
import { preparePerformance, recordPerformance, finishPerformance } from './performance';
import { calculationContext } from './context';
import { oppositeSlot, autoEnabled } from './formation';
import { songById,selectableSongById } from '../data/songs';
import type { Formation, Game, IdolState, Mode, Player, Song } from './types';
import { byId, formationFromArray, posOf, setFormation, validateFormation } from './formation';
import { checkBurstConditions, queueBursts, resolvePendingBursts, pendingBurst } from './burst';
import { applyFatigueAndPost, applyPrePerformance, applySongFatigue } from './fatigue';
import { calcBoth } from './appeal';
import { skillFor } from './skills';
import { finalResult, scoreRound } from './scoring';
import { effectsFor } from './effects';
export const GAME_RULE_VERSION='fatigue-center-meta-20261015-v6';
export function stateFor(id: number): IdolState {
  return { charge: 0, spentCharge: 0, lastSpentCharge: 0, samePositionStreak: 0, positionCounts: {}, symmetries: [], positionKinds: [], fatigueStreak: 0, freshStreak: 0, cuteRounds: 0, exactlyTwoCuteRounds: 0, repeatedSongAutos: 0, swapReduction: 0, plain: false, baseAdjustment: 0, fatigueAffected: false, autoTriggered: false, centerTriggered: false, matchedAttribute: null, stats: { auto: 0, ready: 0, center: 0, positions: { CENTER: 0, 'FRONT-L': 0, 'FRONT-R': 0, 'MIDDLE-L': 0, 'MIDDLE-R': 0, BACK: 0 } }, id, fatigue: 0, normalUsed: false, burstActive: false, forcedBurstCount: 0, burstCount: 0, burstStacks: 0, attributeOverride: null, addedAttributes: [],
    autoGainTotal: 0, autoDebuffTotal: 0, lastAutoGain: 0, lastAutoDebuff: 0, lastAppealGain:0, lastOppositeReduction:0,lastOppositeGain:0, nextAutoCarry: 0, activeAutoCarry: 0, burstDebuff: 0, permBonus: 0,
    nextBonus: 0, activeNextBonus: 0, backCount: 0, centerCount: 0, enteredCount: 0, prevPos: 'BACK', pos: 'BACK', lockedPos: null,
    burstSelfAppeal: 0, shield: false, muraiDoubleC: false };
}
export function mkPlayer(label: string, ids: number[], songs: string[]): Player {
  const p: Player = { songHistory: [], burstRounds:[], noBurstStreak: 0, burstBackCandidates: [], label, ids: [...ids], songs: [...songs], points: 0, totalAppeal: 0,
    states: Object.fromEntries(ids.map(id => [id, stateFor(id)])), formation: formationFromArray(ids),
    winsStreak: 0, lossStreak: 0, round: 1, lastAppeal: 0, coolStreak: 0, addedAttributes: [], tempAttr: null, enteredThisRoundIds: [], burstCoolBonus: 0 };
  ids.forEach(id => { p.states[id].pos = p.states[id].prevPos = posOf(p, id); });
  return p;
}
export function shuffle<T>(input: T[], random = Math.random) {
  const a = [...input]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
export function createGame(ids1: number[], ids2: number[], songs1: string[], songs2: string[], mode: Mode, random = Math.random, options?: {songDeck?:string[]; encorePool?:string[]; randomSources?:RandomSources; recordEffects?:boolean; interactiveBursts?:boolean; configureAnalysisPlayers?:(p1:Player,p2:Player)=>void}): Game {
  for (const ids of [ids1, ids2]) { if (ids.length !== 8 || new Set(ids).size !== 8) throw new Error('各Player：アイドル8人を選んでください。'); ids.forEach(byId); }
  for (const songs of [songs1, songs2]) { if (songs.length !== 3 || new Set(songs).size !== 3) throw new Error('各Player：楽曲3枚を選んでください。'); songs.forEach(selectableSongById); }
  options?.songDeck?.forEach(selectableSongById);options?.encorePool?.forEach(selectableSongById);
  const game: Game = { round: 1, done: false, cpuMode: mode === 'cpu', cpuLocked: false,
    p1: mkPlayer('P1', ids1, songs1), p2: mkPlayer(mode === 'cpu' ? 'CPU' : 'P2', ids2, songs2),
    songDeck: options?.songDeck ? [...options.songDeck] : shuffle([...songs1, ...songs2], random), roundSong: songById(songs1[0]), roundResolved: false,
    targets: [{ koji: ids1[0], matono: ids2[0], kousaka: ids2[0] }, { koji: ids2[0], matono: ids1[0], kousaka: ids1[0] }], logs: ['=== GAME START ==='], result: null };
  if(options?.randomSources)setRandomSources(game,options.randomSources);
  if(options?.encorePool)game.encorePool=[...options.encorePool];
  if(options?.recordEffects)game.skillEffects=[];
  if(options?.interactiveBursts)game.interactiveBursts=true;
  options?.configureAnalysisPlayers?.(game.p1,game.p2);
  prepareRound(game, random); return game;
}
export function prepareRound(game: Game, random = Math.random) {
  const effects = effectsFor(game); effects?.reset();
  game.roundResolved = false; game.result = null; game.cpuLocked = false;delete game.performanceAttributePlayers;
  [game.p1, game.p2].forEach(p => { p.round = game.round; p.ids.forEach(id => { const st = p.states[id]; st.autoTriggered = false; st.activeNextBonus = st.nextBonus; st.nextBonus = 0; st.activeAutoCarry += st.nextAutoCarry; st.nextAutoCarry = 0; }); p.enteredThisRoundIds = []; });
  for(const [p,opp] of [[game.p1,game.p2],[game.p2,game.p1]])for(const id of p.ids)if(autoEnabled(p,opp,id)){
    const start=skillFor(id,p).start;
    if(start){const ctx={...calculationContext(p,opp,id,game.roundSong),game,random:playerRandom(game,p,random)};
      if(effects)effects.capture(effects.source(p,id,'A','start'),()=>start(ctx));else start(ctx);
    }
  }

  if (game.songOverride) game.roundSong = songById(game.songOverride);
  else if (game.round <= 6) game.roundSong = songById(game.songDeck.shift()!);
  else {
    const { p1, p2 } = game;
    const pool = p1.points < p2.points ? p1.songs : p2.points < p1.points ? p2.songs : game.encorePool || [...p1.songs, ...p2.songs];
    game.encoreSong ??= songById(pool[Math.floor(random() * pool.length)]);
    game.roundSong = game.encoreSong;
  }
  if (game.songOverride) game.roundSong = songById(game.songOverride);
  if (game.songAttributeOverride) game.roundSong = { ...game.roundSong, type: game.songAttributeOverride };
  game.songOverride = undefined; game.songAttributeOverride = undefined;
  game.playedSongs?.push(game.roundSong.id);
  for(const p of [game.p1,game.p2]){
    // Reserve random draws before formation selection. Repeated preview and
    // actual execution use the same per-card tie breaks without consuming RNG.
    const rng=playerRandom(game,p,random),yamaguchi=p.ids.find(id=>byId(id).skill==='yamaguchi'),hirao=p.ids.find(id=>byId(id).skill==='hirao');
    if(yamaguchi!==undefined)p.performanceRandom=[rng(),rng()];
    if(hirao!==undefined)p.performanceRandomById={...(yamaguchi!==undefined?{[yamaguchi]:[...p.performanceRandom!]}:{}),[hirao]:[rng(),rng()]};
  }
  game.publicPlayers=[clonePlayer(game.p1),clonePlayer(game.p2)];
  game.logs.push(`\n--- ROUND ${game.round}${game.round === 7 ? ' ENCORE' : ''} / 楽曲 ${game.roundSong.name}: ${game.roundSong.effect} ---`);
}
export function preview(game: Game, f1 = game.p1.formation, f2 = game.p2.formation, detailed = true) {
  const error = validateFormation(game.p1, f1) || validateFormation(game.p2, f2);
  if (error) throw new Error(error);
  const p1 = clonePlayer(game.p1), p2 = clonePlayer(game.p2);
  return calculatePreview(p1,p2,game.roundSong,f1,f2,game.round,detailed);
}
function calculatePreview(p1:Player,p2:Player,song:Song,f1:Formation,f2:Formation,round:number,detailed:boolean) {
  preparePreviewPlayers(p1,p2,song,f1,f2,round);
  return {...calcBoth(p1,p2,song,detailed),players:[p1,p2] as const};
}
function preparePreviewPlayers(p1:Player,p2:Player,song:Song,f1:Formation,f2:Formation,round:number) {
  setFormation(p1,f1,round);setFormation(p2,f2,round);
  const [c1,c2]=preparePerformance(p1,p2,song);
  applySongFatigue(p1,song,p2);applySongFatigue(p2,song,p1);
  applyPrePerformance(p1,p2,song,c1,undefined,true);applyPrePerformance(p2,p1,song,c2,undefined,true);
}
/** Read-only CPU ranking preparation; the same phase hooks as real preview. */
export function prepareCpuEstimate(game:Game,f1:Formation,f2:Formation) {
 const p1=clonePlayerForCpu(game.p1,false),p2=clonePlayerForCpu(game.p2,false);
 preparePreviewPlayers(p1,p2,game.roundSong,f1,f2,game.round);return [p1,p2] as const;
}
// Only copy fields that can be mutated by calculation/end-fatigue. IDs, songs,
// position history and symmetry history are read-only during CPU prediction.
// CHARGE also runs finishPerformance and reaction B, so isolate its telemetry,
// song history and mutable attribute/debuff lists.
function clonePlayerForCpu(p:Player,chargeForecast:boolean):Player {
 const states:Player['states']={};
 for(const id of p.ids){const s=p.states[id];states[id]=chargeForecast?
  {...s,addedAttributes:[...s.addedAttributes],stats:{...s.stats,positions:{...s.stats.positions}},...(s.burstDebuffSources?{burstDebuffSources:s.burstDebuffSources.map(source=>({...source}))}:{})}:
  {...s};
 }
 return inheritAnalysisSkills(p,{...p,states,burstRounds:[...(p.burstRounds||[])],...(chargeForecast?{songHistory:[...p.songHistory],burstBackCandidates:[...p.burstBackCandidates],addedAttributes:[...p.addedAttributes]}:{})});
}
/** CPU-only projection; shared roster/position-history collections are read-only.
 * Use chargeForecast when also executing finishPerformance/reaction BURSTs.
 * validatedSide means the evaluator validates that candidate itself; the
 * opponent's unchanged public formation only needs validation once. */
export function createCpuPreview(game:Game,chargeForecast=false,validatedSide?:1|2) {
 let validatedOpponent:Formation|undefined;
 return (f1=game.p1.formation,f2=game.p2.formation)=>{
  if(validatedSide){
   const opponent=validatedSide===1?game.p2:game.p1,formation=validatedSide===1?f2:f1;
   if(formation!==validatedOpponent){const error=validateFormation(opponent,formation);if(error)throw new Error(error);validatedOpponent=formation;}
  }else{const error=validateFormation(game.p1,f1)||validateFormation(game.p2,f2);if(error)throw new Error(error);}
  return calculatePreview(clonePlayerForCpu(game.p1,chargeForecast),clonePlayerForCpu(game.p2,chargeForecast),game.roundSong,f1,f2,game.round,false);
 };
}
export function executeRound(game: Game, f1: Formation = game.p1.formation, f2: Formation = game.p2.formation, random = Math.random, options?:{detailedAppeal?:boolean}) {
  if (game.done || game.roundResolved) throw new Error('このラウンドは実行済みです。');
  if (game.cpuMode && !game.cpuLocked) throw new Error('先に「CPU配置を決定」を押してください。');
  const error = validateFormation(game.p1, f1) || validateFormation(game.p2, f2); if (error) throw new Error(error);
  const { p1, p2 } = game, log = (s: string) => game.logs.push(s);
  const effects = effectsFor(game); effects?.reset();
  setFormation(p1, f1, game.round); setFormation(p2, f2, game.round);
  for (const p of [p1, p2]) if (p.enteredThisRoundIds.length) log(`${p.label} バックス→ステージ：${p.enteredThisRoundIds.map(id => byId(id).name).join(' / ')}（${p.enteredThisRoundIds.length}人）`);
  const [c1, c2] = preparePerformance(p1, p2, game.roundSong, effects);
  if(effects)effects.capture(effects.song('performance'),()=>{applySongFatigue(p1, game.roundSong, p2);applySongFatigue(p2, game.roundSong, p1);});
  else {applySongFatigue(p1, game.roundSong, p2);applySongFatigue(p2, game.roundSong, p1);}
  applyPrePerformance(p1, p2, game.roundSong, c1, log, true, effects); applyPrePerformance(p2, p1, game.roundSong, c2, log, true, effects);
  const { p1: r1, p2: r2 } = calcBoth(p1, p2, game.roundSong, options?.detailedAppeal??true, effects);
  if(effects)game.performanceAttributePlayers=[clonePlayer(p1),clonePlayer(p2)];
  for (const [p, result] of [[p1, r1], [p2, r2]] as const) {
    p.lastAppeal = result.total; p.coolStreak = game.roundSong.type === 'クール' ? p.coolStreak + 1 : 0;
    p.ids.forEach(id => { p.states[id].lastAutoGain = 0; p.states[id].lastAutoDebuff = 0; p.states[id].lastAppealGain=0;p.states[id].lastOppositeReduction=0;p.states[id].lastOppositeGain=0; });
    const other=result===r1?r2:r1;
    for (const m of result.members) { const st = p.states[m.id]; st.lastAutoGain = m.autoGain; st.lastAutoDebuff = m.autoDebuff; st.autoGainTotal += m.autoGain; st.autoDebuffTotal += m.autoDebuff;st.lastAppealGain=m.skillGain??0;st.lastOppositeReduction=other.members.find(target=>target.slot===oppositeSlot(m.slot))?.skillReduction??0;st.lastOppositeGain=other.members.find(target=>target.slot===oppositeSlot(m.slot))?.skillGain??0; }
  }
  p1.totalAppeal += r1.total; p2.totalAppeal += r2.total;
  const { winner, points } = scoreRound(r1.total, r2.total, game.round);
  if (winner) (winner === 1 ? p1 : p2).points += points;
  log(`${p1.label} Appeal ${r1.total}\n  ${r1.lines.join('\n  ')}`); log(`${p2.label} Appeal ${r2.total}\n  ${r2.lines.join('\n  ')}`);
  log(winner ? `RESULT: ${winner === 1 ? p1.label : p2.label} +${points}pt（差${Math.abs(r1.total - r2.total)}）` : 'RESULT: DRAW');
  const o1 = winner === 1 ? 'win' : winner === 2 ? 'loss' : 'draw', o2 = winner === 2 ? 'win' : winner === 1 ? 'loss' : 'draw';
  recordPerformance(p1,p2,game.roundSong,o1); recordPerformance(p2,p1,game.roundSong,o2);
  applyFatigueAndPost(p1, p2, o1, c1, game.roundSong, log, effects); applyFatigueAndPost(p2, p1, o2, c2, game.roundSong, log, effects);
  for (const [p, opp] of [[p1, p2], [p2, p1]]) for (const id of p.ids) {
    if (p.states[id].burstStacks > 0) {const post=skillFor(id,p).postBurst;
      if(post){const ctx={ game, p, opp, id, song: game.roundSong, log, random:playerRandom(game,p,random), target: () => 0, burst: () => { throw new Error('終了処理でのBURSTは不可'); } };
        if(effects)effects.capture(effects.source(p,id,'B','post'),()=>post(ctx));else post(ctx);
      }
    }
  }
  finishPerformance(p1,p2,game.roundSong,effects); finishPerformance(p2,p1,game.roundSong,effects);
  const eligible1=checkBurstConditions(game,p1,p2,o1),eligible2=checkBurstConditions(game,p2,p1,o2);
  [p1, p2].forEach(p => {
    p.ids.forEach(id => { const st = p.states[id]; st.burstActive = false; st.burstStacks = 0; st.burstDebuff = 0; delete st.burstDebuffSources; st.attributeOverride = null; st.addedAttributes = []; st.activeAutoCarry = 0; st.burstSelfAppeal = 0; st.shield = false; st.grantedShield=false;st.negativeShield=false;st.immunitySources=[];st.protectedTargets=[];st.appealReductionShield=false; st.muraiDoubleC = false; st.activeNextBonus = 0; st.plain=false; st.baseAdjustment=0; st.prevPos = st.pos; st.lockedPos = null; });
    p.cuteOnly=false;p.coolOnly=false;p.burstCoolBonus = 0; p.tempAttr = null; p.addedAttributes = [];
  });
  if(game.skillEffects)game.burstEffectSources=[];
  queueBursts(game,eligible1,eligible2);
  pendingBurst(game);
  if(!game.interactiveBursts)resolvePendingBursts(game,random);
  game.roundResolved = true; game.done = game.round === 7;
  game.result = { p1: r1, p2: r2, winner, points };
  if (game.done) { game.result.final = finalResult(p1, p2); log(`=== FINAL ${game.result.final} / points ${p1.points}-${p2.points} / appeal ${p1.totalAppeal}-${p2.totalAppeal} ===`); }
  return game.result;
}
export function nextRound(game: Game, random = Math.random) {
  if (pendingBurst(game)) throw new Error('BURSTの発動処理を完了してください。');
  if (!game.roundResolved || game.done) throw new Error('次のラウンドに進めません。');
  game.round++; prepareRound(game, random);
}

export function clonePlayer(p: Player): Player {
 return inheritAnalysisSkills(p,{...p,...(p.performanceRandomById?{performanceRandomById:Object.fromEntries(Object.entries(p.performanceRandomById).map(([id,draws])=>[id,[...draws]]))}:{}), ids:[...p.ids],songs:[...p.songs],songHistory:[...p.songHistory],burstRounds:[...(p.burstRounds||[])],burstBackCandidates:[...p.burstBackCandidates],formation:{...p.formation},addedAttributes:[...p.addedAttributes],enteredThisRoundIds:[...p.enteredThisRoundIds],states:Object.fromEntries(p.ids.map(id=>{const s=p.states[id];return [id,{...s,addedAttributes:[...s.addedAttributes],positionCounts:{...s.positionCounts},symmetries:[...s.symmetries],positionKinds:[...s.positionKinds],...(s.burstDebuffSources?{burstDebuffSources:s.burstDebuffSources.map(source=>({...source}))}:{}),stats:{...s.stats,positions:{...s.stats.positions}}}];}))});
}
