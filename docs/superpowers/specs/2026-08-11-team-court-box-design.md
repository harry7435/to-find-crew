# 팀 배치 코트 박스 설계

> `2026-08-11-board-roster-layout-design.md`(참가자/레이아웃 정리) 논의 중 파생된 별도 과제.
> 관심사가 달라 스펙을 분리한다 — 저쪽은 참가자 명단 노출 위치, 이쪽은 4명 뽑기 이후 "누가
> 어느 팀인지"를 다루는 게임 배정 화면이다.

## 배경

현재 "팀 뽑기"는 이름과 다르게 팀을 짜지 않는다. `randomTeamPicker`/직접 선택 둘 다 4명을 고른
뒤 `finalShuffle`(랜덤 재섞기) 또는 선택 순서 그대로 `[p0, p1, p2, p3]` 튜플을 만들고,
`TeamPicker`는 이 4명을 다이아몬드 모양 2x2 박스 + 6개 조합 전부의 co-play 횟수 SVG로 보여줄
뿐이다. 어느 2명이 한 팀인지는 어디에도 정해지지 않는다. `board_games.player_ids`는 대기열
(`GameQueue`)·코트(`CourtManager`)·관전자 보드(`SpectatorBoard`) 세 곳에서도 전부 평평한 4명
목록(2x2 grid)으로만 표시된다.

흥미롭게도 `utils/smartTeamPicker.ts`에는 이미 `{ teamA: [Player,Player], teamB: [Player,Player] }`
를 반환하는 `smartTeamPicker()`와, `game.players`를 `[a0, a1, b0, b1]`(앞 2명=A팀, 뒤 2명=B팀)로
가정하고 파트너/상대 중복을 계산하는 로직이 이미 존재한다. 하지만 어디서도 호출되지 않는 죽은
코드다 — 즉 "배열 순서로 팀을 인코딩한다"는 규약은 이번에 새로 만드는 게 아니라, 이미 코드베이스가
암묵적으로 예정해 두었던 규약을 실제로 연결하는 작업에 가깝다.

## 목표

1. "팀 뽑기"(랜덤)와 "직접 선택" 둘 다, 4명을 정한 뒤 **누가 어느 팀인지 직접 조정**할 수 있게
   한다.
2. 팀 구분을 배드민턴 코트를 본뜬 박스(외곽 테두리 + 중앙 네트선, 위/아래로 팀 분리)로 표시한다.
3. 이 코트 박스를 "팀 뽑기" 확정 전 미리보기뿐 아니라 대기열·코트 관리·관전자 보드까지 **모든
   4인 표시 지점**에서 동일하게 쓴다.
4. 팀 구분은 **표시 전용**이다 — 게임 횟수·파트너 통계 등 기존 집계 로직(`gameCountsMap`,
   `getPartnerCount` 등)은 여전히 `player_ids`에 대한 `includes()` 멤버십 체크만 하므로 이번
   변경으로 깨지지 않는다. `smartTeamPicker`(밸런스 자동 매칭)를 도입하는 것도 이번 범위가
   아니다 — 여전히 조직자가 랜덤/직접 선택 후 수동으로 순서를 조정하는 방식이다.

**비목표(명시적 제외):**
- DB 스키마 변경 없음. `board_games.player_ids`는 지금처럼 4개짜리 id 배열이고, 앞 2개=팀A,
  뒤 2개=팀B라는 "순서 규약"만 새로 확정한다.
- 실제 배드민턴 코트 규격 라인(사이드라인/서비스라인 등) 재현 없음 — 외곽 테두리 + 중앙 네트선만.
- 드래그앤드롭 라이브러리 도입 없음 — 탭-탭 스왑으로 구현한다.
- 이미 대기열에 들어갔거나 코트에서 게임 중인 팀 배치를 재조정하는 기능은 없음. 조정은 확정
  (대기열 투입) 전 미리보기 단계에서만 가능하다.
