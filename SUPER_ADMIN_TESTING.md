# Super Admin access management

Implemented as part of stage 2. Both `admin` and `super_admin` accounts live in the existing `placement-portal.admins` collection. Students remain in `students`, with sign-in eligibility controlled by `approvedstudents`.

## Using the feature

1. Sign in with a Super Admin's Google account and open **Admins** in the navigation.
2. Enter the staff member's name and Google account email. Choose **Admin** and select the permissions they need, or **Super Admin** for full administrative access, including management of ordinary admins' permissions.
3. Click **Add admin**. The person can sign in with that exact Google account. The portal does not send an invitation email or create a Google account.
4. Use **Edit** on an ordinary admin to load their settings in the left panel and grant/revoke capabilities or promote that account to Super Admin. After promotion, that account becomes protected too. Email addresses are fixed; an account already in the student roster or student collection cannot also be added as staff.
5. Use **Remove access** to disable an ordinary admin, or **Restore access** to reactivate one. Disabling retains company ownership and activity history. It is not permanent deletion.

Every Super Admin row, including the signed-in account, shows **Protected account** instead of edit/remove/restore controls. The management API rejects all edits to a Super Admin with HTTP 403, even when several Super Admins exist or requests arrive concurrently. Ordinary admin edits still use revision checks; stale forms cannot change an account that has since been promoted.

The full-width desktop layout places **Add an admin** on the left, **Administrator accounts** on the right and **College placement rules** below the accounts. The list requests four accounts per server page; search covers all accounts and returns to page one. Click a permission count to see the complete grants. Narrow screens stack the panels.

Placement rules separate saved settings from pending edits. **Save rules** becomes available only after a change, and **Cancel changes** restores the saved values. Changing the placement milestone recalculates placement status for existing accepted/joined offers; it does not change the offer records themselves. If another admin saves newer rules, **Reload rules** retrieves that version before further editing.

**Profile** shows name, email, role, account status, available account/sign-in dates and allowed permissions. Super Admins see full access, including admin management and placement rules. Ordinary admins see only their assigned permissions. These details are read-only and load from the authenticated profile endpoint; **Refresh** reloads them. The navigation no longer shows a role label beside Logout.

**Recent activity** shows the signed-in admin's latest five saved actions, newest first, with timestamps. The wider desktop profile places account details and permissions on the left and activity on the right; smaller screens stack the panels. Company changes, admin access changes, imports, exports and recruitment actions use the existing audit history. The server limits the response to five and never returns another admin's activity or raw audit details. Company names and admin emails are saved with new management actions so later edits/deletions keep the history readable. Refresh reloads both profile and activity; older audit records remain available internally. No database setup is needed.

## Permissions

| Permission | Allows |
| --- | --- |
| View students | Read the approved email roster and submitted profile summary |
| Manage student access | Import emails and enable/disable students; includes View students |
| Manage companies | Create/edit/delete companies and upload job descriptions |
| View applications | Read applicants and submitted application details |
| Update application results | Change results; includes View applications |
| View student resumes | Request signed student/resume-version links; includes View applications |

An admin with no permissions can sign in, view their own profile and browse company listings. Only Super Admins can manage administrator accounts. Super Admins automatically have all current administrative capabilities; student application actions remain student-only.

API checks use the current account from MongoDB on every request. Browser storage and hidden buttons are not authorization. Changing a role, permissions or active status revokes every session for the affected admin; they must sign in again. Already issued S3 links can remain valid until their five-minute expiry, and downloaded files cannot be recalled. Applicant responses omit stored resume URLs when resume access is absent.

## First Super Admin setup

Use the bootstrap command once for an **existing active administrator** after stage 2 migration. It defaults to read-only, requires an explicit database name matching the configured URI, and refuses to promote a different account after a Super Admin exists. Repeating it for the same Super Admin is idempotent. Later grants happen through the Super Admin screen.

Before applying against a shared database, pause backend writers, take a private backup and verify its restore. Substitute the existing staff email in these commands, run from the repository root:

```bash
node --env-file=backend/.env backend/scripts/bootstrap-super-admin.js --database placement-portal --email owner@example.com
node --env-file=backend/.env backend/scripts/bootstrap-super-admin.js --database placement-portal --email owner@example.com --apply
```

Bootstrap preserves the account ID and Google identity, records an audit event, revokes old staff sessions, creates the admin-management transaction guard and installs the staff-role index. It does not reset the database or change the student roster. Use the matching backend/frontend release afterward.

For this project, the existing owner's administrator was promoted on September 20, 2026. Read-only verification confirmed one active Super Admin, no remaining old owner sessions, the audit entry, index and unchanged student/company/application counts. The backup under `private-data/backups/2026-09-20T15-07-09.862Z/` passed exact document, collection-option and index restore comparison. Private reports are excluded from Git.

## Verification

September 23 layout verification: the 19 focused admin integration tests and 40 frontend tests passed, along with ESLint and the production build. The new integration case checks bounded page sizes, complete pagination and search across all admin records. Disposable browser checks covered creation, permission dependencies/removal, editing, the permissions dialog and Escape focus return, access restoration, search/paging, rule save/cancel/persistence and conflict recovery using two tabs. The normal four-row desktop view fits at 1280×720 without document or panel scrolling; wider desktop and 390px mobile layouts were also checked. Errors or unusually long content can still scroll within their panel. No real accounts or placement rules were changed by these checks.

```bash
npm run check
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

See [local MongoDB setup](STAGE_2_TESTING.md) before running integration tests. The complete suite passes **65 tests: 21 backend unit/API, 15 frontend, 29 MongoDB integration**, plus ESLint and the production frontend build. The 14 admin integration checks cover bootstrap, Google/session role handling, privilege escalation, permission enforcement, sensitive resume responses, revocation, restoration, identity conflicts, stale edits, promotion protection and concurrent attempts to change protected Super Admins. Google identity verification is synthetic in automated checks.

The synthetic browser preview includes Super Admin and read-only Admin fixtures:

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
```

- Super Admin: <http://localhost:9107/__fixture/admin>
- Read-only Admin: <http://localhost:9107/__fixture/limited-admin>

Browser checks confirmed creation of a synthetic admin, automatic prerequisite permissions, permission removal, disabled email editing, read-only student controls, blocked access to administrator management and disabled company/result actions. These accounts exist only in the disposable preview database and are removed when the preview stops.

After the protection correction, browser verification in the local portal confirmed that the signed-in Super Admin shows **Protected account** while the ordinary admin retains **Edit permissions** and **Remove access**. This correction required no database migration or account changes.

The local backend/frontend were rebuilt and restarted after promotion. Backend health and the frontend returned HTTP 200; unauthenticated profile/admin-account requests returned 401, local CORS matched, and the updated Admins screen was served. The synthetic preview was stopped after verification.

Local testing does not require a Git commit or push. The Render backend remains suspended pending coordinated deployment. Real Google sign-in with the promoted account and production cloud/cookie smoke checks remain part of deployment verification.
