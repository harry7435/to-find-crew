'use client';

import { QueueItem, Court, Player } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, X } from 'lucide-react';
import { formatElapsed } from '@/utils/formatElapsed';
import { useTicker } from '@/hooks/useTicker';

interface GameQueueProps {
  queue: QueueItem[];
  courts: Court[];
  players: Player[];
  onAssignCourt: (queueItemId: string, courtId: string) => void;
  onRemove: (queueItemId: string) => void;
}

export default function GameQueue({ queue, courts, players, onAssignCourt, onRemove }: GameQueueProps) {
  const now = useTicker();
  const freeCourts = courts.filter((c) => c.playerIds === null);

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '알 수 없음';

  if (queue.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <p className="text-sm">대기 중인 게임이 없습니다</p>
        <p className="text-xs mt-1">팀 뽑기에서 4명을 확정하면 여기에 쌓입니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {queue.map((item, idx) => {
        const waitingLabel = formatElapsed(item.queuedAt, now);
        return (
          <div key={item.id} className="border border-purple-200 bg-purple-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">#{idx + 1}</Badge>
                {waitingLabel && (
                  <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {waitingLabel}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                title="대기 취소"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1 mb-2">
              {item.playerIds.map((pid) => (
                <span
                  key={pid}
                  className="text-xs bg-white border border-purple-200 rounded px-2 py-1 text-center truncate"
                >
                  {getPlayerName(pid)}
                </span>
              ))}
            </div>
            {freeCourts.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-1">
                빈 코트가 없습니다. 게임 종료 또는 코트 추가 필요
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {freeCourts.map((court) => (
                  <Button
                    key={court.id}
                    size="sm"
                    onClick={() => onAssignCourt(item.id, court.id)}
                    className="h-7 text-xs"
                  >
                    {court.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
