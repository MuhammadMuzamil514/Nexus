import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { connectDB } from './config/db';
import { swaggerSpec } from './config/swagger';
import { notFound, errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import otpRoutes from './routes/otpRoutes';
import profileRoutes from './routes/profileRoutes';
import meetingRoutes from './routes/meetingRoutes';
import documentRoutes from './routes/documentRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { stripeWebhook } from './controllers/paymentController';
import { initSignalingServer } from './sockets/signaling';

dotenv.config();

const app = express();
const httpServer = http.createServer(app); // Socket.IO needs the raw HTTP server, not just Express

// --- Security & parsing middleware ---
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Stripe webhook MUST receive the raw request body to verify the signature -
// this has to be registered before express.json() and matched by exact path,
// otherwise express.json() will have already consumed/parsed the body.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());
app.use(cookieParser());

// Basic rate limiting on auth routes to blunt brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api/auth', authLimiter);

// OTPs are only 6 digits (1M combinations) - a much tighter limit than
// general auth traffic to make brute-forcing a code impractical.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes, matches OTP_TTL_MS in otpController
  max: 8,
  message: { message: 'Too many code attempts, please wait before trying again.' },
});
app.use('/api/auth/otp', otpLimiter);

// --- Routes ---
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/auth/otp', otpRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payments', paymentRoutes);

// Serve uploaded files statically (dev only - S3 serves these directly in prod)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

// --- WebRTC signaling (Socket.IO), attached to the same HTTP server ---
initSignalingServer(httpServer);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`[server] Nexus backend running on port ${PORT}`);
    console.log(`[server] Socket.IO signaling ready on the same port`);
  });
});
