"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Shield, Zap, Timer, Trophy, ClipboardList, Lock,
  GraduationCap, BookOpen, KeyRound, CheckCircle2,
  Terminal, Cpu, MemoryStick, Wifi, WifiOff, Eye,
  Copy, MonitorOff, Flag, Users, Clock, TrendingUp,
  ChevronRight, ArrowRight,
} from "lucide-react";

// ─── Terminal animation ────────────────────────────────────────────────────────

const TERMINAL_LINES = [
  { delay: 0,    text: "$ psp-runner --lang python3 solution.py",      color: "#94a3b8" },
  { delay: 600,  text: "→ Spawning isolated container…",               color: "#64748b" },
  { delay: 1100, text: "→ Network: disabled  CPU: 256m  Mem: 128Mi",   color: "#64748b" },
  { delay: 1700, text: "",                                               color: "" },
  { delay: 1900, text: "Test Case 1 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 2300, text: "Test Case 2 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 2700, text: "Test Case 3 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 3100, text: "Test Case 4 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 3500, text: "Test Case 5 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 3900, text: "Test Case 6 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 4300, text: "Test Case 7 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 4700, text: "Test Case 8 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 5100, text: "Test Case 9 / 10  ............  PASSED",        color: "#34d399" },
  { delay: 5500, text: "Test Case 10 / 10  ...........  PASSED",        color: "#34d399" },
  { delay: 5900, text: "",                                               color: "" },
  { delay: 6100, text: "Runtime: 38ms  Memory: 14.2 MB",               color: "#94a3b8" },
  { delay: 6400, text: "VERDICT: ACCEPTED",                             color: "#VERDICT" },
];

