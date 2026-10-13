# WAR分析をWindowsで実行する

Node.js 22以降・pnpmを使い、リポジトリの `package.json` がある場所でPowerShellを開きます。最新版をPull後、依存変更があれば `pnpm.cmd install --frozen-lockfile`。計算はPC上だけで動き、Codexを開く必要はありません。以下の大量試合コマンドは**ユーザーのPC用**です。

## まず基礎試合の結果を用意する

現在の48人・選択可能20曲（データは22曲）で取得したcheckpointを使います。inputFingerprint、seed、予定チーム・楽曲・mirror、CPU戦略・探索方式・候補数、fast設定が異なる結果は拒否します。K/Sを通常選択できた旧データの結果は利用できません。

既存の結果があればその `--out` を指定してください。ARCHETYPEとRANDOMの両方を持つ同じ出力フォルダーなら、段階を分けてもモード比較を自動作成できます。まだ結果がない場合の例：

```powershell
pnpm.cmd simulate -- --mode all --random-matches 1000 --matches-per-matchup 20 --cpu-strategy charge-archetype --seed 1 --workers 4 --fast-simulation --burst-round-trace --out simulation-results/balance
```

既定CPU探索は従来の全候補評価です。二段階探索を使う場合だけ `--cpu-search two-stage --preview-candidates 200` を追加してください。WARでもbaselineと同じ探索方式を使います。`--burst-round-trace` は全カードのBURST発動ラウンドを記録する任意の軽い観測機能です。ゲームの判断・乱数・結果は変えません。

## LEVEL 1：全48カードの基本診断

```powershell
pnpm.cmd simulate -- --war-only --card-war --war-samples-per-card 50 --war-seed 1 --war-workers 4 --out simulation-results/balance
```

`--war-only` はsummaryから基礎試合の設定を復元し、baselineを再実行しません。既に完了している試合だけを使います。デフォルトの `--card-war` は**ARCHETYPEの実在代替cWARだけ**。RANDOM、能力除外、ペア、全カードRound Valueは自動実行しません。

採用数・採用勝率・片側のみ採用勝率、cWAR/100と95% CI、Carry/Hurt/Decisive/Net、自チームテーマ別・相手テーマ別、best/worst、home/offRoleを保存します。同じ試合からポイント/Appeal差も計算し、追加試合は発生させません。

`war-samples-per-card` は**各モード・各カードにつき最大50チーム出場分**のpaired比較です。存在する試合以上には増やしません。同型対戦の両側は別対象、mirrorは可能な限りまとめて抽出。上限が奇数なら最後のmirrorの片側だけになる場合があります。50比較×48人なら最大2,400代替試合なので、通常対戦より重い分析です。

最初に計画だけ確認するには `--war-plan-only` を追加してください。`war-planned.json` に予定ジョブ数・全代替・対象seedが保存され、代替試合は実行しません。

`detail_candidates.csv` は上位/下位5、worstでも+3超、best/worst差20以上、CIが0を跨がない、採用勝率とWARの乖離、home/offRole差10以上を**詳細検査候補として示すだけ**です。候補の少数標本表示も見てください。追加試合は自動開始しません。

## LEVEL 2：RANDOMの汎用性診断（別オプション）

```powershell
pnpm.cmd simulate -- --war-only --random-card-war --war-samples-per-card 50 --war-seed 1 --war-workers 4 --out simulation-results/balance
```

LEVEL 1とは別checkpointに保存します。同じbaseline・warSeedのLEVEL 1が同じフォルダーにあれば `analysis_bundle.json` / `analysis.xlsx` とルートの `card_war_mode_comparison.csv` に比較を追加します。

- `card_war_stats` / `archetypeCardWAR`：ARCHETYPEのみ。
- `random_card_war_stats` / `randomCardWAR`：RANDOMのみ。
- `synergyDependency = archetypeCwarPer100 - randomCwarPer100`。
- 片方未測定なら差は `null`。両モードのcWARや標本数を合算しません。

両方高いなら汎用性、ARCHETYPEだけ高いならシナジー依存、RANDOMだけ高いなら構築/role fitの問題、両方低いなら弱さの可能性を検討できます。代替プール・CPU・標本数が違うので、これだけで原因を断定しないでください。

RANDOMのみのbaselineフォルダーでもこのコマンドを単独実行できます。別フォルダーで得たARCHETYPEとの自動統合は行わず、それぞれの解析ファイルをチャットに添付してください。

## LEVEL 3：指定カードだけ詳細検査

```powershell
pnpm.cmd simulate -- --war-only --card-war --war-detail-ids 1,3,7,25,34 --war-samples-per-card 50 --war-seed 1 --war-workers 4 --out simulation-results/balance
```

