import { useEffect, useRef } from "react";
import "./StudentDetailDialog.css";

export default function StudentDetailDialog({ labelledBy, busy = false, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  function backdropClick(event) {
    if (event.target !== event.currentTarget || busy) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }
  return <dialog ref={dialogRef} aria-labelledby={labelledBy} className="student-detail-dialog rounded-2xl border border-white/15 bg-slate-900 p-0 text-slate-100 shadow-2xl shadow-black/50" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={backdropClick}>
    <div className="flex max-h-[calc(90dvh-2px)] min-h-0 flex-col">{children}</div>
  </dialog>;
}
