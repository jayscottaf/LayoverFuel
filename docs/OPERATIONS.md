# Operations

## Where things run

| Piece    | Host                          | Notes                                   |
| -------- | ----------------------------- | --------------------------------------- |
| Frontend | Vercel (`layoverfuel.com`)    | Deploys from `main`                     |
| API      | Railway (`api.layoverfuel.com`), US East | Deploys from `main`; runs `db:migrate:deploy` first |
| Database | Neon via Vercel Storage (`LayoverFuel-DB`), us-east-1, Free plan | Owned by Jason's Vercel team |

Keep the API and database in the same region; every query pays the round trip.

The database was moved off a Replit-managed Neon endpoint on 2026-11-04 after
Replit disabled it. No data was recovered; the new database started empty.

## Health and alerts

- `GET https://api.layoverfuel.com/api/health` returns
  `{"status":"ok","checks":{"database":"ready",...}}` when the schema is complete.
- `.github/workflows/uptime.yml` checks it hourly. A failed run emails the repo
  owner. GitHub pauses scheduled workflows after 60 days without repo activity;
  re-enable them from the Actions tab if that happens.

## Backups

`.github/workflows/db-backup.yml` runs nightly (and on demand from the Actions
tab). It writes a `pg_dump` custom-format dump, encrypts it with AES-256 using
`BACKUP_PASSPHRASE`, and keeps it as a workflow artifact for 30 days. The repo
is public, so never upload an unencrypted dump.

Repository secrets it needs (Settings → Secrets and variables → Actions):

- `BACKUP_DATABASE_URL`: the Neon **direct** (non-pooled) connection string.
- `BACKUP_PASSPHRASE`: a long random passphrase. Store it in your password
  manager too; without it the backups cannot be opened.

### Restoring

1. Download the artifact from the backup run and unzip it.
2. Decrypt: `gpg --decrypt layoverfuel-<stamp>.dump.gpg > layoverfuel.dump`
3. Restore into an **empty** database (create a Neon branch or a new database
   first; don't restore over production without a fresh backup of it):
   `pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" layoverfuel.dump`
4. Point a test deploy at it and check `/api/health` before switching
   production's `DATABASE_URL`.

Neon also keeps a short point-in-time restore window on the Free plan; check the
Neon console for the current limit.

## Database compute budget

The Neon Free plan has a monthly compute-hour limit and suspends the database
after a few idle minutes. Things that wake it: user requests, the hourly uptime
check, the nightly backup, and the daily session prune
(`pruneSessionInterval` in `server/storage.ts`). Avoid adding frequent timers or
polling that touch the database.
