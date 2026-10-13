import { expect,it } from 'vitest';
import { unzipSync,strFromU8 } from 'fflate';
import { parseCsv,workbook,exportAnalysis } from '../simulation/analysis-export';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('CSVのBOM・引用符・カンマ・改行を保持して解析する',()=>{expect(parseCsv('\uFEFFname,note\r\n"A,B","line1\nline2"\r\nC,"say ""yes"""\r\n')).toEqual([{name:'A,B',note:'line1\nline2'},{name:'C',note:'say "yes"'}]);});
it('Excelは数値と文字を区別し、数式化せずXML特殊文字を保全する',()=>{
 const files=unzipSync(workbook([{name:'比較',rows:[{名前:'A&B <test>',勝率:.5,注記:'=1+1'},{名前:'二人目',勝率:0,注記:'line1\nline2'}]}]));
 const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
 expect(sheet).toContain('A&amp;B &lt;test&gt;');expect(sheet).toContain('<v>0.5</v>');expect(sheet).toContain('=1+1');expect(sheet).not.toContain('<f>');expect(sheet).toContain('line1\nline2');
 expect(strFromU8(files['xl/workbook.xml'])).toContain('name="比較"');
});
it('過去のCSV/Excelも試合数・勝率を変えずに標本表示を更新する',()=>{
 const dir=mkdtempSync(join(tmpdir(),'analysis-upgrade-'));
 try{
  mkdirSync(join(dir,'random'));writeFileSync(join(dir,'summary.json'),'{"random":{"games":1}}');
  writeFileSync(join(dir,'random/tag_stats.csv'),'tag,teams,matches,wins,winRate,sufficientSamples\nバースト,1,1,1,1,true\n疲労,20,10,10,0.5,true\n');
  exportAnalysis(dir);
  const rows=parseCsv(readFileSync(join(dir,'random/tag_stats.csv'),'utf8'));
  expect(rows[0]).toMatchObject({teams:'1',matches:'1',wins:'1',winRate:'1',sampleCount:'1',sampleStatus:'insufficient',sufficientSamples:'false'});
  expect(rows[1]).toMatchObject({teams:'20',winRate:'0.5',sampleStatus:'provisional',sufficientSamples:'false'});
  const files=unzipSync(readFileSync(join(dir,'analysis.xlsx')));
  expect(Object.values(files).map(bytes=>strFromU8(bytes)).join('')).toContain('insufficient');
  const before=readFileSync(join(dir,'random/tag_stats.csv'),'utf8');exportAnalysis(dir);expect(readFileSync(join(dir,'random/tag_stats.csv'),'utf8')).toBe(before);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
