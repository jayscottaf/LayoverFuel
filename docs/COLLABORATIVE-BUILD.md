# Travel Beta: Collaborative Build

## Ownership

- Codex: backend, data contracts, account isolation, local dates, offline persistence, migrations and integration verification.
- Claude: Today, Log, Plan, onboarding, capture/review UI, navigation, theme and responsive layout.
- Foundation work was isolated on `codex/travel-foundation` and `codex/travel-ui-foundation`. Codex integrates and verifies releases; feature branches are not themselves deployment evidence.

## Product Boundary

Health-conscious business, crew and leisure travelers are core users. Jason tests first; recruitment is not a prerequisite. The first complete loop is Today -> capture/correct -> saved meal -> updated remaining-day plan.

The first device is an iPhone 16 Pro. Nashville, LaGuardia and Saratoga Springs are the initial location scenarios, not a claim that local restaurant coverage is already available.

The first plan is explicitly generic. Hotel/local-meal, grocery/room-meal and packed-food patterns do not claim verified nearby availability. Venue lookup, access, hours, menu licensing and sourced restaurant nutrition remain separate work. Unsupported dietary restrictions pause generic suggestions instead of guessing.

## Data Contracts

- Dates are explicit `YYYY-MM-DD` calendar labels with an IANA timezone. Changing location does not rewrite historical dates.
- `stats.macros.targetCalories` is the common calorie target. Remaining intake is based on logged meals and may be negative; logging does not lower the target.
- Nutrition POSTs carry a UUID `clientRequestId`. A unique `(user_id, client_request_id)` index deduplicates retries. Reusing an ID with different data returns 409.
- Item nutrients are totals for the stated quantity. The server sums itemized nutrition. Sources are manual, label, database or estimate.
- DELETE soft-deletes a meal; POST `/api/logs/nutrition/:id/restore` restores the same record. Retrying an old creation never resurrects a removed meal.
- `/api/travel-plan` GET derives totals from saved logs. PUT uses a revision check to prevent lost edits. Locked choices are retained; `planMealId` links a consumed choice to its log.
- Offline drafts belong to one account. Failed requests remain available. Legacy drafts without ownership are quarantined rather than attributed to the next user.
- The old Assistants endpoints return 401 without a session and 410 when signed in. New meal estimation is a bounded, structured Responses API request followed by user review.
- Adaptive targets remain disabled pending data-completeness and accuracy validation.

## Local Setup

Use a disposable PostgreSQL database for development and tests, not a production dump:

```sh
npm ci
export DATABASE_URL=postgresql://USER@127.0.0.1:5432/layoverfuel_dev
npm run db:push
PORT=5175 npm run dev
```

Existing databases: inspect with `npm run db:check`, back up, then apply the reviewed additive `npm run db:migrate:travel` migration if needed. Railway now runs `db:migrate:deploy` before deployment, including the earlier Google/log migrations, travel migration, schema verification and a bounded synthetic nutrition-provider check. The travel migration makes a one-time private recovery copy in the same database, uses a transaction and verifies meal counts. Never use `db:push` against production.

```sh
npm run check
npm test
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:5432/layoverfuel_test npm test
npm run build
```

The integration suite refuses non-local database hosts. It uses disposable accounts and exercises real Express sessions and PostgreSQL. Without `TEST_DATABASE_URL`, that suite is explicitly skipped. The existing Cloudinary test requires separate credentials and remains optional.

`docs/test/travel-beta-smoke.mjs` reproduces the browser loop against a local server and disposable database. It creates a throwaway account, requires Playwright (or `PLAYWRIGHT_MODULE` pointing to an existing installation), and expects AI credentials to be absent for the unavailable-provider check. Run with `SMOKE_BASE_URL=http://127.0.0.1:5175 node docs/test/travel-beta-smoke.mjs`. Service workers are blocked in this test: its offline check covers a loaded app queuing and reconnecting, not an installed app's offline cold start. Screenshots default to the ignored `smoke-output/` directory.

For offline-shell testing, build the client and run with `SERVE_STATIC=1` in development. Service workers register only in built clients. Visit the pages online first. Personalized read snapshots are account-scoped; API responses never enter the shared service-worker cache.

## Release Gates

