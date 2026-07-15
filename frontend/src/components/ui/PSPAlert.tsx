"use client";
import { Info, AlertTriangle, CheckCircle2, XCircle, X } from "lucide-react";

export type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant:    AlertVariant;
  title?:     string;
  message:    string;
  onDismiss?: () => void;
  compact?:   boolean;
}

const ALERT_CONFIG: Record<AlertVariant, {
  icon:   React.ReactNode;
  color:  string;
  bg:     string;
  border: string;
  iconBg: string;
}> = {
  info: {
    icon: <Info size={15} />,
    color: "var(--violet)", bg: "var(--violet-soft)",
    border: "rgba(155,140,246,.25)", iconBg: "rgba(155,140,246,.2)",
  },
  success: {
    icon: <CheckCircle2 size={15} />,
    color: "var(--success-ink)", bg: "var(--accent-dim)",
    border: "rgba(0,255,0,.25)", iconBg: "rgba(0,255,0,.15)",
  },
  warning: {
    icon: <AlertTriangle size={15} />,
    color: "var(--warn)", bg: "var(--warn-soft)",
    border: "rgba(232,160,48,.25)", iconBg: "rgba(232,160,48,.15)",
  },
  error: {
    icon: <XCircle size={15} />,
    color: "var(--danger)", bg: "var(--danger-soft)",
    border: "rgba(240,99,122,.25)", iconBg: "rgba(240,99,122,.15)",
  },
};

export function Alert({ variant, title, message, onDismiss, compact }: AlertProps) {
  const cfg = ALERT_CONFIG[variant];

  return (
    <div style={{
      display: "flex",
      alignItems: compact ? "center" : "flex-start",
      gap: 12,
      padding: compact ? "10px 14px" : "14px 16px",
      borderRadius: 12,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      position: "relative",
    }}>
      <div style={{
        width: compact ? 26 : 32,
        height: compact ? 26 : 32,
        borderRadius: compact ? 7 : 8,
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: cfg.iconBg, color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}>
        {cfg.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && !compact && (
          <p style={{ fontSize: 13, fontWeight: 700, color: cfg.color, margin: "0 0 2px" }}>
            {title}
          </p>
        )}
        <p style={{ fontSize: compact ? 12 : 13, color: "var(--ink-2)", lineHeight: 1.5, margin: 0 }}>
          {message}
        </p>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 2,
            color: "var(--ink-3)", flexShrink: 0, display: "flex", alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
