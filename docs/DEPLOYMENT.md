# Deployment

Deploy the frontend and API from a compatible revision after preparing the target database. The database contains student records and retained application history; an application rollback is not automatically a database rollback.

For local setup see [Getting started](GETTING_STARTED.md). Review [Architecture](ARCHITECTURE.md), [Data model](DATA_MODEL.md), and [Security](SECURITY.md) before changing infrastructure or persistence behavior. Commands below run from the repository root.

## Hosting and runtime

Use Node.js 22.12 or newer within the Node 22 release line for both builds and the API, matching CI. Vite 7 requires Node 20.19+ or 22.12+; the backend's broader `engines` declaration is not the frontend compatibility requirement.

| Setting | Frontend on Vercel | API on Render |
| --- | --- | --- |
| Root directory | `frontend` | `backend` |
| Install/build | Install: `npm ci`; build: `npm run build` | Build: `npm ci` |
| Output/start | Output: `dist` | Start: `npm start` |
| Runtime | Static React application | Long-running Node.js service |
| Health check | Load the site and a direct application route | `/health` |

[`frontend/vercel.json`](../frontend/vercel.json) contains the SPA rewrite. The repository Dockerfiles and Compose configuration run development servers; they are not production images. Render supplies `PORT`; set `NODE_ENV=production`. The API currently trusts one reverse proxy, so confirm the deployed proxy topology matches that setting.

`/health` confirms that the HTTP process responds. It does not exercise Google login, every database index, Redis, or cloud storage.

## Environment configuration

Keep backend secrets in the hosting provider's environment settings. Use the tracked environment examples described in [Getting started](GETTING_STARTED.md); never commit real environment files.

| Location | Variables | Requirements |
| --- | --- | --- |
| Backend identity and API | `MONGO_URI`, `GOOGLE_CLIENT_ID`, `CLIENT_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | MongoDB URI names the intended database. `CLIENT_URL` is the exact HTTPS frontend origin without a path. Token secrets differ and each contain at least 32 characters. |
| Backend S3 | `AWS_BUCKET_NAME`, `AWS_BUCKET_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Private document bucket; credentials permit the application's object operations. |
| Backend Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Signed profile-photo uploads and deletion. |
| Backend Redis, if used | `REDIS_URL` | Use authenticated TLS (`rediss://`) for a hosted Redis service. |
| Migration process, optional | `MIGRATION_MONGO_URI` | Separate migration credential; overrides `MONGO_URI` in database setup scripts. Do not add migration privileges to the API merely to run setup. |
| Frontend build | `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` | API URL ends in `/api`; Google client ID matches the backend. Both are public build-time values. |

Google's authorized JavaScript origins must include the exact frontend origin. Backend environment validation covers the core variables, but storage credentials still need an operational check. Restart the API after changing its environment; rebuild the frontend after changing `VITE_*` values.

### Avoid deploying a localhost build

Vite loads `frontend/.env.local` during local production builds, where it can override `.env`. A successful build can therefore still point to localhost. Prefer a clean hosted build using Vercel's production variables. For an explicit local build, shell variables take precedence:

```sh
VITE_API_URL='https://api.example.invalid/api' VITE_GOOGLE_CLIENT_ID='YOUR_PUBLIC_GOOGLE_CLIENT_ID' npm --prefix frontend run build
```

Replace the placeholders, then inspect the browser's actual API requests. Do not upload a previously generated `dist` directory without checking its target.

## Prepare the database

MongoDB must support transactions: use a replica set or Atlas, not a standalone server. Automatic collection creation and indexing are disabled. Model declarations alone do not install indexes.

The existing script filenames are stable operational interfaces. For a new environment or an older schema, run these inspections in order, replacing `PROJECT_DATABASE` with the exact database name in the configured URI:

```sh
node --env-file=backend/.env backend/scripts/migrate-stage2.js --database PROJECT_DATABASE
node --env-file=backend/.env backend/scripts/setup-stage4.js --database PROJECT_DATABASE
node --env-file=backend/.env backend/scripts/setup-stage5.js --database PROJECT_DATABASE
node --env-file=backend/.env backend/scripts/setup-stage6.js --database PROJECT_DATABASE
```

| Script | Purpose |
| --- | --- |
| `migrate-stage2.js` | Foundation account/drive/role/resume migration, preserved application snapshots, and core indexes. |
| `setup-stage4.js` | Notification, read-receipt, and saved-opportunity collections/indexes. |
| `setup-stage5.js` | Recruitment results, placement policy, and related application indexes. Creates a default policy only when absent. |
| `setup-stage6.js` | List/report indexes on current collections. |

These commands default to inspection. The setup inspections describe intended definitions; they are not a complete comparison of all live indexes. After reviewing the target and output, repeat each required command with `--apply`, in the same order. The setup scripts are additive and repeatable; they do not drop existing indexes. A failed or interrupted foundation migration can be rerun after resolving its reported conflict.

