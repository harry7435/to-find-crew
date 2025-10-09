'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const { signInWithKakao, signInWithEmail } = useAuth();

  const handleKakaoLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithKakao();
    } catch (error) {
      console.error('Login error:', error);
      toast.error('카카오 로그인에 실패했습니다', {
        description: '다시 시도하거나 이메일 로그인을 사용해주세요',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('이메일을 입력해주세요');
      return;
    }

    try {
      setIsLoading(true);
      await signInWithEmail(email);
      setEmailSent(true);
      toast.success('로그인 링크를 이메일로 전송했습니다', {
        description: '이메일을 확인해주세요',
      });
    } catch (error) {
      console.error('Email login error:', error);
      toast.error('이메일 전송에 실패했습니다', {
        description: '다시 시도해주세요',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* 뒤로가기 버튼 */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🏸 To Find Crew</CardTitle>
            <CardDescription>모임 및 번개에 참여하려면 로그인이 필요합니다</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {emailSent ? (
              <div className="text-center space-y-4">
                <div className="text-green-600">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium">이메일을 확인해주세요</h3>
                <p className="text-sm text-gray-600">
                  <strong>{email}</strong>로 로그인 링크를 전송했습니다.
                  <br />
                  이메일을 확인하고 링크를 클릭해주세요.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail('');
                  }}
                  className="w-full"
                >
                  다른 이메일로 로그인
                </Button>
              </div>
            ) : (
              <>
                {/* 카카오 로그인 버튼 */}
                <Button
                  onClick={handleKakaoLogin}
                  disabled={isLoading}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      로그인 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11L7.14 21.818c-.264.159-.59.031-.679-.267l-.679-2.27C3.743 17.847 1.5 15.176 1.5 11.185 1.5 6.665 6.201 3 12 3Z"
                        />
                      </svg>
                      카카오톡으로 시작하기
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">또는</span>
                  </div>
                </div>

                {/* 이메일 로그인 폼 */}
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div>
                    <label htmlFor="email" className="sr-only">
                      이메일
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="이메일 주소"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    variant="outline"
                    className="w-full border border-gray-300"
                  >
                    {isLoading ? '전송 중...' : '이메일로 로그인'}
                  </Button>
                </form>
              </>
            )}

            <p className="text-center text-sm text-gray-600 space-y-2">✨ 간편한 소셜 로그인으로 빠르게 시작하세요</p>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-xs text-gray-500">
          로그인하면{' '}
          <Link href="/terms" className="underline">
            서비스 이용약관
          </Link>
          과{' '}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
          에 동의하게 됩니다.
        </div>
      </div>
    </div>
  );
}
