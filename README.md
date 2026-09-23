# Placement Portal

A college placement system for students, placement staff and Super Admins. It
manages approved student access, company drives, role eligibility, applications,
recruitment rounds, offers and placement reports.

## Start here

New developers should follow [Getting started](docs/GETTING_STARTED.md). The
synthetic preview runs against a disposable local database without Google, AWS,
Cloudinary or production credentials.

| Guide | What it covers |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Installation, environment files, local development and startup problems |
| [Architecture](docs/ARCHITECTURE.md) | System boundaries, source layout and request flow |
| [Data model](docs/DATA_MODEL.md) | Collections, relationships, snapshots, indexes and compatibility |
| [API reference](docs/API.md) | Endpoints, permissions, request conventions and errors |
| [Product workflows](docs/WORKFLOWS.md) | Student access, publishing, applications, results and placement rules |
| [Security](docs/SECURITY.md) | Authentication, authorization, private files and security verification |
| [Testing](docs/TESTING.md) | Unit/integration checks, synthetic preview and capacity measurements |
| [Deployment](docs/DEPLOYMENT.md) | Environment configuration, database setup, release checks and recovery |
| [Contributing](docs/CONTRIBUTING.md) | Change scope, review expectations and documentation maintenance |

## Technology

| Layer | Stack |
| --- | --- |
| Web app | React 19, Vite, React Router, Tailwind CSS, Axios |
| API | Node.js, Express 5, Mongoose, Zod |
| Database | MongoDB replica set / Atlas |
| Optional cache | Redis |
| Files | Private AWS S3 documents; Cloudinary profile images |
| Hosting | Vercel frontend; Render API |
| Verification | Node test runner, ESLint, GitHub Actions |

## Repository

```text
frontend/          Web application and frontend tests
backend/           API, models, services, database setup and backend tests
docs/              Developer and operations guides
.github/workflows/ Continuous integration
docker-compose.yaml Local development containers
```

Install dependencies in `frontend` and `backend`; the root package only coordinates
commands. Both applications have committed lockfiles. Use `npm ci` for reproducible
installs and `npm run check` for the standard verification run.

## Local private files

`private-data/` is an optional, Git-ignored local folder for database backups,
student roster imports and verification records. **It is not required to run or
deploy the application.** It may contain student information and recovery copies;
do not publish it, use it as test fixtures, or delete the only backup. New
developers do not need a copy. See [data handling and recovery](docs/DEPLOYMENT.md).

Environment files, installed dependencies, build output and editor settings are
also excluded from Git. Start from the committed `.env.example` templates rather
than sharing another developer's credentials.
