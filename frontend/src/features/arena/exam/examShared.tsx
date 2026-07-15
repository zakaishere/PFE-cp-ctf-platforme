"use client";

import { useCallback, useEffect, useState } from "react";
import { getExamRoom, verifyAssessmentAccessCode, ApiException, type ExamRoomDTO } from "@/lib/api";
import { getCachedAccessCode, setCachedAccessCode } from "@/features/arena/tp/tpShared";

/** Loads the exam room and ticks `remainingSeconds` down locally each second
 *  between server refreshes (matches the old Arena.tsx countdown behavior). */
export function useExamRoom(examId: string) {
  const [room, setRoom] = useState<ExamRoomDTO | null>(null);
  const [remainingSecs, setRemainingSecs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);

  const load = useCallback(async (codeOverride?: string) => {
    const code = codeOverride ?? getCachedAccessCode(examId) ?? undefined;
    try {
      const data = await getExamRoom(examId, code);
      setRoom(data);
      setRemainingSecs(data.remainingSeconds);
      setNeedsCode(false);
      setError(null);
    } catch (err) {
      const isBadCode = err instanceof ApiException && err.status === 403
        && /access code/i.test(err.message);
      if (isBadCode) setNeedsCode(true);
      else setError(err instanceof Error ? err.message : "Failed to load exam.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Local tick between server refreshes; not authoritative (reload() re-syncs).
  useEffect(() => {
    if (!room || room.isEnded || remainingSecs <= 0) return;
    const id = setInterval(() => setRemainingSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [room, remainingSecs]);

  const verifyCode = useCallback(async (code: string) => {
    await verifyAssessmentAccessCode(examId, code.trim());
    setCachedAccessCode(examId, code.trim());
    setLoading(true);
    await load(code.trim());
  }, [examId, load]);

  return { room, remainingSecs, loading, error, needsCode, verifyCode, reload: load };
}

export function formatTime(secs: number): string {
  const s = Math.max(0, secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}
