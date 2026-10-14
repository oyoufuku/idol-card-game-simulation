import {byId} from '../game/formation';
import {SONGS} from '../data/songs';
import type {Team} from './teams';
import type {Attribute} from '../game/types';

export const CONSTRUCTED_DECK_POLICY='constructed-decks-20261014-v5';
export const CONSTRUCTED_DECK_SOURCE='docs/simulation/constructed-decks-20261014.md';
export const CONSTRUCTED_AXIS_TAGS=['クール','チャージ','バースト','フォーメーション移動','多属性','対スキル','疲労回復','疲労付与','対単一属性'] as const;
// Affiliation for the two selected decks only. MCタイム is a common game song;
// special songs K/S remain engine-only and cannot be selected in any deck.
export const GROUP_SONG_IDS={
 '櫻坂46':['A','B','C','D','E','F','G','H','I','K'],
 '日向坂46':['L','M','N','O','P','Q','R','S','T','U','V'],
} as const;
export function songBelongsToGroup(id:string,group:keyof typeof GROUP_SONG_IDS):boolean {
 return (GROUP_SONG_IDS[group] as readonly string[]).includes(id);
}
interface Definition {name:string;theme:string;members:number[];songs:string[];plan:string;memberReasons?:Record<number,string>;songReasons:string[];caveats:string[];fixedMembers?:number[];group?:keyof typeof GROUP_SONG_IDS;allowedAttributes?:Attribute[]}

// Hand-authored using B-condition L1/L2 before playing. No result files are loaded.
// The 9-axis pool covers all 48 cards exactly once or twice; the 3 extra decks
// have independent membership and do not count toward that coverage objective.
const memberRoles:Record<number,string>={
 1:'対面クールへのAUTO減少と、低い相手総Appealを条件にした全体妨害。',
 2:'疲労増加を軽減し、BURSTの対面減少で持久戦を支える。',
 3:'相手クール人数を参照し、BURSTで相手へクール追加。',
 4:'BACKSから前3枠への数値減少を軽減し、疲労交換を使う。',
 5:'キュートFRONT条件と、非キュートへのCENTER妨害。',
 6:'ユーモア3人から強制BURSTを起動し、現在BURST人数を得点へ変える。',
 7:'対面AUTOと相手CENTER SKILLの無効化、BURST反応の位置固定。',
 8:'ポイント優勢時だけ働くクール支援。無条件の加算役とは扱わない。',
 9:'BACKSからの登場時保護と登場者へのC加算。3人同時登場後は味方への保護展開を狙う。',
 10:'ステージのクール3人でAUTO、クール曲のBACKS経験で味方強化。',
 11:'クール曲のCENTER AUTOと自己Cで序盤の得点を確保。',
 12:'同時BURSTから使用済みリセット、BURST中の味方へのC加算。',
 13:'シンメまたはBACKSからCENTERを回復し、全体回復も使う。',
 14:'クールのシンメと前3枠を組み、特殊楽曲への変更を狙う。',
 15:'相手のAppeal減少を拒否する防御支援。味方の加算も拒否する。',
 16:'対面疲労を付与し、高疲労条件から再BURSTする。基礎値低下も伴う。',
 17:'BACKSから相手CENTERを妨害し、必要時はFRONT固定を使う。',
 18:'クール曲でAUTO、連続クール曲からBURSTを狙う。',
 19:'相手BACKSからのBURSTへ反応し、CENTER固定・B無効で対策する。',
 20:'相手AUTOの上昇参照と、クールへの相手AUTO減少の保護。',
 21:'非ユーモアへの疲労付与と相手総疲労を利用する。自軍も対象。',
 22:'自軍3属性を使う対面/CENTER妨害と、前3枠の3属性BURST。',
 23:'高疲労相手へのAUTO/C減少で、疲労付与を得点差へ変換。',
 24:'劣勢時のクール得点と敗北後の回復・次回支援。',
 25:'本人の位置維持でAUTO/Cを使い、BURSTで自軍位置ボーナスを強化。',
 26:'序盤の位置ボーナス・低疲労Cを得点源にし、疲労倍化の負担は休息・回復で管理。',
 27:'クール3人とクールCENTERでAUTO・永続BURSTを狙う。',
 28:'クールの相方を替えてAUTOと3人シンメ経験のBURSTを使う。',
 29:'自軍の疲労ペナルティをAUTO/Cの条件として利用。',
 30:'選択曲を3属性にし、登場済み楽曲属性によるAUTOとBURSTを狙う。',
 31:'回復・軽減で低総疲労のAUTO/B条件を狙う。',
 32:'固定チャージコア。BACKS蓄積を自身のAppealへ変換し、BURSTで復帰・回復。',
 33:'高基礎値の相手を妨害。Cの基礎変更は常に有利とは限らない。',
 34:'FRONTで対面に疲労を付与し、BURSTで相手FRONT位置ボーナスを無効にする。',
 35:'ステージ属性数で妨害し、BACKS3属性からクール/ユーモアを保護する。',
 36:'キュート曲の妨害とPLAINによる相手属性シナジー崩し。',
 37:'位置維持から対面妨害、BURSTで相手位置ボーナスを無効にする。',
 38:'固定チャージコア。蓄積を相手CENTERのAppeal減少へ変換する。',
 39:'低疲労AUTOと総疲労比較CでFRONTを妨害。',
 40:'基礎5と、相手単独最多属性・CENTERへの妨害。',
 41:'高基礎値とランダム属性追加を得点・楽曲一致の自己BURSTに使う。',
 42:'自軍最高疲労を回復し、相手最高疲労へ付与。BURST中は両方の量が増える。',
 43:'ステージからBACKS3人へ追加チャージ。支援採用の例外。',
 44:'固定チャージコア。投入時のCENTER疲労減少/付与と、BURST後の再蓄積。',
 45:'位置種別経験を得点へ変え、相手の移動・位置疲労を妨害。',
 46:'連続楽曲属性から特殊楽曲へ変更するユーモア役。',
 47:'味方ステージ5人のBURST経験から2人への強制BURSTを狙う。',
 48:'低BURST時の自己加算で、相手がBURSTしない局面にも得点役を確保。',
};

