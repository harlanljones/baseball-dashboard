import type { ReactNode } from "react";

/**
 * The standard centered/padded content column shared by every route. `wide`
 * widens it for data-dense pages such as the game's player props board.
 */
export default function PageContainer({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          : "mx-auto w-full max-w-5xl px-4 py-6"
      }
    >
      {children}
    </div>
  );
}
