'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

// 자체적으로 헤더를 관리하는(또는 헤더 없이 몰입형으로 보여줘야 하는) 라우트는
// 전역 헤더 대상에서 제외한다.
// - /random-picker: 뽑기 진행 중엔 헤더 없이 전체 화면을 터치 캔버스로 써야 해서
//   페이지 자체 상태(isStarted)에 따라 Header를 직접 렌더링한다.
// - /auth/login, /auth/callback: 로그인 전/로그인 처리 중 화면이라 전역 헤더가
//   어색하다(자체 "홈으로 돌아가기" 링크, 로그인 버튼 중복 등).
const NO_GLOBAL_HEADER_ROUTES = ['/random-picker', '/auth/login', '/auth/callback'];

// 푸터는 헤더와 반대로 "허용 목록" 방식이다. 경기 보드(/badminton/[id], /game-manager)는
// 뷰포트를 꽉 채우는 대시보드라 하단에 한 줄이라도 더 들어가면 코트/대기열 영역이 줄어든다.
// 제외 목록으로 관리하면 새 보드 계열 페이지를 추가할 때마다 목록에 넣는 걸 잊는 순간
// 레이아웃이 깨지므로, 기본값을 "푸터 없음"으로 두고 문서·폼 성격의 페이지만 여기 등록한다.
// (법적으로 요구되는 것은 "쉽게 접근 가능한 공개"이지 "모든 페이지 하단 고정"이 아니다.
//  보드 화면에서는 헤더 사용자 메뉴의 약관/개인정보처리방침 항목이 진입점 역할을 한다.)
const SHOW_FOOTER_ROUTES = [
  '/',
  '/terms',
  '/privacy',
  '/profile',
  '/badminton/create',
  '/badminton/join',
  '/badminton/my-sessions',
  '/badminton/favorites',
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showHeader = !NO_GLOBAL_HEADER_ROUTES.includes(pathname);
  const showFooter = SHOW_FOOTER_ROUTES.includes(pathname);

  if (!showHeader) {
    return <>{children}</>;
  }

  // 푸터가 항상 화면 최하단에 붙되(sticky footer), 내용이 짧아도 스크롤이 생기지
  // 않도록 세로 flex로 감싼다. 내용 영역이 flex-1로 남은 높이를 모두 먹기 때문에
  // 페이지 루트에서 min-h-screen(=100vh)을 쓰면 pt-16 + 푸터 높이만큼 넘쳐서
  // 스크롤이 생긴다. 화면을 꽉 채워야 하는 페이지는 min-h-screen 대신 flex-1을 쓸 것.
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 flex-col pt-16">{children}</div>
      {showFooter && <Footer />}
    </div>
  );
}
