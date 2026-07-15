"use client";

import { useCallback, useEffect } from "react";
import { useAntiCheat, type ViolationEvent } from "@/hooks/useAntiCheat";
import { useCTFCompetition } from "@/features/ctf/context/CTFCompetitionContext";
import { pingAuditSession, logAuditViolation } from "@/lib/api";

/**
 * Anti-cheat + audit wiring for the CTF competition arena. Mounted once inside
 * the competition provider so it stays active across all tabs (challenges,
 * scoreboard, notifications). Mirrors what the exam/TP/CP arenas do:
 *  - captures the participant's IP on entry (multi-IP detection),
 *  - logs tab-switch / focus-loss / copy-paste / devtools violations to the
 *    CTF audit log via the generic violation endpoint.
 *
 * Only armed while the competition is ACTIVE and the user is on a team — i.e.
 * actually competing. Never touches flag-submission logic.
 */
export default function CTFAuditGuard({ competitionId }: { competitionId: string }) {
  const ctx     = useCTFCompetition();
  const armed   = ctx.status === "ACTIVE" && !!ctx.myTeam;

  useAntiCheat({
    competitionId,
    enabled: armed,
    onViolation: useCallback((event: ViolationEvent) => {
      logAuditViolation("CTF", competitionId, event.type, event.details).catch(() => {});
    }, [competitionId]),
  });

  useEffect(() => {
    if (!armed) return;
    pingAuditSession("CTF", competitionId).catch(() => {});
  }, [armed, competitionId]);

  return null;
}
