"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getAuditSummary, type AuditDomain } from "@/lib/api";

/**
 * Shared "Audit Log" button for the four teacher/admin manage pages
 * (EXAM / TP / CP / CTF). Links to /teacher/audit/{domain}/{contextId} and
 * shows a red badge with the number of flagged participants, if any.
 */
export default function AuditLogButton({
  domain, contextId,
}: { domain: AuditDomain; contextId: string }) {
  const [flagged, setFlagged] = useState(0);

  useEffect(() => {
    let alive = true;
    getAuditSummary(domain, contextId)
      .then((rows) => { if (alive) setFlagged(rows.filter((r) => r.flagged).length); })
      .catch(() => { /* no access / no data — just render the plain button */ });
    return () => { alive = false; };
  }, [domain, contextId]);

  return (
    <Link href={`/teacher/audit/${domain}/${contextId}`} style={{
      position: "relative",
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "7px 14px", borderRadius: 8, flexShrink: 0,
      background: "var(--warn-soft)",
      border: "1px solid color-mix(in srgb, var(--warn) 20%, transparent)",
      color: "var(--warn)", fontSize: 13, fontWeight: 600, textDecoration: "none",
    }}>
      <ShieldAlert size={14} /> Audit Log
      {flagged > 0 && (
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
          background: "var(--danger)", color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1,
        }}>
          {flagged > 99 ? "99+" : flagged}
        </span>
      )}
    </Link>
  );
}
