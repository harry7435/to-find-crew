import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Player, GameRecord, Court, QueueItem } from '@/hooks/useGameManager';
import type { CourtRow, BoardGameRow, BoardPlayerStateRow } from '@/types/badminton';
import {
  buildSnapshot,
  type RawSessionParticipant,
  type RawGuestParticipant,
  type RawParticipantOverride,
} from '@/utils/boardSnapshot';

// realtime 이벤트마다 스냅샷을 다시 받으므로, 조회 실패 토스트는 id를 고정해 쌓이지 않게 한다.
// (useBoardRealtime에도 같은 처리가 있다. 두 훅은 의도적으로 코드를 공유하지 않는다 —
//  docs/gotchas/spectator-board-duplication.md)
const LOAD_ERROR_TOAST_ID = 'board-spectator-load-error';

export function useBoardSpectator(sessionId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    const results = await Promise.all([
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

    // 하나라도 조회에 실패하면 화면을 건드리지 않는다. 실패한 조회를 빈 배열로 취급하면
    // 네트워크가 잠깐 끊겼을 때 현황판이 통째로 비거나 선수 전원이 미참석으로 보인다.
    if (results.some((result) => result.error)) {
      toast.error('현황판을 불러오지 못했습니다. 네트워크 상태를 확인해주세요', {
        id: LOAD_ERROR_TOAST_ID,
        duration: 4000,
      });
      return;
    }
    toast.dismiss(LOAD_ERROR_TOAST_ID);

    const [
      { data: sessionParticipants },
      { data: guestParticipants },
      { data: overrideRows },
      { data: stateRows },
      { data: courtRows },
      { data: gameRows },
    ] = results;

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

    // 모바일(특히 PWA)은 백그라운드로 가면 소켓이 멈추거나 끊기고, 그동안의 이벤트는 다시 오지 않는다.
    // 재구독이 감지되지 않는 경우에도 최신 상태가 보이도록 화면 복귀·네트워크 복구 시 직접 다시 받는다.
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') loadSnapshot();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('online', refreshOnReturn);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.removeEventListener('online', refreshOnReturn);
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadSnapshot]);

  return { players, courts, queue, games, isLoading };
}
