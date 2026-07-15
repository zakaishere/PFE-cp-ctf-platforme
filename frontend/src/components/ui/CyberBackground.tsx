"use client";

import { useEffect, useRef } from "react";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Falling-character matrix rain, very low opacity, purely decorative. */
export function MatrixCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;

    const CHARS = "01アイウエオ0xFFABCDEF{}[]<>/\\|=+-_#@!?";
    const FS = 13;
    let cols: number, drops: number[];

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth ?? window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight ?? window.innerHeight;
      cols = Math.floor(canvas.width / FS);
      drops = new Array(cols).fill(1);
    };

    const tick = () => {
      ctx.fillStyle = "rgba(3,7,8,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${FS}px "JetBrains Mono", monospace`;

      drops.forEach((y, i) => {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * FS;

        ctx.fillStyle = "rgba(0,255,102,0.85)";
        ctx.fillText(ch, x, y * FS);

        ctx.fillStyle = "rgba(0,200,150,0.25)";
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, (y - 1) * FS);

        if (y * FS > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });

      animId = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.07, pointerEvents: "none" }}
    />
  );
}

/** ~18 drifting nodes connected by proximity lines, CTF-flavored labels. */
export function HexNodes({ count = 18 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth ?? window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight ?? window.innerHeight;
    };
    resize();

    const randomLabel = () => {
      const r = Math.random();
      if (r > 0.66) return "0x" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
      if (r > 0.33) return "flag{?}";
      return Math.floor(Math.random() * 2 ** 8).toString(2).padStart(8, "0");
    };

    const nodes = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 3 + 2,
      label: randomLabel(),
    }));

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,200,150,${(1 - dist / 200) * 0.12})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,255,102,0.6)";
        ctx.shadowColor = "rgba(0,255,102,0.8)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = "rgba(0,200,150,0.35)";
        ctx.fillText(n.label, n.x + n.r + 4, n.y + 3);
      });

      animId = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [count]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}

/** Convenience wrapper bundling both effects behind content, absolutely positioned. */
export function CyberBackground({ hexCount }: { hexCount?: number }) {
  return (
    <>
      <MatrixCanvas />
      <HexNodes count={hexCount} />
    </>
  );
}
