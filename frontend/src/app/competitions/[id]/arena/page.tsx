"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  getCompetitionArena,
  submitToCompetition,
  runCode,
  getCompetitionScoreboard,
  getCompetitionTeamActivity,
  getApiBaseUrl,
  reportCompetitionViolation,
  type ArenaDTO,
  type ArenaProblem,
} from "@/lib/api";
import { toast } from "@/components/ui/PSPToast";
import { useCountdown } from "@/hooks/useCountdown";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import ArenaShell, { type ArenaTab } from "@/features/arena/components/ArenaShell";
import { Code, Play, ShieldAlert, Trophy } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_OPTIONS = [
  { value: "java",       label: "Java"       },
  { value: "python",     label: "Python"     },
  { value: "cpp",        label: "C++"        },
  { value: "c",          label: "C"          },
  { value: "javascript", label: "JavaScript" },
];

const LANG_MONACO: Record<string, string> = {
  java: "java", python: "python", cpp: "cpp", c: "c", javascript: "javascript",
};

const DEFAULT_CODE: Record<string, string> = {
  java:       `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // TODO: solve here\n    }\n}`,
  python:     `import sys\ninput = sys.stdin.readline\n\ndef solve():\n    pass\n\nsolve()`,
  cpp:        `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // TODO: solve here\n    return 0;\n}`,
  c:          `#include <stdio.h>\n\nint main() {\n    // TODO: solve here\n    return 0;\n}`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\n// TODO: solve here`,
};

const DIFF_STYLE: Record<string, { bg: string; text: string }> = {
  EASY:   { bg: "#e3fcef", text: "#006644" },
  MEDIUM: { bg: "#fffae6", text: "#974f0c" },
  HARD:   { bg: "#ffebe6", text: "#bf2600" },
};

