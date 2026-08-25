import Link from "next/link";
import PageContainer from "@/components/PageContainer";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <PageContainer>
      <div className="rounded-md border border-dashed border-ink/20 py-16 text-center">
        <p className="font-display text-lg font-semibold uppercase tracking-wide">
          Out of the park
        </p>
        <p className="mt-1 text-sm text-ink/65">
          That page doesn’t exist — the game or link may have been retired.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md border border-ink/15 bg-card px-3 py-2 text-sm shadow-sm hover:bg-field/5"
        >
          ← Back to today’s games
        </Link>
      </div>
    </PageContainer>
  );
}
