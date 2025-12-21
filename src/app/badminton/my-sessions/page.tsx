'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AuthGuard from '@/components/auth/AuthGuard';
import { ArrowLeft, Calendar, MapPin, Users, Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Session {
  id: string;
  name: string;
  venue_name: string;
  session_date: string;
  status: string;
  max_participants: number;
  court_count: number;
  participant_count: number;
  created_at: string;
}

export default function MySessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMySessions = async () => {
      try {
        const response = await fetch('/api/badminton/sessions/my-sessions');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch sessions');
        }

        setSessions(result.sessions);
      } catch (error) {
        console.error('My sessions fetch error:', error);
        setError(error instanceof Error ? error.message : '모임 목록을 불러올 수 없습니다');
        toast.error('모임 목록을 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMySessions();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-100 text-green-800">모집중</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">진행중</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">완료</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">모임 목록을 불러오는 중...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="cursor-pointer">
              <ArrowLeft className="h-4 w-4 mr-2" />
              홈으로
            </Button>
          </Link>
          <Link href="/badminton/create">
            <Button size="sm" className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />새 모임 만들기
            </Button>
          </Link>
        </div>

        {/* 타이틀 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">내가 만든 모임</h1>
          <p className="text-gray-600 mt-2">내가 생성한 배드민턴 번개 모임 목록입니다</p>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* 모임 목록 */}
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 mb-4">아직 만든 모임이 없습니다</p>
                <Link href="/badminton/create">
                  <Button className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-2" />첫 번째 모임 만들기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Link key={session.id} href={`/badminton/${session.id}`} className="block cursor-pointer">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{session.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(session.status)}
                          <span className="text-sm text-gray-500">
                            {session.participant_count}/{session.max_participants}명 참가
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{session.venue_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{formatDate(session.session_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">코트 {session.court_count}개</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
