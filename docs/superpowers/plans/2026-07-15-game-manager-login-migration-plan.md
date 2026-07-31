# game-manager → 서버 세션 로그인 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/game-manager`를 로그인 없는 체험판으로 유지하면서, 로그인하면 지금 등록된 선수 명단을
새 배드민턴 세션(`/badminton/[id]`)으로 옮겨 서버에 저장할 수 있게 만든다.

**Architecture:** `/game-manager` 상단에 상시 배너(`MigrateBanner`)를 두고, 클릭 시 로그인이 필요하면
`localStorage` 플래그를 남기고 기존 로그인 페이지로 보낸다. 로그인 콜백(`/auth/callback`)은 이 플래그가
있으면 `/game-manager`로 돌아오게 하고, `/game-manager`는 돌아온 시점에 저장 모달(`MigrateModal`)을
자동으로 연다. 모달에서 모임 이름을 받아 기존 `/api/badminton/sessions` 생성 API를 호출하고, 현재
localStorage 선수 명단을 그 세션의 `guest_participants`로 복사한 뒤 `/badminton/[id]`로 이동시킨다.

**Tech Stack:** Next.js 15 App Router, Supabase JS 클라이언트, 기존 `@/contexts/AuthContext`,
`@/components/ui/dialog` (Radix 기반, `PlayerEditModal.tsx`와 동일 패턴).

## Global Constraints

- **자동화 테스트 없음.** 이 저장소 관행대로 `pnpm dev` 수동 클릭 검증 + `pnpm lint`/`pnpm build`로
  확인한다.
- **`git add`/`git commit`을 실행하지 않는다.** 파일 수정만 하고, 스테이징과 커밋은 사용자가 직접
  진행한다. 각 태스크 마지막 단계는 검증까지만이며 git 명령은 포함하지 않는다.
- **기존 로그인 흐름(`signInWithKakao`/`signInWithEmail`, `/auth/login` 페이지)은 그대로 둔다.**
  `/auth/callback`의 리다이렉트 대상만 플래그 유무에 따라 조건부로 바꾼다 — 플래그가 없는 모든 기존
  로그인 시나리오는 지금과 동일하게 동작해야 한다.
- **localStorage 선수 명단은 마이그레이션 후에도 지우지 않는다.**
- **코트/대기열/게임 기록은 옮기지 않는다.** 선수 명단만 옮긴다.

---

## Task 1: 마이그레이션 플래그 상수 파일 생성

**Files:**
- Create: `src/utils/gameManagerMigration.ts`

**Interfaces:**
- Produces: `MIGRATION_PENDING_FLAG` 문자열 상수 — Task 2(`auth/callback`)와 Task 5(`game-manager`
  페이지)가 이 상수로 같은 localStorage 키를 참조한다.

- [ ] **Step 1: 파일 생성**

```typescript
// src/utils/gameManagerMigration.ts
export const MIGRATION_PENDING_FLAG = 'game-manager-pending-migration';
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: 에러 없음.

---

## Task 2: 로그인 콜백 조건부 리다이렉트

**Files:**
- Modify: `src/app/auth/callback/page.tsx`

**Interfaces:**
- Consumes: `MIGRATION_PENDING_FLAG` (Task 1, `@/utils/gameManagerMigration`)

- [ ] **Step 1: import 추가**

`src/app/auth/callback/page.tsx` 상단에 추가:

```typescript
import { MIGRATION_PENDING_FLAG } from '@/utils/gameManagerMigration';
```

- [ ] **Step 2: 리다이렉트 로직 수정**

기존:

```typescript
          // 성공적으로 로그인됨 - 홈으로 리디렉트
          router.push('/');
```

교체:

```typescript
          // 성공적으로 로그인됨 - game-manager 마이그레이션 대기 중이면 그쪽으로, 아니면 홈으로
          const hasPendingMigration = localStorage.getItem(MIGRATION_PENDING_FLAG) === 'true';
          if (hasPendingMigration) {
            localStorage.removeItem(MIGRATION_PENDING_FLAG);
            router.push('/game-manager');
          } else {
            router.push('/');
          }
