# チャット解析用データ

`analysis.xlsx` を通常のチャットに添付すれば、前提・仕様・全チーム・両モードの統計をまとめて確認できます。JSONを読める場合は `analysis_bundle.json` 1つでも同じ情報を参照できます。

## 依頼文の例

この添付のゲームシミュレーション結果を解析してください。まず「まず読む」と実行概要を確認し、RANDOMとARCHETYPEを分けて比較してください。カードの採用数・片側のみ採用勝率・BURST/CENTER使用率、テーマ相性、P1/P2差を見てください。試合数不足と1ラウンドCPUの限界を考慮し、強弱を断定せず観測として報告してください。仕様の数値変更は提案と事実を区別してください。

## 実行概要

```json
{
  "seed": 1,
  "mode": "random",
  "configuration": {
    "randomMatches": 100,
    "matchesPerMatchup": 10,
    "variants": 3,
    "workers": 1
  },
  "catalog": {
    "idols": 48,
    "songs": 22
  },
  "cpu": "shared exhaustive 8P5; points > outcome > appeal difference > final fatigue; public snapshot only",
  "matchesPerMatchupIncludesMirrors": true,
  "winRateDefinition": "wins / team appearances; draws count in denominator; no-sample rates are 0 with selections=0",
  "notes": [
    "タグ3/4はCodex用メンバーに列がないため元メンバーG/HをID照合",
    "試合間・worker間でseedを分離。mirrorは同一デッキ・同一seed・同一編成でP1/P2を交換",
    "BURSTは通常と強制の合計。平均Appealは7ラウンドの試合累計",
    "AUTO/CENTERは効果が発生したパフォーマンス単位で計数。READYは状態遷移回数"
  ],
  "random": {
    "games": 100,
    "elapsedSeconds": 255.364056318,
    "incompleteTiming": false,
    "resumedGames": 100,
    "p1Wins": 53,
    "p2Wins": 47,
    "draws": 0
  },
  "totalElapsedSeconds": 0.063794263,
  "archetypeProgress": {
    "completed": 196,
    "planned": 450,
    "status": "paused; checkpoint saved, matchup statistics not finalized"
  }
}
```

## 読み方

- **目的**：実際のゲームと共通のエンジン・CPUによる48人22曲のバランス観測。カード値は独自に調整していない。
- **CPU**：公開済みラウンド開始状態のみ使用。予測獲得ポイント→勝敗→Appeal差→終了時疲労。将来のチャージ・READYの価値は評価しない。
- **勝率**：勝利数/チーム出場数。引き分けは分母に含む。割合は0〜1。採用0の行の0は弱さを意味しない。
- **採用勝率**：そのカード/楽曲を選択したチームの試合勝率。因果的な単体性能ではない。
- **片側のみ採用**：相手のチームがそのカードを含まないときだけの集計。
- **同型対戦**：テーマ総合のgamesはチーム出場数。同型対戦は両側を数える。matchupsのgamesは実試合数。
- **mirror**：同じseed・8人・3曲・デッキ・チーム別乱数を維持してP1/P2を入れ替える。10戦は5条件×2。
- **平均Appeal**：試合全7ラウンドの合計の平均。
- **平均BURST**：通常+強制の発動回数。burstRateは1回以上発動した試合の割合、averageBurstsは1試合平均回数。
- **AUTO/CENTER**：実際の効果が発生したパフォーマンス単位。1人につき1ラウンド最大1。
- **タグ**：Codex用メンバーにタグ3/4列がないため、元メンバーのG/HをIDで補完。能力はCodex用シートを優先。
- **候補の作り方**：主タグ3人以上、能力/条件/CENTER/属性/基礎Appealを固定スコアで評価し3候補。試合結果からの最適化なし。
- **少数標本**：各マッチアップ10戦は動作確認規模。優劣を断定せず、採用数・編成依存・CPUの限界を併記する。
- **sampleStatus**：sampleCountは勝率の分母（selections/teams/games）。20未満insufficient、20〜49 provisional、50以上sufficient。sufficientSamples=trueは50以上だけ。同型・mirrorの標本は独立ではなく、この表示は統計的有意性を保証しない。
- **列の名前**：selections=採用数、exclusiveSelections=片側のみ採用数、stage=ステージ回数、normalBURST/forcedBURST=通常/強制回数、BURST_READY=READY遷移回数。
- **出力範囲**：このファイルの実行概要が実際の試合数と時間の正本。RANDOMとARCHETYPEを混ぜて勝率を計算しない。

CSV/JSONの指定出力はrandom/とarchetype/にも保存しています。各試合のmembersA/B・songsA/BはIDであり、メンバー仕様・楽曲仕様で名前に対応できます。

## 共通ルール・裁定の全文

# v0.8 — Codex実装用Excel（48人・22曲）

基準は `案_48人22曲_Codex実装用.xlsx`。優先順位はREADME_Codex→共通ルール→Codex用メンバー→Codex用楽曲→要確認→元シート。全シートの抽出内容を [workbook-spec.json](simulation/workbook-spec.json) に保存。全48人・22曲の数値・文面をfixtureと照合する。旧原本HTMLは履歴として変更しない。

タグ3/4はCodex用メンバーに列がないため、元メンバーG/HからIDで補完。それ以外はCodex用シートを優先。No.31宮田愛萌の期別は2期生。カード・楽曲を独自にバランス調整していない。

## 共通進行

8人（ステージ5・BACKS3）、選択曲3枚。両者の同一アイドル・曲採用は可。R1〜R6は6枚のデッキを抽選順に消費。同名でも別カード。曲変更BURSTのラウンドは通常カードを消費しない。R7は負けている側の選択3曲から抽選、同点なら両者6曲から抽選。未消費デッキはENCORE候補に影響しない。

