import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { reportError } from '@/lib/monitoring';

export interface Player {
  id: string;
  name: string;
  gender?: 'male' | 'female';
  skillLevel?: 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  ageGroup?: '10s' | '20s' | '30s' | '40s' | '50s' | '60s+';
  status: 'active' | 'resting' | 'playing' | 'queued';
  pinned?: boolean;
  attending?: boolean;
  waitingSince?: string | null;
  participantType?: 'user' | 'guest';
  // 실시간 보드의 게스트 참가자에게만 의미가 있다(guest_participants.is_one_time).
  isOneTime?: boolean;
}

export interface GameRecord {
  id: string;
  players: [string, string, string, string];
  confirmedAt: string;
}

export interface Court {
  id: string;
  name: string;
  playerIds: [string, string, string, string] | null;
  gameStartedAt: string | null;
  gameId?: string | null;
  prevWaiting?: Record<string, string | null>;
}

export interface QueueItem {
  id: string;
  playerIds: [string, string, string, string];
  queuedAt: string;
}

export type AssignResult = { ok: true } | { ok: false; busyNames: string[] };

const PLAYERS_KEY = 'game-manager-players';
const GAMES_KEY = 'game-manager-games';
const COURTS_KEY = 'game-manager-courts';
const QUEUE_KEY = 'game-manager-queue';

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

// 기존 선수 데이터에 attending/waitingSince 누락 시 기본값 보정
function migratePlayers(players: Player[]): Player[] {
  const nowIso = new Date().toISOString();
  return players.map((p) => {
    const attending = p.attending === undefined ? true : p.attending;
    let waitingSince = p.waitingSince ?? null;
    if (p.status === 'active' && !waitingSince) {
      waitingSince = nowIso;
    }
    if (p.status !== 'active') {
      waitingSince = null;
    }
    return { ...p, attending, waitingSince };
  });
}

