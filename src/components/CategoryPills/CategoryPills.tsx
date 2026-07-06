import type { SoldPlayer, TournamentConfig } from '@/types';
import { getCatCount } from '@/utils/auction';
import { getMode } from '@/constants/auction';
import { withAlpha } from '@/utils/color';
import styles from './CategoryPills.module.css';

interface CategoryPillsProps {
  teamId: number;
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
}

/**
 * Per-team category tally pills — "{initial}: {count}/{target}" — coloured by
 * category. The target is the auction per-team `max` or, in draft mode, the
 * exact `draftCount`. Shared by the auction sidebar, squads, and live squad view.
 */
export function CategoryPills({ teamId, soldPlayers, config }: CategoryPillsProps) {
  const isDraft = getMode(config) === 'draft';
  return (
    <>
      {config.categories.map((cat) => {
        const count = getCatCount(teamId, cat.name, soldPlayers);
        const target = isDraft ? cat.draftCount : cat.max;
        return (
          <span
            key={cat.name}
            className={styles.pill}
            style={{
              background: withAlpha(cat.color, 0.09),
              color: cat.color,
              border: `1px solid ${withAlpha(cat.color, 0.22)}`,
            }}
          >
            {cat.name[0]}: {count}{target > 0 ? `/${target}` : ''}
          </span>
        );
      })}
    </>
  );
}
