import type { Idol } from '../game/types';
// Construction-only semantics: clause subjects/targets and actual ability text.
// Tags suggest themes; they never override an opposite target or a counter ability.
function computeAbilitySemantics(c:Idol) {
 const effects=[c.A,c.B,c.C||''].flatMap(t=>t.split('。')).filter(Boolean);
 const ownBurst=effects.some(t=>/(?:自チーム|自身|味方|両チーム).*累計BURST|(?:自分以外|自身以外|味方).*強制(?:BURST|バースト)|(?:自身|味方).*通常BURST使用済み.*リセット|BURST中[、の]*(?:自身|味方)|両チーム.*BURST中.*合計.*自身.*プラス/.test(t));
 const burstEngine=ownBurst&&effects.some(t=>/累計BURST|強制BURST|強制バースト|通常BURST使用済み.*リセット|BURST中の味方/.test(t));
 const enemyFatigue=[...effects,c.Bcond].some(t=>/(?:相手|対面|両チーム)[^。]*疲労[^。]*(?:\+\d|増や|増加|倍|以上)|疲労[^。]*(?:以上)[^。]*相手/.test(t));
 const ownRecovery=[...effects,c.Bcond].some(t=>/(?:自身|味方|自チーム|シンメ)[^。]*疲労[^。]*(?:-\d|減ら|減少|入れ替|以下|0～2|受けず)/.test(t));
 const ownMovement=[c.A,c.Bcond,c.C||''].some(t=>/(?:自身|味方|自チーム)[^。]*移動|自身.*ポジション種別|自身.*異なる.*シンメ/.test(t));
 const ownFixed=[c.A,c.C||''].some(t=>/前ラウンドと同じポジション|ポジションを連続で維持|自身がBACKSにいる間/.test(t))&&!ownMovement;
 const counterBurst=[c.A,c.B,c.C||'',c.Bcond].some(t=>/(?:相手|対面).*BURST|BURST中の相手/.test(t));
 const antiSkill=[...effects,c.Bcond].some(t=>/(?:相手|対面).*AUTOを無効|相手CENTER.*CENTER SKILLを無効|相手.*BURST.*(?:開始|中)|相手由来.*(?:受けない|減少を受けない)|相手AUTO.*受けない|相手側.*軽減|自身はスキル.*受けない|相手または楽曲由来.*受けない|相手・楽曲由来.*受けない/.test(t));
 const negativeProtection=effects.some(t=>/相手または楽曲由来のマイナス効果を受けない|相手・楽曲由来のAppeal減少.*疲労付与.*ポジションボーナス無効.*属性変更を受けない/.test(t));
 const partyProtection=negativeProtection&&effects.some(t=>/自身のAUTO.*(?:効果|対象).*味方ステージ5人/.test(t));
 const ownCool=[...effects,c.Bcond].filter(t=>!/クールとユーモア|クール・キュート・ユーモア|クールまたはユーモア/.test(t)).some(t=>/自チーム.*クール|味方CENTER.*クール|クール楽曲|楽曲属性がクール|シンメがクール/.test(t)&&!/クール以外|クールではない/.test(t));
 const multiAttribute=[...effects,c.Bcond].some(t=>/(?:自身|味方|自チーム|本来).*属性.*追加|自身.*としても扱|自チーム.*属性種類数|自チーム.*属性種類数|自チーム.*属性.*種類数|自チーム.*クールとユーモア|(?:自身|自チーム).*ポジション.*クール.*キュート.*ユーモア|登場済みの楽曲属性の種類数|3属性の楽曲|BACKS3人の属性がすべて異なる|3枠にクール・キュート・ユーモア/.test(t));
 const enemyAttributes=[...effects,c.Bcond].some(t=>/相手.*(?:単独最多属性|同一属性|属性の種類数|クール|属性をPLAIN|属性.*変更|クールとしても扱う)/.test(t));
 const chargeSupport=/BACKS.*味方.*チャージ|BACKSにいる味方.*チャージ|自身のチャージ/.test(c.A);
 return {ownBurst,burstEngine,enemyFatigue,ownRecovery,ownMovement,ownFixed,antiSkill,negativeProtection,partyProtection,counterBurst,ownCool,multiAttribute,enemyAttributes,chargeSupport};
}
// Cache parsed text, not IDs: synthetic/edited card objects invalidate on any
// relevant text change. This does not change construction scores or RNG calls.
const semanticCache=new WeakMap<Idol,{A:string;B:string;C:string|null;Bcond:string;value:ReturnType<typeof computeAbilitySemantics>}>();
export function abilitySemantics(c:Idol){
 const cached=semanticCache.get(c);
 if(cached&&cached.A===c.A&&cached.B===c.B&&cached.C===c.C&&cached.Bcond===c.Bcond)return cached.value;
 const value=Object.freeze(computeAbilitySemantics(c));semanticCache.set(c,{A:c.A,B:c.B,C:c.C,Bcond:c.Bcond,value});return value;
}
export function usesTheme(c:Idol,tag:string){const s=abilitySemantics(c);return tag==='クール'?s.ownCool:tag==='バースト'?s.ownBurst:tag==='疲労付与'?s.enemyFatigue:tag==='疲労回復'?s.ownRecovery:tag==='フォーメーション移動'?s.ownMovement:tag==='多属性'?s.multiAttribute:tag==='対スキル'?s.antiSkill:tag==='チャージ'?s.chargeSupport:false;}

// Historical generator only: keep its published seed/digest compatible.
export function legacyOwnCool(c:Idol){return [c.A,c.B,c.C||'',c.Bcond].flatMap(t=>t.split('。')).some(t=>/自チーム.*クール|味方CENTER.*クール|クール楽曲|楽曲属性がクール|シンメがクール/.test(t)&&!/クール以外|クールではない/.test(t));}
