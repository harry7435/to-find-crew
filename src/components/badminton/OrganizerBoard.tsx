'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserPlus, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useBoardRealtime } from '@/hooks/useBoardRealtime';
import { useReadyFlags } from '@/hooks/useReadyFlags';
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
import { useConfirm } from '@/components/ui/confirm-dialog';
import { notifyGameStarted } from '@/lib/push';
import { useArrivalHighlight, samePlayerSet } from '@/hooks/useArrivalHighlight';
import MobileTabBar from '@/components/layout/MobileTabBar';

type MobileSection = 'players' | 'pick' | 'queue' | 'courts';

interface OrganizerBoardProps {
  sessionId: string;
  /** "게임 기록 · 초기화" 시트 개폐 상태. 트리거 버튼은 부모(세션 상세 페이지)의 "게임 관리"
   *  타이틀과 같은 줄에 렌더링되므로, 시트 콘텐츠를 소유한 이 컴포넌트가 상태를 controlled prop으로 받는다. */
  isMoreSheetOpen: boolean;
  onMoreSheetOpenChange: (open: boolean) => void;
}

export default function OrganizerBoard({ sessionId, isMoreSheetOpen, onMoreSheetOpenChange }: OrganizerBoardProps) {
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
    moveCourtGame,
    isLoading,
  } = useBoardRealtime(sessionId);
  const { readyIds, toggleReady, removeReady, pruneReady } = useReadyFlags(`board-ready-${sessionId}`);

  const [pickedPlayers, setPickedPlayers] = useState<[Player, Player, Player, Player] | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [isEditingCustomPick, setIsEditingCustomPick] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [isAttendancePickerOpen, setIsAttendancePickerOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'pool' | 'pick'>('pool');
  // 모바일 전용 하단 탭. 인원/팀뽑기는 왼쪽 카드의 leftTab과 같은 화면이라 서로 맞춘다.
  const [mobileTab, setMobileTab] = useState<MobileSection>('players');
  const handleMobileTab = useCallback((key: string) => {
    const next = key as MobileSection;
    setMobileTab(next);
    if (next === 'players') setLeftTab('pool');
    if (next === 'pick') setLeftTab('pick');
  }, []);
  // 코트 관리가 대기열보다 중요한 정보라, 기본값은 접어서 코트 관리가 남는 세로 공간을 다 쓰게 한다.
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('attending');
  // 확정 요청 중에는 뽑은 4명을 화면에 남겨 두고 버튼만 잠근다. 예전처럼 먼저 비우면
  // 응답이 올 때까지 팀이 화면 어디에도 없는 공백이 생겨 "어디 갔지?"가 된다.
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);
  const [assigning, setAssigning] = useState<{ queueItemId: string; courtId: string } | null>(null);
  const queueArrival = useArrivalHighlight();
  const courtArrival = useArrivalHighlight();
  // 방금 내가 확정한 4명. enqueueGame은 성공 시 loadSnapshot까지 끝낸 뒤 true를 돌려주므로,
  // 이 값을 세팅한 다음 렌더의 queue에는 새 항목이 이미 들어 있다 — 아래 effect가 그걸 찾아 강조한다.
  const [pendingEnqueue, setPendingEnqueue] = useState<string[] | null>(null);
  // 의존성 배열에 멤버 접근식을 넣지 않도록 안정적인 함수를 꺼내 둔다.
  const flashQueue = queueArrival.flash;
  const flashCourt = courtArrival.flash;

  useEffect(() => {
    if (!pendingEnqueue) return;
    setPendingEnqueue(null);
    const idx = queue.findIndex((q) => samePlayerSet(q.playerIds, pendingEnqueue));
    if (idx === -1) {
      // 그 사이 다른 운영자가 배정·취소했으면 강조할 대상이 없다.
      toast.success('대기열에 추가했어요');
      return;
    }
    setIsQueueExpanded(true);
    setMobileTab('queue');
    flashQueue(queue[idx].id, `방금 추가 · ${idx + 1}번째`);
    toast.success(`대기열 ${idx + 1}번째로 추가했어요`);
  }, [pendingEnqueue, queue, flashQueue]);

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
  // realtime 갱신으로 players 배열이 새로 만들어져도 실제 참석자가 바뀔 때만 정리가 돈다.
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
    async (playerData: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => {
      if (await addPlayer(playerData)) {
        toast.success(`${playerData.name} 선수를 등록했어요`);
      }
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
        if (!(await removePlayer(id))) return;
        removeReady(id);
        toast.success('선수가 삭제되었습니다');
        if (pickedPlayers?.some((p) => p.id === id)) {
          setPickedPlayers(null);
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
      setPickedPlayers(randomTeamPicker(players));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '선수를 뽑는데 실패했습니다');
    }
  }, [players]);

  const handleConfirmGame = useCallback(async () => {
    if (!pickedPlayers || isSubmittingGame) return;
    const picked = pickedPlayers;
    const playerIds = picked.map((p) => p.id) as [string, string, string, string];
    setIsSubmittingGame(true);
    try {
      if (await enqueueGame(playerIds)) {
        setPickedPlayers(null);
        setIsCustomPicking(false);
        setPendingEnqueue(playerIds);
      }
      // 실패하면 뽑아 둔 4명이 그대로 남아 있으므로 바로 다시 시도할 수 있다.
    } finally {
      setIsSubmittingGame(false);
    }
  }, [pickedPlayers, isSubmittingGame, enqueueGame]);

  const handleCancelPick = useCallback(() => {
    setPickedPlayers(null);
  }, []);

  const handleAssignQueueToCourt = useCallback(
    async (queueItemId: string, courtId: string) => {
      if (assigning) return;
      const court = courts.find((c) => c.id === courtId);
      setAssigning({ queueItemId, courtId });
      try {
        if (await assignQueueToCourt(queueItemId, courtId)) {
          flashCourt(courtId, '게임 시작');
          setMobileTab('courts');
          toast.success(`${court?.name ?? '코트'}에서 게임을 시작했어요`);
          // 대기열 항목 id가 곧 board_games.id 다. 기다리지 않는다 — 알림 실패가 보드 조작을 막으면 안 된다.
          notifyGameStarted(queueItemId);
        }
      } finally {
        setAssigning(null);
      }
    },
    [assigning, assignQueueToCourt, courts, flashCourt],
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
        if (await removeFromQueue(queueItemId)) {
          toast.success('대기열에서 취소되었습니다');
        }
      }
    },
    [removeFromQueue, confirm],
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
        if (await endCourtGame(id)) {
          toast.success(`${court.name} 게임이 종료되었습니다. 선수들이 복귀했습니다`);
        }
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
          description: '게임 기록이 남지 않습니다',
          confirmText: '게임 취소',
          cancelText: '닫기',
        })
      ) {
        if (await cancelCourtGame(id)) {
          toast.success(`${court.name} 게임이 취소되었습니다`);
        }
      }
    },
    [courts, cancelCourtGame, confirm],
  );

  const handleMoveCourtGame = useCallback(
    async (fromCourtId: string, toCourtId: string) => {
      const from = courts.find((c) => c.id === fromCourtId);
      const to = courts.find((c) => c.id === toCourtId);
      if (!from?.playerIds || !to) return;
      if (await moveCourtGame(fromCourtId, toCourtId)) {
        toast.success(
          to.playerIds ? `${from.name} ↔ ${to.name} 게임을 맞바꿨습니다` : `${to.name}에 게임을 옮겼습니다`,
        );
      }
    },
    [courts, moveCourtGame],
  );

  const handleStartCustomPicking = useCallback(() => {
    setSelectedPlayers([]);
    setIsEditingCustomPick(false);
    setIsCustomPicking(true);
  }, []);

  // 직접 고른 4명은 선택 화면이 이미 코트 박스 미리보기로 보여주므로, 랜덤 뽑기처럼 결과 확인
  // 단계를 한 번 더 거치지 않고 확정 한 번으로 대기열에 넣는다.
  const handleCustomConfirm = useCallback(async () => {
    if (selectedPlayers.length !== 4 || isSubmittingGame) return;
    const picked = selectedPlayers;
    const playerIds = picked.map((p) => p.id) as [string, string, string, string];
    setIsSubmittingGame(true);
    try {
      if (await enqueueGame(playerIds)) {
        setIsCustomPicking(false);
        setPickedPlayers(null);
        setSelectedPlayers([]);
        setIsEditingCustomPick(false);
        setPendingEnqueue(playerIds);
      }
      // 실패하면 선택 화면과 고른 4명이 그대로 남아 있으므로 바로 다시 시도할 수 있다.
    } finally {
      setIsSubmittingGame(false);
    }
  }, [selectedPlayers, isSubmittingGame, enqueueGame]);

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
    async (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;
      if (player.status === 'active') {
        if (pickedPlayers?.some((p) => p.id === id)) setPickedPlayers(null);
        if (await updatePlayer(id, { status: 'resting', pinned: false, waitingSince: null })) {
          toast.success(`${player.name} 선수가 휴식 상태로 변경되었습니다`);
        }
      } else if (await updatePlayer(id, { status: 'active', waitingSince: new Date().toISOString() })) {
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
    async (attendingIds: string[]) => {
      setPickedPlayers(null);
      if (await setAttendingBulk(attendingIds)) {
        toast.success(`오늘 참석자 ${attendingIds.length}명이 설정되었습니다`);
      }
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
        if (await removeGame(id)) {
          toast.success('게임 기록이 삭제되었습니다');
        }
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
      const [gamesReset, waitingReset] = await Promise.all([resetGames(), resetWaitingTimes()]);
      if (gamesReset && waitingReset) {
        toast.success('게임 기록과 대기 시간이 초기화되었습니다');
      }
    }
  }, [games.length, resetGames, resetWaitingTimes, confirm]);

  const handleResetPlayers = useCallback(async () => {
    if (players.length === 0) {
      toast.error('삭제할 선수가 없습니다');
      return;
    }
    if (
      await confirm({
        title: '게스트로 등록된 선수 전원을 삭제하시겠습니까?',
        description: '로그인 참가자는 유지됩니다',
        confirmText: '삭제',
        variant: 'destructive',
      })
    ) {
      setPickedPlayers(null);
      if (await resetPlayers()) {
        toast.success('게스트 선수 목록이 초기화되었습니다');
      }
    }
  }, [players.length, resetPlayers, confirm]);

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
      setPickedPlayers(null);
      if (await setAttendingBulk([])) {
        toast.success('참석이 모두 해제되었습니다');
      }
    }
  }, [players, setAttendingBulk, confirm]);

  const handleResetWaitingTimes = useCallback(async () => {
    if (!players.some((p) => p.status === 'active')) {
      toast.error('대기 중인 선수가 없습니다');
      return;
    }
    if (
      await confirm({
        title: '대기 중인 선수 전원의 대기 시간을 초기화하시겠습니까?',
        confirmText: '초기화',
      })
    ) {
      if (await resetWaitingTimes()) {
        toast.success('대기 시간이 초기화되었습니다');
      }
    }
  }, [players, resetWaitingTimes, confirm]);

  // 모바일에서 활성 탭이 아닌 섹션은 숨긴다. 데스크톱에서는 flex 아이템이라 max-md로만 숨긴다.
  const mobileOnly = (sections: MobileSection[]) => (sections.includes(mobileTab) ? '' : 'max-md:hidden');

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:flex-1 md:min-h-0">
        {/* 왼쪽: 인원 풀 / 팀 뽑기 탭 전환 — 활성 탭이 컬럼 전체 높이를 쓰고 그 안에서만 스크롤된다 */}
        <Card className={`md:min-h-0 ${mobileOnly(['players', 'pick'])}`}>
          <Tabs
            value={leftTab}
            onValueChange={(v) => {
              setLeftTab(v as 'pool' | 'pick');
              setMobileTab(v === 'pool' ? 'players' : 'pick');
            }}
            className="gap-3 md:flex-1 md:min-h-0"
          >
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-6 max-md:hidden">
              <TabsList className="max-md:hidden">
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
                    <Button
                      size="sm"
                      onClick={handleCustomConfirm}
                      disabled={selectedPlayers.length !== 4 || isSubmittingGame}
                    >
                      {isSubmittingGame ? '대기열에 넣는 중…' : '확정'}
                    </Button>
                    {selectedPlayers.length === 4 && !isEditingCustomPick && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingCustomPick(true)}
                        disabled={isSubmittingGame}
                      >
                        다시 선택
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleCustomCancel} disabled={isSubmittingGame}>
                      취소
                    </Button>
                  </>
                ) : (
                  pickedPlayers && (
                    <>
                      <Button size="sm" onClick={handleConfirmGame} disabled={isSubmittingGame}>
                        {isSubmittingGame ? '대기열에 넣는 중…' : '확정'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleRandomPickTeams} disabled={isSubmittingGame}>
                        다시 뽑기
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartCustomPicking}
                        disabled={isSubmittingGame}
                      >
                        직접 선택
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelPick} disabled={isSubmittingGame}>
                        취소
                      </Button>
                    </>
                  )
                )}
              </div>
            </div>

            <TabsContent value="pool" className="flex-none px-6 pb-6 md:flex md:flex-col md:flex-1 md:min-h-0">
              {/* 선수 등록 (모바일 전용 — PC/태블릿은 카드 헤더에 표시) */}
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
                  isSubmitting={isSubmittingGame}
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
                  onOpenAttendancePicker={() => setIsAttendancePickerOpen(true)}
                  isSubmitting={isSubmittingGame}
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* 오른쪽: 코트 관리 + 대기열 (세로로 쌓임). 대기열이 상대적으로 덜 중요해 기본 접힘 —
            접힌 동안은 코트 관리(flex-1)가 남는 세로 공간을 전부 차지한다 */}
        <div className="flex flex-col gap-3 md:min-h-0 max-md:contents">
          <Card className={`gap-3 md:flex-1 md:min-h-0 ${mobileOnly(['courts'])}`}>
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
                onMoveGame={handleMoveCourtGame}
                highlight={courtArrival.arrival}
              />
            </CardContent>
          </Card>

          <Card className={`gap-3 ${isQueueExpanded ? 'md:flex-1 md:min-h-0' : 'shrink-0'} ${mobileOnly(['queue'])}`}>
            <CardHeader className="shrink-0 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base md:text-lg">
                  대기열
                  {queue.length > 0 && <span className="text-sm text-gray-500 ml-2">({queue.length}개)</span>}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsQueueExpanded((v) => !v)}
                  className="text-xs text-gray-600 max-md:hidden"
                >
                  {isQueueExpanded ? '접기' : `대기 ${queue.length}게임`}
                  {isQueueExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </CardHeader>
            {/* 모바일은 탭 자체가 대기열이라 항상 렌더하고, 데스크톱만 접힘 상태에서 숨긴다 */}
            <CardContent
              className={`pt-0 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade ${isQueueExpanded ? '' : 'md:hidden'}`}
            >
              <GameQueue
                queue={queue}
                courts={courts}
                players={players}
                onAssignCourt={handleAssignQueueToCourt}
                onRemove={handleRemoveFromQueue}
                assigning={assigning}
                highlight={queueArrival.arrival}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={isMoreSheetOpen} onOpenChange={onMoreSheetOpenChange}>
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

      <MobileTabBar
        tabs={[
          { key: 'players', label: '인원', badge: players.filter((p) => p.attending).length },
          { key: 'pick', label: '팀뽑기' },
          { key: 'queue', label: '대기', badge: queue.length },
          {
            key: 'courts',
            label: '코트',
            badge: `${courts.filter((c) => c.playerIds !== null).length}/${courts.length}`,
          },
        ]}
        active={mobileTab}
        onChange={handleMobileTab}
      />
    </div>
  );
}
