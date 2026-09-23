# API reference

The Express API exposes 65 method/path pairs. Paths below are relative to the backend origin. The mounted routes in [app.js](../backend/app.js), [route modules](../backend/routes), and [validators](../backend/validators) are the source of truth.

For business rules, read [Workflows](WORKFLOWS.md). See [Getting started](GETTING_STARTED.md) for running the API and [Security](SECURITY.md) for deployment controls.

## Request conventions

- Send JSON except for file uploads. Browser requests use credentials so the HTTP-only `accessToken` and `refreshToken` cookies are included.
- Protected routes accept an access-token cookie or, when that cookie is absent, `Authorization: Bearer <access token>`. A live server-side session and current account access are checked on every protected request.
- Every non-`GET`/`HEAD`/`OPTIONS` request, including login, refresh and logout, needs an allowed `Origin`. A request without `Origin` is exempt only when it has a Bearer header and neither authentication cookie. There is no separate CSRF-token endpoint.
- Access tokens last 15 minutes. Refresh renews the access token within the existing seven-day session; it does not rotate the refresh token or extend that expiry. Logout revokes the session identified by its cookies.
- `Session` in the tables means any authenticated account; `Staff` means `admin` or `super_admin`; `Student` means the current student only. A named permission requires an active admin with that permission, or a Super Admin. Permission dependencies are defined in [permissions.js](../backend/config/permissions.js).
- Resource IDs are 24-character hexadecimal ObjectIds unless stated otherwise. Notification IDs are 64-character hexadecimal strings. `:id` in company routes is a **Company ID**, not a Drive ID. `:studentId` in the roster API is an **ApprovedStudent ID**; in resume routes it is a **Student ID**.
- Send timestamps as ISO 8601 strings with UTC or an explicit offset. The UI's India-time display does not change how timestamps are stored.
- Responses have endpoint-specific envelopes: for example `user`, `companies`, `applications`, `entries`, or a direct object. Do not assume every successful response has `success` or `data`.

### Errors and concurrent changes

Errors normally include `message`, with optional `success: false` and `code`. Use the HTTP status rather than depending on one universal error shape.

| Status | Meaning |
| --- | --- |
| 400 | Invalid fields, IDs, file format, or business-rule input |
| 401 | Missing, invalid, expired, or revoked session |
| 403 | Access, permission, protected-account, or origin restriction |
| 404 | Missing resource, expired roster preview, or resource hidden from this caller |
| 405 | Direct application deletion is unsupported |
| 409 | Stale revision/preview, duplicate application, or conflicting workflow state |
| 413 | Request body exceeds the parser limit |
| 429 | Rate limit or upload/workbook processing capacity reached |
| 500 | Unexpected server failure; internal details are not returned |

Drive edits/status changes, admin edits, roster edits, placement-policy changes and offer actions require the last retrieved `revision`. Offer actions use the application's `recruitmentRevision` as their input `revision`. Drive-document writes take the drive revision in the **query string**. Refetch and review after a 409; never silently increment a stale revision.

Application preview returns `profileVersion` and `driveRevision`. Submit both with the chosen `roleId` to detect changes after review. These version fields remain optional for API compatibility, but eligibility and current drive state are always checked again on submission.

### Pagination and filters

| Collection | Default / maximum `limit` | Filters beyond `page` and `limit` |
| --- | --- | --- |
| Companies | 20 / 50 | `search`, `course`, `branch`, `role`, `cgpa`, `status`, `sort`, `saved`, `applied`, `eligibility` |
| Applications | 20 / 50 | `search`, `roleId`, `status`, `stage`, `sort`, `requests`, `applicationId` |
| Report students/groups | 20 / 50 | `course`, `branch`, `passingYear`, `search`, `placement`, `group`; applicability varies below |
| Admin accounts | 30 / 30 | `search` |
| Student roster | 30 / 100 | `search`, `active`, `branch`, `passingYear` |
| Notifications | 20 / 20 | `kind`, `read` |

