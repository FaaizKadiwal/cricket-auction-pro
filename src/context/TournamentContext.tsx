import { createContext, useContext, type ReactNode } from 'react';
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
  return (
    <TournamentContext.Provider
      value={{ config, squadSize: getSquadSize(config) }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTournament(): TournamentContextValue {
  return useContext(TournamentContext);
}
