# Workflows and business rules

This guide explains state changes and the boundaries developers must preserve. Request paths, permissions and input limits are listed in [API](API.md); relationships and indexes are in [Data model](DATA_MODEL.md). Complete the database prerequisites in [Deployment](DEPLOYMENT.md) before exercising write workflows.

## Student admission and staff access

An approved email and a registered student are separate records. `ApprovedStudent` controls permission to sign in; `Student` holds the profile created on the first successful Google login. An email on the list is not yet a registered student and is excluded from placement reports until registration.

1. An admin with student-management permission uploads CSV text or pastes emails and reviews the import preview.
2. Invalid rows and staff-email conflicts block commit. Duplicate rows are ignored. Existing approvals retain their details and access state; importing a disabled student never reactivates them.
3. Commit is bound to the preview's creator and checks whether the roster changed. A stale preview must be regenerated. Repeating a completed commit is harmless while its preview still exists.
4. Google login verifies the token's audience, verified email and subject. An active staff account takes precedence; otherwise an active student approval is required. A previously bound account must match the same Google subject.
5. Disabling an approval revokes that student's sessions. Editing approval metadata does not overwrite their submitted profile. Roster branch/year filters use current registered profiles, so entries without those profile details will not match those filters.

Staff accounts live separately from students. Staff creation cannot reuse any student/approval email, including disabled entries. Importing students cannot grant administrative access. Super Admins grant explicit permissions; required dependencies are added automatically. Role, permission or access changes revoke the affected admin's sessions.

The account-management API cannot edit the caller or an existing Super Admin. An ordinary admin can be promoted, after which the account is protected. First-owner bootstrap is an explicit setup operation on an existing active admin, described in [Deployment](DEPLOYMENT.md), not a public registration route.

Sources: [authController.js](../backend/controllers/authController.js), [rosterController.js](../backend/controllers/rosterController.js), [adminManagementService.js](../backend/services/adminManagementService.js).

## Profiles, education and resumes

Student profile writes use validated fields and increment `profileVersion`. The server controls identity, role and placement status. Use the academics catalogue for course/branch choices rather than maintaining a separate list in a client. The B.Tech branch choices are CSE, IT, ECE, Mechanical and EEE.

Profile completion and editing share the same UI fields and validation. Initial completion requires a name, enrollment number, college, course/branch, current semester, graduating year and a 10-digit contact number in addition to valid academic values. WhatsApp is optional, but must also have exactly 10 digits when supplied. Overall and semester CGPA must be greater than 0 and less than 10, with at most two decimal places; school marks allow 0–100%. Semester results must be unique and cannot be ahead of the current semester. Active backlogs cannot exceed total backlogs. The API enforces these rules independently of browser validation.

Email validation is shared by admin account creation, student imports and recruiter result matching. Addresses are trimmed and lowercased; malformed addresses block submission or import preview. Import metadata must use listed branches and valid graduating years. No validation change automatically rewrites existing student records or application snapshots.

School eligibility follows the student's entry qualification. Diploma entry is supported for engineering degrees; it requires valid diploma marks and clears the alternative 12th-class fields. A recorded diploma passing year cannot be after the degree's graduating year. Switching back to 12th-class entry clears diploma fields. A role can accept either route or restrict entry; legacy ambiguous diploma requirements fail closed instead of guessing eligibility. Loading and saving an existing role preserves its entry-qualification requirement.

Uploading a resume creates a `ResumeVersion` and changes the profile's current resume/version. Older versions remain available to applications that captured them. The history endpoint returns the latest 50 versions; this is a listing limit, not a deletion policy. View URLs are temporary and must be requested through the authorized API.

Projects, portfolio links and semester results are profile data. Removing or changing profile UI sections does not rewrite existing application snapshots. Keep profile updates separate from correction requests for already-submitted applications.

Sources: [educationService.js](../backend/services/educationService.js), [resumeService.js](../backend/services/resumeService.js), [profile validator](../backend/validators/authValidator.js).

## Company, drive and role publishing

The current editor creates a Company, its default Drive, and one or more JobRoles together. Company-level legacy summary fields are synchronized for compatibility; they are not a substitute for reading each role's actual compensation and eligibility.

| State/action | Behavior |
| --- | --- |
| Create | Saves a `DRAFT`; only staff with company-management permission can see drafts |
| Publish | Requires a description, future application deadline, and at least one active role with publishable job, compensation and eligibility details |
| Edit published drive | Revalidates publishability and increments the editing revision |
| Close | Stops new applications while retaining roles, documents and application history; a draft must be published before it can be closed |
| Reopen | Publishing a closed drive rechecks the deadline and role requirements |
| Remove role | Deactivates a persisted role; historical applications retain their association |
| Delete company | Allowed only if no applications exist, including rejected or withdrawn applications |

Each role has its own recruitment stages. Empty role stages inherit the drive-level stages for compatibility. Every stage list starts with `Applied` (`key: applied`, `kind: APPLICATION`); stage keys are unique, and an offer stage can only be last.

