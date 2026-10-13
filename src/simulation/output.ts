import { mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDOLS } from '../data/idols';
import { SONGS } from '../data/songs';
import type { MatchResult } from './match';
import { ATTRS } from './teams';
import { sampleEvidence } from './samples';
import { writeChargeStats } from './charge-output';
export function json(path:string,value:unknown){writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
export function csv(path:string,rows:Record<string,unknown>[],headers?:string[]){const keys=headers||Object.keys(rows[0]||{});const cell=(v:unknown)=>{const s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};writeFileSync(path,'\uFEFF'+[keys.join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n')+'\n');}
type Counter={teams:number;matches:Set<string>;wins:number;draws:number};
export function writeMode(dir:string,matches:MatchResult[],minPairSamples=10){
 mkdirSync(dir,{recursive:true});
 const hasPlanning=matches.some(m=>m.burstPlanningTrace);
 csv(join(dir,'matches.csv'),matches.map(m=>({pairId:m.spec.pairId,seed:m.spec.seed,mirror:m.spec.mirror,cpuSearch:m.cpuSearch?.mode||'exhaustive',previewCandidates:m.cpuSearch?.previewCandidates??null,cpuSearchPolicy:m.cpuSearch?.policy||'exhaustive',cpuStrategy:m.cpuStrategy||'normal',cpuStrategyA:m.cpuStrategies?.[0]||'normal',cpuStrategyB:m.cpuStrategies?.[1]||'normal',...(hasPlanning?{cpuPlanningPolicy:m.spec.cpuPolicy||'normal'}:{}),P1:m.spec.mirror?m.spec.b.name:m.spec.a.name,P2:m.spec.mirror?m.spec.a.name:m.spec.b.name,archetypeA:m.spec.a.archetype,archetypeB:m.spec.b.archetype,winner:m.winner,pointsA:m.pointsA,pointsB:m.pointsB,appealA:m.appealA,appealB:m.appealB,burstA:m.burstA,burstB:m.burstB,forcedBurstA:m.forcedBurstA,forcedBurstB:m.forcedBurstB,rounds:m.rounds,membersA:m.spec.a.members,membersB:m.spec.b.members,songsA:m.spec.a.songs,songsB:m.spec.b.songs,playedSongs:m.songs})));
 const counters={songs:new Map<string,Counter>(),attributes:new Map<string,Counter>(),tags:new Map<string,Counter>(),tagPairs:new Map<string,Counter>(),idolPairs:new Map<string,Counter>()};
 const idols=IDOLS.map(c=>({id:c.id,name:c.name,selections:0,wins:0,draws:0,winRate:0,exclusiveSelections:0,exclusiveWins:0,exclusiveWinRate:0,stage:0,CENTER:0,FRONT:0,MIDDLE:0,BACKS:0,AUTO:0,BURST_READY:0,normalBURST:0,forcedBURST:0,CENTER_SKILL:0,centerRate:0,burstRate:0,burstGames:0,normalBurstGames:0,forcedBurstGames:0,averageBursts:0}));
 const add=(map:Map<string,Counter>,key:string,matchId:string,win:boolean,draw:boolean)=>{const c=map.get(key)||{teams:0,matches:new Set<string>(),wins:0,draws:0};c.teams++;c.matches.add(matchId);c.wins+=+win;c.draws+=+draw;map.set(key,c);};
 const pairKeys=(keys:(string|number)[])=>keys.flatMap((a,i)=>keys.slice(i+1).map(b=>`${a} × ${b}`));
 matches.forEach((m,mi)=>{for(const side of [0,1] as const){const p=m.players[side],opp=m.players[1-side],team=side===0?m.spec.a:m.spec.b,win=m.winner===(side===0?'A':'B'),draw=m.winner==='draw';
  for(const id of p.ids){const c=idols[id-1],s=p.states[id],q=s.stats.positions;c.selections++;c.wins+=+win;c.draws+=+draw;if(!opp.ids.includes(id)){c.exclusiveSelections++;c.exclusiveWins+=+win;}c.CENTER+=q.CENTER;c.FRONT+=q['FRONT-L']+q['FRONT-R'];c.MIDDLE+=q['MIDDLE-L']+q['MIDDLE-R'];c.BACKS+=q.BACK;c.stage+=7-q.BACK;c.AUTO+=s.stats.auto;c.BURST_READY+=s.stats.ready;c.normalBURST+=s.burstCount-s.forcedBurstCount;c.forcedBURST+=s.forcedBurstCount;c.CENTER_SKILL+=s.stats.center;c.burstGames+=+(s.burstCount>0);c.normalBurstGames+=+(s.burstCount>s.forcedBurstCount);c.forcedBurstGames+=+(s.forcedBurstCount>0);}
  for(const id of team.songs)add(counters.songs,id,String(mi),win,draw);
  const composition=ATTRS.map(a=>`${a}:${p.ids.filter(id=>IDOLS[id-1].attr===a).length}`).join('/');add(counters.attributes,composition,String(mi),win,draw);
  const tags=[...new Set(p.ids.flatMap(id=>IDOLS[id-1].themeTags))].sort();for(const tag of tags)add(counters.tags,tag,String(mi),win,draw);for(const pair of pairKeys(tags))add(counters.tagPairs,pair,String(mi),win,draw);
  for(const pair of pairKeys([...p.ids].sort((a,b)=>a-b)))add(counters.idolPairs,pair,String(mi),win,draw);
 }});
 for(const c of idols){c.winRate=c.selections?c.wins/c.selections:0;c.exclusiveWinRate=c.exclusiveSelections?c.exclusiveWins/c.exclusiveSelections:0;c.centerRate=c.selections?c.CENTER/(7*c.selections):0;c.burstRate=c.selections?c.burstGames/c.selections:0;c.averageBursts=c.selections?(c.normalBURST+c.forcedBURST)/c.selections:0;}
 const idolRows=idols.map(c=>({...c,...sampleEvidence(c.selections)}));
 csv(join(dir,'idol_stats.csv'),idolRows);
 const writeCounters=(name:string,map:Map<string,Counter>,label:string,min=0)=>csv(join(dir,name),[...map].sort(([a],[b])=>a.localeCompare(b,'ja')).map(([key,c])=>({[label]:key,...(label==='song'?{name:SONGS.find(s=>s.id===key)!.name}:{}),teams:c.teams,matches:c.matches.size,wins:c.wins,draws:c.draws,winRate:c.teams>=min?c.wins/c.teams:null,...sampleEvidence(c.teams)})),[label,...(label==='song'?['name']:[]),'teams','matches','wins','draws','winRate','sampleCount','sampleStatus','sufficientSamples']);
 writeCounters('song_stats.csv',counters.songs,'song');writeCounters('attribute_composition_stats.csv',counters.attributes,'attributeComposition');writeCounters('tag_stats.csv',counters.tags,'tag');writeCounters('tag_pair_stats.csv',counters.tagPairs,'tagPair',minPairSamples);writeCounters('idol_pair_stats.csv',counters.idolPairs,'idolPair',minPairSamples);
 if(matches.some(m=>m.burstPlanningTrace))csv(join(dir,'burst_cpu_round_trace.csv'),matches.flatMap(m=>(m.burstPlanningTrace??[]).map(row=>({pairId:m.spec.pairId,seed:m.spec.seed,mirror:m.spec.mirror,...row}))));
 writeChargeStats(dir,matches);return idolRows;
}
export function writeArchetypeStats(dir:string,matches:MatchResult[]){
 const names=[...new Set(matches.flatMap(m=>[m.spec.a.archetype,m.spec.b.archetype]))].sort();
 const rows=names.map(name=>{let games=0,wins=0,draws=0,p1Games=0,p1Wins=0,p2Games=0,p2Wins=0,points=0,appeal=0,bursts=0,forced=0;
  for(const m of matches)for(const side of [0,1])if((side===0?m.spec.a:m.spec.b).archetype===name){games++;const win=m.winner===(side===0?'A':'B');wins+=+win;draws+=+(m.winner==='draw');const isP1=(side===0)!==m.spec.mirror;if(isP1){p1Games++;p1Wins+=+win;}else{p2Games++;p2Wins+=+win;}points+=side===0?m.pointsA:m.pointsB;appeal+=side===0?m.appealA:m.appealB;bursts+=side===0?m.burstA:m.burstB;forced+=side===0?m.forcedBurstA:m.forcedBurstB;}
  return {archetype:name,games,wins,draws,winRate:games?wins/games:0,p1Games,p1WinRate:p1Games?p1Wins/p1Games:0,p2Games,p2WinRate:p2Games?p2Wins/p2Games:0,averagePoints:points/games,averageAppeal:appeal/games,averageBurst:bursts/games,averageForcedBurst:forced/games};});
 csv(join(dir,'archetype_stats.csv'),rows.map(c=>({...c,...sampleEvidence(c.games)})));
 const matchups:Record<string,unknown>[]=[];const matrix:Record<string,unknown>[]=[];
 for(const a of names){const row:Record<string,unknown>={archetype:a};for(const b of names){const games=matches.filter(m=>m.spec.a.archetype===a&&m.spec.b.archetype===b||m.spec.a.archetype===b&&m.spec.b.archetype===a);let winsA=0,winsB=0,draws=0,pointsA=0,pointsB=0,appealA=0,appealB=0,burstA=0,burstB=0,forcedA=0,forcedB=0;
  for(const m of games){const forward=m.spec.a.archetype===a;winsA+=+(m.winner===(forward?'A':'B'));winsB+=+(m.winner===(forward?'B':'A'));draws+=+(m.winner==='draw');pointsA+=forward?m.pointsA:m.pointsB;pointsB+=forward?m.pointsB:m.pointsA;appealA+=forward?m.appealA:m.appealB;appealB+=forward?m.appealB:m.appealA;burstA+=forward?m.burstA:m.burstB;burstB+=forward?m.burstB:m.burstA;forcedA+=forward?m.forcedBurstA:m.forcedBurstB;forcedB+=forward?m.forcedBurstB:m.forcedBurstA;}
  const n=games.length;row[b]=n?(a===b?(winsA+winsB)/(2*n):winsA/n):null;
  if(names.indexOf(a)<=names.indexOf(b)&&n)matchups.push({archetypeA:a,archetypeB:b,games:n,winsA,winsB,draws,winRateA:winsA/n,winRateB:winsB/n,averagePointsA:pointsA/n,averagePointsB:pointsB/n,averageAppealA:appealA/n,averageAppealB:appealB/n,averageBurstA:burstA/n,averageBurstB:burstB/n,averageForcedBurstA:forcedA/n,averageForcedBurstB:forcedB/n});
 }matrix.push(row);}
 csv(join(dir,'archetype_matchups.csv'),matchups.map(c=>({...c,...sampleEvidence(c.games as number)})));csv(join(dir,'archetype_matchup_matrix.csv'),matrix);return rows;
}
