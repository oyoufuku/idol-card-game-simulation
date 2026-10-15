import { createPortal } from 'react-dom';
import { useEffect, useRef, useId, type ReactNode } from 'react';
export function DetailSheet({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?:string }) {
  const ref = useRef<HTMLDialogElement>(null),titleId=useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return createPortal(<dialog ref={ref} className={`detail-sheet ${className}`} aria-labelledby={titleId} onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation();}} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sheet-content"><div className="sheet-grip"/><header className="sheet-header"><h2 id={titleId}>{title}</h2><button autoFocus onClick={onClose} aria-label="詳細を閉じる">閉じる ×</button></header>{children}</div>
  </dialog>,document.body);
}
