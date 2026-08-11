import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Player, GameRecord, Court, QueueItem } from '@/hooks/useGameManager';
import type { CourtRow, BoardGameRow, BoardPlayerStateRow } from '@/types/badminton';
import {
  buildSnapshot,
  SKILL_LEVEL_TO_NUMBER,
  type RawSessionParticipant,
  type RawGuestParticipant,
} from '@/utils/boardSnapshot';

async function updatePlayerState(
  participantId: string,
  updates: Partial<Pick<BoardPlayerStateRow, 'attending' | 'player_status' | 'pinned' | 'waiting_since'>>,
) {
  await supabase
    .from('board_player_state')
    .update(updates)
    .or(`session_participant_id.eq.${participantId},guest_participant_id.eq.${participantId}`);
}

export function useBoardRealtime(sessionId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const playersRef = useRef<Player[]>([]);
  playersRef.current = players;

  const loadSnapshot = useCallback(async () => {
    const [
      { data: sessionParticipants },
      { data: guestParticipants },
      { data: stateRows },
      { data: courtRows },
      { data: gameRows },
    ] = await Promise.all([
      supabase
        .from('session_participants')
        .select('id, user:users(name, gender, skill_level)')
        .eq('session_id', sessionId),
      supabase
        .from('guest_participants')
        .select('id, name, gender, skill_level, age_group')
        .eq('session_id', sessionId),
      supabase.from('board_player_state').select('*').eq('session_id', sessionId),
      supabase.from('courts').select('*').eq('session_id', sessionId).order('sort_order', { ascending: true }),
      supabase.from('board_games').select('*').eq('session_id', sessionId),
    ]);

    const participants = (sessionParticipants ?? []) as unknown as RawSessionParticipant[];
    const guests = (guestParticipants ?? []) as RawGuestParticipant[];
    const existingStates = (stateRows ?? []) as BoardPlayerStateRow[];

    const existingSpIds = new Set(
      existingStates.filter((s) => s.session_participant_id).map((s) => s.session_participant_id as string),
    );
    const existingGpIds = new Set(
      existingStates.filter((s) => s.guest_participant_id).map((s) => s.guest_participant_id as string),
    );

    const missingInserts: Array<Record<string, unknown>> = [];
    participants.forEach((p) => {
      if (!existingSpIds.has(p.id)) {
        missingInserts.push({ session_id: sessionId, session_participant_id: p.id });
      }
    });
    guests.forEach((g) => {
      if (!existingGpIds.has(g.id)) {
        missingInserts.push({ session_id: sessionId, guest_participant_id: g.id });
      }
    });

    let allStates = existingStates;
    if (missingInserts.length > 0) {
      const { data: inserted } = await supabase.from('board_player_state').insert(missingInserts).select();
      allStates = [...existingStates, ...((inserted ?? []) as BoardPlayerStateRow[])];
    }

    const snapshot = buildSnapshot({
      participants,
      guests,
      states: allStates,
      courtRows: (courtRows ?? []) as CourtRow[],
      gameRows: (gameRows ?? []) as BoardGameRow[],
    });
    setPlayers(snapshot.players);
    setCourts(snapshot.courts);
    setQueue(snapshot.queue);
    setGames(snapshot.games);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadSnapshot().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    const channel = supabase
      .channel(`board-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_player_state', filter: `session_id=eq.${sessionId}` },
        () => loadSnapshot(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'courts', filter: `session_id=eq.${sessionId}` },
        () => loadSnapshot(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_games', filter: `session_id=eq.${sessionId}` },
        () => loadSnapshot(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_participants', filter: `session_id=eq.${sessionId}` },
        () => loadSnapshot(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        () => loadSnapshot(),
      )
      .subscribe((status) => {
        // 최초 연결뿐 아니라 네트워크 재연결로 재구독될 때도 전체 스냅샷을 다시 받아
        // 끊긴 동안 놓쳤을 수 있는 변경사항과 정합성을 맞춘다
        if (status === 'SUBSCRIBED') {
          loadSnapshot();
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadSnapshot]);

  const addPlayer = useCallback(
    async (playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => {
      const { data: guest, error } = await supabase
        .from('guest_participants')
        .insert([
          {
            session_id: sessionId,
            name: playerData.name,
            gender: playerData.gender ?? 'male',
            skill_level: playerData.skillLevel ? SKILL_LEVEL_TO_NUMBER[playerData.skillLevel] : 0,
            age_group: playerData.ageGroup === '60s+' ? '60s' : (playerData.ageGroup ?? '20s'),
          },
        ])
        .select()
        .single();

      if (error || !guest) {
        toast.error('선수 등록에 실패했습니다');
        return;
      }

      await supabase.from('board_player_state').insert([{ session_id: sessionId, guest_participant_id: guest.id }]);
      await loadSnapshot();
    },
    [sessionId, loadSnapshot],
  );

  const removePlayer = useCallback(
    async (id: string) => {
      const player = playersRef.current.find((p) => p.id === id);

      if (player?.participantType === 'user') {
        const response = await fetch('/api/badminton/sessions/remove-participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, participant_id: id, participant_type: 'user' }),
        });
        if (!response.ok) {
          toast.error('참가자 삭제에 실패했습니다');
          return;
        }
      } else {
        const { error } = await supabase.from('guest_participants').delete().eq('id', id);
        if (error) {
          toast.error('선수 삭제에 실패했습니다');
          return;
        }
      }
      await loadSnapshot();
    },
    [sessionId, loadSnapshot],
  );

  const updatePlayer = useCallback(
    async (id: string, updates: Partial<Omit<Player, 'id'>>) => {
      const stateUpdates: Partial<Pick<BoardPlayerStateRow, 'player_status' | 'pinned' | 'waiting_since'>> = {};
      if (updates.status !== undefined) stateUpdates.player_status = updates.status;
      if (updates.pinned !== undefined) stateUpdates.pinned = updates.pinned;
      if (updates.waitingSince !== undefined) stateUpdates.waiting_since = updates.waitingSince;
      if (Object.keys(stateUpdates).length > 0) {
        await updatePlayerState(id, stateUpdates);
      }

      const profileUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) profileUpdates.name = updates.name;
      if (updates.gender !== undefined) profileUpdates.gender = updates.gender;
      if (updates.skillLevel !== undefined) profileUpdates.skill_level = SKILL_LEVEL_TO_NUMBER[updates.skillLevel];
      if (updates.ageGroup !== undefined) {
        profileUpdates.age_group = updates.ageGroup === '60s+' ? '60s' : updates.ageGroup;
      }
      if (Object.keys(profileUpdates).length > 0) {
        const player = playersRef.current.find((p) => p.id === id);
        if (player?.participantType === 'user') {
          toast.error('로그인 참가자 정보는 여기서 수정할 수 없습니다');
        } else {
          await supabase.from('guest_participants').update(profileUpdates).eq('id', id);
        }
      }

      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const setAttending = useCallback(
    async (id: string, attending: boolean) => {
      const current = playersRef.current.find((p) => p.id === id);
      const nowIso = new Date().toISOString();
      if (attending) {
        if (current?.status === 'playing' || current?.status === 'queued') {
          await updatePlayerState(id, { attending: true });
        } else {
          await updatePlayerState(id, { attending: true, player_status: 'active', waiting_since: nowIso });
        }
      } else {
        await updatePlayerState(id, { attending: false, player_status: 'resting', pinned: false, waiting_since: null });
      }
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const setAttendingBulk = useCallback(
    async (attendingIds: string[]) => {
      const nowIso = new Date().toISOString();
      const attendingSet = new Set(attendingIds);
      await Promise.all(
        playersRef.current
          .filter((p) => p.status !== 'playing' && p.status !== 'queued')
          .map((p) => {
            const shouldAttend = attendingSet.has(p.id);
            if (shouldAttend === (p.attending === true)) return Promise.resolve();
            return shouldAttend
              ? updatePlayerState(p.id, { attending: true, player_status: 'active', waiting_since: nowIso })
              : updatePlayerState(p.id, {
                  attending: false,
                  player_status: 'resting',
                  pinned: false,
                  waiting_since: null,
                });
          }),
      );
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const resetPlayers = useCallback(async () => {
    await supabase.from('guest_participants').delete().eq('session_id', sessionId);
    await loadSnapshot();
  }, [sessionId, loadSnapshot]);

  const addCourt = useCallback(
    async (name: string) => {
      await supabase.from('courts').insert([{ session_id: sessionId, name, sort_order: courts.length }]);
      await loadSnapshot();
    },
    [sessionId, courts.length, loadSnapshot],
  );

  const removeCourt = useCallback(
    async (id: string) => {
      await supabase.from('courts').delete().eq('id', id);
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const renameCourt = useCallback(
    async (id: string, name: string) => {
      await supabase.from('courts').update({ name }).eq('id', id);
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const enqueueGame = useCallback(
    async (playerIds: [string, string, string, string]) => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('board_games')
        .insert([{ session_id: sessionId, player_ids: playerIds, status: 'queued', queued_at: nowIso }]);
      if (error) {
        toast.error('대기열 추가에 실패했습니다');
        return;
      }
      await Promise.all(
        playerIds.map((id) => updatePlayerState(id, { player_status: 'queued', pinned: false, waiting_since: null })),
      );
      await loadSnapshot();
    },
    [sessionId, loadSnapshot],
  );

  const removeFromQueue = useCallback(
    async (queueItemId: string) => {
      const { data: item } = await supabase.from('board_games').select('player_ids').eq('id', queueItemId).single();
      if (!item) return;
      const nowIso = new Date().toISOString();
      await supabase.from('board_games').delete().eq('id', queueItemId);
      await Promise.all(
        (item.player_ids as string[]).map((id) =>
          updatePlayerState(id, { player_status: 'active', waiting_since: nowIso }),
        ),
      );
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const assignQueueToCourt = useCallback(
    async (queueItemId: string, courtId: string) => {
      const nowIso = new Date().toISOString();
      const { data: item } = await supabase.from('board_games').select('player_ids').eq('id', queueItemId).single();
      if (!item) return;
      const { error } = await supabase
        .from('board_games')
        .update({ court_id: courtId, status: 'playing', started_at: nowIso })
        .eq('id', queueItemId);
      if (error) {
        toast.error('코트 배정에 실패했습니다');
        return;
      }
      await Promise.all(
        (item.player_ids as string[]).map((id) =>
          updatePlayerState(id, { player_status: 'playing', waiting_since: null }),
        ),
      );
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const endCourtGame = useCallback(
    async (courtId: string) => {
      const { data: game } = await supabase
        .from('board_games')
        .select('*')
        .eq('court_id', courtId)
        .eq('status', 'playing')
        .maybeSingle();
      if (!game) return;
      const nowIso = new Date().toISOString();
      await supabase.from('board_games').update({ status: 'completed', completed_at: nowIso }).eq('id', game.id);
      await Promise.all(
        (game.player_ids as string[]).map((id) =>
          updatePlayerState(id, { player_status: 'active', waiting_since: nowIso }),
        ),
      );
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const cancelCourtGame = useCallback(
    async (courtId: string) => {
      const { data: game } = await supabase
        .from('board_games')
        .select('*')
        .eq('court_id', courtId)
        .eq('status', 'playing')
        .maybeSingle();
      if (!game) return;
      const nowIso = new Date().toISOString();
      await supabase.from('board_games').delete().eq('id', game.id);
      await Promise.all(
        (game.player_ids as string[]).map((id) =>
          updatePlayerState(id, { player_status: 'active', waiting_since: nowIso }),
        ),
      );
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const removeGame = useCallback(
    async (id: string) => {
      await supabase.from('board_games').delete().eq('id', id).eq('status', 'completed');
      await loadSnapshot();
    },
    [loadSnapshot],
  );

  const resetGames = useCallback(async () => {
    await supabase.from('board_games').delete().eq('session_id', sessionId).eq('status', 'completed');
    await loadSnapshot();
  }, [sessionId, loadSnapshot]);

  return {
    players,
    games,
    courts,
    queue,
    isLoading,
    addPlayer,
    removePlayer,
    updatePlayer,
    setAttending,
    setAttendingBulk,
    removeGame,
    resetPlayers,
    resetGames,
    addCourt,
    removeCourt,
    renameCourt,
    enqueueGame,
    removeFromQueue,
    assignQueueToCourt,
    endCourtGame,
    cancelCourtGame,
  };
}
