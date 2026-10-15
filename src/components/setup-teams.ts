import {IDOLS} from '../data/idols';
import {SELECTABLE_SONGS} from '../data/songs';
import {shuffle} from '../game/engine';
import {prng} from '../game/seeded-random';
import {songBelongsToGroup} from '../simulation/constructed-teams';
import type {Team} from '../simulation/teams';

export const RANDOM_PICK_OPTIONS={
 all:{label:'オールランダム',group:null},
 sakura:{label:'櫻坂ランダム',group:'櫻坂46'},
 hinata:{label:'日向坂ランダム',group:'日向坂46'},
} as const;
export type RandomPickScope=keyof typeof RANDOM_PICK_OPTIONS;
/** Browser setup only. The simulator's RANDOM roster/seed sequence is unchanged. */
export function randomSetupTeam(scope:RandomPickScope,seed:number,name:string):Team {
 const group=RANDOM_PICK_OPTIONS[scope].group,random=prng(seed);
 const members=IDOLS.filter(card=>group===null||card.group===group).map(card=>card.id);
 const songs=SELECTABLE_SONGS.filter(song=>group===null||songBelongsToGroup(song.id,group)).map(song=>song.id);
 return {name,archetype:'RANDOM',members:shuffle(members,random).slice(0,8),songs:shuffle(songs,random).slice(0,3),mainTags:[],subTags:[],reasons:{}};
}
