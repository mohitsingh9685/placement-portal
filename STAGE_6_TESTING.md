# Stage 6: placement reports and pagination

This stage includes only placement reports and paginated, searchable lists. It does not include deployment, load testing, monitoring, a college pilot or a database reset.

## Check the features

Use the matching frontend and backend release together. Locally, refresh the frontend and restart the backend if it does not restart automatically. A git push is not required for local testing.

### Reports

1. Sign in as a Super Admin and open **Reports** in the navigation.
2. Check registered students, placed/unplaced students, placement rate, application count, current offers and incomplete profiles.
3. Change Course, Branch or Graduating year. The totals, summaries and student list should all use that cohort.
4. Switch the summary between **Branch**, **Year** and **Company**. Company search and summary pagination run on the server.
5. Search the student table by name, email or roll number; filter to Placed or Unplaced. Search includes students on every page.
6. For other staff, a Super Admin can grant **View placement reports** in Admins. It includes the required View students and View applications permissions. Staff without report access cannot open these endpoints, even with a direct link.

The Reports page uses the full desktop width. Eight totals share a compact strip, with offer counts and refresh information below it. Placement summaries and the student list sit side by side; both request five rows per page and keep their own Previous/Next controls visible. Student rows combine course, branch, year and roll number under Academics, and show placement/profile status together without dropping report data. Smaller screens stack the panels and contain wide tables within their own scroll area.

Layout checks used the disposable `--reports` fixture with 29 students and 25 companies. At 1366×768 and 1680×930 the page and five-row student table fit without scrolling. Verified independent pagination, off-page company/student searches, placed filtering, cohort totals, year summaries and global reset. At 390×844, table overflow stays inside its panel, without horizontal page overflow.

Report definitions:

| Metric | Meaning |
| --- | --- |
| Registered students | Student accounts, including incomplete profiles and disabled accounts. Excludes admin accounts and approved emails that have never signed in. |
| Placed students | Unique students whose placement status is PLACED, following the existing college placement policy. |
| Unplaced students | Registered students minus placed students. |
| Placement rate | Placed / registered students, rounded to one decimal place. Zero for an empty cohort. |
| Recorded offers | One current offer record per application with status ISSUED, ACCEPTED, JOINED, DECLINED or REVOKED. This is not a count of every historical offer event. |
| Active offers | Current offers with status ISSUED, ACCEPTED or JOINED. |
| Company applicants | Unique applicants to that company within the selected student cohort. |
| Placed here | Unique students with a PLACED application at that company. The same student may appear at more than one company. |

Branch and year summaries use the student's current profile. Missing details have a **Not supplied** group, so these totals still reconcile. Company summaries count applications and offers from the selected cohort, including zero-count companies. Adding company placement rows can exceed the college's unique placement total. Earlier placement flags can lack an offer record or company attribution; the reports preserve this distinction.

### Dashboards and applications

1. Browse the admin dashboard: companies load 12 per page. Each company card shows its total applications across all roles and statuses for staff with View applications permission, including zero when nobody has applied. Counts are calculated by the database only for companies on the requested page. Search and course/branch, role, CGPA and drive-status filters apply before pagination. **Reset** clears all filters, restores Newest first and returns to page one.
2. Open a company, then a role. Applicants load 20 per page. Search by name, email, roll number, role or company; filter status/round and sort by date, name or CGPA. Approved academic corrections are used for search and CGPA ordering.
3. Switch pages after selecting applicants. The selection must clear. Bulk actions apply only to the currently selected applicants; they do not silently select other pages.
4. Check **Student requests**. It has separate pending/history filters and pages, so a request does not disappear just because its application is on another page or excluded by applicant search.
5. On the student dashboard, use the compact filter sidebar and All drives / Saved drives tabs. Listed/Eligible statistic boxes are removed; the company grid fills the available width. On narrow screens, Filters toggles the sidebar. Check Save/Unsave, Applied/Not applied, course/branch, eligibility and deadline sorting, plus Reset returning to All drives and page one. Eligibility includes profile, academic, resume, deadline and placement-policy checks; already-applied drives are excluded from Eligible to apply. The application preview still rechecks all conditions before submission.
6. Open **My applications**, which requests four records per page, search for a company on a later page, and change status filters. Counts show the student's complete history, not just the visible page. A notification link opens its specific application in the details dialog even if it is not on page one. Show all applications clears the previous search/status view.
7. Open **Students**. The right panel requests 10 students per page; search and branch/year/access filters run before pagination. The left import preview has its own 10-row pages. Pagination stays below each panel, and submitted student details open in a dialog without enlarging the rows.

