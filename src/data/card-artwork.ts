/** Presentation-only artwork. Keep card abilities and game state in the game catalog. */
export interface CardArtwork {
  normal?: string;
  burst?: string;
  normalPosition?: string;
  burstPosition?: string;
}
// Register imported image URLs by idol ID. Use ?inline so the offline HTML also works.
// Example: import normal01 from '../assets/cards/01-normal.webp?inline';
//          import burst01 from '../assets/cards/01-burst.webp?inline';
//          1: { normal: normal01, burst: burst01, burstPosition: '50% 30%' }
export const CARD_ARTWORK: Readonly<Partial<Record<number, CardArtwork>>> = {};

export function selectCardArtwork(artwork: CardArtwork | undefined, burstActive: boolean) {
  const useBurstImage = burstActive && !!artwork?.burst;
  return {
    url: useBurstImage ? artwork!.burst : artwork?.normal,
    position: (useBurstImage ? artwork?.burstPosition : artwork?.normalPosition) || '50% 50%',
    fullArt: burstActive,
  };
}
