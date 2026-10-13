# Windowsでシミュレーションを実行する

PCだけで動きます。実行中にCodexやChatGPTを開く必要はありません。Node.js 22以降（LTS版を推奨）が必要です。Excel・Pythonは不要です。

## 1. 最新版を取得する

GitHub Desktopで `oyoufuku/idol-card-game` を開き、Current branchを **main** にしてください。Fetch origin → Pull originで最新版を取得します。未mergeのPRを試す場合は、そのPRのブランチを選んでください。

Repository → Show in Explorerを選びます。`package.json` があるフォルダーで右クリック →「ターミナルで開く」を選んでください。Windows PowerShellで以下のコマンドを実行します。GitHub DesktopのRepository → Open in Command Promptから開いても使えます。

## 2. 初回のインストール

Node.jsのインストール後にターミナルを開き直し、確認します。

```powershell
node --version
```

v22以降なら次へ進めます。依存バージョンを固定できるpnpmを推奨します。

```powershell
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
```

依存関係の変更がないPull後は再インストール不要です。`pnpm-lock.yaml` や `package.json` が変わった場合は `pnpm install --frozen-lockfile` を再実行してください。

pnpmを使わない場合は `npm install` でも実行できます（npm専用lockfileはないため依存バージョンは完全固定されません）。**以下のnpm runコマンドはpnpmでインストールしていても使えます。**

PowerShellで「スクリプトの実行が無効」と表示された場合は、コマンド中の `npm` を `npm.cmd`、`pnpm` を `pnpm.cmd` に置き換えてください。

## 3. RANDOMを実行する

100戦：

```powershell
npm run simulate -- --mode random --random-matches 100 --seed 1 --out simulation-results/random-100
```

1000戦：

```powershell
npm run simulate -- --mode random --random-matches 1000 --seed 1 --out simulation-results/random-1000
```

5000戦なら `--random-matches 5000`、保存先も `simulation-results/random-5000` にします。進捗は `[random] 10/100` のように表示されます。

既定は1workerです。PCに余裕があれば `--workers 4` を末尾に追加して4試合を並列実行できます。worker数を変えても各試合のseed・CPU判断は変わりません。クラウドでの以前の100戦は約255秒でしたが、PCの速度とworker数によって時間は異なります。

## 4. ARCHETYPEを新規実行する

```powershell
npm run simulate -- --mode archetype --matches-per-matchup 10 --seed 1 --out simulation-results/archetype-10
```

9テーマ×3候補のチームを作ります。10戦はmirror込み（同条件5組×P1/P2交換）です。同テーマも含め45組合せ、合計450試合。`--matches-per-matchup` は2以上の偶数を指定してください。

## 5. 最新データのcheckpointから再開する

今回のExcel修正はカードデータをそのまま上書きしています。旧結果のZIPは今回のカード性能を表していないため使用しません。旧checkpointには新しい結果を追記できません。

上のARCHETYPEコマンドを中断した後、同じ引数に `--resume` を加えます。

```powershell
npm run simulate -- --mode archetype --matches-per-matchup 10 --seed 1 --resume --out simulation-results/archetype-10
```

完了済み試合を再実行せず、同じseed・mirror条件で未完了試合を実行し、安全に追記します。`--cpu-strategy`、`--charge-comparison`、`--archetypes` を指定した実行は、再開時にも同じ指定を使ってください。worker数は変更できます。

保存済みのカードデータ、楽曲、ゲームルール、予定試合の条件が異なる場合はエラーで止まります。同じフォルダーへ2つのシミュレーターを同時起動しないでください。

旧結果を破棄して同じ保存先へ新規実行する場合は、`--resume` の代わりに `--overwrite` を指定できます。新規実行なので全試合を最初から計算します。カードの別バージョンを選択する機能ではありません。

再開を少数だけ確認したい場合は `--max-new-matches 2`、追加対戦なしで集計だけ更新する場合は `--max-new-matches 0` を末尾に加えます。

## 6. RANDOMとARCHETYPEを両方実行する

```powershell
npm run simulate -- --mode all --random-matches 1000 --matches-per-matchup 50 --seed 1 --out simulation-results/all-1000-50
```

