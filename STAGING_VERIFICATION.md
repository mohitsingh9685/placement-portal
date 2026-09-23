# Live infrastructure verification — 23 September 2026

This follow-up checks the configured providers directly. It does not deploy code,
resume the old backend, or change account permissions. Mohit subsequently applied
the Stage 4/6 index setup; the result was verified read-only as recorded below.
Local credentials may differ from the environment stored in Render.

## Hosting and login

| Check | Observed result |
| --- | --- |
| Frontend | `https://placement-portal-college.vercel.app` returns HTTPS 200; HSTS present. |
| Frontend API target | The served bundle points to `https://placement-portal-re4s.onrender.com/api`. |
| Google client configuration | The public client ID in the deployed frontend matches the configured local backend client ID. This does not validate Google Console origins or the suspended backend's environment. |
| Backend | `/health` and the profile endpoint return HTTP 503 with **“Service Suspended — This service has been suspended by its owner.”** |
| Release match | The served frontend contains Axios 1.16.0; the security update to 1.20.0 remains local. |
| Local production build | The current local build embeds localhost because `.env.local` overrides the API URL. Do not deploy this artifact; build with the intended production `VITE_API_URL`. |
| Local configuration | Frontend/backend Google client IDs match; token secrets are distinct and at least 32 characters; the Atlas URI names the project database. These checks do not establish the deployed environment values. |

The suspended backend prevents end-to-end hosted Google login, session refresh,
logout, allowed/blocked origins, cookie persistence, and application endpoint
checks. Hosting responses cannot be treated as application security responses.
A separate staging URL and designated Google test account have been requested.
No running staging deployment has been identified.

The frontend and backend use different sites (Vercel and Render). Actual browser
cookie-policy testing is still required on the intended domains, including a
browser that blocks third-party cookies. HTTPS and `SameSite=None; Secure` alone
do not prove that those browsers will retain the session.

## Storage

Using the configured local backend credentials, read-only provider checks found:

- S3 is reachable and its region matches the configuration.
- All four S3 public-access block flags are enabled.
- Bucket ownership is enforced; ACL access is owner-only.
- Default AES256 encryption is enabled; no bucket policy exposes objects.
- Cloudinary authenticated ping and configuration reads succeed.
- No Cloudinary upload presets are configured, including unsigned presets.

IAM permission simulation was denied by the account's policy. Actual synthetic
object operations were then verified with those credentials:

| Synthetic check | Result |
| --- | --- |
| S3 upload | One new UUID-named, 85-byte test object uploaded successfully; versioning is disabled. |
| S3 private access | Anonymous GET returned 403; a five-second signed URL returned 200 with the exact bytes. |
| S3 URL expiry | After seven seconds, the same signed URL returned 403. |
| S3 cleanup | Deleted only the test object; HEAD confirmed 404. |
| Cloudinary upload/delivery | One generated 1×1, 70-byte PNG uploaded with authentication; delivery returned 200 and the exact image bytes. |
| Cloudinary cleanup | Destroyed only the test public ID and requested its CDN invalidation; the Admin API confirmed 404. |

Both temporary files were removed; no leftovers remain. No existing student
objects were enumerated, downloaded, overwritten, or deleted. This verifies the
provider operations, not their wiring through a deployed application endpoint.

S3's configured production CORS origin has a trailing slash, which does not match
the browser's `Origin` header. The current server uploads and new-tab downloads
do not depend on that rule. It remains a minor configuration issue for any future
direct browser storage requests; no bucket setting was changed.

## Database and supporting service

The explicitly configured `placement-portal` Atlas database is reachable. The
connection took approximately 500 ms; three sampled pings took 97–398 ms from
this laptop. Replica-set and logical-session capabilities support transactions.
The Stage 2 migration marker and application uniqueness index are present, as
are the Stage 5 recruitment indexes and a valid placement policy.

The initial index review found **10 missing performance indexes**. After Mohit
ran the Stage 4 and Stage 6 setup commands, direct Atlas verification on
23 September 2026 at 15:32 IST confirmed **all 10 are present**. Across 17
collections, **32/32 expected indexes** and **8/8 uniqueness constraints** match
the current model requirements. No expected indexes remain missing.

Exact ordered key patterns and unique/sparse/TTL/partial-filter/collation/hidden
options were compared; different index names were not treated as missing.
The partial student/drive application uniqueness index and sparse legacy-company
uniqueness constraints remain intact.

| Collection | Previously missing key patterns — now present |
| --- | --- |
| `notifications` | `{recipient:1, createdAt:-1}` |
| `notificationreads` | `{student:1, notification:1}` |
| `savedopportunities` | `{student:1, createdAt:-1}` |
| `students` | `{role:1, course:1, branch:1, passingYear:1, placementStatus:1}`; `{role:1, name:1, _id:1}` |
| `companies` | `{companyName:1, _id:1}`; `{createdAt:-1, _id:-1}` |
| `applications` | `{company:1, role:1, appliedAt:-1, _id:-1}`; `{student:1, appliedAt:-1, _id:-1}`; `{"offer.status":1, student:1}` |

Existing Stage 4 and Stage 6 setup scripts created these indexes. Their apply
mode is additive and idempotent, without editing account, application or policy
records. The follow-up verification read only collection/index metadata and
made no database writes. No student, admin, application or session records were
read for verification. This resolves the missing-index finding.

The configured Redis service accepts authenticated PING over TLS (145 ms).
No Redis keys were read or changed. These measurements do not establish latency
or capacity from the eventual Render instance.

## Remaining release verification

The existing suspended backend must not be mistaken for a staging deployment of
the audited code. Deploy matching frontend/backend
versions to an identified staging environment, then verify real student/admin
Google login, browser sessions, application uploads, and authorization using
designated test accounts. Real hosting limits and deployed secret/config values
remain unverified until that environment is available.
