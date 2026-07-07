import { describe, it, expect } from 'vitest';
import type { TournamentConfig, Team } from '@/types';
import {
  getRoundSchedule, generatePickOrder, getPickContext, getSlotFairness,
  getFairnessSpread, canUseBalancedGrid, shuffleTeams, assignCaptainsToTeams,
  getDraftTotalPicks, validateDraftConfig,
} from '@/utils/draft';
import { BALANCED_GRID } from '@/constants/draft';

/** Build a draft config: T teams, counts = picks/team per category. */
function cfg(T: number, counts: number[]): TournamentConfig {
  const squad = counts.reduce((a, b) => a + b, 0);
  return {
    tournamentName: 'T', mode: 'draft', totalTeams: T, playersPerTeam: squad + 1,
    budget: 0, minBidReserve: 0, logoBase64: null,
    categories: counts.map((n, i) => ({
      name: `C${i}`, color: '#ffffff', bgColor: '#000000', min: 0, max: 0, draftCount: n,
    })),
  };
}

describe('BALANCED_GRID structural invariants', () => {
  it('is 6 rows × 7 columns and every column is a permutation of 1..6', () => {
    expect(BALANCED_GRID).toHaveLength(6);
    for (const row of BALANCED_GRID) expect(row).toHaveLength(7);
    for (let c = 0; c < 7; c++) {
      const col = BALANCED_GRID.map((row) => row[c]).sort().join('');
      expect(col).toBe('123456');
    }
  });

  it('gives every slot Gold=7, Bronze=7, Silver 10/11, overall 24/25 (the proven fair totals)', () => {
    for (const row of BALANCED_GRID) {
      const gold = row[0] + row[1];
      const silver = row[2] + row[3] + row[4];
      const bronze = row[5] + row[6];
      expect(gold).toBe(7);
      expect(bronze).toBe(7);
      expect([10, 11]).toContain(silver);
      expect([24, 25]).toContain(gold + silver + bronze);
    }
  });
});

// [teams, per-category picks, expect the Balanced Grid?]
const BATTERY: [number, number[], boolean][] = [
  [6,  [2, 3, 2],    true ],  // the canonical Balanced Grid shape
  [6,  [3, 2, 2],    false],  // 6 teams but wrong round grouping → snake
  [6,  [2, 3, 2, 0], true ],  // zero-count extra category — grouping still 2-3-2
  [2,  [1, 1, 1],    false],
  [4,  [2, 2, 1],    false],
  [5,  [3, 2, 2],    false],
  [7,  [1, 2, 1],    false],
  [8,  [3, 3, 2],    false],
  [10, [2, 2, 2],    false],
  [12, [1, 3, 2],    false],
];

describe.each(BATTERY)('full draft simulation — %i teams, counts %j', (T, counts, expectGrid) => {
  const config = cfg(T, counts);
  const squad = counts.reduce((a, b) => a + b, 0);
  // Deterministic shuffled (non-identity) base order.
  const baseOrder = shuffleTeams(Array.from({ length: T }, (_, i) => i + 1), 'a1b2c3d4e5f60718');
  const schedule = getRoundSchedule(config);
  const pickOrder = generatePickOrder(config, baseOrder);
  const total = getDraftTotalPicks(config);

  it('validates and gates the Balanced Grid correctly', () => {
    expect(validateDraftConfig(config)).toHaveLength(0);
    expect(canUseBalancedGrid(config)).toBe(expectGrid);
    expect(schedule).toHaveLength(squad);
    expect(total).toBe(T * squad);
    expect(pickOrder).toHaveLength(squad);
  });

  it('gives every team exactly one pick per round', () => {
    const idSet = [...baseOrder].sort((a, b) => a - b).join(',');
    for (const round of pickOrder) {
      expect([...round].sort((a, b) => a - b).join(',')).toBe(idSet);
    }
  });

  it('walks pick-by-pick consistently and every team gets EXACTLY its per-category picks', () => {
    const perTeamCat = new Map<number, Record<string, number>>(baseOrder.map((id) => [id, {}]));
    for (let i = 0; i < total; i++) {
      const ctx = getPickContext(config, baseOrder, i);
      const r = Math.floor(i / T);
      expect(ctx.complete).toBe(false);
      expect(ctx.round).toBe(r + 1);
      expect(ctx.category).toBe(schedule[r]);
      expect(ctx.pickNumber).toBe(i + 1);
      expect(ctx.onClockTeamId).toBe(pickOrder[r][i % T]);
      const m = perTeamCat.get(ctx.onClockTeamId!)!;
      m[ctx.category] = (m[ctx.category] ?? 0) + 1;
    }
    expect(getPickContext(config, baseOrder, total).complete).toBe(true);

    for (const id of baseOrder) {
      const m = perTeamCat.get(id)!;
      counts.forEach((n, ci) => expect(m[`C${ci}`] ?? 0).toBe(n));
    }
  });

  it('reports fairness totals matching an independent recount, with the expected spread', () => {
    const fairness = getSlotFairness(config, baseOrder);
    const independent = new Map<number, number>(baseOrder.map((id) => [id, 0]));
    pickOrder.forEach((row) => row.forEach((id, idx) => independent.set(id, independent.get(id)! + idx + 1)));
    for (const f of fairness) expect(f.overall).toBe(independent.get(f.teamId));

    const spread = getFairnessSpread(fairness);
    if (expectGrid) {
      expect(spread).toBeLessThanOrEqual(1);
      for (const f of fairness) expect([24, 25]).toContain(f.overall);
    } else {
      // Snake theory: slot s totals (s+1) in odd rounds and (T-s) in even rounds,
      // so the spread is (T-1) for an odd round count and 0 for an even one.
      expect(spread).toBe(squad % 2 === 1 ? T - 1 : 0);
    }
  });
});

