# Stage 2: verification and rollout

Stage 2 is implemented locally. **The live `placement-portal` Atlas database was migrated and verified on September 20, 2026. Mohit imported the 788-address CSV, and his existing administrator was promoted to Super Admin after a verified backup. The matching code has not yet been pushed or deployed.** Render remains suspended. Test locally before committing or pushing; keep the old Render backend stopped until the matching release is ready.

## What changed

- `admins` is a collection inside `placement-portal`. Staff authentication uses that collection; student access uses `approvedstudents` plus `students`. An import cannot create an administrator.
- Super Admin → Admins supports staff creation, permission grants/revocation and disable/restore access. Permission changes revoke staff sessions; every Super Admin account is protected from edits/removal in the account-management UI and API. Only ordinary admins have management actions. See [Super Admin setup and verification](SUPER_ADMIN_TESTING.md).
- Admin → Students supports email lists/CSV, preview, invalid/duplicate reporting, import, search, branch/year/access filters, pagination and roster edits. Stale edits return a conflict. Disabling a student revokes their device sessions.
- Students edit academics directly, with server validation and no staff approval. The profile includes school percentages, semester results, projects and portfolio links.
- Company → Drive → JobRole → recruitment-stage schemas are in place. Existing company screens still publish one role; the full multi-role publishing UI belongs to stage 3.
- A unique `(student, drive)` index enforces **one role per student per drive**, including concurrent requests. New applications retain submitted profile data and the resume version. Profile edits do not rewrite applications.
- New resume uploads retain older versions. Failed uploads clean up only an unreferenced replacement. An uncertain commit response never deletes a referenced resume.
- Salary/stipend amounts carry a currency and annual/monthly period. Legacy amounts retain their numeric value with unspecified units; administrators must confirm those units. Applicant counts are maintained transactionally. `SELECTED` does not automatically mean `PLACED`.
- Migration backups and audit records are stored in the same database. Server startup requires completed migration/index installation; it does not automatically alter the database.

## Automated checks

Run from the repository root with Node 22 or newer:

```bash
npm run check
```

This runs 21 backend checks, 15 frontend checks, ESLint and the production frontend build. These checks use synthetic Google verification and persistence; no Atlas, Google, S3 or Cloudinary calls are made.

Database integration requires a **disposable localhost MongoDB replica set** because the application uses transactions. The test command refuses Atlas/non-local targets and creates/drops its own randomly named database.

Start the local container once (Docker Desktop must be running):

```bash
docker run -d --name placement-stage2-test-mongo -p 127.0.0.1:27028:27028 mongo:7.0 mongod --replSet rs0 --bind_ip_all --port 27028
```

After MongoDB is ready, initialize its replica set once:

```bash
docker exec placement-stage2-test-mongo mongosh --quiet --port 27028 --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27028"}]})'
```

If this named container already exists, use `docker start placement-stage2-test-mongo`; do not run initialization again. This container was created during local verification and is separate from the application containers.

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

The original 15 real-MongoDB integration tests cover migration/rollback/idempotency, interrupted index installation, admin authentication, roster permissions, a 1,000-row import, pagination, concurrent roster edits, session revocation, academic validation, compensation, simultaneous role applications, snapshots and resume failure recovery. Another 14 integration checks cover Super Admin bootstrap, permissions, privilege escalation, revoked sessions and concurrent access changes, bringing the suite to 29 integration tests. CI runs the same checks against its own disposable replica set. A 1,000-row import is **not** a test of 1,000 simultaneous logins; capacity testing remains stage 6.

## Inspect the screens without changing Atlas

