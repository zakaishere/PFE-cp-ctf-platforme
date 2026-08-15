import type { NextConfig } from "next";
import path from "path";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {

  // Pin the Turbopack root to this project. Without this, Turbopack walks up
  // looking for a lockfile and finds an unrelated one higher up in ~/Downloads,
  // then treats that entire (huge, unrelated) directory tree as the workspace
  // root -- causing on-demand route compilation to stall or hang.
  turbopack: {
    root: path.join(__dirname),
  },

  // Proxy API calls through Next.js (eliminates CORS overhead for same-origin
  // relative requests). Note: the client currently builds absolute URLs to the
  // backend, so this rewrite is a no-op for existing calls — kept for future
  // relative-path usage and SSR.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  // Image optimization (if images are added later)
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
    ],
  },

  // Fail builds on type/lint errors
  typescript: { ignoreBuildErrors: false },

  // Output
  output: "standalone",   // smaller Docker image for the frontend
  poweredByHeader: false, // don't expose Next.js version

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-query",
    ],
  },
};

export default nextConfig;
