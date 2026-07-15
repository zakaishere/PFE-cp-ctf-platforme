"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Icon } from "./icons";

/** Layout-preserving skeleton rows for a loading panel. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden style={{ padding: "8px 0" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" style={{ width: `${90 - (i % 3) * 12}%` }} />
      ))}
    </div>
  );
}

/** "No data yet" — the endpoint works, there is simply nothing to show. */
export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="state-block empty" role="status">
      <span className="state-ico"><Icon name="check" size={22} /></span>
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

/**
 * "Not yet implemented" — there is no backend for this panel. Distinct from
 * EmptyState so we never present a missing capability as merely empty.
 */
export function UnavailablePanel({ feature, note }: { feature: string; note?: string }) {
  return (
    <div className="state-block unavailable" role="status">
      <span className="state-ico"><Icon name="warning" size={22} /></span>
      <strong>{feature}</strong>
      <p>{note ?? "Not yet implemented — no backend data source for this panel. Displaying real data is deferred to a later pass."}</p>
    </div>
  );
}

/** Failed request — offers a retry. Never rendered as "healthy". */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state-block error" role="alert">
      <span className="state-ico"><Icon name="warning" size={22} /></span>
      <strong>Couldn&apos;t load this data</strong>
      <p>{message ?? "The request failed. This may be a permissions or connectivity issue."}</p>
      {onRetry && <button className="retry-btn" onClick={onRetry}><Icon name="refresh" size={13} /> Retry</button>}
    </div>
  );
}

/**
 * Confirmation dialog for privileged/destructive actions. Optional typed
 * confirmation (`confirmWord`) for the highest-risk actions. Esc closes and
 * focus is restored by the caller's trigger.
 */
export function ConfirmDialog({
  open, title, children, confirmLabel = "Confirm", danger, busy,
  confirmWord, typed, onTyped, onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmWord?: string;
  typed?: string;
  onTyped?: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const needsTyped = !!confirmWord;
  const typedOk = !needsTyped || (typed ?? "").trim().toUpperCase() === confirmWord!.toUpperCase();

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel} style={{ paddingTop: "22vh" }}>
      <div className="confirm-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <span className={danger ? "red-text" : ""}><Icon name={danger ? "warning" : "check"} size={18} /></span>
          {title}
        </header>
        <div className="confirm-body">
          {children}
          {needsTyped && (
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
                Type <strong>{confirmWord}</strong> to confirm
              </label>
              <input className="field grow" style={{ width: "100%" }} value={typed ?? ""}
                     autoFocus onChange={(e) => onTyped?.(e.target.value)} aria-label="Typed confirmation" />
            </div>
          )}
        </div>
        <footer>
          <button className="btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`btn-sm ${danger ? "danger" : "green"}`} onClick={onConfirm} disabled={busy || !typedOk}>
            {busy ? <Icon name="refresh" size={13} /> : null} {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Standard page heading used by every management screen. */
export function PageHeading({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
