import {SLOTS,type EffectKind,type Game,type SkillEffect,type Slot} from '../game/types';
import {createGame,executeRound,nextRound,preview} from '../game/engine';
import {attributesOf,byId,formationFromArray,posOf,setFormation} from '../game/formation';
import {resolveCenterSkills} from '../game/appeal';
import {burstTargetKind,burstTargetOptions,pendingBurst,resolveNextBurst} from '../game/burst';
import {effectsFor} from '../game/effects';
import {DECK_GUIDES,type DeckGuide} from '../data/play-guide';
import {constructedTeams} from '../simulation/constructed-teams';
import {placeCard} from '../components/placement';
import {buildSkillMessages} from '../components/presentation';

type Condition='charge-backs'|'entry-three'|'charge-spent'|'plain'|'anti-center'|'recovery'|'fatigue-given';
export type TrainingGoal=
 |{type:'inspect'|'appeal';id:number;side?:0|1;condition?:Condition}
 |{type:'place';id?:number;slot?:Slot;formation?:readonly number[];condition?:Condition}
 |{type:'perform';round:number;condition?:Condition}
 |{type:'advance-round';round:number}
 |{type:'burst';id:number}
 |{type:'review-effect';sourceId?:number;kind?:EffectKind}
 |{type:'review-result'};
export interface TrainingStep {title:string;instruction:string;goal:TrainingGoal;success:string}
export interface TrainingCourse {id:string;title:string;group:'入門'|'デッキ';description:string;members:number[];songs:string[];opening:readonly number[];prelude:number;firstSong:string;displaceCenter?:boolean;steps:TrainingStep[]}
export interface TrainingSession {courseId:string;game:Game;stepIndex:number;stepComplete:boolean;complete:boolean;selected:{side:0|1;id:number}|null;appealFocus:{side:0|1;id:number}|null;effectIndex:number;effectVersion:number;observedEffects:SkillEffect[]}
export type TrainingAction=
 |{type:'inspect'|'appeal';id:number;side:0|1}
 |{type:'place';id:number;slot:Slot}
 |{type:'perform'|'advance-round'|'review-result'}
 |{type:'burst';target?:number}
 |{type:'show-effect'|'review-effect';index:number}
 |{type:'clear-selection'};
