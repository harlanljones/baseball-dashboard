"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-md border border-clay/40 bg-clay/10 py-16 text-center">
      <p className="font-medium text-clay">MLB API unreachable</p>
      <p className="mt-1 text-sm text-clay/80">
        {error.message || "Something went wrong loading the scoreboard."}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-clay px-4 py-1.5 text-sm font-medium text-paper hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );
}
