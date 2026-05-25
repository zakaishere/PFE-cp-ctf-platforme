"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Language, getTemplate, monacoLang } from "@/lib/codeTemplates";
import { useVerticalResize } from "@/hooks/useVerticalResize";
import { DragHandle } from "@/components/ui/DragHandle";
import { EditorToolbar } from "./EditorToolbar";
import { ResultsPanel, type ResultsPanelHandle } from "./ResultsPanel";
import type { ProblemDetailDTO } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface EditorPanelProps {
  problem:          ProblemDetailDTO;
  userId:           string;
  code:             string;
  onCodeChange:     (code: string) => void;
  language:         Language;
  onLanguageChange: (lang: Language) => void;
  loadedFromSub:    string | null;
  onClearSub:       () => void;
}

export function EditorPanel({
  problem, userId,
  code, onCodeChange,
  language, onLanguageChange,
  loadedFromSub, onClearSub,
}: EditorPanelProps) {
  const { topPercent, containerRef, startDrag } = useVerticalResize({
    initialTopPercent: 65,
    minTopPercent: 30,
    maxTopPercent: 85,
    storageKey: "problem-split-v",
  });

  const [running,    setRunning]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"run" | "submit">("run");

  const resultsRef = useRef<ResultsPanelHandle>(null);

  const handleLanguageChange = useCallback((l: Language) => {
    onLanguageChange(l);
    onCodeChange(getTemplate(l));
    onClearSub();
    try { localStorage.setItem("preferred-language", l); } catch {}
  }, [onLanguageChange, onCodeChange, onClearSub]);

  const handleReset = useCallback(() => {
    onCodeChange(getTemplate(language));
    onClearSub();
  }, [language, onCodeChange, onClearSub]);

  const handleRun = useCallback(() => {
    setActiveTab("run");
    resultsRef.current?.handleRun();
  }, []);

  const handleSubmit = useCallback(() => {
    setActiveTab("submit");
    resultsRef.current?.handleSubmit();
  }, []);

  // Ctrl+Enter → submit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#1e1e1e",
      }}
    >
      <EditorToolbar
        language={language}
        onLanguageChange={handleLanguageChange}
        onReset={handleReset}
        onRun={handleRun}
        onSubmit={handleSubmit}
        running={running}
        submitting={submitting}
      />

      {/* Past-submission banner */}
      {loadedFromSub && (
        <div style={{
          background: "rgba(76,154,255,0.08)",
          borderBottom: "1px solid rgba(76,154,255,0.15)",
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "#8899b4",
          flexShrink: 0,
        }}>
          <span style={{ color: "#4c9aff" }}>📋</span>
          <span>Viewing past submission</span>
          <button
            onClick={() => { onCodeChange(getTemplate(language)); onClearSub(); }}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "#4c9aff",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Clear &amp; reset template
          </button>
        </div>
      )}

      {/* Monaco editor */}
      <div style={{ flex: `0 0 ${topPercent}%`, overflow: "hidden", minHeight: 0 }}>
        <MonacoEditor
          height="100%"
          language={monacoLang(language)}
          theme="vs-dark"
          value={code}
          onChange={(v) => onCodeChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>

      <DragHandle direction="vertical" onMouseDown={startDrag} />

      <ResultsPanel
        ref={resultsRef}
        problemId={problem.problemId}
        code={code}
        language={language}
        userId={userId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRunStart={() => setRunning(true)}
        onRunEnd={() => setRunning(false)}
        onSubmitStart={() => setSubmitting(true)}
        onSubmitEnd={() => setSubmitting(false)}
      />
    </div>
  );
}
