# Getting started

[Documentation home](../README.md)

## Prerequisites

- Node.js 22.12 or newer in the 22.x line; `.nvmrc` selects Node 22, matching CI.
- npm, Git and Docker Desktop for the disposable MongoDB replica set.
- A browser. Google and cloud-storage credentials are only needed for real
  integration work, not the synthetic preview.

MongoDB transactions require a replica set. A standalone `mongod` is insufficient
for application submissions, roster imports and recruitment changes.

## Install

Run from the repository root:

```sh
npm --prefix backend ci
npm --prefix frontend ci
```

There are no root application dependencies to install. Keep the two application
lockfiles alongside their respective `package.json` files.

## First run: synthetic preview

1. Start the local MongoDB replica set using [Testing](TESTING.md).
2. Start the preview:

   ```sh
   TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' npm run preview:stage2
   ```

3. Open a student or admin URL printed by the command. The preview uses port
   5187 for the frontend and 9107 for the API.
4. Press Ctrl+C when finished. The preview removes its own temporary database.

This is the quickest way to explore the product and make UI changes. It creates
synthetic accounts, drives and applications, disables real Google sign-in, and
does not load the application's `.env`. Most cloud operations are disabled;
drive-document storage is replaced with an in-memory implementation.

The `stage2` name is retained for compatibility with existing scripts. The preview
includes the current workflows, not only an earlier version of the product.

## Full local development

Use this mode when testing real sign-in or provider integrations. Use a dedicated
development database and test credentials supplied through the team's secure
credential-sharing process.

Copy the templates only if the destination files do not already exist:

```sh
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env.local
```

Configure these files as follows:

| Setting | Requirement |
| --- | --- |
| `MONGO_URI` | Name the intended development database explicitly; use a replica set. |
| `CLIENT_URL` | `http://localhost:5173` locally, without a path or trailing slash. |
| `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` | The same Google web client ID in both applications. |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | Two different random secrets, at least 32 characters each. |
| `VITE_API_URL` | `http://localhost:9000/api` for the local API. |
| `REDIS_URL` | Optional; leave empty locally. Current company-list reads query MongoDB directly. |
| AWS and Cloudinary settings | Required for real document and profile-image operations. |

The app uses Google ID-token verification; a Google client secret is not required
by the current sign-in implementation. Configure the frontend origin in Google's
Authorized JavaScript origins. Google sign-in does not bypass the portal's approved
student list or active staff-account checks.

Generate a new value separately for each token secret, for example:

```sh
node -e 'console.log(require("node:crypto").randomBytes(48).toString("base64url"))'
```

Initialize the selected development database using the setup procedure in
[Deployment](DEPLOYMENT.md). The normal API refuses startup without the base
migration marker and application uniqueness index. Existing staff accounts and
student approvals must be provisioned for real sign-in; the synthetic preview
supplies its own accounts instead.

Start the API in one terminal and the frontend in another:

```sh
npm run backend
```

```sh
npm run frontend
```

Open `http://localhost:5173`; API health is `http://localhost:9000/health`.
Using the repository owner's existing `.env` can connect to real Atlas data.
Check the selected environment before creating, editing or deleting records.

### Docker development

After configuring the same environment files and database setup:

```sh
docker compose up -d --build
docker compose logs -f
```

The Compose stack runs Vite and nodemon and mounts the source directories. It
does not create MongoDB, Redis or storage accounts. For MongoDB on the Mac host,
use a URI reachable from the container; `localhost` inside the API container
refers to that container. The included Dockerfiles are development images.

## Useful commands

| Command, from repository root | Purpose |
| --- | --- |
| `npm run frontend` / `npm start` | Frontend development server |
| `npm run backend` | API development server |
| `npm test` | Backend and frontend unit/API tests |
| `npm run check` | Unit/API tests, frontend lint and build |
| `npm run test:integration` | Integration tests; requires `TEST_MONGO_URI` |
| `npm --prefix backend start` | Normal API process without nodemon |

## Common startup problems

| Symptom | Check |
| --- | --- |
| Migration-required error | Follow database setup in [Deployment](DEPLOYMENT.md); do not bypass the startup guard. |
| Google sign-in rejected | Matching client IDs, allowed browser origin, verified account and active approval/staff record. |
| Transactions unavailable | MongoDB must run as a replica set. |
| API connection or CORS failure | Match `VITE_API_URL`, API port and exact `CLIENT_URL` origin. Restart after changing env files. |
| Production build points to localhost | Vite loads `.env.local` for builds too; supply the intended build-time `VITE_API_URL`. |
| Upload fails locally | Check provider credentials, private-bucket permissions and limits in [API](API.md). |

For a first change, read [Architecture](ARCHITECTURE.md), then the relevant
[workflow](WORKFLOWS.md) and [Contributing](CONTRIBUTING.md).
