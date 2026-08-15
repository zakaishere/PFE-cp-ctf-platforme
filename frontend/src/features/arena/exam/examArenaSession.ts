"use client";

import { useEffect, useSyncExternalStore } from "react";
import { logCheatEvent } from "@/lib/api";
import { logger } from "@/lib/logger";

/**
 * Session state and the anti-cheat/fullscreen lock live here — outside React
 * — keyed by examId, backed by sessionStorage. The exam's question pages are
 * separate routes (/arena/exam/[examId] vs
 * /arena/exam/[examId]/question/[questionId]); in this Next.js build neither
 * a shared layout.tsx nor a plain in-memory module/window store reliably
 * survives that navigation (verified empirically — something in this build's
 * router resets app-defined `window` properties on route change, even though
 * `window` itself, `document`, and sessionStorage all remain intact).
 * sessionStorage does survive, so it's the source of truth here; DOM
 * listeners are attached at most once (guarded by the "locked" flag) and are
 * never removed on a route change — only `endExamArenaSession` (a real
 * session end, e.g. time's up) flips them off, via an "active" flag the
 * handlers check on every event rather than via removeEventListener, since a
 * closure captured during one mount may not be reachable from a later one.
 */

interface Snapshot {
  entered: boolean;
  tabSwitches: number;
  isFullscreen: boolean;
}

const ssKey = {
  entered: (examId: string) => `exam_arena_entered_${examId}`,
  tabSwitches: (examId: string) => `exam_arena_tabswitches_${examId}`,
  locked: (examId: string) => `exam_arena_locked_${examId}`,
  fsRequested: (examId: string) => `exam_arena_fsreq_${examId}`,
  active: (examId: string) => `exam_arena_active_${examId}`,
};

function readFlag(key: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(key) === "1";
}
function writeFlag(key: string, val: boolean) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, val ? "1" : "0");
}
function readCount(key: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  return Number(sessionStorage.getItem(key) ?? "0") || 0;
}
function writeCount(key: string, val: number) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, String(val));
}

// Subscribers are re-established by whatever component is currently
// mounted — they don't need to survive navigation, so plain module scope
// (or a fresh Map after a reset) is fine here.
const subscribers = new Map<string, Set<() => void>>();
const cachedSnapshots = new Map<string, Snapshot>();

function notify(examId: string) {
  subscribers.get(examId)?.forEach((cb) => cb());
}

function subscribe(examId: string, cb: () => void) {
  let set = subscribers.get(examId);
  if (!set) { set = new Set(); subscribers.set(examId, set); }
  set.add(cb);
  return () => set!.delete(cb);
}

function isFullscreenNow() {
  return typeof document !== "undefined" && !!document.fullscreenElement;
}

function getSnapshot(examId: string): Snapshot {
  const fresh: Snapshot = {
    entered: readFlag(ssKey.entered(examId)),
    tabSwitches: readCount(ssKey.tabSwitches(examId)),
    isFullscreen: isFullscreenNow(),
  };
  const cached = cachedSnapshots.get(examId);
  if (cached && cached.entered === fresh.entered && cached.tabSwitches === fresh.tabSwitches && cached.isFullscreen === fresh.isFullscreen) {
    return cached;
  }
  cachedSnapshots.set(examId, fresh);
  return fresh;
}

export function useExamArenaSnapshot(examId: string): Snapshot {
  return useSyncExternalStore(
    (cb) => subscribe(examId, cb),
    () => getSnapshot(examId),
    () => getSnapshot(examId),
  );
}

export function markExamEntered(examId: string) {
  if (!readFlag(ssKey.entered(examId))) {
    writeFlag(ssKey.entered(examId), true);
    writeFlag(ssKey.active(examId), true);
    notify(examId);
  }
}

/** Unguarded — for the "Return to Fullscreen" button, which runs from a real
 *  user gesture and should always retry. */
