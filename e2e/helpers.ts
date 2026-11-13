import { expect, type Page, type TestInfo } from '@playwright/test';

/** 체험판에서 선수를 등록한다. 모달은 한 번만 열고(연속 등록 가능), 이름마다 채워 제출한 뒤 Escape로 닫는다. */
export async function registerPlayers(page: Page, names: string[], genders: ('male' | 'female')[] = []) {
  await page.getByRole('button', { name: '선수 등록' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const [i, name] of names.entries()) {
    await dialog.locator('#player-name').fill(name);
    const gender = genders[i] ?? (i % 2 === 0 ? 'male' : 'female');
    await dialog.locator('#player-gender').selectOption(gender);
    await dialog.getByRole('button', { name: '등록', exact: true }).click();
    await expect(page.getByText(`${name} 선수를 등록했어요`)).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

/** 코트 1개를 기본 이름으로 추가한다. */
export async function addCourt(page: Page) {
  await page.getByRole('button', { name: '코트 추가' }).click();
  await page.getByRole('button', { name: '추가', exact: true }).click();
}

export async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

/** mobile 프로젝트에서만 하단 탭을 누른다(desktop은 모든 섹션이 보이므로 no-op). */
export async function gotoTab(page: Page, testInfo: TestInfo, label: '인원' | '팀뽑기' | '대기' | '코트') {
  if (testInfo.project.name !== 'mobile') return;
  await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click();
}
