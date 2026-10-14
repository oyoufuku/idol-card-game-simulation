# GitHub ActionsでのB条件・構築済みデッキ・WAR実行

`Balance simulation` workflowは、基準試合、LEVEL 1、LEVEL 2、指定カードだけのLEVEL 3を同じ結果Artifactへ順番に保存する。各段階の`resume_run_id`には、直前の成功またはpartial run IDを指定する。commit、カード入力fingerprint、seed、CPU、構築、探索方式、試合予定、保存ファイルのSHA-256が一致しないArtifactは拒否する。

## B条件

GitHubの同時実行枠は、CUSTOM＋constructedの構築済みデッキと、それ以外の検証用ARCHETYPE/RANDOMで分離する。異なる系統は別runnerで並行実行でき、同じ系統は1実行ずつ進める。`cancel-in-progress: false`を維持し、進行中の結果を自動キャンセルしない。L1/L2/L3はそれぞれの基準Artifactが完了してから進める。

Bは次の固定条件を使う。

- balancedの9軸×3候補＝27チーム
- RANDOM 1,000試合
- ARCHETYPEは同型込み45組×20試合＝900試合
- チャージ軸だけCHARGE CPU、ほかは通常CPU
- seed 1、workers 4、fast simulation、BURST round trace

基準実行のinputsは次のとおり。

```text
scenario: B
mode: all
matches_per_matchup: 20
random_matches: 1000
seed: 1
workers: 4
fast_simulation: true
burst_round_trace: true
cpu_search: two-stage
preview_candidates: 100
max_new_matches: 0
analysis_level: baseline
runtime_minutes: 300
```

## 構築済み12デッキ

`docs/simulation/constructed-decks-20261014.md`の「9軸各1デッキ＋櫻坂選抜＋日向坂選抜＋指定8人」の12デッキを使用する。9軸の72枠だけで48人全員を1〜2回ずつ起用する。メンバー8人・選択曲3曲は対戦中に変更しない。同一デッキ戦を含む78組を各50試合、mirror込みで実行するため、ARCHETYPEは3,900試合になる。RANDOMは別に1,000試合を実行する。

CPUは「チャージ・序盤安定」だけCHARGE CPU、ほか11デッキとRANDOMは通常CPUを使う。BURST CPUは使わない。旧12デッキのArtifactとは構築仕様・予定試合hashが異なるため再開できない。新しいbaselineを別runとして開始する。

```text
scenario: CUSTOM
mode: all
archetype_selection: constructed
cpu_strategy: charge-archetype
matches_per_matchup: 50
random_matches: 1000
seed: 1
workers: 4
fast_simulation: true
burst_round_trace: true
cpu_search: two-stage
preview_candidates: 100
max_new_matches: 0
analysis_level: baseline
runtime_minutes: 300
```

5時間で完了しなければ、作成されたrunのArtifactを次の`resume_run_id`に指定し、同じinputsで`analysis_level: baseline`を再実行する。完了済み試合は再実行しない。

## LEVEL 1

基準ArtifactがRANDOM・ARCHETYPEとも`complete: true`になってから実行する。基準と同じscenario、mode、構築、CPU、試合数、seed、fast、trace、探索条件を入力し、次だけ変更する。

```text
analysis_level: level1
resume_run_id: 直前のrun ID
war_samples_per_card: 50
war_workers: 4
war_max_new_jobs: 0
```

全48カードのARCHETYPE cWARを実行し、詳細検査候補を出す。AUTO/BURST/CENTER除外やペア相乗効果は自動実行しない。

## LEVEL 2

LEVEL 1が`complete: true`になってから、同じ基準条件と直前run IDを使う。

```text
analysis_level: level2
resume_run_id: 直前のrun ID
war_samples_per_card: 50
war_workers: 4
war_max_new_jobs: 0
```

RANDOM WARを追加し、ARCHETYPEと単純合算せず`synergyDependency`を出す。L2完了後に`analysis_bundle.json`を確認し、LEVEL 3対象を相談する。

## LEVEL 3

LEVEL 3はL2完了後も自動開始しない。相談して決めたIDだけを指定する。

```text
analysis_level: level3
resume_run_id: LEVEL 2のrun ID
war_detail_ids: 例 1,7,25
war_skill_ablation: AUTO,BURST,CENTER,ALL
war_pairs: 任意。例 1:7,7:25
```

段階を飛ばした実行、別commitや別試合条件のArtifact、破損・改変されたArtifactは開始前に拒否する。

