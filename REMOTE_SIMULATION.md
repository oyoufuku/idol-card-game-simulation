# GitHub Actionsでシミュレーションする

PCを起動したままにせず、GitHubの標準Linuxランナーで既存CLIを実行します。ゲーム・カード・楽曲・CPUの計算は変更していません。初回は2試合までに制限します。

**この公開用リポジトリは、Private開発リポジトリの過去履歴を含まない1コミットのスナップショットとして作成しました。公開前に行った調査は[公開前調査](docs/simulation/public-readiness-20261013.md)に保存しています。**

## 初回の実行

1. GitHubで **Actions → Balance simulation → Run workflow** を開き、mainを選びます。
2. 初回は以下でRun workflowを押します。

| 項目 | 初回の値 |
| --- | --- |
| scenario / mode | C / archetype |
| matches_per_matchup / seed | 2 / 1 |
| workers | 0（CPU数から自動、最大4） |
| fast_simulation | true |
| cpu_search / preview_candidates | two-stage / 100 |
| max_new_matches / runtime_minutes | 2 / 10 |
| retention_days / resume_run_id | 7 / 空欄 |

`max_new_matches`は**今回追加する試合数の上限**です。2なら2試合で止まり、予定全体は未完了として保存します。`0`なら時間予算内で残りすべてを実行します。**ローカルCLIの `--max-new-matches 0` は「追加なしで集計」で、Actions入力の0とは異なります。**

`matches_per_matchup`はmirror込みの偶数です。9テーマの同テーマ戦を含む45組で、2なら90試合、20なら900試合、50なら2,250試合を予定します。各テーマ3候補・27チームを順番に使用します。27チームの全ペアをそれぞれ同じ回数戦わせる方式ではありません。

Privateの実行は契約プランの利用枠・課金条件に従います。最小確認以降の大量試合はPublic対応・費用確認後に手動で開始してください。

## A / B / Cの比較

| scenario | 構築 | CPU |
| --- | --- | --- |
| A | legacy | normal |
| B | balanced | normal |
| C | balanced | **チャージ軸はCHARGE、その他はBURST** |
| CUSTOM | archetype_selectionの指定 | cpu_strategyの指定 |

最新指示に合わせ、Cは `burst-charge-archetype` です。A/B/Cでは構築とCPUを上表で確定し、個別のarchetype_selection/cpu_strategy入力は使いません。全条件で現行の同じカード性能を使用します。seed・試合数・探索・候補数・高速化設定を揃えて比較します。

CUSTOMのCPUはnormal、charge-archetype、burst、burst-charge-archetypeを選べます。RANDOMはチャージ軸指定がないため、charge-archetypeは通常CPU、burst-charge-archetypeはBURST CPUになります。RANDOMの初回はCUSTOM/random、random_matches=1、max_new_matches=1で試せます。

## 結果の保存

実行画面のArtifactsから `simulation-results-...` をダウンロード・展開します。名前にモード・CPU・構築・seed・日時・run ID・attemptを含みます。

- `summary.json`：予定・完了・新規・再利用数、実行条件、時間。
- `analysis.xlsx` / `analysis_bundle.json` / `CHAT_ANALYSIS.md`：チャット解析用資料。
- `random/` または `archetype/`：試合・アイドル・楽曲・タグ等のCSV。ARCHETYPEでは全チームと選出理由、CPU別統計、テーマ別勝率・相性表も保存。
- `*-checkpoint.jsonl`：試合ごとの再開用データ。
- `remote-manifest.json`：commit SHA、inputFingerprint、予定対戦hash、ファイルchecksum、再開履歴。
- `remote-status.json` / `REMOTE_RUN.md`：完了/途中/失敗、実機CPU・メモリ、worker、速度と推定時間。
- `run-<ID>-<attempt>.log` / `.json`：各回のCLIログ・条件・速度・状態（resume後も保持）。

保存期間は既定7日、入力で1〜90日に変更できますが、GitHub側の設定にも従います。期限前にローカルへ保存してください。途中結果は分析資料があっても完了ではありません。upload失敗はSummaryに警告します。Publicではログ・分析資料・Artifactsも公開され得るため、非公開にしたいデータを含めないでください。