With the local MongoDB container running:

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
```

Open either link:

- Super Admin: <http://localhost:9107/__fixture/admin>
- Read-only Admin: <http://localhost:9107/__fixture/limited-admin>
- Student: <http://localhost:9107/__fixture/student>
- First-time student profile: <http://localhost:9107/__fixture/new-student>

These create synthetic sessions and redirect to the preview frontend on port 5187. Google sign-in, cloud uploads and signed document downloads are disabled. Roster/profile/application interactions use only a disposable local database. Ctrl+C stops the preview and removes its database.

Browser checks performed locally:

1. Import preview shows duplicate/invalid rows and disables confirmation until errors are fixed.
2. A valid import appears in the roster; branch edits and access disabling persist.
3. Students save school marks, semester results and a project directly, then reload and see the saved values.
4. Resume history shows the retained current version.

The first-time profile asks students to confirm their name from college records, starting with the Google display name. Their verified sign-in email stays fixed. Email-roster imports do not create completed student profiles: students submit their own details after signing in. The local `private-data/` folder is excluded from Git and can hold prepared college roster files; import CSV files through Admin → Students → Upload CSV → Preview import → Approve. This works in the local app against migrated Atlas; a Git push is not required.

## Migration preview and copy rehearsal

Commands below read the explicit `placement-portal` database from `backend/.env`. They do not choose MongoDB's default `test` database. Use a database-scoped credential, and never paste the URI or credentials into Git/chat.

**Read-only preview:**

```bash
node --env-file=backend/.env backend/scripts/migrate-stage2.js --dry-run --database placement-portal
```

**Rehearse on a temporary local copy:**

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' node --env-file=backend/.env backend/scripts/rehearse-stage2.js --database placement-portal
```

The rehearsal reads source records consistently, copies them only into a newly named localhost database, verifies application references, reapplies idempotently, rolls back and compares restored records exactly. It then deletes the local copy. It never writes to the source database or prints the student records.

The September 20, 2026 rehearsal found **1 admin, 7 students, 8 companies and 9 applications**, with 57 document operations and 5 current resumes to version. Reference checks, repeated apply and exact-record rollback passed. There were no blocking conflicts. Four companies already had unresolved creator IDs; those IDs are retained, not reassigned to an invented owner. A fresh dry-run is required at rollout because live data can change.

Migration preserves account IDs, company ownership IDs, application relationships and session types. Existing applications keep their original snapshot and are marked `legacyIncomplete`; old resumes/academics cannot be reconstructed if they were never stored. The admin applicant screen labels a legacy current-resume fallback explicitly. Existing `SELECTED` states and placement status are retained without inventing offer outcomes.

## Coordinated live rollout — migration complete; deployment pending

**Do not casually push this release into automatic deployment before arranging the database migration.** Stage 1 and stage 2 use different staff/account models; a rolling overlap against the same database is unsafe.

Steps 1–3 below were completed for this rollout. Mohit is testing the updated source locally before deciding when to commit and push. Git commit/push is not required to run the local app; it supplies the source for GitHub-connected deployment. The steps remain documented for future rehearsals and recovery.

1. Take a verified database backup/snapshot including sessions and all placement collections. The Render dashboard inspected on September 20 still showed backend commit `f81698b` live; `f573769` is the local stage 1 source baseline, not a verified live Render deployment. Retain the actual working backend/frontend deployment references. Configure Render/Vercel deployment timing so both releases can be coordinated.
2. Put the portal into a maintenance window and stop all old backend instances and other writers using this database, including local Docker. Keep writes stopped through migration and initial checks. Leave Wanderlust and unrelated databases alone.
3. Run the dry-run against the intended database. Resolve blocking conflicts and review warnings. Then, from this release's repository root, explicitly apply:

   ```bash
   node --env-file=backend/.env backend/scripts/migrate-stage2.js --apply --database placement-portal
   ```

   This command writes migration backups before changing records, moves the legacy staff account out of `students`/`approvedstudents`, creates `admins`, creates drive/role/resume records, updates applications and installs indexes. It does not drop the database. If index installation fails, startup remains blocked; fix the reported issue and rerun `--apply` to finish safely.

4. Deploy the matching backend and frontend. Verify `/health`, the `stage2-v1` migration record (`status: APPLIED`, `indexesReady: true`) and the unique `student_drive_unique` application index. Do not start the old backend against the migrated database.
5. Check real Google login with both accounts, deny an unapproved Gmail, verify admin/student route separation, and test Cloudinary/S3 using designated test accounts/files. Read-only copy testing and mocked uploads do not establish real cloud functionality. Resume uploads now retain versions, so confirm the storage retention policy does not expire documents still used by applications.
6. Open the portal after the checks pass. To run the local application against the migrated database, recreate its containers so the environment is current:

   ```bash
   docker compose up -d --build --force-recreate backend frontend
   ```

No new Google/AWS/Cloudinary credentials are required solely for these model changes. Existing environment settings remain in use. Keep the live URI scoped to `placement-portal`; no cluster reset or deletion of `admin`, `local`, `wanderLust` or other databases is needed.

