'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BadmintonSession } from '@/types/badminton';
import { Calendar, MapPin, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const accessCode = params.code as string;

  const [session, setSession] = useState<BadmintonSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 게스트 정보 입력 폼
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    gender: '' as 'male' | 'female' | '',
    skill_level: '',
    age_group: '' as '10s' | '20s' | '30s' | '40s' | '50s' | '60s' | '',
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data, error } = await supabase
          .from('badminton_sessions')
          .select(
            `
            *,
            creator:users!creator_id(id, name, email),
            session_participants(id, user_id),
            guest_participants(id)
          `,
          )
          .eq('access_code', accessCode.toUpperCase())
          .single();

        if (error || !data) {
          throw new Error('Invalid access code');
        }

        setSession(data as BadmintonSession);
      } catch (err) {
        console.error('Session fetch error:', err);
        setError(err instanceof Error ? err.message : '번개 모임을 찾을 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    };

    if (accessCode) {
      fetchSession();
    }
  }, [accessCode]);

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestInfo.name || !guestInfo.gender || !guestInfo.skill_level || !guestInfo.age_group) {
      toast.error('모든 정보를 입력해주세요');
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch('/api/badminton/sessions/join-guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_code: accessCode.toUpperCase(),
          ...guestInfo,
          skill_level: parseInt(guestInfo.skill_level),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join session');
      }

      toast.success('번개 모임에 참가했습니다!', {
        description: `${session?.name}에 참가하셨습니다`,
      });

      router.push(`/badminton/${result.session.id}`);
    } catch (error) {
      console.error('Join error:', error);
      toast.error('참가에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleAuthenticatedJoin = async () => {
    setIsJoining(true);
    try {
      const response = await fetch('/api/badminton/sessions/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_code: accessCode.toUpperCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join session');
      }

      toast.success('번개 모임에 참가했습니다!');
      router.push(`/badminton/${result.session.id}`);
    } catch (error) {
      console.error('Join error:', error);
      toast.error('참가에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">번개 모임 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '번개 모임을 찾을 수 없습니다'}</p>
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  const sessionDateTime = new Date(session.session_date).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalParticipants = (session.session_participants?.length || 0) + (session.guest_participants?.length || 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </Link>
      </div>

      {/* 세션 정보 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">{session.name}</CardTitle>
          <p className="text-sm text-gray-600">생성자: {session.creator?.name}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              <span>{session.venue_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span>{sessionDateTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <span>
                {totalParticipants} / {session.max_participants}명
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 참가 폼 */}
      <Card>
        <CardHeader>
          <CardTitle>{user ? '번개 모임 참가' : '게스트로 참가'}</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">로그인된 상태로 번개 모임에 참가합니다.</p>
              <Button onClick={handleAuthenticatedJoin} disabled={isJoining} className="w-full">
                {isJoining ? '참가 중...' : '참가하기'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleGuestJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  placeholder="홍길동"
                  value={guestInfo.name}
                  onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                  disabled={isJoining}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">성별 *</Label>
                <select
                  id="gender"
                  value={guestInfo.gender}
                  onChange={(e) => setGuestInfo({ ...guestInfo, gender: e.target.value as 'male' | 'female' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isJoining}
                  required
                >
                  <option value="">선택해주세요</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skill_level">실력 급수 *</Label>
                <select
                  id="skill_level"
                  value={guestInfo.skill_level}
                  onChange={(e) => setGuestInfo({ ...guestInfo, skill_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isJoining}
                  required
                >
                  <option value="">선택해주세요</option>
                  <option value="0">E급 (초보)</option>
                  <option value="1">D급</option>
                  <option value="2">C급</option>
                  <option value="3">B급</option>
                  <option value="4">A급</option>
                  <option value="5">S급 (고급)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age_group">나이대 *</Label>
                <select
                  id="age_group"
                  value={guestInfo.age_group}
                  onChange={(e) =>
                    setGuestInfo({
                      ...guestInfo,
                      age_group: e.target.value as '10s' | '20s' | '30s' | '40s' | '50s' | '60s',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isJoining}
                  required
                >
                  <option value="">선택해주세요</option>
                  <option value="10s">10대</option>
                  <option value="20s">20대</option>
                  <option value="30s">30대</option>
                  <option value="40s">40대</option>
                  <option value="50s">50대</option>
                  <option value="60s">60대 이상</option>
                </select>
              </div>

              <Button type="submit" disabled={isJoining} className="w-full">
                {isJoining ? '참가 중...' : '게스트로 참가하기'}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                로그인하지 않고 게스트로 참가합니다. 정확한 정보를 입력해주세요.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
