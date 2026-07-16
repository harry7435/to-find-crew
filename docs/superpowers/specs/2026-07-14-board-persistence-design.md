# 배드민턴 보드 서버 영속화 · 실시간 공유 설계

## 배경: 서비스 정체성 재확인

README와 홈 화면 문구는 "관심사 기반 크루 매칭 + 채팅 + 위치 검색" 소셜 플랫폼을 표방하지만,
실제 코드는 그 방향으로 가고 있지 않다.

- 홈 화면(`src/app/page.tsx`)에서 크루 생성/참가, 번개 생성/참가 카드는 전부 주석 처리되어 있고
  실제로 노출되는 것은 "게임 관리"와 "랜덤 뽑기" 두 카드뿐이다.
- 최근 커밋 20개는 전부 참석 관리, 게임 대기열, 코트 배정, 팀 뽑기 등
  "이미 모인 배드민턴 동호회의 현장 운영 도구"에 집중되어 있다.
- `/game-manager`는 인증 없이 localStorage만 쓰는 완전히 별도의 시스템이고,
  `/badminton/*` (Supabase 기반 세션/초대/게스트 참가)는 최근 손을 대지 않은 상태로 남아 있다.

**결정된 방향**: 단기적으로는 "배드민턴 동호회 현장 운영 도구"가 1차 제품이고,
"크루 매칭 플랫폼"은 장기 비전으로 유지한다. 지금은 배드민턴 도구의 기능 완성도를 높이는 데 집중한다.
장기 확장을 막지 않기 위해, 새로 만드는 서버 자원은 가능한 한 기존 `badminton_sessions` 인프라
(크루로 확장 가능한 세션 개념)를 재사용한다.

## 사용자가 요청한 개선 사항

1. 로컬(localStorage)에만 저장되는 데이터를 모임장이 서버에 저장할 수 있어야 한다.
2. 모임원이 QR코드/공유 링크로 접속하면 코트 현황과 대기 상황을 볼 수 있어야 한다.
3. 모임장이 참가자를 일일이 입력하지 않고, 입장코드/링크를 공유하면 참가자가 직접 정보를 입력해 등록할 수 있어야 한다.
4. 코트/대기 현황이 한눈에 들어오지 않는 현재 UI(아코디언)를 개선해야 한다.

## 전체 로드맵 (4개 하위 과제)

이 문서는 **1번(서버 영속화 기반)**만 상세 설계한다. 2~4번은 1번 완료 후 각각 별도 스펙으로 설계한다.

1. **서버 영속화 기반** (이 문서) — 데이터 모델 이전, 접근 권한, 실시간 동기화, `/game-manager` →
   `/badminton/[id]` 통합
2. **참가자 셀프 등록** — 입장코드/링크 공유 후 참가자가 직접 등록 (기존 게스트 참가 폼 확장)
3. **스펙테이터 실시간 뷰** — QR/링크로 들어온 방문자를 위한 읽기 전용 현황판
4. **UI 재설계** — 코트+대기열 상시 노출 요약 뷰 (대시보드형)

## 핵심 구조적 결정: `/game-manager`를 `/badminton/[id]`로 통합

`/badminton/[id]`에는 이미 다음이 구현되어 있다:
- 초대 코드(`access_code`) 발급/조회
- QR코드 표시 (`QRCodeSVG`), 공유 링크, 복사 버튼
- 로그인 참가 / 게스트 참가 (이름·성별·급수·나이대 입력) API (`/api/badminton/sessions/join`,
  `/api/badminton/sessions/join-guest`)
- 세션 조회 API, 참가자 목록, RLS ("누구나 읽기 가능", "생성자만 쓰기 가능", "게스트는 누구나 추가 가능")

이 인프라 위에 코트/대기열/팀뽑기 UI를 얹으면 사용자가 요청한 2·3번 요구사항이 대부분 공짜로 해결된다.
반대로 `/game-manager`를 독립적으로 서버화하면 이 모든 것을 중복 구현해야 한다.

**결정**: `/game-manager` 라우트와 그 컴포넌트(`PlayerList`, `TeamPicker`, `CourtManager`, `GameQueue`,
`GameHistory` 등)를 `/badminton/[id]` 안으로 이전한다. 같은 페이지가 보는 사람의 역할에 따라 다르게
렌더링된다:

