'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AuthGuard from '@/components/auth/AuthGuard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { BadmintonSession } from '@/types/badminton';
import OrganizerManagementSection from '@/components/badminton/OrganizerManagementSection';

const sessionSchema = z.object({
  name: z.string().min(2, '번개 모임 이름은 최소 2자 이상이어야 합니다'),
  venue_name: z.string().min(2, '체육관 이름은 최소 2자 이상이어야 합니다'),
  session_date: z.string().min(1, '날짜를 선택해주세요'),
  max_participants: z.number().min(4, '최소 4명 이상이어야 합니다').max(40, '최대 40명까지 가능합니다'),
  court_count: z.number().min(1, '최소 1개 코트 이상이어야 합니다').max(10, '최대 10개 코트까지 가능합니다'),
  status: z.enum(['open', 'in_progress', 'completed']),
});

type SessionFormData = z.infer<typeof sessionSchema>;

// 날짜 변환 유틸 함수
const convertToDateTimeLocal = (isoDateString: string): string => {
  const date = new Date(isoDateString);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function EditSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<BadmintonSession | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
  });

  const statusValue = watch('status');

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/badminton/sessions/${sessionId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch session');
      }

      const session = result.session;
      setSession(session);

      // 폼에 데이터 채우기
      setValue('name', session.name);
      setValue('venue_name', session.venue_name);
      setValue('max_participants', session.max_participants);
      setValue('court_count', session.court_count);
      setValue('status', session.status);
      setValue('session_date', convertToDateTimeLocal(session.session_date));
    } catch (error) {
      console.error('Session fetch error:', error);
      setError(error instanceof Error ? error.message : '번개 모임을 불러올 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, setValue]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const isOrganizer =
    !!user &&
    !!session &&
    (user.id === session.creator_id || (session.session_organizers ?? []).some((o) => o.user_id === user.id));

  useEffect(() => {
    if (authLoading || isLoading || !session) return;
    if (!isOrganizer) {
      toast.error('운영진만 접근할 수 있습니다');
      router.replace(`/badminton/${sessionId}`);
    }
  }, [authLoading, isLoading, session, isOrganizer, sessionId, router]);

  const onSubmit = async (data: SessionFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/badminton/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update session');
      }

      toast.success('번개 모임이 수정되었습니다!');
      router.push(`/badminton/${sessionId}`);
    } catch (error) {
      console.error('Session update error:', error);
      toast.error('번개 모임 수정에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 현재 시간 이후로만 선택 가능하도록 min 값 설정
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">번개 모임 정보를 불러오는 중...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Link href="/badminton/join">
              <Button>목록으로 돌아가기</Button>
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!authLoading && session && !isOrganizer) {
    return null; // 리디렉트 중이므로 아무것도 렌더링하지 않음
  }

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href={`/badminton/${sessionId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로가기
            </Button>
          </Link>
        </div>

        {/* 수정 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">🏸 번개 모임 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">번개 모임 이름 *</Label>
                  <Input id="name" placeholder="예: 저녁 배드민턴" {...register('name')} disabled={isSaving} />
                  {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue_name">체육관 이름 *</Label>
                  <Input
                    id="venue_name"
                    placeholder="예: 강남구민체육관"
                    {...register('venue_name')}
                    disabled={isSaving}
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
                  disabled={isSaving}
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
                    disabled={isSaving}
                  />
                  {errors.max_participants && <p className="text-sm text-red-600">{errors.max_participants.message}</p>}
                  <p className="text-xs text-gray-500">현재 참가자 수보다 작게 설정할 수 없습니다</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="court_count">코트 수</Label>
                  <Input
                    id="court_count"
                    type="number"
                    min="1"
                    max="10"
                    {...register('court_count', { valueAsNumber: true })}
                    disabled={isSaving}
                  />
                  {errors.court_count && <p className="text-sm text-red-600">{errors.court_count.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">상태</Label>
                <Select
                  value={statusValue}
                  onValueChange={(value) => setValue('status', value as SessionFormData['status'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">모집중</SelectItem>
                    <SelectItem value="in_progress">진행중</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && <p className="text-sm text-red-600">{errors.status.message}</p>}
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="submit" className="flex-1 cursor-pointer" disabled={isSaving}>
                  {isSaving ? '저장 중...' : '변경사항 저장'}
                </Button>
                <Link href={`/badminton/${sessionId}`} className="flex-1">
                  <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={isSaving}>
                    취소
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {session && (
          <div className="mt-6">
            <OrganizerManagementSection
              sessionId={sessionId}
              creatorId={session.creator_id}
              creatorName={session.creator?.name ?? '생성자'}
              participants={session.session_participants ?? []}
              organizers={session.session_organizers ?? []}
              onOrganizersChanged={fetchSession}
            />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
