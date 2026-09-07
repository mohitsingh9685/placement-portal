# MAIT Placement Portal

A full-stack placement management system for students and administrators. It centralizes company listings, eligibility checks, applications, status tracking, profile management, and document uploads.

## Highlights

- Google OAuth restricted to pre-approved students and administrators
- HTTP-only JWT cookies with automatic access-token refresh
- Role-based access for company, applicant, resume, and JD operations
- CGPA, branch, backlog, and active-backlog eligibility checks
- Session-only guest demo with realistic eligibility and private applications
- Redis company caching and global API rate limiting
- Private AWS S3 storage with short-lived signed URLs
- Cloudinary profile-photo uploads
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

## Run with Docker

Requirements: Docker Desktop and Docker Compose.

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

The same Google client ID must be configured in the frontend and backend. A Google account must also exist in the MongoDB `ApprovedStudent` collection.

## Focused Tests

```bash
node --test backend/tests/auth-refresh.test.js
node --test frontend/tests/eligibility.test.js
```

## Deployment Notes

- Configure frontend `VITE_*` variables in Vercel.
- Configure all backend secrets in Render.
- Keep the S3 bucket private and use signed URLs for access.
- Use a `rediss://` Upstash connection URL.
- Redeploy or restart a service after changing its environment variables.
