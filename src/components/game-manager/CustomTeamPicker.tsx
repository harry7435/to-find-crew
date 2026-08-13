'use client';

import { Player, GameRecord } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Check, Clock } from 'lucide-react';
import { formatElapsed } from '@/utils/formatElapsed';
import { useTicker } from '@/hooks/useTicker';
import TeamCourtBox from '@/components/game-manager/TeamCourtBox';

interface CustomTeamPickerProps {
  players: Player[];
  games: GameRecord[];
  selectedPlayers: Player[];
  onSelectedPlayersChange: (players: Player[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** true면 조상(OrganizerBoard 고정 대시보드)이 md 이상에서 "팀 뽑기" 영역 높이를 확정해준다는 뜻 —
   *  선택된 선수/활성 선수 선택 두 섹션이 그 전체 높이를 나눠 채우고 각자 독립적으로 스크롤된다.
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

export default function CustomTeamPicker({
  players,
  games,
  selectedPlayers,
  onSelectedPlayersChange,
  onConfirm,
  onCancel,
  boundedOnDesktop = false,
}: CustomTeamPickerProps) {
  const now = useTicker();
  const activePlayers = [...players.filter((p) => p.status === 'active')].sort((a, b) => {
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
      onSelectedPlayersChange([...selectedPlayers, player]);
    }
  };

  const canConfirm = selectedPlayers.length === 4;
  const b = boundedOnDesktop;

  return (
    <div className={`flex flex-col gap-3 ${b ? 'md:h-full md:min-h-0' : ''}`}>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${b ? 'md:flex-1 md:min-h-0' : ''}`}>
        {/* 선택된 선수 */}
        <Card className={b ? 'md:min-h-0' : ''}>
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base md:text-lg text-blue-800">
              선택된 선수 ({selectedPlayers.length}/4)
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`pt-0 max-h-[30vh] overflow-y-auto scroll-fade ${b ? 'md:max-h-none md:flex-1 md:min-h-0' : ''}`}
          >
            {selectedPlayers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">오른쪽에서 4명을 선택해주세요</p>
            ) : selectedPlayers.length < 4 ? (
              <div className="grid grid-cols-1 gap-2">
                {selectedPlayers.map((player) => {
                  const isPinned = player.pinned === true;
                  const waitingLabel = formatElapsed(player.waitingSince, now);
                  return (
                    <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{getGenderIcon(player.gender)}</span>
                        <span className="font-medium">{player.name}</span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePlayer(player)}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="max-w-xs mx-auto">
                <TeamCourtBox
                  players={selectedPlayers as [Player, Player, Player, Player]}
                  size="full"
                  interactive
                  onChange={onSelectedPlayersChange}
                  showPartnerCounts
                  games={games}
                />
                <p className="text-center text-xs text-gray-400 mt-1">
                  선수를 탭한 뒤 다른 선수를 탭하면 자리가 바뀝니다
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 활성 선수 선택 */}
        <div className={`flex flex-col border rounded-xl ${b ? 'md:min-h-0' : ''}`}>
          <h3 className="shrink-0 text-base md:text-lg font-semibold px-4 pt-3 pb-2">활성 선수 선택</h3>
          <div
            className={`px-4 pb-3 max-h-[45vh] overflow-y-auto scroll-fade ${b ? 'md:max-h-none md:flex-1 md:min-h-0' : ''}`}
          >
            {activePlayers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">활성 선수가 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {activePlayers.map((player) => {
                  const isSelected = selectedPlayers.find((p) => p.id === player.id);
                  const isPinned = player.pinned === true;
                  const canSelect = selectedPlayers.length < 4 || isSelected;
                  const waitingLabel = formatElapsed(player.waitingSince, now);

                  return (
                    <button
                      key={player.id}
                      onClick={() => handleTogglePlayer(player)}
                      disabled={!canSelect}
                      className={`flex items-center justify-between p-2 border rounded text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-100 border-blue-300'
                          : canSelect
                            ? 'hover:bg-gray-50'
                            : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{getGenderIcon(player.gender)}</span>
                        <span className="font-medium">{player.name}</span>
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
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons (모바일 전용 — PC/태블릿은 카드 헤더에 표시) */}
      <div className="flex gap-2 justify-center md:hidden">
        <Button onClick={onConfirm} size="lg" disabled={!canConfirm} className="flex-1">
          확정
        </Button>
        <Button onClick={onCancel} variant="outline" size="lg" className="flex-1">
          취소
        </Button>
      </div>
    </div>
  );
}
