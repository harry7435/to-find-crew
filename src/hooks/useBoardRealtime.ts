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
  type RawParticipantOverride,
} from '@/utils/boardSnapshot';

// 토스트 기본 노출 시간은 1초(components/ui/sonner.tsx)라 현장에서 실패를 놓치기 쉽다.
// 에러만 더 길게 띄운다.
const ERROR_TOAST_DURATION = 4000;
// realtime 이벤트마다 스냅샷을 다시 받으므로, 조회 실패 토스트는 id를 고정해 쌓이지 않게 한다.
const LOAD_ERROR_TOAST_ID = 'board-load-error';

function notifyError(message: string) {
  toast.error(message, { duration: ERROR_TOAST_DURATION });
}

type PlayerStateUpdates = Partial<
  Pick<BoardPlayerStateRow, 'attending' | 'player_status' | 'pinned' | 'waiting_since'>
>;

async function updatePlayerState(participantId: string, updates: PlayerStateUpdates): Promise<boolean> {
  const { error } = await supabase
    .from('board_player_state')
    .update(updates)
    .or(`session_participant_id.eq.${participantId},guest_participant_id.eq.${participantId}`);
  return !error;
}

async function updatePlayerStates(participantIds: string[], updates: PlayerStateUpdates): Promise<boolean> {
  const results = await Promise.all(participantIds.map((id) => updatePlayerState(id, updates)));
  return results.every(Boolean);
}

/**
 * 모든 쓰기 동작은 성공 여부(boolean)를 돌려준다. 실패하면 훅이 직접 에러 토스트를 띄우고
 * 스냅샷을 다시 받아 화면을 서버 상태에 맞추므로, 호출부는 true일 때만 성공 토스트를 띄우면 된다.
 *
 * 게임 1행 + 선수 여러 행을 고치는 동작은 트랜잭션이 아니라서 중간에 끊기면 일부만 반영될 수 있다.
 * 그래서 각 동작의 쓰기 순서는 "중간에 실패해도 같은 버튼을 다시 누르면 복구되는" 순서로 잡혀 있다.
 * 순서를 바꾸기 전에 docs/gotchas/game-manager-board-conventions.md를 볼 것.
 */
