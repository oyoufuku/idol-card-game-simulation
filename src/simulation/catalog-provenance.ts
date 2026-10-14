import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {IDOLS} from '../data/idols';
import {SONGS} from '../data/songs';
import {INPUT_FINGERPRINT} from './input-fingerprint';
import {json} from './output';
export function catalogProvenance(){
 const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');let gitCommit:string|null=null;
 try{gitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,stdio:['ignore','pipe','ignore'],timeout:2000}).toString().trim();}catch{/* ZIP downloads may have no Git metadata. */}
 return {specification:'burst_proposals_48cards_3options_20261014.xlsx（追記版）＋チャット確定変更',memberSheet:'docs/simulation/balance-overrides-20261014.json',originalWorkbook:'案_48人22曲_Codex実装用_最終確定_20261011.xlsx',songSheet:'Codex用楽曲',
  cardDefinitionsFile:'src/data/idols.ts',songDefinitionsFile:'src/data/songs.ts',repositoryRoot,gitCommit,inputFingerprint:INPUT_FINGERPRINT,
  constructionPolicy:'effect-aware-v6-role-fit-coverage',historicalDocument:'docs/simulation/normalized-balance-20261010.md（履歴）',currentDocument:'docs/simulation/reviewed-burst-20261014.md',
  usesFixtureAsInput:false,usesWorkbookAsRuntimeInput:false,usesGeneratedJsonAsConstructionInput:false,
  confirmedRulings:[
   {cardIds:[19],rule:'2026-10-13チャット確定：条件/抽選は相手BACKSのBURST開始。対象を次のパフォーマンス終了までCENTER固定・Bのみ無効（A/Cは有効）、元CENTERはBACKSへ。Appeal減少なし。終了時の条件/強制B効果も無効。完了済みの回復・移動・永続補正等は巻き戻さない。'},
   {cardIds:[5],rule:'JOYFUL LOVEでキュート上書きを解除して元の属性へ戻す。PLAINが最優先。'},
   {cardIds:[16],rule:'BURST終了時の基礎低下・使用済みリセット後、同じ終了処理の条件判定で成立すれば再BURST。条件成立中は毎ラウンド可能。'},
   {cardIds:[32,38,44],rule:'合法BACKSと交換後、最後に実消費したチャージまで回復。今回未消費でも同じ。既にBACKSなら回復のみ。次の編成で再配置可能。'},
   {cardIds:[47],rule:'ステージ5人の累計BURST履歴が条件。本人と連鎖内発動済みを除くステージからランダム3人を強制BURST。共通ルール末尾の旧4人全員は採用しない。'}]};
}
export function saveCatalogSnapshot(out:string,source:ReturnType<typeof catalogProvenance>){
 json(resolve(out,'catalog-snapshot.json'),{source,inputFingerprint:INPUT_FINGERPRINT,idols:IDOLS,songs:SONGS});
}
