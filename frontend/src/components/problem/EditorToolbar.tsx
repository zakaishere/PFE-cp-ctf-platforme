"use client";

import { useState, useRef, useEffect } from "react";
import { LANGUAGES, Language } from "@/lib/codeTemplates";

interface EditorToolbarProps {
  language:         Language;
  onLanguageChange: (l: Language) => void;
  onReset:          () => void;
  onRun:            () => void;
  onSubmit:         () => void;
  running:          boolean;
  submitting:       boolean;
}

export function EditorToolbar({
  language, onLanguageChange, onReset, onRun, onSubmit, running, submitting,
}: EditorToolbarProps) {
  const busy = running || submitting;

  return (
    <div style={{
      height: 44,
      background: "#252526",
      borderBottom: "1px solid #333",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 8,
      flexShrink: 0,
    }}>
      <LanguageDropdown value={language} onChange={onLanguageChange} />

      {/* Reset button */}
      <button
        onClick={onReset}
        title="Reset to template"
        style={{
          width: 30, height: 30,
          background: "transparent",
          border: "1px solid #444",
          borderRadius: 5,
          color: "#888",
          cursor: "pointer",
          fontSize: 15,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.12s",
          lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#3c3c3c"; e.currentTarget.style.color = "#ccc"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888"; }}
      >
        ↺
      </button>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 11, color: "#555" }}>Ctrl+Enter to submit</span>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={busy}
        style={{
          height: 32, padding: "0 14px",
          background: "#2d2d2d",
          border: "1px solid #555",
          borderRadius: 5,
          color: busy ? "#666" : "#cccccc",
          fontSize: 12, fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
          transition: "all 0.12s",
          fontFamily: "inherit",
          opacity: busy ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.background = "#3c3c3c"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#2d2d2d"; }}
      >
        {running ? <><MiniSpinner /> Running...</> : <>▷ Run</>}
      </button>

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={busy}
        style={{
          height: 32, padding: "0 16px",
          background: submitting ? "#004099" : "#0052cc",
          border: "none",
          borderRadius: 5,
          color: "white",
          fontSize: 12, fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
          transition: "all 0.12s",
          fontFamily: "inherit",
          boxShadow: "0 1px 3px rgba(0,82,204,0.4)",
          opacity: busy ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.background = "#0065ff"; }}
        onMouseLeave={e => { e.currentTarget.style.background = submitting ? "#004099" : "#0052cc"; }}
      >
        {submitting ? <><MiniSpinner color="white" /> Judging...</> : <>⚡ Submit</>}
      </button>
    </div>
  );
}

function LanguageDropdown({
  value, onChange,
}: { value: Language; onChange: (l: Language) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = LANGUAGES.find(l => l.value === value);

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          height: 32,
          padding: "0 28px 0 12px",
          background: "#2d2d2d",
          border: `1px solid ${open ? "#4c9aff" : "#444"}`,
          borderRadius: 6,
          color: "#e0e0e0",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          position: "relative",
          transition: "border-color 0.12s",
          whiteSpace: "nowrap",
          minWidth: 110,
        }}
      >
        {current?.label}
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{
            position: "absolute", right: 10,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        >
          <path d="M1 1l4 4 4-4" stroke="#888" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          background: "#252526",
          border: "1px solid #444",
          borderRadius: 6,
          overflow: "hidden",
          zIndex: 100,
          minWidth: "100%",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          animation: "dropdown-in 0.12s ease-out",
        }}>
          {LANGUAGES.map(lang => (
            <div
              key={lang.value}
              onClick={() => { onChange(lang.value); setOpen(false); }}
              style={{
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: lang.value === value ? 700 : 400,
                color: lang.value === value ? "#4c9aff" : "#ccc",
                cursor: "pointer",
                background: lang.value === value ? "rgba(76,154,255,0.1)" : "transparent",
                transition: "background 0.1s",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onMouseEnter={e => {
                if (lang.value !== value)
                  (e.currentTarget as HTMLElement).style.background = "#2d2d2d";
              }}
              onMouseLeave={e => {
                if (lang.value !== value)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {lang.label}
              {lang.value === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#4c9aff" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniSpinner({ color = "#888" }: { color?: string }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeDasharray="30 70" />
    </svg>
  );
}
