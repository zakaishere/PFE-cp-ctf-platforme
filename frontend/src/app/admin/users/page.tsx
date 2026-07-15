"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, SkeletonRows, EmptyState, ErrorState } from "@/features/admin/shell/states";
import { getAdminUsers, type AdminUsersPage, type AdminUser } from "@/lib/api";

const ROLES = ["", "STUDENT", "TEACHER", "ADMIN"] as const;

function roleTone(role: string) {
  if (role === "ADMIN") return "red";
  if (role === "TEACHER") return "ctf";
  return "muted";
}
function statusTone(status: string | null) {
  if (status === "ACTIVE") return "";        // green (default pill)
  if (status === "PENDING") return "amber";
  return "muted";
}

function UsersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const role = params.get("role") ?? "";
  const search = params.get("search") ?? "";
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10) || 0);

  const [data, setData] = useState<AdminUsersPage | null>(null);
  const [err, setErr] = useState(false);
  const [searchInput, setSearchInput] = useState(search);

  // Keep the input in sync if the URL changes externally (e.g. command palette).
  useEffect(() => { setSearchInput(search); }, [search]);

  const setParams = useCallback((next: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, String(v));
    }
    router.replace(`${pathname}?${sp.toString()}`);
  }, [params, pathname, router]);

  // Debounce the search box → URL.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setParams({ search: searchInput || null, page: 0 }), 400);
    return () => clearTimeout(t);
  }, [searchInput, search, setParams]);

  const load = useCallback(() => {
    setErr(false);
    setData(null);
    getAdminUsers({ role: role || undefined, search: search || undefined, page, size: 20 })
      .then(setData)
      .catch(() => setErr(true));
  }, [role, search, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="content">
      <PageHeading
        eyebrow="PLATFORM"
        title="Users & Roles"
        subtitle="Search and inspect platform accounts"
        right={<button className="btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>}
      />

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="grow" style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 10, color: "var(--secondary)", pointerEvents: "none" }}><Icon name="search" size={15} /></span>
          <input
            className="field grow"
            style={{ width: "100%", paddingLeft: 32 }}
            placeholder="Search name, email or username…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <div className="filter-tabs" role="tablist" aria-label="Filter by role">
          {ROLES.map((r) => (
            <button key={r || "ALL"} role="tab" aria-selected={role === r}
                    className={role === r ? "active" : ""}
                    onClick={() => setParams({ role: r || null, page: 0 })}>
              {r || "ALL"}
            </button>
          ))}
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Accounts{data ? ` (${data.totalElements.toLocaleString()})` : ""}</h2>
        </div>
        {err ? <ErrorState message="Couldn't load users. Admin permission is required." onRetry={load} />
          : data == null ? <SkeletonRows rows={6} />
          : data.content.length === 0 ? <EmptyState title="No matching users" message="Try a different search or role filter." />
          : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Role</th><th>Status</th><th>Verified</th><th>Joined</th></tr></thead>
                  <tbody>
                    {data.content.map((u: AdminUser) => (
                      <tr key={u.id}>
                        <td><strong>{u.firstName} {u.lastName}</strong></td>
                        <td>{u.email}</td>
                        <td className="mono">{u.username ?? "—"}</td>
                        <td><span className={`status-pill ${roleTone(u.role)}`}>{u.role}</span></td>
                        <td>{u.status ? <span className={`status-pill ${statusTone(u.status)}`}>{u.status}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                        <td>{u.emailVerified ? <span className="success-text"><Icon name="check" size={14} /></span> : <span style={{ color: "var(--muted)" }}>No</span>}</td>
                        <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                <span>Page {data.number + 1} of {Math.max(1, data.totalPages)} · {data.totalElements.toLocaleString()} users</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sm" disabled={page <= 0} onClick={() => setParams({ page: page - 1 })}>Previous</button>
                  <button className="btn-sm" disabled={data.number + 1 >= data.totalPages} onClick={() => setParams({ page: page + 1 })}>Next</button>
                </div>
              </div>
            </>
          )}
      </section>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="content"><SkeletonRows rows={6} /></div>}>
      <UsersInner />
    </Suspense>
  );
}
