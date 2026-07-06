import type { TournamentConfig, Team, Player, SoldPlayer } from '@/types';
import type { DraftState } from '@/types/draft';

/** Bumped when the persisted shape changes in a way that breaks older backups. */
export const BACKUP_SCHEMA_VERSION = 1;
const APP_TAG = 'cricket-auction-pro';

/** A full, portable snapshot of a tournament (spec §2.19 — complete state, not just results). */
export interface BackupData {
  app: typeof APP_TAG;
  schemaVersion: number;
  exportedAt: string;
  config: TournamentConfig;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  draftState: DraftState | null;
}

export interface BackupInput {
  config: TournamentConfig;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  draftState: DraftState | null;
  exportedAt: string; // ISO — caller owns the Date side effect
}

export function buildBackup(input: BackupInput): string {
  const data: BackupData = {
    app: APP_TAG,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    config: input.config,
    teams: input.teams,
    players: input.players,
    soldPlayers: input.soldPlayers,
    draftState: input.draftState,
  };
  return JSON.stringify(data, null, 2);
}

/** Parse + validate a backup file's structure and schema version before it may be loaded (§2.19.2). */
export function parseBackup(json: string): { ok: true; data: BackupData } | { ok: false; error: string } {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  const b = d as Partial<BackupData>;
  if (!b || b.app !== APP_TAG) return { ok: false, error: 'This is not a Cricket Auction Pro backup file.' };
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported backup version (${b.schemaVersion}). This app supports up to v${BACKUP_SCHEMA_VERSION}.` };
  }
  if (!b.config || !Array.isArray(b.teams) || !Array.isArray(b.players) || !Array.isArray(b.soldPlayers)) {
    return { ok: false, error: 'The backup is missing required data (config, teams, players, or picks).' };
  }
  return { ok: true, data: b as BackupData };
}
