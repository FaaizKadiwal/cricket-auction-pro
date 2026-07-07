import type { ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
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

/**
 * Generic guarded-action dialog. Focus is trapped inside, Escape cancels, and
 * focus returns to the trigger on close. Danger dialogs deliberately focus
 * CANCEL first so a stray Enter can never fire a destructive action.
 */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', onConfirm, onCancel,
}: ConfirmDialogProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(onCancel);
  const focusCancelFirst = tone === 'danger';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div ref={panelRef} className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            data-autofocus={focusCancelFirst || undefined}
          >{cancelLabel}</button>
          <button
            className={`${styles.confirmBtn} ${tone === 'danger' ? styles.confirmDanger : tone === 'success' ? styles.confirmSuccess : ''}`}
            onClick={onConfirm}
            data-autofocus={!focusCancelFirst || undefined}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
