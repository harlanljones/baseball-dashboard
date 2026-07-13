"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 py-16 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="font-medium text-red-800 dark:text-red-300">
        Couldn’t load this game
      </p>
      <p className="mt-1 text-sm text-red-700/80 dark:text-red-400/80">
        {error.message || "The MLB API may be temporarily unavailable."}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
        <Link
          href="/"
          className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm dark:border-neutral-700"
        >
          All games
        </Link>
      </div>
    </div>
  );
}
