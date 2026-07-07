import { useCallback, useEffect, useRef, useState } from 'react';
import type { TabId, Team, Player, SoldPlayer, TournamentConfig, DemotionResult, BidValidationResult } from '@/types';
import type { DraftState } from '@/types/draft';
import { DEFAULT_TEAM_COLORS, STORAGE_KEYS, getMode } from '@/constants/auction';
import { validateSaleEdit } from '@/utils/auction';
import { buildBackup, parseBackup, type BackupData } from '@/utils/backup';
import { downloadFile } from '@/utils/export';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useBroadcast } from '@/hooks/useBroadcast';
import { TournamentProvider } from '@/context/TournamentContext';
import { ConfigScreen } from '@/components/ConfigScreen/ConfigScreen';
import { Header } from '@/components/Header/Header';
import { ToastContainer } from '@/components/Toast/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import styles from '@/App.module.css';
import { SetupTab } from '@/components/SetupTab/SetupTab';
import { AuctionTab } from '@/components/AuctionTab/AuctionTab';
import { DraftTab } from '@/components/DraftTab/DraftTab';
import { SquadsTab } from '@/components/SquadsTab/SquadsTab';
import { RulesTab } from '@/components/RulesTab/RulesTab';

// ─── Build blank teams from config ───────────────────────────────────────────

