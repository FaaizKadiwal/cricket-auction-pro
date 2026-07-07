import type { TournamentConfig, Category, Player, Team, SoldPlayer, ValidationError } from '@/types';
import type { PickContext, SlotFairness } from '@/types/draft';
import { getSquadSize } from '@/constants/auction';
import { BALANCED_GRID, BALANCED_GRID_TEAMS, BALANCED_GRID_GROUPS } from '@/constants/draft';

// ─── Round Schedule ───────────────────────────────────────────────────────────

/**
 * The category drawn in each round — one entry per round, in category order,
 * each category repeated by its `draftCount`. Length = total rounds = squadSize.
 * Fully generic: derived from config, no fixed structure assumed.
 */
export function getRoundSchedule(config: TournamentConfig): Category[] {
  const rounds: Category[] = [];
  for (const c of config.categories) {
    const n = c.draftCount ?? 0;
    for (let i = 0; i < n; i++) rounds.push(c.name);
  }
  return rounds;
}

export function getDraftRounds(config: TournamentConfig): number {
  return getRoundSchedule(config).length;
}

export function getDraftTotalPicks(config: TournamentConfig): number {
  return config.totalTeams * getDraftRounds(config);
}

/** Run-lengths of consecutive same-category rounds, e.g. [G,G,S,S,S,B,B] → [2,3,2]. */
function roundGroups(schedule: Category[]): number[] {
  const groups: number[] = [];
  for (let i = 0; i < schedule.length; i++) {
    if (i > 0 && schedule[i] === schedule[i - 1]) groups[groups.length - 1] += 1;
    else groups.push(1);
  }
  return groups;
}

/**
 * The Balanced Custom Grid is only mathematically proven for a 6-team draft
 * grouped exactly 2-3-2. Every other shape uses the generalized snake draft.
 */
export function canUseBalancedGrid(config: TournamentConfig): boolean {
  if (config.totalTeams !== BALANCED_GRID_TEAMS) return false;
  const groups = roundGroups(getRoundSchedule(config));
  return groups.length === BALANCED_GRID_GROUPS.length
    && groups.every((g, i) => g === BALANCED_GRID_GROUPS[i]);
}

// ─── Pick Order ───────────────────────────────────────────────────────────────

/**
 * For each round (0-based), the ordered list of teamIds picking (index 0 = picks
 * first). Uses the Balanced Grid when applicable, otherwise a snake draft
 * (order reverses every round) which generalizes to any team/round count.
 */
export function generatePickOrder(config: TournamentConfig, baseOrder: number[]): number[][] {
  const rounds = getDraftRounds(config);
  const T = config.totalTeams;

  if (canUseBalancedGrid(config) && baseOrder.length === T && rounds === BALANCED_GRID[0].length) {
    const order: number[][] = [];
    for (let r = 0; r < rounds; r++) {
      const arr: number[] = new Array(T);
      for (let slot = 0; slot < T; slot++) {
        const pos = BALANCED_GRID[slot][r]; // 1..T
        arr[pos - 1] = baseOrder[slot];
      }
      order.push(arr);
    }
    return order;
  }

  // Snake: even rounds forward, odd rounds reversed.
  const order: number[][] = [];
  for (let r = 0; r < rounds; r++) {
    order.push(r % 2 === 0 ? [...baseOrder] : [...baseOrder].reverse());
  }
  return order;
}

/** Context for the pick at `pickIndex` (= count of completed picks). */
export function getPickContext(config: TournamentConfig, baseOrder: number[], pickIndex: number): PickContext {
  const schedule = getRoundSchedule(config);
  const T = config.totalTeams;
  const totalPicks = T * schedule.length;

  if (pickIndex >= totalPicks || totalPicks === 0) {
    return {
      pickNumber: totalPicks,
      round: schedule.length,
      category: schedule[schedule.length - 1] ?? '',
      onClockTeamId: null,
      positionInRound: T,
      totalPicks,
      complete: true,
    };
  }

  const round = Math.floor(pickIndex / T);   // 0-based
  const positionInRound = pickIndex % T;     // 0-based
  const onClockTeamId = generatePickOrder(config, baseOrder)[round]?.[positionInRound] ?? null;

  return {
    pickNumber: pickIndex + 1,
    round: round + 1,
    category: schedule[round],
    onClockTeamId,
    positionInRound: positionInRound + 1,
    totalPicks,
    complete: false,
  };
}

