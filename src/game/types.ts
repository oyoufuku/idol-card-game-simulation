export type Attribute = 'キュート' | 'クール' | 'ユーモア';
export const SLOTS = ['CENTER', 'FRONT-L', 'FRONT-R', 'MIDDLE-L', 'MIDDLE-R'] as const;
export type Slot = typeof SLOTS[number];
export type Position = Slot | 'BACK';
export type Formation = Record<Slot, number>;
export type Outcome = 'win' | 'loss' | 'draw';
export type Mode = 'cpu' | 'local';
export interface Idol { id: number; no: string; name: string; attr: Attribute; tags: string[]; themeTags: string[]; group: string; generation: string; base: number; A: string; Bcond: string; B: string; C: string | null; skill: string }
export interface Song { id: string; name: string; type: Attribute; effect: string; tags?: string[]; selectable?: boolean; rule: 'attribute' | 'nonCute' | 'nonHumorFatigue' | 'doubleFatigue' | 'losing' | 'entry' | 'nonBurst' | 'missingAttributes' | 'disableCenter' | 'recoverAll' | 'coolFront' | 'burstPenalty' | 'samePosition' | 'middleBonus' | 'fatigueRelief' | 'highBase' | 'attributeCount' | 'majority' | 'doubleCurrentFatigue' | 'allAttributes' | 'sameFatigue' | 'moved' | 'cancelBurst' }
export interface IdolState {
  burstDisabledUntilRound?:number;
  immunitySources?:{id:number;kind:'A'|'B'}[]; protectedTargets?:number[];
  autoReductionCurrent?:number; autoSuccessRounds?:number; fatigueTwoEnds?:number; stageWins?:number; coolStageRounds?:number; stageSongAttributes?:Attribute[]; stageFreshRounds?:number; qualifiedBackRounds?:number; lastOppositeGain?:number;
  grantedShield?:boolean; negativeShield?:boolean; appealReductionShield?:boolean;
  charge: number; spentCharge: number; lastSpentCharge: number; samePositionStreak: number;
  positionCounts: Record<string, number>; symmetries: number[]; positionKinds: string[];
  fatigueStreak: number; freshStreak: number; cuteRounds: number; exactlyTwoCuteRounds: number; repeatedSongAutos: number;
  swapReduction: number; plain: boolean; baseAdjustment: number; fatigueAffected: boolean;
  stats: { auto: number; ready: number; center: number; positions: Record<Position, number> };
  autoTriggered: boolean; centerTriggered: boolean; matchedAttribute: Attribute | null;
  id: number; fatigue: number; normalUsed: boolean; burstActive: boolean;
  burstCount: number; burstStacks: number; attributeOverride: Attribute | null; addedAttributes: Attribute[];
  autoGainTotal: number; autoDebuffTotal: number; lastAutoGain: number; lastAutoDebuff: number;
  lastAppealGain:number; lastOppositeReduction:number;
  nextAutoCarry: number; activeAutoCarry: number; burstDebuff: number; burstDebuffSources?:{id:number;amount:number}[];
  forcedBurstCount: number; permBonus: number; nextBonus: number; activeNextBonus: number;
  backCount: number; centerCount: number; enteredCount: number; prevPos: Position; pos: Position;
  lockedPos: Position | null; burstSelfAppeal: number; shield: boolean; muraiDoubleC: boolean;
}
export interface Player {
  cuteOnly?:boolean; coolOnly?:boolean; burstRounds?:number[];
  performanceRandom?:number[]; performanceRandomById?:Record<number,readonly number[]>; performanceBurstCount?:number; backGroupStreak?:number; previousBackIds?:number[];
  songHistory: Attribute[]; noBurstStreak: number; burstBackCandidates: number[];
  label: string; ids: number[]; songs: string[]; points: number; totalAppeal: number;
  states: Record<number, IdolState>; formation: Formation; winsStreak: number; lossStreak: number;
  round: number; lastAppeal: number; coolStreak: number; addedAttributes: Attribute[];
  tempAttr: Attribute | null; enteredThisRoundIds: number[]; burstCoolBonus: number;
}
export interface Targets { koji: number; matono: number; kousaka: number; allyBurst?:number; chargeBack?:number }
export interface BurstJob { side: 0 | 1; id: number; forced: boolean; seen: string[]; phase: 'burst' | 'reactions'; position?: Position }
export interface Game {
  cpuStrategy?: 'burst';
  // Publicly revealed song IDs, only tracked for the opt-in planning CPU.
  playedSongs?: string[];
  // The browser pauses this shared engine queue for target selection and animation.
  interactiveBursts?: boolean; pendingBursts?: BurstJob[]; burstTask?: BurstJob; burstChildren?: BurstJob[];
  effectRevision?: number;
  lastBurst?: {side:0|1;id:number;count:number}; burstEffectSources?:SkillEffect[];
  // Optional presentation/telemetry data. CPU previews and fast CLI omit it.
  skillEffects?: SkillEffect[];
  round: number; done: boolean; cpuMode: boolean; cpuLocked: boolean; p1: Player; p2: Player;
  encorePool?: string[];
  publicPlayers?: [Player, Player];
  cpuBoth?: boolean; burstChain?: string[]; burstSeen?: string[]; deferredBackReactions?: boolean;
  songOverride?: string; songAttributeOverride?: Attribute;
  songDeck: string[]; roundSong: Song; encoreSong?: Song; roundResolved: boolean;
  targets: [Targets, Targets]; logs: string[]; result: RoundResult | null;
}
export type EffectKind = 'A' | 'B' | 'C' | '曲' | '終了';
export type EffectPhase = 'start' | 'burst' | 'performance' | 'post';
export interface EffectTarget { side: 0 | 1; id: number; label: string; delta?: number }
export interface EffectSource { side: 0 | 1 | null; id: number | null; position: Position | null; kind: EffectKind; phase: EffectPhase; label: string }
export interface SkillEffect extends EffectSource { targets: EffectTarget[] }
export interface AppealEffect { id: number; amount: number; opponent?: boolean }
export interface AppealContribution { side:0|1|null; sourceId?:number; sourceName:string; kind: 'A'|'B'|'C'|'曲'|'基礎'|'位置'|'疲労'|'下限'; amount:number; effect:string; reason?:string }
export interface Appeal { id: number; slot: Slot; val: number; details: string[]; breakdown?:AppealContribution[]; autoGain: number; autoDebuff: number; skillGain?:number; skillReduction?:number }
export interface TeamAppeal { total: number; lines: string[]; members: Appeal[] }
export interface RoundResult { p1: TeamAppeal; p2: TeamAppeal; winner: number; points: number; final?: string }
export interface Context {
  game?: Game;
  p: Player; opp: Player; id: number; song: Song; log: (text: string) => void;
  random: () => number; target: (kind: keyof Targets) => number;
  burst: (id: number, forced: boolean) => void;
}
export interface Skill {
  start?: (ctx: Context) => void;
  burstPre?: (ctx:Context)=>void; selfBurstShield?:boolean; reactionPosition?:'FRONT'|'STAGE'; centerEntryFatigueReduction?:number;
  post?: (ctx: Context) => void;
  autoActive?: (ctx: Context) => boolean;
  chargeConsumer?: boolean;
  positionMultiplier?: number;
  positionTeamMultiplier?: number;
  cancelOppositePosition?: boolean;
  cancelEnemyFront?: boolean;
  plainCenter?: boolean;
  baseEnemyCenter?: boolean;
  centerPositionBonus?: (ctx: Context) => number;

