# 스펙테이터 실시간 현황판 설계

> 로드맵 3번 과제. `2026-07-14-board-persistence-design.md`의 "범위 밖 (이후 과제)" 중
> "스펙테이터 전용 레이아웃/디자인"에 해당한다.

## 배경

1번 과제(서버 영속화)가 배포·검증 완료되어 `/badminton/[id]`에서 모임장이 코트·대기열·게임을
실시간으로 운영할 수 있게 되었다. 그러나 현재 보드는 모임장에게만 렌더링되고
([`src/app/badminton/[id]/page.tsx`](../../../src/app/badminton/[id]/page.tsx)의
`user?.id === session.creator_id` 게이트), 나머지 사람은 코트 현황을 전혀 볼 수 없다.

체육관 현장에서 참가자는 "지금 누가 뛰고 있나", "내 앞에 몇 팀 남았나"를 알고 싶어 하는데,
지금은 모임장 휴대폰을 넘겨다보는 수밖에 없다.

## 목표

QR/링크로 `/badminton/[id]`에 들어온 **모임장이 아닌 모든 사람**에게 코트·대기열·대기자·게임 기록을
실시간 읽기 전용으로 보여준다.

**비목표(명시적 제외):**
- 참가자 본인 식별·하이라이트, 본인 차례 푸시 알림 → 다음 과제(4번 과제 이후 별도 스펙)
- 참가자가 직접 조작하는 기능(셀프 참석 토글 등) → 로드맵 2번 과제
- 모임장 보드의 아코디언 UI 재설계 → 로드맵 4번 과제

## 선행 조사 결과

설계 확정 전에 두 가지 전제를 코드/스키마에서 검증했다.

### 1. DB 변경이 필요 없다

관련된 모든 테이블의 SELECT 정책이 `USING (true)`다.

| 테이블 | 정책 |
|---|---|
| `users` | `Users can read all users` |
| `session_participants` | `Anyone can read session participants` |
| `guest_participants` | `Anyone can read guest participants` |
| `board_player_state` | `Anyone can read board player state` |
| `courts` | `Anyone can read courts` |
| `board_games` | `Anyone can read board games` |

비로그인 방문자도 전부 읽을 수 있다. Realtime 역시 1번 과제에서 5개 테이블 모두
`ALTER PUBLICATION` + `REPLICA IDENTITY FULL`이 적용 완료되었다.
**따라서 `supabase-schema.sql` 변경도, Supabase 대시보드 SQL 실행도 이번 과제에는 없다.**

### 2. `useBoardRealtime`을 그대로 재사용하면 안 된다

`useBoardRealtime`의 `loadSnapshot()`은 `board_player_state`에 누락된 행을 **INSERT**한다
(`src/hooks/useBoardRealtime.ts`의 `missingInserts` 블록). 그런데 이 `loadSnapshot()`은

- realtime 이벤트 5종(`board_player_state`, `courts`, `board_games`, `guest_participants`,
  `session_participants`)마다 호출되고
- 채널이 `SUBSCRIBED` 될 때마다(최초 연결 + 네트워크 재연결) 다시 호출된다.

RLS가 `Anyone can insert board player state` = `WITH CHECK (true)`이므로 **비로그인 방문자의
INSERT도 실제로 성공한다.** 즉 읽기만 하러 온 관중이 쓰기를 유발한다.

`UNIQUE (session_participant_id)` / `UNIQUE (guest_participant_id)` 제약 덕분에 데이터 중복이나
손상은 발생하지 않지만, 관중 수만큼 무의미한 INSERT 시도가 반복되고 그 에러는 코드에서
확인되지 않은 채(`const { data: inserted } = ...` — `error` 미확인) 조용히 무시된다.

**결론: 스펙테이터용 읽기 전용 데이터 경로가 별도로 필요하다.**

## 설계

### 역할 분기

`/badminton/[id]` 한 페이지 안에서 갈린다. 별도 라우트를 만들지 않는다 — 기존 QR/공유 링크가
이미 이 URL을 가리키고 있어서 진입 경로를 바꿀 이유가 없다.

| 역할 | 조건 | 화면 |
|---|---|---|
| 모임장 | `user?.id === session.creator_id` | 기존 `OrganizerBoard` (변경 없음) |
| 그 외 전원 | 참가자·게스트·비로그인 방문자 | 신규 `SpectatorBoard` (읽기 전용) |

**1차에서는 참가자와 방문자를 구분하지 않고 동일한 화면을 준다.** "이게 나다"라는 식별 수단이
아직 없기 때문이며, 그 식별은 다음 과제(푸시 알림)에서 도입한다. 이 화면이 그때 본인 하이라이트와
알림 구독 토글이 얹히는 토대가 된다.

기존 `ParticipantsList`는 그대로 둔다. 관심사가 다르기 때문이다.

- `ParticipantsList` — *세션에 누가 가입했나* (정원 `N/max`, 게스트 뱃지, 모임장용 퇴장 버튼)
- `SpectatorBoard` — *지금 코트에서 무슨 일이 벌어지나* (배정·대기·경과 시간)

### 데이터 계층

매핑 로직을 순수 모듈로 추출해 두 훅이 공유한다. 복사하지 않는 이유는, 급수 숫자 변환·나이대
정규화·코트/대기열/기록 파생이 약 90줄이고 한쪽만 수정되면 두 화면이 서로 다른 것을 보여주게
되기 때문이다.

