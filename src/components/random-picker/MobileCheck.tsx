'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface MobileCheckProps {
  children: React.ReactNode;
}

export default function MobileCheck({ children }: MobileCheckProps) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // User agent 체크
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some((keyword) => userAgent.includes(keyword));

      // 터치 지원 체크
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // 화면 크기 체크
      const screenWidth = window.innerWidth;
      const isMobileWidth = screenWidth < 768;

      setIsMobile(isMobileDevice || (hasTouchScreen && isMobileWidth));
      setIsSmallScreen(screenWidth < 375); // iPhone SE 기준
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 로딩 중
  if (isMobile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
        <div className="text-white text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  // 모바일이 아닌 경우
  if (!isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center"
        >
          <div className="text-6xl mb-6">📱</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">모바일 전용 서비스입니다</h2>
          <p className="text-gray-600 mb-6">
            이 페이지는 모바일 기기에서만 사용할 수 있습니다.
            <br />
            스마트폰이나 태블릿에서 접속해주세요.
          </p>
          <div className="bg-gray-100 rounded-2xl p-4 text-sm text-gray-700">
            <p className="font-semibold mb-2">💡 Tip</p>
            <p>QR 코드를 생성하거나 URL을 모바일 기기로 전송해보세요.</p>
          </div>
          <Button
            onClick={() => (window.location.href = '/')}
            className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            홈으로 돌아가기
          </Button>
        </motion.div>
      </div>
    );
  }

  // 화면이 너무 작은 경우 경고
  if (isSmallScreen) {
    return (
      <div className="relative">
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-400 text-yellow-900 rounded-xl p-3 shadow-lg text-sm text-center"
          >
            <p className="font-semibold">⚠️ 화면이 작습니다</p>
            <p className="text-xs mt-1">더 큰 화면에서 사용을 권장합니다</p>
          </motion.div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