RANDOM1000戦の後にARCHETYPE2250戦を実行します。試合数を増やす操作はこのようにPCで行ってください。

## 7. 出力とチャット解析

`--out` で指定したフォルダーに保存します。省略時は `simulation-results/latest` です。

- `summary.json`：実際の完了数、予定数、再利用数、新規数、時間、P1/P2勝率。`complete: false` は途中結果です。
- `random/`：試合、アイドル、楽曲、属性構成、タグ・ペアのCSV。
- `archetype/`：上記に加え全チーム・選択理由、テーマ別統計、相性表のCSV。
- `*-checkpoint.jsonl`：試合ごとの再開用データ。削除しないでください。
- `analysis.xlsx` / `analysis_bundle.json` / `CHAT_ANALYSIS.md`：通常のチャットで解析するための仕様・統計一式。

`analysis.xlsx` は実行終了時（途中停止時も）に自動生成します。通常のチャットにこのExcelを添付して、`CHAT_ANALYSIS.md` の依頼文を貼り付けてください。過去結果からExcelだけ作り直す場合：

```powershell
npm run simulate:export -- simulation-results/random-100
```

Excel再生成では試合を実行しません。過去CSVの標本表示も更新しますが、試合数・勝敗・勝率は変更しません。`sampleStatus` は20未満insufficient、20〜49 provisional、50以上sufficient。mirrorの結果は独立標本ではなく、十分という表示だけで強さを断定しないでください。

## 8. 途中で止める・再開する

実行中のターミナルで **Ctrl+Cを1回** 押します。実行中の試合の保存と集計が終わるまで待ってください。複数workerなら実行中の各試合を保存します。

1000戦の再開例：

```powershell
npm run simulate -- --mode random --random-matches 1000 --seed 1 --resume --out simulation-results/random-1000
```

両モードの再開例：

```powershell
npm run simulate -- --mode all --random-matches 1000 --matches-per-matchup 50 --seed 1 --resume --out simulation-results/all-1000-50
```

ウィンドウを閉じる・PCを強制終了すると、進行中の試合は保存されないことがあります。保存済み試合は再利用できますが、破損したcheckpointは自動修復せずエラーにします。

checkpointだけ残り集計ファイルが古い場合は、元の再開コマンドに `--max-new-matches 0` を付ければ追加対戦なしで集計できます。

## 9. テスト

```powershell
npm test
npm run build
```

CPU・仕様の確認結果と性能上の注意は [ローカル実行整備の確認](docs/simulation/local-review.md) に記載しています。

## 10. CHARGE CPUで実行する

指定しなければ従来の通常CPUです。ブラウザーのCPU・おすすめ配置も通常CPUのままです。

全チームにCHARGE戦略を指定（チャージ消費型を含まないチームは通常CPUへ戻ります）：

```powershell
npm run simulate -- --mode random --random-matches 100 --cpu-strategy charge --seed 1 --out simulation-results/charge-random
```

ARCHETYPEでチャージ軸だけCHARGE CPU、相手テーマは通常CPU：

```powershell
npm run simulate -- --mode archetype --matches-per-matchup 10 --cpu-strategy charge-archetype --seed 1 --out simulation-results/charge-archetype
```

同じチャージ軸8人・3曲で通常CPUとCHARGE CPUを比較（6戦＝3候補各1組のmirror）：

```powershell
npm run simulate -- --mode archetype --charge-comparison --matches-per-matchup 6 --seed 1 --out simulation-results/charge-comparison
```

この比較の試合数は全候補を合計した総数です。10なら5組のmirror、100なら50組になります。3候補を順番に使います。

対単一属性メタとクール軸に絞る例（両テーマの同型も含む3組合せ）：

```powershell
npm run simulate -- --mode archetype --archetypes "対単一属性メタ,クール軸" --matches-per-matchup 10 --seed 1 --out simulation-results/meta-cool
```

既存データにはキュート軸・ユーモア軸の独立テーマはないため、未登録のテーマ名を指定するとエラーになります。生成されたチームの属性構成も参照してください。

新規対戦をせず27チームと選択理由だけ見る：

```powershell
npm run simulate -- --mode archetype --generate-only --seed 1 --out simulation-results/teams
```

