#!/usr/bin/env bash
#
# Benchmark entrypoint for the autoresearch loop.
#
# Measures the mean cost of one cold request cycle over the app's two betting
# surfaces — the slate-wide leans API (`getBestLeans`) and the props page
# (`loadPropGroups` with matchup evidence) — plus the server render of the home
# slate and the props board. Caches are bypassed inside the benchmark (see
# bench/preload.ts), so a cycle costs what a cache miss costs in production.
#
# Deterministic and offline: every upstream response comes from bench/fixture.ts
# keyed off player/team ids, so no network, clock or RNG enters the numbers.
#
# `bun bench/run.ts` prints one line per metric per process; this script runs it
# several times and reports, per metric:
#   * `METRIC <name>=<min>`    — the least-perturbed process (primary metric)
#   * `METRIC <name>_median=…` — the middle process, for timing metrics
# Interference from anything else on the machine can only add time, so the
# minimum is the honest estimator of the work itself; the median is reported so
# a machine that is uniformly busy is visible rather than silently hidden.
#
# Usage: bash autoresearch.sh          (BENCH_RUNS=5 to change the run count)
# Exit: 0 when every run passed its invariants, non-zero otherwise.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v bun >/dev/null 2>&1; then
  echo "autoresearch: bun is required (https://bun.sh)" >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "autoresearch: node_modules is missing — run 'bun install --frozen-lockfile'" >&2
  exit 1
fi

# React ships a slower development build that also emits warnings; the deployed
# app runs the production one.
export NODE_ENV=production

RUNS="${BENCH_RUNS:-5}"
TIMING_METRICS="slate_ms leans_ms props_ms render_ms"

RAW="$(mktemp)"
OUT="$(mktemp)"
trap 'rm -f "$RAW" "$OUT"' EXIT

for run in $(seq 1 "$RUNS"); do
  if ! (cd bench && bun run.ts) >"$OUT" 2>&1; then
    echo "autoresearch: bench run $run/$RUNS failed" >&2
    cat "$OUT" >&2
    exit 1
  fi
  if ! grep -q '^METRIC ' "$OUT"; then
    echo "autoresearch: bench run $run/$RUNS emitted no METRIC lines" >&2
    cat "$OUT" >&2
    exit 1
  fi
  grep '^METRIC ' "$OUT" >>"$RAW"
done

echo "# runs=$RUNS; slate_ms per run: $(grep -E '^METRIC slate_ms=' "$RAW" | cut -d= -f2 | tr '\n' ' ')"

# Print each metric in the order bench/run.ts declares it (primary metric
# first), with the minimum across runs as the metric's own value.
ORDER="$(awk '{print $2}' "$RAW" | cut -d= -f1 | awk '!seen[$0]++')"
for name in $ORDER; do
  values="$(grep -E "^METRIC ${name}=" "$RAW" | cut -d= -f2 | sort -g)"
  minimum="$(echo "$values" | head -1)"
  echo "METRIC ${name}=${minimum}"
  case " $TIMING_METRICS " in
    *" $name "*)
      median="$(echo "$values" | awk '
        { v[NR] = $1 }
        END {
          if (NR == 0) exit 1
          if (NR % 2 == 1) { print v[(NR + 1) / 2] } else { printf "%.3f\n", (v[NR / 2] + v[NR / 2 + 1]) / 2 }
        }')"
      echo "METRIC ${name}_median=${median}"
      ;;
  esac
done

exit 0
