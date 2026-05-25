import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { ToastContainer } from "@/components/ui/PSPToast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { PageTransition } from "@/components/ui/PageTransition";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSP Platform — University Problem Solving",
  description: "Secure, real-time coding assessment platform for universities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('psp-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
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
