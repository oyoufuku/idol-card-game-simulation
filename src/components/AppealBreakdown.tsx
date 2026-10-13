import type { Appeal } from '../game/types';
export function AppealBreakdown({appeal,cpuMode}:{appeal?:Appeal;cpuMode:boolean}) {
  return <ul className="modifier-list detailed-modifiers">{appeal?.breakdown?.map((entry,index)=><li key={index}>
    <div className="modifier-heading"><span>{entry.side===null?'':entry.side===0?'P1：':cpuMode?'P2（CPU）：':'P2：'}{entry.sourceName}{['A','B','C'].includes(entry.kind)?`　${entry.kind}スキル`:entry.kind==='曲'?'　楽曲効果':''}</span><b className={entry.amount>0?'amount-positive':entry.amount<0?'amount-negative':'amount-neutral'}>{entry.amount>0?'+':''}{entry.amount}</b></div>
    <small>【{['基礎','位置','疲労','下限'].includes(entry.kind)?'計算内容':'スキル効果'}】</small><p>{entry.effect}</p>{entry.reason&&<em>{entry.reason}</em>}
  </li>) || appeal?.details.map((line,index)=><li key={index}>{line}</li>)}</ul>;
}
