# Stage 5: recruiter exports, round results and offers

Implemented locally on September 21, 2026. Verification uses synthetic accounts and disposable localhost databases. On September 22, Mohit supplied successful setup output for `placement-portal` with `--apply` and confirmed that round processing works. Deployment and live cloud verification remain separate.

## Where to find it

Open **Admin dashboard → company → role**. The applicant page now contains **Export applicants**, **Recruiter results**, **Published result history**, and offer actions on selected applicants. Choose **All roles** to export the entire drive; result imports always require one role.

Super Admins have every capability. Under **Admins**, grant ordinary staff the permissions they need:

| Permission | Capability |
| --- | --- |
| View applications | Read applicants and their submitted details |
| Review student requests | Approve/decline corrections and withdrawals |
| Export applicants | Download Excel/CSV files |
| Manage recruitment rounds | Preview, publish and undo recruiter results |
| Manage offers and placement | Record offers, acceptance, joining, declines and revocations |
| View student resumes | Open resumes separately |

Existing admins do not automatically gain the three new permissions. Each requires View applications, which the permission form adds automatically. Placement rules remain exclusive to Super Admins.

## Export a recruiter list

1. Expand **Export applicants** on the drive or role applicant page.
2. Choose Excel (`.xlsx`) or CSV. Select the desired columns: name, email, roll number, course, branch, graduating year, academics/backlogs, phone, company, role, round and status.
3. Export all applicants/statuses, or the students currently pending in a particular round of this role.
4. Click **Download applicants**. Send the resulting file to the recruiter yourself.

Exports use the submitted application snapshot, including an approved correction when one exists. Later unapproved profile edits do not change the recruiter list. Roll numbers and phone numbers are text so leading zeroes survive; marks are numeric and missing values are blank. XLSX headers are frozen, filtered and formatted. Cell values cannot become executable spreadsheet formulas. Resume URLs, tokens and internal account fields are excluded.

ExcelJS is installed in the backend. No Microsoft account, paid Excel subscription, API key, Google Sheets connection or new cloud service is required. Excel, LibreOffice or Google Sheets can open the downloaded file. Import/export is limited to 5,000 applicants per operation; larger-scale capacity testing belongs to Stage 6.

## Process recruiter results

Example: a role has 100 applicants, and the recruiter sends 30 email addresses for the aptitude test.

1. In **Recruiter results**, choose source round **Applied**. The preview shows the next configured round.
2. Paste one email per line, or upload an XLSX/CSV file. Use an `Email` column. A one-column email list without a header also works. Multi-column files need an identifiable email header; other columns do not alter profiles.
3. Choose the result type:
   - **Partial shortlist:** advance those 30 and leave the other 70 pending.
   - **Final shortlist:** advance those 30 and reject the other 70 still pending in Applied for this role. Previously processed applicants and other roles are unaffected.
4. Add a message for students, then click **Preview results**. Nothing is published yet.
5. Review the advancing/rejected lists, counts and import issues. Tick the review confirmation and click **Publish results**.
6. After the aptitude test, choose that test as the source round and import the next shortlist. Repeat through the configured interview rounds.

The last shortlist records **Selected**; it does not invent an issued or accepted offer. **Applied / pending**, **Shortlisted for [round]**, **Interview**, **Selected**, **Offered**, **Placed**, **Rejected** and **Withdrawn** remain distinct. Students see the actual events in My applications and receive private in-app notifications through the existing API polling. No Socket.IO or WebSockets are needed.

Import rules:

- Email comparison trims whitespace and ignores case. Duplicates count once. Invalid, unknown or ambiguous addresses block publication and report their source row.
- An email belonging to a different role cannot move that student. Already processed addresses are reported and do not advance again.
- A final shortlist with no matches requires an explicit **Allow an empty shortlist** confirmation before rejecting everyone remaining. Invalid/unmatched rows still block it.
- Upload one nonempty worksheet, at most 2 MB, 5,000 data rows and 50 columns. `.xls`, multiple nonempty sheets and formulas in email cells are rejected. XLSX parsing runs in a bounded worker with ZIP expansion checks and a timeout. Pasted input is bounded too.
- Only the admin who prepared a preview can publish it. Previews expire after 15 minutes. Editing the form clears its preview.
- Changes to applicants, corrections, round plans or results invalidate an old preview. Refresh and preview again; newer changes cannot be silently overwritten. Repeating a successful publish does not repeat its effects.
- Finalizing Applied closes registration for that role, even if its original deadline is later. If every active role has finalized registration, saved-drive deadline reminders disappear. Undoing the final result reopens that round subject to the drive's status/deadline.
- Finalized rounds cannot receive late advances from an earlier round. Finish earlier partial lists before finalizing the next round.

## Correct a published result

Expand **Published result history → Correct / undo this batch**, enter a reason, then confirm. This reverses the entire batch and notifies affected students. Import the corrected list afterward.

