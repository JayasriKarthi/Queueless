# QueueLess

**A real-time virtual queue platform for clinics, banks, canteens, salons and offices.**
Customers scan a QR code, join the line from their phone with no app and no account, and watch their place update live. Staff call the next person with one click, a waiting-room TV shows who is being served, and owners manage everything from an admin panel.

**Live demo:** [queueless-lbil.onrender.com](https://queueless-lbil.onrender.com). Log in as `owner@demo.com` / `demo1234`, or join a line at [/city-care](https://queueless-lbil.onrender.com/city-care). The free server sleeps when idle, so the first visit can take up to a minute.

![Node](https://img.shields.io/badge/Node.js-22-339933) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Express](https://img.shields.io/badge/Express-5-000000) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248) ![Redis](https://img.shields.io/badge/Redis-7-DC382D) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED) ![Tests](https://img.shields.io/badge/tests-250%20passing-brightgreen)

---

## Features

**For customers**
- Join a business's line by scanning its QR code or opening its link (`/city-care`), no sign-up.
- Live token page: people ahead, estimated wait, "almost your turn" alert, and "it is your turn" the moment staff call them.
- Leave the line or rate the visit from the same phone.

**For staff**
- Console with the waiting list in call order: Call next, Arrived, Done, No-show, Recall, Skip, Remove.
- Keyboard shortcuts (N, D, X), walk-in customers, pause a counter.
- "Switch user" with a 4-digit PIN on shared front-desk computers.

**For owners**
- Services, counters/doctors, three queue modes (one shared line, a line per service, or a line per doctor).
- Live dashboard and analytics: tokens, served, average wait, busy hours, no-show trends, per-counter performance.
- Customer history with search, filters and CSV export.
- Staff invitations by email, roles (owner, manager, staff), and staff management.
- Custom join form, opening hours, branding and logo, public link with redirects for old links.
- A TV display page with a chime when a token is called.

**Under the hood**
- Multi-tenant: many businesses share one system and each sees only its own data.
- Real-time updates over Socket.IO rooms (about 0.3 s from click to every screen), working across several server instances through Redis.
- Race-free token numbering and "call next", using atomic MongoDB updates, unique indexes and transactions.
- Background jobs: automatic no-shows, invite reminders, daily summaries, nightly cleanup.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Router, React Hook Form + Zod, Recharts, Socket.IO client |
| Backend | Node.js 22, Express 5, Mongoose 9, Zod 4, Socket.IO 4 (Redis adapter), JWT, bcrypt, Nodemailer |
| Data | MongoDB 7 (replica set, for transactions), Redis 7 |
| Testing | Jest, Supertest, mongodb-memory-server (250 tests in 18 suites) |
| DevOps | Docker (multi-stage build), Docker Compose, Docker Hub, GitHub Actions (tests on every push) |
| Hosting | Render (web service), MongoDB Atlas, Upstash Redis, Brevo (email API) |

## Architecture

```
Browser (React)                     API server (Express, port 4000)            Data
--------------------------          -------------------------------------      -------------------------
pages/  -> lib/fakeBackend.js  ──►  routes -> middleware -> controllers   ──►  MongoDB (permanent data)
           lib/api.js (fetch)  HTTP          (auth, role, tenant,              Redis   (rate limits, locks,
                                              validation, rate limit)                    live-update relay)
                                            -> services (business rules)
lib/socket.js + stores  ◄────────────────  sockets/ (events to rooms)
                         Socket.IO
```

- Every request follows the same chain: **route → middleware → controller → service → model**.
- The browser never talks to MongoDB or Redis; only the API does.
- After a change, the API emits an event to a Socket.IO **room** (a business's staff, a TV, one customer's phone). Each audience gets only what it may see: TVs and join pages never receive customer names.

## Quick start with Docker Compose

The fastest way to run everything (app, MongoDB and Redis) with one command. You only need Docker.

```bash
cp backend/.env.example backend/.env    # then set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
docker compose up -d --build            # wait until `docker compose ps` shows all three (healthy)
docker compose exec -e NODE_ENV=development app npm run seed   # demo data, once
```

Open **http://localhost:4000** and log in with a demo account (below).

| Service | What it is |
| --- | --- |
| `app` | The QueueLess image: the backend serving the built frontend, on port 4000 |
| `mongo` | MongoDB 7 as a one-node replica set (its health check runs `rs.initiate` the first time) |
| `redis` | Redis 7 with append-only persistence |

MongoDB and Redis are reachable only inside the Compose network. Data lives in the named volumes `mongo-data`, `redis-data` and `uploads`, so it survives `docker compose down` (add `-v` to erase it).

| Command | What it does |
| --- | --- |
| `docker compose logs -f app` | Follow the app's logs |
| `docker compose up -d --build` | Rebuild after a code change |
| `docker compose down` | Stop (data is kept) |

## Getting started (local, without Docker for the app)

### Prerequisites
- **Node.js 22** (`nvm install 22 && nvm use 22`). Node 18 does not work with Mongoose 9.
- **Docker**, for MongoDB and Redis.

### 1. Start MongoDB and Redis

MongoDB runs as a one-node **replica set**, because the app uses transactions.

```bash
docker run -d --name ql-mongo -p 27018:27017 mongo:7 --replSet rs0
docker exec ql-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
docker run -d --name ql-redis -p 6379:6379 redis:7
```

Next time, just run `docker start ql-mongo ql-redis`.

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Then edit `backend/.env`:

| Variable | Value for local development |
| --- | --- |
| `MONGO_URI` | `mongodb://localhost:27018/queueless?directConnection=true` |
| `REDIS_URL` | `redis://localhost:6379` |
| `CLIENT_URL` | `http://localhost:5173` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Two **different** long random strings, e.g. from `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Optional, for real emails (e.g. Gmail with an app password). Without them, emails are printed in the terminal. |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Optional alternative: a Brevo API key and a verified sender, `QueueLess <you@example.com>`. Used instead of SMTP when set. |

`backend/.env` holds secrets and is ignored by git. Never commit it.

### 3. Install, add demo data, and run

```bash
# backend
cd backend
npm install
npm run seed      # wipes the local "queueless" database and adds demo data
npm run dev       # API on http://localhost:4000

# frontend (second terminal)
cd frontend
npm install
npm run dev       # app on http://localhost:5173
```

The frontend finds the API through `frontend/.env.development` (`VITE_API_URL=http://localhost:4000`).

### Demo accounts (after `npm run seed`)

Every password is `demo1234`. The PIN is for "Switch user" on the staff console.

| Email | Role | Business |
| --- | --- | --- |
| `owner@demo.com` | Owner | City Care Clinic |
| `staff@demo.com` | Staff (PIN 1234) | City Care Clinic |
| `owner.bank@demo.com` | Owner | United Bank, MG Road |
| `owner.canteen@demo.com` | Owner | Campus Canteen |
| `staff.canteen@demo.com` | Staff (PIN 1234) | Campus Canteen |

Public pages to try: `http://localhost:5173/city-care` (join), `http://localhost:5173/display/campus-canteen` (TV).

**See it live:** open the staff console in one tab, join from `/campus-canteen` in another, open the TV page in a third, then press **Call next**. All three update together.

## Scripts

| Where | Command | What it does |
| --- | --- | --- |
| `backend/` | `npm run dev` | Start the API with auto-restart |
| `backend/` | `npm start` | Start the API |
| `backend/` | `npm run seed` | Reset the local database with demo data (refuses to run in production) |
| `backend/` | `npm test` | Run all backend tests |
| `frontend/` | `npm run dev` | Start the app |
| `frontend/` | `npm run build` | Production build into `frontend/dist` |
| root | `npm run build` / `npm start` | Build and start both as one web service (used for deployment) |

## Testing

```bash
cd backend
npm test                              # all 18 suites
npm test -- tests/queue.test.js       # one file
```

Tests run against an in-memory MongoDB replica set (your data is never touched) and cover authentication, tenant isolation, joining and token numbering (including simultaneous requests), staff actions, invites and PIN lockout, Socket.IO rooms, analytics, jobs, rate limits, security and the email adapter. GitHub Actions runs them on every push (`.github/workflows/backend-tests.yml`).

## Project structure

```
Queueless/
├── backend/
│   ├── server.js            # start-up: MongoDB, Redis, Socket.IO, jobs, graceful shutdown
│   ├── app.js               # Express app: security, routes, error handler
│   ├── src/
│   │   ├── config/          # env checks, MongoDB, Redis, Socket.IO
│   │   ├── routes/          # URL -> middleware -> controller
│   │   ├── middleware/      # auth, roles, tenant, validation, rate limits, errors
│   │   ├── controllers/     # thin request handlers
│   │   ├── services/        # business rules
│   │   ├── models/          # Mongoose schemas
│   │   ├── sockets/         # real-time rooms and events
│   │   ├── jobs/            # no-shows, reminders, cleanup
│   │   ├── validators/      # Zod schemas
│   │   ├── utils/           # constants, errors, helpers
│   │   └── seed/            # demo data
│   └── tests/               # Jest + Supertest
├── frontend/
│   └── src/
│       ├── pages/           # one file per screen
│       ├── components/      # shared UI
│       ├── layouts/         # page frames and route guards
│       ├── lib/             # api.js (HTTP), socket.js, fakeBackend.js (server functions)
│       ├── store/           # Zustand stores (cache of server data)
│       └── hooks/           # live data hooks
├── Dockerfile               # multi-stage image: builds the frontend, runs the backend
├── docker-compose.yml       # app + MongoDB (replica set) + Redis for local runs
├── .dockerignore            # keeps .env files, node_modules and tests out of the image
├── package.json, Procfile   # build and start as one web service without Docker
└── QueueLess-API.postman_collection.json
```

## API overview

All endpoints start with `/api`. Owner and staff routes need `Authorization: Bearer <access token>`. Every response is `{ "ok": true, ... }` or `{ "ok": false, "error": { "code", "message", "details" } }`.

| Prefix | Purpose | Access |
| --- | --- | --- |
| `/api/auth` | signup, login, refresh, logout, me, password reset | public (me: logged in) |
| `/api/business` | settings, branding, logo, public link, go live, open/close, QR code, delete | owner |
| `/api/admin` | services, resources, analytics, customers, CSV export, activity, notifications, staff, invites | owner |
| `/api/staff` | console, call next, token actions, walk-in, pause, switch user | owner, manager, staff |
| `/api/public/:slug` | join page, join, token status, leave, rate | public |
| `/api/display/:slug` | TV display | public |
| `/api/invites/:token` | view and accept a staff invite | public |
| `/api/enterprise/leads` | "Contact sales" form | public |

A Postman collection is included: `QueueLess-API.postman_collection.json`.

## Security highlights

- Passwords and PINs hashed with bcrypt; invite, reset and customer links stored only as SHA-256 hashes.
- 15-minute JWT access tokens kept in memory, 30-day refresh tokens in an HTTP-only cookie; logout invalidates every session.
- Tenant isolation on every query, with a dedicated test suite.
- Zod validation on every request (unknown fields rejected), helmet, strict CORS, HTTPS redirect in production.
- Redis-backed rate limits on login, joining, invites and the whole API; PIN lockout after 5 wrong attempts.
- Old customer phone numbers removed after 90 days; CSV export protected against formula injection.
- Secrets are never baked into the Docker image (`.dockerignore` excludes every `.env`); they are passed in at run time. The container runs as a non-root user.
- TLS stays fully verified for Atlas and Upstash; the app sends the host name (SNI) so Upstash's certificate can be checked.

## Deployment

The app runs as **one container**: the backend serves the built React app in production, so pages, API and live updates share one address (no CORS or cookie problems between two domains).

```
Browser ──HTTPS──► Render (web service, Docker image, port from $PORT)
                      ├──► MongoDB Atlas (M0, replica set → transactions work)
                      ├──► Upstash Redis (rediss://, TLS)
                      └──► Brevo email API (HTTPS; Render's free plan blocks SMTP ports)
```

### 1. Build and publish the image

```bash
docker build -t <dockerhub-user>/queueless:1.0 .
docker push <dockerhub-user>/queueless:1.0
```

Use a new version tag for every release, so rolling back is just "run the previous tag".

### 2. Managed services

| Service | Setup |
| --- | --- |
| **MongoDB Atlas** | Free M0 cluster, a database user with read/write access, Network Access `0.0.0.0/0` (the free host has no fixed IP). Connection string with the database name: `mongodb+srv://USER:PASSWORD@HOST/queueless?retryWrites=true&w=majority` |
| **Upstash Redis** | Free database in the same region as the app, eviction **off**. Use the `rediss://` URL (two s = TLS). |
| **Brevo** | Verify a sender address, create an API key (`xkeysib-...`). The free plan sends 300 emails a day. |

### 3. Render web service

Create a **Web Service** from the image (or from this repository's `Dockerfile`), choose the region closest to Upstash, and set the health check path to `/api/health`. Environment variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string |
| `REDIS_URL` | Upstash `rediss://` URL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Two different values from `openssl rand -hex 48` (not the ones from development) |
| `CLIENT_URL` | The service's public address, e.g. `https://queueless-lbil.onrender.com` (used in email links, QR codes and CORS) |
| `TRUST_PROXY` | `1` (Render terminates HTTPS in front of the app) |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Brevo key and `QueueLess <verified-sender@example.com>` |

`PORT` is set by Render. `FORCE_HTTPS` defaults to `on` (plain HTTP is redirected to HTTPS); set it to `off` only when running the production image on your own computer.

### 4. Demo data (optional)

Seeding refuses to run with `NODE_ENV=production`, so run it once from your computer against Atlas. Keep the cloud values in a git-ignored file such as `backend/.env.atlas`:

```bash
docker run --rm --env-file backend/.env --env-file backend/.env.atlas \
  -e NODE_ENV=development <dockerhub-user>/queueless:1.0 npm run seed
```

### Rehearse production locally

Run the published image against the cloud services before deploying:

```bash
docker run --rm -p 4000:4000 --env-file backend/.env --env-file backend/.env.atlas \
  -e NODE_ENV=production -e FORCE_HTTPS=off -e CLIENT_URL=http://localhost:4000 \
  <dockerhub-user>/queueless:1.0
```

The start-up log should show `MongoDB connected`, `Redis connected` and `Email: sending through Brevo as ...`.

### Free-plan limits

- Render's free instance sleeps after 15 minutes without visitors; the first request after that takes up to a minute. Background jobs pause while it sleeps.
- Uploaded logos are stored on the container's disk and are lost when the service restarts or redeploys.
- Upstash's free plan allows about 500,000 commands a month; the background jobs use about 5,000 a day while the app is awake.

### Without Docker

The root `package.json` can also build and start the app as a plain Node service (`npm run build`, then `npm start`), for hosts such as Heroku (`Procfile`).

## Notes

- Plans (Free, Pro, Business) are shown in the app, but plan limits are switched off (`PLAN_LIMITS=off`) because there are no real payments.
- Interview preparation: `QueueLess-Interview-QA.pdf` (questions and answers about the design, with code).