  pre?: (ctx: Context) => void;
  autoAppeal?: (ctx: Context) => number | undefined;
  autoEffects?: (ctx: Context) => AppealEffect[];
  burstEffects?: (ctx: Context) => AppealEffect[];
  centerEffects?: (ctx: Context) => AppealEffect[];
  immuneAppeal?: boolean;
  copyOppositeAuto?: boolean; copyOppositeGain?:boolean; negativeImmuneOnEntry?:boolean; burstPartyShield?:boolean; cancelEnemyPositions?:boolean; enemyPositionFatigueMultiplier?:number;
  centerSongImmune?: boolean;
  protectCoolFromAuto?: boolean;
  reactToOpponentBackBurst?: boolean;
  reactToTeamBursts?: boolean;
  postFatigue?: (ctx: Context) => void;
  postBurst?: (ctx: Context) => void;
  fatigueReduction?: number;
  disableOppositeAuto?: boolean;
  disableOpponentCenter?: boolean;
  centerPre?: (ctx: Context) => void;
  centerAppeal?: (ctx: Context, member: number) => number | undefined;
  centerLoss?: (ctx: Context) => void;
  burst: (ctx: Context) => void;
  condition?: (ctx: Context) => boolean;
  reactToOpponentBurst?: boolean;
  backCenterMitigation?: number;
}
