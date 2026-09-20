# MAIT Placement Portal

A full-stack placement management system for students and administrators. It centralizes company listings, eligibility checks, applications, status tracking, profile management, and document uploads.

## Highlights

- Google OAuth restricted to pre-approved students and administrators
- HTTP-only JWT cookies, automatic session restoration, and independent device sessions
- Role-based access for company, applicant, resume, and JD operations
- CGPA, branch, backlog, and active-backlog eligibility checks
- Session-only guest demo with realistic eligibility and private applications
- Optional Redis caching with bounded fallback, request validation, and API rate limiting
- Private AWS S3 storage with short-lived signed URLs
- Cloudinary profile-photo uploads
- Separate staff accounts, college email-roster imports and batch administration
- Super Admins can add staff, grant/revoke ordinary admin permissions and disable/restore ordinary admin access; all Super Admin accounts are protected from management changes
- Direct academic profile editing, application snapshots and retained resume versions
- Drive/role data foundation with one application per student per drive
- Docker Compose development environment

## Tech Stack

- **Frontend:** React 19, Vite, React Router, Axios, Tailwind CSS
- **Backend:** Node.js, Express 5, Mongoose
- **Data:** MongoDB Atlas, Upstash Redis
- **Storage:** AWS S3, Cloudinary
- **Deployment:** Vercel frontend, Render backend

## Architecture

```text
Browser → React/Vite → Express API → MongoDB
                              ├── Redis cache
                              ├── AWS S3
                              └── Cloudinary
```

## Environment Setup

Environment files are intentionally excluded from Git.

### Backend: `backend/.env`

```env
PORT=9000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=
REDIS_URL=
GOOGLE_CLIENT_ID=
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
AWS_BUCKET_NAME=
AWS_BUCKET_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Frontend: `frontend/.env.local`

```env
VITE_API_URL=http://localhost:9000/api
VITE_GOOGLE_CLIENT_ID=
```

Never commit real credentials.

Access and refresh secrets must be different random strings of at least 32 characters. Startup checks required settings before connecting. `CLIENT_URL` must be the frontend origin with no path; HTTPS is required in production. Specify the intended database in `MONGO_URI`. Redis may be omitted for local development.

## Run with Docker

Requirements: Docker Desktop and Docker Compose.

This release requires the explicit stage 2 database migration before the regular backend starts. Follow [stage 2 verification and rollout](STAGE_2_TESTING.md); use its synthetic preview to inspect the screens without changing Atlas. Coordinate the migration with deployment rather than starting stage 1 and stage 2 against the same database.

```bash
docker compose up -d --build
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:9000/health](http://localhost:9000/health)

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

The included Dockerfiles and `docker-compose.yaml` are intended for local development with Vite and nodemon.

## Run without Docker

Install dependencies once:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

Start the API:

```bash
npm run backend
```

Start the frontend in another terminal:

```bash
npm start
```

## Google Sign-In

Add these Authorized JavaScript origins to the Google OAuth web client:

- `http://localhost:5173`
- `https://placement-portal-college.vercel.app`

The same Google client ID must be configured in the frontend and backend. After trimming/lowercasing, a student's verified Google email must match an active `approvedstudents` entry. Personal Gmail accounts are supported. Staff emails must match an active `admins` account instead; administrators are not student records. Setting `isActive: false` blocks access, including existing sessions. Roles come from the server's account model; browser-supplied roles are ignored. Student roster imports cannot create staff access.

Super Admins have full administrative access and manage staff through **Admins**. Ordinary admins require explicit permissions for student management, company changes, applicant results and resumes. See [Super Admin setup, permissions and testing](SUPER_ADMIN_TESTING.md) for the one-time owner bootstrap and access-management workflow.

Browser POST/PUT/PATCH/DELETE requests must send an allowed `Origin`. CORS alone is not the CSRF defense. Non-browser clients may use bearer-only authorization without cookies; Google login and cookie refresh/logout require an allowed origin.

## Focused Tests

```bash
npm test
npm run check
```

These checks use synthetic persistence and Google verification without connecting to Atlas or cloud services. `npm run test:integration` additionally uses a disposable localhost MongoDB replica set supplied through `TEST_MONGO_URI`. See [stage 2 setup, preview and rollout](STAGE_2_TESTING.md), the [stage 1 baseline](STAGE_1_TESTING.md), and the [six-stage implementation plan](IMPLEMENTATION_PLAN.md). The migration creates `admins` within the existing database; there is no need to delete existing databases.

## Deployment Notes

- Configure frontend `VITE_*` variables in Vercel.
- Configure all backend secrets in Render.
- Keep the S3 bucket private and use signed URLs for access.
- Use a `rediss://` Upstash connection URL.
- Redeploy or restart a service after changing its environment variables.
