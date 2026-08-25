import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import AppShell from '@/components/layout/AppShell';
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'To Find Crew',
  description: '스포츠 크루를 찾고 정보를 공유해요',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'To Find Crew',
  },
  icons: {
    icon: '/icons/icon_to_find_crew.png',
    apple: '/icons/icon_to_find_crew.png',
  },
};

export const viewport = {
  themeColor: '#1E3A8A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
          {/* 헤더가 fixed h-16(64px)이라 상단 오프셋으로 헤더와 겹치지 않게 띄운다.
              bottom-right는 태블릿 이상에서 보드 페이지의 대기자 풀(인원 풀) 카드를 가려서 top-center로 변경 — 관련 피드백 2026-08-24.
              기본 노출 시간(1초)·탭으로 닫기 동작은 components/ui/sonner.tsx의 래퍼에서 처리한다. */}
          <Toaster position="top-center" offset="80px" />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
