import type { ReactNode } from "react";

/**
 * The standard centered/padded content column used by every route except the
 * game detail page, which needs a full-bleed, full-height shell for its
 * resizable split pane. Kept as the old `<main>` classes lifted verbatim so
 * moving it here is a no-op for every other page.
 */
export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
  );
}
