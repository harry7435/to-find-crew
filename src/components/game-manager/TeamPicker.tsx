'use client';

import { useMemo } from 'react';
import { Player, GameRecord } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';

interface TeamPickerProps {
  players: Player[];
  games: GameRecord[];
  pickedTeams: { teamA: [Player, Player]; teamB: [Player, Player] } | null;
  onPick: () => void;
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

export default function TeamPicker({ players, games, pickedTeams, onPick, onConfirm, onReject }: TeamPickerProps) {
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
        <Button onClick={onPick} disabled={!canPick} size="lg" className="w-full md:w-auto">
          스마트 매칭 🎲
        </Button>
        {!canPick && (
          <p className="text-sm text-gray-500">최소 4명의 활성 선수가 필요합니다 (현재: {activePlayers.length}명)</p>
        )}
        {canPick && (
          <div className="text-xs text-gray-500 space-y-1 max-w-md mx-auto">
            <p>💡 게임 수가 적은 선수 우선 배정</p>
            <p>💡 같은 페어 중복 최소화</p>
            <p>💡 밸런스 있는 매칭</p>
          </div>
        )}
      </div>
    );
  }

  const teamAPartnerCount = getPartnerCount(pickedTeams.teamA[0].id, pickedTeams.teamA[1].id);
  const teamBPartnerCount = getPartnerCount(pickedTeams.teamB[0].id, pickedTeams.teamB[1].id);

  return (
    <AnimatePresence>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team A */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-800 flex items-center justify-between">
                  <span>Team A</span>
                  {teamAPartnerCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {teamAPartnerCount}회 페어
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pickedTeams.teamA.map((player) => {
                  const ageLabel = getAgeGroupLabel(player.ageGroup);
                  const gameCount = playerGameCounts.get(player.id) || 0;
                  return (
                    <div key={player.id} className="flex items-center gap-2 p-2 bg-white rounded flex-wrap">
                      <span className="text-lg">{getGenderIcon(player.gender)}</span>
                      <span className="font-medium">{player.name}</span>
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
              <CardContent className="space-y-3">
                {pickedTeams.teamB.map((player) => {
                  const ageLabel = getAgeGroupLabel(player.ageGroup);
                  const gameCount = playerGameCounts.get(player.id) || 0;
                  return (
                    <div key={player.id} className="flex items-center gap-2 p-2 bg-white rounded flex-wrap">
                      <span className="text-lg">{getGenderIcon(player.gender)}</span>
                      <span className="font-medium">{player.name}</span>
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

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
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
