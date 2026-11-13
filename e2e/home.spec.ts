import { test, expect } from '@playwright/test';
import { noHorizontalScroll } from './helpers';

test('홈: 역할별 입구와 보조 기능', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('코트·게임 관리를 한 번에');

  await expect(page.getByRole('link', { name: /모임 운영하기/ })).toHaveAttribute('href', '/badminton/my-sessions');
  await expect(page.getByRole('link', { name: /코드로 참여하기/ })).toHaveAttribute('href', '/badminton/join');

  await expect(page.getByText('이 기기에만 저장돼요')).toBeVisible();
  await expect(page.getByText('손가락으로 당첨자를 뽑아요')).toBeVisible();
  // 회귀 방지: '도구' 제목은 의도적으로 제거했고 구분선으로 섹션을 나눈다
  await expect(page.getByText('도구', { exact: true })).toHaveCount(0);
});

test('홈: 모바일 레이아웃', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  const trialButton = page.getByRole('button', { name: '로그인 없이 체험해보기' });
  const pickerButton = page.getByRole('button', { name: '랜덤 뽑기' });
  await expect(trialButton).toBeVisible();
  await expect(pickerButton).toBeVisible();
  const trial = await trialButton.boundingBox();
  const picker = await pickerButton.boundingBox();
  expect(trial).not.toBeNull();
  expect(picker).not.toBeNull();
  expect(Math.abs(trial!.height - picker!.height)).toBeLessThanOrEqual(1);
});
