# Life Quest System

Life Quest System is a Next.js app that turns personal consistency into a game loop. Users log daily anchor and full routines, earn QP and EXP, level up, track streaks, recover from missed days, write private journal entries, and connect with friends and guilds.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS 4
- Prisma
- PostgreSQL
- Custom username/password auth

## Current Product Surface

- account registration and login
- onboarding flow
- dashboard, today, history, journal, rules, and insights
- editable tasks and punishments
- 7-day backfill/edit window
- recovery tracking for missed days
- quest pass automation
- friends, profiles, guilds, guild activity, guild chat, and notifications
- weekly exercise planner

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy envs:

```bash
cp .env.example .env
```

3. Generate a strong auth secret:

```bash
npm run auth:secret
```

4. Fill `.env` with your database connection and auth secret.

5. Push the schema:

```bash
npm run db:push
```

6. Start development:

```bash
npm run dev
```

## Environment Variables

Required:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
AUTH_SECRET="use-a-long-random-secret"
```

Optional for LAN/mobile development:

```bash
ALLOWED_DEV_ORIGINS="http://192.168.0.112:3000,http://localhost:3000"
```

Notes:

- `AUTH_SECRET` should be at least 32 characters in production.
- `DIRECT_URL` is used by Prisma for schema operations and deploy-time database commands.
- `.env` files are gitignored by default.

## Production Checklist

- rotate any secrets that were pasted into chat, screenshots, or shared notes
- set a strong `AUTH_SECRET`
- confirm the production database is reachable
- run `npm run db:push`
- run `npm run check`
- verify `/api/health` returns `200`

## Deployment

### Recommended: Vercel

1. Create a new Vercel project from this repo.
2. Add the environment variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `AUTH_SECRET`
3. Deploy once so `postinstall` generates Prisma Client during install.
4. Run schema sync against the production database:

```bash
npm run db:push
```

5. Redeploy if needed.

### Generic Node Deployment

Build:

```bash
npm run build
```

Start:

```bash
npm run start
```

## Helpful Scripts

```bash
npm run auth:secret   # generate a strong auth secret
npm run db:generate   # generate Prisma Client
npm run db:push       # sync Prisma schema to the database
npm run typecheck     # run TypeScript checks
npm run lint          # run ESLint
npm run check         # lint + typecheck + production build
```

## Health Endpoint

The app exposes a simple health route:

```bash
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-03-31T00:00:00.000Z"
}
```
