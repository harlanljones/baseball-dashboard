# Changelog

All notable changes to this project will be documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases will use
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Public contribution, conduct, security, deployment, publishing, and data-source guidance.
- GitHub Actions validation for linting, type checking, tests, and production builds.
- Reproducible Bun toolchain and repository metadata.

### Changed

- Refreshed the README and architecture documentation to match the current app.
- Documented the required Cloudflare R2 and Durable Object cache resources.
- Added required Open-Meteo attribution beside weather reports and in the application footer.

### Fixed

- Batter-vs-pitcher pages are now ISR-cached (6-hour revalidation) instead of
  re-rendered per request, which exceeded the Workers free-plan CPU limit when
  crawlers requested many matchup URLs at once (`exceededCpu` / 503s).
- Unknown player ids on the vs-pitcher page render the not-found page instead
  of erroring with an unhandled upstream 404.