function TerminalWindow() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [running, setRunning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), TERMINAL_LINES[i].delay));
    });
    const reset = setTimeout(() => {
      setVisibleCount(0);
      setRunning(false);
      setTimeout(() => setRunning(true), 1400);
    }, 8200);
    return () => { timers.forEach(clearTimeout); clearTimeout(reset); };
  }, [running]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const verdict = visibleCount >= TERMINAL_LINES.length;

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-[#090d16] shadow-2xl shadow-black/60">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-[#0d1117]">
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-xs text-zinc-500 font-mono">psp-runner · solution.py</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-mono text-zinc-600">
          <Terminal size={11} />
          bash
        </span>
      </div>

      {/* Lines */}
      <div
        ref={containerRef}
        className="p-5 font-mono text-[12.5px] leading-6 min-h-[300px] max-h-[340px] overflow-y-auto scrollbar-none space-y-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {TERMINAL_LINES.slice(0, visibleCount).map((line, i) => {
          if (line.color === "#VERDICT") {
            return (
              <div
                key={i}
                className="mt-2 rounded-md px-3 py-2 text-[13px] font-bold tracking-widest text-center"
                style={{
                  background: "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.35)",
                  color: "#34d399",
                  boxShadow: "0 0 24px rgba(52,211,153,0.15)",
                  animation: "psp-glow-in 0.4s ease-out",
                }}
              >
                ✓ VERDICT: ACCEPTED
              </div>
            );
          }
          if (!line.text) return <div key={i} className="h-2" />;
          return (
            <div key={i} style={{ color: line.color, animation: "psp-fade-in 0.2s ease-out" }}>
              {line.text}
            </div>
          );
        })}
        {visibleCount < TERMINAL_LINES.length && !verdict && (
          <span className="inline-block w-2 h-4 bg-emerald-400 align-middle animate-pulse" />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-[#0d1117] text-[11px] font-mono">
        <span className={verdict ? "text-emerald-400" : "text-zinc-500"}>
          {verdict ? "● Accepted" : "● Running…"}
        </span>
        <span className="text-zinc-600">python3 · Docker · PSP v2.4</span>
      </div>
    </div>
  );
}

// ─── Anti-cheat feed mock ──────────────────────────────────────────────────────

const CHEAT_EVENTS = [
  { t: "09:14:22", type: "TAB_SWITCH",   msg: "Switched to external tab",     color: "#fbbf24" },
  { t: "09:16:05", type: "COPY_PASTE",   msg: "Ctrl+V detected in editor",    color: "#fb923c" },
  { t: "09:18:33", type: "WINDOW_BLUR",  msg: "Window lost focus (8.2s)",     color: "#fbbf24" },
  { t: "09:21:11", type: "TAB_SWITCH",   msg: "Returned to exam tab",         color: "#94a3b8" },
  { t: "09:23:44", type: "COPY_PASTE",   msg: "Ctrl+C on problem statement",  color: "#fb923c" },
];

// ─── Metrics bar ──────────────────────────────────────────────────────────────

const METRICS = [
  { value: "6+",         label: "Languages Supported",    mono: true },
  { value: "< 2s",       label: "Avg Execution Time",     mono: true },
  { value: "Docker",     label: "Isolated Execution",     mono: false },
  { value: "Real-time",  label: "WebSocket Results",      mono: false },
  { value: "Anti-Cheat", label: "Built-in Monitoring",    mono: false },
];

// ─── Role data ────────────────────────────────────────────────────────────────

const ROLES = {
  Students: {
    icon: <GraduationCap size={18} />,
    color: "#60a5fa",
    accent: "rgba(96,165,250,0.1)",
    border: "rgba(96,165,250,0.2)",
    items: [
      "Join live timed exams via access code",
      "Submit in Python, C++, Java, and more",
      "See test cases light up in real-time",
      "Compete solo or in teams in CTF events",
      "Earn points and rank on the leaderboard",
      "Practice on public problem library",
    ],
  },
  Teachers: {
    icon: <BookOpen size={18} />,
    color: "#34d399",
    accent: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.2)",
    items: [
      "Create exams with hidden test cases",
      "Set time limits, attempt caps, and access modes",
      "Monitor live anti-cheat violation feed",
      "Approve or reject join requests",
      "Review all submissions with code diff view",
      "Apply manual score adjustments and penalties",
    ],
  },
  Admins: {
    icon: <KeyRound size={18} />,
    color: "#a78bfa",
    accent: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.2)",
    items: [
      "Approve or reject teacher account requests",
      "Monitor platform-wide submission activity",
      "Manage academic department structure",
      "View and audit all assessment results",
    ],
  },
};

type RoleKey = keyof typeof ROLES;

