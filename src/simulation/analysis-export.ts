import { INPUT_FINGERPRINT } from './input-fingerprint';
import { mergeWarData } from './war-merge';
// Portable analysis package. No Python, browser or proprietary spreadsheet app required.
import { existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { zipSync,strToU8 } from 'fflate';
import { IDOLS } from '../data/idols';
import { SONGS } from '../data/songs';
import { json,csv } from './output';
import { sampleEvidence } from './samples';
export function parseCsv(text:string):Record<string,string>[] {
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(cell);cell='';}
  else if(ch==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(cell||row.length){row.push(cell);rows.push(row);}
 if(quoted)throw new Error('Unterminated CSV field');
 const header=rows.shift()||[];
 return rows.filter(r=>r.some(c=>c!=='')).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}
const xml=(v:unknown)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const col=(n:number):string=>n<26?String.fromCharCode(65+n):col(Math.floor(n/26)-1)+col(n%26);
const stringify=(v:unknown)=>v&&typeof v==='object'?JSON.stringify(v):v;
export function workbook(tables:{name:string;rows:Record<string,unknown>[]}[]):Uint8Array {
 const files:Record<string,Uint8Array>={},prefix='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const put=(name:string,value:string)=>{files[name]=strToU8(prefix+value);};
 put('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tables.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 put('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 put('xl/workbook.xml',`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((t,i)=>`<sheet name="${xml(t.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 put('xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
 for(const [i,t] of tables.entries()){
  const keys=Object.keys(t.rows[0]||{note:''}),rows:[...unknown[][]]=[keys,...t.rows.map(r=>keys.map(k=>stringify(r[k])))];
  const data=rows.map((r,j)=>`<row r="${j+1}">${r.map((v,k)=>{const ref=`${col(k)}${j+1}`,numeric=j>0&&((typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v)));
   return numeric?`<c r="${ref}"><v>${xml(v)}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('');
  put(`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultColWidth="18"/><sheetData>${data}</sheetData><autoFilter ref="A1:${col(keys.length-1)}${rows.length}"/></worksheet>`);
 }
 return zipSync(files,{level:6,mtime:new Date('2000-01-01T00:00:00Z')});
}
export function exportAnalysis(out:string){
 const summary=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));
 const gameRules=readFileSync(new URL('../../docs/current-spec.md',import.meta.url),'utf8');
 const archetypes=existsSync(join(out,'archetype/archetypes.json'))?JSON.parse(readFileSync(join(out,'archetype/archetypes.json'),'utf8')):[];
 const modes:Record<string,Record<string,Record<string,string>[]>>={};
 for(const mode of ['random','archetype'])if(existsSync(join(out,mode))){
  modes[mode]={};
  for(const name of readdirSync(join(out,mode)).filter(n=>n.endsWith('.csv')).sort()){
   const path=join(out,mode,name),rows=parseCsv(readFileSync(path,'utf8'));
   // Also upgrade old CSVs without running games or changing counts/win rates.
   if(name.endsWith('_stats.csv')||name==='archetype_matchups.csv'){
    for(const row of rows){const count=row.selections??row.teams??row.games;if(count!==undefined){for(const [key,value] of Object.entries(sampleEvidence(Number(count))))row[key]=String(value);}}
    if(rows.length)csv(path,rows);
   }
   modes[mode][name.slice(0,-4)]=rows;
  }
 }
 const definitions=[
  {項目:'目的',説明:'実際のゲームと共通のエンジン・CPUによる48人22曲のバランス観測。カード値は独自に調整していない。'},
  {項目:'CPU',説明:'通常CPUは公開済み状態の予測獲得ポイント→勝敗→Appeal差→終了時疲労。CHARGEはCLI専用の別戦略として蓄積・B回復・R5投入/R6復帰/R7再登場を固定評価。cpuStrategyは指定戦略。chargeでも消費型がいなければ通常評価へ戻る。CPU別に比較し、相手の未確定配置は見ない。'},
  {項目:'勝率',説明:'勝利数/チーム出場数。引き分けは分母に含む。割合は0〜1。採用0の行の0は弱さを意味しない。'},
  {項目:'採用勝率',説明:'そのカード/楽曲を選択したチームの試合勝率。因果的な単体性能ではない。'},
  {項目:'片側のみ採用',説明:'相手のチームがそのカードを含まないときだけの集計。'},
  {項目:'同型対戦',説明:'テーマ総合のgamesはチーム出場数。同型対戦は両側を数える。matchupsのgamesは実試合数。'},
  {項目:'mirror',説明:'同じseed・8人・3曲・デッキ・チーム別乱数を維持してP1/P2を入れ替える。10戦は5条件×2。'},
  {項目:'平均Appeal',説明:'試合全7ラウンドの合計の平均。'},
  {項目:'平均BURST',説明:'通常+強制の発動回数。burstRateは1回以上発動した試合の割合、averageBurstsは1試合平均回数。'},
  {項目:'AUTO/CENTER',説明:'実際の効果が発生したパフォーマンス単位。1人につき1ラウンド最大1。'},
  {項目:'タグ',説明:'最新のCodex用メンバー (修正) のタグ3/4・能力・基礎値を使用。カードは上書き、旧結果は最新性能の比較に使用しない。'},
  {項目:'候補の作り方',説明:'チャージ軸は渡邉美穂・渡辺莉奈・平尾帆夏の固定コア＋BACKS非依存の支援5人（竹内例外）、CENTER役を確保。他の通常7テーマは主タグ3人以上、能力の対象を区別した固定スコア。多属性は3属性必須。対単一属性メタは主タグ2人を核に3候補。試合結果からの最適化なし。'},
  {項目:'少数標本',説明:'各マッチアップ10戦は動作確認規模。優劣を断定せず、採用数・編成依存・CPUの限界を併記する。'},
  {項目:'sampleStatus',説明:'sampleCountは勝率の分母（selections/teams/games）。20未満insufficient、20〜49 provisional、50以上sufficient。sufficientSamples=trueは50以上だけ。同型・mirrorの標本は独立ではなく、この表示は統計的有意性を保証しない。'},
  {項目:'列の名前',説明:'selections=採用数、exclusiveSelections=片側のみ採用数、stage=ステージ回数、normalBURST/forcedBURST=通常/強制回数、BURST_READY=条件成立回数（READY待機は廃止）。'},
  {項目:'構築の起用分散',説明:'team_coverageは全チームでの採用数と予定対戦での採用機会。実測勝率ではない。balancedは固定コアと戦術の条件を維持し、元の支援枠より構築スコア低下4以内の合法な差し替えで偏りを緩和。回数一致や全員採用は強制しない。legacyで以前の生成を比較可能。'},
  {項目:'BURST考慮CPU',説明:'cpuStrategy=burstは今回終了・BURSTを本番engineで処理し次回を予測する別戦略。今回の符号付き得点×12・勝敗×2・Appeal差×0.25と、次回平均の0.6倍を比較。R6では予測最終勝敗も評価。公開楽曲候補と相手公開配置が基準で実際の勝率ではない。burst_cpu_round_traceは予測、charge_round_traceは実測。通常/CHARGEは不変。'},
  {項目:'チャージ観測',説明:'charge_idol_statsはCPU別カード別のチーム出場数が分母。最大チャージは開始/終了/消費の最大値、消費は正のチャージを使うBACKSからの登場、B回復は本人Bによる実増加。R5/R7登場率はBACKSからの登場、R6BACKS率は選択配置。charge_round_traceで実適用値を確認。'},
  {項目:'高速実行',説明:'configuration.fastSimulation=trueでは効果記録・charge traceを省略し、chargeTelemetryAvailable=false。チャージ専用CSV/シートの空欄は未計測であり0ではない。通常の勝率・ポイント・Appeal・疲労・BURST・AUTO/CENTER・CPU戦略統計は保持。候補数・判断順序・乱数は変えない。'},
  {項目:'二段階CPU探索',説明:'configuration.cpuSearch.mode=two-stageは全合法候補を概算し上位100〜300だけ既存previewで精密評価する近似探索。既定exhaustiveとはCPU配置と結果が変わり得る。previewCandidatesとpolicyを試合結果にも記録。同方式・候補数で比較し、従来の全探索と混ぜない。概算は完全な効果相殺・コピーAUTO・終了時疲労・反応BURST予測を省略し、精密評価で処理する。'},
  {項目:'特殊楽曲',説明:'データは22曲保持し、選択可能は20曲。ジャマイカビール(K)とNO WAR in the future(S)はBURSTによる変更専用。通常3曲/通常抽選/ENCORE抽選候補から除外。song_statsは選択3曲の採用勝率。特殊曲の実演奏はmatches.csvのplayedSongsに記録し、採用勝率とは区別する。'},
  {項目:'出力範囲',説明:'このファイルの実行概要が実際の試合数と時間の正本。RANDOMとARCHETYPEを混ぜて勝率を計算しない。'},
 ];
 const warSummary=summary.cardWar,warRuns=summary.warRuns??(warSummary?[warSummary]:[]);
 const warInputs=warRuns.map((run:{output:string;inputFingerprint?:string;baselineHash?:string;options?:{modes?:string[]}})=>{
  if(run.inputFingerprint!==INPUT_FINGERPRINT||(summary.inputFingerprint&&run.inputFingerprint!==summary.inputFingerprint))throw new Error('WAR fingerprint mismatch in analysis export');
  if(warSummary?.baselineHash&&run.baselineHash!==warSummary.baselineHash)throw new Error('WAR baseline mismatch in analysis export');
  const path=join(resolve(out,run.output),'statistics.json');if(!existsSync(path))throw new Error(`WAR statistics not found: ${path}`);
  return {data:JSON.parse(readFileSync(path,'utf8')),modes:run.options?.modes??['random','archetype']};
 });
 const warData:Record<string,Record<string,unknown>[]>=warInputs.length?mergeWarData(warInputs):{};
 if(warInputs.length)csv(join(out,'card_war_mode_comparison.csv'),warData.card_war_mode_comparison);
 if(warSummary)definitions.push(
  {項目:'WAR実行レベル',説明:'LEVEL 1 --card-war はARCHETYPEの実在代替だけ。LEVEL 2 --random-card-war は別実行。LEVEL 3 --war-detail-ids 指定のみ能力除外/BURST詳細/ラウンド別、ペアは --war-pairs の指定だけ。nWAR/sWARの独立実装なし。追加候補はdetail_candidatesで表示し自動実行しない。段階別結果は合算せずモード・カード別に最も標本の多い行を採用する。'},
  {項目:'Card WAR',説明:'同seed・相手・楽曲・P1/P2・CPUでカード1枚だけ合法代替しR1から再配置。Win=1 Draw=0.5 Loss=0。cWARはactual−replacementの合計、cWARPer100はpairedSamplesで割り100倍。採用勝率とは別。代替なし/未実行はnullで弱さを意味しない。'},
  {項目:'WARのモード分離',説明:'card_war_stats/archetypeCardWARはARCHETYPEのみ、random_card_war_stats/randomCardWARはRANDOMのみ。単純合算は禁止。synergyDependencyはARCHETYPE cWARPer100−RANDOM cWARPer100。片側未測定ならnull。標本不足・代替条件・CPU/編成差を併記し、カードの強弱を断定しない。'},
  {項目:'WAR代替',説明:'ARCHETYPEは構築条件を維持し主テーマ共通→同役割→テーマ全体を既存generatorスコアで順位付けして中央値。チャージ固定コア等は代替なし。RANDOMは同属性&基礎値差±1→同属性→基礎値差±1→合法未採用プール、warSeedで選択。tier/候補はwar/plan.jsonとpaired_trials.jsonに記録。勝率不使用。'},
  {項目:'pWAR/aWAR',説明:'同じpaired試合の獲得ポイント/7ラウンドAppeal差の平均×100。勝利価値cWARとは別単位。Round Valueは対象チーム全体のラウンドAppeal/ポイント差（本人だけではない）。'},
  {項目:'WAR信頼区間',説明:'95% paired cluster bootstrap。actual/replacementの差分を保持し、mirror・両チームを同じseed/pair単位で再抽出。warSeedから決定しworker数不依存。sampleStatusはpairedSamplesで判定し、少数clusterの退化区間やsufficientでも有意性・因果一般化を保証しない。'},
  {項目:'BURST WAR',説明:'BURST条件と能力を本人・自チーム限定で除外したpaired差。発動頻度burstRateと因果比較を分離。主指標は試合単位のcombined BURST WAR。通常/強制寄与を二重計上しない。WhenTriggeredはactualで発動した試合に条件付けた値で選択バイアスがあり、全採用のWARと区別。winDeltaPerBurstActivationは因果効果の参考分割値で主指標にしない。発動ラウンド別はそのラウンドで発動した試合の全試合差で、多ラウンド発動試合を含むため加算不可。記録なしはtraceUnavailableGames。'},
  {項目:'Skill Ablation/ペア',説明:'別オプション。対象チーム本人のA/B条件と能力/C/ALLを除外し属性・基礎値を保持。B除外でも他人による強制BURSTの共通疲労リセット・回数は残る。A/B/CのWARは加算できない。ペアは4条件の勝利価値交互作用で、代替重複を避ける。'}
 );
 const comparison=existsSync(join(out,'idol_comparison.csv'))?parseCsv(readFileSync(join(out,'idol_comparison.csv'),'utf8')):[];
 const tables:{name:string;rows:Record<string,unknown>[]}[]=[{name:'まず読む',rows:definitions},{name:'共通ルール',rows:gameRules.split('\n').filter(Boolean).map(line=>({現在仕様:line}))},{name:'実行概要',rows:Object.entries(summary).map(([key,value])=>({項目:key,値:stringify(value)}))},{name:'カード比較',rows:comparison},{name:'メンバー仕様',rows:IDOLS.map(c=>({...c,tags:c.tags.join(' / '),themeTags:c.themeTags.join(' / ')}))},{name:'楽曲仕様',rows:SONGS.map(s=>({...s,tags:s.tags?.join(' / ')}))}];
 if(archetypes.length)tables.push({name:'全チーム',rows:archetypes.map((t:{name:string;mainTags:string[];subTags:string[];members:{name:string}[];songs:{name:string}[];attribute_composition:unknown;average_base_appeal:number;reasons:unknown;scores?:unknown;construction?:unknown})=>({チーム:t.name,主タグ:t.mainTags.join(' / '),副タグ:t.subTags.join(' / '),メンバー:t.members.map(c=>c.name).join(' / '),楽曲:t.songs.map(s=>s.name).join(' / '),属性構成:JSON.stringify(t.attribute_composition),平均基礎Appeal:t.average_base_appeal,採用理由:JSON.stringify(t.reasons),選出スコア:JSON.stringify(t.scores??null),構築方針と注意:JSON.stringify(t.construction??null) }))});
 const labels:Record<string,string>={matches:'試合',idol_stats:'カード',song_stats:'楽曲',attribute_composition_stats:'属性構成',idol_pair_stats:'カードペア',archetype_stats:'テーマ',archetype_matchups:'組合せ',archetype_matchup_matrix:'相性表',tag_stats:'タグ',tag_pair_stats:'タグペア',team_coverage:'起用機会',burst_cpu_round_trace:'BURST_CPU予測',charge_round_trace:'チャージ履歴',charge_idol_stats:'チャージカード',cpu_strategy_stats:'CPU戦略'};
 for(const [mode,files] of Object.entries(modes))for(const [name,rows] of Object.entries(files))tables.push({name:`${mode==='random'?'RANDOM':'ARCHETYPE'}_${labels[name]||name}`,rows});
 const warLabels:Record<string,string>={card_war_stats:'ARCHETYPE_Card_WAR',random_card_war_stats:'RANDOM_Card_WAR',card_war_mode_comparison:'WAR_モード比較',card_archetype_war_stats:'WAR_採用テーマ',card_matchup_war_stats:'WAR_相手テーマ',card_round_value_stats:'WAR_ラウンド',card_skill_ablation_stats:'WAR_能力別',pair_synergy_war_stats:'WAR_ペア',burst_round_war_stats:'BURST_WAR_発動ラウンド',detail_candidates:'WAR_詳細検査候補'};
 for(const [key,label] of Object.entries(warLabels))if(warData[key])tables.push({name:label,rows:warData[key]});
 const bundle={...warData,formatVersion:1,sourceWorkbook:'案_48人22曲_Codex実装用.xlsx',gameRules,summary,definitions,catalog:{idols:IDOLS,songs:SONGS},archetypes,idolComparison:comparison,modes};
 mkdirSync(out,{recursive:true});json(join(out,'analysis_bundle.json'),bundle);writeFileSync(join(out,'analysis.xlsx'),workbook(tables));
 const md=['# チャット解析用データ','','`analysis.xlsx` を通常のチャットに添付すれば、前提・仕様・全チーム・両モードの統計をまとめて確認できます。JSONを読める場合は `analysis_bundle.json` 1つでも同じ情報を参照できます。','', '## 依頼文の例','','この添付のゲームシミュレーション結果を解析してください。まず「まず読む」と実行概要を確認し、RANDOMとARCHETYPEを分けて比較してください。カードの採用数・片側のみ採用勝率・BURST/CENTER使用率、テーマ相性、P1/P2差を見てください。CPU戦略ごとのチャージ消費・回復・R5/R6/R7配置も比較し、試合数不足と各CPUの限界を考慮し、強弱を断定せず観測として報告してください。仕様の数値変更は提案と事実を区別してください。','', '## 実行概要','','```json',JSON.stringify(summary,null,2),'```','', '## 読み方','',...definitions.map(d=>`- **${d.項目}**：${d.説明}`),'', 'CSV/JSONの指定出力はrandom/とarchetype/にも保存しています。各試合のmembersA/B・songsA/BはIDであり、メンバー仕様・楽曲仕様で名前に対応できます。'];
 writeFileSync(join(out,'CHAT_ANALYSIS.md'),md.join('\n')+'\n\n## 共通ルール・裁定の全文\n\n'+gameRules);
 return {sheets:tables.length};
}
