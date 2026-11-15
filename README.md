# Ladle

Plan the week's dinners around what's on sale at your Fry's, approve them, get the grocery list. The AI never checks out: a person reviews, pays and picks up.

Built from the "Meal Plan App - Ideas and Architecture" doc (section 23 build spec).

## What's built

| Build-order step | Status |
|---|---|
| 1. Project setup, login, database | Done. Email/password + Google (Auth.js), Postgres via Drizzle |
| 2. Setup wizard | Done. One question per screen (motivation, household, store, money, meals, buying), ends with "start with our recipes or add your own" |
| 3. Recipes screen | Done. My Recipes / Browse, rating, add your own (typed, save from link, photo import), starter set loaded |
| 4. Home screen + planner | Done. Plan button, seven day cards, swap, estimated total vs budget, Approve locks the plan and builds the grocery list, rating prompt after each cook, prep-ahead reminder |
| 5. History screen | Done. Past weeks, actual spend, average weekly spend, reuse a week |
| 6. Kroger | Partial. Fry's store search in the wizard (needs Kroger keys). Prices wait on the sale-price test (spec section 14); cart fill comes after. Never checkout |

Nothing is ever deleted: recipes and plans are archived.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET (npx auth secret)
npm run dev
```

With no `DATABASE_URL`, an embedded Postgres (PGlite) is stored in `.data/`. Migrations run and the starter set loads on first request.

Without `ANTHROPIC_API_KEY` the app still works: a basic planner picks at random (respecting no-repeats and low ratings), costs are blank, and recipe import is off.

## Deploy (Vercel)

1. Import the repo in Vercel.
2. Add a Postgres database (Storage → Neon); it sets `DATABASE_URL`.
3. Set `AUTH_SECRET`, `ANTHROPIC_API_KEY`, and optionally `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` and `KROGER_CLIENT_ID`/`KROGER_CLIENT_SECRET`.

## Layout

- `src/lib/planner.ts`: the brain (section 22). Sends Claude the rules, recipes, sale list and recent weeks; gets back seven days with reasons, cost estimates and swap options.
- `src/lib/grocery.ts`: consolidated grocery list on Approve.
- `src/lib/recipe-import.ts`: save from link and photo import (private list only, plain-words rewrite, credit kept).
- `src/lib/kroger.ts`: Kroger Public API (locations now; prices and cart later).
- `src/data/starter-recipes.json`: the starter set (from the Starter Recipe Set sheet and its recipe docs).
- `drizzle/`: SQL migrations (`npm run db:generate` after changing `src/db/schema.ts`).
