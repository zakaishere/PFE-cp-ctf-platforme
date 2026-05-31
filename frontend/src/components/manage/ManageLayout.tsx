"use client";

import Navbar from "@/components/Navbar";
import ManageSidebar, { type SidebarNavGroup } from "./ManageSidebar";

interface ManageLayoutProps {
  title:       string;
  status:      string;
  navGroups:   SidebarNavGroup[];
  activeTab:   string;
  onTabChange: (tab: string) => void;
  backHref:    string;
  backLabel:   string;
  actions?:    React.ReactNode;
  footer?:     React.ReactNode;
  loading?:    boolean;
  children:    React.ReactNode;
}

export default function ManageLayout({
  title, status, navGroups, activeTab, onTabChange,
  backHref, backLabel, actions, footer, loading,
  children,
}: ManageLayoutProps) {
  return (
    <>
      <Navbar />
      <div style={{
        display: "flex",
        marginTop: 52,
        height: "calc(100vh - 52px)",
        overflow: "hidden",
      }}>
        <ManageSidebar
          title={title}
          status={status}
          navGroups={navGroups}
          activeTab={activeTab}
          onTabChange={onTabChange}
          backHref={backHref}
          backLabel={backLabel}
          actions={actions}
          footer={footer}
          loading={loading}
        />
        <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {children}
        </main>
      </div>
    </>
  );
}
