import { useState, useCallback } from 'react';
import type { ToastMessage, ToastType } from '@/types';

let toastIdCounter = 0;

const EXIT_DURATION = 300;

export function useToast(durationMs = 5000) {
  const [toasts,     setToasts]     = useState<ToastMessage[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  const removeToast = useCallback((id: number) => {
    setExitingIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setExitingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, EXIT_DURATION);
  }, []);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'ok') => {
      toastIdCounter = (toastIdCounter + 1) % 1_000_000;
      const id = toastIdCounter;
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => removeToast(id), durationMs);
    },
    [durationMs, removeToast]
  );

  const dismissToast = useCallback((id: number) => {
    removeToast(id);
  }, [removeToast]);

  return { toasts, exitingIds, showToast, dismissToast };
}
