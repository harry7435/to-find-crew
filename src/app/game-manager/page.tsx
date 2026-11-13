'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useGameManager, Player } from '@/hooks/useGameManager';
import { useReadyFlags } from '@/hooks/useReadyFlags';
import PlayerAddModal from '@/components/game-manager/PlayerAddModal';
import PlayerList, { AttendanceFilter } from '@/components/game-manager/PlayerList';
import PlayerEditModal from '@/components/game-manager/PlayerEditModal';
import AttendancePickerModal from '@/components/game-manager/AttendancePickerModal';
import TeamPicker from '@/components/game-manager/TeamPicker';
import CustomTeamPicker from '@/components/game-manager/CustomTeamPicker';
import GameHistory from '@/components/game-manager/GameHistory';
import CourtManager from '@/components/game-manager/CourtManager';
import GameQueue from '@/components/game-manager/GameQueue';
import { useArrivalHighlight, samePlayerSet } from '@/hooks/useArrivalHighlight';
import { randomTeamPicker } from '@/utils/smartTeamPicker';
import MigrateBanner from '@/components/game-manager/MigrateBanner';
import MigrateModal from '@/components/game-manager/MigrateModal';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { MIGRATION_PENDING_FLAG } from '@/utils/gameManagerMigration';
import MobileTabBar, { MOBILE_TAB_BAR_PADDING } from '@/components/layout/MobileTabBar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type MobileSection = 'players' | 'pick' | 'queue' | 'courts';

/** 모바일에서는 접힘과 무관하게 내용을 보이고(탭이 섹션 전환을 맡는다), 데스크톱은 기존 접기 동작을 쓴다. */
const COLLAPSIBLE_MOBILE_OPEN = 'data-[state=closed]:hidden max-md:!block';

