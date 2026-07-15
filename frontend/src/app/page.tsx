import Link from "next/link";
import { CyberBackground } from "@/components/ui/CyberBackground";

export default function LandingPage() {
  return (
    <div
      style={{
        background: "#030708",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes pulse-glow {
          0%   { transform: scale(1) translate(0,0); opacity: .6; }
          100% { transform: scale(1.2) translate(-50px,50px); opacity: .9; }
        }
        @keyframes feed-line { to { opacity: 1; transform: translateX(0); } }
        @keyframes blink { 50% { opacity: 0; } }

        .landing-cyber-btn {
          font-family: 'Fira Code', 'JetBrains Mono', monospace;
          padding: 0.6rem 1.4rem;
          border-radius: 4px;
          font-size: 0.9rem;
          font-weight: 500;
          text-decoration: none;
          transition: all .3s ease;
          background: transparent;
          color: #00ff66;
          border: 1px solid #00ff66;
          box-shadow: 0 0 10px rgba(0,255,102,.25), inset 0 0 5px rgba(0,255,102,.25);
        }
        .landing-cyber-btn:hover {
          background: #00ff66; color: #030708;
          box-shadow: 0 0 20px #00ff66, inset 0 0 0 transparent;
          transform: translateY(-2px);
        }
        .landing-cyber-btn.solid {
          background: #00ff66; color: #030708; font-weight: 700;
          box-shadow: 0 0 15px #00ff66;
        }
        .landing-cyber-btn.solid:hover { box-shadow: 0 0 25px #00ff66; background: #00cc52; }
        .landing-cyber-btn.secondary {
          border-color: #00f0ff; color: #00f0ff;
          box-shadow: 0 0 10px rgba(0,240,255,.2), inset 0 0 5px rgba(0,240,255,.1);
        }
        .landing-cyber-btn.secondary:hover {
          background: #00f0ff; color: #030708; box-shadow: 0 0 20px #00f0ff;
        }
        .landing-nav-link {
          color: #64748b; text-decoration: none; font-size: .9rem;
          font-family: 'Fira Code', 'JetBrains Mono', monospace;
          transition: color .3s;
        }
        .landing-nav-link:hover { color: #00ff66; text-shadow: 0 0 8px rgba(0,255,102,.25); }

        .landing-terminal-line {
          font-size: .9rem; line-height: 1.6; margin-bottom: .5rem;
          opacity: 0; transform: translateX(-10px);
          animation: feed-line .4s forwards;
        }
        .ln-1 { animation-delay: .5s; }
        .ln-2 { animation-delay: 1.5s; color: #64748b; }
        .ln-3 { animation-delay: 2.5s; }
        .ln-4 { animation-delay: 3.5s; color: #00ff66; font-weight: bold; text-shadow: 0 0 10px rgba(0,255,102,.25); }

        .landing-cursor {
          display: inline-block; width: 8px; height: 15px;
          background: #00ff66; box-shadow: 0 0 8px #00ff66;
          animation: blink .8s infinite; vertical-align: middle;
        }

        @media (max-width: 1024px) {
          .landing-main { grid-template-columns: 1fr !important; padding: 4rem 2rem !important; text-align: center; gap: 4rem !important; }
          .landing-header { padding: 1.5rem 2rem !important; }
          .landing-hero-left p { margin: 0 auto 2.5rem !important; }
          .landing-btn-group { justify-content: center; }
          .landing-bottom-bar { padding: 1rem 2rem !important; flex-direction: column !important; gap: .5rem !important; text-align: center; }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-terminal-line, .landing-cursor, .glow-sphere { animation: none !important; }
        }
      `}</style>

      {/* Ambient cyber grid */}
      <div
        style={{
          position: "absolute", inset: 0,
          background:
            "linear-gradient(rgba(0,255,102,.02) 1px, transparent 1px) 0 0 / 40px 40px, " +
            "linear-gradient(90deg, rgba(0,255,102,.02) 1px, transparent 1px) 0 0 / 40px 40px",
          zIndex: 1, pointerEvents: "none",
        }}
      />

      {/* Glow sphere */}
      <div
        className="glow-sphere"
        style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,255,102,.25) 0%, transparent 70%)",
          filter: "blur(60px)", top: -200, right: -100, zIndex: 0,
          animation: "pulse-glow 10s infinite alternate ease-in-out",
        }}
      />

      {/* Matrix rain + hex nodes, full page */}
      <CyberBackground />

      <header
        className="landing-header"
        style={{
          position: "relative", zIndex: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.5rem 4rem",
          borderBottom: "1px solid #14282f",
          background: "rgba(3,7,8,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontFamily: "'Fira Code', monospace", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.5px" }}>
          <img
            src="/algora-logo-icon.png"
            alt="Algora"
            width={32}
            height={32}
            style={{ objectFit: "contain", mixBlendMode: "screen" }}
          />
          algora_
        </div>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href="/auth" className="landing-nav-link">// bypass_auth</Link>
          <Link href="/auth" className="landing-cyber-btn">Initialize App</Link>
        </div>
      </header>

      <main
        className="landing-main"
        style={{
          position: "relative", zIndex: 5, flex: 1,
          display: "grid", gridTemplateColumns: "1.1fr 0.9fr", alignItems: "center",
          padding: "0 4rem", maxWidth: 1400, margin: "0 auto", gap: "5rem", width: "100%",
        }}
      >
        <div className="landing-hero-left">
          <h1 style={{ fontSize: "3.8rem", lineHeight: 1.1, fontWeight: 800, marginBottom: "1.5rem", letterSpacing: "-1.5px", color: "#f8fafc" }}>
            Where Academic <br />Code is{" "}
            <span style={{ color: "#00ff66", textShadow: "0 0 15px #00ff66" }}>Executed.</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "2.5rem", maxWidth: 520 }}>
            Deploy secure, containerized real-time sandbox challenges. Zero infrastructure footprint.
            Infinite cheat protection built natively into the compiler environment layer.
          </p>
          <div className="landing-btn-group" style={{ display: "flex", gap: "1.5rem" }}>
            <Link href="/auth" className="landing-cyber-btn solid">as_student()</Link>
            <Link href="/auth" className="landing-cyber-btn secondary">as_instructor()</Link>
          </div>
        </div>

        <div
          style={{
            background: "#080f11", border: "1px solid #14282f", borderRadius: 8,
            padding: "1.5rem", fontFamily: "'Fira Code', monospace",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,.7), 0 0 30px rgba(0,255,102,.05)",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* CRT scanline overlay */}
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "100%", zIndex: 2, pointerEvents: "none",
              background:
                "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,.25) 50%), " +
                "linear-gradient(90deg, rgba(255,0,0,.06), rgba(0,255,0,.02), rgba(0,0,255,.06))",
              backgroundSize: "100% 2px, 3px 100%",
            }}
          />

          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "1.5rem", paddingBottom: "0.75rem", borderBottom: "1px dashed #14282f",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#00ff66", boxShadow: "0 0 8px #00ff66", display: "inline-block" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#14282f", display: "inline-block" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#14282f", display: "inline-block" }} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "#00f0ff", border: "1px solid #00f0ff", padding: "2px 8px", borderRadius: 4, textShadow: "0 0 5px rgba(0,240,255,.2)" }}>
              ISOLATED_DOCKER_ENV
            </div>
          </div>

          <div>
            <div className="landing-terminal-line ln-1"><span style={{ color: "#00f0ff", marginRight: "0.5rem" }}>#</span>algora --spin-up sandbox_3902.py</div>
            <div className="landing-terminal-line ln-2"><span style={{ color: "#00f0ff", marginRight: "0.5rem" }}>&gt;</span> [INFO] Mount filesystem: isolation level 4 achieved...</div>
            <div className="landing-terminal-line ln-3"><span style={{ color: "#00f0ff", marginRight: "0.5rem" }}>&gt;</span> [RUN] Evaluating 100 test matrices dynamically...</div>
            <div className="landing-terminal-line ln-4">
              <span style={{ color: "#00f0ff", marginRight: "0.5rem" }}>#</span> STATUS: 200 OK // ALL TESTS PASSED [0.18s] <span className="landing-cursor" />
            </div>
          </div>
        </div>
      </main>

      <div
        className="landing-bottom-bar"
        style={{
          position: "relative", zIndex: 10,
          borderTop: "1px solid #14282f", padding: "1rem 4rem",
          display: "flex", justifyContent: "space-between",
          background: "#030708", fontFamily: "'Fira Code', monospace",
          fontSize: "0.8rem", color: "#64748b",
        }}
      >
        <div>SYS_STATUS: <span style={{ color: "#00ff66" }}>ACTIVE</span></div>
        <div>SANDBOX_RUNTIME: <span style={{ color: "#00ff66" }}>&lt; 0.2s Avg</span></div>
        <div>ENCRYPTION: <span style={{ color: "#00ff66" }}>AES_256_GCM</span></div>
      </div>
    </div>
  );
}
