// Runs before each test file. Fixed settings so tests never use your real .env database or
// secrets (dotenv does not override values that are already set). Each suite connects to its
// own in-memory MongoDB, so MONGO_URI here is only a placeholder.
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/not-used-in-tests';
// Database 15 of the same Redis, so tests never touch the keys your dev server uses (database 0).
process.env.REDIS_URL = 'redis://127.0.0.1:6379/15';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
// Stripe webhooks are signed with this in tests (no Stripe account needed).
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_queueless';
// Never reach the real Stripe from tests, even if .env has a key: tests use a stand-in client.
process.env.STRIPE_SECRET_KEY = '';
// The app runs with plan limits off; most tests switch them on to keep checking that code.
// tests/noLimits.test.js checks the app as it really runs (limits off).
process.env.PLAN_LIMITS ??= 'on';
// Email settings from your .env never reach the tests (they read the in-memory outbox instead).
process.env.SALES_EMAIL = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
