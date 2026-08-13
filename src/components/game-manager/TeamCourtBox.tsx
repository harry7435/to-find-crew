'use client';

import { useState } from 'react';
import { Player, GameRecord } from '@/hooks/useGameManager';
import { Badge } from '@/components/ui/badge';
import { Star, Trophy } from 'lucide-react';

type FourPlayers = [Player, Player, Player, Player];
type BoxSize = 'compact' | 'full' | 'hero';

interface TeamCourtBoxProps {
  /** 0,1 = 팀 A(왼쪽) · 2,3 = 팀 B(오른쪽) */
  players: FourPlayers;
  /** compact: 대기열·코트관리·관전자보드. full: 직접 선택 미리보기. hero: 자동 뽑기 결과(더 크게 강조). */
  size?: BoxSize;
  interactive?: boolean;
  onChange?: (next: FourPlayers) => void;
  showPartnerCounts?: boolean;
  games?: GameRecord[];
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

function getPartnerCount(a: Player, b: Player, games: GameRecord[]): number {
  return games.filter((g) => g.players.includes(a.id) && g.players.includes(b.id)).length;
}

function getGameCount(player: Player, games: GameRecord[]): number {
  return games.filter((g) => g.players.includes(player.id)).length;
}

function PlayerChip({
  player,
  size,
  side,
  selected,
  interactive,
  gameCount,
  onClick,
}: {
  player: Player;
  size: BoxSize;
  side: 'a' | 'b';
  selected: boolean;
  interactive: boolean;
  gameCount?: number;
  onClick: () => void;
}) {
  const isDetailed = size !== 'compact';
  const isHero = size === 'hero';
  const sideBorder = side === 'a' ? 'border-blue-200' : 'border-violet-200';
  const genderColor = getGenderColor(player.gender);

  const content = (
    <>
      <div className={`flex items-center justify-center min-w-0 ${isHero ? 'gap-1.5' : 'gap-1'}`}>
        {isDetailed && (
          <span className={`shrink-0 ${genderColor} ${isHero ? 'text-lg' : 'text-sm'}`}>
            {getGenderIcon(player.gender)}
          </span>
        )}
        <span
          className={`font-medium truncate ${genderColor} ${isHero ? 'text-base font-semibold' : isDetailed ? 'text-sm' : 'text-xs'}`}
        >
          {player.name}
        </span>
        {isDetailed && player.pinned && (
          <Star className={`shrink-0 fill-yellow-400 text-yellow-400 ${isHero ? 'h-4 w-4' : 'h-3 w-3'}`} />
        )}
        {isDetailed && player.skillLevel && (
          <Badge
            className={`shrink-0 ${getSkillLevelColor(player.skillLevel)} ${isHero ? 'text-xs px-1.5 py-0' : 'text-[10px] px-1 py-0'}`}
          >
            {player.skillLevel}
          </Badge>
        )}
      </div>
      {isDetailed && gameCount !== undefined && (
        <div
          className={`flex items-center justify-center text-gray-500 ${isHero ? 'gap-1 text-xs' : 'gap-0.5 text-[10px]'}`}
        >
          <Trophy className={isHero ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
          <span>{gameCount}게임</span>
        </div>
      )}
    </>
  );

  const className = `flex flex-col items-center justify-center rounded-lg border w-full min-w-0 text-center transition-colors ${
    isHero ? 'gap-1 py-3.5 px-3' : isDetailed ? 'gap-0.5 py-2 px-2' : 'gap-0.5 py-1 px-1.5'
  } ${
    selected ? 'border-blue-400 ring-2 ring-blue-400 bg-blue-50' : `${sideBorder} bg-white`
  } ${interactive ? 'cursor-pointer hover:bg-blue-50' : ''}`;

  if (!interactive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export default function TeamCourtBox({
  players,
  size = 'compact',
  interactive = false,
  onChange,
  showPartnerCounts = false,
  games = [],
}: TeamCourtBoxProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleTap = (index: number) => {
    if (!interactive || !onChange) return;
    if (selectedIndex === null) {
      setSelectedIndex(index);
      return;
    }
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }
    const next = [...players] as FourPlayers;
    [next[selectedIndex], next[index]] = [next[index], next[selectedIndex]];
    onChange(next);
    setSelectedIndex(null);
  };

  const partnerLabel = (count: number) => (count === 0 ? '첫 조합' : `${count}회 조합`);
  const isHero = size === 'hero';
  const padding = isHero ? 'p-3' : size === 'full' ? 'p-2' : 'p-1.5';

  const renderSide = (indices: [number, number], side: 'a' | 'b') => (
    <div className={`flex-1 min-w-0 ${padding} ${side === 'a' ? 'bg-blue-50' : 'bg-violet-50'}`}>
      <div className={`flex flex-col ${isHero ? 'gap-2' : 'gap-1'}`}>
        {indices.map((i) => (
          <PlayerChip
            key={players[i].id}
            player={players[i]}
            size={size}
            side={side}
            selected={selectedIndex === i}
            interactive={interactive}
            gameCount={size !== 'compact' ? getGameCount(players[i], games) : undefined}
            onClick={() => handleTap(i)}
          />
        ))}
      </div>
      {showPartnerCounts && (
        <p className={`text-center text-gray-500 ${isHero ? 'text-xs mt-2' : 'text-[10px] mt-1'}`}>
          {partnerLabel(getPartnerCount(players[indices[0]], players[indices[1]], games))}
        </p>
      )}
    </div>
  );

  return (
    <div className={`border overflow-hidden flex ${isHero ? 'rounded-xl' : 'rounded-lg'}`}>
      {renderSide([0, 1], 'a')}
      <div className={`w-0 border-dashed border-gray-300 ${isHero ? 'border-l-[3px]' : 'border-l-2'}`} />
      {renderSide([2, 3], 'b')}
    </div>
  );
}
