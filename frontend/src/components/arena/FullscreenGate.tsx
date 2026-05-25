"use client";

import { useEffect, useRef, useState } from "react";
import { useFullscreen } from "@/hooks/useFullscreen";

interface FullscreenGateProps {
  children: React.ReactNode;
  enabled:  boolean;
}

export function FullscreenGate({ children, enabled }: FullscreenGateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, enterFullscreen } = useFullscreen(containerRef);

  // Auto-request fullscreen on mount (small delay so browser permits it)
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => { enterFullscreen(); }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Re-show gate when tab regains visibility while not in fullscreen
  useEffect(() => {
    if (!enabled) return;
    function onVisible() {
      // The fullscreenchange event already handles this — just here as a safety net
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);

  const showGate = enabled && !isFullscreen;

  return (
    <div ref={containerRef} className="h-screen w-screen">
      {children}

      {showGate && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ background: "rgba(13, 17, 23, 0.97)" }}
        >
          <div className="text-center max-w-md px-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-black text-2xl">P</span>
            </div>

            <h2 className="text-white text-xl font-bold mb-3">
              Return to fullscreen to continue
            </h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              This competition requires fullscreen mode.
              Exiting fullscreen is logged as a violation.
            </p>

            <button
              onClick={enterFullscreen}
              className="w-full h-12 bg-blue-600 text-white font-bold text-base rounded hover:bg-blue-700 active:scale-95 transition-all duration-150"
            >
              Return to Fullscreen →
            </button>

            <p className="text-gray-600 text-xs mt-4">
              You cannot submit code while outside fullscreen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
