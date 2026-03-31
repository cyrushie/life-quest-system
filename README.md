## Life Quest System

Life Quest System is a Next.js web app that turns manual habit tracking into a gamified progression loop with QP, EXP, levels, titles, streaks, punishments, and a private daily journal.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS 4
- Prisma
- PostgreSQL
- Custom game logic utilities for QP/EXP/streak calculations

## Current Foundation

The project currently includes:

- RPG-inspired landing page and app shell
- dashboard, today, history, journal, tasks, punishments, rules, and onboarding routes
- Prisma schema for the MVP data model
- game logic utilities for daily QP and EXP calculation
- environment variable template for database and auth setup

The current UI is scaffolded with demo content so the app can be explored before the database and auth flows are fully wired.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in the browser.

## Environment

Copy `.env.example` to `.env` and set:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/life_quest_system"
AUTH_SECRET="replace-with-a-long-random-secret"
```

## Database

Once PostgreSQL is running and `.env` is configured:

```bash
npx prisma generate
npx prisma migrate dev
```

## Next Steps

- wire real register/login flows to Prisma
- add server actions for task, punishment, journal, and daily-log updates
- implement protected routes and session handling
- replace demo data with real database queries
- add recalculation flow for the 7-day edit window
