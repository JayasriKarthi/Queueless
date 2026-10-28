// Runs before each test file. Fixed settings so tests never use your real .env database or
// secrets (dotenv does not override values that are already set). Each suite connects to its
// own in-memory MongoDB, so MONGO_URI here is only a placeholder.
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/not-used-in-tests';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
// Stripe webhooks are signed with this in tests (no Stripe account needed).
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_queueless';
// Never reach the real Stripe from tests, even if .env has a key: tests use a stand-in client.
process.env.STRIPE_SECRET_KEY = '';