- `smartTeamPicker`를 실제로 연결하는 것은 이번 범위가 아니다(팀은 표시 전용이므로).

## 설계

### 순서 규약

`[Player, Player, Player, Player]` 튜플에서 인덱스 `0, 1`은 팀 A(박스 상단), `2, 3`은 팀 B
(박스 하단)로 고정한다. `enqueueGame`을 호출하는 시점에 이미 이 순서로 정렬되어 있어야 하며,
이후 `board_games.player_ids`에는 이 순서 그대로 저장된다. 다른 훅·API 변경은 없다.

### 신규 공유 컴포넌트: `TeamCourtBox`

`src/components/game-manager/TeamCourtBox.tsx` (신규). 대기열·코트 관리·관전자 보드·팀 뽑기
미리보기 다섯 곳에서 반복되던 "4명 박스"를 하나로 통합한다.

```ts
interface TeamCourtBoxProps {
  players: [Player, Player, Player, Player]; // 0,1=팀A(상단) · 2,3=팀B(하단)
  size?: 'compact' | 'full';       // 기본 'compact'
  interactive?: boolean;           // 기본 false — true면 탭-탭 스왑 가능
  onChange?: (next: [Player, Player, Player, Player]) => void; // interactive일 때 필수
  showPartnerCounts?: boolean;     // 기본 false — 팀 뽑기 미리보기 전용
  games?: GameRecord[];            // showPartnerCounts일 때만 사용
}
```

**모양** — 둥근 테두리 사각형(기존 카드 스타일과 통일) 안에서 가로 구분선(네트선, 예:
`border-t-2 border-dashed`)으로 상/하 분리. 각 절반에 `grid-cols-2`로 선수 2명.

**`size` 변형**
- `compact` — 이름만 표시. 대기열·코트 관리·관전자 보드에서 사용(기존 표시 수준과 동일).
- `full` — 성별 아이콘 + 이름 + 급수 배지 + (필수 포함 표시) 표시. 팀 뽑기/직접 선택 미리보기
  전용.

**`interactive` 동작** — 내부 로컬 상태로 "선택된 자리 인덱스"만 관리한다.
1. 자리(카드) 탭 → 해당 자리가 선택 상태(테두리 강조)가 된다.
2. 다른 자리를 탭 → 두 자리의 선수가 서로 바뀌고(팀 소속도 자동으로 바뀜) `onChange(next)` 호출,
   선택 해제.
3. 같은 자리를 다시 탭 → 선택 해제.

**`showPartnerCounts`** — 팀 뽑기 미리보기에서만 사용. 기존 `TeamPicker`의 6개 조합 전체
diamond SVG(파트너 4쌍 + 대각선 상대 2쌍)를 걷어내고, 대신 확정될 두 페어 각각에 대해서만
"함께한 횟수"를 작게 표시한다(팀A 아래 배지 1개, 팀B 아래 배지 1개 — 총 6개였던 표시를 2개로
단순화). 상대팀과의 매치업 이력(대각선 조합)은 더 이상 보여주지 않는다 — 팀을 조직자가 수동으로
정하는 이상, 이제 의미 있는 신호는 "이 페어가 이미 몇 번 같이 뛰었나" 하나뿐이기 때문이다.

### 각 사용처 반영

- **`TeamPicker.tsx`** — 기존 다이아몬드 SVG 레이아웃(`CARD_W`~`EDGE_DIAG_B` 상수, `PlayerCard`,
  `EdgeLabel` 등 ~150줄)을 전부 제거하고 `<TeamCourtBox players={pickedPlayers} size="full"
  interactive onChange={onReorderPickedPlayers} showPartnerCounts games={games} />`로 교체한다.
  `pickedPlayers` state는 `OrganizerBoard`에 있으므로, `TeamPickerProps`에
  `onReorderPickedPlayers: (next: [Player,Player,Player,Player]) => void` 신규 prop을 추가하고
  `OrganizerBoard`에서 `setPickedPlayers`를 그대로 연결한다.
