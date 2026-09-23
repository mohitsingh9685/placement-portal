# Stage 4: student applications and in-app notifications

Implemented and verified locally on September 21, 2026. Tests use synthetic accounts in disposable localhost databases. This work does not deploy the portal, send email, change Google/AWS/Cloudinary settings, or apply setup to Atlas.

## Try the features

With both local servers running, sign in as an approved student at http://localhost:5173.

1. **Dashboard:** open the profile checklist, save a drive and switch to “Saved drives.” Saved choices survive refresh and sign-in on another device.
2. **Drive:** company details fill the left panel; the profile checklist sits above role cards on the right. Save is beside the company name; this page has no calendar button. The desktop page stays within the viewport, with long descriptions contained inside their panel. Choose a role to open a centered dialog around 60% of the desktop width with a blurred backdrop. Switch between Role details, Eligibility, and Rounds & documents; Escape or Close returns focus to the role card. Each eligibility check explains any failure. The server checks profile completeness, CGPA, course/branch pairs, backlogs, school/diploma marks, batch, registration deadline and any required resume. Admins can enable “Require a resume when applying” for a role. New editor roles default to requiring one; existing roles keep their previous setting.
3. **Apply:** inside the role dialog, choose “Review application,” inspect the details and resume version, acknowledge them, then “Confirm and apply.” The review actions stay visible while long submitted details scroll inside the dialog. Check desktop and mobile sizes, eligible/ineligible roles, and an already-applied drive. If your profile, resume or drive changed since review, review again. A simultaneous second submission cannot create another application or inflate the applicant count.
4. **My applications:** compact rows show company, role, application date, current step and status, with four applications per page. Known rounds show their step number; older or completed records do not invent progress. Click the company name or Details to open a centered dialog around 60% of desktop width with a blurred backdrop. Progress, Submitted details, Documents and Requests have separate tabs; long content scrolls inside the dialog while actions stay visible. Revoke application opens and focuses the withdrawal reason form, and sending it requires placement-team approval. Pending requests disable the shortcut; withdrawn/rejected applications have no revoke button. Notification links open the matching dialog automatically; Show all applications clears the previous search/status view. There is no Reset button on this page. Later profile edits do not silently change an application, and original/approved corrected snapshots remain accessible.
5. **Requests & corrections:** request withdrawal, or update your profile/resume first and send a correction request with a reason. One pending request is allowed at a time. The placement team sees the captured correction; subsequent profile edits do not alter that request. A valid correction that falls below a cutoff can still be submitted: both sides see the eligibility warnings captured when it was sent. Approving records the corrected details and eligibility result without automatically selecting or rejecting the application. Invalid profiles and unowned resume versions are still rejected.
6. **Admin → company → role → applicants:** review the “Student requests” panel. Staff with **Review student requests** permission (previously labeled Update application results) can compare details and approve/decline with a response. An approved correction becomes the accepted snapshot while retaining the original. Withdrawal changes status to Withdrawn and retains the record; it does not permit reapplying to another role in that drive. Read-only reviewers cannot decide requests. Resume access remains permission-controlled.
7. **Notifications:** the full-width inbox has a left sidebar for All notifications, Applications, New companies, Requests, Results & offers, and Reminders. Combine a category with All/Unread/Read status; counts reflect that read filter, while the header and bell keep the global unread count. Filters reset to page one and run on the server before pagination (five updates per page). Reset restores the complete inbox. Mark one notification or the entire inbox as read, and follow links to the matching drive/application. Read state is private to each student and persists across sessions. Categories become a compact grid on mobile.
8. **Saved-drive reminders:** Save beside the company name, then use “Remind me before the deadline” to change the in-app reminder. The calendar shortcut has been removed from the student company page.
9. **Profile:** profile, resume and portfolio occupy the left column; academic details, school details and projects fill the right. Semester results use a compact row; project names and URLs stay visible, with descriptions expandable. At 1680 × 930, verify a profile with six semester results, a project and two extra portfolio links fits without scrolling. On mobile, panels stack without horizontal overflow. Use Edit profile → Add link to save named portfolio URLs; check reload, removal and Cancel. Links are included in new application snapshots, while earlier submissions retain their original details. Skills and Contact sections are removed; profile saves omit those fields so existing values remain stored. Check diploma entry, semester/project editing and resume history. Photo and resume uploads have their own Upload buttons.

## How notifications work

- Publication creates one shared announcement; each student has their own read receipt. New accounts do not receive broadcasts from before their account was created. Existing migrated drives are not backfilled with old announcements.
- Submissions, status changes and request decisions create private notifications in the same database transaction as the action. Retrying the same event does not duplicate it.
- Saving a drive enables an in-portal reminder by default. The drive page lets the student turn it off. A reminder appears during the final 24 hours while the drive remains open and the student has not applied. Closing/rescheduling the drive, applying, unsaving or turning reminders off suppresses obsolete reminders on refresh.
- The client refreshes every 60 seconds when visible, on returning to the tab and after relevant actions. There is no background email, browser push or delivery while the portal is closed. The page requests five notifications at a time; the API defaults to 20 and caps requests at 20. Category counts and global unread counts cover all visible notifications, including other pages.
- Notification data lives in `notifications`, per-student read receipts in `notificationreads`, and bookmarks/preferences in `savedopportunities`. No new credentials or packages are needed.

