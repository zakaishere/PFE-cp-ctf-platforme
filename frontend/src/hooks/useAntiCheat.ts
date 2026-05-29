import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

export interface ViolationEvent {
  type:      string;
  timestamp: string;
  details?:  string;
}

interface UseAntiCheatOptions {
  /** Domain context id (CP competitionId, Exam/TP assessmentId). Used as effect key. */
  competitionId: string;
  /** Called for every detected violation. Wire backend reporting here. */
  onViolation:   (event: ViolationEvent) => void;
  /** When false, no listeners are attached. Defaults to true. */
  enabled?:      boolean;
}

export function useAntiCheat({ competitionId, onViolation, enabled = true }: UseAntiCheatOptions) {
  const violations = useRef<ViolationEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;

    function logViolation(type: string, details?: string) {
      const event: ViolationEvent = {
        type,
        timestamp: new Date().toISOString(),
        details,
      };
      violations.current.push(event);
      logger.warn("AntiCheat", `VIOLATION: ${type}`, event);
      onViolation(event);
    }

    function onVisibilityChange() {
      if (document.hidden) logViolation("TAB_SWITCH", "Student switched away from tab");
    }

    function onBlur() {
      logViolation("WINDOW_BLUR", "Window lost focus");
    }

    function onCopy(e: ClipboardEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".monaco-editor") && !target.closest(".test-block")) {
        e.preventDefault();
        logViolation("COPY_ATTEMPT", "Student attempted to copy content");
      }
    }

    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".monaco-editor")) {
        e.preventDefault();
        logViolation("PASTE_ATTEMPT", "Student attempted to paste outside editor");
      }
    }

    function onCut(e: ClipboardEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".monaco-editor")) {
        e.preventDefault();
        logViolation("CUT_ATTEMPT", "Student attempted to cut content");
      }
    }

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      logViolation("CONTEXT_MENU", "Student opened right-click menu");
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F12") {
        e.preventDefault();
        logViolation("DEVTOOLS_ATTEMPT", "F12 pressed");
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
        e.preventDefault();
        logViolation("DEVTOOLS_ATTEMPT", "Ctrl+Shift+I pressed");
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault();
        logViolation("DEVTOOLS_ATTEMPT", "Ctrl+Shift+J pressed");
        return;
      }
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        logViolation("VIEW_SOURCE_ATTEMPT", "Ctrl+U pressed");
        return;
      }
      if (e.key === "PrintScreen") {
        logViolation("SCREENSHOT_ATTEMPT", "PrintScreen key pressed");
      }
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        logViolation("PRINT_ATTEMPT", "Ctrl+P pressed");
      }
    }

    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        logViolation("FULLSCREEN_EXIT", "Student exited fullscreen");
      }
    }

    function onSelectStart(e: Event) {
      const target = e.target as HTMLElement;
      if (!target.closest(".monaco-editor") && !target.closest(".test-block") && !target.closest(".problem-title")) {
        e.preventDefault();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("cut", onCut, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("selectstart", onSelectStart, true);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("selectstart", onSelectStart, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, enabled]);

  return { violations: violations.current };
}
