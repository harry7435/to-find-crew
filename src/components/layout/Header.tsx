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
import { LogOut, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function Header() {
  const { user, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('로그아웃되었습니다');
    } catch {
      toast.error('로그아웃에 실패했습니다');
    }
  };

  if (loading) {
    return (
      <header className="border-b bg-white">
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
    <header className="border-b fixed bg-white top-0 w-full">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          🏸 To Find Crew
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* 배드민턴 퀵 액세스 */}
              {/* <div className="hidden md:flex items-center gap-2">
                <Link href="/badminton/create">
                  <Button variant="outline" size="sm">
                    번개 모임 만들기
                  </Button>
                </Link>
                <Link href="/badminton/join">
                  <Button variant="outline" size="sm">
                    번개 모임 참가
                  </Button>
                </Link>
              </div> */}

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

                  {/* 모바일에서만 보이는 배드민턴 메뉴 */}
                  {/* <div className="md:hidden">
                    <Link href="/badminton/create">
                      <DropdownMenuItem>번개 모임 만들기</DropdownMenuItem>
                    </Link>
                    <Link href="/badminton/join">
                      <DropdownMenuItem>번개 모임 참가</DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                  </div> */}
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/badminton/my-sessions">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>내 모임</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>프로필</span>
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
