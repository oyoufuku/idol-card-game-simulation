/** Match the four fatigue-penalty bands; values above 8 retain the last band. */
export function FatigueValue({value}:{value:number}) {
 const level=value>=7?3:value>=5?2:value>=3?1:0;
 return <span className={`fatigue-value fatigue-level-${level}`} data-fatigue-level={level}>疲労 {value}</span>;
}
