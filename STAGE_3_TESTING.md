# Stage 3: drive publishing and role selection

Implemented and verified locally on September 21, 2026. Stage 3 adds fields to the existing Stage 2 models; it does not require another migration or a database reset. No Atlas documents, cloud objects, Git commits or deployments were changed during this stage's implementation tests.

## Admin workflow

1. Sign in as Super Admin, or an admin with **Manage companies**. Open **+ Company**.
2. Enter the company name, drive title, description and application deadline in **India time (IST)**. The editor has no Drive date field or Back to dashboard button. Saving clears any older drive date.
3. The desktop editor keeps **Company & drive** in a full-width panel with compact role cards below (three per page). New drives start without an empty role. **+ Add role** or an existing card opens an 80%-width dialog with a blurred backdrop. Its switcher and Add role button retain unsaved edits. Use the **Role details**, **Eligibility**, **Courses & branches**, **Rounds** and **Documents** tabs. **Done** returns to the company; **Save draft / Save changes** saves the company and all roles. Validation opens the affected role, tab and round page before focusing its field, including roles whose editors are closed. Escape closes the dialog and restores focus without discarding edits.
4. Role details include description, domain, job type, location, optional experience/positions and free-text compensation. Eligibility includes CGPA, 10th/12th/diploma cutoffs, backlog limits and graduating years. The course checklist contains **B.Tech, B.Com, M.Com, BBA and MBA**; select a course to edit its branches in the adjacent panel. **All courses & branches** selects the catalog, and each course can then be narrowed independently. B.Tech CSE plus MBA Finance accepts only those pairs. Existing branch-only drives retain their criteria until a course is selected. Unavailable courses must be removed before saving. Blank optional limits add no restriction; blank graduating years allow any year.
5. **12th or diploma lateral entry** is the single policy in the editor; there is no qualification restriction dropdown. All three cutoff fields stay visible. Students submit their completed qualification, and only its corresponding 12th or diploma cutoff applies, along with common 10th and degree criteria. Saving an older drive through this editor applies this policy while keeping the entered cutoffs. Untouched historical criteria retain their previous behavior.
6. Configure **Recruitment rounds** in the role dialog, five rows per page. New roles start with Applied; existing roles keep their own rounds, including any earlier shared plan. Switching roles preserves unsaved rounds independently. Use **Move up** and **Move down**; Applied stays first and Offer stays last. Existing applicant rounds are locked; new rounds can be appended when the saved plan does not already end in Offer. Student views and recruiter results use the chosen role's rounds.
7. **Save draft**. Then upload shared files from the company panel's **Shared documents** tab, or role-specific files from the role dialog's **Documents** tab. Current files and history have separate views, with three shared files or five role files per page. Upload multiple PDFs, Word documents, JPGs, PNGs or WEBPs. Files are limited to 10 MB each and 20 current documents per drive/role. Save unsaved form changes before uploading.
8. **Publish drive** when ready. The API checks the future deadline, descriptions, job types, eligible courses/branches and nonempty compensation details. No separate salary/stipend selection is needed. Drafts are visible only to company managers.
9. Open **Edit drive** from the admin dashboard to update it. **Close applications** stops new applications and preserves history. Reopening requires a future deadline. A drive with applications cannot be deleted.

A drive supports up to 25 roles. Use **Remove role** and its inline confirmation to delete an unsaved role or deactivate a saved role. Saved roles retain their identifiers, documents, rounds and applications; **Restore role** reopens them after saving. A published drive must retain an active role. Concurrent admin edits return a conflict instead of overwriting changes; reload the saved version before retrying. Once applications exist for a role, existing effective rounds cannot be renamed, removed or reordered; additional rounds may be appended.

### Admin role navigation

