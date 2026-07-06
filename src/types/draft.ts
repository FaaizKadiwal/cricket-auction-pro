import type { Category } from '@/types';

// ─── Draft State Machine ──────────────────────────────────────────────────────

/**
 * Draft phases (one-way, per spec §5.1). `captains` = randomly assign captains
 * to teams; `order` = shuffle/confirm the base team order; `preview` = review the
 * schedule + fairness; `drafting` = the pick loop; `finalized` = complete + locked.
 */
export type DraftPhase = 'captains' | 'order' | 'preview' | 'drafting' | 'finalized';

/** Persisted draft-specific state (the rest derives from soldPlayers + config). */
export interface DraftState {
  phase: DraftPhase;
  baseOrder: number[];   // teamIds in slot order S1..Sn (the random input)
  seed: string;          // recorded seed (hex) for the base-order shuffle
  captainSeed: string;   // recorded seed for the captain→team draw — both auditable
}

// ─── Derived Draft Views ──────────────────────────────────────────────────────

/** Context of the pick currently on the clock (or the completed state). */
export interface PickContext {
  pickNumber: number;            // 1-based overall pick (1..totalPicks)
  round: number;                 // 1-based round
  category: Category;            // category this round draws from
  onClockTeamId: number | null;  // team on the clock, or null when the draft is complete
  positionInRound: number;       // 1-based position within the round
  totalPicks: number;
  complete: boolean;
}

/** Per-slot pick-position totals — the basis of the fairness summary/preview. */
export interface SlotFairness {
  teamId: number;
  perCategory: Record<string, number>; // Σ of pick positions in each category
  overall: number;                     // Σ across all rounds
}