export function useGameManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedPlayers = localStorage.getItem(PLAYERS_KEY);
      const storedGames = localStorage.getItem(GAMES_KEY);
      const storedCourts = localStorage.getItem(COURTS_KEY);
      const storedQueue = localStorage.getItem(QUEUE_KEY);

      if (storedPlayers) {
        const parsed = JSON.parse(storedPlayers) as Player[];
        setPlayers(migratePlayers(parsed));
      }
      if (storedGames) {
        const parsed = JSON.parse(storedGames) as RawGameRecord[];
        setGames(migrateOldGameRecords(parsed));
      }
      if (storedCourts) {
        setCourts(JSON.parse(storedCourts));
      }
      if (storedQueue) {
        setQueue(JSON.parse(storedQueue));
      }
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
      // 저장 실패는 상태가 바뀔 때마다 나므로(용량 초과 등) 보고하지 않고, 손상된 데이터 로드 실패만 보고한다.
      reportError('게임 매니저 로컬 데이터 로드에 실패했습니다', error);
      toast.error('저장된 데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(COURTS_KEY, JSON.stringify(courts));
      } catch (error) {
        console.error('Failed to save courts:', error);
        toast.error('코트 데이터 저장에 실패했습니다');
      }
    }
  }, [courts, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      } catch (error) {
        console.error('Failed to save queue:', error);
        toast.error('대기열 저장에 실패했습니다');
      }
    }
  }, [queue, isLoading]);

  const addPlayer = useCallback((playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => {
    // 등록하는 사람은 지금 와 있는 사람이므로 바로 참석+대기로 넣는다(setAttending(id, true)와 같은 값).
    const newPlayer: Player = {
      ...playerData,
      id: crypto.randomUUID(),
      status: 'active',
      attending: true,
      waitingSince: new Date().toISOString(),
    };
    setPlayers((prev) => [...prev, newPlayer]);
  }, []);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePlayer = useCallback((id: string, updates: Partial<Omit<Player, 'id'>>) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const setAttending = useCallback((id: string, attending: boolean) => {
    const nowIso = new Date().toISOString();
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (attending) {
          if (p.status === 'playing' || p.status === 'queued') {
            return { ...p, attending: true };
          }
          return { ...p, attending: true, status: 'active', waitingSince: nowIso };
        }
        return { ...p, attending: false, status: 'resting', pinned: false, waitingSince: null };
      }),
    );
  }, []);

  const setAttendingBulk = useCallback((attendingIds: string[]) => {
    const nowIso = new Date().toISOString();
    const attendingSet = new Set(attendingIds);
    setPlayers((prev) =>
      prev.map((p) => {
        // 게임중이거나 대기열에 있는 선수는 참석 상태를 변경하지 않는다 (코트/큐 데이터 불일치 방지)
        if (p.status === 'playing' || p.status === 'queued') {
          return p;
        }
        const shouldAttend = attendingSet.has(p.id);
        if (shouldAttend === (p.attending === true)) {
          return p;
        }
        if (shouldAttend) {
          return { ...p, attending: true, status: 'active', waitingSince: nowIso };
        }
        return { ...p, attending: false, status: 'resting', pinned: false, waitingSince: null };
      }),
    );
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
    // 선수를 모두 지우면 큐/코트 배정이 삭제된 선수 id를 참조하므로 함께 정리
    setQueue([]);
    setCourts((prev) =>
      prev.map((c) => ({ ...c, playerIds: null, gameStartedAt: null, gameId: null, prevWaiting: undefined })),
    );
  }, []);

  const resetGames = useCallback(() => {
    setGames([]);
  }, []);

  const resetWaitingTimes = useCallback(() => {
    const nowIso = new Date().toISOString();
    setPlayers((prev) => prev.map((p) => (p.status === 'active' ? { ...p, waitingSince: nowIso } : p)));
  }, []);

  const addCourt = useCallback((name: string) => {
    const newCourt: Court = {
      id: crypto.randomUUID(),
      name,
      playerIds: null,
      gameStartedAt: null,
      gameId: null,
    };
    setCourts((prev) => [...prev, newCourt]);
  }, []);

  const removeCourt = useCallback((id: string) => {
    setCourts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameCourt = useCallback((id: string, name: string) => {
    setCourts((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  // 게임중인 선수도 다음 대기 게임 하나에는 넣을 수 있다(코트 1 + 대기 1).
  // 이미 대기 게임에 있는 선수가 끼면 거부한다. 게임중인 선수는 playing을 유지한다(우선순위 playing > queued).
  const enqueueGame = useCallback(
    (playerIds: [string, string, string, string]): boolean => {
      const queuedIds = new Set(queue.flatMap((q) => q.playerIds));
      if (playerIds.some((id) => queuedIds.has(id))) return false;
      const playingIds = new Set(courts.flatMap((c) => c.playerIds ?? []));
      const newItem: QueueItem = {
        id: crypto.randomUUID(),
        playerIds,
        queuedAt: new Date().toISOString(),
      };
      setQueue((prev) => [...prev, newItem]);
      setPlayers((prev) =>
        prev.map((p) => {
          if (!playerIds.includes(p.id)) return p;
          if (playingIds.has(p.id)) return { ...p, pinned: false };
          return { ...p, status: 'queued' as const, pinned: false };
        }),
      );
      return true;
    },
    [queue, courts],
  );

  const removeFromQueue = useCallback(
    (queueItemId: string) => {
      const item = queue.find((q) => q.id === queueItemId);
      if (!item) return;
      const playerIds = item.playerIds;
      setQueue((prev) => prev.filter((q) => q.id !== queueItemId));
      // 대기열 취소는 실제 게임을 뛴 게 아니므로 waitingSince를 유지한다(대기 시간 이어서 누적).
      const playingIds = new Set(courts.flatMap((c) => c.playerIds ?? []));
      // 아직 코트에서 게임중인 선수는 playing 그대로 둔다.
      setPlayers((prev) =>
        prev.map((p) => (playerIds.includes(p.id) && !playingIds.has(p.id) ? { ...p, status: 'active' as const } : p)),
      );
    },
    [queue, courts],
  );

  const assignQueueToCourt = useCallback(
    (queueItemId: string, courtId: string): AssignResult => {
      const item = queue.find((q) => q.id === queueItemId);
      if (!item) return { ok: false, busyNames: [] };
      const playerIds = item.playerIds;
      // 멤버 중 아직 다른 코트에서 게임중인 선수가 있으면 배정하지 않는다(한 사람이 코트 두 곳에 서는 것 방지).
      const playingIds = new Set(courts.flatMap((c) => c.playerIds ?? []));
      const busyNames = players.filter((p) => playerIds.includes(p.id) && playingIds.has(p.id)).map((p) => p.name);
      if (busyNames.length > 0) return { ok: false, busyNames };
      const nowIso = new Date().toISOString();
      const gameId = crypto.randomUUID();

      const prevWaiting: Record<string, string | null> = {};
      players.forEach((p) => {
        if (playerIds.includes(p.id)) {
          prevWaiting[p.id] = p.waitingSince ?? null;
        }
      });

      setQueue((prev) => prev.filter((q) => q.id !== queueItemId));
      setCourts((prev) =>
        prev.map((c) => (c.id === courtId ? { ...c, playerIds, gameStartedAt: nowIso, gameId, prevWaiting } : c)),
      );
      setPlayers((prev) =>
        prev.map((p) => (playerIds.includes(p.id) ? { ...p, status: 'playing' as const, waitingSince: null } : p)),
      );
      setGames((prev) => [...prev, { id: gameId, players: playerIds, confirmedAt: nowIso }]);
      return { ok: true };
    },
    [queue, players, courts],
  );

  const endCourtGame = useCallback(
    (courtId: string) => {
      const court = courts.find((c) => c.id === courtId);
      if (!court?.playerIds) return;
      const playerIds = court.playerIds;
      const nowIso = new Date().toISOString();
      setCourts((prev) =>
        prev.map((c) =>
          c.id === courtId ? { ...c, playerIds: null, gameStartedAt: null, gameId: null, prevWaiting: undefined } : c,
        ),
      );
      // 다음 대기 게임에 이미 들어 있는 선수는 queued, 나머지는 active. 게임을 뛰었으니 대기는 지금부터.
      const queuedIds = new Set(queue.flatMap((q) => q.playerIds));
      setPlayers((prev) =>
        prev.map((p) =>
          playerIds.includes(p.id)
            ? { ...p, status: queuedIds.has(p.id) ? ('queued' as const) : ('active' as const), waitingSince: nowIso }
            : p,
        ),
      );
    },
    [courts, queue],
  );

  const moveCourtGame = useCallback((fromCourtId: string, toCourtId: string) => {
    if (fromCourtId === toCourtId) return;
    setCourts((prev) => {
      const from = prev.find((c) => c.id === fromCourtId);
      const to = prev.find((c) => c.id === toCourtId);
      if (!from?.playerIds || !to) return prev;
      // 게임 데이터(선수/시작시각/게임id/직전 대기시각)를 코트 이름만 남기고 통째로 맞바꾼다.
      // 대상이 빈 코트면 빈 값이 그대로 되돌아와 출발 코트가 비워진다.
      return prev.map((c) => {
        if (c.id === fromCourtId) {
          return {
            ...c,
            playerIds: to.playerIds,
            gameStartedAt: to.gameStartedAt,
            gameId: to.gameId ?? null,
            prevWaiting: to.prevWaiting,
          };
        }
        if (c.id === toCourtId) {
          return {
            ...c,
            playerIds: from.playerIds,
            gameStartedAt: from.gameStartedAt,
            gameId: from.gameId ?? null,
            prevWaiting: from.prevWaiting,
          };
        }
        return c;
      });
    });
  }, []);

  const cancelCourtGame = useCallback(
    (courtId: string) => {
      const court = courts.find((c) => c.id === courtId);
      if (!court?.playerIds || !court.gameId) return;
      const playerIds = court.playerIds;
      const gameId = court.gameId;
      const prevWaiting = court.prevWaiting ?? {};
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      setCourts((prev) =>
        prev.map((c) =>
          c.id === courtId ? { ...c, playerIds: null, gameStartedAt: null, gameId: null, prevWaiting: undefined } : c,
        ),
      );
      const queuedIds = new Set(queue.flatMap((q) => q.playerIds));
      setPlayers((prev) =>
        prev.map((p) =>
          playerIds.includes(p.id)
            ? {
                ...p,
                status: queuedIds.has(p.id) ? ('queued' as const) : ('active' as const),
                waitingSince: prevWaiting[p.id] ?? null,
              }
            : p,
        ),
      );
    },
    [courts, queue],
  );

  const resetCourts = useCallback(() => {
    setCourts([]);
  }, []);

  const resetQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    players,
    games,
    courts,
    queue,
    addPlayer,
    removePlayer,
    updatePlayer,
    setAttending,
    setAttendingBulk,
    addGame,
    removeGame,
    resetPlayers,
    resetGames,
    resetWaitingTimes,
    addCourt,
    removeCourt,
    renameCourt,
    enqueueGame,
    removeFromQueue,
    assignQueueToCourt,
    endCourtGame,
    cancelCourtGame,
    moveCourtGame,
    resetCourts,
    resetQueue,
    isLoading,
  };
}