`random/` と `archetype/` に次のCSVを追加しています。これらも `analysis.xlsx` に入ります。

- `cpu_strategy_stats.csv`：CPU戦略とテーマごとの勝率・平均ポイント・Appeal。
- `charge_round_trace.csv`：各ラウンドの配置、ステージ入り、チャージ前後・消費・B回復。
- `charge_idol_stats.csv`：CPU別の平均最大チャージ、3以上到達率、消費回数、B回復回数、R5登場率・R6BACKS率・R7再登場率。

チャージ戦略は公開済み状態を使う固定評価であり、相手の未確定配置や将来の楽曲を読みません。検証内容・追加カード修正・メタ3候補は [今回の実装確認](docs/simulation/charge-review.md) にあります。

## 11. 高速実行

通常CPU・CHARGE CPUの候補キャッシュ、計算用コピーの削減、属性/位置判定の軽量化は常に有効です。候補数、評価順序、同値時の乱数、ゲームルールは維持します。

勝率・カード・楽曲の基本統計が目的なら `--fast-simulation` を追加できます。

```powershell
npm.cmd run simulate -- --mode random --random-matches 1000 --seed 1 --fast-simulation --out simulation-results/random-fast
```

チャージ軸だけCHARGE CPUで、各組合せ10戦を高速実行：

```powershell
npm.cmd run simulate -- --mode archetype --cpu-strategy charge-archetype --matches-per-matchup 10 --seed 1 --fast-simulation --out simulation-results/archetype-fast
```

PCに余裕があれば `--workers 4` を追加してください。workerでも同じ高速設定を適用し、seedは維持します。

fastでは実試合の効果記録とチャージ履歴を省略します。カード/BURST/AUTO/CENTER・楽曲・勝率・CPU戦略別統計、配置、ポイント、Appeal、疲労は保持します。`charge_round_trace.csv` と `charge_idol_stats.csv` はヘッダーのみとなり、Excelでもチャージ詳細は未計測です。回復回数・R5/R6/R7のチャージ運用を調べる場合はfastを外してください。空欄は0を意味しません。

再開時にも同じ `--fast-simulation` を指定します。途中で記録設定を切り替える再開は拒否します。

```powershell
npm.cmd run simulate -- --mode random --random-matches 1000 --seed 1 --fast-simulation --resume --out simulation-results/random-fast
```

チャージ軸の編成は渡邉美穂・渡辺莉奈・平尾帆夏の固定3コア＋ステージ支援5人へ更新しています。竹内は例外採用可、CENTER役を最低1人確保。以前のチャージ軸を含む結果とは予定入力が変わるので、混在せず新規実行してください。変更内容と生成3候補は [高速化・編成の確認](docs/simulation/fast-review.md) を参照してください。

## 12. 二段階評価で候補を絞る

最新版では、結果を変えない共有engineの追加高速化も常時有効です。さらに速くしたい場合は `--cpu-search two-stage --preview-candidates 200` を指定します。

1. 合法な全候補（通常6,720）を概算で順位付け。
2. 上位200候補だけ、従来のpreviewと通常/CHARGE CPUの評価方式で精密比較。

上位数は100〜300の整数。既定は200です。この方式は候補を絞るので、全候補評価とCPU配置・試合結果が変わる可能性があります。指定しない場合、ブラウザのCPU・おすすめ配置を含め従来の全候補評価を維持します。

チャージ詳細を残す900試合の実行例：

```powershell
pnpm.cmd simulate -- --mode archetype --matches-per-matchup 20 --cpu-strategy charge-archetype --seed 1 --cpu-search two-stage --preview-candidates 200 --workers 8 --out simulation-results/archetype-900-charge-v4
```

`--workers 16` も使用可能です。起動時の `[settings]` が実際に読み取った設定、開始時の `workers=` が起動するworker数です。進捗の `games/min` は新しく完了した試合数/実行時間で、最初の起動時間も含みます。CPU使用率だけで判断せず、同じ対戦条件での速度とメモリを比べてください。

同じ実行の再開：

```powershell
pnpm.cmd simulate -- --mode archetype --matches-per-matchup 20 --cpu-strategy charge-archetype --seed 1 --cpu-search two-stage --preview-candidates 200 --workers 8 --resume --out simulation-results/archetype-900-charge-v4
```

