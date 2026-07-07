# Cricket Auction Pro

A professional tournament player-acquisition manager for cricket leagues, built with **React 18 + TypeScript + Vite**. Runs entirely in the browser — no backend, no database, no accounts.

It supports **two tournament modes**, chosen in the setup wizard:

- **Auction** — teams bid points on players, with real-time budget caps, tiered increments, and demotion rules.
- **Draft** — teams pick players in turns with **no bidding**: a seeded random captain draw, a seeded order shuffle, a fairness-verified snake/balanced pick schedule, and a finalized read-only result.

Both modes drive a full-screen **live projector display** in a second window, and both persist every change instantly to `localStorage` (a refresh resumes exactly where you were).

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Available Scripts

| Command              | Description                                    |
|----------------------|------------------------------------------------|
| `npm run dev`        | Start local dev server with HMR                |
| `npm run build`      | TypeScript type-check + production build       |
| `npm run preview`    | Serve the production build locally             |
| `npm run lint`       | ESLint strict pass (0 warnings allowed)        |
| `npm test`           | Run the unit tests (Vitest)                    |
| `npm run test:watch` | Tests in watch mode                            |

## Tech Stack

| Layer        | Technology                                       |
|--------------|--------------------------------------------------|
| UI Framework | React 18 — functional components, hooks          |
| Language     | TypeScript 5 (strict mode)                       |
| Build Tool   | Vite 5                                           |
| Styling      | CSS Modules + design tokens (CSS custom props)   |
| State        | `useState` + `useCallback` in `App.tsx` (no lib) |
| Persistence  | `localStorage` via `useLocalStorage`             |
| Live Viewer  | Browser `BroadcastChannel` API                   |
| PDF Export   | jsPDF (lazy-loaded)                              |
| Testing      | Vitest (pure-logic suites: draft engine, CSV)    |
| Linting      | ESLint + `@typescript-eslint` (max-warnings 0)   |

---

## Application Flow

### 1 · Config Wizard (`ConfigScreen`)

3-step wizard on first launch: tournament name/logo, **mode (Auction or Draft)**, team count, players per team, budget + minimum bid reserve (auction only), and fully configurable categories (names, colours, per-team min/max quotas in auction, exact per-team pick counts in draft). Re-opens later as **Edit Config** — structural fields lock once players have been acquired.

### 2 · Setup Tab

Teams (name, colour, logo) and the player pool (name, category, base price in auction, photo, description). In **draft mode** the captains are entered as a *separate unpaired pool* — the draw pairs them with franchises later.

**Bulk CSV import** for both views: a `Template` button downloads a ready-to-fill CSV (using your real category names / team count), and `Import CSV` parses, validates, de-dupes, and shows a confirmation summary before applying. Prepare the sheet in Excel and *Save As → CSV*.

### 3a · Auction Tab (auction mode)

Live bidding stage: per-team panels with real-time **bid caps** (`remainingBudget − slotsAfterWin × minBidReserve`), tiered increments, SOLD confirmation dialog, unsold → demotion/halving, undo bid / restart / undo last sale, searchable pool, and a bid log.

### 3b · Draft Tab (draft mode)

Five phases, each gated only by what it actually needs:

1. **Captain Assignment** — one click randomly pairs every captain with a franchise (seeded, auditable, re-drawable); confirm to lock.
2. **Draft Order** — seeded shuffle of the base order; the seed is displayed for auditability.
3. **Preview** — locked order, per-round category schedule, and a **fairness table** of pick-position totals. Start Draft is gated on a complete, valid player pool.
4. **Drafting** — full on-the-clock board: current team, category-scoped pool with search, pick confirmation, undo, per-team progress, remaining-per-category counters, round/pick matrix, recent picks.
5. **Finalized** — read-only lock, with **CSV and JSON results export**.

Pick order is a generalized **snake** for any team count; for the 6-team / 2-3-2 shape it automatically uses a **Balanced Custom Grid** with proven fairness totals (Gold/Bronze 7 each, Silver 10–11, overall 24–25, spread ≤ 1). The engine is pure (`src/utils/draft.ts`) and covered by simulation tests across many tournament shapes.

### 4 · Squads Tab

