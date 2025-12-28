'use client';

import { useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TouchPoint as TouchPointType } from '@/hooks/useMultiTouch';
import TouchPoint from './TouchPoint';

interface TouchCanvasProps {
  touches: TouchPointType[];
  winners: TouchPointType[];
  targetCount: number;
  currentCount: number;
  isComplete: boolean;
  setTouches: React.Dispatch<React.SetStateAction<TouchPointType[]>>;
  touchIdCounter: React.MutableRefObject<number>;
}

// 동적으로 색깔 인덱스 할당 (무한대 지원)
const getAvailableColorIndex = (existingTouches: TouchPointType[]): number => {
  const usedColors = new Set(existingTouches.map((t) => t.colorIndex));

  // 0부터 순차적으로 사용되지 않은 인덱스 찾기
  let colorIndex = 0;
  while (usedColors.has(colorIndex)) {
    colorIndex++;
  }

  return colorIndex;
};

export default function TouchCanvas({
  touches,
  winners,
  targetCount,
  currentCount,
  isComplete,
  setTouches,
  touchIdCounter,
}: TouchCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // useEffect로 직접 이벤트 리스너 등록 (passive: false 옵션 필요)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 햅틱 피드백 함수
    const triggerHaptic = () => {
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isComplete) return;
      e.preventDefault();
      triggerHaptic();

      const rect = canvas.getBoundingClientRect();

      setTouches((prevTouches) => {
        const newTouches: TouchPointType[] = [];

        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          // 기존 터치를 찾아서 유지
          const existingTouch = prevTouches.find((t) => t.identifier === touch.identifier);

          if (existingTouch) {
            // 기존 터치는 ID와 색깔 유지, 위치만 업데이트
            newTouches.push({
              ...existingTouch,
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
            });
          } else {
            // 새 터치: 사용 가능한 색깔 할당
            const colorIndex = getAvailableColorIndex(newTouches);
            newTouches.push({
              id: touchIdCounter.current++,
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
              timestamp: Date.now(),
              identifier: touch.identifier,
              colorIndex,
            });
          }
        }

        return newTouches;
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isComplete) return;
      e.preventDefault();

      // touchMove에서는 위치만 업데이트 (터치 수는 변경하지 않음)
      // 이렇게 하면 불필요한 리렌더와 useEffect 트리거를 방지
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isComplete) return;
      e.preventDefault();
      triggerHaptic();

      const rect = canvas.getBoundingClientRect();

      setTouches((prevTouches) => {
        const remainingTouches: TouchPointType[] = [];

        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          // 기존 터치를 찾아서 유지
          const existingTouch = prevTouches.find((t) => t.identifier === touch.identifier);

          if (existingTouch) {
            // 기존 터치는 ID와 색깔 유지, 위치만 업데이트
            remainingTouches.push({
              ...existingTouch,
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
            });
          } else {
            // 새 터치 (거의 발생하지 않지만 안전장치)
            const colorIndex = getAvailableColorIndex(remainingTouches);
            remainingTouches.push({
              id: touchIdCounter.current++,
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
              timestamp: Date.now(),
              identifier: touch.identifier,
              colorIndex,
            });
          }
        }

        return remainingTouches;
      });
    };

    // passive: false 옵션으로 이벤트 리스너 등록
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 touch-none select-none overflow-hidden"
      style={{
        minHeight: '100dvh', // 모바일 브라우저 주소창 고려
      }}
    >
      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 bg-purple-500 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-32 h-32 bg-pink-500 rounded-full blur-xl animate-pulse delay-100" />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-blue-500 rounded-full blur-xl animate-pulse delay-200" />
      </div>

      {/* 상단 정보 바 */}
      {!isComplete && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg z-40">
          <p className="text-center font-bold text-gray-800">
            <span className={`text-3xl ${currentCount > targetCount ? 'text-green-500' : 'text-purple-600'}`}>
              {currentCount}
            </span>
            <span className="text-gray-400 mx-2">/</span>
            <span className="text-2xl text-gray-600">{targetCount}</span>
            <span className="text-sm text-gray-500 ml-2">명</span>
          </p>
        </div>
      )}

      {/* 중앙 안내 메시지 */}
      {!isComplete && currentCount === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl">
            <p className="text-6xl mb-4 animate-bounce">👆</p>
            <p className="text-xl font-bold text-gray-800 mb-2">화면을 터치하세요!</p>
            <p className="text-sm text-gray-600">{targetCount + 1}명 이상이 터치하면 추첨 시작</p>
          </div>
        </div>
      )}

      {/* 터치 포인트들 */}
      <AnimatePresence>
        {(isComplete ? winners : touches).map((touch, index) => (
          <TouchPoint
            key={touch.id}
            x={touch.x}
            y={touch.y}
            index={index}
            colorIndex={touch.colorIndex}
            isWinner={isComplete}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