1. From **Dashboard**, open a published company card. Its role page shows one card per role with title, location, job type, a short description, compensation, minimum CGPA and courses/branches. Draft cards still open the editor.
2. Open a role card to see **only that role's applicants**. Total, In review and Selected counts are calculated for that role, and search/sorting/result actions operate on those applicants.
3. Use **Back to roles** to choose another role. Selection resets when navigating between roles or changing the applicant search. Refreshing a role's applicant URL keeps the selected role.
4. Inactive roles remain accessible to admins with **View applications**, including read-only admins. Updating results and viewing resumes still require their separate permissions. Old company-wide applicant URLs remain supported.

The role filter is enforced by the API using the company, drive and role IDs. A role from another company or an invalid ID returns an error. Loading failures show a retry message rather than an empty applicant count.

## Student workflow

- First-time profile completion and Profile → Academic info use one course and one dependent branch/specialization dropdown. Changing course clears the old branch. Both admin and student forms use the five-course catalog: B.Tech, B.Com, M.Com, BBA and MBA, with engineering, commerce and management branches respectively.
- B.Tech students who entered after diploma choose **Qualification before degree → Diploma (lateral entry)**. They enter diploma percentage and can add the diploma institute, engineering branch and passing year. Their current course remains B.Tech; diploma is a previous qualification, not a current-course choice. 12th fields are hidden and cleared on save. Switching back to 12th clears inactive diploma fields.
- Dashboard lists published/closed drives. Multi-role cards show **Choose role** and indicate that pay and criteria vary by role.
- Open the drive, inspect shared documents and choose a role. The page shows its full salary/stipend description, experience, positions, course-specific eligibility, rounds and documents.
- Apply to one eligible role. The server independently checks profile completion, academics, deadline, drive/role status and duplicate applications.
- **Applications** shows the submitted role, pay and documents from application time. Later edits or document replacements do not rewrite these snapshots. Legacy records show the information actually available; old pay units are not guessed.

## Automated verification

September 23 modal-editor update: 45 frontend tests, all 28 publishing integration tests, lint and production build passed. Disposable browser checks covered two independent roles, switching without losing edits, hidden-role validation and focus, round reordering/pagination, unsaved-role deletion, saved-role removal/reload/restoration, saving and publishing, six role documents and four shared documents. At 1280×720 the main page, full round page, role details and document panels fit without scrolling. The dialog measures 80% of viewport width with a blurred backdrop. A 1366×768 desktop and 390×844 mobile were also checked; mobile uses natural scrolling with no horizontal overflow. Exceptionally short screens and long text retain scroll access instead of clipping controls. Only disposable local preview data was used.

September 23 role-round update: all 38 backend unit tests, 35 frontend tests, 26 publishing integration tests, lint and build passed. Browser checks confirmed the removed fields, separate round editors and preserved unsaved rounds while switching roles. Integration tests verified independent saving, inherited-round compatibility and unchanged applicant history.

From the repository root:

```bash
npm run check
```

This passes 32 backend tests, 29 frontend tests, ESLint and the frontend production build.

With the disposable localhost replica set from [Stage 2](STAGE_2_TESTING.md) running:

