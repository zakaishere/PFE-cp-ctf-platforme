"use client";

import Link from "next/link";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, UnavailablePanel } from "@/features/admin/shell/states";

export default function AdminProblemsPage() {
  return (
    <div className="content">
      <PageHeading eyebrow="PLATFORM" title="Problems" subtitle="Problem bank management" />
      <div className="stack">
        <section className="panel">
          <div className="panel-header"><h2>Manage problems</h2></div>
          <div style={{ padding: 18 }}>
            <p style={{ margin: "0 0 14px", color: "var(--secondary)", fontSize: 13, lineHeight: 1.6 }}>
              Problem creation, editing and judge-data management run through the existing
              teacher/admin problem tools. A dedicated admin problems table (drafts, review status,
              publish/unpublish, bulk actions) is not part of this pass.
            </p>
            <Link className="primary-button" href="/teacher/problems"><Icon name="code" /> Open problem management</Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header"><h2>Draft review & bulk actions</h2></div>
          <UnavailablePanel feature="Admin problem review workflow" note="Draft/review status, visibility toggles and bulk operations have no dedicated backend yet." />
        </section>
      </div>
    </div>
  );
}