export function requestFullscreenNow() {
  const el = document.documentElement;
  const req = el.requestFullscreen?.bind(el) ?? (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(el);
  if (!req) return;
  Promise.resolve(req()).catch((err: unknown) => {
    console.warn("Fullscreen request failed:", err);
  });
}

function requestFullscreenOnce(examId: string) {
  if (readFlag(ssKey.fsRequested(examId))) return;
  writeFlag(ssKey.fsRequested(examId), true);
  requestFullscreenNow();
}

/** Registers the anti-cheat listeners + requests fullscreen exactly once per
 *  exam session (guarded by the "locked" sessionStorage flag), regardless of
 *  how many times the calling component remounts across Prev/Next/Back
 *  navigation. Handlers stay attached but self-disable once the session ends
 *  (see endExamArenaSession) rather than being removed. */
export function useExamArenaLock(examId: string, enabled: boolean, studentId: string | null) {
  useEffect(() => {
    if (!enabled) return;
    if (readFlag(ssKey.locked(examId))) return;
    writeFlag(ssKey.locked(examId), true);

    requestFullscreenOnce(examId);

    function isActive() {
      return readFlag(ssKey.active(examId));
    }

    function logViolation(type: string, details?: string) {
      if (!isActive()) return;
      logger.warn("AntiCheat", `VIOLATION: ${type}`, details);
      if (type === "TAB_SWITCH") {
        writeCount(ssKey.tabSwitches(examId), readCount(ssKey.tabSwitches(examId)) + 1);
        notify(examId);
      }
      if (studentId) {
        logCheatEvent({ studentId, assessmentId: examId, violationType: type }).catch(() => {});
      }
    }

    function onVisibilityChange() {
      if (!isActive()) return;
      if (document.hidden) logViolation("TAB_SWITCH", "Student switched away from tab");
    }
    function onBlur() {
      if (!isActive()) return;
      logViolation("WINDOW_BLUR", "Window lost focus");
    }
    function onCopy(e: ClipboardEvent) {
      if (!isActive()) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".monaco-editor") && !target?.closest?.(".test-block")) {
        e.preventDefault();
        logViolation("COPY_ATTEMPT", "Student attempted to copy content");
      }
    }
    function onPaste(e: ClipboardEvent) {
      if (!isActive()) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".monaco-editor")) {
        e.preventDefault();
        logViolation("PASTE_ATTEMPT", "Student attempted to paste outside editor");
      }
    }
    function onCut(e: ClipboardEvent) {
      if (!isActive()) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".monaco-editor")) {
        e.preventDefault();
        logViolation("CUT_ATTEMPT", "Student attempted to cut content");
      }
    }
    function onContextMenu(e: MouseEvent) {
      if (!isActive()) return;
      e.preventDefault();
      logViolation("CONTEXT_MENU", "Student opened right-click menu");
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!isActive()) return;
      if (e.key === "F12") { e.preventDefault(); logViolation("DEVTOOLS_ATTEMPT", "F12 pressed"); return; }
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) { e.preventDefault(); logViolation("DEVTOOLS_ATTEMPT", "Ctrl+Shift+I pressed"); return; }
      if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) { e.preventDefault(); logViolation("DEVTOOLS_ATTEMPT", "Ctrl+Shift+J pressed"); return; }
      if (e.ctrlKey && e.key === "u") { e.preventDefault(); logViolation("VIEW_SOURCE_ATTEMPT", "Ctrl+U pressed"); return; }
      if (e.key === "PrintScreen") logViolation("SCREENSHOT_ATTEMPT", "PrintScreen key pressed");
      if (e.ctrlKey && e.key === "p") { e.preventDefault(); logViolation("PRINT_ATTEMPT", "Ctrl+P pressed"); }
    }
    function onFullscreenChange() {
      notify(examId);
      if (isActive() && !document.fullscreenElement) logViolation("FULLSCREEN_EXIT", "Student exited fullscreen");
    }
    function onSelectStart(e: Event) {
      if (!isActive()) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest) return;
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
    // No cleanup on unmount by design — a route change unmounting this
    // component is not the same as the exam session ending. See
    // endExamArenaSession for the real teardown path.
  }, [examId, enabled, studentId]);
}

/** Real session end (time's up / grades released / leaving the arena for
 *  good) — the still-attached listeners see `active` flip off and stop
 *  reacting, and fullscreen is exited. */
export function endExamArenaSession(examId: string) {
  writeFlag(ssKey.active(examId), false);
  if (isFullscreenNow()) {
    document.exitFullscreen().catch(() => {});
  }
}
