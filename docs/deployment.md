# Deploying to Cloudflare Workers

The production target is Cloudflare Workers through the OpenNext adapter. The
checked-in configuration expects a Worker named `baseball-dashboard`, an R2
incremental-cache bucket named `baseball-dashboard-cache`, and a Durable Object
queue created by the Wrangler migration.

## Prerequisites

- A Cloudflare account with Workers and R2 enabled.
- Bun 1.4.0 or newer.
- Wrangler authentication (`bunx wrangler login`) for local deployments.
- Optional: a The Odds API key for player props.

The R2 bucket is required by the checked-in `wrangler.jsonc`; create it once:

```bash
bunx wrangler r2 bucket create baseball-dashboard-cache
```

If you choose a different Worker or bucket name, update every matching service
binding or bucket reference in `wrangler.jsonc` before deploying.

## Release checks

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run cf:build
```

`cf:build` invokes `next build` and then creates the Worker bundle in
`.open-next/`. To exercise the generated bundle in the local Workers runtime,
run `bun run preview` instead.

## Manual deployment

```bash
bun run deploy
```

The OpenNext deploy command populates the remote incremental cache and then
deploys the Worker. The first deployment applies the Durable Object migration
declared in `wrangler.jsonc`.

To enable player props, set the runtime secrets interactively:

```bash
bunx wrangler secret put SPORTSGAMEODDS_API_KEY  # primary provider
bunx wrangler secret put ODDS_API_KEY            # optional fallback provider
```

Do not place keys in `wrangler.jsonc`, a shell command argument, or a tracked
file. Confirm the deployed home page, a completed game, a live/preview game when
available, and a player matchup route after deployment.

## Workers Builds

Cloudflare can build and deploy from the GitHub repository. Connect the repo to
the existing Worker under **Settings → Builds**, then use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `bun run cf:build` |
| Deploy command | `bunx opennextjs-cloudflare deploy` |

The Worker name in Cloudflare must match `name` in `wrangler.jsonc`. Configure
`SPORTSGAMEODDS_API_KEY` (and `ODDS_API_KEY` if the fallback is wanted) as both
build secrets and runtime secrets when props are enabled;
do not commit them. Because this Worker includes a Durable Object binding,
non-production branch builds do not receive Cloudflare preview URLs.

GitHub Actions performs validation only and has no Cloudflare credentials. This
keeps pull requests safe to run from forks while Workers Builds owns deployment.

## Cache and image configuration

`open-next.config.ts` uses R2 plus a regional cache and a Durable Object queue.
Removing the R2 binding requires changing that OpenNext configuration as well;
otherwise runtime caching will fail.

Remote MLB images are currently served with Next.js image optimization disabled
(`images.unoptimized: true`). To enable Cloudflare image optimization, add an
`IMAGES` binding in `wrangler.jsonc`, remove `unoptimized: true`, and review
Cloudflare Images pricing before deploying the change.

## Operations

- Inspect Workers Logs and Traces in the Cloudflare dashboard; observability is
  enabled in `wrangler.jsonc`.
- Upload an inactive version with `bun run upload` when you want to inspect a
  version before promoting it.
- Use Cloudflare's deployment/version history to roll back a bad release.
- Keep `compatibility_date`, Next.js, OpenNext, and Wrangler current through a
  tested pull request rather than changing production directly.