| 역할 | 조건 | 화면 |
|---|---|---|
| 모임장 | `user.id === session.creator_id` | 선수 등록·코트/대기열/팀뽑기 전체 조작 |
| 참가자 | 로그인 참가자 또는 게스트로 등록됨 | 자신의 참가 상태 확인 (조작은 2번 과제에서 다룸) |
| 방문자 | 그 외 (QR/링크로만 들어옴) | 읽기 전용 현황판 (3번 과제에서 다룸) |

`/game-manager`, `/random-picker`는 이번 통합 대상이 아니며 그대로 유지한다(별도 유틸리티로 존치).

이 문서(1번 과제)의 UI 범위는 기존 아코디언 레이아웃과 컴포넌트를 그대로 `/badminton/[id]`로 옮겨
데이터 소스만 localStorage에서 서버/realtime으로 교체하는 것까지다. 시각적 재설계는 하지 않으며
4번 과제에서 다룬다.

## 데이터 모델

**원칙: 기존 테이블은 단 하나도 변경하지 않는다.** `ALTER TABLE`, `DROP TABLE` 없이 새 테이블
`CREATE TABLE`만으로 전부 구현한다. 기존 `/badminton` 기능(세션 생성, 초대, 참가, 강제 퇴장)의
동작·스키마는 이번 작업으로 전혀 영향받지 않는다.

### 재사용 (완전히 변경 없음)
- `badminton_sessions`, `session_participants`, `guest_participants` — 스키마 변경 없이 그대로 조회만 한다.
- 초대/참가 API 전부 (`join`, `join-guest`, `leave`, `leave-guest`, `remove-participant`)
- `teams`/`team_members`/`games` — 실제로는 아무 코드도 여기에 쓰지 않는 죽은 테이블이지만(아래 참고),
  DROP하지 않고 그냥 안 쓴 채로 둔다. 지우지 않으므로 "구조 변경"이 아니다.

  > 확인: `.claude/plans/팀-뽑기-로직-단순화.md`에서 "2인 팀 A vs 팀 B" 페어링 개념을 이미 로컬
  > 모델에서 제거했고(2026-02-19), 코드베이스 전체에서 이 3개 테이블에 INSERT/UPDATE하는 곳은
  > 없다. 유일한 참조는 `api/badminton/sessions/[id]/route.ts`의 읽기 전용 조회 하나뿐이며 에러도
  > 무시하도록 되어 있어 실제로는 항상 빈 배열을 반환한다. 그래서 새 모델과 맞지 않아도 그대로 둬도
  > 아무 문제가 없다.

### 신규 테이블 (전부 CREATE TABLE만, 기존 테이블 참조는 FK로만)

```sql
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
```

- `board_player_state`는 참가자 한 명(회원 또는 게스트)당 정확히 한 행을 가진다. `CHECK
  (num_nonnulls(...) = 1)`로 둘 중 정확히 하나만 채워지도록 강제하고, 각 참조에 `UNIQUE`를 걸어
  참가자당 상태 행이 중복되지 않게 한다. 참가자가 처음 등록되는 시점(로그인 참가/게스트 참가)에
  기본값으로 한 행을 같이 만든다.
- `board_games.player_ids`는 `session_participants.id` 또는 `guest_participants.id`를 섞어서 담는
  UUID 배열이다. 두 테이블 중 어디를 가리키는지 DB가 강제하지 않으며(FK 불가), 애플리케이션 레이어에서
  두 테이블을 함께 조회해 이름/급수 등을 resolve한다. 이는 지금 로컬 모델이 회원/게스트를 구분하지 않고
  4명을 다루는 방식과 동일하다.
- 대기열 = `status = 'queued'`, 진행 중 코트 = `status = 'playing'`, 기록 = `status = 'completed'`인
  행 전체. 로컬 모델에서 대기열/코트/기록이 각자 다른 배열이던 것을 하나의 상태 전이로 통합한다.
- 게임 취소(`cancelCourtGame`)는 현재 로컬 모델에서 기록을 남기지 않고 완전히 삭제하므로, 서버에서도
  해당 행을 DELETE한다(취소 이력을 남기지 않는 현재 동작을 그대로 유지).

### RLS 정책 방향
- `board_player_state`, `courts`, `board_games`: "누구나 읽기 가능" (스펙테이터 뷰를 위해 필요) +
  "세션 생성자만 쓰기 가능" (기존 `teams`/`games` 정책과 동일한 패턴, 새 테이블에 새 정책만 추가).
