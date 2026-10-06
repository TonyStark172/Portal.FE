# Portal.FE

Front end of the Portal, talking to [Portal.BE](../Portal.BE).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · [HeroUI v3](https://heroui.com)
· Redux Toolkit + RTK Query (API client generated from Portal.BE's OpenAPI document).

## Run

1. Start Portal.BE (`dotnet run --project ..\Portal.BE\src\AppHost`, or F5 on the AppHost in Visual Studio).
   The API must answer on `http://localhost:5128` (see `PORTAL_API_URL` in `.env.development`).
2. `npm install`, then `npm run dev` and open http://localhost:3000.

Demo account: `admin` / `Admin@123` (see Portal.BE's README for the others).

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run the production build |
| `npm run lint` / `typecheck` | ESLint / TypeScript checks |
| `npm run api:fetch` | Download the OpenAPI document from a running Portal.BE into `openapi/portal-api.json` |
| `npm run api:generate` | Regenerate `src/shared/api/generated/portalApi.ts` (types + RTK Query hooks) |

Run `api:fetch` then `api:generate` whenever the back-end API changes; TypeScript then points at every
place in the front end that must follow.

## Architecture (feature-based)

```
src/
├── app/              Next.js routes only (thin): pages, layouts, route handlers
│   ├── login/        Sign-in page
│   ├── (portal)/     Pages that require a signed-in user (RequireAuth + AppShell)
│   └── api/session/  BFF route handlers keeping the refresh token in an httpOnly cookie
├── core/             App composition: Redux store, providers, app shell and menu
├── features/         One folder per feature (≈ src/Application/* in Portal.BE)
│   └── auth/         Login form, route guard, <Can>, current user, sign-out
└── shared/           No business logic; used by every feature
    ├── api/          RTK Query base API, generated client, error (problem details) helpers
    ├── session/      Session state, refresh/sign-in calls, server-side cookie helpers
    ├── auth/         Permission codes (mirror of Portal.BE's Permissions.cs)
    ├── ui/           Reusable UI not in HeroUI's free set (sidebar: icon rail, mobile drawer, Ctrl+B)
    └── config/
```

Dependency rules: `app → core → features → shared`. A feature never imports another feature's internals,
only its `index.ts`; `shared` never imports from `features` or `core`.

### Adding a feature

1. Create `src/features/<name>/` with `components/`, `hooks/` and an `index.ts` exporting the public parts.
2. Use the generated hooks (`useGetDepartmentsQuery`, `useCreateDepartmentMutation`...) from
   `@/shared/api/generated/portalApi`; show errors with `toApiProblem` / `toFieldErrors` from `@/shared/api/problem`.
3. Add a page under `src/app/(portal)/<route>/page.tsx` that renders the feature's component.
4. Add a menu entry (with its permission) in `src/core/layout/navigation.ts`, and hide actions with
   `<Can permission={Permissions.X.Y}>`.

## Authentication

- `POST /api/session` (route handler) signs in through Portal.BE and stores the **refresh token in an httpOnly,
  SameSite=Strict cookie**; the browser only receives the short-lived access token, kept **in memory** (Redux).
- After a reload, `SessionBootstrap` gets a new access token from `POST /api/session/refresh`.
- API calls go to `/backend/*`, which Next.js rewrites to Portal.BE (no CORS). On `401`, the RTK Query base query
  refreshes the session once and retries; if that fails the user is signed out.
- Refresh tokens are single-use, so refreshes are de-duplicated in the tab and serialised across tabs (Web Locks).
- `<Can permission>` and the menu hide what the user may not do; Portal.BE still checks every request.