途中でworker数は変更できます。探索方式・上位候補数・fast設定は同じにしてください。checkpointでは混在を拒否します。試合結果にも `cpuSearch`、summaryにも設定を記録し、analysis.xlsxへ説明を入れます。勝率がCPU探索の違いで変わる可能性を踏まえ、全候補評価と二段階評価の結果を分けて解析してください。

二段階CPUの概算で村井の登場免疫を反映する修正を入れ、policyを `two-stage-v2-entry-immunity` に更新しています。旧 `two-stage-v1` の結果への再開は拒否します。修正版は別の `--out` で実行してください。通常の全候補評価は変更していません。[予測条件の確認と修正内容](docs/simulation/preview-condition-audit-20261013.md) を参照してください。

K「ジャマイカビール」とS「NO WAR in the future」はBURST専用の特殊曲です。全22曲のデータは残し、UI・RANDOM・全ARCHETYPEの通常選択は20曲だけです。遠藤光莉/濱岸ひよりのBでは次の曲をK/Sに変更でき、そのラウンドは通常デッキを抽選・消費しません。通常ENCOREの抽選候補にも入りません。

特殊曲の選択ルール変更前のv3などの結果とは入力データが異なります。今回の最新版では以前のcheckpoint再開を拒否するため、v4など新しい保存先で実行してください。`--overwrite` は以前のcheckpointを上書きするので、結果を残したいときは新しい保存先を使ってください。

検証結果は [追加高速化の確認](docs/simulation/second-speed-review.md) にあります。

## WARによる勝利貢献度の分析

実在カードとのpaired比較を、基本診断→RANDOM→指定カード詳細の3段階で実行できます。詳細は [WAR分析のWindows手順](docs/simulation/WAR.md) を参照してください。既存checkpointを使う `--war-only` はbaselineを再実行しません。通常CPU・CHARGE CPU・カード性能の変更はありません。

## 文言統一Excelと構築更新（2026-10-10・履歴）

最新カード性能・効果方向による構築と [27チームの全選出理由](docs/simulation/normalized-balance-20261010.md) を反映。旧結果と混在せず、異なる `--out` で開始してください。構築には勝率・WARを使用しません。

```powershell
pnpm.cmd simulate -- --mode archetype --generate-only --seed 1 --out simulation-results/latest-generator
```

試合を行わず構築を確認できます。各エントリーの `scores` は構築点・seed補正・順位点、`reasons` は実効果と対象に基づく選出理由です。

## 最終確定Excel（2026-10-11）

`案_48人22曲_Codex実装用_最終確定_20261011.xlsx` を反映。最新の仕様・変更点・全27チームの選出理由は [最終確定版の確認](docs/simulation/final-balance-20261011.md) を参照してください。谷口はJOYFUL LOVEで元の属性に戻り、チャージBは人間が交換先を選択し、CPUは公開盤面で比較します。今回消費していない場合のチャージ回復は最後の消費値を使います。通常CPUの配置評価方式・楽曲性能は維持。旧結果と混ぜず新しい出力先を使ってください。

## 実カタログの確認

generate-onlyを含む出力に `catalog-snapshot.json`（実入力48人・22曲）と参照元・仕様fingerprintを保存します。10月10日のnormalized文書は履歴、現在の正本は10月11日最終確定Excelと回答済み裁定です。[全48人の照合と確認コマンド](docs/simulation/catalog-sync-audit-20261011.md) を参照してください。


## BURSTを考慮するCPUと起用分散（2026-10-13）

通常CPU・CHARGE CPUの判断方式は維持しています。`burst` は本番engineで今回の終了処理・BURSTを予測し、次回の公開楽曲候補と限定した合法配置を評価する別戦略です。相手の未確定配置・非公開の曲順は読みません。R7終了後のBURST価値は0です。通常より計算が重く、実際の勝率を保証する予測ではありません。

まず1試合だけ：

```powershell
pnpm.cmd simulate -- --mode random --random-matches 1 --cpu-strategy burst --seed 1 --out simulation-results/burst-check
```

全テーマをBURST考慮CPUで検証するコマンド（実行は自分のPCで）：

