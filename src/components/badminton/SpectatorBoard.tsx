'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Clock, Users } from 'lucide-react';
import { useBoardSpectator } from '@/hooks/useBoardSpectator';
import { useTicker } from '@/hooks/useTicker';
import { formatElapsed } from '@/utils/formatElapsed';
import { Player } from '@/hooks/useGameManager';
import TeamCourtBox from '@/components/game-manager/TeamCourtBox';

interface SpectatorBoardProps {
  sessionId: string;
}

const UNKNOWN_PLAYER: Player = { id: 'unknown', name: '알 수 없음', status: 'active' };

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

function getAgeGroupLabel(ageGroup?: string): string | null {
  if (!ageGroup) return null;
  return ageGroup === '60s+' ? '60대+' : ageGroup.replace('s', '대');
}

function getStatusBadge(player: Player) {
  if (!player.attending) {
    return (
      <Badge variant="outline" className="text-gray-500 text-xs">
        미참석
      </Badge>
    );
  }
  switch (player.status) {
    case 'playing':
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
          게임중
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-xs">
          대기열
        </Badge>
      );
    case 'resting':
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
          휴식중
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
          대기 중
        </Badge>
      );
  }
}

export default function SpectatorBoard({ sessionId }: SpectatorBoardProps) {
  const { players, courts, queue, games, isLoading } = useBoardSpectator(sessionId);
  const now = useTicker();
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const getPlayer = (id: string): Player => players.find((p) => p.id === id) ?? { ...UNKNOWN_PLAYER, id };

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

  const rosterPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const recentGames = [...games].reverse().slice(0, 10);

  return (
    <div className="flex flex-col gap-3 md:h-full md:overflow-hidden">
      <div className="shrink-0 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setIsMoreSheetOpen(true)}>
          <Users className="h-4 w-4 mr-1" />
          전체 명단 · 게임 기록
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:flex-1 md:min-h-0">
        {/* 왼쪽: 코트 현황 (항상 펼침) */}
        <Card className="gap-3 md:min-h-0">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base md:text-lg">코트 현황</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
            {courts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">아직 코트가 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
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
                        <TeamCourtBox
                          players={court.playerIds.map(getPlayer) as [Player, Player, Player, Player]}
                          size="compact"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 오른쪽: 대기열 + 대기 중 */}
        <div className="flex flex-col gap-3 md:h-full md:min-h-0">
          <Card className="gap-3 md:flex-1 md:min-h-0">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base md:text-lg">
                대기열
                {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
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
                      <TeamCourtBox
                        players={item.playerIds.map(getPlayer) as [Player, Player, Player, Player]}
                        size="compact"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 md:flex-1 md:min-h-0">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base md:text-lg">
                대기 중
                {waitingPlayers.length > 0 && (
                  <span className="text-sm text-gray-500 ml-2">({waitingPlayers.length}명)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
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
        </div>
      </div>

      <Sheet open={isMoreSheetOpen} onOpenChange={setIsMoreSheetOpen}>
        <SheetContent className="overflow-y-auto scroll-fade">
          <SheetHeader>
            <SheetTitle>전체 명단 · 게임 기록</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">전체 참가자 명단 ({rosterPlayers.length}명)</h3>
              {rosterPlayers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">아직 참가자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {rosterPlayers.map((player) => {
                    const ageLabel = getAgeGroupLabel(player.ageGroup);
                    return (
                      <div key={player.id} className="flex items-center gap-2 p-2 border rounded-lg bg-white flex-wrap">
                        <span className="text-lg shrink-0">{getGenderIcon(player.gender)}</span>
                        <span className="font-medium text-sm">{player.name}</span>
                        {player.skillLevel && (
                          <Badge className={`text-xs ${getSkillLevelColor(player.skillLevel)}`}>
                            {player.skillLevel}
                          </Badge>
                        )}
                        {ageLabel && (
                          <Badge variant="outline" className="text-xs">
                            {ageLabel}
                          </Badge>
                        )}
                        {getStatusBadge(player)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2">오늘 게임 기록 ({games.length})</h3>
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
                        <TeamCourtBox
                          players={game.players.map(getPlayer) as [Player, Player, Player, Player]}
                          size="compact"
                        />
                      </div>
                    );
                  })}
                  {games.length > 10 && (
                    <p className="text-center text-xs text-gray-500 mt-2">최근 10개 게임만 표시됩니다</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
