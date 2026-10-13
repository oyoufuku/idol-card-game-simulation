import { createPortal } from 'react-dom';
import { useEffect, useRef, type ReactNode } from 'react';
export function DetailSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return createPortal(<dialog ref={ref} className="detail-sheet" aria-labelledby="detail-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sheet-content"><div className="sheet-grip"/><header className="sheet-header"><h2 id="detail-title">{title}</h2><button autoFocus onClick={onClose} aria-label="詳細を閉じる">閉じる ×</button></header>{children}</div>
  </dialog>,document.body);
}
