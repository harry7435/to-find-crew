'use client';

import { useState } from 'react';
import { Player, GameRecord } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Check, Clock } from 'lucide-react';
import { formatElapsed } from '@/utils/formatElapsed';
import { useTicker } from '@/hooks/useTicker';
import TeamCourtBox from '@/components/game-manager/TeamCourtBox';

type SortOption = 'wait' | 'name' | 'game';

interface CustomTeamPickerProps {
  players: Player[];
  games: GameRecord[];
  selectedPlayers: Player[];
  onSelectedPlayersChange: (players: Player[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** 4명 선택 완료 후 다시 목록으로 돌아가 일부만 바꿀 수 있게 하는 상태.
   *  헤더(PC/태블릿) · 모바일 버튼 둘 다에서 같은 버튼을 노출해야 해서 부모가 소유한다. */
  isEditingSelection: boolean;
  onEditingSelectionChange: (value: boolean) => void;
  /** true면 조상(OrganizerBoard 고정 대시보드)이 md 이상에서 "팀 뽑기" 영역 높이를 확정해준다는 뜻 —
   *  선택 리스트(또는 결과 미리보기)가 그 전체 높이를 채우고 내부에서 스크롤된다.
   *  false(기본값)면 조상이 높이를 주지 않는 일반 페이지(예: /game-manager)이므로
   *  자체 max-height로만 안전하게 스크롤을 제한한다. */
  boundedOnDesktop?: boolean;
}

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

function getGenderColor(gender?: 'male' | 'female'): string {
  if (gender === 'male') return 'text-blue-600';
  if (gender === 'female') return 'text-pink-600';
  return 'text-gray-400';
}

function getGameCount(playerId: string, games: GameRecord[]): number {
  return games.filter((g) => g.players.includes(playerId)).length;
}

export default function CustomTeamPicker({
  players,
  games,
  selectedPlayers,
  onSelectedPlayersChange,
  onConfirm,
  onCancel,
  isEditingSelection,
  onEditingSelectionChange,
  boundedOnDesktop = false,
}: CustomTeamPickerProps) {
  const now = useTicker();
  const [sort, setSort] = useState<SortOption>('wait');

  const activePlayers = [...players.filter((p) => p.status === 'active')].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ko');
    if (sort === 'game') {
      const aCount = getGameCount(a.id, games);
      const bCount = getGameCount(b.id, games);
      if (aCount !== bCount) return aCount - bCount;
      return a.name.localeCompare(b.name, 'ko');
    }
    const aT = a.waitingSince ? new Date(a.waitingSince).getTime() : Number.POSITIVE_INFINITY;
    const bT = b.waitingSince ? new Date(b.waitingSince).getTime() : Number.POSITIVE_INFINITY;
    if (aT !== bT) return aT - bT; // 오래 기다린 순
    return a.name.localeCompare(b.name, 'ko');
  });

  const handleTogglePlayer = (player: Player) => {
    const isSelected = selectedPlayers.find((p) => p.id === player.id);
    if (isSelected) {
      onSelectedPlayersChange(selectedPlayers.filter((p) => p.id !== player.id));
    } else if (selectedPlayers.length < 4) {
      const next = [...selectedPlayers, player];
      onSelectedPlayersChange(next);
      if (next.length === 4) onEditingSelectionChange(false);
    }
  };

  const isComplete = selectedPlayers.length === 4;
  const showList = !isComplete || isEditingSelection;
  const b = boundedOnDesktop;

  return (
    <div className={`flex flex-col gap-3 ${b ? 'md:h-full md:min-h-0' : ''}`}>
      {!showList ? (
        /* 4명 선택 완료 — 랜덤 뽑기 결과와 동일하게 탭해서 자리를 바꾸는 UI로 전환 */
        <div className={`flex flex-col items-center gap-2 ${b ? 'md:flex-1 md:min-h-0 md:justify-center' : ''}`}>
          <div className="w-full max-w-md">
            <TeamCourtBox
              players={selectedPlayers as [Player, Player, Player, Player]}
              size="hero"
              interactive
              onChange={onSelectedPlayersChange}
              showPartnerCounts
              games={games}
            />
            <p className="text-center text-xs text-gray-400 mt-1">선수를 탭한 뒤 다른 선수를 탭하면 자리가 바뀝니다</p>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col border rounded-xl ${b ? 'md:flex-1 md:min-h-0' : ''}`}>
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              활성 선수 선택
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {selectedPlayers.length}/4 선택
              </Badge>
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 font-medium">정렬</span>
              <div className="flex rounded-md border border-gray-200 overflow-hidden">
                {(
                  [
                    ['wait', '대기시간순'],
                    ['name', '가나다순'],
                    ['game', '게임수순'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSort(value)}
                    className={`px-3 py-1.5 transition-colors ${
                      sort === value ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            className={`px-4 pb-3 max-h-[55vh] overflow-y-auto scroll-fade ${b ? 'md:max-h-none md:flex-1 md:min-h-0' : ''}`}
          >
            {activePlayers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">활성 선수가 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {activePlayers.map((player) => {
                  const isSelected = selectedPlayers.find((p) => p.id === player.id);
                  const isPinned = player.pinned === true;
                  const canSelect = selectedPlayers.length < 4 || isSelected;
                  const waitingLabel = formatElapsed(player.waitingSince, now);
                  const genderColor = getGenderColor(player.gender);

                  return (
                    <button
                      key={player.id}
                      onClick={() => handleTogglePlayer(player)}
                      disabled={!canSelect}
                      className={`flex items-center justify-between p-2 border rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300'
                          : canSelect
                            ? 'hover:bg-gray-50 border-gray-200'
                            : 'opacity-50 cursor-not-allowed border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`text-lg ${genderColor}`}>{getGenderIcon(player.gender)}</span>
                        <span className={`font-medium ${genderColor}`}>{player.name}</span>
                        {isPinned && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Star className="h-3 w-3 mr-1 fill-yellow-400" />
                            필수
                          </Badge>
                        )}
                        {player.skillLevel && (
                          <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                        )}
                        {waitingLabel && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Clock className="h-3 w-3 mr-1" />
                            {waitingLabel}
                          </Badge>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons (모바일 전용 — PC/태블릿은 카드 헤더에 표시) */}
      <div className="flex gap-2 justify-center md:hidden">
        <Button onClick={onConfirm} size="lg" disabled={!isComplete} className="flex-1">
          확정
        </Button>
        {isComplete && !isEditingSelection && (
          <Button variant="outline" size="lg" onClick={() => onEditingSelectionChange(true)} className="flex-1">
            다시 선택
          </Button>
        )}
        <Button onClick={onCancel} variant="outline" size="lg" className="flex-1">
          취소
        </Button>
      </div>
    </div>
  );
}
