import { createGame } from '../../game/engine';
import { posOf } from '../../game/formation';
import { SONGS } from '../../data/songs';
import { ATTRS, randomTeam } from '../../simulation/teams';
import { prng } from '../../simulation/random';

// Exercise all songs, PLAIN/copy/mitigation/cancellation, multi-attributes,
// charge entry, persistent bonuses, fatigue and repeated BURST effects.
export function optimizationCases() {
 return SONGS.flatMap((song,index)=>[false,true].map(special=>{
  const a=randomTeam(40+index,'A'),b=randomTeam(80+index,'B');
  const g=createGame(special?[4,20,17,28,43,32,38,44]:a.members,special?[14,7,16,46,26,36,48,21]:b.members,a.songs,b.songs,'local',prng(index),{recordEffects:true});
  g.cpuBoth=true;g.round=2+index%5;g.roundSong=song;
  for(const [side,p] of [g.p1,g.p2].entries()){
   p.round=g.round;p.points=side?3:5;p.totalAppeal=60+index;
   for(const id of p.ids){const s=p.states[id];
    s.fatigue=(id+index)%9;s.charge=id%6;s.prevPos=id%3?'BACK':posOf(p,id);s.pos=posOf(p,id);
    s.burstActive=id%2===0;s.burstStacks=s.burstActive?1+id%3:0;s.burstCount=+s.burstActive;s.normalUsed=s.burstActive;
    s.shield=id%7===0;s.addedAttributes=[ATTRS[id%3]];s.permBonus=id%3;s.activeNextBonus=id%2;s.activeAutoCarry=id%3;
    s.burstSelfAppeal=s.burstActive?2:0;s.burstDebuff=-id%3;s.burstDebuffSources=[{id:side?4:14,amount:s.burstDebuff}];
    s.positionCounts.CENTER=1;s.symmetries=[id];s.positionKinds=['CENTER'];
   }
  }
  return {name:`${song.id}-${special?'interactions':'random'}`,game:g};
 }));
}
