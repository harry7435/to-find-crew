'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PickerSetupProps {
  onStart: (targetCount: number) => void;
}

const DEFAULT_MIN_COUNT = 1;
const DEFAULT_MAX_COUNT = 100; // 최대 100명까지 지원

export default function PickerSetup({ onStart }: PickerSetupProps) {
  const [targetCount, setTargetCount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [viewportHeight, setViewportHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 초기 viewport 높이 측정 및 고정
  useEffect(() => {
    const setInitialHeight = () => {
      const height = window.innerHeight;
      setViewportHeight(height);

      // CSS 변수로도 설정 (옵션)
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    };

    setInitialHeight();

    // 초기 로드 후에는 resize 이벤트를 무시 (키보드 방지)
    // 필요한 경우 orientationchange만 감지
    const handleOrientationChange = () => {
      setTimeout(setInitialHeight, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const handleStart = () => {
    const count = parseInt(targetCount, 10);

    if (isNaN(count)) {
      setError('숫자를 입력해주세요');
      return;
    }

    if (count < DEFAULT_MIN_COUNT) {
      setError(`최소 ${DEFAULT_MIN_COUNT}명 이상이어야 합니다`);
      return;
    }

    if (count > DEFAULT_MAX_COUNT) {
      setError(`최대 ${DEFAULT_MAX_COUNT}명까지 가능합니다`);
      return;
    }

    setError('');
    onStart(count);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 overflow-y-auto"
      style={{
        height: viewportHeight > 0 ? `${viewportHeight}px` : '100vh',
      }}
    >
      <div className="min-h-full p-6 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md my-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">🎲 랜덤 뽑기</h1>
            <p className="text-sm sm:text-base text-gray-600">재미있는 랜덤 추첨을 시작해보세요!</p>
          </div>

          <div className="space-y-5">
            <div>
              <Label htmlFor="targetCount" className="text-base sm:text-lg font-semibold text-gray-700">
                뽑을 사람 수
              </Label>
              <Input
                id="targetCount"
                type="number"
                inputMode="numeric"
                min={DEFAULT_MIN_COUNT}
                max={DEFAULT_MAX_COUNT}
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-2 text-xl sm:text-2xl text-center font-bold h-14 sm:h-16"
                placeholder="인원 수 입력"
              />
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              <p className="text-gray-500 text-xs sm:text-sm mt-2">최소 {DEFAULT_MIN_COUNT}명부터 입력 가능</p>
            </div>

            <Button
              onClick={handleStart}
              className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              시작하기
            </Button>
          </div>

          <div className="mt-6 sm:mt-8 space-y-3 bg-gray-50 rounded-2xl p-4 sm:p-6">
            <h3 className="font-bold text-gray-800 text-center mb-2 text-sm sm:text-base">📱 사용 방법</h3>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600">
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <p>각자 화면에 손가락을 하나씩 대세요</p>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <p>설정한 인원 이상이 터치하면 카운트다운 시작</p>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <p>3초간 모두 손가락을 유지하면 자동 추첨!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