// ─── Main component ────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeRole, setActiveRole] = useState<RoleKey>("Students");

  return (
    <div
      className="min-h-screen text-slate-200"
      style={{
        background: "#090d16",
        fontFamily: "'Inter', 'Geist', system-ui, sans-serif",
      }}
    >
      {/* Global keyframes */}
      <style>{`
        @keyframes psp-fade-in { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
        @keyframes psp-glow-in { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes psp-pulse-dot { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .psp-card-hover { transition: border-color 0.2s, box-shadow 0.2s; }
        .psp-card-hover:hover { border-color: rgba(99,102,241,0.35) !important; box-shadow: 0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.4); }
        .psp-grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%);
        }
        .psp-mono { font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace; }
        .scrollbar-none::-webkit-scrollbar { display:none; }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center px-6 md:px-12 h-14 border-b"
        style={{ background: "rgba(9,13,22,0.9)", borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-black text-sm text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
          >P</div>
          <span className="font-bold text-[15px] text-slate-100">PSP Platform</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 ml-8">
          {["Features", "How it works", "Leaderboard"].map(label => (
            <a
              key={label}
              href={label === "Leaderboard" ? "/leaderboard" : `#${label.toLowerCase().replace(/ /g, "-")}`}
              className="px-3 h-8 flex items-center text-[13px] text-slate-400 hover:text-slate-200 rounded-md transition-colors no-underline"
              style={{ textDecoration: "none" }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Link
            href="/auth"
            className="h-8 px-4 text-[13px] font-medium text-slate-300 border rounded-md flex items-center no-underline transition-colors hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent", textDecoration: "none" }}
          >
            Sign In
          </Link>
          <Link
            href="/auth"
            className="h-8 px-4 text-[13px] font-semibold text-white rounded-md flex items-center no-underline"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", textDecoration: "none" }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6 md:px-12">
        {/* Grid background */}
        <div className="absolute inset-0 psp-grid-bg pointer-events-none" />
        {/* Radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top, rgba(99,102,241,0.18) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div
              className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-[12px] font-semibold psp-mono"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                style={{ animation: "psp-pulse-dot 2s infinite" }}
              />
              University-grade · Secure · Real-time
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              <span className="text-slate-100">Where University</span>
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg,#818cf8,#6366f1,#34d399)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Code is Tested.
              </span>
            </h1>

            <p className="text-[16px] text-slate-400 leading-relaxed mb-10 max-w-[440px]">
              A secure, real-time coding assessment platform for universities. Live exams, practical
              assignments, and CTF competitions — all running in isolated Docker containers.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 h-11 px-6 text-[14px] font-bold text-white rounded-lg no-underline"
                style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", textDecoration: "none" }}
              >
                Start as Student <ArrowRight size={15} />
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 h-11 px-6 text-[14px] font-semibold text-slate-300 rounded-lg no-underline border transition-colors hover:text-white hover:border-slate-600"
                style={{ border: "1px solid rgba(255,255,255,0.12)", background: "transparent", textDecoration: "none" }}
              >
                I&apos;m a Teacher <ChevronRight size={15} />
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-4 mt-8 flex-wrap">
              {[
                { icon: <Lock size={12} />, label: "Docker isolated" },
                { icon: <Shield size={12} />, label: "Anti-cheat" },
                { icon: <Zap size={12} />, label: "WebSocket live" },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  <span className="text-slate-600">{b.icon}</span>
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right — terminal */}
          <div className="relative hidden lg:block">
            <div
              className="absolute -inset-4 rounded-2xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
            />
            <TerminalWindow />
          </div>
        </div>
      </section>

      {/* ── METRICS BAR ─────────────────────────────────────────────────────── */}
      <div
        className="border-y"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 divide-x"
          style={{ divideColor: "rgba(255,255,255,0.06)" } as React.CSSProperties}
        >
          {METRICS.map((m, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center py-5 px-4 text-center"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div
                className={`text-xl font-black mb-1 ${m.mono ? "psp-mono" : ""}`}
                style={{
                  background: "linear-gradient(90deg,#818cf8,#6366f1)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {m.value}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BENTO FEATURES ──────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="inline-block text-[11px] font-bold psp-mono uppercase tracking-widest mb-3 px-2 py-1 rounded"
              style={{ color: "#818cf8", background: "rgba(99,102,241,0.1)" }}
            >
              Core Features
            </div>
            <h2 className="text-4xl font-extrabold text-slate-100 tracking-tight mb-3">
              Everything you need for coding assessments
            </h2>
            <p className="text-slate-400 text-[15px]">
              From live proctored exams to open CTF competitions — PSP handles every scenario.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">

            {/* Card 1 — Large (spans 2 cols) — Secure Execution */}
            <div
              className="md:col-span-2 rounded-xl p-6 border psp-card-hover"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
                  <Lock size={17} color="#f87171" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-100">Secure Execution</div>
                  <div className="text-[12px] text-slate-500">Every submission runs in a fresh container</div>
                </div>
              </div>

              {/* Container visualization */}
              <div
                className="rounded-lg p-4 border psp-mono text-[12px] space-y-2"
                style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="text-slate-500 mb-3">docker run --rm psp-sandbox:latest</div>
                {[
                  { icon: <Cpu size={12} />, label: "CPU", val: "256 millicores", color: "#fb923c" },
                  { icon: <MemoryStick size={12} />, label: "Memory", val: "128 MiB limit", color: "#fbbf24" },
                  { icon: <WifiOff size={12} />, label: "Network", val: "disabled", color: "#f87171" },
                  { icon: <Timer size={12} />, label: "Timeout", val: "10s hard kill", color: "#a78bfa" },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span style={{ color: r.color }}>{r.icon}</span>
                    <span className="text-slate-500 w-20">{r.label}</span>
                    <span className="text-slate-300">{r.val}</span>
                    <span
                      className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}
                    >
                      ENFORCED
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2 — Anti-Cheat */}
            <div
              className="rounded-xl p-6 border psp-card-hover"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
                  <Shield size={17} color="#fbbf24" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-100">Anti-Cheat Built In</div>
                  <div className="text-[12px] text-slate-500">Live violation feed</div>
                </div>
              </div>
              <div className="space-y-2">
                {CHEAT_EVENTS.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[11px] rounded-md px-2.5 py-1.5"
                    style={{ background: "rgba(0,0,0,0.25)" }}
                  >
                    <span className="psp-mono text-slate-600 mt-px shrink-0">{e.t}</span>
                    <span
                      className="psp-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `${e.color}18`, color: e.color, border: `1px solid ${e.color}30` }}
                    >
                      {e.type}
                    </span>
                    <span className="text-slate-400 leading-tight">{e.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3 — Live Timed Exams */}
            <div
              className="rounded-xl p-6 border psp-card-hover"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
                  <Timer size={17} color="#818cf8" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-100">Live Timed Exams</div>
                  <div className="text-[12px] text-slate-500">Synchronized countdowns</div>
                </div>
              </div>
              {/* Mock timer */}
              <div className="text-center mb-4">
                <div
                  className="psp-mono text-4xl font-black tracking-widest"
                  style={{ color: "#818cf8" }}
                >
                  01:23:44
                </div>
                <div className="text-[11px] text-slate-600 mt-1">remaining · 14 students active</div>
              </div>
              {/* Access code input mock */}
              <div
                className="flex items-center gap-2 rounded-md px-3 py-2 border psp-mono text-[12px]"
                style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <span className="text-slate-600">Access code:</span>
                <span className="text-indigo-400 font-bold tracking-widest">PSP-8K4Z</span>
                <span
                  className="ml-auto w-2 h-2 rounded-full"
                  style={{ background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "psp-pulse-dot 2s infinite" }}
                />
              </div>
            </div>

            {/* Card 4 — Instant Feedback */}
            <div
              className="rounded-xl p-6 border psp-card-hover"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                  <Zap size={17} color="#4ade80" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-100">Instant Feedback</div>
                  <div className="text-[12px] text-slate-500">WebSocket test case grid</div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 15 }).map((_, i) => {
                  const state = i < 9 ? "pass" : i === 9 ? "fail" : i < 12 ? "pending" : "idle";
                  const bg =
                    state === "pass" ? "rgba(52,211,153,0.2)" :
                    state === "fail" ? "rgba(248,113,113,0.2)" :
                    state === "pending" ? "rgba(251,191,36,0.15)" :
                    "rgba(255,255,255,0.05)";
                  const border =
                    state === "pass" ? "rgba(52,211,153,0.4)" :
                    state === "fail" ? "rgba(248,113,113,0.4)" :
                    state === "pending" ? "rgba(251,191,36,0.3)" :
                    "rgba(255,255,255,0.08)";
                  return (
                    <div
                      key={i}
                      className="h-8 rounded text-[10px] font-bold psp-mono flex items-center justify-center border"
                      style={{ background: bg, borderColor: border, color: border }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400/40" /> 9 passed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400/40" /> 1 failed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400/30" /> 3 running</span>
              </div>
            </div>

            {/* Card 5 — Competitions */}
            <div
              className="rounded-xl p-6 border psp-card-hover"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(167,139,250,0.1)" }}>
                  <Trophy size={17} color="#a78bfa" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-100">Competitions</div>
                  <div className="text-[12px] text-slate-500">CTF &amp; ranked contests</div>
                </div>
              </div>
              {/* Mode toggle */}
              <div
                className="flex rounded-lg p-0.5 mb-4 gap-0.5"
                style={{ background: "rgba(0,0,0,0.3)" }}
              >
                {["Solo", "Team"].map((m, i) => (
                  <div
                    key={m}
                    className="flex-1 text-center text-[12px] font-semibold py-1.5 rounded-md cursor-pointer"
                    style={i === 0
                      ? { background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }
                      : { color: "#475569" }
                    }
                  >
                    {m === "Team" ? <><Users size={11} className="inline mr-1" /></> : <><Flag size={11} className="inline mr-1" /></>}
                    {m}
                  </div>
                ))}
              </div>
              {/* Contest badges */}
              <div className="space-y-2">
                {[
                  { name: "InfoSec CTF #4",  score: "2450 pts", rank: "#3",  live: true },
                  { name: "Algo Sprint S2",   score: "1800 pts", rank: "#12", live: false },
                ].map(c => (
                  <div
                    key={c.name}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] border"
                    style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <TrendingUp size={12} color="#a78bfa" />
                    <span className="text-slate-300 font-medium flex-1">{c.name}</span>
                    <span className="text-slate-500 psp-mono">{c.score}</span>
                    <span className="psp-mono font-bold" style={{ color: "#a78bfa" }}>{c.rank}</span>
                    {c.live && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded psp-mono"
                        style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}
                      >LIVE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Card 6 — Open Assignments */}
            <div
              className="rounded-xl p-6 border psp-card-hover"
              style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(251,191,36,0.1)" }}>
                  <ClipboardList size={17} color="#fbbf24" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-100">Open Assignments</div>
                  <div className="text-[12px] text-slate-500">TP deadline tracking</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { name: "TP3 — Sorting",     attempts: 3, maxAttempts: 5, deadline: "2d 14h", pct: 60 },
                  { name: "TP4 — Graph BFS",   attempts: 1, maxAttempts: 3, deadline: "5d 02h", pct: 33 },
                ].map(tp => (
                  <div key={tp.name} className="text-[12px]">
                    <div className="flex justify-between text-slate-300 mb-1.5 font-medium">
                      <span>{tp.name}</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock size={11} />
                        <span className="psp-mono" style={{ color: "#fbbf24" }}>{tp.deadline}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${tp.pct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }}
                        />
                      </div>
                      <span className="text-slate-500 psp-mono shrink-0">{tp.attempts}/{tp.maxAttempts} attempts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-24 px-6 md:px-12 border-y"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="inline-block text-[11px] font-bold psp-mono uppercase tracking-widest mb-3 px-2 py-1 rounded"
              style={{ color: "#34d399", background: "rgba(52,211,153,0.08)" }}
            >
              Workflow
            </div>
            <h2 className="text-4xl font-extrabold text-slate-100 tracking-tight mb-3">
              From problem to verdict in four steps
            </h2>
            <p className="text-slate-400 text-[15px]">
              No infrastructure setup. No manual grading. Just write code and submit.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: "01", title: "Teacher Creates", desc: "Define problems, hidden test cases, time limits, and access mode. Link to a module or open publicly.", color: "#818cf8" },
              { n: "02", title: "Students Join", desc: "Enter access code or accept a join request. The exam timer starts simultaneously for everyone.", color: "#60a5fa" },
              { n: "03", title: "Code & Submit", desc: "Monaco editor with syntax highlighting. Choose Python, C++, Java, or 3 more. Hit submit.", color: "#34d399" },
              { n: "04", title: "Instant Verdict", desc: "Test cases stream via WebSocket. Final verdict, score, and leaderboard rank appear automatically.", color: "#fbbf24" },
            ].map((s, i) => (
              <div key={i} className="relative">
                {i < 3 && (
                  <div
                    className="hidden md:block absolute top-5 left-[calc(100%+12px)] w-6 h-px"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />
                )}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm psp-mono mb-4"
                  style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30` }}
                >
                  {s.n}
                </div>
                <div className="text-[14px] font-bold text-slate-100 mb-2">{s.title}</div>
                <div className="text-[13px] text-slate-400 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLE SWITCHER ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div
              className="inline-block text-[11px] font-bold psp-mono uppercase tracking-widest mb-3 px-2 py-1 rounded"
              style={{ color: "#a78bfa", background: "rgba(167,139,250,0.08)" }}
            >
              Who uses PSP
            </div>
            <h2 className="text-4xl font-extrabold text-slate-100 tracking-tight mb-3">
              Built for every role
            </h2>
            <p className="text-slate-400 text-[15px]">
              Students, teachers, and admins each get a tailored, purpose-built experience.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex justify-center mb-10">
            <div
              className="inline-flex rounded-xl p-1 gap-1"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {(Object.keys(ROLES) as RoleKey[]).map(role => {
                const r = ROLES[role];
                const active = activeRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer border-0"
                    style={active
                      ? { background: `${r.accent}`, color: r.color, border: `1px solid ${r.border}`, boxShadow: `0 0 16px ${r.color}20` }
                      : { background: "transparent", color: "#475569" }
                    }
                  >
                    <span style={{ color: active ? r.color : "#475569" }}>{r.icon}</span>
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature list */}
          {(Object.keys(ROLES) as RoleKey[]).map(role => {
            const r = ROLES[role];
            const active = activeRole === role;
            return (
              <div
                key={role}
                style={{
                  display: active ? "block" : "none",
                  animation: active ? "psp-fade-in 0.25s ease-out" : "none",
                }}
              >
                <div
                  className="rounded-xl p-8 border grid md:grid-cols-2 gap-4"
                  style={{ background: r.accent, borderColor: r.border }}
                >
                  {r.items.map((item, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <CheckCircle2 size={15} style={{ color: r.color, marginTop: 1, flexShrink: 0 }} />
                      <span className="text-[14px] text-slate-300 leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section
        className="py-24 px-6 md:px-12 relative overflow-hidden"
        style={{ background: "rgba(99,102,241,0.06)", borderTop: "1px solid rgba(99,102,241,0.15)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            Ready to run your first exam?
          </h2>
          <p className="text-[16px] text-slate-400 mb-10">
            Set up in minutes. No infrastructure required. Your first assessment can be live today.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 h-12 px-8 text-[15px] font-bold text-white rounded-xl no-underline"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", textDecoration: "none", boxShadow: "0 0 32px rgba(99,102,241,0.3)" }}
            >
              Create Account <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center h-12 px-8 text-[15px] font-semibold text-slate-300 rounded-xl no-underline border transition-colors hover:text-white"
              style={{ border: "1px solid rgba(255,255,255,0.12)", background: "transparent", textDecoration: "none" }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer
        className="border-t py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "#070b12" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
          >P</div>
          <span className="font-bold text-[14px] text-slate-300">PSP Platform</span>
        </div>
        <div className="text-[12px] text-slate-600">
          © 2026 PSP — University Problem Solving Platform · PFE Project
        </div>
        <div className="flex items-center gap-4">
          {["Features", "How it works"].map(link => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/ /g, "-")}`}
              className="text-[12px] text-slate-600 hover:text-slate-400 transition-colors no-underline"
              style={{ textDecoration: "none" }}
            >
              {link}
            </a>
          ))}
          <Link
            href="/leaderboard"
            className="text-[12px] text-slate-600 hover:text-slate-400 transition-colors no-underline"
            style={{ textDecoration: "none" }}
          >
            Leaderboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
