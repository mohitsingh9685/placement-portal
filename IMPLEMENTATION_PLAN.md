# Placement portal: six-stage implementation plan

Production databases and cloud resources are not test environments. All stages require meaningful regression checks and a recorded deployment checklist.

## 1. Authentication, reliability, and regression foundation — implemented and verified locally

- Separate JWT signing secrets and token types; reject invalid configuration.
- Restore sessions across visits and support independent phone/laptop sessions.
- Check current email approval and role on protected requests; revoke sessions on logout.
- Add CSRF protection, request validation, consistent errors, and bounded Redis fallback.
- Fix Google photos, incomplete profile responses, and lint issues.
- Add automated authentication, authorization, HTTP/API and frontend checks plus CI.
- Real Google login and production cookies require staging verification before deployment.

Local checks: automated API/frontend regressions, clean ESLint and Vite build, plus browser checks with synthetic student/admin/guest accounts. See [verification and rollout checklist](STAGE_1_TESTING.md). No Atlas data or live cloud settings were changed. Commit f573769 was pushed to main; GitHub regression/build/deploy checks and Vercel status passed. Full production Google/cloud smoke testing remains separate.

## 2. Data model and student administration — implemented; Atlas migrated; deployment pending

- **Add an `admins` collection inside the `placement-portal` database**, alongside students, applications, and companies. This is not a frontend folder or separate app.
- **Super Admin management:** the first owner has full administrative access and can add staff, assign/revoke permissions and disable/restore access. Current account permissions are enforced by the API; changes revoke sessions. Edit/remove/restore actions apply only to other ordinary admins. Every Super Admin account is protected in both the UI and API, including against concurrent requests. See [setup and verification](SUPER_ADMIN_TESTING.md).
- Rehearse migration of existing admin accounts, company creator references, authentication lookups, and sessions. Preserve references and do not delete the current database.
- Introduce Company → Drive → Roles → Stages and role-specific applications.
- Import the college's approved personal Gmail roster with duplicate/error reporting; student imports cannot grant admin access.
- No staff verification step: students update academic details directly with validation. Add batch management, 10th/12th marks, complete profile fields, immutable application snapshots, and resume versions.
- Define compensation units and maintain currently unused eligibility/count/placement fields.
- Test migration on an isolated database copy, indexes, references, duplicates, validation, and rollback.

Verification: 65 automated checks (21 backend, 15 frontend, 29 real-MongoDB integration), clean lint/build, and browser checks of roster management, academic editing and Super Admin permissions. A read-only copy rehearsal passed application-reference checks, repeated apply and exact-record rollback. On September 20, after suspending Render and verifying an independent backup restore, the live `placement-portal` migration completed. Admin identity, all 9 applications, historical snapshots/statuses, resume references and indexes passed verification. Four pre-existing unresolved company creator references are preserved and reported. Mohit imported the student CSV; read-only comparison confirmed all 788 addresses, with no missing or extra entries. After another verified backup, his existing administrator became the first Super Admin. Deployment and real Google/cloud checks remain pending. See [stage 2 preview, testing and coordinated rollout](STAGE_2_TESTING.md).

Accepted decisions: no staff academic verification; one role per student per drive. Legacy single-role listings remain usable in the new Stage 3 publishing editor; missing job types and pay units must be confirmed before publishing edits. Keep the old backend stopped and deploy the matching release before reopening the portal.

## 3. Admin drive publishing — implemented and verified locally

