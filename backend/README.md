# QueueLess backend (structure only)

This folder is a placeholder for the future API. Every file is intentionally empty; only this README has text.

- `package.json`: will hold the backend's dependencies and scripts.
- `.env.example`: will list the environment variables the server needs (database URL, secrets, payment keys).
- `.gitignore`: will keep secrets, logs, and installed packages out of version control.
- `server.js`: will start the HTTP and websocket server.
- `app.js`: will build the web app and plug in middleware and routes.
- `src/`: all application source code.
- `src/config/`: connection and setup files for the database, environment variables, Redis cache, and websockets.
- `src/models/`: data shapes for users, businesses, services, resources, queues, tokens, subscriptions, invoices, staff invites, slug history, activity logs, and enterprise leads.
- `src/routes/`: URL definitions for auth, onboarding, business settings, tokens, staff, invites, admin, billing, enterprise leads, and the TV display.
- `src/controllers/`: request handlers that read input, call services, and send responses for each route group.
- `src/services/`: business logic for tokens, queues, wait estimates, analytics, billing, notifications, tenant scoping, invites, slugs, and branding.
- `src/middleware/`: request checks for login, roles, tenant isolation, plan limits, go-live status, input validation, rate limiting, and error handling.
- `src/sockets/`: real-time channels for live queue updates, TV displays, and socket authentication.
- `src/jobs/`: scheduled tasks that mark no-shows, clean up old data, and send reminders.
- `src/validators/`: input rules for auth, tokens, business settings, billing, and invites.
- `src/utils/`: small shared helpers such as the API error type, async wrapper, slug tools, token numbering, and constants.
- `src/seed/`: scripts and data that fill a development database with demo businesses.
- `tests/`: automated tests for auth, tokens, tenant isolation, queues, invites, and slugs.