- 기존 테이블(`session_participants`, `guest_participants` 등)의 RLS 정책은 전혀 건드리지 않는다.

### 롤백
새 테이블 3개(`board_player_state`, `courts`, `board_games`)를 DROP하면 이번 작업 이전 상태로
완전히 되돌아간다. 기존 테이블에 손댄 것이 없으므로 마이그레이션 실패/롤백 리스크가 없다.

## 접근 권한 모델

- **모임장**: 로그인 필수(기존 Google/Kakao OAuth 그대로 사용). RLS가 `auth.uid() = creator_id`로
  쓰기를 제한하므로 별도 토큰 체계가 필요 없다.
- **참가자 셀프 등록**: 기존 "누구나 guest_participants insert 가능" 정책을 그대로 사용하므로
  코드 변경이 최소화된다 (상세는 2번 과제).
- **스펙테이터**: 로그인도, 참가 등록도 요구하지 않는다. `access_code`로 세션을 조회하는 기존 로직
  그대로 통과한다 (`courts`/`board_games`가 "누구나 읽기" 정책이므로).

## 실시간 동기화

Supabase Realtime(`postgres_changes`)으로 세션 하나당 채널을 구독한다:

- 구독 대상: `board_player_state`, `courts`, `board_games` (모두 `session_id = :sessionId` 필터).
  `session_participants`/`guest_participants`는 로스터 변경(신규 참가, 강제 퇴장) 감지를 위해 기존
  방식대로 별도 구독하거나 폴링한다.
- 모임장 화면, 참가자 화면, 스펙테이터 화면 모두 같은 채널을 구독하는 하나의 훅(`useBoardRealtime`)을
  공유한다. 기존 `useGameManager`(localStorage 훅)를 대체하되, 반환하는 데이터 shape(`players`,
  `courts`, `queue`, `games`, `addPlayer`, `enqueueGame`, ... )은 최대한 유지해서 기존
  `PlayerList`/`TeamPicker`/`CourtManager`/`GameQueue`/`GameHistory` 컴포넌트를 그대로 재사용한다.
- 쓰기 동작(선수 등록, 팀 뽑기 확정, 코트 배정 등)은 훅 내부에서 Supabase 클라이언트 mutation으로
  직접 나가고, 성공 시 UI 갱신은 realtime 이벤트를 받아 반영한다(낙관적 업데이트는 1단계 범위 밖).

## 에러 처리

- 세션이 `status = 'completed'`인 경우 쓰기 작업(선수 등록, 팀 뽑기 등)을 막고 "종료된 모임입니다"
  안내로 대체한다.
- realtime 구독이 끊긴 경우(네트워크 재연결 등) 재구독 시 전체 스냅샷을 다시 fetch해 정합성을 맞춘다.
- `board_games.player_ids`가 가리키는 참가자가 중간에 강제 퇴장(`remove-participant`)당한 경우,
  UI에서는 이름 대신 "탈퇴한 참가자"로 표시하고 게임/코트 조작은 계속 가능하게 한다(과거 참가자 삭제가
  진행 중인 게임을 깨지 않도록).

## 테스트 방향

- 데이터 모델 마이그레이션 SQL이 기존 `/badminton` 페이지(세션 생성, 초대, 참가, 강제 퇴장)를
  깨지 않는지 회귀 확인.
- 모임장 계정으로: 선수 등록 → 팀 뽑기 → 대기열 → 코트 배정 → 게임 종료까지 전체 플로우가 서버
  저장 후 새로고침해도 유지되는지 확인.
- 두 번째 브라우저(로그인 없음)로 같은 `access_code`에 접속했을 때 코트/대기열 변화가 실시간으로
  반영되는지 확인.
- 기존 `/game-manager`가 이번 변경으로 영향받지 않는지 확인(별도 유지 대상이므로).

## 범위 밖 (이후 과제)

- 참가자가 직접 코트 상태를 조작하는 UI, 참가자의 "참석" 셀프 토글 — 2번 과제.
- 스펙테이터 전용 레이아웃/디자인 — 3번 과제.
- 코트+대기열 요약 대시보드 UI — 4번 과제.
- 기존 `/game-manager`에 쌓인 localStorage 데이터의 서버 이전(수동 재입력 vs 자동 마이그레이션 도구) —
  필요성 낮음(모임마다 리셋되는 휘발성 데이터 특성상), 요청 시 별도 논의.
