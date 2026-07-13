import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baseball Dashboard",
  description: "Today's MLB scores, matchups, and sabermetric player evaluations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="text-lg">
                ⚾
              </span>
              <span>Baseball Dashboard</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-neutral-200 py-4 text-center text-xs text-neutral-500 dark:border-neutral-800">
          Data: MLB Stats API · not affiliated with MLB
        </footer>
      </body>
    </html>
  );
}
