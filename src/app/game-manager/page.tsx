'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useGameManager, Player } from '@/hooks/useGameManager';
import PlayerForm from '@/components/game-manager/PlayerForm';
import PlayerList from '@/components/game-manager/PlayerList';
import PlayerEditModal from '@/components/game-manager/PlayerEditModal';
import TeamPicker from '@/components/game-manager/TeamPicker';
import CustomTeamPicker from '@/components/game-manager/CustomTeamPicker';
import GameHistory from '@/components/game-manager/GameHistory';
import CourtManager from '@/components/game-manager/CourtManager';
import { randomTeamPicker } from '@/utils/smartTeamPicker';

export default function GameManagerPage() {
  const router = useRouter();
  const {
    players,
    games,
    courts,
    addPlayer,
    removePlayer,
    updatePlayer,
    addGame,
    removeGame,
    resetPlayers,
    resetGames,
    addCourt,
    removeCourt,
    renameCourt,
    assignCourtGame,
    endCourtGame,
    isLoading,
  } = useGameManager();
  const [pickedPlayers, setPickedPlayers] = useState<[Player, Player, Player, Player] | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCustomPicking, setIsCustomPicking] = useState(false);
  const [isSelectingCourt, setIsSelectingCourt] = useState(false);
  const [openSections, setOpenSections] = useState({
    registration: false,
    playerList: true,
    teamPicker: true,
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
    (playerData: Omit<Player, 'id' | 'status'>) => {
      addPlayer(playerData);
      toast.success(`${playerData.name} 선수가 등록되었습니다`);
    },
    [addPlayer],
  );

  const handleRemovePlayer = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (player && confirm(`${player.name} 선수를 삭제하시겠습니까?`)) {
        removePlayer(id);
        toast.success('선수가 삭제되었습니다');
        // Clear picked players if the removed player was in them
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

    if (courts.length === 0) {
      toast.error('코트를 먼저 추가해주세요');
      return;
    }

    const freeCourts = courts.filter((c) => c.playerIds === null);
    if (freeCourts.length === 0) {
      toast.error('모든 코트가 사용중입니다. 게임을 종료하거나 코트를 추가하세요');
      return;
    }

    setIsSelectingCourt(true);
  }, [pickedPlayers, courts]);

  const handleAssignCourt = useCallback(
    (courtId: string) => {
      if (!pickedPlayers) return;

      const playerIds = pickedPlayers.map((p) => p.id) as [string, string, string, string];
      addGame({ players: playerIds });
      assignCourtGame(courtId, playerIds);

      const court = courts.find((c) => c.id === courtId);
      const playerNames = pickedPlayers.map((p) => p.name).join(', ');

      toast.success(`${court?.name ?? '코트'}에 배정되었습니다!`, {
        description: `선수: ${playerNames}`,
        duration: 5000,
      });
      setPickedPlayers(null);
      setIsSelectingCourt(false);
      setIsCustomPicking(false);
    },
    [pickedPlayers, courts, addGame, assignCourtGame],
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

  const handleRejectPick = useCallback(() => {
    // 다시 랜덤 뽑기 실행
    handleRandomPickTeams();
  }, [handleRandomPickTeams]);

  const handleCustomConfirm = useCallback((players: [Player, Player, Player, Player]) => {
    setPickedPlayers(players);
    setIsCustomPicking(false);
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
      updatePlayer(id, { status: newStatus });

      if (newStatus === 'resting') {
        // 휴식 상태로 변경하면 필수 포함도 해제
        updatePlayer(id, { pinned: false });
        toast.success(`${player.name} 선수가 휴식 상태로 변경되었습니다`);
        // Clear picked players if the player was in them
        if (pickedPlayers) {
          const allPickedIds = pickedPlayers.map((p) => p.id);
          if (allPickedIds.includes(id)) {
            setPickedPlayers(null);
          }
        }
      } else {
        toast.success(`${player.name} 선수가 활성 상태로 변경되었습니다`);
      }
    },
    [players, updatePlayer, pickedPlayers],
  );

  const handleTogglePinned = useCallback(
    (id: string) => {
      const player = players.find((p) => p.id === id);
      if (!player) return;

      // 휴식중인 선수는 필수 포함 불가
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

      // Clear picked players when pinned status changes
      if (pickedPlayers) {
        setPickedPlayers(null);
      }
    },
    [players, updatePlayer, pickedPlayers],
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

    const hasRestingPlayers = players.some((p) => p.status === 'resting');
    const hasPinnedPlayers = players.some((p) => p.pinned === true);

    if (!hasRestingPlayers && !hasPinnedPlayers) {
      toast.error('휴식중이거나 필수 포함된 선수가 없습니다');
      return;
    }

    if (confirm('모든 선수의 휴식 상태와 필수 포함을 해제하시겠습니까?')) {
      players.forEach((player) => {
        if (player.status === 'resting' || player.pinned === true) {
          updatePlayer(player.id, { status: 'active', pinned: false });
        }
      });
      setPickedPlayers(null);
      toast.success('선수 상태가 초기화되었습니다');
    }
  }, [players, updatePlayer]);

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
                  등록된 선수 ({players.length}명)
                  {(players.some((p) => p.status === 'resting') || players.some((p) => p.status === 'playing')) && (
                    <span className="text-sm text-gray-500 ml-2">
                      (활성: {players.filter((p) => p.status === 'active').length}명
                      {players.some((p) => p.status === 'playing') && (
                        <> · 게임중: {players.filter((p) => p.status === 'playing').length}명</>
                      )}
                      )
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
                  onReject={handleRejectPick}
                  onCustomPick={() => setIsCustomPicking(true)}
                />
              )}

              {/* 코트 선택 패널 */}
              {isSelectingCourt && pickedPlayers && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">배정할 코트를 선택하세요</p>
                  <div className="flex flex-wrap gap-2">
                    {courts
                      .filter((c) => c.playerIds === null)
                      .map((court) => (
                        <Button key={court.id} onClick={() => handleAssignCourt(court.id)} size="sm">
                          {court.name}
                        </Button>
                      ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSelectingCourt(false)}
                    className="mt-2 w-full text-gray-500"
                  >
                    취소
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 3.5: Court Manager */}
      <Collapsible open={openSections.courtManager} onOpenChange={() => toggleSection('courtManager')}>
        <Card className="mb-3">
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
                onAddCourt={handleAddCourt}
                onRemoveCourt={handleRemoveCourt}
                onRenameCourt={handleRenameCourt}
                onEndGame={handleEndCourtGame}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 4: Game History & Stats */}
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

      {/* Section 5: Reset Actions */}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button onClick={handleResetPlayerStates} variant="secondary" className="flex-1">
                  선수 상태 초기화
                </Button>
                <Button onClick={handleResetGames} variant="outline" className="flex-1">
                  게임 기록 초기화
                </Button>
                <Button onClick={handleResetPlayers} variant="destructive" className="flex-1">
                  선수 목록 초기화
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ 선수 상태 초기화: 모든 휴식·필수포함 해제 | 게임/선수 초기화: 되돌릴 수 없음
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
    </div>
  );
}