Before an account/schema migration, take an independent database backup and verify a restore into an isolated database. Stop all API writers, including local servers connected to that database. Rehearse the migration as described in [Testing](TESTING.md#migration-rehearsal). Never overlap the old account-model API with the migrated release.

Startup requires the `stage2-v1` migration record with `status: APPLIED` and `indexesReady: true`, plus the actual unique `applications.student_drive_unique` index. This check does not replace later setup. Compare the target's installed indexes with the current models and setup definitions, including unique, sparse, TTL, and partial-index options. See [Data model](DATA_MODEL.md#constraints-and-indexes).

### Initial Super Admin

For the first owner, bootstrap an existing active administrator:

```sh
node --env-file=backend/.env backend/scripts/bootstrap-super-admin.js --database PROJECT_DATABASE --email owner@example.invalid
```

Inspect the result, then repeat with `--apply` for the intended real account. The script requires an exact database match and refuses to promote a different owner once a Super Admin exists. Later account management belongs in the Admins page; see [Workflows](WORKFLOWS.md).

## Release and verify

1. Run the checks in [Testing](TESTING.md) against the release revision. Record frontend/backend revisions and the target database privately.
2. Prepare any required schema/index changes and deploy a compatible API. Check startup logs and `/health` before enabling traffic.
3. Deploy a clean frontend build. Confirm its API origin, Google client ID, and direct-route navigation.
4. Use designated student and staff test accounts to verify Google sign-in, page reload, session refresh, logout, and permission denial. Check that disabled/revoked access cannot continue using an old session.
5. Exercise a synthetic application and its permitted staff review, plus the upload/download path through the deployed UI. Verify recipient/owner boundaries using the [API](API.md) contracts. Keep test records identifiable and clean up only records created for the check when workflow retention allows it.
6. Observe response errors, latency, process memory, database connection behavior, and provider failures under a representative workload before expanding traffic.

Production cookies are `HttpOnly`, `Secure`, and `SameSite=None`. A Vercel frontend and Render API on separate sites can encounter browser third-party-cookie restrictions. Test the browsers users will use; consider frontend/API custom domains on the same site if cross-site cookies prevent login. Do not weaken origin or cookie protections to make a failed test pass.

Provider verification should use a tiny, uniquely named synthetic object: confirm private S3 access, a short-lived signed download, expiry, deletion, and absence afterward. Check versioning before cleanup and delete only the exact object/version created. A Cloudinary check should likewise upload and delete only its generated image. Avoid listing or downloading student documents. This provider check complements, but does not replace, the deployed endpoint/UI check.

## Backup and recovery

Backups must include the database collections, indexes/options, migration metadata, and retained histories needed for a consistent restore. MongoDB backups do not contain S3 or Cloudinary file bytes. Document the storage retention/recovery policy separately, and test recovery of both metadata and referenced files.

`private-data/` is an optional, ignored local location for private backups, roster exports, and reconciliation reports. It is not required to run the app. Its contents may contain student records or sensitive operational data; do not serve it, commit it, or publish it as a CI artifact. In-database `migrationbackups` also contain sensitive copies and are not an independent backup.

For an ordinary code regression, prefer a compatible previous application revision or a forward fix. Retain the matching frontend/backend release references. Never drop uniqueness constraints to make a rollback start.

Foundation migration rollback is deliberately narrow:

```sh
node --env-file=backend/.env backend/scripts/migrate-stage2.js --rollback --database PROJECT_DATABASE
```

It requires all writers stopped, an unchanged post-migration fingerprint, and the complete set of recorded backup operations. Later logins, session expiry, imports, applications, or other tracked activity can make it refuse. Missing or purged backup operations also block rollback. Do not bypass these guards. A database with subsequent activity needs a forward-compatible repair or a verified backup restore that accounts for later writes, followed by a matching application release.

The old local exports/archives and foundation migration-backup records were removed at the owner's request on 23 September 2026. Live records, indexes, and the applied migration marker were preserved. Foundation rollback is unavailable for this environment; take a fresh independent backup before future migrations.

## Last verified state — 23 September 2026

These observations apply to that check and the credentials/environment used; they are not continuous monitoring or a guarantee about a later release.

| Area | Result |
| --- | --- |
| Automated verification | Repository cleanup: 236 tests passed with none skipped, plus frontend lint/build. Subsequent backup-retirement safeguard: all 19 migration integration tests passed. Test scope is documented in [Testing](TESTING.md). |
| Database | Replica-set connection and foundation migration verified. Ten previously missing performance indexes were installed; the follow-up confirmed all 32 expected indexes across 17 collections, including all eight expected uniqueness constraints. |
| Redis | Authenticated TLS connection and ping passed. |
| S3 | Public-access blocking, owner-only access, enforced ownership, and encryption checked. One synthetic object passed write, anonymous denial, signed exact-byte download, expiry, and deletion; absence confirmed. |
| Cloudinary | Authenticated configuration check and one synthetic image upload/delivery/deletion passed; absence confirmed. No verification objects remained in either provider. |
| Hosted frontend | HTTPS responded, but the hosted bundle was an older release. The local production build also needed its localhost environment override corrected before deployment. |
| Hosted API/login | The old hosted API returned `503 Service Suspended`. Real hosted Google login and deployed UI-to-storage workflows remain unverified. Deploy the compatible API release rather than resuming old code against the migrated database. |

Cloud checks used locally configured credentials; confirm the deployed service uses the intended credentials and environment. For maintenance changes and review expectations, see [Contributing](CONTRIBUTING.md).
