# Testing

Run tests against synthetic data and an isolated local database. Production credentials are not needed for the automated suite. See [Getting started](GETTING_STARTED.md) for normal development setup and [Contributing](CONTRIBUTING.md) for change/review expectations. All commands below run from the repository root.

## Standard checks

Use Node.js 22.12+ in the Node 22 release line, matching CI:

```sh
npm --prefix backend ci
npm --prefix frontend ci
npm run check
```

`check` runs backend and frontend tests, frontend lint, and the production frontend build. It does **not** run MongoDB integration tests. `npm test` runs just the backend/frontend unit suites.

The build uses local Vite environment files. A successful build with a localhost API URL is useful for compilation checks but is not a deployable production artifact; see [Deployment](DEPLOYMENT.md#avoid-deploying-a-localhost-build).

## Local MongoDB integration tests

Transactions require a replica set. Create a disposable MongoDB 7 container bound only to loopback:

```sh
docker run -d --name placement-test-mongo -p 127.0.0.1:27028:27028 mongo:7.0 mongod --replSet rs0 --bind_ip_all --port 27028
```

Wait until this command succeeds:

```sh
docker exec placement-test-mongo mongosh --quiet --port 27028 --eval 'db.adminCommand({ping:1})'
```

Initialize it once:

```sh
docker exec placement-test-mongo mongosh --quiet --port 27028 --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27028"}]})'
```

Wait for `isWritablePrimary` to return `true`, then run the suite:

```sh
docker exec placement-test-mongo mongosh --quiet --port 27028 --eval 'db.hello().isWritablePrimary'
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

The tests create and remove their own temporary databases. The helpers require an unauthenticated localhost URI and reject external targets. Do not pass an Atlas URI, load production environment files into this command, or disable the target checks.

For later runs, use `docker start placement-test-mongo`; do not rerun replica-set initialization. When finished:

```sh
docker stop placement-test-mongo
```

[`Portal checks`](../.github/workflows/checks.yml) runs `npm run check` and the integration suite using this isolated replica-set approach on Node 22.

## Coverage and focused runs

| Area | Main coverage |
| --- | --- |
| Authentication and access | Google-token/session handling, concurrent refresh with fixed expiry, account revocation, current permission checks, protected Super Admins, origin denial, and owner boundaries. |
| Endpoint inventory | Every registered method/path classified once; duplicate endpoints and unclassified routes fail. Anonymous, foreign-origin, and insufficient-permission requests are exercised. |
| Workflow consistency | Migration/rollback, roster preview/commit, publishing, duplicate application races, retained snapshots, corrections/withdrawals, recruitment batches/undo, offers, policy recalculation, and reports. |
| Untrusted input | Multipart limits/admission, malformed and oversized workbooks, ZIP metadata inconsistencies, CSV parsing and formula-safe exports, query/input validation. |
| Frontend logic | Session recovery, filter/query behavior, application progress, profile/portfolio and drive-form behavior, and related helpers. These are Node-based tests, not a full browser end-to-end suite. |

Examples of narrower checks while developing:

```sh
node --test backend/tests/upload-limits.test.js backend/tests/recruiter-files.test.js
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' node --test backend/tests/integration/endpoint-access.test.js
```

The final local checks on 23 September 2026 passed **255 tests**: 64 backend, 58 frontend, and 133 integration tests, with none skipped. Frontend lint and the production build passed. Both dependency audits reported zero known vulnerabilities after compatible frontend dependency updates. The access inventory covered 65 method/path pairs, including 55 protected-route anonymous checks and 34 write-origin checks. These counts describe that revision, not a fixed target for future changes.

Validation regressions cover malformed admin/import/recruiter emails, 10-digit phone fields, strict CGPA bounds and precision, school marks, integer years/backlogs, duplicate/future semester results, initial profile-completion requirements, and immutable login/access fields. Drive tests preserve existing entry-qualification restrictions and distinguish an absent minimum-CGPA cutoff from invalid entered values. Document-opening tests cover delayed signed URLs, popup blocking, unsafe links and failed requests. The backup-retirement regression also verifies that missing backup operations cannot erase live records during rollback.

Synthetic browser checks confirmed invalid-field messages, successful profile persistence, duplicate-semester rejection, disabled import commits for invalid rows, and saved role qualification settings. Profile controls were checked at a 390×844 viewport, and admin forms/dialogs at desktop sizes. The admin account page and role eligibility dialog fit the tested 1440×900 viewport without page overflow. These checks used only disposable local records; they did not change Atlas data or exercise hosted Google/cloud-storage integration.

## Synthetic browser preview

Start the local replica set, then run:

```sh
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
```

For larger report/pagination fixtures:

```sh
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2 -- --reports
```

The script prints sign-in links for a Super Admin, limited administrator, returning student, and first-time student. It runs the API on `9107` and the frontend on `5187`. Use those fixture links rather than Google login.

The preview creates a temporary local database, applies its setup there, generates temporary session secrets, and removes cloud/database environment credentials. It does not load the application `.env` or run in production mode. Real Google login and photo/resume cloud uploads are unavailable; supported document fixtures are synthetic and in memory. The fixture routes exist only in this script, not the production app.

Use the preview to check desktop/mobile layout, keyboard/dialog behavior, filters, pagination, role editing, student application details, and permission-dependent navigation. Press `Ctrl+C` for cleanup of the API, frontend, in-memory files, and temporary database. Preview success does not prove hosted cookie behavior or provider integration.

## Local capacity check

```sh
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' node --expose-gc backend/scripts/audit-capacity.js
```

This script creates 1,000 synthetic students, 30 companies, 3,000 applications, and 8,000 notifications in a disposable localhost database. It exercises authenticated HTTP reads at 20 and 40 concurrent requests, applicant context/export, placement recalculation, and 100 application submissions at 20-request concurrency followed by duplicate replays. It reports latency, throughput, errors, and process memory, then removes its database. It does not load `.env` or contact cloud services.

Rate limiting is disabled for this measurement; authorization remains enabled. Its throughput does not measure the live rate limits; upload admission is covered separately by regression tests. The September 2026 local run had no unexpected request failures, rejected all 100 duplicate replays, and observed read p95 latency of about 0.95–2.22 seconds with peak process RSS around 272 MiB. Those results describe one local machine and fixture distribution, not 1,000 simultaneous production users or a hosting-capacity guarantee.

Repeat a representative workload on the intended staging resources before making a capacity claim. Include actual database/network latency and hosting memory limits, without using live student records or loading the production service.

## Migration rehearsal

Rehearsal is separate from the synthetic suite: it reads the explicitly named source database and copies records into a temporary local database. It can therefore involve private student data even though it does not write to the source.

```sh
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' node --env-file=backend/.env backend/scripts/rehearse-stage2.js --database PROJECT_DATABASE
```

Replace the placeholder with the source database named in `MIGRATION_MONGO_URI` or `MONGO_URI`. The script checks migration references, repeat application, and exact rollback on the local copy, avoids printing source records, and removes its temporary database. Use a secured development machine and a source backup where appropriate. Rehearsal does not replace an independent backup or authorize bypassing the live rollback guard; follow [Deployment](DEPLOYMENT.md#prepare-the-database).

## Verification boundaries and troubleshooting

- **Missing `TEST_MONGO_URI`:** integration tests need the explicit local replica-set target. Skipped database tests are not a complete release check.
- **Transactions fail:** confirm the container is a replica set with a writable primary, and the URI includes `replicaSet=rs0`.
- **Container/port already exists:** reuse the named test container or deliberately choose another isolated loopback port and update the URI. Do not reset a regular development or production database to resolve the conflict.
- **Preview ports are occupied:** stop the earlier preview with `Ctrl+C` before starting another instance.
- **Frontend build succeeds but requests localhost:** correct the build-time environment, then rebuild; this is independent of test success.
- **Hosted login/storage:** automated tests use injected or synthetic identity/storage behavior. The actual S3/Cloudinary canary passed on 23 September 2026, but hosted Google login remained blocked by the suspended old API. See the current [deployment verification record](DEPLOYMENT.md#last-verified-state--23-september-2026).

Use [API](API.md), [Data model](DATA_MODEL.md), and [Workflows](WORKFLOWS.md) to choose regression cases for changed behavior. [Security](SECURITY.md) describes the access and resource limits those tests must preserve; [Architecture](ARCHITECTURE.md) explains where the behavior belongs.
