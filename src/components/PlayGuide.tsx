import {useEffect,useMemo,useRef,useState} from 'react';
import {DECK_GUIDES,GUIDE_LESSONS,type DeckGuide,type GuideLesson} from '../data/play-guide';
import {SHARED_RULES} from '../data/shared-rules';
import {byId,POSITION_BONUS,POSITION_FATIGUE} from '../game/formation';
import {fatiguePenalty} from '../game/fatigue';
import {scoreRound} from '../game/scoring';
import {SLOTS} from '../game/types';
import {songById} from '../data/songs';
import {constructedTeams} from '../simulation/constructed-teams';
import type {Team} from '../simulation/teams';
import {DetailSheet} from './DetailSheet';
import {TrainingBoard} from './TrainingBoard';
import {createTrainingSession,trainingCourses,type TrainingSession} from '../tutorial/training';
import {OPEN_PLAY_GUIDE} from './guide-events';
const positionLabels={CENTER:'CENTER','FRONT-L':'FRONT L','FRONT-R':'FRONT R','MIDDLE-L':'MIDDLE L','MIDDLE-R':'MIDDLE R'};

export function LessonVisual({kind}:{kind:GuideLesson['visual']}){
 if(kind==='score')return <table className="guide-table"><caption>1回の勝利で得るポイント</caption><thead><tr><th>Appeal差</th><th>R1〜R6</th><th>R7</th></tr></thead><tbody>{[9,10].map(difference=><tr key={difference}><th>{difference===9?'1〜9':'10以上'}</th><td>{scoreRound(difference,0,1).points}</td><td>{scoreRound(difference,0,7).points}</td></tr>)}</tbody></table>;
 if(kind==='formation')return <div className="guide-field" aria-label="ステージ5枠の位置ボーナスと疲労">{(['MIDDLE-L','FRONT-L','CENTER','FRONT-R','MIDDLE-R'] as const).map(slot=><div key={slot} className={`guide-slot guide-slot-${slot.split('-')[0].toLowerCase()}`}><b>{positionLabels[slot]}</b><span>Appeal ＋{POSITION_BONUS[slot]}</span><span>疲労 ＋{POSITION_FATIGUE[slot]}</span></div>)}</div>;
 if(kind==='fatigue')return <table className="guide-table"><caption>通常の疲労ペナルティ（小坂・楽曲などの補正前）</caption><thead><tr><th>現在の疲労値</th><th>Appealへの影響</th></tr></thead><tbody>{[[0,'0〜2'],[3,'3〜4'],[5,'5〜6'],[7,'7以上']].map(([value,label])=><tr key={label}><th>{label}</th><td>{fatiguePenalty(100,Number(value))-100}</td></tr>)}</tbody></table>;
 return null;
}

function LessonQuiz({quiz}:{quiz:NonNullable<GuideLesson['quiz']>}){
 const [answer,setAnswer]=useState<number|null>(null);
 return <section className="guide-quiz" aria-label="確認問題"><h4>ひとつ確認</h4><p>{quiz.question}</p><div role="group" aria-label={quiz.question}>{quiz.answers.map((text,index)=><button type="button" key={text} aria-pressed={answer===index} onClick={()=>setAnswer(index)}>{text}</button>)}</div>{answer!==null&&<p className="quiz-answer" role="status"><b>{answer===quiz.correct?'正解です。':'もう一度確認しましょう。'}</b>{quiz.explanation}</p>}</section>;
}

