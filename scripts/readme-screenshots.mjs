// README용 화면 캡처 스크립트.
// 사용: `pnpm dev` 를 띄운 뒤 `node scripts/readme-screenshots.mjs` (BASE_URL 로 주소 변경 가능).
// 가짜 데이터만 쓰고 로그인/DB 는 건드리지 않는다. 결과는 docs/images/*.png.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = new URL('../docs/images/', import.meta.url).pathname;
const SCALE = Number(process.env.DESKTOP_SCALE ?? 2);
mkdirSync(OUT, { recursive: true });

const NAMES = ['김민준', '이서연', '박지호', '최수아', '정우진', '강하은', '조현우', '윤지민', '임도윤', '한예린', '오시우', '서유나', '신하준', '문채원', '배준서', '송지아'];
const GENDERS = ['male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female'];

const VIEWPORTS = {
  mobile: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: SCALE },
};

const browser = await chromium.launch();

async function capture(kind, path, file, prepare, viewport) {
  const ctx = await browser.newContext({ ...VIEWPORTS[kind], ...(viewport && { viewport }), locale: 'ko-KR' });
  const page = await ctx.newPage(); console.log('capturing', file);
  await page.goto(BASE_URL + path, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  if (prepare) await prepare(page, kind);
  await page.mouse.move(2, 2); // 호버 중에는 sonner 토스트가 안 사라진다
  // 토스트(sonner)가 사라질 때까지 대기
  await page.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + file });
  console.log('saved', file);
  await ctx.close();
}

async function tab(page, kind, label) {
  if (kind === 'mobile') await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click();
}

async function fillBoard(page, kind) {
  await page.getByRole('button', { name: '선수 등록' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog');
  for (const [i, name] of NAMES.entries()) {
    await dialog.locator('#player-name').fill(name);
    await dialog.locator('#player-gender').selectOption(GENDERS[i]);
    await dialog.getByRole('button', { name: '등록', exact: true }).click();
    await page.getByText(`${name} 선수를 등록했어요`).waitFor();
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });

  await tab(page, kind, '코트');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '코트 추가' }).click();
    await page.getByRole('button', { name: '추가', exact: true }).click();
  }
  // 랜덤 뽑기 → 확정 으로 대기열에 3팀 적재
  for (let i = 0; i < 3; i++) {
    await tab(page, kind, '팀뽑기');
    await page.getByRole('button', { name: '랜덤 뽑기 🎲' }).click();
    await page.getByRole('button', { name: '확정' }).click();
    await page.getByText(`대기열 ${i + 1}번째로 추가했어요`).waitFor();
  }
  // 대기열 앞의 두 팀을 코트 1, 2 에서 경기 시작 (3번째 팀은 대기열에 남긴다)
  for (const court of ['코트 1', '코트 2']) {
    await tab(page, kind, '대기');
    await page.getByRole('button', { name: new RegExp(court) }).filter({ visible: true }).first().click();
    await page.getByText(`${court}에서 게임을 시작했어요`).waitFor();
    await page.waitForTimeout(800); // 대기열 갱신 전에 다음 클릭이 같은 팀을 집지 않게
  }
  await tab(page, kind, '코트');
  await page.waitForTimeout(5000); // '방금' 도착 강조가 풀릴 때까지
  if (kind === 'desktop') {
    // 데스크톱은 [팀 뽑기]~[코트 관리] 카드가 헤더 바로 아래부터 끊김 없이 보이도록 스크롤
    await page.getByText('팀 뽑기', { exact: true }).first().evaluate((el) => {
      const card = el.closest('.rounded-xl') ?? el.parentElement;
      window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 76);
    });
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}

await capture('mobile', '/', 'home-mobile.png');
await capture('desktop', '/', 'home-desktop.png');
await capture('mobile', '/random-picker', 'random-picker-mobile.png');
await capture('mobile', '/game-manager', 'game-board-mobile.png', async (p, k) => { await fillBoard(p, k); });
await capture('desktop', '/game-manager', 'game-board-desktop.png', async (p, k) => { await fillBoard(p, k); }, { width: 1280, height: 900 }); // 팀 뽑기·대기열·코트가 잘리지 않도록 이 컷만 세로를 조정

await browser.close();
