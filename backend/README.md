# Nexus Backend — Week 1

Auth + Profiles API for the Nexus platform. Node.js + Express + TypeScript + MongoDB (Mongoose) + JWT.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — get this from MongoDB Atlas (free tier: https://www.mongodb.com/cloud/atlas). Create a cluster → Database Access (add a user) → Network Access (allow 0.0.0.0/0 for dev) → Connect → Drivers → copy the connection string.
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`).
- `CLIENT_URL` — `http://localhost:5173` for local dev (matches Vite's default port).

```bash
npm run dev
```

You should see:
```
[db] MongoDB connected: <cluster host>
[server] Nexus backend running on port 5000
```

Test it's alive:
```bash
curl http://localhost:5000/api/health
```

## API Endpoints (Week 1)

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| GET | `/api/health` | none | — | Server liveness check |
| POST | `/api/auth/register` | none | `{ name, email, password, role }` | Create account, returns `{ user, token }` |
| POST | `/api/auth/login` | none | `{ email, password, role? }` | Returns `{ user, token }` |
| GET | `/api/auth/me` | Bearer token | — | Returns current user |
| POST | `/api/auth/logout` | Bearer token | — | Marks user offline |
| GET | `/api/profile?role=investor` | Bearer token | — | List profiles, optional role filter |
| GET | `/api/profile/:id` | none | — | Public profile view |
| PUT | `/api/profile` | Bearer token | any subset of profile fields | Update your own profile |

`role` must be `"entrepreneur"` or `"investor"` — matches the frontend's `UserRole` type exactly.

## Quick manual test with curl

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Founder","email":"jane@example.com","password":"password123","role":"entrepreneur"}'

# Copy the "token" from the response, then:
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

## Deploying to Render

1. Push `backend/` to GitHub (as part of the monorepo or its own repo).
2. On Render: New → Web Service → connect the repo → set **Root Directory** to `backend` (if monorepo).
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add the same env vars from `.env` in Render's dashboard (Environment tab). Set `CLIENT_URL` to your actual Vercel URL, not localhost.
6. Once deployed, update the frontend's `VITE_API_URL` in Vercel's env vars to point at the Render URL + `/api`.

## What's next (Week 2)

`Meeting`, `Document`, and Socket.IO signaling will plug into this same `src/` structure — new files in `models/`, `controllers/`, `routes/`, plus a new `sockets/` folder. The `protect` and `requireRole` middleware in `middleware/auth.ts` already handle auth for any new route you add.

---

## Week 2 — Meetings, Video Calls, Documents

### Meeting Scheduling

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/meetings` | Bearer | `{ participantId, title, notes?, startTime, endTime }` | Propose a meeting. Rejects with 409 if either party has a conflicting `pending`/`accepted` meeting in that window. |
| GET | `/api/meetings?status=` | Bearer | — | List meetings where you're organizer or participant |
| GET | `/api/meetings/:id` | Bearer | — | Get one meeting (must be a party to it) |
| PATCH | `/api/meetings/:id/accept` | Bearer | — | Participant accepts (re-checks conflicts at accept-time too) |
| PATCH | `/api/meetings/:id/reject` | Bearer | — | Participant rejects |
| PATCH | `/api/meetings/:id/cancel` | Bearer | — | Either party cancels |

Each meeting gets a `roomId` (UUID) generated at creation — this is what the video call connects to.

### Video Calling (WebRTC signaling via Socket.IO)

Not a REST endpoint — connect a Socket.IO client to the same backend URL with `auth: { token: <jwt> }`. Events: `join-room`, `existing-members`, `user-joined`, `offer`, `answer`, `ice-candidate`, `toggle-audio`, `toggle-video`, `leave-room`, `user-left`, `room-full`. Capped at 2 participants per room (1:1 calls). See `src/sockets/signaling.ts`.

### Document Chamber

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/documents` | Bearer | multipart, field `file` | Upload a doc (PDF/Word/Excel/PNG/JPEG, 15MB cap) |
| GET | `/api/documents` | Bearer | — | List your docs + docs shared with you |
| GET | `/api/documents/:id` | Bearer | — | Get one document (owner or shared-with only) |
| PATCH | `/api/documents/:id/share` | Bearer | `{ userIds: string[] }` | Owner shares with other users |
| POST | `/api/documents/:id/sign` | Bearer | multipart, field `signature` | Upload a signature PNG, marks doc as `signed` |
| DELETE | `/api/documents/:id` | Bearer | — | Owner deletes |

Files are stored on local disk under `backend/uploads/` in dev, served statically at `/uploads/<filename>`. **For production**, swap the storage engine in `src/middleware/upload.ts` from `multer.diskStorage` to `multer-s3` — nothing else in the controller needs to change since it just reads `req.file`.

### Quick test

```bash
# Create a meeting (replace <token> and <participantId>)
curl -X POST http://localhost:5000/api/meetings \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"participantId":"<participantId>","title":"Intro call","startTime":"2026-07-20T10:00:00Z","endTime":"2026-07-20T10:30:00Z"}'

# Upload a document
curl -X POST http://localhost:5000/api/documents \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/pitch-deck.pdf"
```

## What's next (Week 3)

Payments (Stripe sandbox), password-reset via real email/OTP (Nodemailer), input validation hardening, and final deployment.

---

## Week 3 — Payments, Security & Deployment

### Payments (Stripe test mode)

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/payments/deposit` | Bearer | `{ amount }` (cents, min 50) | Creates a Stripe PaymentIntent, returns `{ transaction, clientSecret }` |
| POST | `/api/payments/deposit/:transactionId/confirm` | Bearer | — | Re-verifies status directly with Stripe after client-side confirmation |
| POST | `/api/payments/webhook` | none (Stripe signs it) | raw Stripe event | Authoritative source of truth for deposit status |
| POST | `/api/payments/withdraw` | Bearer | `{ amount }` | Internal ledger entry, instant for this simulation |
| POST | `/api/payments/transfer` | Bearer | `{ toUserId, amount }` | Internal ledger transfer between two users |
| GET | `/api/payments/history` | Bearer | — | All transactions involving you |
| GET | `/api/payments/balance` | Bearer | — | Balance computed from completed transactions (not a stored/mutable field) |

**Balance is derived, not stored.** `getBalance()` sums completed deposits/transfers-in minus withdrawals/transfers-out on every request. This avoids the classic bug where a stored balance field drifts out of sync with the transaction log.

**Stripe setup:**
1. Create a free Stripe account, switch to **Test mode**.
2. Dashboard → Developers → API keys → copy the **Secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY`, and the **Publishable key** (`pk_test_...`) into the frontend's `VITE_STRIPE_PUBLISHABLE_KEY`.
3. For webhooks locally: `stripe listen --forward-to localhost:5000/api/payments/webhook` (via the [Stripe CLI](https://stripe.com/docs/stripe-cli)) — it prints a `whsec_...` signing secret, put that in `STRIPE_WEBHOOK_SECRET`.
4. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

### Security Enhancements

- **Validation & sanitization** — `express-validator` on every mutating route (`middleware/validate.ts` + `body(...)` chains per route). Rejects malformed input before it reaches a controller.
- **Password hashing** — bcrypt, 10 salt rounds, already in place since Week 1.
- **2FA / OTP mockup** — `models/User.ts` (`otpHash`, `otpExpires`), `controllers/otpController.ts`, `services/emailService.ts` (Nodemailer, logs to console if SMTP isn't configured so local dev isn't blocked). One-time-use, bcrypt-hashed at rest, 10-minute expiry, and the `/send` endpoint gives an identical response whether or not the email exists (prevents account enumeration).
- **Rate limiting** — general auth routes capped at 50 req/15min; `/api/auth/otp/*` capped at 8 req/10min specifically, since a 6-digit code is brute-forceable at high request volume.
- **Role-based authorization** — `middleware/auth.ts`'s `protect` + `requireRole([...])`, used throughout.
- **Helmet** — standard security headers, already in place since Week 1.

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/otp/send` | `{ email }` | Emails a 6-digit code (console-logged in dev without SMTP configured) |
| POST | `/api/auth/otp/verify` | `{ email, otp }` | Verifies code, returns `{ token, user }` - usable as a 2FA login step |
| POST | `/api/auth/otp/reset-password` | `{ email, otp, newPassword }` | Resets password using a verified code |

### API Documentation

Swagger UI is live at **`/api/docs`** once the server is running (e.g. `http://localhost:5000/api/docs`), generated from JSDoc `@swagger` blocks in `src/routes/*.ts` — see `src/config/swagger.ts`. All 24 endpoints across Auth, OTP, Profile, Meetings, Documents, and Payments are documented there with request/response schemas.

### Final Deployment Checklist

1. `npm run build` locally first to confirm a clean production build.
2. Push to GitHub, deploy on Render (Root Directory: `backend`, Build: `npm install && npm run build`, Start: `npm start`).
3. Set every var from `.env.example` in Render's Environment tab — **use live/production values for `CLIENT_URL`** (your Vercel URL) and **test-mode Stripe keys** (this is a sandbox demo, not real payments).
4. Add the Render backend URL as a Stripe webhook endpoint in the Stripe Dashboard (Developers → Webhooks → Add endpoint → `https://<your-render-url>/api/payments/webhook`), select `payment_intent.succeeded` and `payment_intent.payment_failed` events, copy the signing secret into Render's `STRIPE_WEBHOOK_SECRET`.
5. Update the frontend's `VITE_API_URL` and `VITE_STRIPE_PUBLISHABLE_KEY` in Vercel's env vars, redeploy.
6. Full regression pass: register → login → schedule a meeting → join the video call → upload & sign a document → deposit/withdraw/transfer → check `/api/docs` loads.
