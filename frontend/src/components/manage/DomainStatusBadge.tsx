"use client";

export type DomainStatus =
  | "UPCOMING" | "ACTIVE" | "PAUSED" | "ENDED" | "FROZEN"
  | "REGISTRATION" | "DRAFT"
  | "OPEN" | "CLOSED"
  | "LIVE";

interface DomainStatusBadgeProps {
  status: string;
  pulse?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; fg: string; bg: string; border: string; dot?: boolean }> = {
  UPCOMING:     { label: "UPCOMING",     fg: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.35)"  },
  ACTIVE:       { label: "ACTIVE",     fg: "#34d399", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)", dot: true },
  LIVE:         { label: "LIVE",       fg: "#34d399", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)", dot: true },
  OPEN:         { label: "OPEN",       fg: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.35)", dot: true },
  PAUSED:       { label: "PAUSED",    fg: "#fbbf24", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)"  },
  FROZEN:       { label: "FROZEN",     fg: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.35)"  },
  ENDED:        { label: "ENDED",        fg: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)"  },
  CLOSED:       { label: "CLOSED",       fg: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)"  },
  REGISTRATION: { label: "REG OPEN",     fg: "#a78bfa", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)" },
  DRAFT:        { label: "DRAFT",        fg: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
};

export default function DomainStatusBadge({ status, pulse, className }: DomainStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status?.toUpperCase()] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: cfg.bg, color: cfg.fg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 4, padding: "2px 8px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.dot && pulse !== false && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: cfg.fg, flexShrink: 0,
          animation: "manage-pulse 2s infinite",
          display: "inline-block",
        }} />
      )}
      {cfg.label.replace("● ", "")}
      <style jsx global>{`
        @keyframes manage-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 ${cfg.fg}66; }
          50%       { opacity: 0.7; box-shadow: 0 0 0 4px transparent; }
        }
      `}</style>
    </span>
  );
}
