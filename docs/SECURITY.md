# Security

The API is the authorization boundary. Browser route guards and hidden controls are navigation aids, not permission checks. See [API](API.md) for endpoint contracts and [Architecture](ARCHITECTURE.md) for the system boundaries.

## Identity and sessions

- Google ID tokens are verified against the configured client ID. Admission requires an active administrator or an approved student email. Student roster imports cannot create administrator accounts.
- Access tokens last 15 minutes; refresh tokens last seven days. They use different secrets, token types and audiences, a fixed issuer, and HS256 verification. The server validates the account and session identifiers.
- `AuthSession` stores per-session state and hashed refresh tokens. Refresh issues a new access token while retaining the original refresh token and fixed seven-day session expiry, allowing concurrent tabs to refresh safely. Logout revokes that device's session. Protected requests recheck active account state and current permissions; account access/permission changes revoke affected sessions.
- Session cookies are HTTP-only. Production uses `Secure` and `SameSite=None`; development uses `SameSite=Lax`. Keep the production frontend/API on HTTPS and verify browser cookie behavior during deployment.
- Cookie-authenticated writes require a trusted `Origin`; foreign, null, or absent origins are rejected. Bearer-only requests without cookies have a separate origin exception and still require authentication. CORS is not the write-request protection.

Core configuration is validated at startup. Keep access and refresh secrets distinct and at least 32 characters each. Never expose backend credentials through `VITE_*` variables, logs, client bundles, issue reports, or signed URL examples.

## Permissions and data access

Super Admins manage staff access and college rules. Ordinary administrators receive explicit permissions with enforced dependencies. Protected Super Admin accounts cannot be edited or removed through ordinary account-management actions. The initial-owner bootstrap is deliberately limited; it is not an alternative staff-management API.

Students can access their own profile, applications, resume versions, saved listings, and notification state. Staff applicant access does not itself grant resume access. Resume downloads require ownership or the resume-viewing permission.

Published company listings and their current job-description documents are intentionally available to guests. Draft details require publishing access. Retired document versions are restricted to authorized staff or applicants whose retained submission references them. S3 objects remain private: the API issues five-minute download URLs only after checking access. A URL already issued can remain usable until expiry, and a downloaded copy cannot be recalled by revoking a permission.

Database transactions, revision checks, and the unique student/drive application index protect against partial writes, stale edits, and duplicate submissions. Original application snapshots and resume references remain separate from later profile changes and approved corrections. Recruitment publication checks the reviewed batch against current applicant/round state. See [Data model](DATA_MODEL.md) and [Workflows](WORKFLOWS.md) for these invariants.

## Input and resource limits

Request validators accept defined fields, bound pagination/input sizes, and escape text search patterns. CSV exports neutralize spreadsheet formula prefixes; XLSX exports preserve submitted values as data. Error responses avoid exposing server stacks or credentials.

Uploads are buffered, so both request size and concurrent work are bounded:

| Input/work | Current bound |
| --- | --- |
| Profile photo | One JPEG, PNG, or WebP image; 2 MiB maximum. |
| Resume | One PDF, DOC, or DOCX file; 5 MiB maximum. |
| Job-description document | One PDF, DOC, DOCX, JPEG, PNG, or WebP file; 10 MiB maximum. |
| Ordinary upload multipart shape | One file, no text fields; document metadata uses validated query fields. Missing/extra-file and unexpected-field requests are rejected. |
| Buffered upload admission | Eight active uploads per API process, at most two per account. Busy requests receive `429`; slots remain occupied until storage/database work settles, even if the client disconnects. |
| Recruiter result input | CSV/XLSX file up to 2 MiB, or bounded pasted text; at most 5,000 data rows and 50 columns. |
| XLSX parsing | Two concurrent workers per process, eight-second timeout, 96 MiB worker old-generation limit, 16 MiB per expanded ZIP entry and 24 MiB aggregate expansion limits. |

The workbook validator checks ZIP directory counts, exact boundaries, local records, payload ranges, and supported compression before loading the workbook. Declared compressed metadata cannot be used to hide unchecked entries from expansion validation. These checks address a confirmed resource-exhaustion path; the worker heap limit alone does not bound external buffers.

The September 2026 review also closed a multipart bypass where large ordinary fields escaped file-size caps. Regression tests cover both issues, valid uploads/workbooks, concurrent admission, and cleanup after failure. These process-local bounds limit memory pressure; they are not a distributed queue or a substitute for deployment capacity testing.

File acceptance is based on the implemented type/size checks. The application does not claim antivirus or content-disarm scanning. Keep downloaded office documents subject to the institution's normal document-handling policy.

## Storage, secrets, and retained records

Keep S3 public access blocked, bucket ownership enforced, and encryption enabled. Scope runtime credentials to the operations and storage locations the application needs. Profile photos are delivered through Cloudinary and should not contain confidential documents. Do not make a bucket public to fix an application authorization or signing problem.

Historical applications, documents, recruitment results, and audit records are retained for workflow integrity. The five-item recent-activity UI does not truncate the audit log. Session/import-preview TTL cleanup is not a general student-data retention policy. Backup and recovery responsibilities are described in [Deployment](DEPLOYMENT.md#backup-and-recovery).

Real environment files, `private-data/`, database dumps, roster exports, cookies, and signed URLs are not test fixtures. Use synthetic data in automated tests and share sanitized diagnostics only. If a credential is exposed, revoke/rotate it and any affected sessions; removing a committed file does not revoke the leaked value.

## Verification and maintenance

[Testing](TESTING.md) documents the endpoint access inventory, session/permission checks, malformed-file regressions, and local capacity tooling. The inventory rejects duplicate registered method/path pairs and requires new routes to be classified. Extend that coverage whenever an endpoint or permission changes.

Check dependency advisories using the lockfiles actually deployed:

```sh
npm --prefix backend audit
npm --prefix frontend audit
```

On 23 September 2026, the installed backend had no reported advisories; the frontend had no high/critical advisories and retained two low and one moderate build-tool advisory. Recheck before release. Assess affected usage and compatible updates rather than applying forced major-version changes without regression checks.

The dated infrastructure/storage results and the remaining hosted-login gap are recorded once in [Deployment](DEPLOYMENT.md#last-verified-state--23-september-2026). Passing local tests or provider checks does not prove that a hosted deployment has the same code and environment.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the project maintainer through an established private channel. Include the affected revision/endpoint, prerequisites, expected and actual behavior, impact, and a reproduction using synthetic data. Do not publish credentials, session cookies, student records, or reusable signed URLs in an issue. Avoid reproducing an issue against another person's records or exhausting a live service.

For code changes and review expectations, see [Contributing](CONTRIBUTING.md). Setup instructions are in [Getting started](GETTING_STARTED.md).
