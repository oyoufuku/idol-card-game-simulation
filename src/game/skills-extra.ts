import { skillEnabled } from './analysis-skills';
import { increaseFatigue } from './fatigue';
import type { Context, Skill, AppealEffect } from './types';
import { autoEnabled, baseAppeal, clamp0, countAttr, dominantAttribute, hasAttr, byId, attributesOf, setFormation, validateFormation, idsBack, idsStage, oppositeId, posOf, positionKind, symmeId } from './formation';
const st = (c: Context) => c.p.states[c.id];
const opposite = (c: Context, amount: number): AppealEffect[] => { const id = oppositeId(c.p,c.opp,c.id); return id == null ? [] : [{id,amount,opponent:true}]; };
const pair = (c: Context, amount: number): AppealEffect[] => [c.id, symmeId(c.p,c.id)].filter((id): id is number=>id!==null).map(id=>({id,amount}));
const front = (c: Context, amount: number): AppealEffect[] => ['FRONT-L','FRONT-R'].map(s=>({id:c.opp.formation[s as 'FRONT-L'],amount,opponent:true}));
const sum = (p: Context['p']) => p.ids.reduce((n,id)=>n+p.states[id].fatigue,0);
const bursts = (p: Context['p']) => p.ids.reduce((n,id)=>n+p.states[id].burstCount,0);
const active = (c: Context) => [c.p,c.opp].reduce((n,p)=>n+p.ids.filter(id=>p.states[id].burstActive).length,0);
const restoreCharge: Skill = { chargeConsumer:true, burst:c=>{
 const slot=posOf(c.p,c.id),replacement=c.target('chargeBack');if(slot!=='BACK'&&idsBack(c.p).includes(replacement)){
  const f={...c.p.formation,[slot]:replacement};if(!validateFormation(c.p,f)){setFormation(c.p,f,c.p.round);c.log(`  B: ${byId(c.id).name}と${byId(replacement).name}を交換しBACKSへ移動`);}
 }
 st(c).charge=st(c).lastSpentCharge;
 }, condition:c=>st(c).spentCharge>=3 };
