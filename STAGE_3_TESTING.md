# Stage 3: drive publishing and role selection

Implemented and verified locally on September 21, 2026. Stage 3 adds fields to the existing Stage 2 models; it does not require another migration or a database reset. No Atlas documents, cloud objects, Git commits or deployments were changed during this stage's implementation tests.

## Admin workflow

1. Sign in as Super Admin, or an admin with **Manage companies**. Open **+ Company**.
2. Enter the company name, drive title and description. Deadlines and drive dates use **India time (IST)**, regardless of the computer's time zone.
3. Use **+ Add role** for each position; it opens the new role's box. The role switcher immediately to its left lets you edit one role at a time without stacking all role forms. Switching preserves unsaved details; **Save draft / Save changes** saves all roles. Missing or invalid form fields open the affected role before focusing the field. Set its description, domain, job type, location, optional experience and number of positions. Enter **Compensation details** in the single multiline text box (e.g. `3.60 LPA Fixed + 1.20 LPA Variable` or `₹20,000/month stipend`). There are no separate format, type, amount or period controls. Existing numeric pay fills this box with its amount, known type and period when editing. Saving preserves the text without interpreting a numeric CTC.
4. Set each role's CGPA, 10th/12th/diploma percentages, active/total backlog limits, courses, branches and graduating years. The **Courses** dropdown contains only **B.Tech, B.Com, M.Com, BBA and MBA**. Every selected course displays an expanded branch panel; choose individual branches or all branches within each course. **All courses** shows all five panels with all branches selected, and any panel can then be narrowed independently. B.Tech CSE plus MBA Finance accepts only those pairs. Existing branch-only drives keep their criteria until edited. A previously saved course removed from the catalog is identified for removal before saving. Blank optional limits add no restriction; blank graduating years allow any year.
5. **12th or diploma lateral entry** is the single policy in the editor; there is no qualification restriction dropdown. All three cutoff fields stay visible. Students submit their completed qualification, and only its corresponding 12th or diploma cutoff applies, along with common 10th and degree criteria. Saving an older drive through this editor applies this policy while keeping the entered cutoffs. Untouched historical criteria retain their previous behavior.
6. Configure rounds once in **Shared recruitment rounds** at the top. There is no per-role customization control. Use **Move up** and **Move down**; Applied stays first and Offer stays last. A common existing role plan is promoted to the shared editor. Conflicting round plans already used by applicants are retained and shown in a read-only note beside the shared rounds; unused overrides adopt the shared plan on save. Publishing round-by-round results and recruiter email imports remain Stage 5.
7. **Save draft**. Then upload multiple shared or role-specific PDFs, Word documents, JPGs, PNGs or WEBPs. Files are limited to 10 MB each and 20 current documents per drive/role. Save unsaved form changes before uploading.
8. **Publish drive** when ready. The API checks the future deadline, descriptions, job types, eligible courses/branches and nonempty compensation details. No separate salary/stipend selection is needed. Drafts are visible only to company managers.
9. Open **Edit drive** from the admin dashboard to update it. **Close applications** stops new applications and preserves history. Reopening requires a future deadline. A drive with applications cannot be deleted.

A drive supports up to 25 roles. Saved roles can be disabled with **Accept applications**; their historical applications remain. Concurrent admin edits return a conflict instead of overwriting changes; reload the saved version before retrying. Once applications exist for a role, existing effective rounds cannot be renamed, removed or reordered; additional rounds may be appended.

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
- Course/branch pair validation, all-branch/all-course selection, legacy academic spelling, and clearing stale branches in profile forms.
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
