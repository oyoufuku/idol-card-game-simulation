export const OPEN_PLAY_GUIDE='open-play-guide';
export function openPlayGuide(){window.dispatchEvent(new CustomEvent(OPEN_PLAY_GUIDE));}
export function openDeckGuide(deckName:string){window.dispatchEvent(new CustomEvent(OPEN_PLAY_GUIDE,{detail:deckName}));}
