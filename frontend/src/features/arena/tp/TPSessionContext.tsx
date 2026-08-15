"use client";

import { createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { logCheatEvent, pingAuditSession, type ExamRoomDTO } from "@/lib/api";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useTPRoom, AccessCodeGate } from "@/features/arena/tp/tpShared";

interface TPSessionValue {
  tpId: string;
  room: ExamRoomDTO;
  reload: () => Promise<void>;
}

const TPSessionCtx = createContext<TPSessionValue | null>(null);

/** Room data and anti-cheat listeners shared by the task board and every task
 *  page. Lives in the TP's layout.tsx so it mounts once per session — moving
 *  between tasks never re-registers the anti-cheat listeners. */
export function useTPSession(): TPSessionValue {
  const ctx = useContext(TPSessionCtx);
  if (!ctx) throw new Error("useTPSession must be used within a TP session");
  return ctx;
}

export function TPSessionProvider({ tpId, children }: { tpId: string; children: React.ReactNode }) {
  const { room, loading, error, needsCode, verifyCode, reload } = useTPRoom(tpId);
  const { userId } = useAuth();
  const isLocked = !!room?.finalSubmittedAt;

  useEffect(() => {
    pingAuditSession("TP", tpId).catch(() => {});
  }, [tpId]);

  const reportViolation = (event: ViolationEvent) => {
    if (!userId) return;
    logCheatEvent({ studentId: userId, assessmentId: tpId, violationType: event.type }).catch(() => {});
  };
  useAntiCheat({ competitionId: tpId, enabled: !isLocked, onViolation: reportViolation });

  if (needsCode) return <AccessCodeGate title={room?.title} onVerify={verifyCode} />;

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--bg)" }}>
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{error ?? "TP not found."}</p>
        <Link href="/assessments" className="psp-btn psp-btn-secondary psp-btn-sm">Back</Link>
      </div>
    );
  }

  return (
    <TPSessionCtx.Provider value={{ tpId, room, reload }}>
      {children}
    </TPSessionCtx.Provider>
  );
}
