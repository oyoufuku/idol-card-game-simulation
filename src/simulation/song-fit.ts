import type {Idol,Song} from '../game/types';
import {abilitySemantics} from './ability-semantics';
// Effect-aware construction. Enemy rosters and historical outcomes are not inputs.
export function songFit(song:Song,cards:Idol[],theme:string,profile?:number) {
 let score=0,supportsTheme=false;const reasons:string[]=[];
 const add=(n:number,why:string,support=false)=>{score+=n;reasons.push(`${why} (${n>=0?'+':''}${n})`);supportsTheme||=support;};
 const counts=(a:string)=>cards.filter(c=>c.attr===a).length,attrs=new Set(cards.map(c=>c.attr)),burst=cards.filter(c=>abilitySemantics(c).ownBurst).length;
 if(song.rule==='attribute')add(counts(song.type),`自軍${song.type}${counts(song.type)}人へ+1。相手にも同じ条件`,theme==='クール'&&song.type==='クール');
 if(song.rule==='nonCute')add(counts('キュート')-4,`両軍の非キュートを減算。自軍候補${8-counts('キュート')}人が対象`);
 if(song.rule==='nonHumorFatigue')add(counts('ユーモア')-4,`両軍の非ユーモアへ疲労。自軍候補${8-counts('ユーモア')}人が対象`);
 if(song.rule==='nonHumorFatigue'&&theme==='疲労付与')add(10,'相手非ユーモアへの疲労付与を利用。自軍も対象',true);
 if(theme==='疲労付与'&&['recoverAll','fatigueRelief'].includes(song.rule))add(-12,'相手への疲労攻撃・ペナルティの勝ち筋を軽減する');
 if(song.rule==='highBase')add(4-cards.filter(c=>c.base>=4).length,'両軍の高基礎値を減算。自軍対象人数で評価');
 if(song.rule==='allAttributes'||song.rule==='missingAttributes')add(attrs.size===3?5:-10,'ステージ3属性条件。8人の属性構成から成立可能性を評価',theme==='多属性');
 if(song.rule==='attributeCount')add(cards.filter(c=>abilitySemantics(c).multiAttribute).length,'属性保有数比較の対策効果。自軍の属性追加/参照能力との連携',theme==='多属性');
 if(song.rule==='middleBonus')add(2,'MIDDLEの位置加算。固定タグによるチャージ加点はしない');
 if(song.rule==='samePosition')add(theme==='フォーメーション移動'?-8:1,'同じ位置の維持が条件。移動の利用効果とは区別');
 if(song.rule==='entry')add(theme==='フォーメーション移動'?18:theme==='チャージ'?12:cards.filter(c=>abilitySemantics(c).ownMovement).length,'BACKSからの登場を実際に支援（R1不発）',theme==='フォーメーション移動'||theme==='チャージ');
 if(song.rule==='moved')add(theme==='フォーメーション移動'?-14:theme==='疲労回復'?-8:0,'両軍の移動メンバーに疲労+2。移動利用の支援曲ではない');
 if(song.rule==='recoverAll')add(theme==='疲労回復'?18:theme==='チャージ'?12:2,'両軍8人の疲労回復。敵の高疲労も軽減する',theme==='疲労回復'||theme==='チャージ');
 if(song.rule==='fatigueRelief')add(theme==='疲労回復'?12:theme==='チャージ'?8:2,'疲労ペナルティを軽減。疲労値そのものは減らさない',theme==='疲労回復'||theme==='チャージ');
 if(song.rule==='doubleFatigue')add(theme==='疲労回復'?-12:theme==='疲労付与'?12:0,'疲労ペナルティを倍化。回復タグに関係なく高疲労への対策',theme==='疲労付与');
 if(song.rule==='doubleCurrentFatigue')add(theme==='疲労付与'?18:theme==='疲労回復'?-20:0,'両軍の現在疲労を倍化。自軍も対象',theme==='疲労付与');
 if(song.rule==='moved'&&theme==='疲労付与')add(12,'相手移動への疲労付与を利用。自軍移動も罰する',true);
 if(song.rule==='burstPenalty')add(theme==='バースト'?-12:theme==='対スキル'?12:0,'BURST中への減算は対BURST。自軍BURST利用とは逆',theme==='対スキル');
 if(song.rule==='cancelBurst')add(theme==='バースト'?-100:theme==='対スキル'?14-burst*2:0,'両軍BURST継続効果を解除。即時効果は残る対策曲',theme==='対スキル');
 if(song.rule==='disableCenter')add(theme==='対スキル'?18-Math.min(6,cards.filter(c=>c.C).length):0,'両軍CENTERを無効。自軍CENTER連携も失う対策曲',theme==='対スキル');
 if(song.rule==='sameFatigue')add(cards.filter(c=>abilitySemantics(c).ownRecovery).length,'同一疲労の最大グループ人数比較。疲労付与タグだけで加点しない');
 if(song.rule==='losing')add(1,'負けている側を支援。テーマ専用効果ではない');
 if(theme==='クール'&&song.rule==='attribute'&&song.type==='クール')add(12,'自軍クール構成の得点を支援',true);
 if(theme==='多属性'&&['allAttributes','missingAttributes','attributeCount'].includes(song.rule))add(12,'3属性利用・属性保有数の戦術に一致',true);
 if(theme==='対単一属性'){
  if(song.rule==='majority')add(profile===1?4:24,'単独最多属性を減算する対策。自軍にも適用',true);
  if(song.rule==='disableCenter')add(profile===1?10:18,'相手CENTER連携への対策。自軍も無効',true);
  if(profile===1&&['missingAttributes','allAttributes','attributeCount'].includes(song.rule))add(song.rule==='attributeCount'?22:14,'PLAIN/属性追加profileの勝ち筋を支援',true);
  if(song.rule==='majority'&&cards.some(c=>/PLAIN/.test(c.C||'')))add(-12,'相手PLAIN中は最多属性減算が不発');
  if(song.rule==='attribute'&&song.type==='クール')add(-20,'対クールでは相手側も加算されやすい');
 }
 if(cards.some(c=>c.Bcond.includes(`${song.type}楽曲`)))add(3,'実際のBURST条件の楽曲属性に一致');
 if(cards.some(c=>/キュートのみに上書き/.test(c.B))&&['allAttributes','missingAttributes','attributeCount'].includes(song.rule))add(-6,'キュートのみ上書きBURSTは多属性曲と競合');
 return {score,reasons,supportsTheme};
}
