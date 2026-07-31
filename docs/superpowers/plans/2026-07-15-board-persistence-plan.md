# 배드민턴 보드 서버 영속화 (1단계) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) sytax for tracking.

**Goal:** `/game-manager`가 localStorage에만 저장하던 선수/코트/대기열/게임 상태를 Supabase에 서버 영속화하고,
`/badminton/[id]`에서 모임장이 실시간으로 조작할 수 있게 만든다.

**Architecture:** 기존 `badminton_sessions`/`session_participants`/`guest_participants` 테이블은 전혀 변경하지
않고, 새 테이블 3개(`board_player_state`, `courts`, `board_games`)만 추가한다. 새 훅 `useBoardRealtime`이
이 3개 테이블을 Supabase Realtime으로 구독하며, 기존 로컬 훅 `useGameManager`와 동일한 반환 shape(`Player`,
`Court`, `GameRecord`, `QueueItem` 타입과 동일한 함수 시그니처)을 제공해서 기존 게임 관리 UI 컴포넌트
(`PlayerList`, `TeamPicker`, `CourtManager`, `GameQueue`, `GameHistory` 등)를 그대로 재사용한다. 이 UI를
새 컴포넌트 `OrganizerBoard`로 감싸서 `/badminton/[id]`에 모임장에게만 보이도록 배치한다.

**Tech Stack:** Next.js 15 (App Router), Supabase (`@supabase/supabase-js` realtime), React Hook Form + Zod
(기존 패턴 재사용), TypeScript.

## Global Constraints

- **DB 변경은 전부 additive다.** `ALTER TABLE`/`DROP TABLE` 금지. `CREATE TABLE`만 사용하고, 기존
  `badminton_sessions`/`session_participants`/`guest_participants`/`teams`/`team_members`/`games`는
  스키마·정책 모두 손대지 않는다.
- **이 저장소에는 자동화 테스트가 없다.** Jest/Vitest 등을 새로 설치하지 않는다. 각 태스크의 검증은
  `pnpm dev`로 직접 클릭해보고 `pnpm lint`/`pnpm build`로 확인하는 기존 프로젝트 관행을 따른다
  (`.claude/plans/게임-관리-페이지-구현-계획.md`와 동일한 방식).
- **`git add`/`git commit`을 실행하지 않는다.** (2026-07-15 수정: 최초 작성 시에는 "`git add`까지는
  해도 된다"였으나, 이후 사용자가 스테이징도 직접 하겠다고 범위를 넓혀 지금은 스테이징조차 하지 않는다.
  최신 규칙은 `CLAUDE.md`의 Git Workflow 섹션 참고.) 파일 수정과 검증만 하고, 스테이징/커밋은 전부
  사용자에게 맡긴다.
- **모임장만 조작 가능.** 참가자 셀프 조작(참석 토글 등)과 스펙테이터 읽기 전용 화면은 이번 범위 밖이다
  (설계 문서의 2·3번 과제).
- **UI 시각 디자인은 이번에 바꾸지 않는다.** 기존 아코디언 레이아웃 그대로 `/badminton/[id]`로 옮긴다.

## 구현 노트 (설계 문서 대비 세부 결정)

- **선수 등록(`addPlayer`) = `guest_participants` insert.** 모임장이 현장에서 이름을 직접 타이핑해
  등록하는 지금 방식은 서버에서도 "게스트 참가자를 대신 등록"하는 것으로 매핑한다. 이러면 2번 과제(참가자
  셀프 등록)와 같은 테이블을 쓰게 되어 이후 통합이 쉬워진다.
- **`PlayerForm`은 성별/급수/나이대가 전부 선택 사항(선택안함 가능)인데, `guest_participants` 테이블은
  이 3개 컬럼이 `NOT NULL`이다.** 값을 비워서 등록하면 서버에는 기본값(성별 `male`, 급수 `E`(0), 나이대
  `20s`)으로 저장된다. 로컬 모델은 `undefined`를 허용했던 것과의 차이이며, 실제 클럽 사용에서는 조직자가
  이 값들을 항상 채워 넣는 경우가 대부분이라 큰 영향은 없을 것으로 판단한다.
