import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator.js';
import * as auth from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', validate({ body: signupSchema }), auth.signup);
router.post('/login', validate({ body: loginSchema }), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', requireAuth, auth.me);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), auth.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), auth.resetPassword);

export default router;
