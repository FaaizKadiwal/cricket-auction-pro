import type { ToastMessage } from '@/types';
import { Icon } from '@/components/Icon/Icon';
import styles from './Toast.module.css';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.type === 'ok' ? styles.toastOk : styles.toastWarn}`}
          role="alert"
        >
          <span className={styles.icon} aria-hidden="true">
            {t.type === 'ok'
              ? <Icon name="check-circle" size={16} />
              : <Icon name="alert-triangle" size={16} />}
          </span>
          <span className={styles.message}>{t.msg}</span>
          <button
            className={styles.dismiss}
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
