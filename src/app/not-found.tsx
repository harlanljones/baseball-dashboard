import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
      <p className="text-lg font-semibold">Page not found</p>
      <p className="mt-1 text-sm text-neutral-500">
        That game or page doesn’t exist.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-md border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
      >
        ← All games
      </Link>
    </div>
  );
}
