/** Format a rate stat like wOBA as `.462` (three decimals, no leading zero). */
export function rate3(n?: number): string {
  if (n == null) return "—";
  return n.toFixed(3).replace(/^0(?=\.)/, "");
}

export function int(n?: number): string {
  return n == null ? "—" : String(Math.round(n));
}

export function dec1(n?: number): string {
  return n == null ? "—" : n.toFixed(1);
}

export function dec2(n?: number): string {
  return n == null ? "—" : n.toFixed(2);
}
