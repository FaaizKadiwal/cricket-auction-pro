import { useMemo, useState, useEffect, useRef } from 'react';
import type { TournamentConfig, Team, SoldPlayer } from '@/types';
import type { BiddingPayload } from '@/types/live';
import { CATEGORY_STYLE } from '@/constants/auction';
import { formatPts } from '@/utils/format';
import { getBidCap, getSquad, getSpent } from '@/utils/auction';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveBiddingScreen.module.css';

interface LiveBiddingScreenProps {
  bidding: BiddingPayload;
  teams: Team[];
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
}

export function LiveBiddingScreen({ bidding, teams, soldPlayers, config }: LiveBiddingScreenProps) {
  const { player, currentBid, leadingTeamId, log } = bidding;
  const catStyle = CATEGORY_STYLE[player.category];
  const leadingTeam = useMemo(() => teams.find((t) => t.id === leadingTeamId) ?? null, [teams, leadingTeamId]);
  const squadSize = config.playersPerTeam - 1;

  // Bid bump animation
  const [bump, setBump] = useState(false);
  useEffect(() => {
    setBump(true);
    const timer = setTimeout(() => setBump(false), 250);
    return () => clearTimeout(timer);
  }, [currentBid]);

  // ── Bid pop notification ──────────────────────────────────────────────────
  const [bidPop, setBidPop] = useState<{ teamName: string; teamColor: string; teamLogo: string | null; raise: number } | null>(null);
  const prevLogLen = useRef(0);

  useEffect(() => {
    if (log.length > prevLogLen.current && log.length > 0) {
      const latest = log[0];
      const prevBid = log.length > 1 ? log[1].bid : player.basePrice;
      const team = teams.find((t) => t.name === latest.teamName);
      setBidPop({ teamName: latest.teamName, teamColor: latest.teamColor, teamLogo: team?.logoBase64 ?? null, raise: latest.bid - prevBid });
      const timer = setTimeout(() => setBidPop(null), 3000);
      prevLogLen.current = log.length;
      return () => clearTimeout(timer);
    }
    prevLogLen.current = log.length;
  }, [log, player.basePrice, teams]);

  // Build per-team bid info from log (each team's latest bid + raise)
  const teamBidMap = useMemo(() => {
    const map = new Map<string, { lastBid: number; raise: number }>();
    for (let i = 0; i < log.length; i++) {
      const entry = log[i];
      if (!map.has(entry.teamName)) {
        const prevBid = i + 1 < log.length ? log[i + 1].bid : player.basePrice;
        map.set(entry.teamName, { lastBid: entry.bid, raise: entry.bid - prevBid });
      }
    }
    return map;
  }, [log, player.basePrice]);

  // Team budget data with cap warnings + bid info
  const teamBudgets = useMemo(() =>
    teams.map((team) => {
      const squad = getSquad(team.id, soldPlayers);
      const spent = getSpent(team.id, soldPlayers);
      const remaining = config.budget - spent;
      const slotsLeft = squadSize - squad.length;
      const { cap } = getBidCap(team.id, soldPlayers, config);
      const isLeading = team.id === leadingTeamId;
      const bidInfo = teamBidMap.get(team.name) ?? null;

      let capStatus: 'safe' | 'warn' | 'danger' = 'safe';
      if (cap <= 0 || slotsLeft <= 0) capStatus = 'danger';
      else if (cap < currentBid + 50) capStatus = 'warn';

      return { team, remaining, slotsLeft, cap, isLeading, capStatus, bidInfo };
    }),
    [teams, soldPlayers, config, squadSize, leadingTeamId, currentBid, teamBidMap],
  );

  return (
    <div className={styles.layout}>
      {/* ── LEFT: Player Card + Bid ── */}
      <div className={styles.leftPanel}>
        <div className={styles.playerCard}>
          {/* Category badge */}
          <div className={styles.categoryBadge} style={{ color: catStyle.color, background: catStyle.bg, borderColor: `${catStyle.color}40` }}>
            {player.category.toUpperCase()} CATEGORY
          </div>

          {/* Avatar with glow */}
          <div className={styles.avatarWrap}>
            <div className={styles.avatarGlow} style={{ '--glow-color': catStyle.color } as React.CSSProperties} aria-hidden="true" />
            <Avatar
              src={player.photoBase64}
              name={player.name}
              size={140}
              color={catStyle.color}
              className={styles.avatar}
              style={{ border: `4px solid ${catStyle.color}` }}
            />
          </div>

          {/* Player name */}
          <h2 className={styles.playerName}>{player.name}</h2>
          <p className={styles.basePrice}>Base Price: <span>{formatPts(player.basePrice)} pts</span></p>
        </div>

        {/* Bid panel */}
        <div className={styles.bidPanel}>
          <div className={styles.bidLabel}>CURRENT BID</div>
          <div
            className={`${styles.bidAmount} ${bump ? styles.bidBump : ''}`}
            style={{ color: leadingTeam?.color ?? 'var(--accent)' }}
          >
            {formatPts(currentBid)} <span className={styles.bidPts}>PTS</span>
          </div>

          {/* Leading team - prominent display */}
          {leadingTeam ? (
            <div className={styles.leadingTeam} style={{ '--lead-color': leadingTeam.color } as React.CSSProperties}>
              <Avatar src={leadingTeam.logoBase64} name={leadingTeam.name} size={52} color={leadingTeam.color} square />
              <div className={styles.leadingInfo}>
                <span className={styles.leadingLabel}>LEADING BID</span>
                <span className={styles.leadingTeamName} style={{ color: leadingTeam.color }}>
                  {leadingTeam.name}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.noBids}>Awaiting first bid...</div>
          )}
        </div>

      </div>

      {/* Bid pop notification — anchored bottom-center of left panel */}
      {bidPop && (
        <div
          className={styles.bidPop}
          key={log.length}
          style={{ '--pop-color': bidPop.teamColor } as React.CSSProperties}
        >
          <Avatar src={bidPop.teamLogo} name={bidPop.teamName} size={32} color={bidPop.teamColor} square />
          <span className={styles.bidPopName} style={{ color: bidPop.teamColor }}>{bidPop.teamName}</span>
          <span className={styles.bidPopText}>raised</span>
          <span className={styles.bidPopRaise}>+{formatPts(bidPop.raise)}</span>
        </div>
      )}

      {/* ── RIGHT: Team panels ── */}
      <div className={styles.rightPanel}>
        <div className={styles.teamsPanelTitle}>TEAMS</div>
        <div className={styles.teamsList}>
          {teamBudgets.map(({ team, remaining, slotsLeft, cap, isLeading, capStatus, bidInfo }) => (
            <div
              key={team.id}
              className={`${styles.teamRow} ${isLeading ? styles.teamRowLeading : ''} ${bidInfo && !isLeading ? styles.teamRowBid : ''}`}
              style={{ '--team-color': team.color } as React.CSSProperties}
            >
              <Avatar src={team.logoBase64} name={team.name} size={32} color={team.color} square />
              <div className={styles.teamInfo}>
                <span className={styles.teamName} style={{ color: isLeading ? team.color : bidInfo ? 'var(--text)' : 'var(--text-secondary)' }}>
                  {team.name || `Team ${team.id}`}
                </span>
                <span className={styles.teamBudget}>
                  {formatPts(remaining)} pts &middot; {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''}
                </span>
              </div>
              <div className={styles.teamEnd}>
                {bidInfo ? (
                  <div className={styles.bidInfoRow}>
                    <span className={styles.teamBidAmount} style={{ color: isLeading ? team.color : 'var(--accent)' }}>
                      {formatPts(bidInfo.lastBid)}
                    </span>
                    <span className={styles.teamBidRaise}>+{formatPts(bidInfo.raise)}</span>
                  </div>
                ) : (
                  capStatus === 'danger'
                    ? <span className={styles.capDanger}>CAPPED</span>
                    : capStatus === 'warn'
                      ? <span className={styles.capWarn}>{formatPts(cap)} max</span>
                      : null
                )}
                {isLeading && <span className={styles.leadBadge} style={{ color: team.color, borderColor: `${team.color}60` }}>LEADING</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
