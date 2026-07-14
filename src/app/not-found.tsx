import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="rounded-md border border-dashed border-ink/20 py-16 text-center">
      <p className="font-display text-lg font-semibold">Page not found</p>
      <p className="mt-1 text-sm text-ink/50">
        That game or page doesn’t exist.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-md border border-ink/15 bg-card px-3 py-1.5 text-sm shadow-sm hover:bg-field/5"
      >
        ← All games
      </Link>
    </div>
  );
}
