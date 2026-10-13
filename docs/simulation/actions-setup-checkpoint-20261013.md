# GitHub Actions準備の引き継ぎ（2026-10-13）

GitHub API設定変更のため中断した作業を再開し、workflow・実行helper・運用資料を実装しました。公開設定・既存履歴・ゲーム本体は変更していません。

- ブランチ：`codex/actions-simulation-20261013`。ベース：main `78c26e2`。
- 実装：`.github/workflows/simulate.yml`、`scripts/actions-simulation.ts`。
- 操作手順：[REMOTE_SIMULATION.md](../../REMOTE_SIMULATION.md)。
- 公開前調査・個人メール対応案：[public-readiness-20261013.md](public-readiness-20261013.md)。
- CPU既定/C：チャージ軸はCHARGE、その他はBURST。A=legacy/normal、B=balanced/normal。
- 自動テスト：Actions入力・復元・checksum・破損・実CLI少数試合・再開を検証。

## 中断時に見つかっていた問題の対応

- Actionsのmax_new_matches=0は残り全部、内部の集計だけのCLI呼び出しは追加0試合として区別。
- 複数Artifactは混ぜず、同じrunの最新attemptを選んで厳密に照合。
- Node 24を先に用意し、pnpm 11.19.0でfrozen install。
- Actionを検証済みcommit SHAへ固定。checkoutの認証保存を無効化。
- uploadのファイル欠落をエラーとし、upload結果をSummaryへ明示。
- 中断書き込みのJSONL末尾・summary退避、時間予算停止、条件不一致拒否を検証。
- 各runのログ・実行条件・速度をresume後も保持。

## 残る運用上の確認

手動起動にはworkflowのdefault branchへの登録が必要です。GitHub側の少数試合・Artifact upload/downloadは実際のrunで確認してから完了扱いにします。PR未mergeの段階でGitHubがdispatchを拒否した場合は未確認です。

Public化は個人メール2種類・開発資料の公開方針決定後にユーザー自身が行います。履歴書き換えは無断で行いません。100試合の速度測定・900/2250/5000試合は未実行で、Public対応・費用確認後に手動で開始します。

環境が変わった場合、GitHub認証や一時ファイルの存在を前提にせず、読み取りから再確認してください。詳細な最終検証結果はPRの説明を参照してください。

## 最終検証結果

- `pnpm test`：35ファイル、344テストすべて成功。
- `pnpm build`：TypeScript・Viteとも成功。
- actionlint 1.7.12によるworkflow構文検証：成功。
- 実CLIのRANDOMを1試合保存→Artifact相当のコピーから再開して1試合追加。2試合完了、再利用1/新規1、checkpointの元レコードを保持。
- Excel・分析bundle・CSV・checkpoint・条件・checksumの保存と、不一致条件の再開拒否を検証。
- GitHubへのpush：成功。branch上のworkflowをContents APIで読み取れることを確認。
- GitHubへの1試合限定dispatch：HTTP 404。default branch未登録（workflow一覧0件）のため、リモート実行・Artifact upload/downloadは未確認。mainへの取り込み後に初回2試合と再開を確認する。
- 100試合ベンチマーク・大規模バランス対戦は実行していない。既存の自動テストは全件実行。
- ゲーム・カード・楽曲・CPU・構築済み12デッキは変更なし。新規コミットはnoreply作者情報を使用。