Student dashboard cards for a single role show job type, location, compensation and minimum CGPA. Cards with multiple active roles list every role name and the application deadline, without generic “Varies by role” or “By role” values. Role names wrap without clipping; Save and the drive link work for both card layouts.

Changing filters resets to page one. Lists show loading/error/retry states; outdated requests cannot overwrite a newer filter result. Company lists omit large descriptions, document bodies and application records. Applicant lists include the snapshots/history needed for review, but only for the requested page. Private lists and reports are marked `Cache-Control: no-store`.

Check **Reset** in each multi-filter group: both dashboards (including Saved), Students, applicant lists, Reports, and Notifications (category/read status). It restores defaults and page one; applicant resets also clear selections. The top Reports reset clears its nested filters too. My applications intentionally has no Reset button. Single-filter sections and data-entry forms have no reset.

Recruiter exports remain scoped to the selected drive/role/round and are not truncated to the current applicant page. The existing export size limit and permissions still apply.

## Optional database index setup

The feature uses the existing database and collections. This script creates missing model indexes for students, companies, applications, job roles and saved opportunities. It does not delete documents, drop existing indexes, change permissions, modify placement policy or create a new database. It is safe to repeat after a successful apply.

From the project root, preview the indexes against the exact database configured in `backend/.env`:

```bash
node --env-file=backend/.env backend/scripts/setup-stage6.js --database placement-portal
```

After reviewing the output, apply the indexes:

```bash
node --env-file=backend/.env backend/scripts/setup-stage6.js --database placement-portal --apply
```

The script uses `MIGRATION_MONGO_URI` when set, otherwise `MONGO_URI`, and checks that its database name matches `--database`. The first command is a dry run. The second creates indexes; neither command grants staff report permissions. The indexes were verified on a disposable local database; **Stage 6 setup has not been applied to Atlas by the agent**. Reports do not require a new migration marker to run.

These indexes support ownership/cohort filters, page ordering and offer lookups. Contains-text searches and aggregate counts can still scan matching records; pagination bounds what the browser downloads, not the total work of every database query. No 1,000-student concurrent-capacity claim is made.

## API changes

Application list endpoints now return an object rather than an unbounded array:

```json
{
  "applications": [],
  "counts": {},
  "totalApplications": 0,
  "requestCount": 0,
  "page": 1,
  "limit": 20,
  "total": 0,
  "pages": 1
}
```

`total` reflects the search/filters. `totalApplications`, `counts` and `requestCount` describe the whole authorized student/company/role scope. Company endpoints retain `companies` and add pagination plus `summary`. Each company includes `applicationCount` for staff with View applications permission; the company-list summary no longer includes a global application total. Page size is capped at 50; invalid limits, unknown query fields and malformed filters are rejected. The updated frontend understands these envelopes; deploy matching versions when ready.

New report endpoints, all protected by `reports.view`:

- `GET /api/reports/overview`
- `GET /api/reports/options`
- `GET /api/reports/students`
- `GET /api/reports/groups?group=branch|year|company`

## Verification recorded September 22, 2026

- `npm run check`: 38 backend tests, 34 frontend tests, ESLint and production build passed.
- Full disposable-MongoDB integration suite: 109 tests passed, including 12 new report/pagination tests. Focused reruns passed after the final legacy-search and eligibility fixes.
- Coverage includes distinct placements vs multiple offers, incomplete profiles, unsigned roster exclusion, cohort/group totals, off-page searches, stable page ordering, corrected academics, request queues, student isolation, permission revocation, validation and additive/repeated index setup.
- Browser checks used synthetic accounts and more than one page of companies, students and applications. Verified dashboard/search pagination, role counts, off-page pending requests, clearing selections, report filters and summaries, and student history search/pagination. Report tables remain usable at a narrow mobile viewport without horizontal page overflow.
- No Atlas data, real Google accounts, AWS objects or Cloudinary assets were changed. Tests do not prove live deployment behavior or concurrent capacity.

### Re-run locally

Use an existing **disposable localhost MongoDB replica set**; never point these tests at Atlas:

```bash
npm run check
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

For a synthetic multi-page browser preview:

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2 -- --reports
```

The preview prints local fixture login links and uses the frontend on port 5187 and API on 9107. It creates a unique temporary database, disables external cloud integrations and removes its own database on normal shutdown. The regular app on ports 5173/9000 is separate.