Undo is permitted only while all affected applications still match the published changes. An offer, a later round, a correction/request or other newer activity blocks automatic undo. A partial batch cannot be undone while that source round has a final result; undo the final result first. If later activity prevents reversal, the portal explains the conflict instead of overwriting it. Repeated undo requests are harmless.

The screen shows the most recent 100 published/undone batches in the drive. Durable batch changes and audit records retain the actor, time, scope, reason and affected application IDs. Unused preview documents expire automatically; redundant preview names/emails are removed after publication. Original application snapshots and history remain available.

## Record offers and placement

On a selected applicant, enter compensation details, an optional offer reference and a note, then **Issue offer**. Staff can subsequently record acceptance or decline, record joining after acceptance, or revoke an active offer with a reason. These actions record confirmations received outside the portal; they do not accept contracts or send recruiter emails.

Under **Admins → College placement rules**, a Super Admin chooses:

- Count a student as placed after **offer acceptance** (default) or **joining**.
- After placement, **allow further applications** (default), block them, or allow only drives marked **Dream opportunity** in the drive editor.

Changing the placement milestone reconciles tracked offers and student placement flags. Revoking one offer keeps a student placed if another qualifying offer remains. Earlier placement flags are preserved; historical Selected records stay Selected until an actual offer is recorded. Existing applications are retained when further applications are restricted. Active offers must be resolved before approving withdrawal.

The database and notification changes for a result/offer are transactional. A failed write does not leave half a shortlist published. Stale or simultaneous offer decisions return a conflict rather than overwriting each other.

## One-time database setup

Mohit completed this setup on September 22, 2026, as confirmed by his supplied command output. The commands below remain available for another environment or a repeat check. Setup adds `recruiterresults`, `placementpolicies`, their indexes, and an offer lookup index on applications. It creates the default college placement rule once and preserves later rule changes. No database reset, student deletion, roster import or application rewrite is involved.

Stage 2 migration is required. Complete the additive [Stage 4 setup](STAGE_4_TESTING.md#one-time-setup-before-rollout) first if it has not been applied. Use the intended database and the normal release backup. The script checks that `--database` matches the database named in the connection URI and defaults to a dry run.

From the project root, when `backend/.env` contains the intended URI:

```bash
# Preview the target and planned setup without writing.
node --env-file=backend/.env backend/scripts/setup-stage5.js --database placement-portal

# Apply once after checking the target. Repeating this is safe.
node --env-file=backend/.env backend/scripts/setup-stage5.js --database placement-portal --apply
```

If your environment already supplies `MONGO_URI` (or the overriding `MIGRATION_MONGO_URI`), use:

```bash
npm --prefix backend run setup:stage5 -- --database placement-portal
npm --prefix backend run setup:stage5 -- --database placement-portal --apply
```

Use the actual database name for staging. Never paste the connection string or cloud credentials into a chat. Missing Stage 5 setup produces an explicit message when importing results, recording offers or saving placement rules. Local editing/testing does not require a git push. Deployment later needs the matching frontend/backend release and completed setup.

## Verification

Install the updated backend dependencies with `npm --prefix backend ci`. For the existing local Docker service, use `docker compose exec -T backend npm ci` followed by `docker compose restart backend` when its dependency volume is stale.

```bash
npm run check
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
```

Use the disposable MongoDB replica set from [Stage 2 testing](STAGE_2_TESTING.md). Tests reject non-local targets and remove their randomly named databases afterward. Never use Atlas for these tests.

Verified: **169 automated tests** (38 backend unit/API, 34 frontend and 97 MongoDB integration), ESLint and the Vite production build. The full integration run passed before the final edge-case additions; affected suites and each added case passed after the changes and fixes. Backend dependency audit reported no known vulnerabilities at installation time.

The Stage 5 integration suite covers setup repeatability, partial/final processing, cross-role isolation, duplicates/errors, empty shortlists, concurrent publication, stale/expired previews, undo conflicts, transaction failure recovery, exports from accepted snapshots, real XLSX uploads, offer transitions, multiple offers, placement rules, permissions, student history and private notifications. File tests cover XLSX/CSV round trips, text identifiers, numeric marks, formula safety, malformed/oversized workbooks, forged ZIP expansion metadata and source row reporting.

For manual testing without touching Atlas:

```bash
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
```

This shared synthetic preview now includes Stage 5 setup, two roles and four applicants. Use its printed Super Admin/student/read-only sign-in links. It disables real Google and cloud uploads and removes its temporary database on Ctrl+C.

Browser checks covered Excel download and visual inspection, pasted and uploaded shortlists, partial/final rounds, selection, offer issuance/acceptance, placement-rule changes, student timelines/inbox, read-only staff controls, and mobile layout at 390 pixels. Real Google/cloud/deployment smoke tests and a 1,000-student load test remain part of rollout/Stage 6.
