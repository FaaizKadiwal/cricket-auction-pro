import { useState, useEffect, useCallback } from 'react';

/**
 * Generic localStorage hook with JSON serialization and type safety.
 * Falls back to initialValue if the key doesn't exist or JSON parse fails.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Lazy initializer — reads from localStorage only once on mount
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      console.warn(`useLocalStorage: failed to read key "${key}". Using initialValue.`);
      return initialValue;
    }
  });

  // Write to localStorage whenever value changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      console.warn(`useLocalStorage: failed to write key "${key}".`);
    }
  }, [key, storedValue]);

  // Stable setter that accepts either a value or an updater function
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        return next;
      });
    },
    []
  );

  // Remove from localStorage and reset to initial
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}
