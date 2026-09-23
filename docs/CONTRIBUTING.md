# Contributing

[Documentation home](../README.md)

## Before changing code

1. Read [Getting started](GETTING_STARTED.md) and run the synthetic preview.
2. Check the current branch and working-tree changes; preserve work in progress.
3. Read the affected [workflow](WORKFLOWS.md), [API](API.md) and
   [data model](DATA_MODEL.md) before changing behavior.
4. Use a focused branch and keep each change reviewable. Avoid mixing unrelated
   redesigns, dependency upgrades, migrations and feature work.

## Implementation conventions

- Follow the existing ES module and React function-component style. Use existing
  shared form, pagination, date, permission and dialog utilities when applicable.
- Keep request parsing and HTTP handling in routes/controllers; shared business
  rules belong in services. Use Zod validation at API boundaries.
- Enforce authorization and eligibility on the server. Frontend guards and hidden
  buttons provide navigation, not access control.
- Preserve application snapshots, resume versions, recruitment history and
  placement-policy semantics. Make concurrent writes use the existing revision
  and transaction patterns.
- Scope student reads and writes to their owner. Consult [Security](SECURITY.md)
  when adding files, imports, public endpoints or permissions.
- Preserve responsive layouts, keyboard access, focus restoration and readable
  error messages. Keep product wording concise.
- Do not add another abstraction, package or service for a problem already handled
  by the codebase. Remove confirmed unused code with its obsolete tests.

## Verification

Run `npm run check` before submitting a change. Run relevant MongoDB integration
tests for authorization, database, migration or workflow changes; the full suite
requires the disposable replica set described in [Testing](TESTING.md).

Add meaningful regressions for bugs and changed behavior. UI-only spacing or copy
changes generally need visual verification and existing checks, not tests that
copy their implementation. Validate changed layouts at desktop and mobile widths.

For a new endpoint, update both the route inventory in
[`endpoint-access.test.js`](../backend/tests/integration/endpoint-access.test.js)
and [API](API.md). Cover its permissions, owner checks, invalid inputs, and browser
write-origin policy. Never run synthetic destructive/load tests against Atlas.

## Data and dependency changes

Add database changes through explicit, repeatable setup/migration scripts. Document
the target database, dry run, application procedure, compatibility and recovery
limits in [Deployment](DEPLOYMENT.md). Do not rename historical migration IDs or
remove compatibility fields solely to make names look cleaner.

Change dependencies in the relevant frontend/backend package and commit its
lockfile. Use `npm ci` when verifying an existing lockfile. Review advisories and
validate affected behavior after updates; a successful build alone is insufficient.

## Review handoff

A pull request should explain:

- The concrete problem and resulting behavior.
- Important implementation choices and compatibility/data effects.
- Tests and manual checks actually run, with any remaining limitations.
- Required environment, migration or deployment work, if any.

Include screenshots for visible UI changes. Do not attach real student records,
tokens, roster exports, signed document URLs or private backups. Share security
reproduction details privately with project maintainers.

## Keep documentation current

Update the relevant guide with the final behavior. Keep the root README as a short
entry point; put endpoint details in API, schema constraints in Data model, and
release procedures in Deployment. Prefer links to repeating the same instructions.
Record verification dates when a result depends on live infrastructure. Do not
present local/synthetic checks as production verification or retain completed
implementation plans as the primary developer documentation.
