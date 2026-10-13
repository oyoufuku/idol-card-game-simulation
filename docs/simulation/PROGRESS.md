# 過去のローカル実行用チェックポイント（2026-10-08）

**2026-10-09：修正Excelをカードへ上書きしたため、以下の保存結果は現在の性能を表しません。旧ZIPの再開は拒否します。最新版は [CHARGE・メタ実装確認](charge-review.md)、PC用実行は [SIMULATION.md](../../SIMULATION.md) を使用してください。**

**現在の目的はWindows PCでの実行。Cloudで大規模シミュレーションを追加しない。** 利用枠をこちらから自動監視する機能はない。

## 保存状況

- RANDOM100戦完了（元の約255.34秒、P1 53勝 / P2 47勝）。
- ARCHETYPEは今回の整備開始時にすでに450戦完了していた（P1 225勝 / P2 220勝 / 5引き分け）。196戦から再開した以前の実行の保存。今回追加実行したものではない。
- ARCHETYPE時間は前半101戦を含まない `incompleteTiming=true`。450戦全体の正確な時間は不明。
- Cloudの保存先は `simulation-results/final/`。最新100/450戦のPC用ZIPは `local-checkpoints.zip`、196戦時点は `interim/checkpoints.zip`。
- 既存結果の解析用Excelは `latest/analysis.xlsx`。全仕様・27チーム・両モード統計を含む。通常のチャットに添付できる。

## 今回の確認

- 149テスト成功、型チェック・ビルド成功。
- 新規RANDOMは1戦・10戦のみ。
- 196戦のバックアップを別フォルダーで再開し、2戦追加の198戦で停止。元196レコードが完全一致することを確認。
- 100/450戦は `--max-new-matches 0` で再集計し、追加対戦0件。
- 過去CSV/ExcelのsampleStatusを20未満/20〜49/50以上の3段階へ更新。試合数・勝敗・勝率の保存値は維持。
- ゲーム本体・能力・数値・CPU探索ロジックは変更なし。

PCでのインストール・展開・再開コマンドは [SIMULATION.md](../../SIMULATION.md)、CPU・仕様確認は [local-review.md](local-review.md) を参照する。大量試合は今後ユーザーのPCで実行する。
