"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  ClipboardList, CheckCircle2, Clock, Code2, Trophy, AlertTriangle,
} from "lucide-react";

const leaderboard = [
  { rank: 1, initials: "AB", color: "#0052cc", name: "Ali Benali",       pts: 340, medal: "🥇" },
  { rank: 2, initials: "YM", color: "#6554c0", name: "Youssef Mansouri", pts: 290, medal: "🥈" },
  { rank: 3, initials: "FZ", color: "#00875a", name: "Fatima Zahra",     pts: 250, medal: "🥉" },
  { rank: 4, initials: "KE", color: "#ff5630", name: "Karim El Amrani",  pts: 210 },
  { rank: 5, initials: "NA", color: "#ff8b00", name: "Nadia Alaoui",     pts: 190 },
  { rank: 6, initials: "OB", color: "#36b37e", name: "Omar Berrada",     pts: 160 },
  { rank: 7, initials: "RA", color: "#00b8d9", name: "Rachid Amrani",    pts: 130 },
];

const activity = [
  { color: "#00875a", text: <><strong>Ali Benali</strong> solved <strong>Two Sum</strong> — ACCEPTED</>,           time: "2 minutes ago" },
  { color: "#0052cc", text: <><strong>12 students</strong> requested to join <strong>Spring Competition</strong></>, time: "8 minutes ago" },
  { color: "#ff8b00", text: <><strong>Youssef M.</strong> — BST Validation WRONG ANSWER</>,                        time: "14 minutes ago" },
  { color: "#00875a", text: <><strong>Fatima Z.</strong> solved <strong>Palindrome</strong> — ACCEPTED</>,         time: "21 minutes ago" },
  { color: "#0052cc", text: <><strong>3 students</strong> requested to join <strong>Midterm S5</strong></>,         time: "35 minutes ago" },
  { color: "#de350b", text: <><strong>Karim E.</strong> — Graph Shortest Path TIMEOUT</>,                          time: "1 hour ago" },
  { color: "#00875a", text: <><strong>Nadia A.</strong> solved <strong>Two Sum</strong> — ACCEPTED</>,              time: "1 hour ago" },
];

const joinRequests = [
  { initials: "AB", color: "#0052cc", name: "Ali Benali",       sub: "GINF S5 · Midterm — Algorithms S5 · \"I'm in section B\"" },
  { initials: "YM", color: "#6554c0", name: "Youssef Mansouri", sub: "GINF S5 · Spring Competition 2026" },
  { initials: "FZ", color: "#00875a", name: "Fatima Zahra",     sub: "GI S3 · Spring Competition 2026 · \"Team AlgoBeasts\"" },
  { initials: "KE", color: "#ff5630", name: "Karim El Amrani",  sub: "GINF S5 · Midterm — Algorithms S5" },
];

