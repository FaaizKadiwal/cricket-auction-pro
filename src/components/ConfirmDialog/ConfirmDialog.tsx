import type { ReactNode } from 'react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generic guarded-action dialog (dark, keyboard-dismissable via overlay/Escape-free). */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`${styles.confirmBtn} ${tone === 'danger' ? styles.confirmDanger : tone === 'success' ? styles.confirmSuccess : ''}`}
            onClick={onConfirm}
            autoFocus
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
