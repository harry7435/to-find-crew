'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, Star, Users, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getFavoriteSessionIds, removeFavoriteSessionId } from '@/utils/guestFavorites';

interface FavoriteSession {
  id: string;
  name: string;
  venue_name: string;
  session_date: string;
  status: string;
  max_participants: number;
  court_count: number;
  session_participants: { id: string }[];
  guest_participants: { id: string }[];
}

export default function FavoritesPage() {
  const [sessions, setSessions] = useState<FavoriteSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      const ids = getFavoriteSessionIds();
      if (ids.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('badminton_sessions')
          .select(
            `
            id, name, venue_name, session_date, status, max_participants, court_count,
            session_participants(id),
            guest_participants(id)
          `,
          )
          .in('id', ids)
          .order('session_date', { ascending: false });

        if (error) throw error;
        setSessions((data ?? []) as FavoriteSession[]);
      } catch (err) {
        console.error('Favorites fetch error:', err);
        setError('즐겨찾기한 모임을 불러올 수 없습니다');
        toast.error('즐겨찾기한 모임을 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const handleRemove = (sessionId: string) => {
    removeFavoriteSessionId(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast.success('즐겨찾기에서 제거했습니다');
  };

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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">즐겨찾기한 모임을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            홈으로
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">즐겨찾기</h1>
        <p className="text-gray-600 mt-2">
          게스트로 참가한 모임이 이 기기에 자동으로 저장됩니다. 초대 링크 없이 여기서 바로 들어갈 수 있어요.
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">아직 즐겨찾기한 모임이 없습니다</p>
              <p className="text-sm text-gray-500 mt-1">게스트로 모임에 참가하면 자동으로 여기에 추가돼요</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const participantCount =
              (session.session_participants?.length || 0) + (session.guest_participants?.length || 0);
            return (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/badminton/${session.id}`} className="flex-1 cursor-pointer">
                      <CardTitle className="text-xl mb-2">{session.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(session.status)}
                        <span className="text-sm text-gray-500">
                          {participantCount}/{session.max_participants}명 참가
                        </span>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(session.id)}
                      title="즐겨찾기에서 제거"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <Link href={`/badminton/${session.id}`} className="block cursor-pointer">
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
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
