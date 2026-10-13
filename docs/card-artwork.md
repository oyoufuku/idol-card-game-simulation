# 通常画像・BURST画像の登録

画像は表示専用の [card-artwork.ts](../src/data/card-artwork.ts) にアイドルIDで登録します。能力・数値・Excelのカタログを変更する必要はありません。現在は画像未登録です。

1. `src/assets/cards/` に通常画像とBURST画像を保存します。JPEG・PNG・WebPなどを使えます。
2. `card-artwork.ts` に画像をimportし、`CARD_ARTWORK` にIDを追加します。次はID 1の例です。ファイル名は実際の画像に合わせてください。

```ts
import normal01 from '../assets/cards/01-normal.webp?inline';
import burst01 from '../assets/cards/01-burst.webp?inline';

export const CARD_ARTWORK: Readonly<Partial<Record<number, CardArtwork>>> = {
  1: {
    normal: normal01,
    burst: burst01,
    normalPosition: '50% 50%',
    burstPosition: '50% 30%',
  },
};
```

3. `pnpm build:testplay` を実行すると、画像を埋め込んだ `testplay/index.html` が生成されます。`?inline` は大きな画像もHTML内に含めるために必要です。外部URLや `public/` へのパスはオフライン版には使わないでください。

通常時は上側の横長画像枠、BURST中はカード全面に画像を表示します。BURST画像は縦長（例：2:3）を推奨します。画像は枠を埋めるように拡大し、はみ出す部分をトリミングします。`normalPosition`・`burstPosition` はCSSの `object-position` と同じ指定で、顔などを見せたい位置へ調整できます。

盤面・相手カード・左の拡大カードで同じ切り替えを使用します。名前・属性・スキルは全面画像の上に半透明のパネルで表示します。能力文やゲーム計算は変わりません。

- BURST画像未登録：通常画像を全面に表示します。
- 両方未登録、または画像の読み込み失敗：属性色と光の仮デザインを表示します。
- BURST画像だけ登録：通常時は仮デザイン、BURST時は登録画像を表示します。
- 通常BURST使用済みで発動中ではない場合：通常画像のままです。
- 次のパフォーマンス終了・JOYFUL LOVEなどでBURST状態解除：通常の画像枠へ戻ります。

BURST発動時の中央演出も同じ画像登録を使用します。通常画像のカードが拡大して登場し、反転後にBURST専用の全面画像を表示します。画像がなくても両面の仮デザインで動作し、「動きを減らす」設定ではBURST側を静的表示します。
