import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizablePanelsOptions {
  initialLeftPercent?: number;   // default 45
  minLeftPercent?:     number;   // default 25
  maxLeftPercent?:     number;   // default 75
  storageKey?:         string;   // persist in localStorage
}

export function useResizablePanels({
  initialLeftPercent = 45,
  minLeftPercent     = 25,
  maxLeftPercent     = 75,
  storageKey,
}: UseResizablePanelsOptions = {}) {

  const getSaved = () => {
    if (!storageKey) return initialLeftPercent;
    try {
      const v = localStorage.getItem(storageKey);
      return v ? parseFloat(v) : initialLeftPercent;
    } catch { return initialLeftPercent; }
  };

  const [leftPercent, setLeftPercent] = useState(getSaved);
  const dragging    = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect    = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(maxLeftPercent, Math.max(minLeftPercent, percent));
      setLeftPercent(clamped);
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
  }, [minLeftPercent, maxLeftPercent, storageKey]);

  return { leftPercent, containerRef, startDrag };
}
