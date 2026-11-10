# Hosting — <project>

This project's built site is served from Cloudflare R2 through a Worker. The machinery is `hosting/kit/`
(r2-host-kit v<n>, vendored from Garth's Dropbox shelf on <date>). The kit's reference is `hosting/kit/README.md`, and
the one-time setup is `hosting/kit/RUNBOOK.md`. This page records how **this** project is wired.

## Where things are

| Thing | Value |
|---|---|
| Visitors load | `https://<host>` (also `https://<worker>.<subdomain>.workers.dev`) |
| Who may see it | <public / private — Cloudflare Access on the Worker; who is allowed in> — Garth, <date> |
| R2 bucket | `<bucket>` (Public Access disabled; location <hint>) |
| Worker | `<worker>` — `hosting/wrangler.jsonc` |
| Publish config | `hosting/publish.json` |
| Built from branch | `<branch>` |
| What ships | `stage.include` in `hosting/publish.json` (an allowlist) / the `<build>` output |
| The check | `<command>` — <what it proves> |
| Credentials | `%USERPROFILE%\.r2\<bucket>.json` on: <PC names>. Never in the repo |

## Publish, look, roll back

```bash
node hosting/kit/publish.mjs --dry-run
node hosting/kit/publish.mjs --promote          # prints the rollback command — put it in the announcement
curl -s https://<host>/__build                  # what is being served
node hosting/kit/publish.mjs --promote-only=<previous build id>   # roll back
```

## Garth's rulings

- <date>: <decision, in his words where he gave them>