Pages start at 1 and are capped at 10,000. Paginated responses include `total`, `page`, `pages`, and usually `limit`; the roster response omits `limit`. `pages` is at least 1 even for an empty result. Reset `page` when changing filters. Search strings are treated as literal text, with a 100-character limit on list queries (admin-account search accepts 200).

- Company `cgpa`: empty, `6-7`, `7-8`, `8+`; `status`: empty, `DRAFT`, `PUBLISHED`, `CLOSED`; `sort`: `latest`, `a-z`, `deadline`. `saved` accepts empty or `true`; `applied` and `eligibility` also accept `false`. Nonempty personal filters require a student session. Visibility restrictions still apply when filtering by status.
- Application `status`: `ALL`, `APPLIED`, `SHORTLISTED`, `INTERVIEW`, `SELECTED`, `OFFERED`, `PLACED`, `REJECTED`, `WITHDRAWN`; `sort`: `latest`, `oldest`, `high`, `low`, `name`; `requests`: empty, `ANY`, `PENDING`, `APPROVED`, `REJECTED`. `stage` is a round key. Staff role filters must belong to the selected company.
- Reports share `course`, `branch`, and `passingYear` cohort filters. `/students` additionally uses `search` and `placement` (empty, `PLACED`, `NOT_PLACED`). `/groups` uses `group=branch|year|company`; `search` applies to company groups only. `/overview` ignores list-only filters. `/options` returns options from all registered profiles.
- Roster `active=true|false` filters access; branch/year filters use submitted student profiles. Notifications use `read=ALL|UNREAD|READ` and `kind=ALL|DRIVE_PUBLISHED|APPLICATION|RESULT|REQUEST|DEADLINE`.

## Endpoints

### Base — 4

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/` | Public | Plain-text API greeting |
| GET | `/health` | Public | Liveness response; does not check database or storage health |
| GET | `/api/academics` | Public | `{ programs }`, the course/branch catalogue |
| GET | `/api/protected` | Session | `{ success, user }` |

### Authentication — 6

Prefix: `/api/auth`. Source: [authRoutes.js](../backend/routes/authRoutes.js).

| Method | Path | Access | Input / result |
| --- | --- | --- | --- |
| POST | `/google` | Public, allowed origin | `{ token }` Google ID token; verifies identity/access, sets cookies, returns `{ success, user }` |
| POST | `/refresh` | Valid refresh cookie | Renews access cookie; `{ success, message }` |
| POST | `/logout` | No prior authentication required | Clears cookies and revokes valid cookie sessions; `{ success, message }` |
| GET | `/profile` | Session | `{ success, user }`; staff also receive `allowedPermissions` key/label pairs |
| GET | `/activity` | Staff | `{ activities }`, the latest five actions performed by this admin |
| PUT | `/update-profile` | Student | Validated profile fields; `{ success, user }` with updated `profileVersion` |

There are no password registration/login endpoints. Profile fields and cross-field rules are in [authValidator.js](../backend/validators/authValidator.js) and [educationService.js](../backend/services/educationService.js); identity, role and placement status are not student-editable profile fields.

Profile CGPA and semester CGPA accept 0.01–9.99 (at most two decimal places). Contact/WhatsApp numbers accept exactly ten digits; WhatsApp may be empty. School percentages accept 0–100 with at most two decimal places. Semester numbers are integers 1–12, graduating years 2000–2100, and backlog totals integers 0–100 with active ≤ total. Semester results are unique and cannot exceed the student's current semester. First completion also requires name, enrollment, college, course, semester, year and contact number. Email is immutable on student profiles. Admin/roster emails use the shared [field validators](../backend/validators/fieldValidators.js).

An omitted minimum-CGPA cutoff is stored as `0` to mean no minimum; an entered cutoff uses 0.01–9.99. This sentinel is not a valid student CGPA.

### Administrator accounts — 3

Prefix: `/api/admin/accounts`. All require Super Admin. Source: [adminRoutes.js](../backend/routes/adminRoutes.js).

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/` | Paginated `{ admins, permissions, total, page, limit, pages }` |
| POST | `/` | `{ name, email, role?, permissions? }`; role defaults to `admin`; 201 `{ success, admin }` |
| PATCH | `/:adminId` | `{ revision, name?, role?, permissions?, isActive? }`; `{ success, admin }` |