## 中断・再開

1. 前回URLの `/actions/runs/123456789` の数字を控えます。
2. Run workflowで **前回と同じcommitのBranch/Tag** を選びます。更新されたmainはSHAが違うので使えません。再開用branch/tagも公開前調査の対象です。
3. 前回と同じscenario・mode・seed・CPU・構築・探索・候補数・高速化・**予定全体の試合数**を指定します。
4. `resume_run_id`へ数字を入れ、max_new_matches=2などで起動します。
5. 完了済みを再実行せず未完了だけ追記します。次回は**最後にArtifactを保存したrun ID**を指定します。

worker・今回の追加上限・時間予算・保存期間は変更可能です。それ以外の条件とchecksumが一致しなければ復元前に拒否します。同じrunのRe-runでは最新attemptのArtifactを選びます。期限切れ・削除・upload失敗のArtifactは再開できません。

分割実行はcheckpointを継承し毎回再集計します。独立ジョブのCSVを手作業で連結する方式ではありません。大規模WARや構築済み12＋αデッキは次の別作業で、現在のActions入力では自動起動しません。

`runtime_minutes`（1〜330、既定300）でCLIに中断を送り、完了済みcheckpointの集計・uploadを試みます。GitHubのジョブ上限は6時間です。インストール・集計・upload時間も必要なので余裕を残してください。

Cancel workflowでも保存を試みますが、GitHubの強制終了・runner障害・キャンセル猶予不足・upload失敗では保存できない場合があります。**時間予算による停止を優先**し、毎回Artifactを確認してください。未完了試合は再開時にやり直します。JSONL末尾の未完了書き込みだけ退避し、途中の破損行は拒否します。

## 100試合で速度測定（Public対応後に手動実行）

今回の準備では100試合を開始しません。初回確認後、A/B/Cをそれぞれ同じ条件で、matches_per_matchup=20、max_new_matches=100、resume_run_id空欄で実行すると100試合で停止します。worker=1/2/4を別の新規runで比較し、CPU数以内で実測が速い値を選びます。探索・候補数は変えません。

performanceには、新規試合の経過時間を並列処理後の試合数で割った壁時計平均と、900/2,250/5,000試合の推定秒数を記録します。さらにworker数を割る必要はありません。少数試合は参考値、0試合の推定はnullです。インストール・集計・upload時間、対戦ごとの速度差を考慮し、長い実行はresumeで分割します。**現在、CPU別100試合の実測値はありません。**

## 費用とPublic / Private操作

2026-10-13に現行GitHub公式資料を確認しました。

- Publicの**標準GitHub-hostedランナー**の実行は無料です。larger runnerはPublicでも有料。本workflowは標準ubuntu-latestです。
- 公称LinuxリソースはPublicが4 CPU / 16GB、Privateが2 CPU / 8GB。実機値をmetadataへ記録します。
- Privateはプランの無料分・超過課金に従います。Artifactストレージ・保存期間・Billingも確認し、すべての関連料金が無条件にゼロとは扱いません。
- GitHub.comの手動入力上限25個に対し、このworkflowは15個です。

Public化は[公開前調査](docs/simulation/public-readiness-20261013.md)の対応決定後、ユーザー自身が **Settings → General → Danger Zone → Change repository visibility → Public** で行います。

調整後は次の順でPrivateへ戻します。

1. 重要な結果・checkpointをローカルへ保存する。
2. Actionsの実行中・待機中ジョブがないことを確認する。
3. ユーザー自身がSettings → General → Danger Zone → Change repository visibility → Privateを実施する。
4. Private表示とログアウト状態でのアクセス制限を確認する。
5. PrivateのActions利用枠・Billingを確認する。
6. **Private確認後**に画像等を導入する。素材利用の権利確認は別途必要です。

公開中のFork・複製はPrivate化しても回収できません。

公式資料：[ランナー](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)、[制限](https://docs.github.com/en/actions/reference/limits)、[課金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)、[公開設定](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)。
