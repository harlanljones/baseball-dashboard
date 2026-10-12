/**
 * Registers the module stand-ins the benchmark needs, before the entry point
 * (and through it the app) is loaded.
 *
 * Wired in through `bench/bunfig.toml`'s `preload`, because Bun evaluates
 * preload scripts ahead of the entry module: a mock installed from inside
 * `run.ts` would be too late, since `import` statements there are hoisted and
 * `src/lib/odds/{leans,props}.ts` build their `unstable_cache` wrappers at
 * module-evaluation time.
 */

import { mock } from "bun:test";

// On a cache miss Next runs the wrapped function itself — which is precisely
// the work this benchmark measures. Outside a request there is no incremental
// cache to consult, so identity is both faithful and the only option.
mock.module("next/cache", () => ({
  unstable_cache: <T,>(fn: T): T => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
  unstable_noStore: () => undefined,
}));
