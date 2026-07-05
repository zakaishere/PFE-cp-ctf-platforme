"use client";

import React from "react";

/**
 * Algora button. Token-based, green primary.
 * - primary: accent bg, near-black text, weight 700, hover accent-2 + glow
 * - default: surface-2 bg, line-2 border, ink text
 * - ghost:   transparent, line-2 border
 * - danger:  danger-soft bg, danger text
 */
export type ButtonVariant = "primary" | "default" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 10,
  fontFamily: "var(--font-ui)",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "background 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
};

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 30, padding: "0 12px", fontSize: 13 },
  md: { height: 38, padding: "0 16px", fontSize: 13.5 },
};

export function Button({
  variant = "default",
  size = "md",
  style,
  onMouseEnter,
  onMouseLeave,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = React.useState(false);

  const variantStyle = ((): React.CSSProperties => {
    switch (variant) {
      case "primary":
        return {
          background: hover && !disabled ? "var(--accent-2)" : "var(--accent)",
          color: "#0a0a0a",
          border: "1px solid var(--accent)",
          fontWeight: 700,
          boxShadow: hover && !disabled ? "0 0 14px rgba(0,255,0,.3)" : "none",
        };
      case "ghost":
        return {
          background: hover && !disabled ? "var(--surface-2)" : "transparent",
          color: "var(--ink)",
          border: "1px solid var(--line-2)",
        };
      case "danger":
        return {
          background: hover && !disabled ? "rgba(240,99,122,.18)" : "var(--danger-soft)",
          color: "var(--danger)",
          border: "1px solid rgba(240,99,122,.2)",
        };
      default:
        return {
          background: hover && !disabled ? "var(--surface-3)" : "var(--surface-2)",
          color: "var(--ink)",
          border: "1px solid var(--line-2)",
        };
    }
  })();

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
      style={{
        ...BASE,
        ...SIZES[size],
        ...variantStyle,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default Button;