export const EXTRA_SKILLS: Record<string,Skill> = {
 kanemura: {
  autoAppeal:c=>c.p.round>1 && posOf(c.p,c.id)===st(c).prevPos ? st(c).samePositionStreak+1 : 0,
  condition:c=>Object.values(st(c).positionCounts).some(n=>n>=3),
  burst:()=>{}, positionTeamMultiplier:2,
  centerAppeal:(c,id)=>c.p.round>1 && posOf(c.p,id)===c.p.states[id].prevPos ? 1 : 0,
 },
 kosaka: {positionMultiplier:2,condition:c=>posOf(c.p,c.id)==='CENTER'&&st(c).fatigue>=6,burst:c=>{st(c).burstSelfAppeal+=3;},postFatigue:c=>{st(c).fatigue+=5*st(c).burstStacks;},centerPositionBonus:c=>st(c).fatigue<=2?1:0},
 takahashi: {autoAppeal:c=>countAttr(c.p,'クール')>=3?2:0,condition:c=>c.song.type==='クール'&&hasAttr(c.p,c.p.formation.CENTER,'クール'),burst:c=>{st(c).permBonus++;}},
 konishi: {autoEffects:c=>{const t=symmeId(c.p,c.id);return t!==null&&hasAttr(c.p,t,'クール')?pair(c,1):[];},condition:c=>st(c).symmetries.length>=3,burst:()=>{},burstEffects:c=>pair(c,2*st(c).burstStacks)},
 shogenji: {autoAppeal:c=>st(c).fatigue>=3?2:0,condition:c=>st(c).fatigueStreak>=3,burst:c=>{st(c).burstSelfAppeal+=3;},centerAppeal:(c,id)=>c.p.states[id].fatigue>=3?1:0},
 hiraoka: {autoAppeal:c=>new Set([...c.p.songHistory,c.song.type]).size,condition:c=>new Set(c.p.songHistory).size===3,burst:c=>{st(c).burstSelfAppeal+=3;}},
 miyata: {autoAppeal:c=>sum(c.p)<=10?2:0,condition:c=>c.p.round>=3&&sum(c.p)<=12,burst:()=>{},burstEffects:c=>idsStage(c.p).map(id=>({id,amount:st(c).burstStacks}))},
 watanabe_miho: {...restoreCharge,autoAppeal:c=>st(c).spentCharge},
 kamimura: {autoEffects:c=>{const t=oppositeId(c.p,c.opp,c.id);const targets=st(c).burstActive&&skillEnabled(c.p,c.id,'BURST')?idsStage(c.opp):(t==null?[]:[t]);return targets.filter(id=>baseAppeal(c.opp,id)>=4).map(id=>({id,amount:-2,opponent:true}));},condition:c=>idsStage(c.opp).filter(id=>baseAppeal(c.opp,id)>=4).length>=3,burst:()=>{},baseEnemyCenter:true,centerEffects:c=>c.opp.ids.map(id=>({id,amount:-1,opponent:true}))},
 ishizuka: {pre:c=>{const t=oppositeId(c.p,c.opp,c.id);if(posOf(c.p,c.id).startsWith('FRONT')&&t!==null&&!c.opp.states[t].shield&&!c.opp.states[t].negativeShield){increaseFatigue(c.opp,c.p,t,1);st(c).autoTriggered=true;}},condition:c=>['FRONT-L','FRONT-R'].reduce((n,p)=>n+(st(c).positionCounts[p]||0),0)>=2,burst:()=>{},cancelEnemyFront:true},
 shimizu: {autoEffects:c=>opposite(c,-new Set(idsStage(c.p).flatMap(id=>attributesOf(c.p,id))).size),condition:c=>idsBack(c.p).length===3&&new Set(idsBack(c.p).map(id=>attributesOf(c.p,id).sort().join('/'))).size===3&&idsBack(c.p).every(id=>attributesOf(c.p,id).length>0),burst:c=>{for(const id of c.p.ids)if(hasAttr(c.p,id,'クール')||hasAttr(c.p,id,'ユーモア'))c.p.states[id].shield=true;},burstPartyShield:true},
 fujishima: {autoEffects:c=>c.song.type==='キュート'?opposite(c,-2):[],condition:c=>st(c).cuteRounds>=2,burst:()=>{},burstEffects:c=>c.opp.ids.filter(id=>!hasAttr(c.opp,id,c.song.type)).map(id=>({id,amount:-st(c).burstStacks,opponent:true})),plainCenter:true},
 miyachi: {autoEffects:c=>c.p.round>1&&posOf(c.p,c.id)===st(c).prevPos?opposite(c,-(st(c).samePositionStreak+1)):[],condition:c=>Object.values(st(c).positionCounts).some(n=>n>=3),burst:()=>{},cancelEnemyPositions:true},
 watanabe_rina: {...restoreCharge,autoEffects:c=>[{id:c.opp.formation.CENTER,amount:-st(c).spentCharge,opponent:true}]},
 nibu: {autoEffects:c=>st(c).fatigue<=2?opposite(c,-1):[],condition:c=>st(c).freshStreak>=2,burst:()=>{},burstEffects:c=>front(c,-st(c).burstStacks),centerEffects:c=>sum(c.p)<sum(c.opp)?front(c,-2):[]},
 kawata: {autoEffects:c=>{const a=dominantAttribute(c.opp),t=oppositeId(c.p,c.opp,c.id);return a&&countAttr(c.opp,a)>=3&&t!==null&&hasAttr(c.opp,t,a)?opposite(c,-2):[];},condition:c=>{const a=dominantAttribute(c.opp);if(a&&countAttr(c.opp,a)>=4){st(c).matchedAttribute=a;return true;}return false;},burst:()=>{},burstEffects:c=>st(c).matchedAttribute?c.opp.ids.filter(id=>hasAttr(c.opp,id,st(c).matchedAttribute!)).map(id=>({id,amount:-st(c).burstStacks,opponent:true})):[],centerEffects:c=>{const a=dominantAttribute(c.opp),id=c.opp.formation.CENTER;return a&&countAttr(c.opp,a)>=3&&hasAttr(c.opp,id,a)?[{id,amount:-countAttr(c.opp,a),opponent:true}]:[];}},
 morimoto: {start:c=>{const a=c.random()<0.5?'クール':'キュート';st(c).matchedAttribute=a;st(c).addedAttributes.push(a);st(c).autoTriggered=true;},condition:c=>st(c).matchedAttribute===c.song.type,burst:c=>{st(c).burstSelfAppeal+=2;st(c).normalUsed=false;}},
 yamaguchi: {pre:c=>{
  const select=(p:Context['p'])=>{const max=Math.max(...p.ids.map(id=>p.states[id].fatigue)),ids=p.ids.filter(id=>p.states[id].fatigue===max);return ids[Math.floor(c.random()*ids.length)];};
  const own=select(c.p),enemy=select(c.opp),amount=st(c).burstActive&&skillEnabled(c.p,c.id,'BURST')?3:1;
  c.p.states[own].fatigue=clamp0(c.p.states[own].fatigue-amount);if(!c.opp.states[enemy].shield&&!c.opp.states[enemy].negativeShield)increaseFatigue(c.opp,c.p,enemy,amount);
 },condition:c=>Math.max(...c.p.ids.map(id=>c.p.states[id].fatigue))>=5,burst:()=>{},centerPre:c=>idsBack(c.opp).forEach(id=>{if(!c.opp.states[id].shield&&!c.opp.states[id].negativeShield)increaseFatigue(c.opp,c.p,id,3);})},
 takeuchi: {post:c=>{for(const id of idsBack(c.p)){const s=c.p.states[id];s.charge= Math.min(s.charge+1, [32,38,44].includes(id)?5:Infinity);}st(c).autoTriggered=true;},condition:c=>(c.p.backGroupStreak||0)>=2,burst:c=>{st(c).burstSelfAppeal+=3;}},
 hirao: {...restoreCharge,pre:c=>{const n=st(c).spentCharge;if(n){c.p.states[c.p.formation.CENTER].fatigue=clamp0(c.p.states[c.p.formation.CENTER].fatigue-n);const t=c.opp.states[c.opp.formation.CENTER];if(!t.shield&&!t.negativeShield)increaseFatigue(c.opp,c.p,c.opp.formation.CENTER,n);st(c).autoTriggered=true;}}},
 yamashita_haruka: {autoAppeal:c=>new Set([...st(c).positionKinds,positionKind(posOf(c.p,c.id))]).size,condition:c=>['CENTER','FRONT','MIDDLE'].every(p=>st(c).positionKinds.includes(p)),burst:()=>{},enemyPositionFatigueMultiplier:2,
 centerPre:c=>{if(c.p.round>1)idsStage(c.opp).filter(id=>positionKind(posOf(c.opp,id))!==positionKind(c.opp.states[id].prevPos)&&!c.opp.states[id].shield&&!c.opp.states[id].negativeShield).forEach(id=>increaseFatigue(c.opp,c.p,id,2));}},
 hamagishi: {autoAppeal:c=>c.p.round>1&&c.p.songHistory.at(-1)===c.song.type?2:0,condition:c=>st(c).repeatedSongAutos>=2,burst:c=>{c.game!.songOverride='S';}},
 tomita: {
  autoAppeal:c=>bursts(c.p)>bursts(c.opp)?2:0,
  condition:c=>idsStage(c.p).every(id=>c.p.states[id].burstCount>0),
  burst:c=>{
   const candidates=idsStage(c.p).filter(id=>id!==c.id&&!c.game?.burstSeen?.includes(`${c.p===c.game.p1?1:2}:${id}`));
   for(let n=0;n<2&&candidates.length;n++){
    const [target]=candidates.splice(Math.floor(c.random()*candidates.length),1);
    c.burst(target,true);
   }
  },
 },
 matsuda_konoka: {autoAppeal:c=>c.p.round>1&&active(c)<=1?3:0,condition:c=>c.p.noBurstStreak>=2,burst:c=>{const t=c.target('allyBurst');if(t&&t!==c.id&&c.p.states[t]&&!c.game?.burstSeen?.includes(`${c.p===c.game.p1?1:2}:${t}`))c.burst(t,true);},centerAppeal:(c,id)=>id===c.id&&active(c)===0?3:0},
};
