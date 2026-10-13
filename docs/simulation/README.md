# CPU vs CPU シミュレーター

Node.js 22以降（検証は24.19）、pnpm。`pnpm install` 後、リポジトリルートで実行する。ブラウザ・Reactを介さず本体の `createGame / preview / executeRound / nextRound / evaluateCpuFormation` を直接使用する。ゲームルールの別実装はない。

```sh
pnpm simulate --mode random --random-matches 1 --seed 1 --out simulation-results/check
pnpm simulate --mode random --random-matches 10 --seed 1 --workers 4
pnpm simulate --mode archetype --generate-only --seed 1
pnpm simulate --mode archetype --representative --matches-per-matchup 2 --seed 1 --workers 4
pnpm test
pnpm simulate --mode random --random-matches 100 --seed 1 --workers 4
pnpm simulate --mode archetype --matches-per-matchup 10 --seed 1 --workers 4
```

`npm run simulate -- --mode ...` も可。`--mode all --random-matches 1000 --matches-per-matchup 50 --seed 1` は両モードを順に実行する。今回は1000戦・50戦/100戦の総当たりは実行しない。

- `--out` 既定値 `simulation-results/latest`。既存checkpointがある場合は停止する。続きは `--resume`、新しい条件での実行は別ディレクトリを指定する。明示的な `--overwrite` は該当モードのcheckpointを作り直す。
- `--workers` 既定値1。複数workerでも試合番号ごとのseedは不変。ファイルの行順もスケジュール順に固定。
- `--variants` 既定値3。各テーマ3〜5程度のチーム候補を試合前に生成する。
- `--matches-per-matchup` は **mirror込みの総試合数**。2以上の偶数。10なら5条件×P1/P2交換の2試合。全テーマの非順序組合せと同テーマ同士を対象にする。
- `--representative` はバースト×疲労付与、クール×多属性、チャージ×固定の3組だけを実行する。
- `--generate-only` は対戦を実行せず、チームと構築ルールを保存する。
- `--max-new-matches N` は今回の新規試合数を両モード合計でN試合までに制限する。0なら追加対戦なしの再集計。未完了時もCSV/Excelを出力し、summaryにgames/plannedGames/complete/newGames/resumedGamesを保存する。
- Ctrl+Cは停止要求として受け取り、実行中の試合を保存・集計して終了する。再開は元と同じ引数に `--resume` を追加する。checkpointがない、条件不一致、重複、破損の場合は停止する。

## CPUと情報公開

既定のnormal戦略では両モード・両プレイヤー・ブラウザ版で同じCPUを使用。合法な8P5（最大6,720）配置を共通エンジンで計算し、次の辞書式順序で比較する。

1. 当該ラウンドの自軍予測獲得ポイント（R7の加点・差10以上を含む）
2. 勝利 > 引き分け > 敗北
3. 自軍Appeal − 相手Appeal
4. 自軍の予測終了時総疲労（小さい方）
5. 完全同値ならseed付きPRNGで一様選択

終了時疲労は本体の位置疲労・BACKS回復・CENTER敗北時処理・楽曲・BURST終了時疲労を共用する。候補評価はコピー上で実行し、乱数や元の状態を消費・変更しない。

CPUは開始処理後の公開済みスナップショットだけを見る。そのラウンドの相手の未確定配置や、相手CPUが先に計算した答えは参照しない。両CPUが判断した後に2つの配置を適用する。

通常CPUは1ラウンド評価であり、多手先探索はない。未来のチャージ蓄積、BURST READY、位置固定、疲労攻撃による次ラウンド以降の利益には独自の重みを付けていない。そのため「このCPUでの採用勝率」を人間対戦での最終的な強さと同一視しない。

## seedとmirror

チーム生成、曲選択、候補構築、CPU同値選択、属性追加、強制BURST、ランダム対象をseed付きPRNGから取得する。試合seed・デッキseed・チームA/B効果seed・ラウンドごとのCPUseedを分離する。

mirrorではチームA/Bの8人・3曲・seed・最初の6枚のデッキ・チームごとの乱数ストリームを保持し、P1/P2のみ交換する。ゲーム本体のP1→P2処理順に起因する差はそのまま観測する。勝敗が必ず反転することを強制する機能ではない。

## 構築ルール

