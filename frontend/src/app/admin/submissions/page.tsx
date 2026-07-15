"use client";

import { PageHeading, UnavailablePanel } from "@/features/admin/shell/states";

export default function AdminSubmissionsPage() {
  return (
    <div className="content">
      <PageHeading eyebrow="OPERATIONS" title="Submissions" subtitle="Judge submissions & verdicts" />
      <section className="panel">
        <div className="panel-header"><h2>Submissions</h2></div>
        <UnavailablePanel
          feature="Admin submissions list"
          note="A cross-platform submissions list with verdict/status filters and rejudge is not implemented in this pass. CTF flag submissions are available under CTF Operations. Code-judge queue depth is on the Infrastructure screen."
        />
      </section>
    </div>
  );
}
