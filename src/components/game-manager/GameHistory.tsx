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

interface PairStats {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  playCount: number;
}

export default function GameHistory({ games, players, onRemoveGame }: GameHistoryProps) {
  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      [game.teamA[0], game.teamA[1], game.teamB[0], game.teamB[1]].forEach((playerId) => {
        counts.set(playerId, (counts.get(playerId) || 0) + 1);
      });
    });
    return counts;
  }, [games]);

  const pairStats = useMemo(() => {
    const pairMap = new Map<string, number>();

    games.forEach((game) => {
      // Team A pairs
      const teamAPair = [game.teamA[0], game.teamA[1]].sort().join('-');
      pairMap.set(teamAPair, (pairMap.get(teamAPair) || 0) + 1);

      // Team B pairs
      const teamBPair = [game.teamB[0], game.teamB[1]].sort().join('-');
      pairMap.set(teamBPair, (pairMap.get(teamBPair) || 0) + 1);
    });

    const stats: PairStats[] = [];
    pairMap.forEach((count, pairKey) => {
      const [id1, id2] = pairKey.split('-');
      const p1 = players.find((p) => p.id === id1);
      const p2 = players.find((p) => p.id === id2);

      if (p1 && p2) {
        stats.push({
          player1Id: id1,
          player2Id: id2,
          player1Name: p1.name,
          player2Name: p2.name,
          playCount: count,
        });
      }
    });

    return stats.sort((a, b) => b.playCount - a.playCount);
  }, [games, players]);

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
              <div className="flex items-center justify-between mb-1.5 pr-8">
                <Badge variant="outline">Game #{gameNumber}</Badge>
                <span className="text-xs text-gray-500">{date}</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-blue-600 font-medium mb-1">Team A</div>
                  <div className="text-sm">
                    {getPlayerName(game.teamA[0])} & {getPlayerName(game.teamA[1])}
                  </div>
                </div>
                <span className="text-gray-400 font-bold">VS</span>
                <div className="text-center">
                  <div className="text-xs text-red-600 font-medium mb-1">Team B</div>
                  <div className="text-sm">
                    {getPlayerName(game.teamB[0])} & {getPlayerName(game.teamB[1])}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {games.length > 10 && <p className="text-center text-xs text-gray-500 mt-4">최근 10개 게임만 표시됩니다</p>}
      </TabsContent>

      <TabsContent value="stats" className="space-y-4 mt-3">
        {/* Player Game Counts */}
        <div>
          <h3 className="text-sm md:text-base font-medium mb-2">선수별 게임 수</h3>
          {playerStatsArray.length > 0 ? (
            <div className="space-y-2">
              {playerStatsArray.map((stat, index) => (
                <div key={stat.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                    <span className="font-medium">{stat.name}</span>
                  </div>
                  <Badge variant="outline">{stat.count}게임</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">게임 기록이 없습니다</p>
          )}
        </div>

        {/* Pair Statistics */}
        <div>
          <h3 className="text-sm md:text-base font-medium mb-2">페어 통계</h3>
          {pairStats.length > 0 ? (
            <div className="space-y-2">
              {pairStats.map((stat, index) => (
                <div
                  key={`${stat.player1Id}-${stat.player2Id}`}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                    <span className="text-sm">
                      {stat.player1Name} & {stat.player2Name}
                    </span>
                  </div>
                  <Badge variant="outline">{stat.playCount}회</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">페어 기록이 없습니다</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
