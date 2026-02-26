import type { Category, CategoryDefinition, TournamentConfig, TabId } from '@/types';

// ─── Default Categories ──────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { name: 'Gold',   color: '#FFD700', bgColor: '#2a1f00', min: 0, max: 3 },
  { name: 'Silver', color: '#C0C0C0', bgColor: '#1a1a2a', min: 0, max: 4 },
  { name: 'Bronze', color: '#CD7F32', bgColor: '#1f0f00', min: 0, max: 4 },
];

// ─── Config Defaults ──────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: TournamentConfig = {
  tournamentName: 'Cricket Auction',
  totalTeams: 6,
  playersPerTeam: 8, // including captain → squadSize = 7
  budget: 3000,
  minBidReserve: 100,
  categories: DEFAULT_CATEGORIES,
  logoBase64: null,
};

// ─── Derived Helpers ──────────────────────────────────────────────────────────

/** Auction picks per team = players per team − 1 (captain is pre-assigned) */
export function getSquadSize(config: TournamentConfig): number {
  return config.playersPerTeam - 1;
}

// ─── Category Helpers ────────────────────────────────────────────────────────

/** Look up a CategoryDefinition by its name from config. */
export function getCategoryDef(
  config: TournamentConfig,
  categoryName: Category,
): CategoryDefinition | undefined {
  return config.categories.find((c) => c.name === categoryName);
}

/** Get category style (color + bg) by name from config. Fallback for unknown. */
export function getCategoryStyle(
  config: TournamentConfig,
  categoryName: Category,
): { color: string; bg: string } {
  const def = getCategoryDef(config, categoryName);
  return def
    ? { color: def.color, bg: def.bgColor }
    : { color: '#888888', bg: '#1a1a1a' };
}

/** Get ordered list of category names from config. */
export function getCategoryNames(config: TournamentConfig): Category[] {
  return config.categories.map((c) => c.name);
}

// ─── Bid Increments ───────────────────────────────────────────────────────────

export const BID_INCREMENTS = [20, 50, 100, 200] as const;
export type BidIncrement = (typeof BID_INCREMENTS)[number];

/** Bid-threshold tiers: below each `upto` value the increment is `inc`. */
const BID_TIERS: { upto: number; inc: BidIncrement }[] = [
  { upto: 400,  inc: 20  },
  { upto: 1000, inc: 50  },
  { upto: 2000, inc: 100 },
  { upto: Infinity, inc: 200 },
];

/** Return the single active bid increment for the given current bid amount. */
export function getActiveIncrement(currentBid: number): BidIncrement {
  for (const tier of BID_TIERS) {
    if (currentBid < tier.upto) return tier.inc;
  }
  return 200;
}

// ─── Default Team Colors ──────────────────────────────────────────────────────

export const DEFAULT_TEAM_COLORS: string[] = [
  '#e63946', '#f4a261', '#2a9d8f',
  '#e9c46a', '#a8dadc', '#c77dff',
  '#06d6a0', '#ef476f', '#ffd166',
  '#118ab2', '#073b4c', '#8ecae6',
  '#ffb703', '#fb8500', '#023047',
  '#219ebc', '#8338ec', '#3a86ff',
  '#ff006e', '#fb5607',
];

// ─── Live Viewer Channel ──────────────────────────────────────────────────

export const LIVE_CHANNEL_NAME = 'cap_live_auction';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  CONFIG:       'cap_config',
  TEAMS:        'cap_teams',
  PLAYERS:      'cap_players',
  SOLD_PLAYERS: 'cap_sold_players',
  ACTIVE_TAB:   'cap_tab',
} as const;

// ─── Navigation Tabs ──────────────────────────────────────────────────────────

export const TABS: { id: TabId; label: string }[] = [
  { id: 'setup',   label: '⚙️ Setup'   },
  { id: 'auction', label: '🔨 Auction' },
  { id: 'squads',  label: '👥 Squads'  },
  { id: 'rules',   label: '📋 Rules'   },
];
