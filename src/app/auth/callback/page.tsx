'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          // 사용자 정보를 데이터베이스에 저장/업데이트
          const { user } = data.session;

          const { error: upsertError } = await supabase.from('users').upsert({
            id: user.id,
            email: user.email || `kakao_${user.id}@temp.com`, // 카카오는 이메일 없을 수 있음
            name:
              user.user_metadata?.nickname ||
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              '카카오 사용자',
            profile_image: user.user_metadata?.picture || user.user_metadata?.avatar_url,
            provider: user.app_metadata?.provider || 'email',
          });

          if (upsertError) {
            console.error('User upsert error:', upsertError);
          }

          // 성공적으로 로그인됨 - 홈으로 리디렉트
          router.push('/');
        } else {
          // 세션이 없음 - 로그인 페이지로 리디렉트
          router.push('/auth/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError(error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다');
      }
    };

    handleAuthCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600 mb-2">로그인 오류</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
}
