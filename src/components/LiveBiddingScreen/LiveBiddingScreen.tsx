import { useMemo, useState, useEffect, useRef } from 'react';
import type { TournamentConfig, Team, SoldPlayer } from '@/types';
import type { BiddingPayload } from '@/types/live';
import { getCategoryStyle, getActiveIncrement } from '@/constants/auction';
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
  const catStyle = getCategoryStyle(config, player.category);
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

  // Build per-team bid info from log (each team's latest bid + raise + log position)
  const teamBidMap = useMemo(() => {
    const map = new Map<string, { lastBid: number; raise: number; logIndex: number }>();
    for (let i = 0; i < log.length; i++) {
      const entry = log[i];
      if (!map.has(entry.teamName)) {
        const prevBid = i + 1 < log.length ? log[i + 1].bid : player.basePrice;
        map.set(entry.teamName, { lastBid: entry.bid, raise: entry.bid - prevBid, logIndex: i });
      }
    }
    return map;
  }, [log, player.basePrice]);

  // Team budget data with cap warnings + bid info, sorted by activity
  const teamBudgets = useMemo(() => {
    const list = teams.map((team) => {
      const squad = getSquad(team.id, soldPlayers);
      const spent = getSpent(team.id, soldPlayers);
      const remaining = config.budget - spent;
      const slotsLeft = squadSize - squad.length;
      const { cap } = getBidCap(team.id, soldPlayers, config);
      const isLeading = team.id === leadingTeamId;
      const bidInfo = teamBidMap.get(team.name) ?? null;

      const activeInc = getActiveIncrement(currentBid);
      let capStatus: 'safe' | 'warn' | 'danger' = 'safe';
      if (cap <= 0 || slotsLeft <= 0) capStatus = 'danger';
      else if (cap < currentBid + activeInc) capStatus = 'warn';

      return { team, remaining, slotsLeft, cap, isLeading, capStatus, bidInfo };
    });

    // Sort: leading first, then by most recent bid (lowest logIndex), then non-bidders
    list.sort((a, b) => {
      if (a.isLeading) return -1;
      if (b.isLeading) return 1;
      const aIdx = a.bidInfo?.logIndex ?? Infinity;
      const bIdx = b.bidInfo?.logIndex ?? Infinity;
      return aIdx - bIdx;
    });

    return list;
  }, [teams, soldPlayers, config, squadSize, leadingTeamId, currentBid, teamBidMap]);

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
          {bidPop.raise === 0 ? (
            <>
              <span className={styles.bidPopText}>matched</span>
              <span className={styles.bidPopBase}>BASE PRICE</span>
            </>
          ) : (
            <>
              <span className={styles.bidPopText}>raised</span>
              <span className={styles.bidPopRaise}>+{formatPts(bidPop.raise)}</span>
            </>
          )}
        </div>
      )}

      {/* ── RIGHT: Team panels ── */}
      <div className={styles.rightPanel}>
        <div className={styles.teamsPanelTitle}>TEAMS</div>
        <div className={styles.teamsList}>
          {teamBudgets.map(({ team, remaining, slotsLeft, cap, isLeading, capStatus, bidInfo }) => {
            const capPct = cap > 0 ? Math.min(100, Math.round((cap / config.budget) * 100)) : 0;
            return (
              <div
                key={team.id}
                className={`${styles.teamCard} ${isLeading ? styles.teamCardLeading : ''} ${bidInfo && !isLeading ? styles.teamCardBid : ''} ${capStatus === 'danger' ? styles.teamCardCapped : ''}`}
                style={{ '--team-color': team.color } as React.CSSProperties}
              >
                {/* Card header: logo + name + leading badge */}
                <div className={styles.cardHeader}>
                  <Avatar src={team.logoBase64} name={team.name} size={44} color={team.color} square />
                  <div className={styles.cardNameBlock}>
                    <span className={styles.cardTeamName} style={{ color: isLeading ? team.color : 'var(--text)' }}>
                      {team.name || `Team ${team.id}`}
                    </span>
                    {isLeading && (
                      <span className={styles.leadBadge} style={{ color: team.color, borderColor: `${team.color}60` }}>LEADING</span>
                    )}
                  </div>
                  {/* Bid amount (right side) */}
                  {bidInfo && (
                    <div className={styles.cardBidEnd}>
                      <span className={styles.cardBidAmount} style={{ color: isLeading ? team.color : 'var(--accent)' }}>
                        {formatPts(bidInfo.lastBid)}
                      </span>
                      <span className={bidInfo.raise === 0 ? styles.cardBidBase : styles.cardBidRaise}>
                        {bidInfo.raise === 0 ? 'BASE' : `+${formatPts(bidInfo.raise)}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats row: budget, slots, cap */}
                <div className={styles.cardStats}>
                  <div className={styles.cardStat}>
                    <span className={styles.cardStatLabel}>BUDGET</span>
                    <span className={styles.cardStatValue}>{formatPts(remaining)}</span>
                  </div>
                  <div className={styles.cardStatDivider} />
                  <div className={styles.cardStat}>
                    <span className={styles.cardStatLabel}>SLOTS</span>
                    <span className={styles.cardStatValue}>{slotsLeft}</span>
                  </div>
                  <div className={styles.cardStatDivider} />
                  <div className={styles.cardStat}>
                    <span className={styles.cardStatLabel}>MAX BID</span>
                    <span className={`${styles.cardStatValue} ${styles[`teamCap${capStatus.charAt(0).toUpperCase()}${capStatus.slice(1)}`]}`}>
                      {cap <= 0 ? 'NIL' : formatPts(cap)}
                    </span>
                  </div>
                </div>

                {/* Cap bar */}
                <div className={styles.capBarWrap}>
                  <div
                    className={`${styles.capBar} ${styles[`capBar${capStatus.charAt(0).toUpperCase()}${capStatus.slice(1)}`]}`}
                    style={{ width: `${capPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
