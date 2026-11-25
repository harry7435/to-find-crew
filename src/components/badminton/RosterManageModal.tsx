'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Player } from '@/hooks/useGameManager';
import { Edit, MoreVertical, Repeat, Swords, UserPlus, X } from 'lucide-react';

type RosterFilter = 'all' | 'fixed' | 'oneTime' | 'user';

interface RosterManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  onAddPlayerClick: () => void;
  onEditPlayer: (player: Player) => void;
  onRemovePlayer: (id: string) => void;
  onToggleOneTime: (id: string) => void;
  onRemoveOneTimeGuests: () => void;
}

const FILTERS: { key: RosterFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'fixed', label: '고정' },
  { key: 'oneTime', label: '1회성' },
  { key: 'user', label: '로그인' },
];

const EMPTY_MESSAGES: Record<RosterFilter, string> = {
  all: '등록된 선수가 없어요',
  fixed: '고정 선수가 없어요',
  oneTime: '1회성 게스트가 없어요',
  user: '로그인한 참가자가 없어요',
};

function isUser(p: Player): boolean {
  return p.participantType === 'user';
}

function isOneTimeGuest(p: Player): boolean {
  return !isUser(p) && p.isOneTime === true;
}

function isFixed(p: Player): boolean {
  return !isUser(p) && !p.isOneTime;
}

function matches(p: Player, filter: RosterFilter): boolean {
  if (filter === 'fixed') return isFixed(p);
  if (filter === 'oneTime') return isOneTimeGuest(p);
  if (filter === 'user') return isUser(p);
  return true;
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

export default function RosterManageModal({
  isOpen,
  onClose,
  players,
  onAddPlayerClick,
  onEditPlayer,
  onRemovePlayer,
  onToggleOneTime,
  onRemoveOneTimeGuests,
}: RosterManageModalProps) {
  const [filter, setFilter] = useState<RosterFilter>('all');

  const counts: Record<RosterFilter, number> = {
    all: players.length,
    fixed: players.filter(isFixed).length,
    oneTime: players.filter(isOneTimeGuest).length,
    user: players.filter(isUser).length,
  };

  const visible = players.filter((p) => matches(p, filter)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex flex-col gap-0 p-0 h-[85vh] max-h-[85vh] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:max-w-full max-sm:rounded-none sm:max-w-lg">
        <DialogHeader className="shrink-0 px-4 pt-4 pb-3 pr-12">
          <DialogTitle>인원 관리</DialogTitle>
        </DialogHeader>

        <div className="shrink-0 px-4 pb-3">
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`flex-1 px-2 py-1.5 transition-colors ${
                  filter === key ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label} {counts[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border-y divide-y">
          {visible.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500">{EMPTY_MESSAGES[filter]}</div>
          ) : (
            visible.map((p) => {
              const busy = p.status === 'playing' || p.status === 'queued';
              const user = isUser(p);
              return (
                <div key={p.id} className="flex items-center gap-2 pl-4 pr-2 py-2">
                  <div className="flex flex-1 min-w-0 items-center gap-1.5 flex-wrap">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className={`shrink-0 ${getGenderColor(p.gender)}`}>{getGenderIcon(p.gender)}</span>
                    {p.skillLevel && <Badge className={getSkillLevelColor(p.skillLevel)}>{p.skillLevel}</Badge>}
                    {user ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        로그인
                      </Badge>
                    ) : p.isOneTime ? (
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                        1회성
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-white text-gray-600 border-gray-300">
                        고정
                      </Badge>
                    )}
                    {p.status === 'playing' && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        <Swords className="h-3 w-3 mr-1" />
                        게임중
                      </Badge>
                    )}
                    {p.status === 'queued' && (
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                        대기열
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" title="더보기">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditPlayer(p)} disabled={busy}>
                        <Edit className="h-4 w-4" />
                        수정
                      </DropdownMenuItem>
                      {!user && (
                        <DropdownMenuItem onClick={() => onToggleOneTime(p.id)}>
                          <Repeat className="h-4 w-4" />
                          {p.isOneTime ? '고정으로 바꾸기' : '1회성으로 바꾸기'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem variant="destructive" onClick={() => onRemovePlayer(p.id)} disabled={busy}>
                        <X className="h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-2 p-4 sm:flex-row sm:justify-between">
          <Button variant="outline" size="sm" onClick={onAddPlayerClick}>
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            선수 등록
          </Button>
          <Button variant="destructive" size="sm" onClick={onRemoveOneTimeGuests} disabled={counts.oneTime === 0}>
            1회성 게스트 {counts.oneTime}명 삭제
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
