import type { TournamentConfig, Team, SoldPlayer } from '@/types';
import type { DraftState } from '@/types/draft';
import { getRoundSchedule } from '@/utils/draft';
import { getSquad } from '@/utils/auction';
import { teamLabel } from '@/utils/format';

export interface DraftExportInput {
  config: TournamentConfig;
  teams: Team[];
  soldPlayers: SoldPlayer[];
  draftState: DraftState;
  generatedAt: string; // ISO timestamp — passed in (Date is a side effect the caller owns)
}

const nameOf = (teams: Team[], id: number): string => {
  const t = teams.find((x) => x.id === id);
  return t ? teamLabel(t) : `Team ${id}`;
};

/** Quote a CSV field when it contains a comma, quote, or newline (RFC-4180). */
export function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Draft history as CSV — one row per pick, in pick order. */
export function buildDraftCsv({ config, teams, soldPlayers }: DraftExportInput): string {
  const schedule = getRoundSchedule(config);
  const T = config.totalTeams;
  const rows: string[][] = [['Pick', 'Round', 'Category', 'Team', 'Captain', 'Player', 'Time']];
  soldPlayers.forEach((sp, i) => {
    const r = Math.floor(i / T);
    const team = teams.find((t) => t.id === sp.teamId);
    rows.push([
      String(i + 1),
      String(r + 1),
      schedule[r] ?? sp.category,
      nameOf(teams, sp.teamId),
      team?.captain ?? '',
      sp.name,
      sp.soldAt ?? '',
    ]);
  });
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** Full draft results as structured JSON — rosters + ordered history + provenance. */
export function buildDraftJson({ config, teams, soldPlayers, draftState, generatedAt }: DraftExportInput): string {
  const schedule = getRoundSchedule(config);
  const T = config.totalTeams;

  const history = soldPlayers.map((sp, i) => {
    const r = Math.floor(i / T);
    return {
      pick: i + 1,
      round: r + 1,
      category: schedule[r] ?? sp.category,
      team: nameOf(teams, sp.teamId),
      player: sp.name,
      timestamp: sp.soldAt ?? null,
    };
  });

  const rosters = teams.map((team) => ({
    team: teamLabel(team),
    captain: team.captain || null,
    players: getSquad(team.id, soldPlayers).map((sp) => ({ name: sp.name, category: sp.category })),
  }));

  return JSON.stringify(
    {
      tournament: config.tournamentName,
      mode: 'draft',
      generatedAt,
      seed: draftState.seed,
      captainSeed: draftState.captainSeed,
      baseOrder: draftState.baseOrder.map((id) => nameOf(teams, id)),
      rosters,
      history,
    },
    null,
    2,
  );
}

/** Trigger a client-side file download. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