Only other ordinary admins can be edited. Existing Super Admins and the caller's own account are protected. Accounts are disabled rather than deleted; there is no account-deletion endpoint.

### Student roster — 4

Prefix: `/api/admin/roster`. Source: [rosterRoutes.js](../backend/routes/rosterRoutes.js).

| Method | Path | Permission | Input / result |
| --- | --- | --- | --- |
| GET | `/` | `students.view` | Paginated `{ entries, total, page, pages }` with submitted-profile data when present |
| POST | `/imports` | `students.manage` | JSON `{ csv }`; 201 `{ id, rows, summary, expiresAt }` preview |
| POST | `/imports/:importId/commit` | `students.manage` | No body; commits this admin's preview; `{ success, inserted, alreadyCommitted? }` |
| PATCH | `/:studentId` | `students.manage` | `{ revision, isActive?, name?, enrollmentNo?, branch?, passingYear? }`; `{ success, entry }` |

Roster import is JSON text, not multipart. Accepts one email per line or CSV columns `email,name,enrollmentNo,branch,passingYear`; role/access columns are forbidden. Limit: 5,000 data rows and 1 MiB of text. Previews expire after 30 minutes.

### Companies, drives and documents — 14

Prefix: `/api/company`. Source: [companyRoutes.js](../backend/routes/companyRoutes.js).

| Method | Path | Access | Input / result |
| --- | --- | --- | --- |
| POST | `/drives` | `companies.manage` | Full drive/roles payload; creates draft; 201 company/drive/roles graph |
| PUT | `/:id/drive` | `companies.manage` | Full drive/roles payload plus `revision`; updated graph |
| POST | `/:id/drive/status` | `companies.manage` | `{ revision, status: "PUBLISHED" or "CLOSED" }`; graph |
| POST | `/:id/drive/documents` | `companies.manage` | Multipart `document`; query `revision`, optional `roleId`, `replaceId`; 201 graph |
| DELETE | `/:id/drive/documents/:documentId` | `companies.manage` | Query `revision`, optional `roleId`; retires document; graph |
| GET | `/guest/:id/drive/documents/:documentId` | Public visibility | `{ signedUrl }` for a current public document |
| GET | `/:id/drive/documents/:documentId` | Session and document visibility | `{ signedUrl }`; historical access checked separately |
| POST | `/` | `companies.manage` | Legacy single-role company payload; 201 Company |
| GET | `/guest` | Public | Paginated company list, excluding drafts |
| GET | `/guest/:id` | Public | Visible company/drive/roles graph |
| GET | `/` | Session | Paginated company list; drafts only for `companies.manage` |
| GET | `/:id` | Session | Visible graph; active roles for ordinary viewers, historical roles for authorized staff |
| PUT | `/:id` | `companies.manage` | Legacy company update; 409 for modern publishing records |
| DELETE | `/:id` | `companies.manage` | Deletes company/drive/roles only when no applications exist; otherwise 409 |

Use `/drives` and `/:id/drive` for new integrations. [driveValidator.js](../backend/validators/driveValidator.js) defines the graph payload: company name; drive title, description, deadline and stages; and 1–25 roles with title, job details, compensation, eligibility and optional role-specific stages. Omitted persisted roles are deactivated, not erased. Optional `driveDate` remains in the API for compatibility even though the editor no longer exposes it.

### Applications and requests — 9

Prefix: `/api/application`. Source: [applicationRoutes.js](../backend/routes/applicationRoutes.js).