指定IDだけについてA、B条件＋能力、C、ALLを別々に除外します。CがないカードはN/A（null）。同じ本人・属性・基礎Appealを保持し、対象チームの本人だけを除外します。相手の同カードは有効です。本物のengine・CPU preview・CHARGE forecastを使いR1から再配置。nWARや独立のsWARは実装していません。ALL_SKILL_WARは全スキル除外の比較です。

BURSTだけを検査する場合：

```powershell
pnpm.cmd simulate -- --war-only --card-war --war-detail-ids 3,7,25 --war-skill-ablation BURST --war-samples-per-card 50 --war-seed 1 --war-workers 4 --war-out simulation-results/balance/war/burst-detail --out simulation-results/balance
```

`--war-skill-ablation AUTO,BURST,CENTER,ALL` で種類を指定できます。`--burst-war` はBURST除外を追加する別名です。いずれも `--war-detail-ids` が必須です。詳細IDは基本診断のカードフィルターにもなります。LEVEL 1と同じ条件の計算済み代替試合は自動再利用します。

Round Valueは詳細IDについてだけ、チーム全体の各R1〜R7の勝利価値・ポイント・Appeal差を、同じ実在代替試合から計算します。追加試合なし。本人のAppealだけを差し引く指標ではありません。

指定ペアを検査する例：

```powershell
pnpm.cmd simulate -- --war-only --card-war --war-detail-ids 3,7 --war-skill-ablation BURST --war-pairs 3:7 --war-pair-samples 20 --war-samples-per-card 50 --war-seed 1 --war-workers 4 --war-out simulation-results/balance/war/pair-3-7 --out simulation-results/balance
```

ペアの両IDを詳細IDに含めてください。`--war-pairs 3:7,7:25` のように複数指定可。自動全ペア/採用上位ペアは実行しません。4条件の勝利価値の交互作用 `f(A,B)-f(A,replB)-f(replA,B)+f(replA,replB)` を保存します。代替が同じになる場合はBの候補からAの代替を除外します。単独代替の条件が同じなら計算を共用します。

## WARと代替の定義

`Win=1, Draw=0.5, Loss=0`、`winDelta=actual-replacement`。

- `cWAR = sum(winDelta)`、`cWARPer100 = average(winDelta) * 100`。
- `cWARPer100Selections`も同じ値。分母は**実際に完了したpairedSamples**。
- `pWARPer100` は獲得ポイント差、`aWARPer100` は7ラウンド合計Appeal差の平均×100。cWARとは別単位。
- positiveFlipはactualが上、negativeFlipはactualが下。decisiveは両方の割合の和、netは差。carryGamesはactual=Winで代替=Loss/Draw。
- ARCHETYPE代替は元8人を候補から除外し、主タグ共通→同じテーマ/役割→テーマ全体へfallback。既存generatorスコア（試合結果・seed jitter不使用）順の中央値を使います。主タグ最低人数、唯一のCENTER、多属性軸の3属性、メタPLAIN profileの3属性/PLAIN構築、チャージ支援の除外条件を保持します。
- チャージ固定コア32/38/44や、合理的代替が存在しないメタコアなどは `replacementUnavailable`。人工カードを作りません。
- RANDOM代替は未採用の合法カードから、`sameAttribute_baseWithin1` → `sameAttribute_relaxedBase` → `anyAttribute_baseWithin1` → `legalPool` の順に緩和し、warSeedで選択。tier・候補一覧を記録します。
- 代替なしや未計算のWARはnullであり、弱いという意味ではありません。欠測を0として平均しません。

95% CIはactual/replacement差分のpaired cluster bootstrap（既定1,000回、`--war-bootstrap` で変更）。mirrorと同条件の両側をseed/pair単位でまとめて抽出し、warSeedから決定します。workers数は結果を変えません。20未満insufficient、20〜49 provisional、50以上sufficient。少数clusterではCIが一点に退化し得ます。この表示は統計的有意性を保証しません。

## BURST勝利寄与

既存の `burstRate` / `burstGames` / `normalBURST` / `forcedBURST` は発動頻度としてそのままです。BURST除外paired試合から `burstWARPer100Selections`、95% CI、Flip/Decisive、ポイント/Appeal差を算出し、複数回発動しても**1試合1比較**です。

`burstTriggeredSamples` はactualで本人が1回以上BURSTした比較数。`burstWinDeltaWhenTriggered` はその平均winDelta、`burstWARPer100TriggeredGames` は100倍。発動試合への条件付けによる選択バイアスがあるため、全採用の主指標と区別します。

`totalBurstActivations` / `averageBurstActivationsPerTriggeredGame` / `winDeltaPerBurstActivation` は補助指標。**最後の値は因果効果の単純分割による参考値で、主指標にしません。**