export function GuideLessonView({lesson,onRule,onPractice}:{lesson:GuideLesson;onRule:(title:string)=>void;onPractice?:()=>void}){
 return <article className="guide-lesson"><h3 tabIndex={-1}>{lesson.title}</h3><p className="guide-lead">{lesson.lead}</p>{onPractice&&<button type="button" className="guide-practice-start" onClick={onPractice}>盤面でこの項目を練習</button>}<LessonVisual kind={lesson.visual}/><ol className="guide-points">{lesson.points.map(text=><li key={text}>{text}</li>)}</ol><p className="guide-practice"><b>やってみよう</b>{lesson.tryThis}</p>{lesson.quiz&&<LessonQuiz key={lesson.id} quiz={lesson.quiz}/>}<div className="guide-rule-links">{lesson.rules.map(code=>{const rule=SHARED_RULES.find(rule=>rule.code===code);return rule&&<button type="button" key={code} onClick={()=>onRule(rule.title)}>詳しいルール：{rule.title}</button>;})}</div></article>;
}

export function DeckGuideView({team,guide,onPractice}:{team:Team;guide:DeckGuide;onPractice?:()=>void}){
 const opening=new Set(guide.opening),backs=team.members.filter(id=>!opening.has(id));
 return <article className="deck-guide-view"><header><span className="guide-level">{guide.level}</span><h3 tabIndex={-1}>{team.name}</h3><p className="guide-lead">{guide.goal}</p>{onPractice&&<button type="button" className="guide-practice-start" onClick={onPractice}>このデッキを盤面で練習</button>}</header>
  <section><h4>最初の配置例</h4><p>{guide.openingWhy}</p><p className="guide-note">初期配置は一例です。楽曲・相手・疲労に合わせて変更できます。</p><div className="guide-opening">{SLOTS.map((slot,index)=><div key={slot} data-opening-slot={slot} data-member-id={guide.opening[index]}><b>{positionLabels[slot]}</b><span>{byId(guide.opening[index]).name}</span></div>)}<div className="guide-opening-backs"><b>BACKS</b><span>{backs.map(id=>byId(id).name).join('・')}</span></div></div></section>
  <section className="guide-gameplan"><h4>ラウンドの進め方</h4><dl><div><dt>序盤 R1〜R2</dt><dd>{guide.early}</dd></div><div><dt>中盤 R3〜R6</dt><dd>{guide.middle}</dd></div><div><dt>最後のR7へ</dt><dd>{guide.encore}</dd></div></dl></section>
  <section><h4>狙うBURST</h4><p>{guide.burst}</p><p className="guide-note">R7終了時に新しくBURSTはしません。次回用の効果はR6までに準備しましょう。</p></section>
  <section><h4>3曲の使いどころ</h4><ul className="guide-songs">{team.songs.map(id=>{const song=songById(id);return <li key={id} data-song-id={id}><b>{song.name}〈{song.type}〉</b><p>{team.reasons[id]?.join(' ')}</p><details><summary>現在の楽曲効果</summary><p>{song.effect}</p></details></li>;})}</ul></section>
  <section><h4>気をつけること</h4><ul>{guide.watch.map(text=><li key={text}>{text}</li>)}</ul></section>
  <section><h4>8人の現在の能力</h4><p className="guide-note">手動で入れ替える前の構築済みリストです。</p><div className="guide-members">{team.members.map(id=>{const card=byId(id);return <details key={id} data-guide-card={id}><summary>{card.name}〈{card.attr}・基礎{card.base}〉</summary><dl>{[['Aスキル',card.A],['B条件',card.Bcond],['Bスキル',card.B],['Cスキル',card.C]].map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text||'なし'}</dd></div>)}</dl></details>;})}</div></section>
 </article>;
}