```bash
docker start placement-stage2-test-mongo
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

All 54 MongoDB integration tests pass, including 25 Stage 3 cases. Total: **115 automated tests**. The tests refuse Atlas targets, isolate their databases and replace S3 with synthetic storage.

After simplifying compensation to one text box, reran all 59 unit tests, the 20 publishing integration tests, lint and build. Browser checks confirmed multiline text saves, publishes without a type selector, survives reload, and appears on the student dashboard. Earlier numeric pay remains covered by legacy editing and API tests.

After simplifying courses, qualification controls and shared rounds, reran the complete 112-test suite, lint and build. Browser checks confirmed five branch panels, narrowing individual branches after All courses, saving/publishing/reloading each course selection and all school cutoffs, a single shared round editor, and student branch dropdowns for all five courses. Diploma branches remain available under previous education.

The role-switcher change passed all 29 frontend tests, lint and build. Disposable browser checks covered automatic selection when adding a role, switching without losing entered details, opening a hidden role with a required-field error, removing a new role, saving both roles, retaining selection after the initial save, and reloading saved values. Only one role box was visible, including at 390-pixel width without horizontal overflow.

The admin role-card change passed the full 115-test suite, lint and build. Synthetic browser checks covered dashboard → two role cards → role applicants, distinct counts/results for each role, clearing selection on role changes, a bulk result update confined to one role, retained role/result after refresh, and read-only admin permissions. Cards and applicant pages were checked at 390-pixel width without horizontal overflow. Integration cases also cover empty roles, invalid/foreign role IDs, inactive-role history and resume privacy.

Stage 3 coverage includes:

- Diploma signup without 12th marks, correct qualification-specific cutoffs, invalid/partial profile updates, old drive policy preservation, and application-time diploma snapshots.
- Multiline compensation persistence and publishing without a pay-type selection, blank-pay validation, legacy numeric-to-text editing, legacy numeric API compatibility, and preserved application-time experience/vacancies.
- Course/branch pair validation, all-branch/all-course selection, legacy academic spelling, and clearing stale branches in profile forms. B.Tech choices are CSE, IT, ECE, Mechanical and EEE only; check admin eligibility, student/diploma forms and branch filters. Editing older criteria must not re-add retired branches or turn an empty selection into All branches.
- Bidirectional round reordering with fixed Applied/Offer boundaries.
- Draft privacy across lists, direct links, legacy/new JD routes and applications; staff/student permissions.
- Publishing validation, IST conversion, closed/expired drives and reopening.
- Per-role academic boundaries, one application per drive under simultaneous submissions, and races between applications and closing/tightening criteria.
- Stale revisions, foreign role IDs, immutable application snapshots, custom rounds and disabled-role history.
- Multiple shared/per-role files, signature/type/size validation, scoped document IDs, replacement/retirement and applicant-only historical access.
- Failed uploads and uncertain database commits retain referenced or uncertain objects.
- Migrated legacy listings keep their drive/role/application IDs when edited using the new screen.

## Browser preview without changing Atlas

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
```

The existing preview command also serves Stage 3:

- Super Admin: <http://localhost:9107/__fixture/admin>
- Student: <http://localhost:9107/__fixture/student>
- Read-only admin: <http://localhost:9107/__fixture/limited-admin>

The preview uses a random local database. Drive documents remain in memory; Google, S3, Cloudinary and real resume uploads are not contacted. Ctrl+C removes its temporary database and in-memory files. Fixture routes exist only in the preview script, never the regular backend.

Browser verification completed: create two roles with different pay units, add a recruitment round, save a draft, upload two shared files, reject publishing without a deadline, save an IST deadline, publish, choose a student role, apply once, and view the saved role/documents in Applications. Additional September 21 browser checks: diploma signup/save/reload without 12th marks, diploma details in the admin student list, persisted admin diploma policies/cutoffs, B.Sc/M.Sc absent from the catalog, move a round up and down, save/reload descriptive pay and experience/vacancies, select B.Tech CSE/IT plus all MBA branches, publish/apply, confirm the separated Edit drive button, and complete/edit student course selections. Admin editor, student drive details and profile screens were checked at 390-pixel width without horizontal overflow.

## Local app and rollout

The regular local app is available at <http://localhost:5173> after:

```bash
docker compose up -d --build
```

This uses the database configured in `backend/.env`. Saving a drive or uploading a file in this regular app changes that configured database/storage. Use the synthetic preview above for disposable tests. A Git push is not needed for local testing.

Keep the existing old Render backend suspended until the matching frontend/backend code is deliberately deployed, as described in [Stage 2 rollout](STAGE_2_TESTING.md). Stage 3 itself needs no new secret or bucket. Before college rollout, verify real Google sessions and S3 upload/read permissions using the deployment environment. Current published documents follow the existing guest-public listing behavior; confirm that policy with the college before rollout.

File signatures are basic format screening, not antivirus scanning. Retired S3 objects are intentionally retained; lifecycle cleanup must respect historical application references. Large-scale performance, full application timelines, exports and round-result imports remain in their later planned stages.
