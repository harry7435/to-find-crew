'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Player } from '@/hooks/useGameManager';
import { Check, Search } from 'lucide-react';

interface AttendancePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  onConfirm: (attendingIds: string[]) => void;
}

function getSkillColor(level?: string): string {
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

export default function AttendancePickerModal({ isOpen, onClose, players, onConfirm }: AttendancePickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(players.filter((p) => p.attending).map((p) => p.id)));
      setSearch('');
    }
  }, [isOpen, players]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [players, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((p) => p.id)));
  };

  const deselectAll = () => {
    const keepIds = new Set(
      players.filter((p) => !filtered.some((f) => f.id === p.id) && selectedIds.has(p.id)).map((p) => p.id),
    );
    setSelectedIds(keepIds);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>오늘 참석자 선택 ({selectedIds.size}명)</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 검색"
              className="pl-8 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
            전체 선택
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs">
            해제
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md divide-y">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">선수가 없습니다</div>
          ) : (
            filtered.map((p) => {
              const selected = selectedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                    selected ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="h-4 w-4 accent-blue-600 shrink-0 pointer-events-none"
                    />
                    <span className="text-lg shrink-0">{getGenderIcon(p.gender)}</span>
                    <span className="font-medium truncate">{p.name}</span>
                    {p.skillLevel && <Badge className={getSkillColor(p.skillLevel)}>{p.skillLevel}</Badge>}
                  </div>
                  {selected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button type="button" onClick={handleConfirm} className="flex-1">
            확정 ({selectedIds.size}명)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
