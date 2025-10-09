'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const sessionSchema = z.object({
  name: z.string().min(2, '번개 모임 이름은 최소 2자 이상이어야 합니다'),
  venue_name: z.string().min(2, '체육관 이름은 최소 2자 이상이어야 합니다'),
  session_date: z.string().min(1, '날짜를 선택해주세요'),
  max_participants: z.number().min(4, '최소 4명 이상이어야 합니다').max(40, '최대 40명까지 가능합니다'),
  court_count: z.number().min(1, '최소 1개 코트 이상이어야 합니다').max(10, '최대 10개 코트까지 가능합니다'),
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface SessionFormProps {
  onSuccess?: (sessionId: string, accessCode: string) => void;
}

export default function SessionForm({ onSuccess }: SessionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      max_participants: 20,
      court_count: 1,
    },
  });

  const onSubmit = async (data: SessionFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/badminton/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create session');
      }

      toast.success('배드민턴 번개 모임이 생성되었습니다!', {
        description: `접근 코드: ${result.session.access_code}`,
      });

      if (onSuccess) {
        onSuccess(result.session.id, result.session.access_code);
      } else {
        router.push(`/badminton/${result.session.id}`);
      }
    } catch (error) {
      console.error('Session creation error:', error);
      toast.error('번개 모임 생성에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 현재 시간 이후로만 선택 가능하도록 min 값 설정
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // 로컬 시간대 보정
  const minDateTime = now.toISOString().slice(0, 16);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">🏸 배드민턴 번개 모임 생성</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">번개 모임 이름 *</Label>
              <Input id="name" placeholder="예: 저녁 배드민턴" {...register('name')} disabled={isLoading} />
              {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue_name">체육관 이름 *</Label>
              <Input
                id="venue_name"
                placeholder="예: 강남구민체육관"
                {...register('venue_name')}
                disabled={isLoading}
              />
              {errors.venue_name && <p className="text-sm text-red-600">{errors.venue_name.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_date">번개 모임 날짜 및 시간 *</Label>
            <Input
              id="session_date"
              type="datetime-local"
              min={minDateTime}
              {...register('session_date')}
              disabled={isLoading}
            />
            {errors.session_date && <p className="text-sm text-red-600">{errors.session_date.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_participants">최대 참가자 수</Label>
              <Input
                id="max_participants"
                type="number"
                min="4"
                max="40"
                {...register('max_participants', { valueAsNumber: true })}
                disabled={isLoading}
              />
              {errors.max_participants && <p className="text-sm text-red-600">{errors.max_participants.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="court_count">코트 수</Label>
              <Input
                id="court_count"
                type="number"
                min="1"
                max="10"
                {...register('court_count', { valueAsNumber: true })}
                disabled={isLoading}
              />
              {errors.court_count && <p className="text-sm text-red-600">{errors.court_count.message}</p>}
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '생성 중...' : '번개 모임 생성하기'}
            </Button>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              💡 <strong>팁:</strong>
            </p>
            <ul className="list-inside space-y-1 ml-2">
              <li>- 번개 모임 생성 후 자동으로 생성되는 접근 코드를 참가자들과 공유하세요</li>
              <li>- 참가자들은 성별과 실력 정보가 있어야 참가할 수 있습니다</li>
              <li>- 코트 수는 나중에 팀 배정 시 활용됩니다</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
