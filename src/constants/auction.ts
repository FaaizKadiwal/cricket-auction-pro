import type { Category, TournamentConfig, TabId } from '@/types';

// ─── Config Defaults ──────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: TournamentConfig = {
  tournamentName: 'Cricket Auction',
  totalTeams: 6,
  playersPerTeam: 8, // including captain → squadSize = 7
  budget: 3000,
  minBidReserve: 100,
  categoryLimits: {
    Gold:   { max: 3 },
    Silver: { max: 4 },
    Bronze: { max: 4 },
  },
  logoBase64: null,
};

// ─── Derived Helpers ──────────────────────────────────────────────────────────

/** Auction picks per team = players per team − 1 (captain is pre-assigned) */
export function getSquadSize(config: TournamentConfig): number {
  return config.playersPerTeam - 1;
}

// ─── Bid Increments ───────────────────────────────────────────────────────────

export const BID_INCREMENTS = [10, 25, 50, 100, 200] as const;
export type BidIncrement = (typeof BID_INCREMENTS)[number];

// ─── Category Visual Config ───────────────────────────────────────────────────

export const CATEGORY_STYLE: Record<Category, { color: string; bg: string }> = {
  Gold:   { color: '#FFD700', bg: '#2a1f00' },
  Silver: { color: '#C0C0C0', bg: '#1a1a2a' },
  Bronze: { color: '#CD7F32', bg: '#1f0f00' },
};

export const CATEGORIES: Category[] = ['Gold', 'Silver', 'Bronze'];

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
