import type { Song } from '../game/types';
// Source: 案_48人22曲_Codex実装用_最終確定_20261011.xlsx / Codex用楽曲 (性能は前版と同一).
export const SONGS: Song[] = [
  {
    "id": "A",
    "name": "Start over!",
    "type": "クール",
    "tags": [
      "クール"
    ],
    "effect": "ステージのクールメンバーのAppealをそれぞれ+1する。",
    "rule": "attribute"
  },
  {
    "id": "B",
    "name": "夏の近道",
    "type": "キュート",
    "tags": [
      "キュート"
    ],
    "effect": "ステージのキュート属性を持たないメンバーのAppealをそれぞれ-1する。",
    "rule": "nonCute"
  },
  {
    "id": "C",
    "name": "Make or Break",
    "type": "ユーモア",
    "tags": [
      "ユーモア"
    ],
    "effect": "ステージのユーモア属性を持たないメンバーの疲労値をそれぞれ+1する。",
    "rule": "nonHumorFatigue"
  },
  {
    "id": "D",
    "name": "桜月",
    "type": "キュート",
    "tags": [
      "疲労回復"
    ],
    "effect": "疲労ペナルティによるAppeal減少量を2倍にする。",
    "rule": "doubleFatigue"
  },
  {
    "id": "E",
    "name": "何歳の頃に戻りたいのか？",
    "type": "クール",
    "tags": [
      "負けポイント"
    ],
    "effect": "ラウンド開始時点でポイントで負けているプレイヤー側のステージメンバーのAppealをそれぞれ+1する。",
    "rule": "losing"
  },
  {
    "id": "F",
    "name": "Unhappy birthday構文",
    "type": "ユーモア",
    "tags": [
      "フォーメーション移動"
    ],
    "effect": "そのラウンドにBACKSからステージへ移動したメンバーのAppealを+1する。R1の初期配置は移動に数えない。",
    "rule": "entry"
  },
  {
    "id": "G",
    "name": "ドローン旋回中",
    "type": "キュート",
    "tags": [
      "対バースト"
    ],
    "effect": "BURST中のステージメンバーのAppealを-1する。",
    "rule": "burstPenalty"
  },
  {
    "id": "H",
    "name": "UDAGAWA GENERATION",
    "type": "キュート",
    "tags": [
      "多属性"
    ],
    "effect": "各チームについて、ステージ5人にクール・キュート・ユーモアの3属性がすべて揃っていない場合、そのチームのステージ5人のAppealをそれぞれ-1する。",
    "rule": "missingAttributes"
  },
  {
    "id": "I",
    "name": "静寂の暴力",
    "type": "クール",
    "tags": [
      "対センター"
    ],
    "effect": "両チームのCENTER SKILLを無効にする。",
    "rule": "disableCenter"
  },
  {
    "id": "J",
    "name": "MCタイム",
    "type": "ユーモア",
    "tags": [
      "疲労回復"
    ],
    "effect": "両チーム8人全員の疲労値を-1する（最低0）。",
    "rule": "recoverAll"
  },
  {
    "id": "K",
    "selectable": false,
    "name": "ジャマイカビール",
    "type": "クール",
    "tags": [
      "クール"
    ],
    "effect": "CENTER・FRONT-L・FRONT-RにいるクールメンバーのAppealをそれぞれ+2する。",
    "rule": "coolFront"
  },
  {
    "id": "L",
    "name": "ってか",
    "type": "クール",
    "tags": [
      "フォーメーション固定"
    ],
    "effect": "前ラウンドと全く同じポジションでステージにいるメンバーのAppealを+1する。R1は発動しない。",
    "rule": "samePosition"
  },
  {
    "id": "M",
    "name": "僕なんか",
    "type": "クール",
    "tags": [
      "フォーメーション固定"
    ],
    "effect": "MIDDLE-L・MIDDLE-Rのポジションボーナスをそれぞれ+2する。",
    "rule": "middleBonus"
  },
  {
    "id": "N",
    "name": "君はハニーデュー",
    "type": "クール",
    "tags": [
      "対疲労付与"
    ],
    "effect": "疲労ペナルティによるAppeal減少量を1軽減する（最低0）。減少量が0になっても、そのメンバーは疲労ペナルティを受けているものとして扱う。",
    "rule": "fatigueRelief"
  },
  {
    "id": "O",
    "name": "Am I ready?",
    "type": "キュート",
    "tags": [
      "基礎値"
    ],
    "effect": "基礎Appealが4以上のステージメンバーのAppealをそれぞれ-2する。",
    "rule": "highBase"
  },
  {
    "id": "P",
    "name": "見たことのない魔物",
    "type": "キュート",
    "tags": [
      "多属性"
    ],
    "effect": "各チームのステージ5人が現在持つ属性数の合計を比較し、合計が少ないチームのCENTERのAppealを-3する。同数なら発動しない。",
    "rule": "attributeCount"
  },
  {
    "id": "Q",
    "name": "One choice",
    "type": "キュート",
    "tags": [
      "対単一属性"
    ],
    "effect": "各チームのステージで単独最多となる属性がある場合、その属性を持つステージメンバー全員のAppealを-1する。同数最多ならそのチームでは発動しない。",
    "rule": "majority"
  },
  {
    "id": "R",
    "name": "キツネ",
    "type": "キュート",
    "tags": [
      "疲労付与"
    ],
    "effect": "パフォーマンス終了後、通常のポジション疲労加算を行う前に、両チーム8人全員の現在疲労値を2倍にする。",
    "rule": "doubleCurrentFatigue"
  },
  {
    "id": "S",
    "selectable": false,
    "name": "NO WAR in the future",
    "type": "ユーモア",
    "tags": [
      "多属性"
    ],
    "effect": "ステージ5人にクール・キュート・ユーモアの3属性がすべて揃っているチームは、そのステージ5人全員のAppealを+1する。",
    "rule": "allAttributes"
  },
  {
    "id": "T",
    "name": "Right?",
    "type": "ユーモア",
    "tags": [
      "疲労付与"
    ],
    "effect": "各チームのステージ5人について、同じ疲労値を持つ最大グループ人数を比較し、その人数が多いチームのCENTERのAppealを+3する。同数なら発動しない。",
    "rule": "sameFatigue"
  },
  {
    "id": "U",
    "name": "アザトカワイイ",
    "type": "ユーモア",
    "tags": [
      "フォーメーション移動"
    ],
    "effect": "パフォーマンス開始前、前ラウンドからポジション種別を移動したステージメンバーの疲労値を+2する。FRONT-L↔FRONT-R、MIDDLE-L↔MIDDLE-Rの左右入れ替えは移動に数えない。R1は発動しない。",
    "rule": "moved"
  },
  {
    "id": "V",
    "name": "JOYFUL LOVE",
    "type": "ユーモア",
    "tags": [
      "バースト"
    ],
    "effect": "パフォーマンス直前に両チームのBURST状態を解除する。通常BURST使用済み状態と累計BURST回数はリセットしない。",
    "rule": "cancelBurst"
  }
];
export const SELECTABLE_SONGS = SONGS.filter(song => song.selectable !== false);
export function selectableSongById(id:string):Song {const song=songById(id);if(song.selectable===false)throw new Error(`${song.name}は特殊楽曲のため選択楽曲3枚に指定できません`);return song;}
export function songById(id: string): Song { const song = SONGS.find(s => s.id === id); if (!song) throw new Error('未知の楽曲: ' + id); return song; }
