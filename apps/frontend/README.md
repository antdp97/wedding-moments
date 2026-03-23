# Wedding Memos

Wedding Memos is a real-time event media sharing platform for weddings and similar live events. Guests upload photos or videos to an event-specific URL, hosts moderate submissions in an admin dashboard, and approved content appears on a live wall in near real time via WebSockets.

## What This Repository Contains

- `frontend/`: Next.js application for the landing page, guest upload flow, admin dashboard, and live wall.
- `backend/`: NestJS API server with Prisma, PostgreSQL persistence, S3/local upload support, and Socket.IO broadcasting.

## Core User Journeys

### Guest Upload Flow

1. A guest opens an event route such as `/demo-event`.
2. The frontend resolves the event by slug and renders the uploader.
3. The uploader requests a presigned upload target from the backend.
4. The file is uploaded to S3 or local storage.
5. The frontend sends media metadata to the backend.
6. The backend stores the photo and, if auto-approved, pushes it to the live wall immediately.

### Admin Moderation Flow

1. A host opens `/admin`.
2. The dashboard lists events and their photo counts.
3. The host can create, rename, or delete events.
4. Within an event, the host can approve, reject, or delete photos and manage live-wall backgrounds.
5. Moderation updates are propagated to connected live-wall clients over Socket.IO.

### Live Wall Flow

1. A screen opens `/live/:slug`.
2. The page loads approved photos and the active background image from REST endpoints.
3. The client subscribes to the event room over Socket.IO.
4. Newly approved photos and background changes are applied in real time.

## Architecture Summary

### Backend

- **Framework**: NestJS
- **Persistence**: PostgreSQL via Prisma
- **Realtime**: Socket.IO gateway with room-based broadcasts
- **Storage**: AWS S3 via presigned URLs, with local disk upload fallback for development
- **Structure**: Modular monolith using controller-service modules

Primary backend modules:

- `EventsModule`: Event CRUD and event-related WebSocket room management
- `PhotosModule`: Upload metadata, moderation, stats, and background management
- `S3Module`: Presigned upload URL generation
- `PrismaModule`: Shared database client

### Frontend

- **Framework**: Next.js App Router
- **UI Model**: Route-based pages with client-side feature components
- **Data Access**: Centralized API adapter in `frontend/lib/api.ts`
- **Realtime**: `socket.io-client`

Primary frontend routes:

- `/`: Product landing page
- `/[slug]`: Guest upload page
- `/live/[slug]`: Live wall
- `/admin`: Admin dashboard

## Repository Map

| Path | Responsibility |
|---|---|
| `frontend/app/[slug]/page.tsx` | Loads an event by slug and renders the guest upload experience. |
| `frontend/components/GuestUploader.tsx` | Handles file selection, upload, progress, and metadata submission. |
| `frontend/components/LiveWall.tsx` | Renders approved media and listens for realtime updates. |
| `frontend/components/AdminDashboard.tsx` | Admin UI for event management, moderation, stats, and backgrounds. |
| `frontend/hooks/useLiveWall.ts` | Socket.IO hooks for live wall and admin updates. |
| `frontend/lib/api.ts` | Centralized frontend API client. |
| `backend/src/events/*` | Event endpoints, business logic, and realtime gateway. |
| `backend/src/photos/*` | Upload, moderation, stats, and background endpoints/services. |
| `backend/src/s3/s3.service.ts` | S3 presigned upload URL generation. |
| `backend/src/prisma/prisma.service.ts` | Shared Prisma client wrapper. |
| `backend/prisma/schema.prisma` | Database schema. |
| `backend/prisma/seed.ts` | Demo data seed script. |

## Dependencies

### Frontend

- `next`, `react`, `react-dom`: App framework and rendering
- `axios`: HTTP requests and upload calls
- `socket.io-client`: Realtime updates
- `framer-motion`: Live wall animations
- `qrcode.react`: QR code rendering for upload URLs
- `react-dropzone`: Guest upload file picker
- `sonner`: Toast notifications
- `tailwindcss`: Styling

### Backend

- `@nestjs/*`: API framework, validation, DI, and WebSocket support
- `@prisma/client`, `prisma`: ORM and migration tooling
- `socket.io`: Realtime transport
- `class-validator`, `class-transformer`: DTO validation
- `multer`: Local upload handling
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`: S3 upload integration
- `bcrypt`: Password hashing

## Setup

## Prerequisites

- Node.js
- npm
- PostgreSQL
- Optional AWS S3 bucket and credentials for production-style uploads

## Backend Configuration

Expected environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_ACCESS_KEY_ID` | Enables S3 uploads when set |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `AWS_REGION` | S3 region |
| `S3_BUCKET_NAME` | S3 bucket name |
| `BACKEND_URL` | Used for local upload URL generation |
| `PORT` | Backend port, defaults to `4000` |

Note: the current Nest config loads `.env`, while the repository currently includes `backend/.env.local`. For local development, copy or rename it to `.env` or update the Nest config.

## Frontend Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL for backend REST and Socket.IO calls |

## Local Development

### Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Default Demo Event

The seed script creates a default event with slug `demo-event`.

- Guest upload page: `/demo-event`
- Live wall: `/live/demo-event`

This is the fastest path for local UI testing once the backend has been seeded.

## Maintenance Notes

- Admin authentication is currently client-side only and not production-safe.
- Backend admin endpoints do not appear to enforce authorization.
- Backend CORS origins are hardcoded in `backend/src/main.ts`.
- `frontend/components/AdminDashboard.tsx` is a large multi-responsibility component and would benefit from decomposition.
- Backend seed credentials and runtime fallback admin credentials are inconsistent.
- Existing frontend and backend README files are mostly starter templates and do not reflect the implemented system.

## Additional Documentation

- Onboarding guide: [docs/onboarding.md](docs/onboarding.md)