const SOLVE_DOT: Record<string, string> = {
  SOLVED:    "#00875a",
  ATTEMPTED: "#ff8b00",
  UNSOLVED:  "#5e6c84",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunResult {
  idx: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  status: string;
  timeMs: number;
}

interface JudgeResult {
  submissionId: string;
  verdict: string;
  score: number;
  executionTimeMs: number;
  message?: string;
}

interface ScoreboardEntry {
  rank: number;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  teamId?: string;
  teamName?: string;
  totalScore: number;
  solvedCount: number;
  lastSolveTime?: string;
  problems: { label: string; verdict: string | null; score: number; attempts: number }[];
}

interface ActivityEntry {
  studentName: string;
  problemLabel: string;
  verdict: string;
  score: number;
  submittedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verdictColor(v: string): string {
  if (v === "AC")  return "#00875a";
  if (v === "WA")  return "#bf2600";
  if (v === "TLE" || v === "MLE") return "#974f0c";
  return "#5e6c84";
}

function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    AC: "Accepted", WA: "Wrong Answer", TLE: "Time Limit Exceeded",
    MLE: "Memory Limit Exceeded", CE: "Compile Error", RTE: "Runtime Error",
    PENDING: "Judging…",
  };
  return map[v] ?? v;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── End-of-Competition Overlay ───────────────────────────────────────────────

function EndOfCompetitionOverlay({
  title, scoreboard, myUserId, mode, onViewResults,
}: {
  title: string;
  scoreboard: ScoreboardEntry[];
  myUserId: string | null;
  mode: "SOLO" | "TEAM";
  onViewResults: () => void;
}) {
  useEffect(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const myEntry = scoreboard.find(e =>
    mode === "SOLO" ? e.studentId === myUserId : false
  );
  const myRank = myEntry?.rank ?? 0;
  const top3   = scoreboard.filter(e => e.rank <= 3);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ background: "rgba(13,17,23,0.96)" }}
    >
      <div className="text-center max-w-lg px-8 py-10">
        <div className="text-7xl mb-4">
          {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🏁"}
        </div>

        <h1 className="text-white text-3xl font-black mb-2">Competition Ended!</h1>
        <p className="text-gray-400 text-lg mb-6">{title}</p>

        {myEntry && (
          <div className="mb-6">
            <p className="text-gray-300 text-lg mb-1">
              You finished <span className="text-white font-bold">#{myRank}</span>
            </p>
            <p className="text-gray-400 text-base">
              {myEntry.solvedCount} problem{myEntry.solvedCount !== 1 ? "s" : ""} solved
              · {myEntry.totalScore} points
            </p>
          </div>
        )}

        {top3.length >= 2 && (
          <div className="flex justify-center gap-4 mb-8">
            {top3.map(entry => (
              <div
                key={entry.teamId ?? entry.studentId}
                className={`px-4 py-3 rounded border ${
                  entry.rank === 1 ? "border-yellow-500/40 bg-yellow-500/10" :
                  entry.rank === 2 ? "border-gray-400/40 bg-gray-400/10" :
                                     "border-amber-700/40 bg-amber-700/10"
                }`}
              >
                <div className="text-2xl mb-1">
                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                </div>
                <div className="text-white text-sm font-bold truncate max-w-[100px]">
                  {mode === "TEAM" ? entry.teamName : `${entry.firstName} ${entry.lastName}`}
                </div>
                <div className="text-gray-400 text-xs">{entry.totalScore} pts</div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onViewResults}
          className="px-6 h-11 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors text-sm"
        >
          View Full Results →
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Phase = "briefing" | "active";

export default function ArenaPage() {
  const params  = useParams();
  const router  = useRouter();
  const { userId, firstName } = useAuth();
  const competitionId = params.id as string;

  // ── Arena data ──────────────────────────────────────────────────────────────
  const [arena, setArena]             = useState<ArenaDTO | null>(null);
  const [loading, setLoading]         = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeProblemIdx, setActiveProblemIdx] = useState(0);
  const [rightPanel, setRightPanel]             = useState<"editor" | "scoreboard">("editor");
  const [phase, setPhase]                       = useState<Phase>("briefing");

  // ── Editor state ────────────────────────────────────────────────────────────
  const [lang, setLang]   = useState("java");
  const [codes, setCodes] = useState<Record<string, Record<string, string>>>({});

  const currentCode = useCallback(() => {
    if (!arena) return DEFAULT_CODE[lang] ?? "";
    const pid = arena.problems[activeProblemIdx]?.problemId ?? "x";
    return codes[pid]?.[lang] ?? DEFAULT_CODE[lang] ?? "";
  }, [arena, activeProblemIdx, lang, codes]);

  const setCurrentCode = useCallback((val: string) => {
    if (!arena) return;
    const pid = arena.problems[activeProblemIdx]?.problemId ?? "x";
    setCodes(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [lang]: val } }));
  }, [arena, activeProblemIdx, lang]);

  // ── Run / submit state ──────────────────────────────────────────────────────
  const [running, setRunning]         = useState(false);
  const [runResults, setRunResults]   = useState<RunResult[] | null>(null);
  const [judging, setJudging]         = useState(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const stompRef = useRef<StompClient | null>(null);
  const subRef   = useRef<{ unsubscribe: () => void } | null>(null);

  // ── Scoreboard ──────────────────────────────────────────────────────────────
  const [scoreboard, setScoreboard]   = useState<ScoreboardEntry[]>([]);
  const [sbLoading, setSbLoading]     = useState(false);

  // ── Team activity ───────────────────────────────────────────────────────────
  const [activity, setActivity]       = useState<ActivityEntry[]>([]);

  // ── Competition end ─────────────────────────────────────────────────────────
  const [competitionEnded, setCompetitionEnded] = useState(false);
  const [showEndOverlay, setShowEndOverlay]     = useState(false);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null);
  const { isFullscreen } = useFullscreen(containerRef);

  // ── Anti-cheat ──────────────────────────────────────────────────────────────
  const [violationCount, setViolationCount] = useState(0);
  const [violationLog, setViolationLog]     = useState<ViolationEvent[]>([]);
  const [showViolations, setShowViolations] = useState(false);

  useAntiCheat({
    competitionId,
    onViolation: useCallback((event: ViolationEvent) => {
      setViolationCount(c => c + 1);
      setViolationLog(prev => [...prev, event]);
      reportCompetitionViolation(competitionId, event).catch(() => {});
    }, [competitionId]),
  });

  // ─── Load arena data ────────────────────────────────────────────────────────

  useEffect(() => {
    getCompetitionArena(competitionId)
      .then(data => {
        setArena(data);
        if (data.remainingSeconds <= 0) {
          setCompetitionEnded(true);
          setShowEndOverlay(true);
        }
      })
      .catch(err => { setAccessError(err.message ?? "Access denied"); })
      .finally(() => setLoading(false));
  }, [competitionId]);

  // ─── Timer ──────────────────────────────────────────────────────────────────

  const countdown = useCountdown(arena?.remainingSeconds ?? 0);

  // Detect timer hitting 0
  useEffect(() => {
    if (countdown.raw <= 0 && arena && !competitionEnded) {
      setCompetitionEnded(true);
      setTimeout(() => setShowEndOverlay(true), 3000);
    }
  }, [countdown.raw, arena, competitionEnded]);

  // ─── Arena polling (30s) — update solve statuses & detect END ───────────────

  useEffect(() => {
    if (!arena || competitionEnded) return;
    const id = setInterval(async () => {
      try {
        const fresh = await getCompetitionArena(competitionId);
        setArena(prev => prev ? { ...prev, problems: fresh.problems } : fresh);
        if (fresh.remainingSeconds <= 0 && !competitionEnded) {
          setCompetitionEnded(true);
          clearInterval(id);
          setTimeout(() => setShowEndOverlay(true), 3000);
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [arena, competitionId, competitionEnded]);

  // ─── Scoreboard polling (30s) ────────────────────────────────────────────────

  useEffect(() => {
    if (!arena) return;
    const refresh = () =>
      getCompetitionScoreboard(competitionId)
        .then(data => setScoreboard(data as ScoreboardEntry[]))
        .catch(() => {});
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [arena, competitionId]);

  // ─── Load scoreboard panel ───────────────────────────────────────────────────

  useEffect(() => {
    if (rightPanel !== "scoreboard") return;
    setSbLoading(true);
    getCompetitionScoreboard(competitionId)
      .then(data => setScoreboard(data as ScoreboardEntry[]))
      .catch(() => {})
      .finally(() => setSbLoading(false));
  }, [rightPanel, competitionId]);

  // ─── STOMP connection ────────────────────────────────────────────────────────

  useEffect(() => {
    const client = new StompClient({
      webSocketFactory: () =>
        new SockJS(`${getApiBaseUrl()}/ws`),
      reconnectDelay: 5000,
    });
    client.activate();
    stompRef.current = client;
    return () => { client.deactivate(); };
  }, []);

  // ─── Team events ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!arena?.myTeam?.teamId || !stompRef.current) return;
    const client = stompRef.current;
    const refreshActivity = () =>
      getCompetitionTeamActivity(competitionId)
        .then(acts => setActivity(acts.map((a: any) => ({
          studentName: a.studentName,
          problemLabel: a.problemLabel,
          verdict: a.verdict,
          score: a.score,
          submittedAt: a.submittedAt,
        }))))
        .catch(() => {});

    refreshActivity();

    const sub = client.subscribe(
      `/topic/competition/${competitionId}/team/${arena.myTeam.teamId}`,
      msg => {
        const event = JSON.parse(msg.body);
        if (event.type === "TEAMMATE_SUBMITTED") {
          getCompetitionArena(competitionId)
            .then(fresh => setArena(prev => prev ? { ...prev, problems: fresh.problems } : fresh))
            .catch(() => {});
          refreshActivity();
        }
      }
    );
    return () => { sub.unsubscribe(); };
  }, [arena?.myTeam?.teamId, competitionId]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Alt+1..5 — jump to problem
      if (e.altKey && e.key >= "1" && e.key <= "5") {
        const idx = parseInt(e.key, 10) - 1;
        if (arena?.problems[idx]) setActiveProblemIdx(idx);
        return;
      }
      // Ctrl+Enter — submit
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // Ctrl+R — run
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        handleRun();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena, activeProblemIdx, lang, codes]);

  // ─── Run code ────────────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!arena) return;
    const problem = arena.problems[activeProblemIdx];
    setRunning(true);
    setRunResults(null);
    setJudgeResult(null);
    try {
      const res = await runCode(problem.problemId, { sourceCode: currentCode(), language: lang });
      setRunResults(res.results.map((r, i) => ({
        idx: i,
        input: r.input ?? "",
        expected: r.expectedOutput ?? "",
        actual: r.actualOutput ?? "",
        passed: r.passed,
        status: r.verdict,
        timeMs: r.timeMs,
      })));
    } catch { /* apiClient shows toast */ }
    finally { setRunning(false); }
  }, [arena, activeProblemIdx, lang, currentCode]);

  // ─── Submit code ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!arena || judging || !isFullscreen) return;
    const problem = arena.problems[activeProblemIdx];
    setJudging(true);
    setJudgeResult({ submissionId: "", verdict: "PENDING", score: 0, executionTimeMs: 0 });
    setRunResults(null);

    let submissionId: string;
    try {
      const res = await submitToCompetition(competitionId, {
        problemId: problem.problemId,
        sourceCode: currentCode(),
        language: lang,
      });
      submissionId = res.submissionId;
    } catch {
      setJudging(false);
      setJudgeResult(null);
      return;
    }

    const client = stompRef.current;
    if (!client) { setJudging(false); return; }

    const waitConnected = () =>
      new Promise<void>(resolve => {
        if (client.connected) { resolve(); return; }
        const id = setInterval(() => { if (client.connected) { clearInterval(id); resolve(); } }, 100);
      });
    await waitConnected();

    subRef.current?.unsubscribe();
    subRef.current = client.subscribe(`/topic/submissions/${submissionId}`, msg => {
      const payload = JSON.parse(msg.body);
      const verdict = payload.verdict ?? payload.status ?? "WA";
      setJudgeResult({ submissionId, verdict, score: payload.score ?? 0, executionTimeMs: payload.executionTimeMs ?? 0 });
      setJudging(false);
      subRef.current?.unsubscribe();

      if (verdict === "AC") {
        setArena(prev => prev ? {
          ...prev,
          problems: prev.problems.map((p, i) =>
            i === activeProblemIdx ? { ...p, solveStatus: "SOLVED" } : p
          ),
        } : prev);
        toast.success("Accepted!", `Problem ${problem.label} solved — ${payload.score ?? 0} pts`);
      } else {
        setArena(prev => prev ? {
          ...prev,
          problems: prev.problems.map((p, i) =>
            i === activeProblemIdx && p.solveStatus === "UNSOLVED"
              ? { ...p, solveStatus: "ATTEMPTED" } : p
          ),
        } : prev);
      }
    });
  }, [arena, activeProblemIdx, lang, judging, isFullscreen, currentCode, competitionId]);

  // ─── Clear results on problem change ────────────────────────────────────────

  useEffect(() => {
    setRunResults(null);
    setJudgeResult(null);
  }, [activeProblemIdx]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  // Briefing gate: lets the user explicitly enter (satisfies browser
  // user-gesture requirement for fullscreen) and shows the lockdown notice.
  if (!loading && !accessError && arena && phase === "briefing" && !competitionEnded) {
    return (
      <BriefingScreen
        title={arena.title}
        problemCount={arena.problems.length}
        durationSeconds={arena.remainingSeconds}
        mode={arena.mode}
        teamName={arena.myTeam?.teamName}
        onEnter={() => setPhase("active")}
        onCancel={() => router.push(`/competitions/${competitionId}/lobby`)}
      />
    );
  }

  const activeProblem = arena?.problems[activeProblemIdx];
  const solvedCount   = arena?.problems.filter(p => p.solveStatus === "SOLVED").length ?? 0;

  // ── Body factories (called per-tab so refs/keys stay stable) ──────────────
  const buildBody = (mainRight: React.ReactNode) => (
    <div ref={containerRef} className="arena-shell" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @media print { body { display: none !important; } }
        .arena-shell { -webkit-user-select: none; -moz-user-select: none; user-select: none; }
        .arena-shell .monaco-editor,
        .arena-shell .monaco-editor * { -webkit-user-select: text; -moz-user-select: text; user-select: text; }
        .arena-shell .test-block,
        .arena-shell .problem-title { -webkit-user-select: text; -moz-user-select: text; user-select: text; }
      `}</style>

      {arena && (
        <LeftPanel
          problems={arena.problems}
          activeProblemIdx={activeProblemIdx}
          setActiveProblemIdx={setActiveProblemIdx}
          solvedCount={solvedCount}
          mode={arena.mode}
          activity={activity}
        />
      )}

      {activeProblem && <ProblemStatement problem={activeProblem} />}

      {mainRight}
    </div>
  );

  const tabs: ArenaTab[] = [
    {
      key: "workspace",
      label: "Workspace",
      icon: <Code size={14} />,
      content: buildBody(
        activeProblem && (
          <RightEditorPanel
            lang={lang}
            setLang={setLang}
            code={currentCode()}
            setCode={setCurrentCode}
            running={running}
            judging={judging}
            runResults={runResults}
            judgeResult={judgeResult}
            isFullscreen={isFullscreen}
            onRun={handleRun}
            onSubmit={handleSubmit}
            problem={activeProblem}
          />
        )
      ),
    },
    {
      key: "scoreboard",
      label: "Scoreboard",
      icon: <Trophy size={14} />,
      content: buildBody(
        arena && (
          <ScoreboardPanel
            scoreboard={scoreboard}
            loading={sbLoading}
            mode={arena.mode}
            problems={arena.problems}
            myUserId={userId}
          />
        )
      ),
    },
  ];

  return (
    <>
      <ArenaShell
        title={arena?.title ?? "Competition"}
        backHref={`/competitions/${competitionId}/lobby`}
        backLabel="Leave"
        remainingSeconds={countdown.raw}
        isEnded={competitionEnded}
        endedMessage="The competition has ended. Submissions are no longer accepted."
        loading={loading}
        loadingMessage="Loading competition…"
        accessError={accessError}
        lockdown={{
          fullscreen: !competitionEnded,
          // We wire useAntiCheat ourselves so we can surface the violation log.
          antiCheat: false,
        }}
        tabs={tabs}
        activeTabKey={rightPanel === "editor" ? "workspace" : "scoreboard"}
        onTabChange={(k) => setRightPanel(k === "scoreboard" ? "scoreboard" : "editor")}
        topBarExtras={
          arena && (
            <CPTopBarExtras
              teamName={arena.myTeam?.teamName}
              firstName={firstName}
              violationCount={violationCount}
              violationLog={violationLog}
              showViolations={showViolations}
              setShowViolations={setShowViolations}
            />
          )
        }
      />

      {/* ── END OF COMPETITION OVERLAY ── */}
      {showEndOverlay && arena && (
        <EndOfCompetitionOverlay
          title={arena.title}
          scoreboard={scoreboard}
          myUserId={userId}
          mode={arena.mode}
          onViewResults={() => router.push(`/competitions/${competitionId}`)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing screen (CP entry gate)
// ─────────────────────────────────────────────────────────────────────────────

function BriefingScreen({
  title, problemCount, durationSeconds, mode, teamName, onEnter, onCancel,
}: {
  title:           string;
  problemCount:    number;
  durationSeconds: number;
  mode:            "SOLO" | "TEAM";
  teamName?:       string;
  onEnter:         () => void;
  onCancel:        () => void;
}) {
  const mins = Math.floor(Math.max(0, durationSeconds) / 60);
  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0d1426", color: "#f8fafc",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    }}>
      <div style={{
        background: "#172b4d", borderRadius: 10, padding: "32px 36px",
        maxWidth: 520, width: "100%", boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, background: "#0052cc", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 900, fontSize: 16,
          }}>P</div>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Entering competition
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          <BriefStat label="Problems" value={String(problemCount)} />
          <BriefStat label="Duration" value={mins > 0 ? `${mins} min` : "—"} />
          <BriefStat label={mode === "TEAM" ? "Team" : "Mode"} value={mode === "TEAM" ? (teamName ?? "—") : "Solo"} />
        </div>

        <div style={{
          background: "rgba(222,53,11,0.12)", border: "1px solid rgba(222,53,11,0.4)",
          borderRadius: 6, padding: "10px 12px", marginBottom: 18,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <ShieldAlert size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, lineHeight: 1.55, color: "#fecaca" }}>
            <strong style={{ color: "#fee2e2" }}>Anti-cheat is active.</strong>{" "}
            Fullscreen is required to submit. Tab switches, copy/paste outside
            the editor, dev-tools shortcuts and right-click are logged.
          </div>
        </div>

        <button
          type="button"
          onClick={onEnter}
          style={{
            width: "100%", height: 42, background: "#0052cc",
            color: "white", border: "none", borderRadius: 6,
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Play size={14} />
          Enter Arena
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "transparent", border: "none",
              fontSize: 12, color: "#94a3b8", cursor: "pointer",
            }}
          >
            ← Back to lobby
          </button>
        </div>
      </div>
    </div>
  );
}

function BriefStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 6, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: "#f8fafc", marginTop: 2,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-bar extras (team/user name + violation counter + slide-over)
// ─────────────────────────────────────────────────────────────────────────────

function CPTopBarExtras({
  teamName, firstName, violationCount, violationLog,
  showViolations, setShowViolations,
}: {
  teamName?: string; firstName: string | null;
  violationCount: number; violationLog: ViolationEvent[];
  showViolations: boolean; setShowViolations: (v: boolean) => void;
}) {
  return (
    <>
      {teamName && (
        <span style={{
          color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 500,
          maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {teamName}
        </span>
      )}

      {violationCount > 0 && (
        <button
          onClick={() => setShowViolations(!showViolations)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(222,53,11,0.2)", border: "1px solid rgba(222,53,11,0.4)",
            borderRadius: 3, padding: "3px 10px", cursor: "pointer",
          }}
        >
          <span style={{ color: "#ff8b8b", fontSize: 11 }}>⚠</span>
          <span style={{ color: "#ffb8b8", fontSize: 11, fontWeight: 600 }}>
            {violationCount} violation{violationCount !== 1 ? "s" : ""}
          </span>
        </button>
      )}

      {firstName && (
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{firstName}</span>
      )}

      {showViolations && (
        <div style={{
          position: "fixed", top: 44, right: 0, width: 360, height: "calc(100vh - 44px)",
          background: "#172b4d", borderLeft: "1px solid #253858", zIndex: 9000,
          display: "flex", flexDirection: "column", overflowY: "hidden",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #253858", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>Your Violations</span>
            <button onClick={() => setShowViolations(false)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ padding: "10px 16px", background: "rgba(222,53,11,0.12)", borderBottom: "1px solid #253858" }}>
            <p style={{ fontSize: 12, color: "#ffb8b8" }}>⚠ These are logged and visible to the teacher</p>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {violationLog.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No violations recorded</p>
            ) : violationLog.map((v, i) => (
              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #253858" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: "#ff8b8b", fontSize: 12, fontWeight: 600 }}>{v.type.replace(/_/g, " ")}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{fmtTime(v.timestamp)}</span>
                </div>
                {v.details && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{v.details}</p>}
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid #253858" }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1.5 }}>
              Violations are reviewed after the competition. Excessive violations may result in disqualification.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeftPanel
// ─────────────────────────────────────────────────────────────────────────────

function LeftPanel({
  problems, activeProblemIdx, setActiveProblemIdx, solvedCount, mode, activity,
}: {
  problems: ArenaProblem[]; activeProblemIdx: number;
  setActiveProblemIdx: (i: number) => void;
  solvedCount: number; mode: "SOLO" | "TEAM";
  activity: ActivityEntry[];
}) {
  const progressPct = problems.length > 0 ? (solvedCount / problems.length) * 100 : 0;

  return (
    <div style={{ width: 220, background: "#253858", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #344563", overflowY: "auto" }}>
      <div style={{ padding: 12, borderBottom: "1px solid #344563" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Problems</div>
        {problems.map((p, i) => (
          <button key={p.problemId} onClick={() => setActiveProblemIdx(i)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
            borderRadius: 3, cursor: "pointer", marginBottom: 3, width: "100%", textAlign: "left",
            background: activeProblemIdx === i ? "#0052cc" : "transparent", border: "none",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: SOLVE_DOT[p.solveStatus] ?? "#5e6c84" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 500, flex: 1 }}>
              {p.label}. {p.title}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{p.points}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid #344563" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Progress</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>{solvedCount} / {problems.length} solved</div>
        <div style={{ background: "#344563", height: 4, borderRadius: 2 }}>
          <div style={{ background: "#00875a", height: 4, borderRadius: 2, width: `${progressPct}%`, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid #344563" }}>
        {[["SOLVED", "00875a"], ["ATTEMPTED", "ff8b00"], ["UNSOLVED", "5e6c84"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: `#${color}`, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "capitalize" }}>{label.toLowerCase()}</span>
          </div>
        ))}
      </div>

      {mode === "TEAM" && (
        <div style={{ padding: 12, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Team Activity</div>
          {activity.length === 0 ? (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 8 }}>No submissions yet</div>
          ) : activity.map((a, i) => (
            <div key={i} style={{ marginBottom: 8, padding: "6px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{a.studentName}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                Prob {a.problemLabel} —{" "}
                <span style={{ color: verdictColor(a.verdict), fontWeight: 600 }}>{a.verdict}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: 12, borderTop: "1px solid #344563", marginTop: "auto" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
          Alt+1–5: jump problem<br />
          Ctrl+Enter: submit<br />
          Ctrl+R: run
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProblemStatement
// ─────────────────────────────────────────────────────────────────────────────

function ProblemStatement({ problem }: { problem: ArenaProblem }) {
  const diff = DIFF_STYLE[problem.difficultyLevel] ?? DIFF_STYLE.EASY;

  return (
    <div style={{ flex: 1, background: "var(--bg-primary)", display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--border)" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div className="problem-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          {problem.label}. {problem.title}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <MetaChip>⏱ {problem.timeLimitMs} ms</MetaChip>
          <MetaChip>💾 {problem.memoryLimitMb} MB</MetaChip>
          <MetaChip style={{ background: diff.bg, color: diff.text }}>{problem.difficultyLevel}</MetaChip>
          <MetaChip>{problem.points} pts</MetaChip>
          {problem.attempts > 0 && (
            <MetaChip style={{
              background: problem.solveStatus === "SOLVED" ? "#e3fcef" : "#fffae6",
              color: problem.solveStatus === "SOLVED" ? "#006644" : "#974f0c",
            }}>
              {problem.solveStatus === "SOLVED" ? "✓ Solved" : `${problem.attempts} attempt${problem.attempts !== 1 ? "s" : ""}`}
            </MetaChip>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, marginBottom: 20, whiteSpace: "pre-wrap" }}>
          {problem.description}
        </div>

        {problem.visibleTestCases.length > 0 && (
          <>
            <SectionHeader>Sample Test Cases</SectionHeader>
            {problem.visibleTestCases.map((tc, i) => (
              <div key={tc.testCaseId} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                  Example {i + 1}
                </div>
                <CodeBlock label="Input" selectable>{tc.input}</CodeBlock>
                <CodeBlock label="Expected Output" selectable>{tc.expectedOutput}</CodeBlock>
              </div>
            ))}
          </>
        )}

        {problem.hiddenTestCaseCount > 0 && (
          <>
            <SectionHeader>Hidden Test Cases</SectionHeader>
            {Array.from({ length: problem.hiddenTestCaseCount }).map((_, i) => (
              <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "7px 12px", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                🔒 Hidden test case {i + 1}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RightEditorPanel
// ─────────────────────────────────────────────────────────────────────────────

function RightEditorPanel({
  lang, setLang, code, setCode, running, judging,
  runResults, judgeResult, isFullscreen, onRun, onSubmit, problem,
}: {
  lang: string; setLang: (l: string) => void;
  code: string; setCode: (c: string) => void;
  running: boolean; judging: boolean;
  runResults: RunResult[] | null;
  judgeResult: JudgeResult | null;
  isFullscreen: boolean;
  onRun: () => void; onSubmit: () => void;
  problem: ArenaProblem;
}) {
  const hasResults = runResults !== null || judgeResult !== null;
  const submitDisabled = judging || running || problem.solveStatus === "SOLVED" || !isFullscreen;

  let submitLabel = "Submit";
  if (problem.solveStatus === "SOLVED") submitLabel = "✓ Solved";
  else if (judging) submitLabel = "Judging…";
  else if (!isFullscreen) submitLabel = "⛔ Fullscreen required";

  let submitBg = "#0052cc";
  if (problem.solveStatus === "SOLVED") submitBg = "#00875a";
  else if (submitDisabled) submitBg = "#97a0af";

  return (
    <div style={{ width: 500, display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-primary)" }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Language</span>
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          style={{ border: "1px solid var(--border)", borderRadius: 3, padding: "0 8px", height: 28, fontSize: 12, color: "var(--text-primary)", outline: "none", background: "var(--bg-primary)" }}
        >
          {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <button
          onClick={() => setCode(DEFAULT_CODE[lang] ?? "")}
          style={{ background: "transparent", color: "var(--text-muted)", border: "none", fontSize: 12, cursor: "pointer", padding: "0 4px" }}
          title="Reset to template"
        >↺</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={onRun}
            disabled={running || judging}
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 3, height: 28, padding: "0 14px", fontSize: 12, cursor: running || judging ? "not-allowed" : "pointer", fontWeight: 500 }}
          >
            {running ? "Running…" : "▷ Run"}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitDisabled}
            title={!isFullscreen ? "Enter fullscreen to submit" : undefined}
            style={{ background: submitBg, color: "white", border: "none", borderRadius: 3, height: 28, padding: "0 16px", fontSize: 12, cursor: submitDisabled ? "not-allowed" : "pointer", fontWeight: 600 }}
          >
            {submitLabel}
          </button>
        </div>
      </div>

      <div style={{ flex: hasResults ? "0 0 55%" : 1, overflow: "hidden" }}>
        <MonacoEditor
          language={LANG_MONACO[lang] ?? "java"}
          value={code}
          onChange={val => setCode(val ?? "")}
          theme="vs-dark"
          options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: "on", tabSize: 4, automaticLayout: true }}
        />
      </div>

      {hasResults && (
        <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0, maxHeight: "45%", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {judgeResult && <JudgeResultBanner result={judgeResult} />}
          {runResults && (
            <>
              <div style={{ padding: "7px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Run Results</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {runResults.filter(r => r.passed).length}/{runResults.length} passed
                </span>
              </div>
              {runResults.map((r, i) => <RunResultRow key={i} result={r} idx={i} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreboardPanel
// ─────────────────────────────────────────────────────────────────────────────

function ScoreboardPanel({
  scoreboard, loading, mode, problems, myUserId,
}: {
  scoreboard: ScoreboardEntry[]; loading: boolean;
  mode: "SOLO" | "TEAM"; problems: ArenaProblem[]; myUserId: string | null;
}) {
  return (
    <div style={{ width: 500, display: "flex", flexDirection: "column", background: "var(--bg-primary)", borderLeft: "1px solid var(--border)" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Scoreboard</span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "#0052cc", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {scoreboard.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No submissions yet</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, width: 36 }}>#</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>
                    {mode === "TEAM" ? "Team" : "Participant"}
                  </th>
                  {problems.map(p => (
                    <th key={p.problemId} style={{ padding: "8px 8px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, width: 36 }}>{p.label}</th>
                  ))}
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {scoreboard.map(entry => {
                  const isMe = mode === "SOLO" && entry.studentId === myUserId;
                  return (
                    <tr key={entry.teamId ?? entry.studentId} style={{ borderBottom: "1px solid #f4f5f7", background: isMe ? "#deebff" : "transparent" }}>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontWeight: 700 }}>{entry.rank}</td>
                      <td style={{ padding: "8px 12px", color: "var(--text-primary)", fontWeight: 500 }}>
                        {mode === "TEAM" ? entry.teamName : `${entry.firstName} ${entry.lastName}`}
                      </td>
                      {entry.problems.map(p => (
                        <td key={p.label} style={{ padding: "8px 8px", textAlign: "center" }}>
                          {p.verdict ? (
                            <span style={{ color: verdictColor(p.verdict), fontWeight: 700 }}>
                              {p.verdict === "AC" ? "✓" : "✗"}
                            </span>
                          ) : (
                            <span style={{ color: "var(--border)" }}>—</span>
                          )}
                        </td>
                      ))}
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-primary)", fontWeight: 700 }}>{entry.totalScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function JudgeResultBanner({ result }: { result: JudgeResult }) {
  const isPending = result.verdict === "PENDING";
  const isAC      = result.verdict === "AC";
  const bg    = isPending ? "#deebff" : isAC ? "#e3fcef" : "#ffebe6";
  const color = isPending ? "#0747a6" : isAC ? "#006644"  : "#bf2600";

  return (
    <div style={{ padding: "10px 14px", background: bg, color, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      {isPending ? (
        <>
          <div style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          Judging…
        </>
      ) : (
        <>
          <span>{isAC ? "✓" : "✗"}</span>
          <span>{verdictLabel(result.verdict)}</span>
          {result.score > 0 && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500 }}>{result.score} pts</span>}
          {result.executionTimeMs > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>{result.executionTimeMs} ms</span>}
        </>
      )}
    </div>
  );
}

function RunResultRow({ result, idx }: { result: RunResult; idx: number }) {
  const [open, setOpen] = useState(false);
  const icon  = result.passed ? "✓" : result.status === "TIME_OUT" ? "⏱" : "✗";
  const color = result.passed ? "#006644" : result.status === "TIME_OUT" ? "#974f0c" : "#bf2600";

  return (
    <div style={{ borderBottom: "1px solid #f4f5f7" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", padding: "7px 12px", gap: 8, fontSize: 12, cursor: "pointer" }}
      >
        <span style={{ width: 28, color: "var(--text-muted)", fontSize: 11 }}>TC {idx + 1}</span>
        <span style={{ color, fontSize: 14 }}>{icon}</span>
        <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>{result.passed ? "Passed" : result.status}</span>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{result.timeMs} ms</span>
        <span style={{ color: "var(--text-subtle)", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 12px 10px 48px" }}>
          <CodeBlock label="Input" selectable>{result.input}</CodeBlock>
          <CodeBlock label="Expected" selectable>{result.expected}</CodeBlock>
          {!result.passed && (
            <CodeBlock label="Actual" selectable style={{ borderColor: "#ffebe6", background: "var(--red-light)" }}>
              {result.actual}
            </CodeBlock>
          )}
        </div>
      )}
    </div>
  );
}

function MetaChip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", fontSize: 11, color: "var(--text-muted)", ...style }}>
      {children}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 8, marginTop: 20 }}>
      {children}
    </div>
  );
}

function CodeBlock({ label, children, selectable, style }: {
  label?: string; children: React.ReactNode; selectable?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div
      className={selectable ? "test-block" : undefined}
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 3, padding: "8px 12px", fontFamily: "monospace", fontSize: 12, color: "var(--text-primary)", marginBottom: 6, ...style }}
    >
      {label && <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>}
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{children}</pre>
    </div>
  );
}
