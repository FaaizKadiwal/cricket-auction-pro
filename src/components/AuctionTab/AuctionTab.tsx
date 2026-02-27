import { useState, useMemo, useCallback } from 'react';
import type { Team, Player, SoldPlayer, Category, DemotionResult } from '@/types';
import type { BidIncrement } from '@/constants/auction';
import type { BroadcastHandle } from '@/hooks/useBroadcast';
import { getCategoryStyle, getActiveIncrement, MAX_LOG_ENTRIES } from '@/constants/auction';
import { getBidCap, getSquad, getSpent, getCatCount, validateBid } from '@/utils/auction';
import { formatPts, formatPct, getBarColorToken } from '@/utils/format';
import { useTournament } from '@/context/TournamentContext';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import { BidTeamPanel } from './BidTeamPanel';
import styles from './AuctionTab.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  teamName: string;
  teamColor: string;
  bid: number;
  player: string;
}

interface BidSnapshot {
  bid: number;
  teamId: number | null;
}

interface AuctionTabProps {
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  onSell: (player: Player, teamId: number, finalPrice: number) => void;
  onUnsold: (playerId: number) => DemotionResult;
  onUndoLastSale: () => SoldPlayer | null;
  onToast: (msg: string, type: 'ok' | 'warn') => void;
  broadcast?: BroadcastHandle;
}

// ─── AuctionTab ───────────────────────────────────────────────────────────────