Before applications arrive for a role, its stages may be changed freely within validation rules. Afterward, existing stage keys, names, kinds and order must remain an unchanged prefix; only appending stages is allowed. An existing offer stage therefore prevents inserting new stages before it. Deactivating a role does not bypass these history protections. The drive can contain at most 25 persisted roles, including inactive roles, so reuse existing roles rather than repeatedly replacing them.

Ordinary viewers see active roles on published/closed drives. Company managers and applicant reviewers can also see historical roles; only company managers can see drafts. Closing or passing a deadline does not hide a published drive from browsing, but it prevents applying.

Documents belong either to the shared drive or a specific role. Upload, replace and remove use the drive's revision. Replacement/removal retires the old metadata rather than deleting a file referenced by application history. Current public documents can be viewed through the guest routes; retired documents require publishing/review permission or an owning student's application reference. Returned metadata does not expose storage keys.

Source: [publishingService.js](../backend/services/publishingService.js), [driveDocumentService.js](../backend/services/driveDocumentService.js).

## Reviewing and submitting an application

The intended sequence is **open drive → choose role → fetch preview → review submitted details/resume → apply with the preview versions**.

The preview explains each role's eligibility and returns the current profile/drive versions. Submission independently rechecks the student's profile, school qualification and marks, CGPA, course/branch, backlog limits, graduation year, required resume, placement policy, active role, published drive, deadline and whether the Applied round remains open.

There can be only one application per student per drive, even when several roles are available. A unique database index enforces this across simultaneous requests. Rejected and withdrawn applications still occupy that slot; students cannot withdraw and reapply to a different role in the same drive.

Submission captures an immutable original snapshot of the profile, resume version, role/drive details, compensation, recruitment plan and documents. Subsequent profile updates, resume uploads or drive edits do not silently alter what was submitted. The transaction creates the application, updates the company's applicant counter and creates the student's notification together. The counter counts retained application records, not just active applicants.

Profile/drive version mismatches return a conflict and require a fresh review. Internal activity counters serialize application submission with profile, publishing and recruitment changes without making every new applicant invalidate an admin's editing revision. Do not bypass the service by inserting applications or updating counters separately.

Source: [applicationController.js](../backend/controllers/applicationController.js), [eligibility and snapshot helpers](../backend/services/applicationService.js).

## Corrections and withdrawal requests

The UI's “Revoke application” creates a **withdrawal request**. It does not immediately remove the application. Direct deletion is unsupported.

An active application can have one pending request at a time and at most 20 requests over its lifetime. Rejected or withdrawn applications cannot create further requests. Every request and decision is retained in application history.

- **Correction:** the server captures the student's current profile/resume, preserving the original role, compensation, documents and recruitment-plan fields. The caller cannot provide an arbitrary replacement snapshot. The profile and resume must remain structurally valid, but corrections that reveal failed eligibility cutoffs are allowed and carry warnings for staff. Approval changes `effectiveSnapshot` and eligibility reporting; it does not automatically select, reject or place the student. The original snapshot remains intact.
- **Withdrawal:** approval sets `WITHDRAWN`. An issued, accepted or joined offer must be resolved first. A pending request has no effect on application status, and approval does not free the drive for reapplication.
- **Review:** staff must approve or reject with a response. An already-reviewed request cannot be decided again. If the application became rejected/withdrawn while a request was pending, approval is blocked; staff can decline it with an explanation.

Application displays and exports use the latest approved correction as the effective submitted details. Pending/rejected corrections never replace those details. Resume access remains separately permission-controlled in original, effective and proposed snapshots.

Source: [applicationController.js](../backend/controllers/applicationController.js).

## Recruitment results

Recruitment operates on one company, one role and one source round at a time. `APPLIED`, `SHORTLISTED` and `INTERVIEW` applicants currently in that round form its pending cohort. Staff supply selected applicant emails from an exported sheet, CSV/XLSX file or pasted list.

| Mode | Selected applicants | Other pending applicants |
| --- | --- | --- |
| `PARTIAL` | Advance once to the next stage | Remain in this round for a later result |
| `FINAL` | Advance once to the next stage | Become rejected; the source round is finalized |

The next interview stage produces `INTERVIEW`; another assessment stage produces `SHORTLISTED`. Reaching the offer stage or the end of the plan produces `SELECTED`. Selection is not an issued/accepted offer and does not itself mark a student placed.

Preview matching uses effective submitted emails. Duplicates count once; unmatched, invalid or ambiguous addresses block publishing. Already-processed applicants are reported as ignored. Rejecting everyone requires an explicitly confirmed empty **final** shortlist; an empty partial result cannot publish.

The creator must publish their preview within 15 minutes. Publishing rechecks a fingerprint of drive revision, stage definitions/finalization and application revisions/statuses. New applicants, corrections, offers or other recruitment actions can invalidate the preview. Generate and review a new preview after a conflict instead of forcing the old selection through.

