import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './src/config/env.js';
import { errorMiddleware } from './src/middleware/error.middleware.js';
import authRoutes from './src/routes/auth.routes.js';
import onboardingRoutes from './src/routes/onboarding.routes.js';
import businessRoutes from './src/routes/business.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import tokenRoutes from './src/routes/token.routes.js';
import staffRoutes from './src/routes/staff.routes.js';
import inviteRoutes from './src/routes/invite.routes.js';
import displayRoutes from './src/routes/display.routes.js';
import billingRoutes from './src/routes/billing.routes.js';
import { UPLOAD_DIR } from './src/services/branding.service.js';

// Builds the app without starting it, so tests can import it (server.js calls listen).
const app = express();

// 1. Security and parsing
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(compression());
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 2. The payment webhook needs the raw body for its signature check (Phase 13),
// so it is parsed here before express.json(). Its handler is added in billing.routes.js.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// 3. JSON bodies for everything else
app.use(express.json({ limit: '1mb' }));

// 4. Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Uploaded logos. Public pages on the frontend's address load them, so allow cross-origin use.
app.use(
  '/uploads',
  (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false }),
);

// 5. Route files, mounted under /api as each phase adds them.
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/business', businessRoutes);
// Before adminRoutes, whose login checks run for every /api/admin path it receives.
app.use('/api', inviteRoutes); // /api/admin/staff, /api/admin/invites..., /api/invites/:token...
app.use('/api/admin', adminRoutes);
app.use('/api/public', tokenRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/display', displayRoutes);
app.use('/api/billing', billingRoutes);

// 6. 404, then the error handler last. In Express 5, app.all('*', ...) is no longer valid.
app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
app.use(errorMiddleware);

export default app;
