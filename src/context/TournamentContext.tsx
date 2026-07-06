import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TournamentConfig } from '@/types';
import { DEFAULT_CONFIG, getSquadSize } from '@/constants/auction';

// ─── Context Shape ────────────────────────────────────────────────────────────

interface TournamentContextValue {
  config: TournamentConfig;
  squadSize: number; // computed: config.playersPerTeam - 1
}

const TournamentContext = createContext<TournamentContextValue>({
  config: DEFAULT_CONFIG,
  squadSize: DEFAULT_CONFIG.playersPerTeam - 1,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface TournamentProviderProps {
  config: TournamentConfig;
  children: ReactNode;
}

export function TournamentProvider({ config, children }: TournamentProviderProps) {
  // Memoize so consumers only re-render when config actually changes, not on
  // every parent (App) re-render during the auction loop.
  const value = useMemo(
    () => ({ config, squadSize: getSquadSize(config) }),
    [config]
  );
  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useTournament(): TournamentContextValue {
  return useContext(TournamentContext);
}
