import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Player, GameRecord, Court, QueueItem } from '@/hooks/useGameManager';
import type { CourtRow, BoardGameRow, BoardPlayerStateRow } from '@/types/badminton';
import {
  buildSnapshot,
  type RawSessionParticipant,
  type RawGuestParticipant,
  type RawParticipantOverride,
} from '@/utils/boardSnapshot';

export function useBoardSpectator(sessionId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    const [
      { data: sessionParticipants },
      { data: guestParticipants },
      { data: overrideRows },
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
      supabase
        .from('session_participant_overrides')
        .select('session_participant_id, name, gender, skill_level, age_group')
        .eq('session_id', sessionId),
      supabase.from('board_player_state').select('*').eq('session_id', sessionId),
      supabase.from('courts').select('*').eq('session_id', sessionId).order('sort_order', { ascending: true }),
      supabase.from('board_games').select('*').eq('session_id', sessionId),
    ]);

    const snapshot = buildSnapshot({
      participants: (sessionParticipants ?? []) as unknown as RawSessionParticipant[],
      guests: (guestParticipants ?? []) as RawGuestParticipant[],
      overrides: (overrideRows ?? []) as RawParticipantOverride[],
      states: (stateRows ?? []) as BoardPlayerStateRow[],
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
      .channel(`board-spectator-${sessionId}`)
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participant_overrides',
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadSnapshot(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadSnapshot();
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadSnapshot]);

  return { players, courts, queue, games, isLoading };
}
