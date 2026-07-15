"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Big landing-page card linking to a section of the platform. */
export function ModeCard({ href, icon, badge, title, blurb, action, points }: {
  href: string;
  icon: React.ReactNode;
  badge: string;
  title: string;
  blurb: string;
  action: string;
  points: string[];
}) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={href}
      style={{ textDecoration: "none", display: "block", flex: 1, minWidth: 300 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        background: "var(--surface)",
        border: `1px solid ${hover ? "var(--accent-ring)" : "var(--line-2)"}`,
        borderRadius: "var(--r)",
        padding: "32px 30px",
        height: "100%",
        boxSizing: "border-box",
        transition: "border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? "0 8px 32px rgba(0,0,0,0.35)" : "var(--card-shadow)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: "var(--accent-dim)", border: "1px solid var(--accent-ring)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent)",
        }}>
          {icon}
        </div>

        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "var(--accent)",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
          }}>
            {badge}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
            {title}
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
            {blurb}
          </p>
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {points.map((p) => (
            <li key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
              {p}
            </li>
          ))}
        </ul>

        <div style={{
          marginTop: "auto", paddingTop: 8,
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 14, fontWeight: 700, color: "var(--accent)",
        }}>
          {action}
          <ArrowRight size={16} style={{
            transition: "transform 150ms ease",
            transform: hover ? "translateX(4px)" : "none",
          }} />
        </div>
      </div>
    </Link>
  );
}
