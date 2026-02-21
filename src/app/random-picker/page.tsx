'use client';

import { useState, useRef, useEffect } from 'react';
import PickerSetup from '@/components/random-picker/PickerSetup';
import TouchCanvas from '@/components/random-picker/TouchCanvas';
import MobileCheck from '@/components/random-picker/MobileCheck';
import { useMultiTouch } from '@/hooks/useMultiTouch';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import CompletionEffect from '@/components/random-picker/CompletionEffect';
import CountdownTimer from '@/components/random-picker/CountdownTimer';
import Header from '@/components/layout/Header';

const COUNTDOWN_DURATION = 3000; // 3초

export default function RandomPickerPage() {
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const touchIdCounterRef = useRef(0);

  const {
    touches,
    countdown,
    winners,
    isComplete,
    reset: resetPicker,
    currentTouchCount,
    setTouches,
  } = useMultiTouch(targetCount || 1);

  const handleStart = (count: number) => {
    setTargetCount(count);
    setIsStarted(true);
  };

  const handleReset = () => {
    resetPicker();
    setIsStarted(false);
    setTargetCount(null);
    touchIdCounterRef.current = 0;
  };

  const handleRestart = () => {
    resetPicker();
    touchIdCounterRef.current = 0;
  };

  // 추첨 완료 시 진동 효과
  useEffect(() => {
    if (isComplete && winners.length > 0) {
      // 진동 효과
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]); // 축하 패턴
      }
    }
  }, [isComplete, winners.length]);

  return (
    <>
      <MobileCheck>
        <div className={`relative w-full h-screen overflow-hidden ${isStarted ? '' : 'mt-8'}`}>
          {!isStarted ? (
            <>
              <Header />
              <PickerSetup onStart={handleStart} />
            </>
          ) : (
            <>
              {/* 카운트다운 타이머 */}
              <AnimatePresence>
                {countdown !== null && <CountdownTimer countdown={countdown} totalDuration={COUNTDOWN_DURATION} />}
              </AnimatePresence>

              {/* 완료 메시지 */}
              <CompletionEffect isComplete={isComplete} />

              {/* 터치 캔버스 */}
              <TouchCanvas
                touches={touches}
                winners={winners}
                targetCount={targetCount || 1}
                currentCount={currentTouchCount}
                isComplete={isComplete}
                setTouches={setTouches}
                touchIdCounter={touchIdCounterRef}
              />

              {/* 하단 컨트롤 버튼 */}
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex gap-3"
              >
                {isComplete ? (
                  <>
                    <Button
                      onClick={handleRestart}
                      className="bg-white text-purple-600 hover:bg-gray-100 shadow-xl px-6 py-3 rounded-full font-bold"
                    >
                      🔄 다시 뽑기
                    </Button>
                    <Button
                      onClick={handleReset}
                      className="bg-white text-gray-600 hover:bg-gray-100 shadow-xl px-6 py-3 rounded-full font-bold"
                    >
                      ⚙️ 설정으로
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl px-6 py-3 rounded-full font-bold"
                  >
                    ⬅️ 처음으로
                  </Button>
                )}
              </motion.div>
            </>
          )}
        </div>
      </MobileCheck>
    </>
  );
}
