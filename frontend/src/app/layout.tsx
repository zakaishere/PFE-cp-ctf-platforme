import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { ToastContainer } from "@/components/ui/PSPToast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { PageTransition } from "@/components/ui/PageTransition";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — University Problem Solving`,
  description: "Secure, real-time coding assessment platform for universities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            // Algora is a dark-only theme. Force data-theme="dark" so the whole
            // app renders the navy palette regardless of any stored preference.
            __html: `(function(){try{document.documentElement.setAttribute('data-theme','dark');localStorage.setItem('psp-theme','dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <ErrorBoundary context="RootLayout">
            <PageTransition>
              {children}
            </PageTransition>
          </ErrorBoundary>
        </Providers>
        <ToastContainer />
      </body>
    </html>
  );
}
