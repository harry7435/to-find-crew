'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionParticipant } from '@/types/badminton';
import { Users, Crown, Trophy } from 'lucide-react';

interface ParticipantsListProps {
  participants: SessionParticipant[];
  creatorId: string;
  maxParticipants: number;
}

const getSkillLevelText = (level: number) => {
  switch (level) {
    case 1:
      return '초급';
    case 2:
      return '초중급';
    case 3:
      return '중급';
    case 4:
      return '중상급';
    case 5:
      return '상급';
    default:
      return '미설정';
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

export default function ParticipantsList({ participants, creatorId, maxParticipants }: ParticipantsListProps) {
  const sortedParticipants = [...participants].sort((a, b) => {
    // 생성자를 맨 위로
    if (a.user.id === creatorId) return -1;
    if (b.user.id === creatorId) return 1;

    // 그 다음 참가 시간 순
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  const genderCount = participants.reduce(
    (acc, p) => {
      const gender = p.user.gender || 'unknown';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const skillLevelCount = participants.reduce(
    (acc, p) => {
      const level = p.user.skill_level || 0;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          참가자 목록 ({participants.length}/{maxParticipants})
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
          {sortedParticipants.map((participant) => {
            const isCreator = participant.user.id === creatorId;
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
                    {isCreator && <Crown className="h-4 w-4 text-yellow-500" />}
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

                <div className="text-right">
                  <p className="text-xs text-gray-500">{joinTime}</p>
                  {isCreator && <p className="text-xs text-yellow-600 font-medium">관리자</p>}
                </div>
              </div>
            );
          })}

          {participants.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>아직 참가자가 없습니다</p>
              <p className="text-sm">접근 코드를 공유해서 참가자를 모집해보세요</p>
            </div>
          )}

          {participants.length < maxParticipants && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">{maxParticipants - participants.length}명 더 참가할 수 있습니다</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
