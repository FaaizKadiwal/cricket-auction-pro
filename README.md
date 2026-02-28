# Cricket Auction Pro

A professional, production-grade tournament draft management system built with **React 18 + TypeScript + Vite**. Runs entirely in the browser — no backend, no database, no accounts.

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

---

## Available Scripts

| Command           | Description                             |
|-------------------|-----------------------------------------|
| `npm run dev`     | Start local dev server with HMR         |
| `npm run build`   | TypeScript type-check + production build|
| `npm run preview` | Serve the production build locally      |
| `npm run lint`    | ESLint strict pass (0 warnings allowed) |

---

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| UI Framework | React 18 — functional components, hooks |
| Language     | TypeScript 5 (strict mode)              |
| Build Tool   | Vite 5                                  |
| Styling      | CSS Modules + CSS custom properties     |
| State        | `useState` + `useCallback` (no library) |
| Persistence  | `localStorage` via `useLocalStorage`    |
| Live Viewer  | Browser `BroadcastChannel` API          |
| PDF Export   | jsPDF                                   |
| Linting      | ESLint + `@typescript-eslint`           |

---

## Application Flow

### 1 · Config Wizard (`ConfigScreen`)

First launch shows a 3-step wizard:

- **Step 1 — Tournament**: name, logo, number of teams, players per team (captain included), starting budget per team, minimum bid reserve per slot.
- **Step 2 — Categories**: configure category names (default: Gold / Silver / Bronze), colors, per-team min/max limits, and base prices.
- **Step 3 — Review & Launch**: summary before committing.

The wizard also doubles as an in-progress **Edit Config** panel (accessible from the header after launch), which safely propagates any category renames to existing players and adjusts team count without losing auction data.

### 2 · Setup Tab

Configure each team (name, color, logo, captain, captain photo) and build the player pool (name, category, base price, photo, optional description). Images are resized client-side via Canvas to base64 JPEG before storage.

### 3 · Auction Tab

The live bidding stage:

- Select a player from the pool to open bidding.
- Per-team panels show real-time budget, slots remaining, and a computed **bid cap** (see formula below). Bids that would breach the cap are blocked.
- Bid increment scales automatically with the current price (see Bid Increments below).
- Actions: **SOLD** (locks player to leading team), **Unsold** (triggers demotion/halving), **Undo Bid**, **Restart Bidding**, **Cancel**, **Undo Last Sale**.
- A filterable player pool table and a running bid log sit below the stage.
- Sidebar shows every team's budget bar, squad fill, and category quotas at a glance.

### 4 · Squads Tab

Read-only roster overview — all teams side by side showing their captain and every auctioned player with sale price.

### 5 · Rules Tab

Fully dynamic official rules page, generated from live tournament config. Exports a formatted PDF via jsPDF.

---

## Live Viewer (Second Screen)

Open a second browser tab/window to `http://localhost:5173/?mode=live` to show a full-screen broadcast display.

The admin window and viewer window communicate via the **BroadcastChannel API** (same origin, no server required). The viewer polls for a state sync every 3 seconds until connected, then renders animated phase transitions:

| Phase              | Screen shown                                              | Duration   |
|--------------------|-----------------------------------------------------------|------------|
| `IDLE`             | Tournament logo + sold player count + team list           | Persistent |
| `LOGO_TRANSITION`  | Animated logo sting between phases                        | 2 s        |
| `BIDDING`          | Player card + live current bid + all team budget panels   | Persistent |
| `SOLD`             | Sold overlay — player photo, winning team, final price    | 10 s       |
| `UNSOLD`           | Unsold overlay — player photo, stamp / demotion notice    | 5 s        |
| `SQUAD_VIEW`       | Full squad grid across all teams                          | Persistent |

The admin controls the phase via **Show Squads** / **Show Logo** buttons visible when no bidding is active.

---

## Key Domain Concepts

### Squad Size

```
squadSize = playersPerTeam − 1
```

The captain is pre-assigned, not auctioned. This derivation drives all slot-count calculations throughout the codebase.

### Bid Increments

| Current bid   | Increment |
|---------------|-----------|
| Below 400 pts | +20       |
| 400 – 999 pts | +50       |
| 1 000 – 1 999 | +100      |
| 2 000+        | +200      |

### Bid Cap Formula

```
maxBid = remainingBudget − (slotsAfterWin × minBidReserve)
```

`minBidReserve` is set per-tournament in the config wizard. The system enforces this in real time — bids that would leave a team unable to fill their remaining slots are rejected.

**Last-pick exception**: when a team is bidding on their final slot, `slotsAfterWin = 0`, so they may spend their full remaining budget.

### Unsold Player Mechanics

When a player goes unsold, the system applies one of two rules in order:

1. **Demotion** — if the player is not in the lowest category, they move to the next lower tier with a base price equal to the minimum base price of that tier (or `minBidReserve` if the tier is empty).
2. **Halve in place** — if already in the lowest category, their base price is halved (floor of `basePrice / 2`, minimum 1 pt) and they remain pending.