最新の `Codex用メンバー (修正)` のタグ3/4・能力文・属性・基礎値・期別を使用する（宮田愛萌は2期生）。楽曲はCodex用楽曲の属性・タグ1・効果を使用。

主タグを持つカードが3人以上あるテーマを抽出する。汎用的な `Appeal上昇 / Appeal低下 / 楽曲` は副テーマとして使う。現在はクール、チャージ、バースト、フォーメーション移動、フォーメーション固定、多属性、対スキル、疲労回復、疲労付与の9種類。少人数のタグは副タグ・支援役に含める。固定の候補一覧から選ぶ実装ではない。

各テーマにつき3人以上の主タグ要員を確保し、以下の固定スコアで8人を構築する。主タグ+12、副タグ+3、属性一致+7、CENTER役確保+4、AUTO/BURST条件/位置/属性の適合加点、基礎Appeal/2、seedによる微小な揺らぎ。上位3候補の選択順を変え、各テーマ3チームを生成する。構築スコアは勝敗から学習・変更しない。

楽曲は主/副タグ、メンバー属性、BURST条件、効果内容で順位付けし、複数セットを生成する。たとえば桜月のタグは「疲労回復」だが実際は減少量を増やす曲なので、タグだけで無条件に高評価にしない。BURST軸では継続効果を打ち消すJOYFUL LOVEを選ばない。候補の名前、8人、3曲、タグ、属性構成、平均基礎Appeal、各採用理由を `archetypes.json` に保存する。

## 出力・統計の定義

- `summary.json`：設定、実行時間、P1/P2勝利数、引き分け、計数上の注意。
- `idol_comparison.csv`：randomWinRateとarchetypeWinRateの横比較。未実行モードは空欄。
- `random/`：matches、idol_stats、song_stats、attribute_composition_stats、idol_pair_stats。タグ統計も保存する。
- `archetype/`：上記に加えarchetypes.json、construction_rules.json、archetype_stats、archetype_matchups、archetype_matchup_matrix、tag_stats、tag_pair_stats。
- `*-checkpoint.jsonl`：各完了試合の入力と詳細な最終状態。失敗時はfailure.jsonも保存。`--resume` を付けると同じseed・入力の完了済み試合を検証して再利用し、未完了分だけを実行する。タイミング記録のない古いcheckpointを再開した場合は `incompleteTiming: true` となり、計測値は下限として扱う。

勝率は勝利数/チーム出場数。引き分けは分母に含め、別列で回数を記録する。片側のみ採用時勝率は相手がそのカードを含まない出場のみを集計する。少数標本では順位を断定しない。

各カードのCENTER/FRONT/MIDDLE/BACKSはパフォーマンス回数。ステージ回数はCENTER+FRONT+MIDDLE。AUTO/CENTER SKILLは数値効果・疲労操作・無効化などが発生したパフォーマンスごとに最大1回。BURST READYは新たな条件成立回数（互換の列名でありREADY待機は廃止）。通常/強制BURSTは実際の発動回数。

楽曲勝率は「選択3曲に含めたチームの試合勝率」であり、その曲が流れたラウンドだけの勝率ではない。属性構成は登録時の8人の本来属性。タグ・カードペアは1チームにつき重複計上せず、勝率の分母は出場チーム数（teams）、実試合数はmatches。ペアは出場10件未満なら勝率を空欄にする。

`sampleCount` は各表の勝率の分母（selections / teams / games）。20未満は `insufficient`、20〜49は `provisional`、50以上は `sufficient`。`sufficientSamples` は50以上だけtrue。mirrorや同型の両側は独立標本ではなく、この分類は統計的有意性を保証しない。`simulate:export` は過去のCSVにもこの表示を適用し、試合数・勝敗・勝率は変更せずExcel/JSONを再生成する。

平均Appealは試合の7ラウンド合計の平均。平均BURSTは通常+強制。対戦表はテーマ単位で候補A/B/Cを合算。同型対戦ではテーマ総合統計に両側の出場を含め、matrix対角は両側平均とする。対角は引き分けがあると50%未満になる。

CSVはExcelで読みやすいUTF-8 BOM付き。値は割合0〜1で出力する。大量実行結果は `.gitignore` 対象。

## 通常のチャットへ添付する

