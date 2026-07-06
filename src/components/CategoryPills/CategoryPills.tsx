import type { SoldPlayer, TournamentConfig } from '@/types';
import { getCatCount } from '@/utils/auction';
import { withAlpha } from '@/utils/color';
import styles from './CategoryPills.module.css';

interface CategoryPillsProps {
  teamId: number;
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
}

/**
 * Per-team category tally pills — "{initial}: {count}/{max}" — coloured by
 * category. Shared by the auction sidebar, the squads view, and the live squad
 * view so the badge looks identical everywhere.
 */
export function CategoryPills({ teamId, soldPlayers, config }: CategoryPillsProps) {
  return (
    <>
      {config.categories.map((cat) => {
        const count = getCatCount(teamId, cat.name, soldPlayers);
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
            {cat.name[0]}: {count}{cat.max > 0 ? `/${cat.max}` : ''}
          </span>
        );
      })}
    </>
  );
}
