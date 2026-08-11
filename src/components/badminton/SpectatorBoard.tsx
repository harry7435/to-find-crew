'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Clock } from 'lucide-react';
import { useBoardSpectator } from '@/hooks/useBoardSpectator';
import { useTicker } from '@/hooks/useTicker';
import { formatElapsed } from '@/utils/formatElapsed';

interface SpectatorBoardProps {
  sessionId: string;
}

export default function SpectatorBoard({ sessionId }: SpectatorBoardProps) {
  const { players, courts, queue, games, isLoading } = useBoardSpectator(sessionId);
  const now = useTicker();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '알 수 없음';

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">현황판을 불러오는 중...</p>
      </div>
    );
  }

  const waitingPlayers = players
    .filter((p) => p.attending && p.status === 'active')
    .sort((a, b) => {
      const aTime = a.waitingSince ? new Date(a.waitingSince).getTime() : 0;
      const bTime = b.waitingSince ? new Date(b.waitingSince).getTime() : 0;
      return aTime - bTime;
    });

  const recentGames = [...games].reverse().slice(0, 10);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">코트 현황</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {courts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">아직 코트가 없습니다</p>
          ) : (
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
                      <span className="font-medium text-sm">{court.name}</span>
                      {isActive ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatElapsed(court.gameStartedAt, now) ?? '방금'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 text-xs">
                          비어있음
                        </Badge>
                      )}
                    </div>
                    {isActive && court.playerIds && (
                      <div className="grid grid-cols-2 gap-1">
                        {court.playerIds.map((pid) => (
                          <span
                            key={pid}
                            className="text-xs bg-white border border-green-200 rounded px-2 py-1 text-center truncate"
                          >
                            {getPlayerName(pid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">
            대기열
            {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {queue.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">대기 중인 게임이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item, idx) => (
                <div key={item.id} className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs">#{idx + 1}</Badge>
                    <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatElapsed(item.queuedAt, now) ?? '방금'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {item.playerIds.map((pid) => (
                      <span
                        key={pid}
                        className="text-xs bg-white border border-purple-200 rounded px-2 py-1 text-center truncate"
                      >
                        {getPlayerName(pid)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">
            대기 중
            {waitingPlayers.length > 0 && (
              <span className="text-sm text-gray-500 ml-2">({waitingPlayers.length}명)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {waitingPlayers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">대기 중인 선수가 없습니다</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {waitingPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2 border rounded-lg bg-white">
                  <span className="font-medium text-sm">{player.name}</span>
                  {player.waitingSince && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatElapsed(player.waitingSince, now)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">오늘 게임 기록 ({games.length})</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {games.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">아직 완료된 게임이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {recentGames.map((game, index) => {
                    const gameNumber = games.length - index;
                    const date = new Date(game.confirmedAt).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div key={game.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Game #{gameNumber}</Badge>
                          <span className="text-xs text-gray-500">{date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {game.players.map((pid) => (
                            <div key={pid} className="text-sm p-1.5 bg-gray-50 rounded">
                              {getPlayerName(pid)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {games.length > 10 && (
                    <p className="text-center text-xs text-gray-500 mt-2">최근 10개 게임만 표시됩니다</p>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