describe('shuffleTeams (seeded Fisher–Yates)', () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8];

  it('is deterministic for the same seed and a valid permutation', () => {
    const a = shuffleTeams(ids, 'deadbeef01234567');
    const b = shuffleTeams(ids, 'deadbeef01234567');
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(ids);
  });

  it('differs for a different seed and never mutates its input', () => {
    const a = shuffleTeams(ids, 'deadbeef01234567');
    const c = shuffleTeams(ids, '0badc0de87654321');
    expect(a).not.toEqual(c);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('assignCaptainsToTeams (seeded captain draw)', () => {
  const teams: Team[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => ({
    id: i + 1, name: `Team${n}`, captain: `Cap${n}`, color: '#123456',
    logoBase64: null, captainBase64: `img${n}`,
  }));

  it('is a reproducible bijection — every captain lands exactly once', () => {
    const r1 = assignCaptainsToTeams(teams, 'a1b2c3d4e5f60718');
    const r2 = assignCaptainsToTeams(teams, 'a1b2c3d4e5f60718');
    expect(r1).toEqual(r2);
    expect(r1.map((t) => t.captain).sort()).toEqual(teams.map((t) => t.captain).sort());
  });

  it('moves the photo WITH its captain and never touches franchise identity', () => {
    const r = assignCaptainsToTeams(teams, 'a1b2c3d4e5f60718');
    r.forEach((t, i) => {
      expect(t.captainBase64).toBe(`img${t.captain.slice(3)}`); // photo follows captain
      expect(t.id).toBe(teams[i].id);
      expect(t.name).toBe(teams[i].name);
      expect(t.color).toBe(teams[i].color);
    });
  });

  it('is roughly uniform across seeds (CapA lands on slot 1 ≈ 1/6 of the time)', () => {
    let hits = 0;
    const N = 3000;
    for (let s = 0; s < N; s++) {
      const seed = s.toString(16).padStart(8, '0') + '00000000';
      if (assignCaptainsToTeams(teams, seed)[0].captain === 'CapA') hits++;
    }
    const p = hits / N;
    expect(p).toBeGreaterThan(0.12);
    expect(p).toBeLessThan(0.21);
  });
});

describe('validateDraftConfig honesty', () => {
  it('rejects draftCounts that do not sum to the squad size', () => {
    const bad = cfg(6, [2, 3, 2]);
    bad.playersPerTeam = 9; // squad 8 ≠ 2+3+2
    expect(validateDraftConfig(bad).length).toBeGreaterThan(0);
  });

  it('rejects negative draftCounts', () => {
    const bad = cfg(4, [2, 2, 1]);
    bad.categories[0].draftCount = -1;
    expect(validateDraftConfig(bad).length).toBeGreaterThan(0);
  });
});
