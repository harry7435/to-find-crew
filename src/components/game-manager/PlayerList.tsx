'use client';

import { Player } from '@/hooks/useGameManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Trophy, Edit, Coffee, Play, Star } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  onRemovePlayer: (id: string) => void;
  onEditPlayer: (player: Player) => void;
  onToggleStatus: (id: string) => void;
  onTogglePinned: (id: string) => void;
  gameCountsMap?: Map<string, number>;
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

export default function PlayerList({
  players,
  onRemovePlayer,
  onEditPlayer,
  onToggleStatus,
  onTogglePinned,
  gameCountsMap,
}: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>등록된 선수가 없습니다</p>
        <p className="text-sm mt-2">위 폼에서 선수를 등록해주세요</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {players.map((player) => {
        const gameCount = gameCountsMap?.get(player.id) || 0;
        const ageLabel = getAgeGroupLabel(player.ageGroup);
        const isResting = player.status === 'resting';
        const isPinned = player.pinned === true;
        return (
          <div
            key={player.id}
            className={`flex items-center justify-between p-2 border rounded-lg hover:shadow-md transition-shadow ${
              isResting ? 'bg-gray-50 opacity-70' : isPinned ? 'bg-yellow-50 border-yellow-300' : ''
            }`}
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xl">{getGenderIcon(player.gender)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${isResting ? 'text-gray-500' : ''}`}>{player.name}</span>
                  {player.skillLevel && (
                    <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                  )}
                  {ageLabel && <Badge variant="outline">{ageLabel}</Badge>}
                  {isResting && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      <Coffee className="h-3 w-3 mr-1" />
                      휴식중
                    </Badge>
                  )}
                  {isPinned && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      <Star className="h-3 w-3 mr-1" />
                      필수 포함
                    </Badge>
                  )}
                </div>
                {gameCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                    <Trophy className="h-3 w-3" />
                    <span>{gameCount}게임</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTogglePinned(player.id)}
                title={isPinned ? '필수 포함 해제' : '필수 포함 설정'}
                disabled={isResting}
              >
                <Star className={`h-4 w-4 ${isPinned ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(player.id)}
                title={isResting ? '게임 복귀' : '휴식 설정'}
              >
                {isResting ? <Play className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEditPlayer(player)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRemovePlayer(player.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