```

- [ ] **Step 3: 타입 체크 및 lint**

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 4: 수동 검증 — 회귀 확인**

`pnpm dev`로 `/auth/login`에서 (game-manager를 거치지 않고) 바로 로그인 → 기존과 동일하게 홈(`/`)으로
이동하는지 확인한다 (플래그가 없을 때 기존 동작이 안 깨졌는지 확인하는 것이 핵심).

---

## Task 3: `MigrateModal` 컴포넌트

**Files:**
- Create: `src/components/game-manager/MigrateModal.tsx`

**Interfaces:**
- Consumes: `Player` 타입(`@/hooks/useGameManager`), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`
  (`@/components/ui/dialog`, `PlayerEditModal.tsx`와 동일 패턴), `supabase` 클라이언트(`@/lib/supabase`).
- Produces: `<MigrateModal isOpen players onClose />` — Task 5가 `/game-manager` 페이지에서 렌더링한다.

- [ ] **Step 1: 파일 생성**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Player } from '@/hooks/useGameManager';

interface MigrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
}

const SKILL_LEVEL_TO_NUMBER: Record<NonNullable<Player['skillLevel']>, number> = {
  E: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

export default function MigrateModal({ isOpen, onClose, players }: MigrateModalProps) {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!sessionName.trim()) {
      toast.error('모임 이름을 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/badminton/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName.trim(),
          venue_name: '미정',
          session_date: new Date().toISOString(),
          max_participants: 20,
          court_count: 1,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '세션 생성에 실패했습니다');
      }

      const sessionId = result.session.id as string;

      if (players.length > 0) {
        const inserts = players.map((player) => ({
          session_id: sessionId,
          name: player.name,
          gender: player.gender ?? 'male',
          skill_level: player.skillLevel ? SKILL_LEVEL_TO_NUMBER[player.skillLevel] : 0,
          age_group: player.ageGroup === '60s+' ? '60s' : (player.ageGroup ?? '20s'),
        }));

        const { error: insertError } = await supabase.from('guest_participants').insert(inserts);
        if (insertError) {
          throw new Error('선수 명단 복사에 실패했습니다');
        }
      }

      toast.success('서버에 저장되었습니다');
      router.push(`/badminton/${sessionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '저장에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>서버에 저장하기</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="migrate-session-name">모임 이름</Label>
            <Input
              id="migrate-session-name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="예: 수요일 저녁 배드민턴"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500">
            현재 등록된 선수 {players.length}명이 새 모임으로 복사됩니다. 장소와 날짜는 나중에 모임
            관리에서 수정할 수 있습니다.
          </p>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? '저장 중...' : '저장하고 이동하기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 타입 체크 및 lint**

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint
```

Expected: 둘 다 에러 없음. (아직 아무 페이지에서도 이 컴포넌트를 쓰지 않으므로 dead code 상태 — 정상)

---

## Task 4: `MigrateBanner` 컴포넌트

**Files:**
- Create: `src/components/game-manager/MigrateBanner.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`@/contexts/AuthContext`), `MIGRATION_PENDING_FLAG` (Task 1).
- Produces: `<MigrateBanner hasPlayers onOpenModal />` — Task 5가 렌더링한다. 로그인 안 된 상태에서
  클릭하면 `/auth/login`으로 이동하기 전에 `MIGRATION_PENDING_FLAG`를 localStorage에 남긴다.

- [ ] **Step 1: 파일 생성**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MIGRATION_PENDING_FLAG } from '@/utils/gameManagerMigration';

interface MigrateBannerProps {
  hasPlayers: boolean;
  onOpenModal: () => void;
}

export default function MigrateBanner({ hasPlayers, onOpenModal }: MigrateBannerProps) {
  const { user } = useAuth();
  const router = useRouter();

  const handleClick = () => {
    if (!hasPlayers) return;
    if (user) {
      onOpenModal();
    } else {
      localStorage.setItem(MIGRATION_PENDING_FLAG, 'true');
      router.push('/auth/login');
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm text-blue-800">
        {user
          ? '이 선수 명단을 내 계정에 저장할 수 있어요'
          : '체험판입니다 — 로그인하면 서버에 저장하고 계속 이어서 쓸 수 있어요'}
      </p>
      <Button size="sm" onClick={handleClick} disabled={!hasPlayers}>
        {user ? '저장하기' : '로그인하고 저장하기'}
      </Button>
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

## Task 5: `/game-manager` 페이지에 배너·모달 연결

**Files:**
- Modify: `src/app/game-manager/page.tsx`

**Interfaces:**
- Consumes: `MigrateBanner`(Task 4), `MigrateModal`(Task 3), `MIGRATION_PENDING_FLAG`(Task 1).

- [ ] **Step 1: import 추가**

`src/app/game-manager/page.tsx` 상단 import 목록(`import { randomTeamPicker } ...` 다음 줄)에 추가:

```typescript
import MigrateBanner from '@/components/game-manager/MigrateBanner';
import MigrateModal from '@/components/game-manager/MigrateModal';
import { MIGRATION_PENDING_FLAG } from '@/utils/gameManagerMigration';
```

`useState`, `useCallback`, `useMemo` import 줄에 `useEffect`를 추가:

```typescript
import { useState, useCallback, useMemo, useEffect } from 'react';
```

- [ ] **Step 2: 모달 상태 및 마운트 시 플래그 확인 추가**

`const [openSections, setOpenSections] = useState({...})` 블록 바로 다음에 추가:

```typescript
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);

  // 로그인 콜백에서 돌아왔는데 플래그가 아직 남아있는 예외 상황 대비
  useEffect(() => {
    if (localStorage.getItem(MIGRATION_PENDING_FLAG) === 'true') {
      localStorage.removeItem(MIGRATION_PENDING_FLAG);
      setIsMigrateModalOpen(true);
    }
  }, []);
```

- [ ] **Step 3: 배너/모달 렌더링 추가**

헤더 블록(`{/* Header */}` ~ 닫는 `</div>`) 바로 다음, `{/* Section 1: Player Registration */}` 바로
앞에 추가:

```tsx
      <MigrateBanner hasPlayers={players.length > 0} onOpenModal={() => setIsMigrateModalOpen(true)} />
```

파일 맨 끝, `</div>` 닫히기 직전(`<AttendancePickerModal ... />` 다음)에 추가:

```tsx
      <MigrateModal
        isOpen={isMigrateModalOpen}
        onClose={() => setIsMigrateModalOpen(false)}
        players={players}
      />
```

- [ ] **Step 4: 타입 체크 및 lint**

```bash
npx tsc --noEmit -p tsconfig.json
pnpm lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 5: 빌드 확인**

```bash
NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key" pnpm build
```

Expected: 빌드 성공.

---

## Task 6: 수동 end-to-end 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 비로그인 상태 플로우**

`pnpm dev` 실행, 로그아웃 상태로 `/game-manager` 접속:
1. 선수 0명일 때 배너 버튼이 비활성화되어 있는지 확인
2. 선수 1명 이상 등록 후 배너에 "로그인하고 저장하기" 버튼이 활성화되는지 확인
3. 클릭 → `/auth/login`으로 이동하는지 확인
4. 카카오 또는 이메일로 로그인 완료 → 자동으로 `/game-manager`로 돌아오고, 저장 모달이 자동으로
   열리는지 확인
5. 모임 이름 입력 후 "저장하고 이동하기" 클릭 → `/badminton/[id]`로 이동하는지, 그 페이지의 "게임
   관리" 섹션에 방금 등록했던 선수들이 전부 미참석 상태로 보이는지 확인

- [ ] **Step 2: 이미 로그인된 상태 플로우**

로그인된 상태로 `/game-manager`에서 선수 등록 후, 배너의 "저장하기" 클릭 → 로그인 페이지를 거치지
않고 바로 모달이 뜨는지 확인.

- [ ] **Step 3: 회귀 확인**

- `/game-manager`의 localStorage 선수 명단이 마이그레이션 후에도 그대로 남아있는지 (지워지지 않아야 함)
- `/badminton/invite/[code]` 등 game-manager를 거치지 않는 기존 로그인 경로가 여전히 홈(`/`)으로
  정상 이동하는지 (Task 2 Step 4에서 이미 확인했지만 최종적으로 한 번 더)

- [ ] **Step 4: 최종 lint/build**

```bash
pnpm lint
NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key" pnpm build
```

Expected: 둘 다 에러 없음.

## 범위 밖

- `/game-manager` 제거 여부 (실전 검증 이후 별도 결정)
- 코트/대기열/게임 기록 마이그레이션
- localStorage 자동 정리
- 로그인 리다이렉트 대상의 범용 파라미터화
