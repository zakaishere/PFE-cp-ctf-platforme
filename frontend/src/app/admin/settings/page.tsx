"use client";

import Link from "next/link";
import { Icon } from "@/features/admin/shell/icons";
import { PageHeading, UnavailablePanel } from "@/features/admin/shell/states";

export default function AdminSettingsPage() {
  return (
    <div className="content">
      <PageHeading eyebrow="GOVERNANCE" title="Settings" subtitle="Platform configuration" />
      <div className="stack">
        <section className="panel">
          <div className="panel-header"><h2>CTF resource configuration</h2></div>
          <div style={{ padding: 18 }}>
            <p style={{ margin: "0 0 14px", color: "var(--secondary)", fontSize: 13, lineHeight: 1.6 }}>
              Container limits, instance duration and cleanup interval are managed as a structured
              workflow inside CTF Operations.
            </p>
            <Link className="primary-button" href="/admin/ctf"><Icon name="settings" /> Open CTF Operations</Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header"><h2>Other platform settings</h2></div>
          <UnavailablePanel feature="General settings store" note="There is no categorized settings backend beyond CTF resource config yet." />
        </section>
      </div>
    </div>
  );
}
