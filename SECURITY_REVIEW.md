# Pre-deployment security review — 23 September 2026

Scope: all registered HTTP endpoints and critical authentication, permissions,
publishing, application, recruitment, document, and reporting flows. Changes are
limited to high-risk resource exhaustion and security dependency updates. The UI,
placement rules, and existing account permissions are unchanged.

## Confirmed high-risk issues fixed

### Unbounded multipart fields could exhaust API memory

Photo, resume, and job-description endpoints limited the file size but not the
number of ordinary multipart fields. An authenticated student could submit a
request containing no file and retain arbitrarily many fields before validation.
A safe reproduction retained 16 MiB from 32 fields of 512 KiB each; more fields
were accepted even by the 2 MiB photo endpoint.

The shared upload configuration now accepts one file and zero ordinary fields,
with bounded multipart parts and field metadata. Existing document metadata
continues to use the query string. Recruiter imports retain their separate,
bounded single metadata field.

The five buffered upload entry points also share a per-process admission limit
of eight active requests and two per account, independent of the campus IP.
Busy requests receive HTTP 429 and `Retry-After`. Storage operations keep their
slot until completion even if the client disconnects. Requests that disconnect
before processing do not start storage work. This prevents concurrent uploads
or repeated disconnects from bypassing the memory bound. No queue or new service
was added.

### Crafted XLSX archives bypassed decompression checks

The XLSX preflight trusted the ZIP directory's declared entry count, while the
workbook loader tolerated an incorrect count and read additional entries. A
24,266-byte workbook with 17 MiB of compressed media was correctly rejected
initially, then accepted after changing the two entry-count fields from 18 to 1.
Larger concealed entries could consume memory outside the worker's JS heap limit.

Preflight now requires consistent directory counts, offsets, sizes, disk fields,
local payload boundaries, and compression methods before loading the workbook.
Actual decompression remains capped at 16 MiB per entry and 24 MiB total. At most
two XLSX workers run simultaneously; their slots remain occupied until worker
termination. The existing worker heap and execution-time limits remain in place.

## Endpoint coverage

The new integration inventory matches the actual registered routes and fails on
duplicates or new, unclassified endpoints. It covers **65 method/path pairs**:

| Route group | Endpoints | Access policy checked |
| --- | ---: | --- |
| `/api/auth` | 6 | Google admission, session operations, student profile changes, staff activity |
| `/api/admin/accounts` | 3 | Super Admin only |
| `/api/admin/roster` | 4 | Student-view/manage permissions; import ownership |
| `/api/company` | 14 | Public published listings; authenticated reads; company-management writes |
| `/api/application` | 9 | Student ownership; separate applicant-view/manage permissions |
| `/api/recruitment` | 8 | Export, rounds, offers, and Super Admin policy permissions |
| `/api/reports` | 4 | Report permission |
| `/api/student` | 5 | Student-only notifications and saved opportunities |
| `/api/v1/upload` | 8 | Own student resumes, resume-view permission, company-management uploads |
| `/`, `/health`, `/api/academics`, `/api/protected` | 4 | Public metadata/health and authenticated session read |

All **55 protected endpoints** are exercised for anonymous access. The matrix
also checks wrong roles, missing grants, grants changed during an existing
session, disabled accounts, and authorized reads. All **34 write endpoints**
reject foreign, null, and missing browser origins. The three authentication
protocol endpoints are intentionally callable before authentication; their
credentials, cookies, and identity rules are covered by the authentication suite.

Existing functional regressions cover object ownership, draft and historical
document visibility, immutable application snapshots, duplicate submissions,
concurrent requests and decisions, stale revisions, expired result previews,
offer transitions, retained history, export formula injection, profile field
allowlists, malformed inputs, notification isolation, and migration safeguards.
Source review found no further confirmed high-risk access-control or data-integrity
defect in these flows.

## Dependencies

