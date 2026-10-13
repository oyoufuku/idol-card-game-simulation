import { expect, it } from 'vitest';
import { createGame, executeRound } from '../game/engine';
import { evaluateCpuFormation, recommendPlayerFormation } from '../game/cpu';
import { validateFormation } from '../game/formation';
import { prng } from '../simulation/random';
const game = () => createGame([1,3,5,17,19,23,33,37],[10,14,18,25,26,27,28,30],['A','B','C'],['D','E','F'],'local',()=>.5);
it('おすすめ配置はCPUと同じ評価結果を反映し、相手の未確定配置・公開状態・カード状態を変更しない', () => {
  const g = game(), expected = evaluateCpuFormation(g, 1, prng(1));
  g.p2.formation = { CENTER:30, 'FRONT-L':28, 'FRONT-R':27, 'MIDDLE-L':26, 'MIDDLE-R':25 };
  const opponent = structuredClone(g.p2), publicPlayers = structuredClone(g.publicPlayers), states = structuredClone(g.p1.states);
  const result = recommendPlayerFormation(g, 1, prng(1));
  expect(result).toEqual(expected); expect(g.p1.formation).toEqual(expected.formation);
  expect(validateFormation(g.p1,g.p1.formation)).toBeNull(); expect(g.p2).toEqual(opponent); expect(g.publicPlayers).toEqual(publicPlayers);
  for(const id of g.p1.ids) expect({...g.p1.states[id],pos:states[id].pos}).toEqual(states[id]);
  expect(g.roundResolved).toBe(false); expect(g.p1.points).toBe(0);
},20000);
it('ローカルP2にも反映でき、CPU側確定を解除するが通常CPU側や実行後には使用できない', () => {
  const g = game(), before = structuredClone(g.p1);
  recommendPlayerFormation(g,2,prng(2)); expect(g.p1).toEqual(before); expect(validateFormation(g.p2,g.p2.formation)).toBeNull();
  executeRound(g); expect(()=>recommendPlayerFormation(g,1)).toThrow('配置中');
  const cpu = game(); cpu.cpuMode=true; cpu.cpuLocked=true;
  recommendPlayerFormation(cpu,1,prng(3)); expect(cpu.cpuLocked).toBe(false);
  expect(()=>recommendPlayerFormation(cpu,2)).toThrow('配置中');
},20000);