export default function GameManagerPage() {
  const router = useRouter();
  const confirm = useConfirm();
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
  const { readyIds, toggleReady, removeReady, clearReady, pruneReady } = useReadyFlags('game-manager-ready');
  const [pickedPlayers, setPickedPlayers] = useState<[Player, Player, Player, Player] | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [isEditingCustomPick, setIsEditingCustomPick] = useState(false);
  const [isAttendancePickerOpen, setIsAttendancePickerOpen] = useState(false);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('attending');
  const [openSections, setOpenSections] = useState({
    playerList: true,
    teamPicker: true,
    queue: true,
    courtManager: true,
  });
  // 모바일 전용: 섹션을 세로로 다 펼치면 한 화면에 안 들어와서 하단 탭으로 하나씩 보여준다.
  const [mobileTab, setMobileTab] = useState<MobileSection>('players');
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);
  const queueArrival = useArrivalHighlight();
  const courtArrival = useArrivalHighlight();
  const flashQueue = queueArrival.flash;
  const flashCourt = courtArrival.flash;
  // 방금 확정한 4명. enqueueGame과 같은 핸들러에서 세팅되므로 다음 렌더의 queue에 새 항목이 들어 있다.
  const [pendingEnqueue, setPendingEnqueue] = useState<string[] | null>(null);

  useEffect(() => {
    if (!pendingEnqueue) return;
    setPendingEnqueue(null);
    const idx = queue.findIndex((q) => samePlayerSet(q.playerIds, pendingEnqueue));
    if (idx === -1) {
      toast.success('대기열에 추가했어요');
      return;
    }
    setOpenSections((prev) => ({ ...prev, queue: true }));
    setMobileTab('queue');
    flashQueue(queue[idx].id, `방금 추가 · ${idx + 1}번째`);
    toast.success(`대기열 ${idx + 1}번째로 추가했어요`);
  }, [pendingEnqueue, queue, flashQueue]);
  const { emailOnboarding } = useAuth();

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

  // 참석자 목록이 바뀔 때마다 미참석자의 준비완료를 해제한다. 문자열 키로 비교해야
  // players 배열이 매 렌더 새로 만들어져도 실제 참석자가 바뀔 때만 정리가 돈다.
  const attendingIdsKey = useMemo(
    () =>
      players
        .filter((p) => p.attending)
        .map((p) => p.id)
        .sort()
        .join(','),
    [players],
  );

  useEffect(() => {
    if (isLoading) return;
    pruneReady(new Set(attendingIdsKey ? attendingIdsKey.split(',') : []));
  }, [attendingIdsKey, isLoading, pruneReady]);

  const handleAddPlayer = useCallback(
    (playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => {
      addPlayer(playerData);
      toast.success(`${playerData.name} 선수를 등록했어요`);
    },
    [addPlayer],
  );

  const handleRemovePlayer = useCallback(
    async (id: string) => {
      const player = players.find((p) => p.id === id);
      if (
        player &&
        (await confirm({
          title: `${player.name} 선수를 삭제하시겠습니까?`,
          confirmText: '삭제',
          variant: 'destructive',
        }))
      ) {
        removePlayer(id);
        removeReady(id);
        toast.success('선수가 삭제되었습니다');
        if (pickedPlayers) {
          const allPickedIds = pickedPlayers.map((p) => p.id);
          if (allPickedIds.includes(id)) {
            setPickedPlayers(null);
          }
        }
      }
    },
    [players, removePlayer, removeReady, pickedPlayers, confirm],
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

    setPendingEnqueue(playerIds);
    setPickedPlayers(null);
    setIsCustomPicking(false);
  }, [pickedPlayers, enqueueGame]);

  const handleAssignQueueToCourt = useCallback(
    (queueItemId: string, courtId: string) => {
      assignQueueToCourt(queueItemId, courtId);
      const court = courts.find((c) => c.id === courtId);
      setOpenSections((prev) => ({ ...prev, courtManager: true }));
      setMobileTab('courts');
      flashCourt(courtId, '게임 시작');
      toast.success(`${court?.name ?? '코트'}에서 게임을 시작했어요`);
    },
    [assignQueueToCourt, courts, flashCourt],
  );

  const handleRemoveFromQueue = useCallback(
    async (queueItemId: string) => {
      if (
        await confirm({
          title: '대기열에서 이 게임을 취소하시겠습니까?',
          confirmText: '대기 취소',
          cancelText: '닫기',
        })
      ) {
        removeFromQueue(queueItemId);
        toast.success('대기열에서 취소되었습니다');
      }
    },
    [removeFromQueue, confirm],
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
    async (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (!court?.playerIds) return;
      if (
        await confirm({
          title: `${court.name} 게임을 종료하시겠습니까?`,
          confirmText: '종료',
          variant: 'destructive',
        })
      ) {
        endCourtGame(id);
        toast.success(`${court.name} 게임이 종료되었습니다. 선수들이 복귀했습니다`);
      }
    },
    [courts, endCourtGame, confirm],
  );

  const handleCancelCourtGame = useCallback(
    async (id: string) => {
      const court = courts.find((c) => c.id === id);
      if (!court?.playerIds) return;
      if (
        await confirm({
          title: `${court.name} 게임을 취소하시겠습니까?`,
          description: '게임 기록이 남지 않고 선수 대기시간이 유지됩니다',
          confirmText: '게임 취소',
          cancelText: '닫기',
        })
      ) {
        cancelCourtGame(id);
        toast.success(`${court.name} 게임이 취소되었습니다`);
      }
    },
    [courts, cancelCourtGame, confirm],
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

  // 직접 고른 4명은 선택 화면이 이미 코트 박스 미리보기로 보여주므로, 랜덤 뽑기처럼 결과 확인
  // 단계를 한 번 더 거치지 않고 확정 한 번으로 대기열에 넣는다.
  const handleCustomConfirm = useCallback(() => {
    if (selectedPlayers.length !== 4) return;
    const playerIds = selectedPlayers.map((p) => p.id) as [string, string, string, string];
    enqueueGame(playerIds);
    setPendingEnqueue(playerIds);
    setIsCustomPicking(false);
    setPickedPlayers(null);
    setSelectedPlayers([]);
    setIsEditingCustomPick(false);
  }, [selectedPlayers, enqueueGame]);

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
    async (id: string) => {
      if (
        await confirm({
          title: '이 게임 기록을 삭제하시겠습니까?',
          confirmText: '삭제',
          variant: 'destructive',
        })
      ) {
        removeGame(id);
        toast.success('게임 기록이 삭제되었습니다');
      }
    },
    [removeGame, confirm],
  );

  const handleResetGames = useCallback(async () => {
    if (games.length === 0) {
      toast.error('삭제할 게임 기록이 없습니다');
      return;
    }
    if (
      await confirm({
        title: '모든 게임 기록을 삭제하시겠습니까?',
        description: '대기 중인 선수의 대기 시간도 함께 초기화됩니다',
        confirmText: '삭제',
        variant: 'destructive',
      })
    ) {
      resetGames();
      resetWaitingTimes();
      toast.success('게임 기록과 대기 시간이 초기화되었습니다');
    }
  }, [games.length, resetGames, resetWaitingTimes, confirm]);

  const handleResetPlayers = useCallback(async () => {
    if (players.length === 0) {
      toast.error('삭제할 선수가 없습니다');
      return;
    }
    if (
      await confirm({
        title: '모든 선수 정보를 삭제하시겠습니까?',
        description: '게임 기록도 함께 삭제됩니다',
        confirmText: '삭제',
        variant: 'destructive',
      })
    ) {
      resetPlayers();
      resetGames();
      setPickedPlayers(null);
      toast.success('선수 목록이 초기화되었습니다');
    }
  }, [players.length, resetPlayers, resetGames, confirm]);

  const handleResetPlayerStates = useCallback(async () => {
    if (players.length === 0) {
      toast.error('선수가 없습니다');
      return;
    }

    const hasRestingPlayers = players.some((p) => p.status === 'resting' && p.attending);
    const hasPinnedPlayers = players.some((p) => p.pinned === true);
    const hasReadyPlayers = readyIds.size > 0;

    if (!hasRestingPlayers && !hasPinnedPlayers && !hasReadyPlayers) {
      toast.error('휴식중이거나 필수 포함·준비완료된 선수가 없습니다');
      return;
    }

    if (
      await confirm({
        title: '모든 참석 선수의 휴식 상태·필수 포함·준비완료를 해제하시겠습니까?',
        confirmText: '해제',
      })
    ) {
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
      clearReady();
      setPickedPlayers(null);
      toast.success('선수 상태가 초기화되었습니다');
    }
  }, [players, updatePlayer, readyIds, clearReady, confirm]);

  const handleResetAttendance = useCallback(async () => {
    if (!players.some((p) => p.attending)) {
      toast.error('참석 처리된 선수가 없습니다');
      return;
    }
    if (
      await confirm({
        title: '모든 선수의 오늘 참석을 해제하시겠습니까?',
        confirmText: '해제',
      })
    ) {
      setAttendingBulk([]);
      setPickedPlayers(null);
      toast.success('참석이 모두 해제되었습니다');
    }
  }, [players, setAttendingBulk, confirm]);

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

  const mobileTabs = [
    { key: 'players', label: '인원', badge: attendingCount },
    { key: 'pick', label: '팀뽑기' },
    { key: 'queue', label: '대기', badge: queue.length },
    { key: 'courts', label: '코트', badge: `${courts.filter((c) => c.playerIds !== null).length}/${courts.length}` },
  ];
  /** 모바일에서 현재 탭이 아닌 섹션은 숨긴다(언마운트하지 않음 — 직접 선택 중인 선수 등 상태 보존). */
  const mobileOnly = (section: MobileSection) => (mobileTab === section ? '' : 'hidden md:block');

  return (
    <div className={`container mx-auto px-3 py-4 max-w-4xl ${MOBILE_TAB_BAR_PADDING}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
        </Button>
        <h1 className="text-xl md:text-2xl font-bold">번개 게임 관리</h1>
        <Button variant="ghost" size="sm" onClick={() => setIsMoreSheetOpen(true)} className="text-xs">
          게임 기록 · 초기화
        </Button>
      </div>

      <MigrateBanner hasPlayers={players.length > 0} onOpenModal={() => setIsMigrateModalOpen(true)} />

      {/* Section 1: Player List */}
      <Collapsible
        open={openSections.playerList}
        onOpenChange={() => toggleSection('playerList')}
        className={mobileOnly('players')}
      >
        <Card className="mb-3">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between gap-2">
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
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="hidden md:inline-flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!openSections.playerList) toggleSection('playerList');
                      setIsAddPlayerModalOpen(true);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    선수 등록
                  </Button>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 max-md:hidden ${openSections.playerList ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className={COLLAPSIBLE_MOBILE_OPEN}>
            <CardContent className="pt-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddPlayerModalOpen(true)}
                className="w-full mb-3 md:hidden"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                선수 등록
              </Button>
              <PlayerList
                players={players}
                onRemovePlayer={handleRemovePlayer}
                onEditPlayer={handleEditPlayer}
                onToggleStatus={handleToggleStatus}
                onTogglePinned={handleTogglePinned}
                onToggleAttending={handleToggleAttending}
                onOpenAttendancePicker={() => setIsAttendancePickerOpen(true)}
                onAddPlayerClick={() => setIsAddPlayerModalOpen(true)}
                filter={attendanceFilter}
                onFilterChange={setAttendanceFilter}
                gameCountsMap={playerGameCounts}
                readyIds={readyIds}
                onToggleReady={toggleReady}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 3: Team Picker */}
      <Collapsible
        open={openSections.teamPicker}
        onOpenChange={() => toggleSection('teamPicker')}
        className={mobileOnly('pick')}
      >
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
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 max-md:hidden ${openSections.teamPicker ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className={COLLAPSIBLE_MOBILE_OPEN}>
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
                  onOpenAttendancePicker={() => setIsAttendancePickerOpen(true)}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 3.5: Game Queue */}
      <Collapsible
        open={openSections.queue}
        onOpenChange={() => toggleSection('queue')}
        className={mobileOnly('queue')}
      >
        <Card className="mb-3">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-lg transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">
                  대기열
                  {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 max-md:hidden ${openSections.queue ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className={COLLAPSIBLE_MOBILE_OPEN}>
            <CardContent className="pt-0">
              <GameQueue
                queue={queue}
                courts={courts}
                players={players}
                onAssignCourt={handleAssignQueueToCourt}
                onRemove={handleRemoveFromQueue}
                highlight={queueArrival.arrival}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 4: Court Manager */}
      <Collapsible
        open={openSections.courtManager}
        onOpenChange={() => toggleSection('courtManager')}
        className={mobileOnly('courts')}
      >
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
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 max-md:hidden ${openSections.courtManager ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className={COLLAPSIBLE_MOBILE_OPEN}>
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
                highlight={courtArrival.arrival}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <PlayerAddModal
        isOpen={isAddPlayerModalOpen}
        onClose={() => setIsAddPlayerModalOpen(false)}
        onAddPlayer={handleAddPlayer}
      />

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

      <Sheet open={isMoreSheetOpen} onOpenChange={setIsMoreSheetOpen}>
        <SheetContent className="flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>게임 기록 ({games.length}) · 초기화</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto scroll-fade px-4">
            <GameHistory games={games} players={players} onRemoveGame={handleRemoveGame} />
          </div>
          <div className="shrink-0 px-4 pb-6 border-t pt-4">
            <h3 className="text-sm font-medium mb-2">초기화</h3>
            <div className="grid grid-cols-2 gap-2">
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
              ⚠️ 상태 초기화: 휴식·필수포함·준비완료 해제 | 참석 해제: 오늘 참석 전원 off | 게임/선수 초기화: 되돌릴 수
              없음
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* 이메일로 처음 가입해 돌아온 사람은 온보딩 모달이 함께 뜬다. 온보딩을 먼저 보여주고,
          끝나거나 닫히면 이어서 띄운다(열림 상태 자체는 그대로 두므로 플래그 처리와 무관하다). */}
      <MigrateModal
        isOpen={isMigrateModalOpen && !emailOnboarding.isPending}
        onClose={() => setIsMigrateModalOpen(false)}
        players={players}
      />

      <MobileTabBar tabs={mobileTabs} active={mobileTab} onChange={(key) => setMobileTab(key as MobileSection)} />
    </div>
  );
}