- TypeScript, build, domain tests, offline retry tests and real database integration tests pass.
- Browser verification uses the integrated backend, not just Claude's frontend mock harness.
- Verify camera capture, offline cold start, reconnection, permissions and install behavior on Jason's actual iPhone before a trip.
- Live model quality, real barcode coverage, Google OAuth and production configuration require separate verification. A configured key is not evidence of a working feature.
- Resolve the existing `CLAUDE.md`/`claude.md` case collision separately; do not include the pre-existing local change in implementation commits.

## Deliberately Deferred

App Store packaging, payments, health-platform integrations, calendar inference improvements, verified nearby places, calibrated photo accuracy, encrypted private photo retention and broad health coaching are not claimed complete by this milestone.

## First Integrated Milestone

September 22, 2026, local development only. Backend and UI feature branches are integrated on `codex/travel-foundation`; production and `main` remain unchanged.

- TypeScript and production build pass. The automated suite passes 15 tests with one optional Cloudinary test skipped; the PostgreSQL integration tests actually ran.
- Two independent browser passes exercised the combined UI/backend. Codex verified onboarding, consistent targets, manual save, edit, delete/restore, date history, plan context, fixed dinner and plan-to-log totals against disposable local PostgreSQL.
- Layout inspected at 402 x 874 and 1365 x 900 in light/dark themes. No horizontal overflow was found on the inspected mobile Today screen. These are desktop-browser viewports, not physical-iPhone results.
- Claude reports 16/16 browser smoke checks passing, including offline queuing/reconnection, on the integrated UI/backend. Code-level tests cover response-loss retries, duplicate prevention, account-scoped reads, account switching during a cached read, and Undo during upload followed by disconnection.
- Description estimation without a configured provider visibly preserves input and offers manual entry. Successful live photo/description estimation, barcode coverage and Google OAuth are not verified in this local environment.
- Location permission is user-triggered. Current location currently supplies rounded coordinates, not city resolution. The pattern affects generic meal ideas; location, time windows, equipment and notes are retained for reference, not yet used by a venue search or schedule optimizer.
- Existing Progress, Profile, Itinerary and authentication screens retain their legacy styling. The new nutrition loop is the redesigned surface.
- Remaining review items: unsaved plan context is lost when switching Today/Tomorrow or leaving the page; deleting a log does not yet restore keyboard focus predictably. Save plan edits before switching days. Accessibility review is not complete.
- The client still produces a large single JavaScript bundle (about 1.4 MB before gzip). Route/scanner splitting, accessibility audits, device-level offline cold starts and production database/configuration checks remain release work.

Next milestone: real-device camera/offline/installation checks, evaluated live meal recognition, and sourced local food choices for the initial cities. Do not market this milestone as a complete travel recommendation engine or a finished Cal AI competitor.

## October 10 Release Preparation

- Backend released first in `4dc03b9`, retaining the old frontend until migration and provider checks passed. Railway logs confirm the travel migration, schema readiness, and successful synthetic text/image Responses API calls. These calls verify API contracts, not food accuracy.
- Public Railway domains were corrected from port 5000 to 8080 to match the assigned server port. The public API health endpoint returned 200 after the routing repair.
- Full local suite: 24 passing tests, one optional Cloudinary test skipped. Includes actual PostgreSQL integration, repeated migration/data preservation, concurrent retries, edit/delete/restore, locked meals, account separation, local dates, lost responses and offline shell asset precaching.
- Phone-sized browser checks exercised manual save, item correction, plan updates and kept choices. Synthetic camera checks verify a moving preview despite dashboard errors, capture-to-review, stream cleanup and recovery from a stalled permission request.
- Production build and type checks pass. Two critical runtime advisories and the ORM advisory were resolved with compatible updates; build-tool advisories and the large client bundle remain follow-up work.
- New offline account markers survive a fresh launch, are revoked on logout and are checked against the active account. Installation caches all hashed application assets before activating; the shared service worker never caches account APIs. This does not substitute for a physical iPhone airplane-mode test.
- Camera repair and genuine Undo are carried forward into the reviewed capture flow. Nothing is automatically saved from an AI estimate.
- Release remains a personal travel beta. Nearby venue availability, reverse geocoding, calibrated meal recognition, device-level installation/offline testing, broader accessibility work and legacy screen redesign are still outstanding.
- Vercel's legacy ignore file excluded `shared/`; the new frontend imports those validators. The exclusion was removed after the hosted build caught it. Shared files are build inputs, not separately published public assets. Production verification must check both hosts, not just a local build or GitHub push.
