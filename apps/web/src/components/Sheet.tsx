"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import styles from "./Sheet.module.css";

/** A bottom sheet built on <dialog>, so focus, Escape and the backdrop behave natively. */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.inner}>
        <span className={styles.grabber} aria-hidden="true" />
        <div className={styles.head}>
          <h2 id="sheet-title" className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
