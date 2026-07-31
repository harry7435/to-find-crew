'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

// 자체적으로 헤더를 관리하는(또는 헤더 없이 몰입형으로 보여줘야 하는) 라우트는
// 전역 헤더 대상에서 제외한다.
// - /random-picker: 뽑기 진행 중엔 헤더 없이 전체 화면을 터치 캔버스로 써야 해서
//   페이지 자체 상태(isStarted)에 따라 Header를 직접 렌더링한다.
// - /auth/login, /auth/callback: 로그인 전/로그인 처리 중 화면이라 전역 헤더가
//   어색하다(자체 "홈으로 돌아가기" 링크, 로그인 버튼 중복 등).
const NO_GLOBAL_HEADER_ROUTES = ['/random-picker', '/auth/login', '/auth/callback'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showHeader = !NO_GLOBAL_HEADER_ROUTES.includes(pathname);

  if (!showHeader) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <div className="pt-16">{children}</div>
    </>
  );
}