Players marked unsold permanently (no more demotions possible) are shown in the sidebar's Unsold section.

### Category System

Each category (Gold / Silver / Bronze by default, fully configurable) has:

- A display color used throughout the UI.
- Optional per-team **min** and **max** quotas (0 = unlimited).
- A default **base price** used when building new players.

Category limits are enforced at bid time — a team that has reached its max for a category cannot bid on a player in that category.

---

## Data Persistence

All state (config, teams, players, sold records, active tab) auto-syncs to `localStorage` under `cap_` prefixed keys (defined in `src/constants/auction.ts`). A page refresh restores the full in-progress auction.

**To reset**: use the **Reset** button in the header, or clear `localStorage` manually via DevTools → Application → Local Storage.

---

## Project Structure

```
src/
├── types/
│   ├── index.ts            # All domain interfaces (Team, Player, SoldPlayer, TournamentConfig…)
│   └── live.ts             # BroadcastChannel message types + ViewerPhase state machine
│
├── constants/
│   └── auction.ts          # Business constants, storage keys, getCategoryStyle, bid increments
│
├── utils/
│   ├── auction.ts          # Pure functions: getBidCap, validateBid, getSquad, getSpent, getCatCount
│   ├── format.ts           # formatPts, formatPct, getBarColorToken
│   ├── image.ts            # Canvas-based image resize + initials extraction
│   └── pdf.ts              # jsPDF rules export
│
├── hooks/
│   ├── useLocalStorage.ts  # Generic type-safe localStorage sync → [value, setValue, removeValue]
│   ├── useToast.ts         # Notification queue with enter/exit animations
│   ├── useBroadcast.ts     # Admin-side BroadcastChannel publisher
│   └── useLiveViewer.ts    # Viewer-side BroadcastChannel subscriber + state reducer
│
├── context/
│   └── TournamentContext.tsx  # Read-only config + squadSize provided to deep components
│
├── styles/
│   └── globals.css         # Design tokens (CSS variables), reset, scrollbar, focus rings
│
├── components/
│   ├── ErrorBoundary.tsx         # Class component — catches render errors gracefully
│   ├── Avatar/                   # Circular/square image or initials fallback
│   ├── Icon/                     # SVG icon set (single source, name → path)
│   ├── ImageUpload/              # Drag-and-drop / click image uploader with canvas resize
│   ├── Toast/                    # Accessible notification stack with enter/exit animations
│   ├── Header/                   # Sticky nav bar — tabs, sold count, budget spent, edit/reset
│   ├── ConfigScreen/             # 3-step tournament config wizard (also used for edit mode)
│   ├── SetupTab/                 # Team editor + player pool CRUD
│   ├── AuctionTab/               # Live bidding stage + player pool table + sidebar
│   │   └── BidTeamPanel.tsx      # Per-team bid card (co-located, not a separate folder)
│   ├── SquadsTab/                # Final roster grid
│   ├── RulesTab/                 # Dynamic rules page + PDF export
│   ├── LiveViewer/               # Entry point for ?mode=live — orchestrates phase transitions
│   ├── LiveIdleScreen/           # Idle phase: logo + sold count + team list
│   ├── LiveBiddingScreen/        # Bidding phase: player card + bid panel + all team cards
│   ├── LiveBidTicker/            # Scrolling bid log ticker used within LiveBiddingScreen
│   ├── LiveSoldOverlay/          # SOLD phase: animated player + team + final price reveal
│   ├── LiveUnsoldOverlay/        # UNSOLD phase: animated stamp + demotion/halve notice
│   ├── LiveSquadView/            # SQUAD_VIEW phase: full team roster grid
│   └── LogoTransition/           # Animated logo sting between live phases
│
├── App.tsx        # Root — all state coordination, localStorage wiring, tab routing
├── App.module.css
└── main.tsx       # React DOM entry — detects ?mode=live to mount LiveViewerApp
```

---

## Architecture Notes

- **No external state library** — all state lives in `App.tsx` via `useState` / `useCallback` and flows down as props. `TournamentContext` provides read-only config + `squadSize` to avoid deep prop drilling.
- **`@/` path alias** maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`). All imports use this alias — never relative `../` paths from components.
- **Zero CSS-in-JS** — every component has a co-located `.module.css` file. Design tokens are CSS custom properties in `globals.css`. Dark theme only.
- **Live viewer isolation** — `main.tsx` checks `?mode=live` and mounts `LiveViewerApp` instead of `App`. The two windows share zero React state; communication is entirely via `BroadcastChannel`.
- **Fonts** — Bebas Neue (display), DM Sans (body), JetBrains Mono (mono) — loaded via Google Fonts `<link>` in `index.html` to avoid render-blocking `@import`.
- **No test framework** is configured. There are no unit or integration tests.
