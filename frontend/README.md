# QueueLess frontend

A multi-tenant virtual queue app (clinics, banks, salons, canteens, offices, events) with a Shopify-inspired marketing site and admin. It runs entirely in the browser: all data is demo content plus `localStorage`. There is no server and no network request.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Requires Node 18 or newer.

## Demo accounts

Everyone logs in at `/login`. The password for every demo account is `demo1234`.

| Email | Role | Business |
| --- | --- | --- |
| owner@demo.com | Owner | City Care Clinic (`/city-care`, Free plan) |
| staff@demo.com | Staff, PIN 1234 | City Care Clinic, Dr. Ananya Rao |
| owner.bank@demo.com | Owner | United Bank (`/united-bank`, Business plan) |
| staff.bank@demo.com | Staff, PIN 1234 | United Bank, Counter 1 |
| owner.canteen@demo.com | Owner | Campus Canteen (`/campus-canteen`, Pro plan) |
| owner.salon@demo.com | Owner | Glow Studio Salon (`/glow-studio`, not live yet) |

Other City Care staff PINs for "Switch user": Lakshmi Nair 2345, Imran Khan 3456.

Demo invite links: `/accept-invite/demo-invite-pending` (valid), `/accept-invite/demo-invite-soon` (expires within a day), `/accept-invite/demo-invite-expired`, `/accept-invite/demo-invite-revoked`.

## Route map

| Route | What it is |
| --- | --- |
| `/` | Marketing home (Why, Products, Pricing, Enterprise, FAQ) |
| `/pricing`, `/enterprise` | Home page scrolled to that section |
| `/contact-sales` | Enterprise lead form |
| `/signup`, `/login` | Auth. `?plan=pro` and `?email=` prefill signup, `?next=` is honoured on login |
| `/onboarding/welcome`, `/onboarding/plan` | Business type, then plan or "Skip for now" |
| `/accept-invite/:token` | Staff invite acceptance |
| `/admin`, `/admin/queues`, `/admin/services`, `/admin/resources`, `/admin/customers`, `/admin/analytics`, `/admin/staff`, `/admin/channels`, `/admin/billing`, `/admin/settings` | Owner admin |
| `/staff`, `/staff/switch-user` | Staff console and PIN switching |
| `/:slug` | Customer join page (opened by the QR code) |
| `/:slug/token/:tokenId` | Live token status |
| `/display/:slug` | Waiting-room TV display |

Guards: `/admin/*` needs an owner and `/staff` needs staff or a manager. Otherwise you are sent to `/login?next=...`; the wrong role goes to its own home. Adding `?business=<other-slug>` to an admin or staff URL shows "Access denied". Old slugs redirect, for example `/college-canteen` goes to `/campus-canteen`.

## Things to try

- Log in as the owner. The Setup guide shows 2 of 6, and the Free banner, TV lock, CSV lock, and seat limit are visible. Upgrade on Billing (test card 4242 4242 4242 4242) and everything unlocks instantly. Downgrade and nothing is deleted.
- Open `/city-care` in one tab and `/staff` (as staff) in another. Join, then call next, and watch the token page change to "It is your turn".
- Open `/display/united-bank` for the TV. Click once to enable the chime.
- Edit Settings, then Branding, and watch the live preview. Public pages pick up the colour and logo.
- Sign up a new business, skip the plan, and complete the Go live checklist on Channels.

## Where the demo data lives

- `src/data/` holds the seed generators: `businesses.js`, `users.js`, `invites.js`, `tokens.js` (60 to 100 tokens per live business over 30 days), `analytics.js` (sample daily history), `invoices.js`, `activity.js` (feed and notifications), `faqs.js`, and `seed.js` (combines them).
- `src/config/plans.js` holds plan limits and features, `templates.js` holds the business-type templates, and `constants.js` holds shared constants.
- Stores (`src/store/*.js`) persist to `localStorage` keys `ql-auth`, `ql-business`, `ql-queue`, and `ql-ui`. Use **Reset demo data** in the admin avatar menu (or the command palette, Ctrl K) to restore the seed.

## How the fake backend works

`src/lib/fakeBackend.js` acts like an API inside the browser:

- **Stores as the database.** Functions such as `joinQueue`, `callNext`, `createInvite`, `acceptInvite`, `switchUserWithPin`, `checkSlugAvailability`, `changeSlug`, `goLive`, `updateBranding`, and `changePlan` read and write the Zustand stores. Every screen subscribes to the stores, so changes appear immediately.
- **Tabs stay in sync.** `main.jsx` listens for the `storage` event and rehydrates the matching store, so a customer tab, a staff tab, and a TV tab all update together.
- **Live simulation.** `useSimulation` runs every 20 to 40 seconds. Usually a fake customer joins an open queue; sometimes a fake staff action advances a line. Only one open tab runs it, using a small leader lock in `localStorage`.
- **Tenant scoping.** Admin and staff reads go through `forTenant()` and the `useTenant*` hooks, which filter by the session's `businessId`. Customers and TVs are scoped only by the slug in the URL.
- **Plans.** `useFeature('tvDisplay')` and `<LockedFeature>` gate paid extras. Limits (counters, staff seats, tokens per day) block new additions with an upgrade prompt and never delete data. All customisation works on Free.

## Structure

```
src/
  config/      plans, templates, constants, theme, navigation
  data/        demo seed generators
  lib/         fakeBackend, validators, formatters, queueMath, analytics, hours, random
  store/       authStore, businessStore, queueStore, uiStore
  hooks/       useFeature, useGuestToken, useCountdown, useScrollSpy, useBrand, useTenant, useSimulation, ...
  layouts/     Marketing, Auth, Onboarding, Admin, Customer, Staff, Display (+ guards)
  components/  ui/, marketing/, admin/, customer/, staff/, display/
  pages/       marketing/, auth/, onboarding/, admin/ (settings/ tabs), customer/, staff/, display/
```