const definitions:Definition[]=[
 {name:'クール・シンメ連動',theme:'クール',members:[11,10,18,14,27,8,4,15],songs:['A','M','E'],plan:'クール利用コアを保ち、条件付き・防御支援で調整。有力支援を集中させない。',songReasons:['クール人数に応じて加算。相手クールも対象。','MIDDLEの位置加算で得点を分散。','クール曲を維持し、劣勢側を補助。優勢時は相手を助ける。'],caveats:['大園は味方の加算も拒否。','森田の多属性能力をクール利用と混同しない。']},
 {name:'チャージ・序盤安定',theme:'チャージ',members:[32,38,44,43,25,26,39,40],songs:['F','J','N'],fixedMembers:[32,38,44],plan:'3コアを蓄積し、支援5人の序盤得点・疲労管理を厚くする。',songReasons:['BACKSからのコア投入に加算。','長く出場する支援の疲労を回復。相手も回復。','小坂などの疲労ペナルティを軽減。疲労値は下がらない。'],caveats:['CHARGE CPUはこのデッキだけ。','R5投入・R6復帰・R7再投入は得点状況に応じて変わる。','金村本人の位置維持はコア3人の出入りを固定しない。']},
 {name:'BURST・連鎖と疲労',theme:'バースト',members:[6,12,47,16,22,29,34,18],songs:['C','M','N'],plan:'BURST連鎖コアを残し、森本・金村への集中を避けて条件成立の支援に振る。',songReasons:['ユーモア中心の自軍を保ち、相手非ユーモアへ疲労。自軍も対象。','低基礎値コアのMIDDLE出場を得点で支える。','疲労減点を軽減。疲労ペナルティ判定は残り正源司の条件を維持。'],memberReasons:{34:'FRONTの疲労付与で大沼の条件を支援。',18:'クールの3属性担当。選択曲のクール2曲でAUTOと連続クール曲BURSTを狙い、自軍BURST人数の条件を補う。'},caveats:['通常CPUを使用。','前3枠の3属性にはクール・キュート担当も必要。']},
 {name:'移動・疲労軽減',theme:'フォーメーション移動',members:[45,9,28,24,27,13,31,2],songs:['F','J','N'],fixedMembers:[45,9,28],plan:'移動3コアを維持し、低疲労支援と劣勢時の得点・疲労支援で補う。',songReasons:['実際のBACKSからの登場に加算。','移動後の疲労を回復。相手も回復。','移動・出場の疲労減点を軽減。'],memberReasons:{24:'CENTER固定を要求しない劣勢時の得点役。敗北時のCで出場者を回復・次回加算し、小西のクール相方にもなる。',27:'小西・山崎・宮田とクールのシンメ候補を確保。',31:'井上・遠藤理子と回復曲に合わせ、低総疲労を得点へ変える。'},caveats:['山崎Cの敗北時支援と村井Cの登場者支援はCENTERを使い分ける。','移動だけを目的にせず、そのラウンドの得点も確保。']},
 {name:'多属性・属性数活用',theme:'多属性',members:[22,30,35,46,41,15,17,33],songs:['N','P','F'],plan:'ステージとBACKS双方の3属性を成立可能にし、追加属性・楽曲属性を使う。',songReasons:['出場・交代で増えた疲労の減点を軽減。クール曲を確保するが、クール人数に比例して相手へ加算しない。相手も疲労軽減。','森田・森本の複数属性で総属性数を増やし、相手CENTERへの減少を狙う。','3種類目のユーモア曲を確保し、属性配置を組み直す際の登場を支援。'],caveats:['選択3曲は3属性を各1曲。','元属性でもステージ/BACKS双方の3属性が成立可能。','元クール2人で相手クールへの加算が上回りうるStart over!は外す。','上村Cの基礎値操作の利益は保証しない。']},
 {name:'対スキル・封殺',theme:'対スキル',members:[7,19,9,20,37,34,48,36],songs:['V','B','N'],plan:'AUTO・CENTER妨害と対BURSTを残し、高寄与の汎用得点支援を集中させない。',songReasons:['両チームのBURST継続効果を解除し、相手BURST強化を対策。松田好花の低BURST人数条件も支える。','キュート妨害役を中心に、非キュート相手へ減少。','高疲労になった出場者の減点を軽減。'],caveats:['JOYFUL LOVEのラウンドは田村AUTO/CのBURST中相手への減少と、宮地のBURST継続効果が不発。発動済みの位置固定・B無効など状態効果は残る。','夏の近道は非キュートの味方も減少。','的野・田村・藤嶌のCENTER能力は使い分ける。']},
 {name:'疲労回復・持久戦',theme:'疲労回復',members:[13,42,39,31,2,24,4,26],songs:['J','N','T'],plan:'回復と軽減を重ね、低総疲労を得点・妨害へ変える。',songReasons:['8人全体回復で低総疲労条件を支援。相手も回復。','回復しきれない疲労の減点を軽減。','回復で低い疲労値を揃える運用を補助。同数は不発。'],memberReasons:{26:'回復で低疲労Cと位置得点を維持する得点役。'},caveats:['疲労付与に勝ち越すことはまだ未検証。','小坂の疲労倍化・BURST後疲労も管理。']},
 {name:'疲労付与・高疲労妨害',theme:'疲労付与',members:[16,21,23,42,45,37,29,41],songs:['C','D','M'],plan:'高疲労相手の妨害を保ち、自軍を巻き込む曲を減らして得点役を補う。',songReasons:['ユーモア中心の自軍に対し、非ユーモアへ疲労。','高疲労相手の減点を倍化。自軍にも作用。','付与だけで得点不足にならないようMIDDLE得点を補う。'],memberReasons:{41:'高基礎値・自己BURSTで序盤得点を補うユーモア役。増本AUTOの自軍疲労対象にならない。'},caveats:['全員の疲労を倍化するキツネと、自軍の移動にも疲労を与えるアザトカワイイは外す。','非ユーモアの味方は増本AUTOとMake or Breakの対象。']},
 {name:'対単一属性・クールメタ',theme:'対単一属性',members:[3,40,1,5,17,20,19,36],songs:['B','Q','P'],plan:'小田倉・河田を核に、対クール効果とキュート主体の楽曲を組み合わせる。',songReasons:['キュート主体の自軍に対し、クール主体の相手へ広く減少。','単独最多属性を減少。自軍キュートも対象。','PLAIN CENTER運用で相手総属性数を0にし、相手CENTER減少を狙う。'],memberReasons:{19:'クール曲のBACKS経験でBURSTする村山などへCENTER固定・B無効を狙う対策支援。',36:'河田/谷口CENTERとは別運用。PLAINで属性シナジーと魔物の属性数を妨害。'},caveats:['静寂の暴力は河田/谷口Cを止め、山下瞳月Cは止められないため外す。','藤嶌CENTERのPLAIN中は小田倉・河田の属性人数参照が不発。CENTERを使い分ける。']},
 {name:'櫻坂選抜',theme:'櫻坂46',group:'櫻坂46',members:[11,10,20,22,7,13,17,24],songs:['A','I','H'],plan:'山下瞳月・村山・藤吉・森田・的野のステージ出役を主体に、得点とAUTO/CENTER妨害を組み合わせる。井上・幸坂は補助。楽曲は櫻坂のみ。',songReasons:['ステージのクール3人を組み、得点役を直接支援。相手クールも加算対象。','相手CENTER SKILLを止める。山下瞳月Cはこの楽曲の無効化を受けず、主CENTERの得点を保てる。','森田のキュート・的野/井上のユーモア・クール出役で3属性を揃え、3属性を欠く相手のステージ全体を減少させる。'],memberReasons:{13:'ステージ出役を支える回復補助。BACKSに置く場合はCENTERを回復する。',17:'ステージ出役を支える妨害補助。BACKSでは相手CENTERへ減少を与える。'},caveats:['BACKS固定を主戦術にしない。CPUの配置固定など追加ルールも作らない。','静寂の暴力のラウンドは山下瞳月以外の自軍Cも無効になる。','UDAGAWA GENERATIONは自軍がステージ3属性を崩した場合も5人を減少させる。','先行時に相手を助ける何歳の頃に戻りたいのか？は選択しない。','所属による追加のゲーム効果はない。']},
 {name:'日向坂選抜',theme:'日向坂46',group:'日向坂46',allowedAttributes:['キュート','ユーモア'],members:[40,36,39,37,41,42,46,48],songs:['Q','P','V'],plan:'キュート4人・ユーモア4人で、属性妨害・位置維持妨害・疲労管理と低BURST時の得点を組み合わせる。楽曲は日向坂のキュート/ユーモアのみ。',songReasons:['相手の単独最多属性へ減少。2属性を組み合わせ、単属性相手への対策を狙う。自軍最多属性も減少対象。','森本の追加属性で総属性数を増やし、相手CENTERへの減少を狙う。相手側の属性追加が多ければ自軍が減少対象になる。','相手BURST継続効果を解除し、松田好花の低BURST人数条件を支援。自軍の継続効果も解除される。'],memberReasons:{40:'キュートの得点役と最多属性妨害。PLAINとは別のCENTER運用。',36:'キュート2曲でAUTO・BURSTを狙い、CENTER時はPLAINで属性シナジーを崩す。',39:'山口の疲労管理と交代を利用し、低疲労AUTOと総疲労比較Cを使う。',37:'FRONT/MIDDLEなど本人の位置を維持して妨害するキュート役。',41:'ユーモアの得点役。追加属性を魔物に使い、追加キュート時は2曲のキュートでBURSTを狙う。',42:'自軍の最高疲労を回復し、相手へ付与するユーモア支援。',46:'キュート2曲を含む楽曲属性の連続を利用し、特殊楽曲への変更も狙う。',48:'JOYFUL LOVEでBURST人数が0になるラウンドのAUTO/C得点を担当。'},caveats:['元属性はキュート4人・ユーモア4人。森本の追加クールは能力通り発生する。','JOYFUL LOVEのラウンドは森本のBURST加算・宮地のBURST継続妨害・山口のBURST中AUTO強化も消える。','藤嶌CENTERのPLAIN中は河田の相手属性人数参照が不発。CENTERを使い分ける。','元属性だけで3属性のステージ/BACKSを揃える構築ではないため、清水・平岡を主役として採用しない。']},
 {name:'指定8人・妨害とBURST',theme:'指定8人',members:[7,12,19,4,1,40,41,28],songs:['B','N','J'],fixedMembers:[7,12,19,4,1,40,41,28],plan:'指定8人を固定し、CENTER妨害とBURST利用を組み合わせる。',songReasons:['キュート妨害役を支援し、森本のキュート追加時にBURSTを狙う。','疲労減点を軽減し、森本のクール追加時にBURSTを狙う。','出場者の疲労を回復。相手も回復。'],memberReasons:{28:'指定メンバー。森本にクールが追加された時にクールのシンメを狙う。'},caveats:['松田は松田里奈。','小西のクール相方は森本のランダム追加に依存し、常時AUTO成立は保証しない。','小西Bの3人シンメ経験は相方の属性を問わない。','指定8人の入れ替えcWARは欠測。スキル除外検査は別途可能。']},
];