const random=()=>.5;
const inspect=(id:number,instruction=`${byId(id).name}のカードをタップし、左のA・B条件・B・Cを読んでみましょう。`):TrainingStep=>({title:'カードを選んで読む',instruction,goal:{type:'inspect',id},success:'カード詳細を開けました。'});
const place=(id:number,slot:Slot,instruction=`${byId(id).name}を選び、「ここに配置・${slot}」をタップしましょう。`):TrainingStep=>({title:'配置を変える',instruction,goal:{type:'place',id,slot},success:'指定した枠へ配置できました。'});
const appeal=(id:number,instruction='カードの下の予測Appealをタップし、誰のどの効果で増減しているか確認しましょう。',condition?:Condition):TrainingStep=>({title:'予測の内訳を見る',instruction,goal:{type:'appeal',id,condition},success:'共有エンジンで計算した内訳を開けました。'});
const perform=(round:number,instruction='「パフォーマンス開始」を押しましょう。勝敗より、予測した効果が実際に起きるかに注目します。',condition?:Condition):TrainingStep=>({title:`R${round}を実行する`,instruction,goal:{type:'perform',round,condition},success:'実際の得点・疲労・B条件を処理しました。'});
const advance=(round:number):TrainingStep=>({title:`R${round}へ進む`,instruction:'終了時BURSTが残っていれば順に解決し、「次のラウンドへ」を押しましょう。',goal:{type:'advance-round',round},success:`R${round}へ進みました。前回の位置・疲労・経験を引き継いでいます。`});
const burst=(id:number,instruction=`終了時BURSTを順に進め、${byId(id).name}をBURSTさせましょう。対象を選ぶ効果では、選択してから発動します。`):TrainingStep=>({title:`${byId(id).name}のBURST`,instruction,goal:{type:'burst',id},success:'実際のBURSTが発動しました。本人の疲労0とB効果を確認しましょう。'});
const effect=(sourceId?:number,kind?:EffectKind):TrainingStep=>({title:'発動した効果を確かめる',instruction:sourceId?`「確認する効果」からP1 ${byId(sourceId).name}の${kind||'スキル'}を選び、「この効果を確認」を押しましょう。`:'「確認する効果」で発動者・対象・増減を読み、「この効果を確認」を押しましょう。',goal:{type:'review-effect',sourceId,kind},success:'エンジンが記録した実際の効果を確認できました。'});
const result=():TrainingStep=>({title:'結果と疲労を確認する',instruction:'結果欄の両軍Appealと獲得ポイント、カードの疲労を確認して「結果を確認」を押しましょう。終了時BURSTが残っていれば先に解決します。',goal:{type:'review-result'},success:'この回の結果を確認できました。'});
const BASIC_MEMBERS=[25,26,27,28,29,30,31,2],BASIC_OPENING=[25,26,27,28,29],BASIC_SONGS=['B','M','N'];
function basic(id:string,title:string,description:string,steps:TrainingStep[],options:Partial<TrainingCourse>={}):TrainingCourse{return {id:`basic:${id}`,title,group:'入門',description,members:[...BASIC_MEMBERS],songs:[...BASIC_SONGS],opening:[...BASIC_OPENING],prelude:0,firstSong:'B',steps,...options};}
const basics:TrainingCourse[]=[
 basic('goal','1. 得点を実際に取る','R1の練習盤面で予測を読み、実行後のポイントを確認します。勝つことはクリア条件ではありません。',[inspect(25),appeal(25),perform(1),result()]),
 basic('team','2. ステージ5人・BACKS3人','BACKSの宮田を出しても、人数は5人と3人のままです。実際に交換して確かめます。',[inspect(31),place(31,'MIDDLE-L'),appeal(31),perform(1),result()]),
 basic('formation','3. 配置と対面','平岡をFRONT-Lへ移し、対面の相手FRONT-Rもタップして確かめます。',[inspect(30),place(30,'FRONT-L'),{title:'対面の相手を確認する',instruction:'相手FRONT-Rの武元唯衣をタップしましょう。自分のFRONT-Lと左右反対の枠です。',goal:{type:'inspect',id:18,side:1},success:'左右反対の枠が対面だと確認できました。'},appeal(30),perform(1),result()]),
 basic('round','4. 予測→実行→効果','配置、予測内訳、実行、実際のスキル効果を順に操作します。',[inspect(25),place(25,'CENTER'),appeal(25),perform(1),effect(),result()]),
 basic('fatigue','5. 疲れた主力を休ませる','R1を終えたR2の途中盤面です。小坂の疲労6を見て、BACKSの平岡と交代させます。',[inspect(26,'疲労6の小坂をタップし、疲労値とAの倍化を確認しましょう。'),inspect(30),place(30,'CENTER','平岡をCENTERへ置き、小坂をBACKSへ下げましょう。'),appeal(30),perform(2),inspect(26,'BACKSで休んだ小坂をタップし、疲労6から4へ減ったことを確認しましょう。'),result()],{opening:[26,25,27,28,29],prelude:1}),
 basic('skills','6. CENTERでCを働かせる','小坂をCENTERへ移し、位置＋2・C＋1・Aの追加＋3という内訳を読みます。',[inspect(26),place(26,'CENTER'),appeal(26),perform(1),effect(26,'A'),result()]),
 basic('burst','7. 条件達成→BURST→次回','金村がCENTERで3回終了したR4から始めます。同じ枠を維持してBURSTし、次回の位置2倍を確かめます。',[inspect(25),place(25,'CENTER'),appeal(25),perform(4),burst(25),advance(5),appeal(25),perform(5),effect(25,'B'),result()],{prelude:3}),
 basic('songs','8. ENCOREと最後の判定','R1〜R6を終えたR7の盤面です。抽選された曲と得点を確認し、最後のパフォーマンスを実行します。',[inspect(25),appeal(25),perform(7,'現在の楽曲と予測を確認してR7を実行しましょう。終了後に新しいBURSTは発生しません。'),result()],{prelude:6}),
];
function deckCourse(guide:DeckGuide):TrainingCourse{
 const team=constructedTeams().find(team=>team.name===guide.name)!;
 const course:TrainingCourse={id:`deck:${team.name}`,title:team.name,group:'デッキ',description:`${guide.goal}　最初はCENTER役をBACKSへ下げた配置です。カードを選んで役割に合う盤面へ戻しましょう。`,members:[...team.members],songs:[...team.songs],opening:guide.opening,prelude:0,firstSong:team.songs[0],displaceCenter:true,steps:[]};
 const key=guide.opening[0];course.steps=[inspect(key),place(key,'CENTER',guide.openingWhy+'　まず指定のCENTER役を選んでCENTERへ戻しましょう。'),appeal(key),perform(1),effect(),result()];
 switch(team.mainTags[0]){
  case 'クール':course.steps=[inspect(key),place(key,'CENTER'),appeal(key),perform(1),effect(11,'C'),result()];break;
  case 'チャージ':course.steps=[inspect(26),place(26,'CENTER','小坂をCENTERへ戻すと、渡邉美穂・渡辺莉奈・平尾帆夏の3人がBACKSになります。'),appeal(26,'3コアがBACKS、竹内がステージにいることと、小坂の内訳を確認しましょう。','charge-backs'),perform(1,undefined,'charge-backs'),inspect(32,'R1終了後の渡邉美穂をタップし、自然蓄積＋竹内でチャージ2になったことを確認します。'),advance(2),perform(2,undefined,'charge-backs'),advance(3),inspect(32),place(32,'MIDDLE-L','チャージを貯めた渡邉美穂をMIDDLE-Lへ出し、好花と交代させましょう。'),appeal(32,'登場時の実消費とAによる加算を、予測内訳で確認しましょう。','charge-spent'),perform(3,undefined,'charge-spent'),burst(32,'渡邉美穂のBURSTで、合法なBACKSの交代先を自分で選び、再充填しましょう。'),inspect(32,'BURST後の渡邉美穂をタップし、BACKS復帰とチャージ回復を確認しましょう。'),result()];break;
  case 'バースト':course.steps=[inspect(key),place(key,'CENTER'),appeal(6),perform(1),burst(6),effect(6,'B'),result()];break;
  case 'フォーメーション移動':course.steps=[inspect(9),place(9,'CENTER'),appeal(9),perform(1),advance(2),{title:'3人を同時に登場させる',instruction:'BACKSの山崎をFRONT-R、井上をMIDDLE-L、遠藤理子をMIDDLE-Rへ。村井CENTERと小西FRONT-Lを残します。3人を動かしてから次へ進みましょう。',goal:{type:'place',formation:[9,28,24,13,2],condition:'entry-three'},success:'実際にBACKSから3人が登場する配置になりました。'},appeal(24,'村井Cと登場者への加算・位置疲労軽減を確認しましょう。','entry-three'),perform(2,undefined,'entry-three'),burst(9),result()];break;
  case '多属性':course.steps=[inspect(key),place(key,'CENTER'),appeal(22),perform(1),burst(22),inspect(22,'BURSTした森田をタップし、3属性のカード色を確認しましょう。'),result()];break;
  case '対スキル':course.steps=[inspect(7),place(7,'CENTER'),appeal(7,'相手CENTERの山下瞳月のCが無効になる配置です。相手の予測内訳も比べましょう。','anti-center'),perform(1,undefined,'anti-center'),effect(7,'C'),result()];break;
  case '疲労回復':course.prelude=1;course.firstSong='N';course.description='R1を終えたR2から。疲れた小坂をCENTERへ戻し、井上BACKSと山口の回復が計算に入ることを確かめます。';course.steps=[inspect(26),place(26,'CENTER'),appeal(26,'現在疲労と、計算直前の疲労予測を見比べましょう。井上・山口が実際に回復します。','recovery'),perform(2,undefined,'recovery'),effect(13,'A'),result()];break;
  case '疲労付与':course.steps=[inspect(key),place(key,'CENTER'),appeal(16,'大沼の対面を確認し、相手への疲労付与がある配置で予測を見ましょう。','fatigue-given'),perform(1,undefined,'fatigue-given'),effect(16,'A'),result()];break;
  case '対単一属性':course.steps=[inspect(40),place(40,'CENTER'),appeal(40),inspect(17,'幸坂のBACKS支援を確認しましょう。相手の属性を残したままCENTERを妨害します。'),appeal(40,'河田の属性人数参照と、幸坂のBACKS支援を内訳で確認します。'),perform(1),effect(17,'A'),result()];break;
  case '櫻坂46':course.firstSong='I';course.description='「静寂の暴力」のR1です。山下瞳月のCは、この楽曲では無効化されません。';course.steps=[inspect(11),place(11,'CENTER'),appeal(11),perform(1),effect(11,'C'),result()];break;
  case '日向坂46':course.firstSong='V';course.opening=[48,37,39,41,40];course.description='「JOYFUL LOVE」のR1です。今回は好花CENTERを試し、BURST人数0で働くCの加算を確認します。';course.steps=[inspect(48),place(48,'CENTER'),appeal(48),perform(1),effect(48,'C'),result()];break;
  case '指定8人':course.steps=[inspect(key),place(key,'CENTER'),appeal(41),perform(1),burst(41,'河田など先に待機しているBURSTを順に解決し、森本のBURSTも発動しましょう。'),inspect(41,'森本の次回加算と、通常BURSTを再使用できる状態を確認しましょう。'),result()];break;
 }
 return course;
}
export function trainingCourses():TrainingCourse[]{return [...basics,...DECK_GUIDES.map(deckCourse)];}
export function trainingCourse(id:string):TrainingCourse{const course=trainingCourses().find(course=>course.id===id);if(!course)throw new Error('未知の練習コースです。');return course;}
export function createTrainingSession(id:string):TrainingSession{
 const course=trainingCourse(id),deck=[...course.songs,...course.songs];deck.splice(deck.indexOf(course.firstSong),1);deck.unshift(course.firstSong);
 const g=createGame(course.members,[11,10,18,24,27,28,30,31],course.songs,course.songs,'local',random,{songDeck:deck,recordEffects:true});
 setFormation(g.p1,formationFromArray([...course.opening]),1);
 for(let round=0;round<course.prelude;round++){executeRound(g,g.p1.formation,g.p2.formation,random);nextRound(g,random);}
 if(course.displaceCenter){const back=course.members.find(id=>posOf(g.p1,id)==='BACK')!;setFormation(g.p1,placeCard(g.p1,'CENTER',back),g.round);}
 g.interactiveBursts=true;g.publicPlayers=undefined;
 return {courseId:id,game:g,stepIndex:0,stepComplete:false,complete:false,selected:null,appealFocus:null,effectIndex:0,effectVersion:0,observedEffects:[...(g.skillEffects||[])]};
}
export function trainingCondition(session:TrainingSession,condition?:Condition):boolean{
 if(!condition)return true;const g=session.game,p=g.p1;
 if(condition==='charge-backs')return [32,38,44].every(id=>posOf(p,id)==='BACK')&&posOf(p,43)!=='BACK';
 if(condition==='entry-three')return p.enteredThisRoundIds.length>=3;
 const predicted=preview(g),[own,enemy]=predicted.players;
 if(condition==='charge-spent')return own.states[32].spentCharge>=3;
 if(condition==='plain')return enemy.ids.every(id=>attributesOf(enemy,id).length===0);
 if(condition==='anti-center')return !!byId(enemy.formation.CENTER).C&&!resolveCenterSkills(own,enemy,g.roundSong)[1];
 if(condition==='recovery')return own.states[26].fatigue<p.states[26].fatigue;
 if(condition==='fatigue-given')return enemy.ids.some(id=>enemy.states[id].fatigue>g.p2.states[id].fatigue);
 return false;
}
export function trainingMessages(session:TrainingSession){return buildSkillMessages(session.observedEffects,session.game);}
function placementSatisfied(session:TrainingSession,goal:Extract<TrainingGoal,{type:'place'}>){const p=session.game.p1;return (goal.id===undefined||posOf(p,goal.id)===goal.slot)&&(!goal.formation||SLOTS.every((slot,index)=>p.formation[slot]===goal.formation![index]))&&trainingCondition(session,goal.condition);}
export function applyTrainingAction(session:TrainingSession,action:TrainingAction):TrainingSession{
 const course=trainingCourse(session.courseId),step=course.steps[session.stepIndex];
 if(!session.complete&&(action.type==='perform'||action.type==='advance-round')&&step.goal.type!==action.type)throw new Error('先に、上の課題の操作を試しましょう。');
 const mutates=['place','perform','advance-round','burst'].includes(action.type),next={...session,game:mutates?structuredClone(session.game):session.game},g=next.game;
 let fired:number|undefined,firedSide:number|undefined,conditionBefore=true;
 if(action.type==='inspect'||action.type==='appeal'){
  const p=action.side===0?g.p1:g.p2;if(!p.ids.includes(action.id))throw new Error('このチームにいないカードです。');next.selected={side:action.side,id:action.id};
  if(action.type==='inspect')next.appealFocus=null;
  if(action.type==='appeal'){if(posOf(p,action.id)==='BACK')throw new Error('BACKSはAppeal合計に入りません。');next.appealFocus={side:action.side,id:action.id};}
 }else if(action.type==='clear-selection'){next.selected=null;next.appealFocus=null;}
 else if(action.type==='place'){
  if(session.selected?.side!==0||session.selected.id!==action.id)throw new Error('先に移動する自分のカードをタップしてください。');
  if(g.roundResolved||pendingBurst(g))throw new Error('次のラウンドで配置を変更できます。');
  setFormation(g.p1,placeCard(g.p1,action.slot,action.id),g.round);next.appealFocus=null;
 }else if(action.type==='perform'){
  if(!session.complete&&step.goal.type==='perform'){conditionBefore=trainingCondition(next,step.goal.condition);if(!conditionBefore)throw new Error('課題の条件がまだ成立していません。配置と予測を見直しましょう。');}
  executeRound(g,g.p1.formation,g.p2.formation,random);next.observedEffects=[...(g.skillEffects||[])];next.effectIndex=0;
 }else if(action.type==='advance-round'){nextRound(g,random);next.observedEffects=[...(g.skillEffects||[])];next.effectIndex=0;next.appealFocus=null;}
 else if(action.type==='burst'){
  const job=pendingBurst(g);if(!job)throw new Error('発動待ちのBURSTはありません。');fired=job.id;firedSide=job.side;
  // The fixed opponent only chooses a legal target; no formation search or hidden lookahead.
  const kind=burstTargetKind(job.id),target=action.target??(job.side===1&&kind?burstTargetOptions(g,job)[0]:undefined);
  effectsFor(g)?.reset();resolveNextBurst(g,target,random);next.observedEffects=[...session.observedEffects,...(g.skillEffects||[])];
 }else if(action.type==='show-effect'||action.type==='review-effect'){
  if(!trainingMessages(session)[action.index])throw new Error('確認できる効果がありません。');next.effectIndex=action.index;next.effectVersion=session.effectVersion+1;
 }else if(action.type==='review-result'&&!g.result)throw new Error('先にパフォーマンスを実行しましょう。');
 if(session.complete)return next;
 const goal=step.goal;
 let met=false;
 if((goal.type==='inspect'||goal.type==='appeal')&&action.type===goal.type)met=action.id===goal.id&&action.side===(goal.side??0)&&trainingCondition(next,goal.condition);
 else if(goal.type==='place'&&action.type==='place')met=placementSatisfied(next,goal);
 else if(goal.type==='perform'&&action.type==='perform')met=g.round===goal.round&&conditionBefore;
 else if(goal.type==='advance-round'&&action.type==='advance-round')met=g.round===goal.round;
 else if(goal.type==='burst'&&action.type==='burst')met=firedSide===0&&fired===goal.id;
 else if(goal.type==='review-effect'&&action.type==='review-effect'){const event=trainingMessages(next)[action.index];met=!!event&&event.messageType==='target'&&(goal.sourceId===undefined||event.side===0&&event.id===goal.sourceId)&&(goal.kind===undefined||event.kind===goal.kind);}
 else if(goal.type==='review-result'&&action.type==='review-result')met=!!g.result;
 next.stepComplete=(session.stepComplete||met)&&(goal.type!=='place'||placementSatisfied(next,goal));
 return next;
}
export function advanceTrainingStep(session:TrainingSession):TrainingSession{
 if(!session.stepComplete)throw new Error('課題の操作を終えると次へ進めます。');
 const last=session.stepIndex===trainingCourse(session.courseId).steps.length-1;
 if(last&&session.game.pendingBursts?.length)throw new Error('残っている終了時BURSTを順に解決しましょう。');
 return last?{...session,complete:true}:{...session,stepIndex:session.stepIndex+1,stepComplete:false};
}
