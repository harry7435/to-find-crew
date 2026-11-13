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
  onCancelPick: () => void;
  onReorderPickedPlayers: (next: [Player, Player, Player, Player]) => void;
  /** 활성 선수가 4명 미만인데 미참석 선수가 있을 때 참석자 선택 피커를 연다. 없으면 버튼을 숨긴다. */
  onOpenAttendancePicker?: () => void;
  /** 확정 요청이 진행 중이면 true. 뽑힌 카드를 남겨 둔 채 버튼을 잠가 중복 확정을 막는다. */
  isSubmitting?: boolean;
}

export default function TeamPicker({
  players,
  games,
  pickedPlayers,
  onRandomPick,
  onConfirm,
  onReject,
  onCustomPick,
  onCancelPick,
  onReorderPickedPlayers,
  onOpenAttendancePicker,
  isSubmitting = false,
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
        {!canPick && onOpenAttendancePicker && players.some((p) => !p.attending) && (
          <Button variant="secondary" size="sm" onClick={onOpenAttendancePicker}>
            미참석 {players.filter((p) => !p.attending).length}명 중 참석자 선택
          </Button>
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
                  interactive={!isSubmitting}
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

      {/* 확정 / 다시 뽑기 / 직접 선택 / 취소 (모바일 전용 — PC/태블릿은 카드 헤더에 표시) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex flex-col gap-2 md:hidden"
      >
        <div className="flex gap-3">
          <Button onClick={onConfirm} size="lg" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? '대기열에 넣는 중…' : '확정'}
          </Button>
          <Button onClick={onReject} variant="outline" size="lg" className="flex-1" disabled={isSubmitting}>
            다시 뽑기
          </Button>
        </div>
        <Button variant="outline" size="lg" onClick={onCustomPick} className="w-full" disabled={isSubmitting}>
          직접 선택
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={onCancelPick}
          className="w-full text-gray-500"
          disabled={isSubmitting}
        >
          취소
        </Button>
      </motion.div>
    </div>
  );
}