export function isConstructedTeam(team:Team):boolean {
 return /^constructed-decks-\d{8}-v\d+$/.test(team.selectionPolicy??'');
}

export function constructedTeams():Team[]{
 return definitions.map(definition=>{
  if(definition.members.length!==8||new Set(definition.members).size!==8||definition.songs.length!==3||new Set(definition.songs).size!==3)throw new Error(`Invalid constructed deck: ${definition.name}`);
  for(const id of definition.members){const card=byId(id);if(definition.group&&card.group!==definition.group)throw new Error(`Invalid group in constructed deck: ${definition.name}`);if(definition.allowedAttributes&&!definition.allowedAttributes.includes(card.attr))throw new Error(`Invalid attribute route: ${definition.name}`);}
  for(const id of definition.songs){if(!SONGS.some(song=>song.id===id&&song.selectable!==false))throw new Error(`Invalid constructed song ${id}: ${definition.name}`);if(definition.group&&!songBelongsToGroup(id,definition.group))throw new Error(`Invalid song affiliation ${id}: ${definition.name}`);}
  const reasons:Record<string,string[]>={};
  for(const id of definition.members)reasons[String(id)]=[definition.memberReasons?.[id]??memberRoles[id]];
  definition.songs.forEach((id,i)=>{reasons[id]=[definition.songReasons[i]];});
  return {selectionPolicy:CONSTRUCTED_DECK_POLICY,name:definition.name,archetype:definition.name,members:[...definition.members],songs:[...definition.songs],mainTags:[definition.theme],subTags:[],reasons,construction:{profile:'9アーキタイプ＋2選抜＋指定8人',plan:definition.plan,...(definition.fixedMembers?{fixedMembers:[...definition.fixedMembers]}:{}),...(definition.allowedAttributes?{allowedAttributes:[...definition.allowedAttributes]}:{}),caveats:[...definition.caveats,'B条件L1/L2を事前の手動支援調整に使用。調整後の勝率は未検証。','対戦中に結果を見て構築を変更しない。']}};
 });
}
