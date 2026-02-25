import { useState, useCallback } from 'react';
import type { ToastMessage, ToastType } from '@/types';

let toastIdCounter = 0;

export function useToast(durationMs = 5000) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'ok') => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    [durationMs]
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}