実行完了時に `analysis.xlsx`、`analysis_bundle.json`、`CHAT_ANALYSIS.md` を自動生成する。Excel 1つに、読む順番・集計定義・実行条件・48人22曲の仕様・全チーム・CSVと同じ全統計を収録する。通常のチャットにはExcelを添付し、Markdown内の依頼文を利用できる。JSONにも同じ前提と統計をまとめている。

既存の実行結果から解析用ファイルだけを作り直す場合は、追加対戦なしで実行できる。

```sh
pnpm simulate:export simulation-results/final
```

書き出しもNode.jsで実行し、PythonやExcelのインストールは不要。発動回数と発動試合率、RANDOM/ARCHETYPEの分母を区別して読む。

中断後の再開例：元のコマンドと同じ引数に `--resume` を追加する。保存済みのseed・チーム・曲・mirror条件が一致しない場合はエラーで停止する。

## CHARGE CPU（CLI専用）

`--cpu-strategy normal` が既定。`charge` は両側へ指定し、`charge-archetype` はチャージ軸だけへ指定する。チャージタグかつ既存engineにchargeConsumerがあるメンバーを運用対象にし、竹内の支援もengineの終了処理で評価する。消費型がいなければ通常CPUへ完全に戻す。ブラウザーのCPU・おすすめ配置には適用しない。

合法な全配置を列挙し、同じ `preview` でAUTO/B/C/楽曲・相手妨害を計算する。位置疲労、BACKS回復、BACKSチャージ、竹内AUTO、チャージ型の条件/B回復にも本体の処理を使う。

現在価値は符号付き予測獲得ポイント×12＋勝敗×3＋Appeal差×0.45−終了時疲労×0.08。将来価値は固定された次の係数で追加する。カード能力の数値ではなく、シミュレーション専用CPUの選択方針である。

| ラウンド | 追加する価値 |
| --- | --- |
| R1〜R4 | 保持チャージの効果価値×1.8、未使用BURSTと3以上チャージの備え×1.2、BACKS蓄積増分×2、B自己加算×0.5 |
| R5 | 保持価値×0.65、BURSTの備え×0.3、3以上消費でステージ入りする価値×3、B自己加算 |
| R6 | 保持価値×2、前回消費・BURST済みメンバーのBACKS復帰価値×3、BACKS蓄積増分×2 |
| R7 | 3以上消費でステージ入りする価値×0.5（現在Appealにも消費効果を計上） |

保持チャージの効果価値は公開済み状態に対し、次の登場位置でチャージあり/なしのengine予測Appeal差を比較する。今の疲労が0でも将来の疲労操作の余地を評価するため、最低値をチャージ×0.75とする。相手の次の配置・曲は予測しない。R6復帰価値は `3＋保持チャージ`、消費型の登場価値は `3＋消費チャージの効果価値`。これらは戦術を狙う固定ヒューリスティックであり、R5/R6を必ず固定する指示ではない。

現在の得点差、予測獲得/喪失点、残りラウンドの最大得点で、ポイント上の逆転余地がある候補を優先する。これは公開配置に対する予測に基づくガードであり、相手の未確定配置に対する実勝敗の保証ではない。R7は予測最終勝敗（累計Appealの同点判定を含む）→現在ポイント→勝敗→上記の評価値を優先する。同値では通常と同じseed付き一様選択を使う。

B反応の仮計算は独立したseed付き乱数を使い、本試合の効果乱数を消費しない。全カードの将来BURST連鎖や数ラウンド先の相手の最適化までは探索しない。将来価値は推定であり、実チャージ処理は共通engineに従う。通常CPUの判断順序・候補数・同値時の乱数順は維持。実装は候補キャッシュ・必要な状態だけのコピーで高速化している。

`--charge-comparison --mode archetype --matches-per-matchup 6` は3候補それぞれの同じ8人・3曲を通常/CHARGEに渡し、P1/P2を交換した計6戦を予定する。通常総当たりと異なり、試合数引数はこの比較全体の総数。

## 対単一属性メタの追加

現行は通常8テーマ＋メタ3候補を独立seedで構築する。実在する「対単一属性」タグは小田倉・河田の2人なので両者を核にする。Aは対クール人数参照、Bは属性追加/PLAIN、Cは単一属性条件とスキル・位置妨害を重視する。残る枠は実能力、BURST条件、CENTER、基礎値で選ぶ。3属性を必須とするのは属性変更・PLAIN重視profileのみ。試合結果を構築に使わない。