- **`updatePlayer`는 두 종류의 필드를 다른 테이블로 분기한다.** `status`/`pinned`/`waitingSince`는
  `board_player_state`로, `name`/`gender`/`skillLevel`/`ageGroup`은 `guest_participants`로 보낸다.
  로그인 참가자(`session_participants`)의 이름/성별/급수는 계정 프로필에 속하므로 이 화면에서 수정할 수
  없고, 시도하면 토스트로 안내한다.
- **`removePlayer`는 게스트면 `guest_participants` 행을 직접 삭제하고, 로그인 참가자면 기존
  `/api/badminton/sessions/remove-participant` API(이미 구현되어 있음)를 재사용한다.**
- **`cancelCourtGame`은 대기 시작 시각을 취소 시점으로 재설정한다.** 로컬 모델은 게임 시작 직전의
  정확한 대기 시작 시각을 복원하지만, 이를 위해서는 스냅샷 컬럼이 추가로 필요해 범위를 넘어선다. 취소
  시 "지금부터 다시 대기 시작"으로 단순화한다.
- **`resetPlayers`는 게스트 참가자만 삭제한다.** 로그인 참가자(실제 계정)를 이 버튼으로 세션에서
  제거하지는 않는다 (기존 강제 퇴장 기능과 별개로 둔다).

---

## Task 1: 데이터베이스 스키마 추가

**Files:**
- Modify: `supabase-schema.sql` (파일 끝에 추가)

**Interfaces:**
- Produces: 테이블 `board_player_state(id, session_id, session_participant_id, guest_participant_id,
  attending, player_status, pinned, waiting_since)`, `courts(id, session_id, name, sort_order,
  created_at)`, `board_games(id, session_id, court_id, player_ids, status, queued_at, started_at,
  completed_at)` — 이후 모든 태스크가 이 3개 테이블을 사용한다.

- [ ] **Step 1: `supabase-schema.sql` 끝에 새 테이블 추가**

```sql
-- ============================================================
-- Board persistence tables (배드민턴 보드 서버 영속화, additive only)
-- ============================================================

CREATE TABLE board_player_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  session_participant_id UUID REFERENCES session_participants(id) ON DELETE CASCADE,
  guest_participant_id UUID REFERENCES guest_participants(id) ON DELETE CASCADE,
  attending BOOLEAN NOT NULL DEFAULT false,
  player_status TEXT NOT NULL DEFAULT 'resting'
    CHECK (player_status IN ('active', 'resting', 'playing', 'queued')),
  pinned BOOLEAN NOT NULL DEFAULT false,
  waiting_since TIMESTAMP WITH TIME ZONE,
  CHECK (num_nonnulls(session_participant_id, guest_participant_id) = 1),
  UNIQUE (session_participant_id),
  UNIQUE (guest_participant_id)
);

CREATE TABLE courts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE board_games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  player_ids UUID[4] NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'completed')),
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_board_player_state_session_id ON board_player_state(session_id);
CREATE INDEX idx_courts_session_id ON courts(session_id);
CREATE INDEX idx_board_games_session_id ON board_games(session_id);
CREATE INDEX idx_board_games_court_id ON board_games(court_id);

ALTER TABLE board_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_games ENABLE ROW LEVEL SECURITY;

-- board_player_state: 누구나 읽기, 누구나 자기 상태 행 생성(추후 셀프 등록/셀프 토글 대비),
-- 수정/삭제는 세션 생성자만
CREATE POLICY "Anyone can read board player state" ON board_player_state FOR SELECT USING (true);
CREATE POLICY "Anyone can insert board player state" ON board_player_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Session creators can update board player state" ON board_player_state FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = board_player_state.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);
CREATE POLICY "Session creators can delete board player state" ON board_player_state FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = board_player_state.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- courts: 누구나 읽기, 세션 생성자만 쓰기
CREATE POLICY "Anyone can read courts" ON courts FOR SELECT USING (true);
CREATE POLICY "Session creators can manage courts" ON courts FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = courts.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- board_games: 누구나 읽기, 세션 생성자만 쓰기
CREATE POLICY "Anyone can read board games" ON board_games FOR SELECT USING (true);
CREATE POLICY "Session creators can manage board games" ON board_games FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = board_games.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);
```

- [ ] **Step 2: Supabase 대시보드 SQL 에디터에서 위 블록 실행**

