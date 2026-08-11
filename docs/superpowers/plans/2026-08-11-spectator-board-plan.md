# 스펙테이터 실시간 현황판 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/badminton/[id]`에서 모임장이 아닌 모든 사람(참가자·게스트·비로그인 방문자)에게 코트·대기열·대기자·게임 기록을 실시간 읽기 전용으로 보여준다.

**Architecture:** `useBoardRealtime`의 매핑 로직(급수 변환, 코트/대기열/기록 파생)을 순수 함수 `buildSnapshot()`으로 `utils/boardSnapshot.ts`에 추출해 두 훅이 공유한다. 새 훅 `useBoardSpectator`는 같은 5개 테이블을 읽고 구독하지만 `board_player_state` seeding INSERT는 하지 않는다(비로그인 방문자의 쓰기를 막기 위함). 새 컴포넌트 `SpectatorBoard`가 이 훅을 사용해 상시 노출 대시보드를 그리고, `page.tsx`의 역할 분기가 모임장이 아니면 `OrganizerBoard` 대신 이를 렌더링한다.

**Tech Stack:** Next.js 15 (App Router), Supabase JS (`@supabase/supabase-js` realtime), TypeScript, 기존 UI 프리미티브(`@/components/ui/card`, `badge`, `collapsible`).

## Global Constraints

- **DB 변경 없음.** 이번 과제는 스키마·RLS를 전혀 건드리지 않는다 (모든 관련 SELECT 정책이 이미 `USING (true)`).
- **자동화 테스트 없음.** 이 저장소 관행대로 `pnpm dev` 수동 클릭 검증 + `npx tsc --noEmit` / `pnpm lint` / `pnpm build`로 확인한다.
- **`git add`/`git commit`을 실행하지 않는다.** 파일 수정과 검증만 하고, 스테이징·커밋은 사용자가 직접 진행한다.
- **`useBoardRealtime`의 동작(모임장 화면)은 한 글자도 바뀌면 안 된다.** 리팩터는 매핑 로직 위치만 옮기는 것이고, seeding INSERT·mutation 함수·구독 로직은 그대로 유지한다.
- **`useBoardSpectator`는 어떤 테이블에도 INSERT/UPDATE/DELETE를 하지 않는다.** 이게 이번 설계의 핵심 전제다.

---

## Task 1: 순수 매핑 모듈 `utils/boardSnapshot.ts` 추출

**Files:**
- Create: `src/utils/boardSnapshot.ts`

**Interfaces:**
- Consumes: `Player`, `GameRecord`, `Court`, `QueueItem` 타입(`@/hooks/useGameManager`), `CourtRow`, `BoardGameRow`, `BoardPlayerStateRow` 타입(`@/types/badminton`).
- Produces: `SKILL_LEVEL_TO_NUMBER` 상수, `RawSessionParticipant`/`RawGuestParticipant` 타입, `BoardSnapshotInput`/`BoardSnapshot` 타입, `buildSnapshot(input: BoardSnapshotInput): BoardSnapshot` 함수 — Task 2(`useBoardRealtime`)와 Task 3(`useBoardSpectator`)이 전부 이 함수를 사용한다.

- [ ] **Step 1: 파일 생성**

`src/hooks/useBoardRealtime.ts`에 있던 매핑 로직(급수 변환 맵, Raw 타입, `toPlayer`)을 그대로 옮기고, 코트/대기열/기록 파생 로직을 새 `buildSnapshot()` 함수로 뺀다.

```typescript
// src/utils/boardSnapshot.ts
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

export function buildSnapshot({ participants, guests, states, courtRows, gameRows }: BoardSnapshotInput): BoardSnapshot {
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
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: 에러 없음. (이 시점에는 아직 아무도 이 모듈을 import하지 않으므로 순수하게 `boardSnapshot.ts` 자체의 타입만 확인된다.)

---

## Task 2: `useBoardRealtime`이 `boardSnapshot`을 쓰도록 리팩터

**Files:**
- Modify: `src/hooks/useBoardRealtime.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `SKILL_LEVEL_TO_NUMBER`, `RawSessionParticipant`, `RawGuestParticipant` (Task 1, `@/utils/boardSnapshot`)