## Automated verification

```bash
npm run check
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

Integration tests require the disposable MongoDB replica set described in `STAGE_2_TESTING.md`. They reject non-local database targets and drop their own randomly named databases afterward. Never point them at Atlas.

Verified after the Stage 4 audit: 142 tests — 32 backend unit/API, 33 frontend utility, and 77 real-MongoDB integration tests — plus ESLint and the Vite production build. The 23 Stage 4 integration cases cover preview privacy, eligibility/deadlines, diploma entry, resume ownership, stale review versions, competing applications, transactional rollback, private notifications/read receipts, pagination, saved reminders, request permissions/concurrency, withdrawn records, correction eligibility warnings, response validation and immutable original/corrected resume versions. Frontend tests cover delayed application responses as well as calendar timezone conversion, Unicode line folding and escaping.

Audit fixes:

- A corrected CGPA below the role cutoff no longer prevents a student from reporting accurate details; the request carries explicit eligibility warnings for staff review.
- Refreshing drive details clears the confirmation. Role choices are locked during review/submission requests so a late response cannot be shown for a different chosen role.
- A delayed application refresh cannot overwrite a newer request or decision already shown on the page.
- The admin response explains its 3–1,000 character requirement, clears an old error as the response is edited, and accepts a trimmed response such as `Done`.

Additional browser verification exercised a profile change after review, switching between eligible/ineligible roles, fresh confirmation, a below-cutoff correction on both student/admin screens, invalid/valid admin responses, and approval retaining In review status while showing the corrected CGPA. No browser console errors were recorded in this workflow.

The company/role layout was checked at 1680 × 930 and 390 × 844 using long synthetic descriptions. The desktop document stays at viewport height, the role dialog uses 60% desktop width with a blurred backdrop, and dialog actions remain visible while content scrolls. Browser checks covered tab keyboard navigation, Escape/focus restoration, switching roles, Save placement, confirmation reset and a successful synthetic application. All 37 frontend tests, ESLint and the production build passed after this update.

The applications redesign was checked at 1680 × 930, 1366 × 768 and 390 × 844. Four rows fit without scrolling at both desktop sizes; the default submitted-details and request panels also fit the mobile dialog. Verified current interview step, pagination/search/status combinations, notification deep links, keyboard tabs/Escape, focus restoration, validation, and successful synthetic withdrawal/correction requests. Request responses remain in the open dialog while the list refreshes. Expanded details remain contained with visible footer actions. All 40 frontend tests, ESLint and the production build passed.

The notification redesign was checked at 1680 × 930, 1366 × 768 and 390 × 844. Five normal notifications fit the larger desktop list without scrolling; smaller desktop screens contain overflow inside the list with pagination still visible. Mobile categories and notifications have no horizontal overflow. Browser checks covered category/read combinations, reset, pagination, mark-one/read-all, empty states, and an application deep link that also marks the notification read. All 43 backend checks, 40 frontend tests, 25 student-experience integration tests, ESLint and the production build passed. The integration tests verify filtering before pagination, private category counts, hidden/expired announcements, input limits and inbox-wide read-all behavior from a filtered view.

Browser checks use the synthetic preview: eligible/ineligible roles, save/reminder state, application review and confirmation, original/accepted details, correction review, notifications and deep links. Student and admin views were checked at a mobile viewport. Real Google login and live cloud storage remain separate deployment checks. This is not a 1,000-student load-test result; capacity testing remains Stage 6.

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
```

This shared preview now includes a two-role Stage 4 drive. Its printed links switch between synthetic student/admin/read-only accounts. It disables real Google and cloud uploads and removes its database on Ctrl+C.

## One-time setup before rollout

Stage 2 migration remains a prerequisite. Stage 4 only adds collections/indexes; it does not reset the database, move users, import a roster, or rewrite existing applications. Run this against the intended database after reviewing the target and taking the normal release backup. The script requires the database name to match the connection URI and is a dry run unless `--apply` is supplied.

From the project root, if `backend/.env` contains the intended URI:

```bash
node --env-file=backend/.env backend/scripts/setup-stage4.js --database placement-portal
node --env-file=backend/.env backend/scripts/setup-stage4.js --database placement-portal --apply
```

In an environment that already supplies `MONGO_URI` or `MIGRATION_MONGO_URI`, use `npm --prefix backend run setup:stage4 -- --database placement-portal` and then the same command with `--apply`. Use the actual database name for a separate staging environment. The setup is repeatable and creates only `notifications`, `notificationreads` and `savedopportunities` plus their indexes. It has been tested on disposable data and **has not been run on Atlas as part of Stage 4**.

Deploy matching frontend/backend code, then check approved Google sign-in, viewing a saved resume version, a synthetic permitted application, notifications and staff request decisions. Keep the release backup; an older backend does not understand Withdrawn status or accepted correction snapshots, so review compatibility before rolling back code after new activity.

## Next stage

Stage 5 adds recruiter Excel/CSV exports, shortlist imports, configurable round progression and offers/placement rules. The current timeline records actual submission, status and request events; it does not claim that a planned test/interview round was passed. Future exports should use `effectiveSnapshot` for accepted corrections while keeping `snapshot` as the original record.
