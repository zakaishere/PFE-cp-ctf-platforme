"use client";

import React from "react";

/**
 * Algora elevated card with green hover glow.
 * Surface bg, line-2 border, --r radius, --card-shadow. On hover (unless
 * `noHover`) it lifts to --card-hover. Uses CSS variable tokens only.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noHover?: boolean;
}

export function Card({ noHover, style, onMouseEnter, onMouseLeave, children, ...rest }: CardProps) {
  const [hover, setHover] = React.useState(false);
  const glow = !noHover && hover;
  return (
    <div
      {...rest}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r)",
        boxShadow: glow ? "var(--card-hover)" : "var(--card-shadow)",
        borderColor: glow ? "var(--accent-ring)" : "var(--line-2)",
        transition: "border-color 140ms ease, box-shadow 140ms ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;