**주의:** 이 태스크는 순수 리팩터다. seeding INSERT(누락된 `board_player_state` 채우기), mutation 함수(`addPlayer`/`updatePlayer`/`assignQueueToCourt` 등), realtime 구독은 전부 그대로 둔다. 매핑 로직이 있던 자리만 `buildSnapshot()` 호출로 바뀐다.

- [ ] **Step 1: import 교체 및 중복 정의 삭제**

`src/hooks/useBoardRealtime.ts` 상단(1~56번째 줄)을 교체한다.

기존:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Player, GameRecord, Court, QueueItem } from '@/hooks/useGameManager';
import type { CourtRow, BoardGameRow, BoardPlayerStateRow } from '@/types/badminton';

const SKILL_LEVEL_FROM_NUMBER: Record<number, NonNullable<Player['skillLevel']>> = {
  0: 'E',
  1: 'D',
  2: 'C',
  3: 'B',
  4: 'A',
  5: 'S',
};

const SKILL_LEVEL_TO_NUMBER: Record<NonNullable<Player['skillLevel']>, number> = {
  E: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

interface RawSessionParticipant {
  id: string;
  user: { name: string; gender?: string; skill_level?: number } | null;
}

interface RawGuestParticipant {
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
```

교체:

```typescript
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
```

- [ ] **Step 2: `loadSnapshot`의 매핑 꼬리 부분을 `buildSnapshot()` 호출로 교체**

기존:

```typescript
    const existingStates = (stateRows ?? []) as BoardPlayerStateRow[];

    const stateBySp = new Map(
      existingStates.filter((s) => s.session_participant_id).map((s) => [s.session_participant_id as string, s]),
    );
    const stateByGp = new Map(
      existingStates.filter((s) => s.guest_participant_id).map((s) => [s.guest_participant_id as string, s]),
    );

    const missingInserts: Array<Record<string, unknown>> = [];
    participants.forEach((p) => {
      if (!stateBySp.has(p.id)) {
        missingInserts.push({ session_id: sessionId, session_participant_id: p.id });
      }
    });
    guests.forEach((g) => {
      if (!stateByGp.has(g.id)) {
        missingInserts.push({ session_id: sessionId, guest_participant_id: g.id });
      }
    });

    let allStates = existingStates;
    if (missingInserts.length > 0) {
      const { data: inserted } = await supabase.from('board_player_state').insert(missingInserts).select();
      allStates = [...existingStates, ...((inserted ?? []) as BoardPlayerStateRow[])];
    }

    const finalStateBySp = new Map(
      allStates.filter((s) => s.session_participant_id).map((s) => [s.session_participant_id as string, s]),
    );
    const finalStateByGp = new Map(
      allStates.filter((s) => s.guest_participant_id).map((s) => [s.guest_participant_id as string, s]),
    );

    const mappedPlayers: Player[] = [
      ...participants.filter((p) => p.user).map((p) => toPlayer(p.id, 'user', p.user!, finalStateBySp.get(p.id))),
      ...guests.map((g) => toPlayer(g.id, 'guest', g, finalStateByGp.get(g.id))),
    ];
    setPlayers(mappedPlayers);

    const games_ = (gameRows ?? []) as BoardGameRow[];

    const mappedCourts: Court[] = ((courtRows ?? []) as CourtRow[]).map((c) => {
      const activeGame = games_.find((g) => g.court_id === c.id && g.status === 'playing');
      return {
        id: c.id,
        name: c.name,
        playerIds: activeGame ? activeGame.player_ids : null,
        gameStartedAt: activeGame?.started_at ?? null,
        gameId: activeGame?.id ?? null,
      };
    });
    setCourts(mappedCourts);

    const mappedQueue: QueueItem[] = games_
      .filter((g) => g.status === 'queued')
      .map((g) => ({ id: g.id, playerIds: g.player_ids, queuedAt: g.queued_at }));
    setQueue(mappedQueue);

    const mappedGames: GameRecord[] = games_
      .filter((g) => g.status === 'completed')
      .map((g) => ({ id: g.id, players: g.player_ids, confirmedAt: g.completed_at! }));
    setGames(mappedGames);
  }, [sessionId]);
