import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface Player {
  id: string;
  name: string;
  gender?: 'male' | 'female';
  skillLevel?: 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  ageGroup?: '10s' | '20s' | '30s' | '40s' | '50s' | '60s+';
  status: 'active' | 'resting'; // active: 게임 가능, resting: 휴식중
  pinned?: boolean; // true: 무조건 포함, false/undefined: 일반
}

export interface GameRecord {
  id: string;
  players: [string, string, string, string];
  confirmedAt: string;
}

const PLAYERS_KEY = 'game-manager-players';
const GAMES_KEY = 'game-manager-games';

// 기존 데이터 형식 (teamA/teamB)
interface LegacyGameRecord {
  id: string;
  teamA: [string, string];
  teamB: [string, string];
  confirmedAt: string;
}

type RawGameRecord = GameRecord | LegacyGameRecord;

function isLegacyGameRecord(game: RawGameRecord): game is LegacyGameRecord {
  return 'teamA' in game && 'teamB' in game && !('players' in game);
}

// 기존 데이터를 새 형식으로 마이그레이션
function migrateOldGameRecords(games: RawGameRecord[]): GameRecord[] {
  return games.map((game) => {
    if (isLegacyGameRecord(game)) {
      return {
        id: game.id,
        players: [game.teamA[0], game.teamA[1], game.teamB[0], game.teamB[1]] as [string, string, string, string],
        confirmedAt: game.confirmedAt,
      };
    }
    return game;
  });
}

export function useGameManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedPlayers = localStorage.getItem(PLAYERS_KEY);
      const storedGames = localStorage.getItem(GAMES_KEY);

      if (storedPlayers) {
        setPlayers(JSON.parse(storedPlayers));
      }
      if (storedGames) {
        const parsed = JSON.parse(storedGames) as RawGameRecord[];
        const migrated = migrateOldGameRecords(parsed);
        setGames(migrated);
      }
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
      toast.error('저장된 데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save players to localStorage
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
      } catch (error) {
        console.error('Failed to save players:', error);
        toast.error('선수 데이터 저장에 실패했습니다');
      }
    }
  }, [players, isLoading]);

  // Save games to localStorage
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(GAMES_KEY, JSON.stringify(games));
      } catch (error) {
        console.error('Failed to save games:', error);
        toast.error('게임 데이터 저장에 실패했습니다');
      }
    }
  }, [games, isLoading]);

  const addPlayer = useCallback((playerData: Omit<Player, 'id' | 'status'>) => {
    const newPlayer: Player = {
      ...playerData,
      id: crypto.randomUUID(),
      status: 'active',
    };
    setPlayers((prev) => [...prev, newPlayer]);
  }, []);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePlayer = useCallback((id: string, updates: Partial<Omit<Player, 'id'>>) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const addGame = useCallback((gameData: Omit<GameRecord, 'id' | 'confirmedAt'>) => {
    const newGame: GameRecord = {
      ...gameData,
      id: crypto.randomUUID(),
      confirmedAt: new Date().toISOString(),
    };
    setGames((prev) => [...prev, newGame]);
  }, []);

  const removeGame = useCallback((id: string) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const resetPlayers = useCallback(() => {
    setPlayers([]);
  }, []);

  const resetGames = useCallback(() => {
    setGames([]);
  }, []);

  return {
    players,
    games,
    addPlayer,
    removePlayer,
    updatePlayer,
    addGame,
    removeGame,
    resetPlayers,
    resetGames,
    isLoading,
  };
}
