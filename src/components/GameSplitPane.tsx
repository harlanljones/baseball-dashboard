"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  clampPanePct,
  panePctFromPointer,
  parseStoredPanePct,
  DEFAULT_PANE_PCT,
  PANE_STORAGE_KEY,
} from "@/lib/paneWidth";

const STEP_PCT = 2;
const BIG_STEP_PCT = 10;

/**
 * Restores the persisted props-pane width before first paint. Runs as an
 * inline script (not a `useEffect`) so there's no flash from the default
 * width snapping to the stored one after hydration — see
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 * `type` flips to `text/plain` on the client so the script never re-executes
 * (and React never warns about a `<script>` in the tree) on soft navigations.
 */
function RestorePaneWidthScript({ targetId }: { targetId: string }) {
  const html = `{var n=document.getElementById(${JSON.stringify(targetId)}),v=n&&localStorage.getItem(${JSON.stringify(PANE_STORAGE_KEY)});if(n&&v){var p=Number(v);if(p>=20&&p<=75)n.style.setProperty("--props-pane-w",p+"%")}}`;
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * IDE-style split pane for the game page: main content on the left, the
 * player props panel on the right, each scrolling independently, with a
 * draggable divider between them. Below `lg` this collapses to the page's
 * normal stacked, single-scroll layout.
 *
 * The divider writes the width straight to a CSS custom property
 * (`--props-pane-w`) on every pointermove instead of going through React
 * state, so dragging never re-renders either pane. React state only tracks
 * the committed value (for `aria-valuenow` and `localStorage`).
 */
export default function GameSplitPane({
  main,
  sidebar,
}: {
  main: ReactNode;
  sidebar: ReactNode | null;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const shellId = useId();
  const [collapsed, setCollapsed] = useState(false);
  // Lazy initializer so the committed width (used for `aria-valuenow` and
  // subsequent `localStorage` writes) starts in sync with whatever the
  // pre-paint script above already restored onto the DOM, without an effect
  // that would set state after mount.
  const [panePct, setPanePct] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_PANE_PCT;
    return parseStoredPanePct(localStorage.getItem(PANE_STORAGE_KEY)) ?? DEFAULT_PANE_PCT;
  });
  const [dragging, setDragging] = useState(false);

  const hasSidebar = sidebar !== null;
  const showSidebar = hasSidebar && !collapsed;

  const commitPanePct = useCallback((pct: number) => {
    const clamped = clampPanePct(pct);
    setPanePct(clamped);
    shellRef.current?.style.setProperty("--props-pane-w", `${clamped}%`);
    try {
      localStorage.setItem(PANE_STORAGE_KEY, String(clamped));
    } catch {
      // Storage can throw in private browsing — the width just won't persist.
    }
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = panePctFromPointer(e.clientX, rect);
      shellRef.current?.style.setProperty("--props-pane-w", `${pct}%`);
    };
    const onPointerUp = (e: PointerEvent) => {
      const rect = shellRef.current?.getBoundingClientRect();
      const pct = rect ? panePctFromPointer(e.clientX, rect) : panePct;
      commitPanePct(pct);
      setDragging(false);
    };

    document.body.classList.add("cursor-col-resize", "select-none");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragging, panePct, commitPanePct]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? BIG_STEP_PCT : STEP_PCT;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      commitPanePct(panePct + step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      commitPanePct(panePct - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      commitPanePct(75);
    } else if (e.key === "End") {
      e.preventDefault();
      commitPanePct(20);
    }
  };

  return (
    <div
      ref={shellRef}
      id={shellId}
      className={`grid min-h-0 flex-1 grid-cols-1 ${
        hasSidebar
          ? `lg:h-[calc(100svh-var(--spacing-header)-var(--spacing-footer))] ${
              showSidebar
                ? "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,var(--props-pane-w,50%))]"
                : "lg:grid-cols-[minmax(0,1fr)_auto_0px]"
            }`
          : ""
      }`}
    >
      {hasSidebar && <RestorePaneWidthScript targetId={shellId} />}

      <div
        className={`min-h-0 space-y-5 px-4 py-6 ${hasSidebar ? "lg:overflow-y-auto" : ""}`}
      >
        {main}
        {hasSidebar && collapsed && (
          <div className="flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="text-xs font-medium text-ink/50 hover:text-ink"
            >
              Show player props
            </button>
          </div>
        )}
      </div>

      {hasSidebar && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize player props panel"
          aria-valuenow={collapsed ? undefined : Math.round(panePct)}
          aria-valuemin={20}
          aria-valuemax={75}
          tabIndex={collapsed ? -1 : 0}
          suppressHydrationWarning
          onPointerDown={(e) => {
            if (collapsed) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }}
          onKeyDown={onKeyDown}
          className={`relative hidden shrink-0 lg:flex ${
            collapsed ? "w-6 items-start justify-center pt-6" : "w-2.5 cursor-col-resize items-stretch justify-center"
          }`}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Show player props"
              className="rounded-md border border-ink/15 bg-card px-1 py-2 text-xs text-ink/50 shadow-sm hover:text-ink"
            >
              ‹
            </button>
          ) : (
            <div className="w-px bg-ink/10 hover:bg-grass/40" aria-hidden />
          )}
        </div>
      )}

      {showSidebar && (
        <div className="min-h-0 lg:overflow-y-auto">
          <div className="sticky top-0 z-10 flex justify-end bg-paper px-4 pt-6 lg:pt-3">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-xs font-medium text-ink/50 hover:text-ink"
            >
              Hide player props
            </button>
          </div>
          <div className="@container px-4 pb-6 pt-2">{sidebar}</div>
        </div>
      )}
    </div>
  );
}
