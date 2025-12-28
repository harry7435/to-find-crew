'use client';

import { motion } from 'framer-motion';

interface CountdownTimerProps {
  countdown: number | null;
  totalDuration: number;
}

export default function CountdownTimer({ countdown }: CountdownTimerProps) {
  if (countdown === null) return null;

  const seconds = Math.ceil(countdown / 1000); // 올림 처리

  // 0이면 표시하지 않음
  if (seconds <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
    >
      <motion.div
        key={seconds}
        initial={{ scale: 1.5, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 0.6 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="flex items-center justify-center"
      >
        <p
          className="font-bold text-purple-600"
          style={{
            fontSize: '200px',
            lineHeight: '1',
            opacity: '0.6',
            textShadow:
              '0 0 30px rgba(147, 51, 234, 0.6), 0 0 60px rgba(147, 51, 234, 0.4), 0 0 90px rgba(147, 51, 234, 0.2), 0 8px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          {seconds}
        </p>
      </motion.div>
    </motion.div>
  );
}