/** Undrafted players in the given category (draft picks are category-scoped by round). */
export function getDraftAvailablePlayers(players: Player[], category: Category): Player[] {
  return players.filter((p) => p.status === 'pending' && p.category === category);
}

// ─── Shared board derivations (admin DraftBoard + projector LiveDraftScreen) ──

/** Remaining undrafted players per drafted category — the "X left" counters (spec §2.12). */
export function getDraftRemainingCounts(
  config: TournamentConfig,
  players: Player[],
): { cat: Category; remaining: number }[] {
  return config.categories
    .filter((c) => c.draftCount > 0)
    .map((c) => ({ cat: c.name, remaining: getDraftAvailablePlayers(players, c.name).length }));
}

/** The next `count` teams on the clock after `picksMade`, in pick order. */
export function getUpcomingTeams(
  config: TournamentConfig,
  pickOrder: number[][],
  teams: Team[],
  picksMade: number,
  count: number,
): Team[] {
  const T = config.totalTeams;
  const totalPicks = getDraftTotalPicks(config);
  const out: Team[] = [];
  for (let i = picksMade + 1; i < picksMade + 1 + count && i < totalPicks; i++) {
    const tm = teams.find((t) => t.id === pickOrder[Math.floor(i / T)]?.[i % T]);
    if (tm) out.push(tm);
  }
  return out;
}

export interface RecentPick {
  player: SoldPlayer;
  team: Team | undefined;
  round: number;
  category: Category;
}

/** The last `count` picks, newest first, with their round + scheduled category. */
export function getRecentPicks(
  config: TournamentConfig,
  teams: Team[],
  soldPlayers: SoldPlayer[],
  count: number,
): RecentPick[] {
  const T = config.totalTeams;
  const schedule = getRoundSchedule(config);
  const out: RecentPick[] = [];
  for (let i = soldPlayers.length - 1; i >= 0 && out.length < count; i--) {
    const r = Math.floor(i / T);
    out.push({
      player: soldPlayers[i],
      team: teams.find((t) => t.id === soldPlayers[i].teamId),
      round: r + 1,
      category: schedule[r] ?? soldPlayers[i].category,
    });
  }
  return out;
}

// ─── Fairness ─────────────────────────────────────────────────────────────────

/**
 * Per-team pick-position totals (per category and overall) for the given base
 * order — the data behind the fairness preview. For the Balanced Grid this
 * yields the proven 7 / 10-or-11 / 24-or-25 totals; for snake it shows the
 * actual (less balanced) totals so the operator sees the real spread.
 */
export function getSlotFairness(config: TournamentConfig, baseOrder: number[]): SlotFairness[] {
  const schedule = getRoundSchedule(config);
  const pickOrder = generatePickOrder(config, baseOrder);
  const byTeam = new Map<number, SlotFairness>();
  for (const tid of baseOrder) byTeam.set(tid, { teamId: tid, perCategory: {}, overall: 0 });

  schedule.forEach((cat, r) => {
    pickOrder[r].forEach((tid, idx) => {
      const f = byTeam.get(tid);
      if (!f) return;
      const pos = idx + 1;
      f.perCategory[cat] = (f.perCategory[cat] ?? 0) + pos;
      f.overall += pos;
    });
  });

  return baseOrder.map((tid) => byTeam.get(tid)).filter((f): f is SlotFairness => f !== undefined);
}

/** Spread (max − min) of overall pick-position totals; 0–1 is optimal. */
export function getFairnessSpread(fairness: SlotFairness[]): number {
  if (fairness.length === 0) return 0;
  const totals = fairness.map((f) => f.overall);
  return Math.max(...totals) - Math.min(...totals);
}

// ─── Seeded Shuffle (reproducible / auditable) ────────────────────────────────

/** Deterministic PRNG seeded from a 32-bit number (mulberry32). */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed from the browser CSPRNG, recorded so the shuffle can be re-verified. */
export function makeSeed(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return buf[0].toString(16).padStart(8, '0') + buf[1].toString(16).padStart(8, '0');
}

