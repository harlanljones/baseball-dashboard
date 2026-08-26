import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Weights are the ones the UI actually sets. Barlow never renders at 500 and
// Plex Mono never at 500, so loading them would ship two files nothing asks for.
const display = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mlb.harlanljones.com"),
  title: {
    default: "MLB Baseball Dashboard — Live Sabermetric Scores & Matchups | Harlan Jones",
    template: "%s · Baseball Dashboard",
  },
  description: "Today's MLB scores, sabermetric matchups, ballpark weather, bullpen workload, and player evaluations by Harlan Jones.",
  keywords: [
    "MLB",
    "baseball analytics",
    "sabermetrics",
    "baseball dashboard",
    "MLB scores",
    "bullpen workload",
    "ballpark weather",
    "player props",
    "Harlan Jones",
  ],
  authors: [{ name: "Harlan Jones", url: "https://www.harlanljones.com/" }],
  creator: "Harlan Jones",
  publisher: "Harlan Jones",
  alternates: {
    canonical: "https://mlb.harlanljones.com/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://mlb.harlanljones.com/",
    siteName: "MLB Baseball Dashboard by Harlan Jones",
    title: "MLB Baseball Dashboard — Live Sabermetric Scores & Matchups",
    description: "Today's MLB scores, sabermetric matchups, ballpark weather, bullpen workload, and player evaluations.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "MLB Baseball Dashboard — Live Sabermetric Scores & Matchups",
    description: "Today's MLB scores, sabermetric matchups, ballpark weather, and player evaluations.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://mlb.harlanljones.com/#website",
      name: "MLB Baseball Dashboard",
      url: "https://mlb.harlanljones.com/",
      description: "Today's MLB scores, sabermetric matchups, ballpark weather, bullpen workload, and player evaluations.",
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        "@id": "https://www.harlanljones.com/#website",
        "name": "Harlan Jones Portfolio",
        "url": "https://www.harlanljones.com/",
      },
      publisher: {
        "@id": "https://www.harlanljones.com/#person",
      },
      author: {
        "@id": "https://www.harlanljones.com/#person",
      },
    },
    {
      "@type": "WebApplication",
      "@id": "https://mlb.harlanljones.com/#app",
      name: "MLB Baseball Dashboard",
      alternateName: "Sabermetric Baseball Matchup Dashboard",
      url: "https://mlb.harlanljones.com/",
      description: "Live MLB scoreboard and game-day research dashboard with sabermetric matchup statistics, ballpark weather, bullpen workload, and player props.",
      applicationCategory: "SportsApplication",
      operatingSystem: "All modern browsers",
      codeRepository: "https://github.com/harlanljones/baseball-dashboard",
      author: {
        "@id": "https://www.harlanljones.com/#person",
      },
      creator: {
        "@id": "https://www.harlanljones.com/#person",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "Person",
      "@id": "https://www.harlanljones.com/#person",
      name: "Harlan Jones",
      alternateName: "Harlan L. Jones",
      givenName: "Harlan",
      familyName: "Jones",
      jobTitle: "Software Developer",
      url: "https://www.harlanljones.com/",
      sameAs: [
        "https://github.com/harlanljones",
        "https://www.linkedin.com/in/harlanljones/"
      ],
      worksFor: {
        "@type": "Organization",
        name: "PrimeIQ.ai",
        url: "https://primeiq.ai",
      },
      alumniOf: {
        "@type": "EducationalOrganization",
        name: "Boston University",
        url: "https://www.bu.edu",
      },
    },
  ],
};

const directionContract = `<!--
THESIS: A one-game matchup board makes weighted prop comparison the primary task and refuses the old sidebar.
OWN-WORLD: Night-game field green, gold score ticks, IBM Plex data, Barlow condensed headings, flat ruled panels.
STORY: The visitor tunes three transparent inputs, compares both teams, and opens evidence before acting on a lean.
FIRST VIEWPORT: Game identity and the shared 40/35/25 weight console lead into mirrored away/home prop columns with strongest scores at the seam.
FORM: Matchup Board, surface seed 32a17f12.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

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
      <head>
        {/* Every team logo and headshot comes from these two hosts, and the
            first of them is requested only once the slate HTML has parsed. */}
        <link rel="preconnect" href="https://www.mlbstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://midfield.mlbstatic.com" crossOrigin="" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <template
          data-direction-contract="matchup-board"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
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
        <footer className="flex h-footer shrink-0 items-center justify-center border-t border-ink/10 px-4 text-center text-xs leading-4 text-ink/65">
          <span>
            MLB data · Weather by&nbsp;
            <a
              href="https://open-meteo.com/"
              className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-ink"
            >
              Open-Meteo
            </a>
            &nbsp;·&nbsp;
            <Link
              href="/glossary"
              className="underline decoration-ink/25 underline-offset-2 transition-colors hover:text-ink"
            >
              Glossary
            </Link>
            &nbsp;· Unaffiliated with MLB
          </span>
        </footer>
      </body>
    </html>
  );
}
