import { useEffect, useState } from 'react';

export function FullscreenButton() {
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = async () => {
    if (pending) return;
    setMessage('');
    setPending(true);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false) {
        // Called directly by the tap so the browser's user-activation requirement is preserved.
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } else {
        setMessage('このブラウザー、またはファイルの開き方では全画面を利用できません。');
      }
    } catch {
      setMessage('全画面に切り替えられませんでした。ブラウザーやファイルの開き方によっては利用できない場合があります。');
    } finally {
      setPending(false);
    }
  };

  return <div className="fullscreen-control">
    <button type="button" className="fullscreen-toggle" aria-pressed={active} disabled={pending} onClick={toggle} title={active ? '通常の表示に戻す' : 'アドレスバーを隠して表示'}>{active ? '全画面を終了' : '全画面'}</button>
    {message && <div className="fullscreen-feedback" role="status"><span>{message}</span><button type="button" aria-label="全画面の案内を閉じる" onClick={() => setMessage('')}>×</button></div>}
  </div>;
}