Roster overview for all teams. In auction mode each acquired player has a **Correct Sale** action (reassign team / fix price, or return to the pool) — validated against squad size, category limits, and budget. Draft squads are corrected via Undo on the board instead.

### 5 · Rules Tab

Dynamic rules page generated from the live tournament config (auction or draft variant), with a formatted **PDF export**.

---

## Live Viewer (Second Screen)

Open `http://localhost:5173/?mode=live` in a second window (the header's **Live Viewer** button does this) and put it on the projector. The admin window drives it over the **BroadcastChannel** API — same origin, same machine, no server.

| Phase        | Screen                                                        |
|--------------|---------------------------------------------------------------|
| `IDLE`       | Tournament logo + progress + team list                        |
| `BIDDING`    | Player card + live bid + all team budget panels               |
| `SOLD`       | Animated sold overlay (player, team, price)                   |
| `UNSOLD`     | Unsold overlay with demotion / base-halved notice             |
| `SQUAD_VIEW` | Full squad grid                                               |
| `DRAFT`      | **On-the-clock draft board** (round, team, counters, recents) |

The viewer requests a snapshot until connected, then stays current via incremental event messages. Type on the projector screens scales fluidly with resolution (1080p → 4K).

---

## Data Safety

- **Auto-persistence** — every change is written to `localStorage` (`cap_`-prefixed keys); refresh/crash resumes in place. Storage-full conditions surface a warning toast.
- **Full backup** — the header's save icon exports the *entire* tournament (config, teams, players, sales/picks, draft state) as a single JSON file; the import icon restores it behind a confirmation dialog with schema validation.
- **Results export** — finalized drafts export CSV + JSON (with seeds for auditability); auction rules export as PDF.
- **Reset** — guarded by a type-safe confirmation dialog.

---

## Project Structure

```text
src/
├── types/            # All domain interfaces (index.ts), live-viewer messages (live.ts), draft types (draft.ts)
├── constants/        # auction.ts (business constants, storage keys, tabs) · draft.ts (Balanced Grid)
├── utils/            # Pure logic — auction.ts (caps/validation), draft.ts (schedule/order/fairness/draw),
│                     # csvImport.ts (RFC-4180 parser + validators), export.ts (CSV/JSON), backup.ts,
│                     # format.ts, color.ts, image.ts, pdf.ts
├── hooks/            # useLocalStorage, useToast, useBroadcast (admin), useLiveViewer (viewer), useFocusTrap
├── context/          # TournamentContext (read-only config + squadSize)
├── styles/           # globals.css — design tokens, reset, a11y helpers
├── components/       # One folder per component (.tsx + .module.css)
│   ├── ConfigScreen/ SetupTab/ AuctionTab/ DraftTab/ SquadsTab/ RulesTab/ Header/
│   ├── LiveViewer/ LiveBiddingScreen/ LiveSoldOverlay/ LiveUnsoldOverlay/
│   ├── LiveSquadView/ LiveIdleScreen/ LiveDraftScreen/ LogoTransition/
│   └── ConfirmDialog/ CategoryPills/ Avatar/ Icon/ ImageUpload/ Toast/ ErrorBoundary
├── App.tsx           # Root — all state coordination + localStorage wiring
└── main.tsx          # Entry — ?mode=live mounts the viewer app instead
```

Tests live next to the logic they verify: `src/utils/draft.test.ts` (fairness/simulation battery) and `src/utils/csvImport.test.ts`.

## Architecture Notes

- **All state lives in `App.tsx`** and flows down as props; `TournamentContext` provides read-only config. No state library by design at this scale.
- **Pure logic lives in `utils/`**, never in components — the draft engine, bid math, validation, and parsers are all plain testable functions.
- **`@/` path alias** → `src/` (tsconfig + vite config). No relative `../` imports from components.
- **Design tokens** in `globals.css`; component styles in co-located CSS Modules; dynamic per-team/category colours via inline `style` and `withAlpha()`. Dark theme only.
- **A drafted player is a `SoldPlayer` with `finalPrice: 0`** — squads, projector, search, undo, and exports reuse the same data path in both modes.
- **Scope by design:** single operator, one machine, projector via a second window. There is no multi-user editing, cross-device sync, or server — see the stack notes above before deploying it as a hosted service.
