import { skillEnabled } from './analysis-skills';
import { SLOTS, type Player, type Song, type Slot, type TeamAppeal, type AppealEffect, type AppealContribution } from './types';
import { autoEnabled, byId, hasAttr, idsBack, POSITION_BONUS, posOf, oppositeId, attributesOf, baseAppeal, dominantAttribute, positionKind } from './formation';
import { skillFor } from './skills';
import { calculationContext } from './context';
import { fatiguePenalty } from './fatigue';
import type { EffectRecorder } from './effects';
export function resolveCenterSkills(p1: Player, p2: Player, song: Song): [boolean, boolean] {
  const eligible = (p: Player) => !!byId(p.formation.CENTER).C && skillEnabled(p,p.formation.CENTER,'CENTER') && (song.rule !== 'disableCenter' || !!skillFor(p.formation.CENTER,p).centerSongImmune);
  let e1 = eligible(p1), e2 = eligible(p2);
  const d1 = skillFor(p1.formation.CENTER,p1).disableOpponentCenter, d2 = skillFor(p2.formation.CENTER,p2).disableOpponentCenter;
  if (e1 && d1 && !p2.states[p2.formation.CENTER].shield) e2 = false;
  if (e2 && d2 && !p1.states[p1.formation.CENTER].shield) e1 = false;
  if (d1 && d2 && song.rule !== 'disableCenter'&&!p1.states[p1.formation.CENTER].shield&&!p2.states[p2.formation.CENTER].shield) { e1 = false; e2 = false; }
  return [e1, e2];
}
export function songAppealEffects(p:Player,opp:Player,song:Song):AppealEffect[] {
  const collected:AppealEffect[]=[];
    // Song-wide values do not change while collecting this team's modifiers.
    const allAttrs = song.rule==='missingAttributes'||song.rule==='allAttributes' ? new Set(SLOTS.flatMap(slot => attributesOf(p, p.formation[slot]))) : undefined;
    const dominant=song.rule==='majority'?dominantAttribute(p):null;
    for (const slot of SLOTS) {
      const id = p.formation[slot]; let n = 0;
      if (song.rule === 'attribute' && hasAttr(p, id, song.type)) n = 1;
      if (song.rule === 'nonCute' && !hasAttr(p, id, 'キュート')) n = -1;
      if (song.rule === 'losing' && p.points < opp.points) n = 1;
      if (song.rule === 'entry' && p.enteredThisRoundIds.includes(id)) n = 1;
      if (song.rule === 'nonBurst' && !p.states[id].burstActive) n = -1;
      if (song.rule === 'burstPenalty' && p.states[id].burstActive) n = -1;
      if (song.rule === 'missingAttributes' && allAttrs!.size < 3) n = -1;
      if (song.rule === 'coolFront' && (slot === 'CENTER' || slot.startsWith('FRONT')) && hasAttr(p, id, 'クール')) n = 2;
      if (song.rule === 'samePosition' && p.round>1 && slot===p.states[id].prevPos) n=1;
      if (song.rule === 'highBase' && baseAppeal(p,id)>=4) n=-2;
      if (song.rule === 'attributeCount' && slot==='CENTER' && SLOTS.reduce((n,s)=>n+attributesOf(p,p.formation[s]).length,0)<SLOTS.reduce((n,s)=>n+attributesOf(opp,opp.formation[s]).length,0)) n=-3;
      if (song.rule === 'majority' && dominant && hasAttr(p,id,dominant)) n=-1;
      if (song.rule === 'allAttributes' && allAttrs!.size===3) n=1;
      if (song.rule === 'sameFatigue' && slot==='CENTER') {
        const group=(t:Player)=>Math.max(...SLOTS.map(s=>SLOTS.filter(q=>t.states[t.formation[q]].fatigue===t.states[t.formation[s]].fatigue).length));
        if(group(p)>group(opp))n=3;
      }
      if (n) collected.push({id,amount:n});
    }
  return collected;
}
type Kind = 'A' | 'B' | 'C' | '曲';
interface Modifier { owner: Player; target: Player; actor: number; id: number; amount: number; kind: Kind; label: string }
function ignoreExplanation() {}
export function calcBoth(p1: Player, p2: Player, song: Song, detailed = true, effects?:EffectRecorder): { p1: TeamAppeal; p2: TeamAppeal } {
  const enabled = resolveCenterSkills(p1, p2, song), mods: Modifier[] = [];
  const add = (p: Player, opp: Player, actor: number, kind: Kind, effects: AppealEffect[], label = `${byId(actor).name}${kind}`) => effects.forEach(e => { if (e.amount) mods.push({ owner: p, target: e.opponent ? opp : p, actor, id: e.id, amount: e.amount, kind, label }); });
  for (const [index, p, opp] of [[0, p1, p2], [1, p2, p1]] as const) {
    for (const id of p.ids) {
      const st = p.states[id], skill = skillFor(id,p), ctx = calculationContext(p, opp, id, song), stage = posOf(p, id) !== 'BACK';
      if (autoEnabled(p, opp, id)) {
        const n = stage ? skill.autoAppeal?.(ctx) : undefined;
        if (n) add(p, opp, id, 'A', [{ id, amount: n }]);
        add(p, opp, id, 'A', skill.autoEffects?.(ctx) || []);
      }
      if (st.burstActive) add(p, opp, id, 'B', skill.burstEffects?.(ctx) || []);
      if (st.burstSelfAppeal) add(p, opp, id, 'B', [{ id, amount: st.burstSelfAppeal }]);

      if (st.activeNextBonus) add(p, opp, id, 'C', [{ id, amount: st.activeNextBonus }], '山崎C引継ぎ');
      if (st.activeAutoCarry) add(p, opp, id, 'B', byId(id).skill === 'moriya' ? oppositeEffect(p, opp, id, -st.activeAutoCarry) : [{ id, amount: st.activeAutoCarry }], '前回AUTO引継ぎB');
      if (p.burstCoolBonus && hasAttr(p, id, 'クール')) add(p, opp, id, 'B', [{ id, amount: p.burstCoolBonus }], '村山B');
      if (st.burstDebuff) mods.push({ owner: opp, target: p, actor: -1, id, amount: st.burstDebuff, kind: 'B', label: '相手固定B' });
    }
    if (enabled[index]) {
      const id = p.formation.CENTER, skill = skillFor(id,p), ctx = calculationContext(p, opp, id, song);
      for (const target of p.ids) { const n = skill.centerAppeal?.(ctx, target); if (n) add(p, opp, id, 'C', [{ id: target, amount: n }]); }
      add(p, opp, id, 'C', skill.centerEffects?.(ctx) || []);
    }
    for(const effect of songAppealEffects(p,opp,song))add(p,opp,effect.id,'曲',[effect],song.name);
  }
  function adjusted(m: Modifier): { n: number; reason: string; blocker?:number; blocked?:number } {
    const p = m.target, opp = p === p1 ? p2 : p1, st = p.states[m.id], slot = posOf(p, m.id);
    if (slot === 'BACK') return { n: 0, reason: 'バックス' };
    if (m.amount<0&&(m.owner!==p||m.kind==='曲')&&st.negativeShield)return {n:0,reason:'村井Aマイナス効果無効'};
    if(m.amount<0&&m.owner!==p&&st.appealReductionShield)return {n:0,reason:'藤吉B相手Appeal減少無効'};
    if (m.owner !== p && st.shield) return { n: 0, reason: '相手効果無効' };
    const skill = skillFor(m.id,p);
    if (skill.immuneAppeal && (!st.burstActive || !skillEnabled(p,m.id,'BURST')) && autoEnabled(p, opp, m.id)) {st.autoTriggered=true;return { n: 0, reason: '大園A' };}
    const cEnabled = enabled[p === p1 ? 0 : 1];
    if (m.amount < 0 && m.kind === 'A' && m.owner !== p && cEnabled && skillFor(p.formation.CENTER,p).protectCoolFromAuto && hasAttr(p, m.id, 'クール')) {p.states[p.formation.CENTER].centerTriggered=true;return { n: 0, reason: '藤吉C' };}
    let n = m.amount,blocker:number|undefined,blocked=0;
    let reason = '';
    if (n < 0 && (m.owner !== p || m.kind === '曲') && (slot === 'CENTER' || slot.startsWith('FRONT'))) {
      const reduction = idsBack(p).reduce((sum, id) => sum + (autoEnabled(p, opp, id) ? skillFor(id,p).backCenterMitigation || 0 : 0), 0);
      if (reduction) { for(const id of idsBack(p))if(autoEnabled(p,opp,id)&&skillFor(id,p).backCenterMitigation)p.states[id].autoTriggered=true; n = Math.min(0, n + reduction); reason = '小島A軽減'; }
    }
    if (skill.immuneAppeal && skillEnabled(p,m.id,'BURST') && st.burstActive) { n *= 2; reason = [reason, '大園B×2'].filter(Boolean).join(' / '); }
    return { n, reason, ...(blocker===undefined?{}:{blocker,blocked}) };
  }
  // Snapshot resolved positive modifiers before copies; two copying AUTOs cannot recurse.
  const baseAutos = [...mods];
  for (const [p, opp] of [[p1, p2], [p2, p1]]) for (const id of p.ids) {
    if (!(skillFor(id,p).copyOppositeAuto||skillFor(id,p).copyOppositeGain) || !autoEnabled(p, opp, id)) continue;
    const t = oppositeId(p, opp, id); if (t == null) continue;
    let n=0;
    for(const m of baseAutos)if(m.target===opp&&m.id===t&&(!skillFor(id,p).copyOppositeAuto||(m.kind==='A'&&m.owner===opp&&m.actor===t)))n+=Math.max(0,adjusted(m).n);
    if (n) add(p, opp, id, 'A', [{ id, amount: n }], '藤吉Aコピー');
  }
  const resolved = mods.map(m => ({ ...m, ...adjusted(m) }));
  if(effects)for(const m of resolved){
    if(!m.n&&m.reason==='バックス')continue;
    // Carry/team modifiers retain the actual skill owner in the presentation.
    const origin=m.label==='山崎C引継ぎ'?m.owner.ids.find(id=>byId(id).skill==='yamasaki'):m.label==='村山B'?m.owner.ids.find(id=>byId(id).skill==='murayama'):undefined;
    const source=m.kind==='曲'?effects.song('performance'):m.actor>0?{...effects.source(m.owner,origin??m.actor,m.kind,'performance'),label:m.label}:effects.fixedBurstSource(m.target,m.id)||{side:m.owner===p1?0 as const:1 as const,id:null,position:null,kind:m.kind,phase:'performance' as const,label:m.label};
    effects.emit(source,[effects.target(m.target,m.id,m.n?'Appeal':m.reason||'Appeal無効',m.n||undefined)]);
    if(m.blocker!==undefined)effects.emit(effects.source(m.target===p1?p2:p1,m.blocker,'B','performance'),[effects.target(m.target,m.id,'AUTO上昇抑制',m.blocked)]);
    if(m.reason==='大園A')effects.emit(effects.source(m.target,m.id,'A','performance'),[effects.target(m.target,m.id,'Appeal変化無効')]);
    if(m.reason==='藤吉C')effects.emit(effects.source(m.target,m.target.formation.CENTER,'C','performance'),[effects.target(m.target,m.id,'AUTO減少無効')]);
    if(m.reason.includes('小島A'))for(const id of idsBack(m.target))if(autoEnabled(m.target,m.target===p1?p2:p1,id)&&skillFor(id,m.target).backCenterMitigation)effects.emit(effects.source(m.target,id,'A','performance'),[effects.target(m.target,m.id,'Appeal減少軽減')]);
    if(m.reason.includes('大園B'))effects.emit(effects.source(m.target,m.id,'B','performance'),[effects.target(m.target,m.id,'数値変化×2')]);
  }
  for(const m of resolved)if(m.n&&m.actor>0){if(m.kind==='A')m.owner.states[m.actor].autoTriggered=true;if(m.kind==='C'&&m.actor===m.owner.formation.CENTER&&m.label!=='山崎C引継ぎ')m.owner.states[m.actor].centerTriggered=true;}

  // Index once, preserving modifier order and separate identities for P1/P2
  // even when both teams use the same idol. Keep the individual modifiers for
  // the UI's explanations; numerical telemetry uses the same resolved values.
  type Resolved = typeof resolved[number];
  interface Totals { modifiers:Resolved[];skillGain:number;skillReduction:number;autoGain:number;autoDebuff:number }
  const totals:[Record<number,Totals>,Record<number,Totals>]=[{},{}];
  for(const [side,p] of [[0,p1],[1,p2]] as const)for(const id of p.ids)totals[side][id]={modifiers:[],skillGain:0,skillReduction:0,autoGain:0,autoDebuff:0};
  for(const m of resolved){
    const target=totals[m.target===p1?0:1][m.id];
    target.modifiers.push(m);target.skillGain+=Math.max(0,m.n);target.skillReduction+=Math.max(0,-m.n);
    if(m.kind==='A'&&m.actor>0){const own=totals[m.owner===p1?0:1][m.actor];
      if(m.target===m.owner&&m.id===m.actor)own.autoGain+=Math.max(0,m.n);
      if(m.target!==m.owner)own.autoDebuff+=Math.max(0,-m.n);
    }
  }

  function contribution(owner:Player|undefined,id:number|undefined,kind:AppealContribution['kind'],amount:number,effect:string,name?:string,reason?:string):AppealContribution {
    return {side:owner===p1?0:owner===p2?1:null,...(id===undefined?{}:{sourceId:id}),sourceName:name??(id===undefined?'':byId(id).name),kind,amount,effect,...(reason?{reason}:{})};
  }
  function skillText(id:number,kind:Kind) {const c=byId(id);return kind==='A'?c.A:kind==='B'?c.B:kind==='C'?c.C||'CENTER SKILLなし':song.effect;}
  function team(p: Player, opp: Player): TeamAppeal {
    const centerId=p.formation.CENTER,centerSkill=skillFor(centerId,p),cEnabled=enabled[p===p1?0:1],ctx=calculationContext(p,opp,centerId,song);
    const centerPositionBonus=cEnabled?centerSkill.centerPositionBonus?.(ctx)||0:0;
    const members = SLOTS.map(slot => {
      const id = p.formation[slot], st = p.states[id],breakdown:AppealContribution[]|undefined=detailed?[]:undefined;
      const explain=detailed?(owner:Player|undefined,source:number|undefined,kind:AppealContribution['kind'],amount:number,effect:string,name?:string,reason?:string)=>{breakdown!.push(contribution(owner,source,kind,amount,effect,name,reason));}:ignoreExplanation;
      explain(undefined,undefined,'基礎',byId(id).base,'カードに記載された基礎Appeal','基礎Appeal');
      if(st.permBonus)explain(p,id,'B',st.permBonus,byId(id).B,undefined,'永続補正の累計');
      if(st.baseAdjustment)explain(opp,opp.formation.CENTER,'C',st.baseAdjustment,byId(opp.formation.CENTER).C||'基礎Appeal補正');
      explain(undefined,undefined,'位置',POSITION_BONUS[slot],`${slot}の基本ポジションボーナス`,'ポジション');
      let position=POSITION_BONUS[slot];
      if(song.rule==='middleBonus'&&slot.startsWith('MIDDLE')){const bonus=2;position+=bonus;explain(undefined,undefined,'曲',bonus,song.effect,song.name);if(effects)effects.emit(effects.song('performance'),[effects.target(p,id,'位置ボーナス',bonus)]);}
      if(cEnabled){const bonus=centerPositionBonus;position+=bonus;if(bonus)explain(p,centerId,'C',bonus,skillText(centerId,'C'));if(effects&&bonus)effects.emit(effects.source(p,centerId,'C','performance'),[effects.target(p,id,'位置ボーナス',bonus)]);}
      for(const source of p.ids)if(p.states[source].burstActive){const before=position;position*=skillFor(source,p).positionTeamMultiplier||1;if(position!==before)explain(p,source,'B',position-before,skillText(source,'B'));if(effects&&position!==before)effects.emit(effects.source(p,source,'B','performance'),[effects.target(p,id,'位置ボーナス',position-before)]);}
      const facing=oppositeId(p,opp,id)!;
      if(!st.shield&&!st.negativeShield && (opp.ids.some(i=>opp.states[i].burstActive&&skillFor(i,opp).cancelEnemyPositions)|| (autoEnabled(opp,p,facing)&&skillFor(facing,opp).cancelOppositePosition)||(slot.startsWith('FRONT')&&opp.ids.some(i=>opp.states[i].burstActive&&skillFor(i,opp).cancelEnemyFront)))){
        const cancellationAuto=autoEnabled(opp,p,facing)&&skillFor(facing,opp).cancelOppositePosition,canceller=cancellationAuto?facing:opp.ids.find(i=>opp.states[i].burstActive&&(skillFor(i,opp).cancelEnemyPositions||skillFor(i,opp).cancelEnemyFront))!;
        explain(opp,canceller,cancellationAuto?'A':'B',-position,skillText(canceller,cancellationAuto?'A':'B'),undefined,'ポジションボーナス無効');
        if(effects){const auto=autoEnabled(opp,p,facing)&&skillFor(facing,opp).cancelOppositePosition,source=auto?facing:opp.ids.find(i=>opp.states[i].burstActive&&(skillFor(i,opp).cancelEnemyPositions||skillFor(i,opp).cancelEnemyFront))!;effects.emit(effects.source(opp,source,auto?'A':'B','performance'),[effects.target(p,id,'位置ボーナス無効',position?-position:undefined)]);}
        position=0;if(autoEnabled(opp,p,facing)&&skillFor(facing,opp).cancelOppositePosition)opp.states[facing].autoTriggered=true;
      }
      if(autoEnabled(p,opp,id)){const before=position;position*=skillFor(id,p).positionMultiplier||1;if(position!==before)explain(p,id,'A',position-before,skillText(id,'A'));if(effects&&position!==before)effects.emit(effects.source(p,id,'A','performance'),[effects.target(p,id,'位置ボーナス',position-before)]);}
      let value = baseAppeal(p,id) + position;
      const details = [`基礎${baseAppeal(p,id)}`, `位置+${position}`];
      if(cEnabled&&(centerSkill.plainCenter||centerSkill.baseEnemyCenter||centerSkill.disableOpponentCenter||centerPositionBonus>0))p.states[centerId].centerTriggered=true;
      if(autoEnabled(p,opp,id)&&(skillFor(id,p).positionMultiplier||skillFor(id,p).disableOppositeAuto))st.autoTriggered=true;
      if (!autoEnabled(p, opp, id)&&skillEnabled(p,id,'AUTO')){details.push('正面の的野によりAUTO無効');explain(opp,facing,'A',0,skillText(facing,'A'),undefined,'AUTO無効');if(effects)effects.emit(effects.source(opp,facing,'A','performance'),[effects.target(p,id,'AUTO無効')]);}
      const memberTotals=totals[p===p1?0:1][id];
      for (const m of memberTotals.modifiers) { value += m.n;
        if(detailed){
          const inherited=m.label==='山崎C引継ぎ'?m.owner.ids.find(source=>byId(source).skill==='yamasaki'):m.label==='村山B'?m.owner.ids.find(source=>byId(source).skill==='murayama'):undefined;
          const fixedSources=m.actor<0?[...new Set(st.burstDebuffSources?.map(source=>source.id)||[])]:[];
          const actor=m.actor>0?(inherited??m.actor):fixedSources.length===1?fixedSources[0]:undefined;
          explain(m.kind==='曲'?undefined:m.owner,m.kind==='曲'?undefined:actor,m.kind,m.n,fixedSources.length>1?fixedSources.map(source=>`${byId(source).name}：${byId(source).B}`).join('\n'):m.kind==='曲'?song.effect:actor===undefined?m.label:skillText(actor,m.kind),m.kind==='曲'?song.name:fixedSources.length>1?fixedSources.map(source=>byId(source).name).join(' / '):actor===undefined?m.label:undefined,m.reason||undefined);
        }
        if(detailed)details.push(`${m.label}${m.n >= 0 ? '+' : ''}${m.n}${m.reason ? `（${m.reason}）` : ''}`); }
      const multiplier = (song.rule === 'doubleFatigue'&&!st.negativeShield ? 2 : 1)*(autoEnabled(p,opp,id)?skillFor(id,p).positionMultiplier||1:1), before = Math.max(0, value), final = fatiguePenalty(before, st.fatigue, multiplier, song.rule==='fatigueRelief'?1:0);
      if(effects&&final!==before&&autoEnabled(p,opp,id)&&skillFor(id,p).positionMultiplier===2)effects.emit(effects.source(p,id,'A','performance'),[effects.target(p,id,'疲労ペナルティ×2')]);
      if(value<0)explain(undefined,undefined,'下限',-value,'Appealの下限は0','下限補正');
      if(final!==before)explain(undefined,undefined,'疲労',final-before,`疲労値${st.fatigue}によるペナルティ${multiplier!==1?`（倍率${multiplier}）`:''}${song.rule==='fatigueRelief'?'（青春の馬の軽減込み）':''}`,'疲労');
      if (final !== before) details.push(`疲労${st.fatigue}：${final - before}${multiplier === 2 ? '（桜月×2）' : ''}`);
      return { id, slot, val: final, details, ...(detailed?{breakdown}:{}),
        skillGain:memberTotals.skillGain,
        skillReduction:memberTotals.skillReduction+(before-final),
        autoGain:memberTotals.autoGain,
        autoDebuff:memberTotals.autoDebuff };
    });
    return { members, total: members.reduce((n, m) => n + m.val, 0), lines: detailed ? members.map(m => `${byId(m.id).name} [${m.slot}] = ${m.val} (${m.details.join(', ')})`) : [] };
  }
  return { p1: team(p1, p2), p2: team(p2, p1) };
}
function oppositeEffect(p: Player, opp: Player, id: number, amount: number): AppealEffect[] { const t = oppositeId(p, opp, id); return t == null ? [] : [{ id: t, amount, opponent: true }]; }
export function calcTeam(p: Player, opp: Player, _cEnabled: boolean, song: Song) { return calcBoth(p, opp, song).p1; }
export function appealFor(p: Player, opp: Player, id: number, slot: Slot, _cEnabled: boolean, song: Song) { const m = calcBoth(p, opp, song).p1.members.find(m => m.id === id && m.slot === slot); if (!m) throw new Error('ステージ配置と一致しません'); return m; }
