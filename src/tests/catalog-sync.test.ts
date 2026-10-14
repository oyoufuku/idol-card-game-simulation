import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import workbook from '../../docs/simulation/workbook-spec.json';
import reviewed from '../../docs/simulation/balance-overrides-20261014.json';
import {IDOLS} from '../data/idols';
import {SONGS} from '../data/songs';
import {INPUT_FINGERPRINT} from '../simulation/input-fingerprint';
import {songFit} from '../simulation/song-fit';
const cell=(row:Record<string,unknown>,column:string)=>Object.entries(row).find(([key])=>key.replace(/\d/g,'')===column)?.[1];
function expectedCards(sheet:string){
 return (workbook as Record<string,Record<string,unknown>[]>)[sheet].filter(r=>/^No\.\d+$/.test(String(cell(r,'A')))).map(r=>{
  const id=Number(String(cell(r,'A')).slice(3));let B=String(cell(r,'K'));
  if(id===16)B=B.replace('以後のパフォーマンス終了時に再び条件を満たせば通常BURSTできる。同一パフォーマンス終了処理内では再発動しない。','続くBURST条件判定で条件を満たした場合は、同じ終了処理内で再び通常BURSTする。');
  if([32,38,44].includes(id))B=B.replace('その後、このパフォーマンスで消費した自身のチャージを、ステージ入り直前の値まで回復する。','その後、最後に実消費した自身のチャージを、消費直前の値まで回復する。このパフォーマンスで未消費の場合も、最後に消費した値まで回復する。');
  return {id,no:cell(r,'A'),name:cell(r,'B'),attr:cell(r,'C'),group:cell(r,'D'),generation:cell(r,'E'),themeTags:['F','G'].map(col=>cell(r,col)).filter(v=>v&&v!=='なし'),base:cell(r,'H'),A:cell(r,'I'),Bcond:cell(r,'J'),B,C:cell(r,'L')==='なし'?null:cell(r,'L')??null};
 });
}
it('fixtureではなく最終確定Excel抽出と回答済み裁定から48人全員の実カタログを照合する',()=>{
 const expected=expectedCards('Codex用メンバー');expect(expected).toHaveLength(48);expect(expectedCards('Codex用メンバー (修正)')).toEqual(expected);
 for(const card of IDOLS){const {skill,tags,...actual}=card;const {skill:expectedSkill,tags:expectedTags,...override}=reviewed.find(c=>c.id===card.id)!;expect(expectedSkill).toBe(skill);expect(actual,card.name).toEqual(override);expect(tags).toEqual([card.generation,card.group,...card.themeTags]);expect(skill).toBeTruthy();}
});
it('実CLIのgenerate-onlyは古い生成JSONを入力にせず、全48人・全チーム能力を現行データから書き直す',()=>{
 const out=mkdtempSync(join(tmpdir(),'catalog-sync-'));
 try{
  mkdirSync(join(out,'archetype'));writeFileSync(join(out,'archetype/archetypes.json'),JSON.stringify([{members:[{id:5,AUTO:'stale'}]}]));writeFileSync(join(out,'catalog-snapshot.json'),JSON.stringify({idols:[{id:5,base:99}]}));
  const output=execFileSync(process.execPath,['--import','tsx','src/simulation/cli.ts','--mode','archetype','--generate-only','--seed','1','--out',out],{cwd:process.cwd(),encoding:'utf8'});
  expect(output).toContain('[catalog] src/data/idols.ts');const snapshot=JSON.parse(readFileSync(join(out,'catalog-snapshot.json'),'utf8')),summary=JSON.parse(readFileSync(join(out,'summary.json'),'utf8')),teams=JSON.parse(readFileSync(join(out,'archetype/archetypes.json'),'utf8'));
  expect(snapshot.idols).toEqual(IDOLS);expect(snapshot.songs).toEqual(SONGS);expect(snapshot.inputFingerprint).toBe(INPUT_FINGERPRINT);
  expect(summary).toMatchObject({generatedTeams:27,archetypes:9,catalogSource:{cardDefinitionsFile:'src/data/idols.ts',usesFixtureAsInput:false,usesWorkbookAsRuntimeInput:false,usesGeneratedJsonAsConstructionInput:false}});
  expect(teams).toHaveLength(27);for(const t of teams){expect(t.inputFingerprint).toBe(INPUT_FINGERPRINT);expect(t.cardDefinitionsFile).toBe('src/data/idols.ts');for(const c of t.members){const live=IDOLS.find(x=>x.id===c.id)!;expect(c).toEqual({id:live.id,name:live.name,attribute:live.attr,base:live.base,AUTO:live.A,BURST_condition:live.Bcond,BURST:live.B,CENTER:live.C});}}
  expect(existsSync(join(out,'archetype-checkpoint.jsonl'))).toBe(false);
 }finally{rmSync(out,{recursive:true,force:true});}
});
it('全22曲・全9テーマの楽曲評価はタグ・過去勝率・WARの値で変わらない',()=>{
 const cards=[6,9,12,18,32,38,41,47].map(id=>IDOLS.find(c=>c.id===id)!);
 for(const theme of ['クール','チャージ','バースト','フォーメーション移動','多属性','対スキル','疲労回復','疲労付与','対単一属性'])for(const song of SONGS){
  const base=songFit(song,cards,theme,0),unrelated=Object.assign({...song,tags:[theme,'誤ったタグ']},{winRate:1,cWARPer100:100,war:-100});
  expect(songFit(unrelated,cards,theme,0)).toEqual(base);
 }
});
