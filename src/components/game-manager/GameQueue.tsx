'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueueItem, Court, Player } from '@/hooks/useGameManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, X, Play } from 'lucide-react';
import { formatElapsed } from '@/utils/formatElapsed';
import { useTicker } from '@/hooks/useTicker';
import TeamCourtBox from '@/components/game-manager/TeamCourtBox';
import { Arrival, scrollToArrival } from '@/hooks/useArrivalHighlight';

interface GameQueueProps {
  queue: QueueItem[];
  courts: Court[];
  players: Player[];
  onAssignCourt: (queueItemId: string, courtId: string) => void;
  onRemove: (queueItemId: string) => void;
  /** 배정 요청이 진행 중인 (대기열 항목, 코트). 그 항목의 버튼을 잠그고 누른 버튼만 "배정 중…"으로 표시한다. */
  assigning?: { queueItemId: string; courtId: string } | null;
  /** 방금 내 확정으로 들어온 항목. 해당 항목을 강조하고 화면에 보이게 스크롤한다. */
  highlight?: Arrival | null;
}

const UNKNOWN_PLAYER: Player = { id: 'unknown', name: '알 수 없음', status: 'active' };

export default function GameQueue({
  queue,
  courts,
  players,
  onAssignCourt,
  onRemove,
  assigning = null,
  highlight = null,
}: GameQueueProps) {
  const now = useTicker();
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (highlight) scrollToArrival(itemRefs.current.get(highlight.id) ?? null);
  }, [highlight]);
  const freeCourts = courts.filter((c) => c.playerIds === null);

  const getPlayer = (id: string): Player => players.find((p) => p.id === id) ?? { ...UNKNOWN_PLAYER, id };

  // 마지막 항목의 exit 애니메이션이 재생되도록 AnimatePresence는 항상 마운트해 둔다 (빈 상태 조기 return 금지)
  return (
    <div>
      {queue.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">대기 중인 게임이 없습니다</p>
          <p className="text-xs mt-1">팀 뽑기에서 4명을 확정하면 여기에 쌓입니다</p>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        <AnimatePresence initial={false}>
          {queue.map((item, idx) => {
            const waitingLabel = formatElapsed(item.queuedAt, now);
            const isHighlighted = highlight?.id === item.id;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
                ref={(el: HTMLDivElement | null) => {
                  if (el) itemRefs.current.set(item.id, el);
                  else itemRefs.current.delete(item.id);
                }}
                // 도착 강조 scrollIntoView가 고정 헤더·하단 바 밑으로 가지 않도록 스크롤 여백을 둔다
                className={`scroll-mt-20 max-md:scroll-mb-[calc(5rem+env(safe-area-inset-bottom))] border rounded-lg p-3 transition-shadow ${
                  isHighlighted ? 'relative border-amber-400 bg-amber-50' : 'border-purple-200 bg-purple-50'
                }`}
              >
                {isHighlighted && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-amber-400 motion-safe:animate-pulse"
                  />
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-600 text-white font-bold text-xs">
                      {idx + 1}
                    </span>
                    {waitingLabel && (
                      <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {waitingLabel}
                      </Badge>
                    )}
                    {isHighlighted && <Badge className="bg-amber-500 text-white text-xs">{highlight?.label}</Badge>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(item.id)}
                    disabled={assigning?.queueItemId === item.id}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                    title="대기 취소"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mb-2">
                  <TeamCourtBox
                    players={item.playerIds.map(getPlayer) as [Player, Player, Player, Player]}
                    size="compact"
                  />
                </div>
                {freeCourts.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-1">
                    빈 코트가 없습니다. 게임 종료 또는 코트 추가 필요
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {freeCourts.map((court) => {
                      const isItemAssigning = assigning?.queueItemId === item.id;
                      const isThisButton = isItemAssigning && assigning?.courtId === court.id;
                      return (
                        <Button
                          key={court.id}
                          size="sm"
                          onClick={() => onAssignCourt(item.id, court.id)}
                          className="h-7 text-xs"
                          disabled={assigning !== null}
                        >
                          {isThisButton ? (
                            '배정 중…'
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1 fill-current" />
                              {court.name}
                            </>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
