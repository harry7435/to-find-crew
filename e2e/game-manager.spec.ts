import { test, expect } from '@playwright/test';
import { registerPlayers, addCourt, noHorizontalScroll, gotoTab } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto('/game-manager');
  if (testInfo.project.name === 'mobile') {
    // dev 서버의 Next 인디케이터(좌하단)가 가장 왼쪽 탭 위에 떠서 클릭을 가로챈다. 프로덕션엔 없다.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  }
});

test('빈 목록에서 [선수 등록]으로 등록 모달이 열린다', async ({ page }) => {
  const hint = page.getByText("'선수 등록' 버튼으로 오늘 온 사람을 추가하세요");
  await expect(hint).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // 안내 문구와 같은 빈 상태 블록 안의 버튼
  await hint.locator('..').getByRole('button', { name: '선수 등록' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('선수 등록', { exact: true }).first()).toBeVisible();
  await expect(dialog.locator('#player-name')).toBeVisible();
});

test('등록한 선수는 바로 참석이고 랜덤 뽑기가 켜진다', async ({ page }, testInfo) => {
  await registerPlayers(page, ['가', '나', '다', '라']);
  await expect(page.getByRole('button', { name: '참석 4' })).toBeVisible();
  await gotoTab(page, testInfo, '팀뽑기');
  await expect(page.getByRole('button', { name: '랜덤 뽑기 🎲' })).toBeEnabled();
});

test('확정 → 대기열 강조, ▶ 코트 → 코트 강조', async ({ page }, testInfo) => {
  await registerPlayers(page, ['가', '나', '다', '라']);
  await gotoTab(page, testInfo, '코트');
  await addCourt(page);
  await gotoTab(page, testInfo, '팀뽑기');
  await page.getByRole('button', { name: '랜덤 뽑기 🎲' }).click();
  await page.getByRole('button', { name: '확정' }).click();
  await expect(page.getByText('대기열 1번째로 추가했어요')).toBeVisible();
  await expect(page.getByText('방금 추가 · 1번째')).toBeVisible();

  await page.getByRole('button', { name: /코트 1/ }).click();
  await expect(page.getByText('게임 시작', { exact: true })).toBeVisible();
});

test('참석 칩 토글', async ({ page }) => {
  await registerPlayers(page, ['가']);
  const chip = page.getByRole('switch', { name: /참석/ });
  await expect(chip).toHaveAttribute('aria-checked', 'true');
  await chip.click();
  // '참석' 필터가 기본이라 미참석이 되면 목록에서 빠지고 안내가 뜬다
  await expect(page.getByText(/신청자 1명이 있어요/)).toBeVisible();
});

test('가로 스크롤 없음', async ({ page }) => {
  await expect(page.getByText("'선수 등록' 버튼으로 오늘 온 사람을 추가하세요")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await registerPlayers(page, ['가', '나', '다', '라']);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test.describe('모바일 하단 탭', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile');
  });

  test('탭 전환 시 해당 섹션만 보인다', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /^인원/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: '랜덤 뽑기 🎲' })).toBeHidden();
    // 전체 폭 버튼 + 빈 상태 버튼. 데스크톱 헤더 버튼이 모바일에 새면 3이 된다.
    await expect(page.getByRole('button', { name: '선수 등록' }).filter({ visible: true })).toHaveCount(2);
    await page.getByRole('tab', { name: /^팀뽑기/ }).click();
    await expect(page.getByRole('button', { name: '랜덤 뽑기 🎲' })).toBeVisible();
    await expect(page.getByRole('button', { name: '선수 등록' }).filter({ visible: true })).toHaveCount(0);
  });

  test('확정하면 대기 탭, 배정하면 코트 탭으로 자동 전환', async ({ page }) => {
    await registerPlayers(page, ['가', '나', '다', '라']);
    await page.getByRole('tab', { name: /^코트/ }).click();
    await addCourt(page);
    await page.getByRole('tab', { name: /^팀뽑기/ }).click();
    await page.getByRole('button', { name: '랜덤 뽑기 🎲' }).click();
    await page.getByRole('button', { name: '확정' }).click();
    await expect(page.getByRole('tab', { name: /^대기/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('방금 추가 · 1번째')).toBeVisible();
    await page.getByRole('button', { name: /코트 1/ }).click();
    await expect(page.getByRole('tab', { name: /^코트/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('게임 시작', { exact: true })).toBeVisible();
  });

  test('직접 선택 중인 선수가 탭을 오가도 유지된다', async ({ page }) => {
    await registerPlayers(page, ['가', '나', '다', '라']);
    await page.getByRole('tab', { name: /^팀뽑기/ }).click();
    await page.getByRole('button', { name: '직접 선택' }).click();
    // 선수 카드 버튼 이름에는 성별 아이콘·게임수가 섞여 있어, 보이는 카드(트로피 아이콘 포함)를 순서로 고른다
    const picker = page.locator('div.rounded-xl.border').filter({ hasText: '활성 선수 선택' });
    const cards = picker.locator('button:has(svg.lucide-trophy):visible');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(page.getByText('2/4 선택')).toBeVisible();
    await page.getByRole('tab', { name: /^인원/ }).click();
    await page.getByRole('tab', { name: /^팀뽑기/ }).click();
    await expect(page.getByText('2/4 선택')).toBeVisible();
    // 선택된 선수 카드에만 체크 아이콘(lucide-check)이 붙는다
    await expect(picker.locator('button:has(svg.lucide-check)')).toHaveCount(2);
  });

  test('마지막 콘텐츠가 하단 바에 가려지지 않는다', async ({ page }) => {
    await registerPlayers(page, ['가', '나', '다', '라', '마', '바', '사', '아']);
    const overflows = () => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    for (const name of ['자', '차', '카', '타', '파', '하']) {
      if (await overflows()) break;
      await registerPlayers(page, [name]);
    }
    expect(await overflows()).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = await page.getByRole('tablist', { name: '화면 섹션' }).boundingBox();
    // 현재 탭에서 보이는 마지막 섹션 카드(페이지 루트의 마지막 가시 자식)
    const lastCard = await page.evaluate(() => {
      const root = document.querySelector('[class*="max-md:pb-"]');
      const last = Array.from(root?.children ?? [])
        .filter((el) => (el as HTMLElement).offsetHeight > 0 && getComputedStyle(el).position !== 'fixed')
        .pop();
      const r = last?.getBoundingClientRect();
      // 카드 자체의 mb-3 마진은 제외하고, 바 높이 패딩이 만드는 여백만 잰다
      // (마진은 래퍼 밖으로 새어 나오므로 마지막 자식 체인을 따라 합산)
      let margin = 0;
      for (let el: Element | null = last ?? null; el; el = el.lastElementChild)
        margin += parseFloat(getComputedStyle(el).marginBottom) || 0;
      return r ? { y: r.y, height: r.height + margin } : null;
    });
    expect(bar).not.toBeNull();
    expect(lastCard).not.toBeNull();
    expect(bar!.y - (lastCard!.y + lastCard!.height)).toBeGreaterThanOrEqual(12);
  });

  test('탭을 직접 바꾸면 스크롤이 맨 위로 돌아간다', async ({ page }) => {
    await registerPlayers(page, ['가', '나', '다', '라', '마', '바', '사', '아']);
    // 도착 탭이 뷰포트보다 길어야 한다. 아니면 scrollTo가 없어도 브라우저가 scrollY를 0으로 clamp해 항상 통과한다.
    await page.getByRole('tab', { name: /^코트/ }).click();
    for (let i = 0; i < 8; i++) await addCourt(page);
    await page.getByRole('tab', { name: /^인원/ }).click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole('tab', { name: /^코트/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test('기록·초기화 시트가 바 위에 뜨고 버튼을 누를 수 있다', async ({ page }) => {
  await page.getByRole('button', { name: '게임 기록 · 초기화' }).click();
  await expect(page.getByRole('button', { name: '참석 전체 해제' })).toBeVisible();
  await page.getByRole('button', { name: '참석 전체 해제' }).click({ trial: true });
});

test('데스크톱: 하단 탭 바 없음, 섹션 모두 보임', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await expect(page.getByRole('tablist', { name: '화면 섹션' })).toBeHidden();
  await expect(page.getByRole('button', { name: '랜덤 뽑기 🎲' })).toBeVisible();
  await expect(page.getByRole('button', { name: '코트 추가' })).toBeVisible();

  // 헤더의 [선수 등록] 버튼 (빈 상태 버튼이 없도록 1명 등록)
  await registerPlayers(page, ['가']);
  const addButtons = page.getByRole('button', { name: '선수 등록' }).filter({ visible: true });
  await expect(addButtons).toHaveCount(1);
  await page.getByText(/^인원 풀 \(참석/).click();
  // 모달이 열리면 배경이 aria-hidden이라 role 쿼리가 못 찾는다 → CSS 셀렉터 사용
  const chip = page.locator('[role="switch"]');
  await expect(chip).toBeHidden();
  await addButtons.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(chip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
