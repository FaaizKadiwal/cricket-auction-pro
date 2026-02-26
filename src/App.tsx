import { useCallback } from 'react';
import type { TabId, Team, Player, SoldPlayer, TournamentConfig, DemotionResult } from '@/types';
import { DEFAULT_TEAM_COLORS, STORAGE_KEYS, DEFAULT_CATEGORIES } from '@/constants/auction';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useBroadcast } from '@/hooks/useBroadcast';
import { TournamentProvider } from '@/context/TournamentContext';
import { ConfigScreen } from '@/components/ConfigScreen/ConfigScreen';
import { Header } from '@/components/Header/Header';
import { ToastContainer } from '@/components/Toast/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SetupTab } from '@/components/SetupTab/SetupTab';
import { AuctionTab } from '@/components/AuctionTab/AuctionTab';
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

// ─── Layout styles ────────────────────────────────────────────────────────────

const appStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 1440,
  width: '100%',
  margin: '0 auto',
  padding: '24px',
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Persisted State ────────────────────────────────────────────────────────
  // null config means the wizard hasn't been completed yet
  const [config,      setConfig]      = useLocalStorage<TournamentConfig | null>(STORAGE_KEYS.CONFIG, null);
  const [activeTab,   setActiveTab]   = useLocalStorage<TabId>(STORAGE_KEYS.ACTIVE_TAB, 'setup');
  const [teams,       setTeams]       = useLocalStorage<Team[]>(STORAGE_KEYS.TEAMS, []);
  const [players,     setPlayers]     = useLocalStorage<Player[]>(STORAGE_KEYS.PLAYERS, []);
  const [soldPlayers, setSoldPlayers] = useLocalStorage<SoldPlayer[]>(STORAGE_KEYS.SOLD_PLAYERS, []);

  const { toasts, showToast, dismissToast } = useToast(5000);

  // Live viewer broadcast (only active when config exists)
  const broadcast = useBroadcast({
    config: config ?? { tournamentName: '', totalTeams: 0, playersPerTeam: 0, budget: 0, minBidReserve: 0, categories: DEFAULT_CATEGORIES, logoBase64: null },
    teams,
    players,
    soldPlayers,
  });

  // ── Config Wizard ──────────────────────────────────────────────────────────

  const handleLaunch = useCallback(
    (newConfig: TournamentConfig) => {
      setConfig(newConfig);
      setTeams(buildTeams(newConfig.totalTeams));
      setPlayers([]);
      setSoldPlayers([]);
      setActiveTab('setup');
    },
    [setConfig, setTeams, setPlayers, setSoldPlayers, setActiveTab]
  );

  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      'Reset the entire tournament? All teams, players, and auction progress will be cleared.'
    );
    if (!confirmed) return;
    setConfig(null);
    setTeams([]);
    setPlayers([]);
    setSoldPlayers([]);
    setActiveTab('setup');
  }, [setConfig, setTeams, setPlayers, setSoldPlayers, setActiveTab]);

  // ── Data Handlers ──────────────────────────────────────────────────────────

  const handleTeamsChange = useCallback(
    (updated: Team[]) => setTeams(updated),
    [setTeams]
  );

  const handlePlayersChange = useCallback(
    (updated: Player[]) => setPlayers(updated),
    [setPlayers]
  );

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
          : config.minBidReserve;

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

  // ── Render ─────────────────────────────────────────────────────────────────

  // Step 1: config wizard not yet completed
  if (!config) {
    return (
      <>
        <ConfigScreen onLaunch={handleLaunch} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Step 2: full app shell
  return (
    <TournamentProvider config={config}>
      <div style={appStyle}>
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          soldPlayers={soldPlayers}
          onReset={handleReset}
        />

        <main style={mainStyle} id="main-content">
          {activeTab === 'setup' && (
            <ErrorBoundary fallbackLabel="Setup Tab">
              <SetupTab
                teams={teams}
                onTeamsChange={handleTeamsChange}
                players={players}
                onPlayersChange={handlePlayersChange}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'auction' && (
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

          {activeTab === 'squads' && (
            <ErrorBoundary fallbackLabel="Squads Tab">
              <SquadsTab teams={teams} soldPlayers={soldPlayers} />
            </ErrorBoundary>
          )}

          {activeTab === 'rules' && (
            <ErrorBoundary fallbackLabel="Rules Tab">
              <RulesTab />
            </ErrorBoundary>
          )}
        </main>

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </TournamentProvider>
  );
}
