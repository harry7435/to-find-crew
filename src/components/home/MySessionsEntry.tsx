'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

// 역할(운영진/참여자)과 무관하게 "내가 속한 모임"으로 가는 입구. 로그인한 사람에게만 보인다.
// loading 중에도 null을 돌려줘서, 로그아웃 상태 방문자에게 잠깐 보였다 사라지는 깜빡임을 막는다.
export default function MySessionsEntry() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <Link
      href="/badminton/my-sessions"
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 outline-none transition-colors hover:bg-white focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden="true" className="text-xl">
        📋
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">내 모임</span>
        <span className="text-xs text-muted-foreground">만든 모임과 참여 중인 모임</span>
      </span>
      <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
