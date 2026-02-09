'use client';

import { useMemo } from 'react';
import { Player, GameRecord } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Star } from 'lucide-react';

interface TeamPickerProps {
  players: Player[];
  games: GameRecord[];
  pickedTeams: { teamA: [Player, Player]; teamB: [Player, Player] } | null;
  onRandomPick: () => void;
  onConfirm: () => void;
  onReject: () => void;
}

function getSkillLevelColor(level: string): string {
  switch (level) {
    case 'S':
      return 'bg-red-100 text-red-800';
    case 'A':
      return 'bg-orange-100 text-orange-800';
    case 'B':
      return 'bg-yellow-100 text-yellow-800';
    case 'C':
      return 'bg-blue-100 text-blue-800';
    case 'D':
      return 'bg-green-100 text-green-800';
    case 'E':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getGenderIcon(gender?: 'male' | 'female'): string {
  if (!gender) return '👤';
  return gender === 'male' ? '♂️' : '♀️';
}

function getAgeGroupLabel(ageGroup?: string): string | null {
  if (!ageGroup) return null;
  return ageGroup === '60s+' ? '60대+' : ageGroup.replace('s', '대');
}

export default function TeamPicker({
  players,
  games,
  pickedTeams,
  onRandomPick,
  onConfirm,
  onReject,
}: TeamPickerProps) {
  const activePlayers = players.filter((p) => p.status === 'active');
  const canPick = activePlayers.length >= 4;

  // 선수별 게임 수 계산
  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      [game.teamA[0], game.teamA[1], game.teamB[0], game.teamB[1]].forEach((playerId) => {
        counts.set(playerId, (counts.get(playerId) || 0) + 1);
      });
    });
    return counts;
  }, [games]);

  // 페어가 함께 게임한 횟수 계산
  const getPartnerCount = (playerId1: string, playerId2: string): number => {
    let count = 0;
    games.forEach((game) => {
      const teamA = game.teamA;
      const teamB = game.teamB;

      if (
        (teamA[0] === playerId1 && teamA[1] === playerId2) ||
        (teamA[1] === playerId1 && teamA[0] === playerId2) ||
        (teamB[0] === playerId1 && teamB[1] === playerId2) ||
        (teamB[1] === playerId1 && teamB[0] === playerId2)
      ) {
        count++;
      }
    });
    return count;
  };

  if (!pickedTeams) {
    return (
      <div className="text-center space-y-4">
        <Button onClick={onRandomPick} disabled={!canPick} size="lg" className="w-full md:w-auto">
          랜덤 뽑기 🎲
        </Button>
        {!canPick && (
          <p className="text-sm text-gray-500">최소 4명의 활성 선수가 필요합니다 (현재: {activePlayers.length}명)</p>
        )}
      </div>
    );
  }

  const teamAPartnerCount = getPartnerCount(pickedTeams.teamA[0].id, pickedTeams.teamA[1].id);
  const teamBPartnerCount = getPartnerCount(pickedTeams.teamB[0].id, pickedTeams.teamB[1].id);

  // 각 선수가 상대팀 선수들과 게임한 횟수 계산
  const getOpponentCount = (player1Id: string, player2Id: string): number => {
    let count = 0;
    games.forEach((game) => {
      // player1이 Team A, player2가 Team B인 경우
      if (
        (game.teamA.includes(player1Id) && game.teamB.includes(player2Id)) ||
        (game.teamB.includes(player1Id) && game.teamA.includes(player2Id))
      ) {
        count++;
      }
    });
    return count;
  };

  // 전체 4명이 함께 게임한 횟수 (정확히 같은 매치업)
  const exactMatchCount = games.filter((game) => {
    const aIds = [pickedTeams.teamA[0].id, pickedTeams.teamA[1].id];
    const bIds = [pickedTeams.teamB[0].id, pickedTeams.teamB[1].id];
    return (
      (game.teamA.every((id) => aIds.includes(id)) && game.teamB.every((id) => bIds.includes(id))) ||
      (game.teamA.every((id) => bIds.includes(id)) && game.teamB.every((id) => aIds.includes(id)))
    );
  }).length;

  // 크로스 매치 카운트 (팀A-팀B 간의 모든 조합)
  const crossMatchCounts = {
    a1_b1: getOpponentCount(pickedTeams.teamA[0].id, pickedTeams.teamB[0].id),
    a1_b2: getOpponentCount(pickedTeams.teamA[0].id, pickedTeams.teamB[1].id),
    a2_b1: getOpponentCount(pickedTeams.teamA[1].id, pickedTeams.teamB[0].id),
    a2_b2: getOpponentCount(pickedTeams.teamA[1].id, pickedTeams.teamB[1].id),
  };

  const totalCrossMatches = Object.values(crossMatchCounts).reduce((sum, count) => sum + count, 0);

  return (
    <AnimatePresence>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Team A */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg text-blue-800 flex items-center justify-between">
                  <span>Team A</span>
                  {teamAPartnerCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {teamAPartnerCount}회 페어
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {pickedTeams.teamA.map((player) => {
                  const ageLabel = getAgeGroupLabel(player.ageGroup);
                  const gameCount = playerGameCounts.get(player.id) || 0;
                  const isPinned = player.pinned === true;
                  return (
                    <div key={player.id} className="flex items-center gap-2 p-2 bg-white rounded flex-wrap">
                      <span className="text-lg">{getGenderIcon(player.gender)}</span>
                      <span className="font-medium">{player.name}</span>
                      {isPinned && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          <Star className="h-3 w-3 mr-1 fill-yellow-400" />
                          필수
                        </Badge>
                      )}
                      {player.skillLevel && (
                        <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                      )}
                      {ageLabel && <Badge variant="outline">{ageLabel}</Badge>}
                      <Badge variant="outline" className="text-xs ml-auto">
                        <Trophy className="h-3 w-3 mr-1" />
                        {gameCount}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Team B */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-lg text-red-800 flex items-center justify-between">
                  <span>Team B</span>
                  {teamBPartnerCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {teamBPartnerCount}회 페어
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {pickedTeams.teamB.map((player) => {
                  const ageLabel = getAgeGroupLabel(player.ageGroup);
                  const gameCount = playerGameCounts.get(player.id) || 0;
                  const isPinned = player.pinned === true;
                  return (
                    <div key={player.id} className="flex items-center gap-2 p-2 bg-white rounded flex-wrap">
                      <span className="text-lg">{getGenderIcon(player.gender)}</span>
                      <span className="font-medium">{player.name}</span>
                      {isPinned && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          <Star className="h-3 w-3 mr-1 fill-yellow-400" />
                          필수
                        </Badge>
                      )}
                      {player.skillLevel && (
                        <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                      )}
                      {ageLabel && <Badge variant="outline">{ageLabel}</Badge>}
                      <Badge variant="outline" className="text-xs ml-auto">
                        <Trophy className="h-3 w-3 mr-1" />
                        {gameCount}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Match Statistics */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base">매칭 통계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {/* 정확히 같은 매치업 */}
              {exactMatchCount > 0 && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">⚠️ 이 조합으로 {exactMatchCount}회 게임했습니다</p>
                </div>
              )}

              {/* 팀 내 페어 정보 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm">
                  <p className="text-gray-600 mb-1">Team A 페어</p>
                  <p className="font-medium">
                    {pickedTeams.teamA[0].name} & {pickedTeams.teamA[1].name}
                  </p>
                  {teamAPartnerCount > 0 ? (
                    <Badge variant="outline" className="mt-1 text-xs">
                      함께 {teamAPartnerCount}회
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 text-xs bg-green-50 text-green-700 border-green-200">
                      첫 페어 ✨
                    </Badge>
                  )}
                </div>
                <div className="text-sm">
                  <p className="text-gray-600 mb-1">Team B 페어</p>
                  <p className="font-medium">
                    {pickedTeams.teamB[0].name} & {pickedTeams.teamB[1].name}
                  </p>
                  {teamBPartnerCount > 0 ? (
                    <Badge variant="outline" className="mt-1 text-xs">
                      함께 {teamBPartnerCount}회
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 text-xs bg-green-50 text-green-700 border-green-200">
                      첫 페어 ✨
                    </Badge>
                  )}
                </div>
              </div>

              {/* 대전 기록 */}
              <div>
                <p className="text-sm text-gray-600 mb-2">대전 기록 (맞상대로 게임한 횟수)</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">
                      {pickedTeams.teamA[0].name} vs {pickedTeams.teamB[0].name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {crossMatchCounts.a1_b1}회
                    </Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">
                      {pickedTeams.teamA[0].name} vs {pickedTeams.teamB[1].name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {crossMatchCounts.a1_b2}회
                    </Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">
                      {pickedTeams.teamA[1].name} vs {pickedTeams.teamB[0].name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {crossMatchCounts.a2_b1}회
                    </Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span className="text-gray-600">
                      {pickedTeams.teamA[1].name} vs {pickedTeams.teamB[1].name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {crossMatchCounts.a2_b2}회
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">총 대전: {totalCrossMatches}회</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="flex gap-3 justify-center"
        >
          <Button onClick={onConfirm} size="lg" className="flex-1 md:flex-none">
            확정
          </Button>
          <Button onClick={onReject} variant="outline" size="lg" className="flex-1 md:flex-none">
            다시 뽑기
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