得点は通常勝利1、差10以上2、R7はそれぞれ2/3。引き分け0。最終ポイント同点なら7ラウンド累計Appealで判定。

位置AppealはCENTER+2、FRONT+1、MIDDLE+0。疲労0〜2は0、3〜4は-1、5〜6は-2、7以上は**-3**。桜月はこの減少量を2倍。疲労減算後のAppeal下限0。通常終了時疲労はCENTER+3、FRONT+2、MIDDLE+1、BACKS-2（最低0）。遠藤理子のAUTO有効時は疲労増加を1軽減。

R1初期配置はBACKSからの登場・前ラウンドからの移動に数えない。以後は前回パフォーマンスの位置と比較する。全く同じ位置の維持と、CENTER/FRONT/MIDDLE/BACKSという位置種別は区別する。

## ラウンド順序

1. 前回予約ボーナス、開始時AUTO（森本のseed付きランダム属性追加）。
2. READYから通常BURST、反応/強制BURST、即時効果。通常/強制の発動数を記録する。
3. 楽曲を決定、曲変更・曲属性変更を反映。公開済み状態を保存。
4. 両チームが配置決定。CPUは保存した公開状態だけを見て独立に決定する。
5. 登場を確定。JOYFUL LOVEのBURST状態解除、CENTERによるPLAIN/一時基礎値、ステージ入りチャージ消費を解決。
6. 楽曲疲労→P1/P2順のAUTO/CENTER前処理→両者の共通Appeal計算。
7. スコア、累計Appeal、位置/シンメ/疲労などの条件用履歴を記録。
8. キツネの現在疲労2倍→位置疲労/BACKS回復→敗北CENTER→BURST終了時疲労。BURSTで予約した終了時リセット等を処理。
9. BACKSチャージ・竹内の付与、連続履歴更新、BURST条件判定→READY。
10. パフォーマンス限定状態を解除し、次回の基準位置を保存。

通常BURSTは原則1人1試合1回。疲労0、次の1パフォーマンス中発動。強制BURSTは通常使用済みでも可、B効果を実行し通常使用済み状態は消費しない。リセットでも累計回数は維持。

## 今回の確認済み事項

- 山口CENTER：FRONT2人が同疲労ならそれぞれAppeal+2。
- 竹内AUTO：チャージ能力を持たないメンバーにもchargeを付与・保持。最大5と明記されたチャージ型は5まで。
- 濱岸B：遠藤光莉と同じく通常抽選・通常カード消費なし。
- 見たことのない魔物：ステージ5人の保有属性数合計を比較。同数不発。
- Right?：ステージ5人の同疲労値最大グループ人数を比較。同数不発。
- 山下葉留花CENTER：FRONT左右・MIDDLE左右の交換は移動に数えない。
- 藤吉・守屋READY条件：1パフォーマンス内のAUTO増減合計4以上。試合累計ではない。
- 松田里奈：同じ開始処理内の別の味方2人以上BURSTで即時発動。リセットは自身を含む味方8人から抽選し通常使用済み状態のみを戻す。
- 幸坂：相手を手動指定。CPU時は両側とも共通の対象選択ヒューリスティック。
- **追加回答**：同じ強制BURST連鎖内で発動済みの人を抽選候補から除外。候補がなければ不発。後の独立した発動は対象にできる。

## 属性・無効化・数値処理

「としても扱う」は属性追加。小田倉Bもクール追加（旧版の置換から更新）。複数属性者は各属性の人数へ1人ずつ計上。属性人数や種類数は原則ステージ5人。森田CENTERもステージの属性種類数を使う。

藤嶌CENTERのPLAINは他の追加属性より優先し、3属性のいずれにも数えない。CENTERを外れれば解除。山下瞳月BURSTの相手効果無効がある場合は防ぐ。

上村CENTERの相手基礎Appeal+1はそのパフォーマンスだけ。AUTOの基礎値条件にも反映。永続的な基礎値上昇（山崎、髙橋）と別管理。

大園AUTOはスキル・楽曲による数値増減を無効。BURST中はこの保護を外し数値増減を2倍。藤吉CENTERはクール味方への相手AUTO減少を防ぐ。小島はBACKS時、味方CENTER/FRONTへの相手または楽曲由来の各数値減少を1軽減。疲労や属性・位置変更は数値減少軽減に含めない。

小坂AUTOは補正後の位置ボーナス、位置由来疲労増加、疲労ペナルティを2倍にする。敵の位置ボーナス無効は0とし、AUTO/CENTER無効や山下の相手効果無効を共通判定する。

JOYFUL LOVEは開始済みBの即時効果（固定・属性追加・疲労交換等）と発動回数を残す。パフォーマンス中のBURST加算・免疫・倍率などは解除。開始時に予約した「パフォーマンス終了後」の疲労追加・リセットは実行する。

チャージはBACKS終了時に蓄積し、次のステージ入りで消費する。BURST条件は消費前の値で判定し、次回開始Bで直前に消費した値まで回復する。手動で付与された非チャージ型のchargeは、消費AUTOがなければ保持する。

## 既存の裁定・検証範囲

固定同士が矛盾する場合は先に成立した固定を優先し、後の強制移動・付随減算は不発としてログへ記録する。AUTOコピー同士は0として循環させない。BURST開始と前処理はP1→P2順であり、mirror検証でその偏りも観測する。

Excel「要確認」はユーザー回答ですべて解決済み。数値変更によるバランス修正は行わない。CPUは1ラウンドの得点・勝敗・Appeal差・終了時疲労まで評価し、将来のチャージ・READYの価値は評価しない。実装・統計の詳細は [シミュレーター](simulation/README.md) を参照。
