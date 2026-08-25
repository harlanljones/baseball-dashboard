import type { Metadata } from "next";
import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "Plain-language definitions for every sabermetric stat, bullpen workload signal, and prop-scoring term used across the Baseball Dashboard.",
  alternates: { canonical: "https://mlb.harlanljones.com/glossary" },
};

export default function GlossaryPage() {
  return (
    <PageContainer>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">
          Glossary
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink/65">
          Every specialized number on this dashboard, in plain language. Stats
          are research context — nothing here predicts outcomes.
        </p>
      </div>

      <div className="space-y-4">
        {GLOSSARY.map((group) => (
          <section
            key={group.title}
            className="rounded-md border border-ink/10 bg-card p-4 shadow-sm"
          >
            <h2 className="eyebrow text-lg">{group.title}</h2>
            <p className="mt-1 max-w-xl text-sm text-ink/65">{group.intro}</p>
            <dl className="mt-3 divide-y divide-ink/10 border-t border-ink/10">
              {group.terms.map(({ term, definition }) => (
                <div
                  key={term}
                  className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <dt className="nums font-mono text-sm font-semibold text-field-deep dark:text-grass">
                    {term}
                  </dt>
                  <dd className="max-w-prose text-sm leading-snug text-ink/75">{definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-5 max-w-xl text-xs text-ink/65">
        Grades compare players within this site&apos;s thresholds, not official
        awards. See the{" "}
        <Link href="/" className="text-grass underline underline-offset-2 hover:text-field-deep dark:hover:text-grass">
          today&apos;s slate
        </Link>{" "}
        to put the numbers to work.
      </p>
    </PageContainer>
  );
}
