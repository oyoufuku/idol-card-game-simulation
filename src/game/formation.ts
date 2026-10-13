import { skillEnabled } from './analysis-skills';
import { IDOLS } from '../data/idols';
import { SLOTS, type Formation, type Player, type Position, type Slot, type Attribute } from './types';
export const POSITION_BONUS: Record<Slot, number> = { CENTER: 2, 'FRONT-L': 1, 'FRONT-R': 1, 'MIDDLE-L': 0, 'MIDDLE-R': 0 };
export const POSITION_FATIGUE: Record<Slot, number> = { CENTER: 3, 'FRONT-L': 2, 'FRONT-R': 2, 'MIDDLE-L': 1, 'MIDDLE-R': 1 };
const PAIRS: Partial<Record<Position, Slot>> = { 'FRONT-L': 'FRONT-R', 'FRONT-R': 'FRONT-L', 'MIDDLE-L': 'MIDDLE-R', 'MIDDLE-R': 'MIDDLE-L' };
const catalog = new Map(IDOLS.map(c=>[c.id,c]));
export function byId(id: number) { const card = catalog.get(id); if (!card) throw new Error(`未知のカード: ${id}`); return card; }
export const clamp0 = (x: number) => Math.max(0, x);
export const effectiveAttr = (p: Player, id: number) => p.cuteOnly?'キュート': p.states[id].attributeOverride || p.tempAttr || byId(id).attr;
export const attributesOf = (p: Player, id: number): Attribute[] => p.states[id].plain ? [] : p.cuteOnly?['キュート']: [...new Set([effectiveAttr(p, id), ...p.addedAttributes, ...p.states[id].addedAttributes])];
export const hasAttr = (p: Player, id: number, attr: Attribute) => !p.states[id].plain && (p.cuteOnly?attr==='キュート':(effectiveAttr(p,id)===attr||p.addedAttributes.includes(attr)||p.states[id].addedAttributes.includes(attr)));
export const oppositeId = (p: Player, opp: Player, id: number) => { const slot = posOf(p, id); return slot === 'BACK' ? null : opp.formation[slot]; };
// Disabling the opposing AUTO must not recurse when two Matono face each other.
export const autoEnabled = (p: Player, opp: Player, id: number) => {if(!skillEnabled(p,id,'AUTO'))return false;if(p.states[id].shield)return true;const facing=oppositeId(p,opp,id);return facing==null||byId(facing).skill!=='matono'||!skillEnabled(opp,facing,'AUTO');};
export const idsStage = (p: Player) => SLOTS.map(s => p.formation[s]);
export const idsBack = (p: Player) => {const f=p.formation;return p.ids.filter(id=>id!==f.CENTER&&id!==f['FRONT-L']&&id!==f['FRONT-R']&&id!==f['MIDDLE-L']&&id!==f['MIDDLE-R']);};
export const posOf = (p: Player, id: number): Position => {const f=p.formation;if(f.CENTER===id)return 'CENTER';if(f['FRONT-L']===id)return 'FRONT-L';if(f['FRONT-R']===id)return 'FRONT-R';if(f['MIDDLE-L']===id)return 'MIDDLE-L';if(f['MIDDLE-R']===id)return 'MIDDLE-R';return 'BACK';};
export const countAttr = (p: Player, attr: Attribute) => {let count=0;for(const slot of SLOTS)if(hasAttr(p,p.formation[slot],attr))count++;return count;};
export function symmeId(p: Player, id: number) { const pair = PAIRS[posOf(p, id)]; return pair ? p.formation[pair] : null; }
export const formationFromArray = (ids: number[]) => Object.fromEntries(SLOTS.map((s, i) => [s, ids[i]])) as Formation;
export function calcEnteredThisRoundIds(p: Player, formation: Formation, round: number) {
  return round === 1 ? [] : p.ids.filter(id => p.states[id].prevPos === 'BACK' && (formation.CENTER===id||formation['FRONT-L']===id||formation['FRONT-R']===id||formation['MIDDLE-L']===id||formation['MIDDLE-R']===id));
}
export function validateFormation(p: Player, f: Formation): string | null {
  const vals = SLOTS.map(s => f[s]);
  if (vals.some(id => !p.ids.includes(id))) return '編成外のアイドルが含まれています。';
  if (new Set(vals).size !== 5) return '同じアイドルを複数ポジションには置けません。';
  for (const id of p.ids) {
    const lock = p.states[id].lockedPos;
    if(!lock)continue;
    const next = SLOTS.find(s => f[s] === id) || 'BACK';
    if (next !== lock) return `${byId(id).name}は的野Bにより ${lock} に固定されています。`;
  }
  return null;
}
export function setFormation(p: Player, f: Formation, round: number) {
  p.enteredThisRoundIds = calcEnteredThisRoundIds(p, f, round);
  p.formation = { ...f };
  p.ids.forEach(id => { p.states[id].pos = posOf(p, id); });
}

export const positionKind = (pos: Position) => pos.split('-')[0];
export const baseAppeal = (p: Player, id: number) => byId(id).base + p.states[id].permBonus + p.states[id].baseAdjustment;
export const dominantAttribute = (p: Player): Attribute | null => {
  const counts = (['クール', 'キュート', 'ユーモア'] as const).map(a => [a, countAttr(p, a)] as const).sort((a,b)=>b[1]-a[1]);
  return counts[0][1] > counts[1][1] ? counts[0][0] : null;
};
