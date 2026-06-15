"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, Loader2, Lock } from "lucide-react";
import { FullscreenGate } from "@/components/arena/FullscreenGate";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArenaTab {
  key:     string;
  label:   string;
  icon?:   React.ReactNode;
  badge?:  number;
  content: React.ReactNode;
}

/**
 * Anti-cheat / fullscreen policy.
 * - fullscreen: require fullscreen mode (shows FullscreenGate when not in fs).
 * - antiCheat:  install keyboard/clipboard/visibility listeners.
 * - contextId:  domain object id passed to useAntiCheat (exam/tp/cp competition id).
 * - onViolation: optional extra callback for violations (e.g., increment a counter).
 */
export interface LockdownPolicy {
  fullscreen?:   boolean;
  antiCheat?:    boolean;
  contextId?:    string;
  onViolation?:  (e: ViolationEvent) => void;
}

export interface ArenaShellProps {
  title:             string;
  /** Tabs rendered inside the shell. The first tab is shown by default. */
  tabs:              ArenaTab[];
  /** Optional override for which tab is initially active. */
  initialTabKey?:    string;
  /** Optional controlled active tab (parent owns selection). */
  activeTabKey?:     string;
  /** Called when the user clicks a tab; only fires if `activeTabKey` is provided. */
  onTabChange?:      (key: string) => void;

  /** Where the "Leave" link points to (default: /). */
  backHref?:         string;
  backLabel?:        string;

  /** Remaining seconds. 0 hides the timer. Negative is clamped to 0. */
  remainingSeconds?: number;
  isEnded?:          boolean;
  endedMessage?:     string;

  /** Lockdown / anti-cheat policy. */
  lockdown?:         LockdownPolicy;

  /** Loading / access-error states (replaces shell content when set). */
  loading?:          boolean;
  loadingMessage?:   string;
  accessError?:      string | null;

