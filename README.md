# 🏏 Cricket Auction Pro

A professional, production-grade tournament draft management system built with **React 18 + TypeScript + Vite**.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open http://localhost:5173 in your browser
```

---

## Tech Stack

| Layer         | Technology                    |
|---------------|-------------------------------|
| UI Framework  | React 18 (functional + hooks) |
| Language      | TypeScript 5 (strict mode)    |
| Build Tool    | Vite 5                        |
| Styling       | CSS Modules + CSS Custom Props |
| State         | React useState + useCallback   |
| Persistence   | localStorage via custom hook  |
| Linting       | ESLint + @typescript-eslint   |

---

## Project Structure

```
src/
├── types/          # All TypeScript interfaces (single source of truth)
├── constants/      # Business rule constants (TEAM_BUDGET, SQUAD_LIMITS, etc.)
├── utils/
│   ├── auction.ts  # Pure auction logic (getBidCap, validateBid, etc.)
│   └── format.ts   # Pure formatting helpers
├── hooks/
│   ├── useLocalStorage.ts  # Generic, type-safe persistence
│   └── useToast.ts         # Queue-based notification system
├── styles/
│   └── globals.css         # Design tokens (CSS variables) + reset
├── components/
│   ├── ErrorBoundary.tsx   # Catches render errors gracefully
│   ├── Header/             # Sticky navigation with live stats
│   ├── Toast/              # Accessible notification stack
│   ├── SetupTab/           # Team + player pool setup
│   ├── AuctionTab/         # Live bidding stage + bid cap enforcement
│   │   └── BidTeamPanel/   # Per-team bidding card (extracted component)
│   ├── SquadsTab/          # Final roster overview
│   └── RulesTab/           # Official rules reference
├── App.tsx         # Root — state coordination + localStorage
└── main.tsx        # React DOM entry point
```

---

## Available Scripts

| Command          | Description                      |
|------------------|----------------------------------|
| `npm run dev`    | Start local dev server (HMR)     |
| `npm run build`  | Type-check + production build    |
| `npm run preview`| Preview the production build     |
| `npm run lint`   | Run ESLint across all TS files   |

---

## Bidding Cap Formula

```
maxBid = remainingBudget − (slotsAfterWin × 100)
```

A captain's maximum bid on the current player equals their remaining budget minus a reserve
of 100 pts for each slot they still need to fill after winning this player.
This is enforced automatically — bid buttons are disabled per-increment in real time.

---

## Data Persistence

All auction state (teams, players, sold records, active tab) is persisted to `localStorage`
automatically. A page refresh will restore the full auction in progress.

To reset: clear `localStorage` in browser DevTools → Application → Local Storage.