| Method | Path | Access | Input / result |
| --- | --- | --- | --- |
| POST | `/apply` | Student | `{ roleId, profileVersion?, driveRevision? }`; 201 `{ message, application }` |
| GET | `/my` | Student | Own paginated `{ applications, total, page, limit, pages, ... }` |
| GET | `/preview/:companyId` | Student | `{ company, profile, profileVersion, driveRevision, application, roles }`; per-role eligibility checks |
| POST | `/:applicationId/requests` | Owning student | `{ kind: "CORRECTION" or "WITHDRAWAL", reason }`; 201 `{ application }` |
| DELETE | `/:applicationId` | Student | Always 405; use the withdrawal-request workflow |
| GET | `/admin/all` | `applications.view` | Paginated staff application list |
| PUT | `/admin/:applicationId/requests/:requestId` | `applications.manage` | `{ decision: "APPROVED" or "REJECTED", response }`; `{ application }` |
| PUT | `/admin/status/:applicationId` | `applications.manage` | Legacy `{ status: "APPLIED", "SELECTED", or "REJECTED" }`; 409 for current recruitment workflows |
| GET | `/admin/company/:companyId` | `applications.view` | Paginated company applicants, optionally filtered by `roleId` |

Apply also accepts `companyId` instead of `roleId` for a company with exactly one active role; supply exactly one of these IDs. Requests require a 5–1,000-character reason; decisions require a 3–1,000-character response. Staff responses remove resume data unless the caller also has `resumes.view`.

### Recruitment, export and offers — 8

Prefix: `/api/recruitment`. Source: [recruitmentRoutes.js](../backend/routes/recruitmentRoutes.js).

| Method | Path | Access | Input / result |
| --- | --- | --- | --- |
| GET | `/policy` | Session | Current placement-policy object, or defaults before setup |
| PUT | `/policy` | Super Admin | `{ revision, placedOn, furtherApplications }`; updated policy |
| POST | `/companies/:companyId/export` | `applications.export` | `{ roleId?, stageKey?, format?, columns }`; CSV/XLSX attachment, not JSON |
| POST | `/companies/:companyId/results/preview` | `rounds.manage` | Result settings below, JSON or multipart; 201 reviewed batch preview |
| POST | `/results/:batchId/publish` | `rounds.manage`, preview owner | No body; publishes unchanged, unexpired preview; batch result |
| POST | `/results/:batchId/undo` | `rounds.manage` | `{ reason }`; reverses eligible published batch; batch result |
| GET | `/companies/:companyId/results` | `rounds.manage` | Latest 100 published/undone batch summaries; no preview rows |
| POST | `/applications/:applicationId/offer` | `offers.manage` | `{ revision, action, reason, compensationDetails?, reference? }`; `{ application }` |

Result settings are `{ roleId, sourceKey, mode: "PARTIAL" or "FINAL", reason, text?, confirmEmptyShortlist? }`. Supply pasted emails/CSV in `text`, or a multipart `file` plus an `input` field containing those settings as JSON; do not supply both file and nonempty text. A multi-column file needs one Email column. XLSX accepts exactly one nonempty worksheet. Limits: 2 MiB file, 5,000 emails, 50 columns, or 250,000 pasted characters. Previews expire after 15 minutes. Undo reasons require at least five characters.

Export `format` defaults to `xlsx`; `stageKey` requires `roleId`. Select distinct columns from [exportColumns](../backend/validators/recruitmentValidator.js). Exports and per-role recruitment processing are capped at 5,000 applicants.

