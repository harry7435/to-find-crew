'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useGameManager, Player } from '@/hooks/useGameManager';
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
import MigrateBanner from '@/components/game-manager/MigrateBanner';
import MigrateModal from '@/components/game-manager/MigrateModal';
import { MIGRATION_PENDING_FLAG } from '@/utils/gameManagerMigration';

export default function GameManagerPage() {
  const router = useRouter();
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
    resetWaitingTimes,
    addCourt,
    removeCourt,
    renameCourt,
    enqueueGame,
    removeFromQueue,
    assignQueueToCourt,
    endCourtGame,
    cancelCourtGame,
    moveCourtGame,
    isLoading,
  } = useGameManager();
  const [pickedPlayers, setPickedPlayers] = useState<[Player, Player, Player, Player] | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [isEditingCustomPick, setIsEditingCustomPick] = useState(false);
  const [isAttendancePickerOpen, setIsAttendancePickerOpen] = useState(false);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
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
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);

  // 로그인 콜백에서 돌아왔는데 플래그가 아직 남아있는 예외 상황 대비
  useEffect(() => {
    if (localStorage.getItem(MIGRATION_PENDING_FLAG) === 'true') {
      localStorage.removeItem(MIGRATION_PENDING_FLAG);
      setIsMigrateModalOpen(true);
    }
  }, []);

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
        if (pickedPlayers) {
          const allPickedIds = pickedPlayers.map((p) => p.id);
          if (allPickedIds.includes(id)) {
            setPickedPlayers(null);
          }
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
      const selectedPlayers = randomTeamPicker(players);
      setPickedPlayers(selectedPlayers);
    } catch (error) {
      console.error('Player picking error:', error);
      toast.error(error instanceof Error ? error.message : '선수를 뽑는데 실패했습니다');
    }
  }, [players]);

  const handleConfirmGame = useCallback(() => {
    if (!pickedPlayers) return;

    const playerIds = pickedPlayers.map((p) => p.id) as [string, string, string, string];
    enqueueGame(playerIds);

    const playerNames = pickedPlayers.map((p) => p.name).join(', ');
    toast.success('대기열에 추가되었습니다', {
      description: `선수: ${playerNames}`,
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

  const handleAddCourt = useCallback(
    (name: string) => {
      addCourt(name);
    },
    [addCourt],
  );

  const handleRenameCourt = useCallback(
    (id: string, name: string) => {
      renameCourt(id, name);
    },
    [renameCourt],
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
      if (confirm(`${court.name} 게임을 취소하시겠습니까?\n(게임 기록이 남지 않고 선수 대기시간이 유지됩니다)`)) {
        cancelCourtGame(id);
        toast.success(`${court.name} 게임이 취소되었습니다`);
      }
    },
    [courts, cancelCourtGame],
  );

  const handleMoveCourtGame = useCallback(
    (fromCourtId: string, toCourtId: string) => {
      const from = courts.find((c) => c.id === fromCourtId);
      const to = courts.find((c) => c.id === toCourtId);
      if (!from?.playerIds || !to) return;
      moveCourtGame(fromCourtId, toCourtId);
      toast.success(to.playerIds ? `${from.name} ↔ ${to.name} 게임을 맞바꿨습니다` : `${to.name}에 게임을 옮겼습니다`);
    },
    [courts, moveCourtGame],
  );

  const handleRejectPick = useCallback(() => {
    handleRandomPickTeams();
  }, [handleRandomPickTeams]);

  const handleCancelPick = useCallback(() => {
    setPickedPlayers(null);
  }, []);

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

  const handleEditPlayer = useCallback((player: Player) => {
    setEditingPlayer(player);
  }, []);

  const handleUpdatePlayer = useCallback(
    (id: string, updates: Partial<Omit<Player, 'id'>>) => {
      updatePlayer(id, updates);
      toast.success('선수 정보가 수정되었습니다');
    },
    [updatePlayer],
  );

  const handleToggleStatus = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;

      const newStatus = player.status === 'active' ? 'resting' : 'active';
      if (newStatus === 'resting') {
        updatePlayer(id, { status: 'resting', pinned: false, waitingSince: null });
        toast.success(`${player.name} 선수가 휴식 상태로 변경되었습니다`);
        if (pickedPlayers) {
          const allPickedIds = pickedPlayers.map((p) => p.id);
          if (allPickedIds.includes(id)) {
            setPickedPlayers(null);
          }
        }
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

      const newPinned = !player.pinned;
      updatePlayer(id, { pinned: newPinned });

      if (newPinned) {
        toast.success(`${player.name} 선수가 필수 포함되었습니다`);
      } else {
        toast.success(`${player.name} 선수의 필수 포함이 해제되었습니다`);
      }

      if (pickedPlayers) {
        setPickedPlayers(null);
      }
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
      if (pickedPlayers?.some((p) => p.id === id)) {
        setPickedPlayers(null);
      }
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
    if (confirm('모든 선수 정보를 삭제하시겠습니까?\n(게임 기록도 함께 삭제됩니다)')) {
      resetPlayers();
      resetGames();
      setPickedPlayers(null);
      toast.success('선수 목록이 초기화되었습니다');
    }
  }, [players.length, resetPlayers, resetGames]);

  const handleResetPlayerStates = useCallback(() => {
    if (players.length === 0) {
      toast.error('선수가 없습니다');
      return;
    }

    const hasRestingPlayers = players.some((p) => p.status === 'resting' && p.attending);
    const hasPinnedPlayers = players.some((p) => p.pinned === true);

    if (!hasRestingPlayers && !hasPinnedPlayers) {
      toast.error('휴식중이거나 필수 포함된 선수가 없습니다');
      return;
    }

    if (confirm('모든 참석 선수의 휴식 상태와 필수 포함을 해제하시겠습니까?')) {
      const nowIso = new Date().toISOString();
      players.forEach((player) => {
        if (player.attending && (player.status === 'resting' || player.pinned === true)) {
          updatePlayer(player.id, {
            status: player.status === 'resting' ? 'active' : player.status,
            pinned: false,
            waitingSince: player.status === 'resting' ? nowIso : player.waitingSince,
          });
        }
      });
      setPickedPlayers(null);
      toast.success('선수 상태가 초기화되었습니다');
    }
  }, [players, updatePlayer]);

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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const attendingCount = players.filter((p) => p.attending).length;
  const activeCount = players.filter((p) => p.status === 'active').length;
  const playingCount = players.filter((p) => p.status === 'playing').length;
  const queuedCount = players.filter((p) => p.status === 'queued').length;

  return (
    <div className="container mx-auto px-3 py-4 max-w-4xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">번개 게임 관리</h1>
        <div className="w-11" />
      </div>

      <MigrateBanner hasPlayers={players.length > 0} onOpenModal={() => setIsMigrateModalOpen(true)} />

      {/* Section 1: Player Registration */}
      <Collapsible open={openSections.registration} onOpenChange={() => toggleSection('registration')}>
        <Card className="mb-3">
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

      {/* Section 2: Player List */}
      <Collapsible open={openSections.playerList} onOpenChange={() => toggleSection('playerList')}>
        <Card className="mb-3">
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

      {/* Section 3: Team Picker */}
      <Collapsible open={openSections.teamPicker} onOpenChange={() => toggleSection('teamPicker')}>
        <Card className="mb-3">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base md:text-lg">팀 뽑기</CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden md:flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isCustomPicking ? (
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
                          <Button size="sm" variant="outline" onClick={handleRejectPick}>
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
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.teamPicker ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
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
                />
              ) : (
                <TeamPicker
                  players={players}
                  games={games}
                  pickedPlayers={pickedPlayers}
                  onRandomPick={handleRandomPickTeams}
                  onConfirm={handleConfirmGame}
                  onReject={handleRejectPick}
                  onCustomPick={handleStartCustomPicking}
                  onCancelPick={handleCancelPick}
                  onReorderPickedPlayers={setPickedPlayers}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 3.5: Game Queue */}
      <Collapsible open={openSections.queue} onOpenChange={() => toggleSection('queue')}>
        <Card className="mb-3">
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

      {/* Section 4: Court Manager */}
      <Collapsible open={openSections.courtManager} onOpenChange={() => toggleSection('courtManager')}>
        <Card className="mb-3">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base md:text-lg">
                  코트 관리
                  {courts.some((c) => c.playerIds !== null) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (게임중: {courts.filter((c) => c.playerIds !== null).length}개)
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!openSections.courtManager) toggleSection('courtManager');
                      setIsAddingCourt(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    코트 추가
                  </Button>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${openSections.courtManager ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <CourtManager
                courts={courts}
                players={players}
                isAdding={isAddingCourt}
                onCancelAdding={() => setIsAddingCourt(false)}
                onAddCourt={handleAddCourt}
                onRemoveCourt={handleRemoveCourt}
                onRenameCourt={handleRenameCourt}
                onEndGame={handleEndCourtGame}
                onCancelGame={handleCancelCourtGame}
                onMoveGame={handleMoveCourtGame}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 5: Game History & Stats */}
      <Collapsible open={openSections.gameHistory} onOpenChange={() => toggleSection('gameHistory')}>
        <Card className="mb-3">
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

      {/* Section 6: Reset Actions */}
      <Collapsible open={openSections.resetActions} onOpenChange={() => toggleSection('resetActions')}>
        <Card className="mb-4">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button onClick={handleResetPlayerStates} variant="secondary" size="sm">
                  상태 초기화
                </Button>
                <Button onClick={handleResetAttendance} variant="secondary" size="sm">
                  참석 전체 해제
                </Button>
                <Button onClick={handleResetGames} variant="outline" size="sm">
                  게임 기록 초기화
                </Button>
                <Button onClick={handleResetPlayers} variant="destructive" size="sm">
                  선수 목록 초기화
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ 상태 초기화: 휴식·필수포함 해제 | 참석 해제: 오늘 참석 전원 off | 게임/선수 초기화: 되돌릴 수 없음
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Player Edit Modal */}
      <PlayerEditModal
        player={editingPlayer}
        isOpen={editingPlayer !== null}
        onClose={() => setEditingPlayer(null)}
        onUpdate={handleUpdatePlayer}
      />

      {/* Attendance Picker Modal */}
      <AttendancePickerModal
        isOpen={isAttendancePickerOpen}
        onClose={() => setIsAttendancePickerOpen(false)}
        players={players}
        onConfirm={handleBulkAttending}
      />

      <MigrateModal isOpen={isMigrateModalOpen} onClose={() => setIsMigrateModalOpen(false)} players={players} />
    </div>
  );
}
