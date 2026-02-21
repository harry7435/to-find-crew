'use client';

import { useMemo } from 'react';
import { GameRecord, Player } from '@/hooks/useGameManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';

interface GameHistoryProps {
  games: GameRecord[];
  players: Player[];
  onRemoveGame: (id: string) => void;
}

export default function GameHistory({ games, players, onRemoveGame }: GameHistoryProps) {
  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      game.players.forEach((playerId) => {
        counts.set(playerId, (counts.get(playerId) || 0) + 1);
      });
    });
    return counts;
  }, [games]);

  const playerStatsArray = useMemo(() => {
    return players
      .map((player) => ({
        id: player.id,
        name: player.name,
        count: playerGameCounts.get(player.id) || 0,
      }))
      .filter((stat) => stat.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [players, playerGameCounts]);

  const maxGames = useMemo(() => {
    return Math.max(...playerStatsArray.map((s) => s.count), 1);
  }, [playerStatsArray]);

  // 게임 횟수에 따른 색상 결정
  function getGameCountColor(count: number, max: number): string {
    const ratio = count / max;
    if (ratio <= 0.33) return 'bg-green-500'; // 게임 적음
    if (ratio <= 0.66) return 'bg-yellow-500'; // 평균
    return 'bg-orange-500'; // 게임 많음
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>아직 확정된 게임이 없습니다</p>
        <p className="text-sm mt-2">팀을 뽑고 확정해주세요</p>
      </div>
    );
  }

  const getPlayerName = (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    return player ? player.name : '알 수 없음';
  };

  // Show last 10 games
  const recentGames = [...games].reverse().slice(0, 10);

  return (
    <Tabs defaultValue="games" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="games">게임 기록</TabsTrigger>
        <TabsTrigger value="stats">통계</TabsTrigger>
      </TabsList>

      <TabsContent value="games" className="space-y-2 mt-3">
        {recentGames.map((game, index) => {
          const gameNumber = games.length - index;
          const date = new Date(game.confirmedAt).toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div key={game.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1"
                onClick={() => onRemoveGame(game.id)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-between mb-2 pr-8">
                <Badge variant="outline">Game #{gameNumber}</Badge>
                <span className="text-xs text-gray-500">{date}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {game.players.map((playerId) => (
                  <div key={playerId} className="text-sm p-1.5 bg-gray-50 rounded">
                    {getPlayerName(playerId)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {games.length > 10 && <p className="text-center text-xs text-gray-500 mt-4">최근 10개 게임만 표시됩니다</p>}
      </TabsContent>

      <TabsContent value="stats" className="space-y-4 mt-3">
        {/* Player Game Counts with Visualization */}
        <div>
          <h3 className="text-sm md:text-base font-medium mb-3">선수별 게임 수</h3>
          {playerStatsArray.length > 0 ? (
            <div className="space-y-3">
              {playerStatsArray.map((stat, index) => {
                const percentage = (stat.count / maxGames) * 100;
                const colorClass = getGameCountColor(stat.count, maxGames);

                return (
                  <div key={stat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                        <span className="font-medium">{stat.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {stat.count}게임
                      </Badge>
                    </div>
                    {/* Progress bar */}
                    <div className="w-1/2 h-2 bg-gray-200 rounded-full overflow-hidden ml-8">
                      <div
                        className={`h-full ${colorClass} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {/* 범례 */}
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-gray-600 mb-2">색상 의미:</p>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-gray-600">게임 적음 (우선 선발)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span className="text-gray-600">평균 참여</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span className="text-gray-600">게임 많음</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">게임 기록이 없습니다</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