export function PlayGuide({onOpenChange}:{onOpenChange?:(open:boolean)=>void}){
 const [open,setOpen]=useState(false),[section,setSection]=useState<'basics'|'decks'|'practice'>('basics'),[lessonIndex,setLessonIndex]=useState(0);
 const [training,setTraining]=useState<TrainingSession|null>(null);
 const courses=useMemo(()=>trainingCourses(),[]);
 const startPractice=(id:string)=>{setTraining(createTrainingSession(id));setSection('practice');};
 const teams=useMemo(()=>constructedTeams(),[]),[deckName,setDeckName]=useState(DECK_GUIDES[0].name),content=useRef<HTMLDivElement>(null);
 useEffect(()=>{const show=(event:Event)=>{const name=String((event as CustomEvent).detail||'');if(teams.some(team=>team.name===name)){setDeckName(name);setSection('decks');}else setSection('basics');setOpen(true);};window.addEventListener(OPEN_PLAY_GUIDE,show);return()=>window.removeEventListener(OPEN_PLAY_GUIDE,show);},[teams]);
 useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
 useEffect(()=>{if(!open)return;content.current?.closest('dialog')?.scrollTo({top:0});content.current?.querySelector<HTMLElement>('h3')?.focus({preventScroll:true});},[open,section,lessonIndex,deckName,training?.courseId]);
 const guide=DECK_GUIDES.find(guide=>guide.name===deckName),team=teams.find(team=>team.name===deckName);
 const showRule=(title:string)=>{setOpen(false);window.dispatchEvent(new CustomEvent('open-shared-rulebook',{detail:title}));};
 return <><button type="button" className="play-guide-button" onClick={()=>setOpen(true)}>遊び方・デッキガイド</button>{open&&<DetailSheet title="遊び方・デッキガイド" className={`play-guide-sheet${section==='practice'?' training-guide-sheet':''}`} onClose={()=>setOpen(false)}><div className="play-guide" ref={content}>
  <nav className="guide-tabs" aria-label="ガイドの種類"><button type="button" aria-pressed={section==='basics'} onClick={()=>setSection('basics')}>はじめての遊び方</button><button type="button" aria-pressed={section==='decks'} onClick={()=>setSection('decks')}>構築済みデッキ別</button><button type="button" aria-pressed={section==='practice'} onClick={()=>{if(!training)startPractice(courses[0].id);else setSection('practice');}}>盤面で練習</button></nav>
  <p className="guide-note">ガイドを開いている間は自動演出を一時停止します。閉じると元の設定で再開します。</p>
  {section==='basics'?<><label className="guide-select">読みたい項目<select value={lessonIndex} onChange={e=>setLessonIndex(Number(e.target.value))}>{GUIDE_LESSONS.map((lesson,index)=><option key={lesson.id} value={index}>{lesson.title}</option>)}</select></label><p className="guide-step">{lessonIndex+1} / {GUIDE_LESSONS.length}　途中で閉じても、この起動中は続きから読めます。</p><GuideLessonView key={GUIDE_LESSONS[lessonIndex].id} lesson={GUIDE_LESSONS[lessonIndex]} onRule={showRule} onPractice={()=>startPractice(`basic:${GUIDE_LESSONS[lessonIndex].id}`)}/><nav className="guide-page-controls" aria-label="入門ガイドのページ"><button type="button" disabled={lessonIndex===0} onClick={()=>setLessonIndex(index=>index-1)}>前へ</button>{lessonIndex<GUIDE_LESSONS.length-1?<button type="button" onClick={()=>setLessonIndex(index=>index+1)}>次へ →</button>:<button type="button" onClick={()=>setSection('decks')}>デッキの戦い方へ →</button>}</nav></>
   :section==='practice'?<><label className="guide-select"><span>練習する項目・デッキ</span><select value={training?.courseId} onChange={e=>startPractice(e.target.value)}>{(['入門','デッキ'] as const).map(group=><optgroup key={group} label={group}>{courses.filter(course=>course.group===group).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</optgroup>)}</select></label>{training&&<TrainingBoard key={training.courseId} session={training} onChange={setTraining}/>}</>
   :<><label className="guide-select">戦い方を見るデッキ<select value={deckName} onChange={e=>setDeckName(e.target.value)}>{teams.map((team,index)=><option key={team.name} value={team.name}>{index+1}. {team.name}</option>)}</select></label>{team&&guide?<DeckGuideView key={team.name} team={team} guide={guide} onPractice={()=>startPractice(`deck:${team.name}`)}/>:<p>このデッキのガイドは準備中です。</p>}</>}
 </div></DetailSheet>}</>;
}
