'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserPlus, History, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useBoardRealtime } from '@/hooks/useBoardRealtime';
import { Player } from '@/hooks/useGameManager';
import PlayerList, { AttendanceFilter } from '@/components/game-manager/PlayerList';
import PlayerAddModal from '@/components/game-manager/PlayerAddModal';
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
    resetWaitingTimes,
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
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [isEditingCustomPick, setIsEditingCustomPick] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [isAttendancePickerOpen, setIsAttendancePickerOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'pool' | 'pick'>('pool');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('attending');

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

  const handleCancelPick = useCallback(() => {
    setPickedPlayers(null);
  }, []);

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

  const handleStartCustomPicking = useCallback(() => {
    setSelectedPlayers([]);
    setIsEditingCustomPick(false);
    setIsCustomPicking(true);
  }, []);

  const handleCustomConfirm = useCallback(() => {
    if (selectedPlayers.length !== 4) return;
    setPickedPlayers(selectedPlayers as [Player, Player, Player, Player]);
    setIsCustomPicking(false);
    setSelectedPlayers([]);
    setIsEditingCustomPick(false);
  }, [selectedPlayers]);

  const handleCustomCancel = useCallback(() => {
    setIsCustomPicking(false);
    setPickedPlayers(null);
    setSelectedPlayers([]);
    setIsEditingCustomPick(false);
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
    if (confirm('모든 게임 기록을 삭제하시겠습니까?\n(대기 중인 선수의 대기 시간도 함께 초기화됩니다)')) {
      resetGames();
      resetWaitingTimes();
      toast.success('게임 기록과 대기 시간이 초기화되었습니다');
    }
  }, [games.length, resetGames, resetWaitingTimes]);

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

  const handleResetWaitingTimes = useCallback(() => {
    if (!players.some((p) => p.status === 'active')) {
      toast.error('대기 중인 선수가 없습니다');
      return;
    }
    if (confirm('대기 중인 선수 전원의 대기 시간을 초기화하시겠습니까?')) {
      resetWaitingTimes();
      toast.success('대기 시간이 초기화되었습니다');
    }
  }, [players, resetWaitingTimes]);

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">보드 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:h-full md:overflow-hidden">
      <div className="shrink-0 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setIsMoreSheetOpen(true)}>
          <History className="h-4 w-4 mr-1" />
          게임 기록 · 초기화
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:flex-1 md:min-h-0">
        {/* 왼쪽: 인원 풀 / 팀 뽑기 탭 전환 — 활성 탭이 컬럼 전체 높이를 쓰고 그 안에서만 스크롤된다 */}
        <Card className="md:min-h-0">
          <Tabs
            value={leftTab}
            onValueChange={(v) => setLeftTab(v as 'pool' | 'pick')}
            className="gap-3 md:flex-1 md:min-h-0"
          >
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-6">
              <TabsList>
                <TabsTrigger value="pool">인원 풀</TabsTrigger>
                <TabsTrigger value="pick">팀 뽑기</TabsTrigger>
              </TabsList>
              <div className="hidden md:flex items-center gap-2 shrink-0">
                {leftTab === 'pool' ? (
                  <Button size="sm" variant="outline" onClick={() => setIsAddPlayerModalOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    선수 등록
                  </Button>
                ) : isCustomPicking ? (
                  <>
                    <Button size="sm" onClick={handleCustomConfirm} disabled={selectedPlayers.length !== 4}>
                      확정
                    </Button>
                    {selectedPlayers.length === 4 && !isEditingCustomPick && (
                      <Button size="sm" variant="outline" onClick={() => setIsEditingCustomPick(true)}>
                        다시 선택
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleCustomCancel}>
                      취소
                    </Button>
                  </>
                ) : (
                  pickedPlayers && (
                    <>
                      <Button size="sm" onClick={handleConfirmGame}>
                        확정
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleRandomPickTeams}>
                        다시 뽑기
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleStartCustomPicking}>
                        직접 선택
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelPick}>
                        취소
                      </Button>
                    </>
                  )
                )}
              </div>
            </div>

            <TabsContent value="pool" className="flex-none px-6 pb-6 md:flex md:flex-col md:flex-1 md:min-h-0">
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
            </TabsContent>

            <TabsContent value="pick" className="flex-none px-6 pb-6 md:flex md:flex-col md:flex-1 md:min-h-0">
              {isCustomPicking ? (
                <CustomTeamPicker
                  players={players}
                  games={games}
                  selectedPlayers={selectedPlayers}
                  onSelectedPlayersChange={setSelectedPlayers}
                  onConfirm={handleCustomConfirm}
                  onCancel={handleCustomCancel}
                  isEditingSelection={isEditingCustomPick}
                  onEditingSelectionChange={setIsEditingCustomPick}
                  boundedOnDesktop
                />
              ) : (
                <TeamPicker
                  players={players}
                  games={games}
                  pickedPlayers={pickedPlayers}
                  onRandomPick={handleRandomPickTeams}
                  onConfirm={handleConfirmGame}
                  onReject={handleRandomPickTeams}
                  onCustomPick={handleStartCustomPicking}
                  onCancelPick={handleCancelPick}
                  onReorderPickedPlayers={setPickedPlayers}
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* 오른쪽: 코트 관리 + 대기열 (세로로 쌓임, 항상 둘 다 펼쳐짐) */}
        <div className="flex flex-col gap-3 md:min-h-0">
          <Card className="gap-3 md:flex-1 md:min-h-0">
            <CardHeader className="shrink-0 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base md:text-lg">
                  코트 관리
                  {courts.some((c) => c.playerIds !== null) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (게임중: {courts.filter((c) => c.playerIds !== null).length}개)
                    </span>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setIsAddingCourt(true)} className="shrink-0">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  코트 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 md:flex md:flex-col md:flex-1 md:min-h-0">
              <CourtManager
                courts={courts}
                players={players}
                isAdding={isAddingCourt}
                onCancelAdding={() => setIsAddingCourt(false)}
                onAddCourt={addCourt}
                onRemoveCourt={handleRemoveCourt}
                onRenameCourt={renameCourt}
                onEndGame={handleEndCourtGame}
                onCancelGame={handleCancelCourtGame}
              />
            </CardContent>
          </Card>

          <Card className="gap-3 md:flex-1 md:min-h-0">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base md:text-lg">
                대기열
                {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
              <GameQueue
                queue={queue}
                courts={courts}
                players={players}
                onAssignCourt={handleAssignQueueToCourt}
                onRemove={handleRemoveFromQueue}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={isMoreSheetOpen} onOpenChange={setIsMoreSheetOpen}>
        <SheetContent className="flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>게임 기록 · 초기화</SheetTitle>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-fade px-4">
            <GameHistory games={games} players={players} onRemoveGame={handleRemoveGame} />
          </div>

          <div className="shrink-0 px-4 pb-6 border-t pt-4">
            <h3 className="text-sm font-medium mb-2">초기화</h3>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={handleResetWaitingTimes} variant="secondary" size="sm">
                대기 시간 초기화
              </Button>
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
          </div>
        </SheetContent>
      </Sheet>

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

      <PlayerAddModal
        isOpen={isAddPlayerModalOpen}
        onClose={() => setIsAddPlayerModalOpen(false)}
        onAddPlayer={handleAddPlayer}
      />
    </div>
  );
}
