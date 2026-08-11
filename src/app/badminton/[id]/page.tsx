'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ParticipantsList from '@/components/badminton/ParticipantsList';
import OrganizerBoard from '@/components/badminton/OrganizerBoard';
import SpectatorBoard from '@/components/badminton/SpectatorBoard';
import UserInfoModal from '@/components/badminton/UserInfoModal';
import { BadmintonSession } from '@/types/badminton';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, MapPin, Users, Copy, Share2, QrCode, Settings } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<BadmintonSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/badminton/sessions/${sessionId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch session');
      }

      setSession(result.session);
    } catch (error) {
      console.error('Session fetch error:', error);
      setError(error instanceof Error ? error.message : '번개 모임을 불러올 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // 프로필 확인 및 모달 표시 로직 (로그인한 사용자만)
  const checkUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase.from('users').select('gender, skill_level').eq('id', user.id).single();

      // 프로필 정보가 없거나 불완전하면 모달 표시
      if (!profile || !profile.gender || !profile.skill_level) {
        setShowUserInfoModal(true);
      }
    } catch (error) {
      console.error('Failed to check user profile:', error);
      // 프로필 확인 실패 시에도 모달 표시
      setShowUserInfoModal(true);
    }
  }, [user]);

  useEffect(() => {
    fetchSession();
    checkUserProfile();
  }, [fetchSession, checkUserProfile]);

  // 참가자 목록 실시간 반영 (다른 브라우저에서 참가/게스트 등록/퇴장 시 자동 새로고침)
  useEffect(() => {
    const channel = supabase
      .channel(`session-participants-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_participants', filter: `session_id=eq.${sessionId}` },
        () => fetchSession(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        () => fetchSession(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSession]);

  // 사용자 정보 업데이트 함수
  const handleUserInfoSubmit = async (data: { gender: string; age_group: string; skill_level: string }) => {
    setIsUpdatingProfile(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // 실력 급수를 숫자로 변환
      const skillLevelMap: { [key: string]: number } = {
        S: 5,
        A: 4,
        B: 3,
        C: 2,
        D: 1,
        E: 0,
      };

      const { error } = await supabase
        .from('users')
        .update({
          gender: data.gender,
          skill_level: skillLevelMap[data.skill_level],
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      toast.success('프로필이 업데이트되었습니다!');
      setShowUserInfoModal(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('프로필 업데이트에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const copyAccessCode = () => {
    if (session?.access_code) {
      navigator.clipboard.writeText(session.access_code);
      toast.success('접근 코드가 복사되었습니다!');
    }
  };

  const copyInviteLink = () => {
    if (session?.access_code) {
      const inviteUrl = `${window.location.origin}/badminton/invite/${session.access_code}`;
      navigator.clipboard.writeText(inviteUrl);
      toast.success('초대 링크가 복사되었습니다!');
    }
  };

  const shareSession = async () => {
    if (session) {
      const shareData = {
        title: `🏸 ${session.name}`,
        text: `배드민턴 번개 모임에 참가하세요!\n체육관: ${session.venue_name}\n접근코드: ${session.access_code}`,
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (error) {
          // 사용자가 취소한 경우 무시
          if (error instanceof Error && error.name !== 'AbortError') {
            fallbackShare();
          }
        }
      } else {
        fallbackShare();
      }
    }
  };

  const fallbackShare = () => {
    if (session) {
      const text = `🏸 ${session.name}\n체육관: ${session.venue_name}\n접근코드: ${session.access_code}\n${window.location.href}`;
      navigator.clipboard.writeText(text);
      toast.success('공유 정보가 복사되었습니다!');
    }
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
          <Link href="/badminton/join">
            <Button>다시 시도하기</Button>
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

  const isOrganizer = user?.id === session.creator_id;

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowQRCode(!showQRCode)}>
              <QrCode className="h-4 w-4 mr-2" />
              QR 코드
            </Button>
            <Button variant="outline" size="sm" onClick={shareSession}>
              <Share2 className="h-4 w-4 mr-2" />
              공유
            </Button>
          </div>
        </div>

        {/* QR 코드 섹션 */}
        {showQRCode && session && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">QR 코드로 참가하기</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-lg border-2">
                  <QRCodeSVG
                    value={`${window.location.origin}/badminton/invite/${session.access_code}`}
                    size={256}
                    level="H"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-600">QR 코드를 스캔하면 바로 참가할 수 있습니다</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyInviteLink}>
                      <Copy className="h-4 w-4 mr-2" />
                      초대 링크 복사
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 번개 모임 정보 카드 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{session.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {getStatusBadge(session.status)}
                  {session.creator && <span className="text-sm text-gray-600">생성자: {session.creator.name}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600">접근 코드</span>
                  <Button variant="outline" size="sm" onClick={copyAccessCode} className="font-mono">
                    <Copy className="h-4 w-4 mr-1" />
                    {session.access_code}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <span>코트 {session.court_count}개</span>
              </div>
            </div>

            {/* 관리자 전용 버튼 */}
            {user && session.creator_id === user.id && (
              <div className="pt-4 border-t">
                <Link href={`/badminton/edit/${session.id}`}>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    모임 관리
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 참가자 목록 */}
        <ParticipantsList
          participants={session.session_participants || []}
          guestParticipants={session.guest_participants || []}
          creatorId={session.creator_id}
          maxParticipants={session.max_participants}
          currentUserId={user?.id}
          sessionId={session.id}
          onParticipantRemoved={fetchSession}
        />

        {/* 게임 관리 (모임장) / 실시간 현황판 (그 외 전원) */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">{isOrganizer ? '게임 관리' : '실시간 현황판'}</h2>
          {session.status === 'completed' ? (
            <p className="text-sm text-gray-500">
              종료된 모임입니다. {isOrganizer ? '게임 관리' : '현황판'} 기능은 사용할 수 없습니다.
            </p>
          ) : isOrganizer ? (
            <OrganizerBoard sessionId={session.id} />
          ) : (
            <SpectatorBoard sessionId={session.id} />
          )}
        </div>

        {/* 팀 정보 (있는 경우) */}
        {session.teams && session.teams.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>팀 배정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {session.teams.map((team) => (
                  <div key={team.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">팀 {team.team_number}</h4>
                      <Badge variant="outline">{team.court_number ? `코트 ${team.court_number}` : '대기'}</Badge>
                    </div>
                    <div className="space-y-2">
                      {team.team_members?.map((member) => (
                        <div key={member.id} className="text-sm">
                          {member.user.name}
                        </div>
                      )) || <p className="text-sm text-gray-500">멤버 배정 대기</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 사용자 정보 입력 모달 (로그인한 사용자만) */}
      {user && (
        <UserInfoModal
          isOpen={showUserInfoModal}
          onClose={() => setShowUserInfoModal(false)}
          onSubmit={handleUserInfoSubmit}
          isLoading={isUpdatingProfile}
        />
      )}

      {/* 게스트 사용자 안내 */}
      {!user && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <p className="text-sm text-blue-800">
                💡 <strong>게스트로 볼 수 있습니다</strong>
              </p>
              <p className="text-xs text-blue-600">
                로그인하시면 참가 취소, 프로필 관리 등 더 많은 기능을 사용할 수 있습니다.
              </p>
              <Link href="/auth/login">
                <Button size="sm" variant="outline" className="mt-2 cursor-pointer">
                  로그인하기
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
