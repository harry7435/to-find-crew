'use client';

import { useState, useRef, useEffect } from 'react';
import { Court, Player } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Square, Pencil, Check } from 'lucide-react';

interface CourtManagerProps {
  courts: Court[];
  players: Player[];
  onAddCourt: (name: string) => void;
  onRemoveCourt: (id: string) => void;
  onRenameCourt: (id: string, name: string) => void;
  onEndGame: (id: string) => void;
}

export default function CourtManager({
  courts,
  players,
  onAddCourt,
  onRemoveCourt,
  onRenameCourt,
  onEndGame,
}: CourtManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addingName, setAddingName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const getPlayerName = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.name ?? '알 수 없음';
  };

  const handleStartAdding = () => {
    setAddingName(`코트 ${courts.length + 1}`);
    setIsAdding(true);
  };

  const handleConfirmAdd = () => {
    const name = addingName.trim();
    if (!name) return;
    onAddCourt(name);
    setIsAdding(false);
    setAddingName('');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setAddingName('');
  };

  const handleStartEdit = (court: Court) => {
    setEditingId(court.id);
    setEditingName(court.name);
  };

  const handleConfirmEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) onRenameCourt(editingId, name);
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="space-y-2">
      {courts.length === 0 && !isAdding && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">등록된 코트가 없습니다</p>
          <p className="text-xs mt-1">코트를 추가하면 게임 배정이 가능합니다</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {courts.map((court) => {
          const isActive = court.playerIds !== null;
          const isEditing = editingId === court.id;

          return (
            <div
              key={court.id}
              className={`border rounded-lg p-3 ${
                isActive ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Square className={`h-4 w-4 shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Input
                        ref={editInputRef}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="h-6 text-sm py-0 px-2 flex-1 min-w-0"
                      />
                      <Button variant="ghost" size="sm" onClick={handleConfirmEdit} className="h-6 w-6 p-0 shrink-0">
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-6 w-6 p-0 shrink-0">
                        <X className="h-3 w-3 text-gray-400" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-sm truncate">{court.name}</span>
                      {isActive ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs shrink-0">게임중</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 text-xs shrink-0">
                          대기중
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                {!isActive && !isEditing && (
                  <div className="flex gap-1 shrink-0 ml-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(court)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500"
                      title="이름 수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveCourt(court.id)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                      title="코트 삭제"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {isActive && court.playerIds ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    {court.playerIds.map((playerId) => (
                      <span
                        key={playerId}
                        className="text-xs bg-white border border-green-200 rounded px-2 py-1 text-center truncate"
                      >
                        {getPlayerName(playerId)}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onEndGame(court.id)}
                    className="w-full mt-2 h-7 text-xs"
                  >
                    게임 종료
                  </Button>
                </div>
              ) : (
                !isEditing && <p className="text-xs text-gray-400 text-center py-1">비어있음</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 코트 추가 입력 */}
      {isAdding ? (
        <div className="flex items-center gap-2 p-2 border border-blue-200 rounded-lg bg-blue-50">
          <Input
            ref={addInputRef}
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmAdd();
              if (e.key === 'Escape') handleCancelAdd();
            }}
            placeholder="코트 이름 입력"
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" onClick={handleConfirmAdd} disabled={!addingName.trim()} className="h-8 shrink-0">
            추가
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelAdd} className="h-8 shrink-0">
            취소
          </Button>
        </div>
      ) : (
        <Button onClick={handleStartAdding} variant="outline" className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          코트 추가
        </Button>
      )}
    </div>
  );
}