Updated compatible versions in the frontend lockfile for packages with high
advisories: Axios, React Router, Form Data, PostCSS, brace-expansion, Browserslist,
js-yaml, and nanoid, including required transitive updates. No major-version
upgrade or dependency override was introduced. Some advisories concern tooling
or server-side library features that this browser-only frontend does not expose;
they are not described here as demonstrated portal exploits.

The npm advisory check after the updates reports:

| Dependency tree | Critical | High | Other |
| --- | ---: | ---: | --- |
| Backend, including development dependencies | 0 | 0 | 0 |
| Frontend, including development dependencies | 0 | 0 | 2 low, 1 moderate |

The remaining frontend findings are development tools (`@babel/core`,
`@humanfs/node`, and `postcss-selector-parser`), outside the requested severity
scope. Deploy the locked versions using `npm ci`.

## Validation and capacity

The complete verification run passed **237 tests**: 60 backend unit tests,
45 frontend tests, and 132 integration tests, with no skipped integration tests.
Frontend lint, the production build, and whitespace checks also passed.
An isolated browser smoke check verified student and admin session redirects,
dashboard navigation, the application-details dialog, and report loading with
the updated client dependencies. This used synthetic accounts and local data.

The disposable capacity fixture contains 1,000 student accounts and sessions,
30 companies, 3,000 applications, and 8,000 notifications. Application documents
average approximately 5 KiB, with three project descriptions per profile and
an approved correction on 10% of students' applications.

| Local scenario | Result |
| --- | --- |
| 600 authenticated reads, 20 simultaneous requests | 0 errors; 59.7 requests/sec; p95 0.95 sec |
| 600 authenticated reads, 40 simultaneous requests | 0 errors; 50.8 requests/sec; p95 2.22 sec |
| Recruitment context, 1,000 applicants | 286 ms |
| Export 1,000 applicants | CSV 115 ms; XLSX 173 ms |
| Recalculate 300 accepted offers | 2.16 sec; consistent application/student placement totals |
| 100 students apply to one drive, 20 simultaneous requests | 0 errors; 34.1 submissions/sec; p95 2.21 sec |
| Replay all 100 submissions | All rejected with HTTP 409; zero duplicate records |

The write scenario creates and publishes a fresh drive over HTTP, previews each
student's eligibility, and submits the returned review version. It verifies
exactly 100 applications, 100 private notifications, and an applicant count of
100, unchanged after replay. Peak process RSS across the final scenarios was
about 272 MiB. The table records the final run; local timing varies between runs.

These measurements use loopback HTTP and local MongoDB, with rate limiting
disabled for capacity measurement. They do not establish production throughput
or support a claim of 1,000 simultaneous users. No speculative query rewrite or
new infrastructure was added based on these results.

Reproduce with an unauthenticated disposable **local** MongoDB replica set:

```sh
npm run check
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run test:integration
TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' node --expose-gc backend/scripts/audit-capacity.js
npm --prefix backend audit
npm --prefix frontend audit
```

## Deployment boundary

Follow-up provider checks are recorded in [Live infrastructure verification](STAGING_VERIFICATION.md).
They verified private S3 access, signed URL expiry, Cloudinary operations and
synthetic-file cleanup, plus read-only Atlas/Redis connectivity. The hosted
backend remains suspended, so hosted login and browser session checks remain
blocked. The original audit's local test boundary is recorded below.

No deployment, real account changes, cloud uploads, or production database
modifications were performed. Hosted Google OAuth, browser cookie behavior on
the actual domains, private S3 policy, Cloudinary access, Render limits, and
Atlas latency still require staging verification. Use the existing Stage 2,
Stage 4, Stage 5, and Stage 6 setup instructions and production environment
settings; the development Dockerfiles are not the production start command.

This review fixes the demonstrated high-risk issues and records tested coverage.
It is not a guarantee that the project has no undiscovered vulnerabilities.
