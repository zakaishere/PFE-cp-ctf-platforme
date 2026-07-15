"use client";

import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { type ReactNode } from "react";

/** Unified dropdown — thin, styled wrapper over Radix (a11y/positioning stay Radix's job). */
export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  children,
  align = "end",
  width = 220,
}: {
  children: ReactNode;
  align?: "start" | "end" | "center";
  width?: number;
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={8}
        style={{
          width,
          background: "var(--surface)",
          border: "1px solid var(--line-2)",
          borderRadius: 14,
          boxShadow: "0 16px 48px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.4)",
          padding: 6,
          zIndex: 200,
        }}
        className="psp-dd-content"
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
      {children}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  icon,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      onClick={onClick}
      disabled={disabled}
      className={`psp-dd-item${danger ? " psp-dd-item-danger" : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "9px 12px", borderRadius: 9,
        fontSize: 13, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        outline: "none",
      }}
    >
      {icon && <span className="psp-dd-icon">{icon}</span>}
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator style={{ height: 1, background: "var(--line)", margin: "4px 8px" }} />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownPrimitive.Label
      style={{
        padding: "6px 12px 4px", fontSize: 10, fontWeight: 700,
        letterSpacing: "1px", textTransform: "uppercase",
        color: "var(--ink-3)", fontFamily: "var(--font-mono), monospace",
      }}
    >
      {children}
    </DropdownPrimitive.Label>
  );
}
