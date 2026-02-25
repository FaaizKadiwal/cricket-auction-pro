# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR (http://localhost:5173)
npm run build      # TypeScript type-check (tsc) then production build
npm run preview    # Preview production build locally
npm run lint       # ESLint on .ts/.tsx files (--max-warnings 0, strict)
```

No test framework is configured. There are no unit or integration tests.

## Architecture

Cricket Auction Pro is a single-page React 18 + TypeScript + Vite application for managing cricket tournament player auctions. Zero runtime dependencies beyond React.

### State Management

All application state lives in `App.tsx` via `useState` + `useCallback`. There is no Redux/Zustand — state flows down as props. `TournamentContext` (React Context) provides read-only tournament config + derived `squadSize` to deeply nested components.

`useLocalStorage<T>(key, initialValue)` returns `[value, setValue, removeValue]` and auto-syncs to localStorage. Storage keys are centralized in the `STORAGE_KEYS` object in `src/constants/auction.ts` (prefixed `cap_`).

Key render gate: `config === null` means the wizard hasn't completed — App renders `ConfigScreen`. Once config exists, the full tab shell renders.

### Application Flow

ConfigScreen (3-step wizard) → main tabs: Setup → Auction → Squads → Rules

- **ConfigScreen**: Tournament setup wizard (team count, budget, category limits)
- **SetupTab**: Configure teams and player pool with image uploads
- **AuctionTab**: Live bidding interface with real-time bid cap enforcement
- **SquadsTab**: Final roster overview per team
- **RulesTab**: Dynamic rules page (reads from tournament config)

### Key Domain Concepts

- **squadSize** = `playersPerTeam - 1` — the captain is pre-assigned, not auctioned. This derivation appears throughout the codebase.
- **Player IDs** are generated via `Date.now()` in `SetupTab`.
- **Categories**: Gold, Silver, Bronze — each has configurable per-team limits (0 = unlimited).
- **Bid cap formula**: `maxBid = remainingBudget − (slotsAfterWin × minBidReserve)`
- **Images** are resized via canvas to base64 JPEG and stored directly in state/localStorage.

All auction validation logic (bid caps, category limits, budget checks) lives in `src/utils/auction.ts` as pure functions. Formatting helpers in `src/utils/format.ts`. Image resize + initials extraction in `src/utils/image.ts`.

### Styling

CSS Modules for component-scoped styles. Design tokens (colors, spacing, typography) defined as CSS custom properties in `src/styles/globals.css`. Dark theme only. Fonts: Bebas Neue (display), DM Sans (body), JetBrains Mono (mono) — loaded via Google Fonts in `index.html`.

### Type System

All TypeScript interfaces are centralized in `src/types/index.ts` — this is the single source of truth for domain types (`Team`, `Player`, `SoldPlayer`, `TournamentConfig`, `Category`, etc.).

### Path Alias

`@/*` maps to `src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

## Conventions

- Functional components + hooks only (exception: `ErrorBoundary` is a class component)
- Each component gets its own folder with `.tsx` + `.module.css` (except `ErrorBoundary.tsx` which is standalone, and `BidTeamPanel` which is co-located in `AuctionTab/`)
- Unused variables must be prefixed with `_` (ESLint enforced)
- `console.log` triggers a lint warning; use `console.warn` or `console.error` instead
- Business constants (budgets, limits, default colors) live in `src/constants/auction.ts`
- Accessibility: ARIA roles/labels on all interactive elements, `sr-only` class for screen-reader text, `focus-visible` outlines, `aria-live` regions for dynamic content
- All imports use the `@/` path alias — never relative `../` paths from components