`supabase-schema.sql`은 이 프로젝트에서 마이그레이션 도구가 아니라 스키마 스냅샷 문서다(기존
`teams`/`games` 등도 같은 방식으로 추가됐음). Supabase 프로젝트의 SQL Editor에 Step 1의 SQL 블록을
그대로 붙여넣고 실행한다.

- [ ] **Step 3: 수동 검증 — SQL 에디터에서 직접 확인**

```sql
-- 임의의 기존 세션 id로 교체해서 실행
select * from badminton_sessions limit 1;
-- 위에서 얻은 id로:
insert into courts (session_id, name) values ('<session-id>', '코트 1') returning *;
insert into board_player_state (session_id, guest_participant_id)
  select '<session-id>', id from guest_participants where session_id = '<session-id>' limit 1
  returning *;
```

두 INSERT가 에러 없이 실행되고 `returning`으로 행이 반환되면 통과. 이후 `delete from courts where name
= '코트 1';` 등으로 테스트 데이터를 정리한다.

- [ ] **Step 4: 완료** (스테이징/커밋은 하지 않음 — 사용자가 직접 진행)

---

## Task 2: TypeScript 타입 추가

**Files:**
- Modify: `src/types/badminton.ts` (파일 끝에 추가)
- Modify: `src/hooks/useGameManager.ts:4-14` (Player 인터페이스에 선택 필드 1개 추가)

**Interfaces:**
- Consumes: 없음 (순수 타입 추가)
- Produces: `CourtRow`, `BoardGameRow`, `BoardPlayerStateRow` 타입 — Task 3(`useBoardRealtime`)이 이
  타입들을 가져다 DB 응답을 매핑한다. `Player.participantType?: 'user' | 'guest'` — Task 3의
  `removePlayer`/`updatePlayer`가 참가자 종류를 구분하는 데 쓴다.

- [ ] **Step 1: `src/types/badminton.ts` 끝에 추가**

```typescript
export interface CourtRow {
  id: string;
  session_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface BoardGameRow {
  id: string;
  session_id: string;
  court_id: string | null;
  player_ids: [string, string, string, string];
  status: 'queued' | 'playing' | 'completed';
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface BoardPlayerStateRow {
  id: string;
  session_id: string;
  session_participant_id: string | null;
  guest_participant_id: string | null;
  attending: boolean;
  player_status: 'active' | 'resting' | 'playing' | 'queued';
  pinned: boolean;
  waiting_since: string | null;
}
```

- [ ] **Step 2: `src/hooks/useGameManager.ts`의 `Player` 인터페이스에 선택 필드 추가**

`src/hooks/useGameManager.ts:4-14`를 아래처럼 수정 (기존 필드는 그대로 두고 `participantType` 한 줄만
추가 — 로컬 훅 동작에는 영향 없는 추가 전용 변경):

```typescript
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
}
```

- [ ] **Step 3: 타입 체크로 검증**

```bash
pnpm build
```

Expected: 기존과 동일하게 빌드 성공 (새 필드는 optional이라 기존 코드에 영향 없음).

- [ ] **Step 4: 완료** (스테이징/커밋은 하지 않음 — 사용자가 직접 진행)

---

## Task 3: `useBoardRealtime` 훅 구현

**Files:**
- Create: `src/hooks/useBoardRealtime.ts`

**Interfaces:**
- Consumes: `Player`, `GameRecord`, `Court`, `QueueItem` 타입 (`@/hooks/useGameManager`에서 import,
  Task 2에서 `Player`에 필드 추가됨), `CourtRow`/`BoardGameRow`/`BoardPlayerStateRow` (`@/types/badminton`,
  Task 2), `supabase` 클라이언트 (`@/lib/supabase`).
- Produces: `useBoardRealtime(sessionId: string)` 훅. 반환값:
  `{ players: Player[], games: GameRecord[], courts: Court[], queue: QueueItem[], isLoading: boolean,
  addPlayer, removePlayer, updatePlayer, setAttending, setAttendingBulk, removeGame, resetPlayers,
  resetGames, addCourt, removeCourt, renameCourt, enqueueGame, removeFromQueue, assignQueueToCourt,
  endCourtGame, cancelCourtGame }` — `useGameManager`와 동일한 이름·시그니처. Task 4(`OrganizerBoard`)가
  이 훅을 `useGameManager` 대신 사용한다.

