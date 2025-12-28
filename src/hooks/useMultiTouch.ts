import { useState, useEffect, useCallback, useRef } from 'react';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
  identifier: number; // 터치 고유 식별자
  colorIndex: number; // 색깔 인덱스 추가
}

interface UseMultiTouchResult {
  touches: TouchPoint[];
  countdown: number | null;
  winners: TouchPoint[];
  isComplete: boolean;
  reset: () => void;
  currentTouchCount: number;
  setTouches: React.Dispatch<React.SetStateAction<TouchPoint[]>>;
}

const COUNTDOWN_DURATION = 3000; // 3초
const COUNTDOWN_INTERVAL = 100; // 0.1초마다 업데이트

export const useMultiTouch = (targetCount: number): UseMultiTouchResult => {
  const [touches, setTouches] = useState<TouchPoint[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winners, setWinners] = useState<TouchPoint[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const touchIdCounterRef = useRef(0);
  const previousTouchCountRef = useRef<number>(0);

  // 카운트다운 시작
  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    lastUpdateRef.current = Date.now();
    setCountdown(COUNTDOWN_DURATION);

    countdownTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastUpdateRef.current;

      setCountdown((prev) => {
        if (prev === null) return null;
        const newCountdown = Math.max(0, prev - elapsed);
        lastUpdateRef.current = now;
        return newCountdown;
      });
    }, COUNTDOWN_INTERVAL);
  }, []);

  // 카운트다운 중지
  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  }, []);

  // 리셋
  const reset = useCallback(() => {
    stopCountdown();
    setTouches([]);
    setWinners([]);
    setIsComplete(false);
    setCountdown(null);
    touchIdCounterRef.current = 0;
  }, [stopCountdown]);

  // 당첨자 선정
  const selectWinners = useCallback(
    (currentTouches: TouchPoint[]) => {
      if (currentTouches.length < targetCount) {
        // 참가자가 목표 인원보다 적으면 모두 당첨
        setWinners([...currentTouches]);
      } else {
        // 랜덤으로 선정
        const shuffled = [...currentTouches].sort(() => Math.random() - 0.5);
        setWinners(shuffled.slice(0, targetCount));
      }
      setIsComplete(true);
    },
    [targetCount],
  );

  // 터치 변경 감지 및 카운트다운 관리
  useEffect(() => {
    if (isComplete) return;

    const touchCount = touches.length;
    const previousTouchCount = previousTouchCountRef.current;

    // 터치 수가 변경되었는지 확인
    const touchCountChanged = touchCount !== previousTouchCount;

    if (touchCountChanged) {
      previousTouchCountRef.current = touchCount;

      // 터치 수가 변경되면 카운트다운 리셋
      if (countdown !== null) {
        stopCountdown();
      }
    }

    if (touchCount === 0) {
      // 터치가 없으면 카운트다운 중지
      stopCountdown();
    } else if (touchCount > targetCount) {
      // 목표 인원보다 많으면 카운트다운 시작
      if (countdown === null) {
        // 터치 수가 변경된 직후에는 짧은 딜레이 후 시작
        if (touchCountChanged) {
          const timeoutId = setTimeout(() => {
            startCountdown();
          }, 100); // 100ms 안정화 시간
          return () => clearTimeout(timeoutId);
        } else {
          startCountdown();
        }
      }
    } else {
      // 목표 인원 이하면 카운트다운 중지
      stopCountdown();
    }
  }, [touches.length, targetCount, countdown, isComplete, startCountdown, stopCountdown]);

  // 카운트다운 완료 체크
  useEffect(() => {
    if (countdown !== null && countdown <= 0 && !isComplete) {
      stopCountdown();
      selectWinners(touches);
    }
  }, [countdown, isComplete, touches, stopCountdown, selectWinners]);

  // 클린업
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  return {
    touches,
    countdown,
    winners,
    isComplete,
    reset,
    currentTouchCount: touches.length,
    setTouches,
  };
};