- Company description, application deadline, and an Add role action.
- A switcher beside Add role displays one role box at a time; adding selects the new role, switching preserves edits, and saving includes all roles.
- Admin dashboard company cards open a role-card page. Each role opens its own applicant list, counts and result actions; role links survive refresh, and Back to roles returns to the choices. Inactive roles remain reviewable by admins with application access.
- Per-role title, domain, location, employment type, optional experience/vacancies, one multiline compensation-details field, and eligibility. Existing numeric salary/stipend values become editable text with their known units preserved.
- Diploma lateral-entry profiles retain B.Tech as their current course and collect diploma details instead of 12th marks. The admin editor accepts 12th or diploma entry with all three school cutoff fields visible and no qualification restriction dropdown.
- Shared five-course catalog: B.Tech, B.Com, M.Com, BBA and MBA. Admins select multiple courses with a visible branch panel for each (or all); students choose one course and its related branch. Eligibility keeps each course/branch pair separate. Labeled up/down round controls and separated Edit drive action.
- Multiple shared/per-role PDFs, Word documents, and images; one shared recruitment-round editor. Existing conflicting applicant round plans remain protected and are identified at the shared editor.
- Upload replacements before retiring old objects, retain application-referenced documents, correct content types, and invalidate cached JD metadata.
- Draft → Publish → Close, reopening with a future deadline, revision conflict checks and protected applicant history.
- Student role selection and saved role/pay/document/round snapshots support the publishing flow.
- Tested role isolation, deadline/time-zone boundaries, uploads, permissions, document history, failure recovery and application/edit races.

Verification: **115 automated tests** (32 backend, 29 frontend, 54 MongoDB integration), clean lint/build, and synthetic browser checks of two-role publishing, shared uploads, descriptive pay, all five course/branch panels, qualification cutoffs, shared rounds and student applications. Admin role cards, role-scoped counts and updates, refresh/back navigation and read-only access were also checked. Role cards and applicant pages fit at 390 pixels. No new migration or Atlas edits were required. See [Stage 3 workflow and testing](STAGE_3_TESTING.md).

## 4. Student applications — planned

- Explain eligibility; enforce deadlines, completed/valid academics, and configured resume requirements server-side.
- Enforce the agreed policy: one role per student per drive, including simultaneous submissions.
- Snapshot submitted details/resume versions; prevent duplicate applications safely.
- Application timeline, saved opportunities, in-app notifications, calendar/reminders, profile checklist, withdrawal/correction requests.
- Test invalid/missing academics, closed drives, duplicate races, and later profile changes.

## 5. Recruiter exports, rounds, and offers — planned

- Excel/CSV exports scoped to drive, role and round, including name, email, enrolment number and selected academic columns.
- Paste/import recruiter emails, normalize/deduplicate, flag unmatched candidates, and preview outcomes.
- Publish final results: advance matched students and reject remaining pending students in that round only. Partial imports leave others pending.
- Distinguish Applied/Pending, shortlist rounds, interviews, Selected, Offered, and Placed.
- Idempotent imports, concurrent-admin safety, audit history, controlled corrections, export/round permissions extending stage 2 staff permissions, offers and configurable college placement policies.
- Test repeated imports, unmatched emails, multiple roles, partial failures, and exported data.

## 6. Reports, capacity, and launch — planned

- Unique placed students versus offers, branch/batch reports, and consistent compensation statistics.
- Count/aggregate endpoints instead of downloading every applicant; server pagination/filter/sort and narrow projections.
- Staging with 1,000 synthetic students and about 20,000 applications; test browsing, exports, results, and agreed deadline bursts.
- Monitoring, backups/restore rehearsal, hosting assessment, email notifications if selected, and rollback procedure.
- Pilot with staff and 30–50 students; record response times, errors and data correctness before wider rollout.

## Open decisions

- Definition of Placed; offer/dream-company policies.
- Staging resources, recruiter export columns, email provider, launch date.
- Guest demo: real public listings/JDs or synthetic data.
- Define how historical SELECTED records should map to future offer states; migration preserved them without assuming accepted offers.

## Explicit follow-up backlog

Attendance, support tickets, preparation resources, and richer recommendations. No automatic applications on behalf of students.

## Testing policy

Automated stage-1 checks use synthetic identities and isolated persistence doubles. Stage 2 adds real isolated MongoDB migration/integration tests. Never seed, load-test, migrate or clean production resources during local checks. Passing local tests does not establish live Google/cloud functionality or deployment capacity.