/** Deterministically shuffle a number array from a recorded seed (Fisher–Yates). */
export function shuffleTeams(teamIds: number[], seed: string): number[] {
  const rand = mulberry32(parseInt(seed.slice(0, 8), 16) || 1);
  const a = [...teamIds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Randomly reassign captains to teams from a recorded seed (spec §2.4 — captains
 * are not bound to teams). The pool is the captains already entered per team;
 * this returns new team records with the captain name/photo drawn onto each team.
 */
export function assignCaptainsToTeams(teams: Team[], seed: string): Team[] {
  const pool = teams.map((t) => ({ captain: t.captain, captainBase64: t.captainBase64 }));
  const order = shuffleTeams(teams.map((_, i) => i), seed); // permutation of pool indices
  return teams.map((t, i) => ({ ...t, captain: pool[order[i]].captain, captainBase64: pool[order[i]].captainBase64 }));
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Draft-specific config validation: per-category picks must sum to squad size. */
export function validateDraftConfig(config: TournamentConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const squadSize = getSquadSize(config);
  const total = config.categories.reduce((s, c) => s + (c.draftCount ?? 0), 0);

  config.categories.forEach((c, i) => {
    if (!Number.isInteger(c.draftCount) || c.draftCount < 0) {
      errors.push({ field: `draftCount_${i}`, message: `${c.name}: picks per team must be a whole number ≥ 0.` });
    }
  });

  if (errors.length === 0 && total !== squadSize) {
    errors.push({
      field: 'draftCount',
      message: `Category picks per team add up to ${total}, but each squad drafts ${squadSize}. Adjust the per-category counts to match.`,
    });
  }
  return errors;
}

/** Per-category shortfalls: not enough players in the pool to fill every team's picks. */
export function getDraftReadiness(
  config: TournamentConfig,
  players: Player[],
): { category: Category; need: number; have: number }[] {
  const shortfalls: { category: Category; need: number; have: number }[] = [];
  for (const c of config.categories) {
    const need = config.totalTeams * (c.draftCount ?? 0);
    if (need === 0) continue;
    // Count only draftable players — matches getDraftAvailablePlayers, so a
    // non-pending stray (e.g. from a restored backup) can't satisfy the gate.
    const have = players.filter((p) => p.status === 'pending' && p.category === c.name).length;
    if (have < need) shortfalls.push({ category: c.name, need, have });
  }
  return shortfalls;
}

/** First case-insensitive duplicate in a list of names, or null. */
function firstDuplicate(names: string[]): string | null {
  const seen = new Set<string>();
  for (const raw of names) {
    const n = raw.trim().toLowerCase();
    if (n && seen.has(n)) return raw.trim();
    seen.add(n);
  }
  return null;
}

/**
 * What the captain draw (and order shuffle) actually needs: every franchise and
 * captain named + unique. Deliberately does NOT look at the player pool — the
 * draw is a pre-draft ceremony and must not be blocked by an unfinished roster;
 * the pool is gated later, at Start Draft (getDraftSetupErrors).
 */
export function getCaptainDrawErrors(teams: Team[]): string[] {
  const errors: string[] = [];

  if (teams.some((t) => !t.name.trim())) errors.push('Every franchise needs a name (Setup tab).');
  else { const d = firstDuplicate(teams.map((t) => t.name)); if (d) errors.push(`Duplicate team name: "${d}".`); }

  if (teams.some((t) => !t.captain.trim())) errors.push('Every captain needs a name (Setup tab).');
  else { const d = firstDuplicate(teams.map((t) => t.captain)); if (d) errors.push(`Duplicate captain name: "${d}".`); }

  return errors;
}

/**
 * Full roster validation before drafting may begin (spec §9, generic form):
 * the captain-draw checks plus player-name uniqueness and enough players per
 * category. Returns a clear, itemised list of failures (empty = ready).
 */
export function getDraftSetupErrors(
  config: TournamentConfig,
  teams: Team[],
  players: Player[],
): string[] {
  const errors = getCaptainDrawErrors(teams);

  const dupPlayer = firstDuplicate(players.map((p) => p.name));
  if (dupPlayer) errors.push(`Duplicate player name: "${dupPlayer}".`);

  for (const s of getDraftReadiness(config, players)) {
    errors.push(`Not enough ${s.category} players: ${s.have} of ${s.need} needed.`);
  }
  return errors;
}
