"use client";

import { useState, useEffect, useCallback } from "react";
import { getProblemDetail, getSubmissionCode, type ProblemDetailDTO, type MySubmissionDTO } from "@/lib/api";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useResizablePanels } from "@/hooks/useResizablePanels";
import { DragHandle } from "@/components/ui/DragHandle";
import { ProblemTopBar } from "@/components/problem/ProblemTopBar";
import { ProblemStatement, ProblemStatementSkeleton } from "@/components/problem/ProblemStatement";
import { EditorPanel } from "@/components/problem/EditorPanel";
import { type Language, getSavedLanguage, getTemplate } from "@/lib/codeTemplates";

export default function PracticeArena({ problemId }: { problemId: string }) {
  const { userId, firstName, email } = useAuth();

  const { leftPercent, containerRef, startDrag } = useResizablePanels({
    initialLeftPercent: 45,
    minLeftPercent: 25,
    maxLeftPercent: 75,
    storageKey: "problem-split-h",
  });

  const [problem,        setProblem]        = useState<ProblemDetailDTO | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(true);
  const [fetchError,     setFetchError]     = useState(false);

  // Editor state lifted here so SubmissionsTab can push code into the editor
  const [editorCode,    setEditorCode]    = useState<string>(() => getTemplate(getSavedLanguage()));
  const [editorLang,    setEditorLang]    = useState<Language>(getSavedLanguage);
  const [loadedFromSub, setLoadedFromSub] = useState<string | null>(null);

  const handleLoadSubmission = useCallback(async (sub: MySubmissionDTO) => {
    setLoadedFromSub(sub.id);
    try {
      const { code, language } = await getSubmissionCode(sub.id);
      setEditorCode(code);
      setEditorLang(language.toLowerCase() as Language);
    } catch {
      setLoadedFromSub(null);
    }
  }, []);

  const handleClearSub = useCallback(() => {
    setLoadedFromSub(null);
  }, []);

  useEffect(() => {
    setLoadingProblem(true);
    setFetchError(false);
    setProblem(null);
    getProblemDetail(problemId)
      .then(setProblem)
      .catch(() => setFetchError(true))
      .finally(() => setLoadingProblem(false));
  }, [problemId]);

  const initials = firstName
    ? firstName.charAt(0).toUpperCase()
    : email
    ? email.charAt(0).toUpperCase()
    : "U";

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "var(--text-primary)",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-secondary)",
      }}
    >
      <ProblemTopBar problem={problem} loading={loadingProblem} initials={initials} />

      <div
        ref={containerRef}
        style={{ display: "flex", flex: 1, overflow: "hidden" }}
      >
        {/* LEFT: Problem Statement */}
        <div
          style={{
            width: `${leftPercent}%`,
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {loadingProblem && <ProblemStatementSkeleton />}

          {!loadingProblem && fetchError && (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
                background: "var(--bg-primary)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>🧩</div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 16, marginBottom: 6 }}>
                Problem not found
              </div>
              <a href="/problems" style={{ color: "var(--brand)", fontSize: 13 }}>
                ← Back to problems
              </a>
            </div>
          )}

          {!loadingProblem && !fetchError && problem && (
            <ProblemStatement
              problem={problem}
              onLoadSubmission={handleLoadSubmission}
              loadedFromSubId={loadedFromSub}
            />
          )}
        </div>

        <DragHandle direction="horizontal" onMouseDown={startDrag} />

        {/* RIGHT: Editor + Results */}
        {problem && userId ? (
          <EditorPanel
            problem={problem}
            userId={userId}
            code={editorCode}
            onCodeChange={setEditorCode}
            language={editorLang}
            onLanguageChange={setEditorLang}
            loadedFromSub={loadedFromSub}
            onClearSub={handleClearSub}
          />
        ) : (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              background: "#1e1e1e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {loadingProblem && (
              <div style={{ color: "#555", fontSize: 13 }}>Loading…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
