import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus management for dialogs: traps Tab/Shift+Tab inside the container,
 * closes on Escape, focuses the first `[data-autofocus]` (else first focusable)
 * element on open, and returns focus to the previously-focused element on close.
 *
 * Usage: `const ref = useFocusTrap<HTMLDivElement>(onClose);` then put `ref` on
 * the dialog panel. Mount/unmount the dialog conditionally (all ours are).
 */
export function useFocusTrap<T extends HTMLElement>(onClose?: () => void) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Initial focus: explicit [data-autofocus] wins, else the first focusable.
    const preferred = container.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusables()[0] ?? container).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) { e.preventDefault(); last.focus(); }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault(); first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return containerRef;
}