function buildTeams(totalTeams: number): Team[] {
  return Array.from({ length: totalTeams }, (_, i) => ({
    id:             i + 1,
    name:           '',
    captain:        '',
    color:          DEFAULT_TEAM_COLORS[i % DEFAULT_TEAM_COLORS.length],
    logoBase64:     null,
    captainBase64:  null,
  }));
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Persisted State ────────────────────────────────────────────────────────
  // null config means the wizard hasn't been completed yet
  const [config,      setConfig]      = useLocalStorage<TournamentConfig | null>(STORAGE_KEYS.CONFIG, null);
  const [activeTab,   setActiveTab]   = useLocalStorage<TabId>(STORAGE_KEYS.ACTIVE_TAB, 'setup');
  const [teams,       setTeams]       = useLocalStorage<Team[]>(STORAGE_KEYS.TEAMS, []);
  const [players,     setPlayers]     = useLocalStorage<Player[]>(STORAGE_KEYS.PLAYERS, []);
  const [soldPlayers, setSoldPlayers] = useLocalStorage<SoldPlayer[]>(STORAGE_KEYS.SOLD_PLAYERS, []);
  const [draftState,  setDraftState]  = useLocalStorage<DraftState | null>(STORAGE_KEYS.DRAFT, null);

  const mode = config ? getMode(config) : 'auction';

  const { toasts, exitingIds, showToast, dismissToast } = useToast(5000);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);

  // Warn the operator if a localStorage write fails (throttled — a burst of
  // failing writes across keys should surface a single warning, not a flood).
  const lastStorageWarnRef = useRef(0);
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastStorageWarnRef.current < 8000) return;
      lastStorageWarnRef.current = now;
      showToast('Storage is full — recent changes may not be saved. Remove some images or reset the tournament to free space.', 'warn');
    };
    window.addEventListener('cap:storage-error', handler);
    return () => window.removeEventListener('cap:storage-error', handler);
  }, [showToast]);

  // Live viewer broadcast (only responds to sync when config exists)
  const broadcast = useBroadcast({ config, teams, players, soldPlayers, draftState });

  // Keep SoldPlayer.teamName / teamColor in sync when teams are edited
  useEffect(() => {
    if (soldPlayers.length === 0 || teams.length === 0) return;
    const needsSync = soldPlayers.some((sp) => {
      const team = teams.find((t) => t.id === sp.teamId);
      return team && (team.name !== sp.teamName || team.color !== sp.teamColor);
    });
    if (!needsSync) return;
    setSoldPlayers((prev) =>
      prev.map((sp) => {
        const team = teams.find((t) => t.id === sp.teamId);
        return team && (team.name !== sp.teamName || team.color !== sp.teamColor)
          ? { ...sp, teamName: team.name, teamColor: team.color }
          : sp;
      })
    );
  }, [teams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the middle tab consistent with the mode (draft ↔ auction), e.g. after
  // switching format or loading a legacy tab id.
  useEffect(() => {
    if (!config) return;
    if (mode === 'draft' && activeTab === 'auction') setActiveTab('draft');
    else if (mode === 'auction' && activeTab === 'draft') setActiveTab('auction');
  }, [mode, activeTab, config, setActiveTab]);

  // ── Config Wizard ──────────────────────────────────────────────────────────

  const handleLaunch = useCallback(
    (newConfig: TournamentConfig) => {
      const newTeams = buildTeams(newConfig.totalTeams);
      setConfig(newConfig);
      setTeams(newTeams);
      setPlayers([]);
      setSoldPlayers([]);
      setActiveTab('setup');
      // Seed the draft state for draft tournaments (starts at the captain draw).
      setDraftState(
        newConfig.mode === 'draft'
          ? { phase: 'captains', baseOrder: newTeams.map((t) => t.id), seed: '', captainSeed: '' }
          : null
      );
    },
    [setConfig, setTeams, setPlayers, setSoldPlayers, setActiveTab, setDraftState]
  );

  const confirmReset = useCallback(() => {
    setConfirmingReset(false);
    setConfig(null);
    setTeams([]);
    setPlayers([]);
    setSoldPlayers([]);
    setDraftState(null);
    setActiveTab('setup');
  }, [setConfig, setTeams, setPlayers, setSoldPlayers, setDraftState, setActiveTab]);

  // ── Backup / Restore (spec §2.19) ────────────────────────────────────────────

  const handleExportBackup = useCallback(() => {
    if (!config) return;
    const json = buildBackup({ config, teams, players, soldPlayers, draftState, exportedAt: new Date().toISOString() });
    const base = (config.tournamentName || 'tournament').replace(/[^\w-]+/g, '_') || 'tournament';
    downloadFile(`${base}_backup.json`, json, 'application/json');
    showToast('Backup exported.', 'ok');
  }, [config, teams, players, soldPlayers, draftState, showToast]);

  const handleImportBackup = useCallback((text: string) => {
    const result = parseBackup(text);
    if (!result.ok) { showToast(result.error, 'warn'); return; }
    setPendingBackup(result.data); // require explicit confirmation before overwriting (§2.19.2)
  }, [showToast]);

  const applyBackup = useCallback(() => {
    if (!pendingBackup) return;
    const d = pendingBackup;
    setConfig(d.config);
    setTeams(d.teams);
    setPlayers(d.players);
    setSoldPlayers(d.soldPlayers);
    setDraftState(d.draftState);
    setActiveTab('setup');
    setPendingBackup(null);
    showToast('Backup restored.', 'ok');
  }, [pendingBackup, setConfig, setTeams, setPlayers, setSoldPlayers, setDraftState, setActiveTab, showToast]);

  const handleConfigSave = useCallback(
    (newConfig: TournamentConfig) => {
      if (!config) return;

      // Propagate category name renames to players (match by slot index).
      // A rename is only counted when the old name has genuinely disappeared
      // from the new list — otherwise a pure reorder (which keeps every name,
      // just in a different order) would be misread as a rename and corrupt
      // player categories.
      const oldCats = config.categories;
      const newCats = newConfig.categories;
      const newCatNames = new Set(newCats.map((c) => c.name));
      let updatedPlayers = players;
      let updatedSoldPlayers = soldPlayers;

      oldCats.forEach((oldCat, i) => {
        const newCat = newCats[i];
        if (newCat && oldCat.name !== newCat.name && !newCatNames.has(oldCat.name)) {
          updatedPlayers = updatedPlayers.map((p) =>
            p.category === oldCat.name ? { ...p, category: newCat.name } : p
          );
          updatedSoldPlayers = updatedSoldPlayers.map((sp) =>
            sp.category === oldCat.name ? { ...sp, category: newCat.name } : sp
          );
        }
      });

      // Adjust teams array if totalTeams changed
      let updatedTeams = teams;
      if (newConfig.totalTeams > config.totalTeams) {
        const extras = buildTeams(newConfig.totalTeams).slice(config.totalTeams);
        updatedTeams = [...updatedTeams, ...extras];
      } else if (newConfig.totalTeams < config.totalTeams) {
        updatedTeams = updatedTeams.slice(0, newConfig.totalTeams);
        // Safety net: the wizard locks team count once players are sold, but if
        // teams are removed we must not leave sold records (or players marked
        // sold) pointing at a team that no longer exists.
        const validTeamIds = new Set(updatedTeams.map((t) => t.id));
        const orphanedIds = new Set(
          updatedSoldPlayers.filter((sp) => !validTeamIds.has(sp.teamId)).map((sp) => sp.id)
        );
        if (orphanedIds.size > 0) {
          updatedSoldPlayers = updatedSoldPlayers.filter((sp) => validTeamIds.has(sp.teamId));
          updatedPlayers = updatedPlayers.map((p) =>
            orphanedIds.has(p.id) ? { ...p, status: 'pending' as const } : p
          );
        }
      }

      setConfig(newConfig);
      setTeams(updatedTeams);
      setPlayers(updatedPlayers);
      setSoldPlayers(updatedSoldPlayers);

      // Keep draft state consistent with the (possibly changed) mode / team count.
      // Structural fields lock once players are acquired, so re-seeding here only
      // ever happens before any picks — no draft progress is lost.
      if (newConfig.mode === 'draft') {
        if (!draftState || draftState.baseOrder.length !== updatedTeams.length) {
          setDraftState({ phase: 'captains', baseOrder: updatedTeams.map((t) => t.id), seed: '', captainSeed: '' });
        }
      } else if (draftState) {
        setDraftState(null);
      }

      setShowConfigEditor(false);
    },
    [config, players, soldPlayers, teams, draftState, setConfig, setTeams, setPlayers, setSoldPlayers, setDraftState]
  );

  // ── Data Handlers ──────────────────────────────────────────────────────────

  /**
   * Called when a player is confirmed SOLD.
   * Appends a SoldPlayer entry and marks the player status in the pool.
   */
  const handleSell = useCallback(
    (player: Player, teamId: number, finalPrice: number) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const soldEntry: SoldPlayer = {
        ...player,
        status:    'sold',
        teamId,
        teamName:  team.name,
        teamColor: team.color,
        finalPrice,
        soldAt:    new Date().toISOString(),
      };

      setSoldPlayers((prev) => [...prev, soldEntry]);
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, status: 'sold' } : p))
      );
    },
    [teams, setSoldPlayers, setPlayers]
  );

  const handleUnsold = useCallback(
    (playerId: number): DemotionResult => {
      const player = players.find((p) => p.id === playerId);
      if (!player || !config) return { demoted: false };

      const categories = config.categories;
      const catIndex = categories.findIndex((c) => c.name === player.category);
      const isLowestTier = catIndex === -1 || catIndex >= categories.length - 1;

      if (!isLowestTier) {
        // Demote to next lower tier
        const lowerCat = categories[catIndex + 1].name;
        const lowerCatPlayers = players.filter((p) => p.category === lowerCat && p.id !== playerId);
        const newBasePrice = lowerCatPlayers.length > 0
          ? Math.min(...lowerCatPlayers.map((p) => p.basePrice))
          : Math.max(1, config.minBidReserve);

        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId
              ? { ...p, status: 'pending' as const, category: lowerCat, basePrice: newBasePrice }
              : p
          )
        );
        return { demoted: true, newCategory: lowerCat, newBasePrice };
      }

      // Lowest tier: halve base price, keep pending in same category
      const halvedPrice = Math.max(1, Math.floor(player.basePrice / 2));
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, status: 'pending' as const, basePrice: halvedPrice }
            : p
        )
      );
      return { demoted: false, halvedInPlace: true, newBasePrice: halvedPrice };
    },
    [players, config, setPlayers]
  );

  const handleUndoLastSale = useCallback(
    (): SoldPlayer | null => {
      const current = soldPlayers;
      if (current.length === 0) return null;

      const lastSold = current[current.length - 1];
      setSoldPlayers((prev) => prev.slice(0, -1));
      setPlayers((prev) =>
        prev.map((p) => (p.id === lastSold.id ? { ...p, status: 'pending' as const } : p))
      );
      return lastSold;
    },
    [soldPlayers, setSoldPlayers, setPlayers]
  );

  /**
   * Correct an already-completed sale — reassign the player to the right team
   * and/or fix the final price. Because every squad, budget and category total
   * is derived from `soldPlayers`, updating the one record recalculates both the
   * old and new team's figures everywhere automatically. Returns a validation
   * result so the caller can surface a reason on failure.
   */
  const handleEditSale = useCallback(
    (playerId: number, newTeamId: number, newFinalPrice: number): BidValidationResult => {
      if (!config) return { valid: false, reason: 'No tournament configured.' };
      const sold = soldPlayers.find((s) => s.id === playerId);
      if (!sold) return { valid: false, reason: 'Sale not found.' };
      const team = teams.find((t) => t.id === newTeamId);
      if (!team) return { valid: false, reason: 'Team not found.' };

      const result = validateSaleEdit(soldPlayers, playerId, sold.category, newTeamId, newFinalPrice, config);
      if (!result.valid) return result;

      setSoldPlayers((prev) =>
        prev.map((s) =>
          s.id === playerId
            ? { ...s, teamId: newTeamId, teamName: team.name, teamColor: team.color, finalPrice: newFinalPrice }
            : s
        )
      );
      return { valid: true };
    },
    [config, soldPlayers, teams, setSoldPlayers]
  );

  /**
   * Send a specific sold player back to the pool for re-auction — removes the
   * sale (refunding the team) and returns the player to 'pending'. Unlike Undo
   * Last Sale this works for any sale, not just the most recent.
   */
  const handleReturnToPool = useCallback(
    (playerId: number) => {
      setSoldPlayers((prev) => prev.filter((s) => s.id !== playerId));
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, status: 'pending' as const } : p))
      );
    },
    [setSoldPlayers, setPlayers]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  // Step 1: config wizard not yet completed
  if (!config) {
    return (
      <>
        <ConfigScreen onLaunch={handleLaunch} />
        <ToastContainer toasts={toasts} exitingIds={exitingIds} onDismiss={dismissToast} />
      </>
    );
  }

  // Step 2: full app shell
  return (
    <TournamentProvider config={config}>
      <div className={styles.app}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          soldPlayers={soldPlayers}
          onReset={() => setConfirmingReset(true)}
          onEditConfig={() => setShowConfigEditor(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />

        <main className={styles.main} id="main-content">
          {activeTab === 'setup' && (
            <ErrorBoundary fallbackLabel="Setup Tab">
              <SetupTab
                teams={teams}
                onTeamsChange={setTeams}
                players={players}
                onPlayersChange={setPlayers}
                onToast={showToast}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'auction' && mode === 'auction' && (
            <ErrorBoundary fallbackLabel="Auction Tab">
              <AuctionTab
                teams={teams}
                players={players}
                soldPlayers={soldPlayers}
                onSell={handleSell}
                onUnsold={handleUnsold}
                onUndoLastSale={handleUndoLastSale}
                onToast={showToast}
                broadcast={broadcast}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'draft' && mode === 'draft' && draftState && (
            <ErrorBoundary fallbackLabel="Draft Tab">
              <DraftTab
                teams={teams}
                players={players}
                soldPlayers={soldPlayers}
                draftState={draftState}
                onDraftStateChange={setDraftState}
                onTeamsChange={setTeams}
                onPick={handleSell}
                onUndoPick={handleUndoLastSale}
                onToast={showToast}
                broadcast={broadcast}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'squads' && (
            <ErrorBoundary fallbackLabel="Squads Tab">
              <SquadsTab teams={teams} soldPlayers={soldPlayers} onEditSale={handleEditSale} onReturnToPool={handleReturnToPool} onToast={showToast} />
            </ErrorBoundary>
          )}

          {activeTab === 'rules' && (
            <ErrorBoundary fallbackLabel="Rules Tab">
              <RulesTab />
            </ErrorBoundary>
          )}
        </main>

        <ToastContainer toasts={toasts} exitingIds={exitingIds} onDismiss={dismissToast} />
      </div>

      {showConfigEditor && (
        <ConfigScreen
          mode="edit"
          initialConfig={config}
          onLaunch={handleLaunch}
          onSave={handleConfigSave}
          onCancel={() => setShowConfigEditor(false)}
          hasSoldPlayers={soldPlayers.length > 0}
          existingPlayers={players}
        />
      )}

      {confirmingReset && (
        <ConfirmDialog
          title="Reset entire tournament?"
          message="This permanently clears all teams, players, and auction progress and returns to the setup wizard. This cannot be undone."
          confirmLabel="Reset everything"
          tone="danger"
          onConfirm={confirmReset}
          onCancel={() => setConfirmingReset(false)}
        />
      )}

      {pendingBackup && (
        <ConfirmDialog
          title="Restore this backup?"
          message={`This replaces the current tournament with the backup "${pendingBackup.config.tournamentName || 'Untitled'}" (${pendingBackup.teams.length} teams, ${pendingBackup.players.length} players). Your current data will be overwritten.`}
          confirmLabel="Restore backup"
          tone="danger"
          onConfirm={applyBackup}
          onCancel={() => setPendingBackup(null)}
        />
      )}
    </TournamentProvider>
  );
}
