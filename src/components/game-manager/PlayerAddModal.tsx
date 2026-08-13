'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Player } from '@/hooks/useGameManager';
import PlayerForm from '@/components/game-manager/PlayerForm';

interface PlayerAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (player: Omit<Player, 'id' | 'status' | 'attending' | 'waitingSince'>) => void;
}

export default function PlayerAddModal({ isOpen, onClose, onAddPlayer }: PlayerAddModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>선수 등록</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">등록해도 창이 닫히지 않으니 여러 명을 연달아 등록할 수 있습니다</p>
        <PlayerForm onAddPlayer={onAddPlayer} />
      </DialogContent>
    </Dialog>
  );
}
