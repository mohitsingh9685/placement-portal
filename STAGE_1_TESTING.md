# Stage 1 verification and rollout

This document records the stage 1 baseline. Stage 2 moves administrators from student/approval records into `admins`; use [the stage 2 checklist](STAGE_2_TESTING.md) for the current model, preview and migration requirements.

## Automated local checks

Run `npm run check` from the repository root after installing both dependency sets with `npm ci`.

Latest local result (2026-09-20): 19 backend tests and 12 frontend tests passed; ESLint and the production build passed.

- Backend tests send real HTTP requests to an ephemeral loopback Express server. Google verification and MongoDB model operations use synthetic test doubles; MongoDB is never connected.
- Coverage includes allowlist admission/revocation, Google identity binding, independent device sessions, logout, refresh expiry and concurrency, admin authorization, cross-site requests, validation, private profile responses, deadline checks, duplicate application handling, cookie flags, configuration, and bounded Redis failure.
- Frontend tests cover shared refresh requests, one-retry limits, denied/revoked sessions, temporary network/server failures, routing destinations and eligibility.
- ESLint and the production Vite build are required. GitHub Actions runs the same checks on pull requests and main/master pushes.

These checks do not replace real MongoDB integration, Google OAuth, browser cookie-policy, file-storage or load tests. No live cloud services were modified or exercised by the automated suite.

Local browser smoke checks used synthetic persistence, a mocked Google button, and loopback-only servers. Verified returning student/admin sessions with invalid access cookies and valid refresh sessions, student/admin route separation, new-student profile completion, saving academics and dashboard updates, editing active/total backlogs, rejecting a blank CGPA, logout, guest access restrictions, and the connection-retry screen. These were functional checks, not a production-domain or visual audit.

## Session behavior

Access cookies last 15 minutes. Each Google login creates a separate seven-day session in `authsessions`; only a SHA-256 digest of its refresh token is stored. Refresh issues an access cookie without extending the session or replacing other devices' sessions. Logout revokes that browser's session. Protected requests check session expiry and the current active email approval and role.

The new token format intentionally rejects old tokens: existing users must sign in once after rollout. The obsolete `students.refreshToken` field is cleared when each account next signs in. No database deletion is needed. The planned `admins` collection and migration belong to stage 2.

## Before deploying stage 1

1. Back up the placement database and test in a separate staging database with separate cloud credentials. Keep Wanderlust and MongoDB's system databases untouched.
2. Configure different random access/refresh secrets of at least 32 characters in staging/Render. Local environment changes do not update Render. Set `NODE_ENV=production`, an HTTPS frontend origin in `CLIENT_URL`, and matching Google client IDs. Ensure `MONGO_URI` explicitly names the intended database.
3. Allow the application to create/read/write/delete `authsessions` in its own database. Verify its TTL index on `expiresAt` and user index; expiry is also enforced by every request, independently of TTL cleanup.
4. Test approved student and admin Google login; reject an unapproved personal Gmail account. Revisit `/` with a valid refresh cookie after access expiry. Repeat on phone and laptop; log out of one and verify the other still works.
5. Disable an approval and verify an already signed-in browser loses access. Recheck student/admin route restrictions, profile saving, company CRUD, applications, and S3/Cloudinary operations against staging resources.
6. Verify cookies in Chrome, Safari and mobile browsers on the actual Vercel/Render domains. Browser third-party-cookie restrictions may require a shared custom parent domain or same-origin API proxy. Check allowed/blocked origins and legitimate upload form requests.
7. Test Redis unavailability and recovery, then run the later capacity plan using synthetic accounts. Current in-memory IP rate limits are starting settings; verify the trusted proxy and campus NAT behavior under the chosen hosting topology.
8. Deploy backend and frontend together, communicate the one-time sign-in, monitor errors, and retain the preceding application release for rollback. Keep compatible additive collections; do not delete databases as a rollback step. Keep distinct secrets even on rollback and expect another sign-in if formats differ.

Staging/cloud checks and capacity testing are pending. Passing local tests is not a certification for 1,000 simultaneous logins.
