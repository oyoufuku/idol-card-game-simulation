export function seedFor(seed:number,...keys:(string|number)[]){let h=seed>>>0;for(const key of keys)for(const ch of String(key)){h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;}return h;}
export function prng(seed:number){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
