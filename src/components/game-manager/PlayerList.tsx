'use client';

import { useState } from 'react';
import { Player } from '@/hooks/useGameManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Trophy, Edit, Coffee, Play, Star, Swords, Clock, ListChecks } from 'lucide-react';
import { formatElapsed } from '@/utils/formatElapsed';
import { useTicker } from '@/hooks/useTicker';

export type AttendanceFilter = 'all' | 'attending' | 'absent';
type SortOption = 'name' | 'wait' | 'game';

interface PlayerListProps {
  players: Player[];
  onRemovePlayer: (id: string) => void;
  onEditPlayer: (player: Player) => void;
  onToggleStatus: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onToggleAttending: (id: string) => void;
  onOpenAttendancePicker: () => void;
  filter: AttendanceFilter;
  onFilterChange: (filter: AttendanceFilter) => void;
  gameCountsMap?: Map<string, number>;
}

function getSkillLevelColor(level: string): string {
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

function getAgeGroupLabel(ageGroup?: string): string | null {
  if (!ageGroup) return null;
  return ageGroup === '60s+' ? '60대+' : ageGroup.replace('s', '대');
}

export default function PlayerList({
  players,
  onRemovePlayer,
  onEditPlayer,
  onToggleStatus,
  onTogglePinned,
  onToggleAttending,
  onOpenAttendancePicker,
  filter,
  onFilterChange,
  gameCountsMap,
}: PlayerListProps) {
  const now = useTicker();
  const [sort, setSort] = useState<SortOption>('name');

  const attendingCount = players.filter((p) => p.attending).length;
  const absentCount = players.length - attendingCount;
  const waitingCount = players.filter((p) => p.attending && p.status === 'active').length;
  const playingCount = players.filter((p) => p.attending && p.status === 'playing').length;
  const queuedCount = players.filter((p) => p.attending && p.status === 'queued').length;

  const filteredPlayers = players.filter((p) => {
    if (filter === 'attending') return p.attending === true;
    if (filter === 'absent') return !p.attending;
    return true;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (sort === 'wait') {
      const aT = a.waitingSince ? new Date(a.waitingSince).getTime() : Number.POSITIVE_INFINITY;
      const bT = b.waitingSince ? new Date(b.waitingSince).getTime() : Number.POSITIVE_INFINITY;
      if (aT !== bT) return aT - bT;
      return a.name.localeCompare(b.name, 'ko');
    }
    if (sort === 'game') {
      const aCount = gameCountsMap?.get(a.id) || 0;
      const bCount = gameCountsMap?.get(b.id) || 0;
      if (aCount !== bCount) return aCount - bCount;
      return a.name.localeCompare(b.name, 'ko');
    }
    return a.name.localeCompare(b.name, 'ko');
  });

  return (
    <div className="flex flex-col gap-3 md:h-full md:min-h-0">
      {/* 상단 컨트롤 (고정) */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          대기중 <b className="text-blue-600 font-semibold">{waitingCount}명</b>
        </span>
        <span>
          게임중 <b className="text-gray-900 font-semibold">{playingCount}명</b>
        </span>
        {queuedCount > 0 && (
          <span>
            대기열 <b className="text-purple-600 font-semibold">{queuedCount}명</b>
          </span>
        )}
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(['all', 'attending', 'absent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1.5 transition-colors ${
                filter === f ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all'
                ? `전체 ${players.length}`
                : f === 'attending'
                  ? `참석 ${attendingCount}`
                  : `미참석 ${absentCount}`}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={onOpenAttendancePicker} className="text-xs">
          <ListChecks className="h-3.5 w-3.5 mr-1" />
          오늘 참석자 선택
        </Button>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-400 font-medium">정렬</span>
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {(
            [
              ['name', '가나다순'],
              ['wait', '대기시간순'],
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

      {players.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>등록된 선수가 없습니다</p>
          <p className="text-sm mt-2">위 폼에서 선수를 등록해주세요</p>
        </div>
      ) : sortedPlayers.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">해당 조건의 선수가 없습니다</div>
      ) : (
        <div className="flex flex-col gap-2 md:flex-1 md:min-h-0 md:overflow-y-auto scroll-fade">
          {sortedPlayers.map((player) => {
            const gameCount = gameCountsMap?.get(player.id) || 0;
            const ageLabel = getAgeGroupLabel(player.ageGroup);
            const isResting = player.status === 'resting';
            const isPlaying = player.status === 'playing';
            const isQueued = player.status === 'queued';
            const isPinned = player.pinned === true;
            const isAttending = player.attending === true;
            const waitingLabel = player.status === 'active' ? formatElapsed(player.waitingSince, now) : null;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2 border rounded-lg hover:shadow-md transition-shadow ${
                  isPlaying
                    ? 'bg-green-50 border-green-300'
                    : isQueued
                      ? 'bg-purple-50 border-purple-200'
                      : !isAttending
                        ? 'bg-gray-50 opacity-60'
                        : isResting
                          ? 'bg-gray-50 opacity-80'
                          : isPinned
                            ? 'bg-yellow-50 border-yellow-300'
                            : ''
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isAttending}
                    onChange={() => onToggleAttending(player.id)}
                    className="h-4 w-4 shrink-0 accent-blue-600"
                    title={isAttending ? '오늘 참석 해제' : '오늘 참석 체크'}
                  />
                  <span className={`text-xl shrink-0 ${getGenderColor(player.gender)}`}>
                    {getGenderIcon(player.gender)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`font-medium ${
                          !isAttending || isResting ? 'text-gray-500' : getGenderColor(player.gender)
                        }`}
                      >
                        {player.name}
                      </span>
                      {player.skillLevel && (
                        <Badge className={getSkillLevelColor(player.skillLevel)}>{player.skillLevel}</Badge>
                      )}
                      {ageLabel && <Badge variant="outline">{ageLabel}</Badge>}
                      {isPlaying && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          <Swords className="h-3 w-3 mr-1" />
                          게임중
                        </Badge>
                      )}
                      {isQueued && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                          대기열
                        </Badge>
                      )}
                      {isResting && isAttending && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          <Coffee className="h-3 w-3 mr-1" />
                          휴식중
                        </Badge>
                      )}
                      {isPinned && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          <Star className="h-3 w-3 mr-1" />
                          필수 포함
                        </Badge>
                      )}
                      {waitingLabel && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <Clock className="h-3 w-3 mr-1" />
                          {waitingLabel}
                        </Badge>
                      )}
                    </div>
                    {gameCount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                        <Trophy className="h-3 w-3" />
                        <span>{gameCount}게임</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTogglePinned(player.id)}
                    title={isPinned ? '필수 포함 해제' : '필수 포함 설정'}
                    disabled={isResting || isPlaying || isQueued || !isAttending}
                  >
                    <Star className={`h-4 w-4 ${isPinned ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleStatus(player.id)}
                    title={isResting ? '게임 복귀' : '휴식 설정'}
                    disabled={isPlaying || isQueued || !isAttending}
                  >
                    {isResting ? <Play className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditPlayer(player)}
                    disabled={isPlaying || isQueued}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemovePlayer(player.id)}
                    disabled={isPlaying || isQueued}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