export default function TeacherOverview() {
  return (
    <>
      <Navbar />
      <div className="psp-breadcrumb">
        <Link href="/teacher">PSP</Link> › <span style={{ color: "var(--text-primary)" }}>Dashboard</span>
      </div>
      <div className="psp-main">

        {/* Alert */}
        <div className="psp-alert psp-alert-warn">
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span><strong>15 pending join requests</strong> across your assessments —{" "}
            <Link href="/teacher/join-requests" style={{ color: "#0052cc", cursor: "pointer", fontWeight: 600 }}>Review now</Link>
          </span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Teacher Dashboard</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Sara Idrissi · Algorithms Department · Wednesday, April 23 2026</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="psp-btn psp-btn-secondary"><Code2 size={13} /> New Problem</button>
            <button className="psp-btn psp-btn-primary"><ClipboardList size={13} /> Create Assessment</button>
          </div>
        </div>

        {/* Stats */}
        <div className="psp-stats">
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-blue"><ClipboardList size={20} /></div>
            <div><div className="psp-stat-val">4</div><div className="psp-stat-lbl">Active Assessments</div></div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-green"><CheckCircle2 size={20} /></div>
            <div><div className="psp-stat-val">127</div><div className="psp-stat-lbl">Submissions Today</div></div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-orange"><Clock size={20} /></div>
            <div><div className="psp-stat-val">15</div><div className="psp-stat-lbl">Pending Requests</div></div>
          </div>
          <div className="psp-stat-card">
            <div className="psp-stat-icon ic-purple"><Code2 size={20} /></div>
            <div><div className="psp-stat-val">23</div><div className="psp-stat-lbl">Problems Created</div></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="psp-tabs">
          <div className="psp-tab active">Assessments</div>
          <div className="psp-tab">Competitions</div>
          <div className="psp-tab">Submissions</div>
          <div className="psp-tab">
            Join Requests{" "}
            <span style={{ background: "#de350b", color: "white", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, marginLeft: 5 }}>15</span>
          </div>
        </div>

        {/* Two-col */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          {/* Left */}
          <div>
            {/* Assessments Table */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Your Assessments</span>
                <input className="psp-search" placeholder="Search…" />
              </div>
              <div className="psp-filter-bar">
                <button className="psp-ftab on">All</button>
                <button className="psp-ftab">Live Exams</button>
                <button className="psp-ftab">Open TPs</button>
                <button className="psp-ftab">Competitions</button>
                <button className="psp-ftab">Closed</button>
              </div>
              <table className="psp-table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Module</th><th>Visibility</th><th>Date</th><th>Status</th><th>Requests</th><th></th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="td-link">Midterm — Algorithms S5</td>
                    <td><span className="psp-badge b-live">Live Exam</span></td>
                    <td className="td-muted">Algorithms</td>
                    <td><span className="psp-status"><span className="psp-dot d-blue" />Request Based</span></td>
                    <td className="td-muted">May 1 · 09:00</td>
                    <td><span className="psp-status"><span className="psp-dot d-orange" />Upcoming</span></td>
                    <td><a style={{ color: "#0052cc", fontWeight: 600, fontSize: 12 }}>3 pending</a></td>
                    <td><button className="psp-btn psp-btn-primary psp-btn-sm">Review</button></td>
                  </tr>
                  <tr>
                    <td className="td-link">TP2 — Sorting Algorithms</td>
                    <td><span className="psp-badge b-tp">Open TP</span></td>
                    <td className="td-muted">Data Structures</td>
                    <td><span className="psp-status"><span className="psp-dot d-green" />Module Only</span></td>
                    <td className="td-muted">Jun 1 · 23:59</td>
                    <td><span className="psp-status"><span className="psp-dot d-green" />Open</span></td>
                    <td className="td-muted">—</td>
                    <td><button className="psp-btn psp-btn-secondary psp-btn-sm">View</button></td>
                  </tr>
                  <tr>
                    <td className="td-link">Spring Competition 2026</td>
                    <td><span className="psp-badge b-comp">Competition</span></td>
                    <td className="td-muted">Open</td>
                    <td><span className="psp-status"><span className="psp-dot d-blue" />Request Based</span></td>
                    <td className="td-muted">Apr 28 · 10:00</td>
                    <td><span className="psp-status"><span className="psp-dot d-orange" />Registration</span></td>
                    <td><a style={{ color: "#0052cc", fontWeight: 600, fontSize: 12 }}>12 pending</a></td>
                    <td><button className="psp-btn psp-btn-primary psp-btn-sm">Review</button></td>
                  </tr>
                  <tr>
                    <td className="td-link">Quiz 1 — Complexity</td>
                    <td><span className="psp-badge b-live">Live Exam</span></td>
                    <td className="td-muted">Algorithms</td>
                    <td><span className="psp-status"><span className="psp-dot d-gray" />Access Code</span></td>
                    <td className="td-muted">Apr 10 · 14:00</td>
                    <td><span className="psp-status"><span className="psp-dot d-gray" />Closed</span></td>
                    <td className="td-muted">—</td>
                    <td><button className="psp-btn psp-btn-secondary psp-btn-sm">Results</button></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Join Requests */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Pending Join Requests</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="psp-btn psp-btn-success psp-btn-sm">Approve All</button>
                  <button className="psp-btn psp-btn-secondary psp-btn-sm">By Division</button>
                </div>
              </div>
              <div className="psp-scroll">
                {joinRequests.map((r, i) => (
                  <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid #f4f5f7", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>{r.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.sub}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button style={{ background: "var(--green-light)", color: "#006644", border: "none", padding: "3px 10px", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Approve</button>
                      <button style={{ background: "var(--red-light)", color: "#bf2600", border: "none", padding: "3px 10px", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Problems Table */}
            <div className="psp-card">
              <div className="psp-card-header">
                <span className="psp-card-title">Problems</span>
                <button className="psp-btn psp-btn-secondary psp-btn-sm">+ New Problem</button>
              </div>
              <table className="psp-table">
                <thead>
                  <tr><th>Title</th><th>Difficulty</th><th>Test Cases</th><th>Visibility</th><th>Submissions</th><th>Pass Rate</th></tr>
                </thead>
                <tbody>
                  {[
                    { title: "Two Sum",                    diff: "easy",  tc: 10, vis: "pub",  subs: 342, rate: 78, barColor: "#0052cc" },
                    { title: "Binary Search Tree Validation", diff: "med", tc: 15, vis: "pub",  subs: 178, rate: 52, barColor: "#ff8b00" },
                    { title: "Graph Shortest Path",         diff: "hard", tc: 20, vis: "priv", subs: 43,  rate: 28, barColor: "#de350b" },
                    { title: "Palindrome Check",            diff: "easy", tc: 15, vis: "pub",  subs: 289, rate: 85, barColor: "#0052cc" },
                  ].map((p, i) => (
                    <tr key={i}>
                      <td className="td-link">{p.title}</td>
                      <td><span className={`psp-badge b-${p.diff}`}>{p.diff}</span></td>
                      <td className="td-muted">{p.tc}</td>
                      <td><span className={`psp-badge b-${p.vis}`}>{p.vis === "pub" ? "Public" : "Private"}</span></td>
                      <td className="td-muted">{p.subs}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div className="psp-prog-wrap" style={{ width: 70 }}>
                            <div className="psp-prog-fill" style={{ width: `${p.rate}%`, background: p.barColor }} />
                          </div>
                          <span className="td-muted">{p.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right */}
          <div>
            {/* Leaderboard */}
            <div className="psp-card" style={{ marginBottom: 14 }}>
              <div className="psp-card-header">
                <span className="psp-card-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Trophy size={13} color="#ff8b00" /> Leaderboard
                </span>
                <Link href="/leaderboard" style={{ fontSize: 11, color: "#0052cc" }}>View All</Link>
              </div>
              <div className="psp-scroll">
                {leaderboard.map((u) => (
                  <div key={u.rank} style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid #f4f5f7", gap: 10 }}>
                    <div style={{ width: 22, textAlign: "center", fontWeight: 700, fontSize: 12 }}>
                      {u.medal ? <span>{u.medal}</span> : <span style={{ color: "var(--text-muted)" }}>{u.rank}</span>}
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>{u.initials}</div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontWeight: 700, color: "#0052cc", fontSize: 12 }}>{u.pts} pts</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="psp-card">
              <div className="psp-card-header"><span className="psp-card-title">Recent Activity</span></div>
              <div className="psp-scroll">
                {activity.map((a, i) => (
                  <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #f4f5f7", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-primary)" }}>{a.text}</div>
                      <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
