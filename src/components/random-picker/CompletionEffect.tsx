'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CompletionMessageProps {
  isComplete: boolean;
}

export default function CompletionEffect({ isComplete }: CompletionMessageProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isComplete) {
      setShow(true);
      // 1.8초 후 컴포넌트 제거 (애니메이션이 완전히 끝난 후)
      const timer = setTimeout(() => {
        setShow(false);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center"
      style={{
        transform: 'translateZ(0)',
        willChange: 'auto',
        isolation: 'isolate',
      }}
    >
      {/* 빛나는 원형 파동 효과들 */}
      <div
        className="relative"
        style={{
          width: '400px',
          height: '400px',
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
        }}
      >
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, rgba(236, 72, 153, 0.2) 50%, rgba(251, 191, 36, 0.1) 100%)',
            }}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{
              scale: 2.5,
              opacity: 0,
            }}
            transition={{
              duration: 1.5,
              delay: i * 0.15,
              ease: [0.16, 1, 0.3, 1], // ease-out-expo for smooth fade
            }}
          />
        ))}

        {/* 중앙 밝은 섬광 */}
        <motion.div
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: '150px',
            height: '150px',
            background:
              'radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, rgba(236, 72, 153, 0.4) 50%, rgba(147, 51, 234, 0.2) 100%)',
            filter: 'blur(20px)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: 1.5,
            opacity: 0,
          }}
          transition={{
            duration: 1.5,
            ease: [0.16, 1, 0.3, 1], // ease-out-expo for smooth fade
          }}
        />
      </div>
    </div>
  );
}
