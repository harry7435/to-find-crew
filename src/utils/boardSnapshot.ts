import type { Player, GameRecord, Court, QueueItem } from '@/hooks/useGameManager';
import type { CourtRow, BoardGameRow, BoardPlayerStateRow } from '@/types/badminton';

export const SKILL_LEVEL_FROM_NUMBER: Record<number, NonNullable<Player['skillLevel']>> = {
  0: 'E',
  1: 'D',
  2: 'C',
  3: 'B',
  4: 'A',
  5: 'S',
};

export const SKILL_LEVEL_TO_NUMBER: Record<NonNullable<Player['skillLevel']>, number> = {
  E: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

export interface RawSessionParticipant {
  id: string;
  user: { name: string; gender?: string; skill_level?: number } | null;
}

export interface RawGuestParticipant {
  id: string;
  name: string;
  gender: string;
  skill_level: number;
  age_group: string;
}

function toPlayer(
  participantId: string,
  type: 'user' | 'guest',
  info: { name: string; gender?: string; skill_level?: number; age_group?: string },
  state: BoardPlayerStateRow | undefined,
): Player {
  return {
    id: participantId,
    participantType: type,
    name: info.name,
    gender: info.gender === 'male' || info.gender === 'female' ? info.gender : undefined,
    skillLevel: info.skill_level !== undefined ? SKILL_LEVEL_FROM_NUMBER[info.skill_level] : undefined,
    ageGroup: info.age_group ? ((info.age_group === '60s' ? '60s+' : info.age_group) as Player['ageGroup']) : undefined,
    status: state?.player_status ?? 'resting',
    pinned: state?.pinned ?? false,
    attending: state?.attending ?? false,
    waitingSince: state?.waiting_since ?? null,
  };
}

export interface BoardSnapshotInput {
  participants: RawSessionParticipant[];
  guests: RawGuestParticipant[];
  states: BoardPlayerStateRow[];
  courtRows: CourtRow[];
  gameRows: BoardGameRow[];
}

export interface BoardSnapshot {
  players: Player[];
  courts: Court[];
  queue: QueueItem[];
  games: GameRecord[];
}

export function buildSnapshot({
  participants,
  guests,
  states,
  courtRows,
  gameRows,
}: BoardSnapshotInput): BoardSnapshot {
  const stateBySp = new Map(
    states.filter((s) => s.session_participant_id).map((s) => [s.session_participant_id as string, s]),
  );
  const stateByGp = new Map(
    states.filter((s) => s.guest_participant_id).map((s) => [s.guest_participant_id as string, s]),
  );

  const players: Player[] = [
    ...participants.filter((p) => p.user).map((p) => toPlayer(p.id, 'user', p.user!, stateBySp.get(p.id))),
    ...guests.map((g) => toPlayer(g.id, 'guest', g, stateByGp.get(g.id))),
  ];

  const courts: Court[] = courtRows.map((c) => {
    const activeGame = gameRows.find((g) => g.court_id === c.id && g.status === 'playing');
    return {
      id: c.id,
      name: c.name,
      playerIds: activeGame ? activeGame.player_ids : null,
      gameStartedAt: activeGame?.started_at ?? null,
      gameId: activeGame?.id ?? null,
    };
  });

  const queue: QueueItem[] = gameRows
    .filter((g) => g.status === 'queued')
    .map((g) => ({ id: g.id, playerIds: g.player_ids, queuedAt: g.queued_at }));

  const games: GameRecord[] = gameRows
    .filter((g) => g.status === 'completed')
    .map((g) => ({ id: g.id, players: g.player_ids, confirmedAt: g.completed_at! }));

  return { players, courts, queue, games };
}
