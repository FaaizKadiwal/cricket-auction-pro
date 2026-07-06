import { useMemo, useState } from 'react';
import type { Team, SoldPlayer, TournamentConfig, BidValidationResult } from '@/types';
import { getCategoryStyle, getSquadSize } from '@/constants/auction';
import { validateSaleEdit } from '@/utils/auction';
import { formatPts, teamLabel } from '@/utils/format';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import styles from './EditSaleDialog.module.css';

interface EditSaleDialogProps {
  sold: SoldPlayer;
  teams: Team[];
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
  /** Commit the correction. Returns the authoritative validation result. */
  onSubmit: (teamId: number, finalPrice: number) => BidValidationResult;
  /** Remove the sale and return the player to the pool for re-auction. */
  onReturnToPool: () => void;
  onClose: () => void;
}

export function EditSaleDialog({ sold, teams, soldPlayers, config, onSubmit, onReturnToPool, onClose }: EditSaleDialogProps) {
  const [teamId, setTeamId]     = useState<number>(sold.teamId);
  const [priceStr, setPriceStr] = useState<string>(String(sold.finalPrice));
  const [confirmReturn, setConfirmReturn] = useState(false);

  const price     = Number(priceStr);
  const catStyle  = getCategoryStyle(config, sold.category);
  const squadSize = getSquadSize(config);
  const targetTeam = teams.find((t) => t.id === teamId);

  // Live validation — same rule the commit uses, so the preview never lies.
  const validation = useMemo(
    () => validateSaleEdit(soldPlayers, sold.id, sold.category, teamId, price, config),
    [soldPlayers, sold.id, sold.category, teamId, price, config]
  );

  // Resulting squad size + remaining budget for the target team after the change.
  const preview = useMemo(() => {
    const others = soldPlayers.filter((s) => s.teamId === teamId && s.id !== sold.id);
    const otherSpend = others.reduce((sum, s) => sum + s.finalPrice, 0);
    const remainingAfter = config.budget - otherSpend - (Number.isFinite(price) ? price : 0);
    return { squadCount: others.length + 1, remainingAfter };
  }, [soldPlayers, teamId, sold.id, price, config.budget]);

  const unchanged = teamId === sold.teamId && price === sold.finalPrice;
  const canSave   = validation.valid && !unchanged;

  const handleSave = () => {
    if (!canSave) return;
    const result = onSubmit(teamId, price);
    if (result.valid) onClose();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Correct sale" onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}><Icon name="pencil" size={16} /> Correct Sale</div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        {/* Player being corrected */}
        <div className={styles.playerRow}>
          <Avatar src={sold.photoBase64} name={sold.name} size={44} color={catStyle.color} style={{ border: `2px solid ${catStyle.color}` }} />
          <div>
            <div className={styles.playerName}>{sold.name}</div>
            <span className={styles.catBadge} style={{ color: catStyle.color, background: catStyle.bg, border: `1px solid ${catStyle.color}40` }}>
              {sold.category}
            </span>
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Assign to team</span>
          <select className={styles.select} value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {teamLabel(t)}{t.id === sold.teamId ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Final price (pts)</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
          />
        </label>

        {confirmReturn ? (
          <div className={styles.returnArea}>
            <p className={styles.returnWarn}>
              <Icon name="alert-triangle" size={12} /> Remove this sale and send {sold.name} back to the pool for re-auction?
            </p>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmReturn(false)}>No, keep</button>
              <button className={styles.returnBtn} onClick={onReturnToPool}><Icon name="undo" size={13} /> Return to pool</button>
            </div>
          </div>
        ) : (
          <>
            {!validation.valid ? (
              <p className={styles.error} role="alert"><Icon name="alert-triangle" size={12} /> {validation.reason}</p>
            ) : (
              <p className={styles.preview}>
                {(targetTeam ? teamLabel(targetTeam) : `Team ${teamId}`)}: {preview.squadCount}/{squadSize} players · {formatPts(preview.remainingAfter)} pts left after
              </p>
            )}

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={!canSave}>
                <Icon name="save" size={14} /> Save Correction
              </button>
            </div>

            <button className={styles.returnLink} onClick={() => setConfirmReturn(true)}>
              <Icon name="undo" size={12} /> Return to pool (re-auction)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
