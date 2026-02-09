'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useGameManager, Player } from '@/hooks/useGameManager';
import PlayerForm from '@/components/game-manager/PlayerForm';
import PlayerList from '@/components/game-manager/PlayerList';
import PlayerEditModal from '@/components/game-manager/PlayerEditModal';
import TeamPicker from '@/components/game-manager/TeamPicker';
import CustomTeamPicker from '@/components/game-manager/CustomTeamPicker';
import GameHistory from '@/components/game-manager/GameHistory';
import { randomTeamPicker } from '@/utils/smartTeamPicker';

export default function GameManagerPage() {
  const router = useRouter();
  const {
    players,
    games,
    addPlayer,
    removePlayer,
    updatePlayer,
    addGame,
    removeGame,
    resetPlayers,
    resetGames,
    isLoading,
  } = useGameManager();
  const [pickedTeams, setPickedTeams] = useState<{ teamA: [Player, Player]; teamB: [Player, Player] } | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCustomPicking, setIsCustomPicking] = useState(false);

  const playerGameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      [game.teamA[0], game.teamA[1], game.teamB[0], game.teamB[1]].forEach((playerId) => {
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
        // Clear picked teams if the removed player was in them
        if (pickedTeams) {
          const allPickedIds = [...pickedTeams.teamA.map((p) => p.id), ...pickedTeams.teamB.map((p) => p.id)];
          if (allPickedIds.includes(id)) {
            setPickedTeams(null);
          }
        }
      }
    },
    [players, removePlayer, pickedTeams],
  );

  const handleRandomPickTeams = useCallback(() => {
    const activePlayers = players.filter((p) => p.status === 'active');
    if (activePlayers.length < 4) {
      toast.error('최소 4명의 활성 선수가 필요합니다');
      return;
    }

    try {
      const teams = randomTeamPicker(players);
      setPickedTeams(teams);
    } catch (error) {
      console.error('Team picking error:', error);
      toast.error(error instanceof Error ? error.message : '팀을 뽑는데 실패했습니다');
    }
  }, [players]);

  const handleConfirmGame = useCallback(() => {
    if (!pickedTeams) return;

    addGame({
      teamA: [pickedTeams.teamA[0].id, pickedTeams.teamA[1].id],
      teamB: [pickedTeams.teamB[0].id, pickedTeams.teamB[1].id],
    });

    const teamANames = `${pickedTeams.teamA[0].name} & ${pickedTeams.teamA[1].name}`;
    const teamBNames = `${pickedTeams.teamB[0].name} & ${pickedTeams.teamB[1].name}`;

    toast.success('게임이 확정되었습니다!', {
      description: `Team A: ${teamANames} vs Team B: ${teamBNames}`,
      duration: 5000,
    });
    setPickedTeams(null);
    setIsCustomPicking(false);
  }, [pickedTeams, addGame]);

  const handleRejectPick = useCallback(() => {
    // 다시 랜덤 뽑기 실행
    handleRandomPickTeams();
  }, [handleRandomPickTeams]);

  const handleCustomConfirm = useCallback((teamA: [Player, Player], teamB: [Player, Player]) => {
    setPickedTeams({ teamA, teamB });
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
        // Clear picked teams if the player was in them
        if (pickedTeams) {
          const allPickedIds = [...pickedTeams.teamA.map((p) => p.id), ...pickedTeams.teamB.map((p) => p.id)];
          if (allPickedIds.includes(id)) {
            setPickedTeams(null);
          }
        }
      } else {
        toast.success(`${player.name} 선수가 활성 상태로 변경되었습니다`);
      }
    },
    [players, updatePlayer, pickedTeams],
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

      // Clear picked teams when pinned status changes
      if (pickedTeams) {
        setPickedTeams(null);
      }
    },
    [players, updatePlayer, pickedTeams],
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
      setPickedTeams(null);
      toast.success('선수 목록이 초기화되었습니다');
    }
  }, [players.length, resetPlayers, resetGames]);

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
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">선수 등록</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PlayerForm onAddPlayer={handleAddPlayer} />
        </CardContent>
      </Card>

      {/* Section 2: Player List */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">
            등록된 선수 ({players.length}명)
            {players.filter((p) => p.status === 'resting').length > 0 && (
              <span className="text-sm text-gray-500 ml-2">
                (활성: {players.filter((p) => p.status === 'active').length}명)
              </span>
            )}
          </CardTitle>
        </CardHeader>
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
      </Card>

      {/* Section 3: Team Picker */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center justify-between">
            <span>팀 뽑기</span>
            {!pickedTeams && !isCustomPicking && (
              <Button variant="outline" size="sm" onClick={() => setIsCustomPicking(true)}>
                직접 선택
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isCustomPicking ? (
            <CustomTeamPicker
              players={players}
              onConfirm={handleCustomConfirm}
              onCancel={() => setIsCustomPicking(false)}
            />
          ) : (
            <TeamPicker
              players={players}
              games={games}
              pickedTeams={pickedTeams}
              onRandomPick={handleRandomPickTeams}
              onConfirm={handleConfirmGame}
              onReject={handleRejectPick}
            />
          )}
        </CardContent>
      </Card>

      {/* Section 4: Game History & Stats */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">게임 기록 ({games.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <GameHistory games={games} players={players} onRemoveGame={handleRemoveGame} />
        </CardContent>
      </Card>

      {/* Section 5: Reset Actions */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">초기화</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-2">
            <Button onClick={handleResetGames} variant="outline" className="flex-1">
              게임 기록 초기화
            </Button>
            <Button onClick={handleResetPlayers} variant="destructive" className="flex-1">
              선수 목록 초기화
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">⚠️ 초기화는 되돌릴 수 없습니다</p>
        </CardContent>
      </Card>

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