楽曲は最多属性減算、欠けた属性への減算、3属性加算、属性保有数比較、CENTER無効を能力文から評価する。PLAINと属性人数参照の競合・CENTER無効でPLAINも無効になる点は採用理由と注意点に記録する。

全体は9テーマ×3候補＝27チーム、同型込み45組合せ。各10戦なら450戦。通常8テーマの予定試合を先に並べ、新テーマの組合せを末尾に追加する。`--archetypes "対単一属性メタ,クール軸"` で対象テーマを絞れる。既存のタグには単独のキュート軸/ユーモア軸がなく、それらの独立テーマは追加していない。

## チャージ観測とデータ照合

`matches.csv` に cpuStrategy / cpuStrategyA / cpuStrategyB を追加。cpuStrategyは指定戦略を表し、charge指定で消費型がいない場合の通常CPUへのフォールバックもchargeとして記録する。戦略はcanonicalなチームA/Bに追随し、mirrorで物理P1/P2だけを入れ替える。

`charge_round_trace.csv` はタグを持つカードをラウンドごとに記録する。位置とenteredはそのパフォーマンスで選択した配置・前回の位置で判定し、終了後Bの強制移動とは分離する。B回復は共通効果記録で観測した、その本人のBによる本人へのチャージ増加だけを数える。

`charge_idol_stats.csv` はCPU別・カード別のチーム出場数を分母にする。最大値は開始/終了/消費チャージから算出。消費はBACKSからのステージ入りで正のチャージを消費した回数、R5/R7の登場率も同じ入り直し判定。R6BACKS率は選択配置のBACKS率。R1の初期配置はステージ入りに数えない。

`cpu_strategy_stats.csv` はCPU×テーマの勝率・平均ポイント・累計Appeal。3つの追加CSVもExcel/JSONに収録する。

カードは修正Excelで上書きし、別カード版を作らない。旧性能の結果は今回の検証には使用しない。checkpointにはカード・楽曲・処理順の入力指紋を記録し、異なる入力を拒否する。normal指定時のRANDOMのピック/seed、生成ルールは現行9軸へ整理されており、Excel修正により勝敗や基礎値を使う構築結果は変わり得る。

## 高速化と記録設定

最大6,720候補の列挙とformationFromArrayの結果を選出順つき8人キーでキャッシュする。LRUは各プロセス/workerで32チームまで。ID順を並べ替えず、全候補を同じ順に評価し、固定位置などの合法性は候補ごとに確認する。キャッシュは不変で、返却配置は編集可能なコピー。相手の固定された公開配置は重複検証を省く。

CPU専用projectionは同じ `calculatePreview` / `preparePerformance` / `calcBoth` を使用する。選出ID・曲・位置履歴など、この計算で変更しない配列はコピーを省く。状態のスカラーは各候補で独立コピーし、CHARGEの終了処理・反応BURSTが変更するstats、曲履歴、属性リストなどは別コピーで保護する。ブラウザーの通常previewは従来の完全コピーを維持する。凍結した入力で22曲を処理するテストで、元状態を変えないことを確認する。

`hasAttr` は属性追加/変更/PLAINを同じ意味で直接判定し、位置/人数/BACKS判定の不要な配列・Set生成も削減する。属性付与や人数のルールは変更しない。

`--fast-simulation` は実試合の効果記録とcharge traceを省略。勝敗・点数・Appeal・疲労・配置・カード/BURST/AUTO/CENTER/楽曲・CPU戦略統計を維持する。charge専用2CSVはヘッダーのみ、summaryのchargeTelemetryAvailable=falseとExcelの説明で未計測を明示する。CPUに渡す情報や乱数の消費は変えない。normal/CHARGEそれぞれで通常記録とfastの7ラウンド最終状態が一致することを検証する。

checkpointはfast有無が一致した実行だけを再開する。通常記録の既存checkpointは通常設定で再利用可能。workerへも同じ記録設定を渡す。

## チャージ軸の構築更新

渡邉美穂・渡辺莉奈・平尾帆夏を固定コアにする。残る5枠は自身のBACKS依存AUTO、自軍BACKSを要求するBURST条件、BACKSからの登場条件を除外する。竹内は例外として採用可能。相手BACKSへの反応（田村）は自軍のBACKS配置を要求しないため除外しない。井上はBACKS時のAUTO分岐を持つため厳密条件で除外する。

