# Publishing checklist

The tracked repository is ready to make public after the owner completes the
provider and repository settings below. These settings are intentionally not
automated because they affect external visibility, credentials, and billing.

## Repository settings

- Set the description to: `Live MLB scores, matchup stats, weather, and optional player props.`
- Add topics such as `mlb`, `baseball`, `nextjs`, `typescript`, `cloudflare-workers`, and `sabermetrics`.
- Keep Issues enabled so the checked-in issue forms are available.
- Enable private vulnerability reporting before relying on the link in
  `SECURITY.md`.
- Enable secret scanning and push protection where the account supports them.
- Protect `main` and require the `quality` job from the `CI` workflow before merge.
- Add the deployed URL as the repository website after the first successful deploy.

The package remains marked `private: true` intentionally. This is a deployable
application, not an npm package, and the flag prevents accidental registry
publication without preventing a public source repository.

## Pre-publication verification

```bash
bun install --frozen-lockfile
bun run check
bun run cf:build
git status --short
```

Review the complete staged diff, confirm no `.env` or `.dev.vars` file is
tracked, and check the repository history for credentials before changing its
visibility. Rotate any credential that may ever have been committed; deleting a
file in a later commit does not remove it from history.

## First deployment

Follow [deployment.md](deployment.md) to create the R2 cache bucket, configure
the optional secret, and deploy. Confirm the home page, a completed game route,
an upcoming/live game route when one is available, and a player matchup route.

If a stable custom domain is added, update the package `homepage`, repository
website, Next.js metadata base, sitemap, robots policy, and social-sharing image
in one change. Those values are omitted today so the repository does not publish
placeholder or incorrect URLs.

## First release

1. Move the relevant `Unreleased` changelog entries under a dated version.
2. Confirm CI is green on the exact commit.
3. Create an annotated semantic-version tag.
4. Publish GitHub release notes from the changelog.
5. Verify the deployed Worker and retain the previous Cloudflare version for rollback.
