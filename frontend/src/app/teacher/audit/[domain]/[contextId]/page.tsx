"use client";

import { useParams } from "next/navigation";
import AuditDashboard from "@/features/audit/AuditDashboard";
import type { AuditDomain } from "@/lib/api";

export default function TeacherAuditPage() {
  const { domain, contextId } = useParams<{ domain: string; contextId: string }>();
  return <AuditDashboard domain={domain.toUpperCase() as AuditDomain} contextId={contextId} />;
}
