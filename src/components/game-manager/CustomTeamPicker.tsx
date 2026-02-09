'use client';

import { useState } from 'react';
import { Player } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

interface CustomTeamPickerProps {
  players: Player[];
  onConfirm: (teamA: [Player, Player], teamB: [Player, Player]) => void;
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
  const activePlayers = players.filter((p) => p.status === 'active');
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);

  const availablePlayers = activePlayers.filter(
    (p) => !teamA.find((t) => t.id === p.id) && !teamB.find((t) => t.id === p.id),
  );

  const handleAddToTeamA = (player: Player) => {
    if (teamA.length < 2) {
      setTeamA([...teamA, player]);
    }
  };

  const handleAddToTeamB = (player: Player) => {
    if (teamB.length < 2) {
      setTeamB([...teamB, player]);
    }
  };

  const handleRemoveFromTeamA = (playerId: string) => {
    setTeamA(teamA.filter((p) => p.id !== playerId));
  };

  const handleRemoveFromTeamB = (playerId: string) => {
    setTeamB(teamB.filter((p) => p.id !== playerId));
  };

  const handleConfirm = () => {
    if (teamA.length === 2 && teamB.length === 2) {
      onConfirm([teamA[0], teamA[1]] as [Player, Player], [teamB[0], teamB[1]] as [Player, Player]);
    }
  };

  const canConfirm = teamA.length === 2 && teamB.length === 2;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg text-blue-800">Team A ({teamA.length}/2)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamA.length === 0 && <p className="text-sm text-gray-500 text-center py-4">선수를 선택해주세요</p>}
            {teamA.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getGenderIcon(player.gender)}</span>
                  <span className="font-medium">{player.name}</span>
                  {player.skillLevel && (
                    <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveFromTeamA(player.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team B */}
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-800">Team B ({teamB.length}/2)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamB.length === 0 && <p className="text-sm text-gray-500 text-center py-4">선수를 선택해주세요</p>}
            {teamB.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getGenderIcon(player.gender)}</span>
                  <span className="font-medium">{player.name}</span>
                  {player.skillLevel && (
                    <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveFromTeamB(player.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Available Players */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">활성 선수 선택</CardTitle>
        </CardHeader>
        <CardContent>
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">모든 선수가 팀에 배정되었습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availablePlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getGenderIcon(player.gender)}</span>
                    <span className="font-medium">{player.name}</span>
                    {player.skillLevel && (
                      <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToTeamA(player)}
                      disabled={teamA.length >= 2}
                      className="text-xs"
                    >
                      Team A
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToTeamB(player)}
                      disabled={teamB.length >= 2}
                      className="text-xs"
                    >
                      Team B
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
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
