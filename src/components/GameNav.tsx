import Link from "next/link";

export default function GameNav({
  gamePk,
  current,
  propsAvailable,
}: {
  gamePk: number;
  current: "overview" | "props";
  propsAvailable: boolean;
}) {
  const active = "border-b-2 border-gold px-3 py-2 text-sm font-semibold text-ink";
  const idle = "px-3 py-2 text-sm text-ink/65 hover:text-ink";
  return (
    <nav aria-label="Game detail navigation" className="mt-4 flex gap-1 border-b border-ink/10">
      <Link
        href={`/games/${gamePk}`}
        aria-current={current === "overview" ? "page" : undefined}
        className={current === "overview" ? active : idle}
      >
        Overview
      </Link>
      {propsAvailable || current === "props" ? (
        <Link
          href={`/games/${gamePk}/props`}
          aria-current={current === "props" ? "page" : undefined}
          className={current === "props" ? active : idle}
        >
          Player props
        </Link>
      ) : (
        <span aria-disabled="true" className="px-3 py-2 text-sm text-ink/65">
          Player props <span className="text-xs">(closed)</span>
        </span>
      )}
    </nav>
  );
}
