import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Barlow_Condensed({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Baseball Dashboard",
    template: "%s · Baseball Dashboard",
  },
  description: "Today's MLB scores, matchups, and sabermetric player evaluations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-10 h-header bg-field text-white">
          <div className="mx-auto flex h-full max-w-5xl items-center px-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 focus-visible:outline-gold"
            >
              <span aria-hidden className="h-4.5 w-1.5 bg-gold" />
              <span className="font-display text-xl font-semibold uppercase tracking-wide">
                Baseball Dashboard
              </span>
            </Link>
          </div>
        </header>
        <main id="main" className="flex min-h-0 w-full flex-1 flex-col">
          {children}
        </main>
        <footer className="flex h-footer shrink-0 items-center justify-center border-t border-ink/10 px-4 text-center text-xs leading-4 text-ink/50">
          MLB data · Weather by&nbsp;
          <a
            href="https://open-meteo.com/"
            className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-ink"
          >
            Open-Meteo
          </a>
          &nbsp;· Unaffiliated with MLB
        </footer>
      </body>
    </html>
  );
}