通常/強制が混在するため、寄与を厳密分離した値は出しません。combined BURST WARが正本です。通常/強制の発動試合数は残します。B除外でも、他人からの強制BURSTの共通疲労リセット・BURST状態・累計回数は残り、本人B条件・反応条件・固有能力を止めます。

`burst_round_war_stats` はそのラウンドで発動した試合の**試合全体**のpaired差。複数ラウンドで発動した試合は各層に入るため加算不可。R7終了時BURSTは通常その試合の得点に反映されませんが、条件付けた全試合差には以前のBURSTの寄与を含みます。旧checkpointで全カードの発動ラウンドがない場合、チャージ履歴から確認できるカードだけ集計し、その他は `traceUnavailableGames` とnull。復元を推測せず、baselineの再実行もしません。

## 停止・再開と計算量の制限

Ctrl+Cで実行中の試合を完了・保存して停止します。同じコマンドを再実行してください。`--war-only` はWAR checkpointも自動再開し、完了済み試合を重複実行しません。通常実行に分析を付ける場合のWAR再開は `--war-resume` を指定します。

`--war-max-new-jobs 1` なら今回の追加counterfactualを最大1試合に制限。0なら既存結果/再利用結果の集計だけ。`--max-new-matches` はbaselineの追加試合数で、WARの制限とは別です。`--war-card-ids 1,3` はLEVEL 1/2の対象を絞ります。

WARのsample数・seed・詳細ID・分析種類・bootstrap回数・baseline等を変更する場合は別 `--war-out` を指定してください。既存checkpointとは混在させません。同じ出力への同時実行は避けてください。war-workersは独立に指定でき、既定1。メモリ使用量を見ながら4程度から試すのが無難です。

## 出力とチャット解析

通常のCSVは変更せず、分析を以下に追加します。

```text
simulation-results/balance/
  summary.json
  analysis_bundle.json
  analysis.xlsx
  card_war_mode_comparison.csv
  war/
    level1-archetype/
    level2-random/
    detail/
      plan.json
      checkpoint.jsonl
      statistics.json
      paired_trials.json
      detail_candidates.csv
      card_war_mode_comparison.csv
      archetype/ または random/
        card_war_stats.csv
        card_archetype_war_stats.csv
        card_matchup_war_stats.csv
        card_round_value_stats.csv
        card_skill_ablation_stats.csv
        pair_synergy_war_stats.csv
        burst_round_war_stats.csv
```

段階別結果は合算せず、同モード・同カード等のキーで最も標本の多い行を使い、能力別診断を付記します。同じbaseline/inputFingerprint/warSeedの実行だけを解析にまとめます。各計算条件はsummary.warRuns、全対象と代替はplan/paired_trialsで追えます。

Excelだけ再作成する場合：

```powershell
pnpm.cmd simulate:export -- simulation-results/balance
```

通常チャットには `analysis.xlsx` または `analysis_bundle.json` を添付してください。LEVEL 1のcWAR・best/worst・採用テーマ別・Carry/Hurt・CI・採用数をまず見て、万能すぎるカードだけ精密検査へ進めます。強カードを一律50%へ均す分析ではありません。メタ・シナジー・相性による環境を観測し、ゲーム性能の自動調整は一切行いません。

## 2026-10-10 指定バランス調整

谷口愛季AUTOの対面減算を-1→-2、河田陽菜AUTOを-3→-2へ変更。山下葉留花は基礎Appeal3→2のみ変更し、A/B/Cは維持。その他のカード・楽曲・進行ルール・通常CPU/CHARGE CPUは変更しない。

現行の独立軸はクール、チャージ、バースト、フォーメーション移動、多属性、対スキル、疲労回復、疲労付与、対単一属性メタの9種類。3候補ずつ計27チーム、同型込み45組合せ、各20戦で900戦（RANDOM1000と合わせ1900戦）。フォーメーション固定は能力・タグ・副シナジーとして残し、独立軸は生成しない。

BURST加点は自軍の利用・回数・強制発動・使用済みリセットを評価し、対バーストタグや相手BURSTのみへの反応には追加点を与えない。疲労・移動・対スキルも効果の対象を区別する。多属性軸は3属性必須。チャージは固定3コアを維持し、固定タグだけの優先点は付けない。

メタは実在2人のコアと3profileを維持。基礎値加点はbase/2、未採用属性加点は2。3属性必須と多属性曲の高評価は属性変更・PLAIN profileのみ。他のprofileは対クール/単一属性妨害・CENTER妨害を優先する。構築に勝率・WARは使用しない。

旧checkpoint・結果は新性能・構築と混ぜず、新しい出力先で実行する。歴史的結果は書き換えない。
