import {byId} from '../game/formation';
import {SONGS} from '../data/songs';
import type {Team} from './teams';

export const CONSTRUCTED_DECK_POLICY='constructed-decks-20261013-v1';

const definitions=[
 {name:'クール・シンメ連動',theme:'クール',members:[11,10,18,14,28,8,15,4],songs:['A','M','E']},
 {name:'チャージ・序盤安定',theme:'チャージ',members:[32,38,44,43,39,40,25,11],songs:['F','J','L']},
 {name:'チャージ・疲労妨害',theme:'チャージ',members:[32,38,44,43,23,34,26,22],songs:['F','J','N']},
 {name:'BURST連鎖',theme:'バースト',members:[6,12,41,47,16,25,22,26],songs:['C','M','N']},
 {name:'移動・疲労軽減',theme:'フォーメーション移動',members:[45,9,28,2,13,24,27,31],songs:['F','J','N']},
 {name:'移動・疲労攻撃',theme:'フォーメーション移動',members:[45,9,28,16,23,42,20,18],songs:['F','J','M']},
 {name:'多属性・属性数活用',theme:'多属性',members:[22,30,41,35,46,29,33,17],songs:['F','A','P']},
 {name:'対スキル・封殺',theme:'対スキル',members:[7,19,9,20,37,34,26,35],songs:['F','B','N']},
 {name:'対スキル・解除',theme:'対スキル',members:[7,15,11,33,36,48,2,30],songs:['V','B','N']},
 {name:'疲労回復・持久戦',theme:'疲労回復',members:[13,42,17,39,4,2,24,44],songs:['J','N','T']},
 {name:'疲労付与・疲労活用',theme:'疲労付与',members:[16,21,23,42,45,37,29,1],songs:['C','D','M']},
 {name:'対単一属性メタ',theme:'対単一属性',members:[3,40,1,36,5,17,13,15],songs:['Q','B','V']},
] as const;

export function constructedTeams():Team[]{
 return definitions.map(definition=>{
  if(new Set(definition.members).size!==8||new Set(definition.songs).size!==3)throw new Error(`Invalid constructed deck: ${definition.name}`);
  definition.members.forEach(byId);for(const id of definition.songs)if(!SONGS.some(song=>song.id===id&&song.selectable!==false))throw new Error(`Invalid constructed song ${id}: ${definition.name}`);
  const reasons:Record<string,string[]>={};
  for(const id of definition.members)reasons[String(id)]=[`構築済みデッキ「${definition.name}」の戦術担当。個別理由は docs/simulation/constructed-decks-20261013.md に固定済み`];
  for(const id of definition.songs)reasons[id]=[`構築済みデッキ「${definition.name}」の戦術を実効果で支援。個別理由は docs/simulation/constructed-decks-20261013.md に固定済み`];
  return {selectionPolicy:CONSTRUCTED_DECK_POLICY,name:definition.name,archetype:definition.name,members:[...definition.members],songs:[...definition.songs],mainTags:[definition.theme],subTags:[],reasons,construction:{profile:'構築済み12デッキ',plan:'確定済みの8人・3曲を変更せず、12デッキ総当たりで検証する。',caveats:['過去WARは今回の対戦中に構築変更へ使用しない','現在のカード・楽曲データをIDで参照する']}};
 });
}