- [ ] **Step 1: 파일 생성 — 매핑 유틸과 스냅샷 로딩까지**

`src/hooks/useBoardRealtime.ts`:

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

  // 다음 스텝에서 mutation 함수들을 이어서 추가한다
  return { players, games, courts, queue, isLoading, loadSnapshot };
}
```

- [ ] **Step 2: 수동 검증 — 스냅샷 로딩만 임시로 확인**

`src/app/badminton/[id]/page.tsx` 최상단에 임시로 `console.log(useBoardRealtime(sessionId))`를 추가하지
말고, 대신 브라우저 개발자 도구 콘솔에서 아래를 실행해 `loadSnapshot` 로직이 기대대로 동작하는지 확인할
수 없으므로 이 스텝은 Task 4에서 UI에 연결한 뒤 함께 검증한다. 여기서는 `pnpm build`로 타입 에러만 먼저
잡는다.

```bash
pnpm build
```

Expected: 빌드 성공 (아직 아무 컴포넌트도 이 훅을 사용하지 않으므로 dead code 경고만 있을 수 있음 —
있다면 무시).

- [ ] **Step 3: mutation 함수 추가 — 선수 관련**

같은 파일의 `return` 문 바로 위에 추가하고, `return`에 함수들을 포함시킨다:

```typescript
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
```

- [ ] **Step 4: mutation 함수 추가 — 코트/대기열/게임 관련**

같은 위치에 이어서 추가:

```typescript
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
        (item.player_ids as string[]).map((id) => updatePlayerState(id, { player_status: 'active', waiting_since: nowIso })),
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
        (item.player_ids as string[]).map((id) => updatePlayerState(id, { player_status: 'playing', waiting_since: null })),
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
        (game.player_ids as string[]).map((id) => updatePlayerState(id, { player_status: 'active', waiting_since: nowIso })),
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
        (game.player_ids as string[]).map((id) => updatePlayerState(id, { player_status: 'active', waiting_since: nowIso })),
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
```

그리고 마지막 `return` 문을 아래로 교체:

```typescript
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
```

- [ ] **Step 5: 타입 체크**

```bash
pnpm build
```

Expected: 빌드 성공. 실패하면 `Player`/`Court`/`GameRecord`/`QueueItem` 필드명이 Task 2에서 추가한
정의와 정확히 일치하는지 확인한다.

- [ ] **Step 6: 완료** (스테이징/커밋은 하지 않음 — 사용자가 직접 진행)

---

## Task 4: `OrganizerBoard` 컴포넌트 — 게임 관리 UI를 서버 훅으로 이식

**Files:**
- Create: `src/components/badminton/OrganizerBoard.tsx`

**Interfaces:**
- Consumes: `useBoardRealtime(sessionId)` (Task 3), 기존 컴포넌트 `PlayerForm`, `PlayerList`,
  `PlayerEditModal`, `AttendancePickerModal`, `TeamPicker`, `CustomTeamPicker`, `GameHistory`,
  `CourtManager`, `GameQueue`(모두 `src/components/game-manager/*`, 변경 없이 그대로 import),
  `randomTeamPicker` (`@/utils/smartTeamPicker`).
- Produces: `<OrganizerBoard sessionId={string} />` — Task 5가 `/badminton/[id]` 페이지에서 모임장에게만
  렌더링한다.

- [ ] **Step 1: `src/components/badminton/OrganizerBoard.tsx` 생성**

`src/app/game-manager/page.tsx`의 로직을 그대로 옮기되, `useGameManager()` 호출을
`useBoardRealtime(sessionId)`로 바꾸고, 뒤로가기 헤더(이미 `/badminton/[id]`에 자체 헤더가 있으므로
불필요)를 제거한다:

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useBoardRealtime } from '@/hooks/useBoardRealtime';
import { Player } from '@/hooks/useGameManager';
import PlayerForm from '@/components/game-manager/PlayerForm';
import PlayerList, { AttendanceFilter } from '@/components/game-manager/PlayerList';
import PlayerEditModal from '@/components/game-manager/PlayerEditModal';
import AttendancePickerModal from '@/components/game-manager/AttendancePickerModal';
import TeamPicker from '@/components/game-manager/TeamPicker';
import CustomTeamPicker from '@/components/game-manager/CustomTeamPicker';
import GameHistory from '@/components/game-manager/GameHistory';
import CourtManager from '@/components/game-manager/CourtManager';
import GameQueue from '@/components/game-manager/GameQueue';
import { randomTeamPicker } from '@/utils/smartTeamPicker';

interface OrganizerBoardProps {
  sessionId: string;
}

export default function OrganizerBoard({ sessionId }: OrganizerBoardProps) {
  const {
    players,
    games,
    courts,
    queue,
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
    isLoading,
  } = useBoardRealtime(sessionId);

  const [pickedPlayers, setPickedPlayers] = useState<[Player, Player, Player, Player] | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [isAttendancePickerOpen, setIsAttendancePickerOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('attending');
  const [openSections, setOpenSections] = useState({
    registration: false,
    playerList: true,
    teamPicker: true,
    queue: true,
    courtManager: true,
    gameHistory: false,
    resetActions: false,
  });

  const toggleSection = useCallback((key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      game.players.forEach((playerId) => {
        counts.set(playerId, (counts.get(playerId) || 0) + 1);
      });
    });
    return counts;
  }, [games]);

  const handleAddPlayer = useCallback(
    (playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => {
      addPlayer(playerData);
      toast.success(`${playerData.name} 선수가 등록되었습니다 (미참석 상태)`);
    },
    [addPlayer],
  );

  const handleRemovePlayer = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (player && confirm(`${player.name} 선수를 삭제하시겠습니까?`)) {
        removePlayer(id);
        toast.success('선수가 삭제되었습니다');
        if (pickedPlayers?.some((p) => p.id === id)) {
          setPickedPlayers(null);
        }
      }
    },
    [players, removePlayer, pickedPlayers],
  );

  const handleRandomPickTeams = useCallback(() => {
    const activePlayers = players.filter((p) => p.status === 'active');
    if (activePlayers.length < 4) {
      toast.error('최소 4명의 활성 선수가 필요합니다');
      return;
    }
    try {
      setPickedPlayers(randomTeamPicker(players));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '선수를 뽑는데 실패했습니다');
    }
  }, [players]);

  const handleConfirmGame = useCallback(() => {
    if (!pickedPlayers) return;
    const playerIds = pickedPlayers.map((p) => p.id) as [string, string, string, string];
    enqueueGame(playerIds);
    toast.success('대기열에 추가되었습니다', {
      description: `선수: ${pickedPlayers.map((p) => p.name).join(', ')}`,
      duration: 4000,
    });
    setPickedPlayers(null);
    setIsCustomPicking(false);
  }, [pickedPlayers, enqueueGame]);

  const handleAssignQueueToCourt = useCallback(
    (queueItemId: string, courtId: string) => {
      assignQueueToCourt(queueItemId, courtId);
      const court = courts.find((c) => c.id === courtId);
      toast.success(`${court?.name ?? '코트'}에 배정되었습니다!`);
    },
    [assignQueueToCourt, courts],
  );

  const handleRemoveFromQueue = useCallback(
    (queueItemId: string) => {
      if (confirm('대기열에서 이 게임을 취소하시겠습니까?')) {
        removeFromQueue(queueItemId);
        toast.success('대기열에서 취소되었습니다');
      }
    },
    [removeFromQueue],
  );

  const handleRemoveCourt = useCallback(
    (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (court?.playerIds !== null) {
        toast.error('게임중인 코트는 삭제할 수 없습니다');
        return;
      }
      removeCourt(id);
    },
    [courts, removeCourt],
  );

  const handleEndCourtGame = useCallback(
    (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (!court?.playerIds) return;
      if (confirm(`${court.name} 게임을 종료하시겠습니까?`)) {
        endCourtGame(id);
        toast.success(`${court.name} 게임이 종료되었습니다. 선수들이 복귀했습니다`);
      }
    },
    [courts, endCourtGame],
  );

  const handleCancelCourtGame = useCallback(
    (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (!court?.playerIds) return;
      if (confirm(`${court.name} 게임을 취소하시겠습니까?\n(게임 기록이 남지 않습니다)`)) {
        cancelCourtGame(id);
        toast.success(`${court.name} 게임이 취소되었습니다`);
      }
    },
    [courts, cancelCourtGame],
  );

  const handleCustomConfirm = useCallback((selected: [Player, Player, Player, Player]) => {
    setPickedPlayers(selected);
    setIsCustomPicking(false);
  }, []);

  const handleEditPlayer = useCallback((player: Player) => setEditingPlayer(player), []);

  const handleUpdatePlayer = useCallback(
    (id: string, updates: Partial<Omit<Player, 'id'>>) => {
      updatePlayer(id, updates);
    },
    [updatePlayer],
  );

  const handleToggleStatus = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'active') {
        updatePlayer(id, { status: 'resting', pinned: false, waitingSince: null });
        toast.success(`${player.name} 선수가 휴식 상태로 변경되었습니다`);
        if (pickedPlayers?.some((p) => p.id === id)) setPickedPlayers(null);
      } else {
        updatePlayer(id, { status: 'active', waitingSince: new Date().toISOString() });
        toast.success(`${player.name} 선수가 활성 상태로 변경되었습니다`);
      }
    },
    [players, updatePlayer, pickedPlayers],
  );

  const handleTogglePinned = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'resting') {
        toast.error('휴식중인 선수는 필수 포함할 수 없습니다');
        return;
      }
      updatePlayer(id, { pinned: !player.pinned });
      if (pickedPlayers) setPickedPlayers(null);
    },
    [players, updatePlayer, pickedPlayers],
  );

  const handleToggleAttending = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'playing' || player.status === 'queued') {
        toast.error('게임중이거나 대기열에 있는 선수는 변경할 수 없습니다');
        return;
      }
      setAttending(id, !player.attending);
      if (pickedPlayers?.some((p) => p.id === id)) setPickedPlayers(null);
    },
    [players, setAttending, pickedPlayers],
  );

  const handleBulkAttending = useCallback(
    (attendingIds: string[]) => {
      setAttendingBulk(attendingIds);
      toast.success(`오늘 참석자 ${attendingIds.length}명이 설정되었습니다`);
      setPickedPlayers(null);
    },
    [setAttendingBulk],
  );

  const handleRemoveGame = useCallback(
    (id: string) => {
      if (confirm('이 게임 기록을 삭제하시겠습니까?')) {
        removeGame(id);
        toast.success('게임 기록이 삭제되었습니다');
      }
    },
    [removeGame],
  );

  const handleResetGames = useCallback(() => {
    if (games.length === 0) {
      toast.error('삭제할 게임 기록이 없습니다');
      return;
    }
    if (confirm('모든 게임 기록을 삭제하시겠습니까?')) {
      resetGames();
      toast.success('게임 기록이 초기화되었습니다');
    }
  }, [games.length, resetGames]);

  const handleResetPlayers = useCallback(() => {
    if (players.length === 0) {
      toast.error('삭제할 선수가 없습니다');
      return;
    }
    if (confirm('게스트로 등록된 선수 전원을 삭제하시겠습니까?\n(로그인 참가자는 유지됩니다)')) {
      resetPlayers();
      setPickedPlayers(null);
      toast.success('게스트 선수 목록이 초기화되었습니다');
    }
  }, [players.length, resetPlayers]);

  const handleResetAttendance = useCallback(() => {
    if (!players.some((p) => p.attending)) {
      toast.error('참석 처리된 선수가 없습니다');
      return;
    }
    if (confirm('모든 선수의 오늘 참석을 해제하시겠습니까?')) {
      setAttendingBulk([]);
      setPickedPlayers(null);
      toast.success('참석이 모두 해제되었습니다');
    }
  }, [players, setAttendingBulk]);

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">보드 데이터를 불러오는 중...</p>
      </div>
    );
  }

  const attendingCount = players.filter((p) => p.attending).length;
  const activeCount = players.filter((p) => p.status === 'active').length;
  const playingCount = players.filter((p) => p.status === 'playing').length;
  const queuedCount = players.filter((p) => p.status === 'queued').length;

  return (
    <div className="space-y-3">
      <Collapsible open={openSections.registration} onOpenChange={() => toggleSection('registration')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">선수 등록</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.registration ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <PlayerForm onAddPlayer={handleAddPlayer} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.playerList} onOpenChange={() => toggleSection('playerList')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  인원 풀 (참석 {attendingCount}/{players.length}명)
                  {(activeCount > 0 || playingCount > 0 || queuedCount > 0) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (활성: {activeCount}
                      {playingCount > 0 && <> · 게임중: {playingCount}</>}
                      {queuedCount > 0 && <> · 대기열: {queuedCount}</>})
                    </span>
                  )}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.playerList ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <PlayerList
                players={players}
                onRemovePlayer={handleRemovePlayer}
                onEditPlayer={handleEditPlayer}
                onToggleStatus={handleToggleStatus}
                onTogglePinned={handleTogglePinned}
                onToggleAttending={handleToggleAttending}
                onOpenAttendancePicker={() => setIsAttendancePickerOpen(true)}
                filter={attendanceFilter}
                onFilterChange={setAttendanceFilter}
                gameCountsMap={playerGameCounts}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.teamPicker} onOpenChange={() => toggleSection('teamPicker')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">팀 뽑기</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.teamPicker ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {isCustomPicking ? (
                <CustomTeamPicker
                  players={players}
                  onConfirm={handleCustomConfirm}
                  onCancel={() => {
                    setIsCustomPicking(false);
                    setPickedPlayers(null);
                  }}
                />
              ) : (
                <TeamPicker
                  players={players}
                  games={games}
                  pickedPlayers={pickedPlayers}
                  onRandomPick={handleRandomPickTeams}
                  onConfirm={handleConfirmGame}
                  onReject={handleRandomPickTeams}
                  onCustomPick={() => setIsCustomPicking(true)}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.queue} onOpenChange={() => toggleSection('queue')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  대기열
                  {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.queue ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <GameQueue
                queue={queue}
                courts={courts}
                players={players}
                onAssignCourt={handleAssignQueueToCourt}
                onRemove={handleRemoveFromQueue}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.courtManager} onOpenChange={() => toggleSection('courtManager')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  코트 관리
                  {courts.some((c) => c.playerIds !== null) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (게임중: {courts.filter((c) => c.playerIds !== null).length}개)
                    </span>
                  )}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.courtManager ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <CourtManager
                courts={courts}
                players={players}
                onAddCourt={addCourt}
                onRemoveCourt={handleRemoveCourt}
                onRenameCourt={renameCourt}
                onEndGame={handleEndCourtGame}
                onCancelGame={handleCancelCourtGame}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.gameHistory} onOpenChange={() => toggleSection('gameHistory')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">게임 기록 ({games.length})</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.gameHistory ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <GameHistory games={games} players={players} onRemoveGame={handleRemoveGame} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.resetActions} onOpenChange={() => toggleSection('resetActions')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">초기화</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.resetActions ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button onClick={handleResetAttendance} variant="secondary" size="sm">
                  참석 전체 해제
                </Button>
                <Button onClick={handleResetGames} variant="outline" size="sm">
                  게임 기록 초기화
                </Button>
                <Button onClick={handleResetPlayers} variant="destructive" size="sm">
                  게스트 선수 초기화
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <PlayerEditModal
        player={editingPlayer}
        isOpen={editingPlayer !== null}
        onClose={() => setEditingPlayer(null)}
        onUpdate={handleUpdatePlayer}
      />

      <AttendancePickerModal
        isOpen={isAttendancePickerOpen}
        onClose={() => setIsAttendancePickerOpen(false)}
        players={players}
        onConfirm={handleBulkAttending}
      />
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm build
```

Expected: 빌드 성공. `PlayerList`/`TeamPicker`/`CourtManager`/`GameQueue`/`GameHistory` 등 기존 컴포넌트의
prop 타입과 어긋나면 여기서 에러가 난다 — 에러 메시지의 prop 이름을 이 파일의 호출부와 대조해서 고친다.

- [ ] **Step 3: 완료** (스테이징/커밋은 하지 않음 — 사용자가 직접 진행)

---

## Task 5: `/badminton/[id]` 페이지에 역할별 렌더링 연결

**Files:**
- Modify: `src/app/badminton/[id]/page.tsx`

**Interfaces:**
- Consumes: `OrganizerBoard` (Task 4), 기존 `session`(state)과 `user`(`useAuth()`)는 이미 이 파일에 있음.

- [ ] **Step 1: import 추가**

`src/app/badminton/[id]/page.tsx` 상단 import 목록에 추가:

```typescript
import OrganizerBoard from '@/components/badminton/OrganizerBoard';
```

- [ ] **Step 2: 모임장에게만 보이는 섹션 추가**

파일 안에서 세션 상세 정보를 보여주는 JSX 블록(참가자 목록을 렌더링하는 `<ParticipantsList ... />` 바로
아래)에 다음 블록을 추가한다:

```tsx
{session && user?.id === session.creator_id && (
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

정확한 삽입 위치는 `ParticipantsList` 컴포넌트 호출 직후이며, 기존 JSX 들여쓰기/구조를 유지한다. 세션이
`completed` 상태면 `OrganizerBoard`를 아예 렌더링하지 않아, 종료된 모임에 대한 쓰기 작업(설계 문서의
에러 처리 항목)을 UI 단에서 차단한다.

- [ ] **Step 3: 수동 검증 — 모임장 계정으로 전체 플로우**

```bash
pnpm dev
```

1. 로그인 계정으로 `/badminton/create`에서 세션 생성
2. 생성된 세션의 `/badminton/[id]`로 이동 → "게임 관리" 섹션이 보이는지 확인
3. 선수 등록 → 참석 처리 → 팀 뽑기(랜덤) → 확정(대기열 추가) → 코트 배정 → 게임 종료까지 클릭
4. 페이지 새로고침 → 등록한 선수/코트/게임 기록이 그대로 남아있는지 확인 (localStorage가 아니라 서버에
   저장됐다는 증거)

Expected: 각 단계에서 토스트 메시지가 뜨고, 새로고침 후에도 상태가 유지된다.

- [ ] **Step 4: 수동 검증 — 비로그인/게스트로 접속**

같은 세션의 초대 링크(`/badminton/invite/[code]`)를 시크릿 창으로 열어 게스트로 참가한 뒤,
`/badminton/[id]`에 접속했을 때 "게임 관리" 섹션이 보이지 않는지 확인한다 (모임장 전용이므로).

- [ ] **Step 5: 회귀 확인**

기존 `/badminton` 플로우가 깨지지 않았는지 확인:
- 세션 생성, 초대 코드 발급, QR 표시, 게스트/로그인 참가, 강제 퇴장 — 전부 기존과 동일하게 동작하는지
- `/game-manager`, `/random-picker` 페이지가 이번 변경과 무관하게 그대로 동작하는지

```bash
pnpm lint
pnpm build
```

Expected: 둘 다 에러 없이 통과.

- [ ] **Step 6: 완료** (스테이징/커밋은 하지 않음 — 사용자가 직접 진행)

---

## Task 6: 멀티 클라이언트 실시간 동기화 검증 (최종 회귀 확인)

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 두 브라우저로 동시 접속 테스트**

1. 브라우저 A: 모임장 계정으로 `/badminton/[id]` 접속, "게임 관리" 섹션 열어둠
2. 브라우저 B(시크릿 창, 로그인 안 함): 같은 세션 access_code로 `/badminton/invite/[code]`에서
   게스트로 참가만 하고 대기
3. 브라우저 A에서 선수를 추가하고 코트에 배정 → 브라우저 A에서 실시간으로 반영되는지 확인 (자기 자신의
   변경이므로 즉시 반영되어야 함)
4. 브라우저 A에서 게임을 종료 → 다시 브라우저 A 화면에서 코트가 비워지는지 확인

Expected: 별도 새로고침 없이 Realtime 구독을 통해 화면이 갱신된다. (참가자/스펙테이터 전용 실시간 뷰는
2·3번 과제 범위이므로, 이 태스크에서는 모임장 화면 자체의 realtime 동작만 확인한다.)

- [ ] **Step 2: 최종 빌드/린트 확인**

```bash
pnpm lint
pnpm build
```

Expected: 에러 없이 통과.

- [ ] **Step 3: 최종 변경 사항 확인**

```bash
git status
git diff --stat
```

모든 태스크에서 수정한 파일이 의도한 대로 반영되어 있는지 확인한다. 스테이징/커밋은 전부 사용자가 직접 진행한다.

## 범위 밖 (이 계획 이후)

- 참가자 셀프 등록 UI, 참가자 셀프 참석 토글 — 설계 문서 2번 과제.
- 스펙테이터(읽기 전용) 전용 화면 — 설계 문서 3번 과제.
- 코트/대기열 한눈에 보기 대시보드 UI 재설계 — 설계 문서 4번 과제.
