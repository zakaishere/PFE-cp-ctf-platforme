import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import "./admin.css";

/**
 * Dedicated admin shell for every /admin/* route. Deliberately does NOT render
 * the student <Navbar/> — the admin area has its own sidebar + command bar.
 * Route access is enforced by middleware.ts (frontend) and hasRole("ADMIN")
 * on /api/admin/** (backend).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
