"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Lock, LogOut } from "lucide-react";
import { FullscreenGate } from "@/components/arena/FullscreenGate";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";
import { pingAuditSession, type AuditDomain } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";

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
  /** When set (with contextId), pings the audit session endpoint on entry so
   *  the platform records this participant's IP for multi-IP detection. */
  auditDomain?:  AuditDomain;
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

  /** Optional subtitle under the title (e.g. "Live Exam", "Take-home TP"). */
  subtitle?:         string;
  /** Extra content rendered on the left, right after the title block (e.g. progress). */
  leftExtras?:       React.ReactNode;

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
  subtitle,
  leftExtras,
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

  // Audit session heartbeat — one fire-and-forget IP capture on entry.
  const acDomain = lockdown?.auditDomain;
  useEffect(() => {
    if (!acEnabled || !acDomain || acContext === "__disabled__") return;
    pingAuditSession(acDomain, acContext).catch(() => { /* never disrupt the arena */ });
  }, [acEnabled, acDomain, acContext]);

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
        subtitle={subtitle}
        leftExtras={leftExtras}
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

function TopBar({ title, subtitle, leftExtras, backHref, backLabel, remainingSeconds, isEnded, extras }: {
  title:            string;
  subtitle?:        string;
  leftExtras?:      React.ReactNode;
  backHref:         string;
  backLabel:        string;
  remainingSeconds: number;
  isEnded:          boolean;
  extras?:          React.ReactNode;
}) {
  const showTimer = remainingSeconds > 0 || isEnded;
  const isUrgent  = !isEnded && remainingSeconds > 0 && remainingSeconds < 300;
  const timerStr  = formatTime(remainingSeconds);

  return (
    <div style={{
      background: "var(--bg)", height: 54, display: "flex", alignItems: "stretch",
      flexShrink: 0, borderBottom: "1px solid var(--line-2)",
      boxShadow: "0 1px 0 0 rgba(0,255,0,.07)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 9,
        color: "var(--ink)", fontWeight: 700, fontSize: 15,
        padding: "0 18px", borderRight: "1px solid var(--line-2)", flex: "none",
      }}>
        <img src="/algora-logo-icon.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />
        {APP_NAME}
      </div>

      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "0 16px", borderRight: "1px solid var(--line-2)", flex: "none", maxWidth: 300,
      }}>
        <span style={{
          font: "600 13.5px var(--font)", color: "var(--ink)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ font: "500 11px var(--font)", color: "var(--ink-3)", marginTop: 2 }}>
            {subtitle}
          </span>
        )}
      </div>

      {leftExtras}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {extras}
        {showTimer && (
          <span style={{
            display: "flex", alignItems: "center", padding: "0 18px",
            borderLeft: "1px solid var(--line-2)",
            font: "600 22px var(--font-mono)", letterSpacing: 2,
            color: isEnded ? "var(--ink-3)" : isUrgent ? "var(--danger)" : "var(--accent)",
            textShadow: isEnded ? "none" : isUrgent ? "0 0 18px rgba(240,99,122,.55)" : "0 0 18px rgba(0,255,0,.55)",
            animation: isUrgent ? "arenaBlink 1s ease infinite" : "none",
          }}>
            {isEnded ? "00:00:00" : timerStr}
          </span>
        )}
        <Link href={backHref} style={{
          borderLeft: "1px solid var(--line-2)",
          padding: "0 20px", height: "100%", fontSize: 13, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
          textDecoration: "none", color: "var(--danger-ink)",
        }}>
          <LogOut size={15} /> {backLabel}
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
      background: "var(--bg)", borderBottom: "1px solid var(--line-2)",
      display: "flex", alignItems: "center",
      padding: "0 16px", gap: 0, flexShrink: 0, height: 38,
    }}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            style={{
              background: "transparent",
              color: active ? "var(--accent)" : "var(--ink-3)",
              border: "none",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              padding: "0 14px", height: 38,
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span style={{
                background: "var(--accent)", color: "#0a0a0a",
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