支援スコアにステージ常駐+4、基礎値4〜5優先+8、CENTER役+6、竹内のチャージ支援+8、多種類位置経験の要求-8を加える。元の固定スコア・seed付きの候補分散と組み合わせ、最後の支援枠までにCENTER役がいなければCENTER能力持ちから選ぶ。試合結果は構築に使用しない。3曲は新しい8人の属性・条件に対して従来の楽曲選択式で選ぶ。

チャージの固定3コアは維持する。チャージ軸の予定入力が変わるため、旧編成を含むcheckpointには新編成を混ぜない。

二段階候補評価は `--cpu-search two-stage --preview-candidates 200`（100〜300）で指定。指定しない場合は全候補評価。最終評価・実際の試合は共通engineのままですが、候補絞り込みによりCPU配置/勝敗が変わる可能性があります。normal/charge戦略とは独立の設定で、結果/summary/Excelにも記録し、checkpointの方式/候補数の混在を拒否します。

K/SはBURST専用。データ22曲、通常選択20曲です。今回の選択ルール変更前のcheckpointは再開できません。新規出力先で実行してください。詳細なWindowsコマンドは [SIMULATION.md](../../SIMULATION.md#12-二段階評価で候補を絞る) を参照してください。

## 2026-10-10 指定バランス調整

谷口愛季AUTOの対面減算を-1→-2、河田陽菜AUTOを-3→-2へ変更。山下葉留花は基礎Appeal3→2のみ変更し、A/B/Cは維持。その他のカード・楽曲・進行ルール・通常CPU/CHARGE CPUは変更しない。

現行の独立軸はクール、チャージ、バースト、フォーメーション移動、多属性、対スキル、疲労回復、疲労付与、対単一属性メタの9種類。3候補ずつ計27チーム、同型込み45組合せ、各20戦で900戦（RANDOM1000と合わせ1900戦）。フォーメーション固定は能力・タグ・副シナジーとして残し、独立軸は生成しない。

BURST加点は自軍の利用・回数・強制発動・使用済みリセットを評価し、対バーストタグや相手BURSTのみへの反応には追加点を与えない。疲労・移動・対スキルも効果の対象を区別する。多属性軸は3属性必須。チャージは固定3コアを維持し、固定タグだけの優先点は付けない。

メタは実在2人のコアと3profileを維持。基礎値加点はbase/2、未採用属性加点は2。3属性必須と多属性曲の高評価は属性変更・PLAIN profileのみ。他のprofileは対クール/単一属性妨害・CENTER妨害を優先する。構築に勝率・WARは使用しない。

旧checkpoint・結果は新性能・構築と混ぜず、新しい出力先で実行する。歴史的結果は書き換えない。

## 文言統一Excelと構築更新（2026-10-10・履歴）

最新カード性能・効果方向による構築と [27チームの全選出理由](normalized-balance-20261010.md) を反映。旧結果と混在せず、異なる `--out` で開始してください。構築には勝率・WARを使用しません。

```powershell
pnpm.cmd simulate -- --mode archetype --generate-only --seed 1 --out simulation-results/latest-generator
```

試合を行わず構築を確認できます。各エントリーの `scores` は構築点・seed補正・順位点、`reasons` は実効果と対象に基づく選出理由です。

## 最終確定Excel（2026-10-11）

`案_48人22曲_Codex実装用_最終確定_20261011.xlsx` を反映。最新の仕様・変更点・全27チームの選出理由は [最終確定版の確認](final-balance-20261011.md) を参照してください。谷口はJOYFUL LOVEで元の属性に戻り、チャージBは人間が交換先を選択し、CPUは公開盤面で比較します。今回消費していない場合のチャージ回復は最後の消費値を使います。通常CPUの配置評価方式・楽曲性能は維持。旧結果と混ぜず新しい出力先を使ってください。

## 実カタログの確認

generate-onlyを含む出力に `catalog-snapshot.json`（実入力48人・22曲）と参照元・仕様fingerprintを保存します。10月10日のnormalized文書は履歴、現在の正本は10月11日最終確定Excelと回答済み裁定です。[全48人の照合と確認コマンド](catalog-sync-audit-20261011.md) を参照してください。
