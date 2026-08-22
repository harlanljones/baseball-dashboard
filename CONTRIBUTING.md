# Contributing

Thanks for helping improve Baseball Dashboard. Bug fixes, tests, accessibility
improvements, documentation corrections, and focused features are welcome.

## Before opening a change

Search existing issues and keep each pull request focused on one concern. For a
large feature or architectural change, open an issue first so the approach can
be discussed before significant implementation work.

Do not include API keys, `.env` files, generated build output, copied provider
data, or assets whose redistribution rights are unclear.

## Development setup

```bash
git clone https://github.com/harlanljones/baseball-dashboard.git
cd baseball-dashboard
bun install --frozen-lockfile
cp .env.example .env.local  # optional
bun run dev
```

This repository targets the checked-in Next.js version, whose APIs can differ
from older releases. Before changing framework behavior, read the relevant
guide under `node_modules/next/dist/docs/` and follow any deprecation guidance.

## Quality checks

Run the checks relevant to your change. Before requesting review, run the full
suite:

```bash
bun run check
```

For Cloudflare or deployment changes, also run:

```bash
bun run cf:build
```

Tests belong beside the domain they cover in a `__tests__` directory. Prefer
pure-function tests for data shaping and calculations. Async Server Components
need build coverage and, where practical, manual route verification.

## Pull requests

- Explain the user-visible behavior and why the change is needed.
- Link the relevant issue when one exists.
- Include test evidence and manual verification notes.
- Include before/after screenshots for visual changes.
- Update current documentation and `CHANGELOG.md` when behavior, configuration,
  commands, data providers, or deployment requirements change.
- Keep historical files under `docs/superpowers/` unchanged unless correcting a
  broken link or clearly factual transcription error.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