Before deployment, verify the live Render environment meets the stage 1 requirements: distinct `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` values of at least 32 characters, plus `MONGO_URI`, `GOOGLE_CLIENT_ID` and the correct production `CLIENT_URL`. These variable names were confirmed present in Render on September 20; their secret values were not exposed or changed. Value validation and real deployment checks remain pending. The last deployed backend is still the older release, currently suspended.

### Rollout preparation recorded September 20, 2026

- Mohit confirmed Render Auto-Deploy was set to Off. This leaves the existing backend running.
- A private MongoDB archive was saved under `private-data/backups/2026-09-20T13-54-51.415Z/`. It includes all five existing application collections and 35 documents. Restoring to an isolated localhost database reproduced every document, collection option and index exactly; the temporary database was then removed. `verification.json` records the archive checksum and counts. This is a database backup; S3 and Cloudinary file contents are outside its scope.
- Atlas was only read during that preliminary backup. After Render suspension was confirmed, a fresh archive was saved under `private-data/backups/2026-09-20T13-59-20.695Z/`. Its 35 documents, collection options and indexes also passed exact local restore comparison. The verification database was removed and its local container stopped.
- The prepared roster CSV contains 788 unique addresses: 787 from the PDF and one additional Gmail address confirmed by Mohit. It passes the portal parser and remains local in Git-ignored `private-data/`; Mohit later imported it into Atlas. Read-only comparison at 15:07 UTC confirmed exactly 788 active entries matching the CSV, with no missing addresses, outside entries or staff conflicts.
- The fresh migration preview had no blocking conflicts. `stage2-v1` was applied at 14:00:30 UTC (19:30:30 IST). Atlas verification at 14:02:36 UTC confirmed `APPLIED`, `indexesReady: true`, all 57 backed-up document changes matching the migration plan, and the unique student/drive application index.
- Immediately after migration, the live database contained 1 admin, 7 students, 8 approved student entries, 8 companies, 8 drives, 8 roles, 9 applications and 5 resume versions. The administrator retained the same account ID and Google identity. Application relationships, existing statuses/snapshots, resume object keys and session references were verified. Four pre-existing unresolved company creator references remain preserved.
- The private verification report is `private-data/stage2-atlas-migration-verification.json`. No database reset or roster import was performed by that migration. Mohit subsequently imported the roster through the local UI. Git commit/push is left to Mohit.
- After migration verification, the updated local backend/frontend were rebuilt and started for Mohit's testing before committing. Backend `/health` and the frontend return HTTP 200, unauthenticated profile/refresh requests correctly return 401, and local CORS and the served API URL were verified. Browser refresh/login still requires user verification. This local app uses the migrated Atlas database, so subsequent logins or edits count as post-migration activity for rollback. Render remains suspended.

### Super Admin addition

A fresh independent backup at `private-data/backups/2026-09-20T15-07-09.862Z/` passed exact local restore comparison. The existing owner account was then promoted to `super_admin` without changing its ID or Google identity. Read-only verification at 15:11 UTC confirmed one active Super Admin, revoked old owner sessions, an audit record, and unchanged counts of 7 students, 788 approvals, 8 companies, 8 drives, 8 roles, 9 applications and 6 resume versions. The sixth resume version predates this change. Details and recovery considerations are in [Super Admin testing](SUPER_ADMIN_TESTING.md). The updated local app was rebuilt and restarted: health/frontend returned 200, unauthenticated admin requests returned 401, and the new screen was verified. The owner must sign in again.

## Rollback

With all writers stopped, and **only if no tracked records have changed since migration**:

```bash
node --env-file=backend/.env backend/scripts/migrate-stage2.js --rollback --database placement-portal
```

The guard includes sessions, imports and audit records: even login or TTL expiry can cause it to refuse rollback. This prevents overwriting newer activity. The command restores original documents and the legacy student/company unique index. Compatible additional indexes and migration backup/history collections remain. Restart the previous backend/frontend together only after rollback succeeds.

After new activity, do not bypass the guard: reconcile or restore the verified backup, accounting for later records. In-database migration backups are not a replacement for an independent database backup.

## Remaining stages

Stage 3 adds the full drive/role publishing form, multiple JDs/images and safe JD replacement/cache updates. Stage 4 adds richer student eligibility/application flows. Stage 5 adds recruiter exports, bulk round results and offers. Stage 6 covers reporting, sustained load and the college pilot. Those features are not completed by the stage 2 schema foundation.
