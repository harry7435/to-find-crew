'use client';

import { Court, Player } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Square } from 'lucide-react';

interface CourtManagerProps {
  courts: Court[];
  players: Player[];
  onAddCourt: () => void;
  onRemoveCourt: (id: string) => void;
  onEndGame: (id: string) => void;
}

export default function CourtManager({ courts, players, onAddCourt, onRemoveCourt, onEndGame }: CourtManagerProps) {
  const getPlayerName = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.name ?? '알 수 없음';
  };

  if (courts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">등록된 코트가 없습니다</p>
          <p className="text-xs mt-1">코트를 추가하면 게임 배정이 가능합니다</p>
        </div>
        <Button onClick={onAddCourt} variant="outline" className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          코트 추가
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {courts.map((court) => {
          const isActive = court.playerIds !== null;
          return (
            <div
              key={court.id}
              className={`border rounded-lg p-3 ${
                isActive ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Square className={`h-4 w-4 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-medium text-sm">{court.name}</span>
                  {isActive ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">게임중</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500 text-xs">
                      대기중
                    </Badge>
                  )}
                </div>
                {!isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveCourt(court.id)}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                    title="코트 삭제"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {isActive && court.playerIds ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    {court.playerIds.map((playerId) => (
                      <span
                        key={playerId}
                        className="text-xs bg-white border border-green-200 rounded px-2 py-1 text-center truncate"
                      >
                        {getPlayerName(playerId)}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onEndGame(court.id)}
                    className="w-full mt-2 h-7 text-xs"
                  >
                    게임 종료
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1">비어있음</p>
              )}
            </div>
          );
        })}
      </div>
      <Button onClick={onAddCourt} variant="outline" className="w-full" size="sm">
        <Plus className="h-4 w-4 mr-2" />
        코트 추가
      </Button>
    </div>
  );
}
