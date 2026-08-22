# Security policy

## Supported versions

Until the first tagged release, security fixes are applied to the latest commit
on `main` only. Older commits and forks are not supported.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities or exposed secrets.
Use GitHub's private vulnerability reporting for this repository:

<https://github.com/harlanljones/baseball-dashboard/security/advisories/new>

Include the affected route or component, reproduction steps, impact, and any
suggested mitigation. Avoid accessing data that is not yours, disrupting the
deployed service, or testing against third-party APIs beyond what is necessary
to demonstrate the issue.

You can expect an acknowledgement when the report is reviewed. Remediation and
disclosure timing depend on severity and whether an upstream provider or
framework is involved.

## Secrets

The only application secret is `ODDS_API_KEY`. It must stay in `.env.local`,
`.dev.vars`, Cloudflare secrets, or CI secret storage. If a key is committed or
printed in logs, revoke it immediately before removing it from the repository.
