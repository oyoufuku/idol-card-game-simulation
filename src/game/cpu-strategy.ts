import type { Game } from './types';
import { setFormation } from './formation';
import { evaluateBurstFormation } from './burst-cpu';
import { cpuChooseBestFormation as normalChoose, recommendPlayerFormation as normalRecommend } from './cpu';
function describe(game:Game,side:1|2,random=Math.random){
 const best=evaluateBurstFormation(game,side,random);
 game.logs.push(`${side===1?game.p1.label:game.p2.label} BURST考慮：今回 ${best.currentPoints}pt / Appeal差 ${best.currentDifference} → 次回平均 ${best.nextPoints.toFixed(2)}pt / Appeal差 ${best.nextDifference.toFixed(2)} / BURST予測 ${best.predictedBursts.map(b=>`P${b.side}:No.${b.id}`).join(',')||'なし'}（相手の公開配置を基準）`);
 return best;
}
export function cpuChooseBestFormation(game:Game){
 if(game.cpuStrategy!=='burst')return normalChoose(game);
 if(!game.cpuMode||game.done||game.roundResolved)throw new Error('CPU配置を決定できません。');
 const best=describe(game,2);setFormation(game.p2,best.formation,game.round);game.cpuLocked=true;return best;
}
export function recommendPlayerFormation(game:Game,side:1|2,random=Math.random){
 if(game.cpuStrategy!=='burst')return normalRecommend(game,side,random);
 if(game.done||game.roundResolved||(game.cpuMode&&side===2))throw new Error('おすすめ配置はプレイヤーの配置中のみ使用できます。');
 const best=describe(game,side,random);setFormation(side===1?game.p1:game.p2,best.formation,game.round);
 if(game.cpuMode)game.cpuLocked=false;return best;
}