```
utils/boardSnapshot.ts  (신규, 순수 함수 — supabase 의존 없음)
  toPlayer / buildSnapshot({ participants, guests, states, courtRows, gameRows })
      → { players, courts, queue, games }
              |
        +-----+-----+
        |           |
useBoardRealtime   useBoardSpectator  (신규)
(seeding INSERT     (읽기만 — INSERT 없음)
 + mutations 유지)
```

**`utils/boardSnapshot.ts` (신규)** — `SKILL_LEVEL_FROM_NUMBER` / `SKILL_LEVEL_TO_NUMBER` 맵,
`toPlayer()`, 그리고 조회 결과 5종을 받아 `{ players, courts, queue, games }`를 만드는
`buildSnapshot()`. Supabase를 import하지 않는 순수 함수라 단독으로 이해·검증할 수 있다.

**`useBoardRealtime` (기존 수정)** — 매핑 로직만 위 모듈로 빠져나간다. seeding INSERT, mutation
함수, 구독 동작은 전부 그대로다. 동작 변화 없음이 요구사항이다.

**`useBoardSpectator` (신규)** — 같은 5개 테이블을 조회하고 같은 5개 채널을 구독하되,
seeding INSERT를 하지 않는다. 반환값은 `{ players, courts, queue, games, isLoading }`뿐이고
mutation을 노출하지 않는다.

> **INSERT를 생략해도 표시가 깨지지 않는 이유:** `toPlayer()`가 이미
> `state?.attending ?? false`처럼 optional chaining으로 되어 있어, `board_player_state` 행이 없는
> 참가자는 자동으로 "미참석 / `resting`"으로 떨어진다. 읽기 전용 화면에서는 이것이 정확히 맞는
> 동작이다(모임장이 아직 참석 체크를 안 한 사람 = 미참석).

### 화면 구성

상시 노출 대시보드형. 관중은 체육관에 서서 휴대폰으로 힐끗 보는 상황이므로, 볼 때마다 펼쳐야 하는
아코디언은 맞지 않는다. 부차적인 게임 기록만 접어둔다.

```
[ 코트 현황 ]              <- 상시 노출
  코트1  김·이 vs 박·최
         12분 경과
  코트2  비어있음

[ 대기열 (2) ]             <- 상시 노출
  1. 정·강 vs 조·윤
  2. 한·오 vs 임·서

[ 대기 중 (5) ]            <- 상시 노출
  홍길동  8분              <- 오래 기다린 순
  김영희  5분

> 오늘 게임 기록 (12)       <- 기본 접힘
```

- **경과 시간**은 기존 `useTicker` + `formatElapsed`를 재사용해 실시간으로 흐른다.
- **"대기 중"의 정의** — `attending === true`이면서 코트·대기열 어디에도 없는 사람.
  `waiting_since` 오래된 순으로 정렬한다.
- 모바일 우선 레이아웃. 조작 버튼은 하나도 없다.

이 화면은 4번 과제(대시보드형 UI 재설계)의 선행 사례가 된다. 신규 컴포넌트라 기존 아코디언 자산을
보존할 의무가 없어, 목표 형태를 먼저 시험해볼 수 있다.

### 엣지 케이스

- **코트 0개 / 대기열 0 / 참석자 0** — 각 섹션에 안내 문구("아직 코트가 없습니다" 등).
- **종료된 모임** (`session.status === 'completed'`) — 모임장에게 보이는 것과 동일하게
  "종료된 모임입니다" 문구를 보여주고 보드를 렌더링하지 않는다.
- **비로그인** — 그대로 동작한다. 모든 SELECT 정책이 `USING (true)`라 인증이 필요 없다.
- **로딩** — 기존 보드와 같은 로딩 표시 패턴을 따른다.

## 검증

DB 변경이 없으므로 SQL 실행 단계가 없다. 이 저장소 관행대로 `pnpm dev` 수동 클릭 + `pnpm lint` /
`pnpm build`로 확인한다.

1. **실시간 반영** — 모임장 브라우저에서 코트 배정·게임 종료·참석 토글을 하고, 시크릿 창(비로그인)에서
   같은 세션 URL을 열어 즉시 반영되는지 확인.
2. **쓰기 미발생 (이번 설계의 핵심 전제)** — 시크릿 창의 Network 탭에서 `board_player_state`에 대한
   POST(INSERT)가 **한 건도 발생하지 않는지** 확인. 이벤트를 여러 번 발생시켜도 마찬가지여야 한다.
3. **모임장 화면 회귀** — 매핑 로직 추출 후 `OrganizerBoard`의 표시·조작이 이전과 동일한지 확인.
   특히 급수/성별/나이대 표시와 코트·대기열·기록 파생이 그대로여야 한다.
4. **종료된 모임** — `status = 'completed'` 세션에 비로그인으로 접속해 안내 문구가 뜨는지 확인.

## 제약

- **DB는 additive-only** — 이번 과제는 아예 스키마를 건드리지 않는다.
- **`git add` / `git commit`을 실행하지 않는다.** 파일 수정과 검증만 하고 스테이징·커밋은 사용자가
  직접 한다 (`CLAUDE.md`의 Git Workflow 참고).
- **자동화 테스트를 새로 도입하지 않는다.** 이 저장소에는 테스트 러너가 없고, 추가하지 않는다.
