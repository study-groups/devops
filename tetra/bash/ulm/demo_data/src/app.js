import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { AuthService } from '../auth/login.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateInput, validators } from '../utils/validation.js';
import logger from '../utils/logger.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Auth endpoints
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const errors = validateInput(req.body, {
        email: ['required', 'email'],
        password: ['required']
    });

    if (errors) {
        return res.status(400).json({ errors });
    }

    // Authentication logic here
    logger.info('Login attempt', { email });
    res.json({ token: 'jwt-token-here' });
});

app.get('/profile', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

app.get('/admin', requireAuth, requireRole('admin'), (req, res) => {
    res.json({ message: 'Admin area' });
});

export default app;