- **`CustomTeamPicker.tsx`** — 4명이 다 선택되면, 기존 "선택된 선수 (4/4)" 평면 리스트 대신
  `<TeamCourtBox players={selectedPlayers as [...]} size="full" interactive
  onChange={setSelectedPlayers} />`를 보여준다. 4명 미만일 때는 지금처럼 진행 중 리스트를 유지.
- **`GameQueue.tsx`** — 각 대기열 항목의 `item.playerIds`를 `players` 배열에서 조회해 4인
  튜플로 만든 뒤 `<TeamCourtBox players={...} size="compact" />`(읽기 전용)로 교체.
- **`CourtManager.tsx`** — 진행 중인 코트의 `court.playerIds`도 동일하게 `TeamCourtBox
  size="compact"`(읽기 전용)로 교체.
- **`SpectatorBoard.tsx`** — 코트 현황·대기열 두 섹션의 4인 그리드를 각각
  `TeamCourtBox size="compact"`(읽기 전용)로 교체.

### 데이터 흐름 변경 없음

`enqueueGame`, `assignQueueToCourt`, `endCourtGame` 등 `useBoardRealtime`/`useBoardSpectator`의
어떤 함수도 시그니처가 바뀌지 않는다. `player_ids` 배열이 이미 팀 순서로 들어오기만 하면 되므로,
변경은 전부 화면(컴포넌트) 레이어에 머문다.

## 엣지 케이스

- **랜덤 뽑기 결과 재조정** — `randomTeamPicker`는 지금처럼 4명을 랜덤 순서로 반환한다(스마트
  매칭 도입은 비목표). 다만 이제 그 순서가 곧 팀 배치이므로, 마음에 안 들면 `TeamCourtBox`에서
  탭-탭 스왑으로 조정한다.
- **필수 포함(pinned) 선수** — 팀 배치와 무관. 기존처럼 `full` 카드에 별 배지로 표시만 된다.
- **직접 선택 중 4명 미만** — `TeamCourtBox`를 렌더링하지 않고 기존 진행 중 리스트를 유지한다.
- **대기열·코트에서는 조정 불가** — `interactive=false`로 고정. 배치를 바꾸려면 대기열에서
  취소 후 다시 뽑아야 한다(기존에도 대기열 항목 수정 기능 자체가 없었으므로 새로운 제약이
  아니다).

## 검증

DB 변경이 없으므로 SQL 실행 단계는 없다. `pnpm dev` 수동 클릭 + `pnpm lint` / `pnpm build`.

1. **팀 스왑 동작** — 팀 뽑기(랜덤)·직접 선택 양쪽에서 카드를 탭-탭으로 스왑했을 때 팀 A/B가
   올바르게 바뀌는지, 확정 후 대기열에 그 순서 그대로 반영되는지 확인.
2. **표시 일관성** — 같은 게임이 대기열 → 코트 배정 → (관전자 보드에서 실시간 반영)까지
   이동하는 동안 팀 A/B 구성이 그대로 유지되는지 확인.
3. **기존 통계 회귀 없음** — 게임 확정 후 `PlayerList`의 게임수(`gameCountsMap`)가 이전과 동일하게
   집계되는지 확인(순서 규약 도입이 멤버십 기반 집계에 영향 없어야 함).
4. **컴팩트 표시 회귀** — 대기열·코트 관리·관전자 보드에서 이름이 잘리지 않고 기존과 비슷한
   밀도로 보이는지 확인.

## 제약

- **DB는 additive-only** — 이번 작업은 스키마를 전혀 건드리지 않는다.
- **`git add` / `git commit`을 실행하지 않는다.** 파일 수정과 검증만 하고 스테이징·커밋은 사용자가
  직접 한다(`CLAUDE.md`의 Git Workflow 참고).
- **자동화 테스트를 새로 도입하지 않는다.**
- **새 npm 의존성(드래그앤드롭 등)을 추가하지 않는다.**
