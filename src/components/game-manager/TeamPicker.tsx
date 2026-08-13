'use client';

import { Player, GameRecord } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import TeamCourtBox from '@/components/game-manager/TeamCourtBox';

interface TeamPickerProps {
  players: Player[];
  games: GameRecord[];
  pickedPlayers: [Player, Player, Player, Player] | null;
  onRandomPick: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCustomPick: () => void;
  onReorderPickedPlayers: (next: [Player, Player, Player, Player]) => void;
}

export default function TeamPicker({
  players,
  games,
  pickedPlayers,
  onRandomPick,
  onConfirm,
  onReject,
  onCustomPick,
  onReorderPickedPlayers,
}: TeamPickerProps) {
  const activePlayers = players.filter((p) => p.status === 'active');
  const canPick = activePlayers.length >= 4;

  if (!pickedPlayers) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 md:flex-1 md:min-h-0">
        <Button onClick={onRandomPick} disabled={!canPick} size="lg" className="w-full max-w-xs">
          랜덤 뽑기 🎲
        </Button>
        {!canPick && (
          <p className="text-sm text-gray-500">최소 4명의 활성 선수가 필요합니다 (현재: {activePlayers.length}명)</p>
        )}
        <Button variant="outline" size="lg" onClick={onCustomPick} className="w-full max-w-xs">
          직접 선택
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:flex-1 md:min-h-0 md:justify-center">
      {/* 뽑힌 팀 미리보기 */}
      <div className="max-h-[45vh] overflow-y-auto scroll-fade">
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <TeamCourtBox
                  players={pickedPlayers}
                  size="hero"
                  interactive
                  onChange={onReorderPickedPlayers}
                  showPartnerCounts
                  games={games}
                />
                <p className="text-center text-xs text-gray-400 mt-1">
                  선수를 탭한 뒤 다른 선수를 탭하면 자리가 바뀝니다
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 확정 / 다시 뽑기 / 직접 선택 (모바일 전용 — PC/태블릿은 카드 헤더에 표시) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex flex-col gap-2 md:hidden"
      >
        <div className="flex gap-3">
          <Button onClick={onConfirm} size="lg" className="flex-1">
            확정
          </Button>
          <Button onClick={onReject} variant="outline" size="lg" className="flex-1">
            다시 뽑기
          </Button>
        </div>
        <Button variant="outline" size="lg" onClick={onCustomPick} className="w-full">
          직접 선택
        </Button>
      </motion.div>
    </div>
  );
}
