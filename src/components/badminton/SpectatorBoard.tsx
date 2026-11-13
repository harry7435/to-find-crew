'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Clock, Users, X } from 'lucide-react';
import { useBoardSpectator } from '@/hooks/useBoardSpectator';
import { useTicker } from '@/hooks/useTicker';
import { formatElapsed } from '@/utils/formatElapsed';
import { Player } from '@/hooks/useGameManager';
import TeamCourtBox from '@/components/game-manager/TeamCourtBox';
import PushOptIn from '@/components/badminton/PushOptIn';
import MobileTabBar from '@/components/layout/MobileTabBar';

interface SpectatorBoardProps {
  sessionId: string;
  /** 로그인 사용자가 이 모임의 참가자일 때 그 session_participants.id. 알림 받기에서 본인 이름을 고정하는 데 쓴다. */
  myParticipantId?: string | null;
}

const UNKNOWN_PLAYER: Player = { id: 'unknown', name: '알 수 없음', status: 'active' };

const ROLE_HINT_DISMISSED_KEY = 'spectator-role-hint-dismissed';

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

function getStatusBadge(player: Player) {
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

export default function SpectatorBoard({ sessionId, myParticipantId = null }: SpectatorBoardProps) {
  const { players, courts, queue, games, isLoading } = useBoardSpectator(sessionId);
  const now = useTicker();
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  // 모바일에서는 한 번에 한 섹션만 보여준다.
  type SpectatorSection = 'courts' | 'queue' | 'waiting';
  const [mobileTab, setMobileTab] = useState<SpectatorSection>('courts');
  // 참석자 명단 정렬 (저장하지 않음).
  type RosterSort = 'gamesAsc' | 'gamesDesc' | 'name';
  const [rosterSort, setRosterSort] = useState<RosterSort>('gamesAsc');

  // 서버 렌더와 첫 렌더를 맞추려고 처음엔 숨겼다가, 마운트 후 저장값을 읽어 보여준다.
  // 저장소가 막힌 환경(프라이빗 모드 등)이면 읽기 실패 → 그냥 보여준다.
  const [showRoleHint, setShowRoleHint] = useState(false);

  useEffect(() => {
    try {
      setShowRoleHint(localStorage.getItem(ROLE_HINT_DISMISSED_KEY) !== 'true');
    } catch {
      setShowRoleHint(true);
    }
  }, []);

  const dismissRoleHint = () => {
    setShowRoleHint(false);
    try {
      localStorage.setItem(ROLE_HINT_DISMISSED_KEY, 'true');
    } catch {
      // 저장 실패 시 이번 화면에서만 닫힌다.
    }
  };

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

  const gameCounts = new Map<string, number>();
  games.forEach((g) => g.players.forEach((id) => gameCounts.set(id, (gameCounts.get(id) ?? 0) + 1)));

  const rosterPlayers = players
    .filter((p) => p.attending === true)
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'ko');
      if (rosterSort === 'name') return byName;
      const diff = (gameCounts.get(a.id) ?? 0) - (gameCounts.get(b.id) ?? 0);
      if (diff !== 0) return rosterSort === 'gamesAsc' ? diff : -diff;
      return byName;
    });

  const recentGames = [...games].reverse();

  const attendingCount = players.filter((p) => p.attending).length;
  const playingCount = players.filter((p) => p.attending && p.status === 'playing').length;

  // 모바일에서 활성 탭이 아닌 섹션은 숨긴다.
  const mobileOnly = (s: SpectatorSection) => (mobileTab === s ? '' : 'max-md:hidden');

  return (
    <div className="flex flex-col gap-3 md:h-full md:overflow-hidden">
      {showRoleHint && (
        <div className="shrink-0 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <p className="flex-1">게임 배정은 운영진이 해요. 내 이름이 코트나 대기열에 뜨면 준비하세요.</p>
          <button
            type="button"
            onClick={dismissRoleHint}
            className="shrink-0 rounded p-0.5 text-blue-700 hover:bg-blue-100"
            aria-label="안내 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <PushOptIn sessionId={sessionId} players={players} myParticipantId={myParticipantId} />
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setIsMoreSheetOpen(true)}>
          <Users className="h-4 w-4 mr-1" />
          오늘 참석자 · 게임 기록
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setIsMoreSheetOpen(true)}
        className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 text-left hover:text-gray-900"
      >
        <span>
          참석 <b className="font-semibold text-gray-900">{attendingCount}명</b>
        </span>
        <span>
          게임중 <b className="font-semibold text-green-700">{playingCount}</b>
        </span>
        <span>
          대기 <b className="font-semibold text-blue-700">{waitingPlayers.length}</b>
        </span>
        <span className="text-gray-400">(신청 {players.length}명)</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:flex-1 md:min-h-0">
        {/* 왼쪽: 코트 현황 (항상 펼침) */}
        <Card className={`gap-3 md:min-h-0 ${mobileOnly('courts')}`}>
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base md:text-lg">코트 현황</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
            {courts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">운영진이 코트를 준비하고 있어요</p>
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
        <div className="flex flex-col gap-3 md:h-full md:min-h-0 max-md:contents">
          <Card className={`gap-3 md:flex-1 md:min-h-0 ${mobileOnly('queue')}`}>
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base md:text-lg">
                대기열
                {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
              {queue.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">운영진이 팀을 짜면 여기에 순서가 표시돼요</p>
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

          <Card className={`gap-3 md:flex-1 md:min-h-0 ${mobileOnly('waiting')}`}>
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
                <p className="text-sm text-gray-500 text-center py-4">운영진이 참석 처리하면 여기에 이름이 올라와요</p>
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
            <SheetTitle>오늘 참석자 · 게임 기록</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">오늘 참석자 ({rosterPlayers.length}명)</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <span className="text-gray-400 font-medium">정렬</span>
                <div className="flex rounded-md border border-gray-200 overflow-hidden">
                  {(
                    [
                      ['gamesAsc', '게임 적은순'],
                      ['gamesDesc', '게임 많은순'],
                      ['name', '가나다순'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRosterSort(value)}
                      aria-pressed={rosterSort === value}
                      className={`px-3 py-1.5 whitespace-nowrap transition-colors ${
                        rosterSort === value ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {rosterPlayers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">아직 참석 처리된 사람이 없어요</p>
              ) : (
                <div className="space-y-2">
                  {rosterPlayers.map((player) => (
                    <div key={player.id} className="flex items-center gap-2 p-2 border rounded-lg bg-white flex-wrap">
                      <span className="text-lg shrink-0">{getGenderIcon(player.gender)}</span>
                      <span className="font-medium text-sm">{player.name}</span>
                      {player.skillLevel && (
                        <Badge className={`text-xs ${getSkillLevelColor(player.skillLevel)}`}>
                          {player.skillLevel}
                        </Badge>
                      )}
                      {getStatusBadge(player)}
                      <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-gray-500">
                        {gameCounts.get(player.id) ?? 0}게임
                      </span>
                    </div>
                  ))}
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
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MobileTabBar
        tabs={[
          {
            key: 'courts',
            label: '코트',
            badge: `${courts.filter((c) => c.playerIds !== null).length}/${courts.length}`,
          },
          { key: 'queue', label: '대기열', badge: queue.length },
          { key: 'waiting', label: '대기 중', badge: waitingPlayers.length },
        ]}
        active={mobileTab}
        onChange={(key) => setMobileTab(key as SpectatorSection)}
      />
    </div>
  );
}