export function useBoardRealtime(sessionId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const playersRef = useRef<Player[]>([]);
  playersRef.current = players;

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
    // 네트워크가 잠깐 끊겼을 때 선수 전원이 사라지거나 미참석으로 보이고, 아래의 상태 행
    // 보충 INSERT가 이미 있는 행을 다시 넣으려 한다.
    if (results.some((result) => result.error)) {
      toast.error('보드를 불러오지 못했습니다. 네트워크 상태를 확인해주세요', {
        id: LOAD_ERROR_TOAST_ID,
        duration: ERROR_TOAST_DURATION,
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

    const participants = (sessionParticipants ?? []) as unknown as RawSessionParticipant[];
    const guests = (guestParticipants ?? []) as RawGuestParticipant[];
    const overrides = (overrideRows ?? []) as RawParticipantOverride[];
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
      overrides,
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
        // 최초 연결뿐 아니라 네트워크 재연결로 재구독될 때도 전체 스냅샷을 다시 받아
        // 끊긴 동안 놓쳤을 수 있는 변경사항과 정합성을 맞춘다
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

  // 실패를 알리고 화면을 서버 상태로 되돌린 뒤 false를 돌려준다.
  const fail = useCallback(
    async (message: string): Promise<false> => {
      notifyError(message);
      await loadSnapshot();
      return false;
    },
    [loadSnapshot],
  );

  const addPlayer = useCallback(
    async (playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>): Promise<boolean> => {
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
        return fail('선수 등록에 실패했습니다');
      }

      // 상태 행 생성이 실패해도 loadSnapshot의 누락 행 보충이 다시 만들어 주므로 결과를 확인하지 않는다.
      await supabase.from('board_player_state').insert([{ session_id: sessionId, guest_participant_id: guest.id }]);
      await loadSnapshot();
      return true;
    },
    [sessionId, loadSnapshot, fail],
  );

  const removePlayer = useCallback(
    async (id: string): Promise<boolean> => {
      const player = playersRef.current.find((p) => p.id === id);

      if (player?.participantType === 'user') {
        // fetch는 오프라인이면 응답 대신 예외를 던진다.
        const ok = await fetch('/api/badminton/sessions/remove-participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, participant_id: id, participant_type: 'user' }),
        })
          .then((response) => response.ok)
          .catch(() => false);
        if (!ok) {
          return fail('참가자 삭제에 실패했습니다');
        }
      } else {
        const { error } = await supabase.from('guest_participants').delete().eq('id', id);
        if (error) {
          return fail('선수 삭제에 실패했습니다');
        }
      }
      await loadSnapshot();
      return true;
    },
    [sessionId, loadSnapshot, fail],
  );

  const updatePlayer = useCallback(
    async (id: string, updates: Partial<Omit<Player, 'id'>>): Promise<boolean> => {
      const stateUpdates: Partial<Pick<BoardPlayerStateRow, 'player_status' | 'pinned' | 'waiting_since'>> = {};
      if (updates.status !== undefined) stateUpdates.player_status = updates.status;
      if (updates.pinned !== undefined) stateUpdates.pinned = updates.pinned;
      if (updates.waitingSince !== undefined) stateUpdates.waiting_since = updates.waitingSince;
      if (Object.keys(stateUpdates).length > 0) {
        if (!(await updatePlayerState(id, stateUpdates))) {
          return fail('선수 상태 변경에 실패했습니다');
        }
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
          const overrideFields: Record<string, unknown> = {};
          if (updates.name !== undefined) overrideFields.name = updates.name;
          if (updates.gender !== undefined) overrideFields.gender = updates.gender;
          if (updates.skillLevel !== undefined) overrideFields.skill_level = SKILL_LEVEL_TO_NUMBER[updates.skillLevel];
          if (updates.ageGroup !== undefined) {
            overrideFields.age_group = updates.ageGroup === '60s+' ? '60s' : updates.ageGroup;
          }
          const { error } = await supabase
            .from('session_participant_overrides')
            .upsert(
              { session_id: sessionId, session_participant_id: id, ...overrideFields },
              { onConflict: 'session_participant_id' },
            );
          if (error) {
            return fail('선수 정보 수정에 실패했습니다');
          }
        } else {
          const { error } = await supabase.from('guest_participants').update(profileUpdates).eq('id', id);
          if (error) {
            return fail('선수 정보 수정에 실패했습니다');
          }
        }
      }

      await loadSnapshot();
      return true;
    },
    [sessionId, loadSnapshot, fail],
  );

  const setAttending = useCallback(
    async (id: string, attending: boolean): Promise<boolean> => {
      const current = playersRef.current.find((p) => p.id === id);
      const nowIso = new Date().toISOString();
      let ok: boolean;
      if (attending) {
        if (current?.status === 'playing' || current?.status === 'queued') {
          ok = await updatePlayerState(id, { attending: true });
        } else {
          ok = await updatePlayerState(id, { attending: true, player_status: 'active', waiting_since: nowIso });
        }
      } else {
        ok = await updatePlayerState(id, {
          attending: false,
          player_status: 'resting',
          pinned: false,
          waiting_since: null,
        });
      }
      if (!ok) {
        return fail('참석 상태 변경에 실패했습니다');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const setAttendingBulk = useCallback(
    async (attendingIds: string[]): Promise<boolean> => {
      const nowIso = new Date().toISOString();
      const attendingSet = new Set(attendingIds);
      const results = await Promise.all(
        playersRef.current
          .filter((p) => p.status !== 'playing' && p.status !== 'queued')
          .map((p) => {
            const shouldAttend = attendingSet.has(p.id);
            if (shouldAttend === (p.attending === true)) return Promise.resolve(true);
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
      if (!results.every(Boolean)) {
        return fail('일부 선수의 참석 상태를 변경하지 못했습니다. 다시 시도해주세요');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const resetPlayers = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.from('guest_participants').delete().eq('session_id', sessionId);
    if (error) {
      return fail('게스트 선수 초기화에 실패했습니다');
    }
    await loadSnapshot();
    return true;
  }, [sessionId, loadSnapshot, fail]);

  const resetWaitingTimes = useCallback(async (): Promise<boolean> => {
    const nowIso = new Date().toISOString();
    const ok = await updatePlayerStates(
      playersRef.current.filter((p) => p.status === 'active').map((p) => p.id),
      { waiting_since: nowIso },
    );
    if (!ok) {
      return fail('대기 시간 초기화에 실패했습니다. 다시 시도해주세요');
    }
    await loadSnapshot();
    return true;
  }, [loadSnapshot, fail]);

  const addCourt = useCallback(
    async (name: string): Promise<boolean> => {
      const { error } = await supabase
        .from('courts')
        .insert([{ session_id: sessionId, name, sort_order: courts.length }]);
      if (error) {
        return fail('코트 추가에 실패했습니다');
      }
      await loadSnapshot();
      return true;
    },
    [sessionId, courts.length, loadSnapshot, fail],
  );

  const removeCourt = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('courts').delete().eq('id', id);
      if (error) {
        return fail('코트 삭제에 실패했습니다');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const renameCourt = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const { error } = await supabase.from('courts').update({ name }).eq('id', id);
      if (error) {
        return fail('코트 이름 변경에 실패했습니다');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const enqueueGame = useCallback(
    async (playerIds: [string, string, string, string]): Promise<boolean> => {
      const nowIso = new Date().toISOString();
      const { data: game, error } = await supabase
        .from('board_games')
        .insert([{ session_id: sessionId, player_ids: playerIds, status: 'queued', queued_at: nowIso }])
        .select('id')
        .single();
      if (error || !game) {
        return fail('대기열 추가에 실패했습니다');
      }
      if (!(await updatePlayerStates(playerIds, { player_status: 'queued', pinned: false }))) {
        // 게임 행만 남기고 실패로 알리면 다시 확정했을 때 같은 4명이 대기열에 두 번 들어간다.
        // 넣은 게임을 지우고 선수 상태를 되돌려 "아무 일도 없던 상태"로 맞춘다(되돌리기도 최선 노력).
        await supabase.from('board_games').delete().eq('id', game.id);
        await updatePlayerStates(playerIds, { player_status: 'active' });
        return fail('대기열 추가에 실패했습니다. 다시 시도해주세요');
      }
      await loadSnapshot();
      return true;
    },
    [sessionId, loadSnapshot, fail],
  );

  const removeFromQueue = useCallback(
    async (queueItemId: string): Promise<boolean> => {
      const { data: item, error: findError } = await supabase
        .from('board_games')
        .select('player_ids')
        .eq('id', queueItemId)
        .maybeSingle();
      if (findError) {
        return fail('대기열 취소에 실패했습니다');
      }
      if (!item) {
        return fail('이미 처리된 대기열입니다');
      }
      // 선수 상태를 먼저 되돌리고 게임 행을 지운다. 반대 순서로 하다 중간에 끊기면 게임 행은
      // 사라졌는데 선수는 queued로 남아, 다시 취소할 대상이 없어 복구할 수 없다.
      // 대기열 취소는 실제 게임을 뛴 게 아니므로 waiting_since를 유지한다(대기 시간 이어서 누적).
      if (!(await updatePlayerStates(item.player_ids as string[], { player_status: 'active' }))) {
        return fail('대기열 취소에 실패했습니다. 다시 시도해주세요');
      }
      const { error } = await supabase.from('board_games').delete().eq('id', queueItemId);
      if (error) {
        return fail('대기열 취소에 실패했습니다. 다시 시도해주세요');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const assignQueueToCourt = useCallback(
    async (queueItemId: string, courtId: string): Promise<boolean> => {
      const nowIso = new Date().toISOString();
      const { data: item, error: findError } = await supabase
        .from('board_games')
        .select('player_ids')
        .eq('id', queueItemId)
        .maybeSingle();
      if (findError) {
        return fail('코트 배정에 실패했습니다');
      }
      if (!item) {
        return fail('이미 처리된 대기열입니다');
      }
      const { error } = await supabase
        .from('board_games')
        .update({ court_id: courtId, status: 'playing', started_at: nowIso })
        .eq('id', queueItemId);
      if (error) {
        return fail('코트 배정에 실패했습니다');
      }
      // 여기서 실패하면 게임은 코트에 올라갔는데 선수는 queued로 남는다. 그 코트의 게임을
      // 종료/취소하면 선수 상태가 다시 맞춰지므로 복구할 수 있다.
      if (!(await updatePlayerStates(item.player_ids as string[], { player_status: 'playing', waiting_since: null }))) {
        return fail('코트에는 배정됐지만 선수 상태 반영에 실패했습니다. 화면을 확인해주세요');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const endCourtGame = useCallback(
    async (courtId: string): Promise<boolean> => {
      const { data: game, error: findError } = await supabase
        .from('board_games')
        .select('*')
        .eq('court_id', courtId)
        .eq('status', 'playing')
        .maybeSingle();
      if (findError) {
        return fail('게임 종료에 실패했습니다');
      }
      if (!game) {
        return fail('이미 종료된 게임입니다');
      }
      const nowIso = new Date().toISOString();
      // 선수 상태를 먼저 되돌리고 게임 행을 완료 처리한다. 반대 순서로 하다 중간에 끊기면 게임은
      // 완료됐는데 선수는 playing으로 남아, 다시 종료할 게임이 없어 복구할 수 없다.
      if (
        !(await updatePlayerStates(game.player_ids as string[], { player_status: 'active', waiting_since: nowIso }))
      ) {
        return fail('게임 종료에 실패했습니다. 다시 시도해주세요');
      }
      const { error } = await supabase
        .from('board_games')
        .update({ status: 'completed', completed_at: nowIso })
        .eq('id', game.id);
      if (error) {
        return fail('게임 종료에 실패했습니다. 다시 시도해주세요');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const cancelCourtGame = useCallback(
    async (courtId: string): Promise<boolean> => {
      const { data: game, error: findError } = await supabase
        .from('board_games')
        .select('*')
        .eq('court_id', courtId)
        .eq('status', 'playing')
        .maybeSingle();
      if (findError) {
        return fail('게임 취소에 실패했습니다');
      }
      if (!game) {
        return fail('이미 종료된 게임입니다');
      }
      const nowIso = new Date().toISOString();
      // endCourtGame과 같은 이유로 선수 상태를 먼저 되돌린 뒤 게임 행을 지운다.
      if (
        !(await updatePlayerStates(game.player_ids as string[], { player_status: 'active', waiting_since: nowIso }))
      ) {
        return fail('게임 취소에 실패했습니다. 다시 시도해주세요');
      }
      const { error } = await supabase.from('board_games').delete().eq('id', game.id);
      if (error) {
        return fail('게임 취소에 실패했습니다. 다시 시도해주세요');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const moveCourtGame = useCallback(
    async (fromCourtId: string, toCourtId: string): Promise<boolean> => {
      if (fromCourtId === toCourtId) return false;
      const { data: rows, error: findError } = await supabase
        .from('board_games')
        .select('id, court_id')
        .in('court_id', [fromCourtId, toCourtId])
        .eq('status', 'playing');
      if (findError) {
        return fail('코트 이동에 실패했습니다');
      }
      const fromGame = rows?.find((g) => g.court_id === fromCourtId);
      if (!fromGame) {
        return fail('이미 종료된 게임입니다');
      }
      const toGame = rows?.find((g) => g.court_id === toCourtId);

      const { error } = await supabase.from('board_games').update({ court_id: toCourtId }).eq('id', fromGame.id);
      if (error) {
        return fail('코트 이동에 실패했습니다');
      }
      if (toGame) {
        const { error: swapError } = await supabase
          .from('board_games')
          .update({ court_id: fromCourtId })
          .eq('id', toGame.id);
        if (swapError) {
          // 맞바꾸기의 두 번째 업데이트가 실패하면 첫 업데이트를 되돌린다.
          // 그대로 두면 두 게임이 같은 코트를 가리켜 한 게임이 화면에서 사라진다.
          await supabase.from('board_games').update({ court_id: fromCourtId }).eq('id', fromGame.id);
          return fail('코트 교환에 실패했습니다');
        }
      }
      // 선수 상태(playing)와 started_at은 그대로 두어 경과 시간이 이어지게 한다
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const removeGame = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('board_games').delete().eq('id', id).eq('status', 'completed');
      if (error) {
        return fail('게임 기록 삭제에 실패했습니다');
      }
      await loadSnapshot();
      return true;
    },
    [loadSnapshot, fail],
  );

  const resetGames = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase.from('board_games').delete().eq('session_id', sessionId).eq('status', 'completed');
    if (error) {
      return fail('게임 기록 초기화에 실패했습니다');
    }
    await loadSnapshot();
    return true;
  }, [sessionId, loadSnapshot, fail]);

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
    resetWaitingTimes,
    resetGames,
    addCourt,
    removeCourt,
    renameCourt,
    enqueueGame,
    removeFromQueue,
    assignQueueToCourt,
    endCourtGame,
    cancelCourtGame,
    moveCourtGame,
  };
}
