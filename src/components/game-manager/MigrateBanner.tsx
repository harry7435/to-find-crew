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