Offer `action` is `ISSUE`, `ACCEPT`, `JOIN`, `DECLINE`, or `REVOKE`; issuing requires `compensationDetails`. Policy `placedOn` is `ACCEPTED` or `JOINED`; `furtherApplications` is `ALLOW`, `BLOCK`, or `DREAM_ONLY`. See [offer transitions](WORKFLOWS.md#offers-and-placement-policy) before integrating writes.

### Placement reports — 4

Prefix: `/api/reports`. All require `reports.view` and return `Cache-Control: no-store`. Source: [reportRoutes.js](../backend/routes/reportRoutes.js).

| Method | Path | Result |
| --- | --- | --- |
| GET | `/overview` | Student, placement, application and offer totals with `asOf` |
| GET | `/options` | `{ courses, branches, years }` from registered profiles |
| GET | `/students` | Paginated `{ students, total, page, limit, pages }` |
| GET | `/groups` | Paginated `{ groups, total, page, limit, pages }` for branch, year or company |

### Notifications and saved drives — 5

Prefix: `/api/student`. All require Student and operate only on that student's data. Source: [studentExperienceRoutes.js](../backend/routes/studentExperienceRoutes.js).

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/notifications` | `{ items, total, totalCount, unreadCount, counts, page, limit, pages, asOf }` |
| POST | `/notifications/read` | Exactly one of `{ id }` or `{ before }`; `{ success }` |
| GET | `/saved` | `{ saved }`, own saved-drive records; unpaginated |
| PUT | `/saved/:companyId` | `{ remind? }`; creates/updates saved record; `{ saved }` |
| DELETE | `/saved/:companyId` | Removes own saved record and its deadline reminders; `{ success }` |

Use the inbox response's `asOf` as `before` when marking all displayed notifications read, so later arrivals remain unread. Inbox retrieval also prepares or removes deadline reminders; it is not a purely passive database read.

### File uploads and viewing — 8

Prefix: `/api/v1/upload`. Source: [upload.routes.js](../backend/routes/upload.routes.js).

| Method | Path | Access | Input / result |
| --- | --- | --- | --- |
| POST | `/profile-photo` | Session | Multipart `profilePhoto`; `{ success, message, profilePicture }` |
| POST | `/resume` | Student | Multipart `resume`; creates resume version; `{ success, message, resume }` |
| GET | `/resume/versions` | Student | `{ versions }`, latest 50 own resume versions |
| GET | `/resume/view` | Student | Optional `versionId` query; own `{ success, signedUrl }` |
| GET | `/resume/view/:studentId` | `resumes.view` | Optional `versionId` belonging to that student; `{ success, signedUrl }` |
| POST | `/jd/:companyId` | `companies.manage` | Legacy multipart `jd`; modern drives return 409; `{ success, jobDescription }` |
| GET | `/jd/view/:companyId` | Session and drive visibility | First shared JD's `{ success, signedUrl }` |
| GET | `/jd/guest/view/:companyId` | Public visibility | First shared public JD's `{ success, signedUrl }` |

## Upload and request budgets

| Input | Maximum | Accepted types |
| --- | --- | --- |
| Profile photo | 2 MiB | JPEG, PNG, WEBP |
| Resume | 5 MiB | PDF, DOC, DOCX |
| JD / drive / role document | 10 MiB | PDF, DOC, DOCX, JPEG, PNG, WEBP |
| Recruiter results | 2 MiB | CSV, XLSX |
| JSON body | 100 KiB normally | Company routes: 1 MiB; recruitment: 300 KiB; roster-import routes: 2 MiB envelope, still subject to the 1 MiB CSV limit |

Photo/resume/JD/document uploads accept one file and no text fields. Put drive-document metadata in the query. Let the browser set the multipart boundary; do not force a JSON content type. Each drive or role supports at most 20 current documents. Signed S3 viewing URLs expire after five minutes and must be requested again rather than persisted as permanent links.

The process admits at most eight simultaneous upload operations, with two per account. Saturation returns `429`, `UPLOAD_BUSY`, and `Retry-After: 5`. XLSX parsing additionally allows two concurrent workers and enforces time/decompression bounds; prefer CSV if a workbook is rejected. These are per-process limits.

General traffic is limited to 20,000 requests per IP per 15 minutes, excluding `/health`. Google login limits failed attempts to 1,000 per IP per 15 minutes. Recruiter previews allow 12 requests per admin per minute. Deployment topology and limiter/storage behavior are covered in [Deployment](DEPLOYMENT.md) and [Architecture](ARCHITECTURE.md).

For persisted fields, use [Data model](DATA_MODEL.md); for extending these contracts, use [Testing](TESTING.md) and [Contributing](CONTRIBUTING.md).
