import { IDOLS } from '../data/idols';
import type { Idol } from '../game/types';
export const CHARGE_CORE_NAMES=['渡邉美穂','渡辺莉奈','平尾帆夏'] as const;
export function chargeCore():Idol[] {
 return CHARGE_CORE_NAMES.map(name=>{const card=IDOLS.find(c=>c.name===name);if(!card)throw new Error(`チャージコアがありません：${name}`);return card;});
}
export function chargeSupportPolicy(card:Idol) {
 const exception=card.name==='竹内希来里',excluded:string[]=[],deprioritized:string[]=[];
 if(!exception){
  if(/自身がBACKS|BACKSにいる間|BACKSにいる場合/.test(card.A))excluded.push('BACKS配置をAUTO条件に含む');
  if(/BACKSからステージ|BACKS→ステージ/.test(card.A+card.Bcond+(card.C||'')))excluded.push('BACKSからの登場が主要条件');
  if(/BACKSで|BACKSとして|BACKS3人|同じ3人をBACKS/.test(card.Bcond)&&!/相手.*BACKS/.test(card.Bcond))excluded.push('自軍BACKS配置をBURST条件に含む');
 }
 if(/ポジション種別.*種類|CENTER・FRONT・MIDDLE.*3種類/.test(card.A+card.Bcond))deprioritized.push('多種類のポジション経験が必要');
 if(/FRONT-LとFRONT-Rの両方/.test(card.Bcond))deprioritized.push('FRONT左右の両方の経験が必要');
 return {exception,excluded,deprioritized};
}