```powershell
pnpm.cmd simulate -- --mode archetype --matches-per-matchup 10 --cpu-strategy burst --archetype-selection balanced --seed 1 --out simulation-results/archetype-burst
```

`burst-archetype` はバースト軸だけ新CPU、その他は通常CPUです。弱い3軸にも新CPUを使いたい場合は `burst` を指定してください。両CPUとも同じチームを使う比較には、同じseed・`--archetype-selection`・試合数・探索設定で `--cpu-strategy normal` を別の出力先へ実行します。

新CPUの既定は `--cpu-search two-stage --preview-candidates 100`。R1～R6の一次評価は本番engineの今回終了＋公開次曲1候補・配置維持の予測で順位付けし、上位100候補を公開曲候補全体・次回最大86配置で評価します。未知の次曲、次回CPU配置、抽選結果、絞り込みの精度には限界があります。`--cpu-search exhaustive` は今回の全合法配置を精密評価するため非常に重くなります。normal/chargeの既定探索は変更していません。

`burst_cpu_round_trace.csv` は今回の符号付き得点、Appeal差、次回平均、BURST予測、選択配置とpolicyを記録します。正値は自軍の得点、負値は相手の得点です。予測の`side`は物理P1/P2、`team`はmirror前のA/Bです。既存の `charge_round_trace.csv` は実測です。`--fast-simulation` でも新CPUの判断記録は保存し、チャージの実測traceは省略します。CSVはanalysis.xlsxとanalysis_bundle.jsonにも入ります。

編成生成だけを確認する（対戦なし）：

```powershell
pnpm.cmd simulate -- --mode archetype --generate-only --seed 1 --archetype-selection balanced --out simulation-results/decks-balanced
```

`balanced` は全27チームで起用を分散する既定設定です。戦術コアと明示した固定支援、村井の登場保護、属性条件・チャージ支援条件を守り、役割に合う候補だけで偏りを減らします。役割構築スコアからの低下は4以内。強い軸は条件付き支援、弱い軸は序盤得点・疲労対策を補い、候補ごとの8人セットを変えます。勝率/WARは27チームの生成に使いません。全員を同数にすることや全員採用は強制しません。`archetype/team_coverage.csv` に従来/新チームの採用数・予定対戦での採用回数を保存します。これは生成上の機会であり実測勝率ではありません。

`--archetype-selection legacy` で以前の生成方式を比較できます。RANDOM構築は変更していません。カード性能は田村Bの確定変更を含む現行データ共通なので、legacyは旧カード性能の復元ではありません。田村変更前のcheckpointは入力fingerprint不一致で拒否します。新しい出力先で実行してください。再開時は同じ設定＋`--resume`を使い、追加なしの確認には`--max-new-matches 0`を指定します。

ブラウザは開始画面の「CPU・おすすめ配置の思考」で「BURSTを考慮」を選びます。検証用27チームを維持し、構築済み12デッキは[別枠の提案](docs/simulation/constructed-decks-20261013.md)で、役割と旧WARを参考に強さを近づけます。まだ12デッキをUIへ登録していません。


## チャージ軸だけCHARGE、その他はBURST CPU

```powershell
pnpm.cmd simulate -- --mode archetype --matches-per-matchup 10 --cpu-strategy burst-charge-archetype --seed 1 --out simulation-results/archetype-burst-charge
```

`burst-charge-archetype` はチームごとに判定し、チャージ軸だけ既存CHARGE CPU、その他8軸はBURST CPUを使います。チャージ同士は両方CHARGE、mirrorでもチームに対応するCPUを維持します。CPU自体の評価式は変更しません。RANDOMにはチャージ軸の指定がないため、RANDOM側は全チームBURST CPUです。

探索設定は両CPU共通で、既定は二段階100候補です。以前のCHARGEが全候補評価だった場合、この既定では探索精度が異なります。同じ精度で比較するときは以前と同じ `--cpu-search` と `--preview-candidates` を明示してください。`--cpu-search exhaustive` で両方を全候補評価できますが、BURST CPUの全候補評価は非常に重くなります。

従来の `charge-archetype` はチャージ以外が通常CPUで、今回の組み合わせとは異なります。以前の結果へ追記せず、別の `--out` を使ってください。
