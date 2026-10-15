import { analysisSkill } from './analysis-skills';
import { increaseFatigue } from './fatigue';
import {grantImmunity} from './immunity';
import {disableBurstSkill} from './skill-suppression';
// Catalog behavior is registered here; common engine phases are independent of card IDs.
import { EXTRA_SKILLS } from './skills-extra';
import type { Context, Skill, AppealEffect } from './types';
import { attributesOf, byId, clamp0, countAttr, hasAttr, idsStage, oppositeId, posOf, symmeId, validateFormation, setFormation } from './formation';
const self = (c: Context) => c.p.states[c.id];
const opposite = (c: Context, amount: number): AppealEffect[] => { const id = oppositeId(c.p, c.opp, c.id); return id == null ? [] : [{ id, amount, opponent: true }]; };
const fatigueSum = (c: Context, opponent = false) => { const p = opponent ? c.opp : c.p; return p.ids.reduce((n, id) => n + p.states[id].fatigue, 0); };
const stageRounds=(c:Context)=>Object.entries(self(c).positionCounts).filter(([pos])=>pos!=='BACK').reduce((n,[,v])=>n+v,0);
const onStage=(c:Context)=>posOf(c.p,c.id)!=='BACK';
function frontLock(c: Context, id: number, amount=4) {
  const st = c.opp.states[id];
  if (!st || st.shield||st.negativeShield) { c.log('  B: 対象は相手効果を受けない'); return; }
  const next = { ...c.opp.formation }, old = posOf(c.opp, id), replaced = next['FRONT-R'];
  next['FRONT-R'] = id;
  if (old !== 'BACK' && old !== 'FRONT-R') next[old] = replaced;
  const error = validateFormation(c.opp, next);
  if (error) { c.log(`  B: 既存の位置固定を優先し不発（${error}）`); return; }
  setFormation(c.opp, next, c.p.round); st.lockedPos = 'FRONT-R'; st.burstDebuff -= amount; (st.burstDebuffSources??=[]).push({id:c.id,amount:-amount});
  c.log(`  B: ${byId(id).name}をFRONT-Rに固定 / Appeal-${amount}`);
}
export const SKILLS: Record<string, Skill> = {
  ...EXTRA_SKILLS,
  ishimori: {
 autoEffects:c=>{const id=oppositeId(c.p,c.opp,c.id);return id!==null&&hasAttr(c.opp,id,'クール')?opposite(c,-2):[];},
 burstEffects:c=>c.opp.ids.map(id=>({id,amount:-self(c).burstStacks*(hasAttr(c.opp,id,'クール')?2:1),opponent:true})),burst:()=>{},
 condition:c=>onStage(c)&&stageRounds(c)>=2&&(self(c).autoSuccessRounds||0)>=1
},
  endo: {fatigueReduction:1,burst:()=>{},burstEffects:c=>opposite(c,-4*self(c).burstStacks),condition:c=>(self(c).fatigueTwoEnds||0)>=2},
  odakura: {autoEffects:c=>opposite(c,-countAttr(c.opp,'クール')),burst:c=>{c.opp.coolOnly=true;},condition:c=>onStage(c)&&stageRounds(c)>=2&&new Set(idsStage(c.opp).flatMap(id=>attributesOf(c.opp,id))).size<=2},
  kojima: {
    backCenterMitigation: 1,
    burst: c => { const t = c.target('koji'); if (t && t !== c.id && c.p.states[t]) { [self(c).fatigue, c.p.states[t].fatigue] = [c.p.states[t].fatigue, self(c).fatigue]; self(c).protectedTargets=[...new Set([...(self(c).protectedTargets||[]),t])];grantImmunity(c.p,t,c.id,'B'); c.log(`  B: ${byId(t).name}と疲労を交換`); } },
    condition:c=>self(c).positionCounts.BACK>=3,
  },
  taniguchi: {
    autoEffects: c => hasAttr(c.p, c.p.formation['FRONT-L'], 'キュート') && hasAttr(c.p, c.p.formation['FRONT-R'], 'キュート') ? opposite(c, -2) : [],
    burst:c=>{c.p.cuteOnly=true;},
    condition: c => c.song.type === 'キュート' && posOf(c.p, c.id) === 'CENTER',
    centerEffects: c => [c.p, c.opp].flatMap(p => p.ids.filter(id => !hasAttr(p, id, 'キュート')).map(id => ({ id, amount: -1, opponent: p === c.opp }))),
  },
  nakashima: {
    autoAppeal: c => [c.p, c.opp].reduce((n, p) => n + p.ids.filter(id => p.states[id].burstActive).length, 0),
    burst: c => { const candidates=c.p.ids.filter(id=>id!==c.id&&hasAttr(c.p,id,'ユーモア')&&!c.game?.burstSeen?.includes(`${c.p===c.game.p1?1:2}:${id}`));
      if(candidates.length)c.burst(candidates[Math.floor(c.random()*candidates.length)],true);
    }, condition:c=>onStage(c)&&countAttr(c.p,'ユーモア')>=3,
  },
  matono: {
    disableOppositeAuto:true,disableOpponentCenter:true,reactToOpponentBurst:true,reactionPosition:'FRONT',
    centerPre: c => { self(c).fatigue += 2; c.log(`${c.p.label} 的野C：自身疲労+2`); },
    burst: c => { const t = c.target('matono'); if (t && c.opp.states[t] && !c.opp.states[t].shield&&!c.opp.states[t].negativeShield) { c.opp.states[t].lockedPos = posOf(c.opp, t); c.log(`  B: ${byId(t).name}を${c.opp.states[t].lockedPos}に固定`); } },
  },
  mukai: { autoAppeal: c => c.p.points > c.opp.points ? 2 : undefined,
    burst: c => { self(c).burstSelfAppeal += Math.min(c.p.points, 3); }, condition:c=>onStage(c)&&(self(c).stageWins||0)>=2 },
  murai: {negativeImmuneOnEntry:true,burst:c=>{self(c).muraiDoubleC=true;},condition:c=>c.p.enteredThisRoundIds.length>=3,burstEffects:c=>idsStage(c.p).map(id=>({id,amount:self(c).burstStacks})),centerAppeal:(c,id)=>c.p.enteredThisRoundIds.includes(id)?1:undefined,centerEntryFatigueReduction:1},
  murayama: { autoAppeal: c => countAttr(c.p, 'クール') >= 3 ? 2 : undefined,
    burst: c => { c.p.burstCoolBonus++; }, condition: c => c.song.type === 'クール' && posOf(c.p, c.id) === 'BACK' },
  yamashita: { autoAppeal: c => c.song.type === 'クール' && posOf(c.p, c.id) === 'CENTER' ? 1 : undefined,
    burst: c => { self(c).burstSelfAppeal += 2; grantImmunity(c.p,c.id,c.id,'B'); },
    selfBurstShield:true,condition:c=>self(c).positionCounts.CENTER>=2,
    centerAppeal: (c, id) => id === c.id ? 5 : undefined, centerSongImmune: true },
  matsuda: {
    autoAppeal: c => c.p.ids.reduce((n, id) => n + c.p.states[id].burstCount, 0) >= 5 ? 3 : undefined,
    reactToTeamBursts: true,
    burst: () => {},
    postBurst: c => { for (let n = 0; n < self(c).burstStacks; n++) {
      const id = c.p.ids[Math.floor(c.random() * c.p.ids.length)];
      c.p.states[id].normalUsed = false;
      c.log(`  松田B：${byId(id).name}の通常BURST使用済み状態をリセット（累計回数は保持）`);
    } },
    centerAppeal: (c, id) => c.p.states[id].burstActive ? 2 : undefined,
  },
  kousaka: {
    autoEffects: c => posOf(c.p, c.id) === 'BACK' ? [{ id: c.opp.formation.CENTER, amount: -2, opponent: true }] : [],
    condition: c => c.song.type === 'キュート' && posOf(c.p, c.id) !== 'BACK',
    burst: c => frontLock(c, c.target('kousaka'),6),
  },
  fujiyoshi: {
    copyOppositeAuto: true, protectCoolFromAuto: true,
    condition: c => self(c).lastAppealGain >= 4,
    burst: c => { self(c).activeAutoCarry+=self(c).lastAutoGain; },
  },
  moriya: {
    autoEffects: c => { const id = oppositeId(c.p, c.opp, c.id); return id != null && c.opp.states[id].fatigue >= 3 ? opposite(c, -2) : []; },
    condition:c=>self(c).lastOppositeReduction-(self(c).lastOppositeGain||0)>=3,
    burst: c => { self(c).activeAutoCarry += self(c).lastAutoDebuff;const t=oppositeId(c.p,c.opp,c.id);if(t!==null&&!c.opp.states[t].shield&&!c.opp.states[t].negativeShield)c.opp.states[t].lockedPos=posOf(c.opp,t); c.log(`  守屋B：前パフォーマンスのAUTO下降分-${self(c).lastAutoDebuff}を引継ぎ`); },
    centerEffects: c => c.opp.ids.filter(id => c.opp.states[id].fatigue >= 3).map(id => ({ id, amount: c.opp.states[id].fatigue >= 5 ? -2 : -1, opponent: true })),
  },
  inoue: {
    pre: c => { const back = posOf(c.p, c.id) === 'BACK', t = back ? c.p.formation.CENTER : symmeId(c.p, c.id); if (t != null) { c.p.states[t].fatigue = clamp0(c.p.states[t].fatigue - 2); c.log(`${c.p.label} 井上A：${byId(t).name}疲労-2`); } },
    burst: c => { c.p.ids.forEach(id => c.p.states[id].fatigue = clamp0(c.p.states[id].fatigue - 2)); }, condition:c=>c.p.ids.filter(id=>c.p.states[id].fatigue>=5).length>=2,
  },
  endo_hikari: {
    autoEffects: c => { const t = symmeId(c.p, c.id); return t != null && hasAttr(c.p, t, 'クール') ? [{ id: c.id, amount: 1 }, { id: t, amount: 1 }] : []; },
    condition: c => [c.p.formation.CENTER, c.p.formation['FRONT-L'], c.p.formation['FRONT-R']].every(id => hasAttr(c.p, id, 'クール')),
    burst: c => { c.game!.songOverride = 'K'; c.log('  B: 今回のパフォーマンス楽曲をジャマイカビールに変更'); },
  },
  ozono: { immuneAppeal: true, burst: () => {}, condition:c=>c.p.round>=5&&['CENTER','FRONT-L','FRONT-R'].includes(posOf(c.p,c.id)) },
  onuma: {
    pre: c => { const t = oppositeId(c.p, c.opp, c.id); if (t != null && !c.opp.states[t].shield&&!c.opp.states[t].negativeShield) { increaseFatigue(c.opp,c.p,t,2); c.log(`${c.p.label} 大沼A：${byId(t).name}疲労+2`); } },
    condition: c => { const t = oppositeId(c.p, c.opp, c.id); return t != null && c.opp.states[t].fatigue >= 7; },
    burst: c => { self(c).burstSelfAppeal += 5; },
    postFatigue: c => { self(c).permBonus=Math.max(-byId(c.id).base,self(c).permBonus-self(c).burstStacks); },
    postBurst: c => { self(c).normalUsed = false; c.log('  大沼B：基礎Appeal減少・通常BURST再使用可能'); },
  },
  takemoto: {
    autoAppeal: c => c.song.type === 'クール' ? 3 : undefined,
    condition:c=>onStage(c)&&(self(c).coolStageRounds||0)>=2,
    burst: c => { c.game!.songAttributeOverride = 'クール'; self(c).burstSelfAppeal += 2; },
  },
  tamura: {
    autoEffects: c => { const t = oppositeId(c.p, c.opp, c.id); return t != null && c.opp.states[t].burstActive ? opposite(c, -4) : []; },
    reactToOpponentBackBurst:true,reactionPosition:'STAGE',
    burst: c => {
      const candidates=c.opp.burstBackCandidates;if(!candidates.length)return;
      const id=candidates[Math.floor(c.random()*candidates.length)],s=c.opp.states[id];
      if(s.shield||s.negativeShield){c.log('  田村B：対象は相手効果を受けない');return;}
      const previous=c.opp.formation.CENTER,next={...c.opp.formation,CENTER:id},error=validateFormation(c.opp,next);
      if(error){c.log(`  田村B：既存の配置・位置固定を優先し不発（${error}）`);return;}
      setFormation(c.opp,next,c.p.round);s.lockedPos='CENTER';disableBurstSkill(c.opp,c.p,id,c.p.round+1);
      c.log(`  田村B：${byId(id).name}をCENTER固定 / Bスキル無効（次のパフォーマンス終了まで）${previous!==id?` / ${byId(previous).name}はBACKSへ移動`:''}`);
    },
    centerEffects: c => c.opp.ids.filter(id => c.opp.states[id].burstActive).map(id => ({ id, amount: -2, opponent: true })),
  },
  masumoto: {
 pre:c=>{for(const p of [c.p,c.opp])for(const id of p.ids)if(!hasAttr(p,id,'ユーモア')&&!(p===c.opp&&(p.states[id].shield||p.states[id].negativeShield)))increaseFatigue(p,p===c.p?c.opp:c.p,id,1);},
 condition:c=>onStage(c)&&fatigueSum(c,true)>=24,burst:()=>{},
 burstPre:c=>{const t=oppositeId(c.p,c.opp,c.id);if(t!==null&&!c.opp.states[t].shield&&!c.opp.states[t].negativeShield)increaseFatigue(c.opp,c.p,t,8);}
},
  morita: {
    autoEffects: c => countAttr(c.p, 'クール') && countAttr(c.p, 'ユーモア') ? opposite(c, -1) : [],
    condition:c=>posOf(c.p,c.id)==='CENTER'&&((hasAttr(c.p,c.p.formation['FRONT-L'],'クール')&&hasAttr(c.p,c.p.formation['FRONT-R'],'ユーモア'))||(hasAttr(c.p,c.p.formation['FRONT-R'],'クール')&&hasAttr(c.p,c.p.formation['FRONT-L'],'ユーモア'))),
    burst: c => { self(c).addedAttributes = ['クール', 'ユーモア']; },
    burstEffects: c => opposite(c, -2 * self(c).burstStacks),
    centerEffects: c => [{ id: c.opp.formation.CENTER, opponent: true, amount: -new Set(idsStage(c.p).flatMap(id => attributesOf(c.p, id))).size }],
  },
  yamasaki: {
    autoAppeal: c => c.p.points < c.opp.points ? c.opp.points : undefined,
    burst: c => { self(c).permBonus += 2; }, condition: c => c.p.lossStreak >= 2,
    centerLoss: c => { idsStage(c.p).forEach(id => { c.p.states[id].fatigue = clamp0(c.p.states[id].fatigue - 1); c.p.states[id].nextBonus++; }); c.log(`${c.p.label} 山崎C：ステージ疲労-1 / 次パフォーマンスAppeal+1`); },
  },
};
export function skillFor(id: number, player?: import('./types').Player): Skill {
  const skill = SKILLS[byId(id).skill]; if (!skill) throw new Error(`未登録スキル: ${byId(id).skill}`); return analysisSkill(player,id,skill);
}