```

교체:

```typescript
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
```

- [ ] **Step 3: 타입 체크 및 lint**

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint
```

Expected: 둘 다 에러 없음. (`Player`/`GameRecord`/`Court`/`QueueItem`/`CourtRow`/`BoardGameRow`/`BoardPlayerStateRow`는 `addPlayer`/`updatePlayer`/`useState` 타입 등 파일 나머지 부분에서 계속 쓰이므로 미사용 import 경고는 발생하지 않아야 한다.)

- [ ] **Step 4: 수동 검증 — 모임장 화면 회귀 확인**

`pnpm dev`로 모임장 계정으로 `/badminton/[id]`에 접속해 다음이 리팩터 전과 동일하게 동작하는지 확인한다:
- 선수 등록 시 이름·성별·급수·나이대가 정확히 표시되는가 (급수 숫자→문자 변환 확인)
- 코트 배정 → 게임중 표시 → 게임 종료 흐름이 정상 동작하는가
- 대기열 추가/삭제, 게임 기록 확인이 정상 동작하는가
- 새로고침 후에도 상태가 유지되는가 (seeding INSERT가 여전히 동작하는지 간접 확인)

---

## Task 3: 읽기 전용 훅 `useBoardSpectator` 생성

**Files:**
- Create: `src/hooks/useBoardSpectator.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `RawSessionParticipant`, `RawGuestParticipant` (Task 1, `@/utils/boardSnapshot`)
- Produces: `useBoardSpectator(sessionId: string): { players: Player[]; courts: Court[]; queue: QueueItem[]; games: GameRecord[]; isLoading: boolean }` — Task 4(`SpectatorBoard`)가 사용한다. `useBoardRealtime`과 달리 mutation 함수를 하나도 반환하지 않는다.

- [ ] **Step 1: 파일 생성**

```typescript
// src/hooks/useBoardSpectator.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Player, GameRecord, Court, QueueItem } from '@/hooks/useGameManager';
import type { CourtRow, BoardGameRow, BoardPlayerStateRow } from '@/types/badminton';
import { buildSnapshot, type RawSessionParticipant, type RawGuestParticipant } from '@/utils/boardSnapshot';

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

    const snapshot = buildSnapshot({
      participants: (sessionParticipants ?? []) as unknown as RawSessionParticipant[],
      guests: (guestParticipants ?? []) as RawGuestParticipant[],
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
```

**채널 이름을 `board-${sessionId}`가 아니라 `board-spectator-${sessionId}`로 다르게 짓는 이유:** 같은 세션을 보는 다른 역할(모임장 vs 스펙테이터)이 서로 다른 Supabase Realtime 채널 인스턴스를 갖게 해 구독 충돌 가능성을 없앤다.

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: 에러 없음. (이 시점에는 아직 아무 컴포넌트도 이 훅을 쓰지 않으므로 훅 자체의 타입만 확인된다.)

---

## Task 4: `SpectatorBoard` 컴포넌트 생성

**Files:**
- Create: `src/components/badminton/SpectatorBoard.tsx`

**Interfaces:**
- Consumes: `useBoardSpectator` (Task 3, `@/hooks/useBoardSpectator`), `useTicker`(`@/hooks/useTicker`), `formatElapsed`(`@/utils/formatElapsed`), `Card`/`CardHeader`/`CardTitle`/`CardContent`(`@/components/ui/card`), `Badge`(`@/components/ui/badge`), `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`(`@/components/ui/collapsible`).
- Produces: `<SpectatorBoard sessionId={string} />` — Task 5가 `page.tsx`에서 렌더링한다.

- [ ] **Step 1: 파일 생성**

```typescript
// src/components/badminton/SpectatorBoard.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Clock } from 'lucide-react';
import { useBoardSpectator } from '@/hooks/useBoardSpectator';
import { useTicker } from '@/hooks/useTicker';
import { formatElapsed } from '@/utils/formatElapsed';

interface SpectatorBoardProps {
  sessionId: string;
}

export default function SpectatorBoard({ sessionId }: SpectatorBoardProps) {
  const { players, courts, queue, games, isLoading } = useBoardSpectator(sessionId);
  const now = useTicker();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '알 수 없음';

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">현황판을 불러오는 중...</p>
      </div>
    );
  }

  const waitingPlayers = players
    .filter((p) => p.attending && p.status === 'active')
    .sort((a, b) => {
      const aTime = a.waitingSince ? new Date(a.waitingSince).getTime() : 0;
      const bTime = b.waitingSince ? new Date(b.waitingSince).getTime() : 0;
      return aTime - bTime;
    });

  const recentGames = [...games].reverse().slice(0, 10);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">코트 현황</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {courts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">아직 코트가 없습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {courts.map((court) => {
                const isActive = court.playerIds !== null;
                return (
                  <div
                    key={court.id}
                    className={`border rounded-lg p-3 ${
                      isActive ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{court.name}</span>
                      {isActive ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatElapsed(court.gameStartedAt, now) ?? '방금'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 text-xs">
                          비어있음
                        </Badge>
                      )}
                    </div>
                    {isActive && court.playerIds && (
                      <div className="grid grid-cols-2 gap-1">
                        {court.playerIds.map((pid) => (
                          <span
                            key={pid}
                            className="text-xs bg-white border border-green-200 rounded px-2 py-1 text-center truncate"
                          >
                            {getPlayerName(pid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">
            대기열
            {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {queue.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">대기 중인 게임이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item, idx) => (
                <div key={item.id} className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">#{idx + 1}</Badge>
                    <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatElapsed(item.queuedAt, now) ?? '방금'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {item.playerIds.map((pid) => (
                      <span
                        key={pid}
                        className="text-xs bg-white border border-purple-200 rounded px-2 py-1 text-center truncate"
                      >
                        {getPlayerName(pid)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">
            대기 중
            {waitingPlayers.length > 0 && <span className="text-sm text-gray-500 ml-2">({waitingPlayers.length}명)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {waitingPlayers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">대기 중인 선수가 없습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {waitingPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2 border rounded-lg bg-white">
                  <span className="font-medium text-sm">{player.name}</span>
                  {player.waitingSince && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatElapsed(player.waitingSince, now)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">오늘 게임 기록 ({games.length})</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {games.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">아직 완료된 게임이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {recentGames.map((game, index) => {
                    const gameNumber = games.length - index;
                    const date = new Date(game.confirmedAt).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div key={game.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Game #{gameNumber}</Badge>
                          <span className="text-xs text-gray-500">{date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {game.players.map((pid) => (
                            <div key={pid} className="text-sm p-1.5 bg-gray-50 rounded">
                              {getPlayerName(pid)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {games.length > 10 && (
                    <p className="text-center text-xs text-gray-500 mt-2">최근 10개 게임만 표시됩니다</p>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크 및 lint**

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint
```

Expected: 둘 다 에러 없음.

---

## Task 5: `page.tsx` 역할 분기 연결

**Files:**
- Modify: `src/app/badminton/[id]/page.tsx`

**Interfaces:**
- Consumes: `SpectatorBoard` (Task 4, `@/components/badminton/SpectatorBoard`)

- [ ] **Step 1: import 추가**

`src/app/badminton/[id]/page.tsx` 9번째 줄(`OrganizerBoard` import) 바로 아래에 추가:

```typescript
import SpectatorBoard from '@/components/badminton/SpectatorBoard';
```

- [ ] **Step 2: `isOrganizer` 변수 추가**

`sessionDateTime` 계산 바로 다음, `return (` 바로 앞(224~232번째 줄 사이)에 추가:

기존:

```typescript
  const sessionDateTime = new Date(session.session_date).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
```

교체:

```typescript
  const sessionDateTime = new Date(session.session_date).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isOrganizer = user?.id === session.creator_id;

  return (
```

- [ ] **Step 3: 역할 분기 렌더링으로 교체**

기존:

```typescript
        {/* 게임 관리 (모임장 전용) */}
        {user?.id === session.creator_id && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">게임 관리</h2>
            {session.status === 'completed' ? (
              <p className="text-sm text-gray-500">종료된 모임입니다. 게임 관리 기능은 사용할 수 없습니다.</p>
            ) : (
              <OrganizerBoard sessionId={session.id} />
            )}
          </div>
        )}
```

교체:

```typescript
        {/* 게임 관리 (모임장) / 실시간 현황판 (그 외 전원) */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">{isOrganizer ? '게임 관리' : '실시간 현황판'}</h2>
          {session.status === 'completed' ? (
            <p className="text-sm text-gray-500">
              종료된 모임입니다. {isOrganizer ? '게임 관리' : '현황판'} 기능은 사용할 수 없습니다.
            </p>
          ) : isOrganizer ? (
            <OrganizerBoard sessionId={session.id} />
          ) : (
            <SpectatorBoard sessionId={session.id} />
          )}
        </div>
```

- [ ] **Step 4: 타입 체크 및 lint**

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint
```

Expected: 둘 다 에러 없음.

---

## Task 6: 통합 수동 검증

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 실시간 반영 확인**

`pnpm dev` 실행 후, 모임장 계정으로 브라우저 A에서 `/badminton/[id]`에 접속하고, 시크릿 창(브라우저 B, 비로그인)으로 같은 세션 URL에 접속한다.

브라우저 A(모임장)에서 다음을 차례로 수행하며 브라우저 B(현황판)에 실시간 반영되는지 확인한다:
- 참석자 체크 → B의 "대기 중" 목록에 등장
- 팀 뽑기 → 대기열에 추가 → B의 "대기열" 섹션에 등장, 경과 시간이 흐름
- 대기열을 코트에 배정 → B의 "코트 현황"에서 해당 코트가 "게임중"으로 바뀌고 선수 이름이 보임, 경과 시간이 흐름
- 게임 종료 → B의 "코트 현황"이 "비어있음"으로 바뀌고, "오늘 게임 기록"을 펼치면 방금 끝난 게임이 최상단에 보임

- [ ] **Step 2: 쓰기 미발생 확인 (핵심 전제)**

브라우저 B(시크릿 창)의 개발자 도구 Network 탭을 열고, Step 1의 이벤트들을 다시 한번 발생시킨다. `board_player_state`를 대상으로 하는 POST 요청이 **한 건도 발생하지 않는지** 확인한다. (참고: Supabase REST 요청은 보통 `rest/v1/board_player_state`처럼 테이블명이 URL에 노출된다.)

- [ ] **Step 3: 종료된 모임 확인**

Supabase 대시보드 또는 모임장 화면에서 아무 세션이나 `status`를 `completed`로 바꾼 뒤(또는 이미 종료된 세션이 있다면 그걸 사용), 비로그인 상태로 그 세션 URL에 접속해 "종료된 모임입니다. 현황판 기능은 사용할 수 없습니다."가 뜨고 보드가 렌더링되지 않는지 확인한다.

- [ ] **Step 4: 최종 lint/build**

```bash
pnpm lint
pnpm build
```

Expected: 둘 다 에러 없음. (`pnpm build`는 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 환경변수가 있어야 정적 생성까지 통과한다 — 플레이스홀더 값이어도 컴파일/타입 에러는 잡힌다.)
