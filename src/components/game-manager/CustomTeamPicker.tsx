'use client';

import { useState } from 'react';
import { Player } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Check, Clock } from 'lucide-react';
import { formatElapsed } from '@/utils/formatElapsed';
import { useTicker } from '@/hooks/useTicker';

interface CustomTeamPickerProps {
  players: Player[];
  onConfirm: (players: [Player, Player, Player, Player]) => void;
  onCancel: () => void;
}

function getSkillLevelColor(level?: string): string {
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

export default function CustomTeamPicker({ players, onConfirm, onCancel }: CustomTeamPickerProps) {
  const now = useTicker();
  const activePlayers = [...players.filter((p) => p.status === 'active')].sort((a, b) => {
    const aT = a.waitingSince ? new Date(a.waitingSince).getTime() : Number.POSITIVE_INFINITY;
    const bT = b.waitingSince ? new Date(b.waitingSince).getTime() : Number.POSITIVE_INFINITY;
    if (aT !== bT) return aT - bT; // 오래 기다린 순
    return a.name.localeCompare(b.name, 'ko');
  });
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  const handleTogglePlayer = (player: Player) => {
    const isSelected = selectedPlayers.find((p) => p.id === player.id);
    if (isSelected) {
      setSelectedPlayers(selectedPlayers.filter((p) => p.id !== player.id));
    } else {
      if (selectedPlayers.length < 4) {
        setSelectedPlayers([...selectedPlayers, player]);
      }
    }
  };

  const handleConfirm = () => {
    if (selectedPlayers.length === 4) {
      onConfirm(selectedPlayers as [Player, Player, Player, Player]);
    }
  };

  const canConfirm = selectedPlayers.length === 4;

  return (
    <div className="space-y-3">
      {/* 선택된 선수 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg text-blue-800">선택된 선수 ({selectedPlayers.length}/4)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {selectedPlayers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">아래에서 4명을 선택해주세요</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedPlayers.map((player) => {
                const isPinned = player.pinned === true;
                const waitingLabel = formatElapsed(player.waitingSince, now);
                return (
                  <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {waitingLabel && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <Clock className="h-3 w-3 mr-1" />
                          {waitingLabel}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePlayer(player)}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 활성 선수 선택 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg">활성 선수 선택</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activePlayers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">활성 선수가 없습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activePlayers.map((player) => {
                const isSelected = selectedPlayers.find((p) => p.id === player.id);
                const isPinned = player.pinned === true;
                const canSelect = selectedPlayers.length < 4 || isSelected;
                const waitingLabel = formatElapsed(player.waitingSince, now);

                return (
                  <button
                    key={player.id}
                    onClick={() => handleTogglePlayer(player)}
                    disabled={!canSelect}
                    className={`flex items-center justify-between p-2 border rounded text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-blue-300'
                        : canSelect
                          ? 'hover:bg-gray-50'
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {waitingLabel && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <Clock className="h-3 w-3 mr-1" />
                          {waitingLabel}
                        </Badge>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center">
        <Button onClick={handleConfirm} size="lg" disabled={!canConfirm} className="flex-1 md:flex-none">
          확정
        </Button>
        <Button onClick={onCancel} variant="outline" size="lg" className="flex-1 md:flex-none">
          취소
        </Button>
      </div>
    </div>
  );
}
