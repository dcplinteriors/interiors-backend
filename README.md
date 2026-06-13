# DCPL Backend

REST API for the DCPL Interior platform — **Node + TypeScript + Express**, with
**Firebase (Admin SDK)** as the data/auth layer. The Flutter apps (admin + user) consume
this API; they do **not** talk to Firestore directly.

> This folder will become the `dcpl-backend` repository. See the platform docs in
> [`../docs`](../docs) for product context, data model, and the Material Request feature spec.

## Architecture (layered)

```
HTTP → routes → controllers → services → repositories → Firebase (Admin SDK)
                                  │
                              middlewares (auth, validation, errors)
```

- **routes/** — Express routers; URL → controller wiring only.
- **controllers/** — thin HTTP adapters: validate input (via a schema), call a service, respond.
- **schemas/** — zod request schemas (one file per feature). Controllers import and `.parse()`.
- **services/** — business logic (the testable core). No Express, no Firebase types leaking out.
- **repositories/** — the only place that touches Firebase/Firestore (via the Admin SDK).
- **middlewares/** — cross-cutting: auth (verify Firebase ID token), validation, error handling.
- **config/** — env loading/validation, CORS, and Firebase Admin init.
- **utils/** — pure helpers (e.g. PO/Job number formatting).

Tests live in **`tests/`** (outside `src/`), split into `unit/`, `integration/`, and
`emulator/`. We work **test-first (TDD)**.

```
Backend/
├── src/
│   ├── config/         # env.ts, firebase.ts, cors.ts
│   ├── routes/
│   ├── controllers/
│   ├── schemas/        # zod request schemas (per feature)
│   ├── services/
│   ├── repositories/   # ports + firestore/ implementations
│   ├── middlewares/
│   ├── utils/
│   ├── app.ts          # builds the Express app (no listen) — imported by tests
│   └── server.ts       # process entrypoint (listen)
├── scripts/            # seedAdmin.ts, getToken.ts
└── tests/
    ├── unit/
    ├── integration/    # supertest + in-memory fakes (no Firebase)
    └── emulator/       # Firestore-emulator repository tests
```

## Getting started

```bash
npm install
cp .env.example .env   # fill in once the Firebase project exists
npm test               # run the test suite
npm run dev            # start the dev server (tsx watch)
```

## Scripts

| Script | Does |
|--------|------|
| `npm run dev` | Dev server with reload (`tsx watch`). |
| `npm run build` | Compile to `dist/` (`tsconfig.build.json`). |
| `npm start` | Run the compiled server. |
| `npm run seed:admin -- <email> <name> <password>` | Provision an admin (sets the `role: admin` claim + `users` record). |
| `npm run get-token -- <email> <password>` | Print a Firebase ID token (for hitting protected endpoints via curl). |
| `npm test` | Run the fast suite (unit + integration with fakes; no Firebase). |
| `npm run test:watch` | Jest in watch mode (TDD). |
| `npm run test:coverage` | Coverage report. |
| `npm run test:emulator` | Repository tests against the Firestore emulator (needs Java). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run format` | Prettier write. |

## Endpoints

See the full **[API reference](../docs/api.md)**. In short: `supervisors` (admin),
`projects` (create/list/get/assign), and `material-requests` (submit/list/accept/decline/cancel),
plus `health` and `me`.

CORS is enabled for the Flutter web clients (the `Authorization` header is allowed and
preflight is handled). Origins are reflected by default; set `CORS_ORIGINS` (comma-separated)
to lock them down in production.

### Middleware

`helmet` (security headers) → `cors` → `pino-http` (request logging) → `express.json`
(1 MB limit) → routes → 404 → error handler. The error handler maps `ZodError`→400,
`AppError`→its status (logging 5xx), unknown→500, and delegates to Express if the response
already started. `server.ts` handles SIGTERM/SIGINT for graceful shutdown.

**Deferred production hardening** (deploy-context dependent, not yet added):
- **Rate limiting** (e.g. `express-rate-limit`) — recommended before public exposure.
- **`trust proxy`** — set when running behind Cloud Run / a load balancer so client IP and
  protocol are correct.

## Auth model

Clients sign in with Firebase Auth and send the **ID token** as `Authorization: Bearer …`.
The backend verifies it and reads the `role` custom claim (`admin` | `supervisor`). Admins are
seeded via `npm run seed:admin`; supervisors are created through `POST /api/supervisors`.

## Testing

- **Services & utils:** pure unit tests.
- **HTTP/integration:** supertest against the app with **in-memory fake repositories** injected
  through the container (`createContainer(overrides)`), so the whole route→controller→service
  path runs without Firebase. This is the fast `npm test` suite.
- **Firestore repositories:** covered by **emulator-backed tests** in `tests/emulator/`
  (`npm run test:emulator`) — verifies queries, sorting, batch writes, `merge` updates, and the
  transactional counter against a real Firestore. Requires Java (Firebase emulator). Keep
  business logic out of the repos regardless.

## Conventions

- **TDD:** write a failing test in `tests/`, implement the minimum in `src/`, refactor.
- Keep business logic in **services** (unit-tested without HTTP/Firebase); keep Firebase access
  confined to **repositories**.
- Validate all request input at the edge (controller) with **zod**.
- Throw `AppError(statusCode, message)` for expected error responses.
- Wire new dependencies in `src/container.ts`; mount new routers in `src/routes/index.ts`.
