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
        <p className="font-medium text-clay">Couldn’t load this game</p>
        <p className="mt-1 text-sm text-clay/80">
          {error.message || "The MLB API may be temporarily unavailable."}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-clay px-4 py-1.5 text-sm font-medium text-paper hover:opacity-90"
          >
            Retry
          </button>
          <Link
            href="/"
            className="rounded-md border border-ink/20 px-4 py-1.5 text-sm hover:bg-ink/5"
          >
            All games
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
