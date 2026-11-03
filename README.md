# QueueLess

**A real-time virtual queue platform for clinics, banks, canteens, salons and offices.**
Customers scan a QR code, join the line from their phone with no app and no account, and watch their place update live. Staff call the next person with one click, a waiting-room TV shows who is being served, and owners manage everything from an admin panel.

![Node](https://img.shields.io/badge/Node.js-22-339933) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Express](https://img.shields.io/badge/Express-5-000000) ![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248) ![Redis](https://img.shields.io/badge/Redis-7-DC382D) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101) ![Tests](https://img.shields.io/badge/tests-247%20passing-brightgreen)

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
| Testing | Jest, Supertest, mongodb-memory-server (247 tests in 17 suites) |
| Tooling | Docker, GitHub Actions (tests on every push) |

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

## Getting started (local)

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
npm test                              # all 17 suites
npm test -- tests/queue.test.js       # one file
```

Tests run against an in-memory MongoDB replica set (your data is never touched) and cover authentication, tenant isolation, joining and token numbering (including simultaneous requests), staff actions, invites and PIN lockout, Socket.IO rooms, analytics, jobs, rate limits and security. GitHub Actions runs them on every push (`.github/workflows/backend-tests.yml`).

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
├── package.json, Procfile   # build and start as one web service
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

## Deployment

The app deploys as **one web service**: the backend serves the built React app in production, so pages, API and live updates share one address. The root `package.json` builds it (`npm run build`) and starts it (`npm start`).

Planned free setup: **Render** (web service) + **MongoDB Atlas** (M0) + **Upstash** (Redis). Set the variables from `backend/.env.example` in the host's dashboard, with `NODE_ENV=production`, `TRUST_PROXY=1` and `CLIENT_URL` set to the public address.

Notes for free hosting: Render's free plan sleeps after 15 minutes without visitors and blocks outgoing SMTP (use an email API instead of Gmail SMTP there), and uploaded logos are lost when the service restarts.

## Notes

- Plans (Free, Pro, Business) are shown in the app, but plan limits are switched off (`PLAN_LIMITS=off`) because there are no real payments.
- More detailed guides are in this folder: `QueueLess-Backend-Guide.pdf` (how the backend was built, phase by phase), `QueueLess-Code-Walkthrough.pdf` (following a request from frontend to backend), and `QueueLess-Interview-QA.pdf`.
