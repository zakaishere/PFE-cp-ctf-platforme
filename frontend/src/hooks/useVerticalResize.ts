import { useCallback, useEffect, useRef, useState } from 'react';

export function useVerticalResize({
  initialTopPercent = 60,
  minTopPercent     = 30,
  maxTopPercent     = 85,
  storageKey,
}: {
  initialTopPercent?: number;
  minTopPercent?:     number;
  maxTopPercent?:     number;
  storageKey?:        string;
} = {}) {

  const getSaved = () => {
    if (!storageKey) return initialTopPercent;
    try {
      const v = localStorage.getItem(storageKey);
      return v ? parseFloat(v) : initialTopPercent;
    } catch { return initialTopPercent; }
  };

  const [topPercent, setTopPercent] = useState(getSaved);
  const dragging    = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor     = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect    = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.min(maxTopPercent, Math.max(minTopPercent, percent));
      setTopPercent(clamped);
      if (storageKey) {
        try { localStorage.setItem(storageKey, String(clamped)); } catch {}
      }
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [minTopPercent, maxTopPercent, storageKey]);

  return { topPercent, containerRef, startDrag };
}