  /** Mode-specific extras rendered in the right side of the top bar. */
  topBarExtras?:     React.ReactNode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatTime(secs: number): string {
  const s = Math.max(0, secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(r)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArenaShell({
  title,
  tabs,
  initialTabKey,
  activeTabKey,
  onTabChange,
  backHref         = "/",
  backLabel        = "Leave",
  remainingSeconds = 0,
  isEnded          = false,
  endedMessage     = "This session has ended. Submissions are no longer accepted.",
  lockdown,
  loading          = false,
  loadingMessage   = "Loading…",
  accessError      = null,
  topBarExtras,
}: ArenaShellProps) {
  // ── Tab selection ───────────────────────────────────────────────────────────
  const fallbackInitial = initialTabKey ?? tabs[0]?.key ?? "";
  const [internalTab, setInternalTab] = useState(fallbackInitial);
  const isControlled = typeof activeTabKey === "string";
  const currentTab = isControlled ? activeTabKey! : internalTab;

  // Keep internal selection valid if tabs change
  useEffect(() => {
    if (!isControlled && !tabs.some((t) => t.key === internalTab) && tabs[0]) {
      setInternalTab(tabs[0].key);
    }
  }, [tabs, internalTab, isControlled]);

  function selectTab(key: string) {
    if (isControlled) {
      onTabChange?.(key);
    } else {
      setInternalTab(key);
      onTabChange?.(key);
    }
  }

  // ── Anti-cheat (optional) ───────────────────────────────────────────────────
  const violationsRef = useRef(0);
  const acEnabled  = !!lockdown?.antiCheat;
  const acContext  = lockdown?.contextId ?? "__disabled__";
  useAntiCheat({
    competitionId: acContext,
    enabled:       acEnabled,
    onViolation: (ev) => {
      violationsRef.current += 1;
      lockdown?.onViolation?.(ev);
    },
  });

  const active = tabs.find((t) => t.key === currentTab) ?? tabs[0];

  // ── Loading shell ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-2)", flexDirection: "column", gap: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--brand)" }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>{loadingMessage}</div>
      </div>
    );
  }

  // ── Access denied ───────────────────────────────────────────────────────────
  if (accessError) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-2)", flexDirection: "column", gap: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <Lock size={32} color="var(--ink-3)" />
        <div style={{ fontWeight: 700, fontSize: 16, color: "white" }}>Access Denied</div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.55)",
          maxWidth: 360, textAlign: "center",
        }}>
          {accessError}
        </div>
        <Link href={backHref} style={{
          marginTop: 8, background: "var(--brand)", color: "white", borderRadius: 3,
          padding: "8px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}>
          Back
        </Link>
      </div>
    );
  }

  // ── Main shell ──────────────────────────────────────────────────────────────
  const shell = (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "var(--text-primary)", height: "100vh",
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      <TopBar
        title={title}
        backHref={backHref}
        backLabel={backLabel}
        remainingSeconds={remainingSeconds}
        isEnded={isEnded}
        extras={topBarExtras}
      />

      {tabs.length > 1 && (
        <NavTabs
          tabs={tabs}
          activeKey={active?.key ?? ""}
          onSelect={selectTab}
        />
      )}

      {isEnded && (
        <div style={{
          background: "var(--red-light)", borderBottom: "1px solid var(--danger)",
          padding: "7px 16px", fontSize: 13, color: "var(--danger-ink)",
          fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <AlertTriangle size={14} /> {endedMessage}
        </div>
      )}

      <main style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {active?.content}
      </main>
    </div>
  );

  // ── Lockdown wrapper ────────────────────────────────────────────────────────
  if (lockdown?.fullscreen !== undefined) {
    return <FullscreenGate enabled={lockdown.fullscreen}>{shell}</FullscreenGate>;
  }
  return shell;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TopBar({ title, backHref, backLabel, remainingSeconds, isEnded, extras }: {
  title:            string;
  backHref:         string;
  backLabel:        string;
  remainingSeconds: number;
  isEnded:          boolean;
  extras?:          React.ReactNode;
}) {
  const showTimer = remainingSeconds > 0 || isEnded;
  const isUrgent  = !isEnded && remainingSeconds > 0 && remainingSeconds < 600;
  const timerStr  = formatTime(remainingSeconds);

  return (
    <div style={{
      background: "var(--bg-2)", height: 44, display: "flex", alignItems: "center",
      padding: "0 16px", gap: 16, flexShrink: 0, borderBottom: "1px solid var(--line)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        color: "white", fontWeight: 700, fontSize: 13,
      }}>
        <div style={{
          width: 22, height: 22, background: "var(--brand)", borderRadius: 3,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 900, fontSize: 11,
        }}>P</div>
        PSP
      </div>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
      <span style={{
        color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500,
        maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {title}
      </span>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        {extras}
        {showTimer && (
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 700,
            color: isEnded ? "var(--ink-3)" : isUrgent ? "var(--danger)" : "var(--warn)",
          }}>
            {isEnded ? "00:00:00" : timerStr}
          </span>
        )}
        <Link href={backHref} style={{
          background: "var(--danger)", color: "white", border: "none", borderRadius: 3,
          padding: "0 12px", height: 28, fontSize: 12, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", textDecoration: "none",
        }}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

function NavTabs({ tabs, activeKey, onSelect }: {
  tabs:     ArenaTab[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <nav style={{
      background: "var(--bg)", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center",
      padding: "0 12px", gap: 4, flexShrink: 0, height: 38,
    }}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            style={{
              background: active ? "var(--surface-2)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-2)",
              border: "none",
              borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
              borderRadius: "4px 4px 0 0",
              padding: "0 12px", height: 36,
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span style={{
                background: "var(--brand)", color: "white",
                borderRadius: 10, padding: "1px 6px",
                fontSize: 10, fontWeight: 700, lineHeight: 1,
              }}>
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