export function AuctionTab({ teams, players, soldPlayers, onSell, onUnsold, onUndoLastSale, onToast, broadcast }: AuctionTabProps) {
  const { config, squadSize } = useTournament();

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBid,    setCurrentBid]    = useState(0);
  const [leadingTeamId, setLeadingTeamId] = useState<number | null>(null);
  const [filterCat,     setFilterCat]     = useState<Category | 'All'>('All');
  const [log,           setLog]           = useState<LogEntry[]>([]);
  const [bidHistory,    setBidHistory]    = useState<BidSnapshot[]>([]);

  const pending       = useMemo(() => players.filter((p) => p.status === 'pending'), [players]);
  const displayPending = useMemo(
    () => filterCat === 'All' ? pending : pending.filter((p) => p.category === filterCat),
    [pending, filterCat]
  );
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    config.categories.forEach((c) => { counts[c.name] = 0; });
    pending.forEach((p) => { counts[p.category] = (counts[p.category] ?? 0) + 1; });
    return counts;
  }, [pending, config.categories]);

  const totalSpent  = useMemo(() => soldPlayers.reduce((s, x) => s + x.finalPrice, 0), [soldPlayers]);
  const leadingTeam = useMemo(() => teams.find((t) => t.id === leadingTeamId) ?? null, [teams, leadingTeamId]);
  const unsold      = useMemo(() => players.filter((p) => p.status === 'unsold'), [players]);
  const totalSlots  = config.totalTeams * squadSize;

  const startBidding = useCallback((player: Player) => {
    setCurrentPlayer(player);
    setCurrentBid(player.basePrice);
    setLeadingTeamId(null);
    setLog([]);
    setBidHistory([]);
    broadcast?.broadcastBiddingStart(player, player.basePrice);
  }, [broadcast]);

  const handleBid = useCallback((teamId: number, increment: BidIncrement) => {
    if (!currentPlayer) return;
    const newBid = currentBid + increment;
    const team   = teams.find((t) => t.id === teamId);
    if (!team) return;
    const result = validateBid(teamId, soldPlayers, currentPlayer.category, newBid, config);
    if (!result.valid) {
      onToast(`${team.name}: ${result.reason}`, 'warn');
      return;
    }
    setBidHistory((prev) => [...prev, { bid: currentBid, teamId: leadingTeamId }]);
    setCurrentBid(newBid);
    setLeadingTeamId(teamId);
    setLog((prev) => [
      { teamName: team.name, teamColor: team.color, bid: newBid, player: currentPlayer.name },
      ...prev.slice(0, MAX_LOG_ENTRIES - 1),
    ]);
    broadcast?.broadcastBidUpdate(newBid, teamId, { teamName: team.name, teamColor: team.color, bid: newBid });
  }, [currentPlayer, currentBid, leadingTeamId, teams, soldPlayers, config, onToast, broadcast]);

  const handleBasePick = useCallback((teamId: number) => {
    if (!currentPlayer) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const result = validateBid(teamId, soldPlayers, currentPlayer.category, currentBid, config);
    if (!result.valid) {
      onToast(`${team.name}: ${result.reason}`, 'warn');
      return;
    }
    setBidHistory((prev) => [...prev, { bid: currentBid, teamId: leadingTeamId }]);
    setLeadingTeamId(teamId);
    setLog((prev) => [
      { teamName: team.name, teamColor: team.color, bid: currentBid, player: currentPlayer.name },
      ...prev.slice(0, MAX_LOG_ENTRIES - 1),
    ]);
    broadcast?.broadcastBidUpdate(currentBid, teamId, { teamName: team.name, teamColor: team.color, bid: currentBid });
  }, [currentPlayer, currentBid, leadingTeamId, teams, soldPlayers, config, onToast, broadcast]);

  const resetStage = useCallback(() => {
    setCurrentPlayer(null); setCurrentBid(0); setLeadingTeamId(null); setLog([]); setBidHistory([]);
    broadcast?.broadcastBiddingCancel();
  }, [broadcast]);

  const confirmSale = useCallback(() => {
    if (!currentPlayer || !leadingTeamId) { onToast('No bid placed yet.', 'warn'); return; }
    const team = teams.find((t) => t.id === leadingTeamId);
    if (!team) return;
    onSell(currentPlayer, leadingTeamId, currentBid);

    // Broadcast SOLD before resetStage (which broadcasts CANCEL)
    const soldPayload = {
      player: currentPlayer,
      teamId: leadingTeamId,
      teamName: team.name,
      teamColor: team.color,
      teamLogoBase64: team.logoBase64,
      finalPrice: currentBid,
    };
    const updatedSold = [...soldPlayers, { ...currentPlayer, status: 'sold' as const, teamId: leadingTeamId, teamName: team.name, teamColor: team.color, finalPrice: currentBid }];
    const updatedPlayers = players.map((p) => p.id === currentPlayer.id ? { ...p, status: 'sold' as const } : p);
    broadcast?.broadcastSold(soldPayload, updatedSold, updatedPlayers);

    onToast(`${currentPlayer.name} SOLD to ${team.name} for ${formatPts(currentBid)} pts!`, 'ok');
    // Reset stage without broadcasting cancel (sale broadcast takes priority)
    setCurrentPlayer(null); setCurrentBid(0); setLeadingTeamId(null); setLog([]); setBidHistory([]);
  }, [currentPlayer, leadingTeamId, currentBid, teams, soldPlayers, players, onSell, onToast, broadcast]);

  const markUnsold = useCallback(() => {
    if (!currentPlayer) return;
    const playerName = currentPlayer.name;
    const result = onUnsold(currentPlayer.id);
    if (result.demoted) {
      onToast(`${playerName} moved to ${result.newCategory} (Base: ${formatPts(result.newBasePrice!)} pts)`, 'warn');
    } else if (result.halvedInPlace) {
      onToast(`${playerName} base price halved to ${formatPts(result.newBasePrice!)} pts`, 'warn');
    } else {
      onToast(`${playerName} — UNSOLD`, 'warn');
    }
    // Broadcast unsold with locally computed updated players
    let updatedPlayers: Player[];
    if (result.demoted) {
      updatedPlayers = players.map((p) => p.id === currentPlayer.id ? { ...p, status: 'pending' as const, category: result.newCategory!, basePrice: result.newBasePrice! } : p);
    } else if (result.halvedInPlace) {
      updatedPlayers = players.map((p) => p.id === currentPlayer.id ? { ...p, status: 'pending' as const, basePrice: result.newBasePrice! } : p);
    } else {
      updatedPlayers = players.map((p) => p.id === currentPlayer.id ? { ...p, status: 'unsold' as const } : p);
    }
    broadcast?.broadcastUnsold(playerName, result.demoted, result.newCategory, updatedPlayers, result.halvedInPlace);
    // Reset stage without broadcasting cancel
    setCurrentPlayer(null); setCurrentBid(0); setLeadingTeamId(null); setLog([]); setBidHistory([]);
  }, [currentPlayer, players, onUnsold, onToast, broadcast]);

  const undoLastBid = useCallback(() => {
    if (bidHistory.length === 0) return;
    const prev = bidHistory[bidHistory.length - 1];
    setBidHistory((h) => h.slice(0, -1));
    setCurrentBid(prev.bid);
    setLeadingTeamId(prev.teamId);
    setLog((l) => l.slice(1));
  }, [bidHistory]);

  const restartBidding = useCallback(() => {
    if (!currentPlayer) return;
    setCurrentBid(currentPlayer.basePrice);
    setLeadingTeamId(null);
    setLog([]);
    setBidHistory([]);
    onToast(`Bidding restarted for ${currentPlayer.name}`, 'warn');
  }, [currentPlayer, onToast]);

  const handleUndoSale = useCallback(() => {
    const undone = onUndoLastSale();
    if (undone) {
      onToast(`Sale undone — ${undone.name} returned to pool`, 'warn');
      const updatedSold = soldPlayers.filter((s) => s.id !== undone.id);
      const updatedPlayers = players.map((p) => p.id === undone.id ? { ...p, status: 'pending' as const } : p);
      broadcast?.broadcastUndoSale(updatedSold, updatedPlayers);
    }
  }, [onUndoLastSale, onToast, soldPlayers, players, broadcast]);

  return (
    <main aria-label="Live auction">
      {/* Stats */}
      <div className={styles.statsBar} role="status" aria-live="polite">
        {config.categories.map((cat) => (
          <div key={cat.name} className={styles.statItem}>
            <span className={styles.statLabel} style={{ color: cat.color }}>{cat.name}</span>
            <span className={styles.statValue} style={{ color: cat.color }}>
              {catCounts[cat.name] ?? 0}
            </span>
          </div>
        ))}
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Sold</span>
          <span className={styles.statValue} style={{ color: 'var(--success)' }}>{soldPlayers.length}/{totalSlots}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Pts Spent</span>
          <span className={styles.statValue} style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)' }}>
            {formatPts(totalSpent)}
          </span>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── LEFT ── */}
        <div>
          {/* Auction Stage */}
          <section className={styles.stage} aria-label="Auction stage" aria-live="assertive">
            <div className={styles.stageGlow} aria-hidden="true" />

            {!currentPlayer && (
              <div className={styles.stageContent}>
                <div className={styles.emptyStage}>
                  <div className={styles.emptyIcon} aria-hidden="true"><Icon name="crosshair" size={40} /></div>
                  <p className={styles.emptyTitle}>Select a player to open bidding</p>
                  <p style={{ fontSize: 13 }}>{pending.length} player{pending.length !== 1 ? 's' : ''} remaining</p>
                  {soldPlayers.length > 0 && (
                    <button className={styles.btnUndoSale} onClick={handleUndoSale}>
                      <Icon name="undo" size={13} /> Undo Last Sale ({soldPlayers[soldPlayers.length - 1].name})
                    </button>
                  )}
                  {broadcast && (
                    <div className={styles.liveControls}>
                      <span className={styles.liveControlLabel}>Live Viewer:</span>
                      <button className={styles.btnLiveSquads} onClick={() => broadcast.broadcastShowSquads()} aria-label="Show squads on live viewer">
                        <Icon name="users" size={13} /> Show Squads
                      </button>
                      <button className={styles.btnLiveIdle} onClick={() => broadcast.broadcastShowIdle()} aria-label="Show tournament logo on live viewer">
                        <Icon name="monitor" size={13} /> Show Logo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentPlayer && (
              <div className={styles.stageContent}>
                {/* Player photo */}
                {(() => {
                  const catStyle = getCategoryStyle(config, currentPlayer.category);
                  return (
                    <>
                      <Avatar
                        src={currentPlayer.photoBase64}
                        name={currentPlayer.name}
                        size={96}
                        color={catStyle.color}
                        style={{
                          margin: '0 auto 12px',
                          border: `3px solid ${catStyle.color}`,
                        }}
                      />
                      <div
                        className={styles.playerCatLabel}
                        style={{
                          color:      catStyle.color,
                          background: catStyle.bg,
                          border:     `1px solid ${catStyle.color}40`,
                        }}
                      >
                        ◆ {currentPlayer.category.toUpperCase()} CATEGORY ◆
                      </div>

                      <h2 className={styles.playerName}>{currentPlayer.name}</h2>
                      {currentPlayer.description && (
                        <div className={styles.playerDescWrap} style={{ '--desc-color': catStyle.color } as React.CSSProperties}>
                          <span className={styles.playerDescQuote}>"</span>
                          <span className={styles.playerDescText}>{currentPlayer.description}</span>
                          <span className={styles.playerDescQuote}>"</span>
                        </div>
                      )}
                      <p className={styles.playerBase}>
                        Base Price: <span className={styles.playerBasePts}>{formatPts(currentPlayer.basePrice)} pts</span>
                      </p>
                    </>
                  );
                })()}

                {/* Current bid */}
                <div className={styles.bidDisplay}>
                  <div className={styles.bidLabel}>Current Bid</div>
                  <div className={styles.bidAmount} style={{ color: leadingTeam?.color ?? 'var(--accent)' }}>
                    {formatPts(currentBid)} pts
                  </div>
                  <div className={styles.bidLeader}>
                    {leadingTeam ? (
                      <>
                        <Avatar src={leadingTeam.logoBase64} name={leadingTeam.name} size={18} color={leadingTeam.color} square />
                        <span><Icon name="trophy" size={14} /> <strong>{leadingTeam.name}</strong></span>
                      </>
                    ) : (
                      <span>No bids yet</span>
                    )}
                  </div>
                </div>

                {/* Per-team panels */}
                <div className={styles.bidTeamsGrid}>
                  {teams.map((team) => (
                    <BidTeamPanel
                      key={team.id}
                      team={team}
                      soldPlayers={soldPlayers}
                      currentBid={currentBid}
                      currentCategory={currentPlayer.category}
                      leadingTeamId={leadingTeamId}
                      onBid={handleBid}
                      onBasePick={handleBasePick}
                    />
                  ))}
                </div>

                <div className={styles.actionArea}>
                  <div className={styles.actionRow}>
                    <button className={styles.btnSold} onClick={confirmSale} disabled={!leadingTeamId}>
                      <Icon name="gavel" size={14} /> SOLD{leadingTeam ? ` — ${leadingTeam.name}` : ''}
                    </button>
                    <button className={styles.btnUnsold} onClick={markUnsold}><Icon name="x-circle" size={14} /> Unsold</button>
                  </div>
                  <div className={styles.actionRowSecondary}>
                    <button className={styles.btnUndo} onClick={undoLastBid} disabled={bidHistory.length === 0}>
                      ↩ Undo Bid
                    </button>
                    <button className={styles.btnRestart} onClick={restartBidding}><Icon name="refresh" size={13} /> Restart</button>
                    <button className={styles.btnCancel} onClick={resetStage}>← Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Player pool */}
          <div className={styles.poolCard}>
            <div className={styles.poolHeader}>
              <div className={styles.poolTitle}>Player Pool</div>
              <div className={styles.filterRow} role="group" aria-label="Filter by category">
                {(['All', ...config.categories.map((c) => c.name)] as (Category | 'All')[]).map((cat) => {
                  const catStyle = cat === 'All' ? null : getCategoryStyle(config, cat);
                  return (
                    <button
                      key={cat}
                      className={styles.filterBtn}
                      onClick={() => setFilterCat(cat)}
                      aria-pressed={filterCat === cat}
                      style={{
                        background:  filterCat === cat ? 'var(--accent)' : 'var(--surface2)',
                        color:       filterCat === cat ? '#000' : catStyle?.color ?? 'var(--text)',
                        borderColor: filterCat === cat ? 'var(--accent)' : catStyle ? `${catStyle.color}60` : 'var(--border)',
                      }}
                    >{cat}</button>
                  );
                })}
              </div>
            </div>

            {displayPending.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                No pending players in this filter
              </p>
            ) : (
              <table className={styles.poolTable} aria-label="Available players">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Category</th>
                    <th scope="col">Base</th>
                    <th scope="col"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {displayPending.map((p) => {
                    const { color } = getCategoryStyle(config, p.category);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className={styles.playerInfoCell}>
                            <Avatar src={p.photoBase64} name={p.name} size={32} color={color} />
                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={styles.catBadgePill}
                            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                          >{p.category}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                          {formatPts(p.basePrice)}
                        </td>
                        <td>
                          <button
                            className={styles.openBidBtn}
                            disabled={!!currentPlayer}
                            onClick={() => startBidding(p)}
                            aria-label={`Open bidding for ${p.name}`}
                          ><Icon name="crosshair" size={12} /> Bid</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Log */}
          {log.length > 0 && (
            <div className={styles.logCard}>
              <div className={styles.poolTitle} style={{ fontSize: 15, marginBottom: 10 }}><Icon name="list" size={14} /> Bid Log</div>
              <div className={styles.logScroll} role="log" aria-live="polite">
                {log.map((e, i) => (
                  <div key={i} className={styles.logEntry}>
                    <span style={{ color: e.teamColor, fontWeight: 700 }}>{e.teamName}</span>
                    <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.player}</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatPts(e.bid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className={styles.sidebar} aria-label="Team budgets">
          <div className={styles.sidebarTitle}><Icon name="coins" size={14} /> Budgets &amp; Caps</div>

          {currentPlayer && (
            <div className={styles.capBanner} role="note">
              <Icon name="lock" size={12} /> Bid caps shown — teams must keep {config.minBidReserve} pts per remaining slot in reserve.
            </div>
          )}

          {teams.map((team) => {
            const squad      = getSquad(team.id, soldPlayers);
            const spent      = getSpent(team.id, soldPlayers);
            const remaining  = config.budget - spent;
            const used       = formatPct(spent, config.budget);
            const slotsLeft  = squadSize - squad.length;
            const isLeading  = team.id === leadingTeamId;
            const { cap, reserve, slotsAfterWin } = currentPlayer
              ? getBidCap(team.id, soldPlayers, config)
              : { cap: 0, reserve: 0, slotsAfterWin: 0 };

            const activeInc = currentPlayer ? getActiveIncrement(currentBid) : 0;
            const capCls = !currentPlayer ? ''
              : cap <= 0 ? styles.capDanger
              : cap < currentBid + activeInc ? styles.capWarn
              : styles.capSafe;

            return (
              <div
                key={team.id}
                className={`${styles.sbTeam} ${isLeading ? styles.sbTeamLeading : ''}`}
                style={{ borderLeftColor: isLeading ? team.color : 'var(--border)' }}
                aria-label={`${team.name}: ${formatPts(remaining)} pts remaining`}
              >
                {/* Team header with logo */}
                <div className={styles.sbTeamHeader}>
                  <Avatar src={team.logoBase64} name={team.name} size={36} color={team.color} square />
                  <div className={styles.sbTeamInfo}>
                    {isLeading && <div className={styles.sbLeadTag} style={{ color: team.color }}><Icon name="trophy" size={11} /> Leader</div>}
                    <div className={styles.sbTeamName} style={{ color: team.color }}>
                      {team.name || `Team ${team.id}`}
                    </div>
                    {team.captain && (
                      <div className={styles.sbCaptain} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Avatar src={team.captainBase64} name={team.captain} size={14} color={team.color} />
                        {team.captain}
                      </div>
                    )}
                  </div>
                </div>

                {/* Budget */}
                <div className={styles.sbBudgetRow}>
                  <div>
                    <div className={styles.sbPts} style={{ color: remaining < 300 ? 'var(--danger)' : 'var(--text)' }}>
                      {formatPts(remaining)} pts
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>remaining</div>
                  </div>
                  <div className={styles.sbSlots}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                      {squad.length}/{squadSize}
                    </div>
                    <div>{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left</div>
                  </div>
                </div>

                <div className={styles.progressWrap}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${used}%`, background: getBarColorToken(used) }}
                    role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={100}
                  />
                </div>

                {currentPlayer && (
                  <>
                    <div className={styles.capDetailRow}>
                      <span className={styles.capDetailLabel}><Icon name="lock" size={11} /> Max Bid</span>
                      <span className={`${styles.capPill} ${capCls}`}>
                        {cap <= 0 ? 'CAPPED OUT' : `${formatPts(cap)} pts`}
                      </span>
                    </div>
                    {slotsAfterWin > 0 && cap > 0 && (
                      <p className={styles.reserveNote}>
                        Reserve: {formatPts(reserve)} for {slotsAfterWin} pick{slotsAfterWin !== 1 ? 's' : ''}
                      </p>
                    )}
                  </>
                )}

                <div className={styles.catBadges}>
                  {config.categories.map((catDef) => {
                    const cnt = getCatCount(team.id, catDef.name, soldPlayers);
                    return (
                      <span
                        key={catDef.name}
                        className={styles.catBadge}
                        style={{
                          background: `${catDef.color}18`,
                          color: catDef.color,
                          border: `1px solid ${catDef.color}35`,
                        }}
                      >
                        {catDef.name[0]}: {cnt}{catDef.max > 0 ? `/${catDef.max}` : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {unsold.length > 0 && (
            <div className={styles.unsoldSection}>
              <p className={styles.unsoldTitle}>Unsold ({unsold.length})</p>
              {unsold.map((p) => (
                <span key={p.id} className={styles.unsoldChip}>
                  <span style={{ color: getCategoryStyle(config, p.category).color, fontSize: 10, fontWeight: 700 }}>
                    {p.category[0]}
                  </span>
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
