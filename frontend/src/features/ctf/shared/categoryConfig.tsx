"use client";

import {
  Lock, Search, RefreshCw, Globe, Terminal, Eye, Puzzle, LayoutGrid,
} from "lucide-react";
import type { ReactNode } from "react";

export interface CategoryDef {
  label:  string;
  icon:   ReactNode;
  accent: string;
}

export const CAT_CONFIG: Record<string, CategoryDef> = {
  CRYPTO:    { label: "Crypto",    icon: <Lock size={14} />,      accent: "#a78bfa" },
  FORENSICS: { label: "Forensics", icon: <Search size={14} />,    accent: "#60a5fa" },
  REVERSE:   { label: "Reverse",   icon: <RefreshCw size={14} />, accent: "#fb923c" },
  WEB:       { label: "Web",       icon: <Globe size={14} />,     accent: "#f87171" },
  PWN:       { label: "Pwn",       icon: <Terminal size={14} />,  accent: "#facc15" },
  OSINT:     { label: "OSINT",     icon: <Eye size={14} />,       accent: "#34d399" },
  MISC:      { label: "Misc",      icon: <Puzzle size={14} />,    accent: "#94a3b8" },
};

export const ALL_CAT: CategoryDef = {
  label:  "All",
  icon:   <LayoutGrid size={14} />,
  accent: "#6366f1",
};

export const DIFF_COLORS: Record<string, string> = {
  EASY:   "#34d399",
  MEDIUM: "#fbbf24",
  HARD:   "#f87171",
};

export function catFor(key: string): CategoryDef {
  return key === "ALL" ? ALL_CAT : (CAT_CONFIG[key] ?? { label: key, icon: <Puzzle size={14} />, accent: "#94a3b8" });
}
