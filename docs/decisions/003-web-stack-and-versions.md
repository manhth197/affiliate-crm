# 003 (web) — Web stack and pinned versions

## Context
The brief fixes the libraries (Vite, React, TypeScript strict, React Router, TanStack Query, react-hook-form + zod, Tailwind + shadcn/ui). In November 2026 several of them had new major versions, and not all tools support the newest TypeScript.

## Decision
- **Vite 8 + React 19**, a client-side SPA (no SSR): the app is behind login, SEO does not matter, and nginx can serve the static build (M5).
- **React Router 8 in data mode** (`createBrowserRouter` + route objects), not framework mode. Route guards are layout routes (`<RequireAuth>`, `<RequireRole>`, `<GuestOnly>`) that render `<Outlet />`.
- **Server state in TanStack Query**, not in a global store. The logged-in user is the `['auth','me']` query; the only client state is the token store.
- **TypeScript pinned to 5.9** instead of the scaffold's TypeScript 7. `typescript-eslint` supports `<6.1` and `openapi-typescript` needs `^5`, and we need both (lint and generated API types). Revisit when they support TS 7.
- **ESLint (flat config) + Prettier** instead of the scaffold's oxlint, as the brief asks; `eslint-config-prettier` turns off style rules so the two never disagree.
- **shadcn/ui, `radix-nova` style**: components are copied into `src/components/ui` (we own the code). We removed its `next-themes` dependency (light theme only) and translated hidden labels to Vietnamese.
- **date-fns + `@date-fns/tz`** to always show Vietnam time (`Asia/Ho_Chi_Minh`), whatever the browser's time zone.

## Alternatives
- **Next.js** — SSR/RSC adds a Node server and complexity we do not need for a logged-in dashboard.
- **Redux / Zustand for API data** — duplicates what TanStack Query already does (caching, refetching, loading/error states).
- **TypeScript 7** — faster compiler, but it would break linting and type generation today.

## Consequences
- One npm project in `apps/web` with its own lockfile, so the API and web branches never touch the same lockfile.
- The first production bundle is ~670 KB (≈210 KB gzip) in one chunk; route-level code splitting is planned for M5.
