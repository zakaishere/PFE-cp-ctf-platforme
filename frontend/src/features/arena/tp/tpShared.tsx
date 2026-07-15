"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  getExamRoom, verifyAssessmentAccessCode, ApiException,
  type ExamRoomDTO,
} from "@/lib/api";

const MONO = "var(--font-mono), ui-monospace, monospace";

// Same per-tab cache the exam arena uses — one verified code unlocks both the
// overview and every task page of the TP for this browser tab.
export function accessCodeKey(id: string) { return `arena_access_code_${id}`; }
export function getCachedAccessCode(id: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(accessCodeKey(id));
}
export function setCachedAccessCode(id: string, code: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(accessCodeKey(id), code);
}

/** Loads the TP room, handling the access-code gate + reload after submits. */
export function useTPRoom(tpId: string) {
  const [room, setRoom] = useState<ExamRoomDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);

  const load = useCallback(async (codeOverride?: string) => {
    const code = codeOverride ?? getCachedAccessCode(tpId) ?? undefined;
    try {
      const data = await getExamRoom(tpId, code);
      setRoom(data);
      setNeedsCode(false);
      setError(null);
    } catch (err) {
      const isBadCode = err instanceof ApiException && err.status === 403
        && /access code/i.test(err.message);
      if (isBadCode) setNeedsCode(true);
      else setError(err instanceof Error ? err.message : "Failed to load TP.");
    } finally {
      setLoading(false);
    }
  }, [tpId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const verifyCode = useCallback(async (code: string) => {
    await verifyAssessmentAccessCode(tpId, code.trim()); // throws on wrong code
    setCachedAccessCode(tpId, code.trim());
    setLoading(true);
    await load(code.trim());
  }, [tpId, load]);

  return { room, loading, error, needsCode, verifyCode, reload: load };
}

/** Full-screen access-code prompt (same look as the exam arena's gate). */
export function AccessCodeGate({ title, onVerify }: {
  title?: string;
  onVerify: (code: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!input.trim() || busy) return;
    setBusy(true); setErr("");
    try { await onVerify(input); }
    catch { setErr("Invalid access code — try again"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--line-2)",
        borderRadius: 16, padding: "40px 48px", width: 380,
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div style={{ textAlign: "center" }}>
          <Lock size={32} style={{ color: "var(--accent)", marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "var(--ink)" }}>
            {title ?? "Access code required"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>Enter the access code to continue</p>
        </div>
        <input
          type="text" placeholder="Access code" value={input} autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{
            padding: "10px 14px", borderRadius: 10, fontSize: 14,
            background: "var(--bg-2)",
            border: `1px solid ${err ? "var(--danger)" : "var(--line-2)"}`,
            color: "var(--ink)", outline: "none", textAlign: "center",
            fontFamily: MONO, letterSpacing: "2px",
          }}
        />
        {err && <p style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginTop: -12 }}>{err}</p>}
        <button
          onClick={submit} disabled={busy || !input.trim()}
          style={{
            padding: "11px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
            background: "var(--accent)", color: "#0a0a0a", border: "none",
            cursor: busy ? "default" : "pointer", opacity: busy || !input.trim() ? 0.6 : 1,
          }}
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </div>
    </div>
  );
}

export function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
