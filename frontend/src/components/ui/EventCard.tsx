"use client";

import React from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Pill, type PillVariant } from "@/components/ui/algora";

/**
 * Algora shared event card. One card component for every event surface —
 * competitions, exams, TPs and CTF. Matches `.ev-card` in 09-cards-fix.html:
 * a 260px flex-column with a dot-grid title zone and a meta/action footer.
 *
 * Token-based (CSS variables only) with a green hover glow.
 */

export type EventType = "cp" | "exam" | "tp" | "ctf";
export type EventStatus =
  | "live" | "open" | "reg" | "ended" | "closed" | "scheduled";

export interface EventCardProps {
  type: EventType;
  title: string;
  status: EventStatus;
  /** Primary meta line, e.g. "Advanced Algorithms · 3 problems". */
  meta1: string;
  /** Secondary meta line, e.g. "Due Sat 18:00 · 5 attempts". */
  meta2?: string;
  /** Action label, e.g. "Enter arena" or "View results". */
  action: string;
  actionDisabled?: boolean;
  /** Optional icons rendered before each meta line. */
  meta1Icon?: LucideIcon;
  meta2Icon?: LucideIcon;
  onClick?: () => void;
}

/** Type accent colour used for the top stripe + type label. */
const TYPE_ACCENT: Record<EventType, string> = {
  cp: "var(--accent)",
  exam: "var(--warn)",
  tp: "var(--violet)",
  ctf: "var(--danger)",
};

/** Uppercase kicker shown above the title. */
const TYPE_LABEL: Record<EventType, string> = {
  cp: "Competition",
  exam: "Live Exam",
  tp: "TP",
  ctf: "CTF",
};

/** Status → Pill variant. */
const STATUS_PILL: Record<EventStatus, PillVariant> = {
  live: "live",
  open: "open",
  reg: "reg",
  scheduled: "reg",
  ended: "closed",
  closed: "closed",
};

const STATUS_LABEL: Record<EventStatus, string> = {
  live: "Live",
  open: "Open",
  reg: "Registration",
  scheduled: "Scheduled",
  ended: "Ended",
  closed: "Closed",
};

export function EventCard({
  type,
  title,
  status,
  meta1,
  meta2,
  action,
  actionDisabled,
  meta1Icon: Meta1Icon,
  meta2Icon: Meta2Icon,
  onClick,
}: EventCardProps) {
  const [hover, setHover] = React.useState(false);
  const dimmed = status === "ended" || status === "closed";
  const accent = TYPE_ACCENT[type];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 260,
        background: "var(--surface)",
        border: "1px solid",
        borderColor: hover ? "var(--accent)" : "var(--line-2)",
        borderRadius: "var(--r)",
        boxShadow: hover ? "var(--card-hover)" : "var(--card-shadow)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        transition: "border-color 140ms ease, box-shadow 140ms ease",
      }}
    >
      {/* Top zone — dot-grid + title */}
      <div
        style={{
          flex: 1,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,.4) 100%), var(--surface-2)",
        }}
      >
        {/* faint dot grid */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(0,200,150,.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            opacity: dimmed ? 0.4 : 1,
            pointerEvents: "none",
          }}
        />
        {/* 2px type-accent stripe */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: accent,
          }}
        />
        {/* status pill */}
        <div style={{ position: "absolute", top: 14, right: 14, zIndex: 2 }}>
          <Pill variant={STATUS_PILL[status]}>{STATUS_LABEL[status]}</Pill>
        </div>

        {/* decorative watermark letters */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: -10,
            right: 12,
            fontSize: 80,
            fontWeight: 800,
            opacity: 0.04,
            color: "#ffffff",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {type === "cp" ? "CP" : type === "exam" ? "EX" : type === "tp" ? "TP" : "CTF"}
        </span>
        <div
          style={{
            font: "650 10px var(--font-sans)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: accent,
            position: "relative",
            zIndex: 1,
          }}
        >
          {TYPE_LABEL[type]}
        </div>
        <div
          style={{
            font: "800 22px var(--font-sans)",
            letterSpacing: "-.02em",
            color: dimmed ? "var(--ink-2)" : "var(--ink)",
            lineHeight: 1.2,
            position: "relative",
            zIndex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
      </div>

      {/* Bottom zone — meta + action */}
      <div
        style={{
          flex: "none",
          padding: "14px 20px",
          borderTop: "1px solid var(--line-2)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-2)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {Meta1Icon && (
              <Meta1Icon size={13} style={{ color: "var(--ink-3)", flex: "none" }} />
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{meta1}</span>
          </div>
          {meta2 && (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-3)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {Meta2Icon && <Meta2Icon size={12} style={{ flex: "none" }} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{meta2}</span>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: dimmed || actionDisabled
              ? "var(--ink-3)"
              : hover
                ? "var(--accent-2)"
                : "var(--accent)",
            font: "600 13px var(--font-sans)",
            whiteSpace: "nowrap",
            flex: "none",
          }}
        >
          {action}
          <ArrowRight size={15} />
        </div>
      </div>
    </div>
  );
}

export default EventCard;
