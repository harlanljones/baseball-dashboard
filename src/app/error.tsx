"use client";

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
        MLB API unreachable
      </p>
      <p className="mt-1 text-sm text-red-700/80 dark:text-red-400/80">
        {error.message || "Something went wrong loading the scoreboard."}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}