Publishing applies statuses, history, notifications, finalization and audit records in one transaction. Repeating publication of an already-published batch returns that batch rather than applying it twice. Finalizing `applied` blocks new submissions for that role. Advancing students into a next round that has already been finalized is also blocked.

Undo is a controlled correction, not an unrestricted rollback. It requires a reason and unchanged affected application state/revisions since the batch. Later requests, offers or results prevent overwriting that work. Undo a round's final result before undoing an earlier partial result for that round. The undo itself is recorded and notified; history is not erased.

Recruitment and exports are bounded to 5,000 applicants per operation. Export only the needed columns, using a role/stage scope when appropriate. Exports use effective snapshots, neutralize spreadsheet formula injection in CSV, and keep roll numbers/phone numbers as text in XLSX. Parser limits are in [API](API.md#upload-and-request-budgets); regression coverage is in [Testing](TESTING.md).

Source: [recruitmentService.js](../backend/services/recruitmentService.js), [recruiterFiles.js](../backend/services/recruiterFiles.js).

## Offers and placement policy

Offer actions require a reason and the application's current recruitment revision. They are separate from round-result publication.

| Action | Required current state | Result |
| --- | --- | --- |
| `ISSUE` | Application `SELECTED`, with no active offer | New `ISSUED` offer; compensation details required |
| `ACCEPT` | Offer `ISSUED` | `ACCEPTED` |
| `JOIN` | Offer `ACCEPTED` | `JOINED` |
| `DECLINE` | Offer `ISSUED` | `DECLINED` |
| `REVOKE` | Offer `ISSUED`, `ACCEPTED` or `JOINED` | `REVOKED` |

A declined/revoked offer can be reissued from the selected application; history retains the prior actions. Acceptance/joining cannot be recorded on a rejected or withdrawn application. Declining an already-accepted offer uses revocation rather than the `DECLINE` transition.

The college policy decides whether `ACCEPTED` or only `JOINED` counts as placed. A qualifying offer makes that application `PLACED`; an active nonqualifying offer makes it `OFFERED`; declining/revoking returns it to `SELECTED`. The student's placement status is recomputed across all qualifying offers and any preserved legacy placement record. Revoking one offer must not unplace a student who still qualifies through another offer.

Changing the milestone recalculates recorded-offer/application/student placement state transactionally. Policy and offer writes are serialized to avoid inconsistent counts. Only a Super Admin can change policy; defaults are placement on acceptance and allowing further applications.

| Further-applications policy | Effect on an already-placed student |
| --- | --- |
| `ALLOW` | Can apply to otherwise eligible drives |
| `BLOCK` | Cannot submit new applications |
| `DREAM_ONLY` | Can apply only to drives marked as dream opportunities |

These restrictions apply to new submissions. Existing applications remain accessible and continue through their workflows. Do not derive student placement merely from a `SELECTED` status or the existence of any offer object.

Source: [offerService.js](../backend/services/offerService.js).

## Notifications, saved drives and reporting

Published-drive announcements are shared notifications, visible to students whose accounts existed when the announcement was created. Application, result and request updates are private to the owning student. Read receipts are per student. Mark-all-read uses the last inbox `asOf` cutoff so newly arriving notifications stay unread.

Saving a drive does not reserve a role or change eligibility. When reminders are enabled, inbox polling prepares an in-app reminder during the last 24 hours before the deadline, provided the student has not applied and an active role's Applied round is still open. Closure, application, changed deadlines, disabling reminders or unsaving suppress stale reminders. This mechanism is polling-based; it is not an email sender or scheduled background job.

Admin recent activity shows the latest five of that admin's audit events. The underlying audit history is retained; the display limit is not a five-record storage cap.

Reports deliberately answer a different question from application snapshots:

- Registered-student totals include incomplete and disabled registered accounts, but exclude approved emails that never signed in.
- Course, branch and year filters use each student's **current** profile. Applicant exports use the effective details submitted to that application.
- Placed students are counted once regardless of how many qualifying offers they hold. Company placement summaries use placements attributable to that company's applications; legacy placements may have no recorded offer or company attribution.
- Recorded offers count the current offer record on each application, including declined/revoked records. Active offers are issued, accepted or joined. Reissuing an offer does not create a second current offer count on that application.
- A report response is a current read, not a stored reporting snapshot; separate requests can reflect intervening activity.

Sources: [notificationService.js](../backend/services/notificationService.js), [adminActivityService.js](../backend/services/adminActivityService.js), [reportService.js](../backend/services/reportService.js).

## Changing a workflow safely

Keep authorization and validation on the server, preserve revisions and transaction boundaries, and retain historical snapshots/audit records. Legacy single-role publishing and simple status-update routes remain for older records; current records explicitly reject those shortcuts. Compatibility behavior is not permission to migrate records implicitly in a UI request.

For implementation entry points, read [Architecture](ARCHITECTURE.md). Use [Getting started](GETTING_STARTED.md) and [Testing](TESTING.md) to exercise these flows with disposable data, and follow [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md) when changing contracts or access controls.
