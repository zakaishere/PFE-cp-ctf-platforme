"use client";

import Link from "next/link";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, UnavailablePanel } from "@/features/admin/shell/states";

export default function AdminCompetitionsPage() {
  return (
    <div className="content">
      <PageHeading eyebrow="PLATFORM" title="Competitions" subtitle="Competition lifecycle & oversight" />
      <div className="stack">
        <section className="panel">
          <div className="panel-header"><h2>Manage competitions</h2></div>
          <div style={{ padding: 18 }}>
            <p style={{ margin: "0 0 14px", color: "var(--secondary)", fontSize: 13, lineHeight: 1.6 }}>
              Create, edit, publish, start/end and configure competitions through the existing
              competition tools (reused by admins).
            </p>
            <Link className="primary-button" href="/teacher/competitions"><Icon name="trophy" /> Open competition management</Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header"><h2>Live operations table</h2></div>
          <UnavailablePanel feature="Aggregated live competitions table" note="A combined operational view (participants, submission counts, judge load per competition) is not aggregated by the backend yet." />
        </section>
      </div>
    </div>
  );
}
