'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';

interface TouchPointProps {
  x: number;
  y: number;
  index: number;
  colorIndex: number;
  isWinner: boolean;
}

// HSL을 사용해 동적으로 색깔 생성 (무한대 지원)
const generateColor = (colorIndex: number): string => {
  // 색상환을 균등하게 분배 (0-360도)
  const hue = (colorIndex * 137.5) % 360; // 황금각(137.5도)을 사용해 균등 분배
  const saturation = 70; // 채도 70%
  const lightness = 55; // 밝기 55%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export default function TouchPoint({ x, y, index, colorIndex, isWinner }: TouchPointProps) {
  // colorIndex로 동적으로 색깔 생성
  const color = generateColor(colorIndex);

  // 렌더링 중에 체크 - 첫 렌더링인지 확인
  const hasRendered = useRef(false);
  const initial = hasRendered.current ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 };
  hasRendered.current = true;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)', // 터치 위치를 중심으로
      }}
    >
      <motion.div
        initial={initial}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{
          scale: { type: 'spring', stiffness: 300, damping: 20 },
          opacity: { type: 'spring', stiffness: 300, damping: 20 },
        }}
        style={{
          transformOrigin: 'center center', // scale이 중앙 기준으로 적용
        }}
      >
        {!isWinner ? (
          // 일반 터치 포인트
          <div
            className="relative"
            style={{
              width: '64px',
              height: '64px',
            }}
          >
            {/* 반짝이는 원 효과 (배경) */}
            <motion.div
              className="absolute rounded-full opacity-50"
              style={{
                width: '64px',
                height: '64px',
                left: '0',
                top: '0',
                backgroundColor: color,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            {/* 메인 원 */}
            <div
              className="absolute inset-0 rounded-full shadow-lg flex items-center justify-center"
              style={{
                backgroundColor: color,
              }}
            >
              <span className="text-white text-2xl font-bold">{index + 1}</span>
            </div>
          </div>
        ) : (
          // 당첨자 표시
          <div
            className="relative"
            style={{
              width: '64px',
              height: '64px',
            }}
          >
            {/* 반짝이는 glow 효과 (배경) */}
            <motion.div
              className="absolute bg-yellow-400 rounded-full opacity-30 blur-xl"
              style={{
                width: '80px',
                height: '80px',
                left: '-8px',
                top: '-8px',
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* 이모지 */}
            <motion.div
              initial={{ scale: 0, rotate: 0 }}
              animate={{
                scale: 1,
                rotate: 360,
                y: [0, -10, 0], // 통통 튀는 애니메이션
              }}
              transition={{
                scale: {
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                },
                rotate: {
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                },
                y: {
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                className="text-6xl leading-none flex items-center justify-center"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                🎉
              </div>
            </motion.div>

            {/* 당첨 라벨 */}
            <div
              className="absolute whitespace-nowrap"
              style={{
                bottom: '-32px',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                당첨 #{index + 1}
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
