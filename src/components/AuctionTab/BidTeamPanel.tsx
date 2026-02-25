import type { Team, SoldPlayer, Category } from '@/types';
import type { BidIncrement } from '@/constants/auction';
import { BID_INCREMENTS } from '@/constants/auction';
import { getBidCap, getSquad, getCatCount } from '@/utils/auction';
import { formatPts } from '@/utils/format';
import { Avatar } from '@/components/Avatar/Avatar';
import { useTournament } from '@/context/TournamentContext';
import styles from './BidTeamPanel.module.css';

interface BidTeamPanelProps {
  team: Team;
  soldPlayers: SoldPlayer[];
  currentBid: number;
  currentCategory: Category;
  leadingTeamId: number | null;
  onBid: (teamId: number, increment: BidIncrement) => void;
}

export function BidTeamPanel({
  team, soldPlayers, currentBid, currentCategory, leadingTeamId, onBid,
}: BidTeamPanelProps) {
  const { config } = useTournament();
  const squadSize  = config.playersPerTeam - 1;
  const squad      = getSquad(team.id, soldPlayers);
  const { cap }    = getBidCap(team.id, soldPlayers, config);
  const slotsLeft  = squadSize - squad.length;
  const isLeading  = team.id === leadingTeamId;

  const isFull    = squad.length >= squadSize;
  const catMax    = config.categoryLimits[currentCategory]?.max ?? 0;
  const isCatFull = catMax > 0 && getCatCount(team.id, currentCategory, soldPlayers) >= catMax;
  const isBlocked = isFull || isCatFull || cap <= 0;

  let blockReason = '';
  if (isFull) blockReason = 'SQUAD FULL';
  else if (isCatFull) blockReason = `${currentCategory} LIMIT`;
  else if (cap <= 0) blockReason = 'NO BUDGET';

  function capClass() {
    if (cap < currentBid + BID_INCREMENTS[0]) return styles.capDanger;
    if (cap < currentBid + 100) return styles.capWarn;
    return styles.capSafe;
  }

  return (
    <div
      className={`${styles.panel} ${isLeading ? styles.panelLeading : ''} ${isBlocked ? styles.panelBlocked : ''}`}
      style={{ '--lead-color': team.color } as React.CSSProperties}
      aria-label={`${team.name} bid panel`}
    >
      {/* Header */}
      <div className={styles.header}>
        <Avatar src={team.logoBase64} name={team.name} size={28} color={team.color} square />
        <div className={styles.nameBlock}>
          {isLeading && <div className={styles.leadTag} style={{ color: team.color }}>🏆 Leading</div>}
          <div className={styles.teamName} style={{ color: team.color }}>
            {team.name || `Team ${team.id}`}
          </div>
        </div>
      </div>

      {/* Bid cap */}
      <div className={styles.capRow}>
        {isBlocked ? (
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{blockReason}</span>
        ) : (
          <>
            <span style={{ color: 'var(--muted)' }}>🔒 </span>
            <span className={`${styles.capValue} ${capClass()}`}>{formatPts(cap)}</span>
            <span style={{ color: 'var(--muted)', fontSize: 9 }}> pts · {slotsLeft}sl</span>
          </>
        )}
      </div>

      {/* Increment buttons */}
      <div className={styles.btnRow} role="group" aria-label={`Bid for ${team.name}`}>
        {BID_INCREMENTS.map((inc) => {
          const nextBid  = currentBid + inc;
          const overCap  = nextBid > cap;
          const disabled = isBlocked || overCap;
          return (
            <button
              key={inc}
              className={styles.incBtn}
              disabled={disabled}
              onClick={() => onBid(team.id, inc)}
              aria-label={`+${inc} pts`}
              style={{
                borderColor: disabled ? 'var(--border)' : team.color,
                color:       disabled ? 'var(--muted)'  : team.color,
              }}
            >+{inc}</button>
          );
        })}
      </div>
    </div>
  );
}
