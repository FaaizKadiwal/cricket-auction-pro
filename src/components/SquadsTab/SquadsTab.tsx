import { useCallback, useMemo, useState, memo } from 'react';
import type { Team, SoldPlayer, BidValidationResult } from '@/types';
import { getCategoryStyle, getMode } from '@/constants/auction';
import { getSquad, getSpent, getCategoryNeeds } from '@/utils/auction';
import { formatPts, teamLabel } from '@/utils/format';
import { useTournament } from '@/context/TournamentContext';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import { CategoryPills } from '@/components/CategoryPills/CategoryPills';
import { EditSaleDialog } from './EditSaleDialog';
import styles from './SquadsTab.module.css';

// ─── TeamSquadCard ────────────────────────────────────────────────────────────

interface TeamSquadCardProps {
  team: Team;
  soldPlayers: SoldPlayer[];
  onEditPlayer: (sold: SoldPlayer) => void;
}

const TeamSquadCard = memo(function TeamSquadCard({ team, soldPlayers, onEditPlayer }: TeamSquadCardProps) {
  const { config, squadSize } = useTournament();

  const isDraft = getMode(config) === 'draft';
  const squad   = useMemo(() => getSquad(team.id, soldPlayers), [team.id, soldPlayers]);
  const spent   = useMemo(() => getSpent(team.id, soldPlayers), [team.id, soldPlayers]);
  const remain  = config.budget - spent;
  const needs   = useMemo(() => getCategoryNeeds(team.id, soldPlayers, config), [team.id, soldPlayers, config]);

  // +1 for captain
  const total      = squad.length + 1;
  const isComplete = squad.length >= squadSize;
  const slotsLeft  = squadSize - squad.length;
  const totalNeed  = needs.reduce((sum, n) => sum + n.need, 0);
  const needsImpossible = totalNeed > slotsLeft;

  return (
    <article
      className={styles.card}
      aria-label={`${teamLabel(team)} squad`}
      style={{ borderTop: `3px solid ${team.color}` }}
    >
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.teamMeta}>
          {/* Team logo */}
          <Avatar
            src={team.logoBase64}
            name={team.name}
            size={52}
            color={team.color}
            square
          />

          <div className={styles.teamText}>
            <div className={styles.teamName} style={{ color: team.color }}>
              {teamLabel(team)}
            </div>

            {/* Captain row */}
            <div className={styles.captainRow}>
              <Avatar
                src={team.captainBase64}
                name={team.captain}
                size={20}
                color={team.color}
              />
              <span className={styles.captainName}>{team.captain || '—'}</span>
              <span className={styles.captainTag}>★ CPT</span>
            </div>
          </div>
        </div>

        {/* Size badge */}
        <div className={styles.sizeBadge}>
          <div
            className={styles.sizeNum}
            style={{ color: isComplete ? 'var(--success)' : 'var(--warning)' }}
          >
            {total}/{config.playersPerTeam}
          </div>
          <div className={styles.sizeLabel}>players</div>
        </div>
      </div>

      {/* Player list */}
      <div className={styles.playerList}>
        {/* Captain row (always shown) */}
        <div className={`${styles.playerRow} ${styles.captainPlayerRow}`}>
          <div className={styles.playerLeft}>
            <Avatar
              src={team.captainBase64}
              name={team.captain}
              size={28}
              color={team.color}
            />
            <span className={styles.playerNameText}>{team.captain || '—'}</span>
            <span className={styles.captainTag}>★</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Captain</span>
        </div>

        {squad.length === 0 ? (
          <div className={styles.emptyNote}>No players acquired yet</div>
        ) : (
          squad.map((p) => {
            const { color } = getCategoryStyle(config, p.category);
            return (
              <div key={p.id} className={styles.playerRow}>
                <div className={styles.playerLeft}>
                  <Avatar
                    src={p.photoBase64}
                    name={p.name}
                    size={28}
                    color={color}
                  />
                  <div className={styles.catPip} style={{ background: color }} aria-hidden="true" />
                  <span className={styles.playerNameText}>{p.name}</span>
                </div>
                <div className={styles.playerRight}>
                  {!isDraft && <span className={styles.playerPrice}>{formatPts(p.finalPrice)}</span>}
                  {/* Draft picks are positional/scheduled — correct them with Undo on the
                      draft board, not by reassigning here (which would break the schedule). */}
                  {!isDraft && (
                    <button
                      className={styles.editSaleBtn}
                      onClick={() => onEditPlayer(p)}
                      aria-label={`Correct sale for ${p.name}`}
                      title="Reassign team / fix price"
                    ><Icon name="pencil" size={12} /></button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        {!isDraft && (
          <div className={styles.footerStat}>
            <span className={styles.footerLabel}>Spent</span>
            <span className={styles.footerValue} style={{ color: 'var(--danger)' }}>
              {formatPts(spent)}
            </span>
          </div>
        )}
        {!isDraft && (
          <div className={styles.footerStat}>
            <span className={styles.footerLabel}>Remaining</span>
            <span className={styles.footerValue} style={{ color: 'var(--success)' }}>
              {formatPts(remain)}
            </span>
          </div>
        )}

        {/* Category breakdown */}
        <div className={styles.catRow}>
          <CategoryPills teamId={team.id} soldPlayers={soldPlayers} config={config} />
        </div>

        {needs.length > 0 && (
          <div className={`${styles.needsRow} ${needsImpossible ? styles.needsImpossible : ''}`} role="status">
            <Icon name="alert-triangle" size={11} />
            <span>
              Needs {needs.map((n) => `${n.need} ${n.category}`).join(', ')}
              {needsImpossible ? ' — not enough slots left' : ''}
            </span>
          </div>
        )}
      </div>
    </article>
  );
});

// ─── SquadsTab ────────────────────────────────────────────────────────────────

interface SquadsTabProps {
  teams: Team[];
  soldPlayers: SoldPlayer[];
  onEditSale: (playerId: number, newTeamId: number, newFinalPrice: number) => BidValidationResult;
  onReturnToPool: (playerId: number) => void;
  onToast: (msg: string, type: 'ok' | 'warn') => void;
}

export function SquadsTab({ teams, soldPlayers, onEditSale, onReturnToPool, onToast }: SquadsTabProps) {
  const { config } = useTournament();
  const isDraft = getMode(config) === 'draft';
  const [editingSale, setEditingSale] = useState<SoldPlayer | null>(null);

  const handleEditPlayer = useCallback((sold: SoldPlayer) => setEditingSale(sold), []);

  const handleReturnToPool = useCallback(() => {
    if (!editingSale) return;
    onReturnToPool(editingSale.id);
    onToast(`${editingSale.name} returned to the pool for ${isDraft ? 're-draft' : 're-auction'}`, 'warn');
    setEditingSale(null);
  }, [editingSale, onReturnToPool, onToast, isDraft]);

  const handleSubmitEdit = useCallback(
    (teamId: number, price: number): BidValidationResult => {
      if (!editingSale) return { valid: false };
      const result = onEditSale(editingSale.id, teamId, price);
      if (result.valid) {
        const team = teams.find((t) => t.id === teamId);
        const dest = team ? teamLabel(team) : `Team ${teamId}`;
        onToast(isDraft ? `${editingSale.name} reassigned to ${dest}` : `${editingSale.name} → ${dest} for ${formatPts(price)} pts`, 'ok');
      } else if (result.reason) {
        onToast(result.reason, 'warn');
      }
      return result;
    },
    [editingSale, onEditSale, onToast, teams, isDraft]
  );

  return (
    <main className={styles.page} aria-label="Final squads overview">
      <h1 className={styles.pageTitle}>Final Squads</h1>
      <p className={styles.pageSubtitle}>
        Complete roster{isDraft ? '' : ' and budget'} overview for all {config.totalTeams} teams
      </p>
      <div className={styles.grid}>
        {teams.map((team) => (
          <TeamSquadCard key={team.id} team={team} soldPlayers={soldPlayers} onEditPlayer={handleEditPlayer} />
        ))}
      </div>

      {editingSale && (
        <EditSaleDialog
          sold={editingSale}
          teams={teams}
          soldPlayers={soldPlayers}
          config={config}
          onSubmit={handleSubmitEdit}
          onReturnToPool={handleReturnToPool}
          onClose={() => setEditingSale(null)}
        />
      )}
    </main>
  );
}
