import { expect,it } from 'vitest';
import { IDOLS } from '../data/idols';
import { SKILLS,skillFor } from '../game/skills';
import { SKILL_COMPONENTS,setAnalysisSkillMasks,skillEnabled } from '../game/analysis-skills';
import { createGame,preview,clonePlayer,createCpuPreview } from '../game/engine';
import { autoEnabled,byId,setFormation } from '../game/formation';
import { applyBurst,checkBurstConditions } from '../game/burst';
import { finishPerformance } from '../game/performance';
import { songById } from '../data/songs';
const game=(ids:number[],id:number,kind:'AUTO'|'BURST'|'CENTER'|'ALL')=>createGame(ids,ids,['A','B','C'],['D','E','F'],'local',()=>.5,{configureAnalysisPlayers:p=>setAnalysisSkillMasks(p,[{id,kind}])});
it('全SkillプロパティがA/B/Cまたは共有免疫に分類され、全48枚ALLで能力を除外する',()=>{
 const classified=new Set([...Object.values(SKILL_COMPONENTS).flat(),'immuneAppeal']);
 for(const c of IDOLS){expect(Object.keys(SKILLS[c.skill]).filter(k=>!classified.has(k as never))).toEqual([]);
  const ids=[c.id,...IDOLS.filter(x=>x.id!==c.id).slice(0,7).map(x=>x.id)],g=game(ids,c.id,'ALL'),masked=skillFor(c.id,g.p1);
  expect(Object.keys(masked)).toEqual(['burst']);expect(skillFor(c.id,g.p2)).toBe(SKILLS[c.skill]);expect(byId(c.id)).toBe(c);
 }
});
it('Matono AUTO/CENTER/BURSTを独立除外し相手同カードとclone/public/CPU projectionを保護する',()=>{
 const g=game([7,1,2,3,4,5,6,8],7,'AUTO');
 expect(autoEnabled(g.p1,g.p2,7)).toBe(false);expect(autoEnabled(g.p2,g.p1,7)).toBe(true);
 expect(skillFor(7,g.p1).disableOpponentCenter).toBe(true);expect(skillFor(7,g.p1).reactToOpponentBurst).toBe(true);
 expect(skillEnabled(clonePlayer(g.p1),7,'AUTO')).toBe(false);expect(skillEnabled(g.publicPlayers![0],7,'AUTO')).toBe(false);
 const p=createCpuPreview(g)().players[0];expect(skillEnabled(p,7,'AUTO')).toBe(false);
});
it('AUTO startを初期状態作成前から除外し、BACKSチャージ消費・加算を本人だけ止める',()=>{
 const g=game([41,1,2,3,4,32,5,6],41,'AUTO');expect(g.p1.states[41].addedAttributes).toEqual([]);expect(g.p2.states[41].addedAttributes).not.toEqual([]);
 setAnalysisSkillMasks(g.p1,[{id:32,kind:'AUTO'}]);finishPerformance(g.p1,g.p2,g.roundSong);finishPerformance(g.p2,g.p1,g.roundSong);
 expect(g.p1.states[32].charge).toBe(0);expect(g.p2.states[32].charge).toBe(1);
});
it('B除外は通常条件と反応を止め、他人による強制BURSTの共通疲労リセット・回数を保持する',()=>{
 const g=game([8,1,2,3,4,5,6,9],8,'BURST');g.p1.winsStreak=1;
 expect(checkBurstConditions(g,g.p1,g.p2,'win')).not.toContain(8);g.p1.states[8].fatigue=5;g.p1.points=3;
 applyBurst(g,g.p1,g.p2,8,true,()=>.5);expect(g.p1.states[8]).toMatchObject({fatigue:0,burstCount:1,forcedBurstCount:1,burstSelfAppeal:0});
 applyBurst(g,g.p2,g.p1,8,true,()=>.5);expect(g.p2.states[8].burstSelfAppeal).toBe(0); // opponent has zero points
 expect(skillFor(8,g.p1).autoAppeal).toBe(skillFor(8).autoAppeal);
});
it('PLAIN CENTERを除外し同カード相手のPLAINは保持する',()=>{
 const g=game([36,1,2,3,4,5,6,8],36,'CENTER'),r=preview(g);
 expect(r.players[0].ids.every(id=>r.players[0].states[id].plain)).toBe(true);
 expect(r.players[1].ids.every(id=>!r.players[1].states[id].plain)).toBe(true);
 expect(skillFor(36,g.p1).autoEffects).toBe(skillFor(36).autoEffects);
});
it('強制BURSTで発動した大園のB倍化だけを除外しA免疫を維持する',()=>{
 const id=IDOLS.find(c=>c.skill==='ozono')!.id;const g=game([id,1,2,3,4,5,6,8],id,'BURST');applyBurst(g,g.p1,g.p2,id,true,()=>.5);
 // Retained A permits the +1 song; disabling B removes only its doubling.
 const r=preview({...g,roundSong:songById('A')});expect(r.p1.members.find(m=>m.id===id)!.skillGain).toBe(1);
 expect(skillFor(id,g.p1).selfAutoShield).toBe(true);expect(skillFor(id,g.p1).doubleBurstGains).toBeUndefined();
});
it('上村のBURST拡張と山下葉留花の楽曲倍化もB除外で止まる',()=>{
 const g=game([33,45,1,2,3,4,5,6],33,'BURST');g.p2.states[45].permBonus=2;g.p1.states[33].burstActive=true;
 const ctx={p:g.p1,opp:g.p2,id:33,song:g.roundSong,log:()=>{},random:()=>.5,target:()=>0,burst:()=>{}};
 expect(skillFor(33,g.p1).autoEffects!(ctx)).toHaveLength(0); // opposing base 3 is below threshold
 const own=clonePlayer(g.p1);setAnalysisSkillMasks(own,[]);const normal=skillFor(33).autoEffects!({...ctx,p:own});expect(normal.length).toBeGreaterThan(0);
 setAnalysisSkillMasks(g.p1,[{id:45,kind:'BURST'}]);g.p1.states[45].burstActive=true;
 const r=preview({...g,roundSong:{...songById('A'),type:'ユーモア'}});const gain=r.p1.members.find(m=>m.id===45)!.breakdown!.filter(x=>x.kind==='曲').reduce((n,x)=>n+x.amount,0);expect(gain).toBe(1);
});
