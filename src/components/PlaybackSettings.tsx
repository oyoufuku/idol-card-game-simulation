export const AUTO_ADVANCE_KEY='idol-card-game:auto-advance';
export function readAutoAdvance(storage?:Pick<Storage,'getItem'>):boolean {
  try{return (storage??window.localStorage).getItem(AUTO_ADVANCE_KEY)!=='false';}catch{return true;}
}
export function PlaybackSettings({autoAdvance,onChange}:{autoAdvance:boolean;onChange:(enabled:boolean)=>void}) {
  return <label className="playback-setting"><input type="checkbox" checked={autoAdvance} onChange={e=>onChange(e.target.checked)}/><span>演出を自動で進める <b>{autoAdvance?'ON':'OFF'}</b></span></label>;
}
