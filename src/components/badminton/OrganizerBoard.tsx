'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useBoardRealtime } from '@/hooks/useBoardRealtime';
import { Player } from '@/hooks/useGameManager';
import PlayerForm from '@/components/game-manager/PlayerForm';
import PlayerList, { AttendanceFilter } from '@/components/game-manager/PlayerList';
import PlayerEditModal from '@/components/game-manager/PlayerEditModal';
import AttendancePickerModal from '@/components/game-manager/AttendancePickerModal';
import TeamPicker from '@/components/game-manager/TeamPicker';
import CustomTeamPicker from '@/components/game-manager/CustomTeamPicker';
import GameHistory from '@/components/game-manager/GameHistory';
import CourtManager from '@/components/game-manager/CourtManager';
import GameQueue from '@/components/game-manager/GameQueue';
import { randomTeamPicker } from '@/utils/smartTeamPicker';

interface OrganizerBoardProps {
  sessionId: string;
}

export default function OrganizerBoard({ sessionId }: OrganizerBoardProps) {
  const {
    players,
    games,
    courts,
    queue,
    addPlayer,
    removePlayer,
    updatePlayer,
    setAttending,
    setAttendingBulk,
    removeGame,
    resetPlayers,
    resetGames,
    addCourt,
    removeCourt,
    renameCourt,
    enqueueGame,
    removeFromQueue,
    assignQueueToCourt,
    endCourtGame,
    cancelCourtGame,
    isLoading,
  } = useBoardRealtime(sessionId);

  const [pickedPlayers, setPickedPlayers] = useState<[Player, Player, Player, Player] | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [isAttendancePickerOpen, setIsAttendancePickerOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('attending');
  const [openSections, setOpenSections] = useState({
    registration: false,
    playerList: true,
    teamPicker: true,
    queue: true,
    courtManager: true,
    gameHistory: false,
    resetActions: false,
  });

  const toggleSection = useCallback((key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      game.players.forEach((playerId) => {
        counts.set(playerId, (counts.get(playerId) || 0) + 1);
      });
    });
    return counts;
  }, [games]);

  const handleAddPlayer = useCallback(
    (playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => {
      addPlayer(playerData);
      toast.success(`${playerData.name} 선수가 등록되었습니다 (미참석 상태)`);
    },
    [addPlayer],
  );

  const handleRemovePlayer = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (player && confirm(`${player.name} 선수를 삭제하시겠습니까?`)) {
        removePlayer(id);
        toast.success('선수가 삭제되었습니다');
        if (pickedPlayers?.some((p) => p.id === id)) {
          setPickedPlayers(null);
        }
      }
    },
    [players, removePlayer, pickedPlayers],
  );

  const handleRandomPickTeams = useCallback(() => {
    const activePlayers = players.filter((p) => p.status === 'active');
    if (activePlayers.length < 4) {
      toast.error('최소 4명의 활성 선수가 필요합니다');
      return;
    }
    try {
      setPickedPlayers(randomTeamPicker(players));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '선수를 뽑는데 실패했습니다');
    }
  }, [players]);

  const handleConfirmGame = useCallback(() => {
    if (!pickedPlayers) return;
    const playerIds = pickedPlayers.map((p) => p.id) as [string, string, string, string];
    enqueueGame(playerIds);
    toast.success('대기열에 추가되었습니다', {
      description: `선수: ${pickedPlayers.map((p) => p.name).join(', ')}`,
      duration: 4000,
    });
    setPickedPlayers(null);
    setIsCustomPicking(false);
  }, [pickedPlayers, enqueueGame]);

  const handleAssignQueueToCourt = useCallback(
    (queueItemId: string, courtId: string) => {
      assignQueueToCourt(queueItemId, courtId);
      const court = courts.find((c) => c.id === courtId);
      toast.success(`${court?.name ?? '코트'}에 배정되었습니다!`);
    },
    [assignQueueToCourt, courts],
  );

  const handleRemoveFromQueue = useCallback(
    (queueItemId: string) => {
      if (confirm('대기열에서 이 게임을 취소하시겠습니까?')) {
        removeFromQueue(queueItemId);
        toast.success('대기열에서 취소되었습니다');
      }
    },
    [removeFromQueue],
  );

  const handleRemoveCourt = useCallback(
    (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (court?.playerIds !== null) {
        toast.error('게임중인 코트는 삭제할 수 없습니다');
        return;
      }
      removeCourt(id);
    },
    [courts, removeCourt],
  );

  const handleEndCourtGame = useCallback(
    (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (!court?.playerIds) return;
      if (confirm(`${court.name} 게임을 종료하시겠습니까?`)) {
        endCourtGame(id);
        toast.success(`${court.name} 게임이 종료되었습니다. 선수들이 복귀했습니다`);
      }
    },
    [courts, endCourtGame],
  );

  const handleCancelCourtGame = useCallback(
    (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (!court?.playerIds) return;
      if (confirm(`${court.name} 게임을 취소하시겠습니까?\n(게임 기록이 남지 않습니다)`)) {
        cancelCourtGame(id);
        toast.success(`${court.name} 게임이 취소되었습니다`);
      }
    },
    [courts, cancelCourtGame],
  );

  const handleCustomConfirm = useCallback((selected: [Player, Player, Player, Player]) => {
    setPickedPlayers(selected);
    setIsCustomPicking(false);
  }, []);

  const handleEditPlayer = useCallback((player: Player) => setEditingPlayer(player), []);

  const handleUpdatePlayer = useCallback(
    (id: string, updates: Partial<Omit<Player, 'id'>>) => {
      updatePlayer(id, updates);
    },
    [updatePlayer],
  );

  const handleToggleStatus = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'active') {
        updatePlayer(id, { status: 'resting', pinned: false, waitingSince: null });
        toast.success(`${player.name} 선수가 휴식 상태로 변경되었습니다`);
        if (pickedPlayers?.some((p) => p.id === id)) setPickedPlayers(null);
      } else {
        updatePlayer(id, { status: 'active', waitingSince: new Date().toISOString() });
        toast.success(`${player.name} 선수가 활성 상태로 변경되었습니다`);
      }
    },
    [players, updatePlayer, pickedPlayers],
  );

  const handleTogglePinned = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'resting') {
        toast.error('휴식중인 선수는 필수 포함할 수 없습니다');
        return;
      }
      updatePlayer(id, { pinned: !player.pinned });
      if (pickedPlayers) setPickedPlayers(null);
    },
    [players, updatePlayer, pickedPlayers],
  );

  const handleToggleAttending = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'playing' || player.status === 'queued') {
        toast.error('게임중이거나 대기열에 있는 선수는 변경할 수 없습니다');
        return;
      }
      setAttending(id, !player.attending);
      if (pickedPlayers?.some((p) => p.id === id)) setPickedPlayers(null);
    },
    [players, setAttending, pickedPlayers],
  );

  const handleBulkAttending = useCallback(
    (attendingIds: string[]) => {
      setAttendingBulk(attendingIds);
      toast.success(`오늘 참석자 ${attendingIds.length}명이 설정되었습니다`);
      setPickedPlayers(null);
    },
    [setAttendingBulk],
  );

  const handleRemoveGame = useCallback(
    (id: string) => {
      if (confirm('이 게임 기록을 삭제하시겠습니까?')) {
        removeGame(id);
        toast.success('게임 기록이 삭제되었습니다');
      }
    },
    [removeGame],
  );

  const handleResetGames = useCallback(() => {
    if (games.length === 0) {
      toast.error('삭제할 게임 기록이 없습니다');
      return;
    }
    if (confirm('모든 게임 기록을 삭제하시겠습니까?')) {
      resetGames();
      toast.success('게임 기록이 초기화되었습니다');
    }
  }, [games.length, resetGames]);

  const handleResetPlayers = useCallback(() => {
    if (players.length === 0) {
      toast.error('삭제할 선수가 없습니다');
      return;
    }
    if (confirm('게스트로 등록된 선수 전원을 삭제하시겠습니까?\n(로그인 참가자는 유지됩니다)')) {
      resetPlayers();
      setPickedPlayers(null);
      toast.success('게스트 선수 목록이 초기화되었습니다');
    }
  }, [players.length, resetPlayers]);

  const handleResetAttendance = useCallback(() => {
    if (!players.some((p) => p.attending)) {
      toast.error('참석 처리된 선수가 없습니다');
      return;
    }
    if (confirm('모든 선수의 오늘 참석을 해제하시겠습니까?')) {
      setAttendingBulk([]);
      setPickedPlayers(null);
      toast.success('참석이 모두 해제되었습니다');
    }
  }, [players, setAttendingBulk]);

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">보드 데이터를 불러오는 중...</p>
      </div>
    );
  }

  const attendingCount = players.filter((p) => p.attending).length;
  const activeCount = players.filter((p) => p.status === 'active').length;
  const playingCount = players.filter((p) => p.status === 'playing').length;
  const queuedCount = players.filter((p) => p.status === 'queued').length;

  return (
    <div className="space-y-3">
      <Collapsible open={openSections.registration} onOpenChange={() => toggleSection('registration')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">선수 등록</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.registration ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <PlayerForm onAddPlayer={handleAddPlayer} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.playerList} onOpenChange={() => toggleSection('playerList')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  인원 풀 (참석 {attendingCount}/{players.length}명)
                  {(activeCount > 0 || playingCount > 0 || queuedCount > 0) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (활성: {activeCount}
                      {playingCount > 0 && <> · 게임중: {playingCount}</>}
                      {queuedCount > 0 && <> · 대기열: {queuedCount}</>})
                    </span>
                  )}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.playerList ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <PlayerList
                players={players}
                onRemovePlayer={handleRemovePlayer}
                onEditPlayer={handleEditPlayer}
                onToggleStatus={handleToggleStatus}
                onTogglePinned={handleTogglePinned}
                onToggleAttending={handleToggleAttending}
                onOpenAttendancePicker={() => setIsAttendancePickerOpen(true)}
                filter={attendanceFilter}
                onFilterChange={setAttendanceFilter}
                gameCountsMap={playerGameCounts}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.teamPicker} onOpenChange={() => toggleSection('teamPicker')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">팀 뽑기</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.teamPicker ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {isCustomPicking ? (
                <CustomTeamPicker
                  players={players}
                  onConfirm={handleCustomConfirm}
                  onCancel={() => {
                    setIsCustomPicking(false);
                    setPickedPlayers(null);
                  }}
                />
              ) : (
                <TeamPicker
                  players={players}
                  games={games}
                  pickedPlayers={pickedPlayers}
                  onRandomPick={handleRandomPickTeams}
                  onConfirm={handleConfirmGame}
                  onReject={handleRandomPickTeams}
                  onCustomPick={() => setIsCustomPicking(true)}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.queue} onOpenChange={() => toggleSection('queue')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  대기열
                  {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.queue ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <GameQueue
                queue={queue}
                courts={courts}
                players={players}
                onAssignCourt={handleAssignQueueToCourt}
                onRemove={handleRemoveFromQueue}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.courtManager} onOpenChange={() => toggleSection('courtManager')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  코트 관리
                  {courts.some((c) => c.playerIds !== null) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (게임중: {courts.filter((c) => c.playerIds !== null).length}개)
                    </span>
                  )}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.courtManager ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <CourtManager
                courts={courts}
                players={players}
                onAddCourt={addCourt}
                onRemoveCourt={handleRemoveCourt}
                onRenameCourt={renameCourt}
                onEndGame={handleEndCourtGame}
                onCancelGame={handleCancelCourtGame}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.gameHistory} onOpenChange={() => toggleSection('gameHistory')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">게임 기록 ({games.length})</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.gameHistory ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <GameHistory games={games} players={players} onRemoveGame={handleRemoveGame} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.resetActions} onOpenChange={() => toggleSection('resetActions')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">초기화</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.resetActions ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button onClick={handleResetAttendance} variant="secondary" size="sm">
                  참석 전체 해제
                </Button>
                <Button onClick={handleResetGames} variant="outline" size="sm">
                  게임 기록 초기화
                </Button>
                <Button onClick={handleResetPlayers} variant="destructive" size="sm">
                  게스트 선수 초기화
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <PlayerEditModal
        player={editingPlayer}
        isOpen={editingPlayer !== null}
        onClose={() => setEditingPlayer(null)}
        onUpdate={handleUpdatePlayer}
      />

      <AttendancePickerModal
        isOpen={isAttendancePickerOpen}
        onClose={() => setIsAttendancePickerOpen(false)}
        players={players}
        onConfirm={handleBulkAttending}
      />
    </div>
  );
}
