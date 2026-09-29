import type { ReactNode } from "react";
import Link from "next/link";

export default function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-block text-sm text-ink/65 hover:text-ink">
      ← {children}
    </Link>
  );
}
