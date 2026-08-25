"use client";

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
          Scoreboard unavailable
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-clay-deep">
          The MLB API didn’t respond, so today’s slate couldn’t load. This usually passes within a few minutes.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-clay-deep">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 cursor-pointer rounded-md bg-clay-deep px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </PageContainer>
  );
}
