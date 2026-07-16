'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Player } from '@/hooks/useGameManager';

interface MigrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
}

const SKILL_LEVEL_TO_NUMBER: Record<NonNullable<Player['skillLevel']>, number> = {
  E: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

export default function MigrateModal({ isOpen, onClose, players }: MigrateModalProps) {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!sessionName.trim()) {
      toast.error('모임 이름을 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/badminton/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName.trim(),
          venue_name: '미정',
          session_date: new Date().toISOString(),
          max_participants: 20,
          court_count: 1,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '세션 생성에 실패했습니다');
      }

      const sessionId = result.session.id as string;

      if (players.length > 0) {
        const inserts = players.map((player) => ({
          session_id: sessionId,
          name: player.name,
          gender: player.gender ?? 'male',
          skill_level: player.skillLevel ? SKILL_LEVEL_TO_NUMBER[player.skillLevel] : 0,
          age_group: player.ageGroup === '60s+' ? '60s' : (player.ageGroup ?? '20s'),
        }));

        const { error: insertError } = await supabase.from('guest_participants').insert(inserts);
        if (insertError) {
          throw new Error('선수 명단 복사에 실패했습니다');
        }
      }

      toast.success('서버에 저장되었습니다');
      router.push(`/badminton/${sessionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '저장에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>서버에 저장하기</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="migrate-session-name">모임 이름</Label>
            <Input
              id="migrate-session-name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="예: 수요일 저녁 배드민턴"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500">
            현재 등록된 선수 {players.length}명이 새 모임으로 복사됩니다. 장소와 날짜는 나중에 모임 관리에서 수정할 수
            있습니다.
          </p>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? '저장 중...' : '저장하고 이동하기'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
