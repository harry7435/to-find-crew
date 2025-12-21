'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SessionParticipant, GuestParticipant } from '@/types/badminton';
import { Users, Crown, Trophy, UserCircle, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface ParticipantsListProps {
  participants: SessionParticipant[];
  guestParticipants?: GuestParticipant[];
  creatorId: string;
  maxParticipants: number;
  currentUserId?: string;
  sessionId: string;
  onParticipantRemoved?: () => void;
}

const getSkillLevelText = (level: number) => {
  switch (level) {
    case 0:
      return 'E급';
    case 1:
      return 'D급';
    case 2:
      return 'C급';
    case 3:
      return 'B급';
    case 4:
      return 'A급';
    case 5:
      return 'S급';
    default:
      return '미설정';
  }
};

const getAgeGroupText = (ageGroup: string) => {
  switch (ageGroup) {
    case '10s':
      return '10대';
    case '20s':
      return '20대';
    case '30s':
      return '30대';
    case '40s':
      return '40대';
    case '50s':
      return '50대';
    case '60s':
      return '60대+';
    default:
      return '';
  }
};

const getSkillLevelColor = (level: number) => {
  switch (level) {
    case 1:
      return 'bg-green-100 text-green-800';
    case 2:
      return 'bg-blue-100 text-blue-800';
    case 3:
      return 'bg-yellow-100 text-yellow-800';
    case 4:
      return 'bg-orange-100 text-orange-800';
    case 5:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getGenderIcon = (gender: string) => {
  switch (gender) {
    case 'male':
      return '♂️';
    case 'female':
      return '♀️';
    default:
      return '👤';
  }
};

export default function ParticipantsList({
  participants,
  guestParticipants = [],
  creatorId,
  maxParticipants,
  currentUserId,
  sessionId,
  onParticipantRemoved,
}: ParticipantsListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const isCreator = currentUserId === creatorId;

  // API 호출 함수
  const removeParticipantApi = async (sessionId: string, participantId: string, participantType: 'user' | 'guest') => {
    const response = await fetch('/api/badminton/sessions/remove-participant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        participant_id: participantId,
        participant_type: participantType,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to remove participant');
    }

    return response.json();
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    // 생성자를 맨 위로
    if (a.user.id === creatorId) return -1;
    if (b.user.id === creatorId) return 1;

    // 그 다음 참가 시간 순
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  const sortedGuestParticipants = [...guestParticipants].sort(
    (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
  );

  const totalParticipants = participants.length + guestParticipants.length;

  // 통계 계산 (일반 참가자 + 게스트)
  const genderCount = [...participants, ...guestParticipants].reduce(
    (acc, p) => {
      const gender = 'user' in p ? p.user.gender || 'unknown' : p.gender;
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const skillLevelCount = [...participants, ...guestParticipants].reduce(
    (acc, p) => {
      const level = 'user' in p ? p.user.skill_level || 0 : p.skill_level;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  const handleRemoveParticipant = async (participantId: string, participantType: 'user' | 'guest') => {
    if (!confirm('정말 이 참가자를 퇴장시키겠습니까?')) {
      return;
    }

    setRemovingId(participantId);
    try {
      await removeParticipantApi(sessionId, participantId, participantType);
      toast.success('참가자가 퇴장되었습니다');
      onParticipantRemoved?.();
    } catch (error) {
      console.error('Remove participant error:', error);
      toast.error('참가자 퇴장에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          참가자 목록 ({totalParticipants}/{maxParticipants})
        </CardTitle>

        {/* 참가자 통계 */}
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="flex gap-1">
            <span>성별:</span>
            {genderCount.male && <Badge variant="outline">남성 {genderCount.male}명</Badge>}
            {genderCount.female && <Badge variant="outline">여성 {genderCount.female}명</Badge>}
            {genderCount.unknown && <Badge variant="outline">미설정 {genderCount.unknown}명</Badge>}
          </div>
          <div className="flex gap-1">
            <span>실력:</span>
            {Object.entries(skillLevelCount)
              .filter(([level, count]) => count > 0 && level !== '0')
              .map(([level, count]) => (
                <Badge key={level} variant="outline" className={getSkillLevelColor(parseInt(level))}>
                  {getSkillLevelText(parseInt(level))} {count}명
                </Badge>
              ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* 일반 참가자 (인증된 사용자) */}
          {sortedParticipants.map((participant) => {
            const isParticipantCreator = participant.user.id === creatorId;
            const joinTime = new Date(participant.joined_at).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={participant.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={participant.user.profile_image} />
                  <AvatarFallback>{participant.user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{participant.user.name}</p>
                    {isParticipantCreator && <Crown className="h-4 w-4 text-yellow-500" />}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">{getGenderIcon(participant.user.gender || '')}</span>

                    <Badge
                      variant="secondary"
                      className={`text-xs ${getSkillLevelColor(participant.user.skill_level || 0)}`}
                    >
                      {getSkillLevelText(participant.user.skill_level || 0)}
                    </Badge>

                    {participant.games_played > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Trophy className="h-3 w-3 mr-1" />
                        {participant.games_played}게임
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{joinTime}</p>
                    {isParticipantCreator && <p className="text-xs text-yellow-600 font-medium">관리자</p>}
                  </div>

                  {/* 관리자 전용: 퇴장 버튼 (생성자는 퇴장 불가) */}
                  {isCreator && !isParticipantCreator && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveParticipant(participant.id, 'user')}
                      disabled={removingId === participant.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 게스트 참가자 */}
          {sortedGuestParticipants.map((guest) => {
            const joinTime = new Date(guest.joined_at).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={guest.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-blue-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{guest.name}</p>
                    <Badge variant="outline" className="text-xs bg-white">
                      게스트
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">{getGenderIcon(guest.gender)}</span>

                    <Badge variant="secondary" className={`text-xs ${getSkillLevelColor(guest.skill_level)}`}>
                      {getSkillLevelText(guest.skill_level)}
                    </Badge>

                    <Badge variant="outline" className="text-xs bg-white">
                      {getAgeGroupText(guest.age_group)}
                    </Badge>

                    {guest.games_played > 0 && (
                      <Badge variant="outline" className="text-xs bg-white">
                        <Trophy className="h-3 w-3 mr-1" />
                        {guest.games_played}게임
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{joinTime}</p>
                  </div>

                  {/* 관리자 전용: 게스트 퇴장 버튼 */}
                  {isCreator && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveParticipant(guest.id, 'guest')}
                      disabled={removingId === guest.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {totalParticipants === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>아직 참가자가 없습니다</p>
              <p className="text-sm">접근 코드를 공유해서 참가자를 모집해보세요</p>
            </div>
          )}

          {totalParticipants < maxParticipants && totalParticipants > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">{maxParticipants - totalParticipants}명 더 참가할 수 있습니다</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
