"use client";

import Link from "next/link";
import PageContainer from "@/components/PageContainer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <div className="rounded-md border border-clay/40 bg-clay/10 py-16 text-center">
        <p className="font-display text-lg font-semibold uppercase tracking-wide text-clay-deep">
          Couldn’t load this game
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-clay-deep">
          The game feed didn’t respond. You can retry, or head back to today’s slate.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-clay-deep">Ref: {error.digest}</p>
        )}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="cursor-pointer rounded-md bg-clay-deep px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
          >
            All games
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
