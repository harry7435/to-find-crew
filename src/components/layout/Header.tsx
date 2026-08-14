'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { Calendar, FileText, LogOut, MessageCircle, Shield, Star, User } from 'lucide-react';
import { toast } from 'sonner';

const FEEDBACK_URL = 'https://open.kakao.com/o/s9oD9DIi';

// 로딩 중 헤더와 로딩 완료 헤더가 반드시 같은 클래스를 써야 한다.
// AppShell은 헤더가 fixed(문서 흐름에서 빠짐)라는 전제로 항상 pt-16을 주므로,
// 한쪽만 fixed가 아니면 loading이 풀리는 순간 본문이 헤더 높이만큼 위로 튄다.
// (로그인/로그아웃 직후 홈으로 돌아올 때 getSession() 재확인으로 loading이 다시
//  true가 되면서 이 점프가 눈에 띄게 재현됐다.)
const HEADER_CLASS = 'border-b fixed bg-white top-0 w-full z-10';

export default function Header() {
  const { user, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('로그아웃되었습니다');
      // AuthGuard로 보호된 페이지(내 모임 등)에서 로그아웃하면, signOut으로 user가
      // null이 되는 순간 그 페이지의 AuthGuard가 자체적으로 /auth/login으로
      // 리다이렉트를 걸어 클라이언트 라우터 이동과 경쟁한다. 하드 네비게이션으로
      // 페이지를 통째로 새로고침해 그 경쟁 자체를 없앤다.
      window.location.href = '/';
    } catch {
      toast.error('로그아웃에 실패했습니다');
    }
  };

  if (loading) {
    return (
      <header className={HEADER_CLASS}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            🏸 To Find Crew
          </Link>
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </header>
    );
  }

  return (
    <header className={HEADER_CLASS}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          🏸 To Find Crew
        </Link>

        <div className="flex items-center gap-4">
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">문의하기</span>
          </a>

          {!user && (
            <Link
              href="/badminton/favorites"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">즐겨찾기</span>
            </Link>
          )}

          {user ? (
            <>
              {/* 사용자 메뉴 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.user_metadata?.picture || user.user_metadata?.avatar_url} />
                      <AvatarFallback>
                        {user.user_metadata?.nickname?.slice(0, 2) ||
                          user.user_metadata?.full_name?.slice(0, 2) ||
                          user.email?.slice(0, 2).toUpperCase() ||
                          '🏸'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">
                        {user.user_metadata?.nickname || user.user_metadata?.full_name || user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email?.includes('@temp.com') ? '카카오 로그인' : user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/badminton/my-sessions">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>내 모임</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/badminton/favorites">
                      <Star className="mr-2 h-4 w-4" />
                      <span>즐겨찾기</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>프로필</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* 경기 보드 화면에는 푸터가 없다(AppShell의 SHOW_FOOTER_ROUTES 참고).
                      로그인 사용자에게는 이 메뉴가 약관/방침으로 가는 상시 진입점이다. */}
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/terms">
                      <FileText className="mr-2 h-4 w-4" />
                      <span>서비스 이용약관</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/privacy">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>개인정보처리방침</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>로그아웃</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/auth/login">
              <Button>로그인</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
